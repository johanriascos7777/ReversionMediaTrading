/**
 * consolidation.module.ts
 *
 * Módulo NestJS del Consolidation Geometry Analyzer.
 *
 * Importa MarketModule para acceder al MarketService (historial de velas
 * y eventos de snapshot) y HistoricalModule para descargar y cachear
 * datos históricos para backtesting.
 *
 * Exporta ConsolidationService para que otros módulos puedan consultar
 * el estado de consolidación si lo necesitan.
 */

import { Module } from '@nestjs/common';
import { MarketModule } from '../market/market.module';
import { HistoricalModule } from '../historical/historical.module';
import { ConsolidationService } from './consolidation.service';
import { ConsolidationController } from './consolidation.controller';

@Module({
  imports:     [MarketModule, HistoricalModule],
  providers:   [ConsolidationService],
  controllers: [ConsolidationController],
  exports:     [ConsolidationService],
})
export class ConsolidationModule {}
