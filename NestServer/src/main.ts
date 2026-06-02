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

  // ─── MikroORM: inicializar/actualizar tablas de forma segura ────────
  try {
    const orm = app.get(MikroORM);
    // Verificar si el Migrator está registrado en la configuración
    const hasMigrator = orm.config.get('extensions')?.some((ext: any) => ext.name === 'Migrator') || false;

    if (process.env.NODE_ENV === 'production') {
      // ⚠️ EN PRODUCCIÓN: Nunca usar schema.update() ya que es destructivo y genera
      // condiciones de carrera si varios contenedores/réplicas arrancan en paralelo.
      // En su lugar, usamos Migraciones que ejecutan bloqueos a nivel de base de datos de forma segura.
      if (hasMigrator) {
        console.log('[MikroORM] Entorno de producción detectado. Ejecutando migraciones pendientes...');
        await orm.migrator.up();
        console.log('[MikroORM] Migraciones ejecutadas correctamente ✓');
      } else {
        console.warn(
          '[MikroORM] ADVERTENCIA: Se requiere el Migrator en producción, pero no está registrado. ' +
          'Asegúrate de que @mikro-orm/migrations esté instalado.'
        );
      }
    } else {
      // 🛠️ EN DESARROLLO: Podemos usar schema.update({ safe: true }) para sincronización rápida.
      // { safe: true } garantiza que MikroORM NUNCA ejecute sentencias DROP sobre tablas o columnas,
      // protegiendo los datos existentes de cambios accidentales en las entidades.
      await orm.schema.update({ safe: true });
      console.log('[MikroORM] Schema sincronizado correctamente ✓ (modo seguro en desarrollo — sin DROP)');
    }
  } catch (err) {
    console.error('[MikroORM] Error al sincronizar/migrar la base de datos:', err);
  }

  const PORT = parseInt(process.env.PORT ?? '8082');
  await app.listen(PORT);
  console.log(`[Main] NestServer escuchando en: http://localhost:${PORT}`);
  console.log(`[Main] WebSocket disponible en: ws://localhost:${PORT}`);
}
bootstrap();
