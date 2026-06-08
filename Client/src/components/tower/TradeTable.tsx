/**
 * TradeTable.tsx
 * Tabla de historial de operaciones con filtros y acciones.
 */
import { useState, useEffect } from 'react'
import type { Trade, CloseTradePayload } from '../../hooks/useTrades'
import { CloseTradeModal } from './CloseTradeModal'
import { EditTradeModal, parseScreenshotUrls } from './EditTradeModal'


interface Props {
  trades: Trade[]
  onClose: (id: number, payload: CloseTradePayload) => Promise<void>
  onUpdate: (id: number, payload: Partial<Trade>) => Promise<void>
  onDelete: (id: number) => Promise<void>
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return '—'
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}


const SESSION_LABELS: Record<string, string> = {
  asian: '🌏 Asiática', european: '🇪🇺 Europea',
  american: '🗽 Americana', pacific: '🌊 Pacífico',
}
const OUTCOME_CFG: Record<string, { color: string; label: string }> = {
  win: { color: '#10b981', label: '✓ WIN' },
  loss: { color: '#f43f5e', label: '✗ LOSS' },
  breakeven: { color: '#9ca3af', label: '= BREAK' },
  open: { color: '#f59e0b', label: '⏳ ABIERTA' },
}

export function TradeTable({ trades, onClose, onUpdate, onDelete }: Props) {
  const [filterSymbol, setFilterSymbol] = useState('all')
  const [filterOutcome, setFilterOutcome] = useState('all')
  const [filterSession, setFilterSession] = useState('all')
  const [closingTrade, setClosingTrade] = useState<Trade | null>(null)
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null)
  const [lightboxUrls, setLightboxUrls] = useState<string[]>([])
  const [lightboxIndex, setLightboxIndex] = useState<number>(0)

  // Navegación por teclado para la galería de imágenes del histórico
  useEffect(() => {
    if (lightboxUrls.length === 0) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxUrls([])
      else if (e.key === 'ArrowRight' && lightboxUrls.length > 1) {
        setLightboxIndex(prev => (prev + 1) % lightboxUrls.length)
      } else if (e.key === 'ArrowLeft' && lightboxUrls.length > 1) {
        setLightboxIndex(prev => (prev - 1 + lightboxUrls.length) % lightboxUrls.length)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [lightboxUrls])


  const symbols = ['all', ...Array.from(new Set(trades.map(t => t.symbol)))]
  const outcomes = ['all', 'open', 'win', 'loss', 'breakeven']
  const sessions = ['all', 'asian', 'european', 'american', 'pacific']

  const filtered = trades.filter(t => {
    if (filterSymbol !== 'all' && t.symbol !== filterSymbol) return false
    if (filterOutcome !== 'all' && t.outcome !== filterOutcome) return false
    if (filterSession !== 'all' && t.session !== filterSession) return false
    return true
  })

  const handleClose = async (id: number, payload: CloseTradePayload) => {
    await onClose(id, payload)
    setClosingTrade(null)
  }

  const handleEditSubmit = async (id: number, payload: Partial<Trade>) => {
    await onUpdate(id, payload)
    setEditingTrade(null)
  }


  return (
    <>
      {/* Filtros */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        <FilterSelect label="Par" value={filterSymbol} onChange={setFilterSymbol} options={symbols} />
        <FilterSelect label="Estado" value={filterOutcome} onChange={setFilterOutcome} options={outcomes} />
        <FilterSelect label="Sesión" value={filterSession} onChange={setFilterSession} options={sessions} />
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#6b7280', alignSelf: 'center' }}>
          {filtered.length} operaciones
        </span>
      </div>

      {/* Tabla */}
      <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
              {['#', 'Par', 'Fecha', 'Dir', 'Entrada', 'Salida', 'P&L', 'Lev', 'Sesión', 'M5', 'M15', 'Structure', 'Tipo C', '🚶 Semáforo', 'RSI', 'Tipo', 'Modo', 'Duración', 'Estado', 'Acc'].map(h => (
                <Th key={h}>{h}</Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={20} style={{ textAlign: 'center', padding: '32px 0', color: '#4b5563', fontSize: 12 }}>
                  Sin operaciones registradas
                </td>
              </tr>
            )}
            {filtered.map(t => {
              const outcfg = OUTCOME_CFG[t.outcome] ?? OUTCOME_CFG.open
              const isOpen = t.outcome === 'open'
              return (
                <tr key={t.id} style={{
                  borderTop: '1px solid rgba(255,255,255,0.04)',
                  background: isOpen ? 'rgba(245,158,11,0.04)' : 'transparent',
                  transition: 'background 0.15s',
                }}>
                  <Td>{t.id}</Td>
                  <Td bold>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {t.symbol}
                      {(() => {
                        const urls = parseScreenshotUrls(t.screenshotUrls)
                        return urls.length > 0 && (
                          <span
                            onClick={() => {
                              setLightboxUrls(urls)
                              setLightboxIndex(0)
                            }}
                            style={{ cursor: 'pointer', fontSize: 12, filter: 'drop-shadow(0 0 2px rgba(167,139,250,0.5))' }}
                            title={`Ver capturas (${urls.length})`}
                          >
                            📸
                          </span>
                        )
                      })()}
                    </div>
                  </Td>
                  <Td mono style={{ color: '#9ca3af', fontSize: 10 }}>{formatDate(t.openedAt)}</Td>
                  <Td>
                    <span style={{ color: t.direction === 'BUY' ? '#10b981' : '#f43f5e', fontWeight: 700 }}>
                      {t.direction === 'BUY' ? '↑' : '↓'} {t.direction}
                    </span>
                  </Td>
                  <Td mono>{t.entryPrice.toFixed(5)}</Td>
                  <Td mono>{t.exitPrice?.toFixed(5) ?? '—'}</Td>
                  <Td>
                    {t.pnl != null ? (
                      <span style={{ color: t.pnl >= 0 ? '#10b981' : '#f43f5e', fontWeight: 700 }}>
                        {t.pnl >= 0 ? '+' : ''}{t.pnl.toFixed(2)}
                      </span>
                    ) : '—'}
                  </Td>
                  <Td>x{t.leverage}</Td>
                  <Td>{SESSION_LABELS[t.session] ?? t.session}</Td>
                  <Td><StateBadge state={t.elasticityM5State} /></Td>
                  <Td><StateBadge state={t.elasticityM15State} /></Td>
                  <Td><StructBadge state={t.structureState} /></Td>
                  <Td>
                    {t.hasTypeC === true ? (
                      <span style={{ color: '#10b981', fontWeight: 700 }}>🪃 Sí</span>
                    ) : t.hasTypeC === false ? (
                      <span style={{ color: '#f43f5e', fontWeight: 700 }}>✗ No</span>
                    ) : (
                      <span style={{ color: '#4b5563' }}>—</span>
                    )}
                  </Td>
                  <Td>
                    {t.tradeMode === 'experimental' ? (
                      t.hasPedestrianLight === true ? (
                        <span style={{ color: '#10b981', fontWeight: 700 }}>🚶 WALK</span>
                      ) : t.hasPedestrianLight === false ? (
                        <span style={{ color: '#f43f5e', fontWeight: 700 }}>🛑 STOP</span>
                      ) : (
                        <span style={{ color: '#4b5563' }}>—</span>
                      )
                    ) : (
                      <span style={{ color: '#4b5563' }}>—</span>
                    )}
                  </Td>
                  <Td mono>{t.rsiAtEntry?.toFixed(1) ?? '—'}</Td>
                  <Td style={{ textTransform: 'capitalize' }}>{t.tradeType}</Td>
                  <Td>
                    {t.tradeMode === 'experimental' ? (
                      <span style={{ color: '#a78bfa', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span>🧪</span> <span style={{ fontSize: 10 }}>Exp</span>
                      </span>
                    ) : (
                      <span style={{ color: '#6b7280', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span>💼</span> <span style={{ fontSize: 10 }}>Normal</span>
                      </span>
                    )}
                  </Td>
                  <Td>{t.totalMinutesOpen != null ? `${t.totalMinutesOpen}m` : '—'}</Td>
                  <Td>
                    <span style={{ color: outcfg.color, fontWeight: 700, fontSize: 10 }}>{outcfg.label}</span>
                  </Td>
                  <Td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {isOpen && (
                        <ActionBtn color="#10b981" onClick={() => setClosingTrade(t)} title="Cerrar">🔒</ActionBtn>
                      )}
                      <ActionBtn color="#a78bfa" onClick={() => setEditingTrade(t)} title="Actualizar">✏️</ActionBtn>
                      <ActionBtn color="#f43f5e" onClick={() => onDelete(t.id)} title="Eliminar">🗑</ActionBtn>
                    </div>
                  </Td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {closingTrade && (
        <CloseTradeModal trade={closingTrade} onClose={() => setClosingTrade(null)} onSubmit={handleClose} />
      )}
      {editingTrade && (
        <EditTradeModal trade={editingTrade} onClose={() => setEditingTrade(null)} onSubmit={handleEditSubmit} />
      )}

      {/* Lightbox Modal con Slider */}
      {lightboxUrls.length > 0 && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 3000,
          background: 'rgba(0,0,0,0.95)', backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        }} onClick={() => setLightboxUrls([])}>
          <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh', display: 'flex', alignItems: 'center' }} onClick={e => e.stopPropagation()}>

            {/* Botón de Anterior */}
            {lightboxUrls.length > 1 && (
              <button
                onClick={() => setLightboxIndex(prev => (prev - 1 + lightboxUrls.length) % lightboxUrls.length)}
                style={{
                  position: 'absolute', left: -60, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                  color: '#fff', fontSize: 24, width: 44, height: 44, borderRadius: '50%', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', outline: 'none', transition: 'all 0.15s ease',
                  zIndex: 10,
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(124,58,237,0.3)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
              >
                ‹
              </button>
            )}

            {/* Contenedor de Imagen y Contador */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <img src={lightboxUrls[lightboxIndex]} alt="Screenshot Completa" style={{ maxWidth: '100%', maxHeight: '80vh', borderRadius: 10, boxShadow: '0 20px 50px rgba(0,0,0,0.8)' }} />
              {lightboxUrls.length > 1 && (
                <span style={{ color: '#9ca3af', fontSize: 12, background: 'rgba(255,255,255,0.06)', padding: '4px 10px', borderRadius: 20 }}>
                  {lightboxIndex + 1} / {lightboxUrls.length}
                </span>
              )}
            </div>

            {/* Botón de Siguiente */}
            {lightboxUrls.length > 1 && (
              <button
                onClick={() => setLightboxIndex(prev => (prev + 1) % lightboxUrls.length)}
                style={{
                  position: 'absolute', right: -60, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                  color: '#fff', fontSize: 24, width: 44, height: 44, borderRadius: '50%', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', outline: 'none', transition: 'all 0.15s ease',
                  zIndex: 10,
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(124,58,237,0.3)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
              >
                ›
              </button>
            )}

            {/* Botón de Cerrar */}
            <button
              onClick={() => setLightboxUrls([])}
              style={{
                position: 'absolute', top: -45, right: 0, background: 'none', border: 'none',
                color: '#fff', fontSize: 28, cursor: 'pointer', outline: 'none',
              }}
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th style={{
      padding: '8px 10px', textAlign: 'left', color: '#4b5563', fontWeight: 700,
      textTransform: 'uppercase', fontSize: 9, letterSpacing: '0.8px', whiteSpace: 'nowrap'
    }}>
      {children}
    </th>
  )
}

function Td({ children, bold, mono, style }: {
  children: React.ReactNode; bold?: boolean; mono?: boolean; style?: React.CSSProperties
}) {
  return (
    <td style={{
      padding: '7px 10px', color: '#d1d5db', fontWeight: bold ? 700 : 400,
      fontFamily: mono ? 'monospace' : 'inherit', whiteSpace: 'nowrap', ...style
    }}>
      {children}
    </td>
  )
}

function StateBadge({ state }: { state?: string }) {
  const cfg = state === 'GREEN' ? '#10b981' : state === 'YELLOW' ? '#f59e0b' : '#ef4444'
  if (!state) return <span style={{ color: '#4b5563' }}>—</span>
  return <span style={{ color: cfg, fontWeight: 800, fontSize: 10 }}>{state}</span>
}

function StructBadge({ state }: { state?: string }) {
  const cfg = state === 'STRONG' ? '#10b981' : state === 'MODERATE' ? '#f59e0b' : state === 'WEAK' ? '#f43f5e' : '#6b7280'
  if (!state) return <span style={{ color: '#4b5563' }}>—</span>
  return <span style={{ color: cfg, fontWeight: 700, fontSize: 10 }}>{state}</span>
}


function FilterSelect({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: string[]
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase' }}>{label}:</span>
      <select value={value} onChange={e => onChange(e.target.value)} style={{
        background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
        color: '#d1d5db', borderRadius: 6, padding: '4px 8px', fontSize: 11,
        outline: 'none', cursor: 'pointer',
      }}>
        {options.map(o => <option key={o} value={o}>{o === 'all' ? 'Todos' : o}</option>)}
      </select>
    </div>
  )
}

function ActionBtn({ children, onClick, color, title }: {
  children: React.ReactNode; onClick: () => void; color: string; title: string
}) {
  return (
    <button onClick={onClick} title={title} style={{
      background: `${color}15`, border: `1px solid ${color}30`,
      color, borderRadius: 5, padding: '3px 6px', cursor: 'pointer', fontSize: 11,
    }}>
      {children}
    </button>
  )
}
