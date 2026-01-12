// scripts/seed-terminal-v2.ts
// Seed data para Terminal Architecture v2

import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';

const prisma = new PrismaClient();

const TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const ADMIN_ID = '00000000-0000-0000-0000-000000000001';
const CASHIER_ID = '00000000-0000-0000-0000-000000000002';
const WAITER_ID = '00000000-0000-0000-0000-000000000003';

async function main() {
  console.log('🌱 Seeding Terminal Architecture v2 data...\n');

  // 1. TERMINAL DEVICES
  const terminalDevices = [
    { terminal_id: 'CAJA_01', role: 'CASHIER', status: 'active', device_name: 'Caja Principal', location_id: 'LOC01' },
    { terminal_id: 'SPC_HORNO', role: 'KDS', status: 'active', device_name: 'Horno/Parrilla', location_id: 'LOC01' },
    { terminal_id: 'SPC_COCINA', role: 'KDS', status: 'active', device_name: 'Cocina', location_id: 'LOC01' },
    { terminal_id: 'SPC_BAR', role: 'BAR', status: 'active', device_name: 'Bar', location_id: 'LOC01' },
    { terminal_id: 'MOZO_01', role: 'WAITER', status: 'active', device_name: 'Mesero 1', location_id: 'LOC01' },
    { terminal_id: 'MOZO_02', role: 'WAITER', status: 'active', device_name: 'Mesero 2', location_id: 'LOC01' },
    { terminal_id: 'MOZO_03', role: 'WAITER', status: 'pending', device_name: 'Mesero 3', location_id: 'LOC01' },
    { terminal_id: 'MOZO_04', role: 'WAITER', status: 'disabled', device_name: 'Mesero 4', location_id: 'LOC01' },
    { terminal_id: 'MOZO_05', role: 'WAITER', status: 'pending', device_name: 'Mesero 5', location_id: 'LOC01' },
  ];

  let createdDevices = 0;
  for (const td of terminalDevices) {
    const existing = await prisma.terminal_devices.findUnique({
      where: { terminal_id: td.terminal_id }
    });

    if (!existing) {
      const now = new Date();
      await prisma.terminal_devices.create({
        data: {
          terminal_id: td.terminal_id,
          tenant_id: TENANT_ID,
          role: td.role,
          fingerprint_hash: td.status === 'active' ? createHash('sha256').update(`fp_${td.terminal_id}_test`).digest('hex') : null,
          fingerprint_salt: createHash('sha256').update(TENANT_ID).digest('hex').slice(0, 16),
          status: td.status,
          bound_at: td.status === 'active' ? now : null,
          last_seen_at: now,
          last_fingerprint_check: now,
          drift_score: 0,
          location_id: td.location_id,
          device_name: td.device_name,
        },
      });
      createdDevices++;
    }
  }
  console.log(`✅ ${createdDevices} terminal devices created`);

  // 2. ACTIVATION CODES (para terminales pending)
  const pendingTerminals = terminalDevices.filter(t => t.status === 'pending');
  let createdCodes = 0;
  for (const pt of pendingTerminals) {
    const existing = await prisma.activation_codes.findFirst({
      where: { terminal_id: pt.terminal_id, used: false }
    });

    if (!existing) {
      const code = String(Math.floor(100000 + Math.random() * 900000));
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour for testing

      await prisma.activation_codes.create({
        data: {
          terminal_id: pt.terminal_id,
          code: code,
          expires_at: expiresAt,
          attempts: 0,
          used: false,
          created_by: ADMIN_ID,
        },
      });
      console.log(`   📱 ${pt.terminal_id}: código ${code.slice(0,3)}-${code.slice(3)}`);
      createdCodes++;
    }
  }
  console.log(`✅ ${createdCodes} activation codes created`);

  // 3. AUTH EVENTS (sample)
  const existingEvents = await prisma.auth_events.count({ where: { tenant_id: TENANT_ID } });
  if (existingEvents === 0) {
    const authEvents = [
      { terminal_id: 'CAJA_01', event_type: 'login_success', employee_id: CASHIER_ID, risk_score: 10, fingerprint_match: 95 },
      { terminal_id: 'CAJA_01', event_type: 'logout', employee_id: CASHIER_ID, risk_score: null, fingerprint_match: null },
      { terminal_id: 'MOZO_01', event_type: 'login_success', employee_id: WAITER_ID, risk_score: 15, fingerprint_match: 92 },
      { terminal_id: 'MOZO_02', event_type: 'login_failed', employee_id: null, risk_score: 75, fingerprint_match: 30 },
      { terminal_id: 'SPC_HORNO', event_type: 'device_activated', employee_id: null, risk_score: 0, fingerprint_match: 100 },
    ];

    for (const ae of authEvents) {
      await prisma.auth_events.create({
        data: {
          tenant_id: TENANT_ID,
          terminal_id: ae.terminal_id,
          employee_id: ae.employee_id,
          event_type: ae.event_type,
          risk_score: ae.risk_score,
          fingerprint_match: ae.fingerprint_match,
          ip_address: '192.168.1.100',
          user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
          metadata: {},
        },
      });
    }
    console.log(`✅ ${authEvents.length} auth events created`);
  }

  // 4. SECURITY ALERTS (sample)
  const existingAlerts = await prisma.security_alerts.count({ where: { tenant_id: TENANT_ID } });
  if (existingAlerts === 0) {
    const alerts = [
      { terminal_id: 'MOZO_02', alert_type: 'fingerprint_mismatch', severity: 'high', message: 'Fingerprint mismatch detected - possible device change' },
      { terminal_id: 'MOZO_04', alert_type: 'terminal_disabled', severity: 'medium', message: 'Terminal disabled by admin' },
    ];

    for (const sa of alerts) {
      await prisma.security_alerts.create({
        data: {
          tenant_id: TENANT_ID,
          terminal_id: sa.terminal_id,
          alert_type: sa.alert_type,
          severity: sa.severity,
          message: sa.message,
          acknowledged: false,
        },
      });
    }
    console.log(`✅ ${alerts.length} security alerts created`);
  }

  // Verify
  console.log('\n📊 Verificación final:');
  const counts = {
    devices: await prisma.terminal_devices.count(),
    codes: await prisma.activation_codes.count(),
    events: await prisma.auth_events.count(),
    alerts: await prisma.security_alerts.count(),
  };
  console.log(`   terminal_devices: ${counts.devices}`);
  console.log(`   activation_codes: ${counts.codes}`);
  console.log(`   auth_events: ${counts.events}`);
  console.log(`   security_alerts: ${counts.alerts}`);

  console.log('\n🎉 Seed completado!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
