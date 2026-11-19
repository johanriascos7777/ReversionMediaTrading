import { CapitalAdapter, capitalConfigFromEnv } from './capital.adapter';

type Call = { method: string; url: string; body: any; headers: any };

function fakeFetch(
  routes: Array<(c: Call) => { status: number; body?: any; headers?: Record<string, string> } | null>,
) {
  const calls: Call[] = [];
  const fn = (async (url: string, init: any) => {
    const call: Call = {
      method: init?.method ?? 'GET',
      url,
      body: init?.body ? JSON.parse(init.body) : undefined,
      headers: init?.headers ?? {},
    };
    calls.push(call);
    for (const r of routes) {
      const res = r(call);
      if (res) {
        const text = res.body === undefined ? '' : JSON.stringify(res.body);
        return {
          ok: res.status >= 200 && res.status < 300,
          status: res.status,
          headers: { get: (k: string) => res.headers?.[k] ?? null },
          text: async () => text,
        } as any;
      }
    }
    throw new Error(`ruta no simulada: ${call.method} ${url}`);
  }) as unknown as typeof fetch;
  return { fn, calls };
}

const login = (c: Call) =>
  c.method === 'POST' && c.url.endsWith('/api/v1/session')
    ? { status: 200, body: {}, headers: { CST: 'cst-1', 'X-SECURITY-TOKEN': 'tok-1' } }
    : null;

const config = {
  env: 'demo' as const,
  identifier: 'user@example.com',
  apiKey: 'KEY',
  password: 'PASS',
};

