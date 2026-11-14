export type Direction = 'BUY' | 'SELL';

export type OpenRequest = {
  symbol: string;
  direction: Direction;
  size: number;
  stopLevel?: number;
  profitLevel?: number;
};

export type OpenResult = {
  brokerSymbol: string;
  dealId: string | null;
  dealReference: string | null;
  level: number | null;
  confirmed: boolean;
};

export type CloseResult = {
  level: number | null;
  alreadyClosed: boolean;
};

export type Quote = { bid: number; offer: number };

export type ClosedDeal = {
  level: number | null;
  pnl: number | null;
  source: string | null;
  at: Date | null;
};

export type BrokerPositionMark = {
  dealId: string;
  dealReference: string | null;
  brokerSymbol: string;
  direction: Direction;
  size: number;
  level: number;
  upl: number | null;
  bid: number;
  offer: number;
};

export interface BrokerAdapter {
  readonly id: string;
  readonly label: string;
  readonly live: boolean;
  open(req: OpenRequest): Promise<OpenResult>;
  close(position: {
    symbol: string;
    dealId: string | null;
    dealReference: string | null;
  }): Promise<CloseResult>;
  positions?(): Promise<BrokerPositionMark[]>;
  quotes?(symbols: string[]): Promise<Record<string, Quote>>;
  closedDeal?(dealId: string, since: Date): Promise<ClosedDeal | null>;
}

export class BrokerError extends Error {
  constructor(
    message: string,
    readonly status: number | null = null,
    readonly code: string | null = null,
  ) {
    super(message);
  }

  get notFound(): boolean {
    return this.status === 404 || !!this.code?.includes('not-found');
  }
}
