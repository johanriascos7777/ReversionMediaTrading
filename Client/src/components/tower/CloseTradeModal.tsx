/**
 * CloseTradeModal.tsx
 * Mini-modal para cerrar una operación abierta.
 */
import { useState } from 'react'
import type { Trade, CloseTradePayload, TradeOutcome, CloseReason } from '../../hooks/useTrades'

interface Props {
  trade: Trade
  onClose: () => void
  onSubmit: (id: number, payload: CloseTradePayload) => Promise<void>
}

export function CloseTradeModal({ trade, onClose, onSubmit }: Props) {
  const [exitPrice,    setExitPrice]    = useState('')
  const [outcome,      setOutcome]      = useState<TradeOutcome>('win')
  const [closeReason,  setCloseReason]  = useState<CloseReason>('manual')
  const [mae,          setMae]          = useState('')
  const [mfe,          setMfe]          = useState('')
  const [minsHolgura,  setMinsHolgura]  = useState('')
  const [minsProfit,   setMinsProfit]   = useState('')
  const [notes,        setNotes]        = useState('')
  const [submitting,   setSubmitting]   = useState(false)

  // P&L preview
  const exitN   = parseFloat(exitPrice) || 0
  const pnlPrev = exitN > 0
    ? ((trade.direction === 'BUY' ? exitN - trade.entryPrice : trade.entryPrice - exitN)
        * trade.leverage * trade.investmentAmount)
    : null

  const handleSubmit = async () => {
    if (!exitPrice) return
    setSubmitting(true)
    await onSubmit(trade.id, {
      exitPrice: exitN,
      outcome,
      closeReason,
      mae: mae ? parseFloat(mae) : undefined,
      mfe: mfe ? parseFloat(mfe) : undefined,
      minutesInHolgura: minsHolgura ? parseInt(minsHolgura) : undefined,
      minutesInProfit:  minsProfit  ? parseInt(minsProfit)  : undefined,
      notes: notes || undefined,
    })
    setSubmitting(false)
  }

  const inp: React.CSSProperties = {
    width: '100%', padding: '7px 10px', borderRadius: 8, boxSizing: 'border-box',
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
    color: '#fff', fontSize: 12, outline: 'none', fontFamily: 'monospace',
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2100,
      background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: '#0d0d14', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 16, padding: '24px 28px', width: '100%', maxWidth: 420,
        boxShadow: '0 24px 60px rgba(0,0,0,0.6)', display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#fff' }}>
            🔒 Cerrar {trade.symbol} {trade.direction}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 18 }}>✕</button>
        </div>

        <div style={{ fontSize: 11, color: '#6b7280', fontFamily: 'monospace' }}>
          Entrada: {trade.entryPrice.toFixed(5)} · x{trade.leverage} · ${trade.investmentAmount}
        </div>

        {/* Precio de salida */}
        <div>
          <label style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Precio de Salida *</label>
          <input type="number" step="0.00001" value={exitPrice} onChange={e => setExitPrice(e.target.value)} placeholder="1.34150" style={inp} />
          {pnlPrev !== null && (
            <div style={{ fontSize: 11, marginTop: 4, color: pnlPrev >= 0 ? '#10b981' : '#f43f5e', fontFamily: 'monospace' }}>
              P&L estimado: {pnlPrev >= 0 ? '+' : ''}{pnlPrev.toFixed(4)} USD
            </div>
          )}
        </div>

        {/* Resultado y Razón */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Resultado</label>
            <div style={{ display: 'flex', gap: 4 }}>
              {(['win','loss','breakeven'] as TradeOutcome[]).map(o => (
                <button key={o} onClick={() => setOutcome(o)} style={{
                  flex: 1, padding: '5px 0', borderRadius: 6, cursor: 'pointer', fontSize: 9, fontWeight: 700,
                  background: outcome === o ? (o === 'win' ? 'rgba(16,185,129,0.25)' : o === 'loss' ? 'rgba(244,63,94,0.25)' : 'rgba(107,114,128,0.25)') : 'rgba(255,255,255,0.04)',
                  color: outcome === o ? (o === 'win' ? '#10b981' : o === 'loss' ? '#f43f5e' : '#9ca3af') : '#4b5563',
                  border: '1px solid rgba(255,255,255,0.06)', textTransform: 'uppercase',
                }}>
                  {o === 'win' ? '✓' : o === 'loss' ? '✗' : '='} {o}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Razón cierre</label>
            <select value={closeReason} onChange={e => setCloseReason(e.target.value as CloseReason)} style={{ ...inp, appearance: 'none' }}>
              <option value="tp">Take Profit</option>
              <option value="sl">Stop Loss</option>
              <option value="signal">Señal contraria</option>
              <option value="manual">Manual</option>
              <option value="time">Tiempo</option>
            </select>
          </div>
        </div>

        {/* MAE / MFE */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>MAE ($) peor punto</label>
            <input type="number" step="0.01" value={mae} onChange={e => setMae(e.target.value)} placeholder="-0.80" style={inp} />
          </div>
          <div>
            <label style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>MFE ($) mejor punto</label>
            <input type="number" step="0.01" value={mfe} onChange={e => setMfe(e.target.value)} placeholder="1.50" style={inp} />
          </div>
        </div>

        {/* Tiempos */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Mins en holgura</label>
            <input type="number" step="1" value={minsHolgura} onChange={e => setMinsHolgura(e.target.value)} placeholder="3" style={inp} />
          </div>
          <div>
            <label style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Mins en positivo</label>
            <input type="number" step="1" value={minsProfit} onChange={e => setMinsProfit(e.target.value)} placeholder="12" style={inp} />
          </div>
        </div>

        <div>
          <label style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Notas</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} style={{ ...inp, height: 50, resize: 'none' }} />
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '10px 0', borderRadius: 8, cursor: 'pointer',
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            color: '#6b7280', fontWeight: 600, fontSize: 12,
          }}>Cancelar</button>
          <button onClick={handleSubmit} disabled={submitting || !exitPrice} style={{
            flex: 2, padding: '10px 0', borderRadius: 8, cursor: 'pointer',
            background: 'linear-gradient(135deg, #10b981, #059669)',
            border: 'none', color: '#fff', fontWeight: 700, fontSize: 12,
            opacity: submitting || !exitPrice ? 0.5 : 1,
          }}>
            {submitting ? 'Cerrando...' : '🔒 Cerrar Operación'}
          </button>
        </div>
      </div>
    </div>
  )
}
