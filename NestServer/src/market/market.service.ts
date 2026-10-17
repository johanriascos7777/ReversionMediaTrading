import { Injectable, OnModuleInit, OnModuleDestroy, Inject, forwardRef } from '@nestjs/common';
import { EventEmitter } from 'events';
import https from 'https';
import http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { TwelveDataClient } from './twelveDataClient';
import { CandleBuilder } from './candleBuilder';
import { isFxClosed } from './fxCalendar';
import { calculateSnapshot, resolveMultiTF, calculateElasticityForCandles, pushPercentileHistory, clearPercentileHistory } from './marketEngine';
import type { BackendMessage, Candle, MarketSnapshot, MarketState, FusedStateResult, BacktestResult, SignalComparisonResult } from './types';
import { runBacktest } from './backtestEngine';
import { compareSignalWithHistory } from './compareSignal';
import { fuseMarketState } from './fuseMarketState';
import { EntityManager } from '@mikro-orm/mysql';
import { PendingSignal } from '../trade/pending-signal.entity';
import { ConsolidationService } from '../consolidation/consolidation.service';
import { AlertsService, pipSize } from '../alerts/alerts.service';
import { buildZoneModel, emaSeries, atrSeries, lastValue, ZONE_DEFAULTS, type ZoneModel } from '../alerts/zoneEngine';

const HISTORY_OUTPUT = 1000;
const ZONE_HISTORY_OUTPUT = 5000;
const REST_CREDITS_PER_KEY_PER_DAY = 760;
const FOMOWATCH_REFRESH_MS = 30_000;

type FomowatchSignal = Pick<PendingSignal, 'id' | 'symbol' | 'direction' | 'status' | 'entryPrice' | 'tpPrice' | 'slPrice' | 'openedAt'>;

export type TriggerState = 'reposo' | 'estirando' | 'giro-provisional' | 'giro';
export type DirectionalSnapshot = MarketSnapshot & { direction: 'BUY' | 'SELL' };

export class SymbolState {
  public readonly symbol: string;
  public readonly builderM5 = new CandleBuilder('M5');
  public readonly builderM15 = new CandleBuilder('M15');

  public lastSnapshotM5: DirectionalSnapshot | null = null;
  public lastSnapshotM15: DirectionalSnapshot | null = null;

  public historicalM5: Candle[] = [];
  public historicalM15: Candle[] = [];

  public lastBacktestM5: BacktestResult | null = null;
  public lastStructureM5: any | null = null;
  public lastStructureM15: any | null = null;

  // Giro de Elasticidad (Gatillo) M5
  public lastClosedElasticityM5: number | null = null;
  public prevClosedElasticityM5: number | null = null;

  public triggerStateM5: TriggerState = 'reposo';
  public previousTriggerStateM5: TriggerState = 'reposo';
  public maxLiveElasticity = 0;

  // --- Mejoras al Detector de Pico (3 capas) ---
  /** Buffer circular de últimos N valores de elasticidad tick-a-tick para calcular stddev */
  public liveElasticityBuffer: number[] = [];
  /** Contador de ticks consecutivos en estado GREEN antes de armar el detector */
  public greenTickCount = 0;
  /** Contador de ticks sosteniendo retroceso tras giro provisional */
  public provisionalGiroTicks = 0;

  public lastAlertTimeV1 = 0;

  public pedestrianLight: 'STOP' | 'WALK' = 'STOP';

  // Estado del escudo (para alertas Shield-Verified y el frontend)
  public shieldBlocked = false;
  public isCompression = false;
  public shieldExplanation = '✅ Escudo despejado.';

  // Zona de agotamiento (alerta v2)
  public zoneBars: Candle[] = [];
  public zoneEma: number | null = null;
  public zoneAtr: number | null = null;
  public zoneM15Ema: number | null = null;
  public zoneModel: ZoneModel | null = null;
  public zoneModelHour = -1;
  public zoneSource = '';
  public v2Side: 1 | -1 | null = null;
  public v2Alerted = false;

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

