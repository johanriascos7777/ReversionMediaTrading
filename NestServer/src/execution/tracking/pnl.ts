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

export type OperationInput = {
  id: number;
  symbol: string;
  direction: Direction;
  size: number;
  status: string;
  source: string;
  alertLogId: number | null;
  openedAt: Date;
  trackingSince: Date | null;
  closedAt: Date | null;
  realizedPnl: number | null;
  closeSource: string | null;
  closeReason: string | null;
};

export type OperationRow = {
  id: number;
  symbol: string;
  direction: Direction;
  size: number;
  status: string;
  source: string;
  alertLogId: number | null;
  openedAt: Date;
  closedAt: Date | null;
  totalSec: number;
  slackBeforeGreenSec: number | null;
  bestUsd: number | null;
  bestAt: Date | null;
  bestAfterSec: number | null;
  greenSec: number;
  greenPhases: number;
  worstUsd: number | null;
  worstAt: Date | null;
  resultUsd: number | null;
  resultLive: boolean;
  closeSource: string | null;
  closeReason: string | null;
};

const secondsBetween = (from: Date, to: Date) =>
  Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 1000));

export function operationRow(
  pos: OperationInput,
  phases: PhaseView[],
  livePnl: number | null,
  now: Date,
): OperationRow {
  const ordered = [...phases].sort((a, b) => a.seq - b.seq);
  const start = pos.trackingSince ?? pos.openedAt;
  const end = pos.closedAt ?? now;
  const green = ordered.filter((p) => p.state === 'green');
  const red = ordered.filter((p) => p.state === 'red');
  const best = green.reduce<PhaseView | null>(
    (m, p) => (!m || p.extremePnl > m.extremePnl ? p : m),
    null,
  );
  const worst = red.reduce<PhaseView | null>(
    (m, p) => (!m || p.extremePnl < m.extremePnl ? p : m),
    null,
  );
  const firstGreen = green[0] ?? null;
  const open = pos.status === 'open';
  const last = ordered[ordered.length - 1];
  return {
    id: pos.id,
    symbol: pos.symbol,
    direction: pos.direction,
    size: pos.size,
    status: pos.status,
    source: pos.source,
    alertLogId: pos.alertLogId,
    openedAt: pos.openedAt,
    closedAt: pos.closedAt,
    totalSec: secondsBetween(start, end),
    slackBeforeGreenSec: firstGreen
      ? secondsBetween(start, firstGreen.startedAt)
      : null,
    bestUsd: best ? best.extremePnl : null,
    bestAt: best ? best.extremeAt : null,
    bestAfterSec: best ? secondsBetween(start, best.extremeAt) : null,
    greenSec: green.reduce((s, p) => s + p.durationSec, 0),
    greenPhases: green.length,
    worstUsd: worst ? worst.extremePnl : null,
    worstAt: worst ? worst.extremeAt : null,
    resultUsd: open
      ? (livePnl ?? last?.lastPnl ?? null)
      : (pos.realizedPnl ?? last?.lastPnl ?? null),
    resultLive: open,
    closeSource: pos.closeSource,
    closeReason: pos.closeReason,
  };
}

export type OperationSummary = {
  operations: number;
  closed: number;
  everGreen: number;
  neverGreen: number;
  closedUsd: number;
  openUsd: number;
  wins: number;
  winsUsd: number;
  losses: number;
  lossesUsd: number;
  avgWinUsd: number | null;
  avgLossUsd: number | null;
  closedBy: Record<'objetivo' | 'tiempo' | 'otro', { n: number; usd: number }>;
  slackMedianSec: number | null;
  redAt5: number;
  redAt10: number;
  pastMinute5: number;
  pastMinute10: number;
};

const closeKind = (r: OperationRow): 'objetivo' | 'tiempo' | 'otro' =>
  r.closeSource === 'TP' ? 'objetivo' : r.closeReason === 'contrato-tiempo' ? 'tiempo' : 'otro';

const median = (xs: number[]): number | null => {
  if (xs.length === 0) return null;
  const v = [...xs].sort((a, b) => a - b);
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
};

export function operationSummary(rows: OperationRow[]): OperationSummary {
  const closed = rows.filter((r) => !r.resultLive);
  const open = rows.filter((r) => r.resultLive);
  const sum = (xs: OperationRow[]) =>
    round4(xs.reduce((s, r) => s + (r.resultUsd ?? 0), 0));
  const won = closed.filter((r) => (r.resultUsd ?? 0) > 0);
  const lost = closed.filter((r) => (r.resultUsd ?? 0) < 0);
  const closedBy = { objetivo: { n: 0, usd: 0 }, tiempo: { n: 0, usd: 0 }, otro: { n: 0, usd: 0 } };
  for (const r of closed) {
    const k = closedBy[closeKind(r)];
    k.n += 1;
    k.usd = round4(k.usd + (r.resultUsd ?? 0));
  }
  const redAt = (sec: number) => {
    const past = rows.filter((r) => r.totalSec >= sec);
    return {
      past: past.length,
      red: past.filter((r) => r.slackBeforeGreenSec === null || r.slackBeforeGreenSec > sec).length,
    };
  };
  return {
    operations: rows.length,
    closed: closed.length,
    everGreen: rows.filter((r) => r.greenPhases > 0).length,
    neverGreen: rows.filter((r) => r.greenPhases === 0).length,
    closedUsd: sum(closed),
    openUsd: sum(open),
    wins: won.length,
    winsUsd: sum(won),
    losses: lost.length,
    lossesUsd: sum(lost),
    avgWinUsd: won.length ? round4(sum(won) / won.length) : null,
    avgLossUsd: lost.length ? round4(sum(lost) / lost.length) : null,
    closedBy,
    slackMedianSec: median(
      rows.flatMap((r) => (r.slackBeforeGreenSec === null ? [] : [r.slackBeforeGreenSec])),
    ),
    redAt5: redAt(300).red,
    pastMinute5: redAt(300).past,
    redAt10: redAt(600).red,
    pastMinute10: redAt(600).past,
  };
}
