import { useEffect, useState } from 'react'
import { API_URL } from '@/config/env'

export type AlertRow = {
  id: number
  version: 'v1' | 'v2'
  name: string
  symbol: string
  direction: 'BUY' | 'SELL'
  price: number
  emaTarget: number | null
  distanceAtr: number | null
  shieldClear: boolean | null
  walk: boolean | null
  createdAt: string
  status: 'open' | 'touched' | 'expired'
  maePips: number | null
  mfePips: number | null
  touchedAt: string | null
  minutesToEma: number | null
  features?: { telegramSuppressedBy?: number } | null
}

export type VersionSummary = {
  version: string
  alerts: number
  open: number
  maeMedian: number | null
  maeP90: number | null
  maeMax: number | null
  touchedWithin4h: number
  decided4h: number
  minutesToEmaMedian: number | null
}

export function useAlerts(refreshMs = 30_000) {
  const [alerts, setAlerts] = useState<AlertRow[]>([])
  const [summary, setSummary] = useState<VersionSummary[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const [listRes, summaryRes] = await Promise.all([
          fetch(`${API_URL}/alerts?limit=60`),
          fetch(`${API_URL}/alerts/summary`),
        ])
        if (!listRes.ok || !summaryRes.ok) throw new Error(`HTTP ${listRes.status}/${summaryRes.status}`)
        const [list, sum] = await Promise.all([listRes.json(), summaryRes.json()])
        if (cancelled) return
        setAlerts(list)
        setSummary(sum)
        setError(null)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      }
    }
    load()
    const timer = setInterval(load, refreshMs)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [refreshMs])

  return { alerts, summary, error }
}
