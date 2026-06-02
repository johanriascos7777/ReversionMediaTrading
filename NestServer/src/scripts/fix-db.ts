import dotenv from 'dotenv';
dotenv.config();
import { MikroORM } from '@mikro-orm/core';
import config from '../mikro-orm.config';

async function main() {
  console.log('[Fix] Iniciando reparación de base de datos...');
  // ⚠️ ADVERTENCIA: Este es un script de reparación temporal para desarrollo local
  // que realiza alteraciones manuales a la tabla física ('ALTER TABLE ... DROP COLUMN ...').
  // NUNCA lo ejecutes en producción. Las modificaciones de esquema en producción
  // deben realizarse únicamente mediante archivos de migración bajo control de versiones.
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
