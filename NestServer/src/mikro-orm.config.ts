import { defineConfig } from '@mikro-orm/mysql';
import { Migrator } from '@mikro-orm/migrations';
import { ReflectMetadataProvider } from '@mikro-orm/decorators/legacy';

export default defineConfig({
  // Lee los tipos basándose en la reflexión estándar de JS en runtime (resuelve las uniones TS a String/VARCHAR)
  metadataProvider: ReflectMetadataProvider,

  host:     process.env.DB_HOST     || 'localhost',
  port:     Number(process.env.DB_PORT || 3306),
  dbName:   process.env.DB_NAME     || 'trading_journal',
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASS     || '',

  // MikroORM encontrará todas las entidades automáticamente
  entities:   ['dist/**/*.entity.js'],   // producción (compilado)
  entitiesTs: ['src/**/*.entity.ts'],    // desarrollo (TypeScript)

  // Migrator activado correctamente (sin try/catch, ya está instalado)
  extensions: [Migrator],

  migrations: {
    path:   'dist/migrations',           // JS compilado para producción
    pathTs: 'src/migrations',            // TS para desarrollo
    glob: '!(*.d).{js,ts}',
    transactional: true,
    allOrNothing: true,
  },

  // Ver queries SQL en desarrollo
  debug: process.env.NODE_ENV === 'development',
});
