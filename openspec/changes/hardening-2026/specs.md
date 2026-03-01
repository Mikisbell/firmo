# Especificaciones: Hardening 2026

**Cambio**: hardening-2026
**Estado**: Borrador
**Creado**: 2026-02-27
**Propuesta**: [proposal.md](./proposal.md)
**Palabras clave RFC 2119**: DEBE (MUST), NO DEBE (MUST NOT), DEBERÁ (SHALL), NO DEBERÁ (SHALL NOT), DEBERÍA (SHOULD), NO DEBERÍA (SHOULD NOT), PUEDE (MAY)

---

## Fase 1 -- Correcciones CRÍTICAS

### SPEC-1.1: Build Standalone de Docker

**Hallazgo**: `next.config.js` carece de `output: 'standalone'`. El Dockerfile copia desde `.next/standalone` (línea 44), pero no se produce salida standalone. El build de Docker falla silenciosamente o produce una imagen rota.

**Precondiciones**:
- `next.config.js` existe con un objeto de configuración Next.js válido
- `Dockerfile` referencia `COPY --from=builder /app/.next/standalone ./`

#### Escenario 1.1.1: La salida standalone está configurada

```gherkin
DADO   que next.config.js define el objeto nextConfig
CUANDO la configuración es evaluada
ENTONCES la propiedad `output` DEBE ser igual a `'standalone'`
Y      `next build` DEBERÁ producir un directorio `.next/standalone/` que contenga `server.js`
```

#### Escenario 1.1.2: El build multi-stage de Docker tiene éxito

```gherkin
DADO   que `output: 'standalone'` está configurado en next.config.js
CUANDO se ejecuta `docker build .`
ENTONCES el build DEBE completarse con código de salida 0
Y      la imagen resultante DEBE contener `/app/server.js`
Y      la imagen DEBE iniciar y responder a `GET /api/health` con HTTP 200
```

#### Escenario 1.1.3: Los tests existentes permanecen en verde

```gherkin
DADO   que el cambio de salida standalone está aplicado
CUANDO se ejecuta `npm run test`
ENTONCES todos los 3,937+ tests existentes DEBEN pasar
Y      `tsc --noEmit` DEBE reportar 0 errores
```

---

### SPEC-1.2: Aplicación de Autenticación en Audit-Log

**Hallazgo**: `GET /api/admin/audit-log` no tiene autenticación. Cualquier cliente HTTP no autenticado puede leer eventos de auditoría de seguridad incluyendo intentos de login, PINs fallidos y actividad de terminales.

**Precondiciones**:
- Archivo de ruta: `src/app/api/admin/audit-log/route.ts`
- Utilidades de auth: `requireAdminAuth`, `requireAdminPermission` del middleware del proyecto

#### Escenario 1.2.1: La solicitud no autenticada es rechazada

```gherkin
DADO   una solicitud a GET /api/admin/audit-log
CUANDO la solicitud no tiene header Authorization ni cookie de auth
ENTONCES la ruta DEBE retornar HTTP 401
Y      el cuerpo de la respuesta DEBE contener un mensaje de error
Y      la respuesta NO DEBE contener ningún dato de eventos de auditoría
```

#### Escenario 1.2.2: El permiso insuficiente es rechazado

```gherkin
DADO   una solicitud a GET /api/admin/audit-log
CUANDO la solicitud tiene un JWT válido para un usuario con rol CASHIER
ENTONCES la ruta DEBE retornar HTTP 403
Y      la respuesta NO DEBE contener ningún dato de eventos de auditoría
```

#### Escenario 1.2.3: El admin autorizado puede acceder al log de auditoría

```gherkin
DADO   una solicitud a GET /api/admin/audit-log
CUANDO la solicitud tiene un JWT válido para un usuario con rol OWNER, ADMIN o MANAGER
Y      el usuario tiene el permiso `view_audit`
ENTONCES la ruta DEBE retornar HTTP 200
Y      la respuesta DEBERÁ contener los campos `events` y `stats`
```

#### Escenario 1.2.4: Orden del middleware de autenticación

```gherkin
DADO   el handler de ruta para /api/admin/audit-log
CUANDO la función handler es invocada
ENTONCES `requireAdminAuth(request)` DEBE ser llamado antes de cualquier acceso a datos
Y      `requireAdminPermission(request, 'view_audit')` DEBE ser llamado después de que auth tenga éxito
Y      si cualquiera de las verificaciones falla, el handler DEBE retornar inmediatamente sin ejecutar lógica de consulta
```

---

