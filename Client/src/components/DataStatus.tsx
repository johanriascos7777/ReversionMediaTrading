/**
 * DataStatus.tsx
 *
 * Panel de verificación de conexión con datos reales.
 * Muestra de dónde viene cada dato para confirmar que no es simulación.
 *
 * Úsalo temporalmente en App.tsx para verificar la conexión.
 * Una vez confirmado, puedes quitarlo del dashboard.
 */

import type { FinalMarketView } from '../hooks/useMarketData'
import type { Candle } from '../backtest/types'
import type { BacktestResult } from '../backtest/types'

type DataStatusProps = {
  market: FinalMarketView | null
  historical: Candle[] | null
  backtest: BacktestResult | null
}

type StatusRowProps = {
  label: string
  ok: boolean
  detail: string
}

function StatusRow({ label, ok, detail }: StatusRowProps) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '8px 0',
      borderBottom: '1px solid #1a1a1a',
    }}>
      {/* Indicador */}
      <div style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        flexShrink: 0,
        background: ok ? '#16a34a' : '#dc2626',
        boxShadow: ok ? '0 0 6px #16a34a' : '0 0 6px #dc2626',
      }} />

      {/* Label */}
      <span style={{ fontSize: 12, color: '#888', minWidth: 160, fontFamily: 'monospace' }}>
        {label}
      </span>

      {/* Detalle */}
      <span style={{ fontSize: 12, color: ok ? '#16a34a' : '#dc2626' }}>
        {detail}
      </span>
    </div>
  )
}

export function DataStatus({ market, historical, backtest }: DataStatusProps) {

  // ── Verificaciones ────────────────────────────────────────────────────────

  // 1. WebSocket — precio real llega si market existe y cambia
  const wsOk      = market !== null
  const wsPrice   = market ? market.m5.price.toFixed(5) : '—'
  const wsTs      = market ? new Date(market.m5.timestamp).toLocaleTimeString() : '—'

  // 2. Velas históricas — si son reales, el primer datetime no es "ahora"
  const histOk    = historical !== null && historical.length >= 100
  const histCount = historical ? historical.length : 0
  const histFirst = historical && historical.length > 0
    ? new Date(historical[0].time).toLocaleTimeString()
    : '—'
  const histLast  = historical && historical.length > 0
    ? new Date(historical[historical.length - 1].time).toLocaleTimeString()
    : '—'

  // 3. Backtest real — si está conectado al motor real, totalSignals no es
  //    igual a wins (Math.random hacía wins === totalSignals siempre)
  const btOk      = backtest !== null && backtest.totalSignals !== backtest.wins
  const btSignals = backtest ? backtest.totalSignals : 0
  const btWins    = backtest ? backtest.wins : 0
  const btWR      = backtest ? backtest.winRate : 0

  // 4. EMA real — si es real, ema100 es diferente al precio (no iguales)
  const emaOk     = market
    ? Math.abs(market.m5.price - market.m5.ema100) > 0.00001
    : false
  const emaVal    = market ? market.m5.ema100.toFixed(5) : '—'

  // 5. ATR real — si es real, no es el fallback 0.0006 exacto
  const atrOk     = market ? market.m5.atr !== 0.0006 : false
  const atrVal    = market ? market.m5.atr.toFixed(6) : '—'

  const allOk = wsOk && histOk && btOk && emaOk && atrOk

  return (
    <div style={{
      background: '#0d0d0d',
      border: `1px solid ${allOk ? '#16a34a44' : '#dc262644'}`,
      borderRadius: 8,
      padding: '14px 16px',
      fontFamily: 'system-ui, sans-serif',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 12, color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Estado de conexión
        </span>
        <span style={{
          fontSize: 11,
          fontWeight: 700,
          padding: '3px 10px',
          borderRadius: 12,
          color: allOk ? '#16a34a' : '#dc2626',
          background: allOk ? 'rgba(22,163,74,0.1)' : 'rgba(220,38,38,0.1)',
        }}>
          {allOk ? '✓ DATOS REALES' : '⚠ VERIFICAR'}
        </span>
      </div>

      {/* Filas de verificación */}
      <StatusRow
        label="WebSocket (precio vivo)"
        ok={wsOk}
        detail={wsOk ? `${wsPrice} · ${wsTs}` : 'Sin conexión'}
      />
      <StatusRow
        label="EMA100 (velas cerradas)"
        ok={emaOk}
        detail={emaOk ? `${emaVal}` : 'Usando fallback o mock'}
      />
      <StatusRow
        label="ATR14 (velas cerradas)"
        ok={atrOk}
        detail={atrOk ? `${atrVal}` : 'Usando fallback 0.0006'}
      />
      <StatusRow
        label="Historial REST"
        ok={histOk}
        detail={histOk
          ? `${histCount} velas · desde ${histFirst} hasta ${histLast}`
          : `Solo ${histCount} velas (necesita ≥ 100)`}
      />
      <StatusRow
        label="Backtest (motor real)"
        ok={btOk}
        detail={btOk
          ? `${btSignals} señales · ${btWins} wins · WR ${btWR}%`
          : backtest
            ? `WR 100% con ${btSignals} señales = datos ficticios`
            : 'Sin datos de backtest'}
      />

      {/* Nota */}
      <p style={{ margin: '10px 0 0', fontSize: 10, color: '#333', fontFamily: 'monospace' }}>
        * EMA/ATR se actualizan cada 5 min (M5) y cada 15 min (M15) con velas cerradas reales.
      </p>
    </div>
  )
}