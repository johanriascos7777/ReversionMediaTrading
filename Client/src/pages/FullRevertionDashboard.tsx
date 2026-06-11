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
  const [engineMode, setEngineMode] = useState<'standard' | 'reforced'>('reforced')
  const { symbols, status, loading, error, refetch } = useFullRevertion(activeSymbol, 5000, engineMode)

  const theme = engineMode === 'reforced' ? {
    bg: 'radial-gradient(ellipse at 50% 0%, rgba(0, 255, 102, 0.12) 0%, rgba(189, 0, 255, 0.08) 50%, transparent 80%), #04030a',
    title: '🔱 REFORCED ALIEN ENGINE 🪐',
    description: 'Sistema cuántico reforzado de confluencia: EMA50 + EMA100 + Stochastic + CCI.',
    headerGradient: 'linear-gradient(135deg, #00ff66, #bd00ff, #00f0ff)',
    accent: '#00ff66',
    accentText: '#00ff66',
    cardBg: 'rgba(8, 6, 18, 0.85)',
    borderColor: 'rgba(0, 255, 102, 0.2)',
    borderHover: 'rgba(0, 255, 102, 0.5)',
    glowEffect: '0 0 20px rgba(0, 255, 102, 0.1)',
    fontFamily: '"Orbitron", "Share Tech Mono", monospace',
  } : {
    bg: 'radial-gradient(ellipse at 50% 0%, rgba(16,185,129,0.06) 0%, transparent 60%), #07070f',
    title: 'FULL REVERSION ENGINE',
    description: 'Detección de anomalías de elasticidad multi-marco temporal con filtro de pendiente EMA100.',
    headerGradient: 'linear-gradient(135deg, #34d399, #60a5fa)',
    accent: '#10b981',
    accentText: '#34d399',
    cardBg: 'rgba(15,15,25,0.5)',
    borderColor: 'rgba(255,255,255,0.06)',
    borderHover: 'rgba(255,255,255,0.12)',
    glowEffect: 'none',
    fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
  }

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
      background: engineMode === 'reforced'
        ? 'linear-gradient(rgba(4, 3, 10, 0.94), rgba(4, 3, 10, 0.94)), linear-gradient(to right, rgba(0, 255, 102, 0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(0, 255, 102, 0.04) 1px, transparent 1px)'
        : 'radial-gradient(ellipse at 50% 0%, rgba(16,185,129,0.06) 0%, transparent 60%), #07070f',
      backgroundSize: engineMode === 'reforced' ? '40px 40px' : 'auto',
      backgroundImage: engineMode === 'standard' ? theme.bg : undefined,
      padding: '32px 24px',
      color: '#fff',
      fontFamily: theme.fontFamily,
      transition: 'all 0.5s ease-in-out',
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Share+Tech+Mono&display=swap" rel="stylesheet" />
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>

        {/* ── HEADER ────────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28, gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 24 }}>{engineMode === 'reforced' ? '👽' : '🌊'}</span>
              <h1 style={{
                margin: 0,
                fontSize: 24,
                fontWeight: 900,
                letterSpacing: engineMode === 'reforced' ? '1px' : '-0.5px',
                background: theme.headerGradient,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                textShadow: engineMode === 'reforced' ? '0 0 10px rgba(0, 255, 102, 0.3)' : 'none',
                fontFamily: theme.fontFamily,
              }}>
                {theme.title}
              </h1>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#9ca3af', fontFamily: engineMode === 'reforced' ? '"Share Tech Mono", monospace' : 'inherit' }}>
              {theme.description}
            </p>
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {/* Indicador de Carga */}
            {loading && (
              <span style={{ fontSize: 12, color: '#a78bfa', fontFamily: 'monospace', animation: 'pulse-text 1s infinite alternate' }}>
                ACTUALIZANDO...
              </span>
            )}

            {/* Selector de Modo */}
            <div style={{
              display: 'flex',
              background: 'rgba(10,10,20,0.8)',
              border: engineMode === 'reforced' ? '1px solid rgba(0, 255, 102, 0.4)' : '1px solid rgba(255,255,255,0.08)',
              borderRadius: 8,
              padding: 3,
              gap: 4,
              boxShadow: engineMode === 'reforced' ? '0 0 15px rgba(0, 255, 102, 0.15)' : 'none',
              transition: 'all 0.3s'
            }}>
              <button
                onClick={() => setEngineMode('standard')}
                style={{
                  background: engineMode === 'standard' ? '#10b981' : 'transparent',
                  border: 'none',
                  color: engineMode === 'standard' ? '#fff' : '#6b7280',
                  borderRadius: 6,
                  padding: '6px 14px',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                STANDARD
              </button>
              <button
                onClick={() => setEngineMode('reforced')}
                style={{
                  background: engineMode === 'reforced' 
                    ? 'linear-gradient(135deg, #00ff66 0%, #bd00ff 100%)' 
                    : 'transparent',
                  border: 'none',
                  color: engineMode === 'reforced' ? '#fff' : '#6b7280',
                  borderRadius: 6,
                  padding: '6px 14px',
                  fontSize: 11,
                  fontWeight: 900,
                  letterSpacing: '0.5px',
                  textShadow: engineMode === 'reforced' ? '0 1px 3px rgba(0,0,0,0.6)' : 'none',
                  cursor: 'pointer',
                  boxShadow: engineMode === 'reforced' ? '0 0 12px rgba(0, 255, 102, 0.4)' : 'none',
                  transition: 'all 0.2s',
                  fontFamily: engineMode === 'reforced' ? '"Orbitron", sans-serif' : 'inherit'
                }}
              >
                👽 REFORCED
              </button>
            </div>

            {/* Selector de Símbolo */}
            <select
              value={activeSymbol}
              onChange={(e) => setActiveSymbol(e.target.value)}
              style={{
                background: 'rgba(10,10,20,0.8)',
                border: engineMode === 'reforced' ? '1px solid rgba(0, 255, 102, 0.4)' : '1px solid rgba(52,211,153,0.3)',
                color: '#fff',
                borderRadius: 8,
                padding: '8px 16px',
                fontSize: 12,
                outline: 'none',
                cursor: 'pointer',
                fontWeight: 600,
                boxShadow: engineMode === 'reforced' ? '0 0 12px rgba(0, 255, 102, 0.2)' : '0 0 10px rgba(52,211,153,0.1)',
                transition: 'all 0.2s',
                fontFamily: theme.fontFamily,
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
                fontFamily: theme.fontFamily,
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
                ? (engineMode === 'reforced' 
                  ? 'radial-gradient(circle at 10% 50%, rgba(0, 255, 102, 0.2) 0%, transparent 60%), rgba(8, 6, 18, 0.85)'
                  : 'radial-gradient(circle at 10% 50%, rgba(16,185,129,0.15) 0%, transparent 60%), rgba(10,25,18,0.6)')
                : (!status.fused.bothAllowed && status.fused.bothGreen)
                  ? 'radial-gradient(circle at 10% 50%, rgba(239,68,68,0.1) 0%, transparent 60%), rgba(25,10,12,0.6)'
                  : theme.cardBg,
              border: status.fused.signalActive
                ? (engineMode === 'reforced' ? '1px solid rgba(0, 255, 102, 0.5)' : '1px solid rgba(16,185,129,0.35)')
                : (!status.fused.bothAllowed && status.fused.bothGreen)
                  ? '1px solid rgba(239,68,68,0.3)'
                  : `1px solid ${theme.borderColor}`,
              borderRadius: 16, padding: '24px 28px',
              backdropFilter: 'blur(16px)',
              boxShadow: status.fused.signalActive 
                ? (engineMode === 'reforced' ? '0 0 30px rgba(0, 255, 102, 0.3)' : '0 0 25px rgba(16,185,129,0.15)') 
                : 'none',
              transition: 'all 0.3s ease',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 20,
              fontFamily: theme.fontFamily
            }}>
              <div style={{ flex: 1, minWidth: 280 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <span style={{
                    fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 6,
                    background: status.fused.signalActive ? (engineMode === 'reforced' ? '#00ff66' : '#10b981') : '#374151', 
                    color: status.fused.signalActive && engineMode === 'reforced' ? '#000' : '#fff',
                    fontFamily: theme.fontFamily, letterSpacing: '1px',
                    boxShadow: status.fused.signalActive && engineMode === 'reforced' ? '0 0 10px rgba(0, 255, 102, 0.4)' : 'none'
                  }}>
                    CONFLUENCIA {engineMode === 'reforced' ? 'CUÁNTICA' : ''}
                  </span>
                  <span style={{ fontSize: 12, color: '#6b7280' }}>
                    Última actualización: {new Date(status.updatedAt).toLocaleTimeString()}
                  </span>
                </div>

                <h2 style={{
                  margin: '0 0 10px', fontSize: 20, fontWeight: 900,
                  color: status.fused.signalActive 
                    ? (engineMode === 'reforced' ? '#00ff66' : '#10b981') 
                    : (!status.fused.bothAllowed && status.fused.bothGreen) ? '#f43f5e' : '#fff',
                  textShadow: status.fused.signalActive && engineMode === 'reforced' ? '0 0 10px rgba(0,255,102,0.3)' : 'none'
                }}>
                  {status.recommendation}
                </h2>

                <p style={{ margin: 0, fontSize: 13, color: '#9ca3af', lineHeight: 1.5, fontFamily: engineMode === 'reforced' ? '"Share Tech Mono", monospace' : 'inherit' }}>
                  El motor fusionado monitoriza simultáneamente los marcos de M5 y M15. Si ambos detectan un exceso de elasticidad (GREEN) pero la EMA100 está en una tendencia fuerte (STEEP), la señal es bloqueada para protegerte del riesgo de roturas masivas de tendencia.
                </p>

                {/* Detalles de la Confluencia y Objetivos */}
                {(status.fused.signalActive || (status.fused.bothGreen && status.fused.bothAllowed)) && (
                  <div style={{
                    marginTop: 16, display: 'flex', gap: 16, flexWrap: 'wrap',
                    background: engineMode === 'reforced' ? 'rgba(0, 255, 102, 0.03)' : 'rgba(255,255,255,0.02)', 
                    padding: '14px 18px',
                    borderRadius: 12, border: engineMode === 'reforced' ? '1px solid rgba(0, 255, 102, 0.15)' : '1px solid rgba(255,255,255,0.04)'
                  }}>
                    {/* Estado del Gatillo */}
                    <div style={{ flex: '1 1 200px' }}>
                      <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', marginBottom: 4 }}>GATILLO DE AGOTAMIENTO</div>
                      <span style={{
                        fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6,
                        color: status.m5.triggerState === 'giro' ? (engineMode === 'reforced' ? '#00ff66' : '#10b981') : '#f59e0b',
                        textShadow: status.m5.triggerState === 'giro' && engineMode === 'reforced' ? '0 0 8px rgba(0,255,102,0.4)' : 'none'
                      }}>
                        {status.m5.triggerState === 'giro' ? '⚡ GIRO CONFIRMADO (ENTRADA!)' : '🪃 ESTIRANDO RESORTERA (ESPERAR)'}
                      </span>
                    </div>

                    {/* Confluencia Estructural */}
                    <div style={{ flex: '1 1 200px' }}>
                      <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', marginBottom: 4 }}>CONFLUENCIA ESTRUCTURAL</div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {status.m5.divergence && status.m5.divergence !== 'none' && (
                          <span style={{
                            fontSize: 11, padding: '2px 8px', borderRadius: 4, fontWeight: 600,
                            background: engineMode === 'reforced' ? 'rgba(189,0,255,0.15)' : 'rgba(167,139,250,0.12)', 
                            color: engineMode === 'reforced' ? '#d946ef' : '#a78bfa', 
                            border: engineMode === 'reforced' ? '1px solid rgba(189,0,255,0.3)' : '1px solid rgba(167,139,250,0.2)'
                          }}>
                            {status.m5.divergence === 'bearish' ? '🐻 Divergencia Bajista' : '🐂 Divergencia Alcista'}
                          </span>
                        )}
                        {status.m5.nearestSR && (
                          <span style={{
                            fontSize: 11, padding: '2px 8px', borderRadius: 4, fontWeight: 600,
                            background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.08)'
                          }}>
                            🏰 {status.m5.nearestSR.type === 'resistance' ? 'Resistencia' : 'Soporte'} (fza {status.m5.nearestSR.strength})
                          </span>
                        )}
                        {(!status.m5.divergence || status.m5.divergence === 'none') && !status.m5.nearestSR && (
                          <span style={{ fontSize: 12, color: '#4b5563' }}>Sin confluencias secundarias</span>
                        )}
                      </div>
                    </div>

                    {/* Niveles Sugeridos */}
                    <div style={{ flex: '1 1 200px' }}>
                      <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', marginBottom: 4 }}>PARÁMETROS SUGERIDOS (BROKER)</div>
                      {engineMode === 'reforced' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontFamily: 'monospace', fontSize: 12 }}>
                          <div>
                            <span style={{ color: '#00ff66', fontWeight: 700 }}>TP1 (EMA50):</span> {status.m5.tp50Price ?? '—'}
                          </div>
                          <div>
                            <span style={{ color: '#00f0ff', fontWeight: 700 }}>TP2 (EMA100):</span> {status.m5.tpPrice ?? '—'}
                          </div>
                          <div>
                            <span style={{ color: '#f43f5e', fontWeight: 700 }}>SL (1.8 ATR):</span> {status.m5.slPrice ?? '—'}
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: 12, fontFamily: 'monospace', fontSize: 12 }}>
                          <div>
                            <span style={{ color: '#10b981', fontWeight: 700 }}>TP:</span> {status.m5.tpPrice}
                          </div>
                          <div>
                            <span style={{ color: '#f43f5e', fontWeight: 700 }}>SL:</span> {status.m5.slPrice}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Indicador visual de estado */}
              <div style={{
                display: 'flex', flexDirection: 'column', gap: 10,
                alignItems: 'center', justifySelf: 'center', flexShrink: 0
              }}>
                <div style={{
                  width: 76, height: 76, borderRadius: '50%',
                  background: status.fused.signalActive
                    ? (engineMode === 'reforced' ? 'rgba(0, 255, 102, 0.12)' : 'rgba(16,185,129,0.12)')
                    : (!status.fused.bothAllowed && status.fused.bothGreen)
                      ? 'rgba(239,68,68,0.12)'
                      : 'rgba(255,255,255,0.03)',
                  border: `3px solid ${status.fused.signalActive 
                    ? (engineMode === 'reforced' ? '#00ff66' : '#10b981') 
                    : (!status.fused.bothAllowed && status.fused.bothGreen) ? '#ef4444' : 'rgba(255,255,255,0.08)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32,
                  boxShadow: status.fused.signalActive 
                    ? (engineMode === 'reforced' ? '0 0 25px rgba(0, 255, 102, 0.4)' : '0 0 20px rgba(16,185,129,0.4)') 
                    : 'none',
                  animation: status.fused.signalActive ? 'pulse-glow 1.5s infinite alternate' : 'none'
                }}>
                  {status.fused.signalActive ? (engineMode === 'reforced' ? '👽' : '🔱') : (!status.fused.bothAllowed && status.fused.bothGreen) ? '🚫' : '⏳'}
                </div>
                <span style={{
                  fontSize: 11, fontFamily: theme.fontFamily, fontWeight: 700,
                  color: status.fused.signalActive 
                    ? (engineMode === 'reforced' ? '#00ff66' : '#10b981') 
                    : (!status.fused.bothAllowed && status.fused.bothGreen) ? '#ef4444' : '#6b7280',
                  textShadow: status.fused.signalActive && engineMode === 'reforced' ? '0 0 5px rgba(0, 255, 102, 0.4)' : 'none'
                }}>
                  {status.fused.signalActive ? 'SEÑAL ACTIVA' : (!status.fused.bothAllowed && status.fused.bothGreen) ? 'BLOQUEADA' : 'MODO REPOSO'}
                </span>
              </div>
            </div>

            {/* ── DETALLE M5 Y M15 EN DOS COLUMNAS ────────────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: 24 }}>

              {/* CARD M5 */}
              <TimeframeCard title="🕐 Marco Temporal M5" snap={status.m5} getStateColor={getStateColor} getSlopeBadgeColor={getSlopeBadgeColor} engineMode={engineMode} theme={theme} />

              {/* CARD M15 */}
              {status.m15 ? (
                <TimeframeCard title="🕑 Marco Temporal M15" snap={status.m15} getStateColor={getStateColor} getSlopeBadgeColor={getSlopeBadgeColor} engineMode={engineMode} theme={theme} />
              ) : (
                <div style={{
                  borderRadius: 16, background: theme.cardBg,
                  border: `1px solid ${theme.borderColor}`, display: 'flex',
                  alignItems: 'center', justifyContent: 'center', color: '#6b7280', fontSize: 13,
                  fontFamily: theme.fontFamily, minHeight: 250
                }}>
                  No hay datos acumulados para el timeframe M15 de {activeSymbol}.
                </div>
              )}

            </div>

            {/* ── BANDEJA DE AUDITORÍA EN TIEMPO REAL ────────────────────────── */}
            <div style={{
              background: theme.cardBg,
              border: `1px solid ${theme.borderColor}`,
              borderRadius: 16,
              padding: 24,
              backdropFilter: 'blur(12px)',
              boxShadow: theme.glowEffect,
              fontFamily: theme.fontFamily,
              transition: 'all 0.3s ease',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>{engineMode === 'reforced' ? '👽' : '⚖️'}</span> Bandeja de Auditoría en Tiempo Real {engineMode === 'reforced' ? '(Quantum Auditing Inbox)' : '(Auditing Inbox)'}
                  </h3>
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: '#9ca3af' }}>
                    Auditoría pasiva de señales Tipo A y Tipo C del Semáforo Viejo aplicando los filtros de Full Reversion.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 10, fontSize: 11, fontWeight: 700, fontFamily: 'monospace' }}>
                  <span style={{ color: engineMode === 'reforced' ? '#00ff66' : '#fbbf24', background: engineMode === 'reforced' ? 'rgba(0,255,102,0.1)' : 'rgba(245,158,11,0.1)', padding: '2px 8px', borderRadius: 4, border: `1px solid ${engineMode === 'reforced' ? 'rgba(0,255,102,0.2)' : 'rgba(245,158,11,0.2)'}` }}>VIP</span>
                  <span style={{ color: engineMode === 'reforced' ? '#00f0ff' : '#34d399', background: engineMode === 'reforced' ? 'rgba(0,240,255,0.1)' : 'rgba(52,211,153,0.1)', padding: '2px 8px', borderRadius: 4, border: `1px solid ${engineMode === 'reforced' ? 'rgba(0,240,255,0.2)' : 'rgba(52,211,153,0.2)'}` }}>APROBADO</span>
                  <span style={{ color: '#fb923c', background: 'rgba(249,115,22,0.1)', padding: '2px 8px', borderRadius: 4, border: '1px solid rgba(249,115,22,0.2)' }}>RIESGO</span>
                  <span style={{ color: '#f43f5e', background: 'rgba(244,63,94,0.1)', padding: '2px 8px', borderRadius: 4, border: '1px solid rgba(244,63,94,0.2)' }}>RECHAZADO</span>
                </div>
              </div>

              {!status.auditedSignals || status.auditedSignals.length === 0 ? (
                <div style={{
                  padding: '40px 20px',
                  textAlign: 'center',
                  background: 'rgba(255,255,255,0.01)',
                  border: '1px dashed rgba(255,255,255,0.1)',
                  borderRadius: 12,
                  color: '#6b7280',
                  fontSize: 13
                }}>
                  <span style={{ fontSize: 24, display: 'block', marginBottom: 8 }}>📥</span>
                  Esperando señales del Semáforo Viejo para auditar en tiempo real...
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxHeight: 450, overflowY: 'auto', paddingRight: 4 }}>
                  {status.auditedSignals.map((sig) => {
                    const isVIP = sig.verdict === 'VIP';
                    const isApproved = sig.verdict === 'APPROVED';
                    const isWarning = sig.verdict === 'WARNING';
                    const isRejected = sig.verdict === 'REJECTED';

                    let cardBorder = theme.borderColor;
                    let cardBackground = 'rgba(255,255,255,0.02)';
                    let shadow = 'none';
                    let badgeColor = '#9ca3af';
                    let badgeBg = 'rgba(255,255,255,0.05)';
                    let badgeText = sig.verdict;

                    if (isVIP) {
                      cardBorder = engineMode === 'reforced' ? 'rgba(0, 255, 102, 0.6)' : 'rgba(245, 158, 11, 0.45)';
                      cardBackground = engineMode === 'reforced' 
                        ? 'linear-gradient(135deg, rgba(0, 255, 102, 0.08) 0%, rgba(189, 0, 255, 0.08) 100%)' 
                        : 'linear-gradient(135deg, rgba(245, 158, 11, 0.05) 0%, rgba(139, 92, 246, 0.06) 100%)';
                      shadow = engineMode === 'reforced' 
                        ? '0 0 20px rgba(0, 255, 102, 0.2), inset 0 0 15px rgba(189, 0, 255, 0.1)' 
                        : '0 0 15px rgba(245, 158, 11, 0.1), inset 0 0 15px rgba(139, 92, 246, 0.05)';
                      badgeColor = engineMode === 'reforced' ? '#00ff66' : '#fbbf24';
                      badgeBg = engineMode === 'reforced' ? 'rgba(0, 255, 102, 0.15)' : 'rgba(245, 158, 11, 0.15)';
                      badgeText = engineMode === 'reforced' ? '🛸 VIP ALIEN' : '👑 VIP';
                    } else if (isApproved) {
                      cardBorder = engineMode === 'reforced' ? 'rgba(0, 240, 255, 0.5)' : 'rgba(16, 185, 129, 0.4)';
                      cardBackground = engineMode === 'reforced' ? 'rgba(0, 240, 255, 0.05)' : 'rgba(16, 185, 129, 0.03)';
                      shadow = engineMode === 'reforced' ? '0 0 12px rgba(0, 240, 255, 0.1)' : '0 0 12px rgba(16, 185, 129, 0.05)';
                      badgeColor = engineMode === 'reforced' ? '#00f0ff' : '#34d399';
                      badgeBg = engineMode === 'reforced' ? 'rgba(0, 240, 255, 0.15)' : 'rgba(16, 185, 129, 0.15)';
                      badgeText = engineMode === 'reforced' ? '✅ COMPATIBLE' : '✅ APROBADO';
                    } else if (isWarning) {
                      cardBorder = 'rgba(245, 158, 11, 0.35)';
                      cardBackground = 'rgba(245, 158, 11, 0.02)';
                      shadow = '0 0 12px rgba(245, 158, 11, 0.03)';
                      badgeColor = '#fb923c';
                      badgeBg = 'rgba(245, 158, 11, 0.1)';
                      badgeText = '⚠️ CON RIESGO';
                    } else if (isRejected) {
                      cardBorder = 'rgba(244, 63, 94, 0.35)';
                      cardBackground = 'rgba(244, 63, 94, 0.02)';
                      shadow = '0 0 12px rgba(244, 63, 94, 0.03)';
                      badgeColor = '#f43f5e';
                      badgeBg = 'rgba(244, 63, 94, 0.1)';
                      badgeText = '🚫 RECHAZADO';
                    }

                    const dec = sig.symbol.includes('JPY') ? 3 : 5;

                    return (
                      <div
                        key={sig.id}
                        className={`audit-card audit-${sig.verdict.toLowerCase()}`}
                        style={{
                          background: cardBackground,
                          border: `1px solid ${cardBorder}`,
                          borderRadius: 12,
                          padding: '16px 20px',
                          display: 'flex',
                          flexWrap: 'wrap',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: 16,
                          boxShadow: shadow,
                          transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                        }}
                      >
                        {/* PARTE 1: Identificación de la señal */}
                        <div style={{ flex: '1 1 200px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 15, fontWeight: 900, fontFamily: 'monospace', letterSpacing: '-0.2px' }}>
                              {sig.symbol}
                            </span>
                            <span style={{
                              fontSize: 10,
                              fontWeight: 800,
                              padding: '2px 6px',
                              borderRadius: 4,
                              background: sig.direction === 'BUY' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                              color: sig.direction === 'BUY' ? '#34d399' : '#f87171'
                            }}>
                              {sig.direction}
                            </span>
                          </div>
                          <div style={{ fontSize: 11, color: '#9ca3af' }}>
                            Precio: <strong style={{ color: '#fff', fontFamily: 'monospace' }}>{sig.price.toFixed(dec)}</strong>
                          </div>
                          <div style={{ fontSize: 10, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span>🔔 {sig.alertName}</span>
                            <span>•</span>
                            <span>{new Date(sig.timestamp).toLocaleTimeString()}</span>
                          </div>
                        </div>

                        {/* PARTE 2: Veredicto clínico */}
                        <div style={{ flex: '2 1 320px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{
                              fontSize: 9,
                              fontWeight: 900,
                              padding: '3px 8px',
                              borderRadius: 6,
                              color: badgeColor,
                              background: badgeBg,
                              border: `1px solid ${badgeColor}25`,
                              letterSpacing: '0.5px'
                            }}>
                              {badgeText}
                            </span>
                          </div>
                          <p style={{ margin: 0, fontSize: 12, color: '#d1d5db', lineHeight: 1.4 }}>
                            {sig.verdictText}
                          </p>
                        </div>

                        {/* PARTE 3: Filtros técnicos de Full Reversion */}
                        <div style={{ flex: '1.5 1 240px', display: 'flex', flexDirection: 'column', gap: 8, background: 'rgba(0,0,0,0.2)', padding: 12, borderRadius: 8, border: '1px solid rgba(255,255,255,0.03)' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 11 }}>
                            <div>
                              <span style={{ color: '#6b7280', fontSize: 10, display: 'block' }}>PENDIENTE M5</span>
                              <span style={{
                                fontWeight: 700,
                                color: getSlopeBadgeColor(sig.emaSlope as any)
                              }}>
                                {sig.emaSlope} ({sig.emaSlopeValue.toFixed(2)})
                              </span>
                            </div>
                            <div>
                              <span style={{ color: '#6b7280', fontSize: 10, display: 'block' }}>DIVERGENCIA RSI</span>
                              <span style={{ fontWeight: 600, color: sig.divergence.includes('Ninguna') ? '#6b7280' : '#c084fc' }}>
                                {sig.divergence}
                              </span>
                            </div>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 11, borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 6 }}>
                            <div>
                              <span style={{ color: '#6b7280', fontSize: 10, display: 'block' }}>S/R CONFLUENCIA</span>
                              <span style={{ fontWeight: 600, color: sig.nearestSR.includes('Ninguno') ? '#6b7280' : '#38bdf8' }}>
                                {sig.nearestSR}
                              </span>
                            </div>
                            <div>
                              <span style={{ color: '#6b7280', fontSize: 10, display: 'block' }}>ELASTICIDAD M5</span>
                              <span style={{ fontWeight: 700, color: '#fff', fontFamily: 'monospace' }}>
                                {sig.elasticityM5.toFixed(2)} ATR
                              </span>
                            </div>
                          </div>

                          {/* Osciladores adicionales en modo Reinforced */}
                          {engineMode === 'reforced' && (typeof sig.stochK === 'number' || typeof sig.cci === 'number') && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 11, borderTop: '1px solid rgba(0, 255, 102, 0.15)', paddingTop: 6, marginTop: 4 }}>
                              <div>
                                <span style={{ color: '#00ff66', fontSize: 9, display: 'block', fontWeight: 600 }}>STOCH (%K/%D)</span>
                                <span style={{ fontWeight: 600, color: '#fff' }}>
                                  {sig.stochK !== undefined ? sig.stochK.toFixed(1) : '—'} / {sig.stochD !== undefined ? sig.stochD.toFixed(1) : '—'}
                                </span>
                              </div>
                              <div>
                                <span style={{ color: '#00f0ff', fontSize: 9, display: 'block', fontWeight: 600 }}>CCI (14)</span>
                                <span style={{ fontWeight: 600, color: '#fff' }}>
                                  {sig.cci !== undefined ? sig.cci.toFixed(1) : '—'}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* PARTE 4: Parámetros sugeridos */}
                        <div style={{ flex: '1 1 120px', display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end', justifyContent: 'center' }}>
                          {isRejected ? (
                            <span style={{ fontSize: 11, color: '#ef4444', fontWeight: 600 }}>⚠️ OPERACIÓN EVITADA</span>
                          ) : (
                            <>
                              <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase' }}>BROKER SUGERIDO</div>
                              {engineMode === 'reforced' && sig.tp50Price ? (
                                <>
                                  <div style={{ fontSize: 11, fontFamily: 'monospace' }}>
                                    <span style={{ color: '#00ff66', fontWeight: 700 }}>TP1 (50):</span> {sig.tp50Price.toFixed(dec)}
                                  </div>
                                  <div style={{ fontSize: 11, fontFamily: 'monospace' }}>
                                    <span style={{ color: '#00f0ff', fontWeight: 700 }}>TP2 (100):</span> {sig.tpPrice.toFixed(dec)}
                                  </div>
                                </>
                              ) : (
                                <div style={{ fontSize: 12, fontFamily: 'monospace' }}>
                                  <span style={{ color: '#10b981', fontWeight: 700 }}>TP:</span> {sig.tpPrice.toFixed(dec)}
                                </div>
                              )}
                              <div style={{ fontSize: 12, fontFamily: 'monospace' }}>
                                <span style={{ color: '#f43f5e', fontWeight: 700 }}>SL:</span> {sig.slPrice.toFixed(dec)}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── DETALLE DEL BACKTEST Y LISTA DE EVENTOS ──────────────────────── */}
            {status.backtest && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 }}>

                {/* KPI METRICS CARD */}
                <div style={{
                  background: theme.cardBg,
                  border: `1px solid ${theme.borderColor}`,
                  borderRadius: 16, padding: 24, backdropFilter: 'blur(12px)',
                  boxShadow: theme.glowEffect,
                  fontFamily: theme.fontFamily,
                  transition: 'all 0.3s ease',
                }}>
                  <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: '#fff', borderBottom: `1px solid ${theme.borderColor}`, paddingBottom: 10 }}>
                    📊 Rendimiento Backtest (50 barras M5)
                  </h3>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 24 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 32, fontWeight: 900, color: theme.accentText, fontFamily: 'monospace', textShadow: engineMode === 'reforced' ? '0 0 10px rgba(0,255,102,0.4)' : 'none' }}>
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
                        fill="none" stroke={theme.accent} strokeWidth="3.5"
                        strokeDasharray={`${status.backtest.winRate}, 100`}
                        strokeLinecap="round"
                        style={{ transition: 'stroke-dasharray 0.6s ease' }}
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
                    padding: 12, background: engineMode === 'reforced' ? 'rgba(0,255,102,0.04)' : 'rgba(52,211,153,0.04)', borderRadius: 8, border: `1px solid ${engineMode === 'reforced' ? 'rgba(0,255,102,0.1)' : 'rgba(52,211,153,0.1)'}`
                  }}>
                    💡 El filtro de tendencia ha omitido <strong>{status.backtest.filteredBySlope} operaciones</strong> peligrosas en tendencias fuertes, aumentando el ratio de efectividad a <strong>{status.backtest.winRate}%</strong> con una recuperación media en <strong>{status.backtest.avgBarsToRevert} velas</strong>.
                  </div>
                </div>

                {/* BACKTEST EVENTS AUDIT TABLE */}
                <div style={{
                  background: theme.cardBg,
                  border: `1px solid ${theme.borderColor}`,
                  borderRadius: 16, padding: 24, backdropFilter: 'blur(12px)',
                  boxShadow: theme.glowEffect,
                  fontFamily: theme.fontFamily,
                  transition: 'all 0.3s ease',
                  display: 'flex', flexDirection: 'column'
                }}>
                  <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700, color: '#fff', borderBottom: `1px solid ${theme.borderColor}`, paddingBottom: 10 }}>
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
                              transition: 'opacity 0.2s',
                              background: isFiltered ? 'transparent' : (isWin ? (engineMode === 'reforced' ? 'rgba(0, 255, 102, 0.02)' : 'rgba(16, 185, 129, 0.02)') : 'transparent')
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
                                  <span style={{ color: engineMode === 'reforced' ? '#00ff66' : '#10b981', fontWeight: 600 }}>✅ GANADO</span>
                                ) : (
                                  <span style={{ color: '#6b7280', fontWeight: 500 }}>❌ FALLADO</span>
                                )}
                              </td>
                              <td style={{ padding: '8px 4px', fontFamily: 'monospace', color: isWin ? (engineMode === 'reforced' ? '#00ff66' : '#10b981') : '#6b7280' }}>
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
        .audit-card {
          cursor: pointer;
        }
        .audit-card:hover {
          transform: translateY(-2px);
          background: rgba(255, 255, 255, 0.05) !important;
        }
        .audit-vip:hover {
          box-shadow: ${engineMode === 'reforced' 
            ? '0 8px 25px rgba(0, 255, 102, 0.35), inset 0 0 15px rgba(189, 0, 255, 0.25) !important'
            : '0 8px 25px rgba(245, 158, 11, 0.25), inset 0 0 15px rgba(139, 92, 246, 0.05) !important'};
          border-color: ${engineMode === 'reforced' ? 'rgba(0, 255, 102, 0.8) !important' : 'rgba(245, 158, 11, 0.7) !important'};
        }
        .audit-approved:hover {
          box-shadow: ${engineMode === 'reforced' 
            ? '0 8px 20px rgba(0, 240, 255, 0.25) !important'
            : '0 8px 20px rgba(16, 185, 129, 0.15) !important'};
          border-color: ${engineMode === 'reforced' ? 'rgba(0, 240, 255, 0.7) !important' : 'rgba(16, 185, 129, 0.6) !important'};
        }
        .audit-warning:hover {
          box-shadow: 0 8px 20px rgba(245, 158, 11, 0.12) !important;
          border-color: rgba(245, 158, 11, 0.5) !important;
        }
        .audit-rejected:hover {
          box-shadow: 0 8px 20px rgba(244, 63, 94, 0.12) !important;
          border-color: rgba(244, 63, 94, 0.5) !important;
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
  engineMode: 'standard' | 'reforced'
  theme: any
}

function TimeframeCard({ title, snap, getStateColor, getSlopeBadgeColor, engineMode, theme }: TimeframeCardProps) {
  const isUp = snap.slopeDirection === 'UP'
  const isDown = snap.slopeDirection === 'DOWN'
  const slopeSymbol = isUp ? '📈 ↗️' : isDown ? '📉 ↘️' : '⚖️ →'

  const priceDecimals = snap.price > 10 ? 3 : 5

  return (
    <div style={{
      background: theme.cardBg,
      border: `1px solid ${theme.borderColor}`,
      boxShadow: theme.glowEffect,
      fontFamily: theme.fontFamily,
      borderRadius: 16, padding: '24px 28px', backdropFilter: 'blur(12px)',
      display: 'flex', flexDirection: 'column', gap: 16,
      transition: 'all 0.3s ease',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#fff' }}>
          {title}
        </h3>
        <span style={{
          fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 6,
          backgroundColor: engineMode === 'reforced'
            ? `${snap.state === 'GREEN' ? '#00ff66' : snap.state === 'YELLOW' ? '#fbbf24' : '#374151'}18`
            : `${getStateColor(snap.state)}18`,
          color: engineMode === 'reforced'
            ? (snap.state === 'GREEN' ? '#00ff66' : snap.state === 'YELLOW' ? '#fbbf24' : '#9ca3af')
            : getStateColor(snap.state),
          border: `1px solid ${engineMode === 'reforced'
            ? (snap.state === 'GREEN' ? '#00ff66' : snap.state === 'YELLOW' ? '#fbbf24' : '#374151') + '30'
            : getStateColor(snap.state) + '30'}`,
          fontFamily: theme.fontFamily,
          textShadow: engineMode === 'reforced' && snap.state === 'GREEN' ? '0 0 8px rgba(0,255,102,0.4)' : 'none'
        }}>
          ESTADO: {snap.state}
        </span>
      </div>

      {/* Elasticity Gauge Row */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#9ca3af', marginBottom: 6 }}>
          <span>Elasticidad (ATR)</span>
          <span style={{ fontWeight: 700, color: '#fff', fontFamily: theme.fontFamily }}>
            {snap.elasticity.toFixed(3)}
          </span>
        </div>

        {/* Progress bar representational gauge */}
        <div style={{ width: '100%', height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
          <div style={{
            width: `${Math.min(100, (snap.elasticity / 3) * 100)}%`,
            height: '100%',
            background: engineMode === 'reforced'
              ? `linear-gradient(90deg, #00ff66 0%, #bd00ff 100%)`
              : `linear-gradient(90deg, ${getStateColor(snap.state)} 0%, #a78bfa 100%)`,
            borderRadius: 4,
            boxShadow: engineMode === 'reforced'
              ? `0 0 10px rgba(0, 255, 102, 0.4)`
              : `0 0 8px ${getStateColor(snap.state)}`,
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
          <div style={{ fontSize: 15, fontWeight: 700, color: engineMode === 'reforced' ? '#00f0ff' : '#a78bfa', fontFamily: 'monospace' }}>
            {snap.ema100.toFixed(priceDecimals)}
          </div>
        </div>
      </div>

      {/* EMA50 Section (Reforced only) */}
      {engineMode === 'reforced' && typeof snap.ema50 === 'number' && (
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
          background: 'rgba(189, 0, 255, 0.03)', border: '1px solid rgba(189, 0, 255, 0.15)',
          padding: 12, borderRadius: 10, marginTop: -8
        }}>
          <div>
            <div style={{ fontSize: 10, color: '#a78bfa', textTransform: 'uppercase', marginBottom: 2 }}>Media EMA50</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#bd00ff', fontFamily: 'monospace', textShadow: '0 0 5px rgba(189,0,255,0.3)' }}>
              {snap.ema50.toFixed(priceDecimals)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: '#a78bfa', textTransform: 'uppercase', marginBottom: 2 }}>Elast. EMA50</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', fontFamily: 'monospace' }}>
              {snap.elasticity50 ? snap.elasticity50.toFixed(3) : '—'} ATR
            </div>
          </div>
        </div>
      )}

      {/* Oscillator Section (Reforced only) */}
      {engineMode === 'reforced' && (typeof snap.stochK === 'number' || typeof snap.cci === 'number') && (
        <div style={{
          background: 'rgba(0, 255, 102, 0.02)',
          border: '1px dashed rgba(0, 255, 102, 0.2)',
          borderRadius: 12,
          padding: 14,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          fontFamily: '"Share Tech Mono", monospace',
        }}>
          <span style={{ fontSize: 10, fontWeight: 900, color: '#00ff66', display: 'flex', alignItems: 'center', gap: 4 }}>
            👽 OSCILADORES ALIENÍGENAS (MOMENTUM)
          </span>

          {/* Stochastic Gauge */}
          {typeof snap.stochK === 'number' && typeof snap.stochD === 'number' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                <span style={{ color: '#9ca3af' }}>Stochastic (13,3,3)</span>
                <span style={{ color: '#fff' }}>
                  %K: <strong style={{ color: '#00ff66' }}>{snap.stochK.toFixed(1)}</strong> · %D: <strong style={{ color: '#bd00ff' }}>{snap.stochD.toFixed(1)}</strong>
                </span>
              </div>
              {/* Double Bar */}
              <div style={{ width: '100%', height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.05)', position: 'relative', overflow: 'hidden' }}>
                {/* Zone limits (30% to 70%) */}
                <div style={{ position: 'absolute', left: '30%', right: '30%', height: '100%', background: 'rgba(255,255,255,0.05)', borderLeft: '1px solid rgba(255,255,255,0.15)', borderRight: '1px solid rgba(255,255,255,0.15)' }} />
                {/* %K pointer */}
                <div style={{
                  position: 'absolute',
                  left: 0,
                  width: `${Math.min(100, snap.stochK)}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, transparent, #00ff66)',
                  borderRadius: 3,
                  opacity: 0.8
                }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#4b5563', marginTop: 2 }}>
                <span>SOBREVENTA (&lt;30)</span>
                <span>ZONA NEUTRA</span>
                <span>SOBRECOMPRA (&gt;70)</span>
              </div>
            </div>
          )}

          {/* CCI Gauge */}
          {typeof snap.cci === 'number' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                <span style={{ color: '#9ca3af' }}>CCI (14)</span>
                <span style={{ color: snap.cci > 100 || snap.cci < -100 ? '#00f0ff' : '#fff', fontWeight: 'bold' }}>
                  {snap.cci.toFixed(1)} {snap.cci > 100 ? '📈 (EXTREMO COMPRA)' : snap.cci < -100 ? '📉 (EXTREMO VENTA)' : '⚖️'}
                </span>
              </div>
              {/* CCI Scale (-200 to +200) */}
              <div style={{ width: '100%', height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.05)', position: 'relative', overflow: 'hidden' }}>
                {/* Center marker */}
                <div style={{ position: 'absolute', left: '50%', width: 2, height: '100%', background: 'rgba(255,255,255,0.2)' }} />
                {/* Extremes (<-100 and >100) */}
                <div style={{ position: 'absolute', left: '25%', right: '25%', height: '100%', borderLeft: '1px dashed rgba(255,255,255,0.15)', borderRight: '1px dashed rgba(255,255,255,0.15)' }} />
                {/* CCI value indicator */}
                <div style={{
                  position: 'absolute',
                  left: `${Math.max(0, Math.min(100, ((snap.cci + 200) / 400) * 100))}%`,
                  width: 6,
                  marginLeft: -3,
                  height: 6,
                  borderRadius: '50%',
                  background: '#00f0ff',
                  boxShadow: '0 0 6px #00f0ff'
                }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#4b5563', marginTop: 2 }}>
                <span>-200</span>
                <span>0 (Eje)</span>
                <span>+200</span>
              </div>
            </div>
          )}
        </div>
      )}

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
        <span style={{ fontSize: 12, color: '#9ca3af' }}>Filtro de Tendencia:</span>
        <span style={{
          fontSize: 12, fontWeight: 800,
          color: snap.signalAllowed ? '#10b981' : '#ef4444'
        }}>
          {snap.signalAllowed ? '✅ ADECUADA (SIN TENDENCIA)' : '🚫 TENDENCIA FUERTE (FILTRADO)'}
        </span>
      </div>
    </div>
  )
}
