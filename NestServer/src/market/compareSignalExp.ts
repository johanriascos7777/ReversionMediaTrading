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
  // Filtra los eventos históricos del backtest experimental que compartan el mismo estado
  // (GREEN), la misma dirección (BUY/SELL) y cuya elasticidad difiera en menos de 0.1
  const similar = backtest.events.filter(
    (e) =>
      e.state === current.state &&
      e.direction === current.direction &&
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
