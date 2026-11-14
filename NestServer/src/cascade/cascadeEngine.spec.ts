import {
  buildContract,
  CascadeEngine,
  sizeForRisk,
  stepContract,
  type Bar,
  type CascadeSignal,
} from './cascadeEngine';

const PIP = 0.0001;
const MIN = 60_000;

const signal = (over: Partial<CascadeSignal> = {}): CascadeSignal => ({
  symbol: 'EUR/USD',
  side: 1,
  direction: 'SELL',
  barTime: 0,
  at: MIN,
  price: 1.1,
  ema1: 1.1002,
  ema5: 1.099,
  ema15: 1.098,
  atr5: 0.0003,
  stretchAtr5: 4,
  roomPips: 10,
  ema15Pips: 20,
  extreme: 1.1008,
  ...over,
});

const bar = (i: number, o: number, h: number, l: number, c: number): Bar => ({
  time: i * MIN,
  open: o,
  high: h,
  low: l,
  close: c,
});

describe('contrato de la cascada', () => {
  it('pone el stop pasado el extremo y el objetivo a mitad de camino de la EMA 100 de 5m', () => {
    const c = buildContract(signal(), PIP);
    expect(c.stop).toBeCloseTo(1.10085, 6);
    expect(c.target).toBeCloseTo(1.0995, 6);
    expect(c.stopPips).toBeCloseTo(8.5, 6);
    expect(c.targetPips).toBeCloseTo(5, 6);
    expect(c.deadline).toBe(MIN + 175 * MIN);
  });

  it('una compra es el espejo de la venta', () => {
    const c = buildContract(
      signal({ side: -1, direction: 'BUY', price: 1.1, ema5: 1.101, extreme: 1.0992 }),
      PIP,
    );
    expect(c.stop).toBeCloseTo(1.09915, 6);
    expect(c.target).toBeCloseTo(1.1005, 6);
  });

  it('si el stop y el objetivo caen en la misma vela, cuenta el stop', () => {
    const c = buildContract(signal(), PIP);
    const out = stepContract(c, bar(1, 1.1, 1.101, 1.099, 1.1), 1.099, PIP);
    expect(out?.reason).toBe('stop');
    expect(out?.pips).toBeCloseTo(-8.5, 6);
  });

  it('sin salida por stop, anota el toque y sigue hasta el objetivo', () => {
    const c = buildContract(signal(), PIP);
    expect(stepContract(c, bar(1, 1.1, 1.101, 1.0999, 1.1005), 1.099, PIP, false)).toBeNull();
    expect(c.stopTouchedAt).toBe(2 * MIN);
    const out = stepContract(c, bar(2, 1.1005, 1.1006, 1.0995, 1.0996), 1.099, PIP, false);
    expect(out?.reason).toBe('objetivo');
    expect(c.stopTouchedAt).toBe(2 * MIN);
  });

  it('sin salida por objetivo, anota el toque y deja el cierre al TP del broker', () => {
    const c = buildContract(signal(), PIP);
    expect(stepContract(c, bar(1, 1.1, 1.1001, 1.0995, 1.0996), 1.099, PIP, true, false)).toBeNull();
    expect(c.targetTouchedAt).toBe(2 * MIN);
  });

  it('sale en la EMA 100 de 5m si la toca antes del objetivo fijo', () => {
    const c = buildContract(signal(), PIP);
    const out = stepContract(c, bar(1, 1.1, 1.1001, 1.0996, 1.0997), 1.0996, PIP);
    expect(out?.reason).toBe('ema');
    expect(out?.pips).toBeCloseTo(4, 6);
  });

  it('cobra la mitad de la distancia al llegar al objetivo', () => {
    const c = buildContract(signal(), PIP);
    const out = stepContract(c, bar(1, 1.1, 1.1001, 1.0995, 1.0996), 1.099, PIP);
    expect(out?.reason).toBe('objetivo');
    expect(out?.pips).toBeCloseTo(5, 6);
  });

  it('cierra por tiempo a los 175 minutos', () => {
    const c = buildContract(signal(), PIP);
    expect(stepContract(c, bar(174, 1.1, 1.1003, 1.0998, 1.0999), 1.099, PIP)).toBeNull();
    const out = stepContract(c, bar(175, 1.0999, 1.1003, 1.0998, 1.0998), 1.099, PIP);
    expect(out?.reason).toBe('tiempo');
    expect(out?.pips).toBeCloseTo(2, 6);
    expect(c.maePips).toBeCloseTo(3, 6);
  });
});

describe('tamaño por riesgo', () => {
  it('arriesga lo pedido con el stop', () => {
    expect(sizeForRisk(20, 0.00084, 1, PIP)).toBe(23800);
  });

  it('convierte la moneda cotizada a dólares', () => {
    expect(sizeForRisk(20, 0.001, 1.25, PIP)).toBe(16000);
  });

  it('no deja que un stop diminuto dispare el tamaño', () => {
    expect(sizeForRisk(20, 0.00001, 1, PIP)).toBe(66600);
  });
});

describe('motor de la cascada', () => {
  it('arma velas de 1 minuto con los ticks y las cierra al empezar el minuto siguiente', () => {
    const e = new CascadeEngine('EUR/USD');
    expect(e.tick(1.1, 1_000).bars).toHaveLength(0);
    e.tick(1.1005, 20_000);
    e.tick(1.0995, 40_000);
    const ev = e.tick(1.1001, MIN + 1_000);
    expect(ev.bars).toEqual([
      { time: 0, open: 1.1, high: 1.1005, low: 1.0995, close: 1.0995 },
    ]);
  });

  it('avisa la venta cuando la vela de 1m cruza su EMA 100 tras un estirón en abanico', () => {
    const e = new CascadeEngine('EUR/USD');
    const m5: Bar[] = [];
    const m15: Bar[] = [];
    for (let i = 0; i < 120; i++) {
      m15.push(bar(i * 15 - 15 * 120, 1.09, 1.0902, 1.0898, 1.09));
      m5.push(bar(i * 5 - 5 * 120, 1.095, 1.0951, 1.0949, 1.095));
    }
    const m1: Bar[] = [];
    for (let i = 0; i < 200; i++) m1.push(bar(i - 200, 1.1, 1.1001, 1.0999, 1.1));
    e.warm(m1, m5, m15);

    expect(e.view(1.1).armed).toBe(true);
    for (let i = 0; i < 5; i++) e.tick(1.1004, i * MIN + 1_000);
    const ev = e.tick(1.0998, 5 * MIN + 1_000);
    expect(ev.signals).toHaveLength(0);
    const ev2 = e.tick(1.0997, 6 * MIN + 1_000);
    expect(ev2.signals).toHaveLength(1);
    expect(ev2.signals[0].direction).toBe('SELL');
    expect(e.contract?.target).toBeLessThan(1.0998);
    expect(e.tick(1.0996, 7 * MIN + 1_000).signals).toHaveLength(0);
  });
});
