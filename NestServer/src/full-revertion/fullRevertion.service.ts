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
  AuditedSignal,
  AuditVerdict,
} from './fullRevertion.types';

// Intervalo mínimo entre cálculos por símbolo+timeframe (ms)
const MIN_CALC_INTERVAL_MS = 5_000;
// Cooldown alertas simples M5/M15 (10 min)
const ALERT_COOLDOWN_MS = 10 * 60 * 1000;
// Cooldown alerta fusionada M5+M15 (15 min — más conservadora)
const FUSED_ALERT_COOLDOWN_MS = 15 * 60 * 1000;
// Barras a usar en el backtest Full Reversion
const FR_BACKTEST_BARS = 50;
// Control de alertas individuales (false = desactivadas, solo enviar fusionadas M5+M15)
const ENABLE_INDIVIDUAL_ALERTS = false;

@Injectable()
export class FullRevertionService implements OnModuleInit {

  // Último snapshot calculado por símbolo+timeframe (ej. 'AUD/USD:M5')
  private lastSnapshots = new Map<string, FullRevertionSnapshot>();
  // Último backtest calculado por símbolo (solo M5)
  private lastBacktests = new Map<string, FullRevertionBacktestResult>();
  // Estado de alerta SIMPLE por símbolo+timeframe
  private alertStates = new Map<string, FRAlertState>();
  // Estado de alerta FUSIONADA por símbolo
  private fusedAlertStates = new Map<string, FRFusedAlertState>();
  // Rate-limit de cálculo
  private lastCalcTime = new Map<string, number>();

  private lastClosedCandleTime = new Map<string, number>();
  private triggerStates = new Map<string, 'reposo' | 'estirando' | 'giro'>();
  private lastGiroCandleTime = new Map<string, number>();
  private lastClosedElasticity = new Map<string, number | null>();
  private prevClosedElasticity = new Map<string, number | null>();

  // Cola global de señales auditadas (máximo 15 elementos)
  private auditedSignalsQueue: AuditedSignal[] = [];

  // Trackers para simular el cooldown del semáforo viejo y detectar transiciones
  private previousFusedStatesExp = new Map<string, string>();
  private previousFusedStatesNorm = new Map<string, string>();
  private previousTriggerStatesExp = new Map<string, string>();
  private previousTriggerStatesNorm = new Map<string, string>();

  constructor(
    private readonly marketService: MarketService,
    private readonly structureService: StructureService,
  ) { }

