import { useMemo } from 'react'
import type { BacktestResult, BacktestEvent } from '../backtest/types'

type Candle = {
  open: number
  high: number
  low: number
  close: number
}

export function useBacktest(
  candles: Candle[] | null
): BacktestResult | null {
  return useMemo(() => {
    if (!candles || candles.length < 200) return null

    const events: BacktestEvent[] = []

    candles.forEach((_, i) => {
      if (i < 100) return

      // 🧪 lógica dummy (placeholder)
      const elasticity = Math.random()
      const state =
        elasticity > 0.8 ? 'GREEN' : elasticity > 0.5 ? 'YELLOW' : 'RED'

      if (state === 'GREEN') {
        events.push({
          entryIndex: i,
          exitIndex: i + 10,
          barsToRevert: 10,
          state,
          elasticity,
        })
      }
    })

    const wins = events.length
    const totalSignals = events.length
    const avgBarsToRevert =
      events.reduce((a, e) => a + e.barsToRevert, 0) /
      (events.length || 1)

    return {
      totalSignals,
      wins,
      winRate:
        totalSignals > 0 ? (wins / totalSignals) * 100 : 0,
      avgBarsToRevert,
      events,
    }
  }, [candles])
}
