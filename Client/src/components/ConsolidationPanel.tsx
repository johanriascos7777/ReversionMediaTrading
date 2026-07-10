/**
 * ConsolidationPanel.tsx
 *
 * Panel PREMIUM del Consolidation Geometry Analyzer.
 * 
 * PARADIGMA CLAVE:
 * El sistema es un ESCUDO contra pullbacks, NO un disparador de entrada.
 * - OPPOSED = "NO ENTRES, es un pullback" (68% accuracy, 78% en Bear Flags)
 * - ALIGNED = información complementaria, no la señal principal
 * - El edge está en bloquear malas entradas, no en encontrar buenas
 *
 * Features:
 * - Selector de símbolos integrado con status indicators
 * - Escudo visual prominente cuando OPPOSED está activo
 * - Señales M5 y M15 con indicadores de confianza
 * - Super señal con efectos dramáticos de glow
 * - Veredicto dinámico por símbolo
 */

import { useState } from 'react'
import type {
  ConsolidationData,
  ConsolidationTimeframeSignal,
  SuperSignalType,
  MultiSymbolConsolidation,
} from '../hooks/useMarketData'

// ═══════════════════════════════════════════════════════════════════════════════
// Pattern names & icons
// ═══════════════════════════════════════════════════════════════════════════════

const PATTERN_NAMES: Record<string, string> = {
  ascending_triangle:   'Triángulo Ascendente',
  descending_triangle:  'Triángulo Descendente',
  rectangle:            'Rectángulo',
  bull_flag:            'Bandera Alcista',
  bear_flag:            'Bandera Bajista',
  contracting_wedge:    'Cuña Contractiva',
  expanding_wedge:      'Cuña Expansiva',
  falling_channel:      'Canal Descendente',
  rising_channel:       'Canal Ascendente',
  unclassified:         'No clasificado',
}

const PATTERN_ICON: Record<string, string> = {
  ascending_triangle:   '△',
  descending_triangle:  '▽',
  rectangle:            '▬',
  bull_flag:            '🏴',
  bear_flag:            '🏴',
  contracting_wedge:    '◇',
  expanding_wedge:      '◆',
  falling_channel:      '↘',
  rising_channel:       '↗',
  unclassified:         '?',
}

// ═══════════════════════════════════════════════════════════════════════════════
// Color palettes
// ═══════════════════════════════════════════════════════════════════════════════

const COLORS = {
  aligned: {
    primary: '#34d399', secondary: '#10b981',
    bg: 'rgba(16,185,129,0.06)', bgStrong: 'rgba(16,185,129,0.12)',
    border: 'rgba(16,185,129,0.2)',
    glow: '0 0 20px rgba(16,185,129,0.2), 0 0 40px rgba(16,185,129,0.08)',
  },
  opposed: {
    primary: '#f87171', secondary: '#ef4444',
    bg: 'rgba(239,68,68,0.06)', bgStrong: 'rgba(239,68,68,0.12)',
    border: 'rgba(239,68,68,0.2)',
    glow: '0 0 20px rgba(239,68,68,0.2), 0 0 40px rgba(239,68,68,0.08)',
  },
  neutral: {
    primary: '#6b7280', secondary: '#4b5563',
    bg: 'rgba(107,114,128,0.04)', bgStrong: 'rgba(107,114,128,0.08)',
    border: 'rgba(107,114,128,0.12)',
    glow: 'none',
  },
}

