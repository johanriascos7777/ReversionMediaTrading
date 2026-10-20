import { useCallback, useEffect, useState } from 'react'
import { API_URL } from '@/config/env'

export type BrokerInfo = { id: string; label: string; live: boolean }

export type ExecutionConfig = {
  auto: boolean
  autoAllowed: boolean
  brokers: BrokerInfo[]
  defaultBroker: string
  symbols: string[]
  defaultSize: number
  maxSize: number
}

export type PnlModel = 'capital' | 'pip1'

export type PhaseView = {
  seq: number
  state: 'red' | 'green'
  startedAt: string
  endedAt: string | null
  durationSec: number
  startPnl: number
  lastPnl: number
  extremePnl: number
  extremeAt: string
  samples: number
  gapSec: number
}

export type ModelSummary = {
  current: PhaseView | null
  phases: number
  redSec: number
  greenSec: number
  firstGreenAfterSec: number | null
}

export type PositionTracking = {
  live: { at: string; bid: number; offer: number; spread: number; upl: number | null; capital: number; pip1: number } | null
  models: Record<PnlModel, ModelSummary>
}

export type ExecutionPosition = {
  id: number
  broker: string
  brokerLabel: string
  live: boolean
  symbol: string
  direction: 'BUY' | 'SELL'
  size: number
  status: 'open' | 'closed' | 'failed'
  source: 'frontend' | 'telegram' | 'auto'
  alertLogId: number | null
  openPrice: number | null
  stopLevel: number | null
  profitLevel: number | null
  closePrice: number | null
  openedAt: string
  trackingSince: string | null
  entrySpread: number | null
  brokerGoneAt: string | null
  tracking: PositionTracking | null
  closedAt: string | null
  closeReason: string | null
  note: string | null
}

export type OpenOrder = {
  broker: string
  symbol: string
  direction: 'BUY' | 'SELL'
  size: number
  stopLevel?: number
  profitLevel?: number
}

async function readError(res: Response): Promise<string> {
  try {
    const body = await res.json()
    return body?.message ?? `HTTP ${res.status}`
  } catch {
    return `HTTP ${res.status}`
  }
}

export async function fetchPhases(id: number): Promise<Record<PnlModel, PhaseView[]>> {
  const res = await fetch(`${API_URL}/execution/positions/${id}/phases`)
  if (!res.ok) throw new Error(await readError(res))
  return res.json()
}

export function useExecution(refreshMs = 5_000) {
  const [config, setConfig] = useState<ExecutionConfig | null>(null)
  const [positions, setPositions] = useState<ExecutionPosition[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const [cfgRes, posRes] = await Promise.all([
        fetch(`${API_URL}/execution/config`),
        fetch(`${API_URL}/execution/positions?status=open`),
      ])
      if (!cfgRes.ok || !posRes.ok) throw new Error(`HTTP ${cfgRes.status}/${posRes.status}`)
      const [cfg, pos] = await Promise.all([cfgRes.json(), posRes.json()])
      setConfig(cfg)
      setPositions(pos)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [])

  useEffect(() => {
    load()
    const timer = setInterval(load, refreshMs)
    return () => clearInterval(timer)
  }, [load, refreshMs])

  const run = useCallback(
    async (request: () => Promise<Response>) => {
      setBusy(true)
      setError(null)
      try {
        const res = await request()
        if (!res.ok) {
          setError(await readError(res))
          return false
        }
        await load()
        return true
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
        return false
      } finally {
        setBusy(false)
      }
    },
    [load],
  )

  const open = useCallback(
    (order: OpenOrder) =>
      run(() =>
        fetch(`${API_URL}/execution/positions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(order),
        }),
      ),
    [run],
  )

  const close = useCallback(
    (id: number) => run(() => fetch(`${API_URL}/execution/positions/${id}/close`, { method: 'POST' })),
    [run],
  )

  const setAuto = useCallback(
    (enabled: boolean) =>
      run(() =>
        fetch(`${API_URL}/execution/auto`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled }),
        }),
      ),
    [run],
  )

  return { config, positions, error, busy, open, close, setAuto }
}
