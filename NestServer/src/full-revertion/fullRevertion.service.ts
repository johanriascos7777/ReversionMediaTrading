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
import { StructureService } from '../structure/structure.service';
import { ConsolidationService } from '../consolidation/consolidation.service';
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
// Control de alertas individuales (false = desactivadas, solo enviar fusionadas M5+M15)
const ENABLE_INDIVIDUAL_ALERTS  = false;

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
  // Estado de alerta FUSIONADA blindada por símbolo
  private shieldedFusedAlertStates = new Map<string, FRFusedAlertState>();
  // Rate-limit de cálculo
  private lastCalcTime      = new Map<string, number>();

  // Trackers de Elasticidad de velas cerradas (para Giro)
  private lastClosedElasticity = new Map<string, number | null>();
  private prevClosedElasticity = new Map<string, number | null>();
  private lastClosedCandleTime = new Map<string, number>();
  private triggerStates        = new Map<string, 'reposo' | 'estirando' | 'giro'>();

  constructor(
    private readonly marketService: MarketService,
    private readonly structureService: StructureService,
    private readonly consolidationService: ConsolidationService,
  ) {}

  onModuleInit() {
    this.marketService.events.on('broadcast', (msg: BackendMessage) => {
      if (msg.type !== 'snapshot') return;
      setImmediate(() => {
        this.onSnapshot(msg.symbol, msg.m5.timestamp, msg.m5.price);
      });
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
    // Alerta fusionada: Shielded
    this.checkShieldedFusedAlert(symbol);
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

    // ─── ENRIQUECER SNAPSHOT CON CONFLUENCIA ESTRUCTURAL Y TP/SL ───────────
    const structSnap = this.structureService.getLastSnapshot(symbol, timeframe);
    if (structSnap) {
      snap.divergence = structSnap.divergence;
      snap.nearestSR = structSnap.nearestSR;
      snap.isCompression = structSnap.isCompressionSandwich === true;
    } else {
      snap.isCompression = false;
    }

    // ─── ENRIQUECER CON PULLBACK SHIELD Y BLOQUEO AUTOMÁTICO ──────────────
    const consolidationSnap = this.consolidationService.getConsolidationSnapshot(symbol);
    if (consolidationSnap) {
      const m5Opposed = consolidationSnap.m5.detected && consolidationSnap.m5.alignment === 'opposed';
      const m15Opposed = consolidationSnap.m15.detected && consolidationSnap.m15.alignment === 'opposed';
      const isSuperStop = consolidationSnap.superSignal.type === 'SUPER_STOP';
      
      if (m5Opposed || m15Opposed || isSuperStop) {
        snap.shieldBlocked = true;
        snap.signalAllowed = false; // El escudo tiene autoridad máxima para cancelar entradas
      } else {
        snap.shieldBlocked = false;
      }
    } else {
      snap.shieldBlocked = false;
    }

    const decimals = symbol.includes('JPY') ? 3 : 5;
    const isBuy = price < snap.ema100;
    const rawSl = isBuy ? (price - 1.8 * snap.atr) : (price + 1.8 * snap.atr);
    snap.tpPrice = Math.round(snap.ema100 * Math.pow(10, decimals)) / Math.pow(10, decimals);
    snap.slPrice = Math.round(rawSl * Math.pow(10, decimals)) / Math.pow(10, decimals);
    snap.triggerState = this.triggerStates.get(symbol) ?? 'reposo';

    this.lastSnapshots.set(calcKey, snap);

    // Alimentar percentil con el cierre más reciente
    const lastCandleClose = candles[candles.length - 1].close;
    pushFullRevertionPercentile(symbol, timeframe, Math.abs(lastCandleClose - snap.ema100) / snap.atr);

    // Trackear elasticidades de velas cerradas solo para M5 (gatillo del giro)
    if (timeframe === 'M5') {
      const lastClosedCandle = candles[candles.length - 1];
      const lastClosedTime = this.lastClosedCandleTime.get(symbol) ?? 0;

      if (lastClosedCandle.time !== lastClosedTime) {
        this.lastClosedCandleTime.set(symbol, lastClosedCandle.time);

        // Rotar elasticidades cerradas
        const prevEl = this.lastClosedElasticity.get(symbol) ?? null;
        this.prevClosedElasticity.set(symbol, prevEl);

        const currentEl = Math.abs(lastClosedCandle.close - snap.ema100) / snap.atr;
        this.lastClosedElasticity.set(symbol, currentEl);
      }
    }

    // Backtest solo en M5
    if (timeframe === 'M5') {
      const backtest = runFullRevertionBacktest(candles, FR_BACKTEST_BARS);
      this.lastBacktests.set(symbol, backtest);

      // Alerta individual M5 (si están habilitadas)
      if (ENABLE_INDIVIDUAL_ALERTS) {
        this.checkSimpleAlert(symbol, 'M5', snap, backtest);
      }
    }

    // Alerta individual M15 (si están habilitadas)
    if (timeframe === 'M15') {
      const backtestM5 = this.lastBacktests.get(symbol) ?? null;
      if (ENABLE_INDIVIDUAL_ALERTS) {
        this.checkSimpleAlert(symbol, 'M15', snap, backtestM5);
      }
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
        preAlertActive:     false,
      });
    }

    const fusedState = this.fusedAlertStates.get(symbol)!;
    const now        = Date.now();

    const bothGreen       = snapM5.state === 'GREEN' && snapM15.state === 'GREEN';
    const bothAllowed     = snapM5.signalAllowed && snapM15.signalAllowed;

    // Lógica del Gatillo:
    // 1. Activar pre-alerta si M5 y M15 entran en GREEN con pendiente EMA permitida
    if (bothGreen && bothAllowed) {
      if (!fusedState.preAlertActive) {
        console.log(`[FullRevertion] [${symbol}] 🪃 Pre-alerta de confluencia activada. Esperando Giro de Elasticidad...`);
        fusedState.preAlertActive = true;
      }
    } else {
      // Si salen de la confluencia extrema, cancelar pre-alerta
      if (fusedState.preAlertActive) {
        console.log(`[FullRevertion] [${symbol}] ⏳ Pre-alerta cancelada (fin de confluencia GREEN).`);
        fusedState.preAlertActive = false;
      }
    }

    // 2. Determinar si ocurrió un Giro en la última vela cerrada M5
    let currentTriggerState: 'reposo' | 'estirando' | 'giro' = 'reposo';
    if (fusedState.preAlertActive) {
      const lastEl = this.lastClosedElasticity.get(symbol) ?? null;
      const prevEl = this.prevClosedElasticity.get(symbol) ?? null;

      if (lastEl !== null && prevEl !== null && lastEl < prevEl) {
        currentTriggerState = 'giro';
      } else {
        currentTriggerState = 'estirando';
      }
    }

    this.triggerStates.set(symbol, currentTriggerState);
    snapM5.triggerState = currentTriggerState;
    snapM15.triggerState = currentTriggerState;

    // 3. Disparar alerta en Telegram cuando hay 'giro' y cooldown cumplido
    if (fusedState.preAlertActive && currentTriggerState === 'giro') {
      const canAlert = now - fusedState.lastFusedAlertTime > FUSED_ALERT_COOLDOWN_MS;
      if (canAlert) {
        // Verificar si se ha enviado una alerta Tipo A o Tipo C recientemente en el motor base (últimos 15 min)
        const symbolState = (this.marketService as any).symbolStates?.get(symbol);
        if (symbolState) {
          const lastA = symbolState.lastTelegramAlertTimeA ?? 0;
          const lastAExp = symbolState.lastTelegramAlertTimeAExp ?? 0;
          const lastC = symbolState.lastTelegramAlertTimeTrigger ?? 0;
          const lastCExp = symbolState.lastTelegramAlertTimeTriggerExp ?? 0;

          const baseAlertWindow = 15 * 60 * 1000; // 15 minutos
          const hasRecentA = (now - lastA) < baseAlertWindow;
          const hasRecentAExp = (now - lastAExp) < baseAlertWindow;
          const hasRecentC = (now - lastC) < baseAlertWindow;
          const hasRecentCExp = (now - lastCExp) < baseAlertWindow;

          if (!hasRecentA && !hasRecentAExp && !hasRecentC && !hasRecentCExp) {
            console.log(`[FullRevertion] [${symbol}] Alerta fusionada omitida: sin alertas Tipo A ni Tipo C recientes en el motor base.`);
            return;
          }
        }

        fusedState.lastFusedAlertTime = now;
        fusedState.preAlertActive = false; // resetear pre-alerta
        
        console.log(`[FullRevertion] [${symbol}] 🔥 GIRO CONFIRMADO. Enviando alerta a Telegram...`);
        const backtest = this.lastBacktests.get(symbol) ?? null;
        await this.sendFusedTelegramAlert(symbol, snapM5, snapM15, backtest);
      }
    }

    fusedState.previousM5State  = snapM5.state;
    fusedState.previousM15State = snapM15.state;
  }

  // ─── Alerta fusionada blindada (Shield ✓): Sin Sándwich ───────────────────────────

  private async checkShieldedFusedAlert(symbol: string): Promise<void> {
    const snapM5  = this.lastSnapshots.get(`${symbol}:M5`);
    const snapM15 = this.lastSnapshots.get(`${symbol}:M15`);

    if (!snapM5 || !snapM15) return;

    if (!this.shieldedFusedAlertStates.has(symbol)) {
      this.shieldedFusedAlertStates.set(symbol, {
        previousM5State:    null,
        previousM15State:   null,
        lastFusedAlertTime: 0,
        preAlertActive:     false,
      });
    }

    const state = this.shieldedFusedAlertStates.get(symbol)!;
    const now   = Date.now();

    const bothGreen       = snapM5.state === 'GREEN' && snapM15.state === 'GREEN';
    const bothAllowed     = snapM5.signalAllowed && snapM15.signalAllowed;
    const noCompression   = !snapM5.isCompression && !snapM15.isCompression;

    // Solo activamos pre-alerta si está permitido y además NO hay sándwich de EMAs
    if (bothGreen && bothAllowed && noCompression) {
      if (!state.preAlertActive) {
        console.log(`[FullRevertion Shield] [${symbol}] 🛡️🪃 Pre-alerta blindada activada. Esperando Giro...`);
        state.preAlertActive = true;
      }
    } else {
      if (state.preAlertActive) {
        console.log(`[FullRevertion Shield] [${symbol}] ⏳ Pre-alerta blindada cancelada.`);
        state.preAlertActive = false;
      }
    }

    let currentTriggerState: 'reposo' | 'estirando' | 'giro' = 'reposo';
    if (state.preAlertActive) {
      const lastEl = this.lastClosedElasticity.get(symbol) ?? null;
      const prevEl = this.prevClosedElasticity.get(symbol) ?? null;

      if (lastEl !== null && prevEl !== null && lastEl < prevEl) {
        currentTriggerState = 'giro';
      } else {
        currentTriggerState = 'estirando';
      }
    }

    if (state.preAlertActive && currentTriggerState === 'giro') {
      const canAlert = now - state.lastFusedAlertTime > FUSED_ALERT_COOLDOWN_MS;
      if (canAlert) {
        const symbolState = (this.marketService as any).symbolStates?.get(symbol);
        if (symbolState) {
          const baseAlertWindow = 15 * 60 * 1000;
          const hasRecentA = (now - (symbolState.lastTelegramAlertTimeA ?? 0)) < baseAlertWindow;
          const hasRecentAExp = (now - (symbolState.lastTelegramAlertTimeAExp ?? 0)) < baseAlertWindow;
          const hasRecentC = (now - (symbolState.lastTelegramAlertTimeTrigger ?? 0)) < baseAlertWindow;
          const hasRecentCExp = (now - (symbolState.lastTelegramAlertTimeTriggerExp ?? 0)) < baseAlertWindow;

          if (!hasRecentA && !hasRecentAExp && !hasRecentC && !hasRecentCExp) {
            console.log(`[FullRevertion Shield] [${symbol}] Alerta blindada omitida: sin alertas en el motor base.`);
            return;
          }
        }

        state.lastFusedAlertTime = now;
        state.preAlertActive = false;
        
        console.log(`[FullRevertion Shield] [${symbol}] 🔥 GIRO CONFIRMADO Y BLINDADO. Enviando alerta...`);
        const backtest = this.lastBacktests.get(symbol) ?? null;
        await this.sendShieldedFusedTelegramAlert(symbol, snapM5, snapM15, backtest);
      }
    }

    state.previousM5State  = snapM5.state;
    state.previousM15State = snapM15.state;
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
      const decimals    = symbol.includes('JPY') ? 3 : 5;
      const priceStr    = snapM5.price.toFixed(decimals);

      let msg = `🔱🔱🔱🔱🔱🔱🔱🔱🔱🔱🔱🔱\n`;
      msg    += `🚨🌊 *FULL REVERSION — FUSIONADO* 🌊🚨\n`;
      msg    += `REVISA TU DASHBOARD... SYMBOLO ${symbol}`;

      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: msg, parse_mode: 'Markdown' }),
      });

      console.log(`[FullRevertion] 🔱 Alerta FUSIONADA M5+M15 enviada: ${symbol} | ${direction} @ ${priceStr} (M15: ${snapM15.state}, BT: ${backtest?.winRate ?? 0}%)`);
    } catch (err) {
      console.error('[FullRevertion] ❌ Error alerta fusionada:', err);
    }
  }

  // ─── Telegram: Alerta fusionada BLINDADA (Shield ✓) ──────────────────────────────────

  private async sendShieldedFusedTelegramAlert(
    symbol: string,
    snapM5: FullRevertionSnapshot,
    snapM15: FullRevertionSnapshot,
    backtest: FullRevertionBacktestResult | null
  ): Promise<void> {
    const token  = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) return;

    try {
      const isAboveEMA = snapM5.price > snapM5.ema100;
      const direction  = isAboveEMA ? 'SELL' : 'BUY';
      const dirEmoji   = isAboveEMA ? '🔻' : '🔺';

      const srLevel = snapM5.nearestSR;
      let structEmoji = '➖';
      if (srLevel) {
        if (srLevel.type === 'support' && direction === 'BUY') structEmoji = '🏰';
        if (srLevel.type === 'resistance' && direction === 'SELL') structEmoji = '🧱';
      }

      let winRateLine = 'N/D';
      if (backtest) {
        const wr = (backtest.winRate * 100).toFixed(1);
        const winEmoji = backtest.winRate >= 0.65 ? '🌟' : '⚠️';
        winRateLine = `*WinRate histórico:* ${wr}% ${winEmoji}`;
      }

      const tpText = snapM5.tpPrice ? `\n*TP:* ${snapM5.tpPrice}` : '';
      const slText = snapM5.slPrice ? `\n*SL:* ${snapM5.slPrice}` : '';

      const message = `
*🛡️🔱 FULL REVERSION SHIELD ✓*
*${symbol}* — ${dirEmoji} *${direction}*
_Confluencia M5 + M15 (Extremo)_

✅ *Sin Sándwich de EMAs*
✅ *Sin Pullback Geométrico*
${winRateLine}

*GATILLO DE AGOTAMIENTO*
🔥 *GIRO CONFIRMADO* (Elasticidad rotando)

*CONFLUENCIA ESTRUCTURAL*
${structEmoji} *${srLevel ? `${srLevel.type} (fza ${srLevel.strength})` : 'Sin zona S/R cercana'}*

*PARÁMETROS SUGERIDOS (BROKER)*${tpText}${slText}
🛡️🔱
      `.trim();

      const url = `https://api.telegram.org/bot${token}/sendMessage`;
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'Markdown',
        }),
      });
      console.log(`[Telegram] Alerta Shield Fused enviada para ${symbol}`);
    } catch (error) {
      console.error(`[Telegram] Error enviando alerta Shield Fused de ${symbol}:`, error);
    }
  }
}
