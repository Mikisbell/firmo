/**
 * Test de ARQUITECTURA — "no leer status del JSON de orders.items[]"
 *
 * change: remove-item-status-from-write-model (council #2179)
 *
 * REGLA QUE PROTEGE:
 *   El `status` VIVO de un item de orden se resuelve EXCLUSIVAMENTE desde la
 *   proyección `order_item_projections`, leída vía el read-model ÚNICO
 *   `src/core/projections/order-items.read.ts`. Ningún route/service server-side
 *   debe leer `status` del snapshot JSON `orders.items[]` — ese JSON queda
 *   CONGELADO en la creación y nunca refleja transiciones de cocina (el "trap").
 *
 * MODO: **BLOQUEANTE** (Phase 6 del change — completada). Este test FALLA el
 *   build si detecta UNA SOLA lectura de `status` del JSON `orders.items[]` en
 *   `src/app/api/**` o `src/core/**`. Pasó por modo WARN (gate de migración)
 *   durante las Phases 4–5; al confirmarse 0 violaciones reales tras el corte
 *   global del writer (P4: el writer ya NO escribe status en el snapshot), el
 *   gate se endurece: cualquier nueva lectura del status congelado rompe CI.
 *
 * TÉCNICA: fs + regex (heurística), siguiendo el patrón existente
 *   `src/lib/openapi/__tests__/typedoc.property.test.ts`. El repo NO tiene
 *   ts-morph, así que NO se hace análisis semántico de tipos.
 *
 * LIMITACIONES EXPLÍCITAS (council blind-spot #3):
 *   - Heurística textual: puede tener falsos positivos/negativos. Para reducir
 *     falsos positivos, solo se reporta `.status` sobre variables que aliasan
 *     `order.items` / `orders.items` (cast a array JSON), NO sobre resultados de
 *     `order_item_projections` (cuyo `.status` SÍ es la fuente válida).
 *   - FALSO NEGATIVO conocido (aliasing complejo): el escáner detecta el alias
 *     solo cuando la asignación está en la MISMA línea textual
 *     (`const items = order.items`). NO sigue aliasing indirecto multi-salto
 *     (p.ej. pasar `order.items` a una función y leer `.status` dentro), ni
 *     desestructuración profunda. Se acepta esta limitación: el gate es
 *     intencionalmente conservador para NO romper CI con falsos positivos, y
 *     captura el patrón directo que constituye el 'trap' real. Es mejor un gate
 *     bloqueante con falsos negativos acotados que un WARN ignorado.
 *   - NO cubre lectores fuera de TypeScript: las 2 vistas materializadas
 *     MUERTAS (sql/004_kds_materialized_view.sql,
 *     prisma/migrations/20260122_create_materialized_views) leían
 *     `item->>'status'` del JSON — se DROPEAN en Phase 6 (migración versionada
 *     prisma/migrations/.../drop_dead_status_materialized_views, D7 del design).
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const ROOT = process.cwd();

/** Carpetas server-side a escanear. */
const SCAN_DIRS = [
  path.join('src', 'app', 'api'),
  path.join('src', 'core'),
];

/** No tiene sentido escanear estos sufijos/archivos. */
const EXCLUDE_FILE_PATTERNS = [
  /\.test\.ts$/,
  /\.spec\.ts$/,
  // El read-model ÚNICO y su test son la vía válida (leen la proyección, no el JSON).
  /order-items\.read\.ts$/,
];

interface Violation {
  file: string;
  line: number;
  text: string;
}

/** Recolecta recursivamente los .ts/.tsx bajo un directorio. */
function collectSourceFiles(dir: string): string[] {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
      out.push(...collectSourceFiles(rel));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      if (EXCLUDE_FILE_PATTERNS.some((re) => re.test(entry.name))) continue;
      out.push(rel);
    }
  }
  return out;
}

/**
 * Heurística por archivo: identifica las VARIABLES que aliasan el JSON
 * `order.items` / `orders.items` (típicamente vía cast `as any[]` / `as Array<...>`),
 * y luego reporta cualquier lectura de `.status` sobre esas variables o sobre
 * `order.items[...]` directamente.
 *
 * Patrones que dispara:
 *   const items = (order.items as any[]) || [];   // ← `items` aliasa el JSON
 *   ... items[i].status ...                       // ← VIOLACIÓN
 *   ... item.status ...  (cuando `item` itera sobre ese alias)
 *   (order.items as any[]).map(it => it.status)   // ← VIOLACIÓN inline
 *
 * Patrones que NO dispara (fuente válida):
 *   order_item_projections.findMany(...).status   // proyección viva
 *   invoice_queue / tables / shifts .status        // otras entidades
 */
function scanFile(relPath: string): Violation[] {
  const content = fs.readFileSync(path.join(ROOT, relPath), 'utf-8');
  return scanContent(content, relPath);
}