### SPEC-1.3: Aplicación de Autenticación en Cleanup

**Hallazgo**: `POST /api/admin/cleanup` usa una verificación condicional de `ADMIN_API_KEY`: si `ADMIN_API_KEY` no está configurada en env, el endpoint queda completamente abierto. Este es un endpoint destructivo de datos que elimina eventos procesados.

**Precondiciones**:
- Archivo de ruta: `src/app/api/admin/cleanup/route.ts`
- Auth actual: `if (adminKey && authHeader !== ...)` -- se omite cuando la variable de entorno no está configurada

#### Escenario 1.3.1: La solicitud no autenticada es rechazada

```gherkin
DADO   una solicitud a POST /api/admin/cleanup
CUANDO la solicitud no tiene un JWT válido
ENTONCES la ruta DEBE retornar HTTP 401
Y      ningún evento procesado DEBERÁ ser eliminado
```

#### Escenario 1.3.2: La verificación de ADMIN_API_KEY es eliminada

```gherkin
DADO   el código fuente del handler de la ruta cleanup
CUANDO el código fuente es inspeccionado
ENTONCES NO DEBE haber referencia a `ADMIN_API_KEY`
Y      NO DEBE haber referencia a `process.env.ADMIN_API_KEY`
Y      la autenticación DEBE ser aplicada mediante `requireAdminAuth(request)`
```

#### Escenario 1.3.3: Acceso protegido por permisos

```gherkin
DADO   una solicitud a POST /api/admin/cleanup con un JWT de admin válido
CUANDO el usuario tiene el permiso `manage_config`
ENTONCES la ruta DEBE proceder con la lógica de limpieza
Y      la respuesta DEBERÁ contener `success`, `deletedCount` y `retentionDays`
```

#### Escenario 1.3.4: El rol no-admin es rechazado

```gherkin
DADO   una solicitud a POST /api/admin/cleanup
CUANDO la solicitud tiene un JWT válido para un usuario con rol WAITER
ENTONCES la ruta DEBE retornar HTTP 403
Y      ningún evento procesado DEBERÁ ser eliminado
```

---

## Fase 2 -- Endurecimiento de Seguridad

### SPEC-2.1: Autenticación de Ruta -- delivery/[id]

**Hallazgo**: `src/app/api/delivery/[id]/route.ts` no tiene middleware de auth. Los detalles de órdenes de delivery (direcciones de clientes, números telefónicos, montos) están expuestos.

#### Escenario 2.1.1: Aplicación de auth en detalle de delivery

```gherkin
DADO   una solicitud a cualquier método en /api/delivery/{id}
CUANDO la solicitud no tiene un token de auth POS válido
ENTONCES la ruta DEBE retornar HTTP 401
Y      ningún dato de delivery DEBERÁ ser retornado
```

#### Escenario 2.1.2: El acceso autenticado tiene éxito

```gherkin
DADO   una solicitud a GET /api/delivery/{id}
CUANDO la solicitud tiene un token de auth POS válido
Y      el delivery pertenece al mismo tenant
ENTONCES la ruta DEBE retornar HTTP 200 con los datos del delivery
Y      el tenant_id DEBE ser extraído del JWT, no de parámetros de consulta
```

---

### SPEC-2.2: Autenticación de Ruta -- delivery/checkpoint2

**Hallazgo**: `src/app/api/delivery/checkpoint2/route.ts` no tiene middleware de auth. Las transiciones de estado de delivery pueden ser activadas por cualquier llamador.

#### Escenario 2.2.1: Aplicación de auth en checkpoint2

```gherkin
DADO   una solicitud a POST /api/delivery/checkpoint2
CUANDO la solicitud no tiene un token de auth POS válido
ENTONCES la ruta DEBE retornar HTTP 401
Y      ninguna transición de estado de delivery DEBERÁ ocurrir
```

---

### SPEC-2.3: Autenticación de Ruta -- inventory/stock

**Hallazgo**: `src/app/api/inventory/stock/route.ts` no tiene auth. Los niveles de stock (incluyendo costos) están expuestos y el tenant_id proviene de parámetros de consulta, habilitando acceso cross-tenant.

#### Escenario 2.3.1: Aplicación de auth en inventory stock

```gherkin
DADO   una solicitud a GET /api/inventory/stock
CUANDO la solicitud no tiene un token de auth POS válido
ENTONCES la ruta DEBE retornar HTTP 401
```

#### Escenario 2.3.2: Aislamiento de tenant vía JWT

