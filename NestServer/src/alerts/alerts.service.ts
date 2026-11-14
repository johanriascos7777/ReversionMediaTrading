import { Injectable, Optional } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/mysql';
import { RequestContext } from '@mikro-orm/core';
import { PendingSignal } from '../trade/pending-signal.entity';
import { detectSession } from '../trade/trade.service';
import {
  ExecutionError,
  ExecutionService,
} from '../execution/execution.service';
import type {
  Candle,
  MarketState,
  SignalComparisonResult,
} from '../market/types';
import { AlertLog } from './alert-log.entity';
import {
  sizeForRisk,
  type CascadeSignal,
  type Contract,
  type ContractOutcome,
} from '../cascade/cascadeEngine';
import { Copilot } from '../cascade/copilot';
import {
  applyPrice,
  summarize,
  type TrackedAlert,
  type VersionSummary,
} from './outcomeTracker';

export type AlertVersion = 'v1' | 'v2' | 'v3';

export type AlertContext = {
  version: AlertVersion;
  name: string;
  symbol: string;
  direction: 'BUY' | 'SELL';
  price: number;
  fusedState: MarketState;
  m5State: MarketState;
  m15State: MarketState;
  m5Elasticity: number;
  m15Elasticity: number;
  comparison: SignalComparisonResult | null;
  structure: any | null;
  pedestrianLight: 'STOP' | 'WALK';
  shieldClear: boolean;
  shieldExplanation: string;
  emaTarget: number;
  atr: number | null;
  detailLines: string[];
  features: Record<string, unknown>;
};

export function pipSize(symbol: string): number {
  return symbol.includes('JPY') ? 0.01 : 0.0001;
}

function priceDecimals(symbol: string): number {
  return symbol.includes('JPY') ? 3 : 5;
}

export function suggestTpSl(
  symbol: string,
  direction: 'BUY' | 'SELL',
  entryPrice: number,
  struct: any | null,
): { tpPrice: number; slPrice: number } {
  let tpPrice = 0;
  let slPrice = 0;
  const decimals = priceDecimals(symbol);

  if (struct && struct.nearestSR) {
    const entry = entryPrice;
    const srPrice = struct.nearestSR.price;
    const srDistance = struct.nearestSR.distance;
    const srType = struct.nearestSR.type;

    if (srDistance > 0) {
      const atr = Math.abs(entry - srPrice) / srDistance;
      if (direction === 'BUY') {
        if (srType === 'resistance') {
          tpPrice = entry + (srPrice - entry) * 0.85;
          slPrice = entry - 1.5 * atr;
        } else {
          slPrice = srPrice - 0.2 * atr;
          tpPrice = entry + 1.5 * atr;
        }
      } else {
        if (srType === 'support') {
          tpPrice = entry - (entry - srPrice) * 0.85;
          slPrice = entry + 1.5 * atr;
        } else {
          slPrice = srPrice + 0.2 * atr;
          tpPrice = entry - 1.5 * atr;
        }
      }
    }
  }

  const wrongSide =
    direction === 'BUY'
      ? slPrice >= entryPrice || tpPrice <= entryPrice
      : slPrice <= entryPrice || tpPrice >= entryPrice;
  if (tpPrice === 0 || slPrice === 0 || wrongSide) {
    const pips = symbol.includes('JPY') ? 0.15 : 0.0015;
    if (direction === 'BUY') {
      tpPrice = entryPrice + pips;
      slPrice = entryPrice - pips;
    } else {
      tpPrice = entryPrice - pips;
      slPrice = entryPrice + pips;
    }
  }

  tpPrice =
    Math.round(tpPrice * Math.pow(10, decimals)) / Math.pow(10, decimals);
  slPrice =
    Math.round(slPrice * Math.pow(10, decimals)) / Math.pow(10, decimals);
  return { tpPrice, slPrice };
}

@Injectable()
export class AlertsService {
  private readonly trackers = new Map<number, TrackedAlert>();
  readonly copilot = new Copilot();

  constructor(
    private readonly em: EntityManager,
    @Optional() private readonly execution?: ExecutionService,
  ) {}

