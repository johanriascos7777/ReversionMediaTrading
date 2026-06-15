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

export type TradeDirection = 'BUY' | 'SELL'
export type TradeType = 'scalping' | 'swing' | 'positional'
export type TradingSession = 'asian' | 'european' | 'american' | 'pacific'
export type TradeOutcome = 'win' | 'loss' | 'breakeven' | 'open'
export type CloseReason = 'tp' | 'sl' | 'signal' | 'manual' | 'time'
export type ElasticityState = 'GREEN' | 'YELLOW' | 'RED'
export type StructureState = 'STRONG' | 'MODERATE' | 'WEAK'
export type DivergenceType = 'bearish' | 'bullish' | 'none'
export type TrendDirection = 'up' | 'down' | 'flat'
export type TradeMode = 'normal' | 'experimental'
export type AccountType = 'demo' | 'real'

export interface Trade {
  id: number
  symbol: string
  direction: TradeDirection
  tradeType: TradeType
  tradeMode?: TradeMode
  accountType?: AccountType
  hasTypeC?: boolean | null
  hasPedestrianLight?: boolean | null

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
  isImportant?: boolean
  favoriteScreenshotUrl?: string
}

export interface CreateTradePayload {
  symbol: string
  direction: TradeDirection
  tradeType: TradeType
  tradeMode?: TradeMode
  accountType?: AccountType
  hasTypeC?: boolean | null
  hasPedestrianLight?: boolean | null

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
  // Fecha/hora de apertura personalizada (ISO string); si no viene, el server usa now
  openedAt?: string
  notes?: string
  isImportant?: boolean
  favoriteScreenshotUrl?: string
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

export interface SetupStat {
  dashboard: 'PROD' | 'EXP'
  type: string
  hasTypeC: 'Sí' | 'No'
  walkState: 'WALK' | 'STOP' | '—'
  structureState: string
  session: TradingSession
  total: number
  wins: number
  winRate: number
  pnl: number
  expectancy: number
  avgDuration: number | null
}

export interface DurationBracketStat {
  name: string
  total: number
  wins: number
  winRate: number
  pnl: number
  avgPnl: number
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
  bestSetup: SetupStat | null
  worstSetup: SetupStat | null
  mediumSetup: SetupStat | null
  setupCombinations: SetupStat[]
  durationBrackets: DurationBracketStat[]
  byPedestrianLight: {
    walk: { total: number; wins: number; winRate: number; pnl: number; expectancy: number } | null
    stop: { total: number; wins: number; winRate: number; pnl: number; expectancy: number } | null
  }
}

export interface PendingSignal {
  id: number
  symbol: string
  direction: 'BUY' | 'SELL'
  tradeMode: string
  status: 'pending' | 'approved' | 'discarded_active' | 'discarded_win' | 'discarded_loss' | 'discarded_timeout'
  entryPrice: number
  tpPrice: number
  slPrice: number
  session: string
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
  hasTypeC?: boolean | null
  hasPedestrianLight?: boolean | null
  openedAt: string
  closedAt?: string
  totalMinutesOpen?: number
  pnl?: number
  createdAt: string
  updatedAt: string
}

export interface FomowatchSummary {
  totalDiscarded: number
  win: number
  loss: number
  timeout: number
  winRate: number
  rejectionAccuracy: number
  capitalSaved: number
  avgDuration: number
  expectancy: number
}

export interface FomowatchData {
  pending: PendingSignal[]
  active: PendingSignal[]
  history: PendingSignal[]
  summary: FomowatchSummary
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

const TRADE_URL = `${API_URL}/trade`

export function useTrades() {
  const [trades, setTrades] = useState<Trade[]>([])
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [analyticsMode, setAnalyticsMode] = useState<string>('all')
  const [analyticsMinTrades, setAnalyticsMinTrades] = useState<number>(3)
  const [analyticsAccountType, setAnalyticsAccountType] = useState<string>('all')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fomowatch, setFomowatch] = useState<FomowatchData | null>(null)

  const fetchTrades = useCallback(async (filters?: {
    symbol?: string; outcome?: string; session?: string
  }) => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (filters?.symbol) params.set('symbol', filters.symbol)
      if (filters?.outcome) params.set('outcome', filters.outcome)
      if (filters?.session) params.set('session', filters.session)
      const res = await fetch(`${TRADE_URL}?${params}`)
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

  const fetchAnalytics = useCallback(async (tradeMode?: string, minTrades?: number, accountType?: string) => {
    const activeMode = tradeMode !== undefined ? tradeMode : analyticsMode
    const activeMinTrades = minTrades !== undefined ? minTrades : analyticsMinTrades
    const activeAccountType = accountType !== undefined ? accountType : analyticsAccountType
    
    if (tradeMode !== undefined) {
      setAnalyticsMode(tradeMode)
    }
    if (minTrades !== undefined) {
      setAnalyticsMinTrades(minTrades)
    }
    if (accountType !== undefined) {
      setAnalyticsAccountType(accountType)
    }
    
    try {
      const params = new URLSearchParams()
      if (activeMode && activeMode !== 'all') {
        params.set('tradeMode', activeMode)
      }
      if (activeAccountType && activeAccountType !== 'all') {
        params.set('accountType', activeAccountType)
      }
      params.set('minTrades', String(activeMinTrades))
      const res = await fetch(`${TRADE_URL}/analytics?${params}`)
      if (!res.ok) return
      const data = await res.json()
      if (data?.summary) setAnalytics(data)
      else setAnalytics(null)
    } catch {
      setAnalytics(null)
    }
  }, [analyticsMode, analyticsMinTrades, analyticsAccountType])

  const fetchFomowatch = useCallback(async () => {
    try {
      const res = await fetch(`${TRADE_URL}/fomowatch`)
      if (!res.ok) return
      const data = await res.json()
      if (data?.summary) setFomowatch(data)
      else setFomowatch(null)
    } catch {
      setFomowatch(null)
    }
  }, [])

  const createTrade = useCallback(async (payload: CreateTradePayload): Promise<Trade | null> => {
    try {
      const res = await fetch(TRADE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data: Trade = await res.json()
      await fetchTrades()
      await fetchAnalytics()
      await fetchFomowatch()
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
      await fetchFomowatch()
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
      await fetchFomowatch()
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
      await fetchFomowatch()
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
    fetchFomowatch()
  }, [fetchTrades, fetchAnalytics, fetchFomowatch])

  return {
    trades,
    analytics,
    analyticsMode,
    analyticsMinTrades,
    analyticsAccountType,
    fomowatch,
    loading,
    error,
    fetchTrades,
    fetchAnalytics,
    fetchFomowatch,
    createTrade,
    closeTrade,
    updateTrade,
    deleteTrade,
  }
}
