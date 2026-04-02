/**
 * Smoke test: Printer management full CRUD cycle
 * Usage: node scripts/smoke-printers.mjs
 */

const BASE = 'http://localhost:3000';
const TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

let passed = 0, failed = 0;
const ok   = msg => { console.log(`  ✅ ${msg}`); passed++; };
const fail = (msg, d='') => { console.log(`  ❌ ${msg}${d?'\n     '+d:''}`); failed++; };
const sep  = t => console.log(`\n${'─'.repeat(60)}\n  ${t}\n${'─'.repeat(60)}`);

// ── Login ─────────────────────────────────────────────────────
sep('1. Login como Admin Principal');
const loginRes = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ dni: '43708661', pin: '160902', tenant_id: TENANT_ID }),
});
const loginBody = await loginRes.json();
const cookies = loginRes.headers.getSetCookie?.() || [];
const authCookie = cookies.find(c => c.startsWith('auth_token='));

if (loginRes.status === 200 && loginBody.success && authCookie) {
  ok(`Login exitoso como ${loginBody.employee.name} (${loginBody.employee.role})`);
} else {
  fail(`Login falló (${loginRes.status})`, JSON.stringify(loginBody));
  process.exit(1);
}

const cookieStr = cookies.map(c => c.split(';')[0]).join('; ');

async function req(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'Cookie': cookieStr },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, body: json };
}

// ── 2. Listar impresoras ──────────────────────────────────────
sep('2. GET /api/admin/printers');
const list0 = await req('GET', '/api/admin/printers?all=true');
if (list0.status === 200 && Array.isArray(list0.body?.printers)) {
  ok(`Lista OK: ${list0.body.printers.length} impresoras`);
} else {
  fail(`GET printers falló (${list0.status})`, JSON.stringify(list0.body));
}

// ── 3. Crear impresora Caja ───────────────────────────────────
sep('3. POST — Crear Epson TM-m50 Caja');
const create = await req('POST', '/api/admin/printers', {
  name: 'Epson TM-m50 Caja',
  stationCode: 'CAJA',
  connectionType: 'TCP',
  connection: { address: '192.168.1.100:9100' },
  paperWidth: 80,
});

let printerId;
if (create.status === 201 && create.body?.printer?.id) {
  printerId = create.body.printer.id;
  ok(`Creada — ID: ${printerId}`);
  ok(`  ${create.body.printer.connectionType} → ${JSON.stringify(create.body.printer.connection)}`);
} else {
  fail(`Crear falló (${create.status})`, JSON.stringify(create.body));
}

// ── 4. Crear impresora Cocina ─────────────────────────────────
sep('4. POST — Crear Epson Cocina');
const create2 = await req('POST', '/api/admin/printers', {
  name: 'Epson TM-T88 Cocina',
  stationCode: 'COCINA',
  connectionType: 'TCP',
  connection: { address: '192.168.1.101:9100' },
  paperWidth: 80,
});
let printer2Id;
if (create2.status === 201) {
  printer2Id = create2.body.printer.id;
  ok(`Creada — ${create2.body.printer.name}`);
} else {
  fail(`Crear cocina falló (${create2.status})`, JSON.stringify(create2.body));
}

// ── 5. Listar (2+) ───────────────────────────────────────────
sep('5. GET — Verificar lista');
const list1 = await req('GET', '/api/admin/printers?all=true');
if (list1.status === 200) {
  const names = list1.body.printers.map(p => p.name).join(', ');
  ok(`${list1.body.printers.length} impresoras: ${names}`);
} else {
  fail(`Listar falló (${list1.status})`);
}

// ── 6. GET por ID ─────────────────────────────────────────────
sep('6. GET /api/admin/printers/[id]');
if (printerId) {
  const get = await req('GET', `/api/admin/printers/${printerId}`);
  if (get.status === 200 && get.body?.printer?.id === printerId) {
    ok(`Encontrada: ${get.body.printer.name}`);
  } else {
    fail(`GET by ID falló (${get.status})`, JSON.stringify(get.body));
  }
}

// ── 7. PATCH — Renombrar ──────────────────────────────────────
sep('7. PATCH — Renombrar');
if (printerId) {
  const patch = await req('PATCH', `/api/admin/printers/${printerId}`, {
    name: 'Epson TM-m50 Caja Principal',
  });
  if (patch.status === 200 && patch.body?.printer?.name === 'Epson TM-m50 Caja Principal') {
    ok(`Renombrada: ${patch.body.printer.name}`);
  } else {
    fail(`PATCH falló (${patch.status})`, JSON.stringify(patch.body));
  }
}