```gherkin
DADO   una solicitud a GET /api/inventory/stock con un token de auth POS válido
CUANDO la ruta extrae el tenant_id
ENTONCES el tenant_id DEBE ser leído de los claims del JWT (authResult.user.tenantId)
Y      el tenant_id NO DEBE ser aceptado desde parámetros de consulta o cuerpo de la solicitud
Y      cualquier parámetro tenant_id en la URL DEBE ser ignorado
```

---

### SPEC-2.4: Autenticación de Ruta -- inventory/stats

**Hallazgo**: `src/app/api/inventory/stats/route.ts` no tiene auth. Las analíticas y valoraciones de inventario están expuestas.

#### Escenario 2.4.1: Aplicación de auth en inventory stats

```gherkin
DADO   una solicitud a GET /api/inventory/stats
CUANDO la solicitud no tiene un token de auth POS válido
ENTONCES la ruta DEBE retornar HTTP 401
```

#### Escenario 2.4.2: Aislamiento de tenant vía JWT

```gherkin
DADO   una solicitud a GET /api/inventory/stats con un token de auth POS válido
CUANDO la ruta extrae el tenant_id
ENTONCES el tenant_id DEBE ser leído de los claims del JWT
Y      el tenant_id NO DEBE ser aceptado desde parámetros de consulta
```

---

### SPEC-2.5: Autenticación de Ruta -- orders/[orderId]/lock

**Hallazgo**: `src/app/api/orders/[orderId]/lock/route.ts` expone GET, POST y DELETE sin auth. Cualquier llamador puede bloquear o desbloquear cualquier orden.

#### Escenario 2.5.1: Auth en todos los métodos de lock

```gherkin
DADO   una solicitud a GET, POST o DELETE en /api/orders/{orderId}/lock
CUANDO la solicitud no tiene un token de auth POS válido
ENTONCES la ruta DEBE retornar HTTP 401 para cada método
Y      ningún estado de lock DEBERÁ ser modificado
```

#### Escenario 2.5.2: Operaciones de lock autenticadas

```gherkin
DADO   una solicitud a POST /api/orders/{orderId}/lock con un token de auth POS válido
CUANDO la orden pertenece al tenant autenticado
ENTONCES la ruta DEBE adquirir el lock
Y      el lock DEBE estar asociado con la identidad del usuario autenticado
```

---

### SPEC-2.6: Autenticación de Ruta -- locations/history/[driverId]

**Hallazgo**: `src/app/api/locations/history/[driverId]/route.ts` no tiene auth. El historial GPS del conductor (coordenadas con marca de tiempo) está expuesto.

#### Escenario 2.6.1: Aplicación de auth en historial de ubicación

```gherkin
DADO   una solicitud a GET /api/locations/history/{driverId}
CUANDO la solicitud no tiene un token de auth POS válido
ENTONCES la ruta DEBE retornar HTTP 401
Y      ningún dato de ubicación DEBERÁ ser retornado
```

---

### SPEC-2.7: Autenticación de Ruta -- push/send, push/subscribe, push/unsubscribe

**Hallazgo**: Tres rutas de notificaciones push no tienen auth. Cualquier llamador puede enviar notificaciones push, suscribir dispositivos o desuscribir dispositivos.

#### Escenario 2.7.1: Auth en push/send

```gherkin
DADO   una solicitud a POST /api/push/send
CUANDO la solicitud no tiene un token de auth POS válido
ENTONCES la ruta DEBE retornar HTTP 401
Y      ninguna notificación push DEBERÁ ser enviada
```

#### Escenario 2.7.2: Auth en push/subscribe

```gherkin
DADO   una solicitud a POST /api/push/subscribe
CUANDO la solicitud no tiene un token de auth POS válido
ENTONCES la ruta DEBE retornar HTTP 401
Y      ninguna suscripción DEBERÁ ser creada
```

#### Escenario 2.7.3: Auth en push/unsubscribe

```gherkin
DADO   una solicitud a POST /api/push/unsubscribe
CUANDO la solicitud no tiene un token de auth POS válido
ENTONCES la ruta DEBE retornar HTTP 401
Y      ninguna suscripción DEBERÁ ser eliminada
```

---

### SPEC-2.8: Eliminación de NEXT_PUBLIC_API_SECRET

**Hallazgo**: `NEXT_PUBLIC_API_SECRET` está expuesto en los bundles de JavaScript del cliente. Cualquier usuario puede extraerlo desde DevTools del navegador, haciéndolo inútil como secreto.

#### Escenario 2.8.1: Ningún secreto expuesto al cliente en el código fuente

