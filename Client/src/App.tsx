import { useEffect, useRef, useState } from 'react'
import './App.css'
import { WS_URL, API_URL } from '@/config/env'

import { useMarketData } from './hooks/useMarketData'
import { useHistoricalData } from './hooks/useHistoricalData'
import { useBacktest } from './hooks/useBacktest'

import { Semaforo } from './components/Semaforo'
import { BacktestMetrics } from './components/BacktestMetrics'
import { ElasticityCard } from './components/ElasticityCard'
import { SystemObservability } from './components/SystemObservability'

import { compareSignalWithHistory } from './backtest/compareSignal'
import { fuseMarketState } from './logic/fuseMarketState'

interface Toast {
  id: string
  symbol: string
  type: 'A' | 'B'
  title: string
  message: string
}

const LED = ({ state, size = 8 }: { state: 'GREEN' | 'YELLOW' | 'RED'; size?: number }) => {
  const colors = {
    GREEN: { bg: '#10b981', shadow: '0 0 10px #10b981, 0 0 3px #10b981' },
    YELLOW: { bg: '#f59e0b', shadow: '0 0 10px #f59e0b, 0 0 3px #f59e0b' },
    RED: { bg: '#ef4444', shadow: '0 0 4px rgba(239, 68, 68, 0.4)' }
  };
  const current = colors[state] || colors.RED;
  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: '50%',
      backgroundColor: current.bg,
      boxShadow: current.shadow,
      transition: 'all 0.3s ease'
    }} />
  );
};

