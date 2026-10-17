import { applyPrice, summarize, type TrackedAlert } from './outcomeTracker';

const base = (direction: 'BUY' | 'SELL'): TrackedAlert => ({
  id: 1,
  version: 'v1',
  symbol: 'EUR/GBP',
  direction,
  price: 0.85,
  createdAt: 0,
  maePips: 0,
  mfePips: 0,
  status: 'open',
  touchedAt: null,
  minutesToEma: null,
  dirty: false,
});

describe('outcomeTracker', () => {
  it('mide el estirón en contra y a favor de una venta hasta tocar la EMA', () => {
    const a = base('SELL');
    applyPrice(a, 0.8507, 0.8501, 0.848, 60_000, 0.0001);
    expect(a.maePips).toBeCloseTo(7);
    expect(a.mfePips).toBeCloseTo(0);
    expect(a.status).toBe('open');
    applyPrice(a, 0.8495, 0.8479, 0.848, 30 * 60_000, 0.0001);
    expect(a.mfePips).toBeCloseTo(21);
    expect(a.status).toBe('touched');
    expect(a.minutesToEma).toBe(30);
    applyPrice(a, 0.86, 0.86, 0.848, 31 * 60_000, 0.0001);
    expect(a.maePips).toBeCloseTo(7);
  });

  it('una compra que no vuelve en 24 h queda vencida', () => {
    const a = base('BUY');
    applyPrice(a, 0.8501, 0.849, 0.86, 24 * 60 * 60 * 1000, 0.0001);
    expect(a.maePips).toBeCloseTo(10);
    expect(a.status).toBe('expired');
  });

  it('resume por versión', () => {
    const now = 10 * 60 * 60 * 1000;
    const rows = [
      {
        version: 'v1',
        status: 'touched',
        maePips: 2,
        minutesToEma: 30,
        createdAt: 0,
      },
      {
        version: 'v1',
        status: 'expired',
        maePips: 20,
        minutesToEma: null,
        createdAt: 0,
      },
      {
        version: 'v2',
        status: 'open',
        maePips: 1,
        minutesToEma: null,
        createdAt: now - 60_000,
      },
    ];
    const [v1, v2] = summarize(rows, now);
    expect(v1.alerts).toBe(2);
    expect(v1.maeMedian).toBeCloseTo(11);
    expect(v1.touchedWithin4h).toBe(1);
    expect(v1.decided4h).toBe(2);
    expect(v2.open).toBe(1);
    expect(v2.decided4h).toBe(0);
  });
});
