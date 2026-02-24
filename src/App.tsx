import './App.css'

import { useMarketData } from './hooks/useMarketData'
import { useHistoricalData } from './hooks/useHistoricalData'
import { useBacktest } from './hooks/useBacktest'

import { Semaforo } from './components/Semaforo'
import { BacktestMetrics } from './components/BacktestMetrics'
import { ElasticityCard } from './components/ElasticityCard'

import { compareSignalWithHistory } from './backtest/compareSignal'
import { fuseMarketState } from './logic/fuseMarketState'

function App() {
  // 🟢 1. Mercado en tiempo real (motor principal)
  const market = useMarketData()

  // 📜 2. Histórico SIMPLE (solo velas, sin lógica)
  const historical = useHistoricalData()

  // 🧪 3. Backtest (usa SOLO histórico)
  const backtest = useBacktest(historical)

  if (!market) {
    return <div>Cargando mercado...</div>
  }

  // 🧠 4. Comparación señal actual vs histórico
  const comparison =
    backtest
      ? compareSignalWithHistory(
          {
            state: market.finalState,
            elasticity: market.m5.elasticity,
          },
          backtest
        )
      : null

  // 🧠 5. Fusión final (tiempo real + histórico)
  const fusedState = fuseMarketState(
    market.finalState,
    comparison
  )

  return (
    <div style={{ padding: 24, maxWidth: 720, margin: '0 auto' }}>
      <h2>EUR/USD — Elasticity System</h2>

      {/* ============================= */}
      {/* 🔵 SECCIÓN 1 — TIEMPO REAL   */}
      {/* ============================= */}
      <div
        style={{
          marginTop: 24,
          padding: 16,
          border: '1px solid #2a2a2a',
          borderRadius: 8,
        }}
      >
        <h3>🟢 Tiempo real (motor)</h3>
        <p style={{ opacity: 0.7, fontSize: 14 }}>
          Esta sección muestra el estado actual del mercado calculado en
          tiempo real. No usa histórico ni backtest.
        </p>

        <p>
          M5 Elasticidad: {market.m5.elasticity.toFixed(2)} |{' '}
          {market.m5.state}
        </p>

        <p>
          M15 Elasticidad: {market.m15.elasticity.toFixed(2)} |{' '}
          {market.m15.state}
        </p>

        <Semaforo state={market.finalState} label="Actual" />
      </div>

      {/* ============================= */}
      {/* 📊 SECCIÓN 2 — ELASTICIDAD   */}
      {/* ============================= */}
      <div
        style={{
          marginTop: 32,
          padding: 16,
          border: '1px solid #2a2a2a',
          borderRadius: 8,
        }}
      >
        <h3>📊 Elasticidad (detalle visual)</h3>
        <p style={{ opacity: 0.7, fontSize: 14 }}>
          Muestra cuánto se ha estirado el precio respecto a su promedio
          (EMA100) en cada temporalidad. Responde al "¿por qué?" del semáforo.
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
      <div
        style={{
          marginTop: 32,
          padding: 16,
          border: '1px solid #2a2a2a',
          borderRadius: 8,
        }}
      >
        <h3>🧪 Backtesting (histórico)</h3>
        <p style={{ opacity: 0.7, fontSize: 14 }}>
          Resultados estadísticos obtenidos al analizar velas pasadas.
          No influyen directamente en la señal actual.
        </p>

        {backtest && <BacktestMetrics data={backtest} />}
      </div>

      {/* ============================= */}
      {/* 🟣 SECCIÓN 4 — COMPARACIÓN   */}
      {/* ============================= */}
      <div
        style={{
          marginTop: 32,
          padding: 16,
          border: '1px solid #2a2a2a',
          borderRadius: 8,
        }}
      >
        <h3>📊 Comparación señal actual vs histórico</h3>
        <p style={{ opacity: 0.7, fontSize: 14 }}>
          Aquí se compara la señal actual con situaciones similares del
          pasado para medir probabilidad y contexto.
        </p>

        {comparison ? (
          <>
            <p>Señales similares: {comparison.similarSignals}</p>
            <p>Win rate: {comparison.winRate.toFixed(2)}%</p>
            <p>
              Promedio barras a revertir:{' '}
              {comparison.avgBarsToRevert.toFixed(2)}
            </p>
          </>
        ) : (
          <p style={{ opacity: 0.6 }}>
            Aún no hay datos suficientes para comparar.
          </p>
        )}
      </div>

      {/* ============================= */}
      {/* 🔴 SECCIÓN 5 — SEÑAL FUSIONADA */}
      {/* ============================= */}
      <div
        style={{
          marginTop: 32,
          padding: 16,
          border: '2px solid #444',
          borderRadius: 8,
          background: 'rgba(255,255,255,0.02)',
        }}
      >
        <h3>🚦 Señal confirmada</h3>
        <p style={{ opacity: 0.7, fontSize: 14 }}>
          Resultado final que combina la señal en tiempo real con el
          contexto histórico.
        </p>

        <Semaforo state={fusedState} label="Confirmado" />
      </div>
    </div>
  )
}

export default App