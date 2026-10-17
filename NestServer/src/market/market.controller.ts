import { Controller, Get, Query, Res, HttpStatus, Inject, forwardRef } from '@nestjs/common';
import * as express from 'express';
import { MarketService } from './market.service';

@Controller()
export class MarketController {
  constructor(
    @Inject(forwardRef(() => MarketService))
    private readonly marketService: MarketService
  ) {}

  @Get('history')
  getHistory(
    @Query('timeframe') timeframe: string = '5min',
    @Query('symbol') symbol: string = 'EUR/USD',
    @Res() res: express.Response
  ) {
    const tf = timeframe === '15min' ? '15min' : '5min';
    const candles = this.marketService.getHistory(symbol, tf);
    return res.status(HttpStatus.OK).json(candles);
  }

  @Get('health')
  getHealth(@Res() res: express.Response) {
    const m5Length = this.marketService.getHistory('EUR/USD', '5min').length;
    const m15Length = this.marketService.getHistory('EUR/USD', '15min').length;
    const metrics = this.marketService.serverMetrics;

    return res.status(HttpStatus.OK).json({
      status: 'ok',
      candlesM5: m5Length,
      candlesM15: m15Length,
      metrics,
    });
  }
}