  async sendCascadeAlert(
    signal: CascadeSignal,
    contract: Contract,
    quoteToUsd: number | null,
    copilotContext: Record<string, unknown>,
  ): Promise<number | null> {
    let logId: number | null = null;
    await RequestContext.create(this.em, async () => {
      try {
        const pip = pipSize(signal.symbol);
        const decimals = priceDecimals(signal.symbol);
        const round = (x: number) =>
          Math.round(x * Math.pow(10, decimals)) / Math.pow(10, decimals);
        const riskUsd = this.execution?.riskUsd ?? 20;
        const size =
          quoteToUsd !== null
            ? sizeForRisk(riskUsd, Math.abs(contract.stop - contract.entry), quoteToUsd, pip)
            : 0;

        const pending = new PendingSignal();
        pending.symbol = signal.symbol;
        pending.direction = signal.direction;
        pending.tradeMode = 'experimental';
        pending.status = 'pending';
        pending.entryPrice = signal.price;
        pending.tpPrice = round(contract.target);
        pending.slPrice = round(contract.stop);
        pending.session = detectSession(new Date());
        pending.hasTypeC = false;
        pending.hasPedestrianLight = false;
        pending.openedAt = new Date();
        this.em.persist(pending);
        await this.em.flush();

        const lockedBy = await this.lockingPositionId(signal.symbol);
        const features: Record<string, unknown> = {
          contract: {
            entry: contract.entry,
            stop: round(contract.stop),
            target: round(contract.target),
            stopPips: Math.round(contract.stopPips * 10) / 10,
            targetPips: Math.round(contract.targetPips * 10) / 10,
            deadline: new Date(contract.deadline).toISOString(),
            size,
            riskUsd,
            quoteToUsd,
          },
          ema1: signal.ema1,
          ema5: signal.ema5,
          ema15: signal.ema15,
          atr5: signal.atr5,
          stretchAtr5: signal.stretchAtr5,
          roomPips: signal.roomPips,
          ema15Pips: signal.ema15Pips,
          extreme: signal.extreme,
          ...(lockedBy !== null ? { telegramSuppressedBy: lockedBy } : {}),
        };

        const log = new AlertLog();
        log.version = 'v3';
        log.name = 'Cascada';
        log.symbol = signal.symbol;
        log.direction = signal.direction;
        log.price = signal.price;
        log.emaTarget = signal.ema5;
        log.atr = signal.atr5;
        log.elasticityM5 = signal.stretchAtr5;
        log.distanceAtr = signal.atr5 ? Math.abs(signal.price - signal.ema5) / signal.atr5 : undefined;
        log.features = features;
        log.pendingSignalId = pending.id;
        log.createdAt = new Date(signal.at);
        log.status = 'open';
        log.maePips = 0;
        log.mfePips = 0;
        this.em.persist(log);
        await this.em.flush();
        logId = log.id;
        contract.alertLogId = log.id;

        if (lockedBy !== null) {
          console.log(
            `[Alertas] v3 Cascada ${signal.symbol} #${log.id} guardada sin enviar: operación #${lockedBy} abierta.`,
          );
          return;
        }

        let autoLine: string | null = null;
        let autoOpened = false;
        if (this.execution?.autoEnabled) {
          if (size <= 0) {
            autoLine = '⚠️ No se abrió automáticamente: no hay precio para pasar el riesgo a dólares.';
          } else {
            try {
              const p = await this.execution.open({
                symbol: signal.symbol,
                direction: signal.direction,
                size,
                sizeLimit: this.execution.riskMaxSize,
                stopLevel: this.execution.brokerStop ? round(contract.stop) : undefined,
                profitLevel: round(contract.target),
                source: 'auto',
                pendingSignalId: pending.id,
                alertLogId: log.id,
              });
              autoOpened = true;
              autoLine = `🤖🔒 Abierta en ${p.brokerLabel}: #${p.id} · ${p.size} u. · entrada ${p.openPrice !== null ? p.openPrice.toFixed(decimals) : 'sin confirmar'} · ${this.execution.brokerStop ? 'SL y TP puestos' : 'TP puesto, sin SL'} en el broker.${p.note ? ` ⚠️ ${p.note}` : ''}`;
            } catch (err) {
              if (err instanceof ExecutionError && err.status === 409) {
                features.telegramSuppressedBy = -1;
                await this.em.nativeUpdate(AlertLog, { id: log.id }, { features });
                console.log(`[Alertas] v3 Cascada ${signal.symbol} #${log.id}: ${err.message}`);
                return;
              }
              autoLine = `⚠️ No se abrió automáticamente: ${err instanceof Error ? err.message : String(err)}`;
            }
          }
        }

        const text = [
          this.composeCascadeMessage(signal, contract, size, riskUsd),
          autoLine,
        ]
          .filter(Boolean)
          .join('\n');
        const broker = autoOpened ? null : (this.execution?.defaultBroker ?? null);
        await this.sendTelegram(text, {
          inline_keyboard: [
            [
              { text: '✅ Registrar Trade', callback_data: `approve:${pending.id}` },
              { text: '❌ Descartar Alerta', callback_data: `discard:${pending.id}` },
            ],
            ...(broker
              ? [[{ text: `🤖 Entrar en ${broker.label}`, callback_data: `exec:${pending.id}` }]]
              : []),
          ],
        });
        console.log(`[Alertas] v3 Cascada ${signal.symbol} #${log.id} enviada.`);

        void this.askCopilot(log.id, signal, features, copilotContext);
      } catch (err) {
        console.error('[Alertas] Error procesando la alerta v3 Cascada:', err);
      }
    });
    return logId;
  }