/** Núcleo puro del escáner (testeable con fixtures inline). */
export function scanContent(content: string, relPath = '<inline>'): Violation[] {
  const lines = content.split('\n');
  const violations: Violation[] = [];

  // 1. Identificar nombres de variables que aliasan order(s).items (JSON snapshot).
  //    Ej: `const items = (order.items as any[])`, `const orderItems = order.items`
  const aliasNames = new Set<string>();
  const aliasRe =
    /(?:const|let|var)\s+(\w+)\s*(?::[^=]+)?=\s*\(?\s*(?:order|orders)\.items\b/;
  for (const line of lines) {
    const m = line.match(aliasRe);
    if (m) aliasNames.add(m[1]);
  }

  // 2. Reportar lecturas de `.status`:
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Ignorar líneas de COMENTARIO: muchos lectores documentan el trap citando
    // literalmente `orders.items[].status` en prosa (// o *), y eso NO es una
    // lectura real. Sin este filtro, el WARN (y el futuro gate bloqueante) se
    // dispararía sobre documentación.
    const trimmed = line.trim();
    if (
      trimmed.startsWith('//') ||
      trimmed.startsWith('*') ||
      trimmed.startsWith('/*')
    ) {
      continue;
    }

    // 2a. Acceso directo al JSON: order.items[...].status / orders.items[...].status
    if (/(?:order|orders)\.items[^;]*\.status\b/.test(line)) {
      violations.push({ file: relPath, line: i + 1, text: line.trim() });
      continue;
    }

    // 2b. Acceso vía variable que aliasa el JSON: <alias>[...].status o <alias>.<iter>.status
    for (const alias of aliasNames) {
      // <alias>[idx].status  o  <alias>.find(...).status
      const reIndexed = new RegExp(`\\b${alias}\\b[^;]*\\.status\\b`);
      // .map(it => it.status) sobre el alias en la MISMA línea
      if (reIndexed.test(line)) {
        violations.push({ file: relPath, line: i + 1, text: line.trim() });
        break;
      }
    }
  }

  return violations;
}

describe('Arquitectura: no leer item.status del JSON orders.items[] (read-model único)', () => {
  const files = SCAN_DIRS.flatMap(collectSourceFiles);

  it('NINGÚN lector server-side lee status del JSON orders.items[] (BLOQUEANTE)', () => {
    expect(files.length).toBeGreaterThan(0); // el escáner encontró archivos

    const allViolations = files.flatMap(scanFile);

    // MODO BLOQUEANTE (Phase 6): 0 violaciones o falla el build. El mensaje de
    // error lista cada violación con archivo:línea para diagnóstico inmediato.
    const report = allViolations
      .map((v) => `  - ${v.file}:${v.line}  →  ${v.text}`)
      .join('\n');

    expect(
      allViolations,
      allViolations.length === 0
        ? ''
        : `\n[ARQUITECTURA · BLOQUEANTE] ${allViolations.length} lectura(s) de status desde el JSON orders.items[] detectada(s).\n` +
            `El status VIVO se resuelve SOLO desde order_item_projections vía src/core/projections/order-items.read.ts.\n` +
            `El JSON orders.items[] queda CONGELADO en la creación (el 'trap') y nunca refleja transiciones de cocina.\n` +
            `Reemplazá estas lecturas por getItemStatuses/getItemStatusesForOrders del read-model único:\n${report}\n`,
    ).toHaveLength(0);
  });

  it('el read-model único order-items.read.ts existe y es la vía documentada', () => {
    const readModel = path.join(ROOT, 'src', 'core', 'projections', 'order-items.read.ts');
    expect(fs.existsSync(readModel)).toBe(true);
  });

  // Auto-validación del escáner: garantiza que la heurística NO está muerta.
  // Si esto fallara, el WARN/gate sería un placebo.
  describe('auto-validación del escáner (scanContent)', () => {
    it('DETECTA acceso directo al JSON: order.items[i].status', () => {
      const code = `const s = (order.items as any[])[0].status;`;
      expect(scanContent(code).length).toBe(1);
    });

    it('DETECTA lectura vía alias del JSON', () => {
      const code = [
        `const items = (order.items as any[]) || [];`,
        `const st = items[0].status;`,
      ].join('\n');
      expect(scanContent(code).length).toBeGreaterThanOrEqual(1);
    });

    it('IGNORA comentarios que citan orders.items[].status en prosa', () => {
      const code = `// el JSON orders.items[].status queda congelado`;
      expect(scanContent(code).length).toBe(0);
    });

    it('IGNORA .status de otras entidades (proyección / invoice_queue)', () => {
      const code = [
        `const rows = await tx.order_item_projections.findMany();`,
        `const st = rows[0].status;`,
        `const q = await prisma.invoice_queue.findMany();`,
        `return q.map(item => ({ status: item.status }));`,
      ].join('\n');
      expect(scanContent(code).length).toBe(0);
    });
  });
});
