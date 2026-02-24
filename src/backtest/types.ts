export type Candle = {
  time: number
  open: number
  high: number
  low: number
  close: number
}

export type HistoricalMarketData = {
  candles: Candle[]
}

export type BacktestEvent = {
  entryIndex: number
  exitIndex: number
  barsToRevert: number
  state: 'GREEN' | 'YELLOW' | 'RED'
  elasticity: number
}

export type BacktestResult = {
  totalSignals: number
  wins: number
  winRate: number
  avgBarsToRevert: number
  events: BacktestEvent[]
}


export type CurrentSignal = {
  elasticity: number
  state: 'bullish' | 'bearish' | 'neutral'
}

export type SignalMatchResult = {
  similarSignals: number
  winRate: number
  avgBarsToRevert: number
}
