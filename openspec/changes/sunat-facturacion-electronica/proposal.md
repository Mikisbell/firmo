# Propuesta: SUNAT Facturacion Electronica — Integracion Directa via nodefact (Zero Cost)

## Intencion

El sistema de facturacion de PARK POS esta construido al ~70% — el `invoice.service.ts` (1207 lineas) es completo, el `NubefactAdapter` esta escrito y testeado, los modelos de base de datos existen (`invoices`, `invoice_queue`, `invoice_cdr`, `credit_notes`, `sunat_daily_summary`), la UI de admin esta montada, y el flujo de emision/anulacion/notas de credito funciona end-to-end en modo mock. Pero **ninguna factura llega realmente a SUNAT**. Los 4 gaps criticos son:

1. **G1 — No hay Queue Worker**: `invoice.service.ts` crea items en `invoice_queue` (3 call-sites: emision, anulacion, nota de credito), pero **ningun proceso los consume**. Los items se quedan en estado `PENDING` para siempre.
2. **G6 — No hay Configuracion SUNAT por Tenant**: `SunatClient` lee credenciales de variables de entorno globales (`SUNAT_RUC`, `SUNAT_USERNAME`, etc.). En un sistema multi-tenant, cada polleria tiene su propio RUC y certificado digital. No hay campos en `tenant_settings` para almacenar esta configuracion.
3. **G7 — No hay Resumen Diario de Boletas**: SUNAT requiere que todas las boletas emitidas en un dia se consoliden en un "Resumen Diario" y se envien antes de las 11:59 PM del dia siguiente. El modelo `sunat_daily_summary` existe pero no tiene logica de servicio ni cron job.
4. **G8 — Contingencia No Persistente**: `ContingencyManager` almacena facturas pendientes en un array en memoria (`this.pendingInvoices`). Al reiniciar el servidor (deploy, crash, auto-scale), se pierden. En Vercel Serverless esto ocurre constantemente.

**Sin resolver estos 4 gaps**, la facturacion electronica no puede ir a produccion. Cada tenant que vende pollos sin boleta electronica esta en infraccion con SUNAT.

Este cambio conecta las piezas existentes: implementa un `SunatDirectAdapter` usando **nodefact** (paquete npm MIT, 100% gratuito) para el queue worker, agrega configuracion per-tenant con credenciales SOL, implementa el Resumen Diario, y persiste la contingencia en base de datos. El enfoque es **SUNAT DIRECTO** via el SEE del Contribuyente — nodefact maneja la generacion UBL 2.1 XML, firma digital (xml-crypto), comunicacion SOAP con SUNAT, parsing del CDR, generacion de PDF y codigos QR. PARK no necesita intermediarios de pago. **Costo total: S/ 0.00.**

## Alcance

### Dentro del Alcance

**Fase 1 — Queue Worker + Integracion nodefact (3-4 dias)**
1. Instalar dependencia `nodefact` (MIT). Dependencias transitivas: `xml-crypto`, `soap`, `xml2js`, `handlebars`, `pdfkit`, `qrcode`.
2. Crear `src/core/integrations/sunat/sunat-direct-adapter.ts` — adapter que usa nodefact para: generar UBL 2.1 XML, firmar digitalmente, enviar via SOAP a SUNAT, parsear CDR de respuesta, generar PDF y QR.
3. Crear `src/core/jobs/sunat-queue-worker.ts` — servicio que consume items de `invoice_queue`, instancia `SunatDirectAdapter` con credenciales SOL del tenant, envia a SUNAT, y actualiza el estado (CDR, hash, PDF/XML).
4. Crear `src/app/api/cron/sunat-queue/route.ts` — endpoint cron (Vercel Cron) que invoca al queue worker. Schedule: cada 2 minutos.
5. Modificar `src/core/integrations/sunat/client.ts` — refactorizar `realSendInvoice()` para delegar al `SunatDirectAdapter` (default) o `NubefactAdapter` (fallback) segun configuracion del tenant. Cargar credenciales del tenant, no de env vars globales.
6. Modificar `src/core/integrations/sunat/provider-config.ts` — actualizar `SunatProvider` type a `'mock' | 'sunat-direct' | 'nubefact'`, con `sunat-direct` como default en produccion. Agregar config de certificado y credenciales SOL.
7. Agregar logica de retry con backoff exponencial en el queue worker (max 3 intentos, el schema ya soporta `attempts`/`max_attempts`/`last_error`).
8. Emitir eventos `INVOICE_SENT_TO_SUNAT` y `INVOICE_SUNAT_ACCEPTED`/`INVOICE_SUNAT_REJECTED` al procesar cada item.

