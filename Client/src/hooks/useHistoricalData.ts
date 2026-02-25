/**
 * useHistoricalData.ts
 *
 * Antes: llamaba directamente a Twelve Data REST (consumía créditos)
 * Ahora: pide el historial al backend via HTTP
 *
 * El backend ya tiene las 500 velas históricas cargadas al arrancar.
 * El frontend solo las pide para el backtest y la comparación contextual.
 *
 * Endpoint: GET http://localhost:8080/history?timeframe=5min
 */

import { useEffect, useState } from 'react'
import type { Candle } from '../backtest/types'

const BACKEND_HTTP_URL = 'http://localhost:8080'

export function useHistoricalData(): Candle[] | null {
  const [candles, setCandles] = useState<Candle[] | null>(null)

  useEffect(() => {
    fetch(`${BACKEND_HTTP_URL}/history?timeframe=5min`)
      .then((res) => res.json())
      .then((data: Candle[]) => {
        if (Array.isArray(data) && data.length > 0) {
          setCandles(data)
          console.log(`[useHistoricalData] ${data.length} velas recibidas del backend`)
        }
      })
      .catch((err) => {
        console.error('[useHistoricalData] Error al pedir historial al backend:', err)
      })
  }, [])

  return candles
}