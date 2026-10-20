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

  constructor(
    private readonly em: EntityManager,
    adapters: BrokerAdapter[] = buildAdapters(process.env),
    env: NodeJS.ProcessEnv = process.env,
  ) {
    for (const a of adapters) this.adapters.set(a.id, a);
    this.symbols = (env.TWELVE_DATA_SYMBOL ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    this.defaultSize = Number(env.EXECUTION_DEFAULT_SIZE) || 1000;
    this.maxSize = Number(env.EXECUTION_MAX_SIZE) || 10000;
  }

  get defaultBroker(): BrokerAdapter | null {
    for (const a of this.adapters.values()) if (a.id !== 'manual') return a;
    return null;
  }

  config() {
    return {
      brokers: [...this.adapters.values()].map((a) => ({
        id: a.id,
        label: a.label,
        live: a.live,
      })),
      defaultBroker: this.defaultBroker?.id ?? 'manual',
      symbols: this.symbols,
      defaultSize: this.defaultSize,
      maxSize: this.maxSize,
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
    if (!(size > 0) || size > this.maxSize)
      throw new ExecutionError(
        `Tamaño inválido: debe estar entre 1 y ${this.maxSize}`,
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

  async openFromSignal(pendingSignalId: number) {
    const em = this.em.fork();
    const signal = await em.findOne(PendingSignal, pendingSignalId);
    if (!signal)
      throw new ExecutionError(`La alerta #${pendingSignalId} no existe`, 404);
    const log = await em.findOne(AlertLog, { pendingSignalId });
    return this.open({
      symbol: signal.symbol,
      direction: signal.direction,
      stopLevel: num(signal.slPrice) ?? undefined,
      source: 'telegram',
      pendingSignalId,
      alertLogId: log?.id,
    });
  }

  async close(id: number) {
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
    row.closeReason = res.alreadyClosed ? 'ya-cerrada-en-broker' : 'manual';
    await em.flush();
    console.log(
      `[Ejecución] #${row.id} ${row.broker} ${row.symbol} cerrada (${row.closeReason}).`,
    );
    return this.view(row);
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
      openedAt: r.openedAt,
      closedAt: r.closedAt ?? null,
      closeReason: r.closeReason ?? null,
      note: r.note ?? null,
    };
  }
}
