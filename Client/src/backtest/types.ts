/**
 * backtest/types.ts
 *
 * Tipos del módulo de backtesting.
 * Todos los archivos de backtest importan desde aquí.
 */

// Una vela OHLC estándar
export type Candle = {
  time:  number
  open:  number
  high:  number
  low:   number
  close: number
}

export type HistoricalMarketData = {
  candles: Candle[]
}

/**
 * Configuración que recibe runBacktest.
 * emaPeriod      → velas para calcular la EMA de referencia
 * maxBarsToRevert → máximo de velas que esperamos para que el precio revierta
 */
export type BacktestConfig = {
  emaPeriod:       number
  maxBarsToRevert: number
}

/**
 * Un evento registrado durante el backtest.
 * Guarda estado y elasticidad para que compareSignalWithHistory
 * pueda buscar situaciones similares a la señal actual.
 */
export type BacktestEvent = {
  entryIndex:   number
  exitIndex:    number   // -1 si no revirtió (loss)
  barsToRevert: number
  state:        'GREEN' | 'YELLOW' | 'RED'
  elasticity:   number
}

/**
 * Resultado completo del backtest.
 * events es necesario para compareSignalWithHistory.
 */
export type BacktestResult = {
  totalSignals:    number
  wins:            number
  winRate:         number
  avgBarsToRevert: number
  events:          BacktestEvent[]
}

export type CurrentSignal = {
  elasticity: number
  state:      'bullish' | 'bearish' | 'neutral'
}

export type SignalMatchResult = {
  similarSignals:  number
  winRate:         number
  avgBarsToRevert: number
}