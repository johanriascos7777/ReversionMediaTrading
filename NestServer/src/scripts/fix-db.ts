import dotenv from 'dotenv';
dotenv.config();
import { MikroORM } from '@mikro-orm/core';
import config from '../mikro-orm.config';

async function main() {
  console.log('[Fix] Iniciando reparación de base de datos...');
  const orm = await MikroORM.init(config);

  try {
    // Dropear la columna problemática para limpiar la restricción fantasma de MariaDB
    console.log('[Fix] Eliminando columna screenshot_urls y sus restricciones...');
    await orm.em.execute('ALTER TABLE trade DROP COLUMN IF EXISTS screenshot_urls');
    console.log('[Fix] Columna y restricciones eliminadas con éxito.');
  } catch (err: any) {
    console.log('[Fix] Nota/Error al eliminar:', err.message);
  } finally {
    await orm.close();
    console.log('[Fix] Proceso finalizado.');
  }
}

main().catch(err => {
  console.error('[Fix] Error fatal:', err);
});
