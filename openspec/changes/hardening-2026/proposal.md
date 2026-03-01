# Propuesta: Hardening 2026 -- Seguridad de Producción, Arquitectura y Revisión de Tests

## Intención

Una auditoría integral de cuatro sub-agentes del codebase de PARK POS (27 Feb 2026) reveló **30 hallazgos verificados** en los dominios de seguridad, arquitectura, infraestructura y testing. Tres de ellos son **CRITICAL** (standalone de Docker faltante, dos endpoints admin sin autenticación), nueve son **HIGH** y dieciocho son **MEDIUM**. Sin atender, estos hallazgos exponen el sistema de producción a acceso no autorizado de datos, pérdida silenciosa de errores, rendimiento degradado y una falsa sensación de calidad proveniente de una suite de tests que cubre menos del 6% de la superficie de API.

**Estado verificado** (re-auditoría 27 Feb 2026):
- El outbox publisher ya utiliza un diseño eficiente por lotes — eliminado del alcance
- `tenant/export` ya tiene autenticación vía `getTenantContext()` — eliminado del alcance
- `inventory/receive` e `inventory/waste` ya tienen `validateInventoryAuth()` — eliminado del alcance
- Conteo de console.log verificado: 75 llamadas en 12 archivos de API (no 221)
- Conteo de Math.random() verificado: 83 llamadas en 18 archivos de test (no 14)
- Conteo de `as any` verificado: 438 en 86 archivos de test (consistente con la estimación previa)

Este cambio resuelve sistemáticamente los 30 hallazgos en cinco fases desplegables de forma independiente, ordenadas de la más urgente a la menos, de modo que las brechas más riesgosas se cierren en horas y el hardening completo se termine en dos semanas.

## Alcance

### Dentro del Alcance

**Fase 1 -- Correcciones CRITICAL (mismo día, < 4 horas)**
1. Agregar `output: 'standalone'` a `next.config.js` para que el build multi-stage de Docker produzca una imagen funcional.
2. Agregar `requireAdminAuth(request)` + `requireAdminPermission(request, 'view_audit')` a `/api/admin/audit-log`.
3. Reemplazar la verificación condicional de `ADMIN_API_KEY` en `/api/admin/cleanup` con `requireAdminAuth(request)` + `requireAdminPermission(request, 'manage_config')`.

**Fase 2 -- Hardening de Seguridad (2-3 días)**
4. Agregar `requirePosAuth` / `requireAdminAuth` a 11 rutas verificadas sin protección: delivery/[id], delivery/checkpoint2, inventory/stock, inventory/stats, orders/[orderId]/lock (GET/POST/DELETE), locations/history/[driverId], push/send, push/subscribe, push/unsubscribe.
5. Eliminar `NEXT_PUBLIC_API_SECRET` del código cliente; mover el secreto a una variable de entorno solo de servidor y actualizar `src/core/sync/client.ts`.
6. Remediar 6 CVEs de npm (axios DoS, rollup path traversal, minimatch ReDoS) vía `npm audit fix` o overrides fijados.
7. Agregar configuración de Dependabot (`.github/dependabot.yml`) y workflow de CodeQL (`.github/workflows/codeql.yml`) al CI.
8. Endurecer CSP: eliminar `unsafe-eval` (reemplazar con enfoque basado en nonce), agregar `Access-Control-Allow-Origin` explícito con allowlist en lugar de wildcard.
9. Extender el rate limiting de 6 rutas a las 264 rutas de API vía middleware compartido.
10. Corregir conexiones SSE ilimitadas en `src/app/api/events/stream/route.ts` -- agregar límite de conexiones por tenant.
11. Eliminar credenciales hardcodeadas en `docker-compose.yml`; usar archivo `.env` con la directiva `env_file:` de docker-compose.

