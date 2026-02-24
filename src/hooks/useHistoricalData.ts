import { useEffect, useState } from 'react'
import type { Candle } from '../backtest/types'

export function useHistoricalData(): Candle[] | null {
  const [candles, setCandles] = useState<Candle[] | null>(null)

  useEffect(() => {
    const data: Candle[] = []

    let price = 1.1735

    for (let i = 0; i < 300; i++) {
      const open = price
      const close = open + (Math.random() - 0.5) * 0.001
      const high = Math.max(open, close) + Math.random() * 0.0004
      const low = Math.min(open, close) - Math.random() * 0.0004

      data.push({
        time: Date.now() - (300 - i) * 5 * 60_000,
        open,
        high,
        low,
        close,
      })

      price = close
    }

    setCandles(data)
  }, [])

  return candles
}
