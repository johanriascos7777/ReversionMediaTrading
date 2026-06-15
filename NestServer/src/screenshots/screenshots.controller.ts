/**
 * screenshots.controller.ts
 * Endpoints para subir y eliminar screenshots de una operación.
 *
 * POST   /trade/:id/screenshots        → sube 1-30 imágenes, retorna URLs
 * DELETE /trade/:id/screenshots        → elimina una imagen (key en body)
 */
import {
  Controller, Post, Delete, Param, Body,
  UploadedFiles, UseInterceptors, ParseIntPipe,
  BadRequestException, InternalServerErrorException, Logger,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ScreenshotsService } from './screenshots.service';
import { TradeScreenshotService } from './trade-screenshot.service';

@Controller('trade/:id/screenshots')
export class ScreenshotsController {
  private readonly logger = new Logger(ScreenshotsController.name);

  constructor(
    private readonly screenshotsService: ScreenshotsService,
    private readonly tradeScreenshotService: TradeScreenshotService,
  ) {}

  /** Sube hasta 30 imágenes y las agrega al array screenshotUrls del trade */
  @Post()
  @UseInterceptors(FilesInterceptor('files', 30, { storage: memoryStorage() }))
  async upload(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No se recibieron archivos');
    }

    this.logger.log(`[Trade #${id}] Subiendo ${files.length} imagen(es) a S3...`);

    let urls: string[];
    try {
      urls = await Promise.all(
        files.map(f => this.screenshotsService.upload(id, f))
      );
    } catch (err: any) {
      this.logger.error(`[Trade #${id}] Error al subir a S3: ${err?.message ?? err}`);
      throw new InternalServerErrorException(
        `No se pudo subir la imagen a S3: ${err?.message ?? 'Error desconocido'}`
      );
    }

    this.logger.log(`[Trade #${id}] ✓ Subida OK: ${urls.join(', ')}`);

    // Agregar URLs al campo screenshotUrls del trade
    const trade = await this.tradeScreenshotService.addScreenshots(id, urls);
    return { urls, screenshotUrls: trade.screenshotUrls };
  }

  /** Elimina una imagen de S3 y la quita del array del trade */
  @Delete()
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @Body('url') url: string,
  ) {
    if (!url) throw new BadRequestException('Se requiere el campo url');
    try {
      const key = this.screenshotsService.extractKey(url);
      await this.screenshotsService.delete(key);
    } catch (err: any) {
      this.logger.error(`[Trade #${id}] Error al eliminar de S3: ${err?.message ?? err}`);
      throw new InternalServerErrorException(
        `No se pudo eliminar la imagen de S3: ${err?.message ?? 'Error desconocido'}`
      );
    }
    const trade = await this.tradeScreenshotService.removeScreenshot(id, url);
    return { screenshotUrls: trade.screenshotUrls };
  }
}
