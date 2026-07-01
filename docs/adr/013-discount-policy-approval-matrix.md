# ADR-013: El descuento es una POLÍTICA del sistema (approval matrix), no un permiso por rol

## Estado
Aceptado

## Fecha
2026-07-01

## Decisores
Belico (arquitecto)

## Contexto

La auditoría 2026-06-30 encontró que el ingest no validaba descuentos y que `CHECK_DISCOUNT_SET`
ni siquiera estaba en la matriz de permisos (los descuentos se perdían al sincronizar). El primer
fix fue un **parche**: agregar `CHECK_DISCOUNT_SET` como flag booleano a la lista de eventos de
cada rol de caja.

Belico señaló, con razón, que eso es una **inconsistencia de diseño**: el descuento no es un
permiso binario "este rol puede / no puede", es una **operación de dinero con política** — con
límites, umbrales de aprobación y auditoría. Investigación de cómo lo resuelven los POS serios
(Toast, Square, Lightspeed) y los sistemas de autorización modernos:

- **PBAC (Policy-Based Access Control)**: los roles son INPUTS, pero la lógica vive en POLÍTICAS
  gobernadas como objetos de primera clase — aplicado a operaciones de alto riesgo (descuentos, comps).
- **Approval matrix por umbral** (Green/Yellow/Red): descuentos bajos auto-aprobados, medios con
  aprobación de manager, altos con dueño/finanzas.
- **MVP (Minimum Viable Price)**: piso que impide que el descuento baje el precio bajo un umbral
  (aquí, como mínimo, `discount <= subtotal` para no producir total negativo).
- **Razón + auditoría**: quién, cuánto, por qué, aprobado por quién.

## Decisión

El **rol de caja EMITE** `CHECK_DISCOUNT_SET` (queda en la matriz de permisos: OWNER/ADMIN/MANAGER/
SUPERVISOR/CASHIER, NO WAITER), pero la **POLÍTICA por umbral de %** decide la autorización, en
`validateCheckDiscount` (server-side, frontera de confianza):

```
discount% <= DISCOUNT_AUTO_APPROVE_MAX_PERCENT   -> autonomía (sin aprobación)
AUTO < discount% <= DISCOUNT_MANAGER_MAX_PERCENT -> requiere approved_by de MANAGER+ (mismo
                                                    mecanismo approved_by que usa el VOID)
discount% > DISCOUNT_MANAGER_MAX_PERCENT          -> rechazo (DISCOUNT_EXCEEDS_MAX)
discount > subtotal (MVP)                         -> rechazo (DISCOUNT_EXCEEDS_SUBTOTAL, total negativo)
discount < 0                                       -> rechazo (DISCOUNT_NEGATIVE)
```

Umbrales configurables en `src/core/constants/limits.ts` (a futuro, override por `tenant_settings`):
`DISCOUNT_AUTO_APPROVE_MAX_PERCENT = 15`, `DISCOUNT_MANAGER_MAX_PERCENT = 50`. **Son política de
negocio — ajustables sin tocar la lógica ni la matriz de roles.**

## Consecuencias

- ✅ El descuento deja de ser un flag por rol y pasa a ser **política del sistema** — escalable
  (agregar un rol no toca la lógica) y alineado con Toast/Square/Lightspeed.
- ✅ Reutiliza el mecanismo `approved_by` existente (el mismo del VOID) — no inventa infraestructura.
- ✅ Defensa server-side: un evento offline/manipulado con descuento excesivo se rechaza en el ingest.
- ✅ Test 10/10 (los 3 tiers + MVP + negativo), 149/149 validación sin regresión.
- 🔭 A futuro: mover los umbrales a `tenant_settings` (política por tenant); tier de OWNER para
  descuentos > manager_max; razón obligatoria + registro de auditoría del aprobador.

## Referencias
- Auditoría fresca 2026-06-30 (hueco #1 de dinero). ADR-012 (validación server-side de VOID).
- PBAC / policy-based authorization; approval matrix (Green/Yellow/Red); MVP (Minimum Viable Price).
- Toast / Square / Lightspeed: comp/void/discount con manager approval.
