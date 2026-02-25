/**
 * fuseMarketState.ts
 *
 * Genera la "Señal Confirmada" — el segundo semáforo del sistema.
 *
 * Combina dos fuentes independientes:
 *   1. market.finalState  → lo que dice el mercado AHORA (M5 + M15)
 *   2. comparison         → lo que suele pasar cuando esto ocurre (histórico)
 *
 * Regla clave: el tiempo real MANDA.
 *   El backtest solo opina. Nunca puede forzar GREEN si el mercado no lo es.
 *   Sí puede bajar la confianza (RED) si el historial muestra mal resultado.
 */

import type { MarketState } from '../types/market'
import type { SignalComparisonResult } from '../backtest/compareSignal'

export type FusedStateResult = {
  state:       MarketState
  explanation: string   // ← texto explicativo para mostrar en UI
}

export function fuseMarketState(
  current:    MarketState,
  comparison: SignalComparisonResult | null
): FusedStateResult {

  // Sin datos históricos aún → precaución, pero no bloqueamos
  if (!comparison) {
    return {
      state: 'YELLOW',
      explanation:
        'El backtest aún no tiene datos suficientes. ' +
        'La señal en tiempo real existe, pero sin contexto histórico ' +
        'no es posible confirmarla.',
    }
  }

  // Sin señales similares en el historial → no hay evidencia
  // No castigamos con RED porque el mercado puede estar en zona válida,
  // simplemente no tiene precedentes en las velas cargadas
  if (comparison.similarSignals === 0) {
    return {
      state: 'YELLOW',
      explanation:
        'No se encontraron situaciones similares en el historial reciente. ' +
        'La señal puede ser válida, pero sin precedentes no hay estadística ' +
        'que la respalde. Operar con precaución o esperar más contexto.',
    }
  }

  // Tiempo real GREEN + historial con alto win rate → confirmar
  if (current === 'GREEN' && comparison.winRate >= 65) {
    return {
      state: 'GREEN',
      explanation:
        `Señal en tiempo real confirmada por el historial. ` +
        `En ${comparison.similarSignals} situaciones similares, ` +
        `el precio revirtió ${comparison.winRate.toFixed(0)}% de las veces ` +
        `en un promedio de ${comparison.avgBarsToRevert.toFixed(0)} velas.`,
    }
  }

  // Historial con win rate bajo → el setup falla más de lo que funciona
  if (comparison.winRate < 40) {
    return {
      state: 'RED',
      explanation:
        `El historial muestra win rate de ${comparison.winRate.toFixed(0)}% ` +
        `en situaciones similares. La señal actual no tiene respaldo estadístico ` +
        `suficiente. No operar.`,
    }
  }

  // Win rate medio (40–65%) → señal existe pero sin convicción suficiente
  return {
    state: 'YELLOW',
    explanation:
      `Win rate histórico de ${comparison.winRate.toFixed(0)}% ` +
      `(${comparison.similarSignals} señales similares). ` +
      `La estadística no es lo suficientemente fuerte para confirmar. ` +
      `Esperar mejor setup.`,
  }
}