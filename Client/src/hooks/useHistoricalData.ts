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
import { API_URL } from '@/config/env'

const BACKEND_HTTP_URL = API_URL

export function useHistoricalData(symbol: string): Candle[] | null {
  const [candles, setCandles] = useState<Candle[] | null>(null)

  useEffect(() => {
    setCandles(null) // Limpiar estado al cambiar de par para disparar estados de carga

    fetch(`${BACKEND_HTTP_URL}/history?timeframe=5min&symbol=${encodeURIComponent(symbol)}`)
      .then((res) => res.json())
      .then((data: Candle[]) => {
        if (Array.isArray(data) && data.length > 0) {
          setCandles(data)
          console.log(`[useHistoricalData] [${symbol}] ${data.length} velas recibidas del backend`)
        }
      })
      .catch((err) => {
        console.error(`[useHistoricalData] [${symbol}] Error al pedir historial al backend:`, err)
      })
  }, [symbol])

  return candles
}