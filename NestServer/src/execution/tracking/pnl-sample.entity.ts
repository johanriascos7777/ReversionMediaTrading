import { Entity, PrimaryKey, Property } from '@mikro-orm/decorators/legacy';

@Entity({ tableName: 'execution_pnl_sample' })
export class ExecutionPnlSample {
  @PrimaryKey({ autoincrement: true })
  id!: number;

  @Property({ fieldName: 'position_id' })
  positionId!: number;

  @Property()
  at!: Date;

  @Property({ type: 'decimal', precision: 12, scale: 6 })
  bid!: number;

  @Property({ type: 'decimal', precision: 12, scale: 6 })
  offer!: number;

  @Property({ type: 'decimal', precision: 14, scale: 4, nullable: true })
  upl?: number | null;

  @Property({
    type: 'decimal',
    precision: 14,
    scale: 4,
    fieldName: 'pnl_capital',
  })
  pnlCapital!: number;

  @Property({ type: 'decimal', precision: 14, scale: 4, fieldName: 'pnl_pip1' })
  pnlPip1!: number;
}