  async restoreCascadeContract(symbol: string): Promise<Contract | null> {
    let restored: Contract | null = null;
    await RequestContext.create(this.em, async () => {
      try {
        const rows = await this.em.find(
          AlertLog,
          { symbol, version: 'v3', status: 'open' },
          { orderBy: { createdAt: 'ASC' } },
        );
        if (rows.length === 0) return;
        let keep = rows[rows.length - 1];
        for (const row of rows)
          if (await this.execution?.openForAlert(row.id)) keep = row;
        for (const row of rows) {
          if (row.id === keep.id) continue;
          await this.em.nativeUpdate(
            AlertLog,
            { id: row.id },
            {
              status: 'expired',
              features: { ...(row.features ?? {}), outcome: { reason: 'duplicada-por-reinicio' } },
              updatedAt: new Date(Date.now()),
            },
          );
        }
        const f = keep.features as {
          contract?: { entry: number; stop: number; target: number; deadline: string; stopPips: number; targetPips: number };
          ema5?: number;
        };
        if (!f?.contract) return;
        const side = keep.direction === 'SELL' ? 1 : -1;
        restored = {
          symbol,
          side,
          direction: keep.direction,
          openedAt: new Date(keep.createdAt).getTime(),
          deadline: Date.parse(f.contract.deadline),
          entry: Number(f.contract.entry),
          stop: Number(f.contract.stop),
          target: Number(f.contract.target),
          initialEma5: Number(f.ema5 ?? keep.emaTarget),
          stopPips: f.contract.stopPips,
          targetPips: f.contract.targetPips,
          maePips: Number(keep.maePips ?? 0),
          mfePips: Number(keep.mfePips ?? 0),
          alertLogId: keep.id,
        };
      } catch (err) {
        console.error(`[Alertas] [${symbol}] No se pudo recuperar el contrato v3:`, err);
      }
    });
    return restored;
  }

  private async askCopilot(
    logId: number,
    signal: CascadeSignal,
    features: Record<string, unknown>,
    context: Record<string, unknown>,
  ): Promise<void> {
    if (!this.copilot.enabled) return;
    const result = await this.copilot.review({ ...context, alerta: features });
    if (!result) return;
    const v = result.verdict;
    const icon = v.decision === 'tomar' ? '🟢' : v.decision === 'no_tomar' ? '🔴' : '🟡';
    const label = v.decision === 'tomar' ? 'la tomaría' : v.decision === 'no_tomar' ? 'no la tomaría' : 'dudosa';
    await this.sendTelegram(
      [
        `🧠 *Copiloto* (en sombra) — ${signal.symbol} ${signal.direction}: ${icon} ${label} · confianza ${Math.round(v.confianza)}`,
        ...v.razones.slice(0, 3).map((r) => `• ${r}`),
        `Riesgo: ${v.riesgo}`,
      ].join('\n'),
    );
    await RequestContext.create(this.em, async () => {
      try {
        await this.em.nativeUpdate(
          AlertLog,
          { id: logId },
          { features: { ...features, copilot: { ...result, at: new Date().toISOString() } } },
        );
      } catch (err) {
        console.error('[Copiloto] No se pudo guardar el veredicto:', err);
      }
    });
  }

