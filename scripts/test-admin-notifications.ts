/**
 * Test Admin Notifications
 * Script para probar el sistema de notificaciones del admin panel
 */

import { createAdminNotification } from '../src/core/notifications/admin-notifier';

const TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

async function testNotifications() {
  console.log('🔔 Testing Admin Notifications System\n');

  try {
    // 1. Create HIGH priority notification (KDS delay)
    console.log('1. Creating HIGH priority KDS notification...');
    const notif1 = await createAdminNotification({
      tenant_id: TENANT_ID,
      type: 'OPERATIONAL',
      priority: 'HIGH',
      category: 'KDS',
      title: 'KDS Parrilla - Retraso 18 minutos',
      message: 'La orden #1234 lleva 18 minutos en preparación. Cliente esperando.',
      actionable: true,
      action: {
        type: 'NAVIGATE',
        target: '/admin/estaciones',
        label: 'Ver estación',
      },
      metadata: {
        station_id: 'parrilla-1',
        order_number: '1234',
        delay_minutes: 18,
      },
    });
    console.log('✅ Created:', notif1.id);

    // 2. Create MEDIUM priority notification (Low stock)
    console.log('\n2. Creating MEDIUM priority inventory notification...');
    const notif2 = await createAdminNotification({
      tenant_id: TENANT_ID,
      type: 'BUSINESS',
      priority: 'MEDIUM',
      category: 'INVENTORY',
      title: 'Stock bajo - Pollo entero',
      message: 'Solo quedan 5 unidades de Pollo entero. Considere reabastecer.',
      actionable: true,
      action: {
        type: 'NAVIGATE',
        target: '/admin/inventario',
        label: 'Ver inventario',
      },
      metadata: {
        product_id: 'pollo-entero',
        current_stock: 5,
        min_stock: 20,
      },
    });
    console.log('✅ Created:', notif2.id);

    // 3. Create LOW priority notification (Backup completed)
    console.log('\n3. Creating LOW priority system notification...');
    const notif3 = await createAdminNotification({
      tenant_id: TENANT_ID,
      type: 'INFO',
      priority: 'LOW',
      category: 'SYSTEM',
      title: 'Backup completado exitosamente',
      message: 'El backup automático diario se completó sin errores.',
      actionable: false,
      metadata: {
        backup_size_mb: 245,
        duration_seconds: 12,
      },
    });
    console.log('✅ Created:', notif3.id);

    // 4. Create MEDIUM priority notification (Large sale)
    console.log('\n4. Creating MEDIUM priority payment notification...');
    const notif4 = await createAdminNotification({
      tenant_id: TENANT_ID,
      type: 'BUSINESS',
      priority: 'MEDIUM',
      category: 'PAYMENT',
      title: 'Venta grande - S/ 850.00',
      message: 'Se registró una venta de S/ 850.00 en la mesa 12.',
      actionable: true,
      action: {
        type: 'NAVIGATE',
        target: '/admin/reportes',
        label: 'Ver reporte',
      },
      metadata: {
        amount_cents: 85000,
        table_number: 12,
        order_id: 'order-5678',
      },
    });
    console.log('✅ Created:', notif4.id);

    // 5. Create HIGH priority notification (Terminal offline)
    console.log('\n5. Creating HIGH priority terminal notification...');
    const notif5 = await createAdminNotification({
      tenant_id: TENANT_ID,
      type: 'OPERATIONAL',
      priority: 'HIGH',
      category: 'TERMINAL',
      title: 'Terminal offline - Mesero 3',
      message: 'El terminal del Mesero 3 lleva 8 minutos sin conexión.',
      actionable: true,
      action: {
        type: 'NAVIGATE',
        target: '/admin/terminales',
        label: 'Ver terminales',
      },
      metadata: {
        terminal_id: 'mesero-3',
        offline_minutes: 8,
      },
    });
    console.log('✅ Created:', notif5.id);

    // 6. Create MEDIUM priority notification (Employee login attempts)
    console.log('\n6. Creating MEDIUM priority employee notification...');
    const notif6 = await createAdminNotification({
      tenant_id: TENANT_ID,
      type: 'BUSINESS',
      priority: 'MEDIUM',
      category: 'EMPLOYEE',
      title: 'Múltiples intentos de login fallidos',
      message: 'El empleado Juan Pérez tiene 3 intentos de login fallidos.',
      actionable: true,
      action: {
        type: 'NAVIGATE',
        target: '/admin/empleados',
        label: 'Ver empleados',
      },
      metadata: {
        employee_id: 'emp-123',
        employee_name: 'Juan Pérez',
        failed_attempts: 3,
      },
    });
    console.log('✅ Created:', notif6.id);

    console.log('\n✅ All test notifications created successfully!');
    console.log('\n📊 Summary:');
    console.log('- 2 HIGH priority (OPERATIONAL)');
    console.log('- 3 MEDIUM priority (BUSINESS)');
    console.log('- 1 LOW priority (INFO)');
    console.log('\nNow open http://localhost:3000/admin and check the notification bell! 🔔');

  } catch (error) {
    console.error('❌ Error creating notifications:', error);
    process.exit(1);
  }
}

testNotifications();