```gherkin
DADO   el árbol completo de código fuente bajo src/
CUANDO se realiza una búsqueda de texto por `NEXT_PUBLIC_API_SECRET`
ENTONCES la búsqueda DEBE retornar 0 coincidencias
```

#### Escenario 2.8.2: Secreto solo del lado del servidor

```gherkin
DADO   el cliente de sincronización en src/core/sync/client.ts
CUANDO referencia un secreto de API
ENTONCES DEBE usar una variable de entorno solo del servidor (ej., `API_SECRET` sin el prefijo `NEXT_PUBLIC_`)
Y      esta variable de entorno NO DEBE aparecer en ningún código o componente del lado del cliente
```

#### Escenario 2.8.3: .env.example actualizado

```gherkin
DADO   el archivo .env.example
CUANDO es inspeccionado
ENTONCES DEBE contener `API_SECRET=` (solo servidor)
Y      NO DEBE contener `NEXT_PUBLIC_API_SECRET=`
```

---

### SPEC-2.9: Límite de Conexiones SSE

**Hallazgo**: `src/app/api/events/stream/route.ts` acepta conexiones SSE ilimitadas por tenant. Un solo tenant (o atacante) puede agotar los recursos del servidor abriendo miles de conexiones.

**Precondiciones**:
- Ruta actual: sin seguimiento de conexiones, sin límite por tenant
- Auth actual: tenant_id desde parámetro de consulta (no JWT)

#### Escenario 2.9.1: El límite de conexiones es aplicado

```gherkin
DADO   un tenant con 10 conexiones SSE activas a /api/events/stream
CUANDO se realiza un intento de conexión número 11 para el mismo tenant
ENTONCES la ruta DEBE rechazar la conexión con HTTP 429
Y      la respuesta DEBERÍA incluir un header `Retry-After`
Y      las 10 conexiones existentes NO DEBEN ser interrumpidas
```

#### Escenario 2.9.2: El límite de conexiones es por tenant

```gherkin
DADO   que el tenant A tiene 10 conexiones SSE activas (en el límite)
CUANDO el tenant B abre su primera conexión SSE
ENTONCES la conexión del tenant B DEBE ser aceptada
Y      las conexiones del tenant A NO DEBEN ser afectadas
```

#### Escenario 2.9.3: La desconexión libera capacidad

```gherkin
DADO   un tenant en el límite de conexiones (10)
CUANDO una conexión existente es cerrada por el cliente
ENTONCES el contador de conexiones para ese tenant DEBE decrementarse
Y      un intento de conexión posterior DEBE ser aceptado
```

---

### SPEC-2.10: Auth del Stream de Eventos

**Hallazgo**: `GET /api/events/stream` acepta `tenant_id` desde parámetros de consulta sin validación de JWT. Cualquier llamador puede suscribirse al stream de eventos de cualquier tenant adivinando o enumerando IDs de tenant.

#### Escenario 2.10.1: Aplicación de auth en stream SSE

```gherkin
DADO   una solicitud a GET /api/events/stream
CUANDO la solicitud no tiene un token de auth válido
ENTONCES la ruta DEBE retornar HTTP 401
Y      ningún stream SSE DEBERÁ ser abierto
```

#### Escenario 2.10.2: Tenant ID solo desde JWT

```gherkin
DADO   una solicitud a GET /api/events/stream con un token de auth válido
CUANDO la ruta determina los eventos de qué tenant transmitir
ENTONCES el tenant_id DEBE ser extraído de los claims del JWT
Y      el parámetro de consulta `tenant_id` DEBE ser ignorado si está presente
Y      el stream DEBE emitir solo eventos que coincidan con el tenant del JWT
```

---

## Fase 3 -- Mejoras de Arquitectura

### SPEC-3.1: Optimización del Bundle de framer-motion

**Hallazgo**: `framer-motion` tiene 55 sitios de importación en el codebase pero no está listado en `optimizePackageImports` en `next.config.js`. Esto resulta en que la biblioteca completa se incluye en el bundle incluso cuando solo se usan exports específicos.

#### Escenario 3.1.1: framer-motion en optimizePackageImports

```gherkin
DADO   que next.config.js define `experimental.optimizePackageImports`
CUANDO el array es inspeccionado
ENTONCES DEBE contener la cadena `'framer-motion'`
```

#### Escenario 3.1.2: Reducción del tamaño del bundle

```gherkin
DADO   que framer-motion es agregado a optimizePackageImports
CUANDO se ejecuta `next build` y el bundle es analizado
ENTONCES el tamaño total del bundle JS DEBERÍA disminuir
Y      el build DEBE completarse sin errores
Y      todas las páginas que usan animaciones de framer-motion DEBEN renderizar correctamente
```

