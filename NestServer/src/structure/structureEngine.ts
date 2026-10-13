/**
 * structureEngine.ts
 *
 * Motor de Confluencia y Estructura de Mercado.
 * Calcula RSI, EMA200, niveles S/R dinámicos y divergencias
 * para generar señales de mayor precisión en zonas clave.
 *
 * ─── Sin dependencias del motor de elasticidad ───────────────────────────────
 * Corre en paralelo. Puede compararse con el sistema actual.
 */

import type { Candle } from '../market/types';
import type {
  StructureSnapshot,
  StructureState,
  SignalDirection,
  DivergenceType,
  TrendDirection,
  SRLevel,
} from './structure.types';

// ─── EMA ─────────────────────────────────────────────────────────────────────

function calculateEMA(closes: number[], period: number): number {
  if (closes.length === 0) return 0;
  if (closes.length <= period) return closes[closes.length - 1];

  const alpha = 2 / (period + 1);
  let ema = closes.slice(0, period).reduce((s, v) => s + v, 0) / period;

  for (let i = period; i < closes.length; i++) {
    ema = alpha * closes[i] + (1 - alpha) * ema;
  }
  return ema;
}

// ─── ATR ─────────────────────────────────────────────────────────────────────

function calculateATR(candles: Candle[], period = 14): number {
  if (candles.length < 2) return 0.0006;

  const trs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const { high, low } = candles[i];
    const prev = candles[i - 1].close;
    trs.push(Math.max(high - low, Math.abs(high - prev), Math.abs(low - prev)));
  }

  const slice = trs.slice(-period);
  return slice.reduce((s, v) => s + v, 0) / slice.length;
}

// ─── RSI ─────────────────────────────────────────────────────────────────────

function calculateRSI(candles: Candle[], period = 14): number {
  if (candles.length < period + 1) return 50;

  const closes = candles.map(c => c.close);
  let gains = 0;
  let losses = 0;

  // Initial average from the last `period` changes
  const start = closes.length - period;
  for (let i = start; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }

  if (losses === 0) return 100;
  const rs = (gains / period) / (losses / period);
  return Math.round((100 - 100 / (1 + rs)) * 10) / 10;
}

// ─── EMA200 Slope ─────────────────────────────────────────────────────────────

/**
 * Calcula la dirección de la EMA200 comparando su valor actual
 * con el de hace `lookback` velas, normalizado por ATR.
 */
function calculateEMA200Slope(
  candles: Candle[],
  atr: number,
  lookback = 5
): TrendDirection {
  if (candles.length < 205) return 'flat';

  const closes = candles.map(c => c.close);
  const emaNow  = calculateEMA(closes, 200);
  const emaPast = calculateEMA(closes.slice(0, -lookback), 200);
  const delta   = (emaNow - emaPast) / atr;

  if (delta > 0.05) return 'up';
  if (delta < -0.05) return 'down';
  return 'flat';
}

// ─── Soporte / Resistencia Dinámicos ─────────────────────────────────────────

/**
 * Detecta swing highs y swing lows en las últimas `lookback` velas.
 * Agrupa niveles cercanos (dentro de `tolerance` ATR) en un único nivel.
 * Retorna los niveles ordenados por cercanía al precio actual.
 */
function detectSRLevels(
  candles: Candle[],
  currentPrice: number,
  atr: number
): SRLevel[] {
  const lookback = Math.min(120, candles.length);
  const slice    = candles.slice(-lookback);
  const confirm  = 2; // velas a cada lado para confirmar swing

  const swingHighs: number[] = [];
  const swingLows:  number[] = [];

  for (let i = confirm; i < slice.length - confirm; i++) {
    const h = slice[i].high;
    const l = slice[i].low;

    const isSwingHigh = Array.from({ length: confirm }, (_, k) => k + 1).every(
      k => h > slice[i - k].high && h > slice[i + k].high
    );
    const isSwingLow = Array.from({ length: confirm }, (_, k) => k + 1).every(
      k => l < slice[i - k].low && l < slice[i + k].low
    );

    if (isSwingHigh) swingHighs.push(h);
    if (isSwingLow)  swingLows.push(l);
  }

  const tolerance = atr * 0.35;

  const clusterLevels = (prices: number[]): { price: number; strength: number }[] => {
    if (prices.length === 0) return [];
    const sorted = [...prices].sort((a, b) => a - b);
    const clusters: number[][] = [[sorted[0]]];

    for (let i = 1; i < sorted.length; i++) {
      const last = clusters[clusters.length - 1];
      const avg  = last.reduce((s, v) => s + v, 0) / last.length;
      if (sorted[i] - avg <= tolerance) last.push(sorted[i]);
      else clusters.push([sorted[i]]);
    }

    return clusters.map(c => ({
      price:    Math.round((c.reduce((s, v) => s + v, 0) / c.length) * 100000) / 100000,
      strength: Math.min(4, c.length),
    }));
  };

  const levels: SRLevel[] = [];

  clusterLevels(swingHighs).forEach(({ price, strength }) => {
    levels.push({
      price,
      type:     'resistance',
      strength,
      distance: Math.abs(price - currentPrice) / atr,
    });
  });

  clusterLevels(swingLows).forEach(({ price, strength }) => {
    levels.push({
      price,
      type:     'support',
      strength,
      distance: Math.abs(price - currentPrice) / atr,
    });
  });

  return levels.sort((a, b) => a.distance - b.distance).slice(0, 8);
}

