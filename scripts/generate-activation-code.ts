import { PrismaClient } from "@prisma/client";
import { generateActivationCode, formatActivationCode } from "../src/core/auth/terminal-registry";
import { getAdminEmployeeId } from "../src/core/config/employees";

const prisma = new PrismaClient();

async function main() {
  const terminalId = process.argv[2];

  if (!terminalId) {
    console.log("❌ Debes especificar un terminal_id");
    console.log("\nUso: npx tsx scripts/generate-activation-code.ts <TERMINAL_ID>");
    console.log("\nEjemplo: npx tsx scripts/generate-activation-code.ts MOZO_03");
    
    // Show available pending terminals
    const pending = await prisma.terminal_devices.findMany({
      where: { status: 'pending' },
      select: { terminal_id: true, device_name: true, role: true },
    });

    if (pending.length > 0) {
      console.log("\n📱 Terminales pendientes disponibles:");
      for (const t of pending) {
        console.log(`   - ${t.terminal_id} (${t.device_name} - ${t.role})`);
      }
    }
    
    return;
  }

  // Check if terminal exists
  const terminal = await prisma.terminal_devices.findUnique({
    where: { terminal_id: terminalId },
  });

  if (!terminal) {
    console.log(`❌ Terminal ${terminalId} no encontrado`);
    return;
  }

  console.log(`\n🔄 Generando código de activación para ${terminalId}...`);
  console.log(`   Nombre: ${terminal.device_name}`);
  console.log(`   Rol: ${terminal.role}`);
  console.log(`   Estado: ${terminal.status}\n`);

  // Use ADMIN employee ID as created_by
  const ADMIN_ID = getAdminEmployeeId();

  // Generate new activation code
  const code = await generateActivationCode(terminalId, ADMIN_ID);

  const formatted = formatActivationCode(code.code);

  console.log("✅ Código de activación generado:\n");
  console.log(`   📋 Código: ${formatted}`);
  console.log(`   ⏰ Expira: ${code.expires_at.toLocaleString()}`);
  console.log(`   ⏱️  Válido por: 15 minutos`);
  console.log(`   🔢 Intentos permitidos: 5`);
  
  console.log("\n💡 Usa este código en la pantalla de activación del terminal.");
  console.log(`   Tenant ID: ${terminal.tenant_id}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
