import type { MarketState } from '@/types/market'

/**
 * Traduce estadística → decisión operativa
 */
export function resolveElasticityState(
  elasticity: number,
  percentile: number
): MarketState {

  // 🟢 Zona óptima para reversión
  if (percentile >= 80 && elasticity <= 10.0) {
    return 'GREEN'
  }

  // 🟡 Estirado pero aún posible
  if (percentile >= 60) {
    return 'YELLOW'
  }

  // 🔴 Ruido / ruptura / no tocar
  return 'RED'
}
