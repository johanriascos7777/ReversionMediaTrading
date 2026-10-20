jest.mock('@mikro-orm/mysql', () => ({ EntityManager: class {} }));
jest.mock('@mikro-orm/core', () => ({ wrap: () => ({}) }));
jest.mock('@mikro-orm/decorators/legacy', () => {
  const noop = () => () => undefined;
  return { Entity: noop, PrimaryKey: noop, Property: noop };
});

import { ExecutionService } from './execution.service';
import { ExecutionPosition } from './execution-position.entity';
import { ManualAdapter } from './manual.adapter';
import { BrokerError, type BrokerAdapter } from './broker.types';
import { PendingSignal } from '../trade/pending-signal.entity';
import { AlertLog } from '../alerts/alert-log.entity';

function memoryEm(seed: { signals?: any[]; logs?: any[] } = {}) {
  const positions: ExecutionPosition[] = [];
  const pending: ExecutionPosition[] = [];
  const match = (row: any, where: any) =>
    typeof where === 'number' ? row.id === where : Object.entries(where).every(([k, v]) => row[k] === v);
  const table = (entity: any): any[] =>
    entity === ExecutionPosition ? positions : entity === PendingSignal ? seed.signals ?? [] : entity === AlertLog ? seed.logs ?? [] : [];
  const em: any = {
    fork: () => em,
    findOne: async (entity: any, where: any) => table(entity).find((r) => match(r, where)) ?? null,
    find: async (entity: any, where: any) => table(entity).filter((r) => match(r, where)),
    persist: (row: ExecutionPosition) => pending.push(row),
    flush: async () => {
      for (const row of pending.splice(0)) {
        row.id = positions.length + 1;
        positions.push(row);
      }
    },
  };
  return { em, positions };
}

class FakeBroker implements BrokerAdapter {
  readonly id = 'fake';
  readonly label = 'Fake demo';
  readonly live = false;
  opened: any[] = [];
  closed: any[] = [];
  failOpen = false;
  async open(req: any) {
    if (this.failOpen) throw new BrokerError('rechazada', 400);
    this.opened.push(req);
    return { brokerSymbol: req.symbol.replace('/', ''), dealId: `d${this.opened.length}`, dealReference: 'ref', level: 1.1, confirmed: true };
  }
  async close(p: any) {
    this.closed.push(p);
    return { level: 1.2, alreadyClosed: false };
  }
}

const env = { TWELVE_DATA_SYMBOL: 'EUR/USD,EUR/GBP, GBP/USD' } as NodeJS.ProcessEnv;

