import * as fs from 'fs';
import * as zlib from 'zlib';
import type { Candle } from '../../src/market/types';
import {
  TwelveDataClient,
  minuteBarToTicks,
} from '../../src/market/twelveDataClient';
import { MarketService } from '../../src/market/market.service';
import { StructureService } from '../../src/structure/structure.service';
import { ConsolidationService } from '../../src/consolidation/consolidation.service';
import {
  AlertsService,
  type AlertContext,
} from '../../src/alerts/alerts.service';

export type Bar = { t: number; o: number; h: number; l: number; c: number };

export type CapturedAlert = {
  at: number;
  iso: string;
  symbol: string;
  alertName: string;
  tradeMode: string;
  direction: 'BUY' | 'SELL';
  price: number;
  diag: Record<string, unknown>;
};

export type CapturedMessage = { at: number; iso: string; text: string };

export type ReplayResult = {
  from: string;
  to: string;
  symbols: string[];
  ticks: number;
  alerts: CapturedAlert[];
  messages: CapturedMessage[];
};

const MINUTE = 60_000;

export function loadBars(file: string): Bar[] {
  const raw = fs.readFileSync(file);
  const text = file.endsWith('.gz')
    ? zlib.gunzipSync(raw).toString('utf8')
    : raw.toString('utf8');
  return text
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => {
      const [t, o, h, l, c] = line.split(',');
      return {
        t: Date.parse(t),
        o: Number(o),
        h: Number(h),
        l: Number(l),
        c: Number(c),
      };
    });
}

export function aggregate(bars: Bar[], minutes: number): Candle[] {
  const period = minutes * MINUTE;
  const out: Candle[] = [];
  let current: Candle | null = null;
  for (const bar of bars) {
    const start = Math.floor(bar.t / period) * period;
    if (!current || current.time !== start) {
      if (current) out.push(current);
      current = {
        time: start,
        open: bar.o,
        high: bar.h,
        low: bar.l,
        close: bar.c,
        closed: true,
      };
    } else {
      current.high = Math.max(current.high, bar.h);
      current.low = Math.min(current.low, bar.l);
      current.close = bar.c;
    }
  }
  if (current) out.push(current);
  return out;
}

export const barToTicks = minuteBarToTicks;

const drain = async () => {
  for (let i = 0; i < 4; i++) await new Promise((r) => setImmediate(r));
};

