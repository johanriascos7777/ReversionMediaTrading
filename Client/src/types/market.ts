export type MarketType = 'FOREX' | 'CRYPTO'

export type MarketState = 'GREEN' | 'YELLOW' | 'RED'

export type MarketSnapshot = {
  marketType: MarketType
  pair: string
  timeframe: string

  price: number
  ema100: number
  atr: number

  elasticity: number
  percentile: number
  state: MarketState

  timestamp: number
}
