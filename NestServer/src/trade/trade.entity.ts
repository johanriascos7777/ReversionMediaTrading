import { Entity, PrimaryKey, Property } from '@mikro-orm/decorators/legacy';
import { wrap } from '@mikro-orm/core';

export type TradeDirection = 'BUY' | 'SELL';
export type TradeType = 'scalping' | 'swing' | 'positional';
export type TradingSession = 'asian' | 'european' | 'american' | 'pacific';
export type TradeOutcome = 'win' | 'loss' | 'breakeven' | 'open';
export type CloseReason = 'tp' | 'sl' | 'signal' | 'manual' | 'time';
export type ElasticityState = 'GREEN' | 'YELLOW' | 'RED';
export type StructureState = 'STRONG' | 'MODERATE' | 'WEAK';
export type DivergenceType = 'bearish' | 'bullish' | 'none';
export type TrendDirection = 'up' | 'down' | 'flat';
export type TradeMode = 'normal' | 'experimental';
export type AccountType = 'demo' | 'real';

@Entity()
export class Trade {

  @PrimaryKey({ autoincrement: true })
  id!: number;

  // ─── Identificación ──────────────────────────────────────────────────────
  @Property({ length: 20 })
  symbol!: string;                      // 'EUR/USD', 'GBP/USD', etc.

  @Property({ length: 4 })
  direction!: TradeDirection;           // 'BUY' | 'SELL'

  @Property({ length: 12 })
  tradeType!: TradeType;                // 'scalping' | 'swing' | 'positional'

  @Property({ length: 15, default: 'normal', fieldName: 'trade_mode' })
  tradeMode: TradeMode = 'normal';

  @Property({ length: 8, default: 'demo', fieldName: 'account_type' })
  accountType: AccountType = 'demo';

  @Property({ type: 'boolean', nullable: true, fieldName: 'has_type_c' })
  hasTypeC?: boolean | null;

  @Property({ type: 'boolean', nullable: true, fieldName: 'has_pedestrian_light' })
  hasPedestrianLight?: boolean | null;


  @Property({ length: 12 })
  session!: TradingSession;             // 'asian' | 'european' | 'american' | 'pacific'

  // ─── Precios y configuración ─────────────────────────────────────────────
  @Property({ type: 'decimal', precision: 12, scale: 5 })
  entryPrice!: number;

  @Property({ type: 'decimal', precision: 12, scale: 5, nullable: true })
  exitPrice?: number;

  @Property()
  leverage!: number;                    // 10, 100, 200, 500, 1000

  @Property({ type: 'decimal', precision: 8, scale: 5 })
  spread!: number;                      // en precio (ej: 0.00013)

  @Property({ type: 'decimal', precision: 10, scale: 2 })
  investmentAmount!: number;            // en dólares ($2, $5, etc.)

  @Property({ type: 'decimal', precision: 12, scale: 5, nullable: true })
  liquidationTheoretical?: number;      // sin spread

  @Property({ type: 'decimal', precision: 12, scale: 5, nullable: true })
  liquidationReal?: number;             // con spread

  // ─── Señales capturadas al entrar ────────────────────────────────────────
  @Property({ length: 6, nullable: true, fieldName: 'elasticity_m5_state' })
  elasticityM5State?: ElasticityState;

  @Property({ length: 6, nullable: true, fieldName: 'elasticity_m15_state' })
  elasticityM15State?: ElasticityState;

  @Property({ length: 6, nullable: true })
  fusedState?: ElasticityState;

  @Property({ type: 'decimal', precision: 8, scale: 4, nullable: true, fieldName: 'elasticity_m5_value' })
  elasticityM5Value?: number;

  @Property({ type: 'decimal', precision: 8, scale: 4, nullable: true, fieldName: 'elasticity_m15_value' })
  elasticityM15Value?: number;

  @Property({ length: 8, nullable: true })
  structureState?: StructureState;      // 'STRONG' | 'MODERATE' | 'WEAK'

  @Property({ length: 4, nullable: true })
  structureSignal?: string;             // 'SELL' | 'BUY' | 'WAIT'

  @Property({ type: 'decimal', precision: 6, scale: 2, nullable: true })
  rsiAtEntry?: number;

  @Property({ length: 8, nullable: true })
  divergenceAtEntry?: DivergenceType;

  @Property({ length: 4, nullable: true, fieldName: 'ema200_slope_at_entry' })
  ema200SlopeAtEntry?: TrendDirection;

