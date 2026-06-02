import type {
  TradeDirection, TradeType, TradingSession,
  ElasticityState, StructureState, DivergenceType, TrendDirection,
  CloseReason, TradeOutcome
} from '../trade.entity';

export class UpdateTradeDto {
  symbol?: string;
  direction?: TradeDirection;
  tradeType?: TradeType;
  session?: TradingSession;

  // Precios y configuración
  entryPrice?: number;
  exitPrice?: number;
  leverage?: number;
  spread?: number;
  investmentAmount?: number;

  liquidationTheoretical?: number;
  liquidationReal?: number;

  // Señales
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

  // Recomendaciones
  recommendedTp?: number;
  recommendedSl?: number;

  // Resultados
  mae?: number;
  mfe?: number;
  minutesInHolgura?: number;
  minutesInProfit?: number;
  closeReason?: CloseReason;
  outcome?: TradeOutcome;

  // Fecha/hora de apertura editable (ISO string)
  openedAt?: string;

  notes?: string;
}
