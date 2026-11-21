import { useCallback, useEffect, useMemo, useState } from 'react'

type Session = 'asian' | 'european' | 'american'
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
  session: Session
}

type Summary = {
  operations: number
  closed: number
  everGreen: number
  neverGreen: number
  closedUsd: number
  openUsd: number
  wins: number
  winsUsd: number
  losses: number
  lossesUsd: number
  avgWinUsd: number | null
  avgLossUsd: number | null
  avgClosedUsd: number | null
  closedBy: Record<'objetivo' | 'tiempo' | 'otro', { n: number; usd: number }>
  slackMedianSec: number | null
  redAt5: number
  redAt10: number
  pastMinute5: number
  pastMinute10: number
}

type Decision = 'tomada' | 'dejada' | 'rechazada' | 'bloqueada'

type DecisionRow = {
  alertId: number
  at: string
  symbol: string
  direction: 'BUY' | 'SELL'
  decision: Decision
  positionId: number | null
  finished: boolean
  reason: string
  reachedTarget: boolean
  pips: number | null
  minutes: number | null
  maePips: number | null
  mfePips: number | null
  contractUsd: number | null
  realUsd: number | null
  copilot: string | null
  session: Session
}

type DecisionGroup = {
  alerts: number
  finished: number
  reachedTarget: number
  contractUsd: number
  withUsd: number
  realUsd: number | null
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

const SESSION_LABEL: Record<Session, string> = {
  american: '🗽 Americana',
  asian: '🌏 Asiática',
  european: '🇪🇺 Europea',
}

const SESSION_HOURS: Record<Session, string> = {
  asian: '23:00–08:00 UTC',
  european: '08:00–12:00 UTC',
  american: '12:00–23:00 UTC',
}

const pct = (a: number, b: number) => (b === 0 ? '—' : `${Math.round((a / b) * 100)} %`)

const DECISION_LABEL: Record<Decision, string> = {
  tomada: 'La tomaste',
  dejada: 'La dejaste pasar',
  rechazada: 'Rechazada por el broker',
  bloqueada: 'Bloqueada (otra abierta en el par)',
}

const REASON_LABEL: Record<string, string> = {
  objetivo: 'objetivo',
  ema: 'tocó la EMA',
  tiempo: 'tiempo (175 min)',
  stop: 'stop',
  broker: 'cerrada en el broker',
  'en-curso': 'en curso',
  'sin-resultado': 'sin resultado',
}

const box: React.CSSProperties = { padding: '10px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', fontSize: 13, lineHeight: 1.6 }

const th: React.CSSProperties = { padding: '8px 10px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.4px', borderBottom: '1px solid rgba(255,255,255,0.1)', whiteSpace: 'nowrap' }
const select: React.CSSProperties = { background: '#111827', color: '#e5e7eb', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, padding: '4px 8px', fontSize: 13 }
const td: React.CSSProperties = { padding: '8px 10px', fontSize: 13, borderBottom: '1px solid rgba(255,255,255,0.05)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }

export function OperationsTable() {
  const [rows, setRows] = useState<OperationRow[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [decisions, setDecisions] = useState<DecisionRow[]>([])
  const [groups, setGroups] = useState<Record<Decision, DecisionGroup> | null>(null)
  const [bySession, setBySession] = useState<{ session: Session; summary: Summary }[]>([])
  const [allSymbols, setAllSymbols] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [symbol, setSymbol] = useState<string>('')
  const [session, setSession] = useState<Session | ''>('')

  const symbols = useMemo(() => Array.from(new Set(allSymbols)).sort(), [allSymbols])

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (symbol) params.set('symbol', symbol)
      if (session) params.set('session', session)
      const res = await fetch(`${API_URL}/execution/table?${params}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const body = await res.json()
      setRows(body.rows)
      setSummary(body.summary)
      setBySession(body.bySession ?? [])
      const dres = await fetch(`${API_URL}/execution/decisions?${params}`)
      if (!dres.ok) throw new Error(`HTTP ${dres.status}`)
      const dbody = await dres.json()
      setDecisions(dbody.rows)
      setGroups(dbody.groups)
      setAllSymbols([...(body.symbols ?? []), ...(dbody.symbols ?? [])])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [symbol, session])

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

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', fontSize: 13, marginBottom: 16 }}>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          Par:
          <select value={symbol} onChange={(e) => setSymbol(e.target.value)} style={select}>
            <option value="">Todos</option>
            {symbols.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          Sesión:
          <select value={session} onChange={(e) => setSession(e.target.value as Session | '')} style={select}>
            <option value="">Todas</option>
            {(['american', 'asian', 'european'] as Session[]).map((s) => <option key={s} value={s}>{SESSION_LABEL[s]}</option>)}
          </select>
        </label>
        {(symbol || session) && <span style={{ color: MUTED }}>{rows.length} operaciones · {decisions.length} alertas · el resumen de abajo es solo de este filtro</span>}
      </div>

      {summary && (
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: 13, marginBottom: 16 }}>
          <span>{summary.operations} operaciones · {summary.closed} cerradas</span>
          <span style={{ color: GREEN }}>{summary.everGreen} llegaron a verde</span>
          <span style={{ color: RED }}>{summary.neverGreen} nunca</span>
          <span>Cerradas: <b style={{ color: color(summary.closedUsd) }}>{usd(summary.closedUsd)}</b></span>
          <span>Abiertas: <b style={{ color: color(summary.openUsd) }}>{usd(summary.openUsd)}</b></span>
        </div>
      )}
      {summary && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
          <div style={box}>
            <div style={{ color: MUTED, fontSize: 11 }}>RESULTADO REAL DE LAS CERRADAS</div>
            <div><b style={{ color: GREEN }}>{summary.wins} ganadas {usd(summary.winsUsd)}</b> · media {usd(summary.avgWinUsd)}</div>
            <div><b style={{ color: RED }}>{summary.losses} perdidas {usd(summary.lossesUsd)}</b> · media {usd(summary.avgLossUsd)}</div>
          </div>
          <div style={box}>
            <div style={{ color: MUTED, fontSize: 11 }}>CÓMO CERRARON</div>
            <div>Objetivo (TP): {summary.closedBy.objetivo.n} · <b style={{ color: color(summary.closedBy.objetivo.usd) }}>{usd(summary.closedBy.objetivo.usd)}</b></div>
            <div>Reloj de 175 min: {summary.closedBy.tiempo.n} · <b style={{ color: color(summary.closedBy.tiempo.usd) }}>{usd(summary.closedBy.tiempo.usd)}</b></div>
            <div>Otros: {summary.closedBy.otro.n} · <b style={{ color: color(summary.closedBy.otro.usd) }}>{usd(summary.closedBy.otro.usd)}</b></div>
          </div>
          <div style={box}>
            <div style={{ color: MUTED, fontSize: 11 }}>TIEMPO HASTA EL VERDE</div>
            <div>Mediana: <b>{dur(summary.slackMedianSec)}</b></div>
            <div>En rojo a los 5 min: {summary.redAt5} de {summary.pastMinute5} ({pct(summary.redAt5, summary.pastMinute5)})</div>
            <div>En rojo a los 10 min: {summary.redAt10} de {summary.pastMinute10} ({pct(summary.redAt10, summary.pastMinute10)})</div>
          </div>
        </div>
      )}
      {bySession.length > 0 && (
        <div style={{ ...box, marginBottom: 16, overflowX: 'auto' }}>
          <div style={{ color: MUTED, fontSize: 11 }}>POR SESIÓN{symbol ? ` · ${symbol}` : ''} (hora de apertura)</div>
          <table style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>Sesión</th>
                <th style={th}>Cerradas</th>
                <th style={th}>Ganadas / perdidas</th>
                <th style={th}>Resultado</th>
                <th style={th}>Media por operación</th>
                <th style={th}>Media ganada / perdida</th>
                <th style={th}>Llegaron a verde</th>
                <th style={th}>Mediana hasta el verde</th>
                <th style={th}>En rojo a los 5 min</th>
              </tr>
            </thead>
            <tbody>
              {bySession.map(({ session: s, summary: g }) => (
                <tr key={s} style={{ background: session === s ? 'rgba(37,99,235,0.08)' : undefined }}>
                  <td style={{ ...td, fontWeight: 700 }} title={SESSION_HOURS[s]}>{SESSION_LABEL[s]}</td>
                  <td style={td}>{g.closed}</td>
                  <td style={td}><span style={{ color: GREEN }}>{g.wins}</span> / <span style={{ color: RED }}>{g.losses}</span></td>
                  <td style={{ ...td, fontWeight: 700, color: color(g.closedUsd) }}>{usd(g.closedUsd)}</td>
                  <td style={{ ...td, fontWeight: 700, color: color(g.avgClosedUsd) }}>{usd(g.avgClosedUsd)}</td>
                  <td style={td}><span style={{ color: GREEN }}>{usd(g.avgWinUsd)}</span> / <span style={{ color: RED }}>{usd(g.avgLossUsd)}</span></td>
                  <td style={td}>{g.everGreen} de {g.operations} ({pct(g.everGreen, g.operations)})</td>
                  <td style={td}>{dur(g.slackMedianSec)}</td>
                  <td style={td}>{g.redAt5} de {g.pastMinute5} ({pct(g.redAt5, g.pastMinute5)})</td>
                </tr>
              ))}
            </tbody>
          </table>
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
              <th style={th}>Sesión</th>
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
                <td style={td}>{SESSION_LABEL[r.session]}</td>
                <td style={td}>{r.slackBeforeGreenSec === null ? <span style={{ color: RED }}>nunca llegó a verde</span> : dur(r.slackBeforeGreenSec)}</td>
                <td style={td}>
                  {r.bestUsd === null ? '—' : (
                    <>
                      <b style={{ color: GREEN }}>{usd(r.bestUsd)}</b>
                      <span style={{ color: MUTED }}> a las {when(r.bestAt)} ({dur(r.bestAfterSec)})</span>
                    </>
                  )}
                </td>
                <td style={td}>{r.greenPhases === 0 ? '—' : `${dur(r.greenSec)} · ${r.greenPhases} ${r.greenPhases === 1 ? 'tramo' : 'tramos'}`}</td>
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

      <h2 style={{ fontSize: 17, fontWeight: 800, margin: '32px 0 4px' }}>Alertas: las que tomaste y las que dejaste pasar</h2>
      <p style={{ fontSize: 12, color: MUTED, margin: '0 0 16px' }}>
        Cada alerta v3 sigue su contrato aunque no la abras. "Contrato" = cuánto habría dado con el tamaño del sistema, en precios de Twelve Data y sin spread. "Real" = USD de Capital.com.
      </p>
      {groups && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
          {(['tomada', 'dejada', 'rechazada', 'bloqueada'] as Decision[]).map((d) => {
            const g = groups[d]
            return (
              <div key={d} style={box}>
                <div style={{ color: MUTED, fontSize: 11 }}>{DECISION_LABEL[d].toUpperCase()}</div>
                <div><b>{g.alerts}</b> alertas · {g.finished} terminadas</div>
                <div>Llegaron al objetivo: {g.reachedTarget} ({pct(g.reachedTarget, g.withUsd)})</div>
                <div>Contrato: <b style={{ color: color(g.contractUsd) }}>{usd(g.contractUsd)}</b> ({g.withUsd} con resultado)</div>
                {g.realUsd !== null && <div>Real: <b style={{ color: color(g.realUsd) }}>{usd(g.realUsd)}</b></div>}
              </div>
            )
          })}
        </div>
      )}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={th}>Alerta</th>
              <th style={th}>Hora</th>
              <th style={th}>Sesión</th>
              <th style={th}>Par</th>
              <th style={th}>Lado</th>
              <th style={th}>Decisión</th>
              <th style={th}>Copiloto</th>
              <th style={th}>Cómo terminó</th>
              <th style={th}>Pips</th>
              <th style={th}>Máx. en contra / a favor</th>
              <th style={th}>Contrato</th>
              <th style={th}>Real</th>
            </tr>
          </thead>
          <tbody>
            {decisions.map((r) => (
              <tr key={r.alertId}>
                <td style={td}>{r.alertId}{r.positionId !== null ? <span style={{ color: MUTED }}> · op #{r.positionId}</span> : null}</td>
                <td style={td}>{when(r.at)}</td>
                <td style={td}>{SESSION_LABEL[r.session]}</td>
                <td style={{ ...td, fontWeight: 700 }}>{r.symbol}</td>
                <td style={{ ...td, color: r.direction === 'BUY' ? GREEN : RED }}>{r.direction}</td>
                <td style={td}>{DECISION_LABEL[r.decision]}</td>
                <td style={{ ...td, color: MUTED }}>{r.copilot ?? '—'}</td>
                <td style={td}>{REASON_LABEL[r.reason] ?? r.reason}{r.minutes !== null ? <span style={{ color: MUTED }}> · {r.minutes} min</span> : null}</td>
                <td style={{ ...td, color: color(r.pips) }}>{r.pips === null ? '—' : `${r.pips > 0 ? '+' : ''}${r.pips.toFixed(1)}`}</td>
                <td style={{ ...td, color: MUTED }}>{r.maePips ?? '—'} / {r.mfePips ?? '—'}</td>
                <td style={{ ...td, fontWeight: 700, color: color(r.contractUsd) }}>{usd(r.contractUsd)}</td>
                <td style={{ ...td, color: color(r.realUsd) }}>{usd(r.realUsd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