  composeCascadeMessage(
    signal: CascadeSignal,
    contract: Contract,
    size: number,
    riskUsd: number,
  ): string {
    const d = priceDecimals(signal.symbol);
    const pip = pipSize(signal.symbol);
    const hhmm = (ms: number) =>
      new Date(ms - 5 * 3_600_000).toISOString().slice(11, 16);
    return [
      `🌊 *v3 · Cascada* — *${signal.symbol}*`,
      signal.direction === 'BUY' ? '🟢 COMPRA (BUY) 📈' : '🔴 VENTA (SELL) 📉',
      `Entrada: \`${signal.price.toFixed(d)}\``,
      `Stop de referencia: \`${contract.stop.toFixed(d)}\` (${contract.stopPips.toFixed(1)} pips) · Objetivo: \`${contract.target.toFixed(d)}\` (${contract.targetPips.toFixed(1)} pips)`,
      `Salida forzada: ${hhmm(contract.deadline)} COT (175 min) o al tocar la EMA 100 de 5m`,
      size > 0
        ? `Tamaño: ${size.toLocaleString('es-CO')} u. → ≈ ${riskUsd} USD si llega al stop de referencia`
        : 'Tamaño: sin precio para calcularlo',
      `EMA 100: 1m \`${signal.ema1.toFixed(d)}\` (cruzada) · 5m \`${signal.ema5.toFixed(d)}\` (a ${signal.roomPips.toFixed(1)} pips) · 15m \`${signal.ema15.toFixed(d)}\` (a ${signal.ema15Pips.toFixed(1)} pips)`,
      `Estirón: ${signal.stretchAtr5.toFixed(1)} ATR de 5m · extremo \`${signal.extreme.toFixed(d)}\` (${(Math.abs(signal.extreme - signal.price) / pip).toFixed(1)} pips)`,
      'Medido en EUR/USD ene–nov 2026: gana 65 %, peor −30 pips, neto ≈ −0,5 pips tras spread. Reduce la holgura; no es una ventaja probada.',
    ].join('\n');
  }

