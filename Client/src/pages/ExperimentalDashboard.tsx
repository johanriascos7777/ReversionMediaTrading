/**
 * ExperimentalDashboard.tsx
 *
 * Canal paralelo de QA: muestra todos los paneles del Home
 * pero usando el motor experimental corregido (EMA, BUY/SELL, Pico-giro).
 *
 * ❌ NO incluye: ApiKeysStatus (KeyPoller)
 * ✅ Incluye: Live Cockpit, Semáforo de Peatón, ElasticityCard,
 *             Historical Backtest, Contextual Comparison, LaunchCockpit,
 *             Fused Signal, SystemObservability, StructureCockpit, Toasts
 */

import { useRef, useState, useEffect } from 'react'
import { useMarketData } from '../hooks/useMarketData'
import { useHistoricalData } from '../hooks/useHistoricalData'
import { useBacktest } from '../hooks/useBacktest'
import { useStructureData } from '../hooks/useStructureData'

import { Semaforo } from '../components/Semaforo'
import { BacktestMetrics } from '../components/BacktestMetrics'
import { ElasticityCard } from '../components/ElasticityCard'
import { SystemObservability } from '../components/SystemObservability'
import { StructureCockpit } from '../components/StructureCockpit'
import { LaunchCockpit } from '../components/tower/LaunchCockpit'

import { API_URL } from '@/config/env'

// ─── Mini helpers ─────────────────────────────────────────────────────────────

const LED = ({ state, size = 8 }: { state: 'GREEN' | 'YELLOW' | 'RED'; size?: number }) => {
  const colors = {
    GREEN:  { bg: '#10b981', shadow: '0 0 10px #10b981, 0 0 3px #10b981' },
    YELLOW: { bg: '#f59e0b', shadow: '0 0 10px #f59e0b, 0 0 3px #f59e0b' },
    RED:    { bg: '#ef4444', shadow: '0 0 4px rgba(239,68,68,0.4)' }
  }
  const current = colors[state] || colors.RED
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      backgroundColor: current.bg, boxShadow: current.shadow,
      transition: 'all 0.3s ease'
    }} />
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

interface Toast {
  id: string
  symbol: string
  type: 'A' | 'B'
  title: string
  message: string
}

