/**
 * Script simple para generar READMEs en todos los specs
 */

import { writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const specs = [
  { name: 'admin-panel', phase: 'P0', status: '⬜ Planificado', desc: 'Panel de administración básico', type: 'Features - Admin Panel', tags: ['admin', 'crud', 'ui'], deps: [], invDeps: ['admin-panel-crud', 'admin-panel-location-fix'] },
  { name: 'admin-panel-crud', phase: 'P0', status: '✅ Completado', desc: 'CRUD completo (Employees, Products, Drivers, Promotions)', type: 'Features - Admin Panel', tags: ['admin', 'crud'], deps: ['admin-panel', 'security-multi-factor'], invDeps: ['products-p1-improvements'] },
  { name: 'admin-panel-location-fix', phase: 'P0', status: '🟡 En Progreso', desc: 'Fix de ubicaciones y estaciones KDS', type: 'Features - Admin Panel', tags: ['admin', 'kds'], deps: ['admin-panel', 'schema-completeness'], invDeps: [] },
  { name: 'admin-panel-ux-improvements', phase: 'P3', status: '⬜ Planificado', desc: 'Mejoras UX del admin panel', type: 'Features - Admin Panel', tags: ['admin', 'ux'], deps: ['admin-panel-crud'], invDeps: [] },
  { name: 'auditoria-documentacion-profesional', phase: 'P1', status: '🟡 En Progreso', desc: 'Auditoría y organización de documentación', type: 'Operations', tags: ['documentation', 'audit'], deps: [], invDeps: [] },
  { name: 'branded-types-migration', phase: 'P1', status: '⬜ Planificado', desc: 'Migración a tipos seguros (Centavos, OrderId)', type: 'Core System', tags: ['types', 'safety'], deps: [], invDeps: ['admin-panel-crud'] },
  { name: 'conflict-resolution', phase: 'P1', status: '⬜ Planificado', desc: 'Resolución de conflictos multi-terminal', type: 'Core System', tags: ['event-sourcing', 'crdt'], deps: ['event-sourcing-critical-fixes'], invDeps: ['saga-pattern'] },
  { name: 'database-integrity', phase: 'P3', status: '⬜ Planificado', desc: 'Integridad de base de datos', type: 'Core System', tags: ['database', 'integrity'], deps: ['event-sourcing-critical-fixes'], invDeps: [] },
  { name: 'delivery-2026-modernization', phase: 'P2', status: '✅ Completado', desc: 'Modernización del módulo de delivery', type: 'Features - Delivery', tags: ['delivery', 'modernization'], deps: ['delivery-module', 'multi-tenant-improvements'], invDeps: [] },
  { name: 'delivery-module', phase: 'P2', status: '⬜ Planificado', desc: 'Módulo de delivery completo', type: 'Features - Delivery', tags: ['delivery', 'tracking'], deps: [], invDeps: ['delivery-2026-modernization'] },
  { name: 'enterprise-upgrade', phase: 'P3', status: '⬜ Planificado', desc: 'Upgrade enterprise', type: 'Enterprise', tags: ['enterprise', 'scalability'], deps: ['multi-tenant-improvements'], invDeps: [] },
  { name: 'event-schema-versioning', phase: 'P1', status: '⬜ Planificado', desc: 'Versionado de schemas de eventos', type: 'Core System', tags: ['event-sourcing', 'versioning'], deps: ['event-sourcing-critical-fixes'], invDeps: [] },
  { name: 'event-sourcing-critical-fixes', phase: 'P0', status: '⬜ Planificado', desc: 'Fixes críticos del Event Sourcing', type: 'Core System', tags: ['event-sourcing', 'critical'], deps: [], invDeps: ['conflict-resolution', 'event-schema-versioning', 'saga-pattern'] },
  { name: 'flujos-faltantes', phase: 'P3', status: '⬜ Planificado', desc: 'Flujos pendientes (propinas, reservas)', type: 'Features - POS Core', tags: ['pos', 'features'], deps: ['waiter-module'], invDeps: [] },
  { name: 'frontend-cleanup', phase: 'P3', status: '⬜ Planificado', desc: 'Limpieza de frontend', type: 'Frontend & UX', tags: ['frontend', 'cleanup'], deps: [], invDeps: [] },
  { name: 'inventory-ui', phase: 'P2', status: '⬜ Planificado', desc: 'UI de gestión de inventario', type: 'Features - Inventory', tags: ['inventory', 'ui'], deps: [], invDeps: ['products-p1-improvements'] },
  { name: 'kds-order-submission-fix', phase: 'P0', status: '✅ Completado', desc: 'Fix de envío de órdenes a KDS', type: 'Features - POS Core', tags: ['kds', 'orders'], deps: [], invDeps: [] },
  { name: 'mobile-responsive', phase: 'P3', status: '⬜ Planificado', desc: 'Responsive mobile', type: 'Frontend & UX', tags: ['mobile', 'responsive'], deps: [], invDeps: [] },
  { name: 'multi-tenant-improvements', phase: 'P2', status: '✅ Completado', desc: 'RLS, provisioning, quotas multi-tenant', type: 'Security', tags: ['multi-tenant', 'rls'], deps: ['security-multi-factor', 'system-consolidation-phase1'], invDeps: ['delivery-2026-modernization', 'enterprise-upgrade'] },
  { name: 'performance-optimization-vercel-best-practices', phase: 'P2', status: '✅ Completado', desc: 'Best practices de Vercel', type: 'Performance', tags: ['performance', 'vercel'], deps: [], invDeps: ['react-cache-optimization'] },
  { name: 'playwright-e2e-fixes-feb-2026', phase: 'P1', status: '⬜ Planificado', desc: 'Fixes de tests E2E febrero 2026', type: 'Testing', tags: ['testing', 'e2e'], deps: ['playwright-e2e-optimization'], invDeps: [] },
  { name: 'playwright-e2e-improvements', phase: 'P1', status: '⬜ Planificado', desc: 'Mejoras de tests E2E', type: 'Testing', tags: ['testing', 'e2e'], deps: [], invDeps: ['playwright-e2e-optimization'] },
  { name: 'playwright-e2e-optimization', phase: 'P1', status: '✅ Completado', desc: 'Optimización de tests E2E (POMs, 56% más rápido)', type: 'Testing', tags: ['testing', 'e2e', 'optimization'], deps: ['playwright-e2e-improvements'], invDeps: ['playwright-e2e-fixes-feb-2026'] },
  { name: 'premium-dashboard', phase: 'P2', status: '⬜ Planificado', desc: 'Dashboard premium con analytics', type: 'Features - Analytics', tags: ['analytics', 'dashboard'], deps: ['system-consolidation-phase1', 'react-cache-optimization'], invDeps: [] },
  { name: 'products-p1-improvements', phase: 'P2', status: '🟡 En Progreso', desc: 'Mejoras de productos (CSV, bulk operations)', type: 'Features - Inventory', tags: ['inventory', 'products', 'csv'], deps: ['admin-panel-crud', 'inventory-ui'], invDeps: [] },
  { name: 'property-based-testing-expansion', phase: 'P2', status: '✅ Completado', desc: 'Expansión de property-based testing', type: 'Testing', tags: ['testing', 'pbt'], deps: [], invDeps: [] },
  { name: 'react-cache-optimization', phase: 'P2', status: '✅ Completado', desc: 'Optimización de caché React con SWR', type: 'Performance', tags: ['performance', 'cache', 'swr'], deps: ['performance-optimization-vercel-best-practices'], invDeps: ['premium-dashboard'] },
  { name: 'realtime-eventbus-supabase', phase: 'P2', status: '⬜ Planificado', desc: 'EventBus en tiempo real con Supabase', type: 'Operations', tags: ['operations', 'realtime'], deps: ['event-sourcing-critical-fixes', 'system-consolidation-phase1'], invDeps: [] },
  { name: 'saga-pattern', phase: 'P2', status: '🟡 En Progreso', desc: 'Patrón Saga con compensating transactions', type: 'Core System', tags: ['event-sourcing', 'saga'], deps: ['event-sourcing-critical-fixes', 'conflict-resolution'], invDeps: [] },
  { name: 'schema-completeness', phase: 'P0', status: '⬜ Planificado', desc: 'Completitud de schemas Prisma', type: 'Core System', tags: ['database', 'prisma'], deps: [], invDeps: ['admin-panel-location-fix'] },
  { name: 'security-multi-factor', phase: 'P1', status: '✅ Completado', desc: 'Autenticación JWT con PIN y lockout', type: 'Security', tags: ['security', 'jwt', 'authentication'], deps: [], invDeps: ['admin-panel-crud', 'multi-tenant-improvements'] },
  { name: 'system-consolidation-phase1', phase: 'P1', status: '✅ Completado', desc: 'Consolidación del sistema (observabilidad, health checks)', type: 'Operations', tags: ['operations', 'monitoring'], deps: [], invDeps: ['multi-tenant-improvements', 'premium-dashboard', 'realtime-eventbus-supabase'] },
  { name: 'terminal-architecture-v2', phase: 'P3', status: '⬜ Planificado', desc: 'Arquitectura v2 de terminales', type: 'Core System', tags: ['architecture', 'terminals'], deps: ['conflict-resolution'], invDeps: [] },
  { name: 'waiter-module', phase: 'P0', status: '⬜ Planificado', desc: 'Módulo de mesero (15 terminales)', type: 'Features - POS Core', tags: ['pos', 'waiter'], deps: [], invDeps: ['flujos-faltantes'] }
];

function generateReadme(spec) {
  const title = spec.name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  
  const depsSection = spec.deps.length > 0
    ? spec.deps.map(d => `- [\`${d}\`](../${d}/)`).join('\n')
    : '_Ninguna_';
  
  const invDepsSection = spec.invDeps.length > 0
    ? spec.invDeps.map(d => `- [\`${d}\`](../${d}/)`).join('\n')
    : '_Ninguna_';
  
  return `# ${title}

> ${spec.desc}

---

## 📊 Información General

| Atributo | Valor |
|----------|-------|
| **Fase** | ${spec.phase} |
| **Estado** | ${spec.status} |
| **Tipo** | ${spec.type} |

---

## 🏷️ Tags

\`\`\`
${spec.tags.join(', ')}
\`\`\`

---

## 🔗 Dependencias

### Depende de:
${depsSection}

### Requerido por:
${invDepsSection}

---

## 📚 Enlaces Rápidos

- [Índice Completo](../../../docs/INDICE_COMPLETO.md)
- [Roadmap 2026](../../../docs/ROADMAP_CONSOLIDADO_2026.md)
- [Master Steering](../../steering/MASTER.md)

---

**Última actualización:** ${new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}  
**Generado automáticamente**
`;
}

let created = 0;
let skipped = 0;

console.log('🚀 Generando READMEs para todos los specs...\n');

for (const spec of specs) {
  const specDir = join(process.cwd(), '.kiro', 'specs', spec.name);
  const readmePath = join(specDir, 'README.md');
  
  if (!existsSync(specDir)) {
    console.log(`⚠️  Directorio no existe: ${spec.name}`);
    skipped++;
    continue;
  }
  
  const content = generateReadme(spec);
  writeFileSync(readmePath, content, 'utf-8');
  console.log(`✅ Creado: ${spec.name}/README.md`);
  created++;
}

console.log(`\n📊 Resumen:`);
console.log(`   ✅ Creados: ${created}`);
console.log(`   ⚠️  Omitidos: ${skipped}`);
console.log(`   📁 Total: ${specs.length} specs`);
