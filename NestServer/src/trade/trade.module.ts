import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Trade } from './trade.entity';
import { PendingSignal } from './pending-signal.entity';
import { TradeService } from './trade.service';
import { TradeController } from './trade.controller';
import { TelegramBotService } from './telegram-bot.service';
import { ExecutionModule } from '../execution/execution.module';

@Module({
  imports: [
    // Registra las entidades de trade
    MikroOrmModule.forFeature([Trade, PendingSignal]),
    ExecutionModule,
  ],
  controllers: [TradeController],
  providers:   [TradeService, TelegramBotService],
  exports:     [TradeService],
})
export class TradeModule {}
