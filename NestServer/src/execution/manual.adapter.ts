import type {
  BrokerAdapter,
  CloseResult,
  OpenRequest,
  OpenResult,
} from './broker.types';

export class ManualAdapter implements BrokerAdapter {
  readonly id = 'manual';
  readonly label = 'Sin broker (solo bloquea el símbolo)';
  readonly live = false;

  async open(req: OpenRequest): Promise<OpenResult> {
    return {
      brokerSymbol: req.symbol,
      dealId: null,
      dealReference: null,
      level: null,
      confirmed: true,
    };
  }

  async close(): Promise<CloseResult> {
    return { level: null, alreadyClosed: false };
  }
}
