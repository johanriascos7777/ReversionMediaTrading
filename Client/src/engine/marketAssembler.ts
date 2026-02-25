import type { MarketSnapshot, MarketType } from '@/types/market'
import { calculateElasticity } from './elasticityEngine'
import { resolveElasticityState } from './stateEngine'
import { getPercentileEngine } from './engineRegistry'

export type MarketAssemblerInput = {
  marketType: MarketType
  pair: string
  timeframe: string
  price: number
  ema100: number
  atr: number
}

export function assembleMarketSnapshot(
  input: MarketAssemblerInput
): MarketSnapshot {

  const { marketType, pair, timeframe, price, ema100, atr } = input

  const elasticity = calculateElasticity({ price, ema100, atr })

  const engineKey = `${marketType}:${pair}:${timeframe}`
  const percentileEngine = getPercentileEngine(engineKey)

  const percentile = percentileEngine.push(elasticity)
  const state = resolveElasticityState(elasticity, percentile)

  return {
    marketType,
    pair,
    timeframe,
    price,
    ema100,
    atr,
    elasticity,
    percentile,
    state,
    timestamp: Date.now(),
  }
}