**Fase 3 -- Mejoras de Arquitectura (3-4 días)**
12. ~~Reemplazar N+1 UPDATEs del outbox-publisher~~ **ELIMINADO** -- verificado que ya existe diseño por lotes.
13. Agregar `framer-motion` a `optimizePackageImports` en `next.config.js` (actualmente faltante a pesar de 55 sitios de importación).
14. Habilitar `noImplicitAny: true` y agregar `noUncheckedIndexedAccess: true` en `tsconfig.json`; corregir los errores de tipo resultantes.
15. Eliminar ~4,000 líneas de código muerto identificadas por la auditoría.
16. Reemplazar 75 llamadas a `console.log` en 12 archivos de rutas API (38 solo en login) con llamadas estructuradas a `logger.*`.
17. Adoptar el patrón Result de forma consistente en todas las rutas de API (actualmente inconsistente).
18. Agregar `ErrorBoundary` al layout raíz y a la página del menú.

**Fase 4 -- Modernización de Infraestructura (3-4 días)**
19. Integrar Sentry (SDK real, no mock) para rastreo de errores en producción.
20. Actualizar Node.js de 20 a 22 LTS en CI, Dockerfile y `.nvmrc` (EOL de Node 20 en abril 2026).
21. Agregar validación de variables de entorno en runtime (esquema Zod) al inicio de la aplicación.
22. Agregar trabajo automatizado de respaldo de BD al CI/infraestructura.
23. Actualizar Prisma 6.19 a 7.x y Zod 3.25 a 4.x (evaluar breaking changes primero).
24. Agregar etapa de automatización de despliegue al workflow de CI (actualmente faltante).

**Fase 5 -- Cobertura de Tests (4-5 días)**
25. Escribir tests unitarios para los 9 archivos en `src/core/security/` (1,712 LOC, actualmente 0 tests).
26. Agregar tests de integración de rutas API -- objetivo 50%+ de cobertura de 264 rutas (actualmente <6%).
27. Expandir la suite de tests de integración de 3 a 20+ escenarios.
28. Agregar tests de accesibilidad (axe-core) para 7 páginas de UI sin tests.
29. Reemplazar `Math.random()` con PRNG con semilla en 18 archivos de test (83 llamadas) para ejecuciones determinísticas.
30. Reducir casts `as any` en archivos de test de 438 (86 archivos) a menos de 50.
31. Agregar 7 tests de páginas de UI faltantes.

### Fuera del Alcance

- Adopción de funcionalidades de React 19 (use(), migración de Server Actions) -- diferido a un cambio separado
- Migración completa a Prisma 7 si los breaking changes son extensos -- la Fase 4 evaluará y creará seguimiento si es necesario
- Perfilado y optimización de rendimiento más allá de las correcciones de N+1 y bundle
- Desarrollo de nuevas funcionalidades
- Cambios en el esquema de base de datos
- Migración de framer-motion a una librería alternativa

## Enfoque

Cada fase es un PR independiente que puede fusionarse por separado:

1. **Fase 1** es un hotfix quirúrgico: tres archivos modificados, desplegado inmediatamente. Verificado mediante test de build Docker + test de integración de autenticación.
2. **Fase 2** sigue un enfoque de inventario de rutas: un script enumera todos los archivos `route.ts`, los cruza con el uso de middleware de autenticación y genera una checklist. Cada ruta se parchea y se testea.
3. **Fase 3** utiliza análisis estático (compilador TypeScript, ESLint, scripts personalizados) para identificar y corregir problemas de arquitectura en lote.
4. **Fase 4** realiza las actualizaciones una dependencia a la vez con ejecuciones completas de la suite de tests entre cada una.
5. **Fase 5** es trabajo de escritura de tests: cada módulo de seguridad y grupo de rutas API obtiene su propio archivo de test siguiendo los patrones existentes de Vitest + fast-check.

Todas las fases usan el pipeline de CI existente (lint, typecheck, 3,937 tests, build) como gate de calidad. Ninguna fase se fusiona con alguna regresión en tests.

## Áreas Afectadas

