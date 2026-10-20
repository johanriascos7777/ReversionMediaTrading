import type { Direction } from '../broker.types';
import type { PnlModel, PnlState } from './pnl-phase.entity';

export const PNL_MODELS: PnlModel[] = ['capital', 'pip1'];

export const pipSize = (symbol: string) =>
  symbol.includes('JPY') ? 0.01 : 0.0001;

export const stateOf = (pnl: number): PnlState => (pnl > 0 ? 'green' : 'red');

export const currencies = (symbol: string) => {
  const [base = '', quote = ''] = symbol.split('/').map((s) => s.trim());
  return { base, quote };
};

const round4 = (n: number) => Math.round(n * 10_000) / 10_000;

export type PnlInput = {
  symbol: string;
  direction: Direction;
  size: number;
  level: number;
  bid: number;
  offer: number;
  upl: number | null;
  entrySpread: number;
  fx: number;
};

export function pnlModels(i: PnlInput): Record<PnlModel, number> & {
  spread: number;
} {
  const dir = i.direction === 'BUY' ? 1 : -1;
  const spread = i.offer - i.bid;
  const exit = i.direction === 'BUY' ? i.bid : i.offer;
  const capital = i.upl ?? dir * (exit - i.level) * i.size * i.fx;
  const pip1 =
    capital +
    ((i.entrySpread + spread) / 2 - pipSize(i.symbol)) * i.size * i.fx;
  return { capital: round4(capital), pip1: round4(pip1), spread };
}

export type PhaseFields = {
  state: PnlState;
  seq: number;
  startedAt: Date;
  endedAt?: Date | null;
  lastSeenAt: Date;
  startPnl: number;
  lastPnl: number;
  extremePnl: number;
  extremeAt: Date;
  samples: number;
  gapSec: number;
};

export function applyPnl<T extends PhaseFields>(
  current: T | null,
  pnl: number,
  at: Date,
  firstStart: Date,
  gapMs: number,
): { active: PhaseFields; ended: T | null; created: boolean } {
  const state = stateOf(pnl);
  if (current) {
    const silence = at.getTime() - new Date(current.lastSeenAt).getTime();
    if (silence > gapMs) current.gapSec += Math.round(silence / 1000);
  }
  if (current && current.state === state) {
    current.lastSeenAt = at;
    current.lastPnl = pnl;
    current.samples += 1;
    const extreme = Number(current.extremePnl);
    if (state === 'green' ? pnl > extreme : pnl < extreme) {
      current.extremePnl = pnl;
      current.extremeAt = at;
    }
    return { active: current, ended: null, created: false };
  }
  if (current) current.endedAt = at;
  return {
    active: {
      state,
      seq: current ? current.seq + 1 : 1,
      startedAt: current ? at : firstStart,
      endedAt: null,
      lastSeenAt: at,
      startPnl: pnl,
      lastPnl: pnl,
      extremePnl: pnl,
      extremeAt: at,
      samples: 1,
      gapSec: 0,
    },
    ended: current,
    created: true,
  };
}

export type PhaseView = {
  seq: number;
  state: PnlState;
  startedAt: Date;
  endedAt: Date | null;
  durationSec: number;
  startPnl: number;
  lastPnl: number;
  extremePnl: number;
  extremeAt: Date;
  samples: number;
  gapSec: number;
};

export function phaseView(p: PhaseFields, now: Date): PhaseView {
  const end = p.endedAt ? new Date(p.endedAt) : now;
  return {
    seq: p.seq,
    state: p.state,
    startedAt: p.startedAt,
    endedAt: p.endedAt ?? null,
    durationSec: Math.max(
      0,
      Math.round((end.getTime() - new Date(p.startedAt).getTime()) / 1000),
    ),
    startPnl: Number(p.startPnl),
    lastPnl: Number(p.lastPnl),
    extremePnl: Number(p.extremePnl),
    extremeAt: p.extremeAt,
    samples: p.samples,
    gapSec: p.gapSec,
  };
}

export type ModelSummary = {
  current: PhaseView | null;
  phases: number;
  redSec: number;
  greenSec: number;
  firstGreenAfterSec: number | null;
};

export function summarize(
  phases: PhaseView[],
  since: Date | null,
): ModelSummary {
  const ordered = [...phases].sort((a, b) => a.seq - b.seq);
  const firstGreen = ordered.find((p) => p.state === 'green');
  return {
    current: ordered.find((p) => !p.endedAt) ?? null,
    phases: ordered.length,
    redSec: ordered
      .filter((p) => p.state === 'red')
      .reduce((s, p) => s + p.durationSec, 0),
    greenSec: ordered
      .filter((p) => p.state === 'green')
      .reduce((s, p) => s + p.durationSec, 0),
    firstGreenAfterSec:
      firstGreen && since
        ? Math.round(
            (new Date(firstGreen.startedAt).getTime() -
              new Date(since).getTime()) /
              1000,
          )
        : null,
  };
}
