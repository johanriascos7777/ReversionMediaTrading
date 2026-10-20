import {
  Injectable,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { EntityManager } from '@mikro-orm/mysql';
import type { BrokerAdapter, BrokerPositionMark } from '../broker.types';
import { ExecutionPosition } from '../execution-position.entity';
import { ExecutionService } from '../execution.service';
import { ExecutionPnlPhase, type PnlModel } from './pnl-phase.entity';
import { ExecutionPnlSample } from './pnl-sample.entity';
import {
  PNL_MODELS,
  applyPnl,
  currencies,
  phaseView,
  pnlModels,
  summarize,
  type ModelSummary,
  type PhaseView,
} from './pnl';

const SAMPLE_EVERY_MS = 60_000;
const FX_TTL_MS = 60_000;
const MISSING_TICKS_TO_GIVE_UP = 3;
const FRESH_POSITION_MS = 120_000;

export type LiveMark = {
  at: Date;
  bid: number;
  offer: number;
  spread: number;
  upl: number | null;
  capital: number;
  pip1: number;
};

export type PositionTracking = {
  live: LiveMark | null;
  models: Record<PnlModel, ModelSummary>;
};

@Injectable()
export class ExecutionTrackerService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  readonly intervalMs: number;
  readonly accountCurrency: string;
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private readonly missing = new Map<number, number>();
  private readonly lastSample = new Map<number, number>();
  private readonly live = new Map<number, LiveMark>();
  private readonly fxCache = new Map<string, { value: number; at: number }>();

  constructor(
    private readonly em: EntityManager,
    private readonly execution: ExecutionService,
    env: NodeJS.ProcessEnv = process.env,
  ) {
    this.intervalMs = Math.max(Number(env.EXECUTION_TRACK_MS) || 3000, 1000);
    this.accountCurrency = (env.EXECUTION_ACCOUNT_CURRENCY ?? 'USD')
      .trim()
      .toUpperCase();
  }

  onApplicationBootstrap() {
    this.timer = setInterval(() => void this.tick(), this.intervalMs);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async tick(now: Date = new Date()) {
    if (this.running) return;
    this.running = true;
    try {
      await this.run(now);
    } catch (err) {
      console.error(
        '[Seguimiento] Falló una lectura:',
        err instanceof Error ? err.message : err,
      );
    } finally {
      this.running = false;
    }
  }

  private async run(now: Date) {
    const em = this.em.fork();
    const open = await em.find(ExecutionPosition, { status: 'open' });
    const openPhases = await em.find(ExecutionPnlPhase, { endedAt: null });
    const openIds = new Set(open.map((p) => p.id));

    for (const phase of openPhases) {
      if (openIds.has(phase.positionId)) continue;
      const pos = await em.findOne(ExecutionPosition, phase.positionId);
      phase.endedAt = pos?.closedAt ?? phase.lastSeenAt;
      this.forget(phase.positionId);
    }

    const byBroker = new Map<string, ExecutionPosition[]>();
    for (const row of open) {
      if (row.brokerGoneAt) continue;
      const adapter = this.execution.adapter(row.broker);
      if (!adapter?.positions) continue;
      byBroker.set(row.broker, [...(byBroker.get(row.broker) ?? []), row]);
    }

    for (const [brokerId, rows] of byBroker) {
      const adapter = this.execution.adapter(brokerId)!;
      const marks = await adapter.positions!();
      for (const row of rows) {
        const mark = this.findMark(marks, row);
        if (!mark) {
          this.handleMissing(row, openPhases, now);
          continue;
        }
        this.missing.delete(row.id);
        await this.track(em, adapter, row, mark, openPhases, now);
      }
    }
    await em.flush();
  }

  private findMark(marks: BrokerPositionMark[], row: ExecutionPosition) {
    return (
      marks.find((m) => row.dealId && m.dealId === row.dealId) ??
      marks.find(
        (m) =>
          !!row.dealReference &&
          !!m.dealReference &&
          m.dealReference.slice(2) === row.dealReference.slice(2),
      ) ??
      null
    );
  }

  private handleMissing(
    row: ExecutionPosition,
    openPhases: ExecutionPnlPhase[],
    now: Date,
  ) {
    const count = (this.missing.get(row.id) ?? 0) + 1;
    this.missing.set(row.id, count);
    if (count < MISSING_TICKS_TO_GIVE_UP) return;
    row.brokerGoneAt = now;
    for (const phase of openPhases)
      if (phase.positionId === row.id) phase.endedAt = phase.lastSeenAt;
    this.forget(row.id);
    console.log(
      `[Seguimiento] #${row.id} ${row.symbol} ya no está abierta en ${row.broker}; se deja de seguir.`,
    );
  }

  private async track(
    em: EntityManager,
    adapter: BrokerAdapter,
    row: ExecutionPosition,
    mark: BrokerPositionMark,
    openPhases: ExecutionPnlPhase[],
    now: Date,
  ) {
    const fx = await this.fx(adapter, row.symbol);
    if (fx === null) return;
    if (!row.trackingSince)
      row.trackingSince =
        now.getTime() - new Date(row.openedAt).getTime() < FRESH_POSITION_MS
          ? row.openedAt
          : now;
    if (row.entrySpread === null || row.entrySpread === undefined)
      row.entrySpread = mark.offer - mark.bid;

    const values = pnlModels({
      symbol: row.symbol,
      direction: row.direction,
      size: Number(row.size),
      level: Number(row.openPrice ?? mark.level),
      bid: mark.bid,
      offer: mark.offer,
      upl: mark.upl,
      entrySpread: Number(row.entrySpread),
      fx,
    });

    for (const model of PNL_MODELS) {
      const current =
        openPhases.find((p) => p.positionId === row.id && p.model === model) ??
        null;
      const res = applyPnl(
        current,
        values[model],
        now,
        row.trackingSince,
        this.intervalMs * 3,
      );
      if (res.created) {
        const phase = Object.assign(new ExecutionPnlPhase(), res.active, {
          positionId: row.id,
          model,
        });
        em.persist(phase);
        openPhases.push(phase);
        if (res.ended) openPhases.splice(openPhases.indexOf(res.ended), 1);
      }
    }

    this.live.set(row.id, {
      at: now,
      bid: mark.bid,
      offer: mark.offer,
      spread: values.spread,
      upl: mark.upl,
      capital: values.capital,
      pip1: values.pip1,
    });

    const last = this.lastSample.get(row.id) ?? 0;
    if (now.getTime() - last >= SAMPLE_EVERY_MS) {
      this.lastSample.set(row.id, now.getTime());
      em.persist(
        Object.assign(new ExecutionPnlSample(), {
          positionId: row.id,
          at: now,
          bid: mark.bid,
          offer: mark.offer,
          upl: mark.upl,
          pnlCapital: values.capital,
          pnlPip1: values.pip1,
        }),
      );
    }
  }

  private async fx(adapter: BrokerAdapter, symbol: string) {
    const { base, quote } = currencies(symbol);
    const acct = this.accountCurrency;
    if (quote === acct) return 1;
    const cached = this.fxCache.get(quote);
    if (cached && Date.now() - cached.at < FX_TTL_MS) return cached.value;
    let value: number | null = null;
    try {
      if (base === acct) {
        const q = (await adapter.quotes?.([symbol]))?.[symbol];
        if (q) value = 2 / (q.bid + q.offer);
      } else {
        const direct = `${quote}/${acct}`;
        const q = (await adapter.quotes?.([direct]))?.[direct];
        if (q) value = (q.bid + q.offer) / 2;
        else {
          const inverse = `${acct}/${quote}`;
          const qi = (await adapter.quotes?.([inverse]))?.[inverse];
          if (qi) value = 2 / (qi.bid + qi.offer);
        }
      }
    } catch (err) {
      console.error(
        `[Seguimiento] Sin tasa ${quote}/${acct}:`,
        err instanceof Error ? err.message : err,
      );
    }
    if (value === null) return cached?.value ?? null;
    this.fxCache.set(quote, { value, at: Date.now() });
    return value;
  }

  private forget(id: number) {
    this.missing.delete(id);
    this.lastSample.delete(id);
    this.live.delete(id);
  }

  async phases(positionId: number) {
    const em = this.em.fork();
    const rows = await em.find(
      ExecutionPnlPhase,
      { positionId },
      { orderBy: { seq: 'ASC' } },
    );
    const now = new Date();
    const out = {} as Record<PnlModel, PhaseView[]>;
    for (const model of PNL_MODELS)
      out[model] = rows
        .filter((r) => r.model === model)
        .map((r) => phaseView(r, now));
    return out;
  }

  async tracking(
    positions: { id: number; trackingSince: Date | null }[],
  ): Promise<Record<number, PositionTracking>> {
    const out: Record<number, PositionTracking> = {};
    for (const p of positions) {
      const phases = await this.phases(p.id);
      const models = {} as Record<PnlModel, ModelSummary>;
      for (const model of PNL_MODELS)
        models[model] = summarize(phases[model], p.trackingSince);
      out[p.id] = { live: this.live.get(p.id) ?? null, models };
    }
    return out;
  }
}
