/**
 * fullRevertion.service.ts
 *
 * Servicio NestJS del módulo Full Reversion.
 *
 * Genera 3 tipos de alertas Telegram, todas con filtro de pendiente EMA:
 *
 *  1. 🌊 Alerta M5 solo  — Cuando M5 entra en GREEN con slope FLAT/GENTLE
 *  2. 🌊 Alerta M15 solo — Cuando M15 entra en GREEN con slope FLAT/GENTLE
 *  3. 🔱 Alerta FUSIONADA — Cuando AMBOS M5 + M15 están en GREEN simultáneamente
 *                           con slope permitido → la señal de mayor convicción
 *
 * La alerta fusionada es la equivalente al semáforo VERDE del motor estándar
 * (GREEN+GREEN), pero con el filtro de pendiente adicional.
 *
 * NUNCA modifica ni llama a nada del motor de elasticidad estándar.
 */

import { Injectable, OnModuleInit } from '@nestjs/common';
import { MarketService } from '../market/market.service';
import type { BackendMessage } from '../market/types';
import {
  calculateFullRevertionSnapshot,
  runFullRevertionBacktest,
  pushFullRevertionPercentile,
} from './fullRevertionEngine';
import type {
  FullRevertionSnapshot,
  FullRevertionBacktestResult,
  FRAlertState,
  FRFusedAlertState,
} from './fullRevertion.types';

// Intervalo mínimo entre cálculos por símbolo+timeframe (ms)
const MIN_CALC_INTERVAL_MS      = 5_000;
// Cooldown alertas simples M5/M15 (10 min)
const ALERT_COOLDOWN_MS         = 10 * 60 * 1000;
// Cooldown alerta fusionada M5+M15 (15 min — más conservadora)
const FUSED_ALERT_COOLDOWN_MS   = 15 * 60 * 1000;
// Barras a usar en el backtest Full Reversion
const FR_BACKTEST_BARS          = 50;

@Injectable()
export class FullRevertionService implements OnModuleInit {

  // Último snapshot calculado por símbolo+timeframe (ej. 'AUD/USD:M5')
  private lastSnapshots     = new Map<string, FullRevertionSnapshot>();
  // Último backtest calculado por símbolo (solo M5)
  private lastBacktests     = new Map<string, FullRevertionBacktestResult>();
  // Estado de alerta SIMPLE por símbolo+timeframe
  private alertStates       = new Map<string, FRAlertState>();
  // Estado de alerta FUSIONADA por símbolo
  private fusedAlertStates  = new Map<string, FRFusedAlertState>();
  // Rate-limit de cálculo
  private lastCalcTime      = new Map<string, number>();

  constructor(private readonly marketService: MarketService) {}

  onModuleInit() {
    this.marketService.events.on('broadcast', (msg: BackendMessage) => {
      if (msg.type !== 'snapshot') return;
      this.onSnapshot(msg.symbol, msg.m5.timestamp, msg.m5.price);
    });

    console.log('[FullReversionService] ✅ Inicializado — escuchando snapshots (M5 · M15 · Fusión).');
  }

  // ─── Acceso público para el controller ───────────────────────────────────

  getLastSnapshot(symbol: string, timeframe: 'M5' | 'M15'): FullRevertionSnapshot | null {
    return this.lastSnapshots.get(`${symbol}:${timeframe}`) ?? null;
  }

  getLastBacktest(symbol: string): FullRevertionBacktestResult | null {
    return this.lastBacktests.get(symbol) ?? null;
  }

  getAllSymbols(): string[] {
    const symbols = new Set<string>();
    for (const key of this.lastSnapshots.keys()) {
      symbols.add(key.split(':')[0]);
    }
    return Array.from(symbols);
  }

  // ─── Lógica interna ───────────────────────────────────────────────────────

  private onSnapshot(symbol: string, timestamp: number, price: number): void {
    this.runForTimeframe(symbol, price, '5min',  'M5',  timestamp);
    this.runForTimeframe(symbol, price, '15min', 'M15', timestamp);

    // Después de actualizar ambos timeframes, evaluar la fusión M5+M15
    this.checkFusedAlert(symbol);
  }

