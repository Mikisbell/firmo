import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

async function main() {
    console.log("Customers:", await p.customer.count());
    console.log("Drivers:", await p.driver.count());
    console.log("Addresses:", await p.deliveryAddress.count());
    console.log("DeliveryZones:", await p.deliveryZone.count());
}

main().finally(() => p.$disconnect());
