import { useEffect, useRef, useState } from 'react'
import './App.css'
import { WS_URL } from '@/config/env'

import { useMarketData } from './hooks/useMarketData'
import { useAlerts } from './hooks/useAlerts'
import { useExecution } from './hooks/useExecution'

import { ElasticityCard } from './components/ElasticityCard'
import { ApiKeysStatus } from './components/ApiKeysStatus'
import { CascadePanel } from './components/CascadePanel'
import { AlertsTable } from './components/AlertsTable'
import { ExecutionPanel } from './components/ExecutionPanel'
import { ModeToggle } from './components/ModeToggle'

interface Toast {
  id: string
  symbol: string
  type: 'v3'
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

  const { data: market, status: wsStatus, keysStatus, exhaustAlert } = useMarketData()
  const { alerts, summary, error: alertsError } = useAlerts()
  const execution = useExecution()
  const lockedSymbols = new Set(execution.positions.map((p) => p.symbol))

  const activeKey = market && market[activeSymbol] ? activeSymbol : (market ? Object.keys(market)[0] : 'EUR/USD')
  const currentMarket = market ? market[activeKey] : null

  const lastSignalSeen = useRef<{ [symbol: string]: number | null }>({})

  useEffect(() => {
    if (!market) return

    const push = (toast: Omit<Toast, 'id'>) => {
      const id = `${toast.symbol}-${toast.type}-${Date.now()}`
      setToasts(prev => [...prev, { ...toast, id }])
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 10000)
    }

    Object.keys(market).forEach((sym) => {
      const item = market[sym]
      if (!item) return
      const last = item.cascade?.lastSignalAt ?? null
      const seen = lastSignalSeen.current[sym]
      const c = item.cascade?.contract
      if (seen !== undefined && last !== null && last !== seen && c) {
        push({
          symbol: sym,
          type: 'v3',
          title: `🌊 v3 · Cascada en ${sym}`,
          message: `${c.direction === 'SELL' ? 'Venta' : 'Compra'} · stop ${c.stopPips.toFixed(1)} pips · objetivo ${c.targetPips.toFixed(1)} pips`,
        })
      }
      lastSignalSeen.current[sym] = last
    })
  }, [market])

  const dismissToast = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const connectionBadge = (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 8,
      padding: '6px 12px', borderRadius: 8,
      background: wsStatus === 'connected' ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)',
      border: wsStatus === 'connected' ? '1px solid rgba(16,185,129,0.15)' : '1px solid rgba(239,68,68,0.15)',
    }}>
      <div style={{
        width: 8, height: 8, borderRadius: '50%',
        background: wsStatus === 'connected' ? '#10b981' : (wsStatus === 'connecting' ? '#eab308' : '#ef4444'),
        boxShadow: wsStatus === 'connected' ? '0 0 10px #10b981' : '0 0 10px #ef4444',
      }} />
      <span style={{ fontSize: 12, color: wsStatus === 'connected' ? '#10b981' : '#ef4444', fontFamily: 'monospace', fontWeight: 600 }}>
        {wsStatus === 'connected' ? 'BACKEND CONECTADO' : wsStatus === 'connecting' ? 'CONECTANDO' : 'DESCONECTADO'} · {WS_URL}
      </span>
    </div>
  )

  if (!market || !currentMarket) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '80vh', flexDirection: 'column', gap: 16,
        color: '#555', fontFamily: 'monospace', textAlign: 'center',
        padding: 24, boxSizing: 'border-box'
      }}>
        {exhaustAlert && (
          <div style={{
            maxWidth: 500,
            borderRadius: 12,
            border: '1px solid rgba(239,68,68,0.4)',
            background: 'linear-gradient(135deg, rgba(239,68,68,0.15) 0%, rgba(185,28,28,0.1) 100%)',
            padding: '16px 20px',
            textAlign: 'left'
          }}>
            <h4 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#ef4444', textTransform: 'uppercase' }}>
              ⚠️ Llaves de Twelve Data agotadas
            </h4>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#fca5a5', lineHeight: 1.4 }}>
              {exhaustAlert}
            </p>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
          {connectionBadge}
          <ModeToggle execution={execution} />
        </div>
        <p style={{ margin: 0, fontSize: 13, color: '#f3f4f6' }}>
          {wsStatus === 'connecting' && 'Conectando con el backend...'}
          {wsStatus === 'disconnected' && `Backend desconectado — verifica que esté corriendo en ${WS_URL}`}
          {wsStatus === 'connected' && 'Conectado ✓ Esperando el primer snapshot (fuera del horario de mercado no llega ninguno)...'}
        </p>
        <div style={{ width: '100%', maxWidth: 1100, textAlign: 'left' }}>
          <ApiKeysStatus keysStatus={keysStatus} />
          <ExecutionPanel execution={execution} />
          <AlertsTable alerts={alerts} summary={summary} error={alertsError} />
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '24px 0', margin: '0 auto' }}>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 className="title-gradient" style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: '-1px' }}>
            Señales de reversión a la EMA 100
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#9ca3af' }}>
            Una sola alerta: v3 · Cascada, con stop, objetivo y salida a los 175 min
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          {connectionBadge}
          <ModeToggle execution={execution} />
        </div>
      </div>

      {exhaustAlert && (
        <div style={{
          marginBottom: 24,
          borderRadius: 12,
          border: '1px solid rgba(239,68,68,0.4)',
          background: 'linear-gradient(135deg, rgba(239,68,68,0.15) 0%, rgba(185,28,28,0.1) 100%)',
          padding: '16px 20px',
          textAlign: 'left',
        }}>
          <h4 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#ef4444', textTransform: 'uppercase' }}>
            ⚠️ Llaves de Twelve Data agotadas
          </h4>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#fca5a5', lineHeight: 1.4, fontFamily: 'monospace' }}>
            {exhaustAlert}
          </p>
        </div>
      )}

      <ApiKeysStatus keysStatus={keysStatus} />

      <div style={{ marginBottom: 32 }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(260px, 100%), 1fr))',
          gap: 16
        }}>
          {Object.keys(market).map((sym) => {
            const item = market[sym]
            const isActive = sym === activeKey
            const cas = item.cascade
            const locked = lockedSymbols.has(sym)
            return (
              <div
                key={sym}
                onClick={() => setActiveSymbol(sym)}
                style={{
                  cursor: 'pointer',
                  background: isActive ? 'rgba(255, 255, 255, 0.04)' : 'rgba(255, 255, 255, 0.01)',
                  border: locked ? '1px solid rgba(251, 191, 36, 0.5)' : isActive ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid rgba(255, 255, 255, 0.05)',
                  boxShadow: isActive ? '0 8px 24px rgba(59, 130, 246, 0.12)' : 'none',
                  borderRadius: 14,
                  padding: '20px 24px',
                  transition: 'all 0.2s ease',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ fontWeight: 700, fontSize: 18, color: '#f3f4f6' }}>{locked ? '🔒 ' : ''}{sym}</span>
                  <span style={{
                    fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 6, fontFamily: 'monospace',
                    backgroundColor: item.fusedState === 'GREEN' ? 'rgba(16, 185, 129, 0.12)' : (item.fusedState === 'YELLOW' ? 'rgba(245, 158, 11, 0.12)' : 'rgba(239, 68, 68, 0.12)'),
                    color: item.fusedState === 'GREEN' ? '#34d399' : (item.fusedState === 'YELLOW' ? '#fbbf24' : '#f87171'),
                  }}>
                    {item.fusedState}
                  </span>
                </div>

                <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'monospace', color: '#fff', marginBottom: 12 }}>
                  {item.m5.price.toFixed(sym.includes('JPY') ? 3 : 5)}
                </div>

                {locked && (
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#fbbf24', marginBottom: 12 }}>
                    🔒 Operación abierta · alertas en pausa
                  </div>
                )}

                <div style={{ display: 'flex', gap: 16, alignItems: 'center', fontSize: 11, color: '#9ca3af', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>M5</span>
                    <LED state={item.m5.state} size={7} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>M15</span>
                    <LED state={item.m15.state} size={7} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>FUSED</span>
                    <LED state={item.fusedState} size={7} />
                  </div>
                </div>

                <div style={{ marginTop: 10, fontSize: 11, color: cas?.armed ? '#34d399' : '#9ca3af', fontFamily: 'monospace', lineHeight: 1.6 }}>
                  {!cas || !cas.ready
                    ? 'v3: calentando'
                    : cas.contract
                      ? `v3: contrato ${cas.contract.direction} en curso`
                      : `v3: ${cas.armed ? 'ARMADA' : 'en espera'} · estirón ${(cas.stretchAtr5 ?? 0).toFixed(1)}/${cas.stretchNeeded} ATR5 · ${cas.direction ?? ''}`}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 24 }}>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, paddingLeft: 4 }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: '#fff' }}>
            {activeKey}
          </h2>
          <span style={{ color: '#6b7280', fontSize: 14 }}>
            detalle del par seleccionado
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))', gap: 24 }}>

          <CascadePanel symbol={activeKey} cascade={currentMarket.cascade} />

          <div className="glass-panel" style={{ margin: 0, padding: 0, border: 'none', background: 'transparent' }}>
            <ElasticityCard
              symbol={activeKey}
              m5={currentMarket.m5}
              m15={currentMarket.m15}
              fusedState={currentMarket.finalState}
            />
          </div>

        </div>

        <ExecutionPanel execution={execution} />
        <AlertsTable alerts={alerts} summary={summary} error={alertsError} />
      </div>

      {toasts.length > 0 && (
        <div className="toast-container">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className="toast-card"
              style={{ borderLeft: '4px solid #3b82f6' }}
              onClick={() => {
                setActiveSymbol(toast.symbol)
                dismissToast(toast.id)
              }}
            >
              <button className="toast-close" onClick={(e) => dismissToast(toast.id, e)}>
                ✕
              </button>
              <span style={{ fontWeight: 700, fontSize: 14, color: '#fff' }}>{toast.title}</span>
              <p style={{ margin: 0, fontSize: 12, color: '#9ca3af', lineHeight: 1.4, paddingRight: 16 }}>
                {toast.message}
              </p>
            </div>
          ))}
        </div>
      )}

    </div>
  )
}

export default App
