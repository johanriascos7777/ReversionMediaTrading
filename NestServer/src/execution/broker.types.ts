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