const SUPER_COLORS: Record<SuperSignalType, {
  primary: string; bg: string; border: string; glow: string; icon: string; label: string
}> = {
  SUPER_STOP: {
    primary: '#ef4444', bg: 'linear-gradient(135deg, rgba(239,68,68,0.12) 0%, rgba(185,28,28,0.08) 100%)',
    border: 'rgba(239,68,68,0.3)', glow: '0 0 30px rgba(239,68,68,0.2), 0 0 60px rgba(239,68,68,0.08)',
    icon: '🛑', label: 'SUPER STOP',
  },
  SUPER_REVERSAL: {
    primary: '#10b981', bg: 'linear-gradient(135deg, rgba(16,185,129,0.12) 0%, rgba(5,150,105,0.08) 100%)',
    border: 'rgba(16,185,129,0.3)', glow: '0 0 30px rgba(16,185,129,0.2), 0 0 60px rgba(16,185,129,0.08)',
    icon: '⚡', label: 'SUPER REVERSIÓN',
  },
  CONFLICT: {
    primary: '#f59e0b', bg: 'linear-gradient(135deg, rgba(245,158,11,0.1) 0%, rgba(217,119,6,0.06) 100%)',
    border: 'rgba(245,158,11,0.25)', glow: '0 0 20px rgba(245,158,11,0.15)',
    icon: '⚠️', label: 'CONFLICTO',
  },
  INACTIVE: {
    primary: '#4b5563', bg: 'rgba(75,85,99,0.04)', border: 'rgba(75,85,99,0.1)', glow: 'none',
    icon: '⏸️', label: 'INACTIVO',
  },
}

// ═══════════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════════

function patternLabel(pattern: string | null): string {
  if (!pattern) return '—'
  return PATTERN_NAMES[pattern] ?? pattern
}

// ═══════════════════════════════════════════════════════════════════════════════
// Confidence Ring (SVG circular gauge)
// ═══════════════════════════════════════════════════════════════════════════════

function ConfidenceRing({ value, color, size = 56 }: { value: number; color: string; size?: number }) {
  const radius = (size - 6) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (value / 100) * circumference

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={radius}
          fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="4" />
        <circle cx={size/2} cy={size/2} r={radius}
          fill="none" stroke={color} strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, fontWeight: 800, color, fontFamily: "'JetBrains Mono', monospace",
      }}>
        {value}%
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Status Orb
// ═══════════════════════════════════════════════════════════════════════════════

function StatusOrb({ color, active, size = 8 }: { color: string; active: boolean; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: color,
      boxShadow: active ? `0 0 ${size}px ${color}, 0 0 ${size * 2}px ${color}40` : `0 0 4px ${color}40`,
      transition: 'all 0.4s ease',
    }}
    className={active ? 'consolidation-pulse' : ''}
    />
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🛡️ PULLBACK SHIELD — The main visual element
// Shows a prominent shield when OPPOSED is detected on any timeframe
// ═══════════════════════════════════════════════════════════════════════════════

