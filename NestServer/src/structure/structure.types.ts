/**
 * structure.types.ts
 *
 * Tipos del motor de Confluencia y Estructura de Mercado.
 * Sistema paralelo al motor de elasticidad, sin modificar su lógica.
 */

export type StructureState = 'STRONG' | 'MODERATE' | 'WEAK';
export type SignalDirection = 'SELL' | 'BUY' | 'WAIT';
export type DivergenceType = 'bearish' | 'bullish' | 'none';
export type TrendDirection = 'up' | 'down' | 'flat';

export type SRLevel = {
  price:    number;
  type:     'resistance' | 'support';
  strength: number;   // veces que fue testeado (1–4+)
  distance: number;   // distancia al precio actual en unidades de ATR
};

export type StructureSnapshot = {
  type:           'structure-snapshot';
  symbol:         string;
  timeframe:      'M5' | 'M15';
  price:          number;
  rsi:            number;
  rsiZone:        'overbought' | 'oversold' | 'neutral';
  ema50:          number;
  ema100:         number;
  ema200:         number;
  ema200Slope:    TrendDirection;
  priceVsEma200:  'above' | 'below';
  isCompressionSandwich: boolean;
  doublePattern:  'double_top' | 'double_bottom' | 'none';
  divergence:     DivergenceType;
  srLevels:       SRLevel[];
  nearestSR:      SRLevel | null;
  confluences:    string[];   // lista de confluencias activas en texto legible
  structureState: StructureState;
  signal:         SignalDirection;
  explanation:    string;
  timestamp:      number;
};
