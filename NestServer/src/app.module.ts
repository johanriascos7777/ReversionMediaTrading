import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { MarketModule } from './market/market.module';
import { StructureModule } from './structure/structure.module';
import { TradeModule } from './trade/trade.module';
import { ScreenshotsModule } from './screenshots/screenshots.module';
import { FullRevertionModule } from './full-revertion/fullRevertion.module';
import { FullRevertionReforcedModule } from './full-revertion-reforced/fullRevertionReforced.module';
import config from './mikro-orm.config';

@Module({
  imports: [
    MikroOrmModule.forRoot(config),
    MarketModule,
    StructureModule,
    TradeModule,
    ScreenshotsModule,
    FullRevertionModule,
    FullRevertionReforcedModule,
  ],
})
export class AppModule {}
