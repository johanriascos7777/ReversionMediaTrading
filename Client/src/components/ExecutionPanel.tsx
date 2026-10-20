import { useState } from 'react'
import type { useExecution, ExecutionPosition, OpenOrder } from '../hooks/useExecution'

const cell: React.CSSProperties = { padding: '6px 8px', borderBottom: '1px solid rgba(255,255,255,0.05)', whiteSpace: 'nowrap' }
const head: React.CSSProperties = { ...cell, color: '#6b7280', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', textAlign: 'left' }
const input: React.CSSProperties = {
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 6,
  color: '#f3f4f6',
  padding: '6px 8px',
  fontSize: 12,
  fontFamily: 'monospace',
}
const button = (bg: string, active = true): React.CSSProperties => ({
  background: active ? bg : 'rgba(255,255,255,0.06)',
  border: 'none',
  borderRadius: 6,
  color: active ? '#fff' : '#9ca3af',
  padding: '6px 12px',
  fontSize: 12,
  fontWeight: 700,
  cursor: 'pointer',
})

const decimals = (symbol: string) => (symbol.includes('JPY') ? 3 : 5)
const price = (symbol: string, n: number | null) => (n === null ? '—' : n.toFixed(decimals(symbol)))
const optional = (v: string) => (v.trim() === '' ? undefined : Number(v))

function CloseToggle({ position, busy, onClose }: { position: ExecutionPosition; busy: boolean; onClose: (id: number) => void }) {
  const [asking, setAsking] = useState(false)
  if (asking) {
    return (
      <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
        <span style={{ color: '#fca5a5' }}>¿Cerrar?</span>
        <button style={button('#dc2626')} disabled={busy} onClick={() => onClose(position.id)}>Sí</button>
        <button style={button('#374151')} disabled={busy} onClick={() => setAsking(false)}>No</button>
      </span>
    )
  }
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
      <span
        role="switch"
        aria-checked={false}
        onClick={() => setAsking(true)}
        style={{ width: 30, height: 16, borderRadius: 8, background: '#10b981', position: 'relative', display: 'inline-block' }}
      >
        <span style={{ position: 'absolute', top: 2, left: 16, width: 12, height: 12, borderRadius: 6, background: '#fff' }} />
      </span>
      <span>cerrar</span>
    </label>
  )
}