  private runForTimeframe(
    symbol:    string,
    price:     number,
    interval:  '5min' | '15min',
    timeframe: 'M5' | 'M15',
    timestamp: number
  ): void {
    const calcKey = `${symbol}:${timeframe}`;
    const now     = Date.now();
    const last    = this.lastCalcTime.get(calcKey) ?? 0;

    if (now - last < MIN_CALC_INTERVAL_MS) return;
    this.lastCalcTime.set(calcKey, now);

    const candles = this.marketService.getHistory(symbol, interval);
    if (candles.length < 115) return; // EMA100 + SLOPE_LOOKBACK mínimos

    const snap = calculateFullRevertionSnapshot(symbol, candles, price, timeframe, timestamp);
    if (!snap) return;

    this.lastSnapshots.set(calcKey, snap);

    // Alimentar percentil con el cierre más reciente
    const lastCandleClose = candles[candles.length - 1].close;
    pushFullRevertionPercentile(symbol, timeframe, Math.abs(lastCandleClose - snap.ema100) / snap.atr);

    // Backtest solo en M5
    if (timeframe === 'M5') {
      const backtest = runFullRevertionBacktest(candles, FR_BACKTEST_BARS);
      this.lastBacktests.set(symbol, backtest);

      // Alerta individual M5
      this.checkSimpleAlert(symbol, 'M5', snap, backtest);
    }

    // Alerta individual M15
    if (timeframe === 'M15') {
      const backtestM5 = this.lastBacktests.get(symbol) ?? null;
      this.checkSimpleAlert(symbol, 'M15', snap, backtestM5);
    }

    // Log esporádico
    if (Math.random() < 0.04) {
      console.log(
        `[FullRevertion] [${symbol}] ${timeframe}`,
        `· Elast: ${snap.elasticity.toFixed(3)} ${snap.state}`,
        `· Slope: ${snap.emaSlope} (${snap.emaSlopeValue.toFixed(3)} ATR/10b)`,
        `· ${snap.signalAllowed ? '✅ ALLOWED' : '🚫 BLOCKED'}`
      );
    }
  }

  // ─── Alerta simple: M5 solo o M15 solo ───────────────────────────────────

  private async checkSimpleAlert(
    symbol:    string,
    timeframe: 'M5' | 'M15',
    snap:      FullRevertionSnapshot,
    backtest:  FullRevertionBacktestResult | null
  ): Promise<void> {
    const alertKey   = `${symbol}:${timeframe}`;
    const now        = Date.now();

    if (!this.alertStates.has(alertKey)) {
      this.alertStates.set(alertKey, { previousFRState: null, lastAlertTime: 0 });
    }

    const alertState = this.alertStates.get(alertKey)!;

    const isNewGreen = alertState.previousFRState !== 'GREEN' && snap.state === 'GREEN';
    const canAlert   = now - alertState.lastAlertTime > ALERT_COOLDOWN_MS;

    if (isNewGreen && snap.signalAllowed && canAlert) {
      alertState.lastAlertTime = now;
      await this.sendSimpleTelegramAlert(symbol, timeframe, snap, backtest);
    }

    alertState.previousFRState = snap.state;
  }

  // ─── Alerta fusionada: M5 + M15 ambos en GREEN ───────────────────────────

  private async checkFusedAlert(symbol: string): Promise<void> {
    const snapM5  = this.lastSnapshots.get(`${symbol}:M5`);
    const snapM15 = this.lastSnapshots.get(`${symbol}:M15`);

    if (!snapM5 || !snapM15) return;

    if (!this.fusedAlertStates.has(symbol)) {
      this.fusedAlertStates.set(symbol, {
        previousM5State:    null,
        previousM15State:   null,
        lastFusedAlertTime: 0,
      });
    }

    const fusedState = this.fusedAlertStates.get(symbol)!;
    const now        = Date.now();

    const bothGreen       = snapM5.state === 'GREEN' && snapM15.state === 'GREEN';
    const bothAllowed     = snapM5.signalAllowed && snapM15.signalAllowed;
    const wasAlreadyFused =
      fusedState.previousM5State  === 'GREEN' &&
      fusedState.previousM15State === 'GREEN';

    // Solo dispara si es una NUEVA condición fusionada (transición hacia GREEN+GREEN)
    const isNewFusedGreen = bothGreen && !wasAlreadyFused;
    const canAlert        = now - fusedState.lastFusedAlertTime > FUSED_ALERT_COOLDOWN_MS;

    if (isNewFusedGreen && bothAllowed && canAlert) {
      fusedState.lastFusedAlertTime = now;
      const backtest = this.lastBacktests.get(symbol) ?? null;
      await this.sendFusedTelegramAlert(symbol, snapM5, snapM15, backtest);
    }

    fusedState.previousM5State  = snapM5.state;
    fusedState.previousM15State = snapM15.state;
  }

