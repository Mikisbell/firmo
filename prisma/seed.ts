import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    const TENANT_ID = "00000000-0000-0000-0000-000000000001";
    const EMPLOYEE_ID = "00000000-0000-0000-0000-000000000001";

    // Upsert Tenant Settings (Required for some flows, maybe)
    await prisma.tenantSettings.upsert({
        where: { tenant_id: TENANT_ID },
        update: {},
        create: {
            tenant_id: TENANT_ID,
            legal_name: "PARK POS Default Tenant",
            address_text: "123 Main St",
        }
    });

    // Upsert Employee
    await prisma.employee.upsert({
        where: { id: EMPLOYEE_ID },
        update: {},
        create: {
            id: EMPLOYEE_ID,
            tenant_id: TENANT_ID,
            name: "Admin User",
            role: "ADMIN",
            is_active: true
        }
    });

    console.log("✅ Seeded default Tenant and Employee.");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
