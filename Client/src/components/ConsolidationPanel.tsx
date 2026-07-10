/**
 * ConsolidationPanel.tsx
 *
 * Panel visual del Consolidation Geometry Analyzer.
 * Muestra señales M5 y M15 por separado + super señal fusionada.
 *
 * Principio de uso basado en backtest:
 * - M5 OPPOSED (68% accuracy) → detector de pullbacks
 * - M15 ALIGNED (63% accuracy) → confirmador de reversión
 * - Super señal cuando ambos coinciden
 */

import type {
  ConsolidationData,
  ConsolidationTimeframeSignal,
  SuperSignalType,
} from '../hooks/useMarketData'

// ═══════════════════════════════════════════════════════════════════════════════
// Nombres legibles de patrones
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

const PATTERN_EMOJI: Record<string, string> = {
  ascending_triangle:   '📐',
  descending_triangle:  '📐',
  rectangle:            '▬',
  bull_flag:            '🐂',
  bear_flag:            '🐻',
  contracting_wedge:    '◇',
  expanding_wedge:      '◆',
  unclassified:         '❓',
}

// ═══════════════════════════════════════════════════════════════════════════════
// Colores y estilos por alignment/señal
// ═══════════════════════════════════════════════════════════════════════════════

const ALIGNMENT_STYLES: Record<string, {
  color: string; bg: string; border: string; glow: string; label: string; icon: string
}> = {
  aligned: {
    color: '#34d399', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.25)',
    glow: '0 0 12px rgba(16,185,129,0.3)', label: 'ALIGNED', icon: '✅',
  },
  opposed: {
    color: '#f87171', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.25)',
    glow: '0 0 12px rgba(239,68,68,0.3)', label: 'OPPOSED', icon: '⛔',
  },
  neutral: {
    color: '#9ca3af', bg: 'rgba(156,163,175,0.06)', border: 'rgba(156,163,175,0.15)',
    glow: 'none', label: 'NEUTRAL', icon: '⏸️',
  },
}

const SUPER_SIGNAL_STYLES: Record<SuperSignalType, {
  color: string; bg: string; border: string; glow: string; icon: string
}> = {
  SUPER_STOP: {
    color: '#ef4444', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.35)',
    glow: '0 0 20px rgba(239,68,68,0.25), 0 0 40px rgba(239,68,68,0.1)', icon: '🔴',
  },
  SUPER_REVERSAL: {
    color: '#10b981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.35)',
    glow: '0 0 20px rgba(16,185,129,0.25), 0 0 40px rgba(16,185,129,0.1)', icon: '🟢',
  },
  CONFLICT: {
    color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.3)',
    glow: '0 0 15px rgba(245,158,11,0.2)', icon: '⚠️',
  },
  INACTIVE: {
    color: '#6b7280', bg: 'rgba(107,114,128,0.05)', border: 'rgba(107,114,128,0.15)',
    glow: 'none', icon: '⏸️',
  },
}

// ═══════════════════════════════════════════════════════════════════════════════
// Sub-componente: Tarjeta de señal individual (M5 o M15)
// ═══════════════════════════════════════════════════════════════════════════════

