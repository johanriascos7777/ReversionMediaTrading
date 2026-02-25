/**
 * ElasticityCard.tsx
 *
 * Muestra el estado de elasticidad de M5 y M15 de forma visual.
 * Responde a: "¿Está el precio suficientemente estirado para operar?"
 *
 * Complementa al Semáforo:
 *   - Semáforo  → "¿Opero o no?"       (decisión)
 *   - Este card → "¿Por qué dice eso?" (contexto numérico + visual)
 */

import type { CSSProperties } from 'react'
import type { MarketSnapshot } from '@/types/market'
import type { MultiTFState } from '@/engine/multiTimeframeResolver'

// ─── tipos ────────────────────────────────────────────────────────────────────

export type ElasticityCardProps = {
  m5: MarketSnapshot
  m15: MarketSnapshot
  fusedState: MultiTFState
}

type StateMeta = {
  label: string
  color: string
  bg: string
  bar: string
}

type ZoneItem = {
  label: string
  range: string
  color: string
}

type TimeframeRowProps = {
  label: string
  snapshot: MarketSnapshot
}

// ─── constantes ───────────────────────────────────────────────────────────────

const STATE_META: Record<'GREEN' | 'YELLOW' | 'RED', StateMeta> = {
  GREEN:  { label: 'OPERAR',    color: '#16a34a', bg: 'rgba(22,163,74,0.12)',  bar: '#16a34a' },
  YELLOW: { label: 'ESPERAR',   color: '#eab308', bg: 'rgba(234,179,8,0.12)',  bar: '#eab308' },
  RED:    { label: 'NO OPERAR', color: '#dc2626', bg: 'rgba(220,38,38,0.12)', bar: '#dc2626' },
}

const ZONES: ZoneItem[] = [
  { label: 'Equilibrio', range: '< 0.5',   color: '#444' },
  { label: 'Bajo',       range: '0.5–1.0', color: '#666' },
  { label: 'Moderado',   range: '1.0–1.5', color: '#eab308' },
  { label: 'Alto',       range: '1.5–2.0', color: '#f97316' },
  { label: 'Extremo',    range: '> 2.0',   color: '#16a34a' },
]

// ─── helpers ──────────────────────────────────────────────────────────────────

/**
 * Convierte elasticidad a % para la barra visual.
 * Techo en 3.0 → 100% (zona visualmente "llena" = extremo máximo).
 */
function elasticityToPercent(elasticity: number): number {
  return Math.min((elasticity / 3) * 100, 100)
}

/**
 * Etiqueta de zona para que el trader entienda el número
 * sin necesidad de memorizar umbrales.
 */
function elasticityZoneLabel(elasticity: number): string {
  if (elasticity >= 2.0) return 'Extremo'
  if (elasticity >= 1.5) return 'Alto'
  if (elasticity >= 1.0) return 'Moderado'
  if (elasticity >= 0.5) return 'Bajo'
  return 'Equilibrio'
}

// ─── subcomponente: fila de temporalidad ──────────────────────────────────────

function TimeframeRow({ label, snapshot }: TimeframeRowProps) {
  const meta = STATE_META[snapshot.state]
  const pct  = elasticityToPercent(snapshot.elasticity)
  const zone = elasticityZoneLabel(snapshot.elasticity)

  return (
    <div style={styles.row}>
      <span style={styles.rowLabel}>{label}</span>

      {/* Barra visual — cuánto se estiró respecto al máximo esperado */}
      <div style={styles.barTrack}>
        <div
          style={{
            ...styles.barFill,
            width: `${pct}%`,
            background: meta.bar,
            boxShadow: `0 0 6px ${meta.bar}66`,
          }}
        />
      </div>

      {/* Número + etiqueta de zona */}
      <div style={styles.rowMeta}>
        <span style={{ color: meta.color, fontWeight: 700, fontFamily: 'monospace', fontSize: 15 }}>
          {snapshot.elasticity.toFixed(2)}
        </span>
        <span style={{ color: '#555', fontSize: 11, marginLeft: 6 }}>
          {zone}
        </span>
      </div>

      {/* Chip de estado */}
      <span
        style={{
          ...styles.chip,
          color: meta.color,
          background: meta.bg,
          border: `1px solid ${meta.color}44`,
        }}
      >
        {snapshot.state}
      </span>
    </div>
  )
}