| Área | Impacto | Fase | Descripción |
|------|---------|------|-------------|
| `next.config.js` | Modificado | F1, F3 | Agregar `output: 'standalone'`, agregar `framer-motion` a optimizePackageImports, endurecer CSP |
| `src/app/api/admin/audit-log/route.ts` | Modificado | F1 | Agregar requireAdminAuth + requireAdminPermission |
| `src/app/api/admin/cleanup/route.ts` | Modificado | F1 | Reemplazar ADMIN_API_KEY condicional con requireAdminAuth |
| `src/app/api/delivery/[id]/route.ts` | Modificado | F2 | Agregar requirePosAuth |
| `src/app/api/delivery/checkpoint2/route.ts` | Modificado | F2 | Agregar requirePosAuth |
| `src/app/api/inventory/stock/route.ts` | Modificado | F2 | Agregar requirePosAuth (extraer tenant_id del JWT, no del query param) |
| `src/app/api/inventory/stats/route.ts` | Modificado | F2 | Agregar requirePosAuth (extraer tenant_id del JWT, no del query param) |
| `src/app/api/orders/[orderId]/lock/route.ts` | Modificado | F2 | Agregar requirePosAuth a GET/POST/DELETE |
| `src/app/api/locations/history/[driverId]/route.ts` | Modificado | F2 | Agregar requirePosAuth |
| `src/app/api/push/send/route.ts` | Modificado | F2 | Agregar requirePosAuth |
| `src/app/api/push/subscribe/route.ts` | Modificado | F2 | Agregar requirePosAuth |
| `src/app/api/push/unsubscribe/route.ts` | Modificado | F2 | Agregar requirePosAuth |
| `src/app/api/terminals/range/route.ts` | Modificado | F2 | Agregar requirePosAuth |
| `src/app/api/events/stream/route.ts` | Modificado | F2 | Agregar límite de conexiones, agregar autenticación |
| `src/core/sync/client.ts` | Modificado | F2 | Eliminar uso de NEXT_PUBLIC_API_SECRET |
| `.env.example` | Modificado | F2 | Renombrar NEXT_PUBLIC_API_SECRET a API_SECRET (solo servidor) |
| `.github/dependabot.yml` | Nuevo | F2 | Configuración de Dependabot |
| `.github/workflows/codeql.yml` | Nuevo | F2 | Escaneo de seguridad con CodeQL |
| `docker-compose.yml` | Modificado | F2, F4 | Eliminar credenciales hardcodeadas; agregar trabajo de respaldo |
| ~~`src/core/workers/outbox-publisher.ts`~~ | ~~Modificado~~ | ~~F3~~ | ~~ELIMINADO -- ya tiene diseño por lotes~~ |
| `tsconfig.json` | Modificado | F3 | Habilitar noImplicitAny, agregar noUncheckedIndexedAccess |
| 12 archivos en `src/app/api/` | Modificado | F3 | Reemplazar 75 llamadas a console.log con logger |
| `src/app/layout.tsx` | Modificado | F3 | Agregar ErrorBoundary raíz |
| `src/app/menu/*/page.tsx` | Modificado | F3 | Agregar ErrorBoundary |
| ~40 archivos con código muerto | Eliminado/Modificado | F3 | Eliminar ~4,000 líneas de código muerto |
| `src/lib/sentry.ts` | Nuevo | F4 | Integración real de Sentry |
| `.github/workflows/ci.yml` | Modificado | F4 | Node 22, etapa de despliegue, trabajo de respaldo |
| `Dockerfile` | Modificado | F4 | Imagen base Node 22 |
| `.nvmrc` | Nuevo | F4 | Crear con Node 22 (aún no existe) |
| `src/core/config/env-validation.ts` | Nuevo | F4 | Validación de variables de entorno basada en Zod |
| `package.json` | Modificado | F4 | Actualizaciones de Prisma 7.x, Zod 4.x |
| `src/core/security/__tests__/*.test.ts` (9 archivos) | Nuevo | F5 | Tests para todos los módulos de seguridad |
| `src/app/api/**/__tests__/*.test.ts` (~130 archivos) | Nuevo | F5 | Tests de rutas API |
| `e2e/accessibility/*.spec.ts` (7 archivos) | Nuevo | F5 | Tests de accesibilidad |
| 18 archivos de test con Math.random() (83 llamadas) | Modificado | F5 | Reemplazar con PRNG con semilla |

## Riesgos

