import * as fs from 'fs';
import * as path from 'path';
import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/mysql';
import { PendingSignal } from '../trade/pending-signal.entity';
import { AlertLog } from '../alerts/alert-log.entity';
import { BrokerError, type BrokerAdapter, type Direction } from './broker.types';
import { ManualAdapter } from './manual.adapter';
import {
  CapitalAdapter,
  capitalConfigFromEnv,
} from './capital/capital.adapter';
import {
  ExecutionPosition,
  type ExecutionSource,
} from './execution-position.entity';

export type OpenInput = {
  broker?: string;
  symbol: string;
  direction: Direction;
  size?: number;
  stopLevel?: number;
  profitLevel?: number;
  source: ExecutionSource;
  pendingSignalId?: number;
  alertLogId?: number;
  sizeLimit?: number;
};

export class ExecutionError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export function buildAdapters(env: NodeJS.ProcessEnv): BrokerAdapter[] {
  const adapters: BrokerAdapter[] = [];
  const capital = capitalConfigFromEnv(env);
  if (capital) adapters.push(new CapitalAdapter(capital));
  adapters.push(new ManualAdapter());
  return adapters;
}

const num = (v: unknown): number | null =>
  v === null || v === undefined ? null : Number(v);

@Injectable()
export class ExecutionService {
  private readonly adapters = new Map<string, BrokerAdapter>();
  private readonly busySymbols = new Set<string>();
  readonly symbols: string[];
  readonly defaultSize: number;
  readonly maxSize: number;
  readonly riskUsd: number;
  readonly riskMaxSize: number;
  readonly brokerStop: boolean;
  private readonly allowAutoLive: boolean;
  private auto: boolean;

