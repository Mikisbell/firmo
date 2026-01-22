#!/bin/bash

# Script to run FASE 3 migrations
# Run: bash scripts/run-fase3-migrations.sh

echo "🚀 Ejecutando migraciones de FASE 3..."
echo "========================================"

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "❌ ERROR: DATABASE_URL no está configurada"
  echo "Configura la variable de entorno DATABASE_URL"
  exit 1
fi

echo "✓ DATABASE_URL configurada"

# Extract database name from DATABASE_URL
DB_NAME=$(echo $DATABASE_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')
echo "✓ Base de datos: $DB_NAME"

echo ""
echo "📋 Migraciones a ejecutar:"
echo "  1. add_estimated_time"
echo "  2. create_station_alerts"
echo "  3. add_metrics_indices"
echo "  4. create_materialized_views"
echo ""

# Migration 1: Add estimated_time column
echo "1️⃣  Agregando columna estimated_time..."
psql $DATABASE_URL -f prisma/migrations/20260122_add_estimated_time/migration.sql
if [ $? -eq 0 ]; then
  echo "   ✓ Migración 1 completada"
else
  echo "   ✗ Error en migración 1"
fi

# Migration 2: Create station_alerts table
echo ""
echo "2️⃣  Creando tabla station_alerts..."
psql $DATABASE_URL -f prisma/migrations/20260122_create_station_alerts/migration.sql
if [ $? -eq 0 ]; then
  echo "   ✓ Migración 2 completada"
else
  echo "   ✗ Error en migración 2"
fi

# Migration 3: Add performance indices
echo ""
echo "3️⃣  Agregando índices de performance..."
psql $DATABASE_URL -f prisma/migrations/20260122_add_metrics_indices/migration.sql
if [ $? -eq 0 ]; then
  echo "   ✓ Migración 3 completada"
else
  echo "   ✗ Error en migración 3"
fi

# Migration 4: Create materialized views
echo ""
echo "4️⃣  Creando vistas materializadas..."
psql $DATABASE_URL -f prisma/migrations/20260122_create_materialized_views/migration.sql
if [ $? -eq 0 ]; then
  echo "   ✓ Migración 4 completada"
else
  echo "   ✗ Error en migración 4"
fi

echo ""
echo "========================================"
echo "✅ Migraciones completadas"
echo ""
echo "📋 Próximos pasos:"
echo "  1. Actualizar schema de Prisma: npx prisma db pull"
echo "  2. Regenerar cliente: npx prisma generate"
echo "  3. Ejecutar pruebas: npx tsx scripts/test-fase3-database.ts"
