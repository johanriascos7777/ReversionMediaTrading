/**
 * TradeModal.tsx
 *
 * Modal para registrar una nueva operación.
 * Auto-captura las señales actuales del dashboard (elasticidad + estructura)
 * y calcula el precio de liquidación en tiempo real mientras el usuario escribe.
 */

import { useState } from 'react'
import type { CreateTradePayload, TradeDirection, TradeType, TradeMode, AccountType } from '../../hooks/useTrades'

interface TradeModalProps {
  onClose: () => void
  onSubmit: (payload: CreateTradePayload) => Promise<void>
  // Señales auto-capturadas del estado del dashboard
  autoCapture?: {
    symbol?: string
    elasticityM5State?: string
    elasticityM15State?: string
    fusedState?: string
    elasticityM5Value?: number
    elasticityM15Value?: number
    structureState?: string
    structureSignal?: string
    rsiAtEntry?: number
    divergenceAtEntry?: string
    ema200SlopeAtEntry?: string
    nearestSRPrice?: number
    nearestSRType?: string
    nearestSRStrength?: number
    nearestSRDistance?: number
    contextualWinRate?: number
    contextualCases?: number
    recommendedTp?: number
    recommendedSl?: number
    currentPrice?: number
  }
}

// Detectar sesión desde hora UTC actual
function detectSessionNow(): string {
  const h = new Date().getUTCHours()
  if (h >= 23 || h < 8) return 'asian'
  if (h >= 8 && h < 12) return 'european'
  return 'american'
}

// Calcular liquidación
function calcLiq(entry: number, leverage: number, spread: number, dir: TradeDirection) {
  const margin = entry / leverage
  if (dir === 'BUY') return { theo: entry - margin, real: entry - margin + spread }
  return { theo: entry + margin, real: entry + margin - spread }
}

