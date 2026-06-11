/**
 * fullRevertionReforced.module.ts
 *
 * Módulo NestJS para Full Reversion Reinforced.
 */

import { Module } from '@nestjs/common';
import { MarketModule } from '../market/market.module';
import { StructureModule } from '../structure/structure.module';
import { FullRevertionReforcedController } from './fullRevertionReforced.controller';
import { FullRevertionReforcedService } from './fullRevertionReforced.service';

@Module({
  imports: [MarketModule, StructureModule],
  controllers: [FullRevertionReforcedController],
  providers: [FullRevertionReforcedService],
  exports: [FullRevertionReforcedService],
})
export class FullRevertionReforcedModule {}
