import { Injectable, OnModuleInit, OnModuleDestroy, Inject, forwardRef } from '@nestjs/common';
import { EventEmitter } from 'events';
import https from 'https';
import http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { TwelveDataClient } from './twelveDataClient';
import { CandleBuilder } from './candleBuilder';
import { calculateSnapshot, resolveMultiTF, calculateElasticityForCandles, pushPercentileHistory, clearPercentileHistory } from './marketEngine';
import type { BackendMessage, Candle, MarketSnapshot, MarketState, FusedStateResult, BacktestResult, SignalComparisonResult } from './types';
import { runBacktest } from './backtestEngine';
import { compareSignalWithHistory } from './compareSignal';
import { fuseMarketState } from './fuseMarketState';
import { EntityManager } from '@mikro-orm/mysql';
import { PendingSignal } from '../trade/pending-signal.entity';
import { detectSession } from '../trade/trade.service';
import { RequestContext } from '@mikro-orm/core';
import { ConsolidationService } from '../consolidation/consolidation.service';

// --- Imports de Versión Experimental ---
import { calculateSnapshotExp, resolveMultiTFExp, calculateElasticityForCandlesExp, pushPercentileHistoryExp, clearPercentileHistoryExp } from './marketEngineExp';
import { runBacktestExp } from './backtestEngineExp';
import { compareSignalWithHistoryExp } from './compareSignalExp';

const HISTORY_OUTPUT = 1000;

export class SymbolState {
  public readonly symbol: string;
  public readonly builderM5 = new CandleBuilder('M5');
  public readonly builderM15 = new CandleBuilder('M15');

  public lastSnapshotM5: MarketSnapshot | null = null;
  public lastSnapshotM15: MarketSnapshot | null = null;

  public historicalM5: Candle[] = [];
  public historicalM15: Candle[] = [];

  // Backtesting y Fusión de Señal (Fase 2)
  public lastBacktestM5: BacktestResult | null = null;
  public previousFusedState: MarketState | null = null;
  public previousFinalState: MarketState | null = null;
  public lastTelegramAlertTimeA = 0;
  public lastTelegramAlertTimeB = 0;
  public lastStructureM5: any | null = null;
  public lastStructureM15: any | null = null;

  // Giro de Elasticidad (Gatillo) M5
  public lastClosedElasticityM5: number | null = null;
  public prevClosedElasticityM5: number | null = null;
  public triggerStateM5: 'reposo' | 'estirando' | 'giro' = 'reposo';
  public previousTriggerStateM5: 'reposo' | 'estirando' | 'giro' = 'reposo';
  public lastTelegramAlertTimeTrigger = 0;

  // --- Versión Experimental ---
  public lastSnapshotM5Exp: any = null;
  public lastSnapshotM15Exp: any = null;
  public lastBacktestM5Exp: any = null;

  public previousFusedStateExp: MarketState | null = null;
  public previousFinalStateExp: MarketState | null = null;

  public lastClosedElasticityM5Exp: number | null = null;
  public prevClosedElasticityM5Exp: number | null = null;

  public triggerStateM5Exp: 'reposo' | 'estirando' | 'giro-provisional' | 'giro' = 'reposo';
  public previousTriggerStateM5Exp: 'reposo' | 'estirando' | 'giro-provisional' | 'giro' = 'reposo';
  public maxLiveElasticityExp = 0;

  // --- Mejoras al Detector de Pico (3 capas) ---
  /** Buffer circular de últimos N valores de elasticidad tick-a-tick para calcular stddev */
  public liveElasticityBufferExp: number[] = [];
  /** Contador de ticks consecutivos en estado GREEN antes de armar el detector */
  public greenTickCountExp = 0;
  /** Contador de ticks sosteniendo retroceso tras giro provisional */
  public provisionalGiroTicksExp = 0;

  public lastTelegramAlertTimeAExp = 0;
  public lastTelegramAlertTimeBExp = 0;
  public lastTelegramAlertTimeTriggerExp = 0;
  public lastTelegramAlertTimePedestrian = 0;

  public pedestrianLight: 'STOP' | 'WALK' = 'STOP';
  public previousPedestrianLight: 'STOP' | 'WALK' = 'STOP';

  // Tracking de historial individual
  public historyLoaded = false;
  public isHistoryLoading = false;
  public lastHistoryAttemptTime = 0;

  constructor(symbol: string) {
    this.symbol = symbol;
  }
}

@Injectable()
export class MarketService implements OnModuleInit, OnModuleDestroy {
  public readonly events = new EventEmitter();

  // Configuración
  private readonly apiKey = process.env.TWELVE_DATA_API_KEY ?? '';
  private readonly symbol = process.env.TWELVE_DATA_SYMBOL ?? 'EUR/USD,GBP/USD,USD/JPY';
  private readonly symbolList: string[] = [];
  private readonly apiKeyList: string[] = [];

  // Mapa de estados de símbolos
  private readonly symbolStates = new Map<string, SymbolState>();

  private readonly twelveClients: TwelveDataClient[] = [];

  // ─── Control Horario y Pool de Llaves ────────────────────────────────────────
  private engineRunning = false;
  private historyLoaded = false;
  private schedulerInterval: NodeJS.Timeout | null = null;
  /**
   * Llaves agotadas: Map<key, timestampAgotamiento>.
   * Las llaves agotadas por límite de MINUTO (rate-limit) se auto-liberan
   * después de 65 segundos. Solo las que alcanzan los 800 créditos totales
   * se consideran permanentemente agotadas, pero dado que TwelveData
   * no distingue en la respuesta, tratamos todo como rate-limit temporal
   * para no consumir innecesariamente todo el pool en un bucle.
   */
  private readonly exhaustedKeys = new Map<string, number>(); // key -> timestamp agotamiento
  private readonly dailyLimitExhaustedKeys = new Set<string>();
  private lastResetDay = new Date().getUTCDate();
  private static readonly KEY_RATE_LIMIT_COOLDOWN_MS = 65_000; // 65s > 1 min de ventana TwelveData

  private checkDailyReset(): void {
    const today = new Date().getUTCDate();
    if (today !== this.lastResetDay) {
      this.dailyLimitExhaustedKeys.clear();
      this.saveDailyExhaustedKeys(); // Limpiar el archivo de persistencia
      this.lastResetDay = today;
      console.log('[MarketService] ☀️ Nuevo día UTC detectado. Restableciendo límites de créditos diarios de todas las llaves API.');
    }
  }

  private loadDailyExhaustedKeys(): void {
    const filePath = path.join(process.cwd(), 'exhausted_keys.json');
    try {
      if (fs.existsSync(filePath)) {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (data.date === new Date().getUTCDate() && Array.isArray(data.keys)) {
          for (const key of data.keys) {
            this.dailyLimitExhaustedKeys.add(key);
          }
          console.log(`[MarketService] 💾 Cargadas ${this.dailyLimitExhaustedKeys.size} llaves agotadas diarias desde persistencia.`);
        } else {
          // Si es otro día, borrar el archivo
          fs.unlinkSync(filePath);
        }
      }
    } catch (e) {
      console.error('[MarketService] Error cargando llaves agotadas persistidas:', e);
    }
  }

  private saveDailyExhaustedKeys(): void {
    const filePath = path.join(process.cwd(), 'exhausted_keys.json');
    try {
      const data = {
        date: new Date().getUTCDate(),
        keys: Array.from(this.dailyLimitExhaustedKeys)
      };
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
      console.error('[MarketService] Error guardando llaves agotadas persistidas:', e);
    }
  }

  private readonly activeAssignments = new Map<string, string>();
  private readonly keyStats = new Map<string, {
    totalRequests: number;
    requestTimestamps: number[];
    minutelyMax: number;
  }>();

  // Ya no usamos bloqueo global de créditos diarios, rotamos la llave por símbolo.

  // Métricas
  public readonly serverMetrics = {
    droppedTicksTotal: 0,
    lastDroppedTickAt: null as number | null,
    droppedTicksPerMinute: 0,
    currentDelay: 0,
    avgDelay: 0,
    maxDelay: 0,
  };

