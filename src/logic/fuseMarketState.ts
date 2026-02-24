import type { MarketState } from '../types/market'
import type { SignalComparisonResult } from '../backtest/compareSignal'

export function fuseMarketState(
  current: MarketState,
  comparison: SignalComparisonResult | null
): MarketState {
  if (!comparison) return 'YELLOW'

  if (current === 'GREEN' && comparison.winRate >= 65) {
    return 'GREEN'
  }

  if (comparison.winRate < 40) {
    return 'RED'
  }

  return 'YELLOW'
}
