/**
 * ConsolidationPanel.tsx
 *
 * Panel PREMIUM del Consolidation Geometry Analyzer.
 * La sección más visual y atractiva del dashboard.
 *
 * Features:
 * - Selector de símbolos integrado (pill tabs con glow)
 * - Señales M5 y M15 con indicadores visuales de confianza
 * - Super señal con efectos dramáticos de glow
 * - Guía de acción con iconografía visual
 * - Animaciones CSS suaves y micro-interacciones
 */

import { useState } from 'react'
import type {
  ConsolidationData,
  ConsolidationTimeframeSignal,
  SuperSignalType,
  MultiSymbolConsolidation,
} from '../hooks/useMarketData'

// ═══════════════════════════════════════════════════════════════════════════════
// Pattern names & emojis
// ═══════════════════════════════════════════════════════════════════════════════

const PATTERN_NAMES: Record<string, string> = {
  ascending_triangle:   'Triángulo Ascendente',
  descending_triangle:  'Triángulo Descendente',
  rectangle:            'Rectángulo',
  bull_flag:            'Bandera Alcista',
  bear_flag:            'Bandera Bajista',
  contracting_wedge:    'Cuña Contractiva',
  expanding_wedge:      'Cuña Expansiva',
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
  unclassified:         '?',
}

// ═══════════════════════════════════════════════════════════════════════════════
// Color palettes
// ═══════════════════════════════════════════════════════════════════════════════

