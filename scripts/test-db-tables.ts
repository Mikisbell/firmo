import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function check() {
    const tables = await prisma.$queryRaw`SELECT table_name FROM information_schema.tables WHERE table_schema='public'`;
    console.log('Tables:', tables);
    process.exit(0);
}
check();