  async closeCascade(outcome: ContractOutcome): Promise<void> {
    const c = outcome.contract;
    const reasonText: Record<string, string> = {
      stop: 'stop',
      ema: 'toque de la EMA 100 de 5m',
      objetivo: 'objetivo',
      tiempo: 'tiempo límite',
      broker: 'cierre en el broker',
    };
    const sourceText: Record<string, string> = {
      TP: 'TP',
      SL: 'SL',
      USER: 'cierre manual o del sistema',
      SYSTEM: 'sistema del broker',
      CLOSE_OUT: 'cierre por margen',
    };
    const iso = (ms: number | null | undefined) => (ms ? new Date(ms).toISOString() : null);
    await RequestContext.create(this.em, async () => {
      try {
        let broker: Record<string, unknown> | null = null;
        let row: AlertLog | null = null;
        if (c.alertLogId !== null) {
          row = await this.em.findOne(AlertLog, c.alertLogId);
          const position = await this.execution?.positionForAlert(c.alertLogId);
          if (position && this.execution) {
            try {
              const closed =
                position.status === 'open'
                  ? await this.execution.close(position.id, `contrato-${outcome.reason}`)
                  : this.execution.viewOf(position);
              const pip = pipSize(c.symbol);
              const side = closed.direction === 'BUY' ? 1 : -1;
              broker = {
                positionId: closed.id,
                openPrice: closed.openPrice,
                closePrice: closed.closePrice,
                pnlUsd: closed.realizedPnl,
                source: closed.closeSource,
                pips:
                  closed.openPrice !== null && closed.closePrice !== null
                    ? Math.round(((side * (closed.closePrice - closed.openPrice)) / pip) * 10) / 10
                    : null,
              };
            } catch (err) {
              console.error(
                `[Alertas] v3 no pudo cerrar la operación #${position.id}:`,
                err instanceof Error ? err.message : err,
              );
            }
          }
          await this.em.nativeUpdate(
            AlertLog,
            { id: c.alertLogId },
            {
              status: outcome.reason,
              maePips: Math.round(c.maePips * 10) / 10,
              mfePips: Math.round(c.mfePips * 10) / 10,
              touchedAt: new Date(outcome.at),
              minutesToEma: outcome.minutes,
              features: {
                ...(row?.features ?? {}),
                outcome: {
                  reason: outcome.reason,
                  pips: Math.round(outcome.pips * 10) / 10,
                  exitPrice: outcome.exitPrice,
                  minutes: outcome.minutes,
                  stopTouchedAt: iso(c.stopTouchedAt),
                  targetTouchedAt: iso(c.targetTouchedAt),
                  broker,
                },
              },
              updatedAt: new Date(Date.now()),
            },
          );
          if (row?.features?.telegramSuppressedBy !== undefined) return;
        }
        const sign = (x: number) => (x >= 0 ? '+' : '');
        const usd = typeof broker?.pnlUsd === 'number' ? broker.pnlUsd : null;
        const brokerPips = typeof broker?.pips === 'number' ? broker.pips : null;
        const how =
          outcome.reason === 'broker' && typeof broker?.source === 'string'
            ? `${reasonText.broker} (${sourceText[broker.source] ?? broker.source})`
            : reasonText[outcome.reason];
        const result =
          usd !== null
            ? `${sign(usd)}${usd.toFixed(2)} USD${brokerPips !== null ? ` · ${sign(brokerPips)}${brokerPips.toFixed(1)} pips en el broker` : ''}`
            : `${sign(outcome.pips)}${outcome.pips.toFixed(1)} pips en Twelve Data, sin dato del broker`;
        await this.sendTelegram(
          `🏁 v3 ${c.symbol} ${c.direction}: salió por ${how} en ${outcome.minutes} min · ${result} · máximo en contra ${c.maePips.toFixed(1)} pips${c.stopTouchedAt ? ' · pasó por el stop de referencia' : ''}`,
        );
      } catch (err) {
        console.error('[Alertas] Error cerrando el contrato v3:', err);
      }
    });
  }

  async positionEnded(alertLogId: number): Promise<{ closePrice: number | null } | null> {
    if (!this.execution) return null;
    try {
      const p = await this.execution.positionForAlert(alertLogId);
      if (!p || (p.status === 'open' && !p.brokerGoneAt)) return null;
      return { closePrice: p.closePrice != null ? Number(p.closePrice) : null };
    } catch (err) {
      console.error(`[Alertas] No se pudo revisar la operación de la alerta #${alertLogId}:`, err);
      return null;
    }
  }

  private async lockingPositionId(symbol: string): Promise<number | null> {
    if (!this.execution) return null;
    try {
      return (await this.execution.openPositionFor(symbol))?.id ?? null;
    } catch (err) {
      console.error(
        `[Alertas] No se pudo revisar si ${symbol} tiene una operación abierta:`,
        err,
      );
      return null;
    }
  }

