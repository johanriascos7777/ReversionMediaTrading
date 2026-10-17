import { Entity, PrimaryKey, Property } from '@mikro-orm/decorators/legacy';

export type AlertOutcomeStatus = 'open' | 'touched' | 'expired';

@Entity({ tableName: 'alert_log' })
export class AlertLog {
  @PrimaryKey({ autoincrement: true })
  id!: number;

  @Property({ length: 4 })
  version!: string;

  @Property({ length: 30 })
  name!: string;

  @Property({ length: 20 })
  symbol!: string;

  @Property({ length: 4 })
  direction!: 'BUY' | 'SELL';

  @Property({ type: 'decimal', precision: 12, scale: 5 })
  price!: number;

  @Property({
    type: 'decimal',
    precision: 12,
    scale: 5,
    nullable: true,
    fieldName: 'ema_target',
  })
  emaTarget?: number;

  @Property({ type: 'decimal', precision: 12, scale: 6, nullable: true })
  atr?: number;

  @Property({
    type: 'decimal',
    precision: 8,
    scale: 4,
    nullable: true,
    fieldName: 'elasticity_m5',
  })
  elasticityM5?: number;

  @Property({
    type: 'decimal',
    precision: 8,
    scale: 4,
    nullable: true,
    fieldName: 'elasticity_m15',
  })
  elasticityM15?: number;

  @Property({
    type: 'decimal',
    precision: 8,
    scale: 4,
    nullable: true,
    fieldName: 'distance_atr',
  })
  distanceAtr?: number;

  @Property({ type: 'boolean', nullable: true, fieldName: 'shield_clear' })
  shieldClear?: boolean;

  @Property({ type: 'boolean', nullable: true })
  walk?: boolean;

  @Property({ type: 'json', nullable: true })
  features?: Record<string, unknown>;

  @Property({ nullable: true, fieldName: 'pending_signal_id' })
  pendingSignalId?: number;

  @Property({ fieldName: 'created_at' })
  createdAt!: Date;

  @Property({ length: 10, default: 'open' })
  status!: AlertOutcomeStatus;

  @Property({
    type: 'decimal',
    precision: 8,
    scale: 1,
    nullable: true,
    fieldName: 'mae_pips',
  })
  maePips?: number;

  @Property({
    type: 'decimal',
    precision: 8,
    scale: 1,
    nullable: true,
    fieldName: 'mfe_pips',
  })
  mfePips?: number;

  @Property({ nullable: true, fieldName: 'touched_at' })
  touchedAt?: Date;

  @Property({ nullable: true, fieldName: 'minutes_to_ema' })
  minutesToEma?: number;

  @Property({ nullable: true, fieldName: 'updated_at' })
  updatedAt?: Date;
}