export function ExecutionPanel({ execution }: { execution: ReturnType<typeof useExecution> }) {
  const { config, positions, error, busy, open, close, setAuto } = execution
  const [askingAuto, setAskingAuto] = useState(false)
  const [symbolChoice, setSymbol] = useState('')
  const [direction, setDirection] = useState<'BUY' | 'SELL'>('BUY')
  const [sizeChoice, setSize] = useState('')
  const [stop, setStop] = useState('')
  const [profit, setProfit] = useState('')
  const [brokerChoice, setBroker] = useState('')
  const [pending, setPending] = useState<OpenOrder | null>(null)

  const locked = new Set(positions.map((p) => p.symbol))
  const symbol = symbolChoice || config?.symbols.find((s) => !locked.has(s)) || config?.symbols[0] || ''
  const broker = brokerChoice || config?.defaultBroker || ''
  const size = sizeChoice || String(config?.defaultSize ?? '')

  const brokerInfo = config?.brokers.find((b) => b.id === broker)

  const prepare = () =>
    setPending({
      broker,
      symbol,
      direction,
      size: Number(size),
      stopLevel: optional(stop),
      profitLevel: optional(profit),
    })

  const confirm = async () => {
    if (!pending) return
    const ok = await open(pending)
    if (ok) {
      setPending(null)
      setStop('')
      setProfit('')
    }
  }

  return (
    <div className="glass-panel" style={{ margin: '0 0 16px' }}>
      <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 4px', color: '#fff' }}>🤖 Operaciones abiertas</h3>
      <p style={{ margin: '0 0 12px', fontSize: 12, color: '#9ca3af', lineHeight: 1.4 }}>
        Mientras un par tenga una operación abierta, sus alertas se guardan en el marcador pero no llegan a Telegram. Se cierran a mano con el interruptor.
      </p>
      {config && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', margin: '0 0 12px', padding: '8px 12px', borderRadius: 8, fontSize: 12, background: config.auto ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.03)', border: `1px solid ${config.auto ? 'rgba(16,185,129,0.4)' : 'rgba(255,255,255,0.08)'}`, color: '#d1d5db' }}>
          <span
            role="switch"
            aria-checked={config.auto}
            onClick={() => !busy && config.autoAllowed && setAskingAuto(true)}
            style={{ width: 34, height: 18, borderRadius: 9, background: config.auto ? '#10b981' : '#4b5563', position: 'relative', display: 'inline-block', cursor: config.autoAllowed ? 'pointer' : 'not-allowed', opacity: config.autoAllowed ? 1 : 0.5 }}
          >
            <span style={{ position: 'absolute', top: 2, left: config.auto ? 18 : 2, width: 14, height: 14, borderRadius: 7, background: '#fff' }} />
          </span>
          <strong style={{ color: config.auto ? '#34d399' : '#9ca3af' }}>
            Entrada automática {config.auto ? 'ACTIVADA' : 'apagada'}
          </strong>
          <span style={{ color: '#9ca3af' }}>
            {config.autoAllowed
              ? `cada alerta abre ${config.defaultSize} u. en ${config.brokers.find((b) => b.id === config.defaultBroker)?.label ?? config.defaultBroker} con el SL de la alerta`
              : 'necesita un broker en demo'}
          </span>
          {askingAuto && (
            <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
              <span style={{ color: '#fbbf24' }}>{config.auto ? '¿Apagar?' : '¿Activar?'}</span>
              <button style={button('#2563eb')} disabled={busy} onClick={async () => { await setAuto(!config.auto); setAskingAuto(false) }}>Sí</button>
              <button style={button('#374151')} disabled={busy} onClick={() => setAskingAuto(false)}>No</button>
            </span>
          )}
        </div>
      )}
      {error && <p style={{ margin: '0 0 12px', fontSize: 12, color: '#f87171' }}>{error}</p>}

      <div style={{ overflowX: 'auto', marginBottom: 16 }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12, fontFamily: 'monospace', color: '#d1d5db' }}>
          <thead>
            <tr>
              <th style={head}>Hora</th>
              <th style={head}>Par</th>
              <th style={head}>Dir.</th>
              <th style={head}>Tamaño</th>
              <th style={head}>Entrada</th>
              <th style={head}>SL</th>
              <th style={head}>TP</th>
              <th style={head}>Broker</th>
              <th style={head}>Origen</th>
              <th style={head}></th>
            </tr>
          </thead>
          <tbody>
            {positions.length === 0 && (
              <tr><td style={cell} colSpan={10}>No hay operaciones abiertas.</td></tr>
            )}
            {positions.map((p) => (
              <tr key={p.id}>
                <td style={cell}>{new Date(p.openedAt).toLocaleString('es-CO', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                <td style={{ ...cell, color: '#fbbf24' }}>🔒 {p.symbol}</td>
                <td style={{ ...cell, color: p.direction === 'BUY' ? '#34d399' : '#f87171' }}>{p.direction}</td>
                <td style={cell}>{p.size}</td>
                <td style={cell}>{price(p.symbol, p.openPrice)}</td>
                <td style={cell}>{price(p.symbol, p.stopLevel)}</td>
                <td style={cell}>{price(p.symbol, p.profitLevel)}</td>
                <td style={{ ...cell, color: p.live ? '#fbbf24' : undefined }} title={p.note ?? undefined}>
                  {p.brokerLabel}{p.note ? ' ⚠️' : ''}
                </td>
                <td style={cell}>{p.source === 'frontend' ? 'panel' : `${p.source === 'auto' ? 'auto · ' : ''}alerta${p.alertLogId ? ` #${p.alertLogId}` : ''}`}</td>
                <td style={cell}><CloseToggle position={p} busy={busy} onClose={close} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {config && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', fontSize: 12, color: '#d1d5db' }}>
          <select style={input} value={symbol} onChange={(e) => setSymbol(e.target.value)}>
            {config.symbols.map((s) => (
              <option key={s} value={s} disabled={locked.has(s)}>{locked.has(s) ? `🔒 ${s} (abierta)` : s}</option>
            ))}
          </select>
          <button style={button('#059669', direction === 'BUY')} onClick={() => setDirection('BUY')}>BUY</button>
          <button style={button('#dc2626', direction === 'SELL')} onClick={() => setDirection('SELL')}>SELL</button>
          <input style={{ ...input, width: 90 }} type="number" min={1} max={config.maxSize} value={size} onChange={(e) => setSize(e.target.value)} title="Unidades" />
          <input style={{ ...input, width: 100 }} placeholder="SL (opcional)" value={stop} onChange={(e) => setStop(e.target.value)} />
          <input style={{ ...input, width: 100 }} placeholder="TP (opcional)" value={profit} onChange={(e) => setProfit(e.target.value)} />
          <select style={input} value={broker} onChange={(e) => setBroker(e.target.value)}>
            {config.brokers.map((b) => (
              <option key={b.id} value={b.id}>{b.label}</option>
            ))}
          </select>
          {!pending && (
            <button style={button('#2563eb', !!symbol && !locked.has(symbol))} disabled={!symbol || locked.has(symbol) || busy} onClick={prepare}>
              Abrir
            </button>
          )}
          {pending && (
            <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
              <span style={{ color: brokerInfo?.live ? '#fbbf24' : '#93c5fd' }}>
                {pending.direction} {pending.symbol} · {pending.size} u. en {brokerInfo?.label ?? pending.broker}
              </span>
              <button style={button('#2563eb')} disabled={busy} onClick={confirm}>{busy ? 'Abriendo…' : 'Confirmar'}</button>
              <button style={button('#374151')} disabled={busy} onClick={() => setPending(null)}>Cancelar</button>
            </span>
          )}
        </div>
      )}
    </div>
  )
}
