/**
 * consolidationBacktest.ts
 *
 * Motor de backtest retroactivo para el Consolidation Geometry Analyzer.
 * Simula cuándo el clasificador habría acertado/fallado usando datos históricos.
 *
 * Función pura sin estado ni dependencias de NestJS.
 *
 * A diferencia de los backtest engines existentes (que miden si el precio
 * toca la EMA), este mide si la DIRECCIÓN DE RUPTURA de la consolidación
 * fue predicha correctamente por el clasificador geométrico.
 */

import type { Candle } from '../market/types';
import type {
  ConsolidationConfig,
  ConsolidationBacktestEvent,
  ConsolidationBacktestResult,
  ConsolidationPattern,
  ConsolidationZone,
  ReversalAlignment,
  PatternStats,
} from './consolidation.types';
import { DEFAULT_CONSOLIDATION_CONFIG } from './consolidation.types';
import { calculateATR, calculateEMA, detectConsolidation } from './consolidationDetector';
import { classifyAndAlign } from './geometryClassifier';

// ═══════════════════════════════════════════════════════════════════════════════
// Percentil Engine Local (igual que en backtestEngineExp.ts)
// ═══════════════════════════════════════════════════════════════════════════════

class LocalPercentileEngine {
  private buffer: number[] = [];
  private windowSize: number;

  constructor(windowSize = 200) {
    this.windowSize = windowSize;
  }

