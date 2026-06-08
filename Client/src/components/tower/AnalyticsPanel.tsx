/**
 * AnalyticsPanel.tsx
 * Panel de métricas y estadísticas de trading avanzadas.
 */
import type { Analytics, GroupStat, SetupStat } from '../../hooks/useTrades'

interface Props {
  analytics: Analytics | null
  analyticsMode: string
  analyticsMinTrades: number
  fetchAnalytics: (tradeMode?: string, minTrades?: number) => Promise<void>
}

export function AnalyticsPanel({ analytics, analyticsMode, analyticsMinTrades, fetchAnalytics }: Props) {
  if (!analytics) {
    return (
      <div style={{
        padding: '40px 20px', textAlign: 'center',
        border: '1px solid rgba(255,255,255,0.05)', borderRadius: 14,
        color: '#4b5563', fontSize: 13,
      }}>
        📊 Los analytics aparecerán aquí cuando cierres tu primera operación.
      </div>
    )
  }

  const {
    summary, bySession, bySymbol, byStructure, byTradeType, losingPattern,
    bestSetup, worstSetup, mediumSetup, setupCombinations, durationBrackets,
    byPedestrianLight
  } = analytics

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, fontFamily: '"Inter", system-ui, sans-serif' }}>

      {/* Selector de Modo de Operación */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.05)',
        padding: '6px 12px',
        borderRadius: 12,
        marginBottom: 4,
        flexWrap: 'wrap',
        gap: 8,
      }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          🎯 Filtrar Métricas
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          {([['all', '💼 Todos'], ['normal', '🟢 Normal'], ['experimental', '🧪 Experimental']] as const).map(([m, label]) => (
            <button
              key={m}
              onClick={() => fetchAnalytics(m, undefined)}
              style={{
                padding: '6px 14px',
                borderRadius: 8,
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: analyticsMode === m ? 700 : 500,
                background: analyticsMode === m ? 'linear-gradient(135deg, #7c3aed, #a78bfa)' : 'transparent',
                color: analyticsMode === m ? '#fff' : '#6b7280',
                border: 'none',
                boxShadow: analyticsMode === m ? '0 4px 12px rgba(124,58,237,0.2)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Selector de Umbral Mínimo de Trades */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.05)',
        padding: '6px 12px',
        borderRadius: 12,
        marginBottom: 4,
        flexWrap: 'wrap',
        gap: 8,
      }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          🔬 Confianza Estadística
        </span>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <span style={{ fontSize: 10, color: '#6b7280', marginRight: 4 }}>Mín. trades:</span>
          {[3, 5, 10, 15, 20].map(n => (
            <button
              key={n}
              onClick={() => fetchAnalytics(undefined, n)}
              style={{
                padding: '4px 10px',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: analyticsMinTrades === n ? 700 : 500,
                background: analyticsMinTrades === n ? 'linear-gradient(135deg, #f59e0b, #fbbf24)' : 'transparent',
                color: analyticsMinTrades === n ? '#000' : '#6b7280',
                border: 'none',
                boxShadow: analyticsMinTrades === n ? '0 4px 12px rgba(245,158,11,0.2)' : 'none',
                transition: 'all 0.15s ease',
                fontFamily: 'monospace',
              }}
            >
              ≥{n}
            </button>
          ))}
        </div>
      </div>

      {/* Alerta de patrón perdedor */}
      {losingPattern.active && (
        <div style={{
          padding: '14px 18px', borderRadius: 12,
          background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)',
          color: '#f43f5e', fontSize: 13, fontWeight: 600,
        }}>
          {losingPattern.message}
        </div>
      )}

      {/* 🏆 Sección de Setups Clave */}
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>🏆</span> Rendimiento de Setups Específicos
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
          <SetupCard title="Mejor Setup" setup={bestSetup} color="#10b981" icon="🏆" minTrades={analyticsMinTrades} />
          <SetupCard title="Setup Medio" setup={mediumSetup} color="#a78bfa" icon="⚖️" minTrades={analyticsMinTrades} />
          <SetupCard title="Peor Setup" setup={worstSetup} color="#f43f5e" icon="⚠️" minTrades={analyticsMinTrades} />
        </div>
      </div>

      {/* KPIs principales */}
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>📊</span> Resumen General de Rendimiento
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12 }}>
          <KPI label="Win Rate"      value={`${summary.winRate}%`}
            color={summary.winRate >= 50 ? '#10b981' : '#f43f5e'} />
          <KPI label="P&L Total"     value={`${summary.totalPnl >= 0 ? '+' : ''}$${summary.totalPnl}`}
            color={summary.totalPnl >= 0 ? '#10b981' : '#f43f5e'} />
          <KPI label="Operaciones"   value={`${summary.totalTrades}`} />
          <KPI label="Ganadas"       value={`${summary.wins}`} color="#10b981" />
          <KPI label="Perdidas"      value={`${summary.losses}`} color="#f43f5e" />
          <KPI label="Breakeven"     value={`${summary.breakeven}`} color="#9ca3af" />
          <KPI label="Abiertas"      value={`${summary.open}`} color="#f59e0b" />
          <KPI label="MAE promedio"  value={summary.avgMAE != null ? `$${summary.avgMAE}` : '—'} color="#f43f5e" />
          <KPI label="MFE promedio"  value={summary.avgMFE != null ? `$${summary.avgMFE}` : '—'} color="#10b981" />
          <KPI label="Duración prom" value={summary.avgDuration != null ? `${summary.avgDuration}m` : '—'} />
        </div>
      </div>

      {/* 🚦 Confluencia Semáforo Peatón (Solo Experimental) */}
      {(analyticsMode === 'all' || analyticsMode === 'experimental') && byPedestrianLight && (byPedestrianLight.walk || byPedestrianLight.stop) && (
        <div style={{
          padding: '20px', borderRadius: 16,
          background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)',
          display: 'flex', flexDirection: 'column', gap: 12
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>🚦</span> Confluencia Semáforo Peatón (Modo Experimental)
          </div>
          <div style={{ fontSize: 11, color: '#6b7280', marginTop: -6 }}>
            Compara el rendimiento cuando todas las señales experimentales confluyen (WALK) frente a cuando no están alineadas (STOP).
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginTop: 4 }}>
            {/* Tarjeta de WALK */}
            <div style={{
              padding: 16, borderRadius: 12,
              background: 'rgba(16,185,129,0.03)', border: '1px solid rgba(16,185,129,0.15)',
              borderLeft: '4px solid #10b981', display: 'flex', flexDirection: 'column', gap: 8
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: '#10b981' }}>🚶 WALK (Caminar)</span>
                <span style={{ fontSize: 10, color: '#10b981', background: 'rgba(16,185,129,0.1)', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>Confluencia Total</span>
              </div>
              {byPedestrianLight.walk ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 4 }}>
                  <div>
                    <div style={{ fontSize: 10, color: '#6b7280' }}>Trades</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{byPedestrianLight.walk.total}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: '#6b7280' }}>Win Rate</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#10b981' }}>{byPedestrianLight.walk.winRate}%</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: '#6b7280' }}>P&L Total</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: byPedestrianLight.walk.pnl >= 0 ? '#10b981' : '#f43f5e' }}>
                      ${byPedestrianLight.walk.pnl.toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: '#6b7280' }}>Expectancy</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: byPedestrianLight.walk.expectancy >= 0 ? '#10b981' : '#f43f5e' }}>
                      ${byPedestrianLight.walk.expectancy.toFixed(2)}/op
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: 11, color: '#4b5563', padding: '10px 0' }}>Sin operaciones en WALK</div>
              )}
            </div>

            {/* Tarjeta de STOP */}
            <div style={{
              padding: 16, borderRadius: 12,
              background: 'rgba(244,63,94,0.03)', border: '1px solid rgba(244,63,94,0.15)',
              borderLeft: '4px solid #f43f5e', display: 'flex', flexDirection: 'column', gap: 8
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: '#f43f5e' }}>🛑 STOP (Parar)</span>
                <span style={{ fontSize: 10, color: '#f43f5e', background: 'rgba(244,63,94,0.1)', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>Sin Confluencia</span>
              </div>
              {byPedestrianLight.stop ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 4 }}>
                  <div>
                    <div style={{ fontSize: 10, color: '#6b7280' }}>Trades</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{byPedestrianLight.stop.total}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: '#6b7280' }}>Win Rate</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: byPedestrianLight.stop.winRate >= 50 ? '#10b981' : '#f43f5e' }}>{byPedestrianLight.stop.winRate}%</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: '#6b7280' }}>P&L Total</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: byPedestrianLight.stop.pnl >= 0 ? '#10b981' : '#f43f5e' }}>
                      ${byPedestrianLight.stop.pnl.toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: '#6b7280' }}>Expectancy</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: byPedestrianLight.stop.expectancy >= 0 ? '#10b981' : '#f43f5e' }}>
                      ${byPedestrianLight.stop.expectancy.toFixed(2)}/op
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: 11, color: '#4b5563', padding: '10px 0' }}>Sin operaciones en STOP</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ⏱️ Duración y Combinaciones */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: 16 }}>
        
        {/* Tabla de Combinaciones de Setups */}
        <div style={{
          background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
          borderRadius: 12, padding: '16px',
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>⚡</span> Desglose y Edge de Combinaciones Completas
          </div>
          {setupCombinations.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: '#4b5563', fontSize: 11 }}>Sin combinaciones registradas aún.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', color: '#6b7280', fontSize: 9 }}>
                    <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 700, textTransform: 'uppercase' }}>Modo</th>
                    <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 700, textTransform: 'uppercase' }}>Tipo</th>
                    <th style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 700, textTransform: 'uppercase' }}>Tipo C</th>
                    <th style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 700, textTransform: 'uppercase' }}>🚶 Semáforo</th>
                    <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 700, textTransform: 'uppercase' }}>Estructura</th>
                    <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 700, textTransform: 'uppercase' }}>Sesión</th>
                    <th style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 700, textTransform: 'uppercase' }}>Trades</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, textTransform: 'uppercase' }}>WR%</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, textTransform: 'uppercase' }}>P&L Total</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, textTransform: 'uppercase', color: '#a78bfa' }}>Expectancy</th>
                  </tr>
                </thead>
                <tbody>
                  {setupCombinations.map((c, i) => {
                    const hasSufficientTrades = c.total >= analyticsMinTrades
                    return (
                      <tr key={i} style={{
                        borderBottom: '1px solid rgba(255,255,255,0.03)',
                        opacity: hasSufficientTrades ? 1 : 0.65,
                        background: hasSufficientTrades ? 'transparent' : 'rgba(255,255,255,0.005)',
                      }}>
                        <td style={{ padding: '8px' }}>
                          <span style={{
                            fontSize: 9, padding: '2px 4px', borderRadius: 3, fontWeight: 700,
                            background: c.dashboard === 'EXP' ? 'rgba(167,139,250,0.15)' : 'rgba(16,185,129,0.15)',
                            color: c.dashboard === 'EXP' ? '#a78bfa' : '#10b981',
                          }}>
                            {c.dashboard}
                          </span>
                        </td>
                        <td style={{ padding: '8px', color: '#fff', fontWeight: 700 }}>{c.type}</td>
                        <td style={{ padding: '8px', textAlign: 'center' }}>
                          <span style={{
                            fontSize: 9, padding: '1px 4px', borderRadius: 3,
                            background: c.hasTypeC === 'Sí' ? 'rgba(16,185,129,0.1)' : 'rgba(244,63,94,0.1)',
                            color: c.hasTypeC === 'Sí' ? '#10b981' : '#f43f5e',
                            fontWeight: 700,
                          }}>
                            {c.hasTypeC}
                          </span>
                        </td>
                        <td style={{ padding: '8px', textAlign: 'center' }}>
                          {c.walkState && c.walkState !== '—' ? (
                            <span style={{
                              fontSize: 9, padding: '1px 4px', borderRadius: 3,
                              background: c.walkState === 'WALK' ? 'rgba(16,185,129,0.1)' : 'rgba(244,63,94,0.1)',
                              color: c.walkState === 'WALK' ? '#10b981' : '#f43f5e',
                              fontWeight: 700,
                            }}>
                              {c.walkState}
                            </span>
                          ) : (
                            <span style={{ color: '#4b5563' }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: '8px' }}>
                          <span style={{
                            fontSize: 9, padding: '2px 5px', borderRadius: 4,
                            background: 'rgba(255,255,255,0.04)',
                            color: c.structureState === 'STRONG' ? '#10b981' : c.structureState === 'MODERATE' ? '#f59e0b' : '#f43f5e',
                            fontWeight: 700,
                          }}>
                            {c.structureState}
                          </span>
                        </td>
                        <td style={{ padding: '8px', textTransform: 'capitalize', color: '#9ca3af' }}>
                          {c.session === 'american' ? '🗽 American' : c.session === 'asian' ? '🌏 Asian' : c.session === 'european' ? '🇪🇺 European' : '🌊 Pacific'}
                        </td>
                        <td style={{ padding: '8px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                            <span style={{ fontWeight: 700, color: hasSufficientTrades ? '#fff' : '#6b7280' }}>
                              {c.total}
                            </span>
                            {!hasSufficientTrades && (
                              <span style={{ fontSize: 10 }} title={`Muestra insuficiente (requiere >= ${analyticsMinTrades} trades para ranking)`}>
                                ⚠️
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700, color: c.winRate >= 50 ? '#10b981' : '#f43f5e' }}>
                          {c.winRate}%
                        </td>
                        <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700, color: c.pnl >= 0 ? '#10b981' : '#f43f5e', fontFamily: 'monospace' }}>
                          {c.pnl >= 0 ? '+' : ''}${c.pnl.toFixed(2)}
                        </td>
                        <td style={{
                          padding: '8px', textAlign: 'right', fontWeight: 900,
                          color: c.expectancy >= 0 ? '#10b981' : '#f43f5e',
                          fontFamily: 'monospace',
                          background: 'rgba(255,255,255,0.01)',
                        }}>
                          {c.expectancy >= 0 ? '+' : ''}${c.expectancy.toFixed(2)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Sección de Duración de Operaciones */}
        <div style={{
          background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
          borderRadius: 12, padding: '16px',
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>⏱️</span> Rendimiento por Duración de Operación
          </div>
          {durationBrackets.filter(b => b.total > 0).length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: '#4b5563', fontSize: 11 }}>Sin estadísticas de duración disponibles.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {durationBrackets.map((b, i) => {
                if (b.total === 0) return null
                return (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#d1d5db' }}>{b.name}</span>
                      <span style={{ fontSize: 10, color: '#6b7280' }}>{b.total} ops</span>
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      {/* Barra de Win Rate */}
                      <div style={{ flex: 1, height: 8, background: 'rgba(255,255,255,0.04)', borderRadius: 4, overflow: 'hidden', display: 'flex' }}>
                        <div style={{
                          width: `${b.winRate}%`, height: '100%',
                          background: b.winRate >= 50 ? 'linear-gradient(90deg, #10b981, #34d399)' : 'linear-gradient(90deg, #f43f5e, #fb7185)',
                          borderRadius: 4,
                          transition: 'width 0.4s ease',
                        }} />
                      </div>
                      
                      <span style={{ fontSize: 11, fontWeight: 700, color: b.winRate >= 50 ? '#10b981' : '#f43f5e', minWidth: 32, textAlign: 'right', fontFamily: 'monospace' }}>
                        {b.winRate}%
                      </span>
                      
                      <span style={{ fontSize: 11, color: b.pnl >= 0 ? '#10b981' : '#f43f5e', fontWeight: 700, minWidth: 65, textAlign: 'right', fontFamily: 'monospace' }}>
                        {b.pnl >= 0 ? '+' : ''}${b.pnl.toFixed(2)}
                      </span>
                      
                      <span style={{ fontSize: 9, color: '#4b5563', minWidth: 60, textAlign: 'right' }}>
                        avg: {b.avgPnl >= 0 ? '+' : ''}${b.avgPnl.toFixed(2)}
                      </span>
                    </div>
                  </div>
                )
              })}

              <div style={{
                marginTop: 8, padding: '10px 12px', borderRadius: 8,
                background: 'rgba(124,58,237,0.04)', border: '1px solid rgba(124,58,237,0.1)',
                fontSize: 11, color: '#a78bfa', lineHeight: 1.5,
              }}>
                💡 **Insight de Duración**:
                {(() => {
                  const sorted = [...durationBrackets].filter(b => b.total > 0).sort((a, b) => b.avgPnl - a.avgPnl)
                  if (sorted.length > 0) {
                    return ` Las operaciones en el rango de ${sorted[0].name.toLowerCase()} obtienen el mayor retorno promedio por operación ($${sorted[0].avgPnl}).`
                  }
                  return ' Registra más operaciones cerradas para obtener insights sobre el tiempo óptimo de permanencia en el mercado.'
                })()}
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Grids de stats por grupo */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>

        <StatGroup title="📅 Por Sesión" rows={bySession} />
        <StatGroup title="💱 Por Par" rows={bySymbol} />
        <StatGroup title="🏛️ Por Structure State" rows={byStructure} />
        <StatGroup title="⚡ Por Tipo" rows={byTradeType} />

      </div>

      {/* MAE vs MFE insight */}
      {summary.avgMAE != null && summary.avgMFE != null && (
        <div style={{
          padding: '14px 18px', borderRadius: 12,
          background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 8, textTransform: 'uppercase', fontWeight: 700 }}>
            🔬 Análisis de Riesgo Real
          </div>
          <div style={{ fontSize: 13, color: '#d1d5db', lineHeight: 1.6 }}>
            Tu MAE promedio es <span style={{ color: '#f43f5e', fontWeight: 700 }}>${summary.avgMAE}</span> y
            tu MFE promedio es <span style={{ color: '#10b981', fontWeight: 700 }}>${summary.avgMFE}</span>.
            {summary.avgMAE > summary.avgMFE
              ? ' ⚠️ Estás asumiendo más riesgo del que estás capturando en ganancias. Considera entrar más tarde o salir antes del MAE máximo.'
              : ' ✅ Tu ratio MFE/MAE es positivo — capturas más de lo que arriesgas en promedio.'
            }
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Sub-componentes ─────────────────────────────────────────────────────────

function SetupCard({
  title,
  setup,
  color,
  icon,
  minTrades,
}: {
  title: string
  setup: SetupStat | null
  color: string
  icon: string
  minTrades: number
}) {
  if (!setup) {
    return (
      <div style={{
        padding: '20px',
        borderRadius: '16px',
        background: 'rgba(255, 255, 255, 0.01)',
        border: '1px solid rgba(255, 255, 255, 0.03)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '210px',
        color: '#4b5563',
        fontSize: '12px',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: '22px', marginBottom: '6px' }}>{icon}</div>
        <div style={{ fontWeight: 700, color: '#9ca3af', marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: '11px', color: '#6b7280' }}>Muestra insuficiente</div>
        <div style={{ fontSize: '9px', color: '#4b5563', marginTop: 4 }}>Se requiere mín. {minTrades} trades por combinación</div>
      </div>
    )
  }

  const expColor = setup.expectancy >= 0 ? '#10b981' : '#f43f5e'
  const pnlColor = setup.pnl >= 0 ? '#10b981' : '#f43f5e'

  return (
    <div
      style={{
        padding: '20px',
        borderRadius: '16px',
        background: 'rgba(255, 255, 255, 0.02)',
        border: '1px solid rgba(255, 255, 255, 0.05)',
        borderTop: `3px solid ${color}`,
        boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        minHeight: '210px',
        position: 'relative',
        transition: 'transform 0.2s, box-shadow 0.2s',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '10px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          {title}
        </span>
        <span style={{ fontSize: '16px' }}>{icon}</span>
      </div>

      {/* Combinación de Señales Completa */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', margin: '4px 0' }}>
        <span style={{
          fontSize: '9px', padding: '2px 6px', borderRadius: '4px', fontWeight: 800,
          background: setup.dashboard === 'EXP' ? 'rgba(167,139,250,0.15)' : 'rgba(16,185,129,0.15)',
          color: setup.dashboard === 'EXP' ? '#a78bfa' : '#10b981',
          border: setup.dashboard === 'EXP' ? '1px solid rgba(167,139,250,0.3)' : '1px solid rgba(16,185,129,0.3)',
        }}>
          {setup.dashboard}
        </span>
        
        <span style={{
          fontSize: '9px', padding: '2px 6px', borderRadius: '4px', fontWeight: 700,
          background: 'rgba(255,255,255,0.06)', color: '#fff',
        }}>
          {setup.type}
        </span>

        <span style={{
          fontSize: '9px', padding: '2px 6px', borderRadius: '4px', fontWeight: 700,
          background: setup.hasTypeC === 'Sí' ? 'rgba(16,185,129,0.1)' : 'rgba(244,63,94,0.1)',
          color: setup.hasTypeC === 'Sí' ? '#10b981' : '#f43f5e',
        }}>
          C: {setup.hasTypeC}
        </span>

        {setup.walkState && setup.walkState !== '—' && (
          <span style={{
            fontSize: '9px', padding: '2px 6px', borderRadius: '4px', fontWeight: 700,
            background: setup.walkState === 'WALK' ? 'rgba(16,185,129,0.1)' : 'rgba(244,63,94,0.1)',
            color: setup.walkState === 'WALK' ? '#10b981' : '#f43f5e',
          }}>
            🚦 {setup.walkState}
          </span>
        )}

        <span style={{
          fontSize: '9px', padding: '2px 6px', borderRadius: '4px', fontWeight: 700,
          background: 'rgba(255,255,255,0.04)',
          color: setup.structureState === 'STRONG' ? '#10b981' : setup.structureState === 'MODERATE' ? '#f59e0b' : '#f43f5e',
        }}>
          🏛️ {setup.structureState}
        </span>

        <span style={{
          fontSize: '9px', padding: '2px 6px', borderRadius: '4px',
          background: 'rgba(255,255,255,0.04)', color: '#9ca3af',
          textTransform: 'capitalize',
        }}>
          {setup.session === 'american' ? '🗽 Amer.' : setup.session === 'asian' ? '🌏 Asian' : setup.session === 'european' ? '🇪🇺 Europ.' : '🌊 Pacif.'}
        </span>
      </div>

      {/* Expectancy Destacada */}
      <div style={{
        margin: '6px 0',
        padding: '10px',
        borderRadius: '10px',
        background: 'rgba(255,255,255,0.015)',
        border: '1px solid rgba(255,255,255,0.03)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <span style={{ fontSize: '9px', color: '#6b7280', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.3px', marginBottom: 2 }}>
          Expectancy (P&L Promedio)
        </span>
        <span style={{ fontSize: '20px', fontWeight: 950, color: expColor, fontFamily: 'monospace' }}>
          {setup.expectancy >= 0 ? '+' : ''}${setup.expectancy.toFixed(2)}
        </span>
      </div>

      {/* Métricas Secundarias */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: '8px',
        paddingTop: '8px',
        borderTop: '1px solid rgba(255,255,255,0.04)',
        textAlign: 'center',
      }}>
        <div>
          <div style={{ fontSize: '8px', color: '#6b7280', textTransform: 'uppercase' }}>Trades</div>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#fff', fontFamily: 'monospace' }}>
            {setup.total}
          </div>
        </div>
        <div>
          <div style={{ fontSize: '8px', color: '#6b7280', textTransform: 'uppercase' }}>Win Rate</div>
          <div style={{ fontSize: '11px', fontWeight: 700, color: setup.winRate >= 50 ? '#10b981' : '#f43f5e', fontFamily: 'monospace' }}>
            {setup.winRate}%
          </div>
        </div>
        <div>
          <div style={{ fontSize: '8px', color: '#6b7280', textTransform: 'uppercase' }}>P&L Total</div>
          <div style={{ fontSize: '11px', fontWeight: 700, color: pnlColor, fontFamily: 'monospace' }}>
            {setup.pnl >= 0 ? '+' : ''}${setup.pnl.toFixed(1)}
          </div>
        </div>
      </div>
    </div>
  )
}

function KPI({ label, value, color = '#fff' }: { label: string; value: string; color?: string }) {
  return (
    <div style={{
      padding: '14px 16px', borderRadius: 12,
      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color, fontFamily: 'monospace' }}>{value}</div>
    </div>
  )
}

function StatGroup({ title, rows }: { title: string; rows: GroupStat[] }) {
  if (!rows.length) return null
  return (
    <div style={{
      background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
      borderRadius: 12, padding: '16px',
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 12 }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {rows.map(row => (
          <div key={row.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: '#9ca3af', minWidth: 90, textTransform: 'capitalize' }}>
              {row.name}
            </span>
            {/* Barra de win rate */}
            <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{
                width: `${row.winRate}%`, height: '100%', borderRadius: 3,
                background: row.winRate >= 50 ? '#10b981' : row.winRate >= 35 ? '#f59e0b' : '#f43f5e',
                transition: 'width 0.4s ease',
              }} />
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, minWidth: 36, textAlign: 'right',
              color: row.winRate >= 50 ? '#10b981' : '#f43f5e', fontFamily: 'monospace' }}>
              {row.winRate}%
            </span>
            <span style={{ fontSize: 10, color: '#4b5563', minWidth: 28 }}>{row.total}op</span>
            <span style={{ fontSize: 10, fontFamily: 'monospace', minWidth: 52, textAlign: 'right',
              color: row.pnl >= 0 ? '#10b981' : '#f43f5e' }}>
              {row.pnl >= 0 ? '+' : ''}${row.pnl}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
