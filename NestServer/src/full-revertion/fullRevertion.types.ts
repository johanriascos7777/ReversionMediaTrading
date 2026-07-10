/**
 * fullRevertion.types.ts
 *
 * Tipos exclusivos del módulo Full Reversion.
 * No dependen ni modifican los tipos de market/types.ts
 */

import type { DivergenceType, SRLevel } from '../structure/structure.types';

export type EMASlope = 'FLAT' | 'GENTLE' | 'STEEP';

export type SlopeDirection = 'UP' | 'DOWN' | 'FLAT';

export type FRState = 'GREEN' | 'YELLOW' | 'RED';

/**
 * Snapshot calculado por el Full Reversion Engine para un tick en tiempo real.
 */
export type FullRevertionSnapshot = {
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
  /** Magnitud de la pendiente en unidades de ATR por 10 barras (puede ser negativo = bajando) */
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

  // -- Pullback Shield --
  shieldBlocked?: boolean;
};

/**
 * Evento individual del backtest Full Reversion.
 * "win" = el precio CERRÓ al otro lado de la EMA en ≤ maxBarsToRevert barras.
 */
export type FRBacktestEvent = {
  entryIndex:        number;
  exitIndex:         number;   // -1 si no hubo cruce completo
  barsToRevert:      number;
  elasticity:        number;
  emaSlope:          EMASlope;
  slopeValue:        number;
  blockedBySlope:    boolean;  // señal que el filtro hubiera descartado
};

/**
 * Resultado del backtest Full Reversion.
 */
export type FullRevertionBacktestResult = {
  totalSignals:      number;  // señales GREEN totales (incluyendo las bloqueadas)
  allowedSignals:    number;  // señales GREEN con slope FLAT o GENTLE
  wins:              number;  // de las permitidas, cuántas completaron cruce
  winRate:           number;  // wins / allowedSignals × 100
  filteredBySlope:   number;  // señales bloqueadas por pendiente STEEP
  avgBarsToRevert:   number;
  events:            FRBacktestEvent[];
};

/**
 * Estado de alerta por símbolo, mantenido en memoria por el servicio.
 * Usado tanto para alertas M5 individuales como para alertas M15 individuales.
 */
export type FRAlertState = {
  previousFRState: FRState | null;
  lastAlertTime:   number;
};

/**
 * Estado de la alerta FUSIONADA (M5 + M15 coinciden).
 * Se mantiene por separado para que la alerta multi-TF tenga su propio cooldown.
 */
export type FRFusedAlertState = {
  previousM5State:     FRState | null;
  previousM15State:    FRState | null;
  lastFusedAlertTime:  number;
  preAlertActive:      boolean;
};
