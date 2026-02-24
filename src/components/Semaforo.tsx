export type SemaforoProps = {
  state: 'GREEN' | 'YELLOW' | 'RED'
  label?: string
}

export function Semaforo({ state, label }: SemaforoProps) {
  const color =
    state === 'GREEN'
      ? '#16a34a'
      : state === 'YELLOW'
      ? '#eab308'
      : '#dc2626'

  const defaultLabel =
    state === 'GREEN'
      ? 'SETUP VÁLIDO'
      : state === 'YELLOW'
      ? 'ESPERAR'
      : 'NO OPERAR'

  return (
    <div style={{ marginTop: 24 }}>
      {label && (
        <p style={{ textAlign: 'center', opacity: 0.7 }}>
          {label}
        </p>
      )}

      <div
        style={{
          width: 80,
          height: 80,
          borderRadius: '50%',
          backgroundColor: color,
          margin: '0 auto',
        }}
      />

      <h3 style={{ textAlign: 'center', marginTop: 12 }}>
        {defaultLabel}
      </h3>
    </div>
  )
}
