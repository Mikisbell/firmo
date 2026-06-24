/**
 * BACKFILL HISTÓRICO — agujero #2180/#2179 (bugs/order-created-projection-hole)
 * ============================================================================
 *
 * QUÉ: Crea las filas FALTANTES en `order_item_projections` para líneas que
 * existen en el snapshot `orders.items[]` (JSON) pero NUNCA tuvieron fila en la
 * proyección.
 *
 * POR QUÉ: Antes del fix FORWARD (PR #17), el ÚNICO INSERT a
 * `order_item_projections` vivía en el handler ORDER_ITEM_ADDED. Las líneas que
 * NACÍAN dentro de ORDER_CREATED (POS clásico, importación, cualquier flujo
 * create-con-items) quedaban invisibles para KDS/ready-items y su status nunca
 * progresaba. El fix FORWARD tapa el agujero hacia adelante; este script
 * backfillea lo HISTÓRICO.
 *
 * SEMÁNTICA DEL STATUS — `status = 'PENDING'` es RECOVERY, no el status real:
 * el status vivo de esas líneas se PERDIÓ en el agujero (los UPDATE de
 * ORDER_ITEM_STATUS_CHANGED afectaron 0 filas porque la fila no existía). No hay
 * forma fiable de reconstruir el status final desde el snapshot; se inicializa a
 * 'PENDING' igual que lo hace el handler ORDER_CREATED. El `ON CONFLICT
 * (order_id, line_id) DO NOTHING` garantiza que NO se pisa ninguna fila ya
 * existente (idempotente y no-degradante).
 *
 * EXCLUSIONES (council #2179):
 *   (a) Líneas con evento ORDER_ITEM_VOIDED  → la línea fue anulada; el handler
 *       VOIDED la borra de la proyección, recrearla sería incorrecto.
 *   (b) Órdenes con evento ORDER_CANCELLED   → la orden entera desapareció; el
 *       handler CANCELLED borra TODAS sus filas, no debe revivirse ninguna.
 *   (c) Órdenes con invoice ACCEPTED         → PROTECCIÓN FISCAL. Una boleta/
 *       factura ya aceptada por SUNAT fijó sus items como dato de auditoría;
 *       tocar la proyección de esas órdenes es riesgo fiscal. Se EXCLUYE la
 *       orden completa. Señal de aceptación: `invoices.status = 'ACCEPTED'` O
 *       existe `invoice_cdr.response_code = '0'`.
 *
 * COLUMNAS DEL INSERT: idénticas al handler ORDER_CREATED en
 * `src/core/events/project-event.ts` (tenant_id, order_id, line_id,
 * table_number desde fulfillment.table_number, waiter_id, name, qty, station,
 * status='PENDING', created_at, updated_at).
 *
 * ----------------------------------------------------------------------------
 * MODO DE USO:
 *   DRY-RUN (default, READ-ONLY — solo SELECT/conteos, NO escribe):
 *     tsx prisma/cleanup/backfill-order-item-projections.ts
 *   APPLY (ejecuta el INSERT — requiere aprobación explícita del operador):
 *     tsx prisma/cleanup/backfill-order-item-projections.ts --apply
 *
 *   Filtrar por tenant (opcional):
 *     tsx prisma/cleanup/backfill-order-item-projections.ts --tenant=<uuid>
 * ----------------------------------------------------------------------------
 *
 * SEGURIDAD: prisma singleton, tenant_id presente en todos los filtros, money no
 * aplica. En DRY-RUN NADA escribe en la DB.
 */
import { Prisma } from '@prisma/client';
import prisma from '../../src/core/db/prisma';

// Helpers para componer SQL parametrizado con Prisma.sql.
const prismaSql = Prisma.sql;
function tenantSql(tenantId: string | null) {
  return tenantId ? Prisma.sql`AND o.tenant_id = ${tenantId}::uuid` : Prisma.empty;
}

const APPLY = process.argv.includes('--apply');
const tenantArg = process.argv.find((a) => a.startsWith('--tenant='));
const TENANT_FILTER: string | null = tenantArg ? tenantArg.split('=')[1] : null;

// ── Tipos de las filas devueltas por las queries de diagnóstico ────────────
type CandidateRow = {
  tenant_id: string;
  order_id: string;
  line_id: string;
  name: string;
  qty: number;
  station: string | null;
  table_number: string | null;
  waiter_id: string | null;
  created_at: Date;
};

type TenantBreakdownRow = {
  tenant_id: string;
  orders_affected: bigint;
  lines_affected: bigint;
};

type CountRow = { n: bigint };

/**
 * CTE compartido por el dry-run y el apply. Expande `orders.items[]` (JSON) a una
 * fila por línea y la cruza contra `order_item_projections`, aplicando las 3
 * exclusiones. Devuelve EXACTAMENTE el conjunto que el INSERT crearía.
 *
 * El placeholder `${tenantClause}` se inyecta como fragmento Prisma.sql para
 * mantener el binding parametrizado del tenant.
 */