describe('ExecutionService', () => {
  beforeEach(() => jest.spyOn(console, 'log').mockImplementation(() => {}));
  afterEach(() => jest.restoreAllMocks());

  it('usa como broker por defecto el primero que no es manual', () => {
    const { em } = memoryEm();
    const s = new ExecutionService(em, [new ManualAdapter(), new FakeBroker()], env);
    expect(s.defaultBroker?.id).toBe('fake');
    expect(s.config().symbols).toEqual(['EUR/USD', 'EUR/GBP', 'GBP/USD']);
  });

  it('sin broker configurado solo ofrece el manual', () => {
    const { em } = memoryEm();
    const s = new ExecutionService(em, [new ManualAdapter()], env);
    expect(s.defaultBroker).toBeNull();
    expect(s.config().defaultBroker).toBe('manual');
  });

  it('abre, bloquea el símbolo y lo libera al cerrar', async () => {
    const { em } = memoryEm();
    const broker = new FakeBroker();
    const s = new ExecutionService(em, [broker, new ManualAdapter()], env);
    const p = await s.open({ symbol: 'EUR/USD', direction: 'BUY', source: 'frontend' });
    expect(p).toMatchObject({ status: 'open', broker: 'fake', size: 1000, dealId: 'd1', openPrice: 1.1 });
    expect((await s.openPositionFor('EUR/USD'))?.id).toBe(p.id);
    expect(await s.openPositionFor('EUR/GBP')).toBeNull();

    await expect(s.open({ symbol: 'EUR/USD', direction: 'SELL', source: 'frontend' })).rejects.toMatchObject({ status: 409 });
    expect(broker.opened).toHaveLength(1);

    const closed = await s.close(p.id);
    expect(closed).toMatchObject({ status: 'closed', closePrice: 1.2, closeReason: 'manual' });
    expect(await s.openPositionFor('EUR/USD')).toBeNull();
  });

  it('rechaza símbolos que no están configurados y tamaños fuera de rango', async () => {
    const { em } = memoryEm();
    const s = new ExecutionService(em, [new ManualAdapter()], env);
    await expect(s.open({ symbol: 'USD/JPY', direction: 'BUY', source: 'frontend' })).rejects.toMatchObject({ status: 400 });
    await expect(s.open({ symbol: 'EUR/USD', direction: 'BUY', size: 50000, source: 'frontend' })).rejects.toMatchObject({ status: 400 });
  });

  it('guarda como fallida una orden rechazada y no bloquea el símbolo', async () => {
    const { em, positions } = memoryEm();
    const broker = new FakeBroker();
    broker.failOpen = true;
    const s = new ExecutionService(em, [broker], env);
    await expect(s.open({ symbol: 'GBP/USD', direction: 'SELL', source: 'frontend' })).rejects.toMatchObject({ status: 502 });
    expect(positions[0]).toMatchObject({ status: 'failed', note: 'rechazada' });
    expect(await s.openPositionFor('GBP/USD')).toBeNull();
  });

  it('abre desde una alerta con su SL y la enlaza al alert_log', async () => {
    const { em } = memoryEm({
      signals: [{ id: 7, symbol: 'EUR/GBP', direction: 'SELL', slPrice: '0.84500', tpPrice: '0.84000' }],
      logs: [{ id: 3, pendingSignalId: 7 }],
    });
    const broker = new FakeBroker();
    const s = new ExecutionService(em, [broker], env);
    const p = await s.openFromSignal(7);
    expect(p).toMatchObject({ symbol: 'EUR/GBP', direction: 'SELL', source: 'telegram', alertLogId: 3, pendingSignalId: 7, stopLevel: 0.845, profitLevel: null });
    expect(broker.opened[0]).toMatchObject({ stopLevel: 0.845, profitLevel: undefined });
  });
});

describe('ExecutionService · entrada automática', () => {
  const fs = jest.requireActual('fs');
  const os = jest.requireActual('os');
  const path = jest.requireActual('path');
  let file: string;

  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'exec-')), 'execution_settings.json');
  });
  afterEach(() => jest.restoreAllMocks());

  it('arranca apagada salvo EXECUTION_AUTO=true', () => {
    const { em } = memoryEm();
    expect(new ExecutionService(em, [new FakeBroker()], env, file).autoEnabled).toBe(false);
    expect(new ExecutionService(em, [new FakeBroker()], { ...env, EXECUTION_AUTO: 'true' }, file).autoEnabled).toBe(true);
  });

  it('el interruptor se guarda y sobrevive a un reinicio', () => {
    const { em } = memoryEm();
    const s = new ExecutionService(em, [new FakeBroker()], env, file);
    expect(s.setAuto(true).auto).toBe(true);
    expect(new ExecutionService(em, [new FakeBroker()], env, file).autoEnabled).toBe(true);
    s.setAuto(false);
    expect(new ExecutionService(em, [new FakeBroker()], { ...env, EXECUTION_AUTO: 'true' }, file).autoEnabled).toBe(false);
  });

  it('no se activa sin broker ni en cuenta real sin permiso explícito', () => {
    const { em } = memoryEm();
    expect(() => new ExecutionService(em, [new ManualAdapter()], env, file).setAuto(true)).toThrow('No hay broker');
    const live = Object.assign(new FakeBroker(), { live: true });
    const s = new ExecutionService(em, [live], env, file);
    expect(() => s.setAuto(true)).toThrow('EXECUTION_AUTO_LIVE');
    expect(new ExecutionService(em, [live], { ...env, EXECUTION_AUTO_LIVE: 'true' }, file).setAuto(true).auto).toBe(true);
  });

  it('abre desde la alerta con origen auto', async () => {
    const { em } = memoryEm({ signals: [{ id: 9, symbol: 'GBP/USD', direction: 'BUY', slPrice: '1.33000' }], logs: [] });
    const s = new ExecutionService(em, [new FakeBroker()], env, file);
    const p = await s.openFromSignal(9, 'auto');
    expect(p).toMatchObject({ source: 'auto', symbol: 'GBP/USD', stopLevel: 1.33 });
  });
});