export function ExperimentalDashboard() {
  const [activeSymbol, setActiveSymbol] = useState('EUR/USD')
  const [toasts, setToasts] = useState<Toast[]>([])
  const [dismissedFallbacks, setDismissedFallbacks] = useState<Set<string>>(new Set())

  const { data: market, status: wsStatus, wsFallbacks, exhaustAlert } = useMarketData()

  const activeKey = market && market[activeSymbol] ? activeSymbol : (market ? Object.keys(market)[0] : 'EUR/USD')
  const currentRaw = market ? market[activeKey] : null

  // Usamos los datos del motor experimental como fuente primaria
  const exp = currentRaw?.experimental

  // Para las secciones que usan FinalMarketView (LaunchCockpit, etc.)
  // construimos una vista que use los datos experimentales
  const expMarketView = currentRaw && exp ? {
    ...currentRaw,
    m5: exp.m5,
    m15: exp.m15,
    finalState: exp.finalState,
    fusedState: exp.fusedState,
    triggerState: exp.triggerState,
    fusedExplanation: exp.fusedExplanation,
    fusedComparison: exp.fusedComparison,
    backtest: exp.backtest,
  } : null

  // Hooks de historial y backtest (mismos datos base, diferente motor)
  const historical = useHistoricalData(activeKey)
  const backtest = useBacktest(historical)
  const structureData = useStructureData()

  // Refs para alertas Telegram del canal experimental
  const prevExpFusedRefs = useRef<{ [symbol: string]: string | null }>({})
  const prevExpFinalRefs = useRef<{ [symbol: string]: string | null }>({})
  const lastExpAlertARefs = useRef<{ [symbol: string]: number }>({})
  const lastExpAlertBRefs = useRef<{ [symbol: string]: number }>({})

  // Refs para toasts de símbolos no activos
  const lastExpStateChecked = useRef<{ [symbol: string]: { final: string; fused: string } }>({})

  // 📡 Alertas Telegram del motor experimental
  useEffect(() => {
    if (!currentRaw || !exp) return

    const symbol = currentRaw.symbol
    const now = Date.now()

    const prevFused = prevExpFusedRefs.current[symbol] || null
    const prevFinal = prevExpFinalRefs.current[symbol] || null
    const lastAlertA = lastExpAlertARefs.current[symbol] || 0
    const lastAlertB = lastExpAlertBRefs.current[symbol] || 0

    // Semáforo de Peatón WALK → Tipo A Experimental
    const isWalk = exp.pedestrianLight === 'WALK'
    const prevWalk = prevFused === 'WALK'
    const canAlertA = now - lastAlertA > 300000

    if (isWalk && !prevWalk && canAlertA) {
      lastExpAlertARefs.current[symbol] = now
      fetch(`${API_URL}/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message:
            `[🧪 EXPERIMENTAL - ${symbol}] 🚦 SEMÁFORO DE PEATÓN: CAMINAR (WALK)` +
            `\n\nTodas las confluencias experimentales están alineadas.` +
            `\nDirección: ${exp.m5.direction}` +
            `\nM5 (EMA): ${exp.m5.elasticity.toFixed(2)} | M15 (EMA): ${exp.m15.elasticity.toFixed(2)}` +
            `\nFused Experimental: ${exp.fusedState}` +
            `\nGatillo: ${exp.triggerState}`
        })
      }).catch(err => console.error('[Telegram-Exp] Error Semáforo WALK:', err))
    }

    // Fused GREEN → Tipo B Experimental (confirmación histórica)
    const isNewFusedGreen = prevFused !== 'GREEN' && exp.fusedState === 'GREEN'
    const canAlertB = now - lastAlertB > 300000

    if (isNewFusedGreen && !isWalk && canAlertB) {
      lastExpAlertBRefs.current[symbol] = now
      fetch(`${API_URL}/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message:
            `[🧪 EXPERIMENTAL - ${symbol}] 🟢 ALERTA CONFIRMADA EXPERIMENTAL (Tipo A)` +
            `\n\n${exp.fusedExplanation}` +
            `\n\nM5 (EMA): ${exp.m5.elasticity.toFixed(2)} | M15 (EMA): ${exp.m15.elasticity.toFixed(2)}`
        })
      }).catch(err => console.error('[Telegram-Exp] Error Tipo A Experimental:', err))
    }

    // Final GREEN sin fused GREEN → Tipo B
    const isNewFinalGreen = prevFinal !== 'GREEN' && exp.finalState === 'GREEN'
    if (isNewFinalGreen && exp.fusedState !== 'GREEN' && canAlertB) {
      lastExpAlertBRefs.current[symbol] = now
      fetch(`${API_URL}/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message:
            `[🧪 EXPERIMENTAL - ${symbol}] 🟡 ALERTA TIEMPO REAL EXPERIMENTAL (Tipo B)` +
            `\n\nFinalState experimental en GREEN sin confirmación del backtest.` +
            `\nM5 (EMA): ${exp.m5.elasticity.toFixed(2)} | M15 (EMA): ${exp.m15.elasticity.toFixed(2)}`
        })
      }).catch(err => console.error('[Telegram-Exp] Error Tipo B Experimental:', err))
    }

    prevExpFusedRefs.current[symbol] = exp.pedestrianLight === 'WALK' ? 'WALK' : exp.fusedState
    prevExpFinalRefs.current[symbol] = exp.finalState
  }, [currentRaw, exp])

  // 🔔 Toasts para pares no activos
  useEffect(() => {
    if (!market) return

    Object.keys(market).forEach((sym) => {
      const item = market[sym]
      if (!item?.experimental) return

      const expItem = item.experimental
      const prev = lastExpStateChecked.current[sym] || { final: 'RED', fused: 'RED' }

      if (sym !== activeKey) {
        if (prev.fused !== 'WALK' && expItem.pedestrianLight === 'WALK') {
          const id = sym + '-exp-walk-' + Date.now()
          setToasts(prev => [...prev, {
            id, symbol: sym, type: 'A',
            title: `🚦 Semáforo WALK en ${sym}`,
            message: `¡Confluencia experimental total! Dir: ${expItem.m5.direction} | M5: ${expItem.m5.elasticity.toFixed(2)}`
          }])
          setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 8000)
        } else if (prev.fused !== 'GREEN' && expItem.fusedState === 'GREEN' && expItem.pedestrianLight !== 'WALK') {
          const id = sym + '-exp-fused-' + Date.now()
          setToasts(prev => [...prev, {
            id, symbol: sym, type: 'A',
            title: `🧪 Señal Exp. Tipo A en ${sym}`,
            message: `Motor experimental confirmado. M5: ${expItem.m5.elasticity.toFixed(2)} | M15: ${expItem.m15.elasticity.toFixed(2)}`
          }])
          setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 8000)
        }
      }

      lastExpStateChecked.current[sym] = {
        final: expItem.finalState,
        fused: expItem.pedestrianLight === 'WALK' ? 'WALK' : expItem.fusedState
      }
    })
  }, [market, activeKey])

  const dismissToast = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    setToasts(prev => prev.filter(t => t.id !== id))
  }

  // ── Pantalla de carga ─────────────────────────────────────────────────────
  if (!market || !currentRaw) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', flexDirection: 'column', gap: 12,
        color: '#555', fontFamily: 'monospace', textAlign: 'center', padding: 24
      }}>
        <div style={{
          width: 10, height: 10, borderRadius: '50%',
          background: wsStatus === 'connected' ? '#10b981' : (wsStatus === 'connecting' ? '#eab308' : '#dc2626'),
          boxShadow: `0 0 10px ${wsStatus === 'connected' ? '#10b981' : (wsStatus === 'connecting' ? '#eab308' : '#dc2626')}`,
        }} />
        <p style={{ margin: 0, fontSize: 13, color: '#f3f4f6' }}>
          {wsStatus === 'connecting' && 'Conectando al backend experimental...'}
          {wsStatus === 'disconnected' && 'Backend desconectado — verifica que corre en puerto 8082'}
          {wsStatus === 'connected' && 'Conectado ✓ Esperando snapshots...'}
        </p>
      </div>
    )
  }

  // Datos experimentales del símbolo activo
  const isWalk = exp?.pedestrianLight === 'WALK'
  const directionColor = exp?.m5?.direction === 'BUY' ? '#10b981' : '#f43f5e'

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(ellipse at 50% 0%, rgba(139,92,246,0.08) 0%, transparent 60%), #07070f',
      padding: '24px 0',
      color: '#fff',
      fontFamily: '"Outfit", "Inter", sans-serif'
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>

        {/* ==================================================== */}
        {/* 🔴 ALERTA CRÍTICA DE API KEYS                         */}
        {/* ==================================================== */}
        {exhaustAlert && (
          <div style={{
            marginBottom: 24, borderRadius: 12,
            border: '1px solid rgba(239,68,68,0.4)',
            background: 'linear-gradient(135deg, rgba(239,68,68,0.15) 0%, rgba(185,28,28,0.1) 100%)',
            boxShadow: '0 0 20px rgba(239,68,68,0.15)', backdropFilter: 'blur(10px)',
            padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16,
          }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 12px #ef4444, 0 0 24px #ef4444' }} />
            <div style={{ flex: 1, textAlign: 'left' }}>
              <h4 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.5px' }}>⚠️ Critical API Keys Exhausted</h4>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#fca5a5', lineHeight: 1.4, fontFamily: 'monospace' }}>{exhaustAlert}</p>
            </div>
          </div>
        )}

        {/* HEADER EXPERIMENTAL */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32, gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 30, fontWeight: 900, letterSpacing: '-1px', background: 'linear-gradient(135deg, #a78bfa, #60a5fa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              🧪 EXPERIMENTAL DASHBOARD
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#9ca3af' }}>
              Canal QA · Motor corregido (EMA real, BUY/SELL, Pico-giro reactivo) · Sin alterar producción
            </p>
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {/* Badge WS */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '8px 16px', borderRadius: 20,
              background: wsStatus === 'connected' ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)',
              border: wsStatus === 'connected' ? '1px solid rgba(16,185,129,0.15)' : '1px solid rgba(239,68,68,0.15)',
              backdropFilter: 'blur(8px)',
            }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: wsStatus === 'connected' ? '#10b981' : '#ef4444',
                boxShadow: wsStatus === 'connected' ? '0 0 10px #10b981' : '0 0 10px #ef4444',
              }} />
              <span style={{ fontSize: 12, color: wsStatus === 'connected' ? '#10b981' : '#ef4444', fontFamily: 'monospace', fontWeight: 600 }}>
                {wsStatus === 'connected' ? 'BACKEND CONNECTED' : 'DISCONNECTED'}
              </span>
            </div>

            {/* Selector símbolo */}
            <select value={activeSymbol} onChange={e => setActiveSymbol(e.target.value)} style={{
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
              color: '#fff', borderRadius: 8, padding: '8px 12px', fontSize: 12, outline: 'none',
              cursor: 'pointer', fontWeight: 600
            }}>
              {Object.keys(market).map(s => <option key={s} value={s} style={{ background: '#0a0a14' }}>{s}</option>)}
            </select>
          </div>
        </div>

        {/* ⚠️ REST Fallback Banner */}
        {Object.keys(wsFallbacks).filter(sym => !dismissedFallbacks.has(sym)).length > 0 && (
          <div style={{
            marginBottom: 20, borderRadius: 12,
            border: '1px solid rgba(245,158,11,0.35)',
            background: 'linear-gradient(135deg, rgba(245,158,11,0.08) 0%, rgba(217,119,6,0.06) 100%)',
            backdropFilter: 'blur(10px)', overflow: 'hidden',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '1px solid rgba(245,158,11,0.15)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b', boxShadow: '0 0 8px #f59e0b' }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: '#f59e0b', fontFamily: 'monospace', textTransform: 'uppercase' }}>
                  ⚡ REST Poller Activo — WebSocket Restringido
                </span>
              </div>
              <button onClick={() => setDismissedFallbacks(new Set(Object.keys(wsFallbacks)))}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: 16, padding: '2px 6px' }}>✕</button>
            </div>
            {Object.keys(wsFallbacks).filter(sym => !dismissedFallbacks.has(sym)).map(sym => (
              <div key={sym} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 16px', borderBottom: '1px solid rgba(245,158,11,0.08)' }}>
                <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 12, padding: '3px 10px', borderRadius: 8, background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)', color: '#fbbf24', minWidth: 90, textAlign: 'center' }}>{sym}</span>
                <span style={{ fontSize: 11, color: '#92400e', fontFamily: 'monospace' }}>WS: <span style={{ color: '#ef4444', fontWeight: 700 }}>✗ Rechazado</span></span>
                <span style={{ fontSize: 11, color: '#92400e', fontFamily: 'monospace' }}>REST: <span style={{ color: '#10b981', fontWeight: 700 }}>✓ Activo</span></span>
                <button onClick={() => setDismissedFallbacks(prev => new Set([...prev, sym]))}
                  style={{ marginLeft: 'auto', background: 'transparent', border: 'none', cursor: 'pointer', color: '#4b5563', fontSize: 13, padding: '2px 6px' }}>✕</button>
              </div>
            ))}
          </div>
        )}

        {/* ==================================================== */}
        {/* 🚦 SEMÁFORO DE PEATÓN (exclusivo del canal exp.)      */}
        {/* ==================================================== */}
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 14, textTransform: 'uppercase', letterSpacing: '2px', color: '#a78bfa', margin: '0 0 16px 4px', fontWeight: 700 }}>
            🚦 Semáforo de Peatón (Confluencia Total Experimental)
          </h2>
          <div style={{
            padding: '24px', borderRadius: 16,
            background: isWalk
              ? 'radial-gradient(circle at 20% 50%, rgba(16,185,129,0.08) 0%, transparent 60%), rgba(15,15,25,0.6)'
              : 'rgba(15,15,25,0.6)',
            border: isWalk ? '1px solid rgba(16,185,129,0.2)' : '1px solid rgba(255,255,255,0.06)',
            backdropFilter: 'blur(16px)',
            display: 'flex', gap: 32, alignItems: 'center', flexWrap: 'wrap',
            transition: 'all 0.4s ease'
          }}>
            {/* Semáforo visual */}
            <div style={{
              width: 90, height: 180, background: '#11111a', borderRadius: 18,
              border: '4px solid #1e1e2f', padding: '14px 0',
              display: 'flex', flexDirection: 'column', justifyContent: 'space-around', alignItems: 'center',
              boxShadow: '0 10px 30px rgba(0,0,0,0.5)', flexShrink: 0
            }}>
              <div style={{
                width: 54, height: 54, borderRadius: '50%',
                background: !isWalk ? '#f43f5e' : '#22080e',
                boxShadow: !isWalk ? '0 0 25px #f43f5e, inset 0 0 10px rgba(255,255,255,0.3)' : 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, transition: 'all 0.3s'
              }}>🛑</div>
              <div style={{
                width: 54, height: 54, borderRadius: '50%',
                background: isWalk ? '#10b981' : '#042217',
                boxShadow: isWalk ? '0 0 25px #10b981, inset 0 0 10px rgba(255,255,255,0.3)' : 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, transition: 'all 0.3s',
                animation: isWalk ? 'pulse-walk 1.5s infinite alternate' : 'none'
              }}>🚶‍♂️</div>
            </div>

            {/* Estado y texto */}
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 26, fontWeight: 900, color: isWalk ? '#10b981' : '#f43f5e', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>
                {isWalk ? '¡CAMINAR (WALK)!' : 'PARAR (STOP)'}
              </div>
              <div style={{ fontSize: 13, color: '#9ca3af', lineHeight: 1.5, marginBottom: 12 }}>
                {isWalk
                  ? `Todas las confluencias experimentales están alineadas para ${activeKey}.`
                  : 'Esperando que todos los indicadores experimentales coincidan.'}
              </div>
              {isWalk && exp && (
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '8px 16px', borderRadius: 8,
                  background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)',
                  fontSize: 14, fontWeight: 700
                }}>
                  Operación sugerida: <span style={{ color: directionColor, marginLeft: 4 }}>
                    {exp.m5.direction === 'BUY' ? 'COMPRA (BUY)' : 'VENTA (SELL)'}
                  </span>
                </div>
              )}
            </div>

            {/* Checklist de confluencia */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 260 }}>
              <ConfluenceItem
                label="Anomalía M5+M15 (EMA)"
                checked={exp ? (exp.finalState === 'GREEN' || exp.finalState === 'YELLOW') : false}
              />
              <ConfluenceItem
                label="Ventaja Backtest Dir. (Win Rate ≥ 65%)"
                checked={exp ? (exp.fusedState === 'GREEN' || (exp.fusedComparison && exp.fusedComparison.winRate >= 65)) : false}
              />
              <ConfluenceItem
                label="Giro de Elasticidad (Pico superado)"
                checked={exp ? exp.triggerState === 'giro' : false}
              />
            </div>
          </div>
        </div>

        {/* ==================================================== */}
        {/* ⚡ LIVE COCKPIT (multi-símbolo experimental)         */}
        {/* ==================================================== */}
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 14, textTransform: 'uppercase', letterSpacing: '2px', color: '#6b7280', margin: '0 0 16px 4px', fontWeight: 700 }}>
            ⚡ Live Cockpit Experimental (Click para Inspeccionar)
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
            {Object.keys(market).map((sym) => {
              const item = market[sym]
              const expItem = item?.experimental
              const isActive = sym === activeKey
              const expFused = expItem?.fusedState ?? 'RED'
              const expWalk = expItem?.pedestrianLight === 'WALK'
              return (
                <div
                  key={sym}
                  onClick={() => setActiveSymbol(sym)}
                  style={{
                    cursor: 'pointer',
                    background: isActive ? 'rgba(139,92,246,0.06)' : 'rgba(255,255,255,0.01)',
                    border: isActive ? '1px solid rgba(139,92,246,0.35)' : '1px solid rgba(255,255,255,0.05)',
                    boxShadow: isActive ? '0 8px 24px rgba(139,92,246,0.12)' : 'none',
                    borderRadius: 14, padding: '20px 24px',
                    transition: 'all 0.2s ease', backdropFilter: 'blur(12px)', position: 'relative'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <span style={{ fontWeight: 700, fontSize: 18, color: '#f3f4f6', letterSpacing: '-0.3px' }}>{sym}</span>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      {expWalk && (
                        <span style={{
                          fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 4,
                          background: 'rgba(16,185,129,0.15)', color: '#10b981',
                          border: '1px solid rgba(16,185,129,0.25)', fontFamily: 'monospace'
                        }}>WALK</span>
                      )}
                      <span style={{
                        fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 6,
                        backgroundColor: expFused === 'GREEN' ? 'rgba(16,185,129,0.12)' : (expFused === 'YELLOW' ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)'),
                        color: expFused === 'GREEN' ? '#34d399' : (expFused === 'YELLOW' ? '#fbbf24' : '#f87171'),
                        border: expFused === 'GREEN' ? '1px solid rgba(16,185,129,0.15)' : (expFused === 'YELLOW' ? '1px solid rgba(245,158,11,0.15)' : '1px solid rgba(239,68,68,0.15)'),
                        fontFamily: 'monospace', letterSpacing: '0.5px'
                      }}>EXP: {expFused}</span>
                    </div>
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'monospace', letterSpacing: '-0.5px', color: '#fff', marginBottom: 16 }}>
                    {item.m5.price.toFixed(5)}
                  </div>
                  <div style={{ display: 'flex', gap: 16, alignItems: 'center', fontSize: 11, color: '#9ca3af', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontWeight: 500 }}>M5</span>
                      <LED state={expItem?.m5?.state ?? 'RED'} size={7} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontWeight: 500 }}>M15</span>
                      <LED state={expItem?.m15?.state ?? 'RED'} size={7} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontWeight: 500 }}>FUSED</span>
                      <LED state={expFused} size={7} />
                    </div>
                    {expItem && (
                      <span style={{ marginLeft: 'auto', fontSize: 10, color: expItem.m5.direction === 'BUY' ? '#10b981' : '#f43f5e', fontWeight: 700 }}>
                        {expItem.m5.direction}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ==================================================== */}
        {/* 🔍 DETAIL INSPECTOR                                   */}
        {/* ==================================================== */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 24 }}>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, paddingLeft: 4 }}>
            <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: '-0.5px', color: '#fff' }}>
              🧪 Detail Inspector: {activeKey}
            </h2>
            <span style={{ color: '#6b7280', fontSize: 14 }}>motor experimental activo</span>
          </div>

          {/* SEMÁFORO + ELASTICITY CARD */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 }}>

            {/* SEMÁFORO LIVE EXPERIMENTAL */}
            <div className="glass-panel" style={{ margin: 0 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 8px', color: '#fff' }}>
                🟢 Live Decision Engine (Experimental)
              </h3>
              <p style={{ margin: '0 0 16px', fontSize: 13, color: '#9ca3af', lineHeight: 1.4 }}>
                Análisis de volatilidad con EMA real y segmentación por dirección BUY/SELL.
              </p>
              {exp ? (
                <div style={{ display: 'flex', gap: 12, marginBottom: 12, fontSize: 13, flexWrap: 'wrap' }}>
                  <span>M5 EMA: <strong>{exp.m5.elasticity.toFixed(2)}</strong> ({exp.m5.state})</span>
                  <span style={{ opacity: 0.3 }}>|</span>
                  <span>M15 EMA: <strong>{exp.m15.elasticity.toFixed(2)}</strong> ({exp.m15.state})</span>
                  <span style={{ opacity: 0.3 }}>|</span>
                  <span style={{ color: directionColor, fontWeight: 700 }}>{exp.m5.direction}</span>
                </div>
              ) : (
                <div style={{ marginBottom: 12, fontSize: 13, color: '#6b7280' }}>Esperando datos experimentales...</div>
              )}
              <Semaforo state={exp?.finalState ?? 'RED'} label="Estado Experimental" />
            </div>

            {/* TARJETA DE ELASTICIDAD EXPERIMENTAL */}
            <div className="glass-panel" style={{ margin: 0, padding: 0, border: 'none', background: 'transparent' }}>
              {exp ? (
                <ElasticityCard
                  symbol={activeKey}
                  m5={exp.m5}
                  m15={exp.m15}
                  fusedState={exp.finalState}
                />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120, color: '#6b7280', fontSize: 14, fontFamily: 'monospace' }}>
                  Sin datos experimentales aún...
                </div>
              )}
            </div>
          </div>

          {/* BACKTEST + CONTEXTUAL COMPARISON */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 }}>

            {/* BACKTEST EXPERIMENTAL */}
            <div className="glass-panel" style={{ margin: 0 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 8px', color: '#fff' }}>
                🧪 Historical Backtest (500 bars · EMA)
              </h3>
              <p style={{ margin: '0 0 16px', fontSize: 13, color: '#9ca3af', lineHeight: 1.4 }}>
                Estadísticas calculadas con EMA real y segmentadas por dirección ({exp?.m5?.direction ?? '—'}).
              </p>
              {backtest ? (
                <BacktestMetrics data={backtest} />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120, color: '#6b7280', fontSize: 14, fontFamily: 'monospace' }}>
                  Cargando historial...
                </div>
              )}
            </div>

            {/* CONTEXTUAL COMPARISON EXPERIMENTAL */}
            <div className="glass-panel" style={{ margin: 0 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 8px', color: '#fff' }}>
                📊 Contextual Comparison (Experimental)
              </h3>
              <p style={{ margin: '0 0 16px', fontSize: 13, color: '#9ca3af', lineHeight: 1.4 }}>
                Comparando elasticidad experimental M5: {exp?.m5?.elasticity?.toFixed(2) ?? '—'} con historial.
              </p>
              {exp?.fusedComparison ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, textAlign: 'center' }}>
                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px 8px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.03)' }}>
                      <div style={{ fontSize: 20, fontWeight: 700, color: '#fff', fontFamily: 'monospace' }}>{exp.fusedComparison.similarSignals}</div>
                      <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', marginTop: 4 }}>Similar Cases</div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px 8px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.03)' }}>
                      <div style={{ fontSize: 20, fontWeight: 700, color: '#10b981', fontFamily: 'monospace' }}>{exp.fusedComparison.winRate.toFixed(1)}%</div>
                      <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', marginTop: 4 }}>Win Rate Dir.</div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px 8px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.03)' }}>
                      <div style={{ fontSize: 20, fontWeight: 700, color: '#eab308', fontFamily: 'monospace' }}>{exp.fusedComparison.avgBarsToRevert.toFixed(1)}</div>
                      <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', marginTop: 4 }}>Avg Bars</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 13, color: '#9ca3af', lineHeight: 1.5, background: 'rgba(255,255,255,0.01)', padding: 12, borderRadius: 8, border: '1px solid rgba(255,255,255,0.03)' }}>
                    🔍 Motor experimental encontró {exp.fusedComparison.similarSignals} caso(s) similares en dirección {exp.m5.direction}, con recuperación promedio en {exp.fusedComparison.avgBarsToRevert.toFixed(1)} velas.
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120, color: '#6b7280', fontSize: 14, fontFamily: 'monospace' }}>
                  Esperando datos experimentales...
                </div>
              )}
            </div>
          </div>

          {/* ==================================================== */}
          {/* 🪃 CABINA DE DISPARO EXPERIMENTAL                    */}
          {/* ==================================================== */}
          <LaunchCockpit marketView={expMarketView} />

          {/* FUSED SIGNAL EXPERIMENTAL */}
          <div style={{
            border: '1px solid rgba(139,92,246,0.15)',
            background: 'rgba(139,92,246,0.03)',
            backdropFilter: 'blur(16px)',
            borderRadius: 16, padding: 24,
            boxShadow: '0 4px 30px rgba(0, 0, 0, 0.3)'
          }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 6px', color: '#fff' }}>
              🚥 Fused System Signal (Experimental)
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: '#9ca3af', lineHeight: 1.4 }}>
              Combina señal de extremo de precio con estadísticas históricas segmentadas por dirección.
            </p>
            <div style={{
              fontSize: 14, color: '#d1d5db',
              background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.03)',
              borderRadius: 8, padding: '16px 20px',
              margin: '0 0 16px', lineHeight: 1.6, fontFamily: 'monospace'
            }}>
              {exp?.fusedExplanation ?? 'Esperando datos del motor experimental...'}
            </div>
            <Semaforo state={exp?.fusedState ?? 'RED'} label="Señal Fused Experimental" />
          </div>

          {/* SYSTEM OBSERVABILITY */}
          <SystemObservability />

          {/* STRUCTURE ENGINE */}
          <div style={{
            marginTop: 16, padding: '24px 28px',
            background: 'rgba(167,139,250,0.03)',
            border: '1px solid rgba(167,139,250,0.12)',
            borderRadius: 18, backdropFilter: 'blur(12px)',
          }}>
            <StructureCockpit data={structureData} />
          </div>

          {/* TEST TELEGRAM */}
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}>
            <button
              style={{
                background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)',
                color: '#a78bfa', fontWeight: 600, fontSize: 13,
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '10px 20px', borderRadius: 20, cursor: 'pointer', transition: 'all 0.2s'
              }}
              onClick={() => {
                fetch(`${API_URL}/notify`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ message: `[🧪 EXPERIMENTAL] Test de conexión OK para ${activeKey}!` })
                }).catch(console.error)
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(139,92,246,0.15)'
                e.currentTarget.style.borderColor = 'rgba(139,92,246,0.3)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(139,92,246,0.1)'
                e.currentTarget.style.borderColor = 'rgba(139,92,246,0.2)'
              }}
            >
              💬 Test Telegram Experimental
            </button>
          </div>

        </div>

        {/* ==================================================== */}
        {/* 🔔 TOAST NOTIFICATIONS                               */}
        {/* ==================================================== */}
        {toasts.length > 0 && (
          <div className="toast-container">
            {toasts.map((toast) => {
              const isTypeA = toast.type === 'A'
              return (
                <div
                  key={toast.id}
                  className="toast-card"
                  style={{ borderLeft: isTypeA ? '4px solid #10b981' : '4px solid #f59e0b' }}
                  onClick={() => { setActiveSymbol(toast.symbol); dismissToast(toast.id) }}
                >
                  <button className="toast-close" onClick={(e) => dismissToast(toast.id, e)}>✕</button>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 16 }}>{isTypeA ? '🚦' : '🟡'}</span>
                    <span style={{ fontWeight: 700, fontSize: 14, color: '#fff' }}>{toast.title}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: 12, color: '#9ca3af', lineHeight: 1.4, paddingRight: 16 }}>{toast.message}</p>
                  <span style={{ fontSize: 10, color: '#a78bfa', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                    Click para cambiar ➜
                  </span>
                </div>
              )
            })}
          </div>
        )}

      </div>

      {/* CSS animations */}
      <style>{`
        @keyframes pulse-walk {
          from { opacity: 1; transform: scale(1); }
          to   { opacity: 0.7; transform: scale(0.96); }
        }
      `}</style>
    </div>
  )
}

// ─── Helpers locales ──────────────────────────────────────────────────────────

function ConfluenceItem({ label, checked }: { label: string; checked: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 14px', borderRadius: 8,
      background: checked ? 'rgba(16,185,129,0.04)' : 'rgba(255,255,255,0.01)',
      border: `1px solid ${checked ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.04)'}`,
      fontSize: 12, transition: 'all 0.2s'
    }}>
      <div style={{
        width: 16, height: 16, borderRadius: '50%',
        background: checked ? '#10b981' : '#374151',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 10, color: '#fff', flexShrink: 0
      }}>
        {checked ? '✓' : '✗'}
      </div>
      <span style={{ color: checked ? '#fff' : '#9ca3af', fontWeight: checked ? 600 : 400 }}>{label}</span>
    </div>
  )
}
