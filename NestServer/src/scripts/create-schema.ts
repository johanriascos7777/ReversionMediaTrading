import dotenv from 'dotenv';
dotenv.config();
import { MikroORM } from '@mikro-orm/core';
import config from '../mikro-orm.config';

async function main() {
  console.log('\n[DB] ElasticityMeter - Inicializador de Base de Datos');
  console.log('[DB] Conectando a MySQL:', process.env.DB_HOST + ':' + process.env.DB_PORT + '/' + process.env.DB_NAME);

  const orm = await MikroORM.init(config);

  try {
    const schema = orm.schema;
    await schema.update();
    console.log('[DB] Schema sincronizado correctamente');
    console.log('[DB] Tabla trade lista en trading_journal\n');
  } catch (err: any) {
    console.error('[DB] Error creando schema:', err?.message ?? err);
    process.exit(1);
  } finally {
    await orm.close();
  }
}

main().catch(err => {
  console.error('[DB] Error fatal:', err.message ?? err);
  process.exit(1);
});
