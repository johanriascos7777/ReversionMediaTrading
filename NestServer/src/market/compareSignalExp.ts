import type { BacktestResultExp } from './backtestEngineExp';
import type { MarketState, SignalComparisonResult } from './types';

export function compareSignalWithHistoryExp(
  current: {
    state: MarketState;
    elasticity: number;
    direction: 'BUY' | 'SELL';
  },
  backtest: BacktestResultExp
): SignalComparisonResult {
  // Banda de similitud proporcional: escala con la elasticidad actual.
  // Corrige la "paradoja de extremos" donde señales con elasticidad >3.0
  // no encontraban eventos similares con la banda fija de ±0.1.
  // Ej: elas 1.5 → ±0.15 | elas 3.0 → ±0.30 | elas 5.08 → ±0.508
  const similarityBand = Math.max(0.15, 0.1 * current.elasticity);

  const similar = backtest.events.filter(
    (e) =>
      e.state === current.state &&
      e.direction === current.direction &&
      Math.abs(e.elasticity - current.elasticity) < similarityBand
  );

  const wins = similar.filter((e) => e.exitIndex !== -1).length;

  return {
    similarSignals: similar.length,
    winRate: similar.length > 0 ? (wins / similar.length) * 100 : 0,
    avgBarsToRevert:
      similar.reduce((a, e) => a + e.barsToRevert, 0) / (similar.length || 1),
  };
}
