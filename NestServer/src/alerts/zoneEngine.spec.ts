import {
  atrSeries,
  buildZoneModel,
  emaSeries,
  quantile,
  type ZoneBar,
} from './zoneEngine';

const bar = (i: number, close: number, range = 0.0004): ZoneBar => ({
  time: i * 300_000,
  open: close,
  high: close + range / 2,
  low: close - range / 2,
  close,
});

describe('zoneEngine', () => {
  it('quantile interpola igual que numpy', () => {
    expect(quantile([1, 2, 3, 4], 0.5)).toBeCloseTo(2.5);
    expect(quantile([1, 2, 3, 4], 0.75)).toBeCloseTo(3.25);
    expect(quantile([5], 0.9)).toBe(5);
  });

  it('EMA con semilla SMA y ATR de 14 velas', () => {
    const closes = Array.from({ length: 120 }, (_, i) => 1 + i * 0.0001);
    const ema = emaSeries(closes, 100);
    expect(ema[98]).toBeNull();
    expect(ema[99]).toBeCloseTo(
      closes.slice(0, 100).reduce((s, v) => s + v, 0) / 100,
      10,
    );
    const atr = atrSeries(
      closes.map((c, i) => bar(i, c)),
      14,
    );
    expect(atr[13]).toBeNull();
    expect(atr[14]).toBeCloseTo(0.0004, 10);
  });

  it('mide los picos de estirones que se separan y vuelven a la EMA', () => {
    const bars: ZoneBar[] = [];
    let i = 0;
    for (let k = 0; k < 150; k++) bars.push(bar(i++, 1.1));
    for (let wave = 0; wave < 20; wave++) {
      const height = 0.0005 + (wave % 5) * 0.0004;
      const side = wave % 2 === 0 ? 1 : -1;
      for (let k = 1; k <= 6; k++)
        bars.push(bar(i++, 1.1 + side * height * (k / 6)));
      for (let k = 5; k >= 0; k--)
        bars.push(bar(i++, 1.1 + side * height * (k / 6)));
      for (let k = 0; k < 6; k++) bars.push(bar(i++, 1.1));
    }
    const model = buildZoneModel(bars);
    expect(model).not.toBeNull();
    expect(model!.episodes).toBeGreaterThan(5);
    expect(model!.q50).toBeLessThanOrEqual(model!.q75);
    expect(model!.q75).toBeLessThanOrEqual(model!.q90);
    expect(model!.residual.count).toBeGreaterThan(0);
    expect(model!.residual.max).toBeGreaterThanOrEqual(model!.residual.median);
  });

  it('sin velas suficientes no hay modelo', () => {
    expect(buildZoneModel([bar(0, 1.1), bar(1, 1.1)])).toBeNull();
  });
});