// ─── Divergencia RSI ──────────────────────────────────────────────────────────

/**
 * Detecta divergencias simples comparando el RSI actual con el RSI
 * de hace N velas usando la pendiente de precio vs RSI.
 */
function detectDivergence(
  candles: Candle[],
  rsiNow: number,
  lookback = 10
): DivergenceType {
  if (candles.length < lookback + 15) return 'none';

  const past = candles.slice(-lookback - 1, -1);   // velas hace `lookback`
  const rsiPast = calculateRSI(past, 14);

  const priceNow  = candles[candles.length - 1].close;
  const pricePast = past[past.length - 1].close;

  const priceUp = priceNow > pricePast;
  const rsiUp   = rsiNow  > rsiPast;

  // Divergencia bajista: precio sube pero RSI baja
  if (priceUp && !rsiUp && rsiNow > 55 && (rsiPast - rsiNow) > 3)  return 'bearish';
  // Divergencia alcista: precio baja pero RSI sube
  if (!priceUp && rsiUp && rsiNow < 45 && (rsiNow - rsiPast) > 3)  return 'bullish';

  return 'none';
}

// ─── Double Top / Bottom ─────────────────────────────────────────────────────

/**
 * Detecta patrones recientes de Doble Techo o Doble Piso.
 * Si los últimos dos swing highs/lows están en el mismo nivel, es un patrón doble.
 */
function detectDoublePattern(
  candles: Candle[],
  atr: number
): 'double_top' | 'double_bottom' | 'none' {
  const lookback = Math.min(60, candles.length);
  const slice    = candles.slice(-lookback);
  const confirm  = 2;

  const swingHighs: number[] = [];
  const swingLows:  number[] = [];

  for (let i = confirm; i < slice.length - confirm; i++) {
    const h = slice[i].high;
    const l = slice[i].low;

    const isSwingHigh = Array.from({ length: confirm }, (_, k) => k + 1).every(
      k => h > slice[i - k].high && h > slice[i + k].high
    );
    const isSwingLow = Array.from({ length: confirm }, (_, k) => k + 1).every(
      k => l < slice[i - k].low && l < slice[i + k].low
    );

    if (isSwingHigh) swingHighs.push(h);
    if (isSwingLow)  swingLows.push(l);
  }

  const tolerance = atr * 0.25;

  if (swingHighs.length >= 2) {
    const last1 = swingHighs[swingHighs.length - 1];
    const last2 = swingHighs[swingHighs.length - 2];
    if (Math.abs(last1 - last2) <= tolerance) {
      return 'double_top';
    }
  }

  if (swingLows.length >= 2) {
    const last1 = swingLows[swingLows.length - 1];
    const last2 = swingLows[swingLows.length - 2];
    if (Math.abs(last1 - last2) <= tolerance) {
      return 'double_bottom';
    }
  }

  return 'none';
}

// ─── Clasificador de Señal ────────────────────────────────────────────────────

