import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { MarketModule } from './market/market.module';
import { StructureModule } from './structure/structure.module';
import { TradeModule } from './trade/trade.module';
import { ScreenshotsModule } from './screenshots/screenshots.module';
import { HistoricalModule } from './historical/historical.module';
import { ConsolidationModule } from './consolidation/consolidation.module';
import { AlertsModule } from './alerts/alerts.module';
import config from './mikro-orm.config';

@Module({
  imports: [
    MikroOrmModule.forRoot(config),
    MarketModule,
    StructureModule,
    TradeModule,
    ScreenshotsModule,
    HistoricalModule,
    ConsolidationModule,
    AlertsModule,
  ],
})
export class AppModule {}
