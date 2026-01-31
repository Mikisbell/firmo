# Instrucciones para Pruebas de FASE 3

## 📋 Estado Actual

**Detectado:** Las migraciones de base de datos NO se han ejecutado aún.

### ❌ Falta ejecutar:
- Columna `estimated_time` en tabla `stations`
- Tabla `station_alerts`
- Índices de performance
- Vistas materializadas

---

## 🚀 Pasos para Ejecutar Pruebas

### Opción A: Usando Prisma Migrate (Recomendado)

```bash
# 1. Actualizar schema de Prisma con los cambios
npx prisma db pull

# 2. Generar cliente de Prisma
npx prisma generate

# 3. Ejecutar pruebas de base de datos
npx tsx scripts/test-fase3-database.ts
```

### Opción B: Ejecutar Migraciones Manualmente

```bash
# 1. Verificar que DATABASE_URL esté configurada
echo $DATABASE_URL

# 2. Ejecutar cada migración
psql $DATABASE_URL -f prisma/migrations/20260122_add_estimated_time/migration.sql
psql $DATABASE_URL -f prisma/migrations/20260122_create_station_alerts/migration.sql
psql $DATABASE_URL -f prisma/migrations/20260122_add_metrics_indices/migration.sql
psql $DATABASE_URL -f prisma/migrations/20260122_create_materialized_views/migration.sql

# 3. Actualizar schema de Prisma
npx prisma db pull

# 4. Regenerar cliente
npx prisma generate

# 5. Ejecutar pruebas
npx tsx scripts/test-fase3-database.ts
```

### Opción C: Script Automatizado (Linux/Mac)

```bash
# 1. Dar permisos de ejecución
chmod +x scripts/run-fase3-migrations.sh

# 2. Ejecutar script
bash scripts/run-fase3-migrations.sh

# 3. Actualizar Prisma
npx prisma db pull
npx prisma generate

# 4. Ejecutar pruebas
npx tsx scripts/test-fase3-database.ts
```

---

## 🧪 Pruebas Disponibles

### 1. Pruebas de Base de Datos
```bash
npx tsx scripts/test-fase3-database.ts
```

**Verifica:**
- ✓ Columna `estimated_time` existe
- ✓ Tabla `station_alerts` existe con todas las columnas
- ✓ Índices de performance creados
- ✓ Vistas materializadas creadas
- ✓ Integridad de datos

### 2. Pruebas de APIs (Manual con curl)

#### GET Metrics
```bash
curl -X GET http://localhost:3000/api/admin/stations/{STATION_ID}/metrics \
  -H "Cookie: session=YOUR_SESSION_COOKIE" \
  -H "Content-Type: application/json"
```

#### GET Orders
```bash
curl -X GET "http://localhost:3000/api/admin/stations/{STATION_ID}/orders?limit=20&offset=0" \
  -H "Cookie: session=YOUR_SESSION_COOKIE" \
  -H "Content-Type: application/json"
```

#### GET Alerts
```bash
curl -X GET "http://localhost:3000/api/admin/stations/alerts?severity=HIGH" \
  -H "Cookie: session=YOUR_SESSION_COOKIE" \
  -H "Content-Type: application/json"
```

#### POST Dismiss Alert
```bash
curl -X POST http://localhost:3000/api/admin/stations/alerts/{ALERT_ID}/dismiss \
  -H "Cookie: session=YOUR_SESSION_COOKIE" \
  -H "Content-Type: application/json"
```

#### PUT Update Station (estimated_time)
```bash
curl -X PUT http://localhost:3000/api/admin/stations/{STATION_ID} \
  -H "Cookie: session=YOUR_SESSION_COOKIE" \
  -H "Content-Type: application/json" \
  -d '{"estimated_time": 15}'
```

### 3. Pruebas de Frontend (Después de actualizar componentes)

```bash
# Iniciar servidor de desarrollo
npm run dev

# Navegar a:
# http://localhost:3000/admin/estaciones
```

**Verificar:**
- ✓ Métricas reales en tarjetas de estaciones
- ✓ Órdenes activas con datos reales
- ✓ Alertas con botón de dismiss
- ✓ Estadísticas globales calculadas

---

## 📊 Resultados Esperados

### Base de Datos ✅
```
✓ Columna estimated_time existe
✓ Tabla station_alerts existe (11 columnas)
✓ Índices de performance (5+ índices)
✓ Vistas materializadas (2 vistas)
✓ Integridad de datos verificada
```

### APIs ✅
```
✓ GET /api/admin/stations/:id/metrics → 200 OK
✓ GET /api/admin/stations/:id/orders → 200 OK
✓ GET /api/admin/stations/alerts → 200 OK
✓ POST /api/admin/stations/alerts/:id/dismiss → 200 OK
✓ PUT /api/admin/stations/:id → 200 OK
```

### Frontend ⏳ (Pendiente)
```
⏳ StationCard usa useStationMetrics
⏳ OrdersModal usa useStationOrders
⏳ AlertsPanel usa useStationAlerts
⏳ Global stats calculadas desde datos reales
```

---

## 🐛 Troubleshooting

### Error: "Column estimated_time does not exist"
**Solución:** Ejecutar migración 1
```bash
psql $DATABASE_URL -f prisma/migrations/20260122_add_estimated_time/migration.sql
npx prisma db pull
npx prisma generate
```

### Error: "Table station_alerts does not exist"
**Solución:** Ejecutar migración 2
```bash
psql $DATABASE_URL -f prisma/migrations/20260122_create_station_alerts/migration.sql
npx prisma db pull
npx prisma generate
```

### Error: "Unknown argument estimated_time"
**Solución:** Regenerar cliente de Prisma después de migraciones
```bash
npx prisma db pull
npx prisma generate
```

### Error: "Materialized view does not exist"
**Solución:** Ejecutar migración 4
```bash
psql $DATABASE_URL -f prisma/migrations/20260122_create_materialized_views/migration.sql
```

### Error: "401 Unauthorized" en APIs
**Solución:** Asegurarse de estar autenticado como admin
```bash
# Obtener cookie de sesión desde el navegador
# DevTools → Application → Cookies → session
```

### Error: "Redis connection failed"
**Solución:** Redis usa fallback a memoria, no es crítico
```bash
# Opcional: Iniciar Redis
redis-server

# O configurar REDIS_URL en .env
REDIS_URL=redis://localhost:6379
```

---

## 📝 Checklist de Validación

Antes de continuar con frontend, verificar:

- [ ] ✅ Migraciones ejecutadas sin errores
- [ ] ✅ Schema de Prisma actualizado (`npx prisma db pull`)
- [ ] ✅ Cliente de Prisma regenerado (`npx prisma generate`)
- [ ] ✅ Script de pruebas pasa sin errores
- [ ] ✅ Al menos 1 estación activa en base de datos
- [ ] ✅ Servidor de desarrollo corriendo (`npm run dev`)
- [ ] ✅ Endpoints responden correctamente (probar con curl)

Una vez completado este checklist, proceder a actualizar componentes frontend.

---

## 🎯 Próximo Paso

**Después de ejecutar migraciones y pruebas:**

```bash
# Comando para continuar
"Actualiza los componentes frontend para usar los hooks de datos reales"
```

Esto actualizará:
- `StationCard` → `useStationMetrics`
- `OrdersModal` → `useStationOrders`
- `AlertsPanel` → `useStationAlerts`
- Global stats → Cálculo desde datos reales

---

**Última actualización:** 22 Enero 2026
**Estado:** Esperando ejecución de migraciones
