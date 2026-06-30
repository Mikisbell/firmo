# Auditoría fresca de seguridad/calidad — 2026-06-29

Barrido del código ACTUAL (no la auditoría jun-10, que ya estaba resuelta), en 4
dimensiones con subagentes + **verificación manual de cada hallazgo** (el subagente
encuentra pistas; se confirma cuáles son reales antes de tocar nada).

## Resultado: de ~25 hallazgos brutos → 3 reales + backdoors extra

El sistema está **sólido**. La mayoría de los hallazgos brutos fueron falsos positivos
(ver abajo). Los reales son de severidad media, sin críticos explotables en uso normal.

## Confirmados y CORREGIDOS

### 1. `ORDER_ITEM_VOIDED` no validaba estado del item → descuadre de inventario
- **Detalle y fix**: ver [ADR-012](../adr/012-server-side-item-void-validation.md). Commit `5c0a9ae`.
- El ingest ahora rechaza anular items en estado terminal (DONE/VOIDED) leyendo el status
  vivo de la proyección. Test 4/4.

### 2. `GET /api/data-sync/master` sin autenticación → enumeración cross-tenant
- **Era**: tomaba `tenant_id` de query/header **sin auth** → con solo conocer un UUID se
  leían mesas, catálogo y settings de cualquier tenant (`master/route.ts`).
- **Fix**: `requirePosAuth(request)` + el tenant se deriva del **JWT**, nunca del query. El
  POS llama esto autenticado (cookie `auth_token` same-origin), así que **no rompe** el
  bootstrap. Severidad: MEDIA (requería conocer el UUID; datos no críticos pero no públicos).

### 3. Dev backdoors de auto-login gateados solo por `NODE_ENV` (frágil)
Un bypass de autenticación dependiente solo de `NODE_ENV === 'development'` es peligroso:
un deploy con `NODE_ENV` mal configurado lo activaría en producción. Encontrados **3
server-side** (la frontera de confianza real), todos cerrados con **doble barrera**
(`NODE_ENV=development` **Y** opt-in explícito `ALLOW_DEV_AUTOLOGIN=true`):

| Ubicación | Gravedad | Nota |
|---|---|---|
| `core/middleware/admin-auth.ts:48` | 🔴 **RAÍZ** | base de `requirePosAuth` y todo `/admin`; **elevaba a OWNER** (acceso total) |
| `core/auth/auth.service.ts:561` | 🟠 | `getSessionFromRequest`, usado por varios endpoints |
| `app/api/auth/session/route.ts:42` | 🟡 | endpoint de sesión |

Dos bypasses **client-side** (`components/auth/AuthProvider.tsx:73`,
`components/auth/RoleGuard.tsx:33`) quedan documentados como **cosméticos**: el servidor es
la frontera de confianza y ahora valida, así que un bypass en el front **no concede acceso
real** (el server rechaza). No se gatean para no exigir otra env var en el dev local.

> **DEV**: para mantener el auto-login en desarrollo, agregar a `.env.local`:
> `ALLOW_DEV_AUTOLOGIN=true`. Sin esa variable, en dev se loguea con PIN; en prod el backdoor
> nunca existe.

## Falsos positivos descartados (con evidencia)

| Hallazgo del subagente | Por qué NO es real |
|---|---|
| "El retry del ingest duplica líneas/deducciones/contadores" (5 hallazgos) | El retry envuelve la **transacción completa** con rollback (RepeatableRead, `serialization-retry.ts`). Ante 40001 Postgres deshace todo y reintenta limpio. No duplica. |
| IDOR `terminals/activate` / `terminals/validate` | **Pre-auth por diseño** (el terminal no tiene JWT aún); la defensa es el código de activación + fingerprint de 8+ señales. |
| `tenant_id` expuesto en `/admin/employees` | Es el **mismo tenant** del admin que consulta. No hay leak cross-tenant. |
| SQL injection en `$queryRawUnsafe` | Todos **parametrizados** (`$1, $2`), no interpolación de string. |
| Descuento/propina → total negativo (reducers) | Los reducers **no validan por diseño** (retornan warnings, ADR del event-sourcing); además el front y el ingest acotan. Sin caso explotable confirmado. |

## Método
4 dimensiones en paralelo (auth/tenant, dinero, concurrencia, validación/inyección) →
verificación manual de cada CRÍTICO/ALTO → solo se tocó lo confirmado real. El barrido
exhaustivo de `NODE_ENV` (post-hoc) encontró los backdoors `admin-auth` y `auth.service`
que la dimensión inicial no había listado.
