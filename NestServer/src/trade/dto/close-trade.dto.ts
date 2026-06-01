import type { CloseReason, TradeOutcome } from '../trade.entity';

export class CloseTradeDto {
  exitPrice!: number;
  outcome!: TradeOutcome;
  closeReason!: CloseReason;

  // Excursiones manuales (el trader las registra al cerrar)
  mae?: number;   // cuánto fue lo peor que llegó (en $)
  mfe?: number;   // cuánto fue lo mejor que llegó (en $)

  // Tiempos (en minutos)
  minutesInHolgura?: number;
  minutesInProfit?: number;

  notes?: string;
}
