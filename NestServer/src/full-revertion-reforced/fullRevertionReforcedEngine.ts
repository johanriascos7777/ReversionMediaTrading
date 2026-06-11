/**
 * fullRevertionReforcedEngine.ts
 *
 * Motor matemático para Full Reversion Reinforced.
 * Incluye EMA50, Stochastic (13,3,3) y CCI (14).
 */

import type { Candle } from '../market/types';
import type {
  EMASlope,
  SlopeDirection,
  FRState,
  FullRevertionReforcedSnapshot,
  FullRevertionReforcedBacktestResult,
  FRBacktestEvent,
} from './fullRevertionReforced.types';

// ─── Constantes ───────────────────────────────────────────────────────────────

const EMA_PERIOD       = 100;
const ATR_PERIOD       = 14;
const SLOPE_LOOKBACK   = 10;
const SLOPE_FLAT_ATR   = 0.5;
const SLOPE_GENTLE_ATR = 1.0;
const PERCENTILE_GREEN  = 80;
const PERCENTILE_YELLOW = 60;

// ─── EMA (Exponential Moving Average) ────────────────────────────────────────

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

function calculateEMASeries(closes: number[], period: number): number[] {
  const result: number[] = new Array(closes.length).fill(0);
  if (closes.length < period) return result;

  const alpha = 2 / (period + 1);
  result[period - 1] = closes.slice(0, period).reduce((s, v) => s + v, 0) / period;

  for (let i = period; i < closes.length; i++) {
    result[i] = alpha * closes[i] + (1 - alpha) * result[i - 1];
  }
  return result;
}

// ─── ATR (Average True Range) ─────────────────────────────────────────────────

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

// ─── EMA Slope Calculator ──────────────────────────────────────────────────────

function calculateEMASlope(
  emaSeries: number[],
  currentIndex: number,
  atr: number
): { value: number; slope: EMASlope; direction: SlopeDirection } {
  const lookback = Math.min(SLOPE_LOOKBACK, currentIndex);
  const pastIndex = currentIndex - lookback;

  if (emaSeries[pastIndex] === 0 || atr === 0) {
    return { value: 0, slope: 'FLAT', direction: 'FLAT' };
  }

  const delta = emaSeries[currentIndex] - emaSeries[pastIndex];
  const slopeATRUnits = delta / atr;
  const absSlopeATRUnits = Math.abs(slopeATRUnits);

  let slope: EMASlope;
  if (absSlopeATRUnits < SLOPE_FLAT_ATR) {
    slope = 'FLAT';
  } else if (absSlopeATRUnits < SLOPE_GENTLE_ATR) {
    slope = 'GENTLE';
  } else {
    slope = 'STEEP';
  }

  let direction: SlopeDirection;
  if (Math.abs(slopeATRUnits) < 0.05) {
    direction = 'FLAT';
  } else if (slopeATRUnits > 0) {
    direction = 'UP';
  } else {
    direction = 'DOWN';
  }

  return { value: slopeATRUnits, slope, direction };
}

// ─── Stochastic & CCI Oscillators ──────────────────────────────────────────

export function calculateStochastic(
  candles: Candle[],
  kPeriod: number = 13,
  dPeriod: number = 3,
  slowing: number = 3
): { k: number; d: number } {
  if (candles.length < kPeriod + dPeriod + slowing) {
    return { k: 50, d: 50 };
  }

  const rawK: number[] = [];
  for (let i = candles.length - (dPeriod + slowing + 5); i < candles.length; i++) {
    const slice = candles.slice(i - kPeriod + 1, i + 1);
    if (slice.length < kPeriod) continue;
    const lows = slice.map(c => c.low);
    const highs = slice.map(c => c.high);
    const lowestLow = Math.min(...lows);
    const highestHigh = Math.max(...highs);
    const currentClose = candles[i].close;
    const range = highestHigh - lowestLow;
    const kVal = range === 0 ? 50 : ((currentClose - lowestLow) / range) * 100;
    rawK.push(kVal);
  }

  const smoothedK: number[] = [];
  for (let i = slowing - 1; i < rawK.length; i++) {
    const sum = rawK.slice(i - slowing + 1, i + 1).reduce((s, v) => s + v, 0);
    smoothedK.push(sum / slowing);
  }

  if (smoothedK.length < dPeriod) {
    return { k: 50, d: 50 };
  }
  const lastK = smoothedK[smoothedK.length - 1];
  const lastD = smoothedK.slice(-dPeriod).reduce((s, v) => s + v, 0) / dPeriod;

  return { k: lastK, d: lastD };
}

export function calculateCCI(candles: Candle[], period: number = 14): number {
  if (candles.length < period) return 0;

  const typicalPrices = candles.map(c => (c.high + c.low + c.close) / 3);
  const lastTPs = typicalPrices.slice(-period);
  const smaTP = lastTPs.reduce((s, v) => s + v, 0) / period;

  const meanDevSum = lastTPs.reduce((sum, tp) => sum + Math.abs(tp - smaTP), 0);
  const meanDeviation = meanDevSum / period;

  if (meanDeviation === 0) return 0;

  const currentTP = typicalPrices[typicalPrices.length - 1];
  const cci = (currentTP - smaTP) / (0.015 * meanDeviation);
  return cci;
}

// ─── Percentile Engine ────────────────────────────────────────────────────────

