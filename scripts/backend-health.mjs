import { PrismaClient } from "@prisma/client";
import axios from "axios";

const prisma = new PrismaClient();

async function backendHealthCheck() {
  console.log("🔍 VERIFICACIÓN DE BACKEND - PARK POS\n");
  console.log("=" * 70);
  
  try {
    // 1. Database Connection
    console.log("\n1️⃣  CONEXIÓN A BASE DE DATOS");
    console.log("-".repeat(70));
    try {
      await prisma.$queryRaw`SELECT 1`;
      console.log("✅ Conexión a PostgreSQL: EXITOSA");
    } catch (error) {
      console.log("❌ Conexión a PostgreSQL: FALLIDA");
      console.log(`   Error: ${error.message}`);
    }

    // 2. Prisma Models
    console.log("\n2️⃣  MODELOS DE PRISMA");
    console.log("-".repeat(70));
    const models = [
      "tenants", "employees", "terminals", "locations", "products",
      "inventory", "orders", "invoices", "events", "delivery_orders"
    ];
    
    for (const model of models) {
      try {
        const count = await prisma[model].count();
        console.log(`✅ ${model.padEnd(20)}: ${count} registros`);
      } catch (error) {
        console.log(`❌ ${model.padEnd(20)}: Error`);
      }
    }

    // 3. API Endpoints
    console.log("\n3️⃣  ENDPOINTS DE API");
    console.log("-".repeat(70));
    
    const baseUrl = "http://localhost:3000";
    const endpoints = [
      { method: "GET", path: "/api/health", name: "Health Check" },
      { method: "GET", path: "/api/auth/session", name: "Session" },
      { method: "GET", path: "/api/products", name: "Products" },
      { method: "GET", path: "/api/orders", name: "Orders" },
      { method: "GET", path: "/api/inventory", name: "Inventory" },
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await axios({
          method: endpoint.method,
          url: `${baseUrl}${endpoint.path}`,
          timeout: 5000,
          validateStatus: () => true,
        });
        const status = response.status >= 200 && response.status < 300 ? "✅" : "⚠️";
        console.log(`${status} ${endpoint.method.padEnd(6)} ${endpoint.path.padEnd(30)} (${response.status})`);
      } catch (error) {
        console.log(`❌ ${endpoint.method.padEnd(6)} ${endpoint.path.padEnd(30)} (No responde)`);
      }
    }

    // 4. Environment Variables
    console.log("\n4️⃣  VARIABLES DE ENTORNO");
    console.log("-".repeat(70));
    
    const envVars = [
      "DATABASE_URL",
      "DIRECT_URL",
      "NEXTAUTH_SECRET",
      "NEXTAUTH_URL",
      "VAPID_PUBLIC_KEY",
      "VAPID_PRIVATE_KEY",
      "TENANT_ID",
    ];

    for (const envVar of envVars) {
      const value = process.env[envVar];
      if (value) {
        const masked = value.length > 20 ? value.substring(0, 20) + "..." : value;
        console.log(`✅ ${envVar.padEnd(25)}: ${masked}`);
      } else {
        console.log(`⚠️  ${envVar.padEnd(25)}: NO CONFIGURADA`);
      }
    }

    // 5. Services Status
    console.log("\n5️⃣  ESTADO DE SERVICIOS");
    console.log("-".repeat(70));
    
    const services = {
      "PostgreSQL": process.env.DATABASE_URL ? "✅" : "❌",
      "Redis": process.env.REDIS_URL ? "✅" : "⚠️",
      "NextAuth": process.env.NEXTAUTH_SECRET ? "✅" : "❌",
      "Push Notifications": process.env.VAPID_PUBLIC_KEY ? "✅" : "⚠️",
      "Email": process.env.SMTP_HOST ? "✅" : "⚠️",
    };

    for (const [service, status] of Object.entries(services)) {
      console.log(`${status} ${service}`);
    }

    // 6. File Structure
    console.log("\n6️⃣  ESTRUCTURA DE ARCHIVOS");
    console.log("-".repeat(70));
    
    const fs = await import("fs");
    const path = await import("path");
    
    const dirs = [
      "src/app/api",
      "src/core/services",
      "src/core/domain",
      "src/components",
      "prisma/migrations",
    ];

    for (const dir of dirs) {
      try {
        const files = fs.readdirSync(dir);
        console.log(`✅ ${dir.padEnd(30)}: ${files.length} items`);
      } catch (error) {
        console.log(`❌ ${dir.padEnd(30)}: No encontrado`);
      }
    }

    console.log("\n" + "=".repeat(70));
    console.log("✅ Verificación completada\n");

  } catch (error) {
    console.error("❌ Error durante verificación:", error.message);
  } finally {
    await prisma.$disconnect();
  }
}

backendHealthCheck();
