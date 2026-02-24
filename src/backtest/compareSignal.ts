import type { BacktestResult } from './types'
import type { MarketState } from '../types/market'

export type SignalComparisonResult = {
  similarSignals: number
  winRate: number
  avgBarsToRevert: number
}

export function compareSignalWithHistory(
  current: {
    state: MarketState
    elasticity: number
  },
  backtest: BacktestResult
): SignalComparisonResult {
  const similar = backtest.events.filter(
    e =>
      e.state === current.state &&
      Math.abs(e.elasticity - current.elasticity) < 0.1
  )

  const wins = similar.length

  return {
    similarSignals: similar.length,
    winRate:
      similar.length > 0 ? (wins / similar.length) * 100 : 0,
    avgBarsToRevert:
      similar.reduce((a, e) => a + e.barsToRevert, 0) /
      (similar.length || 1),
  }
}
