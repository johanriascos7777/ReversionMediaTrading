/**
 * useStructureData.ts
 *
 * Hook que consume los mensajes 'structure-snapshot' del WebSocket
 * del backend y los expone al componente StructureCockpit.
 *
 * Corre completamente en paralelo a useMarketData — no comparte estado.
 */

import { useState, useEffect, useRef } from 'react';
import { WS_URL } from '@/config/env';

// ─── Tipos (espejo del backend) ────────────────────────────────────────────

export type StructureState = 'STRONG' | 'MODERATE' | 'WEAK';
export type SignalDirection = 'SELL' | 'BUY' | 'WAIT';
export type DivergenceType  = 'bearish' | 'bullish' | 'none';
export type TrendDirection  = 'up' | 'down' | 'flat';

export type SRLevel = {
  price:    number;
  type:     'resistance' | 'support';
  strength: number;
  distance: number;
};

export type StructureSnapshot = {
  type:           'structure-snapshot';
  symbol:         string;
  timeframe:      'M5' | 'M15';
  price:          number;
  rsi:            number;
  rsiZone:        'overbought' | 'oversold' | 'neutral';
  ema50:          number;
  ema100:         number;
  ema200:         number;
  ema200Slope:    TrendDirection;
  priceVsEma200:  'above' | 'below';
  isCompressionSandwich: boolean;
  doublePattern:  'double_top' | 'double_bottom' | 'none';
  divergence:     DivergenceType;
  srLevels:       SRLevel[];
  nearestSR:      SRLevel | null;
  confluences:    string[];
  structureState: StructureState;
  signal:         SignalDirection;
  explanation:    string;
  timestamp:      number;
};

// Mapa por símbolo → último snapshot de M5 y M15
export type StructureData = {
  [symbol: string]: {
    m5:  StructureSnapshot | null;
    m15: StructureSnapshot | null;
  };
};

// ─── Hook ──────────────────────────────────────────────────────────────────

export function useStructureData(): StructureData {
  const [data, setData] = useState<StructureData>({});
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let retryTimeout: NodeJS.Timeout;
    let active = true;

    const connect = () => {
      if (!active) return;

      // Reutilizar la misma URL WebSocket del sistema principal
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onmessage = (event: MessageEvent) => {
        try {
          const msg = JSON.parse(event.data as string);
          if (msg.type !== 'structure-snapshot') return;

          const snap = msg as StructureSnapshot;

          setData(prev => {
            const existing = prev[snap.symbol] ?? { m5: null, m15: null };
            return {
              ...prev,
              [snap.symbol]: {
                m5:  snap.timeframe === 'M5'  ? snap : existing.m5,
                m15: snap.timeframe === 'M15' ? snap : existing.m15,
              },
            };
          });
        } catch {
          // Ignorar mensajes malformados
        }
      };

      ws.onclose = () => {
        if (active) retryTimeout = setTimeout(connect, 5000);
      };

      ws.onerror = () => ws.close();
    };

    connect();

    return () => {
      active = false;
      clearTimeout(retryTimeout);
      wsRef.current?.close();
    };
  }, []);

  return data;
}