  private readonly fomowatchSignals = new Map<string, { loadedAt: number; signals: FomowatchSignal[] }>();
  private readonly fomowatchLoading = new Set<string>();

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
    private readonly consolidationService: ConsolidationService,
    private readonly alertsService: AlertsService
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
    if (isFxClosed(Date.now())) return false;

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

            // Recalcular backtest M5 con la nueva vela
            state.lastBacktestM5 = runBacktest(state.historicalM5, { emaPeriod: 100, maxBarsToRevert: 20 });
            console.log(
              `[MarketService] [${sym}] Vela M5 cerrada. Backtest M5 recalculado: WinRate: ${state.lastBacktestM5.winRate}%`
            );

            void this.alertsService.onCandleClosed(sym, candle, 5 * 60_000, state.zoneEma);
            state.zoneBars.push(candle);
            if (state.zoneBars.length > ZONE_HISTORY_OUTPUT + HISTORY_OUTPUT) state.zoneBars.shift();
            this.refreshZone(state, false);
          });

          state.builderM15.on('candle:closed', (candle: Candle) => {
            state.historicalM15.push(candle);
            if (state.historicalM15.length > HISTORY_OUTPUT) state.historicalM15.shift();

            const el = calculateElasticityForCandles(state.builderM15.getCandles(), candle.close);
            if (el !== null) pushPercentileHistory(sym, 'M15', el);

            state.zoneM15Ema = lastValue(emaSeries(state.historicalM15.map((c) => c.close)));
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
          this.balanceRestPolling();
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

  private balanceRestPolling(): void {
    const restClients = this.twelveClients.filter((c) => c.isUsingRest());
    if (restClients.length === 0) return;
    const dailyBudget = Math.max(1, this.apiKeyList.length) * REST_CREDITS_PER_KEY_PER_DAY;
    const ms = Math.min(5 * 60_000, Math.max(60_000, Math.ceil((86_400_000 * restClients.length) / dailyBudget / 60_000) * 60_000));
    for (const client of restClients) client.setRestPollInterval(ms);
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

  private snapshotPayload(
    state: SymbolState,
    m5: DirectionalSnapshot,
    m15: DirectionalSnapshot,
    finalState: MarketState,
    fused: FusedStateResult,
    comparison: SignalComparisonResult | null,
  ): BackendMessage {
    const engine = {
      m5,
      m15,
      finalState,
      fusedState: fused.state,
      triggerState: state.triggerStateM5,
      pedestrianLight: state.pedestrianLight,
      fusedExplanation: fused.explanation,
      fusedComparison: comparison,
      backtest: state.lastBacktestM5,
      lastClosedElasticityM5: state.lastClosedElasticityM5,
      prevClosedElasticityM5: state.prevClosedElasticityM5,
    };
    return {
      type: 'snapshot',
      symbol: state.symbol,
      ...engine,
      experimental: engine,
      zone: this.zoneView(state, m5.price),
    };
  }

  private evaluate(state: SymbolState, m5: DirectionalSnapshot, m15: DirectionalSnapshot) {
    const finalState = resolveMultiTF(m5, m15);
    const comparison = state.lastBacktestM5
      ? compareSignalWithHistory(
        { state: m5.state, elasticity: m5.elasticity, direction: m5.direction },
        state.lastBacktestM5
      )
      : null;
    const fused = fuseMarketState(finalState, comparison);
    return { finalState, comparison, fused };
  }

  // Retorna todos los últimos snapshots del sistema
  public getAllLastSnapshots(): BackendMessage[] {
    const list: BackendMessage[] = [];
    for (const state of this.symbolStates.values()) {
      if (state.lastSnapshotM5 && state.lastSnapshotM15) {
        const { finalState, comparison, fused } = this.evaluate(state, state.lastSnapshotM5, state.lastSnapshotM15);
        list.push(this.snapshotPayload(state, state.lastSnapshotM5, state.lastSnapshotM15, finalState, fused, comparison));
      }
    }
    return list;
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
        `&interval=${interval}&outputsize=${outputSize}&timezone=UTC&apikey=${key}`;

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
                time: Date.parse(String(c.datetime).replace(' ', 'T') + 'Z'),
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

  private async loadZoneHistory(state: SymbolState): Promise<void> {
    let bars: Candle[] = [];
    try {
      await new Promise((r) => setTimeout(r, 1000));
      bars = await this.fetchHistoricalCandles(state.symbol, '5min', ZONE_HISTORY_OUTPUT);
      this.takeFormingCandle(bars, 5 * 60_000);
    } catch (err: any) {
      console.warn(`[Zona] [${state.symbol}] No se pudo traer el historial largo (${err?.message}). Uso el historial en memoria.`);
    }
    if (bars.length < state.historicalM5.length) {
      bars = state.historicalM5.map((c) => ({ ...c }));
      state.zoneSource = `${bars.length} velas de 5m (respaldo: historial corto)`;
    } else {
      state.zoneSource = `${bars.length} velas de 5m`;
    }
    state.zoneBars = bars;
    state.zoneM15Ema = lastValue(emaSeries(state.historicalM15.map((c) => c.close)));
    this.refreshZone(state, true);

    const emas = emaSeries(state.zoneBars.map((c) => c.close));
    const restored = await this.alertsService.restore(state.symbol, state.zoneBars, emas, 5 * 60_000);
    const m = state.zoneModel;
    console.log(
      `[Zona] [${state.symbol}] ${state.zoneSource} · ` +
      (m ? `umbral ${m.gate.toFixed(2)} ATR · p50 ${m.q50.toFixed(2)} · p75 ${m.q75.toFixed(2)} · p90 ${m.q90.toFixed(2)} · ${m.episodes} episodios` : 'sin modelo') +
      ` · alertas abiertas recuperadas: ${restored}`
    );
  }

  private refreshZone(state: SymbolState, force: boolean): void {
    if (state.zoneBars.length === 0) return;
    const emas = emaSeries(state.zoneBars.map((c) => c.close));
    const atrs = atrSeries(state.zoneBars);
    state.zoneEma = lastValue(emas);
    state.zoneAtr = lastValue(atrs);
    const lastTime = state.zoneBars[state.zoneBars.length - 1].time;
    const hour = Math.floor(lastTime / 3_600_000);
    if (force || hour !== state.zoneModelHour) {
      state.zoneModel = buildZoneModel(state.zoneBars);
      state.zoneModelHour = hour;
    }
  }

  private zoneView(state: SymbolState, price: number) {
    const model = state.zoneModel;
    const ema = state.zoneEma;
    const atr = state.zoneAtr;
    if (!model || ema === null || atr === null) return null;
    const side: 1 | -1 = price > ema ? 1 : -1;
    const level = (q: number) => ema + side * q * atr;
    const pip = pipSize(state.symbol);
    return {
      direction: side === 1 ? 'SELL' : 'BUY',
      ema,
      atr,
      distanceAtr: Math.abs(price - ema) / atr,
      distancePips: Math.abs(price - ema) / pip,
      q50: level(model.q50),
      q75: level(model.q75),
      q90: level(model.q90),
      gateAtr: model.gate,
      q75Atr: model.q75,
      episodes: model.episodes,
      residualMedianPips: (model.residual.median * atr) / pip,
      residualP90Pips: (model.residual.p90 * atr) / pip,
      residualMaxPips: (model.residual.max * atr) / pip,
      touch4h: model.touchWithinBars.count ? model.touchWithinBars.touched / model.touchWithinBars.count : null,
      source: state.zoneSource,
      alerted: state.v2Alerted && state.v2Side === side,
    };
  }

  private zoneLineForV1(state: SymbolState, price: number): string[] {
    const view = this.zoneView(state, price);
    if (!view) return [];
    const inside = view.distanceAtr >= view.q75Atr;
    return [`Zona v2: distancia ${view.distanceAtr.toFixed(1)} ATR (p75 ${view.q75Atr.toFixed(1)} ATR) → ${inside ? 'dentro de la zona' : 'todavía fuera de la zona'}`];
  }

  private takeFormingCandle(candles: Candle[], periodMs: number): Candle | null {
    const last = candles[candles.length - 1];
    if (!last || last.time + periodMs <= Date.now()) return null;
    candles.pop();
    return last;
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

          const formingM5 = this.takeFormingCandle(histM5, 5 * 60_000);
          const formingM15 = this.takeFormingCandle(histM15, 15 * 60_000);

          state.historicalM5 = histM5;
          state.historicalM15 = histM15;

          this.warmUpBuilder(sym, state.builderM5, state.historicalM5);
          this.warmUpBuilder(sym, state.builderM15, state.historicalM15);
          if (formingM5) state.builderM5.resumeCandle(formingM5);
          if (formingM15) state.builderM15.resumeCandle(formingM15);

          state.lastBacktestM5 = runBacktest(state.historicalM5, { emaPeriod: 100, maxBarsToRevert: 20 });
          console.log(
            `[MarketService] [${sym}] Historial cargado con éxito en segundo plano. Backtest M5 recalculado: WinRate: ${state.lastBacktestM5.winRate}%`
          );

          // Calcular snapshot inicial con el último precio del historial cargado
          const lastCandle = formingM5 ?? state.historicalM5[state.historicalM5.length - 1];
          const lastPrice = lastCandle.close;
          const ts = lastCandle.time;
          const snap5 = calculateSnapshot(sym, state.builderM5.getCandles(), lastPrice, 'M5', ts);
          const snap15 = calculateSnapshot(sym, state.builderM15.getCandles(), lastPrice, 'M15', ts);

          if (snap5 && snap15) {
            state.lastSnapshotM5 = snap5;
            state.lastSnapshotM15 = snap15;
            console.log(
              `[MarketService] [${sym}] Snapshot inicial recalculado: M5: ${snap5.elasticity.toFixed(3)} ${snap5.state} · M15: ${snap15.elasticity.toFixed(3)} ${snap15.state}`
            );
          }

          state.historyLoaded = true;
          await this.loadZoneHistory(state);
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

    const { finalState, comparison, fused: fusedStateResult } = this.evaluate(state, snapshotM5, snapshotM15);

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

    if (fusedStateResult.state === 'GREEN') {
      // --- Capa 1: Alimentar buffer de elasticidad para umbral adaptativo ---
      state.liveElasticityBuffer.push(snapshotM5.elasticity);
      if (state.liveElasticityBuffer.length > BUFFER_SIZE) {
        state.liveElasticityBuffer.shift();
      }

      // --- Capa 2: Filtro de persistencia ---
      state.greenTickCount++;

      const detectorArmed = state.greenTickCount >= GREEN_PERSISTENCE;

      if (!detectorArmed) {
        // Aún no hay suficientes ticks en GREEN — trackear pico pero no disparar
        if (snapshotM5.elasticity > state.maxLiveElasticity) {
          state.maxLiveElasticity = snapshotM5.elasticity;
        }
        if (state.triggerStateM5 === 'reposo') {
          state.triggerStateM5 = 'estirando';
        }
      } else {
        // Detector armado — aplicar lógica de pico con umbral adaptativo

        // Calcular umbral adaptativo basado en stddev del buffer
        let adaptiveThreshold = ADAPTIVE_FLOOR;
        if (state.liveElasticityBuffer.length >= 5) {
          const buf = state.liveElasticityBuffer;
          const mean = buf.reduce((a, b) => a + b, 0) / buf.length;
          const variance = buf.reduce((a, v) => a + (v - mean) ** 2, 0) / buf.length;
          const stddev = Math.sqrt(variance);
          adaptiveThreshold = Math.max(ADAPTIVE_FLOOR, ADAPTIVE_K * stddev);
        }

        if (state.triggerStateM5 === 'reposo' || state.triggerStateM5 === 'estirando') {
          // Fase de estiramiento — buscar pico máximo
          if (snapshotM5.elasticity > state.maxLiveElasticity) {
            state.maxLiveElasticity = snapshotM5.elasticity;
            state.triggerStateM5 = 'estirando';
            state.provisionalGiroTicks = 0; // reset si se actualiza el pico
          } else if (state.maxLiveElasticity - snapshotM5.elasticity >= adaptiveThreshold) {
            // --- Capa 3: Primer tick que cumple el umbral → giro provisional ---
            state.triggerStateM5 = 'giro-provisional';
            state.provisionalGiroTicks = 1;
          }
        } else if (state.triggerStateM5 === 'giro-provisional') {
          // --- Capa 3: Confirmación del giro ---
          if (snapshotM5.elasticity >= state.maxLiveElasticity) {
            // Precio volvió a superar el pico → falso giro, cancelar
            state.triggerStateM5 = 'estirando';
            state.maxLiveElasticity = snapshotM5.elasticity;
            state.provisionalGiroTicks = 0;
          } else if (state.maxLiveElasticity - snapshotM5.elasticity >= adaptiveThreshold) {
            // Sigue retrocediendo — sumar tick de confirmación
            state.provisionalGiroTicks++;
            if (state.provisionalGiroTicks >= CONFIRM_TICKS) {
              state.triggerStateM5 = 'giro'; // ¡Confirmado!
            }
          } else {
            // Retrocedió menos que el umbral — cancelar provisional
            state.triggerStateM5 = 'estirando';
            state.provisionalGiroTicks = 0;
          }
        }
        // Si ya está en 'giro' confirmado, se queda ahí hasta que salga de GREEN
      }
    } else {
      // Fuera de GREEN: reset completo del detector
      state.maxLiveElasticity = 0;
      state.triggerStateM5 = 'reposo';
      state.liveElasticityBuffer = [];
      state.greenTickCount = 0;
      state.provisionalGiroTicks = 0;
    }

    // Semáforo de peatón experimental
    // Solo se activa con giro CONFIRMADO, no provisional
    const checkAnomaly = finalState === 'GREEN' || finalState === 'YELLOW';
    const checkBacktest = fusedStateResult.state === 'GREEN' || (comparison && comparison.winRate >= 65);
    const checkTrigger = state.triggerStateM5 === 'giro';

    // -- Integración de Pullback Shield --
    const shieldSnap = this.consolidationService.getConsolidationSnapshot(symbol);
    const isOpposedM5 = shieldSnap?.m5.detected && shieldSnap?.m5.alignment === 'opposed';
    const isOpposedM15 = shieldSnap?.m15.detected && shieldSnap?.m15.alignment === 'opposed';
    const shieldBlocked = isOpposedM5 || isOpposedM15 || shieldSnap?.superSignal.type === 'SUPER_STOP';

    // -- Integración de Structure Engine (Sándwich de EMAs) --
    const structureSnap = state.lastStructureM5;
    const isCompression = structureSnap?.isCompressionSandwich === true;

    state.pedestrianLight = checkAnomaly && checkBacktest && checkTrigger ? 'WALK' : 'STOP';

    // Guardar estado del escudo para las alertas Shield-Verified y el frontend
    state.shieldBlocked = !!(shieldBlocked);
    state.isCompression = !!(isCompression);
    state.shieldExplanation = isCompression
      ? '🚫 Sándwich de EMAs (EMA50 y EMA100 demasiado cerca).'
      : shieldBlocked
        ? (shieldSnap?.superSignal.recommendation || 'Consolidación en contra de la reversión.')
        : '✅ Escudo despejado.';

    this.events.emit('broadcast', this.snapshotPayload(state, snapshotM5, snapshotM15, finalState, fusedStateResult, comparison));

    this.checkAlertV1(state, fusedStateResult, snapshotM5, snapshotM15, comparison);
    this.alertsService.onTick(symbol, price, timestamp, state.zoneEma);
    this.checkAlertV2(state, price, fusedStateResult, snapshotM5, snapshotM15, comparison);

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

  private async checkAlertV1(
    state: SymbolState,
    fused: FusedStateResult,
    m5: DirectionalSnapshot,
    m15: DirectionalSnapshot,
    comparison: SignalComparisonResult | null
  ): Promise<void> {
    const now = Date.now();
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
      state.previousTriggerStateM5 = state.triggerStateM5;
      return;
    }

    const isNewGiro = state.triggerStateM5 === 'giro' && state.previousTriggerStateM5 !== 'giro';
    const canAlert = now - state.lastAlertTimeV1 > 290000;

    if (isNewGiro && canAlert) {
      state.lastAlertTimeV1 = now;
      await this.alertsService.sendAlert({
        version: 'v1',
        name: 'Giro',
        symbol: state.symbol,
        direction: m5.direction,
        price: m5.price,
        fusedState: fused.state,
        m5State: m5.state,
        m15State: m15.state,
        m5Elasticity: m5.elasticity,
        m15Elasticity: m15.elasticity,
        comparison,
        structure: state.lastStructureM5,
        pedestrianLight: state.pedestrianLight,
        shieldClear: !state.shieldBlocked && !state.isCompression,
        shieldExplanation: state.shieldExplanation,
        emaTarget: state.zoneEma ?? m5.ema100,
        atr: state.zoneAtr,
        detailLines: [
          'Detalle: la elasticidad empezó a ceder en M5 (giro confirmado en la vela en curso).',
          ...this.zoneLineForV1(state, m5.price),
        ],
        features: {
          engineEma100: m5.ema100,
          engineAtr: m5.atr,
          maxLiveElasticity: state.maxLiveElasticity,
          percentileM5: m5.percentile,
          percentileM15: m15.percentile,
          shieldExplanation: state.shieldExplanation,
          zone: this.zoneView(state, m5.price),
        },
      });
    }

    state.previousTriggerStateM5 = state.triggerStateM5;
  }

  private async checkAlertV2(
    state: SymbolState,
    price: number,
    fused: FusedStateResult,
    m5: DirectionalSnapshot,
    m15: DirectionalSnapshot,
    comparison: SignalComparisonResult | null
  ): Promise<void> {
    const model = state.zoneModel;
    const ema = state.zoneEma;
    const atr = state.zoneAtr;
    if (!model || ema === null || atr === null || atr <= 0) return;

    if ((state.v2Side === 1 && price <= ema) || (state.v2Side === -1 && price >= ema)) {
      state.v2Side = null;
      state.v2Alerted = false;
    }
    const side: 1 | -1 = price > ema ? 1 : -1;
    if (state.v2Side !== side) {
      state.v2Side = side;
      state.v2Alerted = false;
    }

    const level = ema + side * model.q75 * atr;
    const crossed = side === 1 ? price >= level : price <= level;
    const m15SameSide = state.zoneM15Ema !== null && (price > state.zoneM15Ema) === (side === 1);
    if (!crossed || state.v2Alerted || !m15SameSide || model.episodes < ZONE_DEFAULTS.minEpisodes) return;
    if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) return;

    state.v2Alerted = true;
    const view = this.zoneView(state, price)!;
    const decimals = state.symbol.includes('JPY') ? 3 : 5;
    const days = (model.toTime - model.fromTime) / 86_400_000;
    const touchText = view.touch4h === null
      ? 'sin datos'
      : `${Math.round(view.touch4h * 100)} % (${model.touchWithinBars.touched} de ${model.touchWithinBars.count})`;

    await this.alertsService.sendAlert({
      version: 'v2',
      name: 'Zona de agotamiento',
      symbol: state.symbol,
      direction: side === 1 ? 'SELL' : 'BUY',
      price,
      fusedState: fused.state,
      m5State: m5.state,
      m15State: m15.state,
      m5Elasticity: m5.elasticity,
      m15Elasticity: m15.elasticity,
      comparison,
      structure: state.lastStructureM5,
      pedestrianLight: state.pedestrianLight,
      shieldClear: !state.shieldBlocked && !state.isCompression,
      shieldExplanation: state.shieldExplanation,
      emaTarget: ema,
      atr,
      detailLines: [
        `Zona (donde terminaron los estirones pasados): p50 \`${view.q50.toFixed(decimals)}\` · p75 \`${view.q75.toFixed(decimals)}\` · p90 \`${view.q90.toFixed(decimals)}\``,
        `Si sigue estirando (los que pasaron el p75): mediana +${view.residualMedianPips.toFixed(1)} pips · p90 +${view.residualP90Pips.toFixed(1)} · máx +${view.residualMaxPips.toFixed(1)}`,
        `Volvieron a la EMA en 4 h: ${touchText} · Historial: ${model.episodes} episodios en ${days.toFixed(0)} días`,
      ],
      features: { zone: view, model },
    });
  }

  private async runFomowatchSimulation(symbol: string, currentPrice: number): Promise<void> {
    await this.refreshFomowatchSignals(symbol);
    const activeSignals = this.fomowatchSignals.get(symbol)?.signals ?? [];
    if (activeSignals.length === 0) return;

    try {
      for (const signal of [...activeSignals]) {
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

          const closedAt = new Date();
          const totalMinutesOpen = Math.max(1, Math.round(totalMinutes));
          const roundedPnl = Math.round(pnl * 10000) / 10000;

          activeSignals.splice(activeSignals.indexOf(signal), 1);
          const updated = await this.em.fork().nativeUpdate(
            PendingSignal,
            { id: signal.id, status: 'discarded_active' },
            { status: statusResult, closedAt, totalMinutesOpen, pnl: roundedPnl },
          );
          if (updated > 0) {
            console.log(`[Fomowatch] Alerta descartada #${signal.id} (${signal.symbol}) cerrada virtualmente como ${statusResult} (P&L: $${roundedPnl}, Minutos: ${totalMinutesOpen}).`);
          }
        }
      }
    } catch (err) {
      console.error('[Fomowatch] Error en bucle de simulación pasiva:', err);
    }
  }

  private async refreshFomowatchSignals(symbol: string): Promise<void> {
    const cached = this.fomowatchSignals.get(symbol);
    if (cached && Date.now() - cached.loadedAt < FOMOWATCH_REFRESH_MS) return;
    if (this.fomowatchLoading.has(symbol)) return;
    this.fomowatchLoading.add(symbol);
    try {
      const rows = await this.em.fork().find(PendingSignal, { symbol, status: 'discarded_active' });
      this.fomowatchSignals.set(symbol, {
        loadedAt: Date.now(),
        signals: rows.map((r) => ({
          id: r.id,
          symbol: r.symbol,
          direction: r.direction,
          status: r.status,
          entryPrice: Number(r.entryPrice),
          tpPrice: Number(r.tpPrice),
          slPrice: Number(r.slPrice),
          openedAt: new Date(r.openedAt),
        })),
      });
    } catch (err) {
      console.error('[Fomowatch] Error leyendo alertas descartadas:', err);
    } finally {
      this.fomowatchLoading.delete(symbol);
    }
  }

  private recordDroppedTick(reason: string) {
    this.serverMetrics.droppedTicksTotal++;
    this.dropsInCurrentMinute++;
    this.serverMetrics.lastDroppedTickAt = Date.now();
  }
}
