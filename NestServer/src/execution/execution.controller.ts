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
import { ExecutionTrackerService } from './tracking/execution-tracker.service';
import {
  operationRow,
  operationSummary,
  type OperationRow,
} from './tracking/pnl';
import { decisionGroups, decisionRow } from './tracking/decisions';
import { SESSIONS, isSession, sessionOf, type Session } from './tracking/session';

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
  constructor(
    private readonly execution: ExecutionService,
    private readonly tracker: ExecutionTrackerService,
  ) {}

  @Get('config')
  config() {
    return this.execution.config();
  }

  @Get('positions')
  async list(
    @Query('status') status?: string,
    @Query('limit') limit?: string,
  ) {
    const n = Math.min(Math.max(Number(limit) || 50, 1), 200);
    const rows = await this.execution.list(status || undefined, n);
    const tracking = await this.tracker.tracking(rows);
    return rows.map((r) => ({ ...r, tracking: tracking[r.id] ?? null }));
  }

  @Get('table')
  async table(
    @Query('limit') limit?: string,
    @Query('symbol') symbol?: string,
    @Query('session') session?: string,
  ) {
    const n = Math.min(Math.max(Number(limit) || 200, 1), 500);
    const rows = (await this.execution.list(undefined, n)).filter(
      (r) => r.status !== 'failed',
    );
    const tracking = await this.tracker.tracking(rows);
    const now = new Date();
    const out: (OperationRow & { session: Session })[] = [];
    for (const r of rows) {
      const phases = await this.tracker.phases(r.id);
      out.push({
        ...operationRow(
          {
            id: r.id,
            symbol: r.symbol,
            direction: r.direction,
            size: r.size ?? 0,
            status: r.status,
            source: r.source,
            alertLogId: r.alertLogId,
            openedAt: r.openedAt,
            trackingSince: r.trackingSince,
            closedAt: r.closedAt,
            realizedPnl: r.realizedPnl,
            closeSource: r.closeSource,
            closeReason: r.closeReason,
          },
          phases.capital,
          tracking[r.id]?.live?.capital ?? null,
          now,
        ),
        session: sessionOf(r.openedAt),
      });
    }
    const symbols = [...new Set(out.map((r) => r.symbol))].sort();
    const bySymbol = symbol ? out.filter((r) => r.symbol === symbol) : out;
    const shown = isSession(session)
      ? bySymbol.filter((r) => r.session === session)
      : bySymbol;
    return {
      rows: shown,
      summary: operationSummary(shown),
      bySession: SESSIONS.map((s) => ({
        session: s,
        summary: operationSummary(bySymbol.filter((r) => r.session === s)),
      })),
      symbols,
    };
  }

  @Get('decisions')
  async decisions(
    @Query('limit') limit?: string,
    @Query('symbol') symbol?: string,
    @Query('session') session?: string,
  ) {
    const n = Math.min(Math.max(Number(limit) || 300, 1), 1000);
    const pairs = await this.execution.alertsWithPositions(n);
    const all = pairs.map(({ alert, position }) => ({
      ...decisionRow(
        {
          id: alert.id,
          symbol: alert.symbol,
          direction: alert.direction,
          createdAt: new Date(alert.createdAt),
          status: alert.status,
          maePips: alert.maePips === undefined || alert.maePips === null ? null : Number(alert.maePips),
          mfePips: alert.mfePips === undefined || alert.mfePips === null ? null : Number(alert.mfePips),
          features: (alert.features as Record<string, any>) ?? null,
        },
        position
          ? {
              id: position.id,
              status: position.status,
              realizedPnl:
                position.realizedPnl === undefined || position.realizedPnl === null
                  ? null
                  : Number(position.realizedPnl),
            }
          : null,
      ),
      session: sessionOf(alert.createdAt),
    }));
    const symbols = [...new Set(all.map((r) => r.symbol))].sort();
    const rows = all.filter(
      (r) =>
        (!symbol || r.symbol === symbol) &&
        (!isSession(session) || r.session === session),
    );
    return { rows, groups: decisionGroups(rows), symbols };
  }

  @Get('positions/:id/phases')
  phases(@Param('id', ParseIntPipe) id: number) {
    return this.tracker.phases(id);
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

  @Post('auto')
  setAuto(@Body() body: any) {
    try {
      return this.execution.setAuto(body?.enabled === true);
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
