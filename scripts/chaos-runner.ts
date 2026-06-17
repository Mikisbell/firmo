import { PrismaClient } from "@prisma/client";
import { expect } from "bun:test";
import { randomUUID } from "crypto";

// Truco SRE: Para Neon Serverless, no modificamos connection_limit en la URL
// porque el driver WebSocket tiene su propia gestión y rompe el parser.

import { runFastTracker } from "../src/core/events/tracker.service";
import { runScavenger } from "../src/core/events/scavenger.service";

const prisma = new PrismaClient();

async function main() {
  console.log("🌪️ INICIANDO INGENIERÍA DEL CAOS SRE (NIVEL 10) 🌪️");

  // 1. Preparación del terreno (Aislamos el caos)
  const tenantId = "00000000-0000-0000-0000-000000000000"; // Dummy tenant
  const panId = randomUUID();
  const aguaId = randomUUID();

  // Aseguramos que el tenant exista para las constraints
  await prisma.tenants.upsert({
      where: { id: tenantId },
      create: { id: tenantId, name: "Chaos Restaurant", slug: "chaos" },
      update: {}
  });

  await prisma.inventory.createMany({
      data: [
          { id: panId, tenant_id: tenantId, code: 'PAN', name: 'Pan de Hamburguesa', unit: 'UND' },
          { id: aguaId, tenant_id: tenantId, code: 'AGUA', name: 'Agua Mineral', unit: 'UND' }
      ],
      skipDuplicates: true
  });

  // Limpiamos los rastros pasados de missing_sequences para una aserción limpia
  await prisma.missing_sequences.deleteMany({});

  console.log("🍽️ [FASE 1] Lanzando Ráfaga de 15 Órdenes Simultáneas...");

  let firstLockAcquired = false;

  // Creamos 15 promesas concurrentes (menor al límite de 20 del pool por defecto)
  // para garantizar que todas lleguen a Postgres y sufran asfixia real de Row Lock
  // sin provocar un P2024 (Pool Timeout local en Prisma).
  const promises = Array.from({ length: 15 }).map(async (_, i) => {
      const isRollback = i === 14; // El último sufrirá un Kernel Panic simulado
      
      try {
          await prisma.$transaction(async (tx) => {
              // 1. RESERVA DEL TICKET (El Fantasma Nace aquí)
              await tx.events.create({
                  data: {
                      id: randomUUID(),
                      tenant_id: tenantId,
                      occurred_at: new Date(),
                      type: 'SALE',
                      entity_type: 'ORDER',
                      terminal_id: 'TERM-1',
                      payload: { test: true }
                  }
              });

              // 2. EL CUELLO DE BOTELLA (Row Lock)
              // Simulamos una demora orgánica brutal solo en el primero que adquiera el lock
              // para ahogar a los demás 79 en la cola física de Postgres.
              if (!firstLockAcquired) {
                  firstLockAcquired = true;
                  await tx.$executeRaw`SELECT pg_sleep(4)`; // 4 Segundos de asfixia
              }

              // Todos pelean por descontar el PAN
              await tx.$executeRaw`UPDATE inventory SET stock = stock - 1 WHERE id = ${panId}::uuid`;

              // 3. EL ASESINATO (Bifurcación de Estados)
              if (isRollback) {
                  throw new Error("💀 CAOS: Simulación de Timeout en Prisma / Caída del Nodo TCP");
              }
          }, { timeout: 60000, maxWait: 60000 }); // Tiempo extendido para soportar la asfixia orgánica sin abortar internamente
      } catch (e: any) {
          if (!e.message.includes("CAOS")) {
              console.error("Error no controlado:", e);
          }
      }
  });

  // Damos 50ms para asegurar que las 80 transacciones entraron a Postgres y sacaron su Ticket
  await new Promise(r => setTimeout(r, 50));

  console.log("🚩 [FASE 2] Clavando la Bandera de Cristal (MVCC Bypass)...");
  
  // Transacción Rápida (Agua) que evita el bloqueo del PAN
  await prisma.$transaction(async (tx) => {
      await tx.events.create({
          data: {
              id: randomUUID(),
              tenant_id: tenantId,
              occurred_at: new Date(),
              type: 'SALE_WATER',
              entity_type: 'ORDER',
              terminal_id: 'TERM-2',
              payload: { bypass: true }
          }
      });
      await tx.$executeRaw`UPDATE inventory SET stock = stock - 1 WHERE id = ${aguaId}::uuid`;
  });

  console.log("⏱️ [FASE 3] Esperando 6 segundos para que el Escudo Temporal SRE baje sus defensas...");
  await new Promise(r => setTimeout(r, 6000));
  
  console.log("🕵️ Despertando al FastCron en pleno Caos...");
  // Corremos el FastTracker mientras las 79 transacciones siguen ahogadas en el sleep() del líder
  await runFastTracker();

  // ASERCIÓN 1: El nacimiento del caos
  const initialHoles = await prisma.missing_sequences.count();
  console.log(`📊 FastCron reporta: ${initialHoles} huecos detectados.`);
  // Esperamos al menos 14 huecos (13 vivos + 1 muerto).
  // Nota: Si el sleep() aún retiene al líder, incluso el líder cuenta como hueco, por lo que podrían ser 15.
  expect(initialHoles).toBeGreaterThanOrEqual(14);

  console.log("⏳ [FASE 4] Esperando a que el asfixio orgánico termine...");
  await Promise.allSettled(promises);
  console.log("✅ Asfixia terminada. Los fantasmas vivos acaban de hacer COMMIT.");

  console.log("🧹 [FASE 5] Invocando al Scavenger para el rescate...");
  await runScavenger();
  
  // ASERCIÓN 2: La Resurrección de los vivos
  const remainingHoles = await prisma.missing_sequences.count();
  console.log(`📊 Huecos restantes post-rescate: ${remainingHoles} (El cadáver del ROLLBACK).`);
  // Debería quedar exactamente 1 (el que forzamos a hacer throw)
  expect(remainingHoles).toBe(1);

  // ASERCIÓN 3: Tolerancia Pasiva
  console.log("🔁 Ejecutando Scavenger nuevamente para probar tolerancia...");
  await runScavenger();
  const holesAfterSecondRun = await prisma.missing_sequences.count();
  expect(holesAfterSecondRun).toBe(1); // El sistema es estable

  // ASERCIÓN 4: Time Travel y Garbage Collection
  console.log("⏱️ Viajando en el tiempo... simulando 25 horas después.");
  await prisma.$executeRaw`UPDATE missing_sequences SET detected_at = NOW() - INTERVAL '25 hours'`;
  
  await runScavenger();
  const finalHoles = await prisma.missing_sequences.count();
  console.log(`📊 Huecos tras el Garbage Collection: ${finalHoles}.`);
  expect(finalHoles).toBe(0);

  console.log("🎉 INGENIERÍA DEL CAOS SUPERADA. ARQUITECTURA SRE 100% BLINDADA. 🎉");
}

main().catch(console.error).finally(() => prisma.$disconnect());
