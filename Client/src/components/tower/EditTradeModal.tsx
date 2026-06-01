/**
 * EditTradeModal.tsx
 * Modal premium para editar o actualizar cualquier campo de una operación (abierta o cerrada).
 * Permite calcular de forma automática el "tiempo en holgura" transcurrido desde la apertura.
 */
import { useState, useEffect } from 'react'
import type { Trade, TradeDirection, TradeType, TradeOutcome, CloseReason } from '../../hooks/useTrades'

interface Props {
  trade: Trade
  onClose: () => void
  onSubmit: (id: number, payload: Partial<Trade>) => Promise<void>
}

export function EditTradeModal({ trade, onClose, onSubmit }: Props) {
  const [symbol, setSymbol] = useState(trade.symbol)
  const [direction, setDirection] = useState<TradeDirection>(trade.direction)
  const [tradeType, setTradeType] = useState<TradeType>(trade.tradeType)
  const [entryPrice, setEntryPrice] = useState(String(trade.entryPrice))
  const [leverage, setLeverage] = useState(String(trade.leverage))
  const [spread, setSpread] = useState(String(trade.spread))
  const [investment, setInvestment] = useState(String(trade.investmentAmount))
  
  const [exitPrice, setExitPrice] = useState(trade.exitPrice != null ? String(trade.exitPrice) : '')
  const [outcome, setOutcome] = useState<TradeOutcome>(trade.outcome)
  const [closeReason, setCloseReason] = useState<CloseReason>(trade.closeReason ?? 'manual')
  
  const [recommendedTp, setRecommendedTp] = useState(trade.recommendedTp != null ? String(trade.recommendedTp) : '')
  const [recommendedSl, setRecommendedSl] = useState(trade.recommendedSl != null ? String(trade.recommendedSl) : '')

  const [mae, setMae] = useState(trade.mae != null ? String(trade.mae) : '')
  const [mfe, setMfe] = useState(trade.mfe != null ? String(trade.mfe) : '')
  
  const [minsHolgura, setMinsHolgura] = useState(trade.minutesInHolgura != null ? String(trade.minutesInHolgura) : '')
  const [minsProfit, setMinsProfit] = useState(trade.minutesInProfit != null ? String(trade.minutesInProfit) : '')
  
  const [notes, setNotes] = useState(trade.notes ?? '')
  const [submitting, setSubmitting] = useState(false)

  // Calcular tiempo transcurrido en minutos desde openedAt hasta ahora
  const openedDate = new Date(trade.openedAt)
  const [elapsedMinutes, setElapsedMinutes] = useState(0)

  useEffect(() => {
    const calcElapsed = () => {
      const diffMs = Date.now() - openedDate.getTime()
      setElapsedMinutes(Math.max(0, Math.round(diffMs / 60000)))
    }
    calcElapsed()
    const interval = setInterval(calcElapsed, 30000) // actualizar cada 30s
    return () => clearInterval(interval)
  }, [trade.openedAt])

  const handleAutoHolgura = () => {
    setMinsHolgura(String(elapsedMinutes))
  }

  const handleSubmit = async () => {
    if (!entryPrice || !leverage || !investment) return
    setSubmitting(true)

    const payload: Partial<Trade> = {
      symbol,
      direction,
      tradeType,
      entryPrice: parseFloat(entryPrice),
      leverage: parseInt(leverage),
      spread: parseFloat(spread),
      investmentAmount: parseFloat(investment),
      notes: notes || '',
      recommendedTp: recommendedTp ? parseFloat(recommendedTp) : undefined,
      recommendedSl: recommendedSl ? parseFloat(recommendedSl) : undefined,
      mae: mae ? parseFloat(mae) : undefined,
      mfe: mfe ? parseFloat(mfe) : undefined,
      minutesInHolgura: minsHolgura ? parseInt(minsHolgura) : undefined,
      minutesInProfit: minsProfit ? parseInt(minsProfit) : undefined,
      outcome,
    }

    if (outcome !== 'open') {
      payload.exitPrice = exitPrice ? parseFloat(exitPrice) : undefined
      payload.closeReason = closeReason
    } else {
      payload.exitPrice = undefined
      payload.closeReason = undefined
    }

    await onSubmit(trade.id, payload)
    setSubmitting(false)
  }

  const inp: React.CSSProperties = {
    width: '100%', padding: '8px 10px', borderRadius: 8, boxSizing: 'border-box',
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
    color: '#fff', fontSize: 12, outline: 'none', fontFamily: 'monospace',
  }

  const selectStyle: React.CSSProperties = {
    ...inp, cursor: 'pointer', appearance: 'none',
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2100,
      background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: '#0a0a10', border: '1px solid rgba(124,58,237,0.2)',
        borderRadius: 20, padding: '28px 32px', width: '100%', maxWidth: 560,
        boxShadow: '0 24px 60px rgba(0,0,0,0.8), 0 0 40px rgba(124,58,237,0.05)',
        display: 'flex', flexDirection: 'column', gap: 18,
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
              ✏️ Actualizar Operación #{trade.id}
            </h3>
            <span style={{ fontSize: 11, color: '#6b7280', display: 'block', marginTop: 4 }}>
              Abierta el: {openedDate.toLocaleString()}
            </span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 20 }}>✕</button>
        </div>

        {/* Par + Dirección */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Par">
            <select value={symbol} onChange={e => setSymbol(e.target.value)} style={selectStyle}>
              {['EUR/USD','GBP/USD','USD/JPY','USD/CAD','AUD/USD'].map(s => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="Dirección">
            <div style={{ display: 'flex', gap: 8 }}>
              {(['BUY','SELL'] as TradeDirection[]).map(d => (
                <button key={d} onClick={() => setDirection(d)} style={{
                  flex: 1, padding: '8px 0', borderRadius: 8, cursor: 'pointer',
                  fontWeight: 700, fontSize: 12,
                  background: direction === d
                    ? (d === 'BUY' ? 'rgba(16,185,129,0.2)' : 'rgba(244,63,94,0.2)')
                    : 'rgba(255,255,255,0.03)',
                  color: direction === d ? (d === 'BUY' ? '#10b981' : '#f43f5e') : '#6b7280',
                  border: direction === d
                    ? `1px solid ${d === 'BUY' ? '#10b981' : '#f43f5e'}40`
                    : '1px solid rgba(255,255,255,0.06)',
                }}>
                  {d === 'BUY' ? '↑ BUY' : '↓ SELL'}
                </button>
              ))}
            </div>
          </Field>
        </div>

        {/* Tipo */}
        <Field label="Tipo de operación">
          <div style={{ display: 'flex', gap: 8 }}>
            {(['scalping','swing','positional'] as TradeType[]).map(t => (
              <button key={t} onClick={() => setTradeType(t)} style={{
                flex: 1, padding: '8px 0', borderRadius: 8, cursor: 'pointer',
                fontSize: 12, fontWeight: tradeType === t ? 700 : 500,
                background: tradeType === t ? 'rgba(167,139,250,0.15)' : 'rgba(255,255,255,0.03)',
                color: tradeType === t ? '#a78bfa' : '#6b7280',
                border: tradeType === t ? '1px solid rgba(167,139,250,0.3)' : '1px solid rgba(255,255,255,0.06)',
                textTransform: 'capitalize',
              }}>
                {t}
              </button>
            ))}
          </div>
        </Field>

        {/* Datos de Entrada */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Precio de Entrada">
            <input type="number" step="0.00001" value={entryPrice} onChange={e => setEntryPrice(e.target.value)} style={inp} />
          </Field>
          <Field label="Inversión ($)">
            <input type="number" step="1" value={investment} onChange={e => setInvestment(e.target.value)} style={inp} />
          </Field>
          <Field label="Apalancamiento">
            <select value={leverage} onChange={e => setLeverage(e.target.value)} style={selectStyle}>
              {['10','50','100','200','500','1000'].map(l => (
                <option key={l} value={l}>x{l}</option>
              ))}
            </select>
          </Field>
          <Field label="Spread (precio)">
            <input type="number" step="0.00001" value={spread} onChange={e => setSpread(e.target.value)} style={inp} />
          </Field>
        </div>

        {/* TP / SL Sugeridos */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Recomendador Take Profit">
            <input type="number" step="0.00001" value={recommendedTp} onChange={e => setRecommendedTp(e.target.value)} placeholder="Ej: 1.34800" style={inp} />
          </Field>
          <Field label="Recomendador Stop Loss">
            <input type="number" step="0.00001" value={recommendedSl} onChange={e => setRecommendedSl(e.target.value)} placeholder="Ej: 1.34100" style={inp} />
          </Field>
        </div>

        {/* Separador */}
        <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '4px 0' }} />

        {/* Estado Operativo / Cierre */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Estado de Operación">
            <div style={{ display: 'flex', gap: 4 }}>
              {(['open', 'win', 'loss', 'breakeven'] as TradeOutcome[]).map(o => (
                <button key={o} onClick={() => setOutcome(o)} style={{
                  flex: 1, padding: '6px 0', borderRadius: 6, cursor: 'pointer', fontSize: 10, fontWeight: 700,
                  background: outcome === o
                    ? (o === 'win' ? 'rgba(16,185,129,0.2)' : o === 'loss' ? 'rgba(244,63,94,0.2)' : o === 'open' ? 'rgba(245,158,11,0.2)' : 'rgba(107,114,128,0.2)')
                    : 'rgba(255,255,255,0.03)',
                  color: outcome === o
                    ? (o === 'win' ? '#10b981' : o === 'loss' ? '#f43f5e' : o === 'open' ? '#f59e0b' : '#9ca3af')
                    : '#555861',
                  border: outcome === o
                    ? `1px solid ${o === 'win' ? '#10b981' : o === 'loss' ? '#f43f5e' : o === 'open' ? '#f59e0b' : '#9ca3af'}40`
                    : '1px solid rgba(255,255,255,0.06)',
                  textTransform: 'uppercase',
                }}>
                  {o === 'win' ? '✓ WIN' : o === 'loss' ? '✗ LOSS' : o === 'open' ? '⏳ OPEN' : '= BE'}
                </button>
              ))}
            </div>
          </Field>

          {outcome !== 'open' && (
            <Field label="Razón de Cierre">
              <select value={closeReason} onChange={e => setCloseReason(e.target.value as CloseReason)} style={selectStyle}>
                <option value="tp">Take Profit (TP)</option>
                <option value="sl">Stop Loss (SL)</option>
                <option value="signal">Señal contraria</option>
                <option value="manual">Manual</option>
                <option value="time">Tiempo</option>
              </select>
            </Field>
          )}
        </div>

        {outcome !== 'open' && (
          <Field label="Precio de Salida *">
            <input type="number" step="0.00001" value={exitPrice} onChange={e => setExitPrice(e.target.value)} placeholder="Ej: 1.34500" style={inp} />
          </Field>
        )}

        {/* Métricas: MAE / MFE */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="MAE ($) Peor Punto (Adverse Excursion)">
            <input type="number" step="0.01" value={mae} onChange={e => setMae(e.target.value)} placeholder="Ej: -0.50" style={inp} />
          </Field>
          <Field label="MFE ($) Mejor Punto (Favorable Excursion)">
            <input type="number" step="0.01" value={mfe} onChange={e => setMfe(e.target.value)} placeholder="Ej: 1.20" style={inp} />
          </Field>
        </div>

        {/* Tiempos en Holgura y Positivo */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
              <label style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>Mins en holgura</label>
              <button
                type="button"
                onClick={handleAutoHolgura}
                style={{
                  background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)',
                  color: '#a78bfa', borderRadius: 4, padding: '2px 6px', fontSize: 9, cursor: 'pointer',
                  fontWeight: 700, transition: 'all 0.15s'
                }}
                title={`Registrar tiempo transcurrido desde apertura (${elapsedMinutes}m)`}
              >
                ⏱️ Auto ({elapsedMinutes}m)
              </button>
            </div>
            <input type="number" step="1" value={minsHolgura} onChange={e => setMinsHolgura(e.target.value)} placeholder="Ej: 5" style={inp} />
            <span style={{ fontSize: 9, color: '#4b5563', marginTop: 4, display: 'block' }}>
              Minutos transcurridos desde que se abrió: <strong>{elapsedMinutes} min</strong>
            </span>
          </div>

          <Field label="Mins en positivo">
            <input type="number" step="1" value={minsProfit} onChange={e => setMinsProfit(e.target.value)} placeholder="Ej: 15" style={inp} />
          </Field>
        </div>

        {/* Notas */}
        <Field label="Notas de la Operación">
          <textarea value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Anotaciones, lecciones o capturas..."
            style={{ ...inp, height: 60, resize: 'vertical', fontFamily: 'inherit' }} />
        </Field>

        {/* Acciones del Modal */}
        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <button type="button" onClick={onClose} style={{
            flex: 1, padding: '11px 0', borderRadius: 10, cursor: 'pointer',
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            color: '#6b7280', fontWeight: 600, fontSize: 13,
          }}>
            Cancelar
          </button>
          <button type="button" onClick={handleSubmit} disabled={submitting} style={{
            flex: 2, padding: '11px 0', borderRadius: 10, cursor: 'pointer',
            background: 'linear-gradient(135deg, #7c3aed, #a78bfa)',
            border: 'none', color: '#fff', fontWeight: 700, fontSize: 13,
            boxShadow: '0 4px 15px rgba(124,58,237,0.3)',
            opacity: submitting ? 0.5 : 1,
          }}>
            {submitting ? 'Guardando...' : '💾 Guardar Cambios'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>{label}</label>
      {children}
    </div>
  )
}
