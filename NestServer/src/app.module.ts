import { Module } from '@nestjs/common';
import { MarketModule } from './market/market.module';
import { StructureModule } from './structure/structure.module';

@Module({
  imports: [MarketModule, StructureModule],
})
export class AppModule {}
