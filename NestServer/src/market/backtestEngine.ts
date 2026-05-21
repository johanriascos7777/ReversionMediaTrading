import type { Candle, BacktestConfig, BacktestResult, BacktestEvent, MarketState } from './types';

// ─── Percentile Engine Local para Backtesting ───────────────────────────────

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

// ─── Funciones Auxiliares del Motor ─────────────────────────────────────────

function calculateElasticity(price: number, ema100: number, atr: number): number {
  if (atr <= 0) return 0;
  return Math.abs(price - ema100) / atr;
}

function resolveElasticityState(elasticity: number, percentile: number): MarketState {
  if (percentile >= 80 && elasticity <= 10.0) {
    return 'GREEN';
  }
  if (percentile >= 60) {
    return 'YELLOW';
  }
  return 'RED';
}

// ─── Función Principal de Backtesting ───────────────────────────────────────

export function runBacktest(
  candles: Candle[],
  config: BacktestConfig
): BacktestResult {
  const percentileEngine = new LocalPercentileEngine(200);
  const events: BacktestEvent[] = [];

  for (let i = config.emaPeriod; i < candles.length; i++) {
    const candle = candles[i];

    // 1️⃣ EMA simple sobre las últimas `emaPeriod` velas
    const slice = candles.slice(i - config.emaPeriod, i);
    const ema = slice.reduce((sum, c) => sum + c.close, 0) / config.emaPeriod;

    // 2️⃣ ATR14 rolling
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

    // 3️⃣ Elasticidad
    const elasticity = calculateElasticity(candle.close, ema, atr);

    // 4️⃣ Percentil
    const percentile = percentileEngine.push(elasticity);

    // 5️⃣ Estado
    const state = resolveElasticityState(elasticity, percentile);

    // Solo registramos eventos cuando habría habido señal GREEN
    if (state !== 'GREEN') continue;

    // 6️⃣ Buscar reversión en las siguientes `maxBarsToRevert` velas
    let reverted = false;

    for (
      let j = 1;
      j <= config.maxBarsToRevert && i + j < candles.length;
      j++
    ) {
      const future = candles[i + j];

      const revertedDown = candle.close > ema && future.low <= ema;
      const revertedUp = candle.close < ema && future.high >= ema;

      if (revertedDown || revertedUp) {
        events.push({
          entryIndex: i,
          exitIndex: i + j,
          barsToRevert: j,
          state,
          elasticity,
        });
        reverted = true;
        break;
      }
    }

    // Si no revirtió dentro del límite → loss (exitIndex = -1)
    if (!reverted) {
      events.push({
        entryIndex: i,
        exitIndex: -1,
        barsToRevert: config.maxBarsToRevert,
        state,
        elasticity,
      });
    }
  }

  // 📊 Métricas finales
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