function buildCandidateCTE(tenantClause: ReturnType<typeof tenantSql>) {
  // NOTA: se usa $queryRaw con Prisma.sql para construir el CTE una sola vez.
  return prismaSql`
    WITH expanded AS (
      SELECT
        o.tenant_id::text AS tenant_id,
        o.id::text        AS order_id,
        (line.value ->> 'line_id')                        AS line_id,
        COALESCE(line.value ->> 'name', '(sin nombre)')   AS name,
        COALESCE((line.value ->> 'qty')::int, 1)          AS qty,
        COALESCE(line.value ->> 'station', 'COCINA')      AS station,
        (o.fulfillment ->> 'table_number')                AS table_number,
        o.created_at
      FROM orders o
      CROSS JOIN LATERAL jsonb_array_elements(
        CASE
          WHEN jsonb_typeof(o.items::jsonb) = 'array' THEN o.items::jsonb
          ELSE '[]'::jsonb
        END
      ) AS line
      WHERE (line.value ->> 'line_id') IS NOT NULL
        ${tenantClause}
    ),
    -- (a) líneas anuladas por ORDER_ITEM_VOIDED → no recrear
    voided AS (
      SELECT
        COALESCE(e.payload ->> 'order_id', e.entity_id::text) AS order_id,
        e.payload ->> 'line_id'                                AS line_id
      FROM events e
      WHERE e.type = 'ORDER_ITEM_VOIDED'
    ),
    -- (b) órdenes canceladas por ORDER_CANCELLED → excluir orden entera
    cancelled AS (
      SELECT DISTINCT
        COALESCE(e.payload ->> 'order_id', e.entity_id::text) AS order_id
      FROM events e
      WHERE e.type = 'ORDER_CANCELLED'
    ),
    -- (c) órdenes con invoice ACCEPTED (status o CDR response_code='0') → fiscal
    accepted AS (
      SELECT DISTINCT i.order_id::text AS order_id
      FROM invoices i
      LEFT JOIN invoice_cdr c ON c.invoice_id = i.id
      WHERE i.status = 'ACCEPTED' OR c.response_code = '0'
    )
    SELECT
      x.tenant_id,
      x.order_id,
      x.line_id,
      x.name,
      x.qty,
      x.station,
      x.table_number,
      x.created_at
    FROM expanded x
    -- la fila NO debe existir ya en la proyección
    LEFT JOIN order_item_projections p
      ON p.order_id = x.order_id::uuid AND p.line_id = x.line_id
    WHERE p.order_id IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM voided v
        WHERE v.order_id = x.order_id AND v.line_id = x.line_id
      )
      AND NOT EXISTS (SELECT 1 FROM cancelled cc WHERE cc.order_id = x.order_id)
      AND NOT EXISTS (SELECT 1 FROM accepted aa WHERE aa.order_id = x.order_id)
  `;
}

function fmt(n: bigint | number): string {
  return Number(n).toLocaleString('es-PE');
}

