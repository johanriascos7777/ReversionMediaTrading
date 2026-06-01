import { defineConfig } from '@mikro-orm/mysql';
import { ReflectMetadataProvider } from '@mikro-orm/decorators/legacy';

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

  migrations: {
    path: './src/migrations',
  },
});
