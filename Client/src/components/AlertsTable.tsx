import { useState } from 'react'
import type { AlertRow, VersionSummary } from '../hooks/useAlerts'

const fmt = (n: number | null | undefined, digits = 1) => (n === null || n === undefined ? '—' : n.toFixed(digits))

const statusText: Record<AlertRow['status'], string> = {
  open: 'abierta',
  touched: 'tocó la EMA',
  expired: '24 h sin tocar',
}

const cell: React.CSSProperties = { padding: '6px 8px', borderBottom: '1px solid rgba(255,255,255,0.05)', whiteSpace: 'nowrap' }
const head: React.CSSProperties = { ...cell, color: '#6b7280', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', textAlign: 'left' }

export function AlertsTable({ alerts, summary, error }: { alerts: AlertRow[]; summary: VersionSummary[]; error: string | null }) {
  const [showHistory, setShowHistory] = useState(false)
  return (
    <div className="glass-panel" style={{ margin: 0 }}>
      <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 4px', color: '#fff' }}>📒 Alertas y marcador</h3>
      <p style={{ margin: '0 0 12px', fontSize: 12, color: '#9ca3af', lineHeight: 1.4 }}>
        MAE = pips que el precio siguió en contra después de la alerta, hasta tocar la EMA 100 o 24 h. Con pocas alertas los números no distinguen una versión buena de una con suerte.
      </p>
      {error && <p style={{ margin: '0 0 12px', fontSize: 12, color: '#f87171' }}>No se pudo leer /alerts: {error}</p>}

      <div style={{ overflowX: 'auto', marginBottom: 16 }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12, fontFamily: 'monospace', color: '#d1d5db' }}>
          <thead>
            <tr>
              <th style={head}>Versión</th>
              <th style={head}>Alertas</th>
              <th style={head}>Abiertas</th>
              <th style={head}>MAE mediana</th>
              <th style={head}>MAE p90</th>
              <th style={head}>MAE máx</th>
              <th style={head}>Tocó EMA en 4 h</th>
              <th style={head}>Min. a la EMA (med.)</th>
            </tr>
          </thead>
          <tbody>
            {summary.length === 0 && (
              <tr><td style={cell} colSpan={8}>Todavía no hay alertas registradas.</td></tr>
            )}
            {summary.map((s) => (
              <tr key={s.version}>
                <td style={cell}>{s.version}</td>
                <td style={cell}>{s.alerts}</td>
                <td style={cell}>{s.open}</td>
                <td style={cell}>{fmt(s.maeMedian)}</td>
                <td style={cell}>{fmt(s.maeP90)}</td>
                <td style={cell}>{fmt(s.maeMax)}</td>
                <td style={cell}>{s.decided4h ? `${s.touchedWithin4h} de ${s.decided4h}` : '—'}</td>
                <td style={cell}>{fmt(s.minutesToEmaMedian, 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        onClick={() => setShowHistory((v) => !v)}
        style={{ background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 6, color: '#d1d5db', padding: '6px 12px', fontSize: 12, cursor: 'pointer', marginBottom: showHistory ? 12 : 0 }}
      >
        {showHistory ? 'Ocultar historial de alertas' : `Ver historial de alertas (${alerts.length})`}
      </button>

      {showHistory && <div style={{ overflowX: 'auto', maxHeight: 420, overflowY: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12, fontFamily: 'monospace', color: '#d1d5db' }}>
          <thead>
            <tr>
              <th style={head}>Hora</th>
              <th style={head}>Versión</th>
              <th style={head}>Par</th>
              <th style={head}>Dir.</th>
              <th style={head}>Precio</th>
              <th style={head}>Escudo</th>
              <th style={head}>MAE</th>
              <th style={head}>MFE</th>
              <th style={head}>Estado</th>
              <th style={head}>Min.</th>
              <th style={head}>Telegram</th>
            </tr>
          </thead>
          <tbody>
            {alerts.map((a) => (
              <tr key={a.id}>
                <td style={cell}>{new Date(a.createdAt).toLocaleString('es-CO', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                <td style={cell}>{a.version}</td>
                <td style={cell}>{a.symbol}</td>
                <td style={{ ...cell, color: a.direction === 'BUY' ? '#34d399' : '#f87171' }}>{a.direction}</td>
                <td style={cell}>{a.price.toFixed(a.symbol.includes('JPY') ? 3 : 5)}</td>
                <td style={cell}>{a.shieldClear === null ? '—' : a.shieldClear ? '✓' : '✗'}</td>
                <td style={cell}>{fmt(a.maePips)}</td>
                <td style={cell}>{fmt(a.mfePips)}</td>
                <td style={cell}>{statusText[a.status]}</td>
                <td style={cell}>{a.minutesToEma ?? '—'}</td>
                <td style={cell}>{a.features?.telegramSuppressedBy ? `🔒 no enviada${a.features.telegramSuppressedBy > 0 ? ` (op. #${a.features.telegramSuppressedBy})` : ''}` : 'enviada'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>}
    </div>
  )
}
