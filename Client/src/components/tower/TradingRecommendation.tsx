/**
 * TradingRecommendation.tsx
 *
 * Componente que calcula y muestra sugerencias matemáticas en tiempo real para:
 *   - Take Profit Seguro (TP)
 *   - Stop Loss Técnico (SL)
 *   - Relación Riesgo / Beneficio (R:R)
 *
 * Optimizado para scalping rápido (x1000/x5000) usando Soportes, Resistencias y ATR.
 */

import type { SRLevel } from '../../hooks/useStructureData'

type TradingRecommendationProps = {
  symbol: string
  currentPrice: number
  atr: number
  nearestSR: SRLevel | null
  ema200Slope?: 'up' | 'down' | 'flat'
  elasticityState?: 'GREEN' | 'YELLOW' | 'RED'
}

export function TradingRecommendation({
  symbol,
  currentPrice,
  atr,
  nearestSR,
  ema200Slope = 'flat',
  elasticityState = 'YELLOW',
}: TradingRecommendationProps) {
  if (!currentPrice || !atr || !nearestSR) {
    return (
      <div style={{
        padding: '16px', borderRadius: 12,
        background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)',
        color: '#6b7280', fontSize: 12, textAlign: 'center',
      }}>
        💡 Esperando datos de estructura y volatilidad (ATR) para generar recomendaciones...
      </div>
    )
  }

  const isJpy = symbol.includes('JPY')
  const decimals = isJpy ? 3 : 5
  const pipMultiplier = isJpy ? 100 : 10000
  const pipName = isJpy ? 'pips' : 'pips'

  const entry = currentPrice
  const srPrice = nearestSR.price
  const srType = nearestSR.type

  // ─── 1. ESCENARIO COMPRA (BUY) ──────────────────────────────────────────────
  let buyTp = 0
  let buySl = 0
  let buyReason = ''

  if (srType === 'resistance') {
    // Resistencia arriba: TP seguro al 85% del tramo
    buyTp = entry + (srPrice - entry) * 0.85
    buySl = entry - 1.5 * atr
    buyReason = `Resistencia cercana en ${srPrice.toFixed(decimals)}. TP colocado un 15% antes para asegurar ejecución.`
  } else {
    // Soporte abajo: SL justo debajo del soporte, TP proyectado a 1.5 ATR
    buySl = srPrice - 0.25 * atr
    buyTp = entry + 1.5 * atr
    buyReason = `Soporte firme en ${srPrice.toFixed(decimals)}. SL colocado a salvo por debajo. Proyección a +1.5 ATR.`
  }

  // Ajuste fino por EMA200
  if (ema200Slope === 'up') {
    // Si la tendencia es fuertemente alcista, ajustamos el SL un poco más cerca (1.2 ATR en vez de 1.5) para maximizar R:R
    if (srType === 'resistance') buySl = entry - 1.2 * atr
    buyReason += ' (SL ajustado por inercia alcista de EMA200 ✓)'
  }

  const buyRiskPips = Math.abs(entry - buySl) * pipMultiplier
  const buyRewardPips = Math.abs(buyTp - entry) * pipMultiplier
  const buyRR = buyRiskPips > 0 ? (buyRewardPips / buyRiskPips) : 0

  // ─── 2. ESCENARIO VENTA (SELL) ─────────────────────────────────────────────
  let sellTp = 0
  let sellSl = 0
  let sellReason = ''

  if (srType === 'support') {
    // Soporte abajo: TP seguro al 85% del tramo bajista
    sellTp = entry - (entry - srPrice) * 0.85
    sellSl = entry + 1.5 * atr
    sellReason = `Soporte cercano en ${srPrice.toFixed(decimals)}. TP colocado un 15% antes para evitar rebotes.`
  } else {
    // Resistencia arriba: SL justo arriba de la resistencia, TP proyectado a 1.5 ATR
    sellSl = srPrice + 0.25 * atr
    sellTp = entry - 1.5 * atr
    sellReason = `Resistencia en ${srPrice.toFixed(decimals)}. SL protegido por encima. Proyección bajista a -1.5 ATR.`
  }

  // Ajuste fino por EMA200
  if (ema200Slope === 'down') {
    if (srType === 'support') sellSl = entry + 1.2 * atr
    sellReason += ' (SL ajustado por inercia bajista de EMA200 ✓)'
  }

  const sellRiskPips = Math.abs(sellSl - entry) * pipMultiplier
  const sellRewardPips = Math.abs(entry - sellTp) * pipMultiplier
  const sellRR = sellRiskPips > 0 ? (sellRewardPips / sellRiskPips) : 0

  return (
    <div style={{
      marginBottom: 24, padding: '20px', borderRadius: 16,
      background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
      boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.03)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          🎯 Sugerencia Operativa Matemática (x1000 / x5000)
        </h3>
        <div style={{ fontSize: 11, color: '#6b7280' }}>
          Elasticidad M5: <span style={{
            fontFamily: 'monospace',
            color: elasticityState === 'GREEN' ? '#10b981' : elasticityState === 'YELLOW' ? '#f59e0b' : '#f43f5e',
            fontWeight: 700,
            marginRight: '12px'
          }}>{elasticityState}</span>
          | &nbsp; Volatilidad (ATR): <span style={{ fontFamily: 'monospace', color: '#d1d5db', fontWeight: 600 }}>{atr.toFixed(decimals)}</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        
        {/* COMPRA */}
        <div style={{
          padding: '16px', borderRadius: 12,
          background: 'radial-gradient(circle at 100% 100%, rgba(16,185,129,0.03) 0%, transparent 80%), rgba(255,255,255,0.01)',
          border: '1px solid rgba(16,185,129,0.1)',
          transition: 'border 0.2s',
        }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(16,185,129,0.3)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(16,185,129,0.1)' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 900, color: '#10b981', display: 'flex', alignItems: 'center', gap: 6 }}>
              🟢 ESCENARIO DE COMPRA (BUY)
            </span>
            <span style={{
              fontSize: 10, padding: '2px 6px', borderRadius: 4, fontWeight: 700,
              background: buyRR >= 1.5 ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
              color: buyRR >= 1.5 ? '#10b981' : '#f59e0b',
              border: buyRR >= 1.5 ? '1px solid rgba(16,185,129,0.25)' : '1px solid rgba(245,158,11,0.25)'
            }}>
              R:R {buyRR.toFixed(1)}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: '#9ca3af' }}>Take Profit Seguro:</span>
              <span style={{
                fontSize: 13, fontWeight: 900, color: '#10b981', fontFamily: 'monospace',
                textShadow: '0 0 8px rgba(16,185,129,0.2)'
              }}>
                {buyTp.toFixed(decimals)} <span style={{ fontSize: 10, color: '#6b7280', fontWeight: 500 }}>(+{buyRewardPips.toFixed(0)} {pipName})</span>
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: '#9ca3af' }}>Stop Loss Técnico:</span>
              <span style={{ fontSize: 13, fontWeight: 900, color: '#f43f5e', fontFamily: 'monospace' }}>
                {buySl.toFixed(decimals)} <span style={{ fontSize: 10, color: '#6b7280', fontWeight: 500 }}>(-{buyRiskPips.toFixed(0)} {pipName})</span>
              </span>
            </div>
          </div>
          <div style={{ fontSize: 11, color: '#6b7280', lineHeight: '1.4', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: 8 }}>
            📖 {buyReason}
          </div>
        </div>

        {/* VENTA */}
        <div style={{
          padding: '16px', borderRadius: 12,
          background: 'radial-gradient(circle at 100% 100%, rgba(244,63,94,0.03) 0%, transparent 80%), rgba(255,255,255,0.01)',
          border: '1px solid rgba(244,63,94,0.1)',
          transition: 'border 0.2s',
        }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(244,63,94,0.3)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(244,63,94,0.1)' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 900, color: '#f43f5e', display: 'flex', alignItems: 'center', gap: 6 }}>
              🔴 ESCENARIO DE VENTA (SELL)
            </span>
            <span style={{
              fontSize: 10, padding: '2px 6px', borderRadius: 4, fontWeight: 700,
              background: sellRR >= 1.5 ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
              color: sellRR >= 1.5 ? '#10b981' : '#f59e0b',
              border: sellRR >= 1.5 ? '1px solid rgba(16,185,129,0.25)' : '1px solid rgba(245,158,11,0.25)'
            }}>
              R:R {sellRR.toFixed(1)}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: '#9ca3af' }}>Take Profit Seguro:</span>
              <span style={{
                fontSize: 13, fontWeight: 900, color: '#10b981', fontFamily: 'monospace',
                textShadow: '0 0 8px rgba(16,185,129,0.2)'
              }}>
                {sellTp.toFixed(decimals)} <span style={{ fontSize: 10, color: '#6b7280', fontWeight: 500 }}>(+{sellRewardPips.toFixed(0)} {pipName})</span>
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: '#9ca3af' }}>Stop Loss Técnico:</span>
              <span style={{ fontSize: 13, fontWeight: 900, color: '#f43f5e', fontFamily: 'monospace' }}>
                {sellSl.toFixed(decimals)} <span style={{ fontSize: 10, color: '#6b7280', fontWeight: 500 }}>(-{sellRiskPips.toFixed(0)} {pipName})</span>
              </span>
            </div>
          </div>
          <div style={{ fontSize: 11, color: '#6b7280', lineHeight: '1.4', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: 8 }}>
            📖 {sellReason}
          </div>
        </div>

      </div>
    </div>
  )
}