**Fase 2 — Configuracion SUNAT por Tenant (2-3 dias)**
9. Agregar columnas a `tenant_settings`: `sunat_provider` (enum: `SUNAT_DIRECT`|`NUBEFACT`|`NONE`), `sunat_mode` (enum: `PRODUCTION`|`BETA`|`DISABLED`), `sunat_sol_user` (usuario SOL), `sunat_sol_password` (encrypted), `sunat_certificate_pem` (certificado digital, encrypted), `sunat_private_key_pem` (clave privada, encrypted), `nubefact_token` (encrypted, para tenants que prefieran OSE), `nubefact_url`.
10. Crear migracion Prisma: `ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS ...` para cada campo nuevo.
11. Crear API endpoint `GET/PUT /api/admin/facturacion/configuracion` — admin puede ver y configurar las credenciales SUNAT de su tenant (SOL user/password, upload de certificado .pem, seleccion de provider).
12. Agregar seccion "Configuracion SUNAT" en la pagina admin `/admin/facturacion` con formulario para: seleccionar proveedor (SUNAT Directo / Nubefact / Deshabilitado), ingresar credenciales SOL, subir certificado digital PEM, y validacion de conexion ("Probar conexion" que envia comprobante de prueba al entorno beta de SUNAT).
13. El queue worker debe verificar `sunat_mode !== 'DISABLED'` antes de procesar items de un tenant. Si esta deshabilitado, los items se quedan en cola sin procesar.

**Fase 3 — Resumen Diario de Boletas (2-3 dias)**
14. Crear `src/core/jobs/sunat-daily-summary.ts` — servicio que:
    - Consulta todas las boletas emitidas y aceptadas del dia anterior para cada tenant activo.
    - Genera el "Resumen Diario" agrupando por serie.
    - Envia via `SunatDirectAdapter` usando nodefact (soporte nativo para Resumen Diario / Comunicacion de Baja).
    - Actualiza `sunat_daily_summary` con el ticket_number y estado.
15. Crear `src/app/api/cron/sunat-daily-summary/route.ts` — cron job diario a las 6:00 AM (hora Lima, UTC-5 = 11:00 AM UTC). Procesa resumenes del dia anterior.
16. Agregar en la UI admin `/admin/facturacion` una tabla de "Resumenes Diarios" mostrando fecha, cantidad de boletas, monto total, estado SUNAT.

**Fase 4 — Persistencia de Contingencia (1-2 dias)**
17. Crear modelo `sunat_contingency` en Prisma schema: `id`, `tenant_id`, `active`, `reason`, `activated_at`, `activated_by`, `deactivated_at`, `pending_count`.
18. Crear modelo `sunat_contingency_invoices` en Prisma schema: `id`, `contingency_id`, `invoice_id`, `tenant_id`, `series`, `number`, `issued_at`, `reconcile_by`, `reconciled_at`.
19. Refactorizar `ContingencyManager` para persistir estado en DB en lugar de memoria. Metodos read/write van a Prisma.
20. Agregar seccion "Modo Contingencia" en UI admin `/admin/facturacion`: estado actual, razon, facturas pendientes de reconciliar, alertas de deadline.

### Fuera del Alcance

- **Nota de Debito**: Solo Factura, Boleta, Nota de Credito, Anulacion y Resumen Diario. Nota de Debito es un documento raro en pollerias (nodefact lo soporta, se puede agregar en el futuro).
- **Facturacion desde app movil/offline**: La facturacion electronica requiere conexion a internet (SUNAT). Offline emite ticket pre-impreso y reconcilia al volver online (ya cubierto por contingencia).
- **Reenvio masivo**: Si un tenant tiene 500 facturas atascadas, el worker las procesa en orden. No hay UI de "reenviar todo" por ahora.
- **Guia de Remision Electronica**: Documento de transporte, requerido para delivery inter-provincial. Diferido (nodefact no lo soporta aun).
- **Multi-certificado por tenant**: Un solo certificado digital activo por tenant. Rotacion manual via admin UI.

## Enfoque

### Estrategia: SUNAT Directo via nodefact (100% Gratuito)

