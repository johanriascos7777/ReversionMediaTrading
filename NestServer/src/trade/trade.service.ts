import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository, EntityManager } from '@mikro-orm/core';
import { Trade } from './trade.entity';
import { CreateTradeDto } from './dto/create-trade.dto';
import { CloseTradeDto } from './dto/close-trade.dto';
import { UpdateTradeDto } from './dto/update-trade.dto';


// ─── Utilidades ───────────────────────────────────────────────────────────────

/** Detecta la sesión de trading según la hora UTC */
export function detectSession(date: Date): Trade['session'] {
  const hour = date.getUTCHours();
  if (hour >= 23 || hour < 8) return 'asian';
  if (hour >= 8 && hour < 12) return 'european';
  if (hour >= 12 && hour < 23) return 'american';
  return 'pacific';
}

/** Calcula el precio de liquidación con y sin spread */
export function calcLiquidation(
  entry: number,
  leverage: number,
  spread: number,
  direction: 'BUY' | 'SELL',
): { theoretical: number; real: number } {
  const margin = entry / leverage;
  if (direction === 'BUY') {
    return { theoretical: entry - margin, real: entry - margin + spread };
  }
  return { theoretical: entry + margin, real: entry + margin - spread };
}

// ─── Servicio ─────────────────────────────────────────────────────────────────

@Injectable()
export class TradeService {
  constructor(
    @InjectRepository(Trade)
    private readonly tradeRepo: EntityRepository<Trade>,
    private readonly em: EntityManager,
  ) { }

  // ─── CREATE ──────────────────────────────────────────────────────────────

