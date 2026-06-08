import type { Candle, MarketState, MarketSnapshot, Timeframe } from './types';

const EMA_PERIOD = 100;
const ATR_PERIOD = 14;

let config = {
  percentileGreen:  80,
  percentileYellow: 60,
  elasticityMin:    1.0,
  elasticityMax:    10.0,
};

// ─── EMA ─────────────────────────────────────────────────────────────────────
function calculateEMA(closes: number[], period: number): number {
  if (closes.length === 0) return 0;
  if (closes.length < period) return closes[closes.length - 1];

  const alpha = 2 / (period + 1);
  let ema = closes.slice(0, period).reduce((s, v) => s + v, 0) / period;

  for (let i = period; i < closes.length; i++) {
    ema = alpha * closes[i] + (1 - alpha) * ema;
  }

  return ema;
}

// ─── ATR ─────────────────────────────────────────────────────────────────────
function calculateATR(candles: Candle[], period: number): number {
  if (candles.length < 2) return 0.0006;

  const trues: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const { high, low } = candles[i];
    const prev = candles[i - 1].close;
    trues.push(Math.max(high - low, Math.abs(high - prev), Math.abs(low - prev)));
  }

  const slice = trues.slice(-period);
  return slice.reduce((s, v) => s + v, 0) / slice.length;
}

// ─── Percentile Engine (Ventana Deslizante Experimental Aislada) ──────────────
class PercentileEngineExp {
  private window: number[] = [];
  private maxSize: number;

  constructor(maxSize = 200) {
    this.maxSize = maxSize;
  }

  push(value: number): void {
    this.window.push(value);
    if (this.window.length > this.maxSize) this.window.shift();
  }

  rank(value: number): number {
    if (this.window.length === 0) return 50;
    const sorted = [...this.window].sort((a, b) => a - b);
    const rank = sorted.filter(v => v <= value).length;
    return (rank / this.window.length) * 100;
  }

  clear(): void {
    this.window = [];
  }
}

const percentileM5MapExp = new Map<string, PercentileEngineExp>();
const percentileM15MapExp = new Map<string, PercentileEngineExp>();

function getPercentileEngineExp(symbol: string, timeframe: Timeframe): PercentileEngineExp {
  const map = timeframe === 'M5' ? percentileM5MapExp : percentileM15MapExp;
  let engine = map.get(symbol);
  if (!engine) {
    engine = new PercentileEngineExp(200);
    map.set(symbol, engine);
  }
  return engine;
}

// ─── State resolution ─────────────────────────────────────────────────────────
function resolveStateExp(elasticity: number, percentile: number): MarketState {
  if (
    percentile >= config.percentileGreen &&
    elasticity >= config.elasticityMin &&
    elasticity <= config.elasticityMax
  ) {
    return 'GREEN';
  }

  if (percentile >= config.percentileYellow) return 'YELLOW';

  return 'RED';
}

// ─── Exported Functions ──────────────────────────────────────────────────────
export function calculateElasticityForCandlesExp(candles: Candle[], price: number): number | null {
  if (candles.length < EMA_PERIOD + 2) return null;

  const closes = candles.map(c => c.close);
  const ema100 = calculateEMA(closes, EMA_PERIOD);
  const atr = calculateATR(candles, ATR_PERIOD);

  if (atr === 0) return null;

  return Math.abs(price - ema100) / atr;
}

export function clearPercentileHistoryExp(symbol: string, timeframe: Timeframe): void {
  getPercentileEngineExp(symbol, timeframe).clear();
}

export function pushPercentileHistoryExp(symbol: string, timeframe: Timeframe, elasticity: number): void {
  getPercentileEngineExp(symbol, timeframe).push(elasticity);
}

export function calculateSnapshotExp(
  symbol:    string,
  candles:   Candle[],
  price:     number,
  timeframe: Timeframe,
  timestamp: number
): (MarketSnapshot & { direction: 'BUY' | 'SELL' }) | null {
  const elasticity = calculateElasticityForCandlesExp(candles, price);
  if (elasticity === null) return null;

  const closes = candles.map(c => c.close);
  const ema100 = calculateEMA(closes, EMA_PERIOD);
  const atr = calculateATR(candles, ATR_PERIOD);

  const percentileEngine = getPercentileEngineExp(symbol, timeframe);
  const percentile = percentileEngine.rank(elasticity);

  const state = resolveStateExp(elasticity, percentile);

  // Detección de la dirección del estiramiento
  const direction: 'BUY' | 'SELL' = price < ema100 ? 'BUY' : 'SELL';

  return {
    timeframe,
    price,
    ema100,
    atr,
    elasticity,
    percentile,
    state,
    timestamp,
    direction,
  };
}

export function resolveMultiTFExp(
  m5:  MarketSnapshot,
  m15: MarketSnapshot
): MarketState {
  if (m5.state === 'GREEN' && m15.state === 'GREEN') return 'GREEN';
  if (m5.state === 'GREEN' && m15.state === 'YELLOW') return 'YELLOW';
  return 'RED';
}
