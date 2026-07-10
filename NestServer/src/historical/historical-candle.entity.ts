/**
 * historical-candle.entity.ts
 *
 * Entidad MikroORM para almacenar velas históricas descargadas de TwelveData.
 * Actúa como caché persistente: una vez descargada, una vela no se vuelve a
 * pedir a la API (ahorra créditos).
 *
 * Unique constraint en (symbol, timeframe, timestamp) para evitar duplicados.
 */

import { Entity, PrimaryKey, Property, Unique, Index } from '@mikro-orm/decorators/legacy';

@Entity({ tableName: 'historical_candles' })
@Unique({ properties: ['symbol', 'timeframe', 'timestamp'] })
export class HistoricalCandle {

  @PrimaryKey({ autoincrement: true })
  id!: number;

  @Index()
  @Property({ length: 20 })
  symbol!: string;

  @Index()
  @Property({ length: 5 })
  timeframe!: string;             // '5min', '15min'

  @Index()
  @Property()
  timestamp!: Date;               // Momento de cierre de la vela

  @Property({ type: 'double' })
  open!: number;

  @Property({ type: 'double' })
  high!: number;

  @Property({ type: 'double' })
  low!: number;

  @Property({ type: 'double' })
  close!: number;

  @Property({ onCreate: () => new Date() })
  downloadedAt: Date = new Date();
}
