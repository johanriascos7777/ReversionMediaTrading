import { Module, forwardRef } from '@nestjs/common';
import { MarketService } from './market.service';
import { MarketGateway } from './market.gateway';
import { MarketController } from './market.controller';
import { ConsolidationModule } from '../consolidation/consolidation.module';
import { AlertsModule } from '../alerts/alerts.module';

@Module({
  imports: [forwardRef(() => ConsolidationModule), AlertsModule],
  providers: [MarketService, MarketGateway],
  controllers: [MarketController],
  exports: [MarketService],
})
export class MarketModule {}
