/**
 * AnalyticsPanel.tsx
 * Panel de métricas y estadísticas de trading.
 */
import type { Analytics, GroupStat } from '../../hooks/useTrades'

interface Props {
  analytics: Analytics | null
}

export function AnalyticsPanel({ analytics }: Props) {
  if (!analytics) {
    return (
      <div style={{
        padding: '40px 20px', textAlign: 'center',
        border: '1px solid rgba(255,255,255,0.05)', borderRadius: 14,
        color: '#4b5563', fontSize: 13,
      }}>
        📊 Los analytics aparecerán aquí cuando cierres tu primera operación.
      </div>
    )
  }

  const { summary, bySession, bySymbol, byStructure, byTradeType, losingPattern } = analytics

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Alerta de patrón perdedor */}
      {losingPattern.active && (
        <div style={{
          padding: '14px 18px', borderRadius: 12,
          background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)',
          color: '#f43f5e', fontSize: 13, fontWeight: 600,
        }}>
          {losingPattern.message}
        </div>
      )}

      {/* KPIs principales */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12 }}>
        <KPI label="Win Rate"      value={`${summary.winRate}%`}
          color={summary.winRate >= 50 ? '#10b981' : '#f43f5e'} />
        <KPI label="P&L Total"     value={`${summary.totalPnl >= 0 ? '+' : ''}$${summary.totalPnl}`}
          color={summary.totalPnl >= 0 ? '#10b981' : '#f43f5e'} />
        <KPI label="Operaciones"   value={`${summary.totalTrades}`} />
        <KPI label="Ganadas"       value={`${summary.wins}`} color="#10b981" />
        <KPI label="Perdidas"      value={`${summary.losses}`} color="#f43f5e" />
        <KPI label="Breakeven"     value={`${summary.breakeven}`} color="#9ca3af" />
        <KPI label="Abiertas"      value={`${summary.open}`} color="#f59e0b" />
        <KPI label="MAE promedio"  value={summary.avgMAE != null ? `$${summary.avgMAE}` : '—'} color="#f43f5e" />
        <KPI label="MFE promedio"  value={summary.avgMFE != null ? `$${summary.avgMFE}` : '—'} color="#10b981" />
        <KPI label="Duración prom" value={summary.avgDuration != null ? `${summary.avgDuration}m` : '—'} />
      </div>

      {/* Grids de stats por grupo */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>

        <StatGroup title="📅 Por Sesión" rows={bySession} />
        <StatGroup title="💱 Por Par" rows={bySymbol} />
        <StatGroup title="🏛️ Por Structure State" rows={byStructure} />
        <StatGroup title="⚡ Por Tipo" rows={byTradeType} />

      </div>

      {/* MAE vs MFE insight */}
      {summary.avgMAE != null && summary.avgMFE != null && (
        <div style={{
          padding: '14px 18px', borderRadius: 12,
          background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 8, textTransform: 'uppercase', fontWeight: 700 }}>
            🔬 Análisis de Riesgo Real
          </div>
          <div style={{ fontSize: 13, color: '#d1d5db', lineHeight: 1.6 }}>
            Tu MAE promedio es <span style={{ color: '#f43f5e', fontWeight: 700 }}>${summary.avgMAE}</span> y
            tu MFE promedio es <span style={{ color: '#10b981', fontWeight: 700 }}>${summary.avgMFE}</span>.
            {summary.avgMAE > summary.avgMFE
              ? ' ⚠️ Estás asumiendo más riesgo del que estás capturando en ganancias. Considera entrar más tarde o salir antes del MAE máximo.'
              : ' ✅ Tu ratio MFE/MAE es positivo — capturas más de lo que arriesgas en promedio.'
            }
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Sub-componentes ─────────────────────────────────────────────────────────

function KPI({ label, value, color = '#fff' }: { label: string; value: string; color?: string }) {
  return (
    <div style={{
      padding: '14px 16px', borderRadius: 12,
      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color, fontFamily: 'monospace' }}>{value}</div>
    </div>
  )
}

function StatGroup({ title, rows }: { title: string; rows: GroupStat[] }) {
  if (!rows.length) return null
  return (
    <div style={{
      background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
      borderRadius: 12, padding: '16px',
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 12 }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {rows.map(row => (
          <div key={row.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: '#9ca3af', minWidth: 90, textTransform: 'capitalize' }}>
              {row.name}
            </span>
            {/* Barra de win rate */}
            <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{
                width: `${row.winRate}%`, height: '100%', borderRadius: 3,
                background: row.winRate >= 50 ? '#10b981' : row.winRate >= 35 ? '#f59e0b' : '#f43f5e',
                transition: 'width 0.4s ease',
              }} />
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, minWidth: 36, textAlign: 'right',
              color: row.winRate >= 50 ? '#10b981' : '#f43f5e', fontFamily: 'monospace' }}>
              {row.winRate}%
            </span>
            <span style={{ fontSize: 10, color: '#4b5563', minWidth: 28 }}>{row.total}op</span>
            <span style={{ fontSize: 10, fontFamily: 'monospace', minWidth: 52, textAlign: 'right',
              color: row.pnl >= 0 ? '#10b981' : '#f43f5e' }}>
              {row.pnl >= 0 ? '+' : ''}${row.pnl}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
