import { defineConfig } from '@mikro-orm/mysql';
import { ReflectMetadataProvider } from '@mikro-orm/decorators/legacy';

// Cargar el Migrator dinámicamente. Esto previene errores de compilación local
// si el paquete no está instalado (entorno local offline). En producción,
// npm install instalará '@mikro-orm/migrations' y se activará automáticamente.
const extensions: any[] = [];
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Migrator } = require('@mikro-orm/migrations');
  extensions.push(Migrator);
} catch (e) {
  console.warn('[MikroORM] Migrator no disponible localmente (instalación offline).');
}

export default defineConfig({
  // Mismo patrón que brawlstart-api pero con MySQL driver
  metadataProvider: ReflectMetadataProvider,

  host:     process.env.DB_HOST     || 'localhost',
  port:     Number(process.env.DB_PORT || 3306),
  dbName:   process.env.DB_NAME     || 'trading_journal',
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASS     || '',

  // MikroORM encontrará todas las entidades automáticamente
  entities:   ['dist/**/*.entity.js'],   // producción (compilado)
  entitiesTs: ['src/**/*.entity.ts'],    // desarrollo (TypeScript)

  extensions,

  migrations: {
    path: 'dist/migrations',             // Ruta de las migraciones compiladas (.js) para producción
    pathTs: 'src/migrations',            // Ruta de las migraciones fuente (.ts) para desarrollo
    glob: '!(*.d).{js,ts}',              // Coincidir archivos JS compilados y TS en desarrollo
    transactional: true,                 // Ejecutar cada migración dentro de una transacción SQL
    allOrNothing: true,                  // Transacciones atómicas (se aplica todo o nada)
  },
});
