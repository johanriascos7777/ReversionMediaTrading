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
  applyPrice,
  summarize,
  type TrackedAlert,
  type VersionSummary,
} from './outcomeTracker';

export type AlertVersion = 'v1' | 'v2';

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

  constructor(
    private readonly em: EntityManager,
    @Optional() private readonly execution?: ExecutionService,
  ) {}

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
        const open = await this.em.find(AlertLog, { symbol, status: 'open' });
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