// ── 8. Test print ─────────────────────────────────────────────
sep('8. POST test print (TCP — fallará porque IP no existe)');
if (printerId) {
  const test = await req('POST', `/api/admin/printers/${printerId}/test`);
  if (test.status === 200 && test.body?.success === false) {
    ok(`Test print falló esperadamente (IP no existe en red)`);
    ok(`  Error: ${test.body.error}`);
  } else if (test.status === 200 && test.body?.success === true) {
    ok(`Test print exitoso (impresora respondió)`);
  } else {
    fail(`Test print inesperado (${test.status})`, JSON.stringify(test.body));
  }
}

// ── 9. Print Jobs + stats ─────────────────────────────────────
sep('9. Print Jobs — stats');
const stats = await req('GET', '/api/admin/print-jobs?all=true&stats=true&limit=5');
if (stats.status === 200) {
  const s = stats.body?.stats;
  if (s) ok(`Stats: queued=${s.queued} sent=${s.sent} printed=${s.printed} failed=${s.failed}`);
  else ok(`Jobs OK, ${(stats.body?.jobs || []).length} jobs`);
} else {
  fail(`Print jobs falló (${stats.status})`);
}

// ── 10. Crear job + retry workflow ────────────────────────────
sep('10. Job lifecycle: CREATE → FAILED → RETRY');
if (printerId) {
  const job = await req('POST', '/api/admin/print-jobs', {
    jobType: 'RECEIPT',
    payload: { test: true },
    printerId,
  });
  if (job.status === 201 && job.body?.job?.id) {
    ok(`Job creado — ${job.body.job.id} (${job.body.job.status})`);
    const markFailed = await req('PATCH', `/api/admin/print-jobs/${job.body.job.id}/status`, { status: 'FAILED' });
    if (markFailed.status === 200) {
      ok(`Job → FAILED`);
      const retry = await req('POST', `/api/admin/print-jobs/${job.body.job.id}/retry`);
      if (retry.status === 200) {
        ok(`Job → QUEUED (retry exitoso)`);
      } else {
        fail(`Retry falló (${retry.status})`, JSON.stringify(retry.body));
      }
    } else {
      fail(`Mark failed falló (${markFailed.status})`);
    }
  } else {
    fail(`Crear job falló (${job.status})`, JSON.stringify(job.body));
  }
}

// ── 11. Soft delete ───────────────────────────────────────────
sep('11. DELETE — Soft delete cocina');
if (printer2Id) {
  const del = await req('DELETE', `/api/admin/printers/${printer2Id}`);
  if (del.status === 200) {
    ok(`Impresora cocina desactivada`);
    const listActive = await req('GET', '/api/admin/printers');
    const active = (listActive.body?.printers || []).map(p => p.name);
    if (!active.includes('Epson TM-T88 Cocina')) {
      ok(`No aparece en lista activa`);
    } else {
      fail(`Aún aparece en lista activa`);
    }
  } else {
    fail(`Delete falló (${del.status})`);
  }
}

// ── 12. Validaciones Zod ──────────────────────────────────────
sep('12. Validaciones');
const bad1 = await req('POST', '/api/admin/printers', { name: '', stationCode: '', connectionType: 'INVALID' });
if (bad1.status === 400) ok(`Body inválido → 400`);
else fail(`Body inválido → ${bad1.status}`);

const bad2 = await req('POST', '/api/admin/printers', { name: 'Test', stationCode: 'CAJA', connectionType: 'TCP', connection: {} });
if (bad2.status === 400) ok(`TCP sin address → 400`);
else fail(`TCP sin address → ${bad2.status}`);

// ── 13. UI pages ──────────────────────────────────────────────
sep('13. UI pages');
const p1 = await fetch(`${BASE}/admin/impresoras`, { headers: { Cookie: cookieStr } });
ok(`/admin/impresoras → ${p1.status}`);
const p2 = await fetch(`${BASE}/admin/impresoras/cola`, { headers: { Cookie: cookieStr } });
ok(`/admin/impresoras/cola → ${p2.status}`);

// ── Cleanup ───────────────────────────────────────────────────
if (printerId) await req('DELETE', `/api/admin/printers/${printerId}`);

// ── Summary ───────────────────────────────────────────────────
console.log(`\n${'═'.repeat(60)}`);
console.log(`  SIMULACIÓN COMPLETA — GESTIÓN DE IMPRESORAS`);
console.log(`  ✅ ${passed} pasos exitosos  |  ❌ ${failed} fallidos`);
console.log('═'.repeat(60));
if (failed === 0) console.log('\n  Todo el ciclo funciona correctamente\n');
else console.log(`\n  ⚠️  ${failed} paso(s) fallaron\n`);
process.exit(failed > 0 ? 1 : 0);
