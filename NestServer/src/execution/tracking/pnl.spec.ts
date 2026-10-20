import { applyPnl, phaseView, pnlModels, stateOf, summarize } from './pnl';

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
