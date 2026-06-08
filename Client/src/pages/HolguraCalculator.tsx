/**
 * HolguraCalculator.tsx
 *
 * Calculadora simplificada y gráfica de Holgura (Margen de Drawdown y Liquidación).
 * Utiliza exactamente las fórmulas requeridas por el usuario.
 */

import { useState, useEffect } from 'react'
import { useMarketData } from '../hooks/useMarketData'

// Símbolos Forex soportados y sus valores típicos
const SYMBOL_DEFAULTS: { [key: string]: { spread: number; price: number } } = {
  'EUR/USD': { spread: 0.00013, price: 1.08500 },
  'GBP/USD': { spread: 0.00018, price: 1.27200 },
  'USD/JPY': { spread: 0.015,   price: 156.50 },
  'USD/CAD': { spread: 0.00018, price: 1.36500 },
  'AUD/USD': { spread: 0.00016, price: 0.66500 },
  'EUR/GBP': { spread: 0.00018, price: 0.85200 },
  'USD/CHF': { spread: 0.00018, price: 0.89500 },
  'CAD/JPY': { spread: 0.022,   price: 114.50 },
  'EUR/CHF': { spread: 0.00020, price: 0.97200 }
}

const SUPPORTED_SYMBOLS = Object.keys(SYMBOL_DEFAULTS)

