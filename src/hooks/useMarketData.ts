import { useEffect, useState } from 'react'
import type { MarketSnapshot } from '@/types/market'
import { assembleMarketSnapshot } from '@/engine/marketAssembler'
import { resolveMultiTimeframeState } from '@/engine/multiTimeframeResolver'

export type FinalMarketView = {
  m5: MarketSnapshot
  m15: MarketSnapshot
  finalState: 'GREEN' | 'YELLOW' | 'RED'
}

export function useMarketData() {
  const [data, setData] = useState<FinalMarketView | null>(null)

  useEffect(() => {
    const interval = setInterval(() => {

      // 🔁 MOCK (luego entra feed real)
      const price = 1.1735 + (Math.random() - 0.5) * 0.001

      const snapshotM5 = assembleMarketSnapshot({
        marketType: 'FOREX',
        pair: 'EUR/USD',
        timeframe: 'M5',
        price,
        ema100: 1.173,
        atr: 0.0006,
      })

      const snapshotM15 = assembleMarketSnapshot({
        marketType: 'FOREX',
        pair: 'EUR/USD',
        timeframe: 'M15',
        price,
        ema100: 1.1725,
        atr: 0.0012,
      })

      const finalState = resolveMultiTimeframeState(
        snapshotM5,
        snapshotM15
      )

      setData({
        m5: snapshotM5,
        m15: snapshotM15,
        finalState,
      })

    }, 1000)

    return () => clearInterval(interval)
  }, [])

  return data
}
