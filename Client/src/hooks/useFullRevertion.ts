/**
 * useFullRevertion.ts
 *
 * Hook para interactuar con el módulo Full Reversion del backend.
 * Carga la lista de símbolos disponibles y realiza polling automático
 * para obtener el estado, pendientes de EMA100 y backtests de un par específico.
 */

import { useState, useEffect, useCallback } from 'react'
import { API_URL } from '@/config/env'

export interface FullRevertionSnapshotDetail {
  price: number
  ema100: number
  atr: number
  elasticity: number
  percentile: number
  state: 'GREEN' | 'YELLOW' | 'RED'
  emaSlope: 'FLAT' | 'GENTLE' | 'STEEP'
  emaSlopeValue: number
  slopeDirection: 'UP' | 'DOWN' | 'FLAT'
  signalAllowed: boolean
}

export interface FullRevertionBacktestDetail {
  totalSignals: number
  allowedSignals: number
  wins: number
  winRate: number
  filteredBySlope: number
  avgBarsToRevert: number
  events?: any[]
}

export interface FullRevertionStatusResponse {
  symbol: string
  updatedAt: string
  fused: {
    bothGreen: boolean
    bothAllowed: boolean
    signalActive: boolean
    m5State: 'GREEN' | 'YELLOW' | 'RED'
    m15State: 'GREEN' | 'YELLOW' | 'RED' | null
  }
  m5: FullRevertionSnapshotDetail
  m15: FullRevertionSnapshotDetail | null
  backtest: FullRevertionBacktestDetail | null
  recommendation: string
}

export function useFullRevertion(activeSymbol: string, pollIntervalMs = 5000) {
  const [symbols, setSymbols] = useState<string[]>([])
  const [status, setStatus] = useState<FullRevertionStatusResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 1. Cargar lista de símbolos disponibles
  const fetchSymbols = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/full-revertion/symbols`)
      if (!res.ok) throw new Error(`Status ${res.status}`)
      const data = await res.json()
      if (data && Array.isArray(data.symbols)) {
        setSymbols(data.symbols)
      }
    } catch (err: any) {
      console.error('[useFullRevertion] Error cargando símbolos:', err)
    }
  }, [])

  // 2. Cargar estado de un símbolo específico
  const fetchStatus = useCallback(async (sym: string) => {
    if (!sym) return
    try {
      const res = await fetch(`${API_URL}/full-revertion/status?symbol=${encodeURIComponent(sym)}`)
      if (!res.ok) {
        if (res.status === 404) {
          setStatus(null)
          return
        }
        throw new Error(`Status ${res.status}`)
      }
      const data = await res.json()
      setStatus(data)
      setError(null)
    } catch (err: any) {
      setError(err.message || 'Error cargando estado')
    }
  }, [])

  // Carga inicial de símbolos
  useEffect(() => {
    fetchSymbols()
  }, [fetchSymbols])

  // Polling del estado del símbolo activo
  useEffect(() => {
    if (!activeSymbol) return

    setLoading(true)
    fetchStatus(activeSymbol).finally(() => setLoading(false))

    const interval = setInterval(() => {
      fetchStatus(activeSymbol)
    }, pollIntervalMs)

    return () => clearInterval(interval)
  }, [activeSymbol, fetchStatus, pollIntervalMs])

  const refetch = useCallback(() => {
    if (!activeSymbol) return
    setLoading(true)
    fetchStatus(activeSymbol).finally(() => setLoading(false))
  }, [activeSymbol, fetchStatus])

  return {
    symbols,
    status,
    loading,
    error,
    refetch,
    refetchSymbols: fetchSymbols,
  }
}
