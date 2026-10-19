import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ApiKeyPool } from './apiKeyPool';
import type { BackendMessage } from './types';

describe('ApiKeyPool', () => {
  const keys = ['aaaaaa111111', 'bbbbbb222222', 'cccccc333333'];
  const symbols = ['EUR/USD', 'EUR/GBP'];
  let dir: string;
  let file: string;
  let messages: BackendMessage[];

  const makePool = (list = keys) =>
    new ApiKeyPool(list, symbols, (msg) => messages.push(msg), file);

  beforeEach(() => {
    jest.useFakeTimers({ now: Date.parse('2026-10-19T14:00:00Z') });
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'key-pool-'));
    file = path.join(dir, 'exhausted_keys.json');
    messages = [];
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('da una llave distinta a cada par mientras haya libres', () => {
    const pool = makePool();
    const a = pool.getAvailableApiKey('EUR/USD');
    const b = pool.getAvailableApiKey('EUR/GBP');
    expect(a).not.toBe(b);
    expect(pool.assignedKey('EUR/USD')).toBe(a);
    expect(pool.assignedKey('EUR/GBP')).toBe(b);
  });

  it('rota la llave con límite por minuto y la libera a los 65 s', () => {
    const pool = makePool();
    const first = pool.getAvailableApiKey('EUR/USD');
    pool.markRateLimited(first);
    const second = pool.getAvailableApiKey('EUR/USD', first);
    expect(second).not.toBe(first);

    const status = pool.getKeysPoolStatus() as Extract<
      BackendMessage,
      { type: 'keys-status' }
    >;
    expect(status.exhaustedKeysCount).toBe(1);

    jest.advanceTimersByTime(65_000);
    const after = pool.getKeysPoolStatus() as Extract<
      BackendMessage,
      { type: 'keys-status' }
    >;
    expect(after.exhaustedKeysCount).toBe(0);
  });

  it('guarda las llaves agotadas del día y las recupera tras un reinicio el mismo día UTC', () => {
    const pool = makePool();
    const key = pool.getAvailableApiKey('EUR/USD');
    pool.markDailyExhausted(key);
    expect(JSON.parse(fs.readFileSync(file, 'utf8')).keys).toEqual([key]);

    const restarted = makePool();
    const next = restarted.getAvailableApiKey('EUR/USD');
    expect(next).not.toBe(key);
  });

  it('descarta el archivo de llaves agotadas de otro día', () => {
    makePool().markDailyExhausted(keys[0]);
    jest.setSystemTime(Date.parse('2026-10-20T14:00:00Z'));
    makePool();
    expect(fs.existsSync(file)).toBe(false);
  });

  it('avisa al frontend cuando todas las llaves están agotadas', () => {
    const pool = makePool(keys.slice(0, 1));
    pool.markDailyExhausted(keys[0]);
    expect(pool.getAvailableApiKey('EUR/USD', keys[0])).toBe(keys[0]);
    expect(messages.some((m) => m.type === 'keys-exhausted-alert')).toBe(true);
  });

  it('cuenta las consultas por llave y su máximo por minuto', () => {
    const pool = makePool();
    const key = pool.getAvailableApiKey('EUR/USD');
    pool.incrementKeyRequest(key);
    pool.incrementKeyRequest(key);
    jest.advanceTimersByTime(61_000);
    pool.incrementKeyRequest(key);

    const status = pool.getKeysPoolStatus() as Extract<
      BackendMessage,
      { type: 'keys-status' }
    >;
    const row = status.assignments.find((a) => a.symbol === 'EUR/USD');
    expect(row).toMatchObject({
      requestsCount: 3,
      minutelyRate: 1,
      minutelyMax: 2,
    });
    expect(messages[messages.length - 1].type).toBe('keys-status');
  });
});