  private dropsInCurrentMinute = 0;
  private readonly delayHistory: number[] = [];
  private readonly DELAY_HISTORY_SIZE = 50;
  private metricsInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly em: EntityManager,
    @Inject(forwardRef(() => ConsolidationService))
    private readonly consolidationService: ConsolidationService
  ) {
    this.symbolList = this.symbol.split(',').map((s) => s.trim());
    this.apiKeyList = this.apiKey.split(',').map((k) => k.trim());

    // Iniciar intervalo de métricas
    this.metricsInterval = setInterval(() => {
      this.serverMetrics.droppedTicksPerMinute = this.dropsInCurrentMinute;
      this.serverMetrics.maxDelay = 0;
      this.dropsInCurrentMinute = 0;
    }, 60000);

    // Escuchar eventos de estructura para cachearlos localmente en SymbolState
    this.events.on('broadcast', (msg: any) => {
      if (msg && msg.type === 'structure-snapshot') {
        const state = this.symbolStates.get(msg.symbol);
        if (state) {
          if (msg.timeframe === 'M5') {
            state.lastStructureM5 = msg;
          } else if (msg.timeframe === 'M15') {
            state.lastStructureM15 = msg;
          }
        }
      }
    });

    // Cargar llaves agotadas diariamente desde la persistencia
    this.loadDailyExhaustedKeys();
  }

  async onModuleInit() {
    console.log('[MarketService] Inicializando...');
    console.log('╔════════════════════════════════════╗');
    console.log('║   Elasticity System — NestJS       ║');
    console.log(`║   Symbols : ${this.symbolList.join(', ')}`);
    console.log(`║   API Keys: ${this.apiKeyList.length} llaves cargadas en el pool`);
    console.log('╚════════════════════════════════════╝');

    // Iniciar el programador horario (verifica cada 60 segundos)
    this.schedulerInterval = setInterval(() => this.checkOperationalScheduler(), 60_000);

    // Comprobación inmediata al arrancar
    await this.checkOperationalScheduler();
  }

  onModuleDestroy() {
    console.log('[MarketService] Deteniendo servicio...');
    if (this.metricsInterval) clearInterval(this.metricsInterval);
    if (this.schedulerInterval) clearInterval(this.schedulerInterval);
    for (const client of this.twelveClients) {
      client.disconnect();
    }
    this.twelveClients.length = 0;
  }

  // ─── Programador de Horario Operativo ────────────────────────────────────────
  // Domingo  : 7:30 PM – Lunes 1:30 AM COT (19:30 – 01:30) (Aumentado 2 hrs)
  // Lun–Jue  : 6:00 AM – 11:59 PM COT (06:00 – 24:00)
  // Viernes  : 6:00 AM – 12:00 PM COT (06:00 – 12:00)
  // Sábado   : Siempre cerrado
  // NOTA: Usamos COT (UTC-5) explícitamente para que funcione igual en
  //       servidores en la nube (Render/UTC) y en máquina local.
  private isOperationalTime(): boolean {
    // Si estamos en desarrollo/local y queremos operar 24/7 sin restricción
    if (process.env.IGNORE_SCHEDULE === 'true') {
      return true;
    }

    // Calcular hora actual en COT (UTC-5) de forma explícita y portable
    const ahoraUTC = Date.now();
    const COT_OFFSET_MS = -5 * 60 * 60 * 1000; // UTC-5
    const ahoraCOT = new Date(ahoraUTC + COT_OFFSET_MS);

    const dia = ahoraCOT.getUTCDay();     // 0=Dom, 1=Lun, ..., 6=Sáb en COT
    const hora = ahoraCOT.getUTCHours();   // Hora en COT
    const min = ahoraCOT.getUTCMinutes(); // Minutos en COT

    // Domingo: sesión apertura de mercado (7:30 PM COT en adelante)
    if (dia === 0) {
      return hora > 19 || (hora === 19 && min >= 30);
    }

    // Lunes: sesión de madrugada (extensión de domingo) hasta la 1:30 AM, y luego 6:00 AM en adelante
    if (dia === 1) {
      const extensionDomingo = hora === 0 || (hora === 1 && min < 30);
      const sesionEstandar = hora >= 6;
      return extensionDomingo || sesionEstandar;
    }

    // Martes a Jueves: sesión de madrugada (extensión del día anterior) hasta la 1:30 AM, y luego 6:00 AM en adelante
    if (dia >= 2 && dia <= 4) {
      const extensionDiaAnterior = hora === 0 || (hora === 1 && min < 30);
      const sesionEstandar = hora >= 6;
      return extensionDiaAnterior || sesionEstandar;
    }

    // Viernes: sesión de madrugada (extensión del jueves) hasta la 1:30 AM, y sesión estándar 6:00 AM – 12:00 PM
    if (dia === 5) {
      const extensionDiaAnterior = hora === 0 || (hora === 1 && min < 30);
      const sesionEstandar = hora >= 6 && hora < 12;
      return extensionDiaAnterior || sesionEstandar;
    }

    // Sábado: siempre cerrado
    return false;
  }

  private async checkOperationalScheduler(): Promise<void> {
    const operational = this.isOperationalTime();

    if (operational && !this.engineRunning) {
      console.log(
        `\n╔═══════════════════════════════════════════════════════════╗\n` +
        `║   ⚡ INICIO DE HORARIO OPERATIVO — Activando Motor       ║\n` +
        `╚═══════════════════════════════════════════════════════════╝\n`
      );
      this.engineRunning = true;

      // 1. Cargar historial si no se ha cargado antes
      if (!this.historyLoaded) {
        for (const sym of this.symbolList) {
          console.log(`[MarketService] Inicializando par: ${sym}`);
          const state = new SymbolState(sym);
          this.symbolStates.set(sym, state);

          // Asignar key exclusiva inicial para este símbolo
          this.getAvailableApiKey(sym);

          // Configurar manejadores de eventos de velas (se configuran una sola vez)
          state.builderM5.on('dropped_tick', (reason: string) => this.recordDroppedTick(reason));
          state.builderM15.on('dropped_tick', (reason: string) => this.recordDroppedTick(reason));

          state.builderM5.on('candle:closed', (candle: Candle) => {
            state.historicalM5.push(candle);
            if (state.historicalM5.length > HISTORY_OUTPUT) state.historicalM5.shift();

            const el = calculateElasticityForCandles(state.builderM5.getCandles(), candle.close);
            if (el !== null) {
              pushPercentileHistory(sym, 'M5', el);
              state.prevClosedElasticityM5 = state.lastClosedElasticityM5;
              state.lastClosedElasticityM5 = el;
            }

            // --- Versión Experimental ---
            const elExp = calculateElasticityForCandlesExp(state.builderM5.getCandles(), candle.close);
            if (elExp !== null) {
              pushPercentileHistoryExp(sym, 'M5', elExp);
              state.prevClosedElasticityM5Exp = state.lastClosedElasticityM5Exp;
              state.lastClosedElasticityM5Exp = elExp;
            }

            // Recalcular backtest M5 con la nueva vela
            state.lastBacktestM5 = runBacktest(state.historicalM5, { emaPeriod: 100, maxBarsToRevert: 20 });
            state.lastBacktestM5Exp = runBacktestExp(state.historicalM5, { emaPeriod: 100, maxBarsToRevert: 20 });
            console.log(
              `[MarketService] [${sym}] Vela M5 cerrada. Backtest M5 recalculado: WinRate: ${state.lastBacktestM5.winRate}% | Exp WinRate: ${state.lastBacktestM5Exp.winRate}%`
            );
          });

          state.builderM15.on('candle:closed', (candle: Candle) => {
            state.historicalM15.push(candle);
            if (state.historicalM15.length > HISTORY_OUTPUT) state.historicalM15.shift();

            const el = calculateElasticityForCandles(state.builderM15.getCandles(), candle.close);
            if (el !== null) pushPercentileHistory(sym, 'M15', el);

            // --- Versión Experimental ---
            const elExp = calculateElasticityForCandlesExp(state.builderM15.getCandles(), candle.close);
            if (elExp !== null) pushPercentileHistoryExp(sym, 'M15', elExp);
          });

          // Intentar cargar el historial inicial de forma asíncrona pero secuencial durante el startup
          await this.loadSymbolHistory(state);

          // Breve pausa para no saturar la API
          await new Promise((r) => setTimeout(r, 2000));
        }
        this.historyLoaded = true;
      }

      // 2. Conectar cada par a su key exclusiva del pool
      this.twelveClients.length = 0;
      for (const sym of this.symbolList) {
        const key = this.getAvailableApiKey(sym);

        console.log(`[MarketService] Iniciando cliente para ${sym} usando clave: ...${key.slice(-6)}`);
        const client = new TwelveDataClient(key, sym);

        client.on('tick', (symbol: string, price: number, timestamp: number) =>
          this.processTick(symbol, price, timestamp)
        );
        client.on('dropped_tick', (reason: string) => this.recordDroppedTick(reason));
        client.on('status', (status: string, message: string) => {
          this.events.emit('broadcast', {
            type: 'status',
            status: status as 'connecting' | 'connected' | 'disconnected',
            message: `[${sym}] ${message}`,
          } satisfies BackendMessage);
        });

        client.on('ws-fallback', (symbol: string, reason: string) => {
          console.log(`[MarketService] 📡 [${symbol}] WS Fallback activo — notificando al frontend`);
          this.events.emit('broadcast', {
            type: 'ws-fallback',
            symbol,
            reason,
          });
        });

        // Escuchar solicitudes API para conteo de créditos
        client.on('api-request', (reqKey: string) => {
          this.incrementKeyRequest(reqKey);
        });

        // Rotar key automáticamente si se agotan los créditos
        client.on('key-exhausted', (exhaustedKey: string, type?: 'rate' | 'daily') => {
          if (type === 'daily') {
            this.dailyLimitExhaustedKeys.add(exhaustedKey);
            this.saveDailyExhaustedKeys(); // Persistir
            console.warn(`[MarketService] [${sym}] Llave ...${exhaustedKey.slice(-6)} marcada como AGOTADA DIARIA. Rotando...`);
          } else {
            this.exhaustedKeys.set(exhaustedKey, Date.now());
            console.warn(`[MarketService] [${sym}] Llave ...${exhaustedKey.slice(-6)} marcada como AGOTADA TEMPORAL (rate-limit). Rotando...`);
          }
          const newKey = this.getAvailableApiKey(sym, exhaustedKey);
          client.updateApiKey(newKey);

          // Forzar la recarga de historial en el próximo tick del poller REST
          const state = this.symbolStates.get(sym);
          if (state && !state.historyLoaded) {
            state.lastHistoryAttemptTime = 0;
            console.log(`[MarketService] [${sym}] Llave rotada. Se forzará la recarga de historial en el próximo tick.`);
          }
        });

        client.connect();
        this.twelveClients.push(client);
      }

    } else if (!operational && this.engineRunning) {
      console.log(
        `\n╔═══════════════════════════════════════════════════════════╗\n` +
        `║   🛑 CIERRE DE HORARIO OPERATIVO — Apagando Clientes     ║\n` +
        `╚═══════════════════════════════════════════════════════════╝\n`
      );
      this.engineRunning = false;
      for (const client of this.twelveClients) {
        client.disconnect();
      }
      this.twelveClients.length = 0;

      this.events.emit('broadcast', {
        type: 'status',
        status: 'disconnected',
        message: 'Sistema dormido fuera de horario operativo (Dom 7:30PM–11:30PM · Lun–Jue 6AM–10PM · Vie 6AM–12PM COT)',
      } satisfies BackendMessage);

    } else if (!operational && !this.engineRunning) {
      if (Math.random() < 0.05) {
        console.log('[MarketService] Sistema dormido fuera de horario operativo...');
      }
    }
  }

  // ─── Gestión Dinámica de API Keys (Pool de 32 llaves) ────────────────────────

  /**
   * Verifica si una llave está agotada (considerando el cooldown por minuto).
   * Las llaves se auto-liberan después de KEY_RATE_LIMIT_COOLDOWN_MS.
   */
  private isKeyExhausted(key: string): boolean {
    const exhaustedAt = this.exhaustedKeys.get(key);
    if (exhaustedAt === undefined) return false;
    const elapsed = Date.now() - exhaustedAt;
    if (elapsed >= MarketService.KEY_RATE_LIMIT_COOLDOWN_MS) {
      // Auto-liberar la llave: el minuto ya pasó
      this.exhaustedKeys.delete(key);
      console.log(`[MarketService] ✅ Llave ...${key.slice(-6)} liberada del cooldown (${(elapsed / 1000).toFixed(0)}s transcurridos). Disponible nuevamente.`);
      return false;
    }
    return true;
  }

  private getAvailableApiKey(symbol: string, currentExhaustedKey?: string): string {
    if (currentExhaustedKey) {
      if (!this.dailyLimitExhaustedKeys.has(currentExhaustedKey)) {
        this.exhaustedKeys.set(currentExhaustedKey, Date.now());
        console.log(`[MarketService] Llave ...${currentExhaustedKey.slice(-6)} marcada como agotada temporal (cooldown ${MarketService.KEY_RATE_LIMIT_COOLDOWN_MS / 1000}s).`);
      }
      this.broadcastKeysStatus();
    }

    // Llaves ya asignadas a otros símbolos (excluir la del símbolo actual)
    const assignedToOthers = new Set(this.activeAssignments.values());
    const myCurrentKey = this.activeAssignments.get(symbol);
    if (myCurrentKey) assignedToOthers.delete(myCurrentKey);

    // Priorizar llaves ordenándolas según uso de créditos y métricas por minuto (de menor a mayor uso)
    const sortedKeys = [...this.apiKeyList].sort((a, b) => {
      const statsA = this.keyStats.get(a) || { totalRequests: 0, minutelyMax: 0 };
      const statsB = this.keyStats.get(b) || { totalRequests: 0, minutelyMax: 0 };
      if (statsA.minutelyMax !== statsB.minutelyMax) {
        return statsA.minutelyMax - statsB.minutelyMax;
      }
      return statsA.totalRequests - statsB.totalRequests;
    });

    // 1. Buscar primera llave libre (no rate-limit agotada, no daily agotada, no asignada a otro símbolo)
    for (const key of sortedKeys) {
      if (!this.isKeyExhausted(key) && !this.dailyLimitExhaustedKeys.has(key) && !assignedToOthers.has(key)) {
        this.activeAssignments.set(symbol, key);
        console.log(`[MarketService] [${symbol}] Llave activa asignada: ...${key.slice(-6)}`);
        this.broadcastKeysStatus();
        return key;
      }
    }

    // 2. Fallback: llave no agotada (ni rate, ni daily) aunque compartida temporalmente
    for (const key of sortedKeys) {
      if (!this.isKeyExhausted(key) && !this.dailyLimitExhaustedKeys.has(key)) {
        this.activeAssignments.set(symbol, key);
        console.warn(`[MarketService] [${symbol}] ⚠️ Llave compartida ...${key.slice(-6)} (escasez temporal)`);
        this.broadcastKeysStatus();
        return key;
      }
    }

    // 3. Fallback: usar una llave en cooldown temporal (no daily agotada)
    for (const key of sortedKeys) {
      if (!this.dailyLimitExhaustedKeys.has(key)) {
        this.activeAssignments.set(symbol, key);
        console.warn(`[MarketService] [${symbol}] ⚠️ Usando llave en cooldown temporal ...${key.slice(-6)}`);
        this.broadcastKeysStatus();
        return key;
      }
    }

    // 4. Fallback absoluto (todas agotadas — situación crítica)
    console.error(`[MarketService] [${symbol}] ❌ CRÍTICO: Todas las ${this.apiKeyList.length} llaves están agotadas.`);

    // Alerta de agotamiento absoluto para el frontend
    this.events.emit('broadcast', {
      type: 'keys-exhausted-alert',
      symbol,
      message: `❌ ¡ALERTA CRÍTICA! Se han agotado todas las ${this.apiKeyList.length} llaves API para el símbolo ${symbol}. No es posible obtener más datos.`
    } satisfies BackendMessage);

    this.broadcastKeysStatus();
    return this.apiKeyList[0] || '';
  }

  /**
   * Obtiene el estado actual detallado de todas las llaves API y sus estadísticas de uso.
   */
  public getKeysPoolStatus(): BackendMessage {
    this.checkDailyReset();
    const now = Date.now();

    // Mapeo inverso de llaves activas a símbolos
    const keyToSymbol = new Map<string, string>();
    for (const [sym, key] of this.activeAssignments.entries()) {
      keyToSymbol.set(key, sym);
    }

    // Construir la lista completa de todas las 35 llaves del pool
    const poolDetailsList = this.apiKeyList.map((key, index) => {
      const keyMasked = `...${key.slice(-6)}`;
      const assignedSymbol = keyToSymbol.get(key) || null;

      let status: 'active' | 'shared' | 'rate-limit' | 'daily-limit' = 'active';
      let cooldownRemaining = 0;

      if (this.dailyLimitExhaustedKeys.has(key)) {
        status = 'daily-limit';
      } else {
        const exhaustedAt = this.exhaustedKeys.get(key);
        if (exhaustedAt !== undefined) {
          const remaining = MarketService.KEY_RATE_LIMIT_COOLDOWN_MS - (now - exhaustedAt);
          if (remaining > 0) {
            status = 'rate-limit';
            cooldownRemaining = Math.ceil(remaining / 1000);
          } else {
            this.exhaustedKeys.delete(key);
          }
        }
      }

      if (status === 'active' && assignedSymbol) {
        const sharingCount = Array.from(this.activeAssignments.values()).filter(k => k === key).length;
        if (sharingCount > 1) {
          status = 'shared';
        }
      }

      let totalRequests = 0;
      let minutelyRate = 0;
      let minutelyMax = 0;

      if (this.keyStats.has(key)) {
        const stats = this.keyStats.get(key)!;
        stats.requestTimestamps = stats.requestTimestamps.filter(ts => now - ts <= 60000);
        totalRequests = stats.totalRequests;
        minutelyRate = stats.requestTimestamps.length;
        minutelyMax = stats.minutelyMax;
      }

      return {
        index: index + 1,
        keyMasked,
        status,
        requestsCount: totalRequests,
        minutelyRate,
        minutelyMax,
        cooldownRemaining,
        assignedSymbol
      };
    });

    // Assignments per symbol (for active currency cards)
    const assignmentsList = this.symbolList.map(sym => {
      const activeKey = this.activeAssignments.get(sym);
      const activeKeyMasked = activeKey ? `...${activeKey.slice(-6)}` : 'Ninguna';

      let status: 'active' | 'shared' | 'exhausted' = 'active';
      if (this.apiKeyList.every(k => this.isKeyExhausted(k) || this.dailyLimitExhaustedKeys.has(k))) {
        status = 'exhausted';
      } else if (activeKey) {
        if (this.isKeyExhausted(activeKey) || this.dailyLimitExhaustedKeys.has(activeKey)) {
          status = 'exhausted';
        } else {
          const sharingSymbolsCount = Array.from(this.activeAssignments.values()).filter(k => k === activeKey).length;
          if (sharingSymbolsCount > 1) {
            status = 'shared';
          }
        }
      }

      let totalRequests = 0;
      let minutelyRate = 0;
      let minutelyMax = 0;

      if (activeKey && this.keyStats.has(activeKey)) {
        const stats = this.keyStats.get(activeKey)!;
        stats.requestTimestamps = stats.requestTimestamps.filter(ts => now - ts <= 60000);
        totalRequests = stats.totalRequests;
        minutelyRate = stats.requestTimestamps.length;
        minutelyMax = stats.minutelyMax;
      }

      return {
        symbol: sym,
        activeKeyMasked,
        status,
        requestsCount: totalRequests,
        minutelyRate,
        minutelyMax
      };
    });

    const exhaustedKeysCount = poolDetailsList.filter(k => k.status === 'rate-limit' || k.status === 'daily-limit').length;
    const allExhausted = poolDetailsList.every(k => k.status === 'rate-limit' || k.status === 'daily-limit');

    const exhaustedKeysDetails = poolDetailsList
      .filter(k => k.status === 'rate-limit')
      .map(k => ({
        keyMasked: k.keyMasked,
        cooldownRemaining: k.cooldownRemaining
      }));

    return {
      type: 'keys-status',
      totalKeys: this.apiKeyList.length,
      exhaustedKeysCount,
      allExhausted,
      assignments: assignmentsList,
      exhaustedKeys: exhaustedKeysDetails,
      poolDetails: poolDetailsList
    } satisfies BackendMessage;
  }

  /**
   * Incrementa el contador de peticiones de una API Key y limpia los registros de más de 60 segundos.
   */
  private incrementKeyRequest(key: string): void {
    if (!key) return;

    if (!this.keyStats.has(key)) {
      this.keyStats.set(key, {
        totalRequests: 0,
        requestTimestamps: [],
        minutelyMax: 0
      });
    }

    const stats = this.keyStats.get(key)!;
    stats.totalRequests++;

    const now = Date.now();
    stats.requestTimestamps.push(now);

    // Limpiar peticiones de más de 60 segundos
    stats.requestTimestamps = stats.requestTimestamps.filter(ts => now - ts <= 60000);

    // Actualizar máximo
    if (stats.requestTimestamps.length > stats.minutelyMax) {
      stats.minutelyMax = stats.requestTimestamps.length;
    }

    this.broadcastKeysStatus();
  }

  /**
   * Transmite el estado actual de las llaves API a todos los clientes.
   */
  private broadcastKeysStatus(): void {
    this.events.emit('broadcast', this.getKeysPoolStatus());
  }

  // Retorna todos los últimos snapshots del sistema
  public getAllLastSnapshots(): BackendMessage[] {
    const list: BackendMessage[] = [];
    for (const state of this.symbolStates.values()) {
      if (state.lastSnapshotM5 && state.lastSnapshotM15) {
        const finalState = resolveMultiTF(state.lastSnapshotM5, state.lastSnapshotM15);
        const comparison = state.lastBacktestM5
          ? compareSignalWithHistory(
            { state: state.lastSnapshotM5.state, elasticity: state.lastSnapshotM5.elasticity },
            state.lastBacktestM5
          )
          : null;
        const fusedStateResult = fuseMarketState(finalState, comparison);

        // --- Versión Experimental ---
        const finalStateExp = state.lastSnapshotM5Exp && state.lastSnapshotM15Exp
          ? resolveMultiTFExp(state.lastSnapshotM5Exp, state.lastSnapshotM15Exp)
          : ('RED' as MarketState);

        const comparisonExp = state.lastSnapshotM5Exp && state.lastSnapshotM15Exp && state.lastBacktestM5Exp
          ? compareSignalWithHistoryExp(
            { state: state.lastSnapshotM5Exp.state, elasticity: state.lastSnapshotM5Exp.elasticity, direction: state.lastSnapshotM5Exp.direction },
            state.lastBacktestM5Exp
          )
          : null;

        const fusedStateResultExp = state.lastSnapshotM5Exp && state.lastSnapshotM15Exp
          ? fuseMarketState(finalStateExp, comparisonExp)
          : { state: 'RED' as MarketState, explanation: 'Esperando datos...' };

        list.push({
          type: 'snapshot',
          symbol: state.symbol,
          m5: state.lastSnapshotM5,
          m15: state.lastSnapshotM15,
          finalState,
          fusedState: fusedStateResult.state,
          triggerState: state.triggerStateM5,
          lastClosedElasticityM5: state.lastClosedElasticityM5,
          prevClosedElasticityM5: state.prevClosedElasticityM5,
          fusedExplanation: fusedStateResult.explanation,
          fusedComparison: comparison,
          backtest: state.lastBacktestM5,
          experimental: state.lastSnapshotM5Exp && state.lastSnapshotM15Exp ? {
            m5: state.lastSnapshotM5Exp,
            m15: state.lastSnapshotM15Exp,
            finalState: finalStateExp,
            fusedState: fusedStateResultExp.state,
            triggerState: state.triggerStateM5Exp,
            pedestrianLight: state.pedestrianLight,
            fusedExplanation: fusedStateResultExp.explanation,
            fusedComparison: comparisonExp,
            backtest: state.lastBacktestM5Exp,
          } : undefined
        });
      }
    }
    return list;
  }

  // Retorna el último snapshot para un símbolo en particular
  public getLastSnapshotMessage(symbol?: string): BackendMessage | null {
    const sym = symbol ?? this.symbolList[0] ?? 'EUR/USD';
    const state = this.symbolStates.get(sym);
    if (!state) return null;

    if (state.lastSnapshotM5 && state.lastSnapshotM15) {
      const finalState = resolveMultiTF(state.lastSnapshotM5, state.lastSnapshotM15);
      const comparison = state.lastBacktestM5
        ? compareSignalWithHistory(
          { state: state.lastSnapshotM5.state, elasticity: state.lastSnapshotM5.elasticity },
          state.lastBacktestM5
        )
        : null;
      const fusedStateResult = fuseMarketState(finalState, comparison);

      return {
        type: 'snapshot',
        symbol: state.symbol,
        m5: state.lastSnapshotM5,
        m15: state.lastSnapshotM15,
        finalState,
        fusedState: fusedStateResult.state,
        triggerState: state.triggerStateM5,
        lastClosedElasticityM5: state.lastClosedElasticityM5,
        prevClosedElasticityM5: state.prevClosedElasticityM5,
        fusedExplanation: fusedStateResult.explanation,
        fusedComparison: comparison,
        backtest: state.lastBacktestM5,
      };
    }
    return null;
  }

  // Retorna el historial de velas en memoria
  public getHistory(symbol: string, timeframe: '5min' | '15min'): Candle[] {
    let state = this.symbolStates.get(symbol);
    if (!state) {
      const fallbackSym = this.symbolList[0] ?? 'EUR/USD';
      state = this.symbolStates.get(fallbackSym);
    }
    if (!state) return [];
    return timeframe === '15min' ? state.historicalM15 : state.historicalM5;
  }

  // ─── Fetch historial via REST ─────────────────────────────────────────────────
  private fetchHistoricalCandles(
    symbol: string,
    interval: '5min' | '15min',
    outputSize: number
  ): Promise<Candle[]> {
    return new Promise((resolve, reject) => {
      // Usar la key asignada dinámicamente al símbolo (pool de rotación)
      const key = this.activeAssignments.get(symbol) ?? this.apiKeyList[0] ?? '';

      // Registrar petición de crédito
      this.incrementKeyRequest(key);

      const path =
        `/time_series?symbol=${encodeURIComponent(symbol)}` +
        `&interval=${interval}&outputsize=${outputSize}&apikey=${key}`;

      const req = https.request(
        { hostname: 'api.twelvedata.com', path, method: 'GET' },
        (res: http.IncomingMessage) => {
          let raw = '';
          res.on('data', (chunk: Buffer) => {
            raw += chunk.toString();
          });
          res.on('end', () => {
            try {
              const data = JSON.parse(raw);
              if (data.status !== 'ok' || !data.values) {
                const msg: string = data.message || '';
                // Detectar límite diario: error permanente hasta la medianoche
                const isDailyLimit =
                  msg.toLowerCase().includes('run out of api credits') ||
                  msg.toLowerCase().includes('api credits for the day') ||
                  (msg.toLowerCase().includes('credit') && msg.toLowerCase().includes('limit being 800'));

                if (isDailyLimit) {
                  console.error(`[History] [${symbol}] 🚫 CRÉDITOS DIARIOS AGOTADOS en llave actual. Mensaje: ${msg}`);
                  this.dailyLimitExhaustedKeys.add(key);
                  this.saveDailyExhaustedKeys(); // Persistir
                  this.getAvailableApiKey(symbol, key); // Rotar llave
                  this.broadcastKeysStatus();
                  reject(new Error('DAILY_LIMIT_EXHAUSTED'));
                  return;
                }

                const isRateLimit = msg.toLowerCase().includes('rate limit') || msg.toLowerCase().includes('too many requests') || msg.toLowerCase().includes('per minute limit');
                if (isRateLimit) {
                  console.warn(`[History] [${symbol}] Límite por minuto alcanzado. Rotando llave...`);
                  this.exhaustedKeys.set(key, Date.now());
                  this.getAvailableApiKey(symbol, key); // Rotar llave
                  this.broadcastKeysStatus();
                  reject(new Error('RATE_LIMIT'));
                  return;
                }

                console.error(`[History] [${symbol}] Error ${interval} de TwelveData (Rotando llave):`, msg || data);
                this.getAvailableApiKey(symbol, key); // Rotar llave
                this.broadcastKeysStatus();
                reject(new Error('API_ERROR'));
                return;
              }
              const candles: Candle[] = [...data.values].reverse().map((c: any) => ({
                time: new Date(c.datetime).getTime(),
                open: parseFloat(c.open),
                high: parseFloat(c.high),
                low: parseFloat(c.low),
                close: parseFloat(c.close),
                closed: true,
              }));
              resolve(candles);
            } catch (e) {
              console.error(`[History] [${symbol}] Error parseando JSON en ${interval}:`, e);
              console.error(`[History] [${symbol}] Respuesta cruda:`, raw.substring(0, 300));
              resolve([]);
            }
          });
        }
      );

      req.on('error', (err: Error) => {
        console.error(`[History] [${symbol}] Error de red en request:`, err.message);
        resolve([]);
      });

      req.end();
    });
  }

  private warmUpBuilder(symbol: string, builder: CandleBuilder, candles: Candle[]): void {
    const state = this.symbolStates.get(symbol);
    candles.forEach((c) => {
      builder.injectHistoricalCandle(c);
      const elasticity = calculateElasticityForCandles(builder.getCandles(), c.close);
      if (elasticity !== null) {
        pushPercentileHistory(symbol, builder.getTimeframe(), elasticity);
        if (builder.getTimeframe() === 'M5' && state) {
          state.prevClosedElasticityM5 = state.lastClosedElasticityM5;
          state.lastClosedElasticityM5 = elasticity;
        }
      }

      // --- Versión Experimental ---
      const elasticityExp = calculateElasticityForCandlesExp(builder.getCandles(), c.close);
      if (elasticityExp !== null) {
        pushPercentileHistoryExp(symbol, builder.getTimeframe(), elasticityExp);
        if (builder.getTimeframe() === 'M5' && state) {
          state.prevClosedElasticityM5Exp = state.lastClosedElasticityM5Exp;
          state.lastClosedElasticityM5Exp = elasticityExp;
        }
      }
    });
    console.log(
      `[WarmUp] [${symbol}] ${builder.getTimeframe()} precalentado con ${candles.length} velas (percentiles listos)`
    );
  }

  private async loadSymbolHistory(state: SymbolState): Promise<boolean> {
    const sym = state.symbol;
    if (state.isHistoryLoading) return false;

    state.isHistoryLoading = true;
    state.lastHistoryAttemptTime = Date.now();

    try {
      let attempts = 0;
      const maxAttempts = 15; // Intentar hasta 15 llaves de inmediato

      while (attempts < maxAttempts) {
        try {
          console.log(`[MarketService] [${sym}] Intentando cargar historial (intento ${attempts + 1})...`);
          const histM5 = await this.fetchHistoricalCandles(sym, '5min', HISTORY_OUTPUT);

          // Breve pausa para no saturar la API
          await new Promise((r) => setTimeout(r, 1000));

          const histM15 = await this.fetchHistoricalCandles(sym, '15min', HISTORY_OUTPUT);

          if (histM5.length === 0 || histM15.length === 0) {
            console.warn(`[MarketService] [${sym}] Carga de historial fallida (velas vacías).`);
            return false;
          }

          // Si todo está bien, limpiar constructores actuales e inyectar el historial completo
          state.builderM5.clear();
          state.builderM15.clear();

          // Limpiar también el percentil en el motor
          clearPercentileHistory(sym, 'M5');
          clearPercentileHistory(sym, 'M15');

          // --- Versión Experimental ---
          clearPercentileHistoryExp(sym, 'M5');
          clearPercentileHistoryExp(sym, 'M15');

          state.historicalM5 = histM5;
          state.historicalM15 = histM15;

          this.warmUpBuilder(sym, state.builderM5, state.historicalM5);
          this.warmUpBuilder(sym, state.builderM15, state.historicalM15);

          state.lastBacktestM5 = runBacktest(state.historicalM5, { emaPeriod: 100, maxBarsToRevert: 20 });
          state.lastBacktestM5Exp = runBacktestExp(state.historicalM5, { emaPeriod: 100, maxBarsToRevert: 20 });
          console.log(
            `[MarketService] [${sym}] Historial cargado con éxito en segundo plano. Backtest M5 recalculado: WinRate: ${state.lastBacktestM5.winRate}% · Exp WinRate: ${state.lastBacktestM5Exp.winRate}%`
          );

          // Calcular snapshot inicial con el último precio del historial cargado
          const lastPrice = state.historicalM5[state.historicalM5.length - 1].close;
          const ts = state.historicalM5[state.historicalM5.length - 1].time;
          const snap5 = calculateSnapshot(sym, state.builderM5.getCandles(), lastPrice, 'M5', ts);
          const snap15 = calculateSnapshot(sym, state.builderM15.getCandles(), lastPrice, 'M15', ts);

          if (snap5 && snap15) {
            state.lastSnapshotM5 = snap5;
            state.lastSnapshotM15 = snap15;
            console.log(
              `[MarketService] [${sym}] Snapshot inicial recalculado: M5: ${snap5.elasticity.toFixed(3)} ${snap5.state} · M15: ${snap15.elasticity.toFixed(3)} ${snap15.state}`
            );
          }

          // --- Versión Experimental ---
          const snap5Exp = calculateSnapshotExp(sym, state.builderM5.getCandles(), lastPrice, 'M5', ts);
          const snap15Exp = calculateSnapshotExp(sym, state.builderM15.getCandles(), lastPrice, 'M15', ts);
          if (snap5Exp && snap15Exp) {
            state.lastSnapshotM5Exp = snap5Exp;
            state.lastSnapshotM15Exp = snap15Exp;
          }

          state.historyLoaded = true;
          return true;
        } catch (err: any) {
          attempts++;
          if (err?.message === 'DAILY_LIMIT_EXHAUSTED' || err?.message === 'RATE_LIMIT' || err?.message === 'API_ERROR') {
            console.warn(`[MarketService] [${sym}] Intento ${attempts} falló por límite/error de llave. Reintentando de inmediato con la siguiente llave...`);
            // Esperar un instante corto para no abusar del servidor en ráfaga
            await new Promise((r) => setTimeout(r, 300));
          } else {
            console.error(`[MarketService] [${sym}] Error inesperado cargando historial:`, err);
            return false;
          }
        }
      }

      console.warn(`[MarketService] [${sym}] Se agotaron los intentos de inmediato (${maxAttempts}) para cargar historial.`);
      return false;
    } finally {
      state.isHistoryLoading = false;
    }
  }

  // ─── Procesamiento de ticks ───────────────────────────────────────────────────
  private processTick(symbol: string, price: number, timestamp: number): void {
    const state = this.symbolStates.get(symbol);
    if (!state) return;

    // Si el historial de este símbolo no ha cargado con éxito, intentar cargarlo de forma asíncrona
    if (!state.historyLoaded && !state.isHistoryLoading) {
      const now = Date.now();
      // Reintentar cada 30s con la llave asignada
      if (now - state.lastHistoryAttemptTime > 30000) {
        console.log(`[MarketService] [${symbol}] Historial ausente/incompleto. Iniciando carga asíncrona en segundo plano...`);
        this.loadSymbolHistory(state).catch((e) =>
          console.error(`[MarketService] [${symbol}] Error cargando historial en segundo plano:`, e)
        );
      }
    }

    const delay = Math.max(0, Date.now() - timestamp);

    this.serverMetrics.currentDelay = delay;
    this.serverMetrics.maxDelay = Math.max(this.serverMetrics.maxDelay, delay);

    this.delayHistory.push(delay);
    if (this.delayHistory.length > this.DELAY_HISTORY_SIZE) {
      this.delayHistory.shift();
    }
    this.serverMetrics.avgDelay = Math.round(
      this.delayHistory.reduce((a, b) => a + b, 0) / this.delayHistory.length
    );

    state.builderM5.tick(price, timestamp);
    state.builderM15.tick(price, timestamp);

    const snapshotM5 = calculateSnapshot(symbol, state.builderM5.getCandles(), price, 'M5', timestamp);
    const snapshotM15 = calculateSnapshot(symbol, state.builderM15.getCandles(), price, 'M15', timestamp);

    if (!snapshotM5 || !snapshotM15) return;

    state.lastSnapshotM5 = snapshotM5;
    state.lastSnapshotM15 = snapshotM15;

    const finalState = resolveMultiTF(snapshotM5, snapshotM15);

    const comparison = state.lastBacktestM5
      ? compareSignalWithHistory(
        { state: snapshotM5.state, elasticity: snapshotM5.elasticity },
        state.lastBacktestM5
      )
      : null;
    const fusedStateResult = fuseMarketState(finalState, comparison);

    // Resolver el estado del gatillo M5 (Tradicional)
    if (fusedStateResult.state === 'GREEN') {
      if (state.triggerStateM5 === 'reposo') {
        state.triggerStateM5 = 'estirando';
      }
      if (state.lastClosedElasticityM5 !== null && state.prevClosedElasticityM5 !== null) {
        if (state.lastClosedElasticityM5 < state.prevClosedElasticityM5) {
          state.triggerStateM5 = 'giro';
        } else {
          state.triggerStateM5 = 'estirando';
        }
      }
    } else {
      state.triggerStateM5 = 'reposo';
    }

    // --- Versión Experimental ---
    let finalStateExp = 'RED' as MarketState;
    let fusedStateResultExp = { state: 'RED' as MarketState, explanation: 'Esperando datos...' };
    let comparisonExp: SignalComparisonResult | null = null;

    const snapshotM5Exp = calculateSnapshotExp(symbol, state.builderM5.getCandles(), price, 'M5', timestamp);
    const snapshotM15Exp = calculateSnapshotExp(symbol, state.builderM15.getCandles(), price, 'M15', timestamp);

    if (snapshotM5Exp && snapshotM15Exp) {
      state.lastSnapshotM5Exp = snapshotM5Exp;
      state.lastSnapshotM15Exp = snapshotM15Exp;

      finalStateExp = resolveMultiTFExp(snapshotM5Exp, snapshotM15Exp);

      comparisonExp = state.lastBacktestM5Exp
        ? compareSignalWithHistoryExp(
          { state: snapshotM5Exp.state, elasticity: snapshotM5Exp.elasticity, direction: snapshotM5Exp.direction },
          state.lastBacktestM5Exp
        )
        : null;

      fusedStateResultExp = fuseMarketState(finalStateExp, comparisonExp);

      // ╔══════════════════════════════════════════════════════════════════════╗
      // ║  Detector de Pico Experimental — 3 Capas de Protección            ║
      // ║  Capa 1: Umbral adaptativo (stddev)                               ║
      // ║  Capa 2: Persistencia en GREEN (N ticks antes de armar)           ║
      // ║  Capa 3: Giro provisional → confirmado (M ticks sostenidos)       ║
      // ╚══════════════════════════════════════════════════════════════════════╝

      // Constantes del detector — calibrar con backtest en /experimental
      const ADAPTIVE_K = 1.5;           // multiplicador de stddev
      const ADAPTIVE_FLOOR = 0.08;      // piso mínimo de retroceso
      const BUFFER_SIZE = 30;           // ticks para calcular stddev
      const GREEN_PERSISTENCE = 5;     // ticks consecutivos en GREEN antes de armar
      const CONFIRM_TICKS = 3;         // ticks sostenidos para confirmar giro

      if (fusedStateResultExp.state === 'GREEN') {
        // --- Capa 1: Alimentar buffer de elasticidad para umbral adaptativo ---
        state.liveElasticityBufferExp.push(snapshotM5Exp.elasticity);
        if (state.liveElasticityBufferExp.length > BUFFER_SIZE) {
          state.liveElasticityBufferExp.shift();
        }

        // --- Capa 2: Filtro de persistencia ---
        state.greenTickCountExp++;

        const detectorArmed = state.greenTickCountExp >= GREEN_PERSISTENCE;

        if (!detectorArmed) {
          // Aún no hay suficientes ticks en GREEN — trackear pico pero no disparar
          if (snapshotM5Exp.elasticity > state.maxLiveElasticityExp) {
            state.maxLiveElasticityExp = snapshotM5Exp.elasticity;
          }
          if (state.triggerStateM5Exp === 'reposo') {
            state.triggerStateM5Exp = 'estirando';
          }
        } else {
          // Detector armado — aplicar lógica de pico con umbral adaptativo

          // Calcular umbral adaptativo basado en stddev del buffer
          let adaptiveThreshold = ADAPTIVE_FLOOR;
          if (state.liveElasticityBufferExp.length >= 5) {
            const buf = state.liveElasticityBufferExp;
            const mean = buf.reduce((a, b) => a + b, 0) / buf.length;
            const variance = buf.reduce((a, v) => a + (v - mean) ** 2, 0) / buf.length;
            const stddev = Math.sqrt(variance);
            adaptiveThreshold = Math.max(ADAPTIVE_FLOOR, ADAPTIVE_K * stddev);
          }

          if (state.triggerStateM5Exp === 'reposo' || state.triggerStateM5Exp === 'estirando') {
            // Fase de estiramiento — buscar pico máximo
            if (snapshotM5Exp.elasticity > state.maxLiveElasticityExp) {
              state.maxLiveElasticityExp = snapshotM5Exp.elasticity;
              state.triggerStateM5Exp = 'estirando';
              state.provisionalGiroTicksExp = 0; // reset si se actualiza el pico
            } else if (state.maxLiveElasticityExp - snapshotM5Exp.elasticity >= adaptiveThreshold) {
              // --- Capa 3: Primer tick que cumple el umbral → giro provisional ---
              state.triggerStateM5Exp = 'giro-provisional';
              state.provisionalGiroTicksExp = 1;
            }
          } else if (state.triggerStateM5Exp === 'giro-provisional') {
            // --- Capa 3: Confirmación del giro ---
            if (snapshotM5Exp.elasticity >= state.maxLiveElasticityExp) {
              // Precio volvió a superar el pico → falso giro, cancelar
              state.triggerStateM5Exp = 'estirando';
              state.maxLiveElasticityExp = snapshotM5Exp.elasticity;
              state.provisionalGiroTicksExp = 0;
            } else if (state.maxLiveElasticityExp - snapshotM5Exp.elasticity >= adaptiveThreshold) {
              // Sigue retrocediendo — sumar tick de confirmación
              state.provisionalGiroTicksExp++;
              if (state.provisionalGiroTicksExp >= CONFIRM_TICKS) {
                state.triggerStateM5Exp = 'giro'; // ¡Confirmado!
              }
            } else {
              // Retrocedió menos que el umbral — cancelar provisional
              state.triggerStateM5Exp = 'estirando';
              state.provisionalGiroTicksExp = 0;
            }
          }
          // Si ya está en 'giro' confirmado, se queda ahí hasta que salga de GREEN
        }
      } else {
        // Fuera de GREEN: reset completo del detector
        state.maxLiveElasticityExp = 0;
        state.triggerStateM5Exp = 'reposo';
        state.liveElasticityBufferExp = [];
        state.greenTickCountExp = 0;
        state.provisionalGiroTicksExp = 0;
      }

      // Semáforo de peatón experimental
      // Solo se activa con giro CONFIRMADO, no provisional
      const checkAnomaly = finalStateExp === 'GREEN' || finalStateExp === 'YELLOW';
      const checkBacktest = fusedStateResultExp.state === 'GREEN' || (comparisonExp && comparisonExp.winRate >= 65);
      const checkTrigger = state.triggerStateM5Exp === 'giro';
      
      // -- Integración de Pullback Shield --
      const shieldSnap = this.consolidationService.getConsolidationSnapshot(symbol);
      const isOpposedM5 = shieldSnap?.m5.detected && shieldSnap?.m5.alignment === 'opposed';
      const isOpposedM15 = shieldSnap?.m15.detected && shieldSnap?.m15.alignment === 'opposed';
      const shieldBlocked = isOpposedM5 || isOpposedM15 || shieldSnap?.superSignal.type === 'SUPER_STOP';

      // -- Integración de Structure Engine (Sándwich de EMAs) --
      const structureSnap = state.lastStructureM5;
      const isCompression = structureSnap?.isCompressionSandwich === true;
      const isDoublePattern = structureSnap?.doublePattern === 'double_top' || structureSnap?.doublePattern === 'double_bottom';
      
      if (isCompression) {
        state.pedestrianLight = 'STOP';
        fusedStateResultExp.state = 'RED';
        fusedStateResultExp.explanation = '🚫 BLOQUEADO POR COMPRESIÓN: Sándwich de EMAs (EMA50 y EMA100 demasiado cerca).';
      } else if (shieldBlocked) {
        state.pedestrianLight = 'STOP'; // El escudo bloquea forzosamente
        fusedStateResultExp.state = 'RED'; // Forzar rojo para cancelar alertas
        fusedStateResultExp.explanation = '🚫 BLOQUEADO POR ESCUDO DE PULLBACKS: ' + (shieldSnap?.superSignal.recommendation || 'Consolidación en contra de la reversión.');
      } else {
        state.pedestrianLight = checkAnomaly && checkBacktest && checkTrigger ? 'WALK' : 'STOP';
      }
    }

    // Broadcast a través de eventos (Tradicional + Experimental)
    this.events.emit('broadcast', {
      type: 'snapshot',
      symbol,
      m5: snapshotM5,
      m15: snapshotM15,
      finalState,
      fusedState: fusedStateResult.state,
      triggerState: state.triggerStateM5,
      lastClosedElasticityM5: state.lastClosedElasticityM5,
      prevClosedElasticityM5: state.prevClosedElasticityM5,
      fusedExplanation: fusedStateResult.explanation,
      fusedComparison: comparison,
      backtest: state.lastBacktestM5,
      experimental: snapshotM5Exp && snapshotM15Exp ? {
        m5: snapshotM5Exp,
        m15: snapshotM15Exp,
        finalState: finalStateExp,
        fusedState: fusedStateResultExp.state,
        triggerState: state.triggerStateM5Exp,
        pedestrianLight: state.pedestrianLight,
        fusedExplanation: fusedStateResultExp.explanation,
        fusedComparison: comparisonExp,
        backtest: state.lastBacktestM5Exp,
        lastClosedElasticityM5: state.lastClosedElasticityM5Exp,
        prevClosedElasticityM5: state.prevClosedElasticityM5Exp,
      } : undefined
    } satisfies BackendMessage);

    // Alerta de Telegram autónoma tradicional
    this.checkAndSendTelegramAlert(state, fusedStateResult, finalState, snapshotM5, snapshotM15, comparison);

    // Alerta de Telegram autónoma experimental
    if (snapshotM5Exp && snapshotM15Exp) {
      this.checkAndSendTelegramAlertExp(state, fusedStateResultExp, finalStateExp, snapshotM5Exp, snapshotM15Exp, comparisonExp);
    }

    if (Math.random() < 0.05) {
      console.log(
        `[Engine] [${symbol}] ${new Date(timestamp).toLocaleTimeString()}`,
        `· ${price.toFixed(5)}`,
        `· M5: ${snapshotM5.elasticity.toFixed(3)} ${snapshotM5.state}`,
        `· M15: ${snapshotM15.elasticity.toFixed(3)} ${snapshotM15.state}`,
        `· Final: ${finalState} · Fused: ${fusedStateResult.state}`
      );
    }

    // Correr simulación Fomowatch pasiva
    this.runFomowatchSimulation(symbol, snapshotM5.price);
  }

  private async checkAndSendTelegramAlert(
    state: SymbolState,
    fused: FusedStateResult,
    finalState: MarketState,
    m5: MarketSnapshot,
    m15: MarketSnapshot,
    comparison: any
  ): Promise<void> {
    const now = Date.now();
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
      state.previousFusedState = fused.state;
      state.previousFinalState = finalState;
      state.previousTriggerStateM5 = state.triggerStateM5;
      return;
    }

    const direction = m5.price > m5.ema100 ? 'SELL' : 'BUY';

    // 🟢 Caso 1: Alerta Tipo A (Señal Confirmada e Históricamente Sólida)
    const isNewFusedGreen = state.previousFusedState !== 'GREEN' && fused.state === 'GREEN';
    const canAlertA = now - state.lastTelegramAlertTimeA > 300000; // 5 min cooldown

    if (isNewFusedGreen && canAlertA) {
      state.lastTelegramAlertTimeA = now;
      await this.createPendingSignalAndSendTelegram(
        state,
        'Tipo A',
        direction,
        'normal',
        m5.price,
        fused.state,
        m5.state,
        m15.state,
        m5.elasticity,
        m15.elasticity,
        comparison,
        fused.explanation
      );
    }

    // 🟡 Caso 2: Alerta Tipo B (Señal en Tiempo Real)
    const isNewFinalGreen = state.previousFinalState !== 'GREEN' && finalState === 'GREEN';
    const canAlertB = now - state.lastTelegramAlertTimeB > 300000; // 5 min cooldown

    if (isNewFinalGreen && fused.state !== 'GREEN' && canAlertB) {
      state.lastTelegramAlertTimeB = now;
      await this.createPendingSignalAndSendTelegram(
        state,
        'Tipo B',
        direction,
        'normal',
        m5.price,
        fused.state,
        m5.state,
        m15.state,
        m5.elasticity,
        m15.elasticity,
        comparison,
        'Sobre-estirado en M5/M15 (finalState: GREEN) pero sin confluencia de backtest.'
      );
    }

    // 🪃 Caso 3: Alerta Tipo C (Gatillo de Agotamiento / Giro de Elasticidad)
    const isNewGiro = state.triggerStateM5 === 'giro' && state.previousTriggerStateM5 !== 'giro';
    const canAlertTrigger = now - state.lastTelegramAlertTimeTrigger > 290000; // ~5 min cooldown

    if (isNewGiro && canAlertTrigger) {
      state.lastTelegramAlertTimeTrigger = now;
      const decaimiento = (state.prevClosedElasticityM5 ?? 0) - (state.lastClosedElasticityM5 ?? 0);
      await this.createPendingSignalAndSendTelegram(
        state,
        'Tipo C',
        direction,
        'normal',
        m5.price,
        fused.state,
        m5.state,
        m15.state,
        m5.elasticity,
        m15.elasticity,
        comparison,
        `La elasticidad ha comenzado a ceder en M5 (decae -${decaimiento.toFixed(2)}).`
      );
    }

    state.previousFusedState = fused.state;
    state.previousFinalState = finalState;
    state.previousTriggerStateM5 = state.triggerStateM5;
  }

  private async checkAndSendTelegramAlertExp(
    state: SymbolState,
    fused: FusedStateResult,
    finalState: MarketState,
    m5: MarketSnapshot & { direction: 'BUY' | 'SELL' },
    m15: MarketSnapshot & { direction: 'BUY' | 'SELL' },
    comparison: any
  ): Promise<void> {
    const now = Date.now();
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
      state.previousFusedStateExp = fused.state;
      state.previousFinalStateExp = finalState;
      state.previousTriggerStateM5Exp = state.triggerStateM5Exp;
      state.previousPedestrianLight = state.pedestrianLight;
      return;
    }

    const direction = m5.direction;

    // 1️⃣ Alerta Experimental Tipo A
    const isNewFusedGreen = state.previousFusedStateExp !== 'GREEN' && fused.state === 'GREEN';
    const canAlertA = now - state.lastTelegramAlertTimeAExp > 300000;

    if (isNewFusedGreen && canAlertA) {
      state.lastTelegramAlertTimeAExp = now;
      await this.createPendingSignalAndSendTelegram(
        state,
        'Tipo A',
        direction,
        'experimental',
        m5.price,
        fused.state,
        m5.state,
        m15.state,
        m5.elasticity,
        m15.elasticity,
        comparison,
        fused.explanation
      );
    }

    // 2️⃣ Alerta Experimental Tipo B
    const isNewFinalGreen = state.previousFinalStateExp !== 'GREEN' && finalState === 'GREEN';
    const canAlertB = now - state.lastTelegramAlertTimeBExp > 300000;

    if (isNewFinalGreen && fused.state !== 'GREEN' && canAlertB) {
      state.lastTelegramAlertTimeBExp = now;
      await this.createPendingSignalAndSendTelegram(
        state,
        'Tipo B',
        direction,
        'experimental',
        m5.price,
        fused.state,
        m5.state,
        m15.state,
        m5.elasticity,
        m15.elasticity,
        comparison,
        'Sobre-estirado en M5/M15 pero sin ventaja estadística en backtest.'
      );
    }

    // 3️⃣ Alerta Experimental Tipo C
    const isNewGiro = state.triggerStateM5Exp === 'giro' && state.previousTriggerStateM5Exp !== 'giro';
    const canAlertTrigger = now - state.lastTelegramAlertTimeTriggerExp > 290000;

    if (isNewGiro && canAlertTrigger) {
      state.lastTelegramAlertTimeTriggerExp = now;
      await this.createPendingSignalAndSendTelegram(
        state,
        'Tipo C',
        direction,
        'experimental',
        m5.price,
        fused.state,
        m5.state,
        m15.state,
        m5.elasticity,
        m15.elasticity,
        comparison,
        'La elasticidad ha comenzado a ceder en tiempo real en M5 (Gatillo).'
      );
    }

    // 4️⃣ Alerta del Semáforo de Peatón (Transición a WALK / Todas las confluencias correctas)
    const isNewWalk = state.pedestrianLight === 'WALK' && state.previousPedestrianLight !== 'WALK';
    const canAlertPedestrian = now - state.lastTelegramAlertTimePedestrian > 300000;

    if (isNewWalk && canAlertPedestrian) {
      state.lastTelegramAlertTimePedestrian = now;
      await this.createPendingSignalAndSendTelegram(
        state,
        'Semáforo Peatón',
        direction,
        'experimental',
        m5.price,
        fused.state,
        m5.state,
        m15.state,
        m5.elasticity,
        m15.elasticity,
        comparison,
        '¡CAMINAR (WALK)! Todas las confluencias experimentales (Anomalía + Backtest + Giro) están alineadas.'
      );
    }

    state.previousFusedStateExp = fused.state;
    state.previousFinalStateExp = finalState;
    state.previousTriggerStateM5Exp = state.triggerStateM5Exp;
    state.previousPedestrianLight = state.pedestrianLight;
  }

  private async createPendingSignalAndSendTelegram(
    symbolState: SymbolState,
    alertName: string,
    direction: 'BUY' | 'SELL',
    tradeMode: 'normal' | 'experimental',
    entryPrice: number,
    fusedState: MarketState,
    elasticityM5State: MarketState,
    elasticityM15State: MarketState,
    elasticityM5Value: number,
    elasticityM15Value: number,
    comparison: any,
    explanation: string
  ): Promise<void> {
    await RequestContext.create(this.em, async () => {
      const token = process.env.TELEGRAM_BOT_TOKEN;
      const chatId = process.env.TELEGRAM_CHAT_ID;
      if (!token || !chatId) return;

      try {
        const struct = symbolState.lastStructureM5;
        let tpPrice = 0;
        let slPrice = 0;
        const decimals = symbolState.symbol.includes('JPY') ? 3 : 5;

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

        if (tpPrice === 0 || slPrice === 0) {
          const pips = symbolState.symbol.includes('JPY') ? 0.15 : 0.0015;
          if (direction === 'BUY') {
            tpPrice = entryPrice + pips;
            slPrice = entryPrice - pips;
          } else {
            tpPrice = entryPrice - pips;
            slPrice = entryPrice + pips;
          }
        }

        tpPrice = Math.round(tpPrice * Math.pow(10, decimals)) / Math.pow(10, decimals);
        slPrice = Math.round(slPrice * Math.pow(10, decimals)) / Math.pow(10, decimals);

        const signal = new PendingSignal();
        signal.symbol = symbolState.symbol;
        signal.direction = direction;
        signal.tradeMode = tradeMode;
        signal.status = 'pending';
        signal.entryPrice = entryPrice;
        signal.tpPrice = tpPrice;
        signal.slPrice = slPrice;
        signal.session = detectSession(new Date());

        signal.elasticityM5State = elasticityM5State;
        signal.elasticityM15State = elasticityM15State;
        signal.fusedState = fusedState;
        signal.elasticityM5Value = elasticityM5Value;
        signal.elasticityM15Value = elasticityM15Value;

        if (struct) {
          signal.structureState = alertName === 'Tipo A' ? 'STRONG' : struct.structureState;
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
        } else if (alertName === 'Tipo A') {
          signal.structureState = 'STRONG';
        }

        signal.contextualWinRate = comparison ? comparison.winRate : null;
        signal.contextualCases = comparison ? comparison.similarSignals : null;
        signal.hasTypeC = alertName === 'Tipo C';
        signal.hasPedestrianLight = alertName === 'Semáforo Peatón' || (tradeMode === 'experimental' && symbolState.pedestrianLight === 'WALK');
        signal.openedAt = new Date();

        this.em.persist(signal);
        await this.em.flush();

        const directionEmoji = direction === 'BUY' ? '🟢 COMPRA (BUY) 📈' : '🔴 VENTA (SELL) 📉';
        const modeEmoji = tradeMode === 'experimental' ? '🧪 [EXPERIMENTAL]' : '💼 [NORMAL]';

        let messageText = `${modeEmoji} 🚨 **ALERTA DE TRADING: ${alertName}**\n\n`;
        messageText += `Símbolo: **${symbolState.symbol}**\n`;
        messageText += `Sugerido: **${directionEmoji}**\n`;
        messageText += `Precio: \`${entryPrice.toFixed(5)}\`\n`;
        messageText += `TP Sugerido: \`${tpPrice.toFixed(5)}\` | SL Sugerido: \`${slPrice.toFixed(5)}\`\n\n`;

        if (explanation) {
          messageText += `Detalle: _${explanation}_\n\n`;
        }
        if (comparison) {
          messageText += `Estadística Contextual:\n`;
          messageText += `· Win Rate: **${comparison.winRate.toFixed(0)}%**\n`;
          messageText += `· Casos Similares: **${comparison.similarSignals}**\n`;
        }

        const replyMarkup = {
          inline_keyboard: [
            [
              { text: '✅ Registrar Trade', callback_data: `approve:${signal.id}` },
              { text: '❌ Descartar Alerta', callback_data: `discard:${signal.id}` }
            ]
          ]
        };

        const url = `https://api.telegram.org/bot${token}/sendMessage`;
        await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: messageText,
            parse_mode: 'Markdown',
            reply_markup: replyMarkup
          }),
        });

        console.log(`[Pending-Signal] Alerta ${alertName} (${tradeMode}) #${signal.id} guardada y enviada a Telegram.`);
      } catch (err) {
        console.error(`[Pending-Signal] Error procesando señal pendiente ${alertName}:`, err);
      }
    });
  }

  private async runFomowatchSimulation(symbol: string, currentPrice: number): Promise<void> {
    await RequestContext.create(this.em, async () => {
      try {
        const activeSignals = await this.em.getRepository(PendingSignal).find({
          symbol,
          status: 'discarded_active'
        });

        if (activeSignals.length === 0) return;

        let hasClosedAny = false;

        for (const signal of activeSignals) {
          const totalMinutes = (Date.now() - signal.openedAt.getTime()) / 60000;
          let shouldClose = false;
          let exitPrice = currentPrice;
          let statusResult = signal.status;

          if (signal.direction === 'BUY') {
            if (currentPrice >= signal.tpPrice) {
              shouldClose = true;
              exitPrice = signal.tpPrice;
              statusResult = 'discarded_win';
            } else if (currentPrice <= signal.slPrice) {
              shouldClose = true;
              exitPrice = signal.slPrice;
              statusResult = 'discarded_loss';
            } else if (totalMinutes >= 240) { // 4 horas timeout
              shouldClose = true;
              exitPrice = currentPrice;
              statusResult = 'discarded_timeout';
            }
          } else { // SELL
            if (currentPrice <= signal.tpPrice) {
              shouldClose = true;
              exitPrice = signal.tpPrice;
              statusResult = 'discarded_win';
            } else if (currentPrice >= signal.slPrice) {
              shouldClose = true;
              exitPrice = signal.slPrice;
              statusResult = 'discarded_loss';
            } else if (totalMinutes >= 240) { // 4 horas timeout
              shouldClose = true;
              exitPrice = currentPrice;
              statusResult = 'discarded_timeout';
            }
          }

          if (shouldClose) {
            const pip = signal.direction === 'BUY'
              ? exitPrice - signal.entryPrice
              : signal.entryPrice - exitPrice;

            const pnl = (pip / signal.entryPrice) * 200 * 2.0; // apalancamiento x200, inversión $2.00

            signal.status = statusResult;
            signal.closedAt = new Date();
            signal.totalMinutesOpen = Math.max(1, Math.round(totalMinutes));
            signal.pnl = Math.round(pnl * 10000) / 10000;

            this.em.persist(signal);
            hasClosedAny = true;
            console.log(`[Fomowatch] Alerta descartada #${signal.id} (${signal.symbol}) cerrada virtualmente como ${statusResult} (P&L: $${signal.pnl}, Minutos: ${signal.totalMinutesOpen}).`);
          }
        }

        if (hasClosedAny) {
          await this.em.flush();
        }
      } catch (err) {
        console.error('[Fomowatch] Error en bucle de simulación pasiva:', err);
      }
    });
  }

  private recordDroppedTick(reason: string) {
    this.serverMetrics.droppedTicksTotal++;
    this.dropsInCurrentMinute++;
    this.serverMetrics.lastDroppedTickAt = Date.now();
  }
}