async function dryRun(): Promise<void> {
  const tenantClause = tenantSql(TENANT_FILTER);
  const candidateCTE = buildCandidateCTE(tenantClause);

  // 1) Conteo total de líneas a backfillear
  const totalLines = await prisma.$queryRaw<CountRow[]>(prismaSql`
    SELECT count(*)::bigint AS n FROM (${candidateCTE}) AS c
  `);
  const lines = totalLines[0]?.n ?? BigInt(0);

  // 2) Conteo de órdenes distintas afectadas
  const totalOrders = await prisma.$queryRaw<CountRow[]>(prismaSql`
    SELECT count(DISTINCT c.order_id)::bigint AS n FROM (${candidateCTE}) AS c
  `);
  const orders = totalOrders[0]?.n ?? BigInt(0);

  // 3) Desglose por tenant
  const breakdown = await prisma.$queryRaw<TenantBreakdownRow[]>(prismaSql`
    SELECT
      c.tenant_id,
      count(DISTINCT c.order_id)::bigint AS orders_affected,
      count(*)::bigint                   AS lines_affected
    FROM (${candidateCTE}) AS c
    GROUP BY c.tenant_id
    ORDER BY lines_affected DESC
  `);

  // 4) Exclusiones (cuántas órdenes se descartan por cada motivo, en el scope)
  const tenantClauseEvents = TENANT_FILTER
    ? Prisma.sql`AND e.tenant_id = ${TENANT_FILTER}::uuid`
    : Prisma.empty;
  const voidedCount = await prisma.$queryRaw<CountRow[]>(prismaSql`
    SELECT count(*)::bigint AS n
    FROM events e
    WHERE e.type = 'ORDER_ITEM_VOIDED' ${tenantClauseEvents}
  `);
  const cancelledCount = await prisma.$queryRaw<CountRow[]>(prismaSql`
    SELECT count(DISTINCT COALESCE(e.payload ->> 'order_id', e.entity_id::text))::bigint AS n
    FROM events e
    WHERE e.type = 'ORDER_CANCELLED' ${tenantClauseEvents}
  `);
  const tenantClauseInv = TENANT_FILTER
    ? Prisma.sql`AND i.tenant_id = ${TENANT_FILTER}::uuid`
    : Prisma.empty;
  const acceptedCount = await prisma.$queryRaw<CountRow[]>(prismaSql`
    SELECT count(DISTINCT i.order_id)::bigint AS n
    FROM invoices i
    LEFT JOIN invoice_cdr c ON c.invoice_id = i.id
    WHERE (i.status = 'ACCEPTED' OR c.response_code = '0') ${tenantClauseInv}
  `);

  // 5) Ejemplos (primeras 15 líneas afectadas)
  const examples = await prisma.$queryRaw<CandidateRow[]>(prismaSql`
    SELECT * FROM (${candidateCTE}) AS c
    ORDER BY c.created_at DESC
    LIMIT 15
  `);

  // ── Reporte ────────────────────────────────────────────────────────────
  console.log('\n========================================================');
  console.log('  BACKFILL order_item_projections — DRY-RUN (READ-ONLY)');
  console.log('  agujero #2180/#2179 — NADA se escribe en este modo');
  console.log('========================================================');
  if (TENANT_FILTER) console.log(`Filtro de tenant: ${TENANT_FILTER}`);
  console.log(`\nALCANCE QUE EL --apply INSERTARÍA:`);
  console.log(`  Líneas a backfillear : ${fmt(lines)}`);
  console.log(`  Órdenes afectadas    : ${fmt(orders)}`);

  console.log(`\nDESGLOSE POR TENANT:`);
  if (breakdown.length === 0) {
    console.log('  (ninguno)');
  } else {
    for (const r of breakdown) {
      console.log(
        `  ${r.tenant_id}  ->  ${fmt(r.lines_affected)} líneas en ${fmt(r.orders_affected)} órdenes`,
      );
    }
  }

  console.log(`\nEXCLUSIONES (en el scope actual):`);
  console.log(`  (a) eventos ORDER_ITEM_VOIDED            : ${fmt(voidedCount[0]?.n ?? BigInt(0))}`);
  console.log(`  (b) órdenes con ORDER_CANCELLED          : ${fmt(cancelledCount[0]?.n ?? BigInt(0))}`);
  console.log(`  (c) órdenes con invoice ACCEPTED (fiscal): ${fmt(acceptedCount[0]?.n ?? BigInt(0))}`);

  console.log(`\nEJEMPLOS (hasta 15 líneas afectadas):`);
  if (examples.length === 0) {
    console.log('  (ninguno)');
  } else {
    for (const e of examples) {
      console.log(
        `  order=${e.order_id}  line=${e.line_id}  name="${e.name}"  station=${e.station ?? 'COCINA'}  tenant=${e.tenant_id}`,
      );
    }
  }

  console.log('\n--------------------------------------------------------');
  console.log('  DRY-RUN COMPLETO. El --apply NO se ejecutó.');
  console.log('  Para aplicar (tras aprobación): añadir --apply');
  console.log('--------------------------------------------------------\n');
}

async function apply(): Promise<void> {
  const tenantClause = tenantSql(TENANT_FILTER);
  const candidateCTE = buildCandidateCTE(tenantClause);

  console.log('\n[APPLY] Ejecutando INSERT idempotente (ON CONFLICT DO NOTHING)...');
  // status='PENDING' es RECOVERY (el status real se perdió en el agujero).
  // waiter_id se castea a uuid cuando viene; created_at/updated_at = snapshot.
  const affected = await prisma.$executeRaw(prismaSql`
    INSERT INTO order_item_projections
      (tenant_id, order_id, line_id, table_number, waiter_id, name, qty, station, status, created_at, updated_at)
    SELECT
      c.tenant_id::uuid,
      c.order_id::uuid,
      c.line_id,
      c.table_number,
      NULL::uuid,
      c.name,
      c.qty,
      COALESCE(c.station, 'COCINA'),
      'PENDING',
      c.created_at,
      c.created_at
    FROM (${candidateCTE}) AS c
    ON CONFLICT (order_id, line_id) DO NOTHING
  `);
  console.log(`[APPLY] Filas insertadas (no incluye conflictos ignorados): ${fmt(affected)}`);
  console.log('[APPLY] OK.\n');
}

async function main(): Promise<void> {
  try {
    if (APPLY) {
      await apply();
    } else {
      await dryRun();
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error('FATAL', e instanceof Error ? e.message : e);
  process.exit(1);
});