// ─── componente principal — export nombrado ───────────────────────────────────

export function ElasticityCard({ m5, m15, fusedState }: ElasticityCardProps) {
  const fused = STATE_META[fusedState]

  return (
    <div style={styles.card}>

      {/* Header: par + badge de señal */}
      <div style={styles.header}>
        <div>
          <p style={styles.pair}>EUR / USD</p>
          <p style={styles.subtitle}>Elasticity System · M5 + M15</p>
        </div>

        <div
          style={{
            ...styles.summaryBadge,
            background: fused.bg,
            border: `1.5px solid ${fused.color}55`,
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: fused.color,
              boxShadow: `0 0 8px ${fused.color}`,
              flexShrink: 0,
            }}
          />
          <span style={{ color: fused.color, fontWeight: 800, fontSize: 13, letterSpacing: '0.05em' }}>
            {fused.label}
          </span>
        </div>
      </div>

      <div style={styles.divider} />

      {/* Encabezado de columnas */}
      <div style={styles.tableHeader}>
        <span style={{ ...styles.colLabel, minWidth: 90 }}>Temporalidad</span>
        <span style={{ ...styles.colLabel, flex: 1, paddingLeft: 4 }}>Elasticidad</span>
        <span style={{ ...styles.colLabel, minWidth: 186, textAlign: 'right' }}>Estado</span>
      </div>

      <TimeframeRow label="M5  (señal)" snapshot={m5} />
      <TimeframeRow label="M15 (filtro)" snapshot={m15} />

      <div style={{ ...styles.divider, marginTop: 14 }} />

      {/* Leyenda de zonas */}
      <div>
        <span style={styles.legendTitle}>Zonas de elasticidad</span>
        <div style={styles.legendItems}>
          {ZONES.map((z: ZoneItem) => (
            <div key={z.label} style={styles.legendItem}>
              <span style={{ color: z.color, fontSize: 10, fontWeight: 700 }}>{z.label}</span>
              <span style={{ color: '#333', fontSize: 9, fontFamily: 'monospace' }}>{z.range}</span>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}

// ─── estilos ──────────────────────────────────────────────────────────────────

const styles: Record<string, CSSProperties> = {
  card: {
    background: '#0d0d0d',
    border: '1px solid #1e1e1e',
    borderRadius: 10,
    padding: '18px 20px',
    fontFamily: 'system-ui, sans-serif',
    color: '#ccc',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  pair: {
    margin: 0,
    fontSize: 18,
    fontWeight: 800,
    color: '#e5e5e5',
    letterSpacing: '-0.02em',
  },
  subtitle: {
    margin: '3px 0 0',
    fontSize: 11,
    color: '#444',
  },
  summaryBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    padding: '7px 14px',
    borderRadius: 20,
  },
  divider: {
    height: 1,
    background: '#1a1a1a',
    marginBottom: 12,
  },
  tableHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  colLabel: {
    fontSize: 9,
    color: '#3a3a3a',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 0',
    borderBottom: '1px solid #161616',
  },
  rowLabel: {
    fontSize: 12,
    color: '#777',
    minWidth: 90,
    fontFamily: 'monospace',
  },
  barTrack: {
    flex: 1,
    height: 6,
    background: '#1a1a1a',
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
    transition: 'width 0.5s ease',
  },
  rowMeta: {
    display: 'flex',
    alignItems: 'baseline',
    minWidth: 110,
    justifyContent: 'flex-end',
  },
  chip: {
    fontSize: 10,
    fontWeight: 700,
    padding: '3px 8px',
    borderRadius: 4,
    letterSpacing: '0.05em',
    minWidth: 76,
    textAlign: 'center' as const,
  },
  legendTitle: {
    fontSize: 9,
    color: '#333',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
  },
  legendItems: {
    display: 'flex',
    gap: 14,
    marginTop: 7,
    flexWrap: 'wrap' as const,
  },
  legendItem: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: 2,
  },
}