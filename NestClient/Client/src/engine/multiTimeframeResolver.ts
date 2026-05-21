import type { MarketSnapshot } from '@/types/market'

export type MultiTFState = 'GREEN' | 'YELLOW' | 'RED'

export function resolveMultiTimeframeState(
  fast: MarketSnapshot,   // M5
  slow: MarketSnapshot    // M15
): MultiTFState {

  // 🟢 Solo si AMBOS están verdes
  if (fast.state === 'GREEN' && slow.state === 'GREEN') {
    return 'GREEN'
  }

  // 🟡 Timing ok pero contexto dudoso
  if (fast.state === 'GREEN' && slow.state === 'YELLOW') {
    return 'YELLOW'
  }

  // 🔴 Todo lo demás
  return 'RED'
}
