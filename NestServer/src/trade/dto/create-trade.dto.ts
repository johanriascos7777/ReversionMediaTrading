import type {
  TradeDirection, TradeType, TradingSession,
  ElasticityState, StructureState, DivergenceType, TrendDirection, TradeMode,
} from '../trade.entity';

export class CreateTradeDto {
  // Identificación
  symbol!: string;
  direction!: TradeDirection;
  tradeType!: TradeType;
  tradeMode?: TradeMode;
  hasTypeC?: boolean | null;
  hasPedestrianLight?: boolean | null;

  session!: TradingSession;

  // Precios
  entryPrice!: number;
  leverage!: number;
  spread!: number;
  investmentAmount!: number;

  // Calculados automáticamente (frontend los envía ya calculados)
  liquidationTheoretical?: number;
  liquidationReal?: number;

  // Señales auto-capturadas del dashboard
  elasticityM5State?: ElasticityState;
  elasticityM15State?: ElasticityState;
  fusedState?: ElasticityState;
  elasticityM5Value?: number;
  elasticityM15Value?: number;
  structureState?: StructureState;
  structureSignal?: string;
  rsiAtEntry?: number;
  divergenceAtEntry?: DivergenceType;
  ema200SlopeAtEntry?: TrendDirection;
  nearestSRPrice?: number;
  nearestSRType?: string;
  nearestSRStrength?: number;
  nearestSRDistance?: number;
  contextualWinRate?: number;
  contextualCases?: number;

  // Recomendaciones opcionales del sistema
  recommendedTp?: number;
  recommendedSl?: number;

  // Fecha/hora de apertura personalizable (ISO string; si no viene, se usa now)
  openedAt?: string;

  // Notas
  notes?: string;
}