  onModuleInit() {
    this.marketService.events.on('broadcast', (msg: any) => {
      if (msg.type !== 'snapshot') return;
      this.onSnapshot(msg.symbol, msg.m5.timestamp, msg.m5.price);
      this.auditBroadcastMessage(msg);
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
    this.runForTimeframe(symbol, price, '5min', 'M5', timestamp);
    this.runForTimeframe(symbol, price, '15min', 'M15', timestamp);

    // Después de actualizar ambos timeframes, evaluar la fusión M5+M15
    this.checkFusedAlert(symbol);
  }

  private runForTimeframe(
    symbol: string,
    price: number,
    interval: '5min' | '15min',
    timeframe: 'M5' | 'M15',
    timestamp: number
  ): void {
    const calcKey = `${symbol}:${timeframe}`;
    const now = Date.now();
    const last = this.lastCalcTime.get(calcKey) ?? 0;

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
    symbol: string,
    timeframe: 'M5' | 'M15',
    snap: FullRevertionSnapshot,
    backtest: FullRevertionBacktestResult | null
  ): Promise<void> {
    const alertKey = `${symbol}:${timeframe}`;
    const now = Date.now();

    if (!this.alertStates.has(alertKey)) {
      this.alertStates.set(alertKey, { previousFRState: null, lastAlertTime: 0 });
    }

    const alertState = this.alertStates.get(alertKey)!;

    const isNewGreen = alertState.previousFRState !== 'GREEN' && snap.state === 'GREEN';
    const canAlert = now - alertState.lastAlertTime > ALERT_COOLDOWN_MS;

    if (isNewGreen && snap.signalAllowed && canAlert) {
      alertState.lastAlertTime = now;
      await this.sendSimpleTelegramAlert(symbol, timeframe, snap, backtest);
    }

    alertState.previousFRState = snap.state;
  }

  // ─── Alerta fusionada: M5 + M15 ambos en GREEN ───────────────────────────

  private async checkFusedAlert(symbol: string): Promise<void> {
    const snapM5 = this.lastSnapshots.get(`${symbol}:M5`);
    const snapM15 = this.lastSnapshots.get(`${symbol}:M15`);

    if (!snapM5 || !snapM15) return;

    if (!this.fusedAlertStates.has(symbol)) {
      this.fusedAlertStates.set(symbol, {
        previousM5State: null,
        previousM15State: null,
        lastFusedAlertTime: 0,
        preAlertActive: false,
      });
    }

    const fusedState = this.fusedAlertStates.get(symbol)!;
    const now = Date.now();

    const bothGreen = snapM5.state === 'GREEN' && snapM15.state === 'GREEN';
    const bothAllowed = snapM5.signalAllowed && snapM15.signalAllowed;

    // Lógica del Gatillo:
    // 1. Activar/Actualizar pre-alerta si M5 y M15 entran en GREEN con pendiente EMA permitida
    if (bothGreen && bothAllowed) {
      if (!fusedState.preAlertActive) {
        console.log(`[FullRevertion] [${symbol}] 🪃 Pre-alerta de confluencia activada. Esperando Giro de Elasticidad...`);
        fusedState.preAlertActive = true;
      }
      fusedState.lastGreenTime = now; // Guardar el último momento en zona extrema
    } else {
      // Si salen de la confluencia extrema, mantener la pre-alerta activa si:
      // - Ha pasado menos de 20 minutos (1,200,000 ms) desde que se registró la confluencia
      // - Y el precio sigue estirado por encima del umbral de seguridad de 1.2 ATR
      const lastGreen = fusedState.lastGreenTime ?? 0;
      const timeElapsed = now - lastGreen;
      const stillStretched = snapM5.elasticity > 1.2;

      if (fusedState.preAlertActive) {
        if (timeElapsed > 20 * 60 * 1000 || !stillStretched) {
          console.log(`[FullRevertion] [${symbol}] ⏳ Pre-alerta cancelada (cooldown de tiempo superado o precio retornó a la media).`);
          fusedState.preAlertActive = false;
          fusedState.lastGreenTime = 0;
        }
      }
    }

    const lastClosedTime = this.lastClosedCandleTime.get(symbol) ?? 0;
    const lastGiroTime = this.lastGiroCandleTime.get(symbol) ?? 0;

    // 2. Determinar si ocurrió un Giro en la última vela cerrada M5
    let currentTriggerState: 'reposo' | 'estirando' | 'giro' = 'reposo';

    if (lastClosedTime > 0 && lastClosedTime === lastGiroTime) {
      // Mantener el estado de giro activo durante toda la vela del giro en el dashboard
      currentTriggerState = 'giro';
    } else if (fusedState.preAlertActive) {
      const lastEl = this.lastClosedElasticity.get(symbol) ?? null;
      const prevEl = this.prevClosedElasticity.get(symbol) ?? null;

      if (lastEl !== null && prevEl !== null && lastEl < prevEl) {
        currentTriggerState = 'giro';
        this.lastGiroCandleTime.set(symbol, lastClosedTime); // Registrar vela donde ocurrió el giro
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
        fusedState.lastFusedAlertTime = now;
        fusedState.preAlertActive = false; // Resetear pre-alerta tras disparar para evitar spams en el mismo giro
        fusedState.lastGreenTime = 0;

        console.log(`[FullRevertion] [${symbol}] 🔥 GIRO CONFIRMADO. Enviando alerta a Telegram...`);
        const backtest = this.lastBacktests.get(symbol) ?? null;
        await this.sendFusedTelegramAlert(symbol, snapM5, snapM15, backtest);
      }
    }

    fusedState.previousM5State = snapM5.state;
    fusedState.previousM15State = snapM15.state;
  }

  // ─── Telegram: Alerta simple (M5 o M15) ──────────────────────────────────

  private async sendSimpleTelegramAlert(
    symbol: string,
    timeframe: 'M5' | 'M15',
    snap: FullRevertionSnapshot,
    backtest: FullRevertionBacktestResult | null
  ): Promise<void> {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) return;

    try {
      const isAboveEMA = snap.price > snap.ema100;
      const direction = isAboveEMA ? 'SELL' : 'BUY';
      const dirEmoji = direction === 'BUY' ? '🟢 COMPRA (BUY) 📈' : '🔴 VENTA (SELL) 📉';
      const decimals = symbol.includes('JPY') ? 3 : 5;
      const priceStr = snap.price.toFixed(decimals);
      const emaStr = snap.ema100.toFixed(decimals);
      const slopeLabel = snap.emaSlope === 'FLAT' ? '✅ PLANA' : '⚠️ SUAVE';
      const slopeDirEmo = snap.slopeDirection === 'UP' ? '↗️ Subiendo' : snap.slopeDirection === 'DOWN' ? '↘️ Bajando' : '→ Lateral';
      const winRateEmoji = backtest && backtest.winRate >= 70 ? '🔥' : backtest && backtest.winRate >= 55 ? '✅' : '⚠️';
      const timeStr = new Date().toLocaleString('es-CO', {
        timeZone: 'America/Bogota', year: 'numeric', month: 'short',
        day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'
      });

      let msg = `🌊🌊🌊🌊🌊🌊🌊🌊🌊🌊🌊🌊\n`;
      msg += `🔮 *FULL REVERSION — ${timeframe}* 🔮\n`;
      msg += `🌊🌊🌊🌊🌊🌊🌊🌊🌊🌊🌊🌊\n\n`;
      msg += `📍 *Par:* \`${symbol}\`  ·  *Timeframe:* \`${timeframe}\`\n`;
      msg += `🎯 *Dirección sugerida:* ${dirEmoji}\n`;
      msg += `💰 *Precio:* \`${priceStr}\`  ·  *EMA100:* \`${emaStr}\`\n\n`;
      msg += `━━━━━━━━━━━━━━━━━━━━━━\n`;
      msg += `📐 *Elasticidad ${timeframe}:* \`${snap.elasticity.toFixed(3)}\` _(P${snap.percentile.toFixed(0)}%)_\n`;
      msg += `🧭 *Pendiente EMA100:* ${slopeLabel}\n`;
      msg += `   \`${Math.abs(snap.emaSlopeValue).toFixed(3)} ATR/10b\` ${slopeDirEmo}\n\n`;

      if (backtest) {
        msg += `━━━━━━━━━━━━━━━━━━━━━━\n`;
        msg += `${winRateEmoji} *Backtest FR (${FR_BACKTEST_BARS}b M5):*\n`;
        msg += `   · Win Rate: \`${backtest.winRate}%\`  · Señales: \`${backtest.allowedSignals}\`\n`;
        msg += `   · Bloqueadas por pendiente: \`${backtest.filteredBySlope}\`\n`;
        msg += `   · Avg barras al cruce: \`${backtest.avgBarsToRevert}\`\n\n`;
      }

      msg += `💡 _EMA en pendiente ${snap.emaSlope} — reversión estructural probable_\n`;
      msg += `⚠️ _Señal parcial: solo ${timeframe}. Espera M5+M15 para mayor convicción._\n\n`;
      msg += `⏱ _${timeStr} COT_\n`;
      msg += `🌊🌊🌊🌊🌊🌊🌊🌊🌊🌊🌊🌊`;

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
    symbol: string,
    snapM5: FullRevertionSnapshot,
    snapM15: FullRevertionSnapshot,
    backtest: FullRevertionBacktestResult | null
  ): Promise<void> {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) return;

    try {
      const isAboveEMA = snapM5.price > snapM5.ema100;
      const direction = isAboveEMA ? 'SELL' : 'BUY';
      const dirEmoji = direction === 'BUY' ? '🟢 COMPRA (BUY) 📈' : '🔴 VENTA (SELL) 📉';
      const decimals = symbol.includes('JPY') ? 3 : 5;
      const priceStr = snapM5.price.toFixed(decimals);
      const emaStr = snapM5.ema100.toFixed(decimals);

      const slopeLabelM5 = snapM5.emaSlope === 'FLAT' ? '✅ PLANA' : '⚠️ SUAVE';
      const slopeLabelM15 = snapM15.emaSlope === 'FLAT' ? '✅ PLANA' : '⚠️ SUAVE';

      const winRateEmoji = backtest && backtest.winRate >= 70 ? '🔥🔥🔥' : backtest && backtest.winRate >= 55 ? '🔥🔥' : '🔥';
      const timeStr = new Date().toLocaleString('es-CO', {
        timeZone: 'America/Bogota', year: 'numeric', month: 'short',
        day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'
      });

      // Confluencia Estructural
      let divText = 'Ninguna';
      if (snapM5.divergence === 'bearish') divText = 'Bajista RSI 🐻';
      if (snapM5.divergence === 'bullish') divText = 'Alcista RSI 🐂';

      let srText = 'Ninguno';
      if (snapM5.nearestSR) {
        const srTypeLabel = snapM5.nearestSR.type === 'resistance' ? 'Resistencia' : 'Soporte';
        srText = `${srTypeLabel} en \`${snapM5.nearestSR.price.toFixed(decimals)}\` (fuerza ${snapM5.nearestSR.strength})`;
      }

      // ─── Mensaje fusionado — máxima convicción ────────────────────────────
      let msg = `🔱🔱🔱🔱🔱🔱🔱🔱🔱🔱🔱🔱\n`;
      msg += `🚨🌊 *FULL REVERSION — FUSIONADO* 🌊🚨\n`;
      msg += `✨ *M5 + M15 ALINEADOS — GIRO CONFIRMADO* ✨\n`;
      msg += `🔱🔱🔱🔱🔱🔱🔱🔱🔱🔱🔱🔱\n\n`;
      msg += `📍 *Par:* \`${symbol}\`\n`;
      msg += `🎯 *Dirección:* ${dirEmoji}\n`;
      msg += `💰 *Precio:* \`${priceStr}\`  ·  *EMA100:* \`${emaStr}\`\n\n`;

      msg += `━━━━━━━━━━━━━━━━━━━━━━\n`;
      msg += `🪃 *Gatillo:* La resortera ha comenzado a ceder (giro confirmado en vela cerrada M5).\n\n`;

      msg += `🏰 *Confluencias Estructurales (M5):*\n`;
      msg += `   · Divergencia: ${divText}\n`;
      msg += `   · S/R Cercano: ${srText}\n\n`;

      msg += `🎯 *Parámetros Sugeridos (Broker):*\n`;
      msg += `   · *TP (EMA100):* \`${snapM5.tpPrice?.toFixed(decimals)}\`\n`;
      msg += `   · *SL (1.8 ATR):* \`${snapM5.slPrice?.toFixed(decimals)}\`\n\n`;

      msg += `━━━━━━━━━━━━━━━━━━━━━━\n`;
      msg += `📊 *Estado Multi-Timeframe:*\n`;
      msg += `   🕐 *M5* — Elasticidad: \`${snapM5.elasticity.toFixed(3)}\` _(P${snapM5.percentile.toFixed(0)}%)_ 🟢 GREEN\n`;
      msg += `      Pendiente: ${slopeLabelM5} \`${Math.abs(snapM5.emaSlopeValue).toFixed(3)} ATR/10b\`\n\n`;
      msg += `   🕑 *M15* — Elasticidad: \`${snapM15.elasticity.toFixed(3)}\` _(P${snapM15.percentile.toFixed(0)}%)_ 🟢 GREEN\n`;
      msg += `      Pendiente: ${slopeLabelM15} \`${Math.abs(snapM15.emaSlopeValue).toFixed(3)} ATR/10b\`\n\n`;

      if (backtest) {
        msg += `━━━━━━━━━━━━━━━━━━━━━━\n`;
        msg += `${winRateEmoji} *Backtest Full Reversion (${FR_BACKTEST_BARS}b):*\n`;
        msg += `   · Win Rate con filtro: \`${backtest.winRate}%\`\n`;
        msg += `   · Señales permitidas: \`${backtest.allowedSignals}\`\n`;
        msg += `   · Bloqueadas por tendencia: \`${backtest.filteredBySlope}\`\n`;
        msg += `   · Promedio al cruce completo: \`${backtest.avgBarsToRevert} barras M5\`\n\n`;
      }

      msg += `━━━━━━━━━━━━━━━━━━━━━━\n`;
      msg += `🔍 *¿Por qué esta es la señal más fuerte?*\n`;
      msg += `   ✅ M5 sobreestirado + Giro confirmado\n`;
      msg += `   ✅ M15 sobreestirado + Pendiente permitida\n`;
      msg += `   ✅ El precio tiene presión de reversión en AMBOS marcos\n`;
      msg += `   🚫 No es un simple pullback en tendencia\n\n`;

      msg += `⏱ _${timeStr} COT_\n`;
      msg += `🔱🔱🔱🔱🔱🔱🔱🔱🔱🔱🔱🔱`;

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

  // ─── AUDITORÍA DE SEÑALES DEL SEMÁFORO VIEJO ──────────────────────────────

  getAuditedSignals(): AuditedSignal[] {
    return this.auditedSignalsQueue;
  }

  private auditBroadcastMessage(msg: any): void {
    const symbol = msg.symbol;

    // 1. Auditoría del Semáforo Viejo Normal
    if (msg.fusedState) {
      const prevFusedNorm = this.previousFusedStatesNorm.get(symbol) ?? 'RED';
      const isNewFusedGreen = prevFusedNorm !== 'GREEN' && msg.fusedState === 'GREEN';
      this.previousFusedStatesNorm.set(symbol, msg.fusedState);

      if (isNewFusedGreen) {
        this.runAudit(symbol, 'Tipo A', msg.m5.price, 'normal');
      }
    }

    if (msg.triggerState) {
      const prevTriggerNorm = this.previousTriggerStatesNorm.get(symbol) ?? 'reposo';
      const isNewGiro = msg.triggerState === 'giro' && prevTriggerNorm !== 'giro';
      this.previousTriggerStatesNorm.set(symbol, msg.triggerState);

      if (isNewGiro) {
        this.runAudit(symbol, 'Tipo C', msg.m5.price, 'normal');
      }
    }

    // 2. Auditoría del Semáforo Viejo Experimental
    if (msg.experimental) {
      const exp = msg.experimental;

      if (exp.fusedState) {
        const prevFusedExp = this.previousFusedStatesExp.get(symbol) ?? 'RED';
        const isNewFusedGreenExp = prevFusedExp !== 'GREEN' && exp.fusedState === 'GREEN';
        this.previousFusedStatesExp.set(symbol, exp.fusedState);

        if (isNewFusedGreenExp) {
          this.runAudit(symbol, 'Tipo A (Exp)', exp.m5.price, 'experimental');
        }
      }

      if (exp.triggerState) {
        const prevTriggerExp = this.previousTriggerStatesExp.get(symbol) ?? 'reposo';
        const isNewGiroExp = exp.triggerState === 'giro' && prevTriggerExp !== 'giro';
        this.previousTriggerStatesExp.set(symbol, exp.triggerState);

        if (isNewGiroExp) {
          this.runAudit(symbol, 'Tipo C (Exp)', exp.m5.price, 'experimental');
        }
      }
    }
  }

  private runAudit(symbol: string, alertName: string, price: number, mode: 'normal' | 'experimental'): void {
    const snapM5 = this.getLastSnapshot(symbol, 'M5');
    const snapM15 = this.getLastSnapshot(symbol, 'M15');
    if (!snapM5) return;

    const decimals = symbol.includes('JPY') ? 3 : 5;
    let divText = 'Ninguna';
    if (snapM5.divergence === 'bearish') divText = 'Bajista RSI 🐻';
    if (snapM5.divergence === 'bullish') divText = 'Alcista RSI 🐂';

    let srText = 'Ninguno';
    let srStrength = 0;
    if (snapM5.nearestSR) {
      const srTypeLabel = snapM5.nearestSR.type === 'resistance' ? 'Resistencia' : 'Soporte';
      srText = `${srTypeLabel} (${snapM5.nearestSR.price.toFixed(decimals)})`;
      srStrength = snapM5.nearestSR.strength;
    }

    let verdict: AuditVerdict = 'APPROVED';
    let verdictText = '';

    const isSteep = snapM5.emaSlope === 'STEEP';
    const isGentle = snapM5.emaSlope === 'GENTLE';
    const hasHighSR = srStrength >= 3;
    const hasDivergence = snapM5.divergence && snapM5.divergence !== 'none';
    const isGiroState = snapM5.triggerState === 'giro';

    if (isSteep) {
      verdict = 'REJECTED';
      verdictText = `Tendencia fuerte (STEEP) con pendiente inclinada en ${snapM5.emaSlopeValue.toFixed(3)} ATR/10b. Alto riesgo de continuación de tendencia. Se desaconseja operar contra tendencia en este punto.`;
    } else if (isGentle) {
      verdict = 'WARNING';
      verdictText = `Pendiente suave (GENTLE) de ${snapM5.emaSlopeValue.toFixed(3)} ATR/10b. Existe inercia moderada. Si decides operar, reduce el lotaje al 50% y espera confirmación visual de mechas.`;
    } else if (isGiroState && hasDivergence && hasHighSR) {
      verdict = 'VIP';
      verdictText = `¡Confluencia Máxima! Pendiente plana/favorable, giro confirmado en M5, divergencia de fuerza RSI activa y soporte/resistencia institucional robusto (fuerza ${srStrength}) cercano.`;
    } else {
      verdict = 'APPROVED';
      verdictText = `Pendiente plana o favorable (${snapM5.emaSlopeValue.toFixed(3)} ATR/10b). Estiramiento percentil en GREEN. Condiciones de reversión estadística válidas.`;
    }

    const signal: AuditedSignal = {
      id: Math.random().toString(36).substr(2, 9).toUpperCase(),
      symbol,
      direction: price > snapM5.ema100 ? 'SELL' : 'BUY',
      alertName: `${alertName} (${mode === 'experimental' ? 'Exp' : 'Norm'})`,
      price,
      timestamp: Date.now(),
      verdict,
      verdictText,
      emaSlope: snapM5.emaSlope,
      emaSlopeValue: snapM5.emaSlopeValue,
      elasticityM5: snapM5.elasticity,
      divergence: divText,
      nearestSR: srText,
      tpPrice: snapM5.tpPrice ?? price,
      slPrice: snapM5.slPrice ?? price,
    };

    this.auditedSignalsQueue.unshift(signal);
    if (this.auditedSignalsQueue.length > 15) {
      this.auditedSignalsQueue.pop();
    }

    console.log(`[Audit Engine] ⚖️ Señal ${alertName} de ${symbol} auditada. Veredicto: ${verdict} - ${verdictText}`);

    this.sendAuditedTelegramAlert(signal, snapM5, snapM15);
  }

  private async sendAuditedTelegramAlert(
    signal: AuditedSignal,
    snapM5: FullRevertionSnapshot,
    snapM15: FullRevertionSnapshot | null
  ): Promise<void> {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) return;

    try {
      const decimals = signal.symbol.includes('JPY') ? 3 : 5;
      const directionEmoji = signal.direction === 'BUY' ? '🟢 COMPRA (BUY) 📈' : '🔴 VENTA (SELL) 📉';

      let msg = '';
      if (signal.verdict === 'VIP') {
        msg += `👑 *APROBACIÓN VIP (🔱 Confluencia Máxima):* *${signal.symbol}*\n`;
        msg += `✨ _¡El motor de Full Reversion ha aprobado esta señal con la máxima convicción institucional!_\n\n`;
      } else if (signal.verdict === 'APPROVED') {
        msg += `✅ *ALERTA AUDITADA APROBADA:* *${signal.symbol}*\n`;
        msg += `👍 _Condiciones operativas ideales para retorno a la media._\n\n`;
      } else if (signal.verdict === 'WARNING') {
        msg += `⚠️ *ALERTA AUDITADA CON RIESGO:* *${signal.symbol}*\n`;
        msg += `🚧 _Pendiente moderada detectada. Considera reducir exposición._\n\n`;
      } else {
        msg += `🚫 *ALERTA AUDITADA RECHAZADA:* *${signal.symbol}*\n`;
        msg += `❌ _¡Evita operar! El Semáforo Viejo detectó estiramiento, pero la tendencia es demasiado fuerte._\n\n`;
      }

      msg += `📍 *Par:* \`${signal.symbol}\`  ·  *Alerta:* \`${signal.alertName}\`\n`;
      msg += `🎯 *Dirección:* ${directionEmoji}\n`;
      msg += `💰 *Precio:* \`${signal.price.toFixed(decimals)}\`  ·  *EMA100:* \`${snapM5.ema100.toFixed(decimals)}\`\n\n`;
      msg += `━━━━━━━━━━━━━━━━━━━━━━\n`;
      msg += `⚖️ *VEREDICTO CLÍNICO:*\n`;
      msg += `   _${signal.verdictText}_\n\n`;
      msg += `📊 *Filtros de Reversión M5:*\n`;
      msg += `   · Pendiente: \`${signal.emaSlope}\` (${signal.emaSlopeValue.toFixed(3)} ATR/10b)\n`;
      msg += `   · Divergencia RSI: \`${signal.divergence}\`\n`;
      msg += `   · Soporte/Resistencia: \`${signal.nearestSR}\`\n\n`;

      if (signal.verdict !== 'REJECTED') {
        msg += `🎯 *Parámetros Sugeridos (Broker):*\n`;
        msg += `   · TP (EMA100): \`${signal.tpPrice.toFixed(decimals)}\`\n`;
        msg += `   · SL (1.8 ATR): \`${signal.slPrice.toFixed(decimals)}\`\n\n`;
      }

      msg += `⏱ _${new Date(signal.timestamp).toLocaleString('es-CO', { timeZone: 'America/Bogota' })} COT_\n`;
      msg += `🔱 Auditoría de Reversión Completa`;

      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: msg, parse_mode: 'Markdown' }),
      });
    } catch (err) {
      console.error('[Audit Engine] ❌ Error enviando alerta de auditoría Telegram:', err);
    }
  }
}
