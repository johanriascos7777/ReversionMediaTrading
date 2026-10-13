/**
 * historical-data.service.ts
 *
 * Descarga y cachea velas históricas de TwelveData en MySQL.
 *
 * Características:
 * - Paginación automática con start_date/end_date (máx 5000 velas/request)
 * - Rotación de API keys independiente del MarketService (evita race conditions)
 * - Caché en MySQL: INSERT IGNORE para no gastar créditos re-descargando
 * - Gap-filling: solo descarga lo que falta desde la última vela almacenada
 */

import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/mysql';
import * as https from 'https';
import * as http from 'http';
import { HistoricalCandle } from './historical-candle.entity';
import type { RawTwelveDataCandle, DownloadResult } from './historical.types';
import type { Candle } from '../market/types';

// ─── Configuración ───────────────────────────────────────────────────────────
const RATE_LIMIT_COOLDOWN_MS = 65_000;  // Cooldown cuando una key recibe rate-limit
const INTER_REQUEST_DELAY_MS = 1_500;   // Pausa entre requests para no saturar la API
const MAX_OUTPUT_SIZE         = 5000;    // Máximo de velas por request (límite TwelveData)

@Injectable()
export class HistoricalDataService {

  private readonly apiKeys: string[];
  private currentKeyIndex = 0;
  private readonly exhaustedKeys = new Map<string, number>(); // key → timestamp de agotamiento

