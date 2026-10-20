import { Entity, PrimaryKey, Property } from '@mikro-orm/decorators/legacy';

export type PnlModel = 'capital' | 'pip1';
export type PnlState = 'red' | 'green';

@Entity({ tableName: 'execution_pnl_phase' })
export class ExecutionPnlPhase {
  @PrimaryKey({ autoincrement: true })
  id!: number;

  @Property({ fieldName: 'position_id' })
  positionId!: number;

  @Property({ length: 10 })
  model!: PnlModel;

  @Property()
  seq!: number;

  @Property({ length: 5 })
  state!: PnlState;

  @Property({ fieldName: 'started_at' })
  startedAt!: Date;

  @Property({ nullable: true, fieldName: 'ended_at' })
  endedAt?: Date | null;

  @Property({ fieldName: 'last_seen_at' })
  lastSeenAt!: Date;

  @Property({
    type: 'decimal',
    precision: 14,
    scale: 4,
    fieldName: 'start_pnl',
  })
  startPnl!: number;

  @Property({ type: 'decimal', precision: 14, scale: 4, fieldName: 'last_pnl' })
  lastPnl!: number;

  @Property({
    type: 'decimal',
    precision: 14,
    scale: 4,
    fieldName: 'extreme_pnl',
  })
  extremePnl!: number;

  @Property({ fieldName: 'extreme_at' })
  extremeAt!: Date;

  @Property({ default: 0 })
  samples!: number;

  @Property({ fieldName: 'gap_sec', default: 0 })
  gapSec!: number;
}