export class FullRevertionPercentileEngine {
  private window: number[] = [];
  private readonly maxSize: number;

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

const percentileMap = new Map<string, FullRevertionPercentileEngine>();

function getPercentileEngine(symbol: string, timeframe: 'M5' | 'M15'): FullRevertionPercentileEngine {
  const key = `fr-reforced:${symbol}:${timeframe}`;
  let engine = percentileMap.get(key);
  if (!engine) {
    engine = new FullRevertionPercentileEngine(200);
    percentileMap.set(key, engine);
  }
  return engine;
}

export function pushFullRevertionPercentile(symbol: string, timeframe: 'M5' | 'M15', elasticity: number): void {
  getPercentileEngine(symbol, timeframe).push(elasticity);
}

function resolveState(elasticity: number, percentile: number): FRState {
  if (percentile >= PERCENTILE_GREEN) return 'GREEN';
  if (percentile >= PERCENTILE_YELLOW) return 'YELLOW';
  return 'RED';
}

// ─── Snapshot en Tiempo Real ─────────────────────────────────────────────────

export function calculateFullRevertionSnapshot(
  symbol:    string,
  candles:   Candle[],
  price:     number,
  timeframe: 'M5' | 'M15',
  timestamp: number
): FullRevertionReforcedSnapshot | null {
  if (candles.length < EMA_PERIOD + SLOPE_LOOKBACK + 2) return null;

  const closes  = candles.map(c => c.close);
  const ema100  = calculateEMA(closes, EMA_PERIOD);
  const ema50   = calculateEMA(closes, 50);
  const atr     = calculateATR(candles, ATR_PERIOD);
  if (atr === 0) return null;

  const elasticity = Math.abs(price - ema100) / atr;
  const elasticity50 = Math.abs(price - ema50) / atr;

  const emaSeries   = calculateEMASeries(closes, EMA_PERIOD);
  const lastEMAIdx  = closes.length - 1;
  const slopeResult = calculateEMASlope(emaSeries, lastEMAIdx, atr);

  const signalAllowed = slopeResult.slope !== 'STEEP';

  const engine    = getPercentileEngine(symbol, timeframe);
  const percentile = engine.rank(elasticity);
  const state     = resolveState(elasticity, percentile);

  // Calcular Osciladores
  const stoch = calculateStochastic(candles, 13, 3, 3);
  const cciVal = calculateCCI(candles, 14);

  return {
    symbol,
    timeframe,
    price,
    ema100,
    atr,
    elasticity,
    percentile,
    state,
    emaSlope:       slopeResult.slope,
    emaSlopeValue:  slopeResult.value,
    slopeDirection: slopeResult.direction,
    signalAllowed,
    timestamp,
    ema50,
    elasticity50,
    stochK:         stoch.k,
    stochD:         stoch.d,
    cci:            cciVal,
  };
}

// ─── Backtest ────────────────────────────────────────────────────────────────

export function runFullRevertionBacktest(
  candles:          Candle[],
  maxBarsToRevert:  number = 50
): FullRevertionReforcedBacktestResult {
  const events: FRBacktestEvent[] = [];

  const minCandles = EMA_PERIOD + SLOPE_LOOKBACK + maxBarsToRevert + 5;
  if (candles.length < minCandles) {
    return {
      totalSignals:    0,
      allowedSignals:  0,
      wins:            0,
      winRate:         0,
      filteredBySlope: 0,
      avgBarsToRevert: 0,
      events:          [],
    };
  }

  const closes = candles.map(c => c.close);
  const emaSeries = calculateEMASeries(closes, EMA_PERIOD);

  const localPercentile = new FullRevertionPercentileEngine(200);

  for (let i = EMA_PERIOD + SLOPE_LOOKBACK; i < candles.length - maxBarsToRevert; i++) {
    const candle = candles[i];

    const atrStart = Math.max(1, i - ATR_PERIOD + 1);
    let atrSum = 0, atrCount = 0;
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
    if (atr === 0) continue;

    const ema      = emaSeries[i];
    const elasticity = Math.abs(candle.close - ema) / atr;

    localPercentile.push(elasticity);
    const percentile = localPercentile.rank(elasticity);
    const state      = resolveState(elasticity, percentile);

    if (state !== 'GREEN') continue;

    const slopeResult    = calculateEMASlope(emaSeries, i, atr);
    const blockedBySlope = slopeResult.slope === 'STEEP';

    let reverted = false;
    const isAboveEMA = candle.close > ema;

    for (let j = 1; j <= maxBarsToRevert && i + j < candles.length; j++) {
      const future = candles[i + j];
      const futureEMA = emaSeries[i + j];

      const crossedDown = isAboveEMA  && future.close < futureEMA;
      const crossedUp   = !isAboveEMA && future.close > futureEMA;

      if (crossedDown || crossedUp) {
        events.push({
          entryIndex:     i,
          exitIndex:      i + j,
          barsToRevert:   j,
          elasticity,
          emaSlope:       slopeResult.slope,
          slopeValue:     slopeResult.value,
          blockedBySlope,
        });
        reverted = true;
        break;
      }
    }

    if (!reverted) {
      events.push({
        entryIndex:     i,
        exitIndex:      -1,
        barsToRevert:   maxBarsToRevert,
        elasticity,
        emaSlope:       slopeResult.slope,
        slopeValue:     slopeResult.value,
        blockedBySlope,
      });
    }
  }

  const totalSignals    = events.length;
  const filteredBySlope = events.filter(e => e.blockedBySlope).length;
  const allowedEvents   = events.filter(e => !e.blockedBySlope);
  const allowedSignals  = allowedEvents.length;
  const wins            = allowedEvents.filter(e => e.exitIndex !== -1);

  return {
    totalSignals,
    allowedSignals,
    wins:            wins.length,
    winRate:         allowedSignals === 0 ? 0 : Math.round((wins.length / allowedSignals) * 100),
    filteredBySlope,
    avgBarsToRevert: wins.length === 0 ? 0 : Math.round(wins.reduce((s, e) => s + e.barsToRevert, 0) / wins.length),
    events,
  };
}
