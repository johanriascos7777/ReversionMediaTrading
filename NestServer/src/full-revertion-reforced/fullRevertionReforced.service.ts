/**
 * fullRevertionReforced.service.ts
 *
 * Servicio de Full Reversion Reinforced.
 * Calcula EMA50, Stochastic y CCI, cruzando auditorías en tiempo real.
 */

import { Injectable, OnModuleInit } from '@nestjs/common';
import { MarketService } from '../market/market.service';
import { StructureService } from '../structure/structure.service';
import type { Candle } from '../market/types';
import {
  calculateFullRevertionSnapshot,
  runFullRevertionBacktest,
  pushFullRevertionPercentile,
} from './fullRevertionReforcedEngine';
import type {
  FullRevertionReforcedSnapshot,
  FullRevertionReforcedBacktestResult,
  FRAlertState,
  FRFusedAlertState,
  AuditedSignal,
  AuditVerdict,
} from './fullRevertionReforced.types';

const MIN_CALC_INTERVAL_MS      = 5_000;
const ALERT_COOLDOWN_MS         = 10 * 60 * 1000;
const FUSED_ALERT_COOLDOWN_MS   = 15 * 60 * 1000;
const FR_BACKTEST_BARS          = 50;
const ENABLE_INDIVIDUAL_ALERTS  = false;

@Injectable()
export class FullRevertionReforcedService implements OnModuleInit {

  private lastSnapshots     = new Map<string, FullRevertionReforcedSnapshot>();
  private lastBacktests     = new Map<string, FullRevertionReforcedBacktestResult>();
  private alertStates       = new Map<string, FRAlertState>();
  private fusedAlertStates  = new Map<string, FRFusedAlertState>();
  private lastCalcTime      = new Map<string, number>();

  private lastClosedCandleTime = new Map<string, number>();
  private triggerStates        = new Map<string, 'reposo' | 'estirando' | 'giro'>();
  private lastGiroCandleTime   = new Map<string, number>();
  private lastClosedElasticity = new Map<string, number | null>();
  private prevClosedElasticity = new Map<string, number | null>();

  private auditedSignalsQueue: AuditedSignal[] = [];

  private previousFusedStatesExp = new Map<string, string>();
  private previousFusedStatesNorm = new Map<string, string>();
  private previousTriggerStatesExp = new Map<string, string>();
  private previousTriggerStatesNorm = new Map<string, string>();

  constructor(
    private readonly marketService: MarketService,
    private readonly structureService: StructureService,
  ) {}

  onModuleInit() {
    this.marketService.events.on('broadcast', (msg: any) => {
      if (msg.type !== 'snapshot') return;
      this.onSnapshot(msg.symbol, msg.m5.timestamp, msg.m5.price);
      this.auditBroadcastMessage(msg);
    });

    console.log('[FullRevertionReforcedService] ⚡ Inicializado con soporte EMA50 y osciladores.');
  }

  getLastSnapshot(symbol: string, timeframe: 'M5' | 'M15'): FullRevertionReforcedSnapshot | null {
    return this.lastSnapshots.get(`${symbol}:${timeframe}`) ?? null;
  }

  getLastBacktest(symbol: string): FullRevertionReforcedBacktestResult | null {
    return this.lastBacktests.get(symbol) ?? null;
  }

  getAllSymbols(): string[] {
    const symbols = new Set<string>();
    for (const key of this.lastSnapshots.keys()) {
      symbols.add(key.split(':')[0]);
    }
    return Array.from(symbols);
  }

  getAuditedSignals(): AuditedSignal[] {
    return this.auditedSignalsQueue;
  }