  constructor(
    private readonly em: EntityManager,
    adapters: BrokerAdapter[] = buildAdapters(process.env),
    env: NodeJS.ProcessEnv = process.env,
    private readonly settingsFile = path.join(
      process.cwd(),
      'execution_settings.json',
    ),
  ) {
    for (const a of adapters) this.adapters.set(a.id, a);
    this.allowAutoLive = env.EXECUTION_AUTO_LIVE === 'true';
    this.auto = this.readSettings()?.auto ?? env.EXECUTION_AUTO === 'true';
    this.symbols = (env.TWELVE_DATA_SYMBOL ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    this.defaultSize = Number(env.EXECUTION_DEFAULT_SIZE) || 1000;
    this.maxSize = Number(env.EXECUTION_MAX_SIZE) || 10000;
    this.riskUsd = Number(env.EXECUTION_RISK_USD) || 20;
    this.riskMaxSize = Number(env.EXECUTION_RISK_MAX_SIZE) || 50000;
    this.brokerStop = env.EXECUTION_BROKER_STOP === 'true';
  }

  adapter(id: string): BrokerAdapter | undefined {
    return this.adapters.get(id);
  }

  get defaultBroker(): BrokerAdapter | null {
    for (const a of this.adapters.values()) if (a.id !== 'manual') return a;
    return null;
  }

  get autoAllowed(): boolean {
    const broker = this.defaultBroker;
    return !!broker && (!broker.live || this.allowAutoLive);
  }

  get autoEnabled(): boolean {
    return this.auto && this.autoAllowed;
  }

  setAuto(enabled: boolean) {
    if (enabled && !this.autoAllowed)
      throw new ExecutionError(
        this.defaultBroker
          ? 'La entrada automática en cuenta real exige EXECUTION_AUTO_LIVE=true'
          : 'No hay broker configurado para la entrada automática',
        400,
      );
    this.auto = enabled;
    try {
      fs.writeFileSync(this.settingsFile, JSON.stringify({ auto: enabled }));
    } catch (err) {
      console.error('[Ejecución] No se pudo guardar la configuración:', err);
    }
    console.log(
      `[Ejecución] Entrada automática ${enabled ? 'ACTIVADA' : 'desactivada'}.`,
    );
    return this.config();
  }

  private readSettings(): { auto?: boolean } | null {
    try {
      return JSON.parse(fs.readFileSync(this.settingsFile, 'utf8'));
    } catch {
      return null;
    }
  }

  config() {
    return {
      auto: this.autoEnabled,
      autoAllowed: this.autoAllowed,
      brokers: [...this.adapters.values()].map((a) => ({
        id: a.id,
        label: a.label,
        live: a.live,
      })),
      defaultBroker: this.defaultBroker?.id ?? 'manual',
      symbols: this.symbols,
      defaultSize: this.defaultSize,
      maxSize: this.maxSize,
      riskUsd: this.riskUsd,
      riskMaxSize: this.riskMaxSize,
      brokerStop: this.brokerStop,
    };
  }

  async openPositionFor(symbol: string): Promise<ExecutionPosition | null> {
    return this.em
      .fork()
      .findOne(ExecutionPosition, { symbol, status: 'open' });
  }

  async list(status?: string, limit = 50) {
    const where = status ? { status: status as any } : {};
    const rows = await this.em.fork().find(ExecutionPosition, where, {
      orderBy: { openedAt: 'DESC' },
      limit,
    });
    return rows.map((r) => this.view(r));
  }

  async open(input: OpenInput) {
    const symbol = input.symbol?.trim();
    if (!this.symbols.includes(symbol))
      throw new ExecutionError(
        `Símbolo no configurado: ${symbol}. Disponibles: ${this.symbols.join(', ')}`,
        400,
      );
    if (input.direction !== 'BUY' && input.direction !== 'SELL')
      throw new ExecutionError('La dirección debe ser BUY o SELL', 400);
    const size = input.size ?? this.defaultSize;
    const limit = input.sizeLimit ?? this.maxSize;
    if (!(size > 0) || size > limit)
      throw new ExecutionError(
        `Tamaño inválido: debe estar entre 1 y ${limit}`,
        400,
      );
    const adapter = this.adapters.get(
      input.broker ?? this.defaultBroker?.id ?? 'manual',
    );
    if (!adapter)
      throw new ExecutionError(`Broker no disponible: ${input.broker}`, 400);

    if (this.busySymbols.has(symbol))
      throw new ExecutionError(`Ya se está abriendo ${symbol}`, 409);
    this.busySymbols.add(symbol);
    try {
      const existing = await this.openPositionFor(symbol);
      if (existing)
        throw new ExecutionError(
          `${symbol} ya tiene una operación abierta (#${existing.id}). Ciérrala primero.`,
          409,
        );

      const em = this.em.fork();
      const row = new ExecutionPosition();
      row.broker = adapter.id;
      row.live = adapter.live;
      row.symbol = symbol;
      row.direction = input.direction;
      row.size = size;
      row.source = input.source;
      row.pendingSignalId = input.pendingSignalId;
      row.alertLogId = input.alertLogId;
      row.stopLevel = input.stopLevel;
      row.profitLevel = input.profitLevel;
      row.openedAt = new Date(Date.now());

      try {
        const res = await adapter.open({
          symbol,
          direction: input.direction,
          size,
          stopLevel: input.stopLevel,
          profitLevel: input.profitLevel,
        });
        row.status = 'open';
        row.brokerSymbol = res.brokerSymbol;
        row.dealId = res.dealId ?? undefined;
        row.dealReference = res.dealReference ?? undefined;
        row.openPrice = res.level ?? undefined;
        if (!res.confirmed)
          row.note =
            'El broker no confirmó a tiempo: revisar en la plataforma antes de abrir otra.';
      } catch (err) {
        row.status = 'failed';
        row.note = String(err instanceof Error ? err.message : err).slice(
          0,
          255,
        );
        em.persist(row);
        await em.flush();
        throw new ExecutionError(
          row.note,
          err instanceof BrokerError ? 502 : 500,
        );
      }
      em.persist(row);
      await em.flush();
      console.log(
        `[Ejecución] #${row.id} ${adapter.id} ${symbol} ${input.direction} ${size} abierta (${input.source}).`,
      );
      return this.view(row);
    } finally {
      this.busySymbols.delete(symbol);
    }
  }

  async openFromSignal(
    pendingSignalId: number,
    source: ExecutionSource = 'telegram',
  ) {
    const em = this.em.fork();
    const signal = await em.findOne(PendingSignal, pendingSignalId);
    if (!signal)
      throw new ExecutionError(`La alerta #${pendingSignalId} no existe`, 404);
    const log = await em.findOne(AlertLog, { pendingSignalId });
    const contract = log?.features?.contract as
      | { size?: number; target?: number }
      | undefined;
    return this.open({
      symbol: signal.symbol,
      direction: signal.direction,
      stopLevel: this.brokerStop ? (num(signal.slPrice) ?? undefined) : undefined,
      profitLevel: contract?.target,
      size: contract?.size || undefined,
      sizeLimit: contract?.size ? this.riskMaxSize : undefined,
      source,
      pendingSignalId,
      alertLogId: log?.id,
    });
  }

  async alertsWithPositions(limit: number) {
    const em = this.em.fork();
    const alerts = await em.find(
      AlertLog,
      { version: 'v3' },
      { orderBy: { id: 'DESC' }, limit },
    );
    const ids = alerts.map((a) => a.id);
    const positions = ids.length
      ? await em.find(ExecutionPosition, { alertLogId: { $in: ids } }, { orderBy: { id: 'ASC' } })
      : [];
    const byAlert = new Map<number, ExecutionPosition>();
    for (const p of positions) {
      if (p.alertLogId === null || p.alertLogId === undefined) continue;
      const prev = byAlert.get(p.alertLogId);
      if (!prev || prev.status === 'failed') byAlert.set(p.alertLogId, p);
    }
    return alerts.map((a) => ({ alert: a, position: byAlert.get(a.id) ?? null }));
  }

  async positionForAlert(alertLogId: number): Promise<ExecutionPosition | null> {
    return this.em
      .fork()
      .findOne(ExecutionPosition, { alertLogId }, { orderBy: { id: 'DESC' } });
  }

  async openForAlert(alertLogId: number): Promise<ExecutionPosition | null> {
    return this.em
      .fork()
      .findOne(ExecutionPosition, { alertLogId, status: 'open' });
  }

  async close(id: number, reason = 'manual') {
    const em = this.em.fork();
    const row = await em.findOne(ExecutionPosition, id);
    if (!row) throw new ExecutionError(`La operación #${id} no existe`, 404);
    if (row.status !== 'open')
      throw new ExecutionError(`La operación #${id} no está abierta`, 409);
    const adapter = this.adapters.get(row.broker);
    if (!adapter)
      throw new ExecutionError(
        `El broker ${row.broker} ya no está configurado; no se puede cerrar desde aquí`,
        409,
      );
    let res;
    try {
      res = await adapter.close({
        symbol: row.symbol,
        dealId: row.dealId ?? null,
        dealReference: row.dealReference ?? null,
      });
    } catch (err) {
      throw new ExecutionError(
        String(err instanceof Error ? err.message : err),
        err instanceof BrokerError ? 502 : 500,
      );
    }
    row.status = 'closed';
    row.closedAt = new Date(Date.now());
    row.closePrice = res.level ?? undefined;
    row.closeReason = res.alreadyClosed ? 'ya-cerrada-en-broker' : reason;
    const deal = await this.settledDeal(adapter, row);
    if (deal) {
      if (deal.level !== null) row.closePrice = deal.level;
      if (deal.pnl !== null) row.realizedPnl = deal.pnl;
      if (deal.source) row.closeSource = deal.source;
      if (deal.at && res.alreadyClosed) row.closedAt = deal.at;
    }
    await em.flush();
    console.log(
      `[Ejecución] #${row.id} ${row.broker} ${row.symbol} cerrada (${row.closeReason}).`,
    );
    return this.view(row);
  }

  private async settledDeal(adapter: BrokerAdapter, row: ExecutionPosition) {
    if (!adapter.closedDeal || !row.dealId) return null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const deal = await adapter.closedDeal(row.dealId, row.openedAt);
        if (deal && deal.pnl !== null) return deal;
        if (deal && attempt === 2) return deal;
      } catch (err) {
        console.warn(
          `[Ejecución] #${row.id}: no se pudo leer el cierre real en ${row.broker}:`,
          err instanceof Error ? err.message : err,
        );
        return null;
      }
      await new Promise((r) => setTimeout(r, 1500));
    }
    return null;
  }

  viewOf(r: ExecutionPosition) {
    return this.view(r);
  }

  private view(r: ExecutionPosition) {
    return {
      id: r.id,
      broker: r.broker,
      brokerLabel: this.adapters.get(r.broker)?.label ?? r.broker,
      live: r.live,
      symbol: r.symbol,
      direction: r.direction,
      size: num(r.size),
      status: r.status,
      source: r.source,
      alertLogId: r.alertLogId ?? null,
      pendingSignalId: r.pendingSignalId ?? null,
      dealId: r.dealId ?? null,
      openPrice: num(r.openPrice),
      stopLevel: num(r.stopLevel),
      profitLevel: num(r.profitLevel),
      closePrice: num(r.closePrice),
      realizedPnl: num(r.realizedPnl),
      closeSource: r.closeSource ?? null,
      openedAt: r.openedAt,
      trackingSince: r.trackingSince ?? null,
      entrySpread: num(r.entrySpread),
      brokerGoneAt: r.brokerGoneAt ?? null,
      closedAt: r.closedAt ?? null,
      closeReason: r.closeReason ?? null,
      note: r.note ?? null,
    };
  }
}
