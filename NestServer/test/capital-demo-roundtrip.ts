import dotenv from 'dotenv';
dotenv.config();

import {
  CapitalAdapter,
  capitalConfigFromEnv,
} from '../src/execution/capital/capital.adapter';

async function main() {
  const config = capitalConfigFromEnv(process.env);
  if (!config || config.env !== 'demo') {
    console.log('Capital.com no está configurado en demo; no hago nada.');
    process.exit(1);
  }
  const symbol = process.argv[2] ?? 'EUR/USD';
  const adapter = new CapitalAdapter(config);
  const opened = await adapter.open({ symbol, direction: 'BUY', size: 100 });
  console.log('abierta:', opened);
  await new Promise((r) => setTimeout(r, 3000));
  const closed = await adapter.close({
    symbol,
    dealId: opened.dealId,
    dealReference: opened.dealReference,
  });
  console.log('cerrada:', closed);
}

main().catch((err) => {
  console.error('error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
