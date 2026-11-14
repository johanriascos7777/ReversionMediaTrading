import * as fs from 'fs';
import { CascadeEngine, type Bar } from '../../src/cascade/cascadeEngine';

const [barsFile, x4File, warmArg] = process.argv.slice(2);
if (!barsFile || !x4File) {
  console.error('Uso: ts-node --transpile-only test/replay/cascade-fidelity.ts <bars.csv> <x4.csv> [indice de calentamiento]');
  process.exit(1);
}
const warmIndex = Number(warmArg ?? 4500);

const bars: Bar[] = fs
  .readFileSync(barsFile, 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((line) => {
    const [t, o, h, l, c] = line.split(',');
    return { time: Date.parse(t), open: +o, high: +h, low: +l, close: +c };
  });

type Agg = { period: number; bar: Bar | null; onClose: (b: Bar) => void };
const feed = (agg: Agg, price: number, ts: number) => {
  const start = Math.floor(ts / agg.period) * agg.period;
  if (agg.bar && start > agg.bar.time) {
    agg.onClose(agg.bar);
    agg.bar = null;
  }
  if (!agg.bar) agg.bar = { time: start, open: price, high: price, low: price, close: price };
  else {
    agg.bar.high = Math.max(agg.bar.high, price);
    agg.bar.low = Math.min(agg.bar.low, price);
    agg.bar.close = price;
  }
};

const engine = new CascadeEngine('EUR/USD');
const m5: Agg = { period: 5 * 60_000, bar: null, onClose: (b) => engine.closedM5(b) };
const m15: Agg = { period: 15 * 60_000, bar: null, onClose: (b) => engine.closedM15(b) };
const warmTime = bars[warmIndex + 1].time;

const trades: Array<{ t: string; s: number; entry: number; stop: number; pips: number; bars: number }> = [];
const open = new Map<number, (typeof trades)[number]>();
for (const bar of bars) {
  const ticks: Array<[number, number]> = [
    [bar.time, bar.open],
    [bar.time + 15_000, bar.close >= bar.open ? bar.low : bar.high],
    [bar.time + 30_000, bar.close >= bar.open ? bar.high : bar.low],
    [bar.time + 45_000, bar.close],
  ];
  for (const [ts, price] of ticks) {
    const ev = engine.tick(price, ts);
    for (const o of ev.outcomes) {
      const tr = open.get(o.contract.openedAt);
      if (tr) {
        tr.pips = Math.round(o.pips * 100) / 100;
        tr.bars = o.minutes;
        open.delete(o.contract.openedAt);
      }
    }
    for (const s of ev.signals) {
      if (s.barTime < warmTime) {
        engine.contract = null;
        continue;
      }
      const tr = {
        t: new Date(s.barTime).toISOString().replace('.000', ''),
        s: s.side,
        entry: s.price,
        stop: engine.contract!.stop,
        pips: NaN,
        bars: NaN,
      };
      trades.push(tr);
      open.set(engine.contract!.openedAt, tr);
    }
    feed(m5, price, ts);
    feed(m15, price, ts);
  }
}

const py = fs
  .readFileSync(x4File, 'utf8')
  .split('\n')
  .slice(1)
  .filter(Boolean)
  .map((line) => {
    const [t, s, entry, stop, pips, nb] = line.split(',');
    return { t, s: +s, entry: +entry, stop: +stop, pips: +pips, bars: +nb };
  });

const key = (x: { t: string; s: number }) => `${x.t}|${x.s}`;
const tsMap = new Map(trades.map((x) => [key(x), x]));
const pyMap = new Map(py.map((x) => [key(x), x]));
const both = py.filter((x) => tsMap.has(key(x)));
const samePips = both.filter((x) => Math.abs(tsMap.get(key(x))!.pips - x.pips) < 0.05);
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
console.log(`Python X4: ${py.length} · TypeScript: ${trades.length} · coinciden en hora y lado: ${both.length} · mismo resultado: ${samePips.length}`);
console.log(`Suma bruta Python ${sum(py.map((x) => x.pips)).toFixed(1)} · TypeScript ${sum(trades.filter((x) => !isNaN(x.pips)).map((x) => x.pips)).toFixed(1)} pips`);
const onlyPy = py.filter((x) => !tsMap.has(key(x))).slice(0, 5);
const onlyTs = trades.filter((x) => !pyMap.has(key(x))).slice(0, 5);
if (onlyPy.length) console.log('Solo en Python:', onlyPy);
if (onlyTs.length) console.log('Solo en TypeScript:', onlyTs);
const diff = both.filter((x) => Math.abs(tsMap.get(key(x))!.pips - x.pips) >= 0.05).slice(0, 5);
if (diff.length) console.log('Distinto resultado:', diff.map((x) => ({ py: x, ts: tsMap.get(key(x)) })));
