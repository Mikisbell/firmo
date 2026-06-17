import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
    try {
        await prisma.$transaction(async (tx) => {
            try {
                // This event was already inserted in my previous verification test
                await tx.processed_events.create({ 
                    data: { 
                        event_id: 'a48f76aa-cf3c-43ae-b720-88786a81b060', 
                        tenant_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 
                        processed_at: new Date() 
                    } 
                });
            } catch (e: any) {
                console.log('Caught duplicate:', e.code);
            }
            console.log('Running query after caught error...');
            const count = await tx.processed_events.count();
            console.log('Count:', count);
        });
    } catch(e: any) {
        console.error('Tx failed:', e.message);
    }
    process.exit(0);
}

check();