| Riesgo | Probabilidad | Fase | Mitigación |
|--------|-------------|------|------------|
| Agregar autenticación a 30+ rutas rompe integraciones existentes de clientes | Media | F2 | Auditar todos los consumidores de API primero; despliegue escalonado con feature flag; test de integración completo antes de fusionar |
| `noImplicitAny: true` causa cientos de errores de TS | Alta | F3 | Ejecutar `tsc --noEmit` para contar errores primero; corregir incrementalmente con anotaciones `// @ts-expect-error` donde sea complejo; PR dedicado por módulo |
| Prisma 7.x tiene breaking changes en el esquema o API de queries | Media | F4 | Evaluar en rama aislada primero; ejecutar suite completa de tests; diferir si los breaking changes son extensos |
| Zod 4.x tiene breaking changes en la API | Media | F4 | Evaluar en rama aislada; si las roturas superan 50 sitios de llamada, diferir |
| Eliminar `unsafe-eval` del CSP rompe código en runtime (eval en dependencias) | Media | F2 | Probar cambios de CSP en staging primero; usar header CSP-Report-Only durante 48 horas antes de aplicar |
| La actualización a Node 22 rompe dependencias nativas | Baja | F4 | Probar en CI primero; mantener Dockerfile con Node 20 como respaldo |
| La eliminación de código muerto remueve accidentalmente código aún en uso | Baja | F3 | Solo eliminar código confirmado como muerto por el compilador TypeScript + grep de imports dinámicos |
| El rate limiting en todas las rutas causa falsos positivos para clientes legítimos de alto tráfico | Media | F2 | Establecer límites iniciales generosos (100 req/min/IP); agregar configuración de override por tenant; monitorear tasa de 429 durante la primera semana |

## Plan de Rollback

### Rollback de Fase 1
- **Revertir commit**: Un solo commit con 3 cambios de archivo. `git revert <commit-sha>` restaura el estado anterior.
- **Docker**: La etiqueta de imagen anterior permanece en el registro; redesplegar apuntando a la etiqueta anterior.
- **Rutas con autenticación**: Revertir elimina la autenticación de audit-log y cleanup; aceptable durante horas mientras se depura, ya que estas rutas ya estaban sin protección.

### Rollback de Fase 2
- **Granularidad por ruta**: La adición de autenticación de cada ruta es independiente. Se pueden revertir archivos individuales si una ruta específica rompe clientes.
- **Renombramiento de secreto**: Revertir el renombramiento en `.env` y restaurar `NEXT_PUBLIC_API_SECRET` si la sincronización del cliente se rompe.
- **Overrides de npm**: Eliminar overrides de `package.json` y ejecutar `npm install` para restaurar el árbol de dependencias anterior.
- **Configuraciones de CI**: Dependabot y CodeQL son aditivos -- simplemente eliminar los archivos de workflow para desactivarlos.

### Rollback de Fase 3
- **TypeScript estricto**: Revertir `tsconfig.json` a `noImplicitAny: false` si surgen demasiados errores de tipo después de fusionar.
- **Eliminación de console.log**: `git revert` del commit de reemplazo por lotes. Sin impacto en runtime de cualquier manera.
- **Optimización de bundle**: Eliminar `framer-motion` de `optimizePackageImports` si causa problemas de SSR.
- **Código muerto**: Revertir completamente el commit de eliminación restaura todo el código borrado.

### Rollback de Fase 4
- **Node 22**: Cambiar `NODE_VERSION` de vuelta a `20` en CI y Dockerfile.
- **Prisma 7**: Fijar `@prisma/client` de vuelta a `^6.19.2` y ejecutar `npx prisma generate`.
- **Sentry**: La integración de Sentry es aditiva; desactivar eliminando `sentry.client.config.ts` y `sentry.server.config.ts`.
- **Validación de entorno**: Eliminar la llamada de validación de `src/app/layout.tsx` o punto de entrada; la aplicación vuelve al acceso de env sin verificar.

### Rollback de Fase 5
- Los archivos de test son puramente aditivos. No se necesita rollback; eliminar los archivos de test si causan problemas en CI.

## Dependencias