  async create(dto: CreateTradeDto): Promise<Trade> {
    const now = new Date();
    // Si el usuario envía una fecha personalizada, usarla; si no, usar now
    const openedAt = dto.openedAt ? new Date(dto.openedAt) : now;
    const liq = calcLiquidation(dto.entryPrice, dto.leverage, dto.spread, dto.direction);

    const trade = new Trade();
    trade.symbol = dto.symbol;
    trade.direction = dto.direction;
    trade.tradeType = dto.tradeType;
    trade.tradeMode = dto.tradeMode ?? 'normal';
    trade.accountType = dto.accountType ?? 'demo';
    if (dto.hasTypeC !== undefined) trade.hasTypeC = dto.hasTypeC;
    if (trade.tradeMode === 'experimental' && dto.hasPedestrianLight !== undefined) {
      trade.hasPedestrianLight = dto.hasPedestrianLight;
    }

    trade.session = dto.session ?? detectSession(openedAt);
    trade.entryPrice = dto.entryPrice;
    trade.leverage = dto.leverage;
    trade.spread = dto.spread;
    trade.investmentAmount = dto.investmentAmount;
    trade.openedAt = openedAt;
    trade.outcome = 'open';
    trade.liquidationTheoretical = dto.liquidationTheoretical ?? liq.theoretical;
    trade.liquidationReal = dto.liquidationReal ?? liq.real;

    // Señales auto-capturadas (opcionales)
    if (dto.elasticityM5State) trade.elasticityM5State = dto.elasticityM5State;
    if (dto.elasticityM15State) trade.elasticityM15State = dto.elasticityM15State;
    if (dto.fusedState) trade.fusedState = dto.fusedState;
    if (dto.elasticityM5Value != null) trade.elasticityM5Value = dto.elasticityM5Value;
    if (dto.elasticityM15Value != null) trade.elasticityM15Value = dto.elasticityM15Value;
    if (dto.structureState) trade.structureState = dto.structureState;
    if (dto.structureSignal) trade.structureSignal = dto.structureSignal;
    if (dto.rsiAtEntry != null) trade.rsiAtEntry = dto.rsiAtEntry;
    if (dto.divergenceAtEntry) trade.divergenceAtEntry = dto.divergenceAtEntry;
    if (dto.ema200SlopeAtEntry) trade.ema200SlopeAtEntry = dto.ema200SlopeAtEntry;
    if (dto.nearestSRPrice != null) trade.nearestSRPrice = dto.nearestSRPrice;
    if (dto.nearestSRType) trade.nearestSRType = dto.nearestSRType;
    if (dto.nearestSRStrength != null) trade.nearestSRStrength = dto.nearestSRStrength;
    if (dto.nearestSRDistance != null) trade.nearestSRDistance = dto.nearestSRDistance;
    if (dto.contextualWinRate != null) trade.contextualWinRate = dto.contextualWinRate;
    if (dto.contextualCases != null) trade.contextualCases = dto.contextualCases;

    // Recomendaciones matemáticas de TP y SL
    if (dto.recommendedTp != null) trade.recommendedTp = dto.recommendedTp;
    if (dto.recommendedSl != null) trade.recommendedSl = dto.recommendedSl;
    if (dto.userTp != null) trade.userTp = dto.userTp;
    if (dto.userSl != null) trade.userSl = dto.userSl;

    // Si no vienen calculados del frontend, se calculan matemáticamente usando la volatilidad (ATR) y soporte/resistencia
    if (trade.recommendedTp == null || trade.recommendedSl == null) {
      const entry = dto.entryPrice;
      const srPrice = dto.nearestSRPrice;
      const srDistance = dto.nearestSRDistance;
      const direction = dto.direction;

      if (srPrice != null && srDistance != null && srDistance > 0) {
        const atr = Math.abs(entry - srPrice) / srDistance;

        if (direction === 'BUY') {
          if (dto.nearestSRType === 'resistance') {
            trade.recommendedTp = trade.recommendedTp ?? (entry + (srPrice - entry) * 0.85);
            trade.recommendedSl = trade.recommendedSl ?? (entry - 1.5 * atr);
          } else {
            trade.recommendedSl = trade.recommendedSl ?? (srPrice - 0.2 * atr);
            trade.recommendedTp = trade.recommendedTp ?? (entry + 1.5 * atr);
          }
        } else {
          if (dto.nearestSRType === 'support') {
            trade.recommendedTp = trade.recommendedTp ?? (entry - (entry - srPrice) * 0.85);
            trade.recommendedSl = trade.recommendedSl ?? (entry + 1.5 * atr);
          } else {
            trade.recommendedSl = trade.recommendedSl ?? (srPrice + 0.2 * atr);
            trade.recommendedTp = trade.recommendedTp ?? (entry - 1.5 * atr);
          }
        }

        // Redondear a 5 decimales (estándar Forex)
        if (trade.recommendedTp != null) trade.recommendedTp = Math.round(trade.recommendedTp * 100000) / 100000;
        if (trade.recommendedSl != null) trade.recommendedSl = Math.round(trade.recommendedSl * 100000) / 100000;
      }
    }

    if (dto.notes) trade.notes = dto.notes;
    if (dto.isImportant !== undefined) trade.isImportant = dto.isImportant;
    if (dto.favoriteScreenshotUrl !== undefined) trade.favoriteScreenshotUrl = dto.favoriteScreenshotUrl;

    this.em.persist(trade);
    await this.em.flush();
    return trade;
  }

  // ─── UPDATE ───────────────────────────────────────────────────────────────

