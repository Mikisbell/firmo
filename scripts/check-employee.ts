import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    const employees = await prisma.employee.findMany();
    console.log("Employees Found:", employees);
}

main()
    .catch((e) => console.error(e))
    .finally(() => prisma.$disconnect());
