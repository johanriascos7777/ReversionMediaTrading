export type Bar = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

export const CASCADE = {
  emaPeriod: 100,
  atrPeriod: 14,
  stretchAtr5: 3,
  stretchWindow: 60,
  minRoomPips: 4,
  stopLookback: 181,
  stopPadPips: 0.5,
  targetFraction: 0.5,
  timeLimitMin: 175,
  minuteWarmup: 100,
};

const MINUTE = 60_000;

export function pipOf(symbol: string): number {
  return symbol.includes('JPY') ? 0.01 : 0.0001;
}

export class Ema {
  value: number | null = null;
  count = 0;
  private readonly alpha: number;

  constructor(period: number) {
    this.alpha = 2 / (period + 1);
  }

  update(x: number): number {
    this.value =
      this.value === null ? x : this.alpha * x + (1 - this.alpha) * this.value;
    this.count++;
    return this.value;
  }
}

export class WilderAtr {
  value: number | null = null;
  private prevClose: number | null = null;
  private readonly alpha: number;

  constructor(period: number) {
    this.alpha = 1 / period;
  }

  update(bar: Bar): number {
    const pc = this.prevClose ?? bar.close;
    const tr = Math.max(
      bar.high - bar.low,
      Math.abs(bar.high - pc),
      Math.abs(bar.low - pc),
    );
    this.value =
      this.value === null ? tr : this.alpha * tr + (1 - this.alpha) * this.value;
    this.prevClose = bar.close;
    return this.value;
  }
}

export type Side = 1 | -1;

export type CascadeSignal = {
  symbol: string;
  side: Side;
  direction: 'BUY' | 'SELL';
  barTime: number;
  at: number;
  price: number;
  ema1: number;
  ema5: number;
  ema15: number;
  atr5: number;
  stretchAtr5: number;
  roomPips: number;
  ema15Pips: number;
  extreme: number;
};

export type Contract = {
  symbol: string;
  side: Side;
  direction: 'BUY' | 'SELL';
  openedAt: number;
  deadline: number;
  entry: number;
  stop: number;
  target: number;
  initialEma5: number;
  stopPips: number;
  targetPips: number;
  maePips: number;
  mfePips: number;
  alertLogId: number | null;
  stopTouchedAt?: number | null;
  targetTouchedAt?: number | null;
};

export type ContractExit = 'stop' | 'ema' | 'objetivo' | 'tiempo' | 'broker';

export type ContractOutcome = {
  contract: Contract;
  reason: ContractExit;
  exitPrice: number;
  pips: number;
  minutes: number;
  at: number;
};

export function buildContract(signal: CascadeSignal, pip: number): Contract {
  const s = signal.side;
  const stop = signal.extreme + s * CASCADE.stopPadPips * pip;
  const distance = s * (signal.price - signal.ema5);
  const target = signal.price - s * CASCADE.targetFraction * distance;
  return {
    symbol: signal.symbol,
    side: s,
    direction: signal.direction,
    openedAt: signal.at,
    deadline: signal.at + CASCADE.timeLimitMin * MINUTE,
    entry: signal.price,
    stop,
    target,
    initialEma5: signal.ema5,
    stopPips: (s * (stop - signal.price)) / pip,
    targetPips: (CASCADE.targetFraction * distance) / pip,
    maePips: 0,
    mfePips: 0,
    alertLogId: null,
  };
}

export function stepContract(
  c: Contract,
  bar: Bar,
  ema5: number | null,
  pip: number,
  stopExit = true,
  targetExit = true,
): ContractOutcome | null {
  const s = c.side;
  const end = bar.time + MINUTE;
  if (end <= c.openedAt) return null;
  const adverse = s > 0 ? bar.high - c.entry : c.entry - bar.low;
  const favorable = s > 0 ? c.entry - bar.low : bar.high - c.entry;
  c.maePips = Math.max(c.maePips, adverse / pip);
  c.mfePips = Math.max(c.mfePips, favorable / pip);
  const minutes = Math.round((end - c.openedAt) / MINUTE);
  const done = (reason: ContractExit, exitPrice: number): ContractOutcome => ({
    contract: c,
    reason,
    exitPrice,
    pips: (s * (c.entry - exitPrice)) / pip,
    minutes,
    at: end,
  });

  if (s > 0 ? bar.high >= c.stop : bar.low <= c.stop) {
    if (stopExit) return done('stop', c.stop);
    c.stopTouchedAt ??= end;
  }
  if (ema5 !== null && (s > 0 ? bar.low <= ema5 : bar.high >= ema5)) {
    return done('ema', ema5);
  }
  if (s > 0 ? bar.low <= c.target : bar.high >= c.target) {
    if (targetExit) return done('objetivo', c.target);
    c.targetTouchedAt ??= end;
  }
  if (end >= c.deadline) return done('tiempo', bar.close);
  return null;
}