---

### SPEC-3.2: Modo Estricto de TypeScript -- noImplicitAny + noUncheckedIndexedAccess

**Hallazgo**: `tsconfig.json` tiene `noImplicitAny: false`. Esto permite tipos `any` implícitos en todo el codebase, anulando las garantías de seguridad de tipos de TypeScript. `noUncheckedIndexedAccess` no está configurado, por lo que el acceso por índice a arrays/objetos silenciosamente retorna valores potencialmente undefined tipados como definidos.

#### Escenario 3.2.1: noImplicitAny habilitado

```gherkin
DADO   compilerOptions de tsconfig.json
CUANDO la configuración es evaluada
ENTONCES `noImplicitAny` DEBE ser `true`
Y      `tsc --noEmit` DEBE completarse con 0 errores
```

#### Escenario 3.2.2: noUncheckedIndexedAccess habilitado

```gherkin
DADO   compilerOptions de tsconfig.json
CUANDO la configuración es evaluada
ENTONCES `noUncheckedIndexedAccess` DEBE ser `true`
Y      `tsc --noEmit` DEBE completarse con 0 errores
```

#### Escenario 3.2.3: Sin supresión mediante ts-ignore generalizado

```gherkin
DADO   el codebase después de habilitar noImplicitAny
CUANDO los archivos fuente son inspeccionados
ENTONCES NO DEBEN introducirse nuevas anotaciones `@ts-ignore`
Y      `@ts-expect-error` PUEDE usarse con moderación con un comentario de justificación
Y      el total de nuevas anotaciones `@ts-expect-error` DEBERÍA ser menor a 20
```

---

### SPEC-3.3: Eliminación de Console.log en Rutas API

**Hallazgo**: 75 llamadas a `console.log` existen en 12 archivos de rutas API (38 solo en la ruta de login). Estas producen salida no estructurada que no puede ser filtrada, nivelada ni enrutada a plataformas de observabilidad.

#### Escenario 3.3.1: Cero console.log en rutas API

