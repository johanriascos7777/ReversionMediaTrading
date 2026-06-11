/**
 * EditTradeModal.tsx
 * Modal premium para editar o actualizar cualquier campo de una operación (abierta o cerrada).
 * Permite calcular de forma automática el "tiempo en holgura" transcurrido desde la apertura.
 */
import { useState, useEffect } from 'react'
import type { Trade, TradeDirection, TradeType, TradeOutcome, CloseReason, TradeMode, AccountType } from '../../hooks/useTrades'
import { API_URL } from '@/config/env'

export const parseScreenshotUrls = (val: any): string[] => {
  const sanitize = (arr: any[]): string[] => {
    return arr.filter(u => typeof u === 'string' && u.length > 5 && u.startsWith('http'))
  }
  if (!val) return []
  if (Array.isArray(val)) return sanitize(val)
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val)
      return Array.isArray(parsed) ? sanitize(parsed) : []
    } catch {
      if (val.startsWith('http') && val.length > 5) {
        return [val]
      }
      return []
    }
  }
  return []
}

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
  const [totalMinutesOpen, setTotalMinutesOpen] = useState(trade.totalMinutesOpen != null ? String(trade.totalMinutesOpen) : '')

  // Señales de entrada editables
  const [elasticityM5State, setElasticityM5State] = useState<string>(trade.elasticityM5State ?? '')
  const [elasticityM15State, setElasticityM15State] = useState<string>(trade.elasticityM15State ?? '')
  const [structureState, setStructureState] = useState<string>(trade.structureState ?? '')
  const [hasTypeC, setHasTypeC] = useState<boolean | null>(trade.hasTypeC ?? null)
  const [hasPedestrianLight, setHasPedestrianLight] = useState<boolean | null>(trade.hasPedestrianLight ?? null)


  const [notes, setNotes] = useState(trade.notes ?? '')
  const [tradeMode, setTradeMode] = useState<TradeMode>(trade.tradeMode ?? 'normal')
  const [accountType, setAccountType] = useState<AccountType>(trade.accountType ?? 'demo')
  const [submitting, setSubmitting] = useState(false)

  // Fecha/hora de apertura editable
  const toLocalDT = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }
  const [openedAtEdit, setOpenedAtEdit] = useState<string>(toLocalDT(new Date(trade.openedAt)))

  // Estados de Screenshots (S3)
  const [screenshotUrls, setScreenshotUrls] = useState<string[]>(parseScreenshotUrls(trade.screenshotUrls))
  const [uploading, setUploading] = useState(false)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)

  const handleUploadScreenshots = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return

    setUploading(true)
    const formData = new FormData()
    Array.from(e.target.files).forEach(file => {
      formData.append('files', file)
    })

    try {
      const res = await fetch(`${API_URL}/trade/${trade.id}/screenshots`, {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) throw new Error('Error al subir imágenes')
      const data = await res.json()
      setScreenshotUrls(parseScreenshotUrls(data.screenshotUrls))
    } catch (err) {
      console.error(err)
      alert('Fallo al subir capturas de pantalla a S3')
    } finally {
      setUploading(false)
    }
  }

  const handleDeleteScreenshot = async (url: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar esta captura?')) return

    try {
      const res = await fetch(`${API_URL}/trade/${trade.id}/screenshots`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      if (!res.ok) throw new Error('Error al eliminar imagen')
      const data = await res.json()
      setScreenshotUrls(parseScreenshotUrls(data.screenshotUrls))
    } catch (err) {
      console.error(err)
      alert('Fallo al eliminar captura de pantalla')
    }
  }

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
      tradeMode,
      accountType,
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
      hasTypeC,
      hasPedestrianLight: tradeMode === 'experimental' ? hasPedestrianLight : null,
      elasticityM5State: (elasticityM5State || null) as any,

      elasticityM15State: (elasticityM15State || null) as any,
      structureState: (structureState || null) as any,
      outcome,
      // Fecha de apertura editable — convertida a ISO string
      openedAt: new Date(openedAtEdit).toISOString() as any,
    }

    if (outcome !== 'open') {
      payload.exitPrice = exitPrice ? parseFloat(exitPrice) : undefined
      payload.closeReason = closeReason
      payload.totalMinutesOpen = totalMinutesOpen ? parseInt(totalMinutesOpen) : undefined
    } else {
      payload.exitPrice = undefined
      payload.closeReason = undefined
      payload.totalMinutesOpen = undefined
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
            {/* Campo editable de fecha/hora de apertura */}
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 9, color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>📅 Editar fecha/hora de apertura</label>
              <input
                type="datetime-local"
                value={openedAtEdit}
                onChange={e => setOpenedAtEdit(e.target.value)}
                style={{
                  padding: '6px 10px', borderRadius: 8, boxSizing: 'border-box' as const,
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(124,58,237,0.3)',
                  color: '#a78bfa', fontSize: 12, outline: 'none', fontFamily: 'monospace',
                  width: '100%',
                }}
              />
              <span style={{ fontSize: 9, color: '#4b5563' }}>Ajusta si la operación fue abierta en otro momento</span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 20 }}>✕</button>
        </div>

        {/* Par + Dirección */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Par">
            <select value={symbol} onChange={e => setSymbol(e.target.value)} style={selectStyle}>
              {[
                'EUR/USD',
                'GBP/USD',
                'USD/JPY',
                'USD/CAD',
                'AUD/USD',
                'EUR/GBP',
                'USD/CHF',
                'CAD/JPY',
                'EUR/CHF'
              ].map(s => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="Dirección">
            <div style={{ display: 'flex', gap: 8 }}>
              {(['BUY', 'SELL'] as TradeDirection[]).map(d => (
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
            {(['scalping', 'swing', 'positional'] as TradeType[]).map(t => (
              <button key={t} type="button" onClick={() => setTradeType(t)} style={{
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

        {/* Modo (Normal vs. Experimental) */}
        <Field label="Modo de Operación">
          <div style={{ display: 'flex', gap: 8 }}>
            {(['normal', 'experimental'] as TradeMode[]).map(m => (
              <button key={m} type="button" onClick={() => setTradeMode(m)} style={{
                flex: 1, padding: '8px 0', borderRadius: 8, cursor: 'pointer',
                fontSize: 12, fontWeight: tradeMode === m ? 700 : 500,
                background: tradeMode === m
                  ? (m === 'experimental' ? 'rgba(167,139,250,0.15)' : 'rgba(16,185,129,0.15)')
                  : 'rgba(255,255,255,0.03)',
                color: tradeMode === m ? (m === 'experimental' ? '#a78bfa' : '#10b981') : '#6b7280',
                border: tradeMode === m
                  ? `1px solid ${m === 'experimental' ? '#a78bfa' : '#10b981'}30`
                  : '1px solid rgba(255,255,255,0.06)',
                textTransform: 'capitalize',
              }}>
                {m === 'experimental' ? '🧪 Experimental' : '💼 Normal'}
              </button>
            ))}
          </div>
        </Field>

        {/* Tipo de Cuenta (Demo vs. Real) */}
        <Field label="Tipo de Cuenta">
          <div style={{ display: 'flex', gap: 8 }}>
            {(['demo', 'real'] as AccountType[]).map(a => (
              <button key={a} type="button" onClick={() => setAccountType(a)} style={{
                flex: 1, padding: '8px 0', borderRadius: 8, cursor: 'pointer',
                fontSize: 12, fontWeight: accountType === a ? 700 : 500,
                background: accountType === a
                  ? (a === 'real' ? 'rgba(16,185,129,0.2)' : 'rgba(167,139,250,0.2)')
                  : 'rgba(255,255,255,0.03)',
                color: accountType === a ? (a === 'real' ? '#10b981' : '#a78bfa') : '#6b7280',
                border: accountType === a
                  ? `1px solid ${a === 'real' ? '#10b981' : '#a78bfa'}30`
                  : '1px solid rgba(255,255,255,0.06)',
                textTransform: 'capitalize',
              }}>
                {a === 'real' ? '👑 Real' : '🎮 Demo'}
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
              {['10', '50', '100', '200', '300', '500', '1000'].map(l => (
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

        {/* Señales de Entrada (M5, M15, Estructura) */}
        <div style={{
          padding: '14px 16px', borderRadius: 12,
          background: 'rgba(255,255,255,0.01)',
          border: '1px solid rgba(255,255,255,0.04)',
          display: 'flex', flexDirection: 'column', gap: 10
        }}>
          <div style={{ fontSize: 10, color: '#a78bfa', textTransform: 'uppercase', fontWeight: 700 }}>
            📊 Señales de Entrada
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="Elasticidad M5">
              <select value={elasticityM5State} onChange={e => setElasticityM5State(e.target.value)} style={selectStyle}>
                <option value="">—</option>
                <option value="GREEN">GREEN</option>
                <option value="YELLOW">YELLOW</option>
                <option value="RED">RED</option>
              </select>
            </Field>
            <Field label="Elasticidad M15">
              <select value={elasticityM15State} onChange={e => setElasticityM15State(e.target.value)} style={selectStyle}>
                <option value="">—</option>
                <option value="GREEN">GREEN</option>
                <option value="YELLOW">YELLOW</option>
                <option value="RED">RED</option>
              </select>
            </Field>
            <Field label="Estructura">
              <select value={structureState} onChange={e => setStructureState(e.target.value)} style={selectStyle}>
                <option value="">—</option>
                <option value="STRONG">STRONG</option>
                <option value="MODERATE">MODERATE</option>
                <option value="WEAK">WEAK</option>
              </select>
            </Field>
            <Field label="Alerta Tipo C">
              <select
                value={hasTypeC === null ? '' : String(hasTypeC)}
                onChange={e => {
                  const val = e.target.value;
                  setHasTypeC(val === '' ? null : val === 'true');
                }}
                style={selectStyle}
              >
                <option value="">—</option>
                <option value="true">Sí</option>
                <option value="false">No</option>
              </select>
            </Field>
            {tradeMode === 'experimental' && (
              <Field label="Semáforo Peatón">
                <select
                  value={hasPedestrianLight === null ? '' : String(hasPedestrianLight)}
                  onChange={e => {
                    const val = e.target.value;
                    setHasPedestrianLight(val === '' ? null : val === 'true');
                  }}
                  style={selectStyle}
                >
                  <option value="">—</option>
                  <option value="true">Sí (WALK)</option>
                  <option value="false">No (STOP)</option>
                </select>
              </Field>
            )}
          </div>

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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Precio de Salida *">
              <input type="number" step="0.00001" value={exitPrice} onChange={e => setExitPrice(e.target.value)} placeholder="Ej: 1.34500" style={inp} />
            </Field>
            <Field label="Duración total (minutos)">
              <input type="number" step="1" value={totalMinutesOpen} onChange={e => setTotalMinutesOpen(e.target.value)} placeholder="Ej: 45" style={inp} />
            </Field>
          </div>
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

        {/* Capturas de Pantalla (Screenshots) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>📸 Capturas de Pantalla ({screenshotUrls.length}/5)</span>
            {uploading && <span style={{ color: '#a78bfa', fontSize: 10, fontWeight: 700 }}>⏳ Subiendo...</span>}
          </label>

          {/* Grid de miniaturas */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {screenshotUrls.map((url, i) => (
              <div key={url} style={{
                position: 'relative', width: 75, height: 75, borderRadius: 10, overflow: 'hidden',
                border: '1px solid rgba(255,255,255,0.1)', background: '#000', cursor: 'pointer',
                transition: 'transform 0.15s ease',
              }} onClick={() => setLightboxUrl(url)}>
                <img src={url} alt={`Screenshot ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                {/* Botón para eliminar */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDeleteScreenshot(url)
                  }}
                  style={{
                    position: 'absolute', top: 4, right: 4, width: 18, height: 18, borderRadius: '50%',
                    background: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.15)',
                    color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', fontSize: 8, fontWeight: 'bold', padding: 0,
                  }}
                  title="Eliminar captura"
                >
                  ✕
                </button>
              </div>
            ))}

            {/* Botón para añadir captura */}
            {screenshotUrls.length < 5 && (
              <label style={{
                width: 75, height: 75, borderRadius: 10, border: '2px dashed rgba(124,58,237,0.3)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', background: 'rgba(124,58,237,0.03)', transition: 'all 0.15s ease',
                color: '#a78bfa', gap: 4,
              }}>
                <span style={{ fontSize: 18, lineHeight: 1 }}>+</span>
                <span style={{ fontSize: 9, fontWeight: 600 }}>Adjuntar</span>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleUploadScreenshots}
                  style={{ display: 'none' }}
                  disabled={uploading}
                />
              </label>
            )}
          </div>
        </div>

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

      {/* Lightbox Modal */}
      {lightboxUrl && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 3000,
          background: 'rgba(0,0,0,0.95)', backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        }} onClick={() => setLightboxUrl(null)}>
          <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
            <img src={lightboxUrl} alt="Screenshot Completa" style={{ maxWidth: '100%', maxHeight: '90vh', borderRadius: 10, boxShadow: '0 20px 50px rgba(0,0,0,0.8)' }} />
            <button
              onClick={() => setLightboxUrl(null)}
              style={{
                position: 'absolute', top: -35, right: 0, background: 'none', border: 'none',
                color: '#fff', fontSize: 28, cursor: 'pointer', outline: 'none',
              }}
            >
              ✕
            </button>
          </div>
        </div>
      )}
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
