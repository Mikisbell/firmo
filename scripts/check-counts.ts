import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

async function main() {
    console.log("Customers:", await p.customers.count());
    console.log("Drivers:", await p.drivers.count());
    console.log("Addresses:", await p.delivery_addresses.count());
    console.log("DeliveryZones:", await p.delivery_zones.count());
}

main().finally(() => p.$disconnect());
