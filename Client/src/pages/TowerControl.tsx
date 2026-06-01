/**
 * TowerControl.tsx
 *
 * Página principal de la Torre de Control — Bitácora Inteligente de Operaciones.
 * Integra auto-captura de señales del dashboard, analytics y tabla de historial.
 */

import { useState } from 'react'
import { useMarketData }    from '../hooks/useMarketData'
import { useStructureData } from '../hooks/useStructureData'
import { useTrades }        from '../hooks/useTrades'
import { TradeModal }       from '../components/tower/TradeModal'
import { TradeTable }       from '../components/tower/TradeTable'
import { AnalyticsPanel }   from '../components/tower/AnalyticsPanel'
import { TradingRecommendation } from '../components/tower/TradingRecommendation'
import type { CreateTradePayload } from '../hooks/useTrades'

type Tab = 'analytics' | 'history'

export function TowerControl() {
  const [tab,          setTab]          = useState<Tab>('analytics')
  const [showModal,    setShowModal]    = useState(false)
  const [activeSymbol, setActiveSymbol] = useState('EUR/USD')

  // ── Datos del dashboard (para auto-captura de señales) ────────────────────
  const { data: market } = useMarketData()
  const structureData    = useStructureData()

  const currentMarket  = market?.[activeSymbol]
  const structureSnap  = structureData?.[activeSymbol]?.m5

  // ── Cálculo dinámico de recomendaciones de TP/SL para la auto-captura ──────
  let calculatedTp: number | undefined
  let calculatedSl: number | undefined

  if (currentMarket?.m5 && structureSnap?.nearestSR) {
    const entry = currentMarket.m5.price
    const atr = currentMarket.m5.atr
    const srPrice = structureSnap.nearestSR.price
    const srType = structureSnap.nearestSR.type
    // Asumir dirección según señal estructural dominante (BUY/SELL)
    const direction = structureSnap.signal === 'SELL' ? 'SELL' : 'BUY'

    if (atr > 0) {
      if (direction === 'BUY') {
        if (srType === 'resistance') {
          calculatedTp = entry + (srPrice - entry) * 0.85
          calculatedSl = entry - 1.5 * atr
        } else {
          calculatedSl = srPrice - 0.25 * atr
          calculatedTp = entry + 1.5 * atr
        }
        if (structureSnap.ema200Slope === 'up') {
          if (srType === 'resistance') calculatedSl = entry - 1.2 * atr
        }
      } else {
        if (srType === 'support') {
          calculatedTp = entry - (entry - srPrice) * 0.85
          calculatedSl = entry + 1.5 * atr
        } else {
          calculatedSl = srPrice + 0.25 * atr
          calculatedTp = entry - 1.5 * atr
        }
        if (structureSnap.ema200Slope === 'down') {
          if (srType === 'support') calculatedSl = entry + 1.2 * atr
        }
      }
      
      const decimals = activeSymbol.includes('JPY') ? 3 : 5
      if (calculatedTp != null) calculatedTp = Math.round(calculatedTp * Math.pow(10, decimals)) / Math.pow(10, decimals)
      if (calculatedSl != null) calculatedSl = Math.round(calculatedSl * Math.pow(10, decimals)) / Math.pow(10, decimals)
    }
  }

  // Construye el objeto de auto-captura desde el estado actual del dashboard
  const autoCapture = currentMarket ? {
    symbol:             activeSymbol,
    elasticityM5State:  currentMarket.m5?.state  as any,
    elasticityM15State: currentMarket.m15?.state as any,
    fusedState:         currentMarket.finalState  as any,
    elasticityM5Value:  currentMarket.m5?.elasticity,
    elasticityM15Value: currentMarket.m15?.elasticity,
    ...(structureSnap ? {
      structureState:    structureSnap.structureState as any,
      structureSignal:   structureSnap.signal,
      rsiAtEntry:        structureSnap.rsi,
      divergenceAtEntry: structureSnap.divergence   as any,
      ema200SlopeAtEntry: structureSnap.ema200Slope as any,
      nearestSRPrice:    structureSnap.nearestSR?.price,
      nearestSRType:     structureSnap.nearestSR?.type,
      nearestSRStrength: structureSnap.nearestSR?.strength,
      nearestSRDistance: structureSnap.nearestSR?.distance,
    } : {}),
    recommendedTp:      calculatedTp,
    recommendedSl:      calculatedSl,
  } : { symbol: activeSymbol }

  // ── Trades ────────────────────────────────────────────────────────────────
  const { trades, analytics, loading, createTrade, closeTrade, deleteTrade } = useTrades()

  // Wrappers void para compatibilidad con los tipos de TradeTable
  const handleCloseTrade  = async (id: number, payload: import('../hooks/useTrades').CloseTradePayload) => { await closeTrade(id, payload) }
  const handleDeleteTrade = async (id: number) => { await deleteTrade(id) }

  const openTrades   = trades.filter(t => t.outcome === 'open')
  const closedTrades = trades.filter(t => t.outcome !== 'open')
  const totalPnl     = closedTrades.reduce((s, t) => s + (t.pnl ?? 0), 0)

  const handleCreateTrade = async (payload: CreateTradePayload) => {
    await createTrade(payload)
    setShowModal(false)
  }

  // ── Símbolos disponibles ──────────────────────────────────────────────────
  const symbols = market ? Object.keys(market) : ['EUR/USD']

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(ellipse at 20% 0%, rgba(124,58,237,0.08) 0%, transparent 60%), #07070f',
      padding: '32px 24px',
      maxWidth: 1400,
      margin: '0 auto',
      fontFamily: '"Inter", system-ui, sans-serif',
    }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: '#fff', letterSpacing: '-0.5px' }}>
            🗼 Torre de Control
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>
            Bitácora inteligente de operaciones · Auto-captura de señales · Analytics en tiempo real
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {/* Selector de símbolo activo para auto-captura */}
          <select value={activeSymbol} onChange={e => setActiveSymbol(e.target.value)} style={{
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
            color: '#d1d5db', borderRadius: 8, padding: '8px 12px', fontSize: 12, outline: 'none', cursor: 'pointer',
          }}>
            {symbols.map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          <button onClick={() => setShowModal(true)} style={{
            padding: '9px 20px', borderRadius: 10, cursor: 'pointer',
            background: 'linear-gradient(135deg, #7c3aed, #a78bfa)',
            border: 'none', color: '#fff', fontWeight: 700, fontSize: 13,
            boxShadow: '0 4px 20px rgba(124,58,237,0.4)',
            transition: 'transform 0.15s, box-shadow 0.15s',
          }}
            onMouseEnter={e => { (e.target as HTMLElement).style.transform = 'translateY(-1px)' }}
            onMouseLeave={e => { (e.target as HTMLElement).style.transform = 'translateY(0)' }}
          >
            ➕ Registrar Operación
          </button>
        </div>
      </div>

      {/* ── KPI Strip rápido ───────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 28 }}>
        <QuickKPI label="Abiertas ahora"  value={String(openTrades.length)}
          color="#f59e0b" glow="rgba(245,158,11,0.3)" />
        <QuickKPI label="Total cerradas"  value={String(closedTrades.length)} />
        <QuickKPI label="Win rate global"
          value={analytics ? `${analytics.summary.winRate}%` : '—'}
          color={analytics && analytics.summary.winRate >= 50 ? '#10b981' : '#f43f5e'}
          glow={analytics && analytics.summary.winRate >= 50 ? 'rgba(16,185,129,0.25)' : 'rgba(244,63,94,0.25)'} />
        <QuickKPI label="P&L acumulado"
          value={closedTrades.length ? `${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)}` : '—'}
          color={totalPnl >= 0 ? '#10b981' : '#f43f5e'} />
        {analytics?.summary.avgMAE != null && (
          <QuickKPI label="MAE promedio" value={`$${analytics.summary.avgMAE}`} color="#f43f5e" />
        )}
        {analytics?.summary.avgMFE != null && (
          <QuickKPI label="MFE promedio" value={`$${analytics.summary.avgMFE}`} color="#10b981" />
        )}
      </div>

      {/* ── Señales activas del par seleccionado ───────────────────────────── */}
      {currentMarket && (
        <div style={{
          marginBottom: 24, padding: '12px 18px', borderRadius: 12,
          background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.15)',
          display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center',
        }}>
          <span style={{ fontSize: 11, color: '#a78bfa', fontWeight: 700 }}>
            ⚡ Señales actuales {activeSymbol}:
          </span>
          <SignalBadge label={`M5: ${currentMarket.m5?.state}`}
            color={currentMarket.m5?.state === 'GREEN' ? '#10b981' : currentMarket.m5?.state === 'YELLOW' ? '#f59e0b' : '#6b7280'} />
          <SignalBadge label={`M15: ${currentMarket.m15?.state}`}
            color={currentMarket.m15?.state === 'GREEN' ? '#10b981' : currentMarket.m15?.state === 'YELLOW' ? '#f59e0b' : '#6b7280'} />
          {structureSnap && (
            <>
              <SignalBadge label={`Structure: ${structureSnap.structureState}`}
                color={structureSnap.structureState === 'STRONG' ? '#f43f5e' : structureSnap.structureState === 'MODERATE' ? '#f59e0b' : '#6b7280'} />
              <SignalBadge label={`RSI: ${structureSnap.rsi.toFixed(1)}`} />
              {structureSnap.divergence !== 'none' && (
                <SignalBadge label={`Div: ${structureSnap.divergence}`} color="#a78bfa" />
              )}
            </>
          )}
          <span style={{ fontSize: 10, color: '#4b5563', marginLeft: 'auto' }}>
            Se auto-capturarán al registrar
          </span>
        </div>
      )}

      {/* ── Recomendación operativa del par seleccionado ─────────────────── */}
      {currentMarket && (
        <TradingRecommendation
          symbol={activeSymbol}
          currentPrice={currentMarket.m5?.price}
          atr={currentMarket.m5?.atr}
          nearestSR={structureSnap?.nearestSR as any}
          ema200Slope={structureSnap?.ema200Slope}
          elasticityState={currentMarket.m5?.state}
        />
      )}

      {/* ── Tabs ───────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
        {([['analytics', '📊 Analytics'], ['history', '📋 Historial']] as [Tab, string][]).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '8px 20px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: tab === t ? 700 : 500,
            background: tab === t ? 'rgba(167,139,250,0.15)' : 'rgba(255,255,255,0.03)',
            color: tab === t ? '#a78bfa' : '#6b7280',
            border: tab === t ? '1px solid rgba(167,139,250,0.35)' : '1px solid rgba(255,255,255,0.06)',
            transition: 'all 0.2s',
          }}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Contenido del tab ──────────────────────────────────────────────── */}
      {loading && (
        <div style={{ textAlign: 'center', color: '#6b7280', padding: 40 }}>Cargando operaciones...</div>
      )}

      {!loading && tab === 'analytics' && (
        <AnalyticsPanel analytics={analytics} />
      )}

      {!loading && tab === 'history' && (
        <TradeTable trades={trades} onClose={handleCloseTrade} onDelete={handleDeleteTrade} />
      )}

      {/* ── Modal de registro ──────────────────────────────────────────────── */}
      {showModal && (
        <TradeModal
          onClose={() => setShowModal(false)}
          onSubmit={handleCreateTrade}
          autoCapture={autoCapture}
        />
      )}
    </div>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function QuickKPI({ label, value, color = '#fff', glow }: {
  label: string; value: string; color?: string; glow?: string
}) {
  return (
    <div style={{
      padding: '14px 16px', borderRadius: 12,
      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
      boxShadow: glow ? `0 0 20px ${glow}` : 'none',
    }}>
      <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 900, color, fontFamily: 'monospace' }}>{value}</div>
    </div>
  )
}

function SignalBadge({ label, color = '#6b7280' }: { label: string; color?: string }) {
  return (
    <span style={{
      fontSize: 11, padding: '3px 8px', borderRadius: 5, fontFamily: 'monospace',
      background: `${color}18`, color, border: `1px solid ${color}30`, fontWeight: 600,
    }}>
      {label}
    </span>
  )
}
