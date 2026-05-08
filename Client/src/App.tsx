import { useEffect, useRef } from 'react'
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

function App() {
  // 🟢 1. Mercado en tiempo real — via backend WebSocket local
  const { data: market, status: wsStatus } = useMarketData()

  // 📜 2. Historial real — 500 velas M5 via REST (1 llamada al día)
  const historical = useHistoricalData()

  // 🧪 3. Backtest real — devuelve BacktestResult | null directamente
  const backtest = useBacktest(historical)

  // 📡 Refs para Notificación de Telegram
  const previousStateRef = useRef<string | null>(null)
  const lastAlertTimeRef = useRef(0)

  // 📡 Efecto de Telegram (siempre a nivel superior)
  useEffect(() => {
    if (!market) return
    const comp = backtest
      ? compareSignalWithHistory({ state: market.m5.state, elasticity: market.m5.elasticity }, backtest)
      : null
    const fusedStateRaw = fuseMarketState(market.finalState, comp)

    const isNewGreen = previousStateRef.current !== 'GREEN' && fusedStateRaw.state === 'GREEN'
    const now = Date.now()
    const canAlert = now - lastAlertTimeRef.current > 300000

    if (isNewGreen && canAlert) {
      lastAlertTimeRef.current = now
      fetch(`${API_URL}/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `🟢 ALERTA: Señal Confirmada\n\n${fusedStateRaw.explanation}\n\nM5: ${market.m5.elasticity.toFixed(2)} | M15: ${market.m15.elasticity.toFixed(2)}`
        })
      }).catch(err => console.error('[Telegram] Error llamando al webhook:', err))
    }

    previousStateRef.current = fusedStateRaw.state
  }, [market, backtest])

  // ── Pantalla de carga / conexión ──────────────────────────────────────────
 // ── Pantalla de carga / conexión ──────────────────────────────────────────
  if (!market) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', flexDirection: 'column', gap: 12,
        color: '#555', fontFamily: 'monospace', textAlign: 'center' // ← Corregido aquí
      }}>
        <div style={{
          width: 10, height: 10, borderRadius: '50%',
          background: wsStatus === 'connected' ? '#3b82f6' : (wsStatus === 'connecting' ? '#eab308' : '#dc2626'),
          boxShadow: wsStatus === 'connected' ? '0 0 10px #3b82f6' : (wsStatus === 'connecting' ? '0 0 10px #eab308' : '0 0 10px #dc2626'),
        }}/>
        <p style={{ margin: 0, fontSize: 13 }}>
          {wsStatus === 'connecting' && 'Conectando con el backend...'}
          {wsStatus === 'disconnected' && 'Backend desconectado — verifica que corre en puerto 8080'}
          {wsStatus === 'connected' && 'Conectado ✓ Esperando suficientes velas históricas para calcular EMA100...'}
        </p>
        <p style={{ margin: 0, fontSize: 11, color: '#333' }}>
          {WS_URL}
        </p>
      </div>
    )
  }

  // 🧠 4. Comparación señal actual vs histórico real
  // FIX Bug#1: usar m5.state (no finalState) — backtest.events son M5 individual
  const comparison =
    backtest
      ? compareSignalWithHistory(
          { state: market.m5.state, elasticity: market.m5.elasticity },
          backtest
        )
      : null

  // DEBUG — borrar cuando semáforo confirmado verde
  if (comparison) {
    console.log(
      '[DEBUG]',
      '\n  M5  → state:', market.m5.state,  '| elasticity:', market.m5.elasticity.toFixed(4),  '| percentile:', market.m5.percentile,
      '\n  M15 → state:', market.m15.state, '| elasticity:', market.m15.elasticity.toFixed(4), '| percentile:', market.m15.percentile,
      '\n  finalState (M5 AND M15):', market.finalState,
      '\n  fuseMarketState receives current =', market.finalState, '← ESTE es el que necesita ser GREEN',
      '\n  comparison → similarSignals:', comparison.similarSignals, '| winRate:', comparison.winRate.toFixed(1) + '%',
    )
  }

  // 🧠 5. Fusión final → { state, explanation }
  const fused = fuseMarketState(market.finalState, comparison)

  return (
    <div style={{ padding: 24, maxWidth: 720, margin: '0 auto' }}>
      <h2>EUR/USD — Elasticity System</h2>

      {/* Badge de conexión con el backend */}
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '4px 10px', borderRadius: 12, marginBottom: 8,
        background: 'rgba(22,163,74,0.1)', border: '1px solid #16a34a33',
      }}>
        <div style={{
          width: 6, height: 6, borderRadius: '50%',
          background: '#16a34a', boxShadow: '0 0 6px #16a34a',
        }}/>
        <span style={{ fontSize: 11, color: '#16a34a', fontFamily: 'monospace' }}>
          Backend conectado · {WS_URL}
        </span>
      </div>

      {/* ============================= */}
      {/* 🔵 SECCIÓN 1 — TIEMPO REAL   */}
      {/* ============================= */}
      <div style={{
        marginTop: 16, padding: 16,
        border: '1px solid #2a2a2a', borderRadius: 8,
      }}>
        <h3>🟢 Tiempo real (motor)</h3>
        <p style={{ opacity: 0.7, fontSize: 14 }}>
          Precio tick a tick via WebSocket. EMA y ATR calculados
          sobre velas cerradas reales construidas en el backend.
        </p>
        <p>M5 Elasticidad: {market.m5.elasticity.toFixed(2)} | {market.m5.state}</p>
        <p>M15 Elasticidad: {market.m15.elasticity.toFixed(2)} | {market.m15.state}</p>
        <Semaforo state={market.finalState} label="Actual" />
      </div>

      {/* ============================= */}
      {/* 📊 SECCIÓN 2 — ELASTICIDAD   */}
      {/* ============================= */}
      <div style={{
        marginTop: 32, padding: 16,
        border: '1px solid #2a2a2a', borderRadius: 8,
      }}>
        <h3>📊 Elasticidad (detalle visual)</h3>
        <p style={{ opacity: 0.7, fontSize: 14 }}>
          Muestra cuánto se ha estirado el precio respecto a su promedio
          (EMA100). Responde al "¿por qué?" del semáforo.
        </p>
        <ElasticityCard
          m5={market.m5}
          m15={market.m15}
          fusedState={market.finalState}
        />
      </div>

      {/* ============================= */}
      {/* 🟠 SECCIÓN 3 — BACKTEST      */}
      {/* ============================= */}
      <div style={{
        marginTop: 32, padding: 16,
        border: '1px solid #2a2a2a', borderRadius: 8,
      }}>
        <h3>🧪 Backtesting (histórico)</h3>
        <p style={{ opacity: 0.7, fontSize: 14 }}>
          Resultados estadísticos sobre las últimas 500 velas M5.
          Los umbrales se calibran automáticamente con estos datos.
        </p>
        {backtest
          ? <BacktestMetrics data={backtest} />
          : <p style={{ opacity: 0.5, fontSize: 13 }}>
              Cargando velas históricas...
            </p>
        }
      </div>

      {/* ============================= */}
      {/* 🟣 SECCIÓN 4 — COMPARACIÓN   */}
      {/* ============================= */}
      <div style={{
        marginTop: 32, padding: 16,
        border: '1px solid #2a2a2a', borderRadius: 8,
      }}>
        <h3>📊 Comparación señal actual vs histórico</h3>
        <p style={{ opacity: 0.7, fontSize: 14 }}>
          Busca situaciones históricas con mismo estado y
          elasticidad similar (±0.1) para estimar probabilidad contextual.
        </p>
        {comparison ? (
          <>
            <p>Señales similares: {comparison.similarSignals}</p>
            <p>Win rate: {comparison.winRate.toFixed(2)}%</p>
            <p>Promedio barras a revertir: {comparison.avgBarsToRevert.toFixed(2)}</p>
          </>
        ) : (
          <p style={{ opacity: 0.6 }}>Cargando contexto histórico...</p>
        )}
      </div>

      {/* ============================= */}
      {/* 🔴 SECCIÓN 5 — SEÑAL FINAL   */}
      {/* ============================= */}
      <div style={{
        marginTop: 32, padding: 16,
        border: '2px solid #444', borderRadius: 8,
        background: 'rgba(255,255,255,0.02)',
      }}>
        <h3>🚦 Señal confirmada</h3>
        <p style={{ opacity: 0.7, fontSize: 14 }}>
          Resultado final que combina la señal en tiempo real
          con el contexto histórico real.
        </p>
        <p style={{
          fontSize: 13, color: '#666',
          background: '#111', border: '1px solid #222',
          borderRadius: 6, padding: '10px 14px',
          margin: '0 0 8px', lineHeight: 1.6,
        }}>
          {fused.explanation}
        </p>
        <Semaforo state={fused.state} label="Confirmado" />
      </div>

      {/* ============================= */}
      {/* 🛠️ SECCIÓN 6 — OBSERVABILITY   */}
      {/* ============================= */}
      <SystemObservability />

      <button 
        onClick={() => {
          fetch(`${API_URL}/notify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: "hola probando bot 7777" })
          }).catch(console.error)
        }}
      >
        Probar Bot Telegram
      </button>
    </div>
  )
}

export default App