La decision clave es **conectar directamente con SUNAT** usando el paquete npm `nodefact` (MIT, gratuito), eliminando la dependencia de un OSE de pago como Nubefact. El flujo es:

```
PARK POS ----> nodefact (UBL 2.1 XML + firma digital + SOAP) ----> SUNAT directamente
                                    |
                                    v
                           CDR response + PDF + QR
```

**nodefact** maneja internamente:
- Generacion de XML UBL 2.1 (formato SUNAT obligatorio)
- Firma digital con xml-crypto (XAdES-BES usando el certificado del contribuyente)
- Comunicacion SOAP con los web services de SUNAT
- Parsing del CDR (Constancia de Recepcion) de respuesta
- Generacion de PDF del comprobante
- Generacion de codigo QR para boletas/facturas

Documentos soportados por nodefact:
- Factura (01)
- Boleta de Venta (03)
- Nota de Credito (07)
- Nota de Debito (08)
- Resumen Diario
- Comunicacion de Baja

### Costo Total: S/ 0.00

| Concepto | Costo |
|----------|-------|
| Certificado digital | GRATIS (obtenido desde portal SOL de SUNAT) |
| nodefact npm package | GRATIS (licencia MIT) |
| API SUNAT (SEE del Contribuyente) | GRATIS (servicio gubernamental) |
| **Total mensual por tenant** | **S/ 0.00** |

Comparacion con enfoque anterior (Nubefact OSE):
- Nubefact cobraba ~S/ 0.10 por documento emitido
- Una polleria con 150 boletas/dia = ~S/ 450/mes por tenant
- Con 10 tenants = ~S/ 4,500/mes de ahorro

### Patron de Procesamiento

El queue worker sigue el patron **poll-based cron** ya establecido en el proyecto (`/api/cron/maintenance`):

1. Vercel Cron invoca `GET /api/cron/sunat-queue` cada 2 minutos.
2. El worker consulta `invoice_queue WHERE status = 'PENDING' AND scheduled_at <= NOW() ORDER BY priority ASC, scheduled_at ASC LIMIT 10`.
3. Para cada item: cargar credenciales SOL + certificado del tenant -> instanciar nodefact -> generar XML + firmar -> enviar SOAP a SUNAT -> parsear CDR -> almacenar respuesta -> actualizar status.
4. Si falla: incrementar `attempts`, guardar `last_error`, programar retry con backoff (`scheduled_at = NOW() + attempts * 5 minutes`).
5. Si `attempts >= max_attempts`: marcar como `FAILED`, emitir alerta.

### Configuracion Per-Tenant

Cada tenant necesita configurar en su admin:

| Campo | Descripcion | Obtencion |
|-------|-------------|-----------|
| `sunat_sol_user` | Usuario SOL (ej: `MODDATOS`) | Portal SOL de SUNAT |
| `sunat_sol_password` | Clave SOL | Portal SOL de SUNAT |
| `sunat_certificate_pem` | Certificado digital X.509 en formato PEM | Descargar desde portal SOL > Certificado Digital |
| `sunat_private_key_pem` | Clave privada RSA en formato PEM | Generada junto con el certificado |
| `sunat_mode` | `PRODUCTION` / `BETA` / `DISABLED` | Admin decide |
| `sunat_provider` | `SUNAT_DIRECT` (default) / `NUBEFACT` (fallback) | Admin decide |

Las credenciales sensibles (`sunat_sol_password`, `sunat_certificate_pem`, `sunat_private_key_pem`) se almacenan **encriptadas** en la base de datos.

### Nubefact como Provider Alternativo

El `NubefactAdapter` existente se **mantiene como alternativa**. La arquitectura `provider-config.ts` ya soporta multiples proveedores. Un tenant puede elegir:

- **`SUNAT_DIRECT`** (default): Usa nodefact, costo S/ 0.00, requiere certificado SOL.
- **`NUBEFACT`**: Usa NubefactAdapter, costo ~S/ 0.10/doc, requiere token Nubefact. Util para tenants que ya tienen contrato con Nubefact o que prefieren no gestionar certificados.

El queue worker detecta `sunat_provider` del tenant y usa el adapter correspondiente.

### Fases como PRs Independientes

