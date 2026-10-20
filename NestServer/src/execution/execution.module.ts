import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { EntityManager } from '@mikro-orm/mysql';
import { PendingSignal } from '../trade/pending-signal.entity';
import { AlertLog } from '../alerts/alert-log.entity';
import { ExecutionPosition } from './execution-position.entity';
import { ExecutionService } from './execution.service';
import { ExecutionController } from './execution.controller';

@Module({
  imports: [
    MikroOrmModule.forFeature([ExecutionPosition, PendingSignal, AlertLog]),
  ],
  controllers: [ExecutionController],
  providers: [
    {
      provide: ExecutionService,
      useFactory: (em: EntityManager) => new ExecutionService(em),
      inject: [EntityManager],
    },
  ],
  exports: [ExecutionService],
})
export class ExecutionModule {}
