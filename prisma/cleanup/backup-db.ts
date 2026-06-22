/**
 * Backup completo de la base de datos con pg_dump (formato custom comprimido).
 * Carga la conexión desde el entorno (DIRECT_URL preferido, port 5432).
 * Uso: bun --env-file=.env prisma/cleanup/backup-db.ts
 * Restore: pg_restore --no-owner --no-acl -d "<DIRECT_URL>" backups/<archivo>.dump
 */
import { execSync } from 'child_process';
import { existsSync, statSync, mkdirSync } from 'fs';

const rawUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!rawUrl) {
  console.error('No hay DIRECT_URL ni DATABASE_URL en el entorno.');
  process.exit(1);
}

// pg_dump usa libpq estandar: hay que quitar params especificos de Prisma/pooler
// (pgbouncer, connection_limit, etc.) que libpq no entiende.
function cleanUrl(raw: string): string {
  try {
    const u = new URL(raw);
    ['pgbouncer', 'connection_limit', 'pool_timeout', 'statement_cache_size', 'schema'].forEach(
      (p) => u.searchParams.delete(p),
    );
    return u.toString();
  } catch {
    return raw;
  }
}
const url = cleanUrl(rawUrl);

mkdirSync('backups', { recursive: true });
const ts = new Date().toISOString().replace(/[:.]/g, '-');
const out = `backups/park-db-${ts}.dump`;

const redact = (s: string) => s.replace(/postgres(ql)?:\/\/[^\s"]+/g, '[REDACTED_CONN]');

console.log('Iniciando pg_dump (formato custom comprimido)...');
try {
  // -Fc = custom comprimido | --no-owner/--no-acl = portable para restore
  execSync(`pg_dump "${url}" -Fc --no-owner --no-acl -f "${out}"`, {
    stdio: ['ignore', 'inherit', 'inherit'],
  });
} catch (e: any) {
  console.error('pg_dump FALLO:', redact(String(e?.message ?? e)));
  process.exit(1);
}

if (existsSync(out) && statSync(out).size > 0) {
  const mb = (statSync(out).size / (1024 * 1024)).toFixed(2);
  console.log(`\nBACKUP OK -> ${out} (${mb} MB)`);
} else {
  console.error('El archivo de backup no se genero o esta vacio.');
  process.exit(1);
}
