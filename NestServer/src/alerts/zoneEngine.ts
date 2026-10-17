export type ZoneBar = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

export type ZoneModel = {
  bars: number;
  fromTime: number;
  toTime: number;
  gate: number;
  q50: number;
  q75: number;
  q90: number;
  episodes: number;
  residual: { count: number; median: number; p90: number; max: number };
  touchWithinBars: { bars: number; count: number; touched: number };
};

export const ZONE_DEFAULTS = {
  emaPeriod: 100,
  atrPeriod: 14,
  gateQuantile: 0.8,
  zoneQuantile: 0.75,
  touchBars: 48,
  minEpisodes: 10,
};

export function emaSeries(
  closes: number[],
  period = ZONE_DEFAULTS.emaPeriod,
): (number | null)[] {
  const out: (number | null)[] = new Array(closes.length).fill(null);
  if (closes.length < period) return out;
  const alpha = 2 / (period + 1);
  let ema = closes.slice(0, period).reduce((s, v) => s + v, 0) / period;
  out[period - 1] = ema;
  for (let i = period; i < closes.length; i++) {
    ema = alpha * closes[i] + (1 - alpha) * ema;
    out[i] = ema;
  }
  return out;
}

export function atrSeries(
  bars: ZoneBar[],
  period = ZONE_DEFAULTS.atrPeriod,
): (number | null)[] {
  const out: (number | null)[] = new Array(bars.length).fill(null);
  const tr: number[] = new Array(bars.length).fill(0);
  for (let i = 1; i < bars.length; i++) {
    const prev = bars[i - 1].close;
    tr[i] = Math.max(
      bars[i].high - bars[i].low,
      Math.abs(bars[i].high - prev),
      Math.abs(bars[i].low - prev),
    );
  }
  let sum = 0;
  for (let i = 1; i < bars.length; i++) {
    sum += tr[i];
    if (i > period) sum -= tr[i - period];
    if (i >= period) out[i] = sum / period;
  }
  return out;
}

export function quantile(sorted: number[], p: number): number {
  if (sorted.length === 0) return NaN;
  const k = (sorted.length - 1) * p;
  const f = Math.floor(k);
  const c = Math.min(f + 1, sorted.length - 1);
  return sorted[f] + (sorted[c] - sorted[f]) * (k - f);
}

type RawEpisode = {
  side: 1 | -1;
  peak: number;
  exts: number[];
  startIndex: number;
  endIndex: number;
};

function collectEpisodes(
  bars: ZoneBar[],
  ema: (number | null)[],
  atr: (number | null)[],
) {
  const episodes: RawEpisode[] = [];
  const distances: number[] = [];
  let current: RawEpisode | null = null;

  for (let i = 0; i < bars.length; i++) {
    const e = ema[i];
    const a = atr[i];
    if (e === null || a === null || a <= 0) continue;
    const bar = bars[i];
    distances.push(Math.abs(bar.close - e) / a);

    if (bar.low <= e && e <= bar.high) {
      if (current) {
        current.endIndex = i;
        episodes.push(current);
        current = null;
      }
      continue;
    }

    const side: 1 | -1 = bar.low > e ? 1 : -1;
    const ext = side === 1 ? (bar.high - e) / a : (e - bar.low) / a;
    if (!current || current.side !== side) {
      if (current) {
        current.endIndex = i;
        episodes.push(current);
      }
      current = { side, peak: ext, exts: [ext], startIndex: i, endIndex: -1 };
    } else {
      current.peak = Math.max(current.peak, ext);
      current.exts.push(ext);
    }
  }
  return { episodes, distances };
}

export function buildZoneModel(
  bars: ZoneBar[],
  options: Partial<typeof ZONE_DEFAULTS> = {},
): ZoneModel | null {
  const opts = { ...ZONE_DEFAULTS, ...options };
  const ema = emaSeries(
    bars.map((b) => b.close),
    opts.emaPeriod,
  );
  const atr = atrSeries(bars, opts.atrPeriod);
  const { episodes, distances } = collectEpisodes(bars, ema, atr);
  if (distances.length === 0) return null;

  const gate = quantile(
    [...distances].sort((x, y) => x - y),
    opts.gateQuantile,
  );
  const selected = episodes.filter((ep) => ep.peak >= gate);
  if (selected.length === 0) return null;
  const peaks = selected.map((ep) => ep.peak).sort((x, y) => x - y);
  const q50 = quantile(peaks, 0.5);
  const q75 = quantile(peaks, opts.zoneQuantile);
  const q90 = quantile(peaks, 0.9);

  const beyond = selected.filter((ep) => ep.peak >= q75);
  const residuals = beyond.map((ep) => ep.peak - q75).sort((x, y) => x - y);
  let touched = 0;
  for (const ep of beyond) {
    const reached = ep.exts.findIndex((x) => x >= q75);
    const reachedIndex = ep.startIndex + reached;
    if (ep.endIndex - reachedIndex <= opts.touchBars) touched++;
  }

  return {
    bars: bars.length,
    fromTime: bars[0].time,
    toTime: bars[bars.length - 1].time,
    gate,
    q50,
    q75,
    q90,
    episodes: selected.length,
    residual: {
      count: residuals.length,
      median: residuals.length ? quantile(residuals, 0.5) : 0,
      p90: residuals.length ? quantile(residuals, 0.9) : 0,
      max: residuals.length ? residuals[residuals.length - 1] : 0,
    },
    touchWithinBars: { bars: opts.touchBars, count: beyond.length, touched },
  };
}

export function lastValue(series: (number | null)[]): number | null {
  for (let i = series.length - 1; i >= 0; i--) {
    const v = series[i];
    if (v !== null) return v;
  }
  return null;
}