  async sendAlert(ctx: AlertContext): Promise<void> {
    await RequestContext.create(this.em, async () => {
      const token = process.env.TELEGRAM_BOT_TOKEN;
      const chatId = process.env.TELEGRAM_CHAT_ID;
      if (!token || !chatId) return;

      try {
        const struct = ctx.structure;
        const { tpPrice, slPrice } = suggestTpSl(
          ctx.symbol,
          ctx.direction,
          ctx.price,
          struct,
        );

        const signal = new PendingSignal();
        signal.symbol = ctx.symbol;
        signal.direction = ctx.direction;
        signal.tradeMode = 'experimental';
        signal.status = 'pending';
        signal.entryPrice = ctx.price;
        signal.tpPrice = tpPrice;
        signal.slPrice = slPrice;
        signal.session = detectSession(new Date());

        signal.elasticityM5State = ctx.m5State;
        signal.elasticityM15State = ctx.m15State;
        signal.fusedState = ctx.fusedState;
        signal.elasticityM5Value = ctx.m5Elasticity;
        signal.elasticityM15Value = ctx.m15Elasticity;

        if (struct) {
          signal.structureState = struct.structureState;
          signal.structureSignal = struct.signal;
          signal.rsiAtEntry = struct.rsi;
          signal.divergenceAtEntry = struct.divergence;
          signal.ema200SlopeAtEntry = struct.ema200Slope;
          if (struct.nearestSR) {
            signal.nearestSRPrice = struct.nearestSR.price;
            signal.nearestSRType = struct.nearestSR.type;
            signal.nearestSRStrength = struct.nearestSR.strength;
            signal.nearestSRDistance = struct.nearestSR.distance;
          }
        }

        signal.contextualWinRate = ctx.comparison
          ? ctx.comparison.winRate
          : undefined;
        signal.contextualCases = ctx.comparison
          ? ctx.comparison.similarSignals
          : undefined;
        signal.hasTypeC = ctx.version === 'v1';
        signal.hasPedestrianLight = ctx.pedestrianLight === 'WALK';
        signal.openedAt = new Date();

        this.em.persist(signal);
        await this.em.flush();

        const lockedBy = await this.lockingPositionId(ctx.symbol);
        const createdAt = new Date(Date.now());
        const log = new AlertLog();
        log.version = ctx.version;
        log.name = ctx.name;
        log.symbol = ctx.symbol;
        log.direction = ctx.direction;
        log.price = ctx.price;
        log.emaTarget = ctx.emaTarget;
        log.atr = ctx.atr ?? undefined;
        log.elasticityM5 = ctx.m5Elasticity;
        log.elasticityM15 = ctx.m15Elasticity;
        log.distanceAtr = ctx.atr
          ? Math.abs(ctx.price - ctx.emaTarget) / ctx.atr
          : undefined;
        log.shieldClear = ctx.shieldClear;
        log.walk = ctx.pedestrianLight === 'WALK';
        log.features =
          lockedBy === null
            ? ctx.features
            : { ...ctx.features, telegramSuppressedBy: lockedBy };
        log.pendingSignalId = signal.id;
        log.createdAt = createdAt;
        log.status = 'open';
        log.maePips = 0;
        log.mfePips = 0;
        this.em.persist(log);
        await this.em.flush();
        this.trackers.set(log.id, {
          id: log.id,
          version: ctx.version,
          symbol: ctx.symbol,
          direction: ctx.direction,
          price: ctx.price,
          createdAt: createdAt.getTime(),
          maePips: 0,
          mfePips: 0,
          status: 'open',
          touchedAt: null,
          minutesToEma: null,
          dirty: false,
        });

        if (lockedBy !== null) {
          console.log(
            `[Alertas] ${ctx.version} ${ctx.name} ${ctx.symbol} #${signal.id} guardada sin enviar a Telegram: operación #${lockedBy} abierta.`,
          );
          return;
        }

        let autoLine: string | null = null;
        let autoOpened = false;
        if (this.execution?.autoEnabled) {
          try {
            const p = await this.execution.openFromSignal(signal.id, 'auto');
            autoOpened = true;
            const decimals = priceDecimals(ctx.symbol);
            autoLine = `🤖🔒 Abierta automáticamente en ${p.brokerLabel}: operación #${p.id} · ${p.size} u. · entrada ${p.openPrice !== null ? p.openPrice.toFixed(decimals) : 'sin confirmar'} · SL ${p.stopLevel !== null ? p.stopLevel.toFixed(decimals) : '—'}. No llegarán más alertas de ${ctx.symbol} hasta cerrarla en el panel.${p.note ? ` ⚠️ ${p.note}` : ''}`;
          } catch (err) {
            if (err instanceof ExecutionError && err.status === 409) {
              const other = await this.lockingPositionId(ctx.symbol);
              await this.em.nativeUpdate(
                AlertLog,
                { id: log.id },
                {
                  features: {
                    ...ctx.features,
                    telegramSuppressedBy: other ?? -1,
                  },
                },
              );
              console.log(
                `[Alertas] ${ctx.version} ${ctx.name} ${ctx.symbol} #${signal.id} guardada sin enviar a Telegram: ${err.message}`,
              );
              return;
            }
            autoLine = `⚠️ No se abrió automáticamente: ${err instanceof Error ? err.message : String(err)}`;
          }
        }

        const text = [this.composeMessage(ctx, tpPrice, slPrice), autoLine]
          .filter(Boolean)
          .join('\n');
        const broker = autoOpened
          ? null
          : (this.execution?.defaultBroker ?? null);
        const replyMarkup = {
          inline_keyboard: [
            [
              {
                text: '✅ Registrar Trade',
                callback_data: `approve:${signal.id}`,
              },
              {
                text: '❌ Descartar Alerta',
                callback_data: `discard:${signal.id}`,
              },
            ],
            ...(broker
              ? [
                  [
                    {
                      text: `🤖 Entrar en ${broker.label}`,
                      callback_data: `exec:${signal.id}`,
                    },
                  ],
                ]
              : []),
          ],
        };
        await this.sendTelegram(text, replyMarkup);

        console.log(
          `[Alertas] ${ctx.version} ${ctx.name} ${ctx.symbol} #${signal.id} guardada y enviada a Telegram.`,
        );
      } catch (err) {
        console.error(
          `[Alertas] Error procesando la alerta ${ctx.version} ${ctx.name}:`,
          err,
        );
      }
    });
  }

