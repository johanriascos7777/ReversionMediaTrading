/**
 * geometryClassifier.ts
 *
 * Funciones puras para clasificar la geometría interna de una
 * zona de consolidación y determinar el sesgo direccional.
 *
 * Usa regresión lineal de highs y lows para detectar patrones:
 * triángulos, banderas, cuñas, rectángulos.
 *
 * La función clave es `assessReversalAlignment()`: cruza el sesgo
 * geométrico con la posición del precio vs EMA100 para determinar
 * si la geometría favorece la reversión a la media o la continuación.
 */

import type { Candle } from '../market/types';
import type {
  ConsolidationZone,
  ConsolidationPattern,
  BreakoutBias,
  GeometryResult,
  ReversalAlignment,
  ConsolidationConfig,
} from './consolidation.types';

// ═══════════════════════════════════════════════════════════════════════════════
// Regresión Lineal Simple (sin dependencias externas)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calcula regresión lineal: y = slope * x + intercept
 *
 * @param y Array de valores. x se asume como [0, 1, 2, ..., n-1]
 * @returns slope, intercept, r2 (coeficiente de determinación)
 */
export function linearRegression(y: number[]): {
  slope: number;
  intercept: number;
  r2: number;
} {
  const n = y.length;
  if (n < 2) return { slope: 0, intercept: y[0] ?? 0, r2: 0 };

  // Sumas usando fórmulas cerradas para x = [0, 1, ..., n-1]
  const sumX  = (n * (n - 1)) / 2;
  const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;
  const sumY  = y.reduce((s, v) => s + v, 0);
  const sumXY = y.reduce((s, v, i) => s + i * v, 0);

  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return { slope: 0, intercept: sumY / n, r2: 0 };

  const slope     = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;

  // R² = 1 - SS_res / SS_tot
  const yMean = sumY / n;
  let ssRes = 0;
  let ssTot = 0;
  for (let i = 0; i < n; i++) {
    const predicted = slope * i + intercept;
    ssRes += (y[i] - predicted) ** 2;
    ssTot += (y[i] - yMean) ** 2;
  }
  const r2 = ssTot === 0 ? 0 : Math.max(0, 1 - ssRes / ssTot);

  return { slope, intercept, r2 };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Clasificador de Geometría
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Clasifica la geometría interna de una zona de consolidación.
 *
 * Calcula la regresión lineal de los highs y lows de las velas
 * dentro de la zona, normaliza las pendientes por ATR, y clasifica
 * el patrón resultante.
 *
 * @param candles Array completo de velas
 * @param zone    Zona de consolidación detectada
 * @param atr     ATR14 actual (para normalizar pendientes)
 * @param price   Precio actual
 * @param ema100  EMA100 actual (para determinar si el patrón es
 *                bandera alcista o bajista según la tendencia)
 * @param config  Configuración (thresholds de pendiente)
 */
export function classifyGeometry(
  candles: Candle[],
  zone: ConsolidationZone,
  atr: number,
  price: number,
  ema100: number,
  config: ConsolidationConfig,
): GeometryResult {
  // Extraer highs y lows de la zona
  const highs: number[] = [];
  const lows:  number[] = [];

  for (let i = zone.startIndex; i <= zone.endIndex; i++) {
    highs.push(candles[i].high);
    lows.push(candles[i].low);
  }

  // Regresión lineal
  const upperReg = linearRegression(highs);
  const lowerReg = linearRegression(lows);

  // Normalizar pendientes por ATR (hacerlas comparables entre pares)
  const normUpper = atr > 0 ? upperReg.slope / atr : 0;
  const normLower = atr > 0 ? lowerReg.slope / atr : 0;

  const slopeConvergence = normUpper - normLower; // negativo = convergen

  // Clasificar patrón
  const { pattern, breakoutBias } = classifyPattern(
    normUpper, normLower,
    price, ema100,
    config.flatThreshold, config.slopeThreshold,
  );

  // Calcular confidence
  const confidence = calculateConfidence(
    upperReg.r2, lowerReg.r2,
    zone.duration, pattern,
  );

  return {
    pattern,
    breakoutBias,
    upperSlope:       upperReg.slope,
    lowerSlope:       lowerReg.slope,
    slopeConvergence,
    r2Upper:          upperReg.r2,
    r2Lower:          lowerReg.r2,
    confidence,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Clasificación de Patrón (lógica interna)
// ═══════════════════════════════════════════════════════════════════════════════

function classifyPattern(
  normUpper: number,
  normLower: number,
  price: number,
  ema100: number,
  flatThreshold: number,
  slopeThreshold: number,
): { pattern: ConsolidationPattern; breakoutBias: BreakoutBias } {
  const upperFlat = Math.abs(normUpper) < flatThreshold;
  const lowerFlat = Math.abs(normLower) < flatThreshold;
  const upperDown = normUpper < -slopeThreshold;
  const upperUp   = normUpper > slopeThreshold;
  const lowerUp   = normLower > slopeThreshold;
  const lowerDown = normLower < -slopeThreshold;

  const isAboveEma = price > ema100;

  // ─── Triángulo Ascendente: highs planos + lows subiendo ─────────────────
  if (upperFlat && lowerUp) {
    return { pattern: 'ascending_triangle', breakoutBias: 'bullish' };
  }

  // ─── Triángulo Descendente: highs bajando + lows planos ────────────────
  if (upperDown && lowerFlat) {
    return { pattern: 'descending_triangle', breakoutBias: 'bearish' };
  }

  // ─── Rectángulo: ambos planos ──────────────────────────────────────────
  if (upperFlat && lowerFlat) {
    return { pattern: 'rectangle', breakoutBias: 'neutral' };
  }

  // ─── Banderas: ambos en la misma dirección ─────────────────────────────
  // Bandera alcista (bull flag): retroceso bajista dentro de tendencia alcista
  if (upperDown && lowerDown) {
    if (isAboveEma) {
      // Precio arriba de EMA + pendiente bajista = pullback en tendencia alcista
      return { pattern: 'bull_flag', breakoutBias: 'bullish' };
    } else {
      // Precio abajo de EMA + pendiente bajista = continuación bajista
      return { pattern: 'bear_flag', breakoutBias: 'bearish' };
    }
  }

  if (upperUp && lowerUp) {
    if (!isAboveEma) {
      // Precio abajo de EMA + pendiente alcista = rebote en tendencia bajista
      return { pattern: 'bear_flag', breakoutBias: 'bearish' };
    } else {
      // Precio arriba de EMA + pendiente alcista = continuación alcista
      return { pattern: 'bull_flag', breakoutBias: 'bullish' };
    }
  }

  // ─── Cuña Contractiva: boundaries convergen ────────────────────────────
  if (upperDown && lowerUp) {
    return { pattern: 'contracting_wedge', breakoutBias: 'neutral' };
  }

  // ─── Cuña Expansiva: boundaries divergen ───────────────────────────────
  if (upperUp && lowerDown) {
    return { pattern: 'expanding_wedge', breakoutBias: 'neutral' };
  }

  // ─── Default ───────────────────────────────────────────────────────────
  return { pattern: 'unclassified', breakoutBias: 'neutral' };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Confidence Score
// ═══════════════════════════════════════════════════════════════════════════════

function calculateConfidence(
  r2Upper: number,
  r2Lower: number,
  duration: number,
  pattern: ConsolidationPattern,
): number {
  // Calidad del fit (60% del score)
  const fitScore = ((r2Upper + r2Lower) / 2) * 60;

  // Duración suficiente (25% del score) — satura en 12 velas
  const durationScore = Math.min(duration / 12, 1) * 25;

  // Patrón reconocido (15%)
  const patternScore = pattern !== 'unclassified' ? 15 : 0;

  return Math.min(100, Math.round(fitScore + durationScore + patternScore));
}

// ═══════════════════════════════════════════════════════════════════════════════
// Alineación con Reversión a la Media (LA FUNCIÓN CLAVE)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Determina si la geometría de la consolidación favorece la reversión
 * a la media (hacia la EMA100) o la continuación (lejos de la EMA100).
 *
 * Ejemplo:
 * - Precio ENCIMA de EMA100 → la reversión es bajista (necesita bajar)
 *   → Si breakoutBias = 'bearish' → ALIGNED (geometría favorece reversión)
 *   → Si breakoutBias = 'bullish' → OPPOSED (geometría contra la reversión)
 *
 * - Precio DEBAJO de EMA100 → la reversión es alcista (necesita subir)
 *   → Si breakoutBias = 'bullish' → ALIGNED
 *   → Si breakoutBias = 'bearish' → OPPOSED
 */
export function assessReversalAlignment(
  breakoutBias: BreakoutBias,
  price: number,
  ema100: number,
): ReversalAlignment {
  if (breakoutBias === 'neutral') return 'neutral';

  // ¿Qué dirección necesita la reversión?
  const reversalDirection: BreakoutBias = price > ema100 ? 'bearish' : 'bullish';

  if (breakoutBias === reversalDirection) return 'aligned';
  return 'opposed';
}

// ═══════════════════════════════════════════════════════════════════════════════
// Función orquestadora de alto nivel
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Función de conveniencia que ejecuta clasificación + alineación en un solo paso.
 */
export function classifyAndAlign(
  candles: Candle[],
  zone: ConsolidationZone,
  atr: number,
  price: number,
  ema100: number,
  config: ConsolidationConfig,
): { geometry: GeometryResult; alignment: ReversalAlignment } {
  const geometry  = classifyGeometry(candles, zone, atr, price, ema100, config);
  const alignment = assessReversalAlignment(geometry.breakoutBias, price, ema100);
  return { geometry, alignment };
}
