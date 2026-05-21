/**
 * Semaforo.tsx
 *
 * Señal de decisión principal. Responde a: "¿Qué hago ahora?"
 *
 * Incluye:
 *   - Guard contra state inválido (evita crash si llega valor inesperado)
 *   - Contador de estabilidad: cuántas actualizaciones consecutivas
 *     lleva en el estado actual (clave para no operar en parpadeos)
 *   - Bloqueo por vela: solo marca "listo para operar" si lleva
 *     estable el tiempo equivalente a una vela M5 completa (~20 polls)
 */

import { useEffect, useRef, useState, type CSSProperties } from 'react'

export type SemaforoProps = {
  state:  'GREEN' | 'YELLOW' | 'RED'
  label?: string
}

type StateMeta = {
  color:    string
  bg:       string
  label:    string
  sublabel: string
}

const VALID_STATES = ['GREEN', 'YELLOW', 'RED'] as const
type ValidState = typeof VALID_STATES[number]

const STATE_META: Record<ValidState, StateMeta> = {
  GREEN: {
    color:    '#16a34a',
    bg:       'rgba(22,163,74,0.08)',
    label:    'SETUP VÁLIDO',
    sublabel: 'Condiciones óptimas para operar',
  },
  YELLOW: {
    color:    '#eab308',
    bg:       'rgba(234,179,8,0.08)',
    label:    'ESPERAR',
    sublabel: 'Condiciones parciales — sin señal clara',
  },
  RED: {
    color:    '#dc2626',
    bg:       'rgba(220,38,38,0.08)',
    label:    'NO OPERAR',
    sublabel: 'Condiciones desfavorables',
  },
}

// 20 polls × 15s = 300s = 1 vela M5 completa
// Si el semáforo lleva 20 polls consecutivos en GREEN → señal estable
const STABLE_THRESHOLD = 20   // polls para considerar señal confirmada
const POLL_SECONDS     = 15   // segundos entre cada poll (debe coincidir con useMarketData)

export function Semaforo({ state, label }: SemaforoProps) {
  // Guard: si state es inválido, mostrar RED con aviso
  const safeState: ValidState = VALID_STATES.includes(state as ValidState)
    ? (state as ValidState)
    : 'RED'

  const meta = STATE_META[safeState]

  // ── Contador de estabilidad ──────────────────────────────────────────────
  const [count,    setCount]    = useState(0)
  const [elapsed,  setElapsed]  = useState(0)   // segundos en estado actual
  const prevStateRef            = useRef(safeState)
  const elapsedRef              = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (safeState === prevStateRef.current) {
      // Mismo estado → incrementar contador
      setCount((c) => c + 1)
    } else {
      // Cambió → reiniciar
      setCount(1)
      setElapsed(0)
      prevStateRef.current = safeState
    }
  }, [safeState])

  // Segundos transcurridos en el estado actual (para barra de progreso)
  useEffect(() => {
    setElapsed(0)
    if (elapsedRef.current) clearInterval(elapsedRef.current)
    elapsedRef.current = setInterval(() => {
      setElapsed((s) => s + 1)
    }, 1000)
    return () => {
      if (elapsedRef.current) clearInterval(elapsedRef.current)
    }
  }, [safeState])

  const isStable     = count >= STABLE_THRESHOLD && safeState === 'GREEN'
  const totalSeconds = STABLE_THRESHOLD * POLL_SECONDS
  const progressPct  = Math.min((elapsed / totalSeconds) * 100, 100)

  return (
    <div style={{
      ...styles.card,
      background: meta.bg,
      border: `1px solid ${meta.color}22`,
    }}>

      {label && <p style={styles.contextLabel}>{label}</p>}

      {/* Círculo con glow */}
      <div style={styles.circleWrapper}>
        <div style={{
          ...styles.circle,
          background:  meta.color,
          boxShadow:   `0 0 32px ${meta.color}88, 0 0 8px ${meta.color}`,
        }}/>
      </div>

      <h3 style={{ ...styles.mainLabel, color: meta.color }}>
        {meta.label}
      </h3>
      <p style={styles.sublabel}>{meta.sublabel}</p>

      {/* ── Sección de estabilidad ─────────────────────────────────────── */}
      <div style={styles.stabilitySection}>

        {/* Contador de polls consecutivos */}
        <div style={styles.stabilityRow}>
          <span style={styles.stabilityLabel}>Estabilidad</span>
          <span style={{ ...styles.stabilityValue, color: meta.color }}>
            {count} / {STABLE_THRESHOLD} polls consecutivos
          </span>
        </div>

        {/* Barra de progreso hacia señal estable */}
        <div style={styles.barTrack}>
          <div style={{
            ...styles.barFill,
            width:      `${progressPct}%`,
            background: meta.color,
            boxShadow:  `0 0 6px ${meta.color}66`,
          }}/>
        </div>

        {/* Tiempo en estado actual */}
        <div style={styles.stabilityRow}>
          <span style={styles.stabilityLabel}>Tiempo en este estado</span>
          <span style={{ ...styles.stabilityValue, color: '#555' }}>
            {Math.floor(elapsed / 60)}m {elapsed % 60}s
          </span>
        </div>

        {/* Badge de confirmación — aparece solo cuando es estable */}
        {isStable && (
          <div style={{
            ...styles.confirmedBadge,
            background: 'rgba(22,163,74,0.15)',
            border:     '1px solid #16a34a55',
          }}>
            <div style={{ width:6, height:6, borderRadius:'50%', background:'#16a34a', boxShadow:'0 0 6px #16a34a' }}/>
            <span style={{ color:'#16a34a', fontSize:11, fontWeight:800, letterSpacing:'0.05em' }}>
              SEÑAL ESTABLE — 1 VELA M5 CONFIRMADA
            </span>
          </div>
        )}

        {/* Guía de lectura */}
        <p style={styles.guide}>
          {safeState === 'GREEN'
            ? isStable
              ? '✓ El setup lleva estable el tiempo de una vela M5 completa.'
              : `Espera ${STABLE_THRESHOLD - count} polls más (${((STABLE_THRESHOLD - count) * POLL_SECONDS / 60).toFixed(1)} min) para confirmar estabilidad.`
            : 'El semáforo debe mantenerse verde antes de considerar operar.'}
        </p>

      </div>
    </div>
  )
}

