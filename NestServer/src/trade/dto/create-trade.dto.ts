import type {
  TradeDirection, TradeType, TradingSession,
  ElasticityState, StructureState, DivergenceType, TrendDirection,
} from '../trade.entity';

export class CreateTradeDto {
  // Identificación
  symbol!: string;
  direction!: TradeDirection;
  tradeType!: TradeType;
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

  // Notas
  notes?: string;
}
