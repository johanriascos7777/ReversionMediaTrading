/**
 * FullRevertionDashboard.tsx
 *
 * Panel de control premium de la nueva estrategia "Full Reversion".
 * Muestra el estado en tiempo real (M5, M15 y fusión) y permite visualizar
 * el backtest detallado con el filtro de pendiente de la EMA100.
 */

import { useState } from 'react'
import { useFullRevertion } from '../hooks/useFullRevertion'

export function FullRevertionDashboard() {
  const [activeSymbol, setActiveSymbol] = useState('EUR/USD')
  const { symbols, status, loading, error, refetch } = useFullRevertion(activeSymbol, 5000)

  // ── Símbolos por defecto si la API está vacía temporalmente ──────────────────
  const activeSymbolsList = symbols.length > 0 ? symbols : ['EUR/USD', 'GBP/USD', 'AUD/USD', 'USD/JPY', 'NZD/USD']

  // Cargar color según estado (GREEN/YELLOW/RED)
  const getStateColor = (state?: 'GREEN' | 'YELLOW' | 'RED') => {
    if (state === 'GREEN') return '#10b981'
    if (state === 'YELLOW') return '#f59e0b'
    return '#6b7280'
  }

  const getSlopeBadgeColor = (slope?: 'FLAT' | 'GENTLE' | 'STEEP') => {
    if (slope === 'FLAT') return '#10b981'
    if (slope === 'GENTLE') return '#f59e0b'
    return '#ef4444'
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(ellipse at 50% 0%, rgba(16,185,129,0.06) 0%, transparent 60%), #07070f',
      padding: '32px 24px',
      color: '#fff',
      fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>

        {/* ── HEADER ────────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28, gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 24 }}>🌊</span>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, letterSpacing: '-0.5px', background: 'linear-gradient(135deg, #34d399, #60a5fa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                FULL REVERSION ENGINE
              </h1>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#9ca3af' }}>
              Detección de anomalías de elasticidad multi-marco temporal con filtro de pendiente EMA100.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {/* Indicador de Carga */}
            {loading && (
              <span style={{ fontSize: 12, color: '#a78bfa', fontFamily: 'monospace', animation: 'pulse-text 1s infinite alternate' }}>
                ACTUALIZANDO...
              </span>
            )}

            {/* Selector de Símbolo */}
            <select
              value={activeSymbol}
              onChange={(e) => setActiveSymbol(e.target.value)}
              style={{
                background: 'rgba(10,10,20,0.8)',
                border: '1px solid rgba(52,211,153,0.3)',
                color: '#fff',
                borderRadius: 8,
                padding: '8px 16px',
                fontSize: 12,
                outline: 'none',
                cursor: 'pointer',
                fontWeight: 600,
                boxShadow: '0 0 10px rgba(52,211,153,0.1)',
                transition: 'all 0.2s',
              }}
            >
              {activeSymbolsList.map((sym) => (
                <option key={sym} value={sym} style={{ background: '#0a0a14' }}>{sym}</option>
              ))}
            </select>

            {/* Botón Refrescar */}
            <button
              onClick={refetch}
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8,
                padding: '8px 12px',
                color: '#d1d5db',
                fontSize: 12,
                cursor: 'pointer',
                fontWeight: 500,
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
            >
              🔄 Refrescar
            </button>
          </div>
        </div>

        {/* ── CASO ERROR / SIN DATOS ────────────────────────────────────────── */}
        {error && (
          <div style={{
            marginBottom: 24, borderRadius: 12,
            border: '1px solid rgba(239,68,68,0.3)',
            background: 'rgba(239,68,68,0.06)',
            padding: '16px 20px', fontSize: 13, color: '#fca5a5'
          }}>
            ⚠️ {error}
          </div>
        )}

        {!status && !loading && !error && (
          <div style={{
            borderRadius: 16, background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.05)', padding: 48,
            textAlign: 'center', color: '#9ca3af'
          }}>
            <span style={{ fontSize: 32, display: 'block', marginBottom: 12 }}>⏳</span>
            <h3>No hay datos para {activeSymbol}</h3>
            <p style={{ maxWidth: 500, margin: '0 auto', fontSize: 13, lineHeight: 1.5 }}>
              El servidor NestJS necesita acumular al menos 115 velas de historial para calcular las medias móviles de 100 periodos y las pendientes de este par. Espera un momento o consulta otro par.
            </p>
          </div>
        )}

        {status && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 24 }}>

            {/* ── BANNER CENTRAL DE DECISIÓN FUSIONADA ────────────────────────── */}
            <div style={{
              background: status.fused.signalActive
                ? 'radial-gradient(circle at 10% 50%, rgba(16,185,129,0.15) 0%, transparent 60%), rgba(10,25,18,0.6)'
                : (!status.fused.bothAllowed && status.fused.bothGreen)
                  ? 'radial-gradient(circle at 10% 50%, rgba(239,68,68,0.1) 0%, transparent 60%), rgba(25,10,12,0.6)'
                  : 'rgba(15,15,25,0.6)',
              border: status.fused.signalActive
                ? '1px solid rgba(16,185,129,0.35)'
                : (!status.fused.bothAllowed && status.fused.bothGreen)
                  ? '1px solid rgba(239,68,68,0.3)'
                  : '1px solid rgba(255,255,255,0.06)',
              borderRadius: 16, padding: '24px 28px',
              backdropFilter: 'blur(16px)',
              boxShadow: status.fused.signalActive ? '0 0 25px rgba(16,185,129,0.15)' : 'none',
              transition: 'all 0.3s ease',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 20
            }}>
              <div style={{ flex: 1, minWidth: 280 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <span style={{
                    fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 6,
                    background: status.fused.signalActive ? '#10b981' : '#374151', color: '#fff',
                    fontFamily: 'monospace', letterSpacing: '1px'
                  }}>
                    CONFLUENCIA
                  </span>
                  <span style={{ fontSize: 12, color: '#6b7280' }}>
                    Última actualización: {new Date(status.updatedAt).toLocaleTimeString()}
                  </span>
                </div>

                <h2 style={{
                  margin: '0 0 10px', fontSize: 20, fontWeight: 900,
                  color: status.fused.signalActive ? '#10b981' : (!status.fused.bothAllowed && status.fused.bothGreen) ? '#f43f5e' : '#fff'
                }}>
                  {status.recommendation}
                </h2>

                <p style={{ margin: 0, fontSize: 13, color: '#9ca3af', lineHeight: 1.5 }}>
                  El motor fusionado monitoriza simultáneamente los marcos de M5 y M15. Si ambos detectan un exceso de elasticidad (GREEN) pero la EMA100 está en una tendencia fuerte (STEEP), la señal es bloqueada para protegerte del riesgo de roturas masivas de tendencia.
                </p>
              </div>

              {/* Indicador visual de estado */}
              <div style={{
                display: 'flex', flexDirection: 'column', gap: 10,
                alignItems: 'center', justifySelf: 'center', flexShrink: 0
              }}>
                <div style={{
                  width: 76, height: 76, borderRadius: '50%',
                  background: status.fused.signalActive
                    ? 'rgba(16,185,129,0.12)'
                    : (!status.fused.bothAllowed && status.fused.bothGreen)
                      ? 'rgba(239,68,68,0.12)'
                      : 'rgba(255,255,255,0.03)',
                  border: `3px solid ${status.fused.signalActive ? '#10b981' : (!status.fused.bothAllowed && status.fused.bothGreen) ? '#ef4444' : 'rgba(255,255,255,0.08)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32,
                  boxShadow: status.fused.signalActive ? '0 0 20px rgba(16,185,129,0.4)' : 'none',
                  animation: status.fused.signalActive ? 'pulse-glow 1.5s infinite alternate' : 'none'
                }}>
                  {status.fused.signalActive ? '🔱' : (!status.fused.bothAllowed && status.fused.bothGreen) ? '🚫' : '⏳'}
                </div>
                <span style={{
                  fontSize: 11, fontFamily: 'monospace', fontWeight: 700,
                  color: status.fused.signalActive ? '#10b981' : (!status.fused.bothAllowed && status.fused.bothGreen) ? '#ef4444' : '#6b7280'
                }}>
                  {status.fused.signalActive ? 'SEÑAL ACTIVA' : (!status.fused.bothAllowed && status.fused.bothGreen) ? 'BLOQUEADA' : 'MODO REPOSO'}
                </span>
              </div>
            </div>

            {/* ── DETALLE M5 Y M15 EN DOS COLUMNAS ────────────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: 24 }}>

              {/* CARD M5 */}
              <TimeframeCard title="🕐 Marco Temporal M5" snap={status.m5} getStateColor={getStateColor} getSlopeBadgeColor={getSlopeBadgeColor} />

              {/* CARD M15 */}
              {status.m15 ? (
                <TimeframeCard title="🕑 Marco Temporal M15" snap={status.m15} getStateColor={getStateColor} getSlopeBadgeColor={getSlopeBadgeColor} />
              ) : (
                <div style={{
                  borderRadius: 16, background: 'rgba(255,255,255,0.01)',
                  border: '1px solid rgba(255,255,255,0.04)', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', color: '#6b7280', fontSize: 13
                }}>
                  No hay datos acumulados para el timeframe M15 de {activeSymbol}.
                </div>
              )}

            </div>

            {/* ── DETALLE DEL BACKTEST Y LISTA DE EVENTOS ──────────────────────── */}
            {status.backtest && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 }}>

                {/* KPI METRICS CARD */}
                <div style={{
                  background: 'rgba(15,15,25,0.5)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 16, padding: 24, backdropFilter: 'blur(12px)'
                }}>
                  <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: '#fff', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 10 }}>
                    📊 Rendimiento Backtest (50 barras M5)
                  </h3>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 24 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 32, fontWeight: 900, color: '#10b981', fontFamily: 'monospace' }}>
                        {status.backtest.winRate}%
                      </div>
                      <div style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', marginTop: 4 }}>
                        Win Rate Ajustado
                      </div>
                    </div>

                    {/* Circular dial simulation in SVG */}
                    <svg width="60" height="60" viewBox="0 0 36 36">
                      <path
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="3.5"
                      />
                      <path
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none" stroke="#10b981" strokeWidth="3.5"
                        strokeDasharray={`${status.backtest.winRate}, 100`}
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: 12, borderRadius: 8, border: '1px solid rgba(255,255,255,0.04)' }}>
                      <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'monospace' }}>
                        {status.backtest.allowedSignals} / {status.backtest.totalSignals}
                      </div>
                      <div style={{ fontSize: 10, color: '#6b7280', marginTop: 4 }}>SEÑALES EJECUTABLES</div>
                    </div>

                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: 12, borderRadius: 8, border: '1px solid rgba(255,255,255,0.04)' }}>
                      <div style={{ fontSize: 18, fontWeight: 700, color: '#ef4444', fontFamily: 'monospace' }}>
                        {status.backtest.filteredBySlope}
                      </div>
                      <div style={{ fontSize: 10, color: '#6b7280', marginTop: 4 }}>BLOQUEADAS POR TENDENCIA</div>
                    </div>
                  </div>

                  <div style={{
                    fontSize: 12, color: '#9ca3af', lineHeight: 1.5,
                    padding: 12, background: 'rgba(52,211,153,0.04)', borderRadius: 8, border: '1px solid rgba(52,211,153,0.1)'
                  }}>
                    💡 El filtro de tendencia ha omitido <strong>{status.backtest.filteredBySlope} operaciones</strong> peligrosas en tendencias fuertes, aumentando el ratio de efectividad a <strong>{status.backtest.winRate}%</strong> con una recuperación media en <strong>{status.backtest.avgBarsToRevert} velas</strong>.
                  </div>
                </div>

                {/* BACKTEST EVENTS AUDIT TABLE */}
                <div style={{
                  background: 'rgba(15,15,25,0.5)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 16, padding: 24, backdropFilter: 'blur(12px)',
                  display: 'flex', flexDirection: 'column'
                }}>
                  <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700, color: '#fff', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 10 }}>
                    📋 Historial de Señales en Backtest (Últimos 8)
                  </h3>

                  <div style={{ overflowX: 'auto', flex: 1 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, textAlign: 'left' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#6b7280' }}>
                          <th style={{ padding: '6px 4px', fontWeight: 600 }}>Índice</th>
                          <th style={{ padding: '6px 4px', fontWeight: 600 }}>Elasticidad</th>
                          <th style={{ padding: '6px 4px', fontWeight: 600 }}>Pendiente</th>
                          <th style={{ padding: '6px 4px', fontWeight: 600 }}>Resultado</th>
                          <th style={{ padding: '6px 4px', fontWeight: 600 }}>Cruce</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(status.backtest.events || []).slice(-8).reverse().map((evt, idx) => {
                          const isWin = evt.exitIndex !== -1
                          const isFiltered = evt.blockedBySlope

                          return (
                            <tr key={idx} style={{
                              borderBottom: '1px solid rgba(255,255,255,0.03)',
                              opacity: isFiltered ? 0.45 : 1,
                              transition: 'opacity 0.2s'
                            }}>
                              <td style={{ padding: '8px 4px', fontFamily: 'monospace', color: '#9ca3af' }}>
                                #{evt.entryIndex}
                              </td>
                              <td style={{ padding: '8px 4px', fontFamily: 'monospace', fontWeight: 600 }}>
                                {evt.elasticity.toFixed(2)}
                              </td>
                              <td style={{ padding: '8px 4px' }}>
                                <span style={{
                                  fontSize: 10, padding: '2px 6px', borderRadius: 4, fontWeight: 700,
                                  background: `${getSlopeBadgeColor(evt.emaSlope)}15`,
                                  color: getSlopeBadgeColor(evt.emaSlope),
                                  border: `1px solid ${getSlopeBadgeColor(evt.emaSlope)}30`
                                }}>
                                  {evt.emaSlope}
                                </span>
                              </td>
                              <td style={{ padding: '8px 4px' }}>
                                {isFiltered ? (
                                  <span style={{ color: '#ef4444', fontWeight: 600 }}>🚫 FILTRADO</span>
                                ) : isWin ? (
                                  <span style={{ color: '#10b981', fontWeight: 600 }}>✅ GANADO</span>
                                ) : (
                                  <span style={{ color: '#6b7280', fontWeight: 500 }}>❌ FALLADO</span>
                                )}
                              </td>
                              <td style={{ padding: '8px 4px', fontFamily: 'monospace', color: isWin ? '#10b981' : '#6b7280' }}>
                                {isFiltered ? '—' : isWin ? `${evt.barsToRevert} velas` : '>50 velas'}
                              </td>
                            </tr>
                          )
                        })}

                        {(!status.backtest.events || status.backtest.events.length === 0) && (
                          <tr>
                            <td colSpan={5} style={{ padding: '20px 0', textAlign: 'center', color: '#6b7280' }}>
                              No se encontraron señales en este periodo del backtest.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            )}

          </div>
        )}

      </div>

      <style>{`
        @keyframes pulse-text {
          from { opacity: 0.5; }
          to { opacity: 1; }
        }
        @keyframes pulse-glow {
          from { box-shadow: 0 0 12px rgba(16,185,129,0.2); }
          to { box-shadow: 0 0 25px rgba(16,185,129,0.5); }
        }
      `}</style>
    </div>
  )
}

// ─── COMPONENTE CARD DE TIMEFRAME M5/M15 ────────────────────────────────────

interface TimeframeCardProps {
  title: string
  snap: any
  getStateColor: (state?: 'GREEN' | 'YELLOW' | 'RED') => string
  getSlopeBadgeColor: (slope?: 'FLAT' | 'GENTLE' | 'STEEP') => string
}

function TimeframeCard({ title, snap, getStateColor, getSlopeBadgeColor }: TimeframeCardProps) {
  const isUp = snap.slopeDirection === 'UP'
  const isDown = snap.slopeDirection === 'DOWN'
  const slopeSymbol = isUp ? '📈 ↗️' : isDown ? '📉 ↘️' : '⚖️ →'

  const priceDecimals = snap.price > 10 ? 3 : 5

  return (
    <div style={{
      background: 'rgba(15,15,25,0.5)',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 16, padding: '24px 28px', backdropFilter: 'blur(12px)',
      display: 'flex', flexDirection: 'column', gap: 16
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#fff' }}>
          {title}
        </h3>
        <span style={{
          fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 6,
          backgroundColor: `${getStateColor(snap.state)}18`,
          color: getStateColor(snap.state),
          border: `1px solid ${getStateColor(snap.state)}30`,
          fontFamily: 'monospace'
        }}>
          ESTADO: {snap.state}
        </span>
      </div>

      {/* Elasticity Gauge Row */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#9ca3af', marginBottom: 6 }}>
          <span>Elasticidad (ATR)</span>
          <span style={{ fontWeight: 700, color: '#fff', fontFamily: 'monospace' }}>
            {snap.elasticity.toFixed(3)}
          </span>
        </div>

        {/* Progress bar representational gauge */}
        <div style={{ width: '100%', height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
          <div style={{
            width: `${Math.min(100, (snap.elasticity / 3) * 100)}%`,
            height: '100%',
            background: `linear-gradient(90deg, ${getStateColor(snap.state)} 0%, #a78bfa 100%)`,
            borderRadius: 4,
            boxShadow: `0 0 8px ${getStateColor(snap.state)}`,
            transition: 'width 0.4s ease-out'
          }} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#4b5563', marginTop: 4 }}>
          <span>Normal (0.0)</span>
          <span>Percentil: {snap.percentile.toFixed(0)}%</span>
          <span>Extremo (3.0+)</span>
        </div>
      </div>

      {/* Price vs EMA details */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
        background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)',
        padding: 12, borderRadius: 10
      }}>
        <div>
          <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', marginBottom: 2 }}>Precio Actual</div>
          <div style={{ fontSize: 15, fontWeight: 700, fontFamily: 'monospace' }}>
            {snap.price.toFixed(priceDecimals)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', marginBottom: 2 }}>Media EMA100</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#a78bfa', fontFamily: 'monospace' }}>
            {snap.ema100.toFixed(priceDecimals)}
          </div>
        </div>
      </div>

      {/* Slope indicator section */}
      <div>
        <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', marginBottom: 6 }}>
          Análisis de Pendiente EMA100
        </div>

        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '10px 14px', borderRadius: 8, background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.03)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>{slopeSymbol}</span>
            <span style={{ fontSize: 12, fontWeight: 600 }}>
              {Math.abs(snap.emaSlopeValue).toFixed(3)} ATR/10b
            </span>
          </div>

          <span style={{
            fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 4,
            background: `${getSlopeBadgeColor(snap.emaSlope)}18`,
            color: getSlopeBadgeColor(snap.emaSlope),
            border: `1px solid ${getSlopeBadgeColor(snap.emaSlope)}30`
          }}>
            {snap.emaSlope}
          </span>
        </div>
      </div>

      {/* Operability footer */}
      <div style={{
        marginTop: 'auto', paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.04)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <span style={{ fontSize: 12, color: '#9ca3af' }}>Estatus de Señal:</span>
        <span style={{
          fontSize: 12, fontWeight: 800,
          color: snap.signalAllowed ? '#10b981' : '#ef4444'
        }}>
          {snap.signalAllowed ? '✅ OPERABLE' : '🚫 BLOQUEADO POR TENDENCIA'}
        </span>
      </div>
    </div>
  )
}