function TimeframeSignalCard({
  label,
  signal,
  roleDescription,
  accuracyNote,
}: {
  label: string
  signal: ConsolidationTimeframeSignal
  roleDescription: string
  accuracyNote: string
}) {
  const style = ALIGNMENT_STYLES[signal.alignment] || ALIGNMENT_STYLES.neutral
  const patternName = signal.pattern ? (PATTERN_NAMES[signal.pattern] ?? signal.pattern) : '—'
  const patternEmoji = signal.pattern ? (PATTERN_EMOJI[signal.pattern] ?? '📊') : '—'

  return (
    <div style={{
      flex: 1,
      minWidth: 280,
      background: signal.detected ? style.bg : 'rgba(255,255,255,0.01)',
      border: `1px solid ${signal.detected ? style.border : 'rgba(255,255,255,0.05)'}`,
      borderRadius: 14,
      padding: '18px 20px',
      transition: 'all 0.3s ease',
      boxShadow: signal.detected ? style.glow : 'none',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontSize: 11, fontWeight: 800, letterSpacing: '1px', textTransform: 'uppercase',
            color: '#9ca3af', fontFamily: 'monospace',
          }}>
            {label}
          </span>
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
            background: signal.detected ? style.bg : 'transparent',
            color: signal.detected ? style.color : '#4b5563',
            border: `1px solid ${signal.detected ? style.border : 'rgba(255,255,255,0.06)'}`,
            fontFamily: 'monospace',
          }}>
            {signal.detected ? `${style.icon} ${style.label}` : '— INACTIVO'}
          </span>
        </div>
        {signal.detected && (
          <span style={{
            fontSize: 10, fontWeight: 700, color: style.color, fontFamily: 'monospace',
          }}>
            {signal.confidence}%
          </span>
        )}
      </div>

      {signal.detected ? (
        <>
          {/* Patrón */}
          <div style={{
            fontSize: 16, fontWeight: 700, color: '#f3f4f6', marginBottom: 8,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span>{patternEmoji}</span>
            <span>{patternName}</span>
          </div>

          {/* Métricas */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12,
          }}>
            <div style={{
              background: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: '8px 12px',
              border: '1px solid rgba(255,255,255,0.03)',
            }}>
              <div style={{ fontSize: 9, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Duración
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#d1d5db', fontFamily: 'monospace' }}>
                {signal.duration} velas
              </div>
            </div>
            <div style={{
              background: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: '8px 12px',
              border: '1px solid rgba(255,255,255,0.03)',
            }}>
              <div style={{ fontSize: 9, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Rango (ATR)
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#d1d5db', fontFamily: 'monospace' }}>
                {signal.rangeATR.toFixed(2)}
              </div>
            </div>
          </div>

          {/* Nota de accuracy */}
          <div style={{
            fontSize: 10, color: '#6b7280', fontStyle: 'italic', lineHeight: 1.4,
            borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: 8,
          }}>
            📊 {accuracyNote}
          </div>
        </>
      ) : (
        <div style={{ color: '#4b5563', fontSize: 12, lineHeight: 1.5 }}>
          {signal.explanation || roleDescription}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Sub-componente: Guía de acción
// ═══════════════════════════════════════════════════════════════════════════════

function ActionGuide() {
  return (
    <div style={{
      background: 'rgba(59,130,246,0.04)',
      border: '1px solid rgba(59,130,246,0.12)',
      borderRadius: 10,
      padding: '12px 16px',
      marginTop: 16,
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa', marginBottom: 8, letterSpacing: '0.5px' }}>
        📋 GUÍA DE ACCIÓN
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 11, color: '#9ca3af', lineHeight: 1.5 }}>
        <div>
          <strong style={{ color: '#f87171' }}>OPPOSED en M5</strong> → "Es un pullback, NO entres"
          <br /><span style={{ fontSize: 10, color: '#6b7280' }}>(68% accuracy histórica)</span>
        </div>
        <div>
          <strong style={{ color: '#34d399' }}>ALIGNED en M15</strong> → "La geometría confirma reversión"
          <br /><span style={{ fontSize: 10, color: '#6b7280' }}>(63% accuracy histórica)</span>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Componente Principal
// ═══════════════════════════════════════════════════════════════════════════════

export function ConsolidationPanel({
  data,
  symbol,
}: {
  data: ConsolidationData | null | undefined
  symbol: string
}) {
  const superStyle = data
    ? SUPER_SIGNAL_STYLES[data.superSignal.type]
    : SUPER_SIGNAL_STYLES.INACTIVE

  return (
    <div style={{
      background: 'rgba(139,92,246,0.03)',
      border: '1px solid rgba(139,92,246,0.12)',
      borderRadius: 18,
      padding: '24px 28px',
      backdropFilter: 'blur(12px)',
      marginTop: 24,
    }}>
      {/* Título */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: '#fff', letterSpacing: '-0.3px' }}>
          🔬 Consolidation Geometry Analyzer
        </h3>
        {data && data.superSignal.type !== 'INACTIVE' && (
          <span style={{
            fontSize: 11, fontWeight: 800, padding: '4px 12px', borderRadius: 8,
            background: superStyle.bg, color: superStyle.color,
            border: `1px solid ${superStyle.border}`,
            fontFamily: 'monospace', letterSpacing: '0.5px',
            boxShadow: superStyle.glow,
            animation: data.superSignal.active ? 'pulse 2s infinite' : 'none',
          }}>
            {superStyle.icon} {data.superSignal.type.replace('_', ' ')}
          </span>
        )}
      </div>

      <p style={{ margin: '0 0 20px', fontSize: 13, color: '#9ca3af', lineHeight: 1.4 }}>
        Detecta zonas de consolidación y clasifica su geometría para predecir si la ruptura irá hacia la EMA100 (reversión) o seguirá estirándose (pullback).
      </p>

      {!data ? (
        /* Sin datos */
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          height: 100, color: '#4b5563', fontSize: 13, fontFamily: 'monospace',
          background: 'rgba(0,0,0,0.15)', borderRadius: 12,
          border: '1px solid rgba(255,255,255,0.04)',
        }}>
          Esperando datos de consolidación para {symbol}...
        </div>
      ) : (
        <>
          {/* ─── Señales M5 y M15 lado a lado ─── */}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
            <TimeframeSignalCard
              label="M5 — Detector de Pullbacks"
              signal={data.m5}
              roleDescription="M5 analiza la microestructura para detectar si el precio está haciendo un pullback (pausa antes de seguir) o preparándose para revertir."
              accuracyNote="M5 OPPOSED: 68% de accuracy como detector de pullbacks (backtest EUR/USD 5000 velas)"
            />
            <TimeframeSignalCard
              label="M15 — Confirmador de Reversión"
              signal={data.m15}
              roleDescription="M15 analiza la estructura mayor para confirmar si la geometría favorece la reversión a la media."
              accuracyNote="M15 ALIGNED: 63% de accuracy como confirmador de reversión (backtest EUR/USD 5000 velas)"
            />
          </div>

          {/* ─── Super Señal ─── */}
          {data.superSignal.type !== 'INACTIVE' && (
            <div style={{
              background: superStyle.bg,
              border: `1px solid ${superStyle.border}`,
              borderRadius: 14,
              padding: '16px 20px',
              boxShadow: superStyle.glow,
              transition: 'all 0.3s ease',
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8,
              }}>
                <span style={{ fontSize: 20 }}>{superStyle.icon}</span>
                <span style={{
                  fontSize: 14, fontWeight: 800, color: superStyle.color,
                  fontFamily: 'monospace', letterSpacing: '0.5px',
                }}>
                  {data.superSignal.type.replace('_', ' ')}
                </span>
                <span style={{
                  fontSize: 11, color: '#9ca3af', marginLeft: 'auto',
                }}>
                  {data.priceVsEma === 'above' ? '↑ Encima de EMA100' : '↓ Debajo de EMA100'}
                </span>
              </div>
              <div style={{
                fontSize: 13, color: '#d1d5db', lineHeight: 1.6,
                background: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: '12px 16px',
                border: '1px solid rgba(255,255,255,0.04)',
              }}>
                {data.superSignal.recommendation}
              </div>
            </div>
          )}

          {/* ─── Guía de acción ─── */}
          <ActionGuide />
        </>
      )}
    </div>
  )
}
