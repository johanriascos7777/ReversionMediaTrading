/**
 * HolguraCalculator.tsx
 *
 * Calculadora simplificada y gráfica de Holgura (Margen de Drawdown y Liquidación).
 * Utiliza exactamente las fórmulas requeridas por el usuario.
 */

import { useState, useEffect } from 'react'
import { useMarketData } from '../hooks/useMarketData'

// Símbolos Forex soportados y sus valores típicos
const SYMBOL_DEFAULTS: { [key: string]: { spread: number; price: number; pipSize: number; isJpy?: boolean } } = {
  'EUR/USD': { spread: 0.00013, price: 1.08500, pipSize: 0.0001 },
  'GBP/USD': { spread: 0.00018, price: 1.27200, pipSize: 0.0001 },
  'USD/JPY': { spread: 0.015, price: 156.50, pipSize: 0.01, isJpy: true },
  'USD/CAD': { spread: 0.00018, price: 1.36500, pipSize: 0.0001 },
  'AUD/USD': { spread: 0.00016, price: 0.66500, pipSize: 0.0001 },
  'EUR/GBP': { spread: 0.00018, price: 0.85200, pipSize: 0.0001 },
  'USD/CHF': { spread: 0.00018, price: 0.89500, pipSize: 0.0001 },
  'CAD/JPY': { spread: 0.022, price: 114.50, pipSize: 0.01, isJpy: true },
  'EUR/CHF': { spread: 0.00020, price: 0.97200, pipSize: 0.0001 }
}

const ASSET_PIP_PRESETS = [
  { label: 'Forex Estándar (Pip = 0.0001)', pipSize: 0.0001, minDec: 5 },
  { label: 'Forex JPY (Pip = 0.01)', pipSize: 0.01, minDec: 3 },
  { label: 'Oro / Metales (XAU) (Pip = 0.01)', pipSize: 0.01, minDec: 2 },
  { label: 'Índices / Petróleo (Pip = 0.1)', pipSize: 0.1, minDec: 2 },
  { label: 'Crypto / Puntos (Pip = 1.0)', pipSize: 1.0, minDec: 2 },
]

const SUPPORTED_SYMBOLS = Object.keys(SYMBOL_DEFAULTS)