export type CascadeView = {
  price: number | null;
  ema1: number | null;
  ema5: number | null;
  ema15: number | null;
  atr5: number | null;
  direction: 'BUY' | 'SELL' | null;
  stretchAtr5: number | null;
  stretchNeeded: number;
  fan: boolean;
  roomPips: number | null;
  roomNeeded: number;
  ema15Pips: number | null;
  armed: boolean;
  ready: boolean;
  contract: Contract | null;
  lastSignalAt: number | null;
};

export type MinuteEvents = {
  bars: Bar[];
  signals: CascadeSignal[];
  outcomes: ContractOutcome[];
};

export class CascadeEngine {
  private readonly pip: number;
  private readonly ema1 = new Ema(CASCADE.emaPeriod);
  private readonly ema5 = new Ema(CASCADE.emaPeriod);
  private readonly atr5 = new WilderAtr(CASCADE.atrPeriod);
  private readonly ema15 = new Ema(CASCADE.emaPeriod);
  private ema5Value: number | null = null;
  private atr5Value: number | null = null;
  private ema15Value: number | null = null;
  private readonly highs: number[] = [];
  private readonly lows: number[] = [];
  private readonly stretch: number[] = [];
  private prevDiff: number | null = null;
  private lastClose: number | null = null;
  private current: Bar | null = null;
  private last5Time = -Infinity;
  private last15Time = -Infinity;
  contract: Contract | null = null;
  lastSignalAt: number | null = null;
  stopExit = true;
  targetExit = true;

  constructor(readonly symbol: string) {
    this.pip = pipOf(symbol);
  }

  get ready(): boolean {
    return (
      this.ema1.count >= CASCADE.minuteWarmup &&
      this.ema5Value !== null &&
      this.atr5Value !== null &&
      this.atr5Value > 0 &&
      this.ema15Value !== null
    );
  }

  closedM5(bar: Bar): void {
    if (bar.time <= this.last5Time) return;
    this.last5Time = bar.time;
    this.ema5Value = this.ema5.update(bar.close);
    this.atr5Value = this.atr5.update(bar);
  }

  closedM15(bar: Bar): void {
    if (bar.time <= this.last15Time) return;
    this.last15Time = bar.time;
    this.ema15Value = this.ema15.update(bar.close);
  }

  warm(m1: Bar[], m5: Bar[], m15: Bar[]): void {
    let i5 = 0;
    let i15 = 0;
    for (const bar of m1) {
      while (i5 < m5.length && m5[i5].time + 5 * MINUTE <= bar.time)
        this.closedM5(m5[i5++]);
      while (i15 < m15.length && m15[i15].time + 15 * MINUTE <= bar.time)
        this.closedM15(m15[i15++]);
      this.closeMinute(bar, false);
    }
    while (i5 < m5.length) this.closedM5(m5[i5++]);
    while (i15 < m15.length) this.closedM15(m15[i15++]);
    this.current = null;
  }

  tick(price: number, ts: number): MinuteEvents {
    const events: MinuteEvents = { bars: [], signals: [], outcomes: [] };
    const minute = Math.floor(ts / MINUTE) * MINUTE;
    if (this.current && minute < this.current.time) return events;
    if (this.current && minute > this.current.time) {
      const closed = this.current;
      this.current = null;
      events.bars.push(closed);
      const { signal, outcome } = this.closeMinute(closed, true);
      if (outcome) events.outcomes.push(outcome);
      if (signal) events.signals.push(signal);
    }
    if (!this.current) {
      this.current = { time: minute, open: price, high: price, low: price, close: price };
    } else {
      this.current.high = Math.max(this.current.high, price);
      this.current.low = Math.min(this.current.low, price);
      this.current.close = price;
    }
    return events;
  }