  private onSnapshot(symbol: string, timestamp: number, price: number): void {
    this.runForTimeframe(symbol, price, '5min',  'M5',  timestamp);
    this.runForTimeframe(symbol, price, '15min', 'M15', timestamp);
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
    if (candles.length < 115) return;

    const snap = calculateFullRevertionSnapshot(symbol, candles, price, timeframe, timestamp);
    if (!snap) return;

    // Confluencia Estructural
    const structSnap = this.structureService.getLastSnapshot(symbol, timeframe);
    if (structSnap) {
      snap.divergence = structSnap.divergence;
      snap.nearestSR = structSnap.nearestSR;
    }

    const decimals = symbol.includes('JPY') ? 3 : 5;
    const isBuy = price < snap.ema100;
    const rawSl = isBuy ? (price - 1.8 * snap.atr) : (price + 1.8 * snap.atr);
    snap.tpPrice = Math.round(snap.ema100 * Math.pow(10, decimals)) / Math.pow(10, decimals);
    if (snap.ema50) {
      snap.tp50Price = Math.round(snap.ema50 * Math.pow(10, decimals)) / Math.pow(10, decimals);
    }
    snap.slPrice = Math.round(rawSl * Math.pow(10, decimals)) / Math.pow(10, decimals);
    snap.triggerState = this.triggerStates.get(symbol) ?? 'reposo';

    this.lastSnapshots.set(calcKey, snap);

    const lastCandleClose = candles[candles.length - 1].close;
    pushFullRevertionPercentile(symbol, timeframe, Math.abs(lastCandleClose - snap.ema100) / snap.atr);

    if (timeframe === 'M5') {
      const lastClosedCandle = candles[candles.length - 1];
      const lastClosedTime = this.lastClosedCandleTime.get(symbol) ?? 0;

      if (lastClosedCandle.time !== lastClosedTime) {
        this.lastClosedCandleTime.set(symbol, lastClosedCandle.time);

        const prevEl = this.lastClosedElasticity.get(symbol) ?? null;
        this.prevClosedElasticity.set(symbol, prevEl);

        const currentEl = Math.abs(lastClosedCandle.close - snap.ema100) / snap.atr;
        this.lastClosedElasticity.set(symbol, currentEl);
      }
    }

    if (timeframe === 'M5') {
      const backtest = runFullRevertionBacktest(candles, FR_BACKTEST_BARS);
      this.lastBacktests.set(symbol, backtest);

      if (ENABLE_INDIVIDUAL_ALERTS) {
        this.checkSimpleAlert(symbol, 'M5', snap, backtest);
      }
    }

    if (timeframe === 'M15') {
      const backtestM5 = this.lastBacktests.get(symbol) ?? null;
      if (ENABLE_INDIVIDUAL_ALERTS) {
        this.checkSimpleAlert(symbol, 'M15', snap, backtestM5);
      }
    }
  }

  private async checkSimpleAlert(
    symbol:    string,
    timeframe: 'M5' | 'M15',
    snap:      FullRevertionReforcedSnapshot,
    backtest:  FullRevertionReforcedBacktestResult | null
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

    if (bothGreen && bothAllowed) {
      if (!fusedState.preAlertActive) {
        console.log(`[FullRevertionReforced] [${symbol}] 🪃 Pre-alerta activada. Esperando Giro...`);
        fusedState.preAlertActive = true;
      }
      fusedState.lastGreenTime = now;
    } else {
      const lastGreen = fusedState.lastGreenTime ?? 0;
      const timeElapsed = now - lastGreen;
      const stillStretched = snapM5.elasticity > 1.2;

      if (fusedState.preAlertActive) {
        if (timeElapsed > 20 * 60 * 1000 || !stillStretched) {
          console.log(`[FullRevertionReforced] [${symbol}] ⏳ Pre-alerta cancelada.`);
          fusedState.preAlertActive = false;
          fusedState.lastGreenTime = 0;
        }
      }
    }

    const lastClosedTime = this.lastClosedCandleTime.get(symbol) ?? 0;
    const lastGiroTime   = this.lastGiroCandleTime.get(symbol) ?? 0;

    let currentTriggerState: 'reposo' | 'estirando' | 'giro' = 'reposo';
    
    if (lastClosedTime > 0 && lastClosedTime === lastGiroTime) {
      currentTriggerState = 'giro';
    } else if (fusedState.preAlertActive) {
      const lastEl = this.lastClosedElasticity.get(symbol) ?? null;
      const prevEl = this.prevClosedElasticity.get(symbol) ?? null;

      if (lastEl !== null && prevEl !== null && lastEl < prevEl) {
        currentTriggerState = 'giro';
        this.lastGiroCandleTime.set(symbol, lastClosedTime);
      } else {
        currentTriggerState = 'estirando';
      }
    }

    this.triggerStates.set(symbol, currentTriggerState);
    snapM5.triggerState = currentTriggerState;
    snapM15.triggerState = currentTriggerState;

    if (fusedState.preAlertActive && currentTriggerState === 'giro') {
      const canAlert = now - fusedState.lastFusedAlertTime > FUSED_ALERT_COOLDOWN_MS;
      if (canAlert) {
        fusedState.lastFusedAlertTime = now;
        fusedState.preAlertActive = false;
        fusedState.lastGreenTime = 0;
        
        console.log(`[FullRevertionReforced] [${symbol}] 🔥 GIRO CONFIRMADO.`);
        const backtest = this.lastBacktests.get(symbol) ?? null;
        await this.sendFusedTelegramAlert(symbol, snapM5, snapM15, backtest);
      }
    }

    fusedState.previousM5State  = snapM5.state;
    fusedState.previousM15State = snapM15.state;
  }

