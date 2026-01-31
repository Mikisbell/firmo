import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🔍 Buscando códigos de activación activos...\n");

  // Get all activation codes with terminal info
  const codes = await prisma.activation_codes.findMany({
    where: {
      used: false,
    },
    include: {
      terminal_device: true,
    },
    orderBy: {
      created_at: 'desc',
    },
  });

  if (codes.length === 0) {
    console.log("❌ No hay códigos de activación activos.");
    console.log("\n💡 Necesitas generar un código desde el panel de admin:");
    console.log("   1. Ve a /admin/terminales");
    console.log("   2. Haz clic en 'Nuevo Terminal' o 'Ver Detalles' de un terminal pendiente");
    console.log("   3. Genera un nuevo código de activación");
    return;
  }

  console.log(`✅ Encontrados ${codes.length} código(s) de activación:\n`);

  const now = new Date();

  for (const code of codes) {
    const isExpired = code.expires_at < now;
    const formatted = `${code.code.slice(0, 3)}-${code.code.slice(3)}`;
    
    console.log(`📱 Terminal: ${code.terminal_device.terminal_id}`);
    console.log(`   Nombre: ${code.terminal_device.device_name}`);
    console.log(`   Rol: ${code.terminal_device.role}`);
    console.log(`   Estado: ${code.terminal_device.status}`);
    console.log(`   Código: ${formatted}`);
    console.log(`   Expira: ${code.expires_at.toLocaleString()}`);
    console.log(`   ${isExpired ? '❌ EXPIRADO' : '✅ VÁLIDO'}`);
    console.log(`   Intentos: ${code.attempts}/5`);
    console.log("");
  }

  // Show pending terminals without codes
  const pendingTerminals = await prisma.terminal_devices.findMany({
    where: {
      status: 'pending',
    },
  });

  const terminalsWithoutCodes = pendingTerminals.filter(t => 
    !codes.some(c => c.terminal_id === t.terminal_id)
  );

  if (terminalsWithoutCodes.length > 0) {
    console.log(`\n⚠️  Terminales pendientes sin código de activación:`);
    for (const terminal of terminalsWithoutCodes) {
      console.log(`   - ${terminal.terminal_id} (${terminal.device_name})`);
    }
    console.log("\n💡 Genera códigos para estos terminales desde /admin/terminales");
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
