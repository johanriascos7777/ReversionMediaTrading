export const OUTCOME_WINDOW_MS = 24 * 60 * 60 * 1000;

export type TrackedAlert = {
  id: number;
  version: string;
  symbol: string;
  direction: 'BUY' | 'SELL';
  price: number;
  createdAt: number;
  maePips: number;
  mfePips: number;
  status: 'open' | 'touched' | 'expired';
  touchedAt: number | null;
  minutesToEma: number | null;
  dirty: boolean;
};

export function applyPrice(
  alert: TrackedAlert,
  high: number,
  low: number,
  ema: number | null,
  ts: number,
  pip: number,
): void {
  if (alert.status !== 'open' || ts < alert.createdAt) return;

  const adverse =
    alert.direction === 'SELL'
      ? (high - alert.price) / pip
      : (alert.price - low) / pip;
  const favorable =
    alert.direction === 'SELL'
      ? (alert.price - low) / pip
      : (high - alert.price) / pip;
  if (adverse > alert.maePips) {
    alert.maePips = adverse;
    alert.dirty = true;
  }
  if (favorable > alert.mfePips) {
    alert.mfePips = favorable;
    alert.dirty = true;
  }

  const touched =
    ema !== null && (alert.direction === 'SELL' ? low <= ema : high >= ema);
  if (touched) {
    alert.status = 'touched';
    alert.touchedAt = ts;
    alert.minutesToEma = Math.round((ts - alert.createdAt) / 60_000);
    alert.dirty = true;
    return;
  }

  if (ts - alert.createdAt >= OUTCOME_WINDOW_MS) {
    alert.status = 'expired';
    alert.dirty = true;
  }
}

export type VersionSummary = {
  version: string;
  alerts: number;
  open: number;
  maeMedian: number | null;
  maeP90: number | null;
  maeMax: number | null;
  touchedWithin4h: number;
  decided4h: number;
  minutesToEmaMedian: number | null;
  closed: number;
  wins: number;
  pipsMean: number | null;
  pipsWorst: number | null;
};

function q(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const k = (sorted.length - 1) * p;
  const f = Math.floor(k);
  const c = Math.min(f + 1, sorted.length - 1);
  return sorted[f] + (sorted[c] - sorted[f]) * (k - f);
}

export function summarize(
  rows: Array<{
    version: string;
    status: string;
    maePips: number | null;
    minutesToEma: number | null;
    createdAt: number;
    pips?: number | null;
  }>,
  now: number,
): VersionSummary[] {
  const byVersion = new Map<string, typeof rows>();
  for (const r of rows)
    byVersion.set(r.version, [...(byVersion.get(r.version) ?? []), r]);

  return [...byVersion.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([version, list]) => {
      const maes = list
        .map((r) => r.maePips)
        .filter((x): x is number => x !== null)
        .sort((a, b) => a - b);
      const minutes = list
        .map((r) => r.minutesToEma)
        .filter((x): x is number => x !== null)
        .sort((a, b) => a - b);
      const decided = list.filter(
        (r) =>
          (r.minutesToEma !== null && r.minutesToEma <= 240) ||
          now - r.createdAt >= 4 * 60 * 60 * 1000,
      );
      const pips = list
        .map((r) => r.pips)
        .filter((x): x is number => x !== null && x !== undefined);
      return {
        version,
        alerts: list.length,
        open: list.filter((r) => r.status === 'open').length,
        maeMedian: q(maes, 0.5),
        maeP90: q(maes, 0.9),
        maeMax: maes.length ? maes[maes.length - 1] : null,
        touchedWithin4h: decided.filter(
          (r) => r.minutesToEma !== null && r.minutesToEma <= 240,
        ).length,
        decided4h: decided.length,
        minutesToEmaMedian: q(minutes, 0.5),
        closed: pips.length,
        wins: pips.filter((p) => p > 0).length,
        pipsMean: pips.length
          ? pips.reduce((a, b) => a + b, 0) / pips.length
          : null,
        pipsWorst: pips.length ? Math.min(...pips) : null,
      };
    });
}
