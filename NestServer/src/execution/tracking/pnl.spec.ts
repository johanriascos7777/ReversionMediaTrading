import {
  applyPnl,
  operationRow,
  operationSummary,
  phaseView,
  pnlModels,
  stateOf,
  summarize,
} from './pnl';

const t = (s: number) => new Date(Date.UTC(2026, 9, 20, 4, 30, s));

describe('pnlModels', () => {
  it('SELL EUR/USD: Capital.com usa su upl y 1 pip descuenta solo un pip', () => {
    const v = pnlModels({
      symbol: 'EUR/USD',
      direction: 'SELL',
      size: 1000,
      level: 1.12314,
      bid: 1.12327,
      offer: 1.12334,
      upl: -0.2,
      entrySpread: 0.00007,
      fx: 1,
    });
    expect(v.capital).toBe(-0.2);
    expect(v.pip1).toBeCloseTo(-0.2 + (0.00007 - 0.0001) * 1000, 4);
  });

  it('sin upl calcula con el lado de salida y convierte con fx', () => {
    const v = pnlModels({
      symbol: 'EUR/GBP',
      direction: 'BUY',
      size: 1000,
      level: 0.84245,
      bid: 0.84265,
      offer: 0.84275,
      upl: null,
      entrySpread: 0.0001,
      fx: 1.3,
    });
    expect(v.capital).toBeCloseTo(0.0002 * 1000 * 1.3, 4);
    expect(v.pip1).toBeCloseTo(v.capital, 4);
  });

  it('cero cuenta como rojo; cualquier ganancia como verde', () => {
    expect(stateOf(0)).toBe('red');
    expect(stateOf(-0.01)).toBe('red');
    expect(stateOf(0.001)).toBe('green');
  });
});

describe('applyPnl', () => {
  it('abre la primera fase en el inicio del seguimiento y alterna rojo, verde, rojo', () => {
    const since = t(0);
    let r = applyPnl(null, -0.3, t(3), since, 9000);
    expect(r.created).toBe(true);
    expect(r.active).toMatchObject({ seq: 1, state: 'red', startedAt: since });
    const first = r.active;

    r = applyPnl(first, -0.5, t(6), since, 9000);
    expect(r.created).toBe(false);
    expect(first).toMatchObject({
      extremePnl: -0.5,
      lastPnl: -0.5,
      samples: 2,
    });

    r = applyPnl(first, 0.1, t(9), since, 9000);
    expect(r.created).toBe(true);
    expect(first.endedAt).toEqual(t(9));
    expect(r.active).toMatchObject({ seq: 2, state: 'green', startedAt: t(9) });
    const second = r.active;

    applyPnl(second, 0.4, t(12), since, 9000);
    expect(second.extremePnl).toBe(0.4);
    r = applyPnl(second, -0.1, t(15), since, 9000);
    expect(r.active).toMatchObject({ seq: 3, state: 'red' });

    const views = [first, second, r.active].map((p) => phaseView(p, t(30)));
    expect(views.map((v) => v.durationSec)).toEqual([9, 6, 15]);
    expect(summarize(views, since)).toMatchObject({
      phases: 3,
      redSec: 24,
      greenSec: 6,
      firstGreenAfterSec: 9,
      current: { seq: 3 },
    });
  });

  it('anota los huecos sin datos', () => {
    const r = applyPnl(null, -0.3, t(0), t(0), 9000);
    applyPnl(r.active, -0.4, t(40), t(0), 9000);
    expect(r.active.gapSec).toBe(40);
  });
});

describe('operationRow', () => {
  const t = (min: number) => new Date(Date.UTC(2026, 10, 19, 9, 30 + min));
  const phase = (seq: number, state: 'red' | 'green', from: number, to: number, extreme: number, at: number) => ({
    seq, state, startedAt: t(from), endedAt: t(to), durationSec: (to - from) * 60,
    startPnl: 0, lastPnl: extreme, extremePnl: extreme, extremeAt: t(at), samples: 1, gapSec: 0,
  });
  const pos = {
    id: 24, symbol: 'GBP/JPY', direction: 'SELL' as const, size: 13800, status: 'closed', source: 'auto',
    alertLogId: 52, openedAt: t(0), trackingSince: t(0), closedAt: t(175), realizedPnl: -27.44,
    closeSource: 'USER', closeReason: 'contrato-tiempo',
  };

  it('mide la holgura antes del primer verde, el mejor momento y el rato en verde', () => {
    const r = operationRow(pos, [
      phase(1, 'red', 0, 10, -3.28, 5),
      phase(2, 'green', 10, 11, 1.9, 10),
      phase(3, 'red', 11, 175, -47.55, 98),
    ], null, t(200));
    expect(r.slackBeforeGreenSec).toBe(600);
    expect(r.bestUsd).toBe(1.9);
    expect(r.bestAfterSec).toBe(600);
    expect(r.greenSec).toBe(60);
    expect(r.greenPhases).toBe(1);
    expect(r.worstUsd).toBe(-47.55);
    expect(r.resultUsd).toBe(-27.44);
    expect(r.totalSec).toBe(175 * 60);
  });

  it('una operación que nunca llegó a verde no tiene holgura ni mejor momento', () => {
    const r = operationRow({ ...pos, status: 'open', closedAt: null, realizedPnl: null },
      [phase(1, 'red', 0, 30, -5, 20)], -4.2, t(30));
    expect(r.slackBeforeGreenSec).toBeNull();
    expect(r.bestUsd).toBeNull();
    expect(r.resultUsd).toBe(-4.2);
    expect(r.resultLive).toBe(true);
    expect(operationSummary([r]).neverGreen).toBe(1);
  });

  it('el resumen separa ganadas, perdidas, cierres y las que siguen en rojo a los 5 y 10 min', () => {
    const win = operationRow({ ...pos, closeSource: 'TP', closeReason: 'ya-cerrada-en-broker', realizedPnl: 8, closedAt: t(20) },
      [phase(1, 'red', 0, 2, -1, 1), phase(2, 'green', 2, 20, 8, 19)], null, t(30));
    const late = operationRow(pos, [
      phase(1, 'red', 0, 10, -3.28, 5),
      phase(2, 'green', 10, 11, 1.9, 10),
      phase(3, 'red', 11, 175, -47.55, 98),
    ], null, t(200));
    const fresh = operationRow({ ...pos, status: 'open', closedAt: null, realizedPnl: null, openedAt: t(0), trackingSince: t(0) },
      [phase(1, 'red', 0, 3, -1, 1)], -1, t(3));
    const s = operationSummary([win, late, fresh]);
    expect(s.wins).toBe(1);
    expect(s.losses).toBe(1);
    expect(s.winsUsd).toBe(8);
    expect(s.lossesUsd).toBe(-27.44);
    expect(s.closedBy.objetivo).toEqual({ n: 1, usd: 8 });
    expect(s.closedBy.tiempo).toEqual({ n: 1, usd: -27.44 });
    expect(s.slackMedianSec).toBe(360);
    expect(s.pastMinute5).toBe(2);
    expect(s.redAt5).toBe(1);
    expect(s.pastMinute10).toBe(2);
    expect(s.redAt10).toBe(0);
  });
});
