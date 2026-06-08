import { Entity, PrimaryKey, Property } from '@mikro-orm/decorators/legacy';
import { wrap } from '@mikro-orm/core';
import type { ElasticityState, StructureState, DivergenceType, TrendDirection } from './trade.entity';

export type PendingSignalStatus = 'pending' | 'approved' | 'discarded_active' | 'discarded_win' | 'discarded_loss' | 'discarded_timeout';

@Entity({ tableName: 'pending_signal' })
export class PendingSignal {

  @PrimaryKey({ autoincrement: true })
  id!: number;

  @Property({ length: 20 })
  symbol!: string;

  @Property({ length: 4 })
  direction!: 'BUY' | 'SELL';

  @Property({ length: 15, default: 'experimental', fieldName: 'trade_mode' })
  tradeMode: string = 'experimental';

  @Property({ length: 20, default: 'pending' })
  status: PendingSignalStatus = 'pending';

  @Property({ type: 'decimal', precision: 12, scale: 5 })
  entryPrice!: number;

  @Property({ type: 'decimal', precision: 12, scale: 5, fieldName: 'tp_price' })
  tpPrice!: number;

  @Property({ type: 'decimal', precision: 12, scale: 5, fieldName: 'sl_price' })
  slPrice!: number;

  @Property({ length: 12 })
  session!: string;

  // ─── Snapshot de Variables Técnicas ──────────────────────────────────────
  @Property({ length: 6, nullable: true, fieldName: 'elasticity_m5_state' })
  elasticityM5State?: ElasticityState;

  @Property({ length: 6, nullable: true, fieldName: 'elasticity_m15_state' })
  elasticityM15State?: ElasticityState;

  @Property({ length: 6, nullable: true, fieldName: 'fused_state' })
  fusedState?: ElasticityState;

  @Property({ type: 'decimal', precision: 8, scale: 4, nullable: true, fieldName: 'elasticity_m5_value' })
  elasticityM5Value?: number;

  @Property({ type: 'decimal', precision: 8, scale: 4, nullable: true, fieldName: 'elasticity_m15_value' })
  elasticityM15Value?: number;

  @Property({ length: 8, nullable: true, fieldName: 'structure_state' })
  structureState?: StructureState;

  @Property({ length: 4, nullable: true, fieldName: 'structure_signal' })
  structureSignal?: string;

  @Property({ type: 'decimal', precision: 6, scale: 2, nullable: true, fieldName: 'rsi_at_entry' })
  rsiAtEntry?: number;

  @Property({ length: 8, nullable: true, fieldName: 'divergence_at_entry' })
  divergenceAtEntry?: DivergenceType;

  @Property({ length: 4, nullable: true, fieldName: 'ema200_slope_at_entry' })
  ema200SlopeAtEntry?: TrendDirection;

  @Property({ type: 'decimal', precision: 12, scale: 5, nullable: true, fieldName: 'nearest_s_r_price' })
  nearestSRPrice?: number;

  @Property({ length: 12, nullable: true, fieldName: 'nearest_s_r_type' })
  nearestSRType?: string;

  @Property({ nullable: true, fieldName: 'nearest_s_r_strength' })
  nearestSRStrength?: number;

  @Property({ type: 'decimal', precision: 6, scale: 4, nullable: true, fieldName: 'nearest_s_r_distance' })
  nearestSRDistance?: number;

  @Property({ type: 'decimal', precision: 6, scale: 2, nullable: true, fieldName: 'contextual_win_rate' })
  contextualWinRate?: number;

  @Property({ nullable: true, fieldName: 'contextual_cases' })
  contextualCases?: number;

  @Property({ type: 'boolean', nullable: true, fieldName: 'has_type_c' })
  hasTypeC?: boolean | null;

  @Property({ type: 'boolean', nullable: true, fieldName: 'has_pedestrian_light' })
  hasPedestrianLight?: boolean | null;

  // ─── Timestamps y resultados virtuales (Fomowatch) ────────────────────────
  @Property()
  openedAt!: Date;

  @Property({ nullable: true })
  closedAt?: Date;

  @Property({ nullable: true })
  totalMinutesOpen?: number;

  @Property({ type: 'decimal', precision: 10, scale: 4, nullable: true })
  pnl?: number;

  @Property({ onCreate: () => new Date() })
  createdAt: Date = new Date();

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date();

  toJSON(): any {
    return wrap(this).toObject();
  }
}
