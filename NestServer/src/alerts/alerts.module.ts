import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { PendingSignal } from '../trade/pending-signal.entity';
import { AlertsService } from './alerts.service';
import { AlertsController } from './alerts.controller';
import { AlertLog } from './alert-log.entity';

@Module({
  imports: [MikroOrmModule.forFeature([PendingSignal, AlertLog])],
  controllers: [AlertsController],
  providers: [AlertsService],
  exports: [AlertsService],
})
export class AlertsModule {}
