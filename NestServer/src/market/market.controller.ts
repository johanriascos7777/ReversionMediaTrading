import { Controller, Get, Post, Query, Body, Res, HttpStatus } from '@nestjs/common';
import * as express from 'express';
import { MarketService } from './market.service';

@Controller()
export class MarketController {
  constructor(private readonly marketService: MarketService) {}

  @Get('history')
  getHistory(@Query('timeframe') timeframe: string = '5min', @Res() res: express.Response) {
    const tf = timeframe === '15min' ? '15min' : '5min';
    const candles = this.marketService.getHistory(tf);
    return res.status(HttpStatus.OK).json(candles);
  }

  @Get('health')
  getHealth(@Res() res: express.Response) {
    const m5Length = this.marketService.getHistory('5min').length;
    const m15Length = this.marketService.getHistory('15min').length;
    const metrics = this.marketService.serverMetrics;

    return res.status(HttpStatus.OK).json({
      status: 'ok',
      candlesM5: m5Length,
      candlesM15: m15Length,
      metrics,
    });
  }

  @Post('notify')
  async postNotify(@Body() body: { message?: string }, @Res() res: express.Response) {
    try {
      const message = body.message || '⚠️ Señal Confirmada en Verde';
      const token = process.env.TELEGRAM_BOT_TOKEN;
      const chatId = process.env.TELEGRAM_CHAT_ID;

      if (token && chatId) {
        const url = `https://api.telegram.org/bot${token}/sendMessage`;
        await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text: message }),
        });
        console.log('[Telegram] Notificación enviada con éxito');
      } else {
        console.warn('[Telegram] Faltan credenciales (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID) en el .env');
      }

      return res.status(HttpStatus.OK).json({ status: 'ok' });
    } catch (err) {
      console.error('[Telegram] Error enviando notificación:', err);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: 'Internal Server Error' });
    }
  }
}
