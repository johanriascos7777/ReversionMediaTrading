/**
 * fullRevertion.controller.ts
 *
 * GET /full-revertion/status?symbol=AUD/USD
 *   → Estado completo: M5, M15 y fusión multi-TF
 *
 * GET /full-revertion/symbols
 *   → Lista de símbolos con datos disponibles
 */

import { Controller, Get, Query, Res, HttpStatus } from '@nestjs/common';
import * as express from 'express';
import { FullRevertionService } from './fullRevertion.service';

@Controller('full-revertion')
export class FullRevertionController {
  constructor(private readonly frService: FullRevertionService) {}

  /**
   * GET /full-revertion/status?symbol=AUD/USD
   *
   * Devuelve el estado actual del motor Full Reversion para un símbolo.
   * Incluye snapshot M5, snapshot M15, backtest y el estado fusionado multi-TF.
   */
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
        message: `No hay snapshot Full Reversion disponible para ${symbol}. El motor necesita al menos 115 velas históricas cargadas.`,
      });
    }

    const bothGreen   = snapM5.state === 'GREEN' && snapM15?.state === 'GREEN';
    const bothAllowed = snapM5.signalAllowed && (snapM15?.signalAllowed ?? false);
    const fusedActive = bothGreen && bothAllowed;

    let recommendation: string;
    if (fusedActive) {
      recommendation = `🔱 SEÑAL FUSIONADA ACTIVA — M5+M15 GREEN con pendiente plana. WinRate histórico: ${backtest?.winRate ?? '?'}%. Alta convicción.`;
    } else if (bothGreen && !bothAllowed) {
      recommendation = `🚫 SEÑAL BLOQUEADA — Confluencia M5+M15 detectada pero la EMA100 está en tendencia fuerte (STEEP).`;
    } else {
      recommendation = `⏳ MODO REPOSO — Esperando confluencia (M5: ${snapM5.state} · M15: ${snapM15?.state ?? 'N/A'}).`;
    }

    return res.status(HttpStatus.OK).json({
      symbol,
      updatedAt: new Date(snapM5.timestamp).toISOString(),

      // ─── Fusión multi-TF ─────────────────────────────────────
      fused: {
        bothGreen,
        bothAllowed,
        signalActive: fusedActive,
        m5State:      snapM5.state,
        m15State:     snapM15?.state ?? null,
      },

      // ─── Detalle M5 ──────────────────────────────────────────
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
      },

      // ─── Detalle M15 ─────────────────────────────────────────
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
      } : null,

      // ─── Backtest (basado en M5) ──────────────────────────────
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

  /**
   * GET /full-revertion/symbols
   */
  @Get('symbols')
  getSymbols(@Res() res: express.Response) {
    const symbols = this.frService.getAllSymbols();
    return res.status(HttpStatus.OK).json({ symbols });
  }
}
