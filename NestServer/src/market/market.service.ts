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

@Injectable()
export class MarketService implements OnModuleInit, OnModuleDestroy {
  public readonly events = new EventEmitter();

  // Configuración
  private readonly apiKey = process.env.TWELVE_DATA_API_KEY ?? '';
  private readonly symbol = process.env.TWELVE_DATA_SYMBOL ?? 'EUR/USD';

  // Builders y estado
  private readonly builderM5 = new CandleBuilder('M5');
  private readonly builderM15 = new CandleBuilder('M15');

  private lastSnapshotM5: MarketSnapshot | null = null;
  private lastSnapshotM15: MarketSnapshot | null = null;

  private historicalM5: Candle[] = [];
  private historicalM15: Candle[] = [];

  private twelveClient: TwelveDataClient | null = null;

  // Backtesting y Fusión de Señal (Fase 2)
  private lastBacktestM5: BacktestResult | null = null;
  private previousFusedState: MarketState | null = null;
  private previousFinalState: MarketState | null = null;
  private lastTelegramAlertTimeA = 0;
  private lastTelegramAlertTimeB = 0;

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
    console.log(`║   Symbol: ${this.symbol}                    ║`);
    console.log('╚════════════════════════════════════╝');

    // 1. Cargar historial para pre-calentar
    console.log('[MarketService] Cargando historial M5 (500 velas)...');
    this.historicalM5 = await this.fetchHistoricalCandles('5min', HISTORY_OUTPUT);

    await new Promise((r) => setTimeout(r, 2000)); // pausa entre llamadas REST

    console.log('[MarketService] Cargando historial M15 (500 velas)...');
    this.historicalM15 = await this.fetchHistoricalCandles('15min', HISTORY_OUTPUT);

    if (this.historicalM5.length > 0) this.warmUpBuilder(this.builderM5, this.historicalM5);
    if (this.historicalM15.length > 0) this.warmUpBuilder(this.builderM15, this.historicalM15);

    // Calcular backtest inicial
    if (this.historicalM5.length > 0) {
      this.lastBacktestM5 = runBacktest(this.historicalM5, { emaPeriod: 100, maxBarsToRevert: 20 });
      console.log(`[MarketService] Backtest M5 inicial calculado: WinRate: ${this.lastBacktestM5.winRate}% · Señales: ${this.lastBacktestM5.totalSignals}`);
    }

    // Calcular snapshot inicial con último precio del historial
    if (this.historicalM5.length > 0 && this.historicalM15.length > 0) {
      const lastPrice = this.historicalM5[this.historicalM5.length - 1].close;
      const ts = this.historicalM5[this.historicalM5.length - 1].time;
      const snap5 = calculateSnapshot(this.builderM5.getCandles(), lastPrice, 'M5', ts);
      const snap15 = calculateSnapshot(this.builderM15.getCandles(), lastPrice, 'M15', ts);

      if (snap5 && snap15) {
        this.lastSnapshotM5 = snap5;
        this.lastSnapshotM15 = snap15;
        console.log(
          '[MarketService] Snapshot inicial:',
          `M5: ${snap5.elasticity.toFixed(3)} ${snap5.state}`,
          `· M15: ${snap15.elasticity.toFixed(3)} ${snap15.state}`
        );
      }
    }

    // 2. Conectar Twelve Data WebSocket
    this.twelveClient = new TwelveDataClient(this.apiKey, this.symbol);

    this.twelveClient.on('tick', (price: number, timestamp: number) => this.processTick(price, timestamp));
    this.twelveClient.on('dropped_tick', (reason: string) => this.recordDroppedTick(reason));
    this.twelveClient.on('status', (status: string, message: string) => {
      this.events.emit('broadcast', {
        type: 'status',
        status: status as 'connecting' | 'connected' | 'disconnected',
        message,
      } satisfies BackendMessage);
    });

    this.twelveClient.connect();

    this.builderM5.on('dropped_tick', (reason: string) => this.recordDroppedTick(reason));
    this.builderM15.on('dropped_tick', (reason: string) => this.recordDroppedTick(reason));

