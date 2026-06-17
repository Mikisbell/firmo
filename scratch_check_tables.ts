import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    const tables = await prisma.tables.findMany({ select: { number: true, zone_id: true } });
    console.log(tables.map(t => t.number).sort((a, b) => parseInt(a) - parseInt(b)));
}
main().catch(console.error).finally(() => prisma.$disconnect());
