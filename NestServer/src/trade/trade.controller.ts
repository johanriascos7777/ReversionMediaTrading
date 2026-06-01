import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, ParseIntPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import { TradeService } from './trade.service';
import { CreateTradeDto } from './dto/create-trade.dto';
import { CloseTradeDto } from './dto/close-trade.dto';

@Controller('trade')
export class TradeController {
  constructor(private readonly tradeService: TradeService) {}

  // ─── POST /trade ─────────────────────────────────────────────────────────
  // Registrar nueva operación (auto-captura de señales viene en el body)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateTradeDto) {
    return this.tradeService.create(dto);
  }

  // ─── PATCH /trade/:id/close ───────────────────────────────────────────────
  // Cerrar operación existente: agregar salida, P&L, tiempos, resultado
  @Patch(':id/close')
  close(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CloseTradeDto,
  ) {
    return this.tradeService.close(id, dto);
  }

  // ─── GET /trade ───────────────────────────────────────────────────────────
  // Listar operaciones con filtros opcionales
  @Get()
  findAll(
    @Query('symbol')   symbol?:   string,
    @Query('outcome')  outcome?:  string,
    @Query('session')  session?:  string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate')   toDate?:   string,
  ) {
    return this.tradeService.findAll({ symbol, outcome, session, fromDate, toDate });
  }

  // ─── GET /trade/analytics ─────────────────────────────────────────────────
  // Panel de analytics: win rate por sesión/señal/par, MAE/MFE, alertas
  @Get('analytics')
  getAnalytics() {
    return this.tradeService.getAnalytics();
  }

  // ─── DELETE /trade/:id ────────────────────────────────────────────────────
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.tradeService.remove(id);
  }
}