- **Fase 1**: Sin dependencias externas. Puede desplegarse inmediatamente.
- **Fase 2**: Requiere inventario de todos los consumidores de API (páginas frontend, app móvil, webhooks) para verificar la propagación del token de autenticación. Requiere `npm audit` para confirmar las correcciones de CVE.
- **Fase 3**: Depende de la Fase 1 (el build de Docker debe funcionar para CI). Requiere ejecutar `tsc --noEmit` para dimensionar el impacto de `noImplicitAny` antes de hacer commit.
- **Fase 4**: Sentry requiere un Sentry DSN (configuración de cuenta). Node 22 requiere verificar que todos los runners de CI lo soporten. Prisma 7 requiere leer la guía de migración.
- **Fase 5**: Depende de la Fase 2 (la autenticación en las rutas debe estar implementada antes de escribir tests de autenticación para ellas). Requiere la dependencia de desarrollo `@axe-core/playwright` para tests de accesibilidad.

## Criterios de Éxito

### Fase 1
- [ ] `docker build .` se completa exitosamente y produce una imagen ejecutable
- [ ] `GET /api/admin/audit-log` retorna 401 sin JWT válido
- [ ] `POST /api/admin/cleanup` retorna 401 sin JWT válido
- [ ] Los 3,937 tests existentes pasan
- [ ] `next build` tiene éxito con `output: 'standalone'`

### Fase 2
- [ ] 0 rutas API accesibles sin autenticación (actualmente 11 verificadas sin protección)
- [ ] Grep de `NEXT_PUBLIC_API_SECRET` retorna 0 coincidencias en `src/`
- [ ] `npm audit --audit-level=high` retorna 0 vulnerabilidades
- [ ] PR de Dependabot creado automáticamente dentro de las 24 horas posteriores a la fusión
- [ ] Escaneo de CodeQL se ejecuta en cada PR y reporta 0 hallazgos críticos
- [ ] El header CSP ya no contiene `unsafe-eval`
- [ ] Middleware de rate limiter activo en las 264 rutas API
- [ ] El endpoint SSE aplica un máximo de 10 conexiones por tenant

### Fase 3
- [ ] ~~Outbox publisher~~ ELIMINADO (ya tiene diseño por lotes)
- [ ] `framer-motion` en `optimizePackageImports` -- el analizador de bundle muestra tamaño de chunk reducido
- [ ] `tsc --noEmit` pasa con `noImplicitAny: true` y `noUncheckedIndexedAccess: true`
- [ ] 0 llamadas a `console.log` en `src/app/api/` (75 → 0, reemplazadas con logger estructurado)
- [ ] Líneas de código muerto reducidas en >= 3,500 líneas
- [ ] Layout raíz y páginas de menú envueltas en ErrorBoundary

### Fase 4
- [ ] Sentry captura y muestra errores en producción (verificar con error de prueba)
- [ ] Node.js 22 en CI, Dockerfile y `.nvmrc`
- [ ] La aplicación falla rápidamente con error claro si faltan variables de entorno requeridas
- [ ] El respaldo automatizado de BD se ejecuta según programación (diario) y existen los artefactos de respaldo
- [ ] Prisma y Zod en las últimas versiones mayores (o aplazamiento documentado con justificación)
- [ ] CI tiene etapa de despliegue que despliega a staging en push a rama `develop`

### Fase 5
- [ ] `src/core/security/` tiene >= 90% de cobertura de líneas (actualmente 0%)
- [ ] Cobertura de tests de rutas API >= 50% de 264 rutas (actualmente < 6%)
- [ ] Conteo de tests de integración >= 20 (actualmente 3)
- [ ] 7 páginas de UI tienen tests de accesibilidad con 0 violaciones críticas de axe
- [ ] 0 llamadas a `Math.random()` en archivos de test (todas reemplazadas con PRNG con semilla)
- [ ] `as any` en archivos de test reducido de 439 a < 50
- [ ] Conteo total de tests >= 4,200 (actualmente 3,937)

### General
- [ ] Las 5 fases fusionadas a main
- [ ] Cero regresiones de tests en todas las fases
- [ ] `npm run build` tiene éxito después de todas las fases
- [ ] La imagen Docker se construye y ejecuta correctamente
- [ ] Despliegue a producción verificado con smoke tests
