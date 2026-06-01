/**
 * LaunchCockpit.tsx
 *
 * Cabina de Disparo por Agotamiento (Mean Reversion Launch Control).
 * Monitorea confluencias, calcula el Giro de Elasticidad en M5 y
 * provee un disparador visual de alta fidelidad para operar.
 */

import type { FinalMarketView } from '../../hooks/useMarketData'

type LaunchCockpitProps = {
  marketView: FinalMarketView | null
}

export function LaunchCockpit({ marketView }: LaunchCockpitProps) {
  const triggerState = marketView?.triggerState ?? 'reposo'
  const m5 = marketView?.m5
  const m15 = marketView?.m15
  const finalState = marketView?.finalState ?? 'RED'
  const fusedState = marketView?.fusedState ?? 'RED'
  const comparison = marketView?.fusedComparison
  const lastClosed = marketView?.lastClosedElasticityM5 ?? null
  const prevClosed = marketView?.prevClosedElasticityM5 ?? null

  // 1. Checklist Checks
  const checkAnomaly = finalState === 'GREEN' || finalState === 'YELLOW'
  const checkBacktest = fusedState === 'GREEN' || (comparison && comparison.winRate >= 65)
  const checkTrigger = triggerState === 'giro'

  // Decaimiento (Giro)
  const decaimiento = lastClosed !== null && prevClosed !== null ? prevClosed - lastClosed : 0
  const isGiro = triggerState === 'giro'
  const isEstirando = triggerState === 'estirando'

  // Dirección sugerida
  const direction = m5 && m5.price > m5.ema100 ? 'SELL' : 'BUY'

  return (
    <div style={{
      marginBottom: 24, padding: '20px', borderRadius: 16,
      background: 'rgba(13,13,20,0.4)', border: '1px solid rgba(255,255,255,0.05)',
      boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.02)',
      fontFamily: '"Inter", system-ui, sans-serif',
      backdropFilter: 'blur(10px)',
    }}>
      {/* Título de la Cabina */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <h3 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.7px', display: 'flex', alignItems: 'center', gap: 6 }}>
          🪃 Cabina de Disparo por Agotamiento
        </h3>
        <div style={{
          fontSize: 10, padding: '3px 8px', borderRadius: 6, fontWeight: 700,
          background: isGiro ? 'rgba(16,185,129,0.15)' : isEstirando ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.03)',
          color: isGiro ? '#10b981' : isEstirando ? '#f59e0b' : '#6b7280',
          border: isGiro ? '1px solid rgba(16,185,129,0.3)' : isEstirando ? '1px solid rgba(245,158,11,0.3)' : '1px solid rgba(255,255,255,0.05)',
          textTransform: 'uppercase'
        }}>
          Gatillo: {isGiro ? 'Confirmado' : isEstirando ? 'Estirándose' : 'En reposo'}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
        
        {/* COLUMNA 1: Checklist de Seguridad */}
        <div style={{
          padding: '16px', borderRadius: 12,
          background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)',
          display: 'flex', flexDirection: 'column', gap: 12
        }}>
          <h4 style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
            📋 Checklist de Confluencia
          </h4>
          
          <CheckItem 
            checked={checkAnomaly} 
            label="Anomalía de Mercado (M5+M15)" 
            desc={m5 && m15 ? `M5: ${m5.elasticity.toFixed(1)} (${m5.state}) | M15: ${m15.elasticity.toFixed(1)} (${m15.state})` : 'Esperando datos...'} 
          />
          <CheckItem 
            checked={checkBacktest} 
            label="Ventaja Histórica (Backtest)" 
            desc={comparison ? `Win Rate histórico: ${comparison.winRate.toFixed(0)}% (${comparison.similarSignals} casos)` : 'Esperando estadísticas...'} 
          />
          <CheckItem 
            checked={checkTrigger} 
            label="Giro de Elasticidad Confirmado" 
            desc={lastClosed !== null && prevClosed !== null 
              ? `Vela anterior: ${prevClosed.toFixed(2)} | Última vela: ${lastClosed.toFixed(2)} (${decaimiento >= 0 ? `Decae -${decaimiento.toFixed(2)}` : `Sube +${Math.abs(decaimiento).toFixed(2)}`})`
              : 'Esperando cierre de velas...'
            } 
            pulse={isEstirando}
          />
        </div>

        {/* COLUMNA 2: Visualizador de Tensión */}
        <div style={{
          padding: '16px', borderRadius: 12,
          background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)',
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 14
        }}>
          <div>
            <h4 style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
              🪃 Tensión del Elástico (M5)
            </h4>
            <div style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.4 }}>
              Mide la contracción del precio respecto a la EMA100 al cierre de las velas de 5 minutos.
            </div>
          </div>

          {/* Spring Gauge Visualizer */}
          <div style={{ margin: '8px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#9ca3af', fontFamily: 'monospace', marginBottom: 6 }}>
              <span>Prev: {prevClosed !== null ? prevClosed.toFixed(2) : '—'}</span>
              <span style={{ color: isGiro ? '#10b981' : isEstirando ? '#f59e0b' : '#6b7280', fontWeight: 'bold' }}>
                {isGiro ? `Giro 🪃 -${decaimiento.toFixed(2)}` : isEstirando ? 'Máxima Tensión ⏳' : 'Estable'}
              </span>
              <span>Última: {lastClosed !== null ? lastClosed.toFixed(2) : '—'}</span>
            </div>

            {/* spring line bar */}
            <div style={{
              height: 6, borderRadius: 3,
              background: 'rgba(255,255,255,0.05)',
              position: 'relative', overflow: 'hidden'
            }}>
              {/* spring indicator */}
              <div style={{
                height: '100%',
                borderRadius: 3,
                width: m5 ? `${Math.min(100, (m5.elasticity / 3.5) * 100)}%` : '0%',
                background: isGiro 
                  ? 'linear-gradient(90deg, #10b981, #34d399)' 
                  : isEstirando 
                    ? 'linear-gradient(90deg, #f59e0b, #ef4444)' 
                    : 'linear-gradient(90deg, #4b5563, #6b7280)',
                boxShadow: isGiro 
                  ? '0 0 10px rgba(16,185,129,0.5)' 
                  : isEstirando 
                    ? '0 0 10px rgba(245,158,11,0.5)' 
                    : 'none',
                transition: 'all 0.4s ease-out'
              }} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, fontSize: 11, fontFamily: 'monospace' }}>
            <div style={{ flex: 1 }}>
              <div style={{ color: '#6b7280', fontSize: 9 }}>REAL-TIME ELAS.</div>
              <div style={{ color: '#fff', fontWeight: 700 }}>{m5 ? m5.elasticity.toFixed(3) : '—'}</div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ color: '#6b7280', fontSize: 9 }}>EMA100 DIST.</div>
              <div style={{ color: '#fff', fontWeight: 700 }}>
                {m5 ? `${Math.abs(m5.price - m5.ema100).toFixed(5)}` : '—'}
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* BANNER DE ACCIÓN FINAL */}
      <div style={{
        marginTop: 20, padding: '14px 18px', borderRadius: 12,
        background: isGiro 
          ? 'radial-gradient(circle at 0% 50%, rgba(16,185,129,0.15) 0%, transparent 80%), rgba(16,185,129,0.04)' 
          : isEstirando 
            ? 'radial-gradient(circle at 0% 50%, rgba(245,158,11,0.15) 0%, transparent 80%), rgba(245,158,11,0.04)' 
            : 'rgba(255,255,255,0.02)',
        border: isGiro 
          ? '1px solid rgba(16,185,129,0.25)' 
          : isEstirando 
            ? '1px solid rgba(245,158,11,0.25)' 
            : '1px solid rgba(255,255,255,0.04)',
        boxShadow: isGiro ? '0 0 25px rgba(16,185,129,0.1)' : 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        transition: 'all 0.3s ease-out'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Status Light */}
          <div style={{
            width: 10, height: 10, borderRadius: '50%',
            background: isGiro ? '#10b981' : isEstirando ? '#f59e0b' : '#374151',
            boxShadow: isGiro 
              ? '0 0 10px #10b981, 0 0 20px #10b981' 
              : isEstirando 
                ? '0 0 10px #f59e0b, 0 0 20px #f59e0b' 
                : 'none',
            animation: isEstirando ? 'pulse 2s infinite ease-in-out' : 'none'
          }} />
          <div>
            <div style={{
              fontSize: 12, fontWeight: 800,
              color: isGiro ? '#10b981' : isEstirando ? '#f59e0b' : '#9ca3af',
              textTransform: 'uppercase', letterSpacing: '0.5px'
            }}>
              {isGiro ? `🚀 GATILLO DE AGOTAMIENTO CONFIRMADO: ENTRAR EN ${direction}` : isEstirando ? '🎯 ACECHO ACTIVO: ESPERANDO GIRO' : '⚪ CABINA EN ESPERA'}
            </div>
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
              {isGiro 
                ? `La resortera cedió -${decaimiento.toFixed(2)} unidades. Abre tu broker en temporalidad baja y ejecuta ${direction}.` 
                : isEstirando 
                  ? 'El elástico está bajo tensión extrema. Espera a que cierre la vela de 5 minutos para confirmar el giro.' 
                  : 'Sin condiciones favorables para operar en este momento.'}
            </div>
          </div>
        </div>

        {isGiro && (
          <div style={{
            fontSize: 11, fontWeight: 900, color: '#10b981', background: 'rgba(16,185,129,0.1)',
            padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(16,185,129,0.2)',
            fontFamily: 'monospace', textShadow: '0 0 5px rgba(16,185,129,0.3)'
          }}>
            {direction} @ M5
          </div>
        )}
      </div>

      {/* CSS anims injected via JS */}
      <style>{`
        @keyframes pulse {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.15); opacity: 0.6; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  )
}

// Helper CheckItem
function CheckItem({ checked, label, desc, pulse }: { checked: boolean; label: string; desc: string; pulse?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <div style={{
        marginTop: 2, display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 14, height: 14, borderRadius: 4,
        background: checked 
          ? 'rgba(16,185,129,0.15)' 
          : pulse 
            ? 'rgba(245,158,11,0.15)' 
            : 'rgba(255,255,255,0.03)',
        border: checked 
          ? '1px solid #10b981' 
          : pulse 
            ? '1px solid #f59e0b' 
            : '1px solid rgba(255,255,255,0.08)',
        color: checked ? '#10b981' : pulse ? '#f59e0b' : 'transparent',
        fontSize: 9, fontWeight: 900,
        boxShadow: checked ? '0 0 8px rgba(16,185,129,0.3)' : 'none',
        animation: pulse ? 'pulse 1.5s infinite ease-in-out' : 'none',
        flexShrink: 0
      }}>
        ✓
      </div>
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: checked ? '#fff' : pulse ? '#f59e0b' : '#9ca3af' }}>
          {label}
        </div>
        <div style={{ fontSize: 10, color: '#6b7280', marginTop: 1, fontFamily: 'monospace' }}>
          {desc}
        </div>
      </div>
    </div>
  )
}
