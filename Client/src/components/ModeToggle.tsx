import { useState } from 'react'
import type { useExecution } from '@/hooks/useExecution'

type Props = { execution: ReturnType<typeof useExecution> }

export function ModeToggle({ execution }: Props) {
  const { config, busy, setAuto } = execution
  const [asking, setAsking] = useState(false)
  if (!config) return null

  const auto = config.auto
  const disabled = busy || (!auto && !config.autoAllowed)
  const color = auto ? '#10b981' : '#f59e0b'

  const click = async () => {
    if (disabled) return
    if (auto) {
      await setAuto(false)
      return
    }
    setAsking(true)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '8px 14px', borderRadius: 12, border: `2px solid ${color}`, background: auto ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)', boxShadow: `0 0 14px ${color}55` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: auto ? '#6b7280' : color }}>OFF</span>
        <span
          role="switch"
          aria-checked={auto}
          aria-label="Modo automático"
          title={config.autoAllowed ? '' : 'Necesita un broker en demo'}
          onClick={click}
          style={{ width: 52, height: 28, borderRadius: 14, background: color, position: 'relative', display: 'inline-block', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1, transition: 'background .2s' }}
        >
          <span style={{ position: 'absolute', top: 3, left: auto ? 27 : 3, width: 22, height: 22, borderRadius: 11, background: '#fff', transition: 'left .2s' }} />
        </span>
        <span style={{ fontSize: 13, fontWeight: 800, color: auto ? color : '#6b7280' }}>ON</span>
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color }}>
        {auto ? 'Modo automático' : 'Modo manual'}
      </span>
      {asking && (
        <span style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 11 }}>
          <span style={{ color: '#fbbf24' }}>¿Abrir cada alerta sola en el broker?</span>
          <button disabled={busy} onClick={async () => { await setAuto(true); setAsking(false) }} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer' }}>Sí</button>
          <button disabled={busy} onClick={() => setAsking(false)} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, border: 'none', background: '#374151', color: '#fff', cursor: 'pointer' }}>No</button>
        </span>
      )}
    </div>
  )
}
