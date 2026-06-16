import { Prisma } from "@prisma/client";
import { ParkEvent } from "@/src/core/domain/events";
import { ProjectionHandler } from "./types";

export const handleTableAttachedToOrder: ProjectionHandler = async (tx, event) => {
    const { tenant_id, payload, occurred_at } = event;
    const p = payload as any;
    
    // Fallback logic from both TABLE_ATTACHED_TO_ORDER blocks in original code
    await tx.$executeRaw`
        UPDATE tables 
        SET status = 'OCCUPIED', 
            current_order_id = ${p.order_id}::uuid,
            occupied_since = ${new Date(occurred_at)}
        WHERE id = ${p.attached_table_id}::uuid
    `;

    await tx.order_tables.upsert({
        where: {
            order_id_table_id: {
                order_id: p.order_id,
                table_id: p.attached_table_id
            }
        },
        create: {
            order_id: p.order_id,
            table_id: p.attached_table_id,
            is_primary: false,
            joined_at: new Date(occurred_at)
        },
        update: {}
    });
    return true;
};

export const handleTableDetachedFromOrder: ProjectionHandler = async (tx, event) => {
    const { payload } = event;
    const p = payload as any;
    
    await tx.$executeRaw`
        UPDATE tables 
        SET status = 'AVAILABLE', 
            current_order_id = NULL,
            occupied_since = NULL
        WHERE id = ${p.detached_table_id}::uuid
    `;
    
    await tx.order_tables.deleteMany({
        where: {
            order_id: p.order_id,
            table_id: p.detached_table_id
        }
    });
    return true;
};

export const handleOrderTableChanged: ProjectionHandler = async (tx, event) => {
    const { tenant_id, payload, occurred_at } = event;
    const p = payload as any;

    await tx.$executeRaw`
        UPDATE order_item_projections
        SET table_number = ${p.to_table}, updated_at = ${new Date(occurred_at)}
        WHERE order_id = ${p.order_id}::uuid
    `;
    
    await tx.order_tables.deleteMany({
        where: { order_id: p.order_id, is_primary: true }
    });
    
    const newTbl = await tx.tables.findFirst({
        where: { tenant_id, number: p.to_table },
        select: { id: true }
    });
    
    if (newTbl) {
        await tx.order_tables.create({
            data: {
                order_id: p.order_id,
                table_id: newTbl.id,
                is_primary: true
            }
        }).catch(() => {});
    }
    
    // Also free old table and occupy new table as per earlier logic
    await tx.$executeRaw`
        UPDATE tables 
        SET status = 'AVAILABLE', 
            current_order_id = NULL,
            occupied_since = NULL
        WHERE tenant_id = ${tenant_id}::uuid 
          AND number = ${p.from_table}
    `;
    
    await tx.$executeRaw`
        UPDATE tables 
        SET status = 'OCCUPIED', 
            current_order_id = ${p.order_id}::uuid,
            occupied_since = ${new Date(occurred_at)}
        WHERE tenant_id = ${tenant_id}::uuid 
          AND number = ${p.to_table}
    `;

    return true;
};