function App() {
  const [activeSymbol, setActiveSymbol] = useState('EUR/USD')
  const [toasts, setToasts] = useState<Toast[]>([])

  // 🟢 1. Mercado en tiempo real — via backend WebSocket local (Multi-símbolo)
  const { data: market, status: wsStatus } = useMarketData()

  // Símbolo activo resuelto (con fallback si el activo no se ha recibido o es vacío)
  const activeKey = market && market[activeSymbol] ? activeSymbol : (market ? Object.keys(market)[0] : 'EUR/USD')
  const currentMarket = market ? market[activeKey] : null

  // 📜 2. Historial real del par activo — 500 velas M5 via REST
  const historical = useHistoricalData(activeKey)

  // 🧪 3. Backtest real sobre el par activo — devuelve BacktestResult | null directamente
  const backtest = useBacktest(historical)

  // 📡 Refs para Notificación de Telegram — Frontend (espejo del backend, aislado por símbolo)
  const prevFusedStateRefs = useRef<{ [symbol: string]: string | null }>({})   // para Tipo A
  const prevFinalStateRefs = useRef<{ [symbol: string]: string | null }>({})   // para Tipo B
  const lastAlertTimeARefs = useRef<{ [symbol: string]: number }>({})         // cooldown Tipo A
  const lastAlertTimeBRefs = useRef<{ [symbol: string]: number }>({})         // cooldown Tipo B

  // Estado previo para Toasts (notificaciones en pantalla)
  const lastStateChecked = useRef<{ [symbol: string]: { final: string; fused: string } }>({})

  // 📡 Efecto de Telegram — lógica idéntica a checkAndSendTelegramAlert() del backend
  useEffect(() => {
    if (!currentMarket) return

    const symbol = currentMarket.symbol
    const comp = backtest
      ? compareSignalWithHistory({ state: currentMarket.m5.state, elasticity: currentMarket.m5.elasticity }, backtest)
      : null
    const fusedStateRaw = fuseMarketState(currentMarket.finalState, comp)
    const now = Date.now()

    const prevFused = prevFusedStateRefs.current[symbol] || null
    const prevFinal = prevFinalStateRefs.current[symbol] || null
    const lastAlertA = lastAlertTimeARefs.current[symbol] || 0
    const lastAlertB = lastAlertTimeBRefs.current[symbol] || 0

    // ─── Tipo A: Señal Confirmada (fused === GREEN) ───────────────────────────
    const isNewFusedGreen = prevFused !== 'GREEN' && fusedStateRaw.state === 'GREEN'
    const canAlertA = now - lastAlertA > 300000 // 5 min

    if (isNewFusedGreen && canAlertA) {
      lastAlertTimeARefs.current[symbol] = now
      fetch(`${API_URL}/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message:
            `[📱 FRONTEND - ${symbol} - Calculado en Cliente] 🟢 ALERTA CONFIRMADA (Tipo A - Alta Probabilidad)` +
            `\n\n${fusedStateRaw.explanation}` +
            `\n\nM5: ${currentMarket.m5.elasticity.toFixed(2)} | M15: ${currentMarket.m15.elasticity.toFixed(2)}`
        })
      }).catch(err => console.error(`[Telegram-Frontend] Error Tipo A para ${symbol}:`, err))
    }

    // ─── Tipo B: Señal Tiempo Real sin confirmación histórica ─────────────────
    const isNewFinalGreen = prevFinal !== 'GREEN' && currentMarket.finalState === 'GREEN'
    const canAlertB = now - lastAlertB > 300000 // 5 min

    if (isNewFinalGreen && fusedStateRaw.state !== 'GREEN' && canAlertB) {
      lastAlertTimeBRefs.current[symbol] = now
      fetch(`${API_URL}/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message:
            `[📱 FRONTEND - ${symbol} - Calculado en Cliente] 🟡 ALERTA TIEMPO REAL (Tipo B - Moderada Probabilidad)` +
            `\n\nEl precio se encuentra sobre-estirado en el corto plazo (finalState: GREEN), pero no superó el porcentaje mínimo del backtest histórico.` +
            `\n\nM5: ${currentMarket.m5.elasticity.toFixed(2)} | M15: ${currentMarket.m15.elasticity.toFixed(2)}`
        })
      }).catch(err => console.error(`[Telegram-Frontend] Error Tipo B para ${symbol}:`, err))
    }

    prevFusedStateRefs.current[symbol] = fusedStateRaw.state
    prevFinalStateRefs.current[symbol] = currentMarket.finalState
  }, [currentMarket, backtest])

  // 🔔 Efecto de Global Toasts — notificaciones flotantes elegantes para pares inactivos en pantalla
  useEffect(() => {
    if (!market) return

    Object.keys(market).forEach((sym) => {
      const item = market[sym]
      if (!item) return

      const prev = lastStateChecked.current[sym] || { final: 'RED', fused: 'RED' }
      
      // Solo disparar Toast si NO es el símbolo activo actualmente en pantalla
      if (sym !== activeKey) {
        // Alerta Tipo A (fusedState GREEN)
        if (prev.fused !== 'GREEN' && item.fusedState === 'GREEN') {
          const id = sym + '-fused-' + Date.now()
          setToasts(prevToasts => [
            ...prevToasts,
            {
              id,
              symbol: sym,
              type: 'A',
              title: `🔥 Oportunidad Tipo A en ${sym}`,
              message: `¡Señal Confirmada de Alta Probabilidad! M5: ${item.m5.elasticity.toFixed(2)} | M15: ${item.m15.elasticity.toFixed(2)}`
            }
          ])
          // Auto remove después de 8s
          setTimeout(() => {
            setToasts(prevToasts => prevToasts.filter(t => t.id !== id))
          }, 8000)
        }
        // Alerta Tipo B (finalState GREEN y fusedState !== GREEN)
        else if (prev.final !== 'GREEN' && item.finalState === 'GREEN' && item.fusedState !== 'GREEN') {
          const id = sym + '-final-' + Date.now()
          setToasts(prevToasts => [
            ...prevToasts,
            {
              id,
              symbol: sym,
              type: 'B',
              title: `⚡ Movimiento en ${sym}`,
              message: `Semáforo Corto Plazo en Verde (Moderada Probabilidad).`
            }
          ])
          // Auto remove después de 8s
          setTimeout(() => {
            setToasts(prevToasts => prevToasts.filter(t => t.id !== id))
          }, 8000)
        }
      }

      // Guardar el último estado para la próxima comparación
      lastStateChecked.current[sym] = {
        final: item.finalState,
        fused: item.fusedState
      }
    })
  }, [market, activeKey])

  const dismissToast = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // ── Pantalla de carga / conexión ──────────────────────────────────────────
  if (!market || !currentMarket) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', flexDirection: 'column', gap: 12,
        color: '#555', fontFamily: 'monospace', textAlign: 'center'
      }}>
        <div style={{
          width: 10, height: 10, borderRadius: '50%',
          background: wsStatus === 'connected' ? '#10b981' : (wsStatus === 'connecting' ? '#eab308' : '#dc2626'),
          boxShadow: wsStatus === 'connected' ? '0 0 10px #10b981' : (wsStatus === 'connecting' ? '0 0 10px #eab308' : '0 0 10px #dc2626'),
        }}/>
        <p style={{ margin: 0, fontSize: 13, color: '#f3f4f6' }}>
          {wsStatus === 'connecting' && 'Conectando con el backend multi-símbolo...'}
          {wsStatus === 'disconnected' && 'Backend desconectado — verifica que corre en puerto 8082'}
          {wsStatus === 'connected' && 'Conectado ✓ Esperando snapshots iniciales del servidor...'}
        </p>
        <p style={{ margin: 0, fontSize: 11, color: '#4b5563' }}>
          {WS_URL}
        </p>
      </div>
    )
  }

  // 🧠 4. Comparación de señal del par activo actual vs su histórico
  const comparison =
    backtest
      ? compareSignalWithHistory(
          { state: currentMarket.m5.state, elasticity: currentMarket.m5.elasticity },
          backtest
        )
      : null

  // 🧠 5. Fusión final para visualización detallada
  const fused = fuseMarketState(currentMarket.finalState, comparison)

  return (
    <div style={{ padding: '24px 0', maxWidth: 1200, margin: '0 auto' }}>
      
      {/* HEADER PRINCIPAL */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 className="title-gradient" style={{ margin: 0, fontSize: 32, fontWeight: 800, letterSpacing: '-1px' }}>
            ELASTICITY METERS
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: '#9ca3af', fontWeight: 400 }}>
            Control Tower · Multi-Symbol Forex Monitoring System
          </p>
        </div>

        {/* Badge de Conexión del Servidor */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '8px 16px', borderRadius: 20,
          background: wsStatus === 'connected' ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)',
          border: wsStatus === 'connected' ? '1px solid rgba(16,185,129,0.15)' : '1px solid rgba(239,68,68,0.15)',
          backdropFilter: 'blur(8px)',
          transition: 'all 0.3s ease'
        }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: wsStatus === 'connected' ? '#10b981' : '#ef4444',
            boxShadow: wsStatus === 'connected' ? '0 0 10px #10b981' : '0 0 10px #ef4444',
          }}/>
          <span style={{ fontSize: 12, color: wsStatus === 'connected' ? '#10b981' : '#ef4444', fontFamily: 'monospace', fontWeight: 600 }}>
            {wsStatus === 'connected' ? 'BACKEND CONNECTED' : 'DISCONNECTED'} · {WS_URL}
          </span>
        </div>
      </div>

      {/* ==================================================== */}
      {/* 🎛️ COCKPIT / TORRE DE CONTROL (GRID MULTISÍMBOLO)   */}
      {/* ==================================================== */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 14, textTransform: 'uppercase', letterSpacing: '2px', color: '#6b7280', margin: '0 0 16px 4px', fontWeight: 700 }}>
          ⚡ Live Cockpit (Click to Inspect)
        </h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 16
        }}>
          {Object.keys(market).map((sym) => {
            const item = market[sym]
            const isActive = sym === activeKey
            return (
              <div
                key={sym}
                onClick={() => setActiveSymbol(sym)}
                style={{
                  cursor: 'pointer',
                  background: isActive ? 'rgba(255, 255, 255, 0.04)' : 'rgba(255, 255, 255, 0.01)',
                  border: isActive ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid rgba(255, 255, 255, 0.05)',
                  boxShadow: isActive ? '0 8px 24px rgba(59, 130, 246, 0.12)' : 'none',
                  borderRadius: 14,
                  padding: '20px 24px',
                  transition: 'all 0.2s ease',
                  backdropFilter: 'blur(12px)',
                  position: 'relative'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ fontWeight: 700, fontSize: 18, color: '#f3f4f6', letterSpacing: '-0.3px' }}>
                    {sym}
                  </span>
                  <span style={{
                    fontSize: 10,
                    fontWeight: 800,
                    padding: '3px 8px',
                    borderRadius: 6,
                    backgroundColor: item.fusedState === 'GREEN' ? 'rgba(16, 185, 129, 0.12)' : (item.fusedState === 'YELLOW' ? 'rgba(245, 158, 11, 0.12)' : 'rgba(239, 68, 68, 0.12)'),
                    color: item.fusedState === 'GREEN' ? '#34d399' : (item.fusedState === 'YELLOW' ? '#fbbf24' : '#f87171'),
                    border: item.fusedState === 'GREEN' ? '1px solid rgba(16, 185, 129, 0.15)' : (item.fusedState === 'YELLOW' ? '1px solid rgba(245, 158, 11, 0.15)' : '1px solid rgba(239, 68, 68, 0.15)'),
                    fontFamily: 'monospace',
                    letterSpacing: '0.5px'
                  }}>
                    {item.fusedState}
                  </span>
                </div>
                
                <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'monospace', letterSpacing: '-0.5px', color: '#fff', marginBottom: 16 }}>
                  {item.m5.price.toFixed(5)}
                </div>

                <div style={{ display: 'flex', gap: 16, alignItems: 'center', fontSize: 11, color: '#9ca3af', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontWeight: 500 }}>M5</span>
                    <LED state={item.m5.state} size={7} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontWeight: 500 }}>M15</span>
                    <LED state={item.m15.state} size={7} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontWeight: 500 }}>FUSED</span>
                    <LED state={item.fusedState} size={7} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ==================================================== */}
      {/* 🔍 DETALLES DE INSPECCIÓN DEL SÍMBOLO ACTIVO        */}
      {/* ==================================================== */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 24 }}>
        
        {/* ENCABEZADO DE SECCIÓN DETALLES */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, paddingLeft: 4 }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: '-0.5px', color: '#fff' }}>
            Detail Inspector: {activeKey}
          </h2>
          <span style={{ color: '#6b7280', fontSize: 14 }}>
            showing in-depth metrics and statistical backtest
          </span>
        </div>

        {/* GRID DE PANELS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 }}>
          
          {/* SEMÁFORO DE TIEMPO REAL */}
          <div className="glass-panel" style={{ margin: 0 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 8px', color: '#fff' }}>
              🟢 Live Decision Engine
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: '#9ca3af', lineHeight: 1.4 }}>
              Real-time volatility and overstretch analysis from NestJS WebSocket ticks.
            </p>
            <div style={{ display: 'flex', gap: 12, marginBottom: 12, fontSize: 13 }}>
              <span>M5 Elasticity: <strong>{currentMarket.m5.elasticity.toFixed(2)}</strong> ({currentMarket.m5.state})</span>
              <span style={{ opacity: 0.3 }}>|</span>
              <span>M15 Elasticity: <strong>{currentMarket.m15.elasticity.toFixed(2)}</strong> ({currentMarket.m15.state})</span>
            </div>
            <Semaforo state={currentMarket.finalState} label="Current State" />
          </div>

          {/* TARJETA DE ELASTICIDAD */}
          <div className="glass-panel" style={{ margin: 0, padding: 0, border: 'none', background: 'transparent' }}>
            <ElasticityCard
              symbol={activeKey}
              m5={currentMarket.m5}
              m15={currentMarket.m15}
              fusedState={currentMarket.finalState}
            />
          </div>

        </div>

        {/* SECCIÓN DE ESTADÍSTICA E HISTORIAL */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 }}>
          
          {/* BACKTESTING HISTÓRICO */}
          <div className="glass-panel" style={{ margin: 0 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 8px', color: '#fff' }}>
              🧪 Historical Backtest (500 bars)
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: '#9ca3af', lineHeight: 1.4 }}>
              Performance stats calculated locally on client from M5 historical candles.
            </p>
            {backtest ? (
              <BacktestMetrics data={backtest} />
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120, color: '#6b7280', fontSize: 14, fontFamily: 'monospace' }}>
                Loading historical data...
              </div>
            )}
          </div>

          {/* CONTEXT COMPARISON */}
          <div className="glass-panel" style={{ margin: 0 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 8px', color: '#fff' }}>
              📊 Contextual Comparison
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: '#9ca3af', lineHeight: 1.4 }}>
              Comparing current elasticity (M5: {currentMarket.m5.elasticity.toFixed(2)}) with history.
            </p>
            {comparison ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, textAlign: 'center' }}>
                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px 8px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.03)' }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: '#fff', fontFamily: 'monospace' }}>{comparison.similarSignals}</div>
                    <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', marginTop: 4 }}>Similar Cases</div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px 8px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.03)' }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: '#10b981', fontFamily: 'monospace' }}>{comparison.winRate.toFixed(1)}%</div>
                    <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', marginTop: 4 }}>Win Rate</div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px 8px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.03)' }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: '#eab308', fontFamily: 'monospace' }}>{comparison.avgBarsToRevert.toFixed(1)}</div>
                    <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', marginTop: 4 }}>Avg Bars</div>
                  </div>
                </div>
                <div style={{ fontSize: 13, color: '#9ca3af', lineHeight: 1.5, background: 'rgba(255,255,255,0.01)', padding: 12, borderRadius: 8, border: '1px solid rgba(255,255,255,0.03)' }}>
                  🔍 Context reveals that out of {backtest?.totalSignals || 0} setups in history, {comparison.similarSignals} was found under same overstretch limits, with average recovery within {comparison.avgBarsToRevert.toFixed(1)} candles.
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120, color: '#6b7280', fontSize: 14, fontFamily: 'monospace' }}>
                Waiting for comparison context...
              </div>
            )}
          </div>

        </div>

        {/* FUSED STATE MAIN SIGNAL CARD */}
        <div style={{
          border: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'rgba(255, 255, 255, 0.01)',
          backdropFilter: 'blur(16px)',
          borderRadius: 16,
          padding: 24,
          boxShadow: '0 4px 30px rgba(0, 0, 0, 0.3)'
        }}>
          <h3 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 6px', color: '#fff' }}>
            🚥 Fused System Signal
          </h3>
          <p style={{ margin: '0 0 16px', fontSize: 13, color: '#9ca3af', lineHeight: 1.4 }}>
            Combines short-term price extreme signal with historical statistics.
          </p>
          <div style={{
            fontSize: 14, color: '#d1d5db',
            background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.03)',
            borderRadius: 8, padding: '16px 20px',
            margin: '0 0 16px', lineHeight: 1.6,
            fontFamily: 'monospace'
          }}>
            {fused.explanation}
          </div>
          <Semaforo state={fused.state} label="Final Confirmation Signal" />
        </div>

        {/* OBSERVABILITY SECTION */}
        <SystemObservability />

        {/* BOTTOM TELEGRAM BOT TRIGGER */}
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}>
          <button 
            style={{
              background: 'rgba(59, 130, 246, 0.1)',
              border: '1px solid rgba(59, 130, 246, 0.2)',
              color: '#60a5fa',
              fontWeight: 600,
              fontSize: 13,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 20px',
              borderRadius: 20,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onClick={() => {
              fetch(`${API_URL}/notify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: `[📱 FRONTEND] Test connection successful for ${activeKey}!` })
              }).catch(console.error)
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(59, 130, 246, 0.15)'
              e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.3)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)'
              e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.2)'
            }}
          >
            💬 Test Telegram Alerts
          </button>
        </div>

      </div>

      {/* ==================================================== */}
      {/* 🔔 FLOATING LIVE TOAST NOTIFICATIONS (GLOBAL TOASTS) */}
      {/* ==================================================== */}
      {toasts.length > 0 && (
        <div className="toast-container">
          {toasts.map((toast) => {
            const isTypeA = toast.type === 'A'
            return (
              <div 
                key={toast.id}
                className="toast-card"
                style={{
                  borderLeft: isTypeA ? '4px solid #10b981' : '4px solid #f59e0b'
                }}
                onClick={() => {
                  setActiveSymbol(toast.symbol)
                  dismissToast(toast.id)
                }}
              >
                <button 
                  className="toast-close"
                  onClick={(e) => dismissToast(toast.id, e)}
                >
                  ✕
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 16 }}>{isTypeA ? '🟢' : '🟡'}</span>
                  <span style={{ fontWeight: 700, fontSize: 14, color: '#fff' }}>
                    {toast.title}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: 12, color: '#9ca3af', lineHeight: 1.4, paddingRight: 16 }}>
                  {toast.message}
                </p>
                <span style={{ fontSize: 10, color: '#3b82f6', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                  Click to switch viewport ➜
                </span>
              </div>
            )
          })}
        </div>
      )}

    </div>
  )
}

export default App