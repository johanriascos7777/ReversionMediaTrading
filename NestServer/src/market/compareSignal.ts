import type { BacktestResult, MarketState, SignalComparisonResult } from './types';

export function compareSignalWithHistory(
  current: {
    state: MarketState;
    elasticity: number;
  },
  backtest: BacktestResult
): SignalComparisonResult {
  // Filtra los eventos históricos del backtest que compartan el mismo estado 
  // (GREEN) y cuya elasticidad difiera en menos de 0.1 respecto a la actual.
  const similar = backtest.events.filter(
    (e) =>
      e.state === current.state &&
      Math.abs(e.elasticity - current.elasticity) < 0.1
  );

  const wins = similar.filter((e) => e.exitIndex !== -1).length;

  return {
    similarSignals: similar.length,
    winRate: similar.length > 0 ? (wins / similar.length) * 100 : 0,
    avgBarsToRevert:
      similar.reduce((a, e) => a + e.barsToRevert, 0) / (similar.length || 1),
  };
}
