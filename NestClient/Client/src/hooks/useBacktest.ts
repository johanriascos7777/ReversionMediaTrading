/**
 * useBacktest.ts
 *
 * Conecta el hook de React con el motor real de backtesting (runBacktest).
 *
 * ANTES: usaba Math.random() → números ficticios, inútiles para trading.
 * AHORA: usa runBacktest() con las velas reales de useHistoricalData.
 *
 * ¿Qué hace runBacktest?
 *   Recorre cada vela histórica, calcula elasticidad y percentil en ese
 *   punto, y si el estado sería GREEN busca cuántas velas tardó el precio
 *   en volver a la EMA. Eso genera eventos reales con win/loss verdaderos.
 *
 * useMemo → solo recalcula cuando cambian las velas (no en cada render).
 * Con 300 velas M5 tarda < 5ms. No bloquea el hilo principal.
 */

import { useMemo } from 'react'
import type { BacktestResult } from '../backtest/types'
import type { Candle } from '../backtest/types'
import { runBacktest } from '../backtest/backtestEngine'

// Configuración del backtest — ajustar según calibración real
const BACKTEST_CONFIG = {
  emaPeriod:      100,   // velas para calcular EMA (igual que el motor en tiempo real)
  maxBarsToRevert: 20,   // máximo de velas que esperamos para reversión
}

export function useBacktest(candles: Candle[] | null): BacktestResult | null {
  return useMemo(() => {
    // Necesitamos al menos emaPeriod + algo de historial para que sea útil
    if (!candles || candles.length < BACKTEST_CONFIG.emaPeriod + 10) {
      return null
    }

    return runBacktest(candles, BACKTEST_CONFIG)
  }, [candles])
}