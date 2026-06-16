import { db } from '../db/schema';
import { logger } from '../observability/logger';

export class MasterDataSyncClient {
    private tenantId: string;

    constructor(tenantId: string) {
        this.tenantId = tenantId;
    }

    async bootstrap(): Promise<boolean> {
        try {
            logger.info('master_sync.start', 'Starting Master Data Bootstrap');

            const res = await fetch(`/api/data-sync/master?tenant_id=${this.tenantId}`);
            if (!res.ok) {
                logger.error('master_sync.error', `Failed to fetch master data: ${res.statusText}`);
                return false;
            }

            const data = await res.json();
            
            // Inyectar en Dexie de un solo golpe (Transacción ACID local)
            await db.transaction('rw', db.master_tables, async () => {
                if (data.tables && Array.isArray(data.tables)) {
                    // Limpiar caché anterior
                    await db.master_tables.where('tenant_id').equals(this.tenantId).delete();
                    // Insertar nueva
                    await db.master_tables.bulkAdd(data.tables);
                }
            });

            logger.info('master_sync.success', 'Master Data bootstrapped into Dexie successfully');
            return true;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logger.error('master_sync.exception', 'Exception during Master Data Bootstrap', err);
            return false;
        }
    }
}
