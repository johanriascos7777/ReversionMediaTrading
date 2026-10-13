/**
 * consolidation.types.ts
 *
 * Tipos para el módulo de detección y clasificación
 * de zonas de consolidación del precio.
 */



// ═══════════════════════════════════════════════════════════════════════════════
// Zona de consolidación detectada
// ═══════════════════════════════════════════════════════════════════════════════

export type ConsolidationZone = {
  startIndex:   number;     // Índice de la primera vela de la zona
  endIndex:     number;     // Índice de la última vela de la zona
  upperBound:   number;     // Máximo high de la zona (resistencia)
  lowerBound:   number;     // Mínimo low de la zona (soporte)
  duration:     number;     // Número de velas en la zona
  range:        number;     // upperBound - lowerBound (en precio)
  rangeATR:     number;     // range / ATR14 (normalizado por volatilidad)
};

// ═══════════════════════════════════════════════════════════════════════════════
// Clasificación geométrica
// ═══════════════════════════════════════════════════════════════════════════════

export type ConsolidationPattern =
  | 'ascending_triangle'    // lows subiendo, highs planos → sesgo alcista
  | 'descending_triangle'   // highs bajando, lows planos → sesgo bajista
  | 'rectangle'             // highs y lows planos → sin sesgo claro
  | 'bull_flag'             // pendiente negativa en tendencia alcista → continuación up
  | 'bear_flag'             // pendiente positiva en tendencia bajista → continuación down
  | 'contracting_wedge'     // boundaries convergen → explosividad inminente
  | 'expanding_wedge'       // boundaries divergen → indecisión peligrosa
  | 'falling_channel'       // pendiente negativa debajo de EMA → capitulación/reversión up
  | 'rising_channel'        // pendiente positiva encima de EMA → agotamiento/reversión down
  | 'unclassified';         // no encaja en ningún patrón reconocible

export type BreakoutBias = 'bullish' | 'bearish' | 'neutral';

export type GeometryResult = {
  pattern:          ConsolidationPattern;
  breakoutBias:     BreakoutBias;
  upperSlope:       number;   // Pendiente de la regresión de highs (unidades de precio por vela)
  lowerSlope:       number;   // Pendiente de la regresión de lows
  slopeConvergence: number;   // Diferencia de pendientes (negativo = convergen)
  r2Upper:          number;   // R² del fit de la regresión de highs (0-1)
  r2Lower:          number;   // R² del fit de la regresión de lows (0-1)
  confidence:       number;   // 0-100, calidad general de la clasificación
};

// ═══════════════════════════════════════════════════════════════════════════════
// Alineación con la reversión a la media
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * aligned  = la geometría favorece ruptura HACIA la EMA100 (buena para reversión)
 * opposed  = la geometría favorece ruptura LEJOS de la EMA100 (mala para reversión)
 * neutral  = la geometría no tiene sesgo claro
 */
export type ReversalAlignment = 'aligned' | 'opposed' | 'neutral';

// ═══════════════════════════════════════════════════════════════════════════════
// Resultado combinado: detección + geometría + alineación
// ═══════════════════════════════════════════════════════════════════════════════

export type ConsolidationAnalysis = {
  detected:           boolean;
  zone:               ConsolidationZone | null;
  geometry:           GeometryResult | null;
  reversalAlignment:  ReversalAlignment;
  priceVsEma:         'above' | 'below';       // Posición del precio vs EMA100
  elasticity:         number;                   // Elasticidad actual
  explanation:        string;                   // Explicación en español
};

// ═══════════════════════════════════════════════════════════════════════════════
// Backtest del Consolidation Classifier
// ═══════════════════════════════════════════════════════════════════════════════

export type ConsolidationBacktestEvent = {
  entryIndex:         number;       // Índice de la vela donde se detectó la consolidación
  zoneStartIndex:     number;
  zoneEndIndex:       number;
  pattern:            ConsolidationPattern;
  breakoutBias:       BreakoutBias;
  reversalAlignment:  ReversalAlignment;
  actualBreakout:     'toward_ema' | 'away_from_ema';  // Qué pasó realmente
  correct:            boolean;                         // ¿El classifier acertó?
  barsToResolution:   number;                          // Velas hasta la ruptura clara
  elasticityAtEntry:  number;
  priceAtEntry:       number;
  ema100AtEntry:      number;
};

export type PatternStats = {
  count:    number;
  correct:  number;
  accuracy: number;
};

export type ConsolidationBacktestResult = {
  totalConsolidations:   number;
  classifiedCorrectly:   number;
  accuracy:              number;       // % de acierto global
  avgBarsToResolution:   number;
  byPattern:             Partial<Record<ConsolidationPattern, PatternStats>>;
  byAlignment:           Record<ReversalAlignment, PatternStats>;
  events:                ConsolidationBacktestEvent[];
};

// ═══════════════════════════════════════════════════════════════════════════════
// Configuración del detector (calibrable por backtest)
// ═══════════════════════════════════════════════════════════════════════════════

export type ConsolidationConfig = {
  /** Mínimo de velas para considerar una zona como consolidación */
  minDuration:      number;   // default: 6
  /** Rango máximo de la zona en unidades ATR para calificar como consolidación */
  maxRangeATR:      number;   // default: 1.8
  /** Cuántas velas hacia atrás buscar al detectar consolidación */
  lookback:         number;   // default: 20
  /** Threshold de pendiente normalizada (por ATR) para considerar "plana" */
  flatThreshold:    number;   // default: 0.02
  /** Threshold de pendiente para considerar "significativa" */
  slopeThreshold:   number;   // default: 0.05
  /** Cuántas velas futuras mirar en backtest para ver la resolución */
  resolutionWindow: number;   // default: 30
};

export const DEFAULT_CONSOLIDATION_CONFIG: ConsolidationConfig = {
  minDuration:      6,
  maxRangeATR:      1.8,
  lookback:         20,
  flatThreshold:    0.02,
  slopeThreshold:   0.05,
  resolutionWindow: 30,
};