```gherkin
DADO   todos los archivos que coinciden con src/app/api/**/*.ts
CUANDO se realiza una búsqueda de texto por `console.log(`
ENTONCES la búsqueda DEBE retornar 0 coincidencias
```

#### Escenario 3.3.2: Reemplazo por logger estructurado

```gherkin
DADO   un archivo de ruta API que previamente usaba console.log
CUANDO el reemplazo es inspeccionado
ENTONCES cada llamada anterior a console.log DEBE ser reemplazada con una llamada al logger estructurado
Y      la llamada al logger DEBE usar un nivel apropiado: logger.info, logger.warn, logger.error o logger.debug
Y      la llamada al logger DEBE incluir un objeto de contexto estructurado (no solo una cadena)
```

#### Escenario 3.3.3: console.error y console.warn preservados o reemplazados

```gherkin
DADO   archivos de rutas API con llamadas a console.error o console.warn
CUANDO la estrategia de reemplazo es aplicada
ENTONCES cada llamada DEBERÍA ser reemplazada con el nivel correspondiente del logger
Y      los detalles de error DEBEN ser preservados (stack traces, mensajes de error)
```

---

### SPEC-3.4: ErrorBoundary en el Layout Raíz

**Hallazgo**: `src/app/layout.tsx` no tiene ErrorBoundary. Un error no manejado en cualquier componente hijo causa el fallo completo de la aplicación con una pantalla blanca y sin ruta de recuperación.

#### Escenario 3.4.1: El layout raíz envuelve children en ErrorBoundary

```gherkin
DADO   que src/app/layout.tsx renderiza sus children
CUANDO el árbol de componentes es inspeccionado
ENTONCES el prop {children} DEBE estar envuelto en un componente ErrorBoundary
Y      el ErrorBoundary DEBE renderizar una UI de fallback visible al usuario en caso de error
Y      la UI de fallback DEBE incluir una forma de reintentar o navegar al inicio
```

#### Escenario 3.4.2: ErrorBoundary reporta errores

```gherkin
DADO   un error no manejado lanzado por un componente hijo del layout raíz
CUANDO el ErrorBoundary captura el error
ENTONCES el error DEBERÍA ser reportado al sistema de logging/observabilidad
Y      el usuario DEBE ver una UI de fallback en lugar de una pantalla blanca
Y      el resto del chrome de la aplicación (si existe) DEBERÍA permanecer funcional
```

#### Escenario 3.4.3: Las páginas de menú también están protegidas

```gherkin
DADO   componentes de página de menú bajo src/app/menu/
CUANDO el árbol de componentes es inspeccionado
ENTONCES cada página de menú DEBE estar envuelta en un ErrorBoundary
Y      la UI de fallback DEBE ser apropiada para un contexto orientado al cliente
```

---

## Fase 4 -- Modernización de Infraestructura

### SPEC-4.1: Integración de Sentry

**Hallazgo**: No existe seguimiento de errores en producción. Los errores en producción se pierden a menos que alguien revise los logs del servidor. El proyecto referencia Sentry en la documentación pero no tiene integración real del SDK.

#### Escenario 4.1.1: SDK de Sentry instalado y configurado

```gherkin
DADO   la aplicación en producción
CUANDO la app inicia
ENTONCES Sentry DEBE ser inicializado con un DSN válido desde variables de entorno
Y      el DSN de Sentry NO DEBE estar hardcodeado en archivos fuente
Y      Sentry DEBE capturar excepciones no manejadas y rechazos de promesas no manejados
```

#### Escenario 4.1.2: Sentry captura errores

```gherkin
DADO   una instancia de producción en ejecución con Sentry configurado
CUANDO un error no manejado ocurre en una ruta API o un componente React
ENTONCES el error DEBE aparecer en el dashboard de Sentry dentro de 60 segundos
Y      el error DEBE incluir stack trace, URL de la solicitud y contexto del tenant
```

#### Escenario 4.1.3: Sentry deshabilitado en tests

```gherkin
DADO   el entorno de tests (NODE_ENV=test)
CUANDO la aplicación se inicializa
ENTONCES Sentry NO DEBE ser inicializado
Y      Sentry NO DEBE enviar ninguna solicitud de red
```

---

### SPEC-4.2: Actualización a Node 22

**Hallazgo**: El proyecto usa Node 20 (Dockerfile líneas 6, 13, 29). Node 20 llega a EOL en abril 2026. Node 22 es el LTS actual.

#### Escenario 4.2.1: El Dockerfile usa Node 22

```gherkin
DADO   el Dockerfile
CUANDO las directivas FROM son inspeccionadas
ENTONCES las tres etapas (deps, builder, runner) DEBEN usar `node:22-alpine`
Y      NO DEBE haber referencia a `node:20`
```

#### Escenario 4.2.2: CI usa Node 22

```gherkin
DADO   .github/workflows/ci.yml
CUANDO el paso de configuración de Node.js es inspeccionado
ENTONCES node-version DEBE ser `22` o `22.x`
```

#### Escenario 4.2.3: Todos los tests pasan en Node 22

```gherkin
DADO   el proyecto ejecutándose en Node 22
CUANDO se ejecuta `npm run test`
ENTONCES todos los tests DEBEN pasar con 0 fallas
Y      `npm run build` DEBE tener éxito
```

---

### SPEC-4.3: Validación de Variables de Entorno al Inicio

**Hallazgo**: Variables de entorno faltantes o malformadas causan errores crípticos en tiempo de ejecución profundamente en el código de la aplicación en lugar de fallar rápidamente al inicio.

#### Escenario 4.3.1: Las variables de entorno requeridas se validan al inicio

```gherkin
DADO   un esquema Zod que define las variables de entorno requeridas
CUANDO la aplicación inicia
ENTONCES el esquema DEBE validar DATABASE_URL, JWT_SECRET y todas las demás variables requeridas
Y      si cualquier variable requerida falta, la app DEBE salir con un código distinto de cero
Y      el mensaje de error DEBE listar todas las variables faltantes/inválidas
```

#### Escenario 4.3.2: Comportamiento de fallo rápido

```gherkin
DADO   que DATABASE_URL no está configurada en el entorno
CUANDO la aplicación intenta iniciar
ENTONCES la aplicación DEBE fallar dentro de 5 segundos
Y      el mensaje de error DEBE nombrar específicamente `DATABASE_URL` como faltante
Y      ningún intento de conexión a base de datos DEBERÁ ser realizado
```

#### Escenario 4.3.3: Las variables opcionales tienen valores por defecto

```gherkin
DADO   que una variable de entorno opcional (ej., LOG_LEVEL) no está configurada
CUANDO la aplicación inicia
ENTONCES la validación NO DEBE fallar
Y      un valor por defecto razonable DEBE ser aplicado
Y      los valores por defecto DEBEN estar documentados en el esquema Zod
```

---

### SPEC-4.4: Creación de .nvmrc

**Hallazgo**: No existe archivo `.nvmrc`. Los desarrolladores pueden usar versiones inconsistentes de Node, causando problemas de "funciona en mi máquina".

#### Escenario 4.4.1: .nvmrc existe con la versión correcta

```gherkin
DADO   el directorio raíz del proyecto
CUANDO se lee .nvmrc
ENTONCES el archivo DEBE existir
Y      el contenido DEBE ser `22` (coincidiendo con el Dockerfile y CI)
Y      el archivo DEBE contener exactamente una línea sin espacios en blanco al final
```

---

## Fase 5 -- Cobertura de Tests

### SPEC-5.1: Cobertura de Tests del Módulo de Seguridad

**Hallazgo**: `src/core/security/` contiene 9 archivos con 1,712 líneas de código y 0 archivos de tests. Esto incluye validación de JWT, rate limiting, device fingerprinting y validación de MAC -- todas funciones de seguridad críticas.

#### Escenario 5.1.1: Existen archivos de tests para todos los módulos de seguridad

```gherkin
DADO   cada archivo en src/core/security/
CUANDO el archivo de test correspondiente es verificado
ENTONCES cada archivo .ts en src/core/security/ DEBE tener un archivo de test correspondiente
Y      los archivos de tests DEBEN seguir el patrón src/core/security/__tests__/{module}.test.ts
```

#### Escenario 5.1.2: El umbral de cobertura es alcanzado

```gherkin
DADO   que todos los tests de módulos de seguridad son ejecutados
CUANDO la cobertura de líneas es medida
ENTONCES la cobertura de líneas agregada para src/core/security/ DEBE ser >= 90%
Y      la cobertura de ramas DEBERÍA ser >= 80%
```

#### Escenario 5.1.3: Las rutas críticas están testeadas

```gherkin
DADO   la suite de tests de seguridad
CUANDO los casos de test son revisados
ENTONCES los tests DEBEN cubrir: aceptación de token válido, rechazo de token expirado,
       rechazo de token malformado, activación de rate limit, reinicio de rate limit,
       validación de device fingerprint y validación de MAC
Y      cada test DEBE hacer assertions sobre valores de retorno específicos o errores lanzados
Y      los tests NO DEBEN depender de detalles de implementación (testear comportamiento, no internos)
```

---

### SPEC-5.2: Eliminación de Math.random en Tests

**Hallazgo**: 83 llamadas a `Math.random()` en 18 archivos de tests producen ejecuciones no determinísticas. Las fallas de tests flaky no pueden ser reproducidas porque las semillas aleatorias no son capturadas.

#### Escenario 5.2.1: Cero Math.random en archivos de tests

```gherkin
DADO   todos los archivos que coinciden con src/**/*.test.ts y src/**/*.test.tsx
CUANDO se realiza una búsqueda de texto por `Math.random()`
ENTONCES la búsqueda DEBE retornar 0 coincidencias
```

#### Escenario 5.2.2: Reemplazo por PRNG con semilla

```gherkin
DADO   un archivo de test que previamente usaba Math.random()
CUANDO el reemplazo es inspeccionado
ENTONCES DEBE usar un generador de números pseudo-aleatorios con semilla
Y      la semilla DEBE ser registrada o determinística para que las fallas sean reproducibles
Y      los arbitrarios de fast-check DEBERÍAN ser usados donde los valores aleatorios alimentan property tests
```

#### Escenario 5.2.3: Determinismo de tests verificado

```gherkin
DADO   la suite completa de tests con todas las llamadas a Math.random() reemplazadas
CUANDO la suite de tests es ejecutada 3 veces en secuencia
ENTONCES las 3 ejecuciones DEBEN producir resultados idénticos de pass/fail
Y      ningún test DEBERÁ ser marcado como flaky
```

---

### SPEC-5.3: Reducción de `as any` en Archivos de Tests

**Hallazgo**: 438 casts `as any` en 86 archivos de tests evaden el sistema de tipos de TypeScript. Muchos de estos ocultan errores reales de tipos o fixtures de tests obsoletos que ya no coinciden con los tipos que testean.

#### Escenario 5.3.1: El conteo de casts está por debajo del umbral

```gherkin
DADO   todos los archivos que coinciden con src/**/*.test.ts y src/**/*.test.tsx
CUANDO se realiza una búsqueda de texto por `as any`
ENTONCES el conteo total DEBE ser menor a 50
```

#### Escenario 5.3.2: Los casts restantes están justificados

```gherkin
DADO   cada cast `as any` restante después de la reducción
CUANDO el cast es revisado
ENTONCES DEBERÍA tener un comentario en línea explicando por qué el cast es necesario
Y      el cast DEBE caer en una de estas categorías:
       - Testear rutas de error que requieren entrada inválida
       - Hacer mock de tipos de bibliotecas externas que no son exportados
       - Acceder a APIs privadas/internas para testing de caja blanca
Y      los casts que existen solo para evitar escribir definiciones de tipos apropiadas DEBEN ser eliminados
```

#### Escenario 5.3.3: Seguridad de tipos mejorada

```gherkin
DADO   el conjunto reducido de casts `as any`
CUANDO se ejecuta `tsc --noEmit` contra el proyecto completo incluyendo tests
ENTONCES la compilación DEBE tener éxito con 0 errores
Y      la suite de tests DEBE pasar con 0 fallas
```

---

## Invariantes Cross-Fase

Estas invariantes DEBEN mantenerse verdaderas después de que cada fase sea mergeada.

### INV-1: Sin Regresiones de Tests

```gherkin
DADO   que cualquier fase N es mergeada a main
CUANDO se ejecuta `npm run test`
ENTONCES el número de tests pasando DEBE ser >= al conteo antes de la Fase N
Y      DEBEN haber 0 tests fallando
Y      DEBEN haber 0 tests omitidos (a menos que sean preexistentes y documentados)
```

### INV-2: Integridad del Build

```gherkin
DADO   que cualquier fase N es mergeada a main
CUANDO se ejecuta `npm run build`
ENTONCES el build DEBE tener éxito con código de salida 0
Y      `tsc --noEmit` DEBE reportar 0 errores
```

### INV-3: Viabilidad de la Imagen Docker (Post Fase 1)

```gherkin
DADO   que la Fase 1 o cualquier fase subsecuente es mergeada
CUANDO se ejecuta `docker build .`
ENTONCES la imagen DEBE construirse exitosamente
Y      la imagen DEBE iniciar y pasar el HEALTHCHECK
```

### INV-4: Cero Rutas Desprotegidas (Post Fase 2)

```gherkin
DADO   que la Fase 2 es mergeada
CUANDO todos los archivos route.ts bajo src/app/api/ son enumerados
ENTONCES cada handler de ruta DEBE llamar a requirePosAuth, requireAdminAuth,
       o un middleware de auth equivalente como su primera operación
Y      la única excepción PUEDE ser GET /api/health (health check público)
```

---

## Matriz de Verificación

| ID Spec | Fase | Método de Verificación | Automatizado |
|---------|------|----------------------|--------------|
| 1.1 | F1 | `docker build .` + smoke test del contenedor | Sí (CI) |
| 1.2 | F1 | Test de integración: GET /api/admin/audit-log sin JWT | Sí |
| 1.3 | F1 | Test de integración: POST /api/admin/cleanup sin JWT | Sí |
| 2.1-2.7 | F2 | Tests de integración por ruta: solicitud sin token retorna 401 | Sí |
| 2.8 | F2 | `grep -r NEXT_PUBLIC_API_SECRET src/` retorna 0 | Sí (CI) |
| 2.9 | F2 | Test de carga: 11 conexiones SSE concurrentes, verificar que la 11va es rechazada | Sí |
| 2.10 | F2 | Test de integración: SSE sin JWT retorna 401 | Sí |
| 3.1 | F3 | `next build` + diff del analizador de bundle | Semi |
| 3.2 | F3 | `tsc --noEmit` con flags estrictos | Sí (CI) |
| 3.3 | F3 | `grep -r 'console.log(' src/app/api/` retorna 0 | Sí (CI) |
| 3.4 | F3 | Test unitario: throw en child, verificar que el fallback renderiza | Sí |
| 4.1 | F4 | Desplegar error de prueba, verificar entrada en dashboard de Sentry | Manual |
| 4.2 | F4 | CI ejecuta en Node 22; `node --version` en Docker | Sí (CI) |
| 4.3 | F4 | Iniciar app sin DATABASE_URL, verificar código de salida != 0 | Sí |
| 4.4 | F4 | `cat .nvmrc` retorna `22` | Sí (CI) |
| 5.1 | F5 | Reporte de cobertura para src/core/security/ >= 90% | Sí (CI) |
| 5.2 | F5 | `grep -r 'Math.random()' src/**/*.test.*` retorna 0 | Sí (CI) |
| 5.3 | F5 | `grep -c 'as any' src/**/*.test.*` suma < 50 | Sí (CI) |