Cada fase es un PR desplegable separadamente:
- **Fase 1** puede mergearse primero: los tenants sin credenciales SOL configuradas simplemente no procesan su cola. El worker es un no-op para tenants sin credenciales.
- **Fase 2** habilita la configuracion: al guardar credenciales SOL y certificado, las facturas existentes en cola empiezan a procesarse automaticamente.
- **Fase 3** es independiente pero requiere Fase 1 (el adapter debe estar wired). nodefact soporta Resumen Diario nativamente.
- **Fase 4** es independiente de las demas, modifica solo el subsistema de contingencia.

## Areas Afectadas

| Area | Impacto | Fase | Descripcion |
|------|---------|------|-------------|
| `package.json` | Modificado | F1 | Agregar dependencia `nodefact` |
| `src/core/integrations/sunat/sunat-direct-adapter.ts` | Nuevo | F1 | Adapter que usa nodefact para XML, firma, SOAP, CDR, PDF, QR |
| `src/core/jobs/sunat-queue-worker.ts` | Nuevo | F1 | Worker que consume invoice_queue, despacha a SunatDirectAdapter o NubefactAdapter segun tenant config |
| `src/app/api/cron/sunat-queue/route.ts` | Nuevo | F1 | Endpoint cron cada 2 minutos, protegido por CRON_SECRET |
| `src/core/integrations/sunat/client.ts` | Modificado | F1 | Refactorizar `realSendInvoice()` para delegar a SunatDirectAdapter (default) o NubefactAdapter (fallback) |
| `src/core/integrations/sunat/provider-config.ts` | Modificado | F1 | Actualizar types: `SunatProvider = 'mock' \| 'sunat-direct' \| 'nubefact'`, agregar config SOL/certificado |
| `src/core/integrations/sunat/nubefact-adapter.ts` | Mantenido | F1 | Sin cambios — se mantiene como provider alternativo |
| `vercel.json` | Modificado | F1, F3 | Agregar crons: sunat-queue (2min), sunat-daily-summary (diario) |
| `prisma/schema.prisma` | Modificado | F2, F4 | Agregar columnas SUNAT/SOL a tenant_settings; agregar modelos contingencia |
| `src/app/api/admin/facturacion/configuracion/route.ts` | Nuevo | F2 | GET/PUT configuracion SUNAT del tenant (SOL creds + cert + provider) |
| `src/app/admin/facturacion/page.tsx` | Modificado | F2, F3, F4 | Agregar secciones: config SUNAT, resumenes diarios, contingencia |
| `src/core/jobs/sunat-daily-summary.ts` | Nuevo | F3 | Servicio de generacion y envio de Resumen Diario via nodefact |
| `src/app/api/cron/sunat-daily-summary/route.ts` | Nuevo | F3 | Endpoint cron diario 6AM Lima |
| `src/core/integrations/sunat/contingency.ts` | Modificado | F4 | Refactorizar de in-memory a persistencia DB |
| `src/core/domain/events.ts` | Modificado | F1 | Agregar event types: INVOICE_SENT_TO_SUNAT, INVOICE_SUNAT_ACCEPTED, INVOICE_SUNAT_REJECTED, DAILY_SUMMARY_SENT |
| `src/core/services/invoice.service.ts` | Modificado | F1, F4 | Integrar con contingencia persistente; refactorizar mock-mode para usar adapter |

## Riesgos

