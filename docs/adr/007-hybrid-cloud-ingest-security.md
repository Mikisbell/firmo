# ADR-007: Arquitectura Híbrida de Ingesta y Seguridad API

## Estado
Aceptado

## Contexto
El sistema POS necesita sincronizar eventos hacia la nube (Supabase) con alta fiabilidad.
Inicialmente se consideró usar solo Prisma, pero surgieron preocupaciones sobre el rendimiento en el "Hot Path" de ingesta y la complejidad del manejo de SSL con el Pooler de Supabase en modo transaccional.
Además, el endpoint de ingesta estaba expuesto públicamente sin autenticación.

## Decisión

### 1. Acceso a Datos Híbrido
*   **Gestión de Schema (Design Time):** Usamos **Prisma** con `DIRECT_URL` (puerto 5432) para migraciones y definición de tipos. Es seguro y declarativo.
*   **Ingesta de Eventos (Runtime):** Usamos el driver nativo **`pg`** (node-postgres) con el Pooler de Supabase (puerto 6543) para el endpoint `/api/events/ingest`.
    *   **Razón:** Menor overhead, control granular de transacciones `BEGIN/COMMIT`, y facilidad para configurar `ssl: { rejectUnauthorized: false }` requerido por Supabase en ciertos entornos.

### 2. Seguridad API (MVP)
*   **Shared Secret:** Se implementa una validación de cabecer `x-api-secret` contra la variable de entorno `PARK_API_SECRET`.
    *   **Razón:** Solución inmediata para cerrar vulnerabilidades de escritura pública sin la complejidad de OAuth2 para un sistema Single-Tenant / Local-First inicial.

## Alternativas Consideradas
*   **Solo Prisma:** Se descartó para el ingest por dificultades de configuración SSL con el pooler y sobrecarga en cold-starts.
*   **Supabase Client (PostgREST):** Se consideró, pero requería refactorizar la lógica de negocio existente en el backend (Next.js API route) que ya validaba Zod schemas. Se mantiene abierta como opción futura.

## Consecuencias

### Positivas
*   **Rendimiento:** Inserción "bare-metal" rápida mediante `pg` y Multi-Row Inserts.
*   **Robustez:** Control total sobre el error handling (Logs detallados de DB_ERROR).
*   **Seguridad:** El endpoint ya no es público.

### Negativas
*   **Deuda Técnica de Mantenimiento:** El archivo `route.ts` contiene SQL raw (`INSERT INTO events...`). Si el schema de Prisma cambia (ej. nuevos campos en `events`), se debe actualizar manualmente este string SQL.
*   **Responsabilidad del Desarrollador:** Se debe tener cuidado extremo con la sanitización de inputs en SQL raw (aunque usamos query parameters `$1, $2` para mitigar inyecciones).

## Fecha
2025-12-30