    this.builderM5.on('candle:closed', (candle: Candle) => {
      this.historicalM5.push(candle);
      if (this.historicalM5.length > HISTORY_OUTPUT) {
        this.historicalM5.shift();
      }

      const el = calculateElasticityForCandles(this.builderM5.getCandles(), candle.close);
      if (el !== null) pushPercentileHistory('M5', el);

      // Recalcular backtest M5 con la nueva vela
      this.lastBacktestM5 = runBacktest(this.historicalM5, { emaPeriod: 100, maxBarsToRevert: 20 });
      console.log(
        `[MarketService] Vela M5 cerrada. Backtest M5 recalculado (Historial: ${this.historicalM5.length}):`,
        `WinRate: ${this.lastBacktestM5.winRate}% · Señales: ${this.lastBacktestM5.totalSignals}`
      );
    });

    this.builderM15.on('candle:closed', (candle: Candle) => {
      this.historicalM15.push(candle);
      if (this.historicalM15.length > HISTORY_OUTPUT) {
        this.historicalM15.shift();
      }

      const el = calculateElasticityForCandles(this.builderM15.getCandles(), candle.close);
      if (el !== null) pushPercentileHistory('M15', el);
      console.log(`[MarketService] Vela M15 cerrada — ${this.builderM15.getClosedCandles().length} velas (Historial: ${this.historicalM15.length})`);
    });
  }

  onModuleDestroy() {
    console.log('[MarketService] Deteniendo servicio...');
    if (this.metricsInterval) clearInterval(this.metricsInterval);
    if (this.twelveClient) {
      this.twelveClient.disconnect();
    }
  }

  // Retorna el último snapshot disponible
  public getLastSnapshotMessage(): BackendMessage | null {
    if (this.lastSnapshotM5 && this.lastSnapshotM15) {
      const finalState = resolveMultiTF(this.lastSnapshotM5, this.lastSnapshotM15);
      const comparison = this.lastBacktestM5
        ? compareSignalWithHistory({ state: this.lastSnapshotM5.state, elasticity: this.lastSnapshotM5.elasticity }, this.lastBacktestM5)
        : null;
      const fusedStateResult = fuseMarketState(finalState, comparison);

      return {
        type: 'snapshot',
        m5: this.lastSnapshotM5,
        m15: this.lastSnapshotM15,
        finalState,
        fusedState: fusedStateResult.state,
        fusedExplanation: fusedStateResult.explanation,
        fusedComparison: comparison,
        backtest: this.lastBacktestM5,
      };
    }
    return null;
  }

  // Retorna el historial de velas en memoria
  public getHistory(timeframe: '5min' | '15min'): Candle[] {
    return timeframe === '15min' ? this.historicalM15 : this.historicalM5;
  }

  // --- Fetch historial via REST ---
  private fetchHistoricalCandles(
    interval: '5min' | '15min',
    outputSize: number
  ): Promise<Candle[]> {
    return new Promise((resolve) => {
      const path =
        `/time_series?symbol=${encodeURIComponent(this.symbol)}` +
        `&interval=${interval}&outputsize=${outputSize}&apikey=${this.apiKey}`;

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
                console.error(`[History] Error ${interval} de TwelveData:`, data.message || data);
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
              console.error(`[History] Error parseando JSON en ${interval}:`, e);
              console.error(`[History] Respuesta cruda:`, raw.substring(0, 300));
              resolve([]);
            }
          });
        }
      );

      req.on('error', (err: Error) => {
        console.error(`[History] Error de red en request:`, err.message);
        resolve([]);
      });

      req.end();
    });
  }

  private warmUpBuilder(builder: CandleBuilder, candles: Candle[]): void {
    candles.forEach((c) => {
      builder.injectHistoricalCandle(c);
      const elasticity = calculateElasticityForCandles(builder.getCandles(), c.close);
      if (elasticity !== null) {
        pushPercentileHistory(builder.getTimeframe(), elasticity);
      }
    });
    console.log(
      `[WarmUp] ${builder.getTimeframe()} precalentado con ${candles.length} velas (percentiles listos)`
    );
  }

  // --- Procesamiento de ticks ---
  private processTick(price: number, timestamp: number): void {
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

    this.builderM5.tick(price, timestamp);
    this.builderM15.tick(price, timestamp);

    const snapshotM5 = calculateSnapshot(this.builderM5.getCandles(), price, 'M5', timestamp);
    const snapshotM15 = calculateSnapshot(this.builderM15.getCandles(), price, 'M15', timestamp);

    if (!snapshotM5 || !snapshotM15) return;

    this.lastSnapshotM5 = snapshotM5;
    this.lastSnapshotM15 = snapshotM15;

    const finalState = resolveMultiTF(snapshotM5, snapshotM15);

    const comparison = this.lastBacktestM5
      ? compareSignalWithHistory({ state: snapshotM5.state, elasticity: snapshotM5.elasticity }, this.lastBacktestM5)
      : null;
    const fusedStateResult = fuseMarketState(finalState, comparison);
    
    // Broadcast a través de eventos
    this.events.emit('broadcast', {
      type: 'snapshot',
      m5: snapshotM5,
      m15: snapshotM15,
      finalState,
      fusedState: fusedStateResult.state,
      fusedExplanation: fusedStateResult.explanation,
      fusedComparison: comparison,
      backtest: this.lastBacktestM5,
    } satisfies BackendMessage);

    // Alerta de Telegram autónoma
    this.checkAndSendTelegramAlert(fusedStateResult, finalState, snapshotM5, snapshotM15);

    if (Math.random() < 0.05) {
      console.log(
        `[Engine] ${new Date(timestamp).toLocaleTimeString()}`,
        `· ${price.toFixed(5)}`,
        `· M5: ${snapshotM5.elasticity.toFixed(3)} ${snapshotM5.state}`,
        `· M15: ${snapshotM15.elasticity.toFixed(3)} ${snapshotM15.state}`,
        `· Final: ${finalState} · Fused: ${fusedStateResult.state}`
      );
    }
  }

  private async checkAndSendTelegramAlert(
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
      this.previousFusedState = fused.state;
      this.previousFinalState = finalState;
      return;
    }

    // 🟢 Caso 1: Alerta Tipo A (Señal Confirmada e Históricamente Sólida)
    const isNewFusedGreen = this.previousFusedState !== 'GREEN' && fused.state === 'GREEN';
    const canAlertA = now - this.lastTelegramAlertTimeA > 300000; // 5 min cooldown

    if (isNewFusedGreen && canAlertA) {
      this.lastTelegramAlertTimeA = now;
      const message = `🟢 ALERTA CONFIRMADA (Tipo A - Alta Probabilidad)\n\n${fused.explanation}\n\nM5: ${m5.elasticity.toFixed(2)} | M15: ${m15.elasticity.toFixed(2)}`;
      const url = `https://api.telegram.org/bot${token}/sendMessage`;

      try {
        await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text: message }),
        });
        console.log('[Telegram-Service] Alerta Tipo A (Confirmada) enviada con éxito');
      } catch (err) {
        console.error('[Telegram-Service] Error enviando alerta Tipo A:', err);
      }
    }

    // 🟡 Caso 2: Alerta Tipo B (Señal en Tiempo Real, pero sin confirmación del backtest)
    const isNewFinalGreen = this.previousFinalState !== 'GREEN' && finalState === 'GREEN';
    const canAlertB = now - this.lastTelegramAlertTimeB > 300000; // 5 min cooldown

    if (isNewFinalGreen && fused.state !== 'GREEN' && canAlertB) {
      this.lastTelegramAlertTimeB = now;
      const message = `🟡 ALERTA TIEMPO REAL (Tipo B - Moderada Probabilidad)\n\nEl precio se encuentra sobre-estirado en el corto plazo (finalState: GREEN), pero no superó el porcentaje mínimo del backtest histórico.\n\nM5: ${m5.elasticity.toFixed(2)} | M15: ${m15.elasticity.toFixed(2)}`;
      const url = `https://api.telegram.org/bot${token}/sendMessage`;

      try {
        await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text: message }),
        });
        console.log('[Telegram-Service] Alerta Tipo B (Tiempo Real) enviada con éxito');
      } catch (err) {
        console.error('[Telegram-Service] Error enviando alerta Tipo B:', err);
      }
    }

    this.previousFusedState = fused.state;
    this.previousFinalState = finalState;
  }

  private recordDroppedTick(reason: string) {
    this.serverMetrics.droppedTicksTotal++;
    this.dropsInCurrentMinute++;
    this.serverMetrics.lastDroppedTickAt = Date.now();
  }
}
