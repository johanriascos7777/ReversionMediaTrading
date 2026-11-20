import { useCallback, useEffect, useState } from 'react'
import { API_URL } from '@/config/env'

type OperationRow = {
  id: number
  symbol: string
  direction: 'BUY' | 'SELL'
  size: number
  status: string
  source: string
  alertLogId: number | null
  openedAt: string
  closedAt: string | null
  totalSec: number
  slackBeforeGreenSec: number | null
  bestUsd: number | null
  bestAt: string | null
  bestAfterSec: number | null
  greenSec: number
  greenPhases: number
  worstUsd: number | null
  worstAt: string | null
  resultUsd: number | null
  resultLive: boolean
  closeSource: string | null
  closeReason: string | null
}

type Summary = {
  operations: number
  closed: number
  everGreen: number
  neverGreen: number
  closedUsd: number
  openUsd: number
}

const GREEN = '#10b981'
const RED = '#ef4444'
const MUTED = '#6b7280'

const dur = (sec: number | null) => {
  if (sec === null) return '—'
  if (sec < 60) return `${sec} s`
  const min = Math.round(sec / 60)
  if (min < 60) return `${min} min`
  return `${Math.floor(min / 60)} h ${min % 60} min`
}

const when = (iso: string | null) => {
  if (!iso) return '—'
  const d = new Date(iso)
  const today = new Date().toDateString() === d.toDateString()
  const time = d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false })
  return today ? time : `${d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })} ${time}`
}

const usd = (n: number | null) => (n === null ? '—' : `${n > 0 ? '+' : ''}${n.toFixed(2)}`)
const color = (n: number | null) => (n === null ? MUTED : n > 0 ? GREEN : n < 0 ? RED : MUTED)

const closeLabel = (r: OperationRow) => {
  if (r.resultLive) return 'abierta'
  if (r.closeSource === 'TP') return 'objetivo (TP)'
  if (r.closeSource === 'SL') return 'stop (SL)'
  const reasons: Record<string, string> = {
    'ya-cerrada-en-broker': 'tú, en el broker',
    manual: 'tú, en el panel',
    'contrato-tiempo': 'sistema: tiempo (175 min)',
    'contrato-ema': 'sistema: tocó la EMA',
    'contrato-objetivo': 'sistema: objetivo',
    'contrato-stop': 'sistema: stop',
  }
  if (r.closeReason) return reasons[r.closeReason] ?? r.closeReason
  return r.closeSource ?? '—'
}

const th: React.CSSProperties = { padding: '8px 10px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.4px', borderBottom: '1px solid rgba(255,255,255,0.1)', whiteSpace: 'nowrap' }
const td: React.CSSProperties = { padding: '8px 10px', fontSize: 13, borderBottom: '1px solid rgba(255,255,255,0.05)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }

export function OperationsTable() {
  const [rows, setRows] = useState<OperationRow[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/execution/table`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const body = await res.json()
      setRows(body.rows)
      setSummary(body.summary)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, 15000)
    return () => clearInterval(t)
  }, [load])

  return (
    <div style={{ padding: 24, color: '#e5e7eb', minHeight: '100vh', background: '#05050a' }}>
      <h1 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 4px' }}>Operaciones</h1>
      <p style={{ fontSize: 12, color: MUTED, margin: '0 0 16px' }}>
        USD de Capital.com. Holgura = tiempo en rojo desde la apertura hasta el primer verde. Se actualiza cada 15 s.
      </p>

      {summary && (
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: 13, marginBottom: 16 }}>
          <span>{summary.operations} operaciones · {summary.closed} cerradas</span>
          <span style={{ color: GREEN }}>{summary.everGreen} llegaron a verde</span>
          <span style={{ color: RED }}>{summary.neverGreen} nunca</span>
          <span>Cerradas: <b style={{ color: color(summary.closedUsd) }}>{usd(summary.closedUsd)}</b></span>
          <span>Abiertas: <b style={{ color: color(summary.openUsd) }}>{usd(summary.openUsd)}</b></span>
        </div>
      )}
      {error && <p style={{ color: RED, fontSize: 13 }}>No se pudo cargar: {error}</p>}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={th}>#</th>
              <th style={th}>Par</th>
              <th style={th}>Lado</th>
              <th style={th}>Apertura</th>
              <th style={th}>Holgura antes del verde</th>
              <th style={th}>Mejor momento</th>
              <th style={th}>Rato en verde</th>
              <th style={th}>Peor momento</th>
              <th style={th}>Resultado</th>
              <th style={th}>Cierre</th>
              <th style={th}>Duración</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} style={{ background: r.resultLive ? 'rgba(37,99,235,0.08)' : undefined }}>
                <td style={td}>{r.id}</td>
                <td style={{ ...td, fontWeight: 700 }}>{r.symbol}</td>
                <td style={{ ...td, color: r.direction === 'BUY' ? GREEN : RED }}>{r.direction}</td>
                <td style={td}>{when(r.openedAt)}</td>
                <td style={td}>{r.slackBeforeGreenSec === null ? <span style={{ color: RED }}>nunca llegó a verde</span> : dur(r.slackBeforeGreenSec)}</td>
                <td style={td}>
                  {r.bestUsd === null ? '—' : (
                    <>
                      <b style={{ color: GREEN }}>{usd(r.bestUsd)}</b>
                      <span style={{ color: MUTED }}> a las {when(r.bestAt)} ({dur(r.bestAfterSec)})</span>
                    </>
                  )}
                </td>
                <td style={td}>{r.greenPhases === 0 ? '—' : `${dur(r.greenSec)} · ${r.greenPhases} tramos`}</td>
                <td style={td}>
                  {r.worstUsd === null ? '—' : (
                    <>
                      <b style={{ color: RED }}>{usd(r.worstUsd)}</b>
                      <span style={{ color: MUTED }}> a las {when(r.worstAt)}</span>
                    </>
                  )}
                </td>
                <td style={{ ...td, fontWeight: 700, color: color(r.resultUsd) }}>
                  {usd(r.resultUsd)}{r.resultLive ? ' (en vivo)' : ''}
                </td>
                <td style={td}>{closeLabel(r)}</td>
                <td style={td}>{dur(r.totalSec)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
