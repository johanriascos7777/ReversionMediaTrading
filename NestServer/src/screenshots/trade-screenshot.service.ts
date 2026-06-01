/**
 * trade-screenshot.service.ts
 * Gestiona el campo screenshotUrls (JSON array) en la entidad Trade.
 */
import { Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/mysql';
import { Trade } from '../trade/trade.entity';

@Injectable()
export class TradeScreenshotService {
  constructor(private readonly em: EntityManager) {}

  private parseUrls(val: any): string[] {
    if (!val) return [];
    if (Array.isArray(val)) {
      // Filtrar strings corruptos de longitud 1 (ej: 'h', 't', etc.) por si ya se guardaron así
      return val.filter(u => typeof u === 'string' && u.length > 5 && u.startsWith('http'));
    }
    if (typeof val === 'string') {
      try {
        const parsed = JSON.parse(val);
        if (Array.isArray(parsed)) {
          return parsed.filter(u => typeof u === 'string' && u.length > 5 && u.startsWith('http'));
        }
      } catch {
        if (val.startsWith('http')) return [val];
      }
    }
    return [];
  }

  /** Agrega URLs al array screenshotUrls del trade */
  async addScreenshots(tradeId: number, urls: string[]): Promise<Trade> {
    const trade = await this.em.findOne(Trade, tradeId);
    if (!trade) throw new NotFoundException(`Trade #${tradeId} no encontrado`);

    const current = this.parseUrls(trade.screenshotUrls);
    trade.screenshotUrls = [...current, ...urls];
    await this.em.flush();
    return trade;
  }

  /** Elimina una URL específica del array screenshotUrls del trade */
  async removeScreenshot(tradeId: number, url: string): Promise<Trade> {
    const trade = await this.em.findOne(Trade, tradeId);
    if (!trade) throw new NotFoundException(`Trade #${tradeId} no encontrado`);

    const current = this.parseUrls(trade.screenshotUrls);
    trade.screenshotUrls = current.filter(u => u !== url);
    await this.em.flush();
    return trade;
  }
}
