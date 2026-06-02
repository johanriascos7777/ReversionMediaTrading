import dotenv from 'dotenv';
dotenv.config();
import { MikroORM } from '@mikro-orm/core';
import config from '../mikro-orm.config';

async function main() {
  console.log('\n[DB] ElasticityMeter - Inicializador de Base de Datos');
  console.log('[DB] Conectando a MySQL:', process.env.DB_HOST + ':' + process.env.DB_PORT + '/' + process.env.DB_NAME);

  // ⚠️ ADVERTENCIA DE PRODUCCIÓN: Este script utiliza orm.schema.update() para sincronización directa.
  // Únicamente debe usarse en desarrollo local inicial para inicializar la base de datos vacía.
  // NO lo ejecutes en producción. En producción, el flujo correcto es utilizar Migraciones
  // ('npm run db:migration:up') para un control seguro e incremental de la base de datos.
  const orm = await MikroORM.init(config);

  try {
    const schema = orm.schema;
    await schema.update();
    console.log('[DB] Schema sincronizado correctamente');
    console.log('[DB] Tabla trade lista en trading_journal\n');
  } catch (err: any) {
    console.error('[DB] Error creando schema:', err?.stack ?? err);
    process.exit(1);
  } finally {
    await orm.close();
  }
}

main().catch(err => {
  console.error('[DB] Error fatal:', err.stack ?? err);
  process.exit(1);
});