  private closeMinute(
    bar: Bar,
    live: boolean,
  ): { signal: CascadeSignal | null; outcome: ContractOutcome | null } {
    const e1 = this.ema1.update(bar.close);
    const e5 = this.ema5Value;
    const a5 = this.atr5Value;
    const e15 = this.ema15Value;
    this.lastClose = bar.close;
    this.push(this.highs, bar.high, CASCADE.stopLookback);
    this.push(this.lows, bar.low, CASCADE.stopLookback);
    this.push(
      this.stretch,
      e5 !== null && a5 ? (bar.close - e5) / a5 : 0,
      CASCADE.stretchWindow,
    );
    const diff = bar.close - e1;
    const prevDiff = this.prevDiff;
    this.prevDiff = diff;

    let outcome: ContractOutcome | null = null;
    if (live && this.contract) {
      outcome = stepContract(this.contract, bar, e5, this.pip, this.stopExit, this.targetExit);
      if (outcome) this.contract = null;
    }
    if (!live || this.contract || !this.ready || prevDiff === null)
      return { signal: null, outcome };

    for (const s of [1, -1] as Side[]) {
      const crossed = s * diff < 0 && s * prevDiff > 0;
      if (!crossed) continue;
      const fan = s * (e1 - e5!) > 0 && s * (e5! - e15!) > 0;
      const stretch = Math.max(...this.stretch.map((u) => s * u));
      const room = (s * (bar.close - e5!)) / this.pip;
      const room15 = (s * (bar.close - e15!)) / this.pip;
      if (!fan || stretch < CASCADE.stretchAtr5 || room < CASCADE.minRoomPips || room15 <= 0)
        continue;
      const at = bar.time + MINUTE;
      const signal: CascadeSignal = {
        symbol: this.symbol,
        side: s,
        direction: s > 0 ? 'SELL' : 'BUY',
        barTime: bar.time,
        at,
        price: bar.close,
        ema1: e1,
        ema5: e5!,
        ema15: e15!,
        atr5: a5!,
        stretchAtr5: stretch,
        roomPips: room,
        ema15Pips: room15,
        extreme: s > 0 ? Math.max(...this.highs) : Math.min(...this.lows),
      };
      this.contract = buildContract(signal, this.pip);
      this.lastSignalAt = at;
      return { signal, outcome };
    }
    return { signal: null, outcome };
  }

  private push(list: number[], value: number, max: number): void {
    list.push(value);
    if (list.length > max) list.shift();
  }

  view(price: number | null): CascadeView {
    const e1 = this.ema1.value;
    const e5 = this.ema5Value;
    const e15 = this.ema15Value;
    const p = price ?? this.lastClose;
    let direction: 'BUY' | 'SELL' | null = null;
    let stretch: number | null = null;
    let fan = false;
    let room: number | null = null;
    let room15: number | null = null;
    if (p !== null && e1 !== null && e5 !== null && e15 !== null) {
      const s: Side = p >= e5 ? 1 : -1;
      direction = s > 0 ? 'SELL' : 'BUY';
      stretch = this.stretch.length ? Math.max(...this.stretch.map((u) => s * u)) : null;
      fan = s * (e1 - e5) > 0 && s * (e5 - e15) > 0;
      room = (s * (p - e5)) / this.pip;
      room15 = (s * (p - e15)) / this.pip;
    }
    return {
      price: p,
      ema1: e1,
      ema5: e5,
      ema15: e15,
      atr5: this.atr5Value,
      direction,
      stretchAtr5: stretch,
      stretchNeeded: CASCADE.stretchAtr5,
      fan,
      roomPips: room,
      roomNeeded: CASCADE.minRoomPips,
      ema15Pips: room15,
      armed:
        this.ready &&
        fan &&
        stretch !== null &&
        stretch >= CASCADE.stretchAtr5 &&
        room !== null &&
        room >= CASCADE.minRoomPips &&
        room15 !== null &&
        room15 > 0,
      ready: this.ready,
      contract: this.contract,
      lastSignalAt: this.lastSignalAt,
    };
  }
}

export function sizeForRisk(
  riskUsd: number,
  stopDistance: number,
  quoteToUsd: number,
  pip: number,
  minStopPips = 3,
): number {
  const distance = Math.max(stopDistance, minStopPips * pip);
  const units = riskUsd / (distance * quoteToUsd);
  return Math.max(0, Math.floor(units / 100) * 100);
}
