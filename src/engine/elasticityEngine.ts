// 🧠 Engine puro (sin React)

export type ElasticityInput = {
  price: number
  ema100: number
  atr: number
}

/**
 * Elasticity = distancia a la EMA normalizada por ATR
 * Es adimensional → comparable entre pares y timeframes
 */
export function calculateElasticity(
  { price, ema100, atr }: ElasticityInput
): number {
  if (atr <= 0) return 0
  return Math.abs(price - ema100) / atr
}