  private async sendSimpleTelegramAlert(
    symbol:    string,
    timeframe: 'M5' | 'M15',
    snap:      FullRevertionReforcedSnapshot,
    backtest:  FullRevertionReforcedBacktestResult | null
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
      const timeStr = new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' });

      let msg = `🌊 [REFORCED] Full Reversion Simple — ${timeframe}\n`;
      msg    += `Par: \`${symbol}\`  ·  Dirección: ${dirEmoji}\n`;
      msg    += `Precio: \`${priceStr}\`  ·  EMA100: \`${emaStr}\`\n`;
      msg    += `Elasticidad: \`${snap.elasticity.toFixed(3)}\` · Pendiente: ${slopeLabel} (${snap.emaSlopeValue.toFixed(3)} ATR)\n`;
      msg    += `⏱ _${timeStr}_`;

      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: msg, parse_mode: 'Markdown' }),
      });
    } catch (err) {
      console.error('[FullRevertionReforced] Error simple alert:', err);
    }
  }

  private async sendFusedTelegramAlert(
    symbol:   string,
    snapM5:   FullRevertionReforcedSnapshot,
    snapM15:  FullRevertionReforcedSnapshot,
    backtest: FullRevertionReforcedBacktestResult | null
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
      const timeStr = new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' });

      let msg = `🔱🔱🔱 FUSIONADO REFORZADO 🔱🔱🔱\n`;
      msg    += `📍 *Par:* \`${symbol}\` · *Dirección:* ${dirEmoji}\n`;
      msg    += `💰 *Precio:* \`${priceStr}\`  ·  *EMA100:* \`${emaStr}\`\n`;
      if (snapM5.ema50) {
        msg  += `📊 *EMA50:* \`${snapM5.ema50.toFixed(decimals)}\` (Elast50: \`${snapM5.elasticity50?.toFixed(2)}\` ATR)\n`;
      }
      if (snapM5.stochK !== undefined) {
        msg  += `📈 *Osciladores:* Stoch: \`${snapM5.stochK.toFixed(1)} / ${snapM5.stochD?.toFixed(1)}\` · CCI: \`${snapM5.cci?.toFixed(1)}\`\n`;
      }
      msg    += `🎯 *TP1 (EMA50):* \`${snapM5.tp50Price?.toFixed(decimals)}\`\n`;
      msg    += `🎯 *TP2 (EMA100):* \`${snapM5.tpPrice?.toFixed(decimals)}\`\n`;
      msg    += `🛑 *SL (1.8 ATR):* \`${snapM5.slPrice?.toFixed(decimals)}\`\n`;
      msg    += `🕐 M5 Slope: ${slopeLabelM5} (${snapM5.emaSlopeValue.toFixed(3)} ATR)\n`;
      msg    += `🕑 M15 Slope: ${slopeLabelM15} (${snapM15.emaSlopeValue.toFixed(3)} ATR)\n`;
      msg    += `⏱ _${timeStr} COT_`;

      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: msg, parse_mode: 'Markdown' }),
      });
    } catch (err) {
      console.error('[FullRevertionReforced] Error fused alert:', err);
    }
  }

  private auditBroadcastMessage(msg: any): void {
    const symbol = msg.symbol;

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
    const hasDivergence = snapM5.divergence && snapM5.divergence !== 'none' && !snapM5.divergence.toLowerCase().includes('ninguna');
    const isGiroState = snapM5.triggerState === 'giro';

    const isSell = price > snapM5.ema100;
    const isStochExtreme = isSell 
      ? ((snapM5.stochK ?? 50) > 70 || (snapM5.stochD ?? 50) > 70)
      : ((snapM5.stochK ?? 50) < 30 || (snapM5.stochD ?? 50) < 30);
    const isCciExtreme = isSell
      ? (snapM5.cci ?? 0) > 100
      : (snapM5.cci ?? 0) < -100;

    if (isSteep) {
      verdict = 'REJECTED';
      verdictText = `Tendencia fuerte (STEEP) con pendiente inclinada en ${snapM5.emaSlopeValue.toFixed(3)} ATR/10b. Alto riesgo de continuación. Se desaconseja operar contra tendencia.`;
    } else if (isGentle) {
      verdict = 'WARNING';
      verdictText = `Pendiente suave (GENTLE) de ${snapM5.emaSlopeValue.toFixed(3)} ATR/10b. Existe inercia moderada. Reduce el lotaje al 50% y vigila rechazos en mechas.`;
    } else if (isGiroState && (hasDivergence || hasHighSR) && isStochExtreme && isCciExtreme) {
      verdict = 'VIP';
      verdictText = `¡Confluencia Máxima VIP! Pendiente favorable, giro M5 confirmado, divergencia RSI o nivel S/R robusto activo, apoyado por agotamiento extremo en Stochastic (%K: ${snapM5.stochK?.toFixed(1)}) y CCI (${snapM5.cci?.toFixed(1)}).`;
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
      ema50: snapM5.ema50,
      tp50Price: snapM5.tp50Price,
      stochK: snapM5.stochK,
      stochD: snapM5.stochD,
      cci: snapM5.cci,
    };

    this.auditedSignalsQueue.unshift(signal);
    if (this.auditedSignalsQueue.length > 15) {
      this.auditedSignalsQueue.pop();
    }

    console.log(`[Audit Engine Reforced] ⚖️ Señal ${alertName} de ${symbol} auditada. Veredicto: ${verdict}`);
    this.sendAuditedTelegramAlert(signal, snapM5, snapM15);
  }

  private async sendAuditedTelegramAlert(
    signal: AuditedSignal,
    snapM5: FullRevertionReforcedSnapshot,
    snapM15: FullRevertionReforcedSnapshot | null
  ): Promise<void> {
    const token  = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) return;

    try {
      const decimals = signal.symbol.includes('JPY') ? 3 : 5;
      const directionEmoji = signal.direction === 'BUY' ? '🟢 COMPRA (BUY) 📈' : '🔴 VENTA (SELL) 📉';
      
      let msg = '';
      if (signal.verdict === 'VIP') {
        msg += `👑 *APROBACIÓN VIP (🔱 Confluencia Máxima):* *${signal.symbol}*\n`;
        msg += `✨ _¡El motor de Full Reversion Reforzado ha aprobado esta señal con la máxima convicción!_\n\n`;
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
      msg += `   · Soporte/Resistencia: \`${signal.nearestSR}\`\n`;
      if (signal.stochK !== undefined && signal.cci !== undefined) {
        msg += `   · Stochastic (13,3,3): \`K: ${signal.stochK.toFixed(1)} / D: ${signal.stochD?.toFixed(1)}\`\n`;
        msg += `   · CCI (14): \`${signal.cci.toFixed(1)}\`\n\n`;
      } else {
        msg += `\n`;
      }

      if (signal.verdict !== 'REJECTED') {
        msg += `🎯 *Parámetros Sugeridos (Broker):*\n`;
        if (signal.tp50Price !== undefined) {
          msg += `   · *TP1 (EMA50):* \`${signal.tp50Price.toFixed(decimals)}\`\n`;
          msg += `   · *TP2 (EMA100):* \`${signal.tpPrice.toFixed(decimals)}\`\n`;
        } else {
          msg += `   · *TP (EMA100):* \`${signal.tpPrice.toFixed(decimals)}\`\n`;
        }
        msg += `   · *SL (1.8 ATR):* \`${signal.slPrice.toFixed(decimals)}\`\n\n`;
      }

      msg += `⏱ _${new Date(signal.timestamp).toLocaleString('es-CO', { timeZone: 'America/Bogota' })} COT_\n`;
      msg += `🔱 Auditoría de Reversión Reforzada`;

      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: msg, parse_mode: 'Markdown' }),
      });
    } catch (err) {
      console.error('[Audit Engine Reforced] Error enviando Telegram:', err);
    }
  }
}
