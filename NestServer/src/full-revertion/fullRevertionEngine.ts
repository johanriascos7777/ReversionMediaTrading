/**
 * fullRevertionEngine.ts
 *
 * Motor matemático del módulo Full Reversion.
 * 100% funciones puras, sin estado global, sin dependencias de NestJS.
 *
 * Diferencias clave frente al motor de elasticidad estándar:
 *   1. Calcula la PENDIENTE de la EMA100 (slope) en unidades de ATR.
 *   2. Bloquea señales cuando la pendiente es STEEP (tendencia fuerte).
 *   3. Backtest con ventana más amplia (50 barras por defecto).
 *   4. "Win" se cuenta solo cuando el precio CIERRA al otro lado de la EMA,
 *      no cuando simplemente la toca — esto distingue reversiones reales
 *      de simples pullbacks.
 */

import type { Candle } from '../market/types';
import type {
  EMASlope,
  SlopeDirection,
  FRState,
  FullRevertionSnapshot,
  FullRevertionBacktestResult,
  FRBacktestEvent,
} from './fullRevertion.types';

// ─── Constantes ───────────────────────────────────────────────────────────────

const EMA_PERIOD       = 100;
const ATR_PERIOD       = 14;
const SLOPE_LOOKBACK   = 10;   // barras hacia atrás para medir el movimiento de la EMA
const SLOPE_FLAT_ATR   = 0.5;  // |slopeATRUnits| < 0.5  → FLAT
const SLOPE_GENTLE_ATR = 1.0;  // |slopeATRUnits| < 1.0  → GENTLE, >= 1.0 = STEEP
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

/**
 * Calcula la serie de EMA para un array de cierres, devuelve array de misma longitud.
 * Útil para calcular el slope en cualquier punto histórico.
 */
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

/**
 * Calcula la pendiente de la EMA100 en el punto actual.
 *
 * La pendiente se mide como la diferencia entre la EMA100 actual
 * y la EMA100 hace SLOPE_LOOKBACK barras, normalizada por el ATR.
 *
 * Retorna el valor en "unidades ATR por SLOPE_LOOKBACK barras".
 * Ej: 0.8 significa que la EMA se ha movido 0.8 ATR en las últimas 10 barras.
 */
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

// ─── Percentile Engine (ventana deslizante, sin estado global) ────────────────

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

// Mapa de instancias por símbolo+timeframe (estado en memoria del proceso)
const percentileMap = new Map<string, FullRevertionPercentileEngine>();

function getPercentileEngine(symbol: string, timeframe: 'M5' | 'M15'): FullRevertionPercentileEngine {
  const key = `fr:${symbol}:${timeframe}`;
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

export function clearFullRevertionPercentile(symbol: string, timeframe: 'M5' | 'M15'): void {
  getPercentileEngine(symbol, timeframe).clear();
}

// ─── State Resolver ───────────────────────────────────────────────────────────

function resolveState(elasticity: number, percentile: number): FRState {
  if (percentile >= PERCENTILE_GREEN) return 'GREEN';
  if (percentile >= PERCENTILE_YELLOW) return 'YELLOW';
  return 'RED';
}

// ─── Snapshot en Tiempo Real ─────────────────────────────────────────────────

/**
 * Calcula el snapshot Full Reversion para el precio actual.
 * Devuelve null si no hay suficientes velas para calcular EMA100 + slope.
 */
export function calculateFullRevertionSnapshot(
  symbol:    string,
  candles:   Candle[],
  price:     number,
  timeframe: 'M5' | 'M15',
  timestamp: number
): FullRevertionSnapshot | null {
  // Necesitamos EMA_PERIOD + SLOPE_LOOKBACK + ATR_PERIOD barras mínimo
  if (candles.length < EMA_PERIOD + SLOPE_LOOKBACK + 2) return null;

  const closes  = candles.map(c => c.close);
  const ema100  = calculateEMA(closes, EMA_PERIOD);
  const atr     = calculateATR(candles, ATR_PERIOD);
  if (atr === 0) return null;

  const elasticity = Math.abs(price - ema100) / atr;

  // Calcular serie EMA completa para medir slope
  const emaSeries   = calculateEMASeries(closes, EMA_PERIOD);
  const lastEMAIdx  = closes.length - 1;
  const slopeResult = calculateEMASlope(emaSeries, lastEMAIdx, atr);

  const signalAllowed = slopeResult.slope !== 'STEEP';

  const engine    = getPercentileEngine(symbol, timeframe);
  const percentile = engine.rank(elasticity);
  const state     = resolveState(elasticity, percentile);

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
  };
}

// ─── Backtest Full Reversion ─────────────────────────────────────────────────

/**
 * Backtest del motor Full Reversion sobre un array de velas históricas.
 *
 * Diferencia fundamental frente al backtest estándar:
 * - "Win" = el precio CIERRA al otro lado de la EMA (cruce completo), no solo la toca.
 * - Se registra si la señal hubiera sido bloqueada por pendiente STEEP.
 * - Ventana por defecto: 50 barras (≈ 4 horas en M5).
 */
export function runFullRevertionBacktest(
  candles:          Candle[],
  maxBarsToRevert:  number = 50
): FullRevertionBacktestResult {
  const events: FRBacktestEvent[] = [];

  // Necesitamos suficientes velas
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

  // Calcular la serie EMA completa de una sola vez (eficiente)
  const closes    = candles.map(c => c.close);
  const emaSeries = calculateEMASeries(closes, EMA_PERIOD);

  const localPercentile = new FullRevertionPercentileEngine(200);

  for (let i = EMA_PERIOD + SLOPE_LOOKBACK; i < candles.length - maxBarsToRevert; i++) {
    const candle = candles[i];

    // ATR14 rolling en el punto i
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

    // Solo nos interesan los momentos donde había señal GREEN
    if (state !== 'GREEN') continue;

    // Calcular pendiente en este punto histórico
    const slopeResult    = calculateEMASlope(emaSeries, i, atr);
    const blockedBySlope = slopeResult.slope === 'STEEP';

    // Buscar cruce completo: precio CIERRA al otro lado de la EMA
    let reverted = false;
    const isAboveEMA = candle.close > ema;

    for (let j = 1; j <= maxBarsToRevert && i + j < candles.length; j++) {
      const future = candles[i + j];
      const futureEMA = emaSeries[i + j];

      // Cruce completo: el cierre de la futura vela cruza la EMA
      // (no solo el low/high como en el backtest estándar)
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

  // ─── Métricas ─────────────────────────────────────────────────────────────

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
