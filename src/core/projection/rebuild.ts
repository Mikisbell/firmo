/**
 * Tenant-Scoped Projection Rebuild Service
 * 
 * Rebuilds projections from event stream with tenant isolation.
 * Only processes events belonging to the target tenant.
 * 
 * **Requirement 11.3:** WHEN projections are rebuilt, THE System SHALL 
 * process only events for the target tenant
 */

import { Prisma } from '@prisma/client';
import prisma from '@/src/core/db/prisma';
import type { ParkEvent } from '@/src/core/domain/events';

export interface ProjectionRebuildOptions {
  tenantId: string;
  fromEventId?: string;
  toEventId?: string;
  dryRun?: boolean;
}

export interface ProjectionRebuildResult {
  tenantId: string;
  eventsProcessed: number;
  eventsSkipped: number;
  errors: Array<{ eventId: string; error: string }>;
  dryRun: boolean;
}

/**
 * Rebuild projections for a specific tenant
 * 
 * **Requirement 11.3:** Process only events for the target tenant
 * 
 * Steps:
 * 1. Query all events for the tenant (in order)
 * 2. For each event, verify it belongs to the tenant
 * 3. Rebuild the projection (order, shift, invoice, etc.)
 * 4. Skip events from other tenants
 */
export async function rebuildTenantProjections(
  options: ProjectionRebuildOptions
): Promise<ProjectionRebuildResult> {
  const { tenantId, dryRun = false } = options;

  const result: ProjectionRebuildResult = {
    tenantId,
    eventsProcessed: 0,
    eventsSkipped: 0,
    errors: [],
    dryRun,
  };

  try {
    // 1. Query all events for this tenant (in chronological order)
    const events = await prisma.events.findMany({
      where: {
        tenant_id: tenantId,
      },
      orderBy: {
        occurred_at: 'asc',
      },
    });

    if (events.length === 0) {
      console.log(`[Projection] No events found for tenant ${tenantId}`);
      return result;
    }

    // 2. Process events in transaction
    if (!dryRun) {
      await prisma.$transaction(async (tx) => {
        for (const event of events) {
          try {
            // Verify event belongs to this tenant
            if (event.tenant_id !== tenantId) {
              console.warn(
                `[Projection] Skipping cross-tenant event: event.tenant_id=${event.tenant_id}, target.tenant_id=${tenantId}`
              );
              result.eventsSkipped++;
              continue;
            }

            // Rebuild projection for this event
            await rebuildProjectionForEvent(tx, event as any);
            result.eventsProcessed++;
          } catch (e) {
            const error = e instanceof Error ? e.message : String(e);
            console.error(`[Projection] Error processing event ${event.id}:`, error);
            result.errors.push({
              eventId: event.id,
              error,
            });
          }
        }
      });
    } else {
      // Dry run: just count events
      for (const event of events) {
        if (event.tenant_id === tenantId) {
          result.eventsProcessed++;
        } else {
          result.eventsSkipped++;
        }
      }
    }

    console.log(
      `[Projection] Rebuild complete for tenant ${tenantId}: ${result.eventsProcessed} processed, ${result.eventsSkipped} skipped, ${result.errors.length} errors`
    );

    return result;
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error(`[Projection] Fatal error rebuilding projections for tenant ${tenantId}:`, error);
    throw e;
  }
}

/**
 * Rebuild projection for a single event
 * 
 * **Requirement 11.3:** Only process events for the target tenant
 */
