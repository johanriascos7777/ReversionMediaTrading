/**
 * useTrades.ts
 *
 * Hook que consume los endpoints REST del TradeController del backend.
 * Gestiona el estado de las operaciones (abiertas y cerradas) y expone
 * funciones para crear, cerrar y eliminar operaciones.
 */

import { useState, useEffect, useCallback } from 'react'
import { API_URL } from '@/config/env'

// ─── Tipos (espejo del backend) ───────────────────────────────────────────────

export type TradeDirection  = 'BUY' | 'SELL'
export type TradeType       = 'scalping' | 'swing' | 'positional'
export type TradingSession  = 'asian' | 'european' | 'american' | 'pacific'
export type TradeOutcome    = 'win' | 'loss' | 'breakeven' | 'open'
export type CloseReason     = 'tp' | 'sl' | 'signal' | 'manual' | 'time'
export type ElasticityState = 'GREEN' | 'YELLOW' | 'RED'
export type StructureState  = 'STRONG' | 'MODERATE' | 'WEAK'
export type DivergenceType  = 'bearish' | 'bullish' | 'none'
export type TrendDirection  = 'up' | 'down' | 'flat'

export interface Trade {
  id: number
  symbol: string
  direction: TradeDirection
  tradeType: TradeType
  session: TradingSession
  entryPrice: number
  exitPrice?: number
  leverage: number
  spread: number
  investmentAmount: number
  liquidationTheoretical?: number
  liquidationReal?: number
  // Señales
  elasticityM5State?: ElasticityState
  elasticityM15State?: ElasticityState
  fusedState?: ElasticityState
  elasticityM5Value?: number
  elasticityM15Value?: number
  structureState?: StructureState
  structureSignal?: string
  rsiAtEntry?: number
  divergenceAtEntry?: DivergenceType
  ema200SlopeAtEntry?: TrendDirection
  nearestSRPrice?: number
  nearestSRType?: string
  nearestSRStrength?: number
  nearestSRDistance?: number
  contextualWinRate?: number
  contextualCases?: number
  recommendedTp?: number
  recommendedSl?: number
  // Tiempos
  openedAt: string
  closedAt?: string
  minutesInHolgura?: number
  minutesInProfit?: number
  totalMinutesOpen?: number
  // Resultado
  mae?: number
  mfe?: number
  pnl?: number
  pnlPercent?: number
  closeReason?: CloseReason
  outcome: TradeOutcome
  notes?: string
  screenshotUrls?: string[]
}

export interface CreateTradePayload {
  symbol: string
  direction: TradeDirection
  tradeType: TradeType
  session?: TradingSession
  entryPrice: number
  leverage: number
  spread: number
  investmentAmount: number
  liquidationTheoretical?: number
  liquidationReal?: number
  // Señales (auto-capturadas)
  elasticityM5State?: ElasticityState
  elasticityM15State?: ElasticityState
  fusedState?: ElasticityState
  elasticityM5Value?: number
  elasticityM15Value?: number
  structureState?: StructureState
  structureSignal?: string
  rsiAtEntry?: number
  divergenceAtEntry?: DivergenceType
  ema200SlopeAtEntry?: TrendDirection
  nearestSRPrice?: number
  nearestSRType?: string
  nearestSRStrength?: number
  nearestSRDistance?: number
  contextualWinRate?: number
  contextualCases?: number
  recommendedTp?: number
  recommendedSl?: number
  notes?: string
}

export interface CloseTradePayload {
  exitPrice: number
  outcome: TradeOutcome
  closeReason: CloseReason
  closedAt?: string        // ISO string — hora real de cierre en IQ Option
  mae?: number
  mfe?: number
  minutesInHolgura?: number
  minutesInProfit?: number
  notes?: string
}

export interface AnalyticsSummary {
  totalTrades: number
  open: number
  wins: number
  losses: number
  breakeven: number
  winRate: number
  totalPnl: number
  avgMAE: number | null
  avgMFE: number | null
  avgDuration: number | null
}

export interface GroupStat {
  name: string
  total: number
  wins: number
  winRate: number
  pnl: number
}

export interface Analytics {
  summary: AnalyticsSummary
  bySession: GroupStat[]
  bySymbol: GroupStat[]
  byStructure: GroupStat[]
  byTradeType: GroupStat[]
  byLeverage: GroupStat[]
  losingPattern: {
    active: boolean
    message?: string
    trades?: { id: number; symbol: string; pnl: number; session: string }[]
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

const TRADE_URL = `${API_URL}/trade`

export function useTrades() {
  const [trades, setTrades]       = useState<Trade[]>([])
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<string | null>(null)

  const fetchTrades = useCallback(async (filters?: {
    symbol?: string; outcome?: string; session?: string
  }) => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (filters?.symbol)  params.set('symbol', filters.symbol)
      if (filters?.outcome) params.set('outcome', filters.outcome)
      if (filters?.session) params.set('session', filters.session)
      const res  = await fetch(`${TRADE_URL}?${params}`)
      if (!res.ok) {
        setError(`Backend error ${res.status}`)
        return
      }
      const data = await res.json()
      // Guard: solo actualizar si es un array
      if (Array.isArray(data)) setTrades(data)
    } catch (e) {
      setError('Error cargando operaciones')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchAnalytics = useCallback(async () => {
    try {
      const res  = await fetch(`${TRADE_URL}/analytics`)
      if (!res.ok) return
      const data = await res.json()
      if (data?.summary) setAnalytics(data)
      else setAnalytics(null)
    } catch {
      setAnalytics(null)
    }
  }, [])

  const createTrade = useCallback(async (payload: CreateTradePayload): Promise<Trade | null> => {
    try {
      const res  = await fetch(TRADE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data: Trade = await res.json()
      await fetchTrades()
      await fetchAnalytics()
      return data
    } catch {
      setError('Error registrando operación')
      return null
    }
  }, [fetchTrades, fetchAnalytics])

  const closeTrade = useCallback(async (id: number, payload: CloseTradePayload): Promise<boolean> => {
    try {
      await fetch(`${TRADE_URL}/${id}/close`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      await fetchTrades()
      await fetchAnalytics()
      return true
    } catch {
      setError('Error cerrando operación')
      return false
    }
  }, [fetchTrades, fetchAnalytics])

  const updateTrade = useCallback(async (id: number, payload: Partial<Trade>): Promise<boolean> => {
    try {
      await fetch(`${TRADE_URL}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      await fetchTrades()
      await fetchAnalytics()
      return true
    } catch {
      setError('Error actualizando operación')
      return false
    }
  }, [fetchTrades, fetchAnalytics])


  const deleteTrade = useCallback(async (id: number): Promise<boolean> => {
    try {
      await fetch(`${TRADE_URL}/${id}`, { method: 'DELETE' })
      await fetchTrades()
      await fetchAnalytics()
      return true
    } catch {
      setError('Error eliminando operación')
      return false
    }
  }, [fetchTrades, fetchAnalytics])

  // Carga inicial
  useEffect(() => {
    fetchTrades()
    fetchAnalytics()
  }, [fetchTrades, fetchAnalytics])

  return {
    trades,
    analytics,
    loading,
    error,
    fetchTrades,
    fetchAnalytics,
    createTrade,
    closeTrade,
    updateTrade,
    deleteTrade,
  }
}
