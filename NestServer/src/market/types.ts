/**
 * types.ts
 * Tipos compartidos del backend.
 */

export type Candle = {
  time:  number   // timestamp ms del CIERRE de la vela
  open:  number
  high:  number
  low:   number
  close: number
  closed: boolean // true = vela cerrada, false = vela en construcción
}

export type Timeframe = 'M5' | 'M15'

export type MarketState = 'GREEN' | 'YELLOW' | 'RED'

// Lo que el backend calcula y envía al frontend
export type MarketSnapshot = {
  timeframe:   Timeframe
  price:       number
  ema100:      number
  atr:         number
  elasticity:  number
  percentile:  number
  state:       MarketState
  timestamp:   number
}

export type ApiKeysPoolStatusMessage = {
  type: 'keys-status';
  totalKeys: number;
  exhaustedKeysCount: number;
  allExhausted: boolean;
  assignments: {
    symbol: string;
    activeKeyMasked: string;
    status: 'active' | 'shared' | 'exhausted';
    requestsCount: number;
    minutelyRate: number;
    minutelyMax: number;
  }[];
  exhaustedKeys?: {
    keyMasked: string;
    cooldownRemaining: number;
  }[];
  poolDetails?: {
    index: number;
    keyMasked: string;
    status: 'active' | 'shared' | 'rate-limit' | 'daily-limit';
    requestsCount: number;
    minutelyRate: number;
    minutelyMax: number;
    cooldownRemaining: number;
    assignedSymbol: string | null;
  }[];
}

export type KeysExhaustedAlertMessage = {
  type: 'keys-exhausted-alert';
  symbol: string;
  message: string;
}

// Mensaje que el backend emite al frontend via WebSocket propio
export type BackendMessage =
  | {
      type: 'snapshot';
      symbol: string;
      m5: MarketSnapshot;
      m15: MarketSnapshot;
      finalState: MarketState;
      fusedState: MarketState;
      triggerState?: 'reposo' | 'estirando' | 'giro';
      lastClosedElasticityM5?: number | null;
      prevClosedElasticityM5?: number | null;
      fusedExplanation: string;
      fusedComparison: SignalComparisonResult | null;
      backtest: BacktestResult | null;
      experimental?: {
        m5: MarketSnapshot & { direction: 'BUY' | 'SELL' };
        m15: MarketSnapshot & { direction: 'BUY' | 'SELL' };
        finalState: MarketState;
        fusedState: MarketState;
        triggerState: 'reposo' | 'estirando' | 'giro-provisional' | 'giro';
        pedestrianLight: 'STOP' | 'WALK';
        fusedExplanation: string;
        fusedComparison: SignalComparisonResult | null;
        backtest: any | null; // Usar any para simplificar el mapeo de BacktestResultExp
        lastClosedElasticityM5?: number | null;
        prevClosedElasticityM5?: number | null;
      };
    }
  | { type: 'status';     status: 'connecting' | 'connected' | 'disconnected'; message: string }
  | { type: 'error';      message: string }
  | { type: 'ws-fallback'; symbol: string; reason: string }
  | ApiKeysPoolStatusMessage
  | KeysExhaustedAlertMessage

// Mensaje que llega de Twelve Data WebSocket
export type TwelveTickMessage = {
  event?:     string   // 'price' | 'subscribe-status' | 'heartbeat'
  symbol?:    string
  price?:     number
  timestamp?: number
  exchange?:  string
}

// ─── Tipos para Backtesting y Fusión de Señal ───────────────────────────────

export type BacktestConfig = {
  emaPeriod:       number
  maxBarsToRevert: number
}

export type BacktestEvent = {
  entryIndex:   number
  exitIndex:    number   // -1 si no revirtió (loss)
  barsToRevert: number
  state:        MarketState
  elasticity:   number
}

export type BacktestResult = {
  totalSignals:    number
  wins:            number
  winRate:         number
  avgBarsToRevert: number
  events:          BacktestEvent[]
}

export type SignalComparisonResult = {
  similarSignals: number
  winRate: number
  avgBarsToRevert: number
}

export type FusedStateResult = {
  state:       MarketState
  explanation: string
}