async function rebuildProjectionForEvent(
  tx: Prisma.TransactionClient,
  event: any
): Promise<void> {
  const { type, entity_type, entity_id, tenant_id, payload, occurred_at } = event;

  // Verify tenant_id is set
  if (!tenant_id) {
    throw new Error('Event missing tenant_id');
  }

  // Process based on event type
  switch (type) {
    case 'ORDER_CREATED': {
      const p = payload as any;
      await tx.orders.upsert({
        where: { id: entity_id },
        create: {
          id: entity_id,
          tenant_id,
          order_number: p.order_number,
          order_type: p.order_type,
          order_status: 'OPEN',
          fulfillment_status: 'COOKING',
          handoff_status: 'WAITING',
          stations_active: [],
          unpaid_checks_count: 1,
          subtotal_cents: 0,
          discount_cents: 0,
          total_cents: 0,
          items: p.items || [],
          checks: p.checks || [],
          terminal_id: event.terminal_id,
          created_at: new Date(occurred_at),
          updated_at: new Date(occurred_at),
        },
        update: {
          updated_at: new Date(occurred_at),
        },
      });
      break;
    }

    case 'ORDER_ITEM_ADDED': {
      const p = payload as any;
      const order = await tx.orders.findUnique({
        where: { id: p.order_id },
      });

      if (order && order.tenant_id === tenant_id) {
        const items = (order.items as any[]) || [];
        const lineCents = (p.line.qty || 1) * (p.line.unit_price_cents || 0);
        await tx.orders.update({
          where: { id: p.order_id },
          data: {
            items: [...items, p.line],
            subtotal_cents: order.subtotal_cents + lineCents,
            total_cents: order.total_cents + lineCents,
            updated_at: new Date(occurred_at),
          },
        });
      }
      break;
    }

    case 'CHECK_MARKED_PAID': {
      const p = payload as any;
      const order = await tx.orders.findUnique({
        where: { id: p.order_id },
      });

      if (order && order.tenant_id === tenant_id) {
        await tx.orders.update({
          where: { id: p.order_id },
          data: {
            unpaid_checks_count: { decrement: 1 },
            updated_at: new Date(occurred_at),
          },
        });
      }
      break;
    }

    case 'INVOICE_ISSUED': {
      const p = payload as any;
      await tx.invoices.upsert({
        where: {
          tenant_id_order_id_check_id: {
            tenant_id,
            order_id: p.order_id,
            check_id: p.check_id,
          },
        },
        create: {
          id: p.invoice_id,
          tenant_id,
          order_id: p.order_id,
          check_id: p.check_id,
          invoice_type: p.invoice_type,
          series: p.series || null,
          invoice_number: p.invoice_number || null,
          total_cents: p.total_cents,
          status: 'ISSUED',
          created_at: new Date(occurred_at),
        },
        update: {},
      });
      break;
    }

    case 'SHIFT_OPENED': {
      const p = payload as any;
      await tx.shifts.upsert({
        where: { id: entity_id },
        create: {
          id: entity_id,
          tenant_id,
          terminal_id: event.terminal_id,
          status: 'OPEN',
          opened_at: new Date(occurred_at),
          opened_by: event.actor_id || 'system',
          cash_opening_cents: p.cash_opening_cents,
        },
        update: {},
      });
      break;
    }

    case 'SHIFT_CLOSED': {
      const p = payload as any;
      const shift = await tx.shifts.findUnique({
        where: { id: entity_id },
      });

      if (shift && shift.tenant_id === tenant_id) {
        await tx.shifts.update({
          where: { id: entity_id },
          data: {
            status: 'CLOSED',
            closed_at: new Date(occurred_at),
            closed_by: event.actor_id,
            cash_expected_cents: p.cash_expected_cents,
            cash_counted_cents: p.cash_counted_cents,
            diff_cents: p.diff_cents,
          },
        });
      }
      break;
    }

    // Add more event types as needed
    default:
      // Unknown event type, skip
      break;
  }
}

/**
 * Verify projection consistency for a tenant
 * 
 * Checks that all entities in projections belong to the correct tenant
 */
export async function verifyTenantProjectionConsistency(
  tenantId: string
): Promise<{ consistent: boolean; issues: string[] }> {
  const issues: string[] = [];

  try {
    // Check orders
    const ordersWithWrongTenant = await prisma.orders.findMany({
      where: {
        tenant_id: { not: tenantId },
      },
      select: { id: true, tenant_id: true },
      take: 10,
    });

    if (ordersWithWrongTenant.length > 0) {
      issues.push(
        `Found ${ordersWithWrongTenant.length} orders with wrong tenant_id`
      );
    }

    // Check shifts
    const shiftsWithWrongTenant = await prisma.shifts.findMany({
      where: {
        tenant_id: { not: tenantId },
      },
      select: { id: true, tenant_id: true },
      take: 10,
    });

    if (shiftsWithWrongTenant.length > 0) {
      issues.push(
        `Found ${shiftsWithWrongTenant.length} shifts with wrong tenant_id`
      );
    }

    // Check invoices
    const invoicesWithWrongTenant = await prisma.invoices.findMany({
      where: {
        tenant_id: { not: tenantId },
      },
      select: { id: true, tenant_id: true },
      take: 10,
    });

    if (invoicesWithWrongTenant.length > 0) {
      issues.push(
        `Found ${invoicesWithWrongTenant.length} invoices with wrong tenant_id`
      );
    }

    return {
      consistent: issues.length === 0,
      issues,
    };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return {
      consistent: false,
      issues: [`Error verifying consistency: ${error}`],
    };
  }
}