export function TradeModal({ onClose, onSubmit, autoCapture }: TradeModalProps) {
  const [symbol, setSymbol] = useState(autoCapture?.symbol ?? 'EUR/USD')
  const [direction, setDirection] = useState<TradeDirection>('BUY')
  const [tradeType, setTradeType] = useState<TradeType>('scalping')
  const [entry, setEntry] = useState(autoCapture?.currentPrice ? String(autoCapture.currentPrice) : '')
  const [leverage, setLeverage] = useState('200')
  const [spread, setSpread] = useState('0.00013')
  const [investment, setInvestment] = useState('2')
  const [notes, setNotes] = useState('')
  const [tradeMode, setTradeMode] = useState<TradeMode>('normal')
  const [accountType, setAccountType] = useState<AccountType>('demo')
  const [submitting, setSubmitting] = useState(false)
  const [isImportant, setIsImportant] = useState(false)

  const [userTp, setUserTp] = useState(autoCapture?.recommendedTp != null ? String(autoCapture.recommendedTp) : '')
  const [userSl, setUserSl] = useState(autoCapture?.recommendedSl != null ? String(autoCapture.recommendedSl) : '')

  // Señales de entrada editables
  const [elasticityM5State, setElasticityM5State] = useState<string>(autoCapture?.elasticityM5State ?? '')
  const [elasticityM15State, setElasticityM15State] = useState<string>(autoCapture?.elasticityM15State ?? '')
  const [structureState, setStructureState] = useState<string>(autoCapture?.structureState ?? '')
  const [hasTypeC, setHasTypeC] = useState<boolean | null>(null)
  const [hasPedestrianLight, setHasPedestrianLight] = useState<boolean | null>(
    autoCapture && 'pedestrianLight' in autoCapture && autoCapture.pedestrianLight
      ? (autoCapture.pedestrianLight as string) === 'WALK'
      : null
  )


  // Fecha/hora de apertura: por defecto "ahora" en local, ajustable
  const toLocalDT = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }
  const [openedAt, setOpenedAt] = useState<string>(toLocalDT(new Date()))

  // Calculadora de liquidación en vivo
  const entryN = parseFloat(entry) || 0
  const leverageN = parseFloat(leverage) || 1
  const spreadN = parseFloat(spread) || 0
  const liq = entryN > 0 ? calcLiq(entryN, leverageN, spreadN, direction) : null

  const handleSubmit = async () => {
    if (!entry || !leverage || !investment) return
    setSubmitting(true)

    const payload: CreateTradePayload = {
      symbol,
      direction,
      tradeType,
      tradeMode,
      accountType,
      isImportant,
      session: detectSessionNow() as any,
      entryPrice: entryN,
      leverage: leverageN,
      spread: spreadN,
      investmentAmount: parseFloat(investment),
      liquidationTheoretical: liq?.theo,
      liquidationReal: liq?.real,
      notes: notes || undefined,
      hasTypeC,
      hasPedestrianLight: tradeMode === 'experimental' ? hasPedestrianLight : null,
      // Fecha de apertura personalizada (convertida a ISO UTC)
      openedAt: new Date(openedAt).toISOString(),
      // TP y SL configurados
      userTp: userTp ? parseFloat(userTp) : undefined,
      userSl: userSl ? parseFloat(userSl) : undefined,
      // Señales auto-capturadas y editables (casts a tipos del DTO)
      elasticityM5State: (elasticityM5State || undefined) as any,

      elasticityM15State: (elasticityM15State || undefined) as any,
      fusedState: autoCapture?.fusedState as any,
      elasticityM5Value: autoCapture?.elasticityM5Value,
      elasticityM15Value: autoCapture?.elasticityM15Value,
      structureState: (structureState || undefined) as any,
      structureSignal: autoCapture?.structureSignal,
      rsiAtEntry: autoCapture?.rsiAtEntry,
      divergenceAtEntry: autoCapture?.divergenceAtEntry as any,
      ema200SlopeAtEntry: autoCapture?.ema200SlopeAtEntry as any,
      nearestSRPrice: autoCapture?.nearestSRPrice,
      nearestSRType: autoCapture?.nearestSRType,
      nearestSRStrength: autoCapture?.nearestSRStrength,
      nearestSRDistance: autoCapture?.nearestSRDistance,
      contextualWinRate: autoCapture?.contextualWinRate,
      contextualCases: autoCapture?.contextualCases,
      recommendedTp: autoCapture?.recommendedTp,
      recommendedSl: autoCapture?.recommendedSl,
    }

    await onSubmit(payload)
    setSubmitting(false)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: '#0d0d14',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 18, padding: '28px 32px',
        width: '100%', maxWidth: 520,
        boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
        display: 'flex', flexDirection: 'column', gap: 20,
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
            ➕ Registrar Operación
            <button
              type="button"
              onClick={() => setIsImportant(!isImportant)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 16, color: isImportant ? '#fbbf24' : '#4b5563',
                padding: 0, margin: '0 4px', display: 'inline-flex',
                transition: 'color 0.15s',
              }}
              title={isImportant ? "Quitar importancia" : "Marcar como importante ⭐"}
            >
              {isImportant ? '★' : '☆'}
            </button>
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 20 }}>✕</button>
        </div>

        {/* Par + Dirección */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Par">
            <select value={symbol} onChange={e => {
              const val = e.target.value;
              setSymbol(val);
              if (val !== autoCapture?.symbol) {
                setEntry('');
              } else {
                setEntry(autoCapture?.currentPrice ? String(autoCapture.currentPrice) : '');
              }
            }} style={selectStyle}>
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
                  fontWeight: 700, fontSize: 13,
                  background: direction === d
                    ? (d === 'BUY' ? 'rgba(16,185,129,0.25)' : 'rgba(244,63,94,0.25)')
                    : 'rgba(255,255,255,0.04)',
                  color: direction === d ? (d === 'BUY' ? '#10b981' : '#f43f5e') : '#6b7280',
                  border: direction === d
                    ? `1px solid ${d === 'BUY' ? '#10b981' : '#f43f5e'}40`
                    : '1px solid rgba(255,255,255,0.08)',
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
                flex: 1, padding: '7px 0', borderRadius: 8, cursor: 'pointer',
                fontSize: 11, fontWeight: tradeType === t ? 700 : 500,
                background: tradeType === t ? 'rgba(167,139,250,0.2)' : 'rgba(255,255,255,0.04)',
                color: tradeType === t ? '#a78bfa' : '#6b7280',
                border: tradeType === t ? '1px solid rgba(167,139,250,0.4)' : '1px solid rgba(255,255,255,0.08)',
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
                flex: 1, padding: '7px 0', borderRadius: 8, cursor: 'pointer',
                fontSize: 11, fontWeight: tradeMode === m ? 700 : 500,
                background: tradeMode === m
                  ? (m === 'experimental' ? 'rgba(167,139,250,0.2)' : 'rgba(16,185,129,0.2)')
                  : 'rgba(255,255,255,0.04)',
                color: tradeMode === m ? (m === 'experimental' ? '#a78bfa' : '#10b981') : '#6b7280',
                border: tradeMode === m
                  ? `1px solid ${m === 'experimental' ? '#a78bfa' : '#10b981'}40`
                  : '1px solid rgba(255,255,255,0.08)',
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
                flex: 1, padding: '7px 0', borderRadius: 8, cursor: 'pointer',
                fontSize: 11, fontWeight: accountType === a ? 700 : 500,
                background: accountType === a
                  ? (a === 'real' ? 'rgba(16,185,129,0.2)' : 'rgba(167,139,250,0.2)')
                  : 'rgba(255,255,255,0.04)',
                color: accountType === a ? (a === 'real' ? '#10b981' : '#a78bfa') : '#6b7280',
                border: accountType === a
                  ? `1px solid ${a === 'real' ? '#10b981' : '#a78bfa'}40`
                  : '1px solid rgba(255,255,255,0.08)',
                textTransform: 'capitalize',
              }}>
                {a === 'real' ? '👑 Real' : '🎮 Demo'}
              </button>
            ))}
          </div>
        </Field>

        {/* Fecha/hora de apertura */}
        <Field label="📅 Fecha y hora de apertura">
          <input
            type="datetime-local"
            value={openedAt}
            onChange={e => setOpenedAt(e.target.value)}
            style={inputStyle}
          />
          <span style={{ fontSize: 9, color: '#6b7280', marginTop: 2 }}>
            Puedes ajustar si registras la operación después de haberla abierto
          </span>
        </Field>

        {/* Precios */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Precio de entrada">
            <input type="number" step="0.00001" value={entry} onChange={e => setEntry(e.target.value)}
              placeholder={autoCapture?.currentPrice ? String(autoCapture.currentPrice) : "1.34059"} style={inputStyle} />
          </Field>
          <Field label="Inversión ($)">
            <input type="number" step="1" value={investment} onChange={e => setInvestment(e.target.value)}
              placeholder="2" style={inputStyle} />
          </Field>
          <Field label="Apalancamiento">
            <select value={leverage} onChange={e => setLeverage(e.target.value)} style={selectStyle}>
              {['10', '50', '100', '200', '300', '500', '1000'].map(l => (
                <option key={l} value={l}>x{l}</option>
              ))}
            </select>
          </Field>
          <Field label="Spread (precio)">
            <input type="number" step="0.00001" value={spread} onChange={e => setSpread(e.target.value)}
              placeholder="0.00013" style={inputStyle} />
          </Field>
        </div>

        {/* 🎯 Take Profit & Stop Loss Ideal (IQ Option / Broker) */}
        {(() => {
          const userTpN = parseFloat(userTp) || 0
          const userSlN = parseFloat(userSl) || 0
          const isJpy = symbol.includes('JPY')
          const pipMultiplier = isJpy ? 100 : (symbol.includes('BTC') || symbol.includes('ETH') ? 1 : 10000)

          const tpPips = (userTpN > 0 && entryN > 0)
            ? (direction === 'BUY' ? userTpN - entryN : entryN - userTpN) * pipMultiplier
            : null

          const slPips = (userSlN > 0 && entryN > 0)
            ? (direction === 'BUY' ? entryN - userSlN : userSlN - entryN) * pipMultiplier
            : null

          const investmentVal = parseFloat(investment) || 0
          const tpPnl = (tpPips !== null && entryN > 0)
            ? ((Math.abs(userTpN - entryN) / entryN) * leverageN * investmentVal)
            : null

          const slLoss = (slPips !== null && entryN > 0)
            ? ((Math.abs(entryN - userSlN) / entryN) * leverageN * investmentVal)
            : null

          const rr = (tpPips !== null && slPips !== null && slPips > 0)
            ? (tpPips / slPips).toFixed(2)
            : null

          return (
            <div style={{
              padding: '14px 16px', borderRadius: 12,
              background: 'linear-gradient(135deg, rgba(56,189,248,0.05) 0%, rgba(124,58,237,0.05) 100%)',
              border: '1px solid rgba(56,189,248,0.2)',
              display: 'flex', flexDirection: 'column', gap: 10
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: '#38bdf8', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.5px' }}>
                  🎯 Take Profit & Stop Loss Configurado (Broker)
                </span>
                {rr && (
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                    background: parseFloat(rr) >= 1.5 ? 'rgba(16,185,129,0.2)' : 'rgba(234,179,8,0.2)',
                    color: parseFloat(rr) >= 1.5 ? '#34d399' : '#facc15',
                    border: `1px solid ${parseFloat(rr) >= 1.5 ? 'rgba(16,185,129,0.3)' : 'rgba(234,179,8,0.3)'}`
                  }}>
                    R:R 1:{rr}
                  </span>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Take Profit Ideal (TP)">
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input
                      type="number"
                      step="0.00001"
                      value={userTp}
                      onChange={e => setUserTp(e.target.value)}
                      placeholder={autoCapture?.recommendedTp ? String(autoCapture.recommendedTp) : "1.34250"}
                      style={{ ...inputStyle, borderColor: userTpN > 0 ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.1)' }}
                    />
                    {autoCapture?.recommendedTp && (
                      <button
                        type="button"
                        onClick={() => setUserTp(String(autoCapture.recommendedTp))}
                        title={`Copiar TP sugerido (${autoCapture.recommendedTp})`}
                        style={{
                          padding: '0 8px', borderRadius: 8, background: 'rgba(56,189,248,0.15)',
                          border: '1px solid rgba(56,189,248,0.3)', color: '#38bdf8', cursor: 'pointer',
                          fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap'
                        }}
                      >
                        ⚡ Sistema
                      </button>
                    )}
                  </div>
                  {tpPips !== null && (
                    <span style={{ fontSize: 10, color: tpPips >= 0 ? '#34d399' : '#f87171', marginTop: 2 }}>
                      {tpPips >= 0 ? `+${tpPips.toFixed(1)} pips` : `${tpPips.toFixed(1)} pips`}
                      {tpPnl !== null && ` (~+$${tpPnl.toFixed(2)})`}
                    </span>
                  )}
                </Field>

                <Field label="Stop Loss (SL)">
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input
                      type="number"
                      step="0.00001"
                      value={userSl}
                      onChange={e => setUserSl(e.target.value)}
                      placeholder={autoCapture?.recommendedSl ? String(autoCapture.recommendedSl) : "1.33850"}
                      style={{ ...inputStyle, borderColor: userSlN > 0 ? 'rgba(244,63,94,0.3)' : 'rgba(255,255,255,0.1)' }}
                    />
                    {autoCapture?.recommendedSl && (
                      <button
                        type="button"
                        onClick={() => setUserSl(String(autoCapture.recommendedSl))}
                        title={`Copiar SL sugerido (${autoCapture.recommendedSl})`}
                        style={{
                          padding: '0 8px', borderRadius: 8, background: 'rgba(244,63,94,0.15)',
                          border: '1px solid rgba(244,63,94,0.3)', color: '#fb7185', cursor: 'pointer',
                          fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap'
                        }}
                      >
                        ⚡ Sistema
                      </button>
                    )}
                  </div>
                  {slPips !== null && (
                    <span style={{ fontSize: 10, color: slPips >= 0 ? '#fb7185' : '#34d399', marginTop: 2 }}>
                      {slPips >= 0 ? `-${slPips.toFixed(1)} pips` : `+${Math.abs(slPips).toFixed(1)} pips`}
                      {slLoss !== null && ` (~-$${slLoss.toFixed(2)})`}
                    </span>
                  )}
                </Field>
              </div>

              {autoCapture?.recommendedTp && (
                <div style={{ fontSize: 10, color: '#9ca3af', display: 'flex', gap: 12, borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: 6 }}>
                  <span>Sugerido Sistema TP: <strong style={{ color: '#38bdf8' }}>{autoCapture.recommendedTp}</strong></span>
                  {autoCapture.recommendedSl && <span>SL: <strong style={{ color: '#fb7185' }}>{autoCapture.recommendedSl}</strong></span>}
                </div>
              )}
            </div>
          )
        })()}

        {/* Calculadora de liquidación en vivo */}
        {liq && (
          <div style={{
            padding: '12px 14px', borderRadius: 10,
            background: 'rgba(244,63,94,0.07)',
            border: '1px solid rgba(244,63,94,0.2)',
          }}>
            <div style={{ fontSize: 10, color: '#f43f5e', textTransform: 'uppercase', fontWeight: 700, marginBottom: 8 }}>
              ☠️ Zona de Liquidación
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <LiqRow label="Teórica (sin spread)" value={liq.theo.toFixed(5)} />
              <LiqRow label="Real (con spread)" value={liq.real.toFixed(5)} highlight />
            </div>
            <div style={{ fontSize: 10, color: '#6b7280', marginTop: 8 }}>
              Distancia real: {Math.abs(entryN - liq.real).toFixed(5)} ({(Math.abs(entryN - liq.real) / entryN * 100).toFixed(3)}% del capital)
            </div>
          </div>
        )}

        {/* Señales de Entrada (M5, M15, Estructura) */}
        <div style={{
          padding: '14px 16px', borderRadius: 12,
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', flexDirection: 'column', gap: 10
        }}>
          <div style={{ fontSize: 10, color: '#a78bfa', textTransform: 'uppercase', fontWeight: 700 }}>
            📊 Señales de Entrada (Auto-capturadas / Editables)
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

          {/* Otras señales auto-capturadas no editables (como RSI, Win Rate, etc.) */}
          {autoCapture && (autoCapture.rsiAtEntry != null || autoCapture.contextualWinRate != null || (autoCapture.divergenceAtEntry && autoCapture.divergenceAtEntry !== 'none')) && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
              {autoCapture.rsiAtEntry != null && <Badge label={`RSI: ${autoCapture.rsiAtEntry.toFixed(1)}`} />}
              {autoCapture.contextualWinRate != null && <Badge label={`WR ctx: ${autoCapture.contextualWinRate}%`} />}
              {autoCapture.divergenceAtEntry && autoCapture.divergenceAtEntry !== 'none' && (
                <Badge label={`Div: ${autoCapture.divergenceAtEntry}`} />
              )}
            </div>
          )}
        </div>

        {/* Notas */}
        <Field label="Notas (opcional)">
          <textarea value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Observaciones de la operación..."
            style={{ ...inputStyle, height: 60, resize: 'vertical', fontFamily: 'inherit' }} />
        </Field>

        {/* Botones */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '11px 0', borderRadius: 10, cursor: 'pointer',
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            color: '#6b7280', fontWeight: 600, fontSize: 13,
          }}>
            Cancelar
          </button>
          <button onClick={handleSubmit} disabled={submitting || !entry} style={{
            flex: 2, padding: '11px 0', borderRadius: 10, cursor: 'pointer',
            background: 'linear-gradient(135deg, #7c3aed, #a78bfa)',
            border: 'none', color: '#fff', fontWeight: 700, fontSize: 13,
            opacity: submitting || !entry ? 0.5 : 1,
          }}>
            {submitting ? 'Registrando...' : '📋 Registrar Operación'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Sub-componentes ─────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>{label}</label>
      {children}
    </div>
  )
}

function LiqRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 9, color: '#6b7280', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 800, color: highlight ? '#f43f5e' : '#9ca3af', fontFamily: 'monospace' }}>
        {value}
      </div>
    </div>
  )
}

function Badge({ label }: { label: string }) {
  return (
    <span style={{
      fontSize: 9, padding: '2px 6px', borderRadius: 4,
      background: 'rgba(255,255,255,0.05)', color: '#9ca3af',
      border: '1px solid rgba(255,255,255,0.08)', fontFamily: 'monospace',
    }}>
      {label}
    </span>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', borderRadius: 8, boxSizing: 'border-box',
  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
  color: '#fff', fontSize: 13, outline: 'none', fontFamily: 'monospace',
}

const selectStyle: React.CSSProperties = {
  ...inputStyle, cursor: 'pointer', appearance: 'none',
}
