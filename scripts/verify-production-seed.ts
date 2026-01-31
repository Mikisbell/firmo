#!/usr/bin/env tsx
/**
 * Verify Production Seed
 * 
 * Checks if the production database has been seeded correctly.
 * 
 * Usage:
 *   npx dotenv -e .env.production -- tsx scripts/verify-production-seed.ts
 */

import { PrismaClient } from "@prisma/client";
import { DEFAULT_TENANT_ID } from "../src/core/config/location";
import { DEFAULT_EMPLOYEE_IDS } from "../src/core/config/employees";

const prisma = new PrismaClient();
const TENANT_ID = DEFAULT_TENANT_ID;

async function verify() {
    console.log("🔍 Verifying production database seed...\n");

    let allGood = true;

    // 1. Check Admin Employee
    console.log("1️⃣  Checking ADMIN employee...");
    const admin = await prisma.employees.findUnique({
        where: { id: DEFAULT_EMPLOYEE_IDS.ADMIN }
    });

    if (admin) {
        console.log(`   ✅ Admin found: ${admin.name} (Role: ${admin.role})`);
        console.log(`   🔑 Can login with PIN: 1234`);
    } else {
        console.log("   ❌ Admin NOT found");
        allGood = false;
    }

    // 2. Check Tenant Settings
    console.log("\n2️⃣  Checking tenant settings...");
    const tenant = await prisma.tenant_settings.findUnique({
        where: { tenant_id: TENANT_ID }
    });

    if (tenant) {
        console.log(`   ✅ Tenant found: ${tenant.legal_name}`);
    } else {
        console.log("   ❌ Tenant NOT found");
        allGood = false;
    }

    // 3. Check Location
    console.log("\n3️⃣  Checking location...");
    const location = await prisma.locations.findFirst({
        where: { tenant_id: TENANT_ID }
    });

    if (location) {
        console.log(`   ✅ Location found: ${location.name}`);
    } else {
        console.log("   ❌ Location NOT found");
        allGood = false;
    }

    // 4. Check Stations
    console.log("\n4️⃣  Checking stations...");
    const stations = await prisma.stations.findMany({
        where: { tenant_id: TENANT_ID }
    });

    if (stations.length >= 5) {
        console.log(`   ✅ ${stations.length} stations found`);
        stations.forEach(s => console.log(`      • ${s.name}`));
    } else {
        console.log(`   ⚠️  Only ${stations.length} stations found (expected 5)`);
        allGood = false;
    }

    // 5. Check Products
    console.log("\n5️⃣  Checking products...");
    const products = await prisma.products.findMany({
        where: { tenant_id: TENANT_ID }
    });

    if (products.length >= 10) {
        console.log(`   ✅ ${products.length} products found`);
    } else {
        console.log(`   ⚠️  Only ${products.length} products found (expected 10)`);
        allGood = false;
    }

    // 6. Check Tables
    console.log("\n6️⃣  Checking tables...");
    const tables = await prisma.tables.findMany({
        where: { tenant_id: TENANT_ID }
    });

    if (tables.length >= 10) {
        console.log(`   ✅ ${tables.length} tables found`);
    } else {
        console.log(`   ⚠️  Only ${tables.length} tables found (expected 10)`);
        allGood = false;
    }

    // 7. Check Terminals
    console.log("\n7️⃣  Checking terminals...");
    const terminals = await prisma.terminals.findMany({
        where: { tenant_id: TENANT_ID }
    });

    if (terminals.length >= 3) {
        console.log(`   ✅ ${terminals.length} terminals found`);
        terminals.forEach(t => console.log(`      • ${t.terminal_id}`));
    } else {
        console.log(`   ⚠️  Only ${terminals.length} terminals found (expected 3)`);
        allGood = false;
    }

    // 8. Check Terminal Devices
    console.log("\n8️⃣  Checking terminal devices...");
    const devices = await prisma.terminal_devices.findMany({
        where: { tenant_id: TENANT_ID }
    });

    if (devices.length >= 3) {
        console.log(`   ✅ ${devices.length} terminal devices found`);
        devices.forEach(d => console.log(`      • ${d.terminal_id} (${d.status})`));
    } else {
        console.log(`   ⚠️  Only ${devices.length} terminal devices found (expected 3)`);
        allGood = false;
    }

    // Summary
    console.log("\n" + "=".repeat(60));
    if (allGood) {
        console.log("✅ ALL CHECKS PASSED!");
        console.log("=".repeat(60));
        console.log("\n🚀 You can now login to the admin panel:");
        console.log("   • URL: https://your-app.vercel.app/admin");
        console.log("   • Role: ADMIN");
        console.log("   • PIN: 1234");
    } else {
        console.log("⚠️  SOME CHECKS FAILED");
        console.log("=".repeat(60));
        console.log("\n💡 Try running the seed script again:");
        console.log("   npx dotenv -e .env.production -- npm run seed:prod");
    }
    console.log("");
}

verify()
    .catch((e) => {
        console.error("\n❌ Error verifying database:");
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
