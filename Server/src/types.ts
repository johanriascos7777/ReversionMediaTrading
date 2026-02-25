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
  state:       MarketState
  timestamp:   number
}

// Mensaje que el backend emite al frontend via WebSocket propio
export type BackendMessage =
  | { type: 'snapshot'; m5: MarketSnapshot; m15: MarketSnapshot; finalState: MarketState }
  | { type: 'status';   status: 'connecting' | 'connected' | 'disconnected'; message: string }
  | { type: 'error';    message: string }

// Mensaje que llega de Twelve Data WebSocket
export type TwelveTickMessage = {
  event?:     string   // 'price' | 'subscribe-status' | 'heartbeat'
  symbol?:    string
  price?:     number
  timestamp?: number
  exchange?:  string
}