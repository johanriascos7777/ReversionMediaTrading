import {
  Body,
  Controller,
  Get,
  HttpException,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ExecutionError, ExecutionService } from './execution.service';

const toHttp = (err: unknown): never => {
  if (err instanceof ExecutionError)
    throw new HttpException({ message: err.message }, err.status);
  throw err;
};

const optionalNumber = (v: unknown): number | undefined => {
  if (v === null || v === undefined || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

@Controller('execution')
export class ExecutionController {
  constructor(private readonly execution: ExecutionService) {}

  @Get('config')
  config() {
    return this.execution.config();
  }

  @Get('positions')
  list(@Query('status') status?: string, @Query('limit') limit?: string) {
    const n = Math.min(Math.max(Number(limit) || 50, 1), 200);
    return this.execution.list(status || undefined, n);
  }

  @Post('positions')
  async open(@Body() body: any) {
    try {
      return await this.execution.open({
        broker: body?.broker,
        symbol: String(body?.symbol ?? ''),
        direction: body?.direction,
        size: optionalNumber(body?.size),
        stopLevel: optionalNumber(body?.stopLevel),
        profitLevel: optionalNumber(body?.profitLevel),
        source: 'frontend',
        alertLogId: optionalNumber(body?.alertLogId),
      });
    } catch (err) {
      return toHttp(err);
    }
  }

  @Post('positions/:id/close')
  async close(@Param('id', ParseIntPipe) id: number) {
    try {
      return await this.execution.close(id);
    } catch (err) {
      return toHttp(err);
    }
  }
}