export async function runReplay(opts: {
  barsBySymbol: Record<string, Bar[]>;
  from: number;
  to: number;
  historySize?: number;
}): Promise<ReplayResult> {
  const historySize = opts.historySize ?? 1000;
  const symbols = Object.keys(opts.barsBySymbol);

  let now = opts.from;
  const realDateNow = Date.now;
  Date.now = () => now;

  delete process.env.IGNORE_SCHEDULE;
  process.env.TELEGRAM_BOT_TOKEN = 'replay';
  process.env.TELEGRAM_CHAT_ID = 'replay';
  process.env.TWELVE_DATA_API_KEY = 'replay-key';
  process.env.TWELVE_DATA_SYMBOL = symbols.join(',');

  const messages: CapturedMessage[] = [];
  const realFetch = globalThis.fetch;
  (globalThis as any).fetch = async (url: string, init?: { body?: string }) => {
    if (String(url).includes('api.telegram.org') && init?.body) {
      const body = JSON.parse(init.body);
      messages.push({
        at: now,
        iso: new Date(now).toISOString(),
        text: String(body.text ?? ''),
      });
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({ ok: true, result: [] }),
      text: async () => '',
    };
  };

  const realLog = console.log;
  const realWarn = console.warn;
  console.log = () => {};
  console.warn = () => {};

  (TwelveDataClient.prototype as any).connect = function () {};
  (TwelveDataClient.prototype as any).disconnect = function () {};

  let seq = 0;
  const em: any = {
    name: 'default',
    fork: () => em,
    persist: (entity: any) => {
      if (entity && entity.id === undefined) entity.id = ++seq;
      return em;
    },
    flush: async () => {},
    find: async () => [],
    nativeUpdate: async () => 1,
    getRepository: () => ({ find: async () => [], findOne: async () => null }),
  };
  const historicalStub: any = {
    downloadHistory: async () => ({ downloaded: 0 }),
    getCandles: async () => [],
  };

  let consolidation: any = null;
  const alertsService: any = new AlertsService(em);
  const market: any = new (MarketService as any)(
    em,
    {
      getConsolidationSnapshot: (s: string) =>
        consolidation?.getConsolidationSnapshot(s) ?? null,
    },
    alertsService,
  );
  const structure: any = new (StructureService as any)(market);
  consolidation = new (ConsolidationService as any)(market, historicalStub);
  consolidation.initHistoricalDownload = async () => {};
  structure.onModuleInit();
  consolidation.onModuleInit();

  const historyBySymbol = new Map<string, { m5: Candle[]; m15: Candle[] }>();
  for (const sym of symbols) {
    const before = opts.barsBySymbol[sym].filter((b) => b.t < opts.from);
    historyBySymbol.set(sym, {
      m5: aggregate(before, 5),
      m15: aggregate(before, 15),
    });
  }
  market.fetchHistoricalCandles = async (
    sym: string,
    interval: '5min' | '15min',
    outputSize: number,
  ) => {
    const h = historyBySymbol.get(sym)!;
    const size = outputSize === 1000 ? historySize : outputSize;
    return (interval === '5min' ? h.m5 : h.m15)
      .slice(-size)
      .map((c) => ({ ...c }));
  };

  const alerts: CapturedAlert[] = [];
  const originalSend = alertsService.sendAlert.bind(alertsService);
  alertsService.sendAlert = async (ctx: AlertContext) => {
    const state = market.symbolStates.get(ctx.symbol);
    const current = state?.builderM5.getCurrentCandle();
    const snap = state?.lastSnapshotM5;
    alerts.push({
      at: now,
      iso: new Date(now).toISOString(),
      symbol: ctx.symbol,
      alertName: `${ctx.version} · ${ctx.name}`,
      tradeMode: ctx.version,
      direction: ctx.direction,
      price: ctx.price,
      diag: {
        secondsIntoM5: current ? Math.round((now - current.time) / 1000) : null,
        m5High: current?.high ?? null,
        m5Low: current?.low ?? null,
        ema100: snap?.ema100 ?? null,
        atr: snap?.atr ?? null,
        elasticity: snap?.elasticity ?? null,
        maxLiveElasticity: state?.maxLiveElasticity ?? null,
        pedestrianLight: ctx.pedestrianLight,
        shieldBlocked: !ctx.shieldClear,
        isCompression: state?.isCompression ?? null,
        emaTarget: ctx.emaTarget,
        detail: ctx.detailLines,
      },
    });
    return originalSend(ctx);
  };

  await market.checkOperationalScheduler();

  type Tick = { ts: number; symbol: string; price: number };
  const ticks: Tick[] = [];
  for (const sym of symbols) {
    for (const bar of opts.barsBySymbol[sym]) {
      if (bar.t < opts.from || bar.t >= opts.to) continue;
      for (const tk of barToTicks(bar))
        ticks.push({ ts: tk.ts, symbol: sym, price: tk.price });
    }
  }
  ticks.sort((a, b) => a.ts - b.ts || a.symbol.localeCompare(b.symbol));

  let fed = 0;
  let lastMinute = -1;
  for (const tick of ticks) {
    now = tick.ts;
    const minute = Math.floor(tick.ts / MINUTE);
    if (minute !== lastMinute) {
      lastMinute = minute;
      await market.checkOperationalScheduler();
    }
    if (!market.engineRunning) continue;
    market.processTick(tick.symbol, tick.price, tick.ts);
    fed++;
    await drain();
  }

  market.onModuleDestroy();
  console.log = realLog;
  console.warn = realWarn;
  Date.now = realDateNow;
  (globalThis as any).fetch = realFetch;

  return {
    from: new Date(opts.from).toISOString(),
    to: new Date(opts.to).toISOString(),
    symbols,
    ticks: fed,
    alerts,
    messages,
  };
}
