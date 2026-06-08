/**
 * FomowatchPanel.tsx
 * 
 * Panel de seguimiento pasivo Fomowatch y Psicología del Trader.
 * Mide la efectividad del "Filtro Humano" (descartes correctos vs fallidos),
 * calcula el capital virtual salvado y simula en tiempo real las operaciones descartadas
 * contra los precios en vivo de TwelveData.
 */

import React from 'react'
import type { FomowatchData } from '../../hooks/useTrades'
import type { MultiSymbolMarketData } from '../../hooks/useMarketData'

interface Props {
  fomowatch: FomowatchData | null
  marketData: MultiSymbolMarketData | null
  fetchFomowatch: () => Promise<void>
}

function getProgressBarProgress(direction: 'BUY' | 'SELL', current: number, tp: number, sl: number) {
  if (direction === 'BUY') {
    const range = tp - sl;
    if (range <= 0) return 50;
    const pct = ((current - sl) / range) * 100;
    return Math.max(0, Math.min(100, pct));
  } else {
    const range = sl - tp;
    if (range <= 0) return 50;
    const pct = ((sl - current) / range) * 100;
    return Math.max(0, Math.min(100, pct));
  }
}

export function FomowatchPanel({ fomowatch, marketData, fetchFomowatch }: Props) {
  React.useEffect(() => {
    // Poll de refresco de estadísticas locales de Fomowatch
    const interval = setInterval(() => {
      fetchFomowatch();
    }, 15000);
    return () => clearInterval(interval);
  }, [fetchFomowatch]);

  if (!fomowatch) {
    return (
      <div style={{
        padding: '40px 20px', textAlign: 'center',
        border: '1px solid rgba(255,255,255,0.05)', borderRadius: 14,
        color: '#6b7280', fontSize: 13,
        background: 'rgba(13,13,20,0.2)',
        fontFamily: '"Inter", system-ui, sans-serif'
      }}>
        ⏱️ El panel Fomowatch se activará cuando comiences a registrar o descartar alertas desde Telegram.
      </div>
    )
  }

  const { summary, active, history } = fomowatch;
  const { totalDiscarded, winRate, rejectionAccuracy, capitalSaved, avgDuration, expectancy } = summary;

  // Rejection Accuracy color code
  const getAccuracyColor = (pct: number) => {
    if (pct >= 75) return '#10b981'; // Emerald
    if (pct >= 50) return '#6366f1'; // Indigo
    if (pct >= 30) return '#f59e0b'; // Amber
    return '#ef4444'; // Red
  };

  const ringColor = getAccuracyColor(rejectionAccuracy);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, fontFamily: '"Inter", system-ui, sans-serif' }}>
      
      {/* ─── HEADER Y KPI GENERALES (HAMSTER KOMBAT STYLE) ─────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: 20
      }}>
        
        {/* TARJETA 1: Anillo Filtro Humano */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(20,20,35,0.7) 0%, rgba(13,13,20,0.9) 100%)',
          border: '1px solid rgba(255,255,255,0.05)',
          borderRadius: 16,
          padding: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: 20,
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          backdropFilter: 'blur(10px)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Luz de fondo sutil */}
          <div style={{
            position: 'absolute', top: '-20%', right: '-20%', width: '100px', height: '100px',
            background: ringColor, opacity: 0.15, filter: 'blur(40px)', borderRadius: '50%'
          }} />

          <div style={{ position: 'relative', width: 90, height: 90, flexShrink: 0 }}>
            <svg width="90" height="90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="6" />
              <circle cx="50" cy="50" r="42" fill="none" stroke={ringColor} strokeWidth="6"
                strokeDasharray="263.89" strokeDashoffset={263.89 - (263.89 * rejectionAccuracy) / 100}
                strokeLinecap="round" transform="rotate(-90 50 50)" style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
            </svg>
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center'
            }}>
              <span style={{ fontSize: 18, fontWeight: 900, color: '#fff' }}>{rejectionAccuracy}%</span>
              <span style={{ fontSize: 8, color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>Filtro</span>
            </div>
          </div>

          <div>
            <h4 style={{ margin: 0, fontSize: 14, color: '#fff', fontWeight: 800 }}>Efectividad de Filtro</h4>
            <p style={{ margin: '4px 0 0', fontSize: 11, color: '#9ca3af', lineHeight: '1.4' }}>
              Porcentaje de alertas descartadas que efectivamente resultaron en **Pérdida** o **Timeout**, evitando pérdidas reales.
            </p>
          </div>
        </div>

        {/* TARJETA 2: Capital Evitado de Perder */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(20,20,35,0.7) 0%, rgba(13,13,20,0.9) 100%)',
          border: '1px solid rgba(16,185,129,0.15)',
          borderRadius: 16,
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          boxShadow: '0 8px 32px rgba(16,185,129,0.05)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{
            position: 'absolute', top: '-30%', left: '-10%', width: '150px', height: '150px',
            background: '#10b981', opacity: 0.08, filter: 'blur(50px)', borderRadius: '50%'
          }} />

          <span style={{ fontSize: 10, fontWeight: 700, color: '#10b981', textTransform: 'uppercase', letterSpacing: '1px' }}>
            🛡️ Capital Virtual Salvado
          </span>
          <span style={{ fontSize: 32, fontWeight: 900, color: '#fff', marginTop: 6, textShadow: '0 0 20px rgba(16,185,129,0.4)' }}>
            ${capitalSaved.toFixed(2)}
          </span>
          <span style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
            Inversión virtual de $2.00 apalancada x200 por cada descarte.
          </span>
        </div>

        {/* TARJETA 3: Grid Pequeño de Métricas secundarias */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(20,20,35,0.7) 0%, rgba(13,13,20,0.9) 100%)',
          border: '1px solid rgba(255,255,255,0.05)',
          borderRadius: 16,
          padding: '16px 20px',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 12,
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
        }}>
          <div>
            <span style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>Total Descartados</span>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', marginTop: 2 }}>{totalDiscarded}</div>
          </div>
          <div>
            <span style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>Win Rate Omitido</span>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#f59e0b', marginTop: 2 }}>{winRate}%</div>
          </div>
          <div>
            <span style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>Duración Promedio</span>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#818cf8', marginTop: 2 }}>{avgDuration}m</div>
          </div>
          <div>
            <span style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>Esperanza Virtual</span>
            <div style={{ fontSize: 18, fontWeight: 800, color: expectancy >= 0 ? '#10b981' : '#ef4444', marginTop: 2 }}>
              {expectancy >= 0 ? `+$${expectancy.toFixed(2)}` : `-$${Math.abs(expectancy).toFixed(2)}`}
            </div>
          </div>
        </div>

      </div>

      {/* ─── SIMULACIÓN DE ALERTAS EN VIVO ─────────────────────────────────── */}
      <div style={{
        background: 'rgba(13,13,20,0.4)',
        border: '1px solid rgba(255,255,255,0.05)',
        borderRadius: 16,
        padding: '20px',
        boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.01)'
      }}>
        <h3 style={{
          margin: '0 0 16px 0', fontSize: 13, fontWeight: 800, color: '#818cf8',
          textTransform: 'uppercase', letterSpacing: '0.7px', display: 'flex', alignItems: 'center', gap: 6
        }}>
          📡 Simulador Fomowatch Activo ({active.length})
        </h3>

        {active.length === 0 ? (
          <div style={{
            padding: '30px 10px', textAlign: 'center', color: '#4b5563', fontSize: 11
          }}>
            No hay alertas en simulación en vivo en este momento. Las alertas que rechazas en Telegram aparecen flotando aquí.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {active.map(sig => {
              const livePrice = marketData?.[sig.symbol]?.m5?.price ?? sig.entryPrice;
              const pip = sig.direction === 'BUY' ? livePrice - sig.entryPrice : sig.entryPrice - livePrice;
              const pnl = (pip / sig.entryPrice) * 200 * 2.0; // leverage x200, investment $2.00
              const progress = getProgressBarProgress(sig.direction, livePrice, sig.tpPrice, sig.slPrice);
              const isProfit = pnl >= 0;

              return (
                <div key={sig.id} style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.03)',
                  borderRadius: 12,
                  padding: '14px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12
                }}>
                  {/* Fila superior: Detalles de la señal */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        fontSize: 10, fontWeight: 800, padding: '2px 6px', borderRadius: 4,
                        background: sig.direction === 'BUY' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                        color: sig.direction === 'BUY' ? '#10b981' : '#ef4444'
                      }}>
                        {sig.direction}
                      </span>
                      <strong style={{ fontSize: 14, color: '#fff' }}>{sig.symbol}</strong>
                      <span style={{ fontSize: 10, color: '#6b7280' }}>
                        Alerta #{sig.id} · {sig.tradeMode === 'experimental' ? '🧪' : '💼'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 10, color: '#6b7280' }}>Precio en vivo</div>
                        <strong style={{ fontSize: 13, color: '#e5e7eb' }}>{livePrice.toFixed(5)}</strong>
                      </div>
                      <div style={{
                        textAlign: 'right', minWidth: 70, padding: '4px 8px', borderRadius: 6,
                        background: isProfit ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                        border: `1px solid ${isProfit ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`
                      }}>
                        <div style={{ fontSize: 8, color: isProfit ? '#10b981' : '#ef4444', textTransform: 'uppercase', fontWeight: 700 }}>
                          P&L Virtual
                        </div>
                        <strong style={{ fontSize: 12, color: isProfit ? '#10b981' : '#ef4444' }}>
                          {isProfit ? '+' : ''}${pnl.toFixed(4)}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* Fila del medio: Barra de progreso TP/SL */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#9ca3af' }}>
                      <span>SL: {sig.slPrice.toFixed(5)}</span>
                      <span style={{ color: '#4b5563' }}>Entrada: {sig.entryPrice.toFixed(5)}</span>
                      <span>TP: {sig.tpPrice.toFixed(5)}</span>
                    </div>

                    {/* La barra contenedora */}
                    <div style={{
                      height: 6, background: '#1f2937', borderRadius: 3, position: 'relative', overflow: 'visible',
                      marginTop: 2
                    }}>
                      {/* Zona central de entrada como marcador sutil */}
                      <div style={{
                        position: 'absolute', left: '50%', top: -2, width: 2, height: 10, background: '#4b5563', zIndex: 1
                      }} />

                      {/* Progreso del precio */}
                      <div style={{
                        position: 'absolute', left: 0, width: `${progress}%`, height: '100%',
                        borderRadius: 3,
                        background: sig.direction === 'BUY'
                          ? 'linear-gradient(to right, #ef4444 0%, #4b5563 50%, #10b981 100%)'
                          : 'linear-gradient(to right, #ef4444 0%, #4b5563 50%, #10b981 100%)',
                        opacity: 0.7
                      }} />

                      {/* Pin indicador del precio actual */}
                      <div style={{
                        position: 'absolute', left: `${progress}%`, top: -3, width: 12, height: 12,
                        borderRadius: '50%', background: isProfit ? '#10b981' : '#ef4444',
                        boxShadow: `0 0 10px ${isProfit ? '#10b981' : '#ef4444'}`,
                        transform: 'translateX(-50%)',
                        transition: 'left 0.3s ease, background-color 0.3s ease'
                      }} />
                    </div>
                  </div>

                  {/* Fila inferior: Tiempos */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#6b7280' }}>
                    <span>Rechazado hace: {Math.round((Date.now() - new Date(sig.openedAt).getTime()) / 60000)} minutos</span>
                    <span>Sesión: <span style={{ textTransform: 'capitalize' }}>{sig.session}</span></span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── HISTORIAL DE SIMULACIONES COMPLETADAS ─────────────────────────── */}
      <div style={{
        background: 'rgba(13,13,20,0.4)',
        border: '1px solid rgba(255,255,255,0.05)',
        borderRadius: 16,
        padding: '20px',
        boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.01)'
      }}>
        <h3 style={{
          margin: '0 0 16px 0', fontSize: 13, fontWeight: 800, color: '#9ca3af',
          textTransform: 'uppercase', letterSpacing: '0.7px'
        }}>
          📜 Historial de Descartes (Últimos 10)
        </h3>

        {history.length === 0 ? (
          <div style={{
            padding: '20px 10px', textAlign: 'center', color: '#4b5563', fontSize: 11
          }}>
            No hay registros en el historial. Las simulaciones pasadas se guardarán aquí.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, minWidth: 600 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', textAlign: 'left', color: '#6b7280' }}>
                  <th style={{ padding: '8px 4px', fontWeight: 600 }}>SÍMBOLO</th>
                  <th style={{ padding: '8px 4px', fontWeight: 600 }}>DIRECCIÓN</th>
                  <th style={{ padding: '8px 4px', fontWeight: 600 }}>RESULTADO VIRTUAL</th>
                  <th style={{ padding: '8px 4px', fontWeight: 600 }}>PRECIO ENTRADA</th>
                  <th style={{ padding: '8px 4px', fontWeight: 600 }}>TP / SL</th>
                  <th style={{ padding: '8px 4px', fontWeight: 600 }}>MINUTOS</th>
                  <th style={{ padding: '8px 4px', fontWeight: 600 }}>P&L VIRTUAL</th>
                </tr>
              </thead>
              <tbody>
                {history.slice(0, 10).map((sig) => {
                  const isWin = sig.status === 'discarded_win';
                  const isLoss = sig.status === 'discarded_loss';

                  let statusText = 'TIMEOUT ⏱️';
                  let statusBg = 'rgba(255,255,255,0.03)';
                  let statusColor = '#9ca3af';
                  let pnlColor = '#9ca3af';

                  if (isWin) {
                    statusText = 'WIN (❌ Omitido)';
                    statusBg = 'rgba(245,158,11,0.08)'; // Amber
                    statusColor = '#f59e0b';
                    pnlColor = '#f59e0b';
                  } else if (isLoss) {
                    statusText = 'LOSS (✅ Evitado)';
                    statusBg = 'rgba(16,185,129,0.08)'; // Green
                    statusColor = '#10b981';
                    pnlColor = '#10b981';
                  }

                  return (
                    <tr key={sig.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', color: '#d1d5db' }}>
                      <td style={{ padding: '10px 4px', fontWeight: 700 }}>
                        {sig.symbol} <span style={{ fontSize: 9, color: '#4b5563' }}>#{sig.id}</span>
                      </td>
                      <td style={{ padding: '10px 4px' }}>
                        <span style={{
                          fontSize: 9, fontWeight: 700, padding: '1px 4px', borderRadius: 3,
                          background: sig.direction === 'BUY' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                          color: sig.direction === 'BUY' ? '#10b981' : '#ef4444'
                        }}>
                          {sig.direction}
                        </span>
                      </td>
                      <td style={{ padding: '10px 4px' }}>
                        <span style={{
                          padding: '2px 6px', borderRadius: 4, fontSize: 9, fontWeight: 700,
                          background: statusBg, color: statusColor, border: `1px solid rgba(${isWin ? '245,158,11' : isLoss ? '16,185,129' : '156,163,175'}, 0.15)`
                        }}>
                          {statusText}
                        </span>
                      </td>
                      <td style={{ padding: '10px 4px', fontFamily: 'monospace' }}>{sig.entryPrice.toFixed(5)}</td>
                      <td style={{ padding: '10px 4px', color: '#6b7280', fontFamily: 'monospace' }}>
                        {sig.tpPrice.toFixed(5)} / {sig.slPrice.toFixed(5)}
                      </td>
                      <td style={{ padding: '10px 4px' }}>{sig.totalMinutesOpen} min</td>
                      <td style={{ padding: '10px 4px', fontWeight: 700, color: pnlColor }}>
                        {Number(sig.pnl || 0) >= 0 ? '+' : ''}${Number(sig.pnl || 0).toFixed(4)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  )
}
