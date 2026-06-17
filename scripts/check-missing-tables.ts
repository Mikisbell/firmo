import { PrismaClient, Prisma } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
    const dbTablesRaw = await prisma.$queryRaw`SELECT table_name FROM information_schema.tables WHERE table_schema='public'`;
    const dbTables = (dbTablesRaw as any[]).map(t => t.table_name);
    
    // Get prisma models dynamically
    const dmmf = Prisma.dmmf;
    const prismaModels = dmmf.datamodel.models.map(m => m.dbName || m.name);
    
    const missing = prismaModels.filter(m => !dbTables.includes(m));
    console.log("Missing tables in DB:", missing);
    process.exit(0);
}
check();