const COLORS = {
  aligned: {
    primary: '#34d399',
    secondary: '#10b981',
    bg: 'rgba(16,185,129,0.06)',
    bgStrong: 'rgba(16,185,129,0.12)',
    border: 'rgba(16,185,129,0.2)',
    glow: '0 0 20px rgba(16,185,129,0.2), 0 0 40px rgba(16,185,129,0.08)',
  },
  opposed: {
    primary: '#f87171',
    secondary: '#ef4444',
    bg: 'rgba(239,68,68,0.06)',
    bgStrong: 'rgba(239,68,68,0.12)',
    border: 'rgba(239,68,68,0.2)',
    glow: '0 0 20px rgba(239,68,68,0.2), 0 0 40px rgba(239,68,68,0.08)',
  },
  neutral: {
    primary: '#6b7280',
    secondary: '#4b5563',
    bg: 'rgba(107,114,128,0.04)',
    bgStrong: 'rgba(107,114,128,0.08)',
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
// Confidence Ring (SVG circular gauge)
// ═══════════════════════════════════════════════════════════════════════════════

function ConfidenceRing({ value, color, size = 56 }: { value: number; color: string; size?: number }) {
  const radius = (size - 6) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (value / 100) * circumference

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        {/* Track */}
        <circle cx={size/2} cy={size/2} r={radius}
          fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="4" />
        {/* Progress */}
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
// Status Orb (animated glow dot)
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
// Timeframe Signal Card
// ═══════════════════════════════════════════════════════════════════════════════

function TimeframeCard({
  timeframe,
  role,
  signal,
  accuracyLabel,
}: {
  timeframe: string
  role: string
  signal: ConsolidationTimeframeSignal
  accuracyLabel: string
}) {
  const palette = COLORS[signal.alignment] || COLORS.neutral
  const patternName = signal.pattern ? (PATTERN_NAMES[signal.pattern] ?? signal.pattern) : null
  const patternIcon = signal.pattern ? (PATTERN_ICON[signal.pattern] ?? '📊') : null

  return (
    <div style={{
      flex: 1,
      minWidth: 300,
      background: signal.detected
        ? `linear-gradient(145deg, ${palette.bg} 0%, rgba(0,0,0,0.15) 100%)`
        : 'rgba(255,255,255,0.01)',
      border: `1px solid ${signal.detected ? palette.border : 'rgba(255,255,255,0.04)'}`,
      borderRadius: 16,
      padding: '20px 22px',
      transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
      boxShadow: signal.detected ? palette.glow : 'none',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Subtle mesh overlay */}
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.03, pointerEvents: 'none',
        backgroundImage: `radial-gradient(circle at 1px 1px, ${palette.primary} 1px, transparent 0)`,
        backgroundSize: '20px 20px',
      }} />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, position: 'relative' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <StatusOrb color={signal.detected ? palette.primary : '#374151'} active={signal.detected} />
            <span style={{
              fontSize: 11, fontWeight: 800, letterSpacing: '1.5px', textTransform: 'uppercase',
              color: signal.detected ? palette.primary : '#4b5563',
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              {timeframe}
            </span>
          </div>
          <div style={{
            fontSize: 10, color: '#6b7280', fontWeight: 500,
            fontFamily: "'Outfit', sans-serif",
          }}>
            {role}
          </div>
        </div>

        {/* Alignment Badge */}
        <span style={{
          fontSize: 10, fontWeight: 800, padding: '3px 10px', borderRadius: 20,
          background: signal.detected ? palette.bgStrong : 'rgba(255,255,255,0.03)',
          color: signal.detected ? palette.primary : '#374151',
          border: `1px solid ${signal.detected ? palette.border : 'rgba(255,255,255,0.04)'}`,
          fontFamily: "'JetBrains Mono', monospace",
          letterSpacing: '0.8px',
          textTransform: 'uppercase',
        }}>
          {signal.detected ? signal.alignment : 'inactive'}
        </span>
      </div>

      {signal.detected && patternName ? (
        <div style={{ position: 'relative' }}>
          {/* Pattern + Confidence */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
            <ConfidenceRing value={signal.confidence} color={palette.primary} />
            <div>
              <div style={{
                fontSize: 15, fontWeight: 700, color: '#f3f4f6',
                display: 'flex', alignItems: 'center', gap: 6,
                fontFamily: "'Outfit', sans-serif",
              }}>
                <span style={{ fontSize: 18 }}>{patternIcon}</span>
                {patternName}
              </div>
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                {signal.duration} velas · {signal.rangeATR.toFixed(2)} ATR
              </div>
            </div>
          </div>

          {/* Accuracy footer */}
          <div style={{
            fontSize: 10, color: '#4b5563', lineHeight: 1.5,
            borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: 10,
            fontFamily: "'JetBrains Mono', monospace",
          }}>
            📊 {accuracyLabel}
          </div>
        </div>
      ) : (
        /* Inactive state */
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          minHeight: 80,
          color: '#374151', fontSize: 12, lineHeight: 1.6, textAlign: 'center',
          fontFamily: "'Outfit', sans-serif",
        }}>
          <div>
            <div style={{ fontSize: 24, marginBottom: 6, opacity: 0.3 }}>◌</div>
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

  if (ss.type === 'INACTIVE') {
    return (
      <div style={{
        background: 'rgba(255,255,255,0.01)',
        border: '1px solid rgba(255,255,255,0.04)',
        borderRadius: 14, padding: '14px 18px',
        textAlign: 'center', color: '#374151', fontSize: 12,
      }}>
        <span style={{ fontSize: 18, opacity: 0.3 }}>⏸️</span>
        <div style={{ marginTop: 6, fontFamily: "'Outfit', sans-serif" }}>
          {ss.recommendation}
        </div>
      </div>
    )
  }

  return (
    <div
      className={ss.active ? 'consolidation-glow' : ''}
      style={{
        background: style.bg,
        border: `1px solid ${style.border}`,
        borderRadius: 16,
        padding: '18px 22px',
        boxShadow: style.glow,
        transition: 'all 0.4s ease',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Animated border glow for active signals */}
      {ss.active && (
        <div style={{
          position: 'absolute', inset: -1,
          borderRadius: 16,
          border: `2px solid ${style.primary}`,
          opacity: 0.4,
          pointerEvents: 'none',
        }}
        className="consolidation-pulse"
        />
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, position: 'relative' }}>
        <div style={{
          width: 40, height: 40, borderRadius: 12,
          background: `${style.primary}15`,
          border: `1px solid ${style.primary}30`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 20,
        }}>
          {style.icon}
        </div>
        <div>
          <div style={{
            fontSize: 14, fontWeight: 800, color: style.primary,
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
        fontSize: 12, color: '#d1d5db', lineHeight: 1.7,
        background: 'rgba(0,0,0,0.25)',
        borderRadius: 10, padding: '14px 16px',
        border: '1px solid rgba(255,255,255,0.03)',
        fontFamily: "'Outfit', sans-serif",
        position: 'relative',
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
  symbols,
  active,
  onSelect,
  consolidation,
}: {
  symbols: string[]
  active: string
  onSelect: (sym: string) => void
  consolidation: MultiSymbolConsolidation | null
}) {
  return (
    <div style={{
      display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20,
    }}>
      {symbols.map(sym => {
        const isActive = sym === active
        const data = consolidation?.[sym]
        const hasSignal = data && (data.m5.detected || data.m15.detected)
        const superType = data?.superSignal.type
        const superActive = superType === 'SUPER_STOP' || superType === 'SUPER_REVERSAL'

        // Determine pill color based on signal status
        let pillColor = '#374151'
        let pillBorder = 'rgba(255,255,255,0.06)'
        let pillBg = 'transparent'
        let pillGlow = 'none'

        if (superActive && superType === 'SUPER_STOP') {
          pillColor = '#ef4444'
          pillBorder = 'rgba(239,68,68,0.3)'
          pillBg = 'rgba(239,68,68,0.08)'
          pillGlow = '0 0 12px rgba(239,68,68,0.2)'
        } else if (superActive && superType === 'SUPER_REVERSAL') {
          pillColor = '#10b981'
          pillBorder = 'rgba(16,185,129,0.3)'
          pillBg = 'rgba(16,185,129,0.08)'
          pillGlow = '0 0 12px rgba(16,185,129,0.2)'
        } else if (hasSignal) {
          pillColor = '#f59e0b'
          pillBorder = 'rgba(245,158,11,0.2)'
          pillBg = 'rgba(245,158,11,0.05)'
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
              padding: '6px 14px',
              borderRadius: 20,
              fontSize: 11,
              fontWeight: isActive ? 800 : 600,
              fontFamily: "'JetBrains Mono', monospace",
              letterSpacing: '0.3px',
              color: isActive ? '#a78bfa' : pillColor,
              background: pillBg,
              border: `1px solid ${pillBorder}`,
              cursor: 'pointer',
              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: isActive ? '0 0 15px rgba(139,92,246,0.15)' : pillGlow,
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            {superActive && (
              <StatusOrb color={superType === 'SUPER_STOP' ? '#ef4444' : '#10b981'} active={true} size={6} />
            )}
            {hasSignal && !superActive && (
              <StatusOrb color="#f59e0b" active={false} size={5} />
            )}
            {sym}
          </button>
        )
      })}
    </div>
  )
}

function LiveVerdict({ data }: { data: ConsolidationData }) {
  const m5 = data.m5
  const m15 = data.m15

  // Dynamic M5 verdict
  const m5Verdict = !m5.detected
    ? { icon: '⏸️', color: '#4b5563', label: 'SIN SEÑAL', text: 'Sin consolidación en M5 — sin datos para filtrar.' }
    : m5.alignment === 'opposed'
    ? { icon: '⛔', color: '#ef4444', label: 'PULLBACK DETECTADO', text: `M5 detecta ${PATTERN_NAMES[m5.pattern ?? ''] ?? m5.pattern} con sesgo contrario a la reversión. NO entres.` }
    : m5.alignment === 'aligned'
    ? { icon: '✅', color: '#34d399', label: 'REVERSIÓN FAVORABLE', text: `M5 detecta ${PATTERN_NAMES[m5.pattern ?? ''] ?? m5.pattern} alineado con la reversión a la media.` }
    : { icon: '⏸️', color: '#6b7280', label: 'NEUTRAL', text: `M5 detecta consolidación (${PATTERN_NAMES[m5.pattern ?? ''] ?? m5.pattern}) pero sin sesgo claro.` }

  // Dynamic M15 verdict
  const m15Verdict = !m15.detected
    ? { icon: '⏸️', color: '#4b5563', label: 'SIN SEÑAL', text: 'Sin consolidación en M15 — sin confirmación.' }
    : m15.alignment === 'aligned'
    ? { icon: '✅', color: '#34d399', label: 'REVERSIÓN CONFIRMADA', text: `M15 confirma reversión con ${PATTERN_NAMES[m15.pattern ?? ''] ?? m15.pattern}. La temporalidad mayor valida.` }
    : m15.alignment === 'opposed'
    ? { icon: '⛔', color: '#ef4444', label: 'SIN CONFIRMACIÓN', text: `M15 detecta ${PATTERN_NAMES[m15.pattern ?? ''] ?? m15.pattern} contrario a la reversión. La temporalidad mayor no confirma.` }
    : { icon: '⏸️', color: '#6b7280', label: 'NEUTRAL', text: `M15 detecta consolidación (${PATTERN_NAMES[m15.pattern ?? ''] ?? m15.pattern}) pero sin sesgo claro.` }

  return (
    <div style={{ marginTop: 16 }}>
      {/* Live verdicts */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
      }}>
        {/* M5 live verdict */}
        <div style={{
          background: m5Verdict.color === '#ef4444' ? 'rgba(239,68,68,0.06)' :
                      m5Verdict.color === '#34d399' ? 'rgba(16,185,129,0.06)' : 'rgba(75,85,99,0.04)',
          border: `1px solid ${m5Verdict.color}25`,
          borderRadius: 12, padding: '14px 16px',
          transition: 'all 0.3s ease',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8,
              background: `${m5Verdict.color}15`,
              border: `1px solid ${m5Verdict.color}25`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14,
            }}>{m5Verdict.icon}</div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, color: m5Verdict.color, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.5px' }}>
                M5 → {m5Verdict.label}
              </div>
              <div style={{ fontSize: 9, color: '#6b7280' }}>Detector de pullbacks · 68% accuracy</div>
            </div>
          </div>
          <div style={{ fontSize: 11, color: '#9ca3af', lineHeight: 1.5, fontFamily: "'Outfit', sans-serif" }}>
            {m5Verdict.text}
          </div>
        </div>

        {/* M15 live verdict */}
        <div style={{
          background: m15Verdict.color === '#34d399' ? 'rgba(16,185,129,0.06)' :
                      m15Verdict.color === '#ef4444' ? 'rgba(239,68,68,0.06)' : 'rgba(75,85,99,0.04)',
          border: `1px solid ${m15Verdict.color}25`,
          borderRadius: 12, padding: '14px 16px',
          transition: 'all 0.3s ease',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8,
              background: `${m15Verdict.color}15`,
              border: `1px solid ${m15Verdict.color}25`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14,
            }}>{m15Verdict.icon}</div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, color: m15Verdict.color, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.5px' }}>
                M15 → {m15Verdict.label}
              </div>
              <div style={{ fontSize: 9, color: '#6b7280' }}>Confirmador de reversión · 63% accuracy</div>
            </div>
          </div>
          <div style={{ fontSize: 11, color: '#9ca3af', lineHeight: 1.5, fontFamily: "'Outfit', sans-serif" }}>
            {m15Verdict.text}
          </div>
        </div>
      </div>

      {/* Reference legend (collapsible) */}
      <details style={{ marginTop: 10 }}>
        <summary style={{
          fontSize: 10, color: '#4b5563', cursor: 'pointer', fontFamily: "'JetBrains Mono', monospace",
          padding: '6px 0', userSelect: 'none',
        }}>
          📋 Leyenda — ¿Cómo interpretar las señales?
        </summary>
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8,
          fontSize: 10, color: '#6b7280', lineHeight: 1.6,
          background: 'rgba(0,0,0,0.15)', borderRadius: 8, padding: 12,
          border: '1px solid rgba(255,255,255,0.03)',
        }}>
          <div>
            <strong style={{ color: '#f87171' }}>OPPOSED en M5</strong> = pullback detectado (el precio seguirá estirándose). Accuracy: 68%.
          </div>
          <div>
            <strong style={{ color: '#34d399' }}>ALIGNED en M15</strong> = la geometría favorece la reversión a la media. Accuracy: 63%.
          </div>
        </div>
      </details>
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

  // Sync with parent if activeSymbol changes
  const effectiveSymbol = symbols.includes(selectedSymbol) ? selectedSymbol : activeSymbol
  const data = consolidation?.[effectiveSymbol] ?? null

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

      {/* Radial highlight in top-left */}
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
              🔬
            </div>
            <div>
              <h3 style={{
                fontSize: 18, fontWeight: 800, margin: 0, letterSpacing: '-0.3px',
                background: 'linear-gradient(135deg, #a78bfa 0%, #60a5fa 50%, #34d399 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                fontFamily: "'Outfit', sans-serif",
              }}>
                Consolidation Geometry Analyzer
              </h3>
              <p style={{ margin: 0, fontSize: 11, color: '#6b7280', fontFamily: "'Outfit', sans-serif" }}>
                Detección de zonas de consolidación · Predicción de ruptura · Multi-temporalidad
              </p>
            </div>
          </div>
        </div>

        {/* Super signal badge in header */}
        {data && data.superSignal.type !== 'INACTIVE' && (
          <div
            className={data.superSignal.active ? 'consolidation-pulse' : ''}
            style={{
              padding: '5px 14px', borderRadius: 20,
              background: SUPER_COLORS[data.superSignal.type].bg,
              border: `1px solid ${SUPER_COLORS[data.superSignal.type].border}`,
              boxShadow: SUPER_COLORS[data.superSignal.type].glow,
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 10, fontWeight: 800,
              color: SUPER_COLORS[data.superSignal.type].primary,
              fontFamily: "'JetBrains Mono', monospace",
              letterSpacing: '1px',
            }}
          >
            <StatusOrb color={SUPER_COLORS[data.superSignal.type].primary} active={data.superSignal.active} size={6} />
            {SUPER_COLORS[data.superSignal.type].label}
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
        /* Loading state */
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          minHeight: 140, gap: 12,
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: '50%',
            border: '3px solid rgba(139,92,246,0.1)',
            borderTopColor: '#a78bfa',
          }}
          className="consolidation-spin"
          />
          <div style={{ fontSize: 12, color: '#4b5563', fontFamily: "'Outfit', sans-serif" }}>
            Esperando datos de consolidación para {effectiveSymbol}...
          </div>
        </div>
      ) : (
        <>
          {/* ─── M5 + M15 Cards ─── */}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
            <TimeframeCard
              timeframe="M5"
              role="Detector de Pullbacks"
              signal={data.m5}
              accuracyLabel="M5 OPPOSED: 68% accuracy como detector de pullbacks"
            />
            <TimeframeCard
              timeframe="M15"
              role="Confirmador de Reversión"
              signal={data.m15}
              accuracyLabel="M15 ALIGNED: 63% accuracy como confirmador de reversión"
            />
          </div>

          {/* ─── Super Signal ─── */}
          <SuperSignalCard data={data} />

          {/* ─── Live Verdict (Dynamic) ─── */}
          <LiveVerdict data={data} />
        </>
      )}
    </div>
  )
}