| Riesgo | Probabilidad | Fase | Mitigacion |
|--------|-------------|------|------------|
| **SUNAT SOAP es notoriamente inestable** — timeouts, errores 500, mantenimientos no anunciados | Alta | F1 | El queue worker tiene retry con backoff exponencial (3 intentos, 5/10/15 min). Contingencia (F4) se activa automaticamente despues de N fallos consecutivos. El worker loguea cada error con trace_id. |
| **nodefact es v0.1.2 (libreria joven)** — posibles bugs o falta de edge cases | Media | F1 | El `NubefactAdapter` se mantiene como fallback funcional y testeado (16 tests). Un tenant puede cambiar su `sunat_provider` a `NUBEFACT` en cualquier momento. Ademas, los tests de integracion contra SUNAT beta validaran la libreria. |
| **Gestion de certificados digitales per-tenant** — complejidad de UI, almacenamiento seguro, rotacion | Media | F2 | Admin UI con upload de PEM, almacenamiento encriptado en DB, validacion al subir (verificar formato PEM, fecha de expiracion). Alerta automatica 30 dias antes de expiracion. |
| **Credenciales SOL incorrectas** por tenant mal configurado | Alta | F2 | Boton "Probar conexion" en UI de configuracion que envia un comprobante de prueba al entorno beta de SUNAT. Validacion de formato al guardar. |
| **Vercel Cron 2-minuto no es suficientemente rapido** para tenants con alto volumen | Baja | F1 | El worker procesa 10 items por invocacion (batch). 10 items / 2 min = 300/hora. Una polleria promedio genera ~100-200 boletas/dia. Si se necesita mas: reducir a 1 minuto o aumentar batch size. |
| **Resumen Diario enviado incompleto** (boletas del dia aun en cola) | Media | F3 | El cron de Resumen Diario se ejecuta a las 6AM (madrugada). Solo incluye boletas con status `ACCEPTED` por SUNAT. Si hay boletas pendientes del dia anterior, las omite y las incluye en el resumen del dia siguiente. |
| **Migracion de schema falla** en produccion (nuevas columnas en tenant_settings) | Baja | F2 | Usar `ALTER TABLE ADD COLUMN IF NOT EXISTS` con defaults. Columnas nullable o con default. Zero-downtime migration. |
| **Colision de series** entre facturacion normal y contingencia | Baja | F4 | Ya se usa `Serializable` isolation level para generacion de numeros de serie. Contingencia usa la misma serie — los numeros se asignan secuencialmente. |
| **ContingencyManager refactoring** rompe health check polling | Media | F4 | Los health checks siguen usando el singleton, pero el estado se persiste en DB. Tests unitarios existentes se actualizan para mockear Prisma. |

## Plan de Rollback

### Rollback Fase 1 (Queue Worker + nodefact)
- **Eliminar cron**: Quitar la entrada de `vercel.json`. El worker deja de ejecutarse.
- **Revertir client.ts**: `realSendInvoice()` vuelve a retornar `SUNAT_NOT_IMPLEMENTED`. Las facturas se siguen creando en `invoice_queue` pero no se procesan (estado actual).
- **Archivos nuevos**: Eliminar `sunat-direct-adapter.ts`, `sunat-queue-worker.ts` y `cron/sunat-queue/route.ts`. Son aditivos.
- **Dependencia**: `npm uninstall nodefact`. No afecta nada existente.
- **Impacto**: Las facturas dejan de enviarse a SUNAT. Los items en cola se preservan para cuando se re-despliegue.

### Rollback Fase 2 (Config per-tenant)
- **Columnas en schema**: Las nuevas columnas son nullable/con default. No rompen queries existentes. Para eliminar: migracion inversa.
- **API endpoint**: Eliminar `configuracion/route.ts`. Es aditivo.
- **UI**: Revertir cambios en `facturacion/page.tsx`. La seccion de configuracion desaparece.
- **Impacto**: El queue worker no encuentra credenciales per-tenant y no procesa la cola (comportamiento safe).

### Rollback Fase 3 (Resumen Diario)
- **Eliminar cron**: Quitar entrada de `vercel.json`.
- **Archivos nuevos**: Eliminar `sunat-daily-summary.ts` y `cron/sunat-daily-summary/route.ts`.
- **Impacto**: Los resumenes diarios dejan de generarse. SUNAT permite hasta 72h de atraso antes de multa. Tiempo para corregir.

### Rollback Fase 4 (Contingencia Persistente)
- **Revertir contingency.ts**: Volver al estado in-memory. Los datos de contingencia en DB se preservan pero no se leen.
- **Modelos nuevos**: Los modelos `sunat_contingency*` en schema se pueden dejar (no rompen nada) o revertir la migracion.
- **Impacto**: La contingencia vuelve a ser volatil (estado actual, aceptable temporalmente).

## Dependencias

- **Fase 1**: Requiere `npm install nodefact`. Requiere que cada tenant tenga certificado digital de SUNAT (obtenible gratis desde portal SOL). Para pruebas: SUNAT provee entorno beta con credenciales de prueba.
- **Fase 2**: Depende de Fase 1 (el worker debe existir para que las credenciales tengan efecto). Requiere migracion de Prisma.
- **Fase 3**: Depende de Fase 1 (SunatDirectAdapter wired). nodefact soporta Resumen Diario y Comunicacion de Baja nativamente.
- **Fase 4**: Sin dependencias con otras fases. Puede ejecutarse en paralelo. Requiere migracion de Prisma.
- **Dependencias de paquetes**: Una sola nueva: `nodefact`. Trae transitivamente: `xml-crypto`, `soap`, `xml2js`, `handlebars`, `pdfkit`, `qrcode`.

