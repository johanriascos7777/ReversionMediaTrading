/**
 * historical.module.ts
 *
 * Módulo NestJS para la gestión de datos históricos.
 * Proporciona descarga, caché en MySQL, y lectura de velas
 * históricas de TwelveData para backtest offline.
 */

import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { HistoricalCandle } from './historical-candle.entity';
import { HistoricalDataService } from './historical-data.service';

@Module({
  imports: [MikroOrmModule.forFeature([HistoricalCandle])],
  providers: [HistoricalDataService],
  exports: [HistoricalDataService],
})
export class HistoricalModule {}
