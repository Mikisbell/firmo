/**
 * Corre un archivo .sql contra la DB usando psql y la conexion DIRECTA (puerto 5432),
 * limpiando los params especificos de Prisma/pooler que psql/libpq no entiende.
 * Uso: bun --env-file=.env prisma/cleanup/run-sql.ts <archivo.sql>
 */
import { execSync } from 'child_process';

const file = process.argv[2];
if (!file) {
  console.error('Falta el archivo .sql. Uso: bun ... run-sql.ts <archivo.sql>');
  process.exit(1);
}

const raw = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!raw) {
  console.error('No hay DIRECT_URL ni DATABASE_URL en el entorno.');
  process.exit(1);
}

// psql usa libpq estandar: quitar params de Prisma/pooler (pgbouncer, connection_limit, etc.)
function cleanUrl(u: string): string {
  try {
    const url = new URL(u);
    ['pgbouncer', 'connection_limit', 'pool_timeout', 'statement_cache_size', 'schema'].forEach(
      (p) => url.searchParams.delete(p),
    );
    return url.toString();
  } catch {
    return u;
  }
}

const redact = (s: string) => s.replace(/postgres(ql)?:\/\/[^\s"]+/g, '[REDACTED]');

try {
  // -v ON_ERROR_STOP=1: aborta al primer error. Salida del servidor a stdout.
  execSync(`psql "${cleanUrl(raw)}" -v ON_ERROR_STOP=1 -f "${file}"`, { stdio: 'inherit' });
  console.log(`\nSQL aplicado OK: ${file}`);
} catch (e: any) {
  console.error('psql FALLO:', redact(String(e?.message ?? e)));
  process.exit(1);
}
