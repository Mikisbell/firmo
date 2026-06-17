# PDR-DB: Arquitectura SRE Nativa en PostgreSQL (Zero-Network SPOF)

## 1. Contexto y Visión General
En sistemas basados en **Event Sourcing** con alta concurrencia (como Puntos de Venta o E-commerce), el plano de datos opera mediante un registro de eventos de solo adición (*Append-Only Log*). Cada evento tiene una secuencia global (`global_sequence`). 

Debido a bloqueos de transacciones (*Deadlocks*), desconexiones o *Rollbacks* concurrentes, la generación de secuencias puede dejar "huecos" (ej. 1, 2, 4, 5). 
Es obligatorio contar con un **Plano de Control (SRE)** que detecte estos huecos para garantizar la integridad de las proyecciones (CQRS) sin interrumpir el **Plano de Datos (OLTP)**.

## 2. El Problema: El Cuello de Botella de Red y Memoria (SPOF)
El enfoque tradicional consiste en delegar el SRE a un Worker externo en Node.js/TypeScript. 

**Por qué falla a escala:**
1. **Consumo de Memoria y Red:** Traer miles de registros a la RAM del worker (ej. `SELECT * FROM events`) mediante la red congestiona el ancho de banda y asfixia al worker.
2. **Inanición de Conexiones (Connection Pool Exhaustion):** Si el SRE comparte el Pooler (ej. PgBouncer en Supabase) con la aplicación, una tarea analítica pesada consumirá las conexiones reservadas para los usuarios finales, bloqueando las ventas.
3. **Latencia y Fallos Transitorios:** Depender del ecosistema Edge (Vercel/Cloudflare) añade puntos de fallo externos (DNS, IPv4/IPv6, Timeouts).

## 3. La Solución Arquitectónica: Motor O(1) Puro (Native PL/pgSQL)
Para proteger el negocio, trasladamos el cálculo analítico directamente a las entrañas del motor transaccional (PostgreSQL), donde los datos residen, logrando **Cero Latencia de Red**.

### 3.1. FastTracker: Detección O(1) con Funciones de Ventana
En lugar de iteradores `for` en memoria, utilizamos una consulta relacional con `LEAD()` (Index Only Scan) y `generate_series`. La base de datos es matemáticamente superior para encontrar deltas.

```sql
INSERT INTO missing_sequences (sequence_id)
SELECT s.gap_seq
FROM (
    SELECT global_sequence, LEAD(global_sequence) OVER (ORDER BY global_sequence) as next_seq
    FROM events
    WHERE global_sequence > v_cursor AND received_at <= NOW() - INTERVAL '5 seconds'
) AS sequence_delta, generate_series(global_sequence + 1, next_seq - 1) AS s(gap_seq)
WHERE next_seq - global_sequence > 1
ON CONFLICT DO NOTHING;
```
*Impacto:* Escaneo de miles de eventos en **~38 milisegundos**. Se ignora una ventana de 5 segundos para permitir que las transacciones en vuelo terminen (Visibilidad MVCC).

### 3.2. Scavenger: Prevención de Fantasmas Inmortales
Los "cadáveres transaccionales" son huecos que nunca se llenarán porque sufrieron un *Rollback* definitivo. El limpiador de cadáveres (`Scavenger`) debe usar la hora de **detección del hueco** y no la hora del evento anterior (evitando el anti-patrón de hacer un `JOIN` contra la tabla `events`, lo cual fallaría si ocurren múltiples rollbacks consecutivos).

**Esquema requerido:**
```prisma
model missing_sequences {
  sequence_id BigInt   @id
  detected_at DateTime @default(now())
}
```

**Lógica PL/pgSQL:**
```sql
DELETE FROM missing_sequences WHERE detected_at < NOW() - INTERVAL '15 minutes';
```
*Impacto:* Eficiencia absoluta `O(1)`. Un bloque de 500 Rollbacks simultáneos se purga sin afectar la CPU.

### 3.3. Orquestación Autónoma (pg_cron)
Ningún script externo activa estas funciones. La propia base de datos se orquesta a sí misma usando `pg_cron`.
- `* * * * *` -> `sre_fast_tracker()` (Cada minuto).
- `*/5 * * * *` -> `sre_scavenger()` (Cada 5 minutos).

## 4. Anti-Patrones de Observabilidad: "DB as a Client"
Si la base de datos detecta anomalías masivas, el instinto inicial es usar **Database Webhooks** o la extensión **`pg_net`** para hacer peticiones HTTP (POST) a Slack o PagerDuty desde el PL/pgSQL.

**Por qué esto es una trampa:**
1. **DDoS Autoinfligido:** Una tormenta de Deadlocks causaría 500 inserciones en `missing_sequences`, disparando 500 Webhooks simultáneos, generando un ataque de Rate-Limiting contra tu propia infraestructura de monitoreo (Alert Fatigue).
2. **Acoplamiento Tóxico:** Hardcodear tokens de PagerDuty o Webhooks de Slack en migraciones SQL ensucia la capa de persistencia con responsabilidades de presentación.

### 4.1. El Patrón Correcto: El Guardián Pull (Pull vs Push)
La base de datos debe permanecer como una **fortaleza muda y matemática**. No envía alertas ("Push"), simplemente expone su estado como un panel de instrumentos ("Pull").

**Implementación:**
- Se levanta un **Cron Trigger en el Edge** (ej. Cloudflare Worker) o un scrapper de Datadog cada 5 minutos.
- Su única tarea es consultar: `SELECT COUNT(*) FROM missing_sequences`.
- Si el conteo supera el umbral crítico (ej. > 50), el Worker de Cloudflare se encarga de formatear la alerta y lidiar con la API de PagerDuty/Slack.
- *Beneficio:* La red de la base de datos queda físicamente aislada e invulnerable a fallos HTTP de terceros.

## 5. Resumen de Implementación Rápida para Nuevos Proyectos
Para replicar esta arquitectura:
1. **Esquema Prisma:** Asegurar que `missing_sequences` tenga un campo `detected_at`.
2. **Migración SQL (create-only):** Inyectar las funciones `sre_fast_tracker` y `sre_scavenger` en PL/pgSQL.
3. **Orquestación:** Habilitar y configurar `pg_cron` en el mismo archivo `.sql`.
4. **Infra Edge:** Eliminar cualquier SRE Worker de Node.js/TypeScript. Implementar un Cloudflare Worker tonto para observabilidad (Pull Model).