// ─── estilos ──────────────────────────────────────────────────────────────────

const styles: Record<string, CSSProperties> = {
  card: {
    marginTop:    16,
    padding:      '20px 24px',
    borderRadius: 10,
    textAlign:    'center',
    fontFamily:   'system-ui, sans-serif',
    transition:   'background 0.4s, border 0.4s',
  },
  contextLabel: {
    margin:        '0 0 12px',
    fontSize:      11,
    color:         '#555',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
  },
  circleWrapper: {
    display:        'flex',
    justifyContent: 'center',
    margin:         '0 auto 16px',
  },
  circle: {
    width:        72,
    height:       72,
    borderRadius: '50%',
    transition:   'background 0.4s, box-shadow 0.4s',
  },
  mainLabel: {
    margin:        '0 0 6px',
    fontSize:      18,
    fontWeight:    800,
    letterSpacing: '0.04em',
    transition:    'color 0.4s',
  },
  sublabel: {
    margin:   '0 0 16px',
    fontSize: 12,
    color:    '#555',
  },
  stabilitySection: {
    marginTop:    12,
    padding:      '12px 14px',
    background:   '#0d0d0d',
    borderRadius: 8,
    border:       '1px solid #1a1a1a',
    textAlign:    'left',
  },
  stabilityRow: {
    display:        'flex',
    justifyContent: 'space-between',
    alignItems:     'center',
    marginBottom:   6,
  },
  stabilityLabel: {
    fontSize: 11,
    color:    '#444',
    fontFamily: 'monospace',
  },
  stabilityValue: {
    fontSize:   11,
    fontWeight: 700,
    fontFamily: 'monospace',
  },
  barTrack: {
    height:       5,
    background:   '#1a1a1a',
    borderRadius: 3,
    overflow:     'hidden',
    marginBottom: 8,
  },
  barFill: {
    height:     '100%',
    borderRadius: 3,
    transition: 'width 1s linear',
  },
  confirmedBadge: {
    display:       'flex',
    alignItems:    'center',
    gap:           7,
    padding:       '8px 12px',
    borderRadius:  6,
    margin:        '10px 0 6px',
    justifyContent: 'center',
  },
  guide: {
    margin:   '8px 0 0',
    fontSize: 11,
    color:    '#444',
    fontFamily: 'monospace',
    lineHeight: 1.5,
  },
}