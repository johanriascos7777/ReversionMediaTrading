/**
 * fullRevertionReforced.types.ts
 *
 * Tipos del módulo Full Reversion Reinforced (Reforced).
 * Incluye EMA50 y osciladores de agotamiento Stochastic & CCI.
 */

import type { DivergenceType, SRLevel } from '../structure/structure.types';

export type EMASlope = 'FLAT' | 'GENTLE' | 'STEEP';

export type SlopeDirection = 'UP' | 'DOWN' | 'FLAT';

export type FRState = 'GREEN' | 'YELLOW' | 'RED';

/**
 * Snapshot calculado por el Full Reversion Reinforced Engine.
 */
export type FullRevertionReforcedSnapshot = {
  symbol:         string;
  timeframe:      'M5' | 'M15';
  price:          number;
  ema100:         number;
  atr:            number;
  elasticity:     number;
  percentile:     number;
  state:          FRState;
  /** Clasificación de la pendiente de la EMA100 */
  emaSlope:       EMASlope;
  /** Magnitud de la pendiente en unidades de ATR por 10 barras */
  emaSlopeValue:  number;
  /** Dirección del movimiento de la EMA100 */
  slopeDirection: SlopeDirection;
  /** true = condiciones para operar; false = pendiente demasiado fuerte, señal bloqueada */
  signalAllowed:  boolean;
  timestamp:      number;
  
  // -- Gatillo de Exhaustión --
  triggerState?:  'reposo' | 'estirando' | 'giro';
  
  // -- Confluencia Estructural --
  divergence?:    DivergenceType;
  nearestSR?:     SRLevel | null;

  // -- Objetivos Sugeridos --
  tpPrice?:       number;
  slPrice?:       number;

  // -- EMA50 y TP1 --
  ema50?:         number;
  elasticity50?:  number;
  tp50Price?:     number;

  // -- Osciladores --
  stochK?:        number;
  stochD?:        number;
  cci?:           number;
};

/**
 * Evento individual del backtest.
 */
export type FRBacktestEvent = {
  entryIndex:        number;
  exitIndex:         number;
  barsToRevert:      number;
  elasticity:        number;
  emaSlope:          EMASlope;
  slopeValue:        number;
  blockedBySlope:    boolean;
};

/**
 * Resultado del backtest.
 */
export type FullRevertionReforcedBacktestResult = {
  totalSignals:      number;
  allowedSignals:    number;
  wins:              number;
  winRate:           number;
  filteredBySlope:   number;
  avgBarsToRevert:   number;
  events:            FRBacktestEvent[];
};

/**
 * Estado de alerta por símbolo+timeframe.
 */
export type FRAlertState = {
  previousFRState: FRState | null;
  lastAlertTime:   number;
};

/**
 * Estado de la alerta FUSIONADA (M5 + M15 coinciden).
 */
export type FRFusedAlertState = {
  previousM5State:     FRState | null;
  previousM15State:    FRState | null;
  lastFusedAlertTime:  number;
  preAlertActive:      boolean;
  lastGreenTime?:      number;
};

export type AuditVerdict = 'VIP' | 'APPROVED' | 'WARNING' | 'REJECTED';

export type AuditedSignal = {
  id:             string;
  symbol:         string;
  direction:      'BUY' | 'SELL';
  alertName:      string;
  price:          number;
  timestamp:      number;
  verdict:        AuditVerdict;
  verdictText:    string;
  emaSlope:       string;
  emaSlopeValue:  number;
  elasticityM5:   number;
  divergence:     string;
  nearestSR:      string;
  tpPrice:        number;
  slPrice:        number;

  // -- Parámetros EMA50 y Osciladores --
  ema50?:         number;
  tp50Price?:     number;
  stochK?:        number;
  stochD?:        number;
  cci?:           number;
};