  async update(id: number, dto: UpdateTradeDto): Promise<Trade> {
    const trade = await this.tradeRepo.findOne(id);
    if (!trade) throw new NotFoundException(`Operación #${id} no encontrada`);

    if (dto.symbol !== undefined) trade.symbol = dto.symbol;
    if (dto.direction !== undefined) trade.direction = dto.direction;
    if (dto.tradeType !== undefined) trade.tradeType = dto.tradeType;
    if (dto.tradeMode !== undefined) trade.tradeMode = dto.tradeMode;
    if (dto.accountType !== undefined) trade.accountType = dto.accountType;
    if (dto.hasTypeC !== undefined) trade.hasTypeC = dto.hasTypeC;
    if (trade.tradeMode === 'experimental' && dto.hasPedestrianLight !== undefined) {
      trade.hasPedestrianLight = dto.hasPedestrianLight;
    } else if (trade.tradeMode !== 'experimental') {
      trade.hasPedestrianLight = null;
    }

    if (dto.session !== undefined) trade.session = dto.session;
    if (dto.entryPrice !== undefined) trade.entryPrice = dto.entryPrice;
    if (dto.leverage !== undefined) trade.leverage = dto.leverage;
    if (dto.spread !== undefined) trade.spread = dto.spread;
    if (dto.investmentAmount !== undefined) trade.investmentAmount = dto.investmentAmount;

    if (dto.liquidationTheoretical !== undefined) trade.liquidationTheoretical = dto.liquidationTheoretical;
    if (dto.liquidationReal !== undefined) trade.liquidationReal = dto.liquidationReal;

    if (dto.elasticityM5State !== undefined) trade.elasticityM5State = dto.elasticityM5State;
    if (dto.elasticityM15State !== undefined) trade.elasticityM15State = dto.elasticityM15State;
    if (dto.fusedState !== undefined) trade.fusedState = dto.fusedState;
    if (dto.elasticityM5Value !== undefined) trade.elasticityM5Value = dto.elasticityM5Value;
    if (dto.elasticityM15Value !== undefined) trade.elasticityM15Value = dto.elasticityM15Value;
    if (dto.structureState !== undefined) trade.structureState = dto.structureState;
    if (dto.structureSignal !== undefined) trade.structureSignal = dto.structureSignal;
    if (dto.rsiAtEntry !== undefined) trade.rsiAtEntry = dto.rsiAtEntry;
    if (dto.divergenceAtEntry !== undefined) trade.divergenceAtEntry = dto.divergenceAtEntry;
    if (dto.ema200SlopeAtEntry !== undefined) trade.ema200SlopeAtEntry = dto.ema200SlopeAtEntry;
    if (dto.nearestSRPrice !== undefined) trade.nearestSRPrice = dto.nearestSRPrice;
    if (dto.nearestSRType !== undefined) trade.nearestSRType = dto.nearestSRType;
    if (dto.nearestSRStrength !== undefined) trade.nearestSRStrength = dto.nearestSRStrength;
    if (dto.nearestSRDistance !== undefined) trade.nearestSRDistance = dto.nearestSRDistance;
    if (dto.contextualWinRate !== undefined) trade.contextualWinRate = dto.contextualWinRate;
    if (dto.contextualCases !== undefined) trade.contextualCases = dto.contextualCases;

    if (dto.recommendedTp !== undefined) trade.recommendedTp = dto.recommendedTp;
    if (dto.recommendedSl !== undefined) trade.recommendedSl = dto.recommendedSl;
    if (dto.userTp !== undefined) trade.userTp = dto.userTp;
    if (dto.userSl !== undefined) trade.userSl = dto.userSl;

    if (dto.mae !== undefined) trade.mae = dto.mae;
    if (dto.mfe !== undefined) trade.mfe = dto.mfe;
    if (dto.minutesInHolgura !== undefined) trade.minutesInHolgura = dto.minutesInHolgura;
    if (dto.minutesInProfit !== undefined) trade.minutesInProfit = dto.minutesInProfit;
    if (dto.closeReason !== undefined) trade.closeReason = dto.closeReason;
    if (dto.outcome !== undefined) trade.outcome = dto.outcome;
    if (dto.notes !== undefined) trade.notes = dto.notes;
    if (dto.isImportant !== undefined) trade.isImportant = dto.isImportant;
    if (dto.favoriteScreenshotUrl !== undefined) trade.favoriteScreenshotUrl = dto.favoriteScreenshotUrl;

    // Actualizar fecha/hora de apertura si el usuario la modificó
    if (dto.openedAt !== undefined) {
      trade.openedAt = new Date(dto.openedAt);
      // Recalcular la sesión con la nueva fecha
      trade.session = detectSession(trade.openedAt);
    }

    if (dto.exitPrice !== undefined) {
      trade.exitPrice = dto.exitPrice;
    }

    // Si la operación no está abierta, recalcular P&L y tiempos
    if (trade.outcome !== 'open' && trade.exitPrice != null) {
      if (!trade.closedAt) {
        trade.closedAt = new Date();
      }
      if (dto.totalMinutesOpen !== undefined) {
        trade.totalMinutesOpen = dto.totalMinutesOpen;
      } else {
        const totalMinutes = Math.round(
          (trade.closedAt.getTime() - trade.openedAt.getTime()) / 60000
        );
        trade.totalMinutesOpen = totalMinutes;
      }

      // Fórmula porcentual relativa al precio de entrada (igual a IQ Option)
      const pip = trade.direction === 'BUY'
        ? trade.exitPrice - trade.entryPrice
        : trade.entryPrice - trade.exitPrice;
      const pnl = (pip / trade.entryPrice) * trade.leverage * trade.investmentAmount;
      const pnlPct = (pnl / trade.investmentAmount) * 100;

      if (Math.abs(pnl) > 999999.9999) {
        throw new BadRequestException(
          `El precio de salida (${dto.exitPrice}) genera un P&L de ${pnl.toFixed(2)} USD, ` +
          `el cual supera el límite permitido por la base de datos. ` +
          `Asegúrate de que estás ingresando un precio de salida correcto para el par ${trade.symbol} ` +
          `(Entrada: ${trade.entryPrice}).`
        );
      }

      trade.pnl = Math.round(pnl * 10000) / 10000;
      trade.pnlPercent = Math.round(pnlPct * 100) / 100;
    } else if (trade.outcome === 'open') {
      trade.exitPrice = undefined;
      trade.closedAt = undefined;
      trade.totalMinutesOpen = undefined;
      trade.pnl = undefined;
      trade.pnlPercent = undefined;
      trade.closeReason = undefined;
    }

    await this.em.flush();
    return trade;
  }

