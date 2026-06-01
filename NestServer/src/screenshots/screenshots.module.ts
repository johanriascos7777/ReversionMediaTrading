/**
 * screenshots.module.ts
 */
import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ScreenshotsController } from './screenshots.controller';
import { ScreenshotsService } from './screenshots.service';
import { TradeScreenshotService } from './trade-screenshot.service';
import { Trade } from '../trade/trade.entity';

@Module({
  imports: [
    MikroOrmModule.forFeature([Trade]),
    MulterModule.register({ storage: memoryStorage() }),
  ],
  controllers: [ScreenshotsController],
  providers: [ScreenshotsService, TradeScreenshotService],
})
export class ScreenshotsModule {}
