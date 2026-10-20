import {
  BrokerError,
  type BrokerAdapter,
  type BrokerPositionMark,
  type CloseResult,
  type OpenRequest,
  type OpenResult,
  type Quote,
} from '../broker.types';

export type CapitalConfig = {
  env: 'demo' | 'live';
  identifier: string;
  apiKey: string;
  password: string;
  epicMap?: Record<string, string>;
};

type FetchFn = typeof fetch;

const BASE_URLS = {
  demo: 'https://demo-api-capital.backend-capital.com',
  live: 'https://api-capital.backend-capital.com',
};

const SESSION_MAX_IDLE_MS = 8 * 60_000;
const CONFIRM_ATTEMPTS = 20;
const CONFIRM_INTERVAL_MS = 500;
const REQUEST_TIMEOUT_MS = 15_000;

type Session = { cst: string; token: string; lastUsed: number };

export function capitalConfigFromEnv(
  env: NodeJS.ProcessEnv,
): CapitalConfig | null {
  const identifier = env.CAPITAL_IDENTIFIER?.trim();
  const apiKey = env.CAPITAL_API_KEY?.trim();
  const password = env.CAPITAL_API_PASSWORD?.trim();
  if (!identifier || !apiKey || !password) return null;
  const mode = (env.CAPITAL_ENV ?? 'demo').trim().toLowerCase();
  if (mode !== 'demo' && mode !== 'live') return null;
  if (mode === 'live' && env.CAPITAL_ALLOW_LIVE !== 'true') return null;
  const epicMap: Record<string, string> = {};
  for (const pair of (env.CAPITAL_EPIC_MAP ?? '').split(',')) {
    const [symbol, epic] = pair.split('=').map((s) => s?.trim());
    if (symbol && epic) epicMap[symbol] = epic;
  }
  return { env: mode, identifier, apiKey, password, epicMap };
}

export class CapitalAdapter implements BrokerAdapter {
  readonly id = 'capital';
  readonly label: string;
  readonly live: boolean;
  private readonly base: string;
  private session: Session | null = null;

  constructor(
    private readonly config: CapitalConfig,
    private readonly fetchFn: FetchFn = fetch,
    private readonly sleep: (ms: number) => Promise<void> = (ms) =>
      new Promise((r) => setTimeout(r, ms)),
    private readonly now: () => number = Date.now,
  ) {
    this.live = config.env === 'live';
    this.label = this.live ? 'Capital.com (REAL)' : 'Capital.com demo';
    this.base = BASE_URLS[config.env];
  }

  epicFor(symbol: string): string {
    return this.config.epicMap?.[symbol] ?? symbol.replace('/', '');
  }

  async open(req: OpenRequest): Promise<OpenResult> {
    const epic = this.epicFor(req.symbol);
    const body: Record<string, unknown> = {
      epic,
      direction: req.direction,
      size: req.size,
      guaranteedStop: false,
    };
    if (req.stopLevel !== undefined) body.stopLevel = req.stopLevel;
    if (req.profitLevel !== undefined) body.profitLevel = req.profitLevel;

    const res = await this.request('POST', '/api/v1/positions', body);
    const dealReference: string | undefined = res?.dealReference;
    if (!dealReference)
      throw new BrokerError('Capital.com no devolvió dealReference');

    const confirm = await this.waitConfirm(dealReference);
    if (!confirm) {
      return {
        brokerSymbol: epic,
        dealId: null,
        dealReference,
        level: null,
        confirmed: false,
      };
    }
    if (confirm.dealStatus !== 'ACCEPTED') {
      throw new BrokerError(
        `Capital.com rechazó la orden: ${confirm.reason ?? confirm.dealStatus}`,
      );
    }
    return {
      brokerSymbol: epic,
      dealId: this.positionDealId(confirm),
      dealReference,
      level: typeof confirm.level === 'number' ? confirm.level : null,
      confirmed: true,
    };
  }

  async close(position: {
    symbol: string;
    dealId: string | null;
    dealReference: string | null;
  }): Promise<CloseResult> {
    let dealId = position.dealId;
    if (!dealId && position.dealReference) {
      const confirm = await this.fetchConfirm(position.dealReference);
      if (confirm?.dealStatus === 'ACCEPTED')
        dealId = this.positionDealId(confirm);
    }
    if (!dealId) return { level: null, alreadyClosed: true };

    let res: any;
    try {
      res = await this.request(
        'DELETE',
        `/api/v1/positions/${encodeURIComponent(dealId)}`,
      );
    } catch (err) {
      if (err instanceof BrokerError && err.notFound)
        return { level: null, alreadyClosed: true };
      throw err;
    }
    const ref: string | undefined = res?.dealReference;
    const confirm = ref ? await this.waitConfirm(ref) : null;
    if (confirm && confirm.dealStatus === 'REJECTED') {
      throw new BrokerError(
        `Capital.com rechazó el cierre: ${confirm.reason ?? 'sin motivo'}`,
      );
    }
    return {
      level: confirm && typeof confirm.level === 'number' ? confirm.level : null,
      alreadyClosed: false,
    };
  }

