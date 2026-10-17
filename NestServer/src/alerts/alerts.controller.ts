import { Controller, Get, Query } from '@nestjs/common';
import { AlertsService } from './alerts.service';

@Controller('alerts')
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Get()
  async list(@Query('limit') limit?: string) {
    const n = Math.min(Math.max(Number(limit) || 100, 1), 500);
    const rows = await this.alertsService.list(n);
    return rows.map((r) => ({
      id: r.id,
      version: r.version,
      name: r.name,
      symbol: r.symbol,
      direction: r.direction,
      price: Number(r.price),
      emaTarget:
        r.emaTarget === undefined || r.emaTarget === null
          ? null
          : Number(r.emaTarget),
      distanceAtr:
        r.distanceAtr === undefined || r.distanceAtr === null
          ? null
          : Number(r.distanceAtr),
      shieldClear: r.shieldClear ?? null,
      walk: r.walk ?? null,
      features: r.features ?? null,
      pendingSignalId: r.pendingSignalId ?? null,
      createdAt: r.createdAt,
      status: r.status,
      maePips:
        r.maePips === undefined || r.maePips === null
          ? null
          : Number(r.maePips),
      mfePips:
        r.mfePips === undefined || r.mfePips === null
          ? null
          : Number(r.mfePips),
      touchedAt: r.touchedAt ?? null,
      minutesToEma: r.minutesToEma ?? null,
    }));
  }

  @Get('summary')
  summary() {
    return this.alertsService.summary();
  }
}
