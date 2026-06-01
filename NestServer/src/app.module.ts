import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { MarketModule } from './market/market.module';
import { StructureModule } from './structure/structure.module';
import { TradeModule } from './trade/trade.module';
import config from './mikro-orm.config';

@Module({
  imports: [
    MikroOrmModule.forRoot(config),
    MarketModule,
    StructureModule,
    TradeModule,
  ],
})
export class AppModule {}
