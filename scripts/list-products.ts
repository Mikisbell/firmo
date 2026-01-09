import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const products = await prisma.products.findMany({
        select: { name: true, station: true, category: true },
        orderBy: { station: 'asc' }
    });
    
    console.log('\n=== PRODUCTOS POR ESTACIÓN ===\n');
    
    const byStation: Record<string, string[]> = {};
    for (const p of products) {
        if (!byStation[p.station]) byStation[p.station] = [];
        byStation[p.station].push(p.name);
    }
    
    for (const [station, items] of Object.entries(byStation)) {
        console.log(`📍 ${station}:`);
        items.forEach(item => console.log(`   - ${item}`));
        console.log('');
    }
}

main().finally(() => prisma.$disconnect());