  // ─── Telegram: Alerta simple (M5 o M15) ──────────────────────────────────

  private async sendSimpleTelegramAlert(
    symbol:    string,
    timeframe: 'M5' | 'M15',
    snap:      FullRevertionSnapshot,
    backtest:  FullRevertionBacktestResult | null
  ): Promise<void> {
    const token  = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) return;

    try {
      const isAboveEMA  = snap.price > snap.ema100;
      const direction   = isAboveEMA ? 'SELL' : 'BUY';
      const dirEmoji    = direction === 'BUY' ? '🟢 COMPRA (BUY) 📈' : '🔴 VENTA (SELL) 📉';
      const decimals    = symbol.includes('JPY') ? 3 : 5;
      const priceStr    = snap.price.toFixed(decimals);
      const emaStr      = snap.ema100.toFixed(decimals);
      const slopeLabel  = snap.emaSlope === 'FLAT' ? '✅ PLANA' : '⚠️ SUAVE';
      const slopeDirEmo = snap.slopeDirection === 'UP' ? '↗️ Subiendo' : snap.slopeDirection === 'DOWN' ? '↘️ Bajando' : '→ Lateral';
      const winRateEmoji = backtest && backtest.winRate >= 70 ? '🔥' : backtest && backtest.winRate >= 55 ? '✅' : '⚠️';
      const timeStr = new Date().toLocaleString('es-CO', {
        timeZone: 'America/Bogota', year: 'numeric', month: 'short',
        day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'
      });

      let msg = `🌊🌊🌊🌊🌊🌊🌊🌊🌊🌊🌊🌊\n`;
      msg    += `🔮 *FULL REVERSION — ${timeframe}* 🔮\n`;
      msg    += `🌊🌊🌊🌊🌊🌊🌊🌊🌊🌊🌊🌊\n\n`;
      msg    += `📍 *Par:* \`${symbol}\`  ·  *Timeframe:* \`${timeframe}\`\n`;
      msg    += `🎯 *Dirección sugerida:* ${dirEmoji}\n`;
      msg    += `💰 *Precio:* \`${priceStr}\`  ·  *EMA100:* \`${emaStr}\`\n\n`;
      msg    += `━━━━━━━━━━━━━━━━━━━━━━\n`;
      msg    += `📐 *Elasticidad ${timeframe}:* \`${snap.elasticity.toFixed(3)}\` _(P${snap.percentile.toFixed(0)}%)_\n`;
      msg    += `🧭 *Pendiente EMA100:* ${slopeLabel}\n`;
      msg    += `   \`${Math.abs(snap.emaSlopeValue).toFixed(3)} ATR/10b\` ${slopeDirEmo}\n\n`;

      if (backtest) {
        msg  += `━━━━━━━━━━━━━━━━━━━━━━\n`;
        msg  += `${winRateEmoji} *Backtest FR (${FR_BACKTEST_BARS}b M5):*\n`;
        msg  += `   · Win Rate: \`${backtest.winRate}%\`  · Señales: \`${backtest.allowedSignals}\`\n`;
        msg  += `   · Bloqueadas por pendiente: \`${backtest.filteredBySlope}\`\n`;
        msg  += `   · Avg barras al cruce: \`${backtest.avgBarsToRevert}\`\n\n`;
      }

      msg    += `💡 _EMA en pendiente ${snap.emaSlope} — reversión estructural probable_\n`;
      msg    += `⚠️ _Señal parcial: solo ${timeframe}. Espera M5+M15 para mayor convicción._\n\n`;
      msg    += `⏱ _${timeStr} COT_\n`;
      msg    += `🌊🌊🌊🌊🌊🌊🌊🌊🌊🌊🌊🌊`;

      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: msg, parse_mode: 'Markdown' }),
      });

      console.log(`[FullRevertion] 🌊 Alerta ${timeframe} enviada: ${symbol} | ${direction} @ ${priceStr}`);
    } catch (err) {
      console.error('[FullRevertion] ❌ Error alerta simple:', err);
    }
  }

  // ─── Telegram: Alerta FUSIONADA (M5 + M15) ───────────────────────────────

  private async sendFusedTelegramAlert(
    symbol:   string,
    snapM5:   FullRevertionSnapshot,
    snapM15:  FullRevertionSnapshot,
    backtest: FullRevertionBacktestResult | null
  ): Promise<void> {
    const token  = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) return;

    try {
      const isAboveEMA  = snapM5.price > snapM5.ema100;
      const direction   = isAboveEMA ? 'SELL' : 'BUY';
      const dirEmoji    = direction === 'BUY' ? '🟢 COMPRA (BUY) 📈' : '🔴 VENTA (SELL) 📉';
      const decimals    = symbol.includes('JPY') ? 3 : 5;
      const priceStr    = snapM5.price.toFixed(decimals);
      const emaStr      = snapM5.ema100.toFixed(decimals);

      const slopeLabelM5  = snapM5.emaSlope  === 'FLAT' ? '✅ PLANA'  : '⚠️ SUAVE';
      const slopeLabelM15 = snapM15.emaSlope === 'FLAT' ? '✅ PLANA'  : '⚠️ SUAVE';

      const winRateEmoji  = backtest && backtest.winRate >= 70 ? '🔥🔥🔥' : backtest && backtest.winRate >= 55 ? '🔥🔥' : '🔥';
      const timeStr = new Date().toLocaleString('es-CO', {
        timeZone: 'America/Bogota', year: 'numeric', month: 'short',
        day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'
      });

      // ─── Mensaje fusionado — máxima convicción ────────────────────────────
      let msg = `🔱🔱🔱🔱🔱🔱🔱🔱🔱🔱🔱🔱\n`;
      msg    += `🚨🌊 *FULL REVERSION — FUSIONADO* 🌊🚨\n`;
      msg    += `✨ *M5 + M15 ALINEADOS — ALTA CONVICCIÓN* ✨\n`;
      msg    += `🔱🔱🔱🔱🔱🔱🔱🔱🔱🔱🔱🔱\n\n`;
      msg    += `📍 *Par:* \`${symbol}\`\n`;
      msg    += `🎯 *Dirección:* ${dirEmoji}\n`;
      msg    += `💰 *Precio:* \`${priceStr}\`  ·  *EMA100:* \`${emaStr}\`\n\n`;

      msg    += `━━━━━━━━━━━━━━━━━━━━━━\n`;
      msg    += `📊 *Estado Multi-Timeframe:*\n`;
      msg    += `   🕐 *M5* — Elasticidad: \`${snapM5.elasticity.toFixed(3)}\` _(P${snapM5.percentile.toFixed(0)}%)_ 🟢 GREEN\n`;
      msg    += `      Pendiente: ${slopeLabelM5} \`${Math.abs(snapM5.emaSlopeValue).toFixed(3)} ATR/10b\`\n\n`;
      msg    += `   🕑 *M15* — Elasticidad: \`${snapM15.elasticity.toFixed(3)}\` _(P${snapM15.percentile.toFixed(0)}%)_ 🟢 GREEN\n`;
      msg    += `      Pendiente: ${slopeLabelM15} \`${Math.abs(snapM15.emaSlopeValue).toFixed(3)} ATR/10b\`\n\n`;

      if (backtest) {
        msg  += `━━━━━━━━━━━━━━━━━━━━━━\n`;
        msg  += `${winRateEmoji} *Backtest Full Reversion (${FR_BACKTEST_BARS}b):*\n`;
        msg  += `   · Win Rate con filtro: \`${backtest.winRate}%\`\n`;
        msg  += `   · Señales permitidas: \`${backtest.allowedSignals}\`\n`;
        msg  += `   · Bloqueadas por tendencia: \`${backtest.filteredBySlope}\`\n`;
        msg  += `   · Promedio al cruce completo: \`${backtest.avgBarsToRevert} barras M5\`\n\n`;
      }

      msg    += `━━━━━━━━━━━━━━━━━━━━━━\n`;
      msg    += `🔍 *¿Por qué esta es la señal más fuerte?*\n`;
      msg    += `   ✅ M5 sobreestirado _y_ sin tendencia fuerte\n`;
      msg    += `   ✅ M15 sobreestirado _y_ sin tendencia fuerte\n`;
      msg    += `   ✅ El precio tiene presión de reversión en AMBOS marcos\n`;
      msg    += `   🚫 No es un simple pullback en tendencia\n\n`;

      msg    += `⏱ _${timeStr} COT_\n`;
      msg    += `🔱🔱🔱🔱🔱🔱🔱🔱🔱🔱🔱🔱`;

      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: msg, parse_mode: 'Markdown' }),
      });

      console.log(`[FullRevertion] 🔱 Alerta FUSIONADA M5+M15 enviada: ${symbol} | ${direction} @ ${priceStr}`);
    } catch (err) {
      console.error('[FullRevertion] ❌ Error alerta fusionada:', err);
    }
  }
}