  // ─── CLOSE ───────────────────────────────────────────────────────────────

  async close(id: number, dto: CloseTradeDto): Promise<Trade> {
    const trade = await this.tradeRepo.findOne(id);
    if (!trade) throw new NotFoundException(`Operación #${id} no encontrada`);

    const closedAt = dto.closedAt ? new Date(dto.closedAt) : new Date();
    const totalMinutes = Math.round(
      (closedAt.getTime() - trade.openedAt.getTime()) / 60000
    );

    // Calcular P&L — fórmula porcentual relativa al precio de entrada (igual a IQ Option)
    // P&L = (pip / entryPrice) * leverage * investment
    const pip = trade.direction === 'BUY'
      ? dto.exitPrice - trade.entryPrice
      : trade.entryPrice - dto.exitPrice;
    const pnl = (pip / trade.entryPrice) * trade.leverage * trade.investmentAmount;
    const pnlPct = (pnl / trade.investmentAmount) * 100;

    if (Math.abs(pnl) > 999999.9999) {
      throw new BadRequestException(
        `El precio de salida (${dto.exitPrice}) genera un P&L de ${pnl.toFixed(2)} USD, ` +
        `el cual supera el límite permitido por la base de datos. ` +
        `Asegúrate de que estás ingresando un precio de salida correcto para el par ${trade.symbol} ` +
        `(Entrada: ${trade.entryPrice}).`
      );
    }

    trade.exitPrice = dto.exitPrice;
    trade.outcome = dto.outcome;
    trade.closeReason = dto.closeReason;
    trade.mae = dto.mae;
    trade.mfe = dto.mfe;
    trade.pnl = Math.round(pnl * 10000) / 10000;
    trade.pnlPercent = Math.round(pnlPct * 100) / 100;
    trade.minutesInHolgura = dto.minutesInHolgura;
    trade.minutesInProfit = dto.minutesInProfit;
    trade.totalMinutesOpen = totalMinutes;
    trade.closedAt = closedAt;
    if (dto.notes) trade.notes = dto.notes;

    await this.em.flush();
    return trade;
  }

  // ─── FIND ALL ─────────────────────────────────────────────────────────────

  async findAll(filters: {
    symbol?: string;
    outcome?: string;
    session?: string;
    fromDate?: string;
    toDate?: string;
  }): Promise<Trade[]> {
    const where: Record<string, any> = {};

    if (filters.symbol) where['symbol'] = filters.symbol;
    if (filters.outcome) where['outcome'] = filters.outcome;
    if (filters.session) where['session'] = filters.session;

    if (filters.fromDate || filters.toDate) {
      where['openedAt'] = {};
      if (filters.fromDate) where['openedAt']['$gte'] = new Date(filters.fromDate);
      if (filters.toDate) where['openedAt']['$lte'] = new Date(filters.toDate);
    }

    return this.tradeRepo.find(where as any, {
      orderBy: { openedAt: 'DESC' },
      limit: 500,
    });
  }

  // ─── DELETE ──────────────────────────────────────────────────────────────

  async remove(id: number): Promise<void> {
    const trade = await this.tradeRepo.findOne(id);
    if (!trade) throw new NotFoundException(`Operación #${id} no encontrada`);
    this.em.remove(trade);
    await this.em.flush();
  }
}
