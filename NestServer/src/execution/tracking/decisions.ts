import type { Direction } from '../broker.types';
import { pipSize } from './pnl';

export type Decision = 'tomada' | 'dejada' | 'rechazada' | 'bloqueada';

export type AlertInput = {
  id: number;
  symbol: string;
  direction: Direction;
  createdAt: Date;
  status: string;
  maePips: number | null;
  mfePips: number | null;
  features: Record<string, any> | null;
};

export type PositionInput = {
  id: number;
  status: string;
  realizedPnl: number | null;
};

export type DecisionRow = {
  alertId: number;
  at: string;
  symbol: string;
  direction: Direction;
  decision: Decision;
  positionId: number | null;
  finished: boolean;
  reason: string;
  reachedTarget: boolean;
  pips: number | null;
  minutes: number | null;
  maePips: number | null;
  mfePips: number | null;
  contractUsd: number | null;
  realUsd: number | null;
  copilot: string | null;
};

export type DecisionGroup = {
  alerts: number;
  finished: number;
  reachedTarget: number;
  contractUsd: number;
  withUsd: number;
  realUsd: number | null;
};

const MAX_CONTRACT_MINUTES = 240;

const round2 = (n: number) => Math.round(n * 100) / 100;

export function decisionRow(alert: AlertInput, position: PositionInput | null): DecisionRow {
  const f = alert.features ?? {};
  const outcome = f.outcome ?? null;
  const contract = f.contract ?? null;
  const decision: Decision = position
    ? position.status === 'failed'
      ? 'rechazada'
      : 'tomada'
    : f.telegramSuppressedBy !== undefined
      ? 'bloqueada'
      : 'dejada';
  const finished = alert.status !== 'open' && outcome !== null;
  const usable =
    finished &&
    !(decision === 'rechazada' && outcome.reason === 'broker') &&
    !(typeof outcome.minutes === 'number' && outcome.minutes > MAX_CONTRACT_MINUTES);
  const pips = usable && typeof outcome.pips === 'number' ? outcome.pips : null;
  const size = Number(contract?.size);
  const quoteToUsd = Number(contract?.quoteToUsd);
  const contractUsd =
    pips !== null && size > 0 && quoteToUsd > 0
      ? round2(pips * pipSize(alert.symbol) * size * quoteToUsd)
      : null;
  const reachedTarget =
    usable &&
    (outcome.reason === 'objetivo' ||
      outcome.reason === 'ema' ||
      Boolean(outcome.targetTouchedAt) ||
      outcome.broker?.source === 'TP');
  return {
    alertId: alert.id,
    at: alert.createdAt.toISOString(),
    symbol: alert.symbol,
    direction: alert.direction,
    decision,
    positionId: position?.id ?? null,
    finished,
    reason: finished ? (usable ? String(outcome.reason) : 'sin-resultado') : 'en-curso',
    reachedTarget,
    pips,
    minutes: usable && typeof outcome.minutes === 'number' ? outcome.minutes : null,
    maePips: alert.maePips,
    mfePips: alert.mfePips,
    contractUsd,
    realUsd:
      decision === 'tomada' && position?.status === 'closed' && position.realizedPnl !== null
        ? position.realizedPnl
        : null,
    copilot: typeof f.copilot?.verdict?.decision === 'string' ? f.copilot.verdict.decision : null,
  };
}

export function decisionGroups(rows: DecisionRow[]): Record<Decision, DecisionGroup> {
  const out = {} as Record<Decision, DecisionGroup>;
  for (const d of ['tomada', 'dejada', 'rechazada', 'bloqueada'] as Decision[]) {
    const xs = rows.filter((r) => r.decision === d);
    const withUsd = xs.filter((r) => r.contractUsd !== null);
    const real = xs.filter((r) => r.realUsd !== null);
    out[d] = {
      alerts: xs.length,
      finished: xs.filter((r) => r.finished).length,
      reachedTarget: xs.filter((r) => r.reachedTarget).length,
      contractUsd: round2(withUsd.reduce((s, r) => s + (r.contractUsd ?? 0), 0)),
      withUsd: withUsd.length,
      realUsd: d === 'tomada' ? round2(real.reduce((s, r) => s + (r.realUsd ?? 0), 0)) : null,
    };
  }
  return out;
}
