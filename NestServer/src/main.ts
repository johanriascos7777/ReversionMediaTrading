import dotenv from 'dotenv';
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { WsAdapter } from '@nestjs/platform-ws';
import { MikroORM } from '@mikro-orm/core';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Habilitar CORS para permitir solicitudes HTTP del frontend
  app.enableCors({
    origin: '*',
    methods: 'GET,POST,PATCH,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type,Authorization',
  });

  // Configurar el adaptador para usar WebSockets nativos (ws) en lugar de Socket.io
  app.useWebSocketAdapter(new WsAdapter(app));

  // ── MikroORM: crear/actualizar tablas automáticamente en desarrollo ────────
  try {
    const orm = app.get(MikroORM);
    await orm.schema.update();
    console.log('[MikroORM] Schema sincronizado correctamente ✓');
  } catch (err) {
    console.error('[MikroORM] Error sincronizando schema:', err);
  }

  const PORT = parseInt(process.env.PORT ?? '8082');
  await app.listen(PORT);
  console.log(`[Main] NestServer escuchando en: http://localhost:${PORT}`);
  console.log(`[Main] WebSocket disponible en: ws://localhost:${PORT}`);
}
bootstrap();