  async positions(): Promise<BrokerPositionMark[]> {
    const res = await this.request('GET', '/api/v1/positions');
    const list: any[] = Array.isArray(res?.positions) ? res.positions : [];
    const marks: BrokerPositionMark[] = [];
    for (const item of list) {
      const p = item?.position;
      const m = item?.market;
      if (!p?.dealId || typeof m?.bid !== 'number' || typeof m?.offer !== 'number')
        continue;
      marks.push({
        dealId: p.dealId,
        dealReference: p.dealReference ?? null,
        brokerSymbol: m.epic ?? '',
        direction: p.direction,
        size: Number(p.size),
        level: Number(p.level),
        upl: typeof p.upl === 'number' ? p.upl : null,
        bid: m.bid,
        offer: m.offer,
      });
    }
    return marks;
  }

  async quotes(symbols: string[]): Promise<Record<string, Quote>> {
    const bySymbol = new Map(symbols.map((s) => [this.epicFor(s), s]));
    if (!bySymbol.size) return {};
    const epics = [...bySymbol.keys()].map(encodeURIComponent).join(',');
    const res = await this.request('GET', `/api/v1/markets?epics=${epics}`);
    const list: any[] = res?.marketDetails ?? res?.markets ?? [];
    const out: Record<string, Quote> = {};
    for (const item of list) {
      const symbol = bySymbol.get(item?.instrument?.epic ?? item?.epic);
      const bid = item?.snapshot?.bid ?? item?.bid;
      const offer = item?.snapshot?.offer ?? item?.offer;
      if (symbol && typeof bid === 'number' && typeof offer === 'number')
        out[symbol] = { bid, offer };
    }
    return out;
  }

  private positionDealId(confirm: any): string | null {
    const deals: any[] = Array.isArray(confirm.affectedDeals)
      ? confirm.affectedDeals
      : [];
    const opened = deals.find((d) => d?.status === 'OPENED') ?? deals[0];
    return opened?.dealId ?? confirm.dealId ?? null;
  }

  private async waitConfirm(ref: string): Promise<any | null> {
    for (let i = 0; i < CONFIRM_ATTEMPTS; i++) {
      const confirm = await this.fetchConfirm(ref);
      if (
        confirm &&
        (confirm.dealStatus === 'ACCEPTED' || confirm.dealStatus === 'REJECTED')
      )
        return confirm;
      await this.sleep(CONFIRM_INTERVAL_MS);
    }
    return null;
  }

  private async fetchConfirm(ref: string): Promise<any | null> {
    try {
      return await this.request(
        'GET',
        `/api/v1/confirms/${encodeURIComponent(ref)}`,
      );
    } catch (err) {
      if (err instanceof BrokerError && err.notFound) return null;
      throw err;
    }
  }

  private async login(): Promise<Session> {
    const res = await this.fetchFn(`${this.base}/api/v1/session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CAP-API-KEY': this.config.apiKey,
      },
      body: JSON.stringify({
        identifier: this.config.identifier,
        password: this.config.password,
        encryptedPassword: false,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) {
      const payload = await this.readJson(res);
      throw new BrokerError(
        `Capital.com no aceptó el inicio de sesión (${res.status}${payload?.errorCode ? ` ${payload.errorCode}` : ''})`,
        res.status,
      );
    }
    const cst = res.headers.get('CST');
    const token = res.headers.get('X-SECURITY-TOKEN');
    if (!cst || !token)
      throw new BrokerError('Capital.com no devolvió los tokens de sesión');
    this.session = { cst, token, lastUsed: this.now() };
    return this.session;
  }

  private async request(
    method: 'GET' | 'POST' | 'DELETE',
    path: string,
    body?: unknown,
    retried = false,
  ): Promise<any> {
    let session = this.session;
    if (!session || this.now() - session.lastUsed > SESSION_MAX_IDLE_MS)
      session = await this.login();

    const res = await this.fetchFn(`${this.base}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-CAP-API-KEY': this.config.apiKey,
        CST: session.cst,
        'X-SECURITY-TOKEN': session.token,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    session.lastUsed = this.now();

    if (res.status === 401 && !retried) {
      this.session = null;
      return this.request(method, path, body, true);
    }
    const payload = await this.readJson(res);
    if (!res.ok) {
      throw new BrokerError(
        `Capital.com respondió ${res.status}${payload?.errorCode ? ` (${payload.errorCode})` : ''}`,
        res.status,
        typeof payload?.errorCode === 'string' ? payload.errorCode : null,
      );
    }
    return payload;
  }

  private async readJson(res: Response): Promise<any> {
    try {
      const text = await res.text();
      return text ? JSON.parse(text) : null;
    } catch {
      return null;
    }
  }
}