## Criterios de Exito

### Fase 1 — Queue Worker + nodefact
- [ ] `nodefact` instalado y funcional
- [ ] `SunatDirectAdapter` genera XML UBL 2.1 valido, firma digitalmente, y envia SOAP a SUNAT beta
- [ ] Cron job `/api/cron/sunat-queue` responde 200 y procesa items de `invoice_queue`
- [ ] Item procesado exitosamente: status cambia a `PROCESSED`, `invoice_cdr` tiene CDR de SUNAT
- [ ] Item fallido: `attempts` incrementa, `last_error` tiene mensaje, retry programado con backoff
- [ ] Item agotado (attempts >= max_attempts): status = `FAILED`, alerta logueada
- [ ] Eventos `INVOICE_SENT_TO_SUNAT` e `INVOICE_SUNAT_ACCEPTED` emitidos correctamente
- [ ] `SunatClient.realSendInvoice()` ya no retorna `SUNAT_NOT_IMPLEMENTED`
- [ ] `provider-config.ts` soporta `'sunat-direct'` como provider default
- [ ] Fallback a `NubefactAdapter` funciona cuando `sunat_provider = 'NUBEFACT'`
- [ ] Tests unitarios para queue worker: happy path, retry, max attempts, tenant sin config, fallback a Nubefact
- [ ] 0 regresiones en tests existentes (4897+ tests)

### Fase 2 — Config per-Tenant
- [ ] `tenant_settings` tiene columnas: `sunat_provider`, `sunat_mode`, `sunat_sol_user`, `sunat_sol_password`, `sunat_certificate_pem`, `sunat_private_key_pem`, `nubefact_token`, `nubefact_url`
- [ ] Credenciales sensibles almacenadas encriptadas en DB
- [ ] `GET /api/admin/facturacion/configuracion` retorna config SUNAT del tenant autenticado
- [ ] `PUT /api/admin/facturacion/configuracion` actualiza config con validacion
- [ ] Ambos endpoints retornan 401 sin JWT valido
- [ ] Upload de certificado PEM con validacion de formato y fecha de expiracion
- [ ] Boton "Probar conexion" envia comprobante de prueba a SUNAT beta y muestra resultado
- [ ] Queue worker respeta `sunat_mode === 'DISABLED'` — no procesa items de tenants deshabilitados
- [ ] Queue worker despacha al adapter correcto segun `sunat_provider` del tenant
- [ ] UI admin muestra formulario de configuracion SUNAT en `/admin/facturacion`

### Fase 3 — Resumen Diario
- [ ] Cron job `/api/cron/sunat-daily-summary` se ejecuta diariamente y procesa todas las boletas del dia anterior
- [ ] Resumen Diario generado y enviado via nodefact (SOAP directo a SUNAT)
- [ ] `sunat_daily_summary` actualizado con: fecha, cantidad boletas, monto total, ticket_number SUNAT, status
- [ ] Boletas con status != `ACCEPTED` excluidas del resumen (no se envian boletas rechazadas)
- [ ] UI admin muestra tabla de resumenes diarios con estado
- [ ] Si no hay boletas en un dia, no se genera resumen (correcto segun SUNAT)

### Fase 4 — Contingencia Persistente
- [ ] `sunat_contingency` y `sunat_contingency_invoices` existen en schema y DB
- [ ] `ContingencyManager.activate()` persiste estado en DB
- [ ] `ContingencyManager.registerContingencyInvoice()` persiste factura en DB
- [ ] Al reiniciar servidor, el estado de contingencia se recupera de DB
- [ ] UI admin muestra: estado contingencia, razon, facturas pendientes de reconciliar
- [ ] Facturas con reconcile_by < now() marcadas como urgentes en UI
- [ ] Tests unitarios actualizados para usar Prisma mock en lugar de in-memory arrays

### General
- [ ] Las 4 fases mergeadas a main
- [ ] `tsc --noEmit` pasa con 0 errores
- [ ] `npm run build` tiene exito
- [ ] 0 regresiones de tests
- [ ] Al menos 1 tenant en modo beta procesando facturas de prueba exitosamente contra SUNAT beta
- [ ] Costo de facturacion electronica: S/ 0.00 por tenant
