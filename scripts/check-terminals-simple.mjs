import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const terminals = await prisma.terminals.findMany({
    select: {
      id: true,
      terminal_id: true,
      tenant_id: true,
      is_allowed: true,
      last_seen_at: true,
    },
    take: 20,
  });

  console.log('Terminales en la base de datos:');
  console.log(JSON.stringify(terminals, null, 2));
  
  console.log(`\nTotal: ${terminals.length} terminales`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
