export type MarketBias = 'bullish' | 'bearish' | 'neutral'

export function mapStateToBias(
  state: 'GREEN' | 'YELLOW' | 'RED'
): MarketBias {
  if (state === 'GREEN') return 'bullish'
  if (state === 'RED') return 'bearish'
  return 'neutral'
}