  constructor(private readonly em: EntityManager) {
    // Leer pool de keys desde la misma env var que MarketService
    const raw = process.env.TWELVE_DATA_API_KEY ?? '';
    this.apiKeys = raw.split(',').map(k => k.trim()).filter(Boolean);

    if (this.apiKeys.length === 0) {
      console.warn('[HistoricalData] ⚠️ No se encontraron API keys en TWELVE_DATA_API_KEY');
    } else {
      console.log(`[HistoricalData] Pool de ${this.apiKeys.length} API keys cargado`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Rotación de Keys (independiente del MarketService)
  // ═══════════════════════════════════════════════════════════════════════════

  private getNextKey(): string {
    const now = Date.now();

    // Limpiar keys cuyo cooldown ya expiró
    for (const [key, ts] of this.exhaustedKeys) {
      if (now - ts >= RATE_LIMIT_COOLDOWN_MS) this.exhaustedKeys.delete(key);
    }

    // Buscar la siguiente key disponible (round-robin)
    for (let i = 0; i < this.apiKeys.length; i++) {
      const idx = (this.currentKeyIndex + i) % this.apiKeys.length;
      const key = this.apiKeys[idx];
      if (!this.exhaustedKeys.has(key)) {
        this.currentKeyIndex = (idx + 1) % this.apiKeys.length;
        return key;
      }
    }

    // Todas agotadas — esperar al primero que se libere
    console.warn('[HistoricalData] Todas las keys en cooldown. Usando la primera como fallback.');
    return this.apiKeys[0] ?? '';
  }

  private markKeyExhausted(key: string): void {
    this.exhaustedKeys.set(key, Date.now());
    const masked = key.length > 8 ? `...${key.slice(-6)}` : key;
    console.warn(`[HistoricalData] 🔄 Key ${masked} en cooldown (${RATE_LIMIT_COOLDOWN_MS / 1000}s)`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Descarga con Paginación y Caché
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Descarga velas históricas y las almacena en MySQL.
   * Solo descarga lo que falta (gap-fill desde la última vela en caché).
   *
   * @param symbol    Ej: 'EUR/USD'
   * @param timeframe '5min' o '15min'
   * @param totalCandles Cuántas velas hacia atrás si no hay caché (default: 10000)
   */
  async downloadHistory(
    symbol: string,
    timeframe: '5min' | '15min',
    totalCandles: number = 10_000,
  ): Promise<DownloadResult> {
    const fork = this.em.fork();

    // 1. Buscar la vela más reciente en caché
    const latest = await fork.findOne(
      HistoricalCandle,
      { symbol, timeframe },
      { orderBy: { timestamp: 'DESC' } },
    );

    const endDate = new Date();
    let startDate: Date;

    if (latest) {
      // Gap-fill: solo desde la última vela almacenada
      startDate = new Date(latest.timestamp.getTime() + 1);
      console.log(
        `[HistoricalData] [${symbol}] ${timeframe} — caché hasta ` +
        `${latest.timestamp.toISOString()}. Descargando gap...`,
      );
    } else {
      // Primera descarga: calcular cuánto ir hacia atrás
      const intervalMs = timeframe === '5min' ? 5 * 60_000 : 15 * 60_000;
      startDate = new Date(endDate.getTime() - totalCandles * intervalMs);
      console.log(
        `[HistoricalData] [${symbol}] ${timeframe} — sin caché. ` +
        `Descargando ~${totalCandles} velas desde ${startDate.toISOString().slice(0, 10)}...`,
      );
    }

    // 2. Paginar: cada request trae máx 5000 velas
    let downloaded = 0;
    let pages = 0;
    let currentStart = new Date(startDate);

    while (currentStart < endDate) {
      const key = this.getNextKey();
      if (!key) {
        console.error('[HistoricalData] No hay API keys disponibles. Abortando.');
        break;
      }

      const batch = await this.fetchBatch(
        symbol, timeframe, key,
        this.formatDate(currentStart),
        this.formatDate(endDate),
      );

      if (batch === 'RATE_LIMIT') {
        this.markKeyExhausted(key);
        await this.sleep(2000);
        continue; // Reintentar con otra key
      }

      if (batch === 'DAILY_LIMIT') {
        this.markKeyExhausted(key);
        console.error(`[HistoricalData] Key con créditos diarios agotados. Rotando...`);
        await this.sleep(2000);
        continue;
      }

      if (batch === 'ERROR' || batch.length === 0) break;

      // 3. Insertar en DB (ignorar duplicados)
      const inserted = await this.upsertCandles(fork, batch, symbol, timeframe);
      downloaded += inserted;
      pages++;

      console.log(
        `[HistoricalData] [${symbol}] ${timeframe} — página ${pages}: ` +
        `+${inserted} velas nuevas (batch: ${batch.length})`,
      );

      // Si recibimos menos del máximo, no hay más datos
      if (batch.length < MAX_OUTPUT_SIZE) break;

      // Avanzar la ventana al último timestamp recibido + 1ms
      const lastCandle = batch[batch.length - 1];
      currentStart = new Date(lastCandle.timestamp.getTime() + 1);

      // Pausa entre requests
      await this.sleep(INTER_REQUEST_DELAY_MS);
    }

    // Contar total en caché
    const totalInCache = await fork.count(HistoricalCandle, { symbol, timeframe });

    const result: DownloadResult = {
      symbol,
      timeframe,
      newCandles: downloaded,
      totalInCache,
      pagesDownloaded: pages,
    };

    console.log(
      `[HistoricalData] [${symbol}] ${timeframe} — ` +
      `Descarga completada. ${downloaded} velas nuevas, ${totalInCache} total en caché.`,
    );

    return result;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Lectura del Caché (para backtest)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Lee velas del caché MySQL y las retorna como Candle[] del market engine.
   * Si el caché está vacío, NO dispara descarga automática (para evitar side effects inesperados).
   */
  async getCandles(
    symbol: string,
    timeframe: '5min' | '15min',
    limit: number = 10_000,
  ): Promise<Candle[]> {
    const fork = this.em.fork();

    const candles = await fork.find(
      HistoricalCandle,
      { symbol, timeframe },
      { orderBy: { timestamp: 'ASC' }, limit },
    );

    if (candles.length === 0) {
      console.warn(
        `[HistoricalData] [${symbol}] ${timeframe} — caché vacío. ` +
        `Usa POST /consolidation/download/${encodeURIComponent(symbol)} para descargar.`,
      );
    }

    // Convertir HistoricalCandle → Candle (tipo del market engine)
    return candles.map(c => ({
      time:   c.timestamp.getTime(),
      open:   c.open,
      high:   c.high,
      low:    c.low,
      close:  c.close,
      closed: true,
    }));
  }

  /**
   * Retorna el conteo de velas en caché.
   */
  async getCacheCount(symbol: string, timeframe: '5min' | '15min'): Promise<number> {
    const fork = this.em.fork();
    return fork.count(HistoricalCandle, { symbol, timeframe });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Fetch individual (1 página de TwelveData)
  // ═══════════════════════════════════════════════════════════════════════════

  private fetchBatch(
    symbol: string,
    timeframe: string,
    apiKey: string,
    startDate: string,
    endDate: string,
  ): Promise<{ timestamp: Date; open: number; high: number; low: number; close: number }[] | 'RATE_LIMIT' | 'DAILY_LIMIT' | 'ERROR'> {
    return new Promise((resolve) => {
      const path =
        `/time_series?symbol=${encodeURIComponent(symbol)}` +
        `&interval=${timeframe}` +
        `&start_date=${encodeURIComponent(startDate)}` +
        `&end_date=${encodeURIComponent(endDate)}` +
        `&outputsize=${MAX_OUTPUT_SIZE}` +
        `&apikey=${apiKey}`;

      const req = https.request(
        { hostname: 'api.twelvedata.com', path, method: 'GET' },
        (res: http.IncomingMessage) => {
          let raw = '';
          res.on('data', (chunk: Buffer) => { raw += chunk.toString(); });
          res.on('end', () => {
            try {
              const data = JSON.parse(raw);

              if (data.status !== 'ok' || !data.values) {
                const msg: string = data.message || '';
                const msgLow = msg.toLowerCase();

                if (
                  msgLow.includes('run out of api credits') ||
                  msgLow.includes('api credits for the day') ||
                  (msgLow.includes('credit') && msgLow.includes('limit being 800'))
                ) {
                  resolve('DAILY_LIMIT');
                  return;
                }

                if (
                  msgLow.includes('rate limit') ||
                  msgLow.includes('too many requests') ||
                  msgLow.includes('per minute limit')
                ) {
                  resolve('RATE_LIMIT');
                  return;
                }

                console.error(
                  `[HistoricalData] [${symbol}] Error de API: ${msg || JSON.stringify(data).slice(0, 200)}`,
                );
                resolve('ERROR');
                return;
              }

              // TwelveData retorna las velas en orden descendente (más reciente primero)
              // Las invertimos para tener orden cronológico ascendente
              const candles = [...(data.values as RawTwelveDataCandle[])]
                .reverse()
                .map((c: RawTwelveDataCandle) => ({
                  timestamp: new Date(c.datetime),
                  open:      parseFloat(c.open),
                  high:      parseFloat(c.high),
                  low:       parseFloat(c.low),
                  close:     parseFloat(c.close),
                }));

              resolve(candles);
            } catch (e) {
              console.error(`[HistoricalData] [${symbol}] Error parseando JSON:`, e);
              resolve('ERROR');
            }
          });
        },
      );

      req.on('error', (err: Error) => {
        console.error(`[HistoricalData] [${symbol}] Error de red:`, err.message);
        resolve('ERROR');
      });

      req.end();
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Upsert en DB (INSERT IGNORE para evitar duplicados)
  // ═══════════════════════════════════════════════════════════════════════════

  private async upsertCandles(
    fork: EntityManager,
    batch: { timestamp: Date; open: number; high: number; low: number; close: number }[],
    symbol: string,
    timeframe: string,
  ): Promise<number> {
    let inserted = 0;

    // Procesar en chunks de 500 para no saturar la DB
    const CHUNK_SIZE = 500;
    for (let i = 0; i < batch.length; i += CHUNK_SIZE) {
      const chunk = batch.slice(i, i + CHUNK_SIZE);

      const entities = chunk.map(c => {
        const entity = new HistoricalCandle();
        entity.symbol    = symbol;
        entity.timeframe = timeframe;
        entity.timestamp = c.timestamp;
        entity.open      = c.open;
        entity.high      = c.high;
        entity.low       = c.low;
        entity.close     = c.close;
        return entity;
      });

      try {
        // MikroORM v7: usar nativeInsertMany con onConflictAction para INSERT IGNORE
        await fork.insertMany(entities);
        inserted += chunk.length;
      } catch (err: any) {
        // Si es error de duplicado (MySQL ER_DUP_ENTRY), insertar uno por uno
        if (err?.code === 'ER_DUP_ENTRY' || err?.errno === 1062) {
          for (const entity of entities) {
            try {
              fork.persist(entity);
              await fork.flush();
              inserted++;
            } catch (innerErr: any) {
              // Duplicado individual — skip silencioso
              if (innerErr?.code === 'ER_DUP_ENTRY' || innerErr?.errno === 1062) {
                fork.clear(); // Limpiar el identity map tras el error
                continue;
              }
              throw innerErr;
            }
          }
        } else {
          throw err;
        }
      }
    }

    // Flush final
    try {
      await fork.flush();
    } catch {
      // Ya se hizo flush individualmente si hubo fallback
    }

    return inserted;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Utilidades
  // ═══════════════════════════════════════════════════════════════════════════

  private formatDate(d: Date): string {
    // Formato: "2024-01-15 09:30:00" (lo que espera TwelveData)
    return d.toISOString().slice(0, 19).replace('T', ' ');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
  }
}