function PullbackShield({ data }: { data: ConsolidationData }) {
  const m5Opposed = data.m5.detected && data.m5.alignment === 'opposed'
  const m15Opposed = data.m15.detected && data.m15.alignment === 'opposed'
  const anyOpposed = m5Opposed || m15Opposed
  const bothOpposed = m5Opposed && m15Opposed

  // Shield is DOWN (green/inactive) when no OPPOSED detected
  const m5Aligned = data.m5.detected && data.m5.alignment === 'aligned'
  const m15Aligned = data.m15.detected && data.m15.alignment === 'aligned'
  const anyAligned = m5Aligned || m15Aligned

  if (anyOpposed) {
    // 🔴 SHIELD IS UP — Block entry!
    const sources: string[] = []
    if (m5Opposed)  sources.push(`M5: ${patternLabel(data.m5.pattern)} (${data.m5.confidence}%)`)
    if (m15Opposed) sources.push(`M15: ${patternLabel(data.m15.pattern)} (${data.m15.confidence}%)`)

    return (
      <div
        className="consolidation-pulse"
        style={{
          background: 'linear-gradient(135deg, rgba(239,68,68,0.1) 0%, rgba(185,28,28,0.06) 100%)',
          border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 16,
          padding: '20px 24px',
          boxShadow: bothOpposed
            ? '0 0 40px rgba(239,68,68,0.2), 0 0 80px rgba(239,68,68,0.08)'
            : '0 0 25px rgba(239,68,68,0.15)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Animated red border for double OPPOSED */}
        {bothOpposed && (
          <div style={{
            position: 'absolute', inset: -1, borderRadius: 16,
            border: '2px solid rgba(239,68,68,0.5)',
            pointerEvents: 'none',
          }} className="consolidation-pulse" />
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, position: 'relative' }}>
          {/* Giant shield icon */}
          <div style={{
            width: 64, height: 64, borderRadius: 16,
            background: 'linear-gradient(135deg, rgba(239,68,68,0.2) 0%, rgba(185,28,28,0.12) 100%)',
            border: '2px solid rgba(239,68,68,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 32,
            boxShadow: '0 0 20px rgba(239,68,68,0.15)',
            flexShrink: 0,
          }}>
            🛡️
          </div>
          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: 16, fontWeight: 900, color: '#ef4444',
              fontFamily: "'JetBrains Mono', monospace",
              letterSpacing: '1.5px', textTransform: 'uppercase',
              marginBottom: 4,
            }}>
              {bothOpposed ? '⚠️ DOBLE ESCUDO — PULLBACK CONFIRMADO' : '🛡️ ESCUDO ACTIVO — PULLBACK DETECTADO'}
            </div>
            <div style={{
              fontSize: 13, color: '#fca5a5', lineHeight: 1.6,
              fontFamily: "'Outfit', sans-serif",
            }}>
              {bothOpposed
                ? 'Ambas temporalidades detectan geometría de pullback. La reversión a la media NO está confirmada. NO entres.'
                : 'Se detectó un patrón de consolidación con sesgo contrario a la reversión. El precio probablemente seguirá estirándose.'
              }
            </div>
            <div style={{
              marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap',
            }}>
              {sources.map((src, i) => (
                <span key={i} style={{
                  fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                  background: 'rgba(239,68,68,0.12)',
                  border: '1px solid rgba(239,68,68,0.2)',
                  color: '#f87171',
                  fontFamily: "'JetBrains Mono', monospace",
                }}>
                  {src}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Action bar */}
        <div style={{
          marginTop: 14, padding: '10px 16px',
          background: 'rgba(0,0,0,0.3)',
          borderRadius: 10,
          border: '1px solid rgba(239,68,68,0.15)',
          fontSize: 12, fontWeight: 700, color: '#ef4444',
          fontFamily: "'JetBrains Mono', monospace",
          textAlign: 'center',
          letterSpacing: '0.5px',
        }}>
          ⛔ NO ENTRES — Sin importar qué digan los otros indicadores
        </div>
      </div>
    )
  }

  if (anyAligned) {
    // 🟢 Aligned detected — complementary info (NOT an entry signal)
    const sources: string[] = []
    if (m5Aligned)  sources.push(`M5: ${patternLabel(data.m5.pattern)} (${data.m5.confidence}%)`)
    if (m15Aligned) sources.push(`M15: ${patternLabel(data.m15.pattern)} (${data.m15.confidence}%)`)

    return (
      <div style={{
        background: 'rgba(16,185,129,0.04)',
        border: '1px solid rgba(16,185,129,0.15)',
        borderRadius: 14, padding: '16px 20px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: 'rgba(16,185,129,0.1)',
            border: '1px solid rgba(16,185,129,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, flexShrink: 0,
          }}>✅</div>
          <div>
            <div style={{
              fontSize: 12, fontWeight: 800, color: '#34d399',
              fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.8px',
            }}>
              ESCUDO ABAJO — GEOMETRÍA FAVORABLE
            </div>
            <div style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.5, marginTop: 2, fontFamily: "'Outfit', sans-serif" }}>
              La geometría de consolidación favorece la reversión a la media. El escudo no bloquea.
              <span style={{ color: '#4b5563', display: 'block', marginTop: 4, fontSize: 10, fontStyle: 'italic' }}>
                ℹ️ Esto NO es una señal de entrada — confirma con el semáforo de elasticidad.
              </span>
            </div>
          </div>
        </div>
        <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {sources.map((src, i) => (
            <span key={i} style={{
              fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
              background: 'rgba(16,185,129,0.08)',
              border: '1px solid rgba(16,185,129,0.15)',
              color: '#34d399',
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              {src}
            </span>
          ))}
        </div>
      </div>
    )
  }

  // ⏸️ No signal / neutral — shield is inactive
  const hasAnyDetection = data.m5.detected || data.m15.detected

  return (
    <div style={{
      background: 'rgba(75,85,99,0.04)',
      border: '1px solid rgba(255,255,255,0.04)',
      borderRadius: 14, padding: '14px 18px',
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: 'rgba(75,85,99,0.08)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 18, opacity: 0.4, flexShrink: 0,
      }}>🛡️</div>
      <div style={{ fontSize: 11, color: '#4b5563', lineHeight: 1.5, fontFamily: "'Outfit', sans-serif" }}>
        {hasAnyDetection
          ? 'Consolidación detectada pero sin sesgo claro (NEUTRAL). El escudo no se activa — espera a que la geometría se defina.'
          : 'Sin consolidación detectada. El escudo anti-pullback está inactivo.'
        }
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Timeframe Signal Card (compact)
// ═══════════════════════════════════════════════════════════════════════════════

function TimeframeCard({
  timeframe,
  role,
  signal,
}: {
  timeframe: string
  role: string
  signal: ConsolidationTimeframeSignal
}) {
  const palette = COLORS[signal.alignment] || COLORS.neutral
  const pName = signal.pattern ? (PATTERN_NAMES[signal.pattern] ?? signal.pattern) : null
  const pIcon = signal.pattern ? (PATTERN_ICON[signal.pattern] ?? '📊') : null

  return (
    <div style={{
      flex: 1,
      minWidth: 280,
      background: signal.detected
        ? `linear-gradient(145deg, ${palette.bg} 0%, rgba(0,0,0,0.15) 100%)`
        : 'rgba(255,255,255,0.01)',
      border: `1px solid ${signal.detected ? palette.border : 'rgba(255,255,255,0.04)'}`,
      borderRadius: 14,
      padding: '16px 18px',
      transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
      boxShadow: signal.detected ? palette.glow : 'none',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Mesh overlay */}
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.03, pointerEvents: 'none',
        backgroundImage: `radial-gradient(circle at 1px 1px, ${palette.primary} 1px, transparent 0)`,
        backgroundSize: '20px 20px',
      }} />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, position: 'relative' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <StatusOrb color={signal.detected ? palette.primary : '#374151'} active={signal.detected} />
            <span style={{
              fontSize: 11, fontWeight: 800, letterSpacing: '1.5px', textTransform: 'uppercase',
              color: signal.detected ? palette.primary : '#4b5563',
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              {timeframe}
            </span>
          </div>
          <div style={{ fontSize: 10, color: '#6b7280', fontWeight: 500, fontFamily: "'Outfit', sans-serif" }}>
            {role}
          </div>
        </div>

        <span style={{
          fontSize: 10, fontWeight: 800, padding: '3px 10px', borderRadius: 20,
          background: signal.detected ? palette.bgStrong : 'rgba(255,255,255,0.03)',
          color: signal.detected ? palette.primary : '#374151',
          border: `1px solid ${signal.detected ? palette.border : 'rgba(255,255,255,0.04)'}`,
          fontFamily: "'JetBrains Mono', monospace",
          letterSpacing: '0.8px', textTransform: 'uppercase',
        }}>
          {signal.detected ? signal.alignment : 'inactive'}
        </span>
      </div>

      {signal.detected && pName ? (
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <ConfidenceRing value={signal.confidence} color={palette.primary} size={50} />
            <div>
              <div style={{
                fontSize: 14, fontWeight: 700, color: '#f3f4f6',
                display: 'flex', alignItems: 'center', gap: 6,
                fontFamily: "'Outfit', sans-serif",
              }}>
                <span style={{ fontSize: 16 }}>{pIcon}</span>
                {pName}
              </div>
              <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2, fontFamily: "'JetBrains Mono', monospace" }}>
                {signal.duration} velas · {signal.rangeATR.toFixed(2)} ATR
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          minHeight: 60,
          color: '#374151', fontSize: 11, lineHeight: 1.5, textAlign: 'center',
          fontFamily: "'Outfit', sans-serif",
        }}>
          <div>
            <div style={{ fontSize: 20, marginBottom: 4, opacity: 0.25 }}>◌</div>
            <div>{signal.explanation || 'Sin consolidación detectada'}</div>
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Super Signal Card
// ═══════════════════════════════════════════════════════════════════════════════

function SuperSignalCard({ data }: { data: ConsolidationData }) {
  const ss = data.superSignal
  const style = SUPER_COLORS[ss.type]

  if (ss.type === 'INACTIVE') return null

  return (
    <div
      className={ss.active ? 'consolidation-glow' : ''}
      style={{
        background: style.bg,
        border: `1px solid ${style.border}`,
        borderRadius: 14,
        padding: '16px 20px',
        boxShadow: style.glow,
        transition: 'all 0.4s ease',
        position: 'relative',
        overflow: 'hidden',
        marginBottom: 14,
      }}
    >
      {ss.active && (
        <div style={{
          position: 'absolute', inset: -1, borderRadius: 14,
          border: `2px solid ${style.primary}`,
          opacity: 0.4, pointerEvents: 'none',
        }} className="consolidation-pulse" />
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, position: 'relative' }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: `${style.primary}15`,
          border: `1px solid ${style.primary}30`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, flexShrink: 0,
        }}>
          {style.icon}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: 12, fontWeight: 800, color: style.primary,
            fontFamily: "'JetBrains Mono', monospace",
            letterSpacing: '1px',
          }}>
            {style.label}
          </div>
          <div style={{ fontSize: 10, color: '#6b7280' }}>
            {data.priceVsEma === 'above' ? '↑ Precio encima de EMA100' : '↓ Precio debajo de EMA100'}
          </div>
        </div>
      </div>

      <div style={{
        marginTop: 10, fontSize: 11, color: '#d1d5db', lineHeight: 1.6,
        background: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: '10px 14px',
        border: '1px solid rgba(255,255,255,0.03)',
        fontFamily: "'Outfit', sans-serif",
      }}>
        {ss.recommendation}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Symbol Selector Pills
// ═══════════════════════════════════════════════════════════════════════════════

function SymbolPills({
  symbols, active, onSelect, consolidation,
}: {
  symbols: string[]
  active: string
  onSelect: (sym: string) => void
  consolidation: MultiSymbolConsolidation | null
}) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 18 }}>
      {symbols.map(sym => {
        const isActive = sym === active
        const data = consolidation?.[sym]
        const m5Opposed = data?.m5.detected && data.m5.alignment === 'opposed'
        const m15Opposed = data?.m15.detected && data.m15.alignment === 'opposed'
        const anyOpposed = m5Opposed || m15Opposed
        const hasSignal = data && (data.m5.detected || data.m15.detected)

        let pillColor = '#374151'
        let pillBorder = 'rgba(255,255,255,0.06)'
        let pillBg = 'transparent'
        let pillGlow = 'none'

        // Red = OPPOSED detected (shield up)
        if (anyOpposed) {
          pillColor = '#ef4444'
          pillBorder = 'rgba(239,68,68,0.3)'
          pillBg = 'rgba(239,68,68,0.08)'
          pillGlow = '0 0 12px rgba(239,68,68,0.2)'
        } else if (hasSignal) {
          pillColor = '#6b7280'
          pillBorder = 'rgba(107,114,128,0.15)'
          pillBg = 'rgba(107,114,128,0.05)'
        }

        if (isActive) {
          pillBg = 'rgba(139,92,246,0.12)'
          pillBorder = 'rgba(139,92,246,0.35)'
          pillColor = '#a78bfa'
        }

        return (
          <button
            key={sym}
            onClick={() => onSelect(sym)}
            style={{
              padding: '6px 14px', borderRadius: 20,
              fontSize: 11, fontWeight: isActive ? 800 : 600,
              fontFamily: "'JetBrains Mono', monospace",
              letterSpacing: '0.3px', color: isActive ? '#a78bfa' : pillColor,
              background: pillBg,
              border: `1px solid ${pillBorder}`,
              cursor: 'pointer',
              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: isActive ? '0 0 15px rgba(139,92,246,0.15)' : pillGlow,
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            {anyOpposed && !isActive && (
              <StatusOrb color="#ef4444" active={true} size={6} />
            )}
            {sym}
          </button>
        )
      })}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════════════════

export function ConsolidationPanel({
  consolidation,
  symbols,
  activeSymbol,
}: {
  consolidation: MultiSymbolConsolidation | null
  symbols: string[]
  activeSymbol: string
}) {
  const [selectedSymbol, setSelectedSymbol] = useState(activeSymbol)

  const effectiveSymbol = symbols.includes(selectedSymbol) ? selectedSymbol : activeSymbol
  const data = consolidation?.[effectiveSymbol] ?? null

  // Count symbols with active shields
  const shieldCount = symbols.filter(s => {
    const d = consolidation?.[s]
    return d && ((d.m5.detected && d.m5.alignment === 'opposed') || (d.m15.detected && d.m15.alignment === 'opposed'))
  }).length

  return (
    <div
      className="consolidation-panel"
      style={{
        position: 'relative',
        borderRadius: 20,
        padding: '28px 32px',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        background: 'linear-gradient(145deg, rgba(139,92,246,0.04) 0%, rgba(59,130,246,0.02) 50%, rgba(16,185,129,0.02) 100%)',
        border: '1px solid rgba(139,92,246,0.12)',
        boxShadow: '0 8px 40px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.03)',
        overflow: 'hidden',
      }}
    >
      {/* Background mesh */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.015,
        backgroundImage: `
          linear-gradient(rgba(139,92,246,0.3) 1px, transparent 1px),
          linear-gradient(90deg, rgba(139,92,246,0.3) 1px, transparent 1px)
        `,
        backgroundSize: '40px 40px',
      }} />

      {/* Radial highlight */}
      <div style={{
        position: 'absolute', top: -60, left: -60, width: 200, height: 200,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(139,92,246,0.08) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* ─── Header ─── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6, position: 'relative' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'linear-gradient(135deg, rgba(139,92,246,0.15) 0%, rgba(59,130,246,0.1) 100%)',
              border: '1px solid rgba(139,92,246,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18,
            }}>
              🛡️
            </div>
            <div>
              <h3 style={{
                fontSize: 18, fontWeight: 800, margin: 0, letterSpacing: '-0.3px',
                background: 'linear-gradient(135deg, #a78bfa 0%, #60a5fa 50%, #34d399 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                fontFamily: "'Outfit', sans-serif",
              }}>
                Pullback Shield
              </h3>
              <p style={{ margin: 0, fontSize: 11, color: '#6b7280', fontFamily: "'Outfit', sans-serif" }}>
                Escudo contra pullbacks · Geometría de consolidación · Multi-temporal
              </p>
            </div>
          </div>
        </div>

        {/* Shield count badge */}
        {shieldCount > 0 && (
          <div
            className="consolidation-pulse"
            style={{
              padding: '5px 14px', borderRadius: 20,
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.25)',
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 10, fontWeight: 800,
              color: '#ef4444',
              fontFamily: "'JetBrains Mono', monospace",
              letterSpacing: '0.5px',
            }}
          >
            <StatusOrb color="#ef4444" active={true} size={6} />
            {shieldCount} ESCUDO{shieldCount > 1 ? 'S' : ''} ACTIVO{shieldCount > 1 ? 'S' : ''}
          </div>
        )}
      </div>

      {/* ─── Symbol Selector ─── */}
      <div style={{ position: 'relative', marginTop: 16 }}>
        <SymbolPills
          symbols={symbols}
          active={effectiveSymbol}
          onSelect={setSelectedSymbol}
          consolidation={consolidation}
        />
      </div>

      {!data ? (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          minHeight: 120, gap: 12,
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: '50%',
            border: '3px solid rgba(139,92,246,0.1)',
            borderTopColor: '#a78bfa',
          }} className="consolidation-spin" />
          <div style={{ fontSize: 12, color: '#4b5563', fontFamily: "'Outfit', sans-serif" }}>
            Esperando datos de consolidación para {effectiveSymbol}...
          </div>
        </div>
      ) : (
        <>
          {/* ─── 🛡️ PULLBACK SHIELD (Main Visual) ─── */}
          <PullbackShield data={data} />

          {/* ─── Super Signal (if active) ─── */}
          {data.superSignal.type !== 'INACTIVE' && (
            <div style={{ marginTop: 14 }}>
              <SuperSignalCard data={data} />
            </div>
          )}

          {/* ─── M5 + M15 Details (collapsible) ─── */}
          <details style={{ marginTop: 14 }} open={data.m5.detected || data.m15.detected}>
            <summary style={{
              fontSize: 11, color: '#6b7280', cursor: 'pointer',
              fontFamily: "'JetBrains Mono', monospace",
              padding: '6px 0', userSelect: 'none',
              letterSpacing: '0.3px',
            }}>
              📊 Detalle por temporalidad — M5 + M15
            </summary>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 10 }}>
              <TimeframeCard
                timeframe="M5"
                role="Detector de pullbacks (68% acc.)"
                signal={data.m5}
              />
              <TimeframeCard
                timeframe="M15"
                role="Confirmador de reversión (63% acc.)"
                signal={data.m15}
              />
            </div>
          </details>

          {/* ─── How it works (collapsible) ─── */}
          <details style={{ marginTop: 8 }}>
            <summary style={{
              fontSize: 10, color: '#4b5563', cursor: 'pointer',
              fontFamily: "'JetBrains Mono', monospace",
              padding: '6px 0', userSelect: 'none',
            }}>
              ❓ ¿Cómo funciona el escudo?
            </summary>
            <div style={{
              marginTop: 8, fontSize: 11, color: '#6b7280', lineHeight: 1.7,
              background: 'rgba(0,0,0,0.15)', borderRadius: 10, padding: '14px 16px',
              border: '1px solid rgba(255,255,255,0.03)',
              fontFamily: "'Outfit', sans-serif",
            }}>
              <div style={{ marginBottom: 8 }}>
                <strong style={{ color: '#f87171' }}>🛡️ Escudo ARRIBA (OPPOSED)</strong> = la geometría indica que el precio va a seguir estirándose → <strong style={{ color: '#ef4444' }}>NO ENTRES</strong>.
                <br /><span style={{ fontSize: 10, color: '#4b5563' }}>68% accuracy • 78% en Bear Flags (backtest EUR/USD, 5000 velas)</span>
              </div>
              <div style={{ marginBottom: 8 }}>
                <strong style={{ color: '#34d399' }}>✅ Escudo ABAJO (ALIGNED)</strong> = la geometría favorece la reversión → <em>el escudo no bloquea</em>, pero confirma con otros indicadores.
                <br /><span style={{ fontSize: 10, color: '#4b5563' }}>Info complementaria, no señal de entrada</span>
              </div>
              <div>
                <strong style={{ color: '#6b7280' }}>⏸️ Inactivo</strong> = sin consolidación detectada o patrón neutral → sin información adicional.
              </div>
            </div>
          </details>
        </>
      )}
    </div>
  )
}
