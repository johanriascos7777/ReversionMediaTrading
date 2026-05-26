import { Module } from '@nestjs/common';
import { MarketModule } from '../market/market.module';
import { StructureService } from './structure.service';

@Module({
  imports:   [MarketModule],
  providers: [StructureService],
  exports:   [StructureService],
})
export class StructureModule {}
