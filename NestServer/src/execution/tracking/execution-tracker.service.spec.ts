jest.mock('@mikro-orm/mysql', () => ({ EntityManager: class {} }));
jest.mock('@mikro-orm/core', () => ({ wrap: () => ({}) }));
jest.mock('@mikro-orm/decorators/legacy', () => {
  const noop = () => () => undefined;
  return { Entity: noop, PrimaryKey: noop, Property: noop };
});

import { ExecutionTrackerService } from './execution-tracker.service';
import { ExecutionPosition } from '../execution-position.entity';
import { ExecutionPnlPhase } from './pnl-phase.entity';
import { ExecutionPnlSample } from './pnl-sample.entity';
import type { BrokerPositionMark } from '../broker.types';

function memoryEm(positions: any[]) {
  const phases: any[] = [];
  const samples: any[] = [];
  const pending: any[] = [];
  const table = (e: any) =>
    e === ExecutionPosition
      ? positions
      : e === ExecutionPnlPhase
        ? phases
        : samples;
  const match = (row: any, where: any) =>
    typeof where === 'number'
      ? row.id === where
      : Object.entries(where).every(([k, v]) =>
          v === null ? row[k] === null || row[k] === undefined : row[k] === v,
        );
  const em: any = {
    fork: () => em,
    find: async (e: any, where: any) => table(e).filter((r) => match(r, where)),
    findOne: async (e: any, where: any) =>
      table(e).find((r) => match(r, where)) ?? null,
    persist: (row: any) => pending.push(row),
    flush: async () => {
      for (const row of pending.splice(0)) {
        const list =
          row instanceof ExecutionPnlPhase
            ? phases
            : row instanceof ExecutionPnlSample
              ? samples
              : positions;
        row.id = list.length + 1;
        list.push(row);
      }
    },
  };
  return { em, phases, samples };
}

const at = (s: number) => new Date(Date.UTC(2026, 9, 20, 5, 0, s));

function setup(
  position: Partial<ExecutionPosition>,
  quotes: Record<string, any> = {},
) {
  const row = Object.assign(new ExecutionPosition(), {
    id: 3,
    broker: 'fake',
    symbol: 'EUR/USD',
    direction: 'SELL',
    size: '1000.00',
    status: 'open',
    dealId: 'd3',
    openPrice: '1.12314',
    openedAt: at(0),
    ...position,
  });
  const { em, phases, samples } = memoryEm([row]);
  let marks: BrokerPositionMark[] = [];
  const adapter: any = {
    id: 'fake',
    positions: async () => marks,
    quotes: async (symbols: string[]) =>
      Object.fromEntries(
        symbols.filter((s) => quotes[s]).map((s) => [s, quotes[s]]),
      ),
  };
  const execution: any = {
    adapter: (id: string) => (id === 'fake' ? adapter : undefined),
  };
  const tracker = new ExecutionTrackerService(
    em,
    execution,
    {} as NodeJS.ProcessEnv,
  );
  const mark = (bid: number, offer: number, upl: number | null = null) => {
    marks = [
      {
        dealId: 'd3',
        dealReference: 'p_x',
        brokerSymbol: 'EURUSD',
        direction: row.direction,
        size: 1000,
        level: 1.12314,
        bid,
        offer,
        upl,
      },
    ];
  };
  return {
    row,
    tracker,
    phases,
    samples,
    mark,
    setMarks: (m: any[]) => (marks = m),
  };
}

describe('ExecutionTrackerService', () => {
  beforeEach(() => jest.spyOn(console, 'log').mockImplementation(() => {}));
  afterEach(() => jest.restoreAllMocks());

  it('registra fases rojo → verde en los dos modelos y guarda una muestra por minuto', async () => {
    const { row, tracker, phases, samples, mark } = setup({});
    mark(1.12327, 1.12334, -0.2);
    await tracker.tick(at(5));
    expect(row.trackingSince).toEqual(at(0));
    expect(Number(row.entrySpread)).toBeCloseTo(0.00007, 6);
    expect(phases.map((p) => [p.model, p.state, p.startedAt])).toEqual([
      ['capital', 'red', at(0)],
      ['pip1', 'red', at(0)],
    ]);
    expect(samples).toHaveLength(1);

    mark(1.1229, 1.12297, 0.17);
    await tracker.tick(at(8));
    const capital = phases.filter((p) => p.model === 'capital');
    expect(capital.map((p) => [p.seq, p.state])).toEqual([
      [1, 'red'],
      [2, 'green'],
    ]);
    expect(capital[0].endedAt).toEqual(at(8));
    expect(samples).toHaveLength(1);

    const summary = (
      await tracker.tracking([{ id: 3, trackingSince: at(0) }])
    )[3];
    expect(summary.models.capital.firstGreenAfterSec).toBe(8);
    expect(summary.live?.capital).toBe(0.17);
  });

  it('una posición vieja empieza a medirse desde que la ve el seguimiento', async () => {
    const { row, tracker, phases, mark } = setup({
      openedAt: new Date(at(0).getTime() - 3_600_000),
    });
    mark(1.12327, 1.12334, -0.2);
    await tracker.tick(at(5));
    expect(row.trackingSince).toEqual(at(5));
    expect(phases[0].startedAt).toEqual(at(5));
  });

  it('al cerrar en el panel termina las fases en la hora de cierre', async () => {
    const { row, tracker, phases, mark } = setup({});
    mark(1.12327, 1.12334, -0.2);
    await tracker.tick(at(5));
    row.status = 'closed';
    row.closedAt = at(20);
    await tracker.tick(at(23));
    expect(phases.every((p) => p.endedAt?.getTime() === at(20).getTime())).toBe(
      true,
    );
  });

  it('si el broker la cerró (SL), tras 3 lecturas sin verla deja de seguirla', async () => {
    const { row, tracker, phases, mark, setMarks } = setup({});
    mark(1.12327, 1.12334, -0.2);
    await tracker.tick(at(5));
    setMarks([]);
    await tracker.tick(at(8));
    await tracker.tick(at(11));
    expect(row.brokerGoneAt).toBeUndefined();
    await tracker.tick(at(14));
    expect(row.brokerGoneAt).toEqual(at(14));
    expect(phases.every((p) => p.endedAt?.getTime() === at(5).getTime())).toBe(
      true,
    );
    expect(row.status).toBe('open');
  });

  it('EUR/GBP convierte el modelo de 1 pip a USD con GBP/USD', async () => {
    const { tracker, mark } = setup(
      { symbol: 'EUR/GBP', direction: 'BUY', openPrice: 0.84245 },
      { 'GBP/USD': { bid: 1.3, offer: 1.3 } },
    );
    mark(0.84265, 0.84275, 0.26);
    await tracker.tick(at(5));
    const live = (await tracker.tracking([{ id: 3, trackingSince: at(0) }]))[3]
      .live!;
    expect(live.capital).toBe(0.26);
    expect(live.pip1).toBeCloseTo(0.26 + (0.0001 - 0.0001) * 1000 * 1.3, 4);
  });

  it('sin tasa de cambio no inventa el valor', async () => {
    const { tracker, phases, mark } = setup({
      symbol: 'EUR/GBP',
      direction: 'BUY',
    });
    mark(0.84265, 0.84275, 0.26);
    await tracker.tick(at(5));
    expect(phases).toHaveLength(0);
  });
});