  push(value: number): number {
    this.buffer.push(value);
    if (this.buffer.length > this.windowSize) this.buffer.shift();
    if (this.buffer.length === 1) return 0;

    const sorted = [...this.buffer].sort((a, b) => a - b);
    const index = sorted.findIndex((v) => v >= value);
    if (index === -1) return 100;
    return Math.round((index / (sorted.length - 1)) * 100);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Backtest Principal
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Ejecuta el backtest retroactivo del Consolidation Geometry Analyzer.
 *
 * Para cada punto donde:
 * 1. La elasticidad está en GREEN (percentil ≥ 80)
 * 2. Se detecta una zona de consolidación
 * 3. La geometría se clasifica con un sesgo (no neutral)
 *
 * Mira al futuro para ver si la ruptura fue HACIA o LEJOS de la EMA100,
 * y compara con la predicción del clasificador.
 *
 * @param candles Array largo de velas históricas (5000-10000+)
 * @param config  Configuración del detector (thresholds calibrables)
 */
export function runConsolidationBacktest(
  candles: Candle[],
  config: ConsolidationConfig = DEFAULT_CONSOLIDATION_CONFIG,
  emaPeriod: number = 100,
): ConsolidationBacktestResult {
  const events: ConsolidationBacktestEvent[] = [];
  const percentileEngine = new LocalPercentileEngine(200);

  if (candles.length < emaPeriod + config.lookback + config.resolutionWindow) {
    return emptyResult();
  }

  // Pre-calcular EMA100
  const emas = calculateEMA(candles, emaPeriod);

  // Variable para evitar señales solapadas (cooldown de consolidación)
  let lastConsolidationEndIndex = -1;

  // Bucle principal: desde emaPeriod + buffer hasta len - resolutionWindow
  const startFrom = emaPeriod + config.lookback;
  const stopAt    = candles.length - config.resolutionWindow;

  for (let i = startFrom; i < stopAt; i++) {
    const candle = candles[i];
    const ema100 = emas[i];
    if (ema100 === 0) continue; // EMA aún no inicializada

    const atr = calculateATR(candles, i);
    if (atr <= 0) continue;

    // Calcular elasticidad
    const elasticity = Math.abs(candle.close - ema100) / atr;
    const percentile = percentileEngine.push(elasticity);

    // Solo analizar en GREEN (percentil ≥ 80)
    if (percentile < 80) continue;
    if (elasticity < 1.0 || elasticity > 10.0) continue;

    // Evitar señales solapadas: si la última consolidación terminó hace poco, skip
    if (i <= lastConsolidationEndIndex + 3) continue;

    // Detectar consolidación
    const zone = detectConsolidation(candles, i, atr, config);
    if (!zone) continue;

    // Clasificar geometría y alineación
    const { geometry, alignment } = classifyAndAlign(
      candles, zone, atr, candle.close, ema100, config,
    );

    // Solo registrar eventos con sesgo claro
    if (alignment === 'neutral') continue;

    // ─── MIRAR EL FUTURO: ¿Qué pasó realmente? ────────────────────────────
    const breakoutResult = resolveBreakout(
      candles, i, ema100, zone, config.resolutionWindow,
    );

    if (!breakoutResult) continue; // No hubo ruptura clara en la ventana

    // ¿El clasificador acertó?
    const correct =
      (alignment === 'aligned'  && breakoutResult.direction === 'toward_ema') ||
      (alignment === 'opposed'  && breakoutResult.direction === 'away_from_ema');

    events.push({
      entryIndex:         i,
      zoneStartIndex:     zone.startIndex,
      zoneEndIndex:       zone.endIndex,
      pattern:            geometry.pattern,
      breakoutBias:       geometry.breakoutBias,
      reversalAlignment:  alignment,
      actualBreakout:     breakoutResult.direction,
      correct,
      barsToResolution:   breakoutResult.barsToResolution,
      elasticityAtEntry:  elasticity,
      priceAtEntry:       candle.close,
      ema100AtEntry:      ema100,
    });

    // Marcar cooldown
    lastConsolidationEndIndex = zone.endIndex;
  }

  return buildResult(events);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Resolución de ruptura (mira al futuro)
// ═══════════════════════════════════════════════════════════════════════════════

function resolveBreakout(
  candles: Candle[],
  currentIndex: number,
  ema100AtEntry: number,
  zone: ConsolidationZone,
  resolutionWindow: number,
): { direction: 'toward_ema' | 'away_from_ema'; barsToResolution: number } | null {
  const isAboveEma = candles[currentIndex].close > ema100AtEntry;
  // Si precio > EMA100, la reversión sería un movimiento bajista (hacia EMA = abajo)
  // Si precio < EMA100, la reversión sería un movimiento alcista (hacia EMA = arriba)

  const upperBound = zone.upperBound;
  const lowerBound = zone.lowerBound;
  const rangePadding = (upperBound - lowerBound) * 0.3; // 30% de margen para confirmar ruptura

  for (let j = 1; j <= resolutionWindow && currentIndex + j < candles.length; j++) {
    const future   = candles[currentIndex + j];

    // Ruptura alcista: cierre por encima del boundary superior + margen
    if (future.close > upperBound + rangePadding) {
      if (isAboveEma) {
        // Precio estaba arriba de EMA y rompió UP → se alejó de la EMA
        return { direction: 'away_from_ema', barsToResolution: j };
      } else {
        // Precio estaba debajo de EMA y rompió UP → se acercó a la EMA
        return { direction: 'toward_ema', barsToResolution: j };
      }
    }

    // Ruptura bajista: cierre por debajo del boundary inferior - margen
    if (future.close < lowerBound - rangePadding) {
      if (isAboveEma) {
        // Precio estaba arriba de EMA y rompió DOWN → se acercó a la EMA
        return { direction: 'toward_ema', barsToResolution: j };
      } else {
        // Precio estaba debajo de EMA y rompió DOWN → se alejó de la EMA
        return { direction: 'away_from_ema', barsToResolution: j };
      }
    }
  }

  // No hubo ruptura clara en la ventana
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Construcción de resultados
// ═══════════════════════════════════════════════════════════════════════════════

function buildResult(events: ConsolidationBacktestEvent[]): ConsolidationBacktestResult {
  const total   = events.length;
  const correct = events.filter(e => e.correct).length;

  // Desglose por patrón
  const byPattern: Partial<Record<ConsolidationPattern, PatternStats>> = {};
  for (const event of events) {
    if (!byPattern[event.pattern]) {
      byPattern[event.pattern] = { count: 0, correct: 0, accuracy: 0 };
    }
    byPattern[event.pattern]!.count++;
    if (event.correct) byPattern[event.pattern]!.correct++;
  }
  for (const key of Object.keys(byPattern) as ConsolidationPattern[]) {
    const stats = byPattern[key]!;
    stats.accuracy = stats.count > 0 ? Math.round((stats.correct / stats.count) * 100) : 0;
  }

  // Desglose por alignment
  const byAlignment: Record<ReversalAlignment, PatternStats> = {
    aligned:  { count: 0, correct: 0, accuracy: 0 },
    opposed:  { count: 0, correct: 0, accuracy: 0 },
    neutral:  { count: 0, correct: 0, accuracy: 0 },
  };
  for (const event of events) {
    byAlignment[event.reversalAlignment].count++;
    if (event.correct) byAlignment[event.reversalAlignment].correct++;
  }
  for (const key of Object.keys(byAlignment) as ReversalAlignment[]) {
    const stats = byAlignment[key];
    stats.accuracy = stats.count > 0 ? Math.round((stats.correct / stats.count) * 100) : 0;
  }

  // Tiempo promedio hasta resolución
  const resolvedEvents = events.filter(e => e.barsToResolution > 0);
  const avgBars = resolvedEvents.length > 0
    ? Math.round(resolvedEvents.reduce((s, e) => s + e.barsToResolution, 0) / resolvedEvents.length)
    : 0;

  return {
    totalConsolidations:   total,
    classifiedCorrectly:   correct,
    accuracy:              total > 0 ? Math.round((correct / total) * 100) : 0,
    avgBarsToResolution:   avgBars,
    byPattern,
    byAlignment,
    events,
  };
}

function emptyResult(): ConsolidationBacktestResult {
  return {
    totalConsolidations: 0,
    classifiedCorrectly: 0,
    accuracy:            0,
    avgBarsToResolution: 0,
    byPattern:           {},
    byAlignment: {
      aligned:  { count: 0, correct: 0, accuracy: 0 },
      opposed:  { count: 0, correct: 0, accuracy: 0 },
      neutral:  { count: 0, correct: 0, accuracy: 0 },
    },
    events: [],
  };
}
