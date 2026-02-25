import type { BacktestResult } from '@/backtest/types'

export function BacktestMetrics({ data }: { data: BacktestResult }) {
  return (
    <div style={{ marginTop: 24, padding: 16, border: '1px solid #333' }}>
      <h3>📊 Backtesting (últimas horas)</h3>
      <p>Señales: {data.totalSignals}</p>
      <p>Win rate: {data.winRate}%</p>
      <p>Velas promedio a reversión: {data.avgBarsToRevert}</p>
    </div>
  )
}