export function HolguraCalculator() {
  const { data: market, status: wsStatus } = useMarketData()

  // Estados de entrada
  const [symbol, setSymbol] = useState('EUR/USD')
  const [direction, setDirection] = useState<'BUY' | 'SELL'>('BUY')
  const [entryPrice, setEntryPrice] = useState('1.08500')
  const [leverage, setLeverage] = useState('200')
  const [investment, setInvestment] = useState('2')
  const [spreadPips, setSpreadPips] = useState('1.3')
  const [includeSpread, setIncludeSpread] = useState(true)
  const [isManualPrice, setIsManualPrice] = useState(false)

  // Holgura objetivo para cálculo inverso
  const [targetPips, setTargetPips] = useState('40')

  const isJpy = symbol.toUpperCase().includes('JPY')
  const pipSize = isJpy ? 0.01 : 0.0001

  // Sincronizar precio en vivo por WebSocket si no está en modo manual
  useEffect(() => {
    if (market && market[symbol] && !isManualPrice) {
      setEntryPrice(market[symbol].m5.price.toFixed(isJpy ? 3 : 5))
    }
  }, [market, symbol, isManualPrice, isJpy])

  // Cargar defaults cuando cambia el símbolo
  useEffect(() => {
    const defaults = SYMBOL_DEFAULTS[symbol]
    if (defaults) {
      const defaultPipSize = symbol.toUpperCase().includes('JPY') ? 0.01 : 0.0001
      const defaultSpreadPips = defaults.spread / defaultPipSize
      setSpreadPips(defaultSpreadPips.toFixed(1))
      if (!isManualPrice && (!market || !market[symbol])) {
        setEntryPrice(String(defaults.price))
      }
    }
  }, [symbol])

  // Parsing numérico de inputs
  const entryN = parseFloat(entryPrice) || 0
  const leverageN = parseFloat(leverage) || 1
  const investmentN = parseFloat(investment) || 0
  const spreadPipsN = parseFloat(spreadPips) || 0

  // ─── 🧮 CÁCULOS CON LAS FÓRMULAS EXACTAS SOLICITADAS ──────────────────────────
  
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
  const livePrice = market && market[symbol] ? market[symbol].m5.price : entryN

  // Porcentaje de la posición del precio actual en la regla de holgura
  // 100% = Entrada (Seguridad total)
  // 0% = Liquidación (Zona de muerte)
  const livePct = (() => {
    if (entryN === activeLiqPrice) return 0
    let pct = 0
    if (direction === 'BUY') {
      pct = ((livePrice - activeLiqPrice) / (entryN - activeLiqPrice)) * 100
    } else {
      pct = ((activeLiqPrice - livePrice) / (activeLiqPrice - entryN)) * 100
    }
    return Math.max(-20, Math.min(120, pct)) // damos un poco de holgura visual por si entra en ganancias (>100)
  })()

  // Distancia del precio actual a la liquidación en pips
  const liveDistancePrice = Math.abs(livePrice - activeLiqPrice)
  const liveDistancePips = liveDistancePrice / pipSize

  // ─── 🎯 CÁLCULO INVERSO DE APALANCAMIENTO RECOMENDADO ────────────────────────
  const targetPipsN = parseFloat(targetPips) || 1
  // requiredLeverage = Margen / (Margen * (pipSize / Entry) * TargetPips)
  // => requiredLeverage = Entry / (pipSize * TargetPips)
  const recLeverage = entryN > 0 ? entryN / (pipSize * targetPipsN) : 0

  return (
    <div style={{ padding: '24px 0', maxWidth: 900, margin: '0 auto', fontFamily: '"Outfit", sans-serif' }}>
      
      {/* Cabecera */}
      <div style={{ marginBottom: 28 }}>
        <h1 className="title-gradient" style={{ margin: 0, fontSize: 30, fontWeight: 800, letterSpacing: '-0.8px' }}>
          🧮 CALCULADORA DE HOLGURA
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#9ca3af' }}>
          Matemáticas de Liquidación y Distancia de Tolerancia en Forex
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        
        {/* Panel de Control de Parámetros */}
        <div className="glass-panel" style={{ margin: 0, border: '1px solid rgba(255,255,255,0.06)' }}>
          <h3 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 16px', color: '#fff', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 8 }}>
            ⚙️ Ajustes de Operación
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            {/* Símbolo */}
            <div style={fieldGroupStyle}>
              <label style={labelStyle}>Símbolo</label>
              <select value={symbol} onChange={e => setSymbol(e.target.value)} style={selectStyle}>
                {SUPPORTED_SYMBOLS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
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
                {['10','50','100','200','300','500','1000'].map(l => (
                  <option key={l} value={l}>x{l}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Precio y Spread */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginTop: 16 }}>
            {/* Precio de Entrada */}
            <div style={fieldGroupStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={labelStyle}>Precio de Entrada</label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#9ca3af', cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={isManualPrice} 
                    onChange={e => setIsManualPrice(e.target.checked)}
                    style={{ cursor: 'pointer' }}
                  />
                  Precio manual
                </label>
              </div>
              <input 
                type="number" 
                step="0.00001" 
                value={entryPrice} 
                disabled={!isManualPrice && wsStatus === 'connected' && !!market?.[symbol]}
                onChange={e => setEntryPrice(e.target.value)}
                style={{
                  ...inputStyle,
                  opacity: !isManualPrice && wsStatus === 'connected' && !!market?.[symbol] ? 0.6 : 1,
                  borderColor: !isManualPrice && wsStatus === 'connected' && !!market?.[symbol] ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.1)'
                }} 
              />
            </div>

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
                  {pipSize} / {entryN.toFixed(5)} = <strong style={{ color: '#fff' }}>{valPerPipUnit.toFixed(8)}</strong>
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
                  {entryN.toFixed(isJpy ? 3 : 5)}
                </span>
              </div>
              <div style={resultRowStyle}>
                <span style={resultLabelStyle}>Zona de Liquidación:</span>
                <span style={{ fontSize: 18, fontWeight: 700, color: '#f43f5e', fontFamily: 'monospace' }}>
                  {activeLiqPrice.toFixed(isJpy ? 3 : 5)}
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

        {/* Métrica Gráfica de Distancia de Holgura (Custom Graphic) */}
        <div className="glass-panel" style={{ margin: 0, border: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 15, fontWeight: 800, color: '#fff', margin: 0 }}>
              📐 Métrica de Cercanía a Liquidación (Holgura)
            </h3>
            {wsStatus === 'connected' && market?.[symbol] && (
              <span style={{ fontSize: 11, color: '#10b981', fontWeight: 600 }}>
                ● WebSocket Activo: {livePrice.toFixed(isJpy ? 3 : 5)}
              </span>
            )}
          </div>

          <div style={{ position: 'relative', padding: '24px 0 10px' }}>
            {/* Etiquetas Superiores */}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9ca3af', marginBottom: 8, fontWeight: 600 }}>
              <span style={{ color: '#f87171' }}>☠️ Liquidación ({activeLiqPrice.toFixed(isJpy ? 3 : 5)})</span>
              <span>Distancia en Pips: {liveDistancePips.toFixed(1)} pips</span>
              <span style={{ color: '#34d399' }}>🟢 Entrada ({entryN.toFixed(isJpy ? 3 : 5)})</span>
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
                  Precio: {livePrice.toFixed(isJpy ? 3 : 5)}
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
                      { lev: 'x50',   pips: '~230 pips', risk: 'Muy Bajo ✅', color: '#10b981' },
                      { lev: 'x100',  pips: '~115 pips', risk: 'Bajo ✅',     color: '#34d399' },
                      { lev: 'x200',  pips: '~57 pips',  risk: 'Moderado ⚠️', color: '#fbbf24' },
                      { lev: 'x300',  pips: '~38 pips',  risk: 'Alto ⚠️',     color: '#f97316' },
                      { lev: 'x500',  pips: '~23 pips',  risk: 'Muy Alto ❌', color: '#f43f5e' },
                      { lev: 'x1000', pips: '~11 pips',  risk: 'Extremo 💀',  color: '#dc2626' },
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
