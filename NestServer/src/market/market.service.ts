import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { EventEmitter } from 'events';
import https from 'https';
import http from 'http';
import { TwelveDataClient } from './twelveDataClient';
import { CandleBuilder } from './candleBuilder';
import { calculateSnapshot, resolveMultiTF, calculateElasticityForCandles, pushPercentileHistory } from './marketEngine';
import type { BackendMessage, Candle, MarketSnapshot, MarketState, FusedStateResult, BacktestResult } from './types';
import { runBacktest } from './backtestEngine';
import { compareSignalWithHistory } from './compareSignal';
import { fuseMarketState } from './fuseMarketState';

const HISTORY_OUTPUT = 500;

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
  private readonly exhaustedKeys = new Set<string>();
  private readonly activeAssignments = new Map<string, string>();
  private readonly keyStats = new Map<string, {
    totalRequests: number;
    requestTimestamps: number[];
    minutelyMax: number;
  }>();

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

  constructor() {
    this.symbolList = this.symbol.split(',').map((s) => s.trim());
    this.apiKeyList = this.apiKey.split(',').map((k) => k.trim());

    // Iniciar intervalo de métricas
    this.metricsInterval = setInterval(() => {
      this.serverMetrics.droppedTicksPerMinute = this.dropsInCurrentMinute;
      this.serverMetrics.maxDelay = 0;
      this.dropsInCurrentMinute = 0;
    }, 60000);
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
  // Domingo  : 7:30 PM – 11:30 PM COT (19:30 – 23:30)
  // Lun–Jue  : 7:00 AM – 10:00 PM COT (07:00 – 22:00)
  // Viernes  : 7:00 AM – 12:00 PM COT (07:00 – 12:00)
  // Sábado   : Siempre cerrado
  // NOTA: Usamos COT (UTC-5) explícitamente para que funcione igual en
  //       servidores en la nube (Render/UTC) y en máquina local.
  private isOperationalTime(): boolean {
    // Calcular hora actual en COT (UTC-5) de forma explícita y portable
    const ahoraUTC = Date.now();
    const COT_OFFSET_MS = -5 * 60 * 60 * 1000; // UTC-5
    const ahoraCOT = new Date(ahoraUTC + COT_OFFSET_MS);

    const dia  = ahoraCOT.getUTCDay();     // 0=Dom, 1=Lun, ..., 6=Sáb en COT
    const hora = ahoraCOT.getUTCHours();   // Hora en COT
    const min  = ahoraCOT.getUTCMinutes(); // Minutos en COT

    // Domingo: sesión apertura de mercado
    if (dia === 0) {
      const inicio = hora > 19 || (hora === 19 && min >= 30);
      const fin   = hora < 23 || (hora === 23 && min < 30);
      return inicio && fin;
    }

    // Lunes a Jueves: 7:00 AM – 10:00 PM
    if (dia >= 1 && dia <= 4) {
      return hora >= 7 && hora < 22;
    }

    // Viernes: 7:00 AM – 12:00 PM
    if (dia === 5) {
      return hora >= 7 && hora < 12;
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

          console.log(`[MarketService] [${sym}] Cargando historial M5 (500 velas)...`);
          state.historicalM5 = await this.fetchHistoricalCandles(sym, '5min', HISTORY_OUTPUT);

          await new Promise((r) => setTimeout(r, 2000));

          console.log(`[MarketService] [${sym}] Cargando historial M15 (500 velas)...`);
          state.historicalM15 = await this.fetchHistoricalCandles(sym, '15min', HISTORY_OUTPUT);

          if (state.historicalM5.length > 0) this.warmUpBuilder(sym, state.builderM5, state.historicalM5);
          if (state.historicalM15.length > 0) this.warmUpBuilder(sym, state.builderM15, state.historicalM15);

          // Calcular backtest inicial
          if (state.historicalM5.length > 0) {
            state.lastBacktestM5 = runBacktest(state.historicalM5, { emaPeriod: 100, maxBarsToRevert: 20 });
            console.log(
              `[MarketService] [${sym}] Backtest M5 inicial calculado: WinRate: ${state.lastBacktestM5.winRate}% · Señales: ${state.lastBacktestM5.totalSignals}`
            );
          }

          // Calcular snapshot inicial con último precio del historial
          if (state.historicalM5.length > 0 && state.historicalM15.length > 0) {
            const lastPrice = state.historicalM5[state.historicalM5.length - 1].close;
            const ts = state.historicalM5[state.historicalM5.length - 1].time;
            const snap5 = calculateSnapshot(sym, state.builderM5.getCandles(), lastPrice, 'M5', ts);
            const snap15 = calculateSnapshot(sym, state.builderM15.getCandles(), lastPrice, 'M15', ts);

            if (snap5 && snap15) {
              state.lastSnapshotM5 = snap5;
              state.lastSnapshotM15 = snap15;
              console.log(
                `[MarketService] [${sym}] Snapshot inicial: M5: ${snap5.elasticity.toFixed(3)} ${snap5.state} · M15: ${snap15.elasticity.toFixed(3)} ${snap15.state}`
              );
            }
          }

          // Configurar manejadores de eventos de velas
          state.builderM5.on('dropped_tick', (reason: string) => this.recordDroppedTick(reason));
          state.builderM15.on('dropped_tick', (reason: string) => this.recordDroppedTick(reason));

          state.builderM5.on('candle:closed', (candle: Candle) => {
            state.historicalM5.push(candle);
            if (state.historicalM5.length > HISTORY_OUTPUT) state.historicalM5.shift();

            const el = calculateElasticityForCandles(state.builderM5.getCandles(), candle.close);
            if (el !== null) pushPercentileHistory(sym, 'M5', el);

            // Recalcular backtest M5 con la nueva vela
            state.lastBacktestM5 = runBacktest(state.historicalM5, { emaPeriod: 100, maxBarsToRevert: 20 });
            console.log(
              `[MarketService] [${sym}] Vela M5 cerrada. Backtest M5 recalculado: WinRate: ${state.lastBacktestM5.winRate}%`
            );
          });

          state.builderM15.on('candle:closed', (candle: Candle) => {
            state.historicalM15.push(candle);
            if (state.historicalM15.length > HISTORY_OUTPUT) state.historicalM15.shift();

            const el = calculateElasticityForCandles(state.builderM15.getCandles(), candle.close);
            if (el !== null) pushPercentileHistory(sym, 'M15', el);
          });

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
        client.on('key-exhausted', (exhaustedKey: string) => {
          console.warn(`[MarketService] [${sym}] Llave agotada: ...${exhaustedKey.slice(-6)}. Rotando...`);
          const newKey = this.getAvailableApiKey(sym, exhaustedKey);
          client.updateApiKey(newKey);
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
        message: 'Sistema dormido fuera de horario operativo (Dom 7:30PM–11:30PM · Lun–Jue 7AM–10PM · Vie 7AM–12PM COT)',
      } satisfies BackendMessage);

    } else if (!operational && !this.engineRunning) {
      if (Math.random() < 0.05) {
        console.log('[MarketService] Sistema dormido fuera de horario operativo...');
      }
    }
  }

  // ─── Gestión Dinámica de API Keys (Pool de 32 llaves) ────────────────────────
  private getAvailableApiKey(symbol: string, currentExhaustedKey?: string): string {
    if (currentExhaustedKey) {
      this.exhaustedKeys.add(currentExhaustedKey);
      console.log(`[MarketService] Llave ...${currentExhaustedKey.slice(-6)} marcada como agotada.`);
      this.broadcastKeysStatus();
    }

    // Llaves ya asignadas a otros símbolos (excluir la del símbolo actual)
    const assignedToOthers = new Set(this.activeAssignments.values());
    const myCurrentKey = this.activeAssignments.get(symbol);
    if (myCurrentKey) assignedToOthers.delete(myCurrentKey);

    // 1. Buscar primera llave libre (no agotada, no asignada a otro símbolo)
    for (const key of this.apiKeyList) {
      if (!this.exhaustedKeys.has(key) && !assignedToOthers.has(key)) {
        this.activeAssignments.set(symbol, key);
        console.log(`[MarketService] [${symbol}] Llave activa asignada: ...${key.slice(-6)}`);
        this.broadcastKeysStatus();
        return key;
      }
    }

    // 2. Fallback: llave no agotada aunque compartida temporalmente
    for (const key of this.apiKeyList) {
      if (!this.exhaustedKeys.has(key)) {
        this.activeAssignments.set(symbol, key);
        console.warn(`[MarketService] [${symbol}] ⚠️ Llave compartida ...${key.slice(-6)} (escasez temporal)`);
        this.broadcastKeysStatus();
        return key;
      }
    }

    // 3. Fallback absoluto (todas agotadas — situación crítica)
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
    const now = Date.now();
    const assignmentsList = this.symbolList.map(sym => {
      const activeKey = this.activeAssignments.get(sym);
      const activeKeyMasked = activeKey ? `...${activeKey.slice(-6)}` : 'Ninguna';
      
      let status: 'active' | 'shared' | 'exhausted' = 'active';
      if (this.exhaustedKeys.size === this.apiKeyList.length) {
        status = 'exhausted';
      } else if (activeKey) {
        if (this.exhaustedKeys.has(activeKey)) {
          status = 'exhausted';
        } else {
          // Compartida
          const sharingSymbolsCount = Array.from(this.activeAssignments.values()).filter(k => k === activeKey).length;
          if (sharingSymbolsCount > 1) {
            status = 'shared';
          }
        }
      }

      // Obtener estadísticas de la llave
      let totalRequests = 0;
      let minutelyRate = 0;
      let minutelyMax = 0;

      if (activeKey && this.keyStats.has(activeKey)) {
        const stats = this.keyStats.get(activeKey)!;
        // Limpiar expirados al consultar
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

    return {
      type: 'keys-status',
      totalKeys: this.apiKeyList.length,
      exhaustedKeysCount: this.exhaustedKeys.size,
      allExhausted: this.exhaustedKeys.size === this.apiKeyList.length,
      assignments: assignmentsList
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

        list.push({
          type: 'snapshot',
          symbol: state.symbol,
          m5: state.lastSnapshotM5,
          m15: state.lastSnapshotM15,
          finalState,
          fusedState: fusedStateResult.state,
          fusedExplanation: fusedStateResult.explanation,
          fusedComparison: comparison,
          backtest: state.lastBacktestM5,
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
    return new Promise((resolve) => {
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
                console.error(`[History] [${symbol}] Error ${interval} de TwelveData:`, data.message || data);
                resolve([]);
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
    candles.forEach((c) => {
      builder.injectHistoricalCandle(c);
      const elasticity = calculateElasticityForCandles(builder.getCandles(), c.close);
      if (elasticity !== null) {
        pushPercentileHistory(symbol, builder.getTimeframe(), elasticity);
      }
    });
    console.log(
      `[WarmUp] [${symbol}] ${builder.getTimeframe()} precalentado con ${candles.length} velas (percentiles listos)`
    );
  }

  // ─── Procesamiento de ticks ───────────────────────────────────────────────────
  private processTick(symbol: string, price: number, timestamp: number): void {
    const state = this.symbolStates.get(symbol);
    if (!state) return;

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

    // Broadcast a través de eventos
    this.events.emit('broadcast', {
      type: 'snapshot',
      symbol,
      m5: snapshotM5,
      m15: snapshotM15,
      finalState,
      fusedState: fusedStateResult.state,
      fusedExplanation: fusedStateResult.explanation,
      fusedComparison: comparison,
      backtest: state.lastBacktestM5,
    } satisfies BackendMessage);

    // Alerta de Telegram autónoma
    this.checkAndSendTelegramAlert(state, fusedStateResult, finalState, snapshotM5, snapshotM15);

    if (Math.random() < 0.05) {
      console.log(
        `[Engine] [${symbol}] ${new Date(timestamp).toLocaleTimeString()}`,
        `· ${price.toFixed(5)}`,
        `· M5: ${snapshotM5.elasticity.toFixed(3)} ${snapshotM5.state}`,
        `· M15: ${snapshotM15.elasticity.toFixed(3)} ${snapshotM15.state}`,
        `· Final: ${finalState} · Fused: ${fusedStateResult.state}`
      );
    }
  }

  private async checkAndSendTelegramAlert(
    state: SymbolState,
    fused: FusedStateResult,
    finalState: MarketState,
    m5: MarketSnapshot,
    m15: MarketSnapshot
  ): Promise<void> {
    const now = Date.now();
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
      console.warn('[Telegram-Service] No se pudo enviar alerta autónoma: Faltan credenciales en el .env');
      state.previousFusedState = fused.state;
      state.previousFinalState = finalState;
      return;
    }

    // 🟢 Caso 1: Alerta Tipo A (Señal Confirmada e Históricamente Sólida)
    const isNewFusedGreen = state.previousFusedState !== 'GREEN' && fused.state === 'GREEN';
    const canAlertA = now - state.lastTelegramAlertTimeA > 300000; // 5 min cooldown

    if (isNewFusedGreen && canAlertA) {
      state.lastTelegramAlertTimeA = now;
      const message = `[⚙️ BACKEND - Autónomo] ${state.symbol}: 🟢 ALERTA CONFIRMADA (Tipo A - Alta Probabilidad)\n\n${fused.explanation}\n\nM5: ${m5.elasticity.toFixed(2)} | M15: ${m15.elasticity.toFixed(2)}`;
      const url = `https://api.telegram.org/bot${token}/sendMessage`;

      try {
        await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text: message }),
        });
        console.log(`[Telegram-Service] [${state.symbol}] Alerta Tipo A (Confirmada) enviada con éxito`);
      } catch (err) {
        console.error(`[Telegram-Service] [${state.symbol}] Error enviando alerta Tipo A:`, err);
      }
    }

    // 🟡 Caso 2: Alerta Tipo B (Señal en Tiempo Real, pero sin confirmación del backtest)
    const isNewFinalGreen = state.previousFinalState !== 'GREEN' && finalState === 'GREEN';
    const canAlertB = now - state.lastTelegramAlertTimeB > 300000; // 5 min cooldown

    if (isNewFinalGreen && fused.state !== 'GREEN' && canAlertB) {
      state.lastTelegramAlertTimeB = now;
      const message = `[⚙️ BACKEND - Autónomo] ${state.symbol}: 🟡 ALERTA TIEMPO REAL (Tipo B - Moderada Probabilidad)\n\nEl precio se encuentra sobre-estirado en el corto plazo (finalState: GREEN), pero no superó el porcentaje mínimo del backtest histórico.\n\nM5: ${m5.elasticity.toFixed(2)} | M15: ${m15.elasticity.toFixed(2)}`;
      const url = `https://api.telegram.org/bot${token}/sendMessage`;

      try {
        await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text: message }),
        });
        console.log(`[Telegram-Service] [${state.symbol}] Alerta Tipo B (Tiempo Real) enviada con éxito`);
      } catch (err) {
        console.error(`[Telegram-Service] [${state.symbol}] Error enviando alerta Tipo B:`, err);
      }
    }

    state.previousFusedState = fused.state;
    state.previousFinalState = finalState;
  }

  private recordDroppedTick(reason: string) {
    this.serverMetrics.droppedTicksTotal++;
    this.dropsInCurrentMinute++;
    this.serverMetrics.lastDroppedTickAt = Date.now();
  }
}
