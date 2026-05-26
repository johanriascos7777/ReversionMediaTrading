import { Injectable, OnModuleInit } from '@nestjs/common';
import { MarketService } from '../market/market.service';
import type { BackendMessage } from '../market/types';
import { calculateStructureSnapshot } from './structureEngine';
import type { StructureSnapshot } from './structure.types';

// Intervalo mínimo entre cálculos de estructura por símbolo (ms)
// El motor de elasticidad emite ~cada 1-10s según REST/WS.
// El motor de estructura corre máximo una vez cada 5s por símbolo.
const MIN_INTERVAL_MS = 5_000;

@Injectable()
export class StructureService implements OnModuleInit {
  // Último timestamp de cálculo por símbolo+timeframe
  private lastCalcTime = new Map<string, number>();

  constructor(private readonly marketService: MarketService) {}

  onModuleInit() {
    // Escuchar los broadcasts del motor de elasticidad.
    // Cada vez que llega un snapshot de un símbolo, calculamos
    // el análisis de estructura usando el historial ya disponible.
    this.marketService.events.on('broadcast', (msg: BackendMessage) => {
      if (msg.type !== 'snapshot') return;
      this.onSnapshot(msg.symbol, msg.m5.timestamp, msg.m5.price);
    });

    console.log('[StructureService] Inicializado — escuchando snapshots del motor de elasticidad.');
  }

  private onSnapshot(symbol: string, timestamp: number, price: number): void {
    // Calcular en M5 y M15
    this.runForTimeframe(symbol, price, '5min', 'M5', timestamp);
    this.runForTimeframe(symbol, price, '15min', 'M15', timestamp);
  }

  private runForTimeframe(
    symbol: string,
    price:  number,
    interval: '5min' | '15min',
    timeframe: 'M5' | 'M15',
    timestamp: number
  ): void {
    const key = `${symbol}:${timeframe}`;
    const now = Date.now();
    const last = this.lastCalcTime.get(key) ?? 0;

    // Rate-limit: no recalcular más de una vez cada MIN_INTERVAL_MS
    if (now - last < MIN_INTERVAL_MS) return;
    this.lastCalcTime.set(key, now);

    const candles = this.marketService.getHistory(symbol, interval);
    if (candles.length < 210) return; // EMA200 necesita mínimo 210 velas

    const snap: StructureSnapshot | null = calculateStructureSnapshot(
      symbol,
      candles,
      price,
      timeframe,
      timestamp
    );

    if (!snap) return;

    // Emitir en el mismo canal de broadcast del gateway
    // El gateway retransmite TODO lo que llega a 'broadcast' a los clientes WS
    this.marketService.events.emit('broadcast', snap as unknown as BackendMessage);

    if (Math.random() < 0.1) {
      console.log(
        `[Structure] [${symbol}] ${timeframe}`,
        `· RSI: ${snap.rsi.toFixed(1)}`,
        `· ${snap.structureState} ${snap.signal}`,
        `· ${snap.divergence !== 'none' ? `Div: ${snap.divergence}` : 'Sin div'}`,
        `· SR: ${snap.nearestSR ? `${snap.nearestSR.type} @${snap.nearestSR.price.toFixed(5)} (${snap.nearestSR.distance.toFixed(1)} ATR)` : 'ninguno'}`
      );
    }
  }
}