describe('CapitalAdapter', () => {
  it('abre en demo, espera la confirmación y usa el dealId de la posición', async () => {
    const { fn, calls } = fakeFetch([
      login,
      (c) => (c.method === 'POST' && c.url.endsWith('/api/v1/positions') ? { status: 200, body: { dealReference: 'o_ref' } } : null),
      (c) =>
        c.url.endsWith('/api/v1/confirms/o_ref')
          ? {
              status: 200,
              body: { dealStatus: 'ACCEPTED', dealId: 'order-1', level: 1.1225, affectedDeals: [{ dealId: 'pos-1', status: 'OPENED' }] },
            }
          : null,
    ]);
    const a = new CapitalAdapter(config, fn, async () => {});
    const res = await a.open({ symbol: 'EUR/USD', direction: 'BUY', size: 1000, stopLevel: 1.12 });
    expect(res).toEqual({ brokerSymbol: 'EURUSD', dealId: 'pos-1', dealReference: 'o_ref', level: 1.1225, confirmed: true });
    expect(calls[0].url).toBe('https://demo-api-capital.backend-capital.com/api/v1/session');
    expect(calls[1].body).toEqual({ epic: 'EURUSD', direction: 'BUY', size: 1000, guaranteedStop: false, stopLevel: 1.12 });
    expect(calls[1].headers.CST).toBe('cst-1');
  });

  it('lanza error si el broker rechaza la orden', async () => {
    const { fn } = fakeFetch([
      login,
      (c) => (c.method === 'POST' && c.url.endsWith('/positions') ? { status: 200, body: { dealReference: 'r' } } : null),
      (c) => (c.url.endsWith('/confirms/r') ? { status: 200, body: { dealStatus: 'REJECTED', reason: 'INSUFFICIENT_FUNDS' } } : null),
    ]);
    const a = new CapitalAdapter(config, fn, async () => {});
    await expect(a.open({ symbol: 'EUR/GBP', direction: 'SELL', size: 100 })).rejects.toThrow('INSUFFICIENT_FUNDS');
  });

  it('marca la orden sin confirmar si el broker no responde a tiempo', async () => {
    const { fn } = fakeFetch([
      login,
      (c) => (c.method === 'POST' && c.url.endsWith('/positions') ? { status: 200, body: { dealReference: 'r' } } : null),
      (c) => (c.url.endsWith('/confirms/r') ? { status: 404, body: { errorCode: 'error.not-found.dealReference' } } : null),
    ]);
    const a = new CapitalAdapter(config, fn, async () => {});
    const res = await a.open({ symbol: 'GBP/USD', direction: 'BUY', size: 100 });
    expect(res.confirmed).toBe(false);
    expect(res.dealReference).toBe('r');
  });

  it('cierra y devuelve el precio de cierre', async () => {
    const { fn, calls } = fakeFetch([
      login,
      (c) => (c.method === 'DELETE' && c.url.endsWith('/api/v1/positions/pos-1') ? { status: 200, body: { dealReference: 'c_ref' } } : null),
      (c) => (c.url.endsWith('/confirms/c_ref') ? { status: 200, body: { dealStatus: 'ACCEPTED', level: 1.123 } } : null),
    ]);
    const a = new CapitalAdapter(config, fn, async () => {});
    const res = await a.close({ symbol: 'EUR/USD', dealId: 'pos-1', dealReference: 'o_ref' });
    expect(res).toEqual({ level: 1.123, alreadyClosed: false });
    expect(calls.some((c) => c.method === 'DELETE')).toBe(true);
  });

  it('da por cerrada una posición que el broker ya no tiene', async () => {
    const { fn } = fakeFetch([
      login,
      (c) => (c.method === 'DELETE' ? { status: 404, body: { errorCode: 'error.not-found.dealId' } } : null),
    ]);
    const a = new CapitalAdapter(config, fn, async () => {});
    await expect(a.close({ symbol: 'EUR/USD', dealId: 'gone', dealReference: null })).resolves.toEqual({ level: null, alreadyClosed: true });
  });

  it('vuelve a iniciar sesión una vez si la sesión expiró', async () => {
    let positionsCalls = 0;
    const { fn, calls } = fakeFetch([
      login,
      (c) => {
        if (!(c.method === 'POST' && c.url.endsWith('/positions'))) return null;
        positionsCalls++;
        return positionsCalls === 1 ? { status: 401, body: { errorCode: 'error.invalid.session.token' } } : { status: 200, body: { dealReference: 'r2' } };
      },
      (c) => (c.url.endsWith('/confirms/r2') ? { status: 200, body: { dealStatus: 'ACCEPTED', dealId: 'd2', level: 1.3 } } : null),
    ]);
    const a = new CapitalAdapter(config, fn, async () => {});
    const res = await a.open({ symbol: 'GBP/USD', direction: 'SELL', size: 100 });
    expect(res.dealId).toBe('d2');
    expect(calls.filter((c) => c.url.endsWith('/session')).length).toBe(2);
  });
  it('lee las posiciones abiertas con su precio actual y su upl', async () => {
    const { fn } = fakeFetch([
      login,
      (c) =>
        c.method === 'GET' && c.url.endsWith('/api/v1/positions')
          ? {
              status: 200,
              body: {
                positions: [
                  {
                    position: { dealId: 'pos-1', dealReference: 'p_pos-1', direction: 'SELL', size: 1000, level: 1.12314, upl: -0.2 },
                    market: { epic: 'EURUSD', bid: 1.12327, offer: 1.12334 },
                  },
                ],
              },
            }
          : null,
    ]);
    const a = new CapitalAdapter(config, fn, async () => {});
    expect(await a.positions()).toEqual([
      { dealId: 'pos-1', dealReference: 'p_pos-1', brokerSymbol: 'EURUSD', direction: 'SELL', size: 1000, level: 1.12314, upl: -0.2, bid: 1.12327, offer: 1.12334 },
    ]);
  });

  it('lee cotizaciones por símbolo desde marketDetails', async () => {
    const { fn, calls } = fakeFetch([
      login,
      (c) =>
        c.url.includes('/api/v1/markets?epics=GBPUSD')
          ? { status: 200, body: { marketDetails: [{ instrument: { epic: 'GBPUSD' }, snapshot: { bid: 1.3001, offer: 1.3003 } }] } }
          : null,
    ]);
    const a = new CapitalAdapter(config, fn, async () => {});
    expect(await a.quotes(['GBP/USD'])).toEqual({ 'GBP/USD': { bid: 1.3001, offer: 1.3003 } });
    expect(calls.at(-1)?.method).toBe('GET');
  });
});

describe('CapitalAdapter.closedDeal', () => {
  it('lee el precio, el origen y la ganancia real del cierre en el historial', async () => {
    const { fn, calls } = fakeFetch([
      login,
      (c) =>
        c.url.includes('/api/v1/history/activity')
          ? {
              status: 200,
              body: {
                activities: [
                  { dealId: 'pos-1', type: 'WORKING_ORDER', source: 'TP', details: { level: 1.32314 } },
                  { dealId: 'pos-1', type: 'POSITION', source: 'TP', dateUTC: '2026-11-13T06:39:51.962', details: { level: 1.32314, openPrice: 1.32262 } },
                  { dealId: 'pos-1', type: 'POSITION', source: 'USER', details: { level: 1.32262 } },
                ],
              },
            }
          : null,
      (c) =>
        c.url.includes('/api/v1/history/transactions')
          ? { status: 200, body: { transactions: [{ dealId: 'pos-1', transactionType: 'TRADE', size: '18.56' }] } }
          : null,
    ]);
    const a = new CapitalAdapter(config, fn, async () => {}, () => Date.parse('2026-11-13T07:00:00Z'));
    const deal = await a.closedDeal('pos-1', new Date('2026-11-13T06:25:46Z'));
    expect(deal).toEqual({ level: 1.32314, pnl: 18.56, source: 'TP', at: new Date('2026-11-13T06:39:51.962Z') });
    expect(calls.find((c) => c.url.includes('activity'))?.url).toContain('from=2026-11-13T06:24:46&to=2026-11-13T06:59:59');
  });

  it('devuelve null si el cierre todavía no aparece', async () => {
    const { fn } = fakeFetch([
      login,
      (c) => (c.url.includes('/api/v1/history/activity') ? { status: 200, body: { activities: [] } } : null),
    ]);
    const a = new CapitalAdapter(config, fn, async () => {});
    expect(await a.closedDeal('pos-1', new Date())).toBeNull();
  });
});