function resolveStructureSignal(
  rsi:         number,
  nearestSR:   SRLevel | null,
  divergence:  DivergenceType,
  slope:       TrendDirection,
  priceAbove:  boolean          // true = precio sobre EMA200
): { state: StructureState; signal: SignalDirection; confluences: string[] } {

  const confluences: string[] = [];
  let sellScore = 0;
  let buyScore  = 0;

  // ── RSI extremes ──────────────────────────────────────────────────────────
  if (rsi >= 75)      { sellScore += 3; confluences.push(`RSI sobrecomprado (${rsi})`); }
  else if (rsi >= 70) { sellScore += 2; confluences.push(`RSI elevado (${rsi})`); }
  else if (rsi <= 25) { buyScore  += 3; confluences.push(`RSI sobrevendido (${rsi})`); }
  else if (rsi <= 30) { buyScore  += 2; confluences.push(`RSI deprimido (${rsi})`); }

  // ── Nivel S/R próximo ─────────────────────────────────────────────────────
  if (nearestSR && nearestSR.distance <= 0.5) {
    const label = nearestSR.type === 'resistance' ? 'resistencia' : 'soporte';
    const bonus  = nearestSR.strength >= 3 ? 3 : nearestSR.strength >= 2 ? 2 : 1;

    if (nearestSR.type === 'resistance') {
      sellScore += bonus;
      confluences.push(`En ${label} (${nearestSR.price.toFixed(5)}, fuerza ${nearestSR.strength})`);
    } else {
      buyScore  += bonus;
      confluences.push(`En ${label} (${nearestSR.price.toFixed(5)}, fuerza ${nearestSR.strength})`);
    }
  } else if (nearestSR && nearestSR.distance <= 1.2) {
    const label = nearestSR.type === 'resistance' ? 'resistencia' : 'soporte';
    if (nearestSR.type === 'resistance') sellScore += 1;
    else buyScore += 1;
    confluences.push(`Cerca de ${label} (${nearestSR.price.toFixed(5)}, ${nearestSR.distance.toFixed(1)} ATR)`);
  }

  // ── Divergencia ───────────────────────────────────────────────────────────
  if (divergence === 'bearish') { sellScore += 3; confluences.push('Divergencia bajista RSI'); }
  if (divergence === 'bullish') { buyScore  += 3; confluences.push('Divergencia alcista RSI'); }

  // ── EMA200 slope & side ───────────────────────────────────────────────────
  if (priceAbove && slope === 'down') {
    sellScore += 1;
    confluences.push('Precio sobre EMA200, tendencia bajando');
  } else if (!priceAbove && slope === 'up') {
    buyScore  += 1;
    confluences.push('Precio bajo EMA200, tendencia subiendo');
  }

  // ── Resolve ───────────────────────────────────────────────────────────────
  const dominantScore = Math.max(sellScore, buyScore);
  const signal: SignalDirection = sellScore > buyScore ? 'SELL'
                                : buyScore > sellScore ? 'BUY'
                                : 'WAIT';

  let state: StructureState;
  if (dominantScore >= 6)      state = 'STRONG';
  else if (dominantScore >= 3) state = 'MODERATE';
  else                         state = 'WEAK';

  return { state, signal, confluences };
}

// ─── Punto de entrada público ─────────────────────────────────────────────────

export function calculateStructureSnapshot(
  symbol:    string,
  candles:   Candle[],
  price:     number,
  timeframe: 'M5' | 'M15',
  timestamp: number
): StructureSnapshot | null {

  // EMA200 necesita al menos 205 velas para cálculo estable
  if (candles.length < 210) return null;

  const closes       = candles.map(c => c.close);
  const atr          = calculateATR(candles, 14);
  const ema50        = calculateEMA(closes, 50);
  const ema100       = calculateEMA(closes, 100);
  const ema200       = calculateEMA(closes, 200);
  const ema200Slope  = calculateEMA200Slope(candles, atr);
  const priceAbove   = price > ema200;
  const rsi          = calculateRSI(candles, 14);

  // Filtro de Compresión: Sándwich de EMAs
  const isCompressionSandwich = Math.abs(ema50 - ema100) / atr < 0.5;
  const doublePattern = detectDoublePattern(candles, atr);

  const rsiZone = rsi >= 70 ? 'overbought'
                : rsi <= 30 ? 'oversold'
                : 'neutral';

  const divergence = detectDivergence(candles, rsi);
  const srLevels   = detectSRLevels(candles, price, atr);
  const nearestSR  = srLevels.length > 0 ? srLevels[0] : null;

  const { state, signal, confluences } = resolveStructureSignal(
    rsi, nearestSR, divergence, ema200Slope, priceAbove
  );

  if (isCompressionSandwich) {
    confluences.push('Sándwich EMA50-100 (Compresión)');
  }
  if (doublePattern === 'double_top') {
    confluences.push('Doble Techo Reciente');
  } else if (doublePattern === 'double_bottom') {
    confluences.push('Doble Piso Reciente');
  }

  // Texto de explicación para el frontend
  let explanation: string;
  if (state === 'STRONG') {
    explanation = `Confluencia FUERTE (${confluences.length} factores): ${confluences.join(' · ')}`;
  } else if (state === 'MODERATE') {
    explanation = `Confluencia MODERADA: ${confluences.join(' · ')}`;
  } else {
    explanation = confluences.length > 0
      ? `Señal DÉBIL — ${confluences.join(', ')}`
      : `Sin confluencias. RSI: ${rsi} · EMA200 tendencia: ${ema200Slope}.`;
  }

  return {
    type:          'structure-snapshot',
    symbol,
    timeframe,
    price,
    rsi,
    rsiZone,
    ema50,
    ema100,
    ema200,
    ema200Slope,
    priceVsEma200: priceAbove ? 'above' : 'below',
    isCompressionSandwich,
    doublePattern,
    divergence,
    srLevels,
    nearestSR,
    confluences,
    structureState: state,
    signal,
    explanation,
    timestamp,
  };
}
