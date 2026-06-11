/**
 * fullRevertionReforced.controller.ts
 *
 * GET /full-revertion-reforced/status?symbol=AUD/USD
 * GET /full-revertion-reforced/symbols
 */

import { Controller, Get, Query, Res, HttpStatus } from '@nestjs/common';
import * as express from 'express';
import { FullRevertionReforcedService } from './fullRevertionReforced.service';

@Controller('full-revertion-reforced')
export class FullRevertionReforcedController {
  constructor(private readonly frService: FullRevertionReforcedService) {}

  @Get('status')
  getStatus(
    @Query('symbol') symbol: string = 'EUR/USD',
    @Res() res: express.Response
  ) {
    const snapM5   = this.frService.getLastSnapshot(symbol, 'M5');
    const snapM15  = this.frService.getLastSnapshot(symbol, 'M15');
    const backtest = this.frService.getLastBacktest(symbol);

    if (!snapM5) {
      return res.status(HttpStatus.NOT_FOUND).json({
        status:  'no_data',
        symbol,
        message: `No hay snapshot Full Reversion Reforzado disponible para ${symbol}.`,
      });
    }

    const bothGreen   = snapM5.state === 'GREEN' && snapM15?.state === 'GREEN';
    const bothAllowed = snapM5.signalAllowed && (snapM15?.signalAllowed ?? false);
    const triggerState = snapM5.triggerState ?? 'reposo';

    let recommendation: string;
    let fusedActive = false;

    if (triggerState === 'giro') {
      fusedActive = true;
      recommendation = `🔱 ¡GIRO CONFIRMADO REFORZADO! ENTRADA ACTIVA — M5+M15 con confluencia y pendiente permitida. WinRate histórico: ${backtest?.winRate ?? '?'}%.`;
    } else if (triggerState === 'estirando') {
      recommendation = `⏳ PREPARAR ENTRADA REFORZADA — Resortera en zona extrema M5/M15. Espera Giro M5.`;
    } else if (bothGreen && !bothAllowed) {
      recommendation = `🚫 SEÑAL BLOQUEADA REFORZADA — Confluencia detectada pero la EMA100 está en tendencia fuerte (STEEP).`;
    } else {
      recommendation = `⏳ MODO REPOSO — Esperando confluencia (M5: ${snapM5.state} · M15: ${snapM15?.state ?? 'N/A'}).`;
    }

    return res.status(HttpStatus.OK).json({
      symbol,
      updatedAt: new Date(snapM5.timestamp).toISOString(),
      auditedSignals: this.frService.getAuditedSignals(),

      fused: {
        bothGreen,
        bothAllowed,
        signalActive: fusedActive,
        m5State:      snapM5.state,
        m15State:     snapM15?.state ?? null,
      },

      m5: {
        price:          snapM5.price,
        ema100:         snapM5.ema100,
        atr:            snapM5.atr,
        elasticity:     snapM5.elasticity,
        percentile:     snapM5.percentile,
        state:          snapM5.state,
        emaSlope:       snapM5.emaSlope,
        emaSlopeValue:  snapM5.emaSlopeValue,
        slopeDirection: snapM5.slopeDirection,
        signalAllowed:  snapM5.signalAllowed,
        triggerState:   snapM5.triggerState,
        divergence:     snapM5.divergence,
        nearestSR:      snapM5.nearestSR,
        tpPrice:        snapM5.tpPrice,
        slPrice:        snapM5.slPrice,
        ema50:          snapM5.ema50,
        elasticity50:   snapM5.elasticity50,
        tp50Price:      snapM5.tp50Price,
        stochK:         snapM5.stochK,
        stochD:         snapM5.stochD,
        cci:            snapM5.cci,
      },

      m15: snapM15 ? {
        price:          snapM15.price,
        ema100:         snapM15.ema100,
        atr:            snapM15.atr,
        elasticity:     snapM15.elasticity,
        percentile:     snapM15.percentile,
        state:          snapM15.state,
        emaSlope:       snapM15.emaSlope,
        emaSlopeValue:  snapM15.emaSlopeValue,
        slopeDirection: snapM15.slopeDirection,
        signalAllowed:  snapM15.signalAllowed,
        triggerState:   snapM15.triggerState,
        divergence:     snapM15.divergence,
        nearestSR:      snapM15.nearestSR,
        tpPrice:        snapM15.tpPrice,
        slPrice:        snapM15.slPrice,
        ema50:          snapM15.ema50,
        elasticity50:   snapM15.elasticity50,
        tp50Price:      snapM15.tp50Price,
        stochK:         snapM15.stochK,
        stochD:         snapM15.stochD,
        cci:            snapM15.cci,
      } : null,

      backtest: backtest ? {
        totalSignals:    backtest.totalSignals,
        allowedSignals:  backtest.allowedSignals,
        wins:            backtest.wins,
        winRate:         backtest.winRate,
        filteredBySlope: backtest.filteredBySlope,
        avgBarsToRevert: backtest.avgBarsToRevert,
        events:          backtest.events,
      } : null,

      recommendation,
    });
  }

  @Get('symbols')
  getSymbols(@Res() res: express.Response) {
    const symbols = this.frService.getAllSymbols();
    return res.status(HttpStatus.OK).json({ symbols });
  }
}
