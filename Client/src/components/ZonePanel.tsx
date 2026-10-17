import type { ZoneView } from '../hooks/useMarketData'

const decimalsFor = (symbol: string) => (symbol.includes('JPY') ? 3 : 5)

export function ZonePanel({ symbol, price, zone }: { symbol: string; price: number; zone: ZoneView | null | undefined }) {
  if (!zone) {
    return (
      <div className="glass-panel" style={{ margin: 0 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 8px', color: '#fff' }}>🧪 Zona de agotamiento (v2)</h3>
        <p style={{ margin: 0, fontSize: 13, color: '#9ca3af' }}>Esperando el historial largo de {symbol}...</p>
      </div>
    )
  }

  const d = decimalsFor(symbol)
  const inside = zone.distanceAtr >= zone.q75Atr
  const progress = Math.min(1, zone.distanceAtr / Math.max(zone.q75Atr, 0.0001))
  const sideText = zone.direction === 'SELL' ? 'por encima de la EMA (venta)' : 'por debajo de la EMA (compra)'
  const row = (label: string, value: string, strong = false) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <span style={{ color: '#9ca3af' }}>{label}</span>
      <span style={{ fontFamily: 'monospace', color: strong ? '#fff' : '#d1d5db', fontWeight: strong ? 700 : 500 }}>{value}</span>
    </div>
  )

  return (
    <div className="glass-panel" style={{ margin: 0 }}>
      <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 4px', color: '#fff' }}>🧪 Zona de agotamiento (v2)</h3>
      <p style={{ margin: '0 0 12px', fontSize: 12, color: '#9ca3af', lineHeight: 1.4 }}>
        Dónde terminaron los estirones pasados de {symbol}. Precio {sideText}.
      </p>

      <div style={{ height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', marginBottom: 6 }}>
        <div style={{ width: `${progress * 100}%`, height: '100%', background: inside ? '#10b981' : '#f59e0b', transition: 'width 0.3s ease' }} />
      </div>
      <div style={{ fontSize: 12, color: inside ? '#34d399' : '#fbbf24', fontFamily: 'monospace', marginBottom: 12 }}>
        {zone.distanceAtr.toFixed(2)} ATR de {zone.q75Atr.toFixed(2)} (p75) · {inside ? 'dentro de la zona' : 'fuera de la zona'}
        {zone.alerted ? ' · v2 ya avisó en este estirón' : ''}
      </div>

      {row('Precio', price.toFixed(d), true)}
      {row('EMA 100 (objetivo)', `${zone.ema.toFixed(d)} · ${zone.distancePips.toFixed(1)} pips`)}
      {row('Zona p50', zone.q50.toFixed(d))}
      {row('Zona p75 (dispara v2)', zone.q75.toFixed(d), true)}
      {row('Zona p90', zone.q90.toFixed(d))}
      {row('Si sigue estirando tras p75', `+${zone.residualMedianPips.toFixed(1)} med · +${zone.residualP90Pips.toFixed(1)} p90 · +${zone.residualMaxPips.toFixed(1)} máx (pips)`)}
      {row('Volvieron a la EMA en 4 h', zone.touch4h === null ? 'sin datos' : `${Math.round(zone.touch4h * 100)} %`)}
      {row('Historial', `${zone.episodes} episodios · ${zone.source}`)}
    </div>
  )
}
