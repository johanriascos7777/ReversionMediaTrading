import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Trade } from './trade.entity';
import { TradeService } from './trade.service';
import { TradeController } from './trade.controller';

@Module({
  imports: [
    // Registra la entidad Trade — igual que brawlstart-api con Brawler
    MikroOrmModule.forFeature([Trade]),
  ],
  controllers: [TradeController],
  providers:   [TradeService],
  exports:     [TradeService],
})
export class TradeModule {}