  composeMessage(ctx: AlertContext, tpPrice: number, slPrice: number): string {
    const decimals = priceDecimals(ctx.symbol);
    const pip = pipSize(ctx.symbol);
    const directionText =
      ctx.direction === 'BUY' ? '🟢 COMPRA (BUY) 📈' : '🔴 VENTA (SELL) 📉';
    const header =
      ctx.version === 'v1'
        ? `🚨 *v1 · ${ctx.name}* — *${ctx.symbol}*`
        : `🧪 *v2 · ${ctx.name}* (experimental) — *${ctx.symbol}*`;
    const emaPips = Math.abs(ctx.price - ctx.emaTarget) / pip;

    const lines = [
      header,
      directionText,
      `Precio: \`${ctx.price.toFixed(decimals)}\``,
      `TP sugerido: \`${tpPrice.toFixed(decimals)}\` | SL sugerido: \`${slPrice.toFixed(decimals)}\``,
      `EMA 100: \`${ctx.emaTarget.toFixed(decimals)}\` (a ${emaPips.toFixed(1)} pips)`,
      ctx.version === 'v1'
        ? `Escudo: ${ctx.shieldClear ? '✅ despejado' : '⛔ en contra'} · Semáforo: ${ctx.pedestrianLight === 'WALK' ? 'WALK' : 'STOP'}`
        : `Escudo: ${ctx.shieldClear ? '✅ despejado' : '⛔ en contra'}`,
      ...ctx.detailLines,
    ];
    if (
      ctx.version === 'v1' &&
      ctx.comparison &&
      ctx.comparison.similarSignals > 0
    ) {
      lines.push(
        `Win Rate interno: ${ctx.comparison.winRate.toFixed(0)} % en ${ctx.comparison.similarSignals} casos (solo mide si volvió a la EMA, no cuánto más se estiró)`,
      );
    }
    return lines.join('\n');
  }

  onTick(symbol: string, price: number, ts: number, ema: number | null): void {
    const pip = pipSize(symbol);
    for (const t of this.trackers.values()) {
      if (t.symbol === symbol) applyPrice(t, price, price, ema, ts, pip);
    }
  }

  async onCandleClosed(
    symbol: string,
    candle: Candle,
    periodMs: number,
    ema: number | null,
  ): Promise<void> {
    const pip = pipSize(symbol);
    const end = candle.time + periodMs;
    for (const t of this.trackers.values()) {
      if (t.symbol !== symbol) continue;
      if (candle.time >= t.createdAt)
        applyPrice(t, candle.high, candle.low, ema, end, pip);
      else applyPrice(t, t.price, t.price, null, end, pip);
    }
    await this.persistTrackers(symbol);
  }

