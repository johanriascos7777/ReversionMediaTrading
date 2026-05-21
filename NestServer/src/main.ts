import dotenv from 'dotenv';
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { WsAdapter } from '@nestjs/platform-ws';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Habilitar CORS para permitir solicitudes HTTP del frontend
  app.enableCors({
    origin: '*',
    methods: 'GET,POST,OPTIONS',
    allowedHeaders: 'Content-Type,Authorization',
  });

  // Configurar el adaptador para usar WebSockets nativos (ws) en lugar de Socket.io
  app.useWebSocketAdapter(new WsAdapter(app));

  const PORT = parseInt(process.env.PORT ?? '8082');
  await app.listen(PORT);
  console.log(`[Main] NestServer escuchando en: http://localhost:${PORT}`);
  console.log(`[Main] WebSocket disponible en: ws://localhost:${PORT}`);
}
bootstrap();