  @Property({ type: 'decimal', precision: 12, scale: 5, nullable: true, fieldName: 'nearest_s_r_price' })
  nearestSRPrice?: number;

  @Property({ length: 12, nullable: true, fieldName: 'nearest_s_r_type' })
  nearestSRType?: string;               // 'resistance' | 'support'

  @Property({ nullable: true, fieldName: 'nearest_s_r_strength' })
  nearestSRStrength?: number;

  @Property({ type: 'decimal', precision: 6, scale: 4, nullable: true, fieldName: 'nearest_s_r_distance' })
  nearestSRDistance?: number;           // en unidades ATR

  @Property({ type: 'decimal', precision: 6, scale: 2, nullable: true })
  contextualWinRate?: number;           // % del backtest contextual

  @Property({ nullable: true })
  contextualCases?: number;             // casos similares encontrados

  // ─── Tiempos ─────────────────────────────────────────────────────────────
  @Property()
  openedAt!: Date;

  @Property({ nullable: true })
  closedAt?: Date;

  @Property({ nullable: true })
  minutesInHolgura?: number;            // tiempo hasta ser positivo

  @Property({ nullable: true })
  minutesInProfit?: number;             // tiempo en zona positiva

  @Property({ nullable: true })
  totalMinutesOpen?: number;            // duración total

  // ─── Resultado ───────────────────────────────────────────────────────────
  @Property({ type: 'decimal', precision: 10, scale: 4, nullable: true })
  mae?: number;                         // Max Adverse Excursion en $

  @Property({ type: 'decimal', precision: 10, scale: 4, nullable: true })
  mfe?: number;                         // Max Favorable Excursion en $

  @Property({ type: 'decimal', precision: 10, scale: 4, nullable: true })
  pnl?: number;                         // P&L final en $

  @Property({ type: 'decimal', precision: 8, scale: 2, nullable: true })
  pnlPercent?: number;                  // P&L como % sobre inversión

  @Property({ length: 8, nullable: true })
  closeReason?: CloseReason;            // 'tp' | 'sl' | 'signal' | 'manual' | 'time'

  @Property({ length: 10, default: 'open' })
  outcome: TradeOutcome = 'open';       // 'win' | 'loss' | 'breakeven' | 'open'

  @Property({ type: 'decimal', precision: 12, scale: 5, nullable: true, fieldName: 'recommended_tp' })
  recommendedTp?: number;

  @Property({ type: 'decimal', precision: 12, scale: 5, nullable: true, fieldName: 'recommended_sl' })
  recommendedSl?: number;

  // ─── Notas libres ────────────────────────────────────────────────────────
  @Property({ type: 'text', nullable: true })
  notes?: string;

  // ─── Screenshots (URLs de imágenes en S3) ────────────────────────────────
  @Property({ type: 'text', nullable: true, fieldName: 'screenshot_urls' })
  screenshotUrlsRaw?: string;

  // ⚠️ NOTA PARA EL DESARROLLADOR (VIRTUAL FIELD / GETTER-SETTER):
  // NO DECORAR 'screenshotUrls' con '@Property({ persist: false })' en MikroORM v6/v7.
  // Decorar getters virtuales con @Property causa que MikroORM intente mapearlo de forma inconsistente
  // o intente generar/eliminar columnas durante schema.update().
  // La mejor práctica profesional es dejarlo como un getter/setter estándar de TypeScript
  // sin decoradores de base de datos, y agregarlo explícitamente en el método toJSON() de abajo.
  get screenshotUrls(): string[] {
    if (!this.screenshotUrlsRaw) return [];
    try {
      const parsed = JSON.parse(this.screenshotUrlsRaw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      if (this.screenshotUrlsRaw.startsWith('http')) {
        return [this.screenshotUrlsRaw];
      }
      return [];
    }
  }

  set screenshotUrls(urls: string[]) {
    this.screenshotUrlsRaw = JSON.stringify(urls);
  }

  toJSON(): any {
    return {
      ...wrap(this).toObject(),
      // Inyectar explícitamente el array virtual en la respuesta de la API JSON
      screenshotUrls: this.screenshotUrls,
    };
  }

  // ─── Timestamps automáticos ──────────────────────────────────────────────
  @Property({ onCreate: () => new Date() })
  createdAt: Date = new Date();

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date();
}
