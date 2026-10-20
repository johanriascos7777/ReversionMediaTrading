import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { EntityManager } from '@mikro-orm/mysql';
import { PendingSignal } from '../trade/pending-signal.entity';
import { AlertLog } from '../alerts/alert-log.entity';
import { ExecutionPosition } from './execution-position.entity';
import { ExecutionService } from './execution.service';
import { ExecutionController } from './execution.controller';
import { ExecutionPnlPhase } from './tracking/pnl-phase.entity';
import { ExecutionPnlSample } from './tracking/pnl-sample.entity';
import { ExecutionTrackerService } from './tracking/execution-tracker.service';

@Module({
  imports: [
    MikroOrmModule.forFeature([
      ExecutionPosition,
      ExecutionPnlPhase,
      ExecutionPnlSample,
      PendingSignal,
      AlertLog,
    ]),
  ],
  controllers: [ExecutionController],
  providers: [
    {
      provide: ExecutionService,
      useFactory: (em: EntityManager) => new ExecutionService(em),
      inject: [EntityManager],
    },
    {
      provide: ExecutionTrackerService,
      useFactory: (em: EntityManager, execution: ExecutionService) =>
        new ExecutionTrackerService(em, execution),
      inject: [EntityManager, ExecutionService],
    },
  ],
  exports: [ExecutionService],
})
export class ExecutionModule {}
