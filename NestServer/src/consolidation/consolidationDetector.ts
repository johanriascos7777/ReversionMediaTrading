/**
 * consolidationDetector.ts
 *
 * Funciones puras para detectar zonas de consolidación del precio.
 * Sin estado, sin dependencias de NestJS — puramente computacional.
 *
 * Una "consolidación" es un rango de velas consecutivas donde:
 * 1. El rango total (max high - min low) es < maxRangeATR × ATR14
 * 2. La zona tiene al menos `minDuration` velas
 * 3. El precio estaba estirado de la EMA100 (elasticidad en GREEN o YELLOW)
 *
 * El detector mira hacia atrás desde una vela dada y busca el inicio
 * de la zona de consolidación.
 */

import type { Candle } from '../market/types';
import type { ConsolidationZone, ConsolidationConfig } from './consolidation.types';

// ═══════════════════════════════════════════════════════════════════════════════
// ATR14 local (igual que en los engines existentes)
// ═══════════════════════════════════════════════════════════════════════════════

export function calculateATR(candles: Candle[], index: number, period: number = 14): number {
  const start = Math.max(1, index - period + 1);
  let sum = 0;
  let count = 0;

  for (let k = start; k <= index; k++) {
    const prev = candles[k - 1].close;
    const tr = Math.max(
      candles[k].high - candles[k].low,
      Math.abs(candles[k].high - prev),
      Math.abs(candles[k].low - prev),
    );
    sum += tr;
    count++;
  }

  return count > 0 ? sum / count : 0.0001;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EMA calculada localmente (para backtest sin depender del percentile engine)
// ═══════════════════════════════════════════════════════════════════════════════

export function calculateEMA(candles: Candle[], period: number): number[] {
  const emas = new Array<number>(candles.length).fill(0);
  if (candles.length < period) return emas;

  // Semilla: SMA del primer periodo
  let currentEma = 0;
  for (let i = 0; i < period; i++) {
    currentEma += candles[i].close;
  }
  currentEma /= period;
  emas[period - 1] = currentEma;

  const alpha = 2 / (period + 1);
  for (let i = period; i < candles.length; i++) {
    currentEma = alpha * candles[i].close + (1 - alpha) * currentEma;
    emas[i] = currentEma;
  }

  return emas;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Detector de consolidación
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Detecta si hay una zona de consolidación que termina en `currentIndex`.
 *
 * El algoritmo mira hacia atrás desde currentIndex y busca el rango de
 * velas más largo cuyo rango total (max high - min low) no excede
 * maxRangeATR × ATR14.
 *
 * @returns ConsolidationZone si se detecta, null si no hay consolidación
 */
export function detectConsolidation(
  candles: Candle[],
  currentIndex: number,
  atr: number,
  config: ConsolidationConfig,
): ConsolidationZone | null {
  if (currentIndex < config.lookback || atr <= 0) return null;

  const maxRange = config.maxRangeATR * atr;

  // Empezar desde la vela actual e ir hacia atrás buscando el rango máximo
  let high = candles[currentIndex].high;
  let low  = candles[currentIndex].low;
  let startIndex = currentIndex;

  for (let i = currentIndex - 1; i >= Math.max(0, currentIndex - config.lookback); i--) {
    const candidateHigh = Math.max(high, candles[i].high);
    const candidateLow  = Math.min(low, candles[i].low);
    const candidateRange = candidateHigh - candidateLow;

    if (candidateRange > maxRange) {
      // Esta vela rompe el rango — la consolidación empieza en la siguiente
      break;
    }

    // Verificar si esta vela es una vela de impulso (cuerpo muy grande)
    const body = Math.abs(candles[i].close - candles[i].open);
    if (body > 0.8 * (candidateHigh - candidateLow) && body > 0.5 * atr) {
      // Vela de impulso que inició el movimiento — consolidación empieza después
      break;
    }

    high = candidateHigh;
    low  = candidateLow;
    startIndex = i;
  }

  const duration = currentIndex - startIndex + 1;

  // Verificar duración mínima
  if (duration < config.minDuration) return null;

  const range = high - low;

  return {
    startIndex,
    endIndex:   currentIndex,
    upperBound: high,
    lowerBound: low,
    duration,
    range,
    rangeATR:   range / atr,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Función combinada: detectar + contexto de elasticidad
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Detecta consolidación solo si el precio está estirado de la EMA100.
 * Esto evita buscar consolidaciones en rangos normales (RED) donde
 * no hay señal de reversión pendiente.
 *
 * @param elasticity Elasticidad actual del precio respecto a la EMA100
 * @param percentile Percentil de la elasticidad actual
 */
export function detectConsolidationWithContext(
  candles: Candle[],
  currentIndex: number,
  atr: number,
  elasticity: number,
  percentile: number,
  config: ConsolidationConfig,
): ConsolidationZone | null {
  // Solo buscar consolidaciones cuando hay estiramiento significativo
  // Percentil ≥ 60 = YELLOW o GREEN (hay sobreextensión)
  if (percentile < 60) return null;

  return detectConsolidation(candles, currentIndex, atr, config);
}
