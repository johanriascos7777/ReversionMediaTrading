import type { Candle, BacktestConfig, MarketState } from './types';

export type BacktestEventExp = {
  entryIndex:   number;
  exitIndex:    number;   // -1 si no revirtió (loss)
  barsToRevert: number;
  state:        MarketState;
  elasticity:   number;
  direction:    'BUY' | 'SELL';
};

export type BacktestResultExp = {
  totalSignals:    number;
  wins:            number;
  winRate:         number;
  avgBarsToRevert: number;
  events:          BacktestEventExp[];
};

// ─── Percentile Engine Local para Backtesting Experimental ───────────────────
class LocalPercentileEngine {
  private buffer: number[] = [];
  private windowSize: number;

  constructor(windowSize = 200) {
    this.windowSize = windowSize;
  }

  push(value: number): number {
    this.buffer.push(value);

    if (this.buffer.length > this.windowSize) {
      this.buffer.shift();
    }

    if (this.buffer.length === 1) return 0;

    const sorted = [...this.buffer].sort((a, b) => a - b);
    const index = sorted.findIndex((v) => v >= value);

    if (index === -1) return 100;

    return Math.round((index / (sorted.length - 1)) * 100);
  }
}

// ─── Funciones Auxiliares ───────────────────────────────────────────────────
function calculateElasticity(price: number, ema100: number, atr: number): number {
  if (atr <= 0) return 0;
  return Math.abs(price - ema100) / atr;
}

function resolveElasticityState(elasticity: number, percentile: number): MarketState {
  // Coincide con la lógica del backend tradicional pero con topes dinámicos experimentales
  if (percentile >= 80 && elasticity >= 1.0 && elasticity <= 10.0) {
    return 'GREEN';
  }
  if (percentile >= 60) {
    return 'YELLOW';
  }
  return 'RED';
}

// ─── Función Principal de Backtesting Experimental (EMA Exponencial Real) ─────
export function runBacktestExp(
  candles: Candle[],
  config: BacktestConfig
): BacktestResultExp {
  const percentileEngine = new LocalPercentileEngine(200);
  const events: BacktestEventExp[] = [];

  if (candles.length < config.emaPeriod) {
    return { totalSignals: 0, wins: 0, winRate: 0, avgBarsToRevert: 0, events: [] };
  }

  // Pre-calcular la EMA100 exponencial real para todas las velas
  const alpha = 2 / (config.emaPeriod + 1);
  const emas: number[] = new Array(candles.length).fill(0);
  
  // Semilla inicial usando SMA del primer periodo
  let currentEma = candles.slice(0, config.emaPeriod).reduce((sum, c) => sum + c.close, 0) / config.emaPeriod;
  emas[config.emaPeriod - 1] = currentEma;

  for (let i = config.emaPeriod; i < candles.length; i++) {
    currentEma = alpha * candles[i].close + (1 - alpha) * currentEma;
    emas[i] = currentEma;
  }

  // Bucle de simulación para recopilar eventos
  for (let i = config.emaPeriod; i < candles.length; i++) {
    const candle = candles[i];
    const ema = emas[i];

    // ATR14 rolling
    const atrStart = Math.max(1, i - 13);
    let atrSum = 0;
    let atrCount = 0;
    for (let k = atrStart; k <= i; k++) {
      const prev = candles[k - 1].close;
      const tr = Math.max(
        candles[k].high - candles[k].low,
        Math.abs(candles[k].high - prev),
        Math.abs(candles[k].low - prev)
      );
      atrSum += tr;
      atrCount++;
    }
    const atr = atrCount > 0 ? atrSum / atrCount : 0.0001;

    // Elasticidad y Percentil
    const elasticity = calculateElasticity(candle.close, ema, atr);
    const percentile = percentileEngine.push(elasticity);
    const state = resolveElasticityState(elasticity, percentile);

    if (state !== 'GREEN') continue;

    // Determinar la dirección de la sobre-extensión
    const direction: 'BUY' | 'SELL' = candle.close < ema ? 'BUY' : 'SELL';

    // Buscar reversión en las siguientes `maxBarsToRevert` velas
    let reverted = false;

    for (
      let j = 1;
      j <= config.maxBarsToRevert && i + j < candles.length;
      j++
    ) {
      const future = candles[i + j];
      const futureEma = emas[i + j];

      const revertedDown = direction === 'SELL' && future.low <= futureEma;
      const revertedUp = direction === 'BUY' && future.high >= futureEma;

      if (revertedDown || revertedUp) {
        events.push({
          entryIndex: i,
          exitIndex: i + j,
          barsToRevert: j,
          state,
          elasticity,
          direction,
        });
        reverted = true;
        break;
      }
    }

    if (!reverted) {
      events.push({
        entryIndex: i,
        exitIndex: -1,
        barsToRevert: config.maxBarsToRevert,
        state,
        elasticity,
        direction,
      });
    }
  }

  const wins = events.filter((e) => e.exitIndex !== -1);
  const totalSignals = events.length;

  return {
    totalSignals,
    wins: wins.length,
    winRate:
      totalSignals === 0
        ? 0
        : Math.round((wins.length / totalSignals) * 100),
    avgBarsToRevert:
      wins.length === 0
        ? 0
        : Math.round(
            wins.reduce((s, e) => s + e.barsToRevert, 0) / wins.length
          ),
    events,
  };
}
