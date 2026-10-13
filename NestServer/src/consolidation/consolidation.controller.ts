/**
 * consolidation.controller.ts
 *
 * REST endpoints para el Consolidation Geometry Analyzer.
 *
 * Endpoints:
 * - GET  /consolidation/analysis/:symbol        → Último análisis live
 * - GET  /consolidation/analysis                → Todos los análisis
 * - GET  /consolidation/backtest/:symbol        → Último backtest
 * - GET  /consolidation/backtest                → Todos los backtests
 * - POST /consolidation/backtest/:symbol/run    → Ejecutar backtest
 * - POST /consolidation/download/:symbol        → Descargar historial
 */

import { Controller, Get, Post, Param, Query } from '@nestjs/common';
import { ConsolidationService } from './consolidation.service';
import type { ConsolidationConfig } from './consolidation.types';

@Controller('consolidation')
export class ConsolidationController {

  constructor(private readonly service: ConsolidationService) {}

  // ─── Análisis en tiempo real ──────────────────────────────────────────────

  @Get('analysis/:symbol')
  getAnalysis(@Param('symbol') symbol: string) {
    const decoded = decodeURIComponent(symbol);
    const analysis = this.service.getLastAnalysis(decoded);

    if (!analysis) {
      return {
        status: 'no_data',
        message: `No hay análisis de consolidación para ${decoded}. ` +
          `El símbolo puede no estar activo o el mercado puede estar en rango normal (RED).`,
      };
    }

    return analysis;
  }

  @Get('analysis')
  getAllAnalyses() {
    return this.service.getAllAnalyses();
  }

  // ─── Backtesting ──────────────────────────────────────────────────────────

  @Get('backtest/:symbol')
  getBacktest(@Param('symbol') symbol: string) {
    const decoded = decodeURIComponent(symbol);
    const backtest = this.service.getLastBacktest(decoded);

    if (!backtest) {
      return {
        status: 'no_data',
        message: `No hay backtest para ${decoded}. ` +
          `Ejecuta POST /consolidation/backtest/${encodeURIComponent(decoded)}/run para correrlo.`,
      };
    }

    // Retornar sin los eventos individuales para no sobrecargar la respuesta
    return {
      ...backtest,
      events: undefined,
      eventsSample: backtest.events.slice(-10), // Últimos 10 eventos como muestra
      totalEvents: backtest.events.length,
    };
  }

  @Get('backtest')
  getAllBacktests() {
    const all = this.service.getAllBacktests();
    // Retornar resúmenes sin eventos
    const summaries: Record<string, any> = {};
    for (const [symbol, bt] of Object.entries(all)) {
      summaries[symbol] = {
        totalConsolidations:   bt.totalConsolidations,
        classifiedCorrectly:   bt.classifiedCorrectly,
        accuracy:              bt.accuracy,
        avgBarsToResolution:   bt.avgBarsToResolution,
        byPattern:             bt.byPattern,
        byAlignment:           bt.byAlignment,
      };
    }
    return summaries;
  }

  @Post('backtest/:symbol/run')
  async runBacktest(
    @Param('symbol') symbol: string,
    @Query('timeframe') timeframe?: string,
    @Query('minDuration') minDuration?: string,
    @Query('maxRangeATR') maxRangeATR?: string,
    @Query('lookback') lookback?: string,
    @Query('flatThreshold') flatThreshold?: string,
    @Query('slopeThreshold') slopeThreshold?: string,
    @Query('resolutionWindow') resolutionWindow?: string,
  ) {
    const decoded = decodeURIComponent(symbol);
    const tf = (timeframe === '15min' ? '15min' : '5min') as '5min' | '15min';

    // Construir config con overrides opcionales (para calibración)
    const configOverrides: Partial<ConsolidationConfig> = {};
    if (minDuration)      configOverrides.minDuration      = parseInt(minDuration);
    if (maxRangeATR)      configOverrides.maxRangeATR      = parseFloat(maxRangeATR);
    if (lookback)         configOverrides.lookback         = parseInt(lookback);
    if (flatThreshold)    configOverrides.flatThreshold    = parseFloat(flatThreshold);
    if (slopeThreshold)   configOverrides.slopeThreshold   = parseFloat(slopeThreshold);
    if (resolutionWindow) configOverrides.resolutionWindow = parseInt(resolutionWindow);

    const result = await this.service.runBacktestForSymbol(decoded, configOverrides, tf);

    return {
      timeframe: tf,
      ...result,
      events: undefined,
      eventsSample: result.events.slice(-20),
      totalEvents: result.events.length,
    };
  }

  // ─── Descarga de historial ────────────────────────────────────────────────

  @Post('download/:symbol')
  async downloadHistory(
    @Param('symbol') symbol: string,
    @Query('timeframe') timeframe?: string,
    @Query('candles') candles?: string,
  ) {
    const decoded = decodeURIComponent(symbol);
    const tf = (timeframe === '15min' ? '15min' : '5min') as '5min' | '15min';
    const count = candles ? parseInt(candles) : 10_000;

    const result = await this.service.downloadAndCache(decoded, tf, count);

    return {
      ...result,
      message: `Descarga completada. ${result.newCandles} velas nuevas, ` +
        `${result.totalInCache} total en caché.`,
    };
  }

  // ─── Backtest con todos los eventos (para análisis detallado) ─────────────

  @Get('backtest/:symbol/events')
  async getBacktestEvents(@Param('symbol') symbol: string) {
    const decoded = decodeURIComponent(symbol);
    const backtest = this.service.getLastBacktest(decoded);

    if (!backtest) {
      return { status: 'no_data', events: [] };
    }

    return { events: backtest.events };
  }
}
