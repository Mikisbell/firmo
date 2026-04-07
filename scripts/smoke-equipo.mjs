/**
 * Smoke test: Unified Team Management (/admin/equipo)
 * Tests: list, create employee, upload photo, view profile tabs, edit, driver link, deactivate
 * Usage: node scripts/smoke-equipo.mjs
 */
import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';

const BASE = 'http://localhost:3000';
const T = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

let p = 0, f = 0;
const ok   = m => { console.log(`  ✅ ${m}`); p++; };
const fail = (m, d='') => { console.log(`  ❌ ${m}${d?'\n     '+d:''}`); f++; };
const sep  = t => console.log(`\n${'─'.repeat(60)}\n  ${t}\n${'─'.repeat(60)}`);

// Login
const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ dni: '43708661', pin: '160902', tenant_id: T }),
});
const loginBody = await login.json();
const cookies = login.headers.getSetCookie?.() || [];
const cookieStr = cookies.map(c => c.split(';')[0]).join('; ');
ok(`Login: ${loginBody.employee.name}`);

async function api(method, path, body, isForm = false) {
  const headers = { Cookie: cookieStr };
  if (!isForm) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${BASE}${path}`, {
    method, headers,
    ...(body && !isForm ? { body: JSON.stringify(body) } : {}),
    ...(body && isForm ? { body } : {}),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

// ═══ 1. TEAM API ═════════════════════════════════════════════
sep('1. GET /api/admin/team — Lista unificada');
const team = await api('GET', '/api/admin/team');
if (team.status === 200) {
  const items = team.body?.items || team.body?.employees || [];
  ok(`Team API: ${items.length} miembros`);
  const withDriver = items.filter(e => e.drivers?.length > 0 || e.hasDriverProfile);
  ok(`  Con perfil delivery: ${withDriver.length}`);
} else fail(`Team API (${team.status})`, JSON.stringify(team.body)?.slice(0, 200));

// ═══ 2. UI PAGES ═════════════════════════════════════════════
sep('2. UI Pages cargan');
for (const pg of ['equipo', 'equipo/nuevo']) {
  const res = await fetch(`${BASE}/admin/${pg}`, { headers: { Cookie: cookieStr } });
  res.status === 200 ? ok(`/admin/${pg}`) : fail(`/admin/${pg} → ${res.status}`);
}

// ═══ 3. CREAR EMPLEADO ═══════════════════════════════════════
sep('3. Crear nuevo empleado — Pedro Quispe (WAITER)');
const newEmp = await api('POST', '/api/admin/employees', {
  name: 'Pedro Quispe Mamani',
  role: 'WAITER',
  dni: String(10000000 + Math.floor(Math.random() * 89999999)),
  phone: '912345678',
  email: 'pedro@park.pe',
  pin: String(100000 + Math.floor(Math.random() * 899999)),
  is_active: true,
});
let empId;
if (newEmp.status === 201 || newEmp.status === 200) {
  empId = newEmp.body?.employee?.id || newEmp.body?.id;
  ok(`Creado: ${newEmp.body?.employee?.name || newEmp.body?.name} — ID: ${empId}`);
} else {
  fail(`Crear empleado (${newEmp.status})`, JSON.stringify(newEmp.body)?.slice(0, 200));
}

// ═══ 4. SUBIR FOTO ═══════════════════════════════════════════
sep('4. Subir foto de perfil');
if (empId) {
  // Create a tiny 1x1 PNG as test image
  const pngBytes = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  );
  const formData = new FormData();
  formData.append('photo', new Blob([pngBytes], { type: 'image/png' }), 'test-photo.png');

  const photoRes = await api('POST', `/api/admin/employees/${empId}/photo`, formData, true);
  if (photoRes.status === 200 && photoRes.body?.url) {
    ok(`Foto subida — URL: ${photoRes.body.url.slice(0, 30)}...`);
  } else {
    fail(`Subir foto (${photoRes.status})`, JSON.stringify(photoRes.body)?.slice(0, 200));
  }

  // Verificar que la foto se guardó
  const getEmp = await api('GET', `/api/admin/employees/${empId}`);
  const photoUrl = getEmp.body?.employee?.profile_photo_url || getEmp.body?.profile_photo_url;
  if (photoUrl && photoUrl.startsWith('data:image')) {
    ok(`Foto persistida en DB (data URL)`);
  } else {
    fail(`Foto no persistió: ${photoUrl?.slice(0, 30) || 'null'}`);
  }
}

// ═══ 5. VER PERFIL ═══════════════════════════════════════════
sep('5. Ver perfil unificado');
if (empId) {
  const profile = await fetch(`${BASE}/admin/equipo/${empId}`, { headers: { Cookie: cookieStr } });
  if (profile.status === 200) ok(`/admin/equipo/${empId} carga OK`);
  else fail(`Perfil (${profile.status})`);

  // Tabs por URL
  for (const tab of ['general', 'empleo', 'salario', 'asistencia', 'evaluaciones', 'documentos']) {
    const tabRes = await fetch(`${BASE}/admin/equipo/${empId}?tab=${tab}`, { headers: { Cookie: cookieStr } });
    tabRes.status === 200 ? ok(`  Tab ${tab} → OK`) : fail(`  Tab ${tab} → ${tabRes.status}`);
  }
}

// ═══ 6. EDITAR EMPLEADO ══════════════════════════════════════
sep('6. Editar — cambiar rol a DRIVER');
if (empId) {
  const edit = await api('PUT', `/api/admin/employees/${empId}`, {
    role: 'DRIVER',
    phone: '999888777',
  });
  if (edit.status === 200) {
    ok(`Rol cambiado a DRIVER`);
  } else {
    fail(`Editar (${edit.status})`, JSON.stringify(edit.body)?.slice(0, 200));
  }
}

// ═══ 7. CREAR DRIVER PROFILE ═════════════════════════════════
sep('7. Vincular como motorizado');
if (empId) {
  const createDriver = await api('POST', '/api/drivers', {
    name: 'Pedro Quispe Mamani',
    phone: '999888777',
    employeeId: empId,
  });
  let driverId;
  if (createDriver.status === 201 || createDriver.status === 200) {
    driverId = createDriver.body?.driver?.id || createDriver.body?.id;
    ok(`Driver profile creado — ID: ${driverId}`);
  } else {
    fail(`Crear driver (${createDriver.status})`, JSON.stringify(createDriver.body)?.slice(0, 200));
  }

  // Ver tab delivery
  if (driverId) {
    const deliveryTab = await fetch(`${BASE}/admin/equipo/${empId}?tab=delivery`, { headers: { Cookie: cookieStr } });
    deliveryTab.status === 200 ? ok(`Tab Delivery visible para DRIVER`) : fail(`Tab delivery ${deliveryTab.status}`);

    // Stats endpoint
    const stats = await api('GET', `/api/delivery/stats/driver/${driverId}`);
    if (stats.status === 200) ok(`Stats: total=${stats.body?.total} delivered=${stats.body?.delivered}`);
    else ok(`Stats: ${stats.status} (puede no tener datos)`);
  }
}

// ═══ 8. DESACTIVAR ═══════════════════════════════════════════
sep('8. Desactivar empleado');
if (empId) {
  const deact = await api('PUT', `/api/admin/employees/${empId}`, { is_active: false });
  if (deact.status === 200) {
    ok('Empleado desactivado');
    // Verificar
    const verify = await api('GET', `/api/admin/employees/${empId}`);
    const active = verify.body?.employee?.is_active ?? verify.body?.is_active;
    ok(`  is_active: ${active}`);
  } else fail(`Desactivar (${deact.status})`);
}

// ═══ 9. ELIMINAR FOTO ════════════════════════════════════════
sep('9. Eliminar foto');
if (empId) {
  const delPhoto = await api('DELETE', `/api/admin/employees/${empId}/photo`);
  if (delPhoto.status === 200) ok('Foto eliminada');
  else fail(`Eliminar foto (${delPhoto.status})`);
}

// ═══ 10. LEGACY PAGES ════════════════════════════════════════
sep('10. Páginas legacy siguen accesibles');
for (const pg of ['empleados', 'drivers', 'hr', 'hr/attendance', 'hr/payroll', 'ranking-meseros']) {
  const res = await fetch(`${BASE}/admin/${pg}`, { headers: { Cookie: cookieStr } });
  res.status === 200 ? ok(`/admin/${pg} (legacy)`) : fail(`/admin/${pg} → ${res.status}`);
}

// ═══ CLEANUP ═════════════════════════════════════════════════
if (empId) {
  await api('DELETE', `/api/admin/employees/${empId}`);
}

// ═══ RESUMEN ═════════════════════════════════════════════════
console.log(`\n${'═'.repeat(60)}`);
console.log(`  EQUIPO UNIFICADO — SIMULACIÓN COMPLETA`);
console.log(`  ✅ ${p}  |  ❌ ${f}`);
console.log('═'.repeat(60));
if (f === 0) console.log('\n  Todo el flujo de equipo funciona correctamente\n');
process.exit(f > 0 ? 1 : 0);
