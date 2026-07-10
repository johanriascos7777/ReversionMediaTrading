/**
 * fullRevertion.module.ts
 *
 * Módulo NestJS del Full Reversion Engine.
 * Importa MarketModule para obtener acceso al MarketService
 * (historial de velas y eventos de snapshot).
 *
 * No exporta nada — es un módulo hoja/leaf, no necesita
 * ser consumido por otros módulos.
 */

import { Module } from '@nestjs/common';
import { MarketModule } from '../market/market.module';
import { StructureModule } from '../structure/structure.module';
import { ConsolidationModule } from '../consolidation/consolidation.module';
import { FullRevertionService } from './fullRevertion.service';
import { FullRevertionController } from './fullRevertion.controller';

@Module({
  imports:     [MarketModule, StructureModule, ConsolidationModule],
  providers:   [FullRevertionService],
  controllers: [FullRevertionController],
})
export class FullRevertionModule {}