describe('capitalConfigFromEnv', () => {
  const base = { CAPITAL_IDENTIFIER: 'u', CAPITAL_API_KEY: 'k', CAPITAL_API_PASSWORD: 'p' };

  it('usa demo por defecto', () => {
    expect(capitalConfigFromEnv(base)?.env).toBe('demo');
  });

  it('no habilita real sin CAPITAL_ALLOW_LIVE=true', () => {
    expect(capitalConfigFromEnv({ ...base, CAPITAL_ENV: 'live' })).toBeNull();
    expect(capitalConfigFromEnv({ ...base, CAPITAL_ENV: 'live', CAPITAL_ALLOW_LIVE: 'true' })?.env).toBe('live');
  });

  it('queda deshabilitado si falta una credencial', () => {
    expect(capitalConfigFromEnv({ CAPITAL_IDENTIFIER: 'u', CAPITAL_API_KEY: 'k' })).toBeNull();
  });

  it('acepta un mapa de epics', () => {
    const c = capitalConfigFromEnv({ ...base, CAPITAL_EPIC_MAP: 'US500=US500, XAU/USD=GOLD' })!;
    const a = new CapitalAdapter(c);
    expect(a.epicFor('XAU/USD')).toBe('GOLD');
    expect(a.epicFor('EUR/USD')).toBe('EURUSD');
  });

  describe('cuenta elegida con CAPITAL_ACCOUNT_ID', () => {
    const accounts = (c: Call) =>
      c.method === 'GET' && c.url.endsWith('/api/v1/accounts')
        ? { status: 200, body: { accounts: [{ accountId: 'A1', accountName: 'demoj1normal' }, { accountId: 'A2', accountName: 'demoj2agents' }] } }
        : null;
    const loginOn = (current: string) => (c: Call) =>
      c.method === 'POST' && c.url.endsWith('/api/v1/session')
        ? { status: 200, body: { currentAccountId: current }, headers: { CST: 'cst-1', 'X-SECURITY-TOKEN': 'tok-1' } }
        : null;
    const positions = (c: Call) => (c.method === 'GET' && c.url.endsWith('/api/v1/positions') ? { status: 200, body: { positions: [] } } : null);

    it('lee la variable', () => {
      expect(capitalConfigFromEnv({ CAPITAL_IDENTIFIER: 'u', CAPITAL_API_KEY: 'k', CAPITAL_API_PASSWORD: 'p', CAPITAL_ACCOUNT_ID: ' demoj1normal ' })?.account).toBe('demoj1normal');
    });

    it('cambia a la cuenta por nombre antes de operar', async () => {
      const { fn, calls } = fakeFetch([
        loginOn('A2'),
        accounts,
        (c) => (c.method === 'PUT' && c.url.endsWith('/api/v1/session') ? { status: 200, body: {} } : null),
        positions,
      ]);
      await new CapitalAdapter({ ...config, account: 'demoj1normal' }, fn, async () => {}).positions!();
      const put = calls.find((c) => c.method === 'PUT');
      expect(put?.body).toEqual({ accountId: 'A1' });
      expect(calls.indexOf(put!)).toBeLessThan(calls.findIndex((c) => c.url.endsWith('/api/v1/positions')));
    });

    it('no cambia si ya está en esa cuenta', async () => {
      const { fn, calls } = fakeFetch([loginOn('A1'), accounts, positions]);
      await new CapitalAdapter({ ...config, account: 'A1' }, fn, async () => {}).positions!();
      expect(calls.some((c) => c.method === 'PUT')).toBe(false);
    });

    it('no opera si la cuenta no existe', async () => {
      const { fn, calls } = fakeFetch([loginOn('A1'), accounts, positions]);
      await expect(new CapitalAdapter({ ...config, account: 'otra' }, fn, async () => {}).positions!()).rejects.toThrow('no existe la cuenta otra');
      expect(calls.some((c) => c.url.endsWith('/api/v1/positions'))).toBe(false);
    });
  });
});
