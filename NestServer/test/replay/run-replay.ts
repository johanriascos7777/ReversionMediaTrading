import * as fs from 'fs';
import * as path from 'path';
import { loadBars, runReplay } from './replay-harness';

const FIXTURES = path.join(__dirname, 'fixtures');
const SYMBOLS: Record<string, string> = {
  'EUR/USD': 'EURUSD-1min.csv.gz',
  'EUR/GBP': 'EURGBP-1min.csv.gz',
};

async function main() {
  const out = process.argv[2];
  const from = Date.parse(process.argv[3] ?? '2026-10-05T11:00:00Z');
  const to = Date.parse(process.argv[4] ?? '2026-10-17T00:00:00Z');
  const live = process.argv.includes('--24h');
  if (!out) {
    console.error(
      'Uso: ts-node --transpile-only test/replay/run-replay.ts <salida.json> [desde ISO] [hasta ISO] [--check] [--24h]',
    );
    process.exit(1);
  }

  const barsBySymbol: Record<string, ReturnType<typeof loadBars>> = {};
  for (const [symbol, file] of Object.entries(SYMBOLS)) {
    barsBySymbol[symbol] = loadBars(path.join(FIXTURES, file));
  }

  const started = Date.now();
  const result = await runReplay({
    barsBySymbol,
    from,
    to,
    ignoreSchedule: live,
  });
  fs.writeFileSync(out, JSON.stringify(result, null, 1));

  const counts = new Map<string, number>();
  for (const a of result.alerts) {
    const key = `${a.tradeMode} · ${a.alertName}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  console.log(
    `Ticks: ${result.ticks} · alertas: ${result.alerts.length} · mensajes: ${result.messages.length} · ${((Date.now() - started) / 1000).toFixed(1)} s`,
  );
  for (const [key, n] of [...counts.entries()].sort())
    console.log(`  ${key}: ${n}`);

  if (process.argv.includes('--check')) {
    const golden = JSON.parse(
      fs.readFileSync(
        path.join(
          __dirname,
          'golden',
          live ? 'v1-expected-24h.json' : 'v1-expected.json',
        ),
        'utf8',
      ),
    ) as {
      v1: Array<{
        iso: string;
        symbol: string;
        direction: string;
        price: number;
      }>;
    };
    const key = (a: {
      iso: string;
      symbol: string;
      direction: string;
      price: number;
    }) => `${a.iso} ${a.symbol} ${a.direction} ${a.price.toFixed(5)}`;
    const expected = golden.v1.map(key);
    const actual = result.alerts.filter((a) => a.tradeMode === 'v1').map(key);
    const same =
      expected.length === actual.length &&
      expected.every((k, i) => k === actual[i]);
    console.log(
      same
        ? `v1 idéntica a la línea base (${actual.length} alertas).`
        : 'v1 DISTINTA a la línea base:',
    );
    if (!same) {
      console.log('  esperadas:', expected);
      console.log('  obtenidas:', actual);
      process.exit(2);
    }
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
