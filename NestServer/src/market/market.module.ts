import { Module } from '@nestjs/common';
import { MarketService } from './market.service';
import { MarketGateway } from './market.gateway';
import { MarketController } from './market.controller';

@Module({
  providers: [MarketService, MarketGateway],
  controllers: [MarketController],
  exports: [MarketService],
})
export class MarketModule {}