export function HolguraCalculator() {
  const { data: market, status: wsStatus } = useMarketData()

  // Estados de entrada
  const [symbol, setSymbol] = useState('EUR/USD')
  const [customSymbol, setCustomSymbol] = useState('')
  const [isCustomAsset, setIsCustomAsset] = useState(false)
  const [customPipSize, setCustomPipSize] = useState('0.0001')
  const [direction, setDirection] = useState<'BUY' | 'SELL'>('BUY')
  const [entryPrice, setEntryPrice] = useState('1.08500')
  const [leverage, setLeverage] = useState('200')
  const [investment, setInvestment] = useState('2')
  const [spreadPips, setSpreadPips] = useState('1.3')
  const [includeSpread, setIncludeSpread] = useState(true)
  const [isManualPrice, setIsManualPrice] = useState(false)
  const [manualLivePrice, setManualLivePrice] = useState('')

  // Holgura objetivo para cálculo inverso
  const [targetPips, setTargetPips] = useState('40')

  const activeSymbolName = isCustomAsset ? (customSymbol.trim() || 'Activo Personalizado') : symbol
  const isJpy = !isCustomAsset && symbol.toUpperCase().includes('JPY')
  
  // Tamaño de pip activo
  const pipSize = isCustomAsset 
    ? (parseFloat(customPipSize) || 0.0001) 
    : (SYMBOL_DEFAULTS[symbol]?.pipSize || (isJpy ? 0.01 : 0.0001))

  // Sincronizar precio en vivo por WebSocket si no está en modo manual ni personalizado
  useEffect(() => {
    if (!isCustomAsset && market && market[symbol] && !isManualPrice) {
      setEntryPrice(market[symbol].m5.price.toFixed(isJpy ? 3 : 5))
    }
  }, [market, symbol, isManualPrice, isJpy, isCustomAsset])

  // Cargar defaults cuando cambia el símbolo predeterminado
  useEffect(() => {
    if (isCustomAsset) return
    const defaults = SYMBOL_DEFAULTS[symbol]
    if (defaults) {
      const defaultPipSize = defaults.pipSize || (defaults.isJpy ? 0.01 : 0.0001)
      const defaultSpreadPips = defaults.spread / defaultPipSize
      setSpreadPips(defaultSpreadPips.toFixed(1))
      if (!isManualPrice && (!market || !market[symbol])) {
        setEntryPrice(String(defaults.price))
      }
    }
  }, [symbol, isCustomAsset])

  // Parsing numérico de inputs
  const entryN = parseFloat(entryPrice) || 0
  const leverageN = parseFloat(leverage) || 1
  const investmentN = parseFloat(investment) || 0
  const spreadPipsN = parseFloat(spreadPips) || 0

  // ─── 🎯 PRECISIÓN DINÁMICA: Mostrar todos los decimales que el usuario introduce ───
  const userDecimals = entryPrice.includes('.') ? (entryPrice.split('.')[1] || '').length : 0
  const defaultMinDec = pipSize === 0.01 ? 3 : pipSize === 0.0001 ? 5 : pipSize <= 0.001 ? 4 : 2
  const displayDecimals = Math.max(defaultMinDec, userDecimals)

  // ─── 🧮 CÁLCULOS CON LAS FÓRMULAS EXACTAS ──────────────────────────

  // 1. Notional = Inversión * Apalancamiento
  const notional = investmentN * leverageN

  // 2. valor por pip (unidad) = pipSize / Precio de Entrada
  const valPerPipUnit = entryN > 0 ? pipSize / entryN : 0

  // 3. valor por pip del trade = Notional * valor por pip (unidad)
  const valPerPipTrade = notional * valPerPipUnit

  // 4. Pips hasta liquidación = Margen / valor por pip del trade
  const pipsToLiqTheo = valPerPipTrade > 0 ? investmentN / valPerPipTrade : 0

  // Ajustes de Spread
  const spreadInPips = spreadPipsN
  const pipsToLiqReal = includeSpread
    ? Math.max(0, pipsToLiqTheo - spreadInPips)
    : pipsToLiqTheo

  // Precios de Liquidación resultantes
  const liqTheoPrice = direction === 'BUY'
    ? entryN - (pipsToLiqTheo * pipSize)
    : entryN + (pipsToLiqTheo * pipSize)

  const liqRealPrice = direction === 'BUY'
    ? entryN - (pipsToLiqReal * pipSize)
    : entryN + (pipsToLiqReal * pipSize)

  const activeLiqPrice = includeSpread ? liqRealPrice : liqTheoPrice
  const activePipsToLiq = includeSpread ? pipsToLiqReal : pipsToLiqTheo

  // ─── 📡 PRECIO EN VIVO Y CÁLCULO DE AGUJA DEL GRÁFICO ───────────────────────
  // Si hay datos WS para este símbolo, usar el precio WS.
  // Si no hay datos WS (modo manual o activo personalizado), usar el campo manualLivePrice.
  // Si ni WS ni manual live, fallback al precio de entrada (holgura será 100%).
  const hasWsData = !isCustomAsset && !!market?.[symbol]
  const manualLivePriceN = parseFloat(manualLivePrice) || 0
  const needsManualLive = (isManualPrice || isCustomAsset) && !hasWsData
  const livePrice = hasWsData 
    ? market![symbol].m5.price 
    : (manualLivePriceN > 0 ? manualLivePriceN : entryN)

  // Porcentaje de la posición del precio actual en la regla de holgura
  const livePct = (() => {
    if (entryN === activeLiqPrice) return 0
    let pct = 0
    if (direction === 'BUY') {
      pct = ((livePrice - activeLiqPrice) / (entryN - activeLiqPrice)) * 100
    } else {
      pct = ((activeLiqPrice - livePrice) / (activeLiqPrice - entryN)) * 100
    }
    return Math.max(-20, Math.min(120, pct))
  })()

  // Distancia del precio actual a la liquidación en pips
  const liveDistancePrice = Math.abs(livePrice - activeLiqPrice)
  const liveDistancePips = pipSize > 0 ? liveDistancePrice / pipSize : 0

  // ─── 🎯 CÁLCULO INVERSO DE APALANCAMIENTO RECOMENDADO ────────────────────────
  const targetPipsN = parseFloat(targetPips) || 1
  const recLeverage = (entryN > 0 && pipSize > 0) ? entryN / (pipSize * targetPipsN) : 0

  return (
    <div style={{ padding: '24px 0', maxWidth: 900, margin: '0 auto', fontFamily: '"Outfit", sans-serif' }}>

      {/* Cabecera */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 className="title-gradient" style={{ margin: 0, fontSize: 30, fontWeight: 800, letterSpacing: '-0.8px' }}>
              🧮 CALCULADORA DE HOLGURA
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#9ca3af' }}>
              Matemáticas de Liquidación y Distancia de Tolerancia (Forex, Metales, Crypto e IQ Option)
            </p>
          </div>

          {/* Badge de modo */}
          <div style={{
            padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700,
            background: (isManualPrice || isCustomAsset) ? 'rgba(234, 179, 8, 0.15)' : 'rgba(16, 185, 129, 0.15)',
            border: `1px solid ${(isManualPrice || isCustomAsset) ? 'rgba(234, 179, 8, 0.4)' : 'rgba(16, 185, 129, 0.4)'}`,
            color: (isManualPrice || isCustomAsset) ? '#facc15' : '#34d399',
            display: 'flex', alignItems: 'center', gap: 6
          }}>
            <span>{(isManualPrice || isCustomAsset) ? '✏️ Modo Manual / IQ Option' : '⚡ WebSocket Sincronizado'}</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Panel de Control de Parámetros */}
        <div className="glass-panel" style={{ margin: 0, border: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0 0 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 8 }}>
            <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0, color: '#fff' }}>
              ⚙️ Ajustes de Operación
            </h3>
            <span style={{ fontSize: 11, color: '#9ca3af' }}>
              {activeSymbolName} • Pip: {pipSize}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            {/* Símbolo */}
            <div style={fieldGroupStyle}>
              <label style={labelStyle}>Símbolo / Activo</label>
              {!isCustomAsset ? (
                <div style={{ display: 'flex', gap: 6 }}>
                  <select 
                    value={symbol} 
                    onChange={e => {
                      if (e.target.value === 'CUSTOM') {
                        setIsCustomAsset(true)
                        setIsManualPrice(true)
                      } else {
                        setSymbol(e.target.value)
                      }
                    }} 
                    style={selectStyle}
                  >
                    {SUPPORTED_SYMBOLS.map(s => <option key={s} value={s}>{s}</option>)}
                    <option value="CUSTOM">➕ Otro / Personalizado...</option>
                  </select>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    type="text"
                    placeholder="Ej. EUR/AUD, XAU/USD, BTC/USD"
                    value={customSymbol}
                    onChange={e => setCustomSymbol(e.target.value.toUpperCase())}
                    style={inputStyle}
                  />
                  <button
                    onClick={() => {
                      setIsCustomAsset(false)
                      setSymbol('EUR/USD')
                    }}
                    title="Volver a lista rápida"
                    style={{
                      padding: '0 10px', borderRadius: 8, background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.1)', color: '#9ca3af', cursor: 'pointer',
                      fontSize: 12, fontWeight: 700
                    }}
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>

            {/* Dirección */}
            <div style={fieldGroupStyle}>
              <label style={labelStyle}>Dirección</label>
              <div style={{ display: 'flex', gap: 6, height: 38 }}>
                {(['BUY', 'SELL'] as const).map(dir => (
                  <button
                    key={dir}
                    onClick={() => setDirection(dir)}
                    style={{
                      flex: 1, padding: 0, borderRadius: 8, cursor: 'pointer',
                      fontWeight: 700, fontSize: 12, transition: 'all 0.2s',
                      background: direction === dir
                        ? (dir === 'BUY' ? 'rgba(16,185,129,0.2)' : 'rgba(244,63,94,0.2)')
                        : 'rgba(255,255,255,0.03)',
                      color: direction === dir ? (dir === 'BUY' ? '#10b981' : '#f43f5e') : '#6b7280',
                      border: direction === dir
                        ? `1px solid ${dir === 'BUY' ? '#10b981' : '#f43f5e'}40`
                        : '1px solid rgba(255,255,255,0.05)',
                    }}
                  >
                    {dir}
                  </button>
                ))}
              </div>
            </div>

            {/* Inversión */}
            <div style={fieldGroupStyle}>
              <label style={labelStyle}>Inversión (Margen)</label>
              <input type="number" step="0.5" value={investment} onChange={e => setInvestment(e.target.value)} style={inputStyle} />
            </div>

            {/* Apalancamiento */}
            <div style={fieldGroupStyle}>
              <label style={labelStyle}>Apalancamiento</label>
              <select value={leverage} onChange={e => setLeverage(e.target.value)} style={selectStyle}>
                {['10', '25', '50', '100', '200', '300', '500', '1000'].map(l => (
                  <option key={l} value={l}>x{l}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Fila secundaria: Precio, Spread y Selector de Pip si es personalizado */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginTop: 16 }}>
            
            {/* Precio de Entrada */}
            <div style={fieldGroupStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={labelStyle}>Precio de Entrada (IQ Option / Broker)</label>
                {!isCustomAsset && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#9ca3af', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={isManualPrice}
                      onChange={e => setIsManualPrice(e.target.checked)}
                      style={{ cursor: 'pointer' }}
                    />
                    Precio manual
                  </label>
                )}
              </div>
              <input
                type="text"
                placeholder="Ej. 1.157891"
                value={entryPrice}
                disabled={!isCustomAsset && !isManualPrice && wsStatus === 'connected' && !!market?.[symbol]}
                onChange={e => setEntryPrice(e.target.value)}
                style={{
                  ...inputStyle,
                  opacity: !isCustomAsset && !isManualPrice && wsStatus === 'connected' && !!market?.[symbol] ? 0.6 : 1,
                  borderColor: isManualPrice || isCustomAsset ? 'rgba(234,179,8,0.3)' : 'rgba(16,185,129,0.2)'
                }}
              />
              <span style={{ fontSize: 10, color: '#9ca3af' }}>
                {isManualPrice || isCustomAsset 
                  ? `✍️ Entrada manual activa con ${userDecimals} decimales detectados` 
                  : '🟢 Actualizado en tiempo real por WebSocket'}
              </span>
            </div>

            {/* Campo de Precio Actual del Mercado (solo cuando no hay WS) */}
            {needsManualLive && (
              <div style={fieldGroupStyle}>
                <label style={labelStyle}>Precio Actual del Mercado</label>
                <input
                  type="text"
                  placeholder={`Ej. ${entryPrice}`}
                  value={manualLivePrice}
                  onChange={e => setManualLivePrice(e.target.value)}
                  style={{
                    ...inputStyle,
                    borderColor: manualLivePriceN > 0 ? 'rgba(16,185,129,0.3)' : 'rgba(244,63,94,0.3)'
                  }}
                />
                <span style={{ fontSize: 10, color: manualLivePriceN > 0 ? '#10b981' : '#f87171' }}>
                  {manualLivePriceN > 0 
                    ? `📡 Precio actual: ${manualLivePriceN.toFixed(displayDecimals)} (manual)` 
                    : '⚠️ Ingresa el precio actual del mercado para calcular holgura y P/G'}
                </span>
              </div>
            )}

            {/* Selector de Pip Size si es activo personalizado o modo avanzado */}
            {isCustomAsset && (
              <div style={fieldGroupStyle}>
                <label style={labelStyle}>Tamaño de Pip / Categoría</label>
                <select 
                  value={customPipSize} 
                  onChange={e => setCustomPipSize(e.target.value)} 
                  style={selectStyle}
                >
                  {ASSET_PIP_PRESETS.map(p => (
                    <option key={p.pipSize} value={String(p.pipSize)}>{p.label}</option>
                  ))}
                </select>
                <span style={{ fontSize: 10, color: '#9ca3af' }}>
                  Define cuánto vale 1 pip para este activo (ej. 0.0001 en Forex)
                </span>
              </div>
            )}

            {/* Configuración de Spread */}
            <div style={{
              padding: '12px 14px', borderRadius: 10,
              background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.05)',
              display: 'flex', flexDirection: 'column', gap: 8
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ ...labelStyle, color: '#eab308' }}>Spread de Mercado</label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, cursor: 'pointer', color: '#fff' }}>
                  <input
                    type="checkbox"
                    checked={includeSpread}
                    onChange={e => setIncludeSpread(e.target.checked)}
                    style={{ cursor: 'pointer' }}
                  />
                  Restar spread
                </label>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="number"
                  step="0.1"
                  disabled={!includeSpread}
                  value={spreadPips}
                  onChange={e => setSpreadPips(e.target.value)}
                  style={{ ...inputStyle, opacity: includeSpread ? 1 : 0.4 }}
                />
                <span style={{ fontSize: 11, color: '#6b7280', whiteSpace: 'nowrap' }}>
                  pips
                </span>
              </div>
              <span style={{ fontSize: 10, color: '#9ca3af', display: 'block', marginTop: 2 }}>
                💡 En IQ Option es la cifra que sale en el botón (ej: 0.8 o 1.3)
              </span>
            </div>
          </div>
        </div>

        {/* Desglose Matemático de la Holgura */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>

          {/* Fórmulas matemáticas */}
          <div className="glass-panel" style={{ margin: 0, border: '1px solid rgba(255,255,255,0.06)' }}>
            <h3 style={{ fontSize: 14, fontWeight: 800, margin: '0 0 16px', color: '#fff', letterSpacing: '0.5px' }}>
              📐 FÓRMULAS DE CÁLCULO
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13 }}>
              <div>
                <div style={formulaLabelStyle}>1. NOTIONAL (Inversión × Apalancamiento)</div>
                <div style={formulaValStyle}>
                  ${investmentN} × {leverageN} = <strong style={{ color: '#fff' }}>${notional.toFixed(2)} USD</strong>
                </div>
              </div>
              <div>
                <div style={formulaLabelStyle}>2. VALOR POR PIP (unidad base)</div>
                <div style={formulaValStyle}>
                  {pipSize} / {entryN.toFixed(displayDecimals)} = <strong style={{ color: '#fff' }}>{valPerPipUnit.toFixed(8)}</strong>
                </div>
              </div>
              <div>
                <div style={formulaLabelStyle}>3. VALOR POR PIP DEL TRADE (Notional × Valor Pip Base)</div>
                <div style={formulaValStyle}>
                  ${notional.toFixed(2)} × {valPerPipUnit.toFixed(8)} = <strong style={{ color: '#60a5fa' }}>${valPerPipTrade.toFixed(4)} USD</strong>
                </div>
              </div>
              <div>
                <div style={formulaLabelStyle}>4. PIPS HASTA LIQUIDACIÓN (Margen / Valor Pip Trade)</div>
                <div style={formulaValStyle}>
                  {includeSpread
                    ? `(${investmentN} / ${valPerPipTrade.toFixed(4)}) - ${spreadInPips.toFixed(1)} spread = `
                    : `${investmentN} / ${valPerPipTrade.toFixed(4)} = `
                  }
                  <strong style={{ color: '#10b981', fontSize: 15 }}>{activePipsToLiq.toFixed(1)} PIPS</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Resultados finales */}
          <div className="glass-panel" style={{ margin: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', border: '1px solid rgba(255,255,255,0.06)' }}>
            <h3 style={{ fontSize: 14, fontWeight: 800, margin: '0 0 16px', color: '#fff', letterSpacing: '0.5px' }}>
              📊 MÁRGENES DE PRECIO
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={resultRowStyle}>
                <span style={resultLabelStyle}>Precio de Entrada:</span>
                <span style={{ fontSize: 18, fontWeight: 700, color: '#fff', fontFamily: 'monospace' }}>
                  {entryN.toFixed(displayDecimals)}
                </span>
              </div>
              <div style={resultRowStyle}>
                <span style={resultLabelStyle}>Zona de Liquidación:</span>
                <span style={{ fontSize: 18, fontWeight: 700, color: '#f43f5e', fontFamily: 'monospace' }}>
                  {activeLiqPrice.toFixed(displayDecimals)}
                </span>
              </div>
              <div style={resultRowStyle}>
                <span style={resultLabelStyle}>Tolerancia Máxima (Pips):</span>
                <span style={{ fontSize: 18, fontWeight: 700, color: '#10b981', fontFamily: 'monospace' }}>
                  {activePipsToLiq.toFixed(1)} pips
                </span>
              </div>
              <div style={resultRowStyle}>
                <span style={resultLabelStyle}>Pérdida en Liquidación:</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: '#ef4444' }}>
                  -${investmentN.toFixed(2)} USD (100% del Margen)
                </span>
              </div>
            </div>
          </div>

        </div>

        {/* ─── 💵 SECCIÓN DIFERENCIADA: SPREAD vs VALOR/PIP vs P/G ───────────────── */}
        <div className="glass-panel" style={{
          margin: 0,
          border: '1px solid rgba(59,130,246,0.2)',
          background: 'linear-gradient(135deg, rgba(15,23,42,0.85) 0%, rgba(30,41,59,0.7) 100%)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.37)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 10 }}>
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 800, color: '#60a5fa', margin: 0 }}>
                💵 COSTOS Y GANANCIAS DEL TRADE
              </h3>
              <span style={{ fontSize: 11, color: '#9ca3af' }}>
                Spread (costo de entrada) vs Valor por Pip (ganancia por movimiento)
              </span>
            </div>
            <div style={{
              padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700,
              background: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.3)'
            }}>
              Volumen: ${(investmentN * leverageN).toFixed(0)} USD
            </div>
          </div>

          {/* ── Grid de Tarjetas ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16 }}>

            {/* ── TARJETA 1: COSTO DEL SPREAD (solo si "Restar spread" está activado) ── */}
            {includeSpread && (
              <div style={{
                padding: '16px 18px', borderRadius: 12,
                background: 'rgba(234,179,8,0.04)', border: '1px solid rgba(234,179,8,0.2)',
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
              }}>
                <div>
                  <span style={{ fontSize: 10, color: '#eab308', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>
                    ⚡ COSTO DEL SPREAD (PEAJE DE ENTRADA)
                  </span>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#fbbf24', fontFamily: 'monospace', margin: '6px 0 2px' }}>
                    -${(spreadInPips * valPerPipTrade).toFixed(4)} <span style={{ fontSize: 12, color: '#a16207' }}>USD</span>
                  </div>
                  <p style={{ margin: 0, fontSize: 11, color: '#d4a017', lineHeight: 1.5 }}>
                    Al abrir la operación, <strong>empiezas {spreadInPips.toFixed(1)} pips abajo</strong> por el spread del broker. Este costo se paga <strong>una sola vez</strong> al entrar.
                  </p>
                </div>

                <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid rgba(234,179,8,0.1)', fontSize: 11, color: '#a16207' }}>
                  {spreadInPips.toFixed(1)} pips × ${valPerPipTrade.toFixed(4)}/pip = <strong style={{ color: '#fbbf24' }}>-${(spreadInPips * valPerPipTrade).toFixed(4)}</strong>
                </div>
              </div>
            )}

            {/* ── TARJETA 2: VALOR DEL PIP POR MOVIMIENTO (lo que ganas/pierdes por cada pip) ── */}
            <div style={{
              padding: '16px 18px', borderRadius: 12,
              background: 'rgba(56,189,248,0.04)', border: '1px solid rgba(56,189,248,0.2)',
              display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
            }}>
              <div>
                <span style={{ fontSize: 10, color: '#38bdf8', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>
                  📈 VALOR POR PIP (GANANCIA/PÉRDIDA POR MOVIMIENTO)
                </span>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#38bdf8', fontFamily: 'monospace', margin: '6px 0 2px' }}>
                  ${valPerPipTrade.toFixed(4)} <span style={{ fontSize: 13, color: '#94a3b8' }}>USD/pip</span>
                </div>
                <p style={{ margin: 0, fontSize: 11, color: '#cbd5e1', lineHeight: 1.5 }}>
                  Cuando el precio se mueve <strong>1 pip</strong> a tu favor, ganas <strong style={{ color: '#10b981' }}>+${valPerPipTrade.toFixed(4)}</strong>. Si se mueve 1 pip en contra, pierdes <strong style={{ color: '#f43f5e' }}>-${valPerPipTrade.toFixed(4)}</strong>.
                </p>
              </div>

              <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid rgba(56,189,248,0.08)', display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9ca3af' }}>
                <span>10p = <strong style={{ color: '#fff' }}>${(valPerPipTrade * 10).toFixed(2)}</strong></span>
                <span>20p = <strong style={{ color: '#fff' }}>${(valPerPipTrade * 20).toFixed(2)}</strong></span>
                <span>50p = <strong style={{ color: '#fff' }}>${(valPerPipTrade * 50).toFixed(2)}</strong></span>
              </div>
            </div>

            {/* ── TARJETA 3: P/G BRUTA EN VIVO ── */}
            {(() => {
              const liveDiffPrice = direction === 'BUY' ? (livePrice - entryN) : (entryN - livePrice)
              const livePipsMoved = pipSize > 0 ? (liveDiffPrice / pipSize) : 0
              const livePnLBruta = Math.max(-investmentN, livePipsMoved * valPerPipTrade)
              const livePnLPct = investmentN > 0 ? (livePnLBruta / investmentN) * 100 : 0
              const isProfit = livePnLBruta >= 0

              return (
                <div style={{
                  padding: '16px 18px', borderRadius: 12,
                  background: isProfit ? 'rgba(16,185,129,0.05)' : 'rgba(244,63,94,0.05)',
                  border: `1px solid ${isProfit ? 'rgba(16,185,129,0.25)' : 'rgba(244,63,94,0.25)'}`,
                  display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
                }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>
                        P/G BRUTAS EN VIVO
                      </span>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                        background: direction === 'BUY' ? 'rgba(16,185,129,0.2)' : 'rgba(244,63,94,0.2)',
                        color: direction === 'BUY' ? '#34d399' : '#fb7185'
                      }}>
                        {direction} @ {entryN.toFixed(displayDecimals)}
                      </span>
                    </div>

                    <div style={{
                      fontSize: 26, fontWeight: 800, fontFamily: 'monospace', margin: '6px 0 2px',
                      color: isProfit ? '#10b981' : '#f43f5e'
                    }}>
                      {isProfit ? '+' : ''}${livePnLBruta.toFixed(2)} <span style={{ fontSize: 14 }}>({isProfit ? '+' : ''}{livePnLPct.toFixed(1)}%)</span>
                    </div>

                    <p style={{ margin: 0, fontSize: 11, color: '#cbd5e1' }}>
                      {livePipsMoved >= 0 ? '🟢' : '🔴'}{' '}
                      <strong style={{ color: isProfit ? '#34d399' : '#fb7185' }}>
                        {livePipsMoved.toFixed(1)} pips
                      </strong>{' '}
                      × ${valPerPipTrade.toFixed(4)}/pip
                    </p>
                  </div>

                  <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.04)', display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                    <span style={{ color: '#9ca3af' }}>Inversión: <strong style={{ color: '#fff' }}>${investmentN.toFixed(2)}</strong></span>
                    <span style={{ color: '#9ca3af' }}>Precio: <strong style={{ color: '#fff', fontFamily: 'monospace' }}>{livePrice.toFixed(displayDecimals)}</strong></span>
                  </div>
                </div>
              )
            })()}

          </div>

          {/* ── Escala de P/G Proyectada ── */}
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <span style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: 8 }}>
              📊 Proyección de P/G {includeSpread ? '(después de recuperar spread)' : ''}
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8 }}>
              {[
                ...(includeSpread ? [{ pips: 0, label: `🔄 Break-even (${spreadInPips.toFixed(1)}p)`, isBreakeven: true }] : []),
                { pips: 5, label: '+5 Pips' },
                { pips: 10, label: '+10 Pips' },
                { pips: 20, label: '+20 Pips' },
                { pips: 50, label: '+50 Pips' },
                { pips: -Math.round(activePipsToLiq), label: `☠️ Liq (-${activePipsToLiq.toFixed(0)}p)`, isLiq: true }
              ].map((item: any) => {
                let usd: number, pct: number
                if (item.isLiq) {
                  usd = -investmentN
                  pct = -100
                } else if (item.isBreakeven) {
                  usd = 0
                  pct = 0
                } else {
                  usd = item.pips * valPerPipTrade
                  pct = investmentN > 0 ? (usd / investmentN) * 100 : 0
                }
                const isPositive = usd >= 0
                return (
                  <div key={item.label} style={{
                    padding: '8px 10px', borderRadius: 8,
                    background: item.isLiq ? 'rgba(239,68,68,0.1)' : item.isBreakeven ? 'rgba(234,179,8,0.08)' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${item.isLiq ? 'rgba(239,68,68,0.3)' : item.isBreakeven ? 'rgba(234,179,8,0.25)' : 'rgba(255,255,255,0.04)'}`,
                    textAlign: 'center'
                  }}>
                    <span style={{ fontSize: 10, color: item.isLiq ? '#f87171' : item.isBreakeven ? '#eab308' : '#9ca3af', display: 'block', fontWeight: 700 }}>
                      {item.label}
                    </span>
                    <span style={{
                      fontSize: 12, fontWeight: 800, fontFamily: 'monospace',
                      color: item.isLiq ? '#ef4444' : item.isBreakeven ? '#eab308' : isPositive ? '#10b981' : '#f43f5e'
                    }}>
                      {item.isBreakeven ? '$0.00' : `${isPositive && !item.isLiq ? '+' : ''}$${usd.toFixed(2)}`}
                    </span>
                    <span style={{ fontSize: 9, color: item.isLiq ? '#fca5a5' : item.isBreakeven ? '#ca8a04' : isPositive ? '#6ee7b7' : '#fda4af', display: 'block' }}>
                      {item.isBreakeven ? 'Recuperas spread' : `${isPositive && !item.isLiq ? '+' : ''}${pct.toFixed(1)}%`}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

        </div>

        {/* Métrica Gráfica de Distancia de Holgura (Custom Graphic) */}
        <div className="glass-panel" style={{ margin: 0, border: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 15, fontWeight: 800, color: '#fff', margin: 0 }}>
              📐 Métrica de Cercanía a Liquidación (Holgura)
            </h3>
            {hasWsData && (
              <span style={{ fontSize: 11, color: '#10b981', fontWeight: 600 }}>
                ● WebSocket Activo: {livePrice.toFixed(displayDecimals)}
              </span>
            )}
            {!hasWsData && manualLivePriceN > 0 && (
              <span style={{ fontSize: 11, color: '#38bdf8', fontWeight: 600 }}>
                📡 Precio Actual (manual): {livePrice.toFixed(displayDecimals)}
              </span>
            )}
            {!hasWsData && manualLivePriceN <= 0 && (
              <span style={{ fontSize: 11, color: '#f87171', fontWeight: 600 }}>
                ⚠️ Sin precio actual — ingresa el precio del mercado arriba
              </span>
            )}
          </div>

          <div style={{ position: 'relative', padding: '24px 0 10px' }}>
            {/* Etiquetas Superiores */}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9ca3af', marginBottom: 8, fontWeight: 600 }}>
              <span style={{ color: '#f87171' }}>☠️ Liquidación ({activeLiqPrice.toFixed(displayDecimals)})</span>
              <span>Distancia en Pips: {liveDistancePips.toFixed(1)} pips</span>
              <span style={{ color: '#34d399' }}>🟢 Entrada ({entryN.toFixed(displayDecimals)})</span>
            </div>

            {/* Barra Gráfica de Holgura */}
            <div style={{
              height: 16,
              borderRadius: 8,
              background: 'linear-gradient(90deg, rgba(239,68,68,0.7) 0%, rgba(245,158,11,0.5) 35%, rgba(16,185,129,0.3) 100%)',
              position: 'relative',
              boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.6)',
              overflow: 'visible'
            }}>
              {/* Amortiguador por Spread visual */}
              {includeSpread && (
                <div style={{
                  position: 'absolute',
                  left: 0,
                  height: '100%',
                  width: `${Math.min(100, (spreadInPips / pipsToLiqTheo) * 100)}%`,
                  background: 'rgba(255, 255, 255, 0.15)',
                  borderRight: '1px dashed rgba(255,255,255,0.4)',
                  borderRadius: '8px 0 0 8px'
                }} title={`Spread Buffer: ${spreadInPips.toFixed(1)} pips`} />
              )}

              {/* Indicador de Aguja del Precio Actual */}
              <div style={{
                position: 'absolute',
                left: `${livePct}%`,
                top: -8,
                bottom: -8,
                width: 4,
                background: '#3b82f6',
                borderRadius: 2,
                boxShadow: '0 0 10px #3b82f6, 0 0 4px #3b82f6',
                transform: 'translateX(-50%)',
                zIndex: 10,
                transition: 'left 0.3s ease-out'
              }}>
                {/* Globo tooltip de la aguja */}
                <div style={{
                  position: 'absolute',
                  top: -24,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: '#1e3a8a',
                  border: '1px solid #3b82f6',
                  color: '#fff',
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '2px 6px',
                  borderRadius: 4,
                  whiteSpace: 'nowrap',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
                }}>
                  Precio: {livePrice.toFixed(displayDecimals)}
                </div>
              </div>
            </div>

            {/* Guía inferior del medidor */}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#6b7280', marginTop: 10 }}>
              <span>0% (Margen Agotado)</span>
              <span>Distancia Segura de Holgura</span>
              <span>100% (Entrada Ejecutada)</span>
            </div>
          </div>
        </div>

        {/* Sección: ¿Qué apalancamiento necesito para sobrevivir X pips? */}
        <div className="glass-panel" style={{ margin: 0, border: '1px solid rgba(255,255,255,0.06)' }}>
          <h3 style={{ fontSize: 15, fontWeight: 800, color: '#fff', margin: '0 0 12px' }}>
            🎯 ¿Con cuánto apalancamiento entrar?
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20, alignItems: 'center' }}>
            <div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={labelStyle}>Holgura Requerida en Pips (Drawdown Soportado)</label>
                <input
                  type="number"
                  min="5"
                  max="500"
                  value={targetPips}
                  onChange={e => setTargetPips(e.target.value)}
                  style={inputStyle}
                />
              </div>
              <span style={{ fontSize: 11, color: '#6b7280', display: 'block', marginTop: 6 }}>
                Ingresa los pips que deseas que aguante tu operación antes de tocar la liquidación.
              </span>
            </div>

            <div style={{
              padding: '16px 20px', borderRadius: 12,
              background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.15)',
              textAlign: 'center'
            }}>
              <span style={{ fontSize: 11, color: '#60a5fa', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                Apalancamiento Recomendado
              </span>
              <span style={{ fontSize: 26, fontWeight: 800, color: '#fff', fontFamily: 'monospace' }}>
                x{recLeverage > 0 && recLeverage !== Infinity ? Math.round(recLeverage) : '—'}
              </span>
              <p style={{ margin: '6px 0 0', fontSize: 11, color: '#9ca3af', lineHeight: 1.3 }}>
                Si usas un apalancamiento de <strong>x{recLeverage > 0 && recLeverage !== Infinity ? Math.round(recLeverage) : '—'}</strong>, tu cuenta aguantará exactamente {targetPipsN} pips de movimiento en contra antes de la liquidación teórica.
              </p>
            </div>
          </div>
        </div>

        {/* ─── SECCIÓN EDUCATIVA ─────────────────────────────────────────────────── */}
        <div style={{
          padding: '20px 24px', borderRadius: 16,
          background: 'linear-gradient(135deg, rgba(167,139,250,0.05) 0%, rgba(59,130,246,0.03) 100%)',
          border: '1px solid rgba(167,139,250,0.15)',
        }}>
          <h3 style={{ fontSize: 14, fontWeight: 800, margin: '0 0 16px', color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            📚 ¿Cómo funciona la Holgura? (para principiantes)
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontSize: 13, color: '#d1d5db', lineHeight: 1.6 }}>

            {/* Explicación 1 */}
            <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
              <div style={{ fontWeight: 700, color: '#fff', marginBottom: 4 }}>
                💡 ¿Qué es la Holgura?
              </div>
              Cuando abres una operación, el broker te presta dinero a través del apalancamiento.
              La <strong style={{ color: '#10b981' }}>holgura</strong> es el espacio de movimiento que tienes a favor del mercado en tu contra <em>antes</em> de que el broker cierre tu operación automáticamente porque ya perdiste todo tu margen. También se le llama <em>zona de tolerancia</em>.
            </div>

            {/* Explicación 2 */}
            <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
              <div style={{ fontWeight: 700, color: '#fff', marginBottom: 4 }}>
                ⚠️ ¿Por qué la inversión ($2 o $200) no cambia los pips de holgura?
              </div>
              Porque la Inversión se cancela matemáticamente en la fórmula. Al simplificarla, queda solo:
              <div style={{ margin: '8px 0', padding: '8px 12px', borderRadius: 8, background: 'rgba(0,0,0,0.3)', fontFamily: 'monospace', color: '#60a5fa', fontSize: 12 }}>
                Pips hasta Liquidación = Precio de Entrada / (Apalancamiento × Tamaño del Pip)
              </div>
              Lo que <strong style={{ color: '#f43f5e' }}>SÍ cambia</strong> con la inversión es cuánto dinero ganas o pierdes por cada pip. Con $2 cada pip vale centavos; con $200 cada pip puede valer dólares.
            </div>

            {/* Explicación 3 */}
            <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
              <div style={{ fontWeight: 700, color: '#fff', marginBottom: 8 }}>
                🎯 ¿Qué controla la Holgura entonces?
              </div>
              <div style={{ color: '#9ca3af', fontSize: 12, marginBottom: 8 }}>
                A precio constante (ej. EUR/USD = 1.15), la holgura depende únicamente del <strong style={{ color: '#fbbf24' }}>Apalancamiento</strong>:
              </div>
              {/* Tabla de referencia */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: 'monospace' }}>
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
                      <th style={{ padding: '8px 12px', color: '#9ca3af', textAlign: 'left', fontWeight: 700 }}>Apalancamiento</th>
                      <th style={{ padding: '8px 12px', color: '#9ca3af', textAlign: 'left', fontWeight: 700 }}>Pips de Holgura Aprox.</th>
                      <th style={{ padding: '8px 12px', color: '#9ca3af', textAlign: 'left', fontWeight: 700 }}>Riesgo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { lev: 'x50', pips: '~230 pips', risk: 'Muy Bajo ✅', color: '#10b981' },
                      { lev: 'x100', pips: '~115 pips', risk: 'Bajo ✅', color: '#34d399' },
                      { lev: 'x200', pips: '~57 pips', risk: 'Moderado ⚠️', color: '#fbbf24' },
                      { lev: 'x300', pips: '~38 pips', risk: 'Alto ⚠️', color: '#f97316' },
                      { lev: 'x500', pips: '~23 pips', risk: 'Muy Alto ❌', color: '#f43f5e' },
                      { lev: 'x1000', pips: '~11 pips', risk: 'Extremo 💀', color: '#dc2626' },
                    ].map(row => (
                      <tr key={row.lev} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <td style={{ padding: '7px 12px', color: '#fff', fontWeight: 700 }}>{row.lev}</td>
                        <td style={{ padding: '7px 12px', color: row.color }}>{row.pips}</td>
                        <td style={{ padding: '7px 12px', color: row.color }}>{row.risk}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p style={{ margin: '10px 0 0', fontSize: 11, color: '#6b7280' }}>
                * Los pips son aproximados para EUR/USD a precio 1.15. Usa la calculadora de arriba para obtener el valor exacto con el precio real.
              </p>
            </div>

          </div>
        </div>

      </div>

    </div>
  )
}

// Estilos Reutilizables (Inline CSS)
const labelStyle: React.CSSProperties = {
  fontSize: 10,
  color: '#9ca3af',
  textTransform: 'uppercase',
  fontWeight: 700,
  letterSpacing: '0.5px',
  marginBottom: 4
}

const fieldGroupStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  borderRadius: 8,
  boxSizing: 'border-box',
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.08)',
  color: '#fff',
  fontSize: 13,
  outline: 'none',
  fontFamily: 'monospace',
  height: 38
}

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: 'pointer',
}

const formulaLabelStyle: React.CSSProperties = {
  fontSize: 10,
  color: '#9ca3af',
  textTransform: 'uppercase',
  fontWeight: 600,
  marginBottom: 2
}

const formulaValStyle: React.CSSProperties = {
  fontFamily: 'monospace',
  color: '#6b7280',
}

const resultRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  borderBottom: '1px solid rgba(255,255,255,0.03)',
  paddingBottom: 8
}

const resultLabelStyle: React.CSSProperties = {
  fontSize: 12,
  color: '#9ca3af'
}