  async restore(
    symbol: string,
    bars: Candle[],
    emas: (number | null)[],
    periodMs: number,
  ): Promise<number> {
    let restored = 0;
    await RequestContext.create(this.em, async () => {
      try {
        const open = await this.em.find(AlertLog, {
          symbol,
          status: 'open',
          version: { $ne: 'v3' },
        });
        const pip = pipSize(symbol);
        for (const row of open) {
          const t: TrackedAlert = {
            id: row.id,
            version: row.version,
            symbol: row.symbol,
            direction: row.direction,
            price: Number(row.price),
            createdAt: new Date(row.createdAt).getTime(),
            maePips: Number(row.maePips ?? 0),
            mfePips: Number(row.mfePips ?? 0),
            status: 'open',
            touchedAt: null,
            minutesToEma: null,
            dirty: false,
          };
          for (let i = 1; i < bars.length; i++) {
            if (bars[i].time >= t.createdAt)
              applyPrice(
                t,
                bars[i].high,
                bars[i].low,
                emas[i - 1],
                bars[i].time + periodMs,
                pip,
              );
          }
          this.trackers.set(t.id, t);
          restored++;
        }
      } catch (err) {
        console.error(
          `[Alertas] [${symbol}] No se pudieron recuperar las alertas abiertas:`,
          err,
        );
      }
    });
    await this.persistTrackers(symbol);
    return restored;
  }

  private async persistTrackers(symbol: string): Promise<void> {
    const dirty = [...this.trackers.values()].filter(
      (t) => t.symbol === symbol && t.dirty,
    );
    if (dirty.length === 0) return;
    await RequestContext.create(this.em, async () => {
      try {
        for (const t of dirty) {
          await this.em.nativeUpdate(
            AlertLog,
            { id: t.id },
            {
              maePips: Math.round(t.maePips * 10) / 10,
              mfePips: Math.round(t.mfePips * 10) / 10,
              status: t.status,
              touchedAt:
                t.touchedAt !== null ? new Date(t.touchedAt) : undefined,
              minutesToEma: t.minutesToEma ?? undefined,
              updatedAt: new Date(Date.now()),
            },
          );
          t.dirty = false;
          if (t.status !== 'open') this.trackers.delete(t.id);
        }
      } catch (err) {
        console.error(
          `[Alertas] [${symbol}] No se pudo guardar el resultado de las alertas:`,
          err,
        );
      }
    });
  }

  async list(limit: number): Promise<AlertLog[]> {
    return this.em
      .fork()
      .find(AlertLog, {}, { orderBy: { createdAt: 'DESC' }, limit });
  }

  async summary(): Promise<VersionSummary[]> {
    const rows = await this.em.fork().find(AlertLog, {});
    return summarize(
      rows.map((r) => ({
        version: r.version,
        status: r.status,
        maePips:
          r.maePips === null || r.maePips === undefined
            ? null
            : Number(r.maePips),
        minutesToEma: r.minutesToEma ?? null,
        createdAt: new Date(r.createdAt).getTime(),
        pips:
          (r.features?.outcome as { pips?: number } | undefined)?.pips ??
          null,
      })),
      Date.now(),
    );
  }

  private async sendTelegram(
    text: string,
    replyMarkup?: object,
  ): Promise<boolean> {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) return false;

    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const post = (body: object) =>
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

    try {
      const res = await post({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
        reply_markup: replyMarkup,
      });
      if (res.ok) return true;
      console.warn(
        `[Alertas] Telegram respondió ${res.status} con Markdown; reenviando como texto plano.`,
      );
      const plain = await post({
        chat_id: chatId,
        text: text.replace(/[*_`]/g, ''),
        reply_markup: replyMarkup,
      });
      return plain.ok;
    } catch (err) {
      console.error('[Alertas] Error enviando a Telegram:', err);
      return false;
    }
  }
}
