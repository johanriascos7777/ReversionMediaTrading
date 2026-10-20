import { Entity, PrimaryKey, Property } from '@mikro-orm/decorators/legacy';

export type ExecutionStatus = 'open' | 'closed' | 'failed';
export type ExecutionSource = 'frontend' | 'telegram' | 'auto';

@Entity({ tableName: 'execution_position' })
export class ExecutionPosition {
  @PrimaryKey({ autoincrement: true })
  id!: number;

  @Property({ length: 20 })
  broker!: string;

  @Property({ type: 'boolean', default: false })
  live!: boolean;

  @Property({ length: 20 })
  symbol!: string;

  @Property({ length: 30, nullable: true, fieldName: 'broker_symbol' })
  brokerSymbol?: string;

  @Property({ length: 4 })
  direction!: 'BUY' | 'SELL';

  @Property({ type: 'decimal', precision: 14, scale: 2 })
  size!: number;

  @Property({ length: 10 })
  status!: ExecutionStatus;

  @Property({ length: 10 })
  source!: ExecutionSource;

  @Property({ nullable: true, fieldName: 'alert_log_id' })
  alertLogId?: number;

  @Property({ nullable: true, fieldName: 'pending_signal_id' })
  pendingSignalId?: number;

  @Property({ length: 60, nullable: true, fieldName: 'deal_id' })
  dealId?: string;

  @Property({ length: 60, nullable: true, fieldName: 'deal_reference' })
  dealReference?: string;

  @Property({
    type: 'decimal',
    precision: 12,
    scale: 5,
    nullable: true,
    fieldName: 'open_price',
  })
  openPrice?: number;

  @Property({
    type: 'decimal',
    precision: 12,
    scale: 5,
    nullable: true,
    fieldName: 'stop_level',
  })
  stopLevel?: number;

  @Property({
    type: 'decimal',
    precision: 12,
    scale: 5,
    nullable: true,
    fieldName: 'profit_level',
  })
  profitLevel?: number;

  @Property({
    type: 'decimal',
    precision: 12,
    scale: 5,
    nullable: true,
    fieldName: 'close_price',
  })
  closePrice?: number;

  @Property({
    type: 'decimal',
    precision: 12,
    scale: 6,
    nullable: true,
    fieldName: 'entry_spread',
  })
  entrySpread?: number;

  @Property({ nullable: true, fieldName: 'tracking_since' })
  trackingSince?: Date;

  @Property({ nullable: true, fieldName: 'broker_gone_at' })
  brokerGoneAt?: Date;

  @Property({ fieldName: 'opened_at' })
  openedAt!: Date;

  @Property({ nullable: true, fieldName: 'closed_at' })
  closedAt?: Date;

  @Property({ length: 30, nullable: true, fieldName: 'close_reason' })
  closeReason?: string;

  @Property({ length: 255, nullable: true })
  note?: string;
}
