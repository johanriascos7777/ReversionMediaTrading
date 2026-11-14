import { useEffect, useState } from 'react'
import type { CascadeView } from '../hooks/useMarketData'

const decimalsFor = (symbol: string) => (symbol.includes('JPY') ? 3 : 5)
const pipFor = (symbol: string) => (symbol.includes('JPY') ? 0.01 : 0.0001)

const check = (ok: boolean) => (
  <span style={{ color: ok ? '#34d399' : '#6b7280', fontWeight: 700 }}>{ok ? '✓' : '·'}</span>
)

function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(id)
  }, [ms])
  return now
}

export function CascadePanel({ symbol, cascade }: { symbol: string; cascade: CascadeView | null | undefined }) {
  const now = useNow()
  const d = decimalsFor(symbol)
  const pip = pipFor(symbol)

  if (!cascade || !cascade.ready) {
    return (
      <div className="glass-panel" style={{ margin: 0 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 8px', color: '#fff' }}>🌊 v3 · Cascada</h3>
        <p style={{ margin: 0, fontSize: 13, color: '#9ca3af' }}>
          Calentando las EMA 100 de 1m, 5m y 15m de {symbol}...
        </p>
      </div>
    )
  }

  const row = (label: string, value: string, strong = false) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13, padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <span style={{ color: '#9ca3af' }}>{label}</span>
      <span style={{ fontFamily: 'monospace', color: strong ? '#fff' : '#d1d5db', fontWeight: strong ? 700 : 500, textAlign: 'right' }}>{value}</span>
    </div>
  )

  const stretch = cascade.stretchAtr5 ?? 0
  const progress = Math.min(1, stretch / cascade.stretchNeeded)
  const roomOk = (cascade.roomPips ?? 0) >= cascade.roomNeeded
  const ema15Ok = (cascade.ema15Pips ?? 0) > 0
  const sideText = cascade.direction === 'SELL' ? 'estirado arriba → buscaría VENTA' : 'estirado abajo → buscaría COMPRA'
  const ema = (v: number | null) => (v === null ? '—' : v.toFixed(d))
  const dist = (v: number | null) =>
    v === null || cascade.price === null ? '' : ` · ${(Math.abs(cascade.price - v) / pip).toFixed(1)} pips`
  const c = cascade.contract

  let contractBlock = null
  if (c) {
    const s = c.side
    const price = cascade.price ?? c.entry
    const pnl = (s * (c.entry - price)) / pip
    const left = Math.max(0, c.deadline - now)
    const mm = Math.floor(left / 60_000)
    const ss = Math.floor((left % 60_000) / 1000)
    const toStop = (s * (c.stop - price)) / pip
    const toTarget = (s * (price - c.target)) / pip
    contractBlock = (
      <div style={{ marginTop: 14, padding: 12, borderRadius: 10, background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.25)' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 6 }}>
          Contrato en curso · {c.direction === 'BUY' ? '🟢 COMPRA' : '🔴 VENTA'} desde {c.entry.toFixed(d)}
        </div>
        {row('P&L (antes del spread)', `${pnl >= 0 ? '+' : ''}${pnl.toFixed(1)} pips`, true)}
        {row('Stop de referencia (no está en el broker)', `${c.stop.toFixed(d)} · faltan ${toStop.toFixed(1)} pips`)}
        {row('Al objetivo', `${c.target.toFixed(d)} · faltan ${toTarget.toFixed(1)} pips`)}
        {row('Salida forzada en', `${mm}:${String(ss).padStart(2, '0')}`, true)}
        {row('Máx. en contra / a favor', `${c.maePips.toFixed(1)} / ${c.mfePips.toFixed(1)} pips`)}
      </div>
    )
  }

  return (
    <div className="glass-panel" style={{ margin: 0 }}>
      <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 4px', color: '#fff' }}>🌊 v3 · Cascada</h3>
      <p style={{ margin: '0 0 12px', fontSize: 12, color: '#9ca3af', lineHeight: 1.4 }}>
        Avisa cuando, con el precio estirado en 1m, 5m y 15m, la vela de 1m cierra al otro lado de su EMA 100. Precio {sideText}.
      </p>

      <div style={{ height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', marginBottom: 6 }}>
        <div style={{ width: `${progress * 100}%`, height: '100%', background: progress >= 1 ? '#10b981' : '#f59e0b', transition: 'width 0.3s ease' }} />
      </div>
      <div style={{ fontSize: 12, color: cascade.armed ? '#34d399' : '#9ca3af', fontFamily: 'monospace', marginBottom: 12 }}>
        {cascade.armed ? 'ARMADA: falta que la vela de 1m cruce su EMA 100' : 'en espera'}
      </div>

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12, color: '#d1d5db', marginBottom: 10 }}>
        <span>{check(progress >= 1)} estirón {stretch.toFixed(1)} / {cascade.stretchNeeded} ATR5</span>
        <span>{check(cascade.fan)} abanico 1m·5m·15m</span>
        <span>{check(roomOk)} espacio {(cascade.roomPips ?? 0).toFixed(1)} / {cascade.roomNeeded} pips</span>
        <span>{check(ema15Ok)} lado de la 15m</span>
      </div>

      {row('Precio', ema(cascade.price), true)}
      {row('EMA 100 · 1m (dominó 1)', `${ema(cascade.ema1)}${dist(cascade.ema1)}`)}
      {row('EMA 100 · 5m (dominó 2)', `${ema(cascade.ema5)}${dist(cascade.ema5)}`)}
      {row('EMA 100 · 15m (dominó 3)', `${ema(cascade.ema15)}${dist(cascade.ema15)}`)}
      {row('Última alerta', cascade.lastSignalAt ? new Date(cascade.lastSignalAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : '—')}

      {contractBlock}
    </div>
  )
}
