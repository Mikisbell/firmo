#!/bin/bash
# Migration script for FASE 3: KDS Stations Real-Time Integration
# Created: 22 Enero 2026

set -e  # Exit on error

echo "🚀 Starting FASE 3 migrations..."
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "❌ ERROR: DATABASE_URL environment variable is not set"
  exit 1
fi

echo "📊 Database: $DATABASE_URL"
echo ""

# Function to run a migration
run_migration() {
  local migration_name=$1
  local migration_file=$2
  
  echo "▶️  Running migration: $migration_name"
  psql "$DATABASE_URL" -f "$migration_file"
  
  if [ $? -eq 0 ]; then
    echo "✅ $migration_name completed successfully"
  else
    echo "❌ $migration_name failed"
    exit 1
  fi
  echo ""
}

# Run migrations in order
echo "📝 Step 1/4: Adding estimated_time column to stations table..."
run_migration "Add estimated_time" "prisma/migrations/20260122_add_estimated_time/migration.sql"

echo "📝 Step 2/4: Creating station_alerts table..."
run_migration "Create station_alerts" "prisma/migrations/20260122_create_station_alerts/migration.sql"

echo "📝 Step 3/4: Adding performance indices..."
run_migration "Add metrics indices" "prisma/migrations/20260122_add_metrics_indices/migration.sql"

echo "📝 Step 4/4: Creating materialized views..."
run_migration "Create materialized views" "prisma/migrations/20260122_create_materialized_views/migration.sql"

echo ""
echo "🎉 All migrations completed successfully!"
echo ""

# Verify schema changes
echo "🔍 Verifying schema changes..."
echo ""

echo "Checking stations table..."
psql "$DATABASE_URL" -c "\d stations" | grep estimated_time
if [ $? -eq 0 ]; then
  echo "✅ estimated_time column exists"
else
  echo "❌ estimated_time column not found"
  exit 1
fi

echo ""
echo "Checking station_alerts table..."
psql "$DATABASE_URL" -c "\d station_alerts" > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo "✅ station_alerts table exists"
else
  echo "❌ station_alerts table not found"
  exit 1
fi

echo ""
echo "Checking materialized views..."
psql "$DATABASE_URL" -c "\d station_hourly_metrics" > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo "✅ station_hourly_metrics view exists"
else
  echo "❌ station_hourly_metrics view not found"
  exit 1
fi

psql "$DATABASE_URL" -c "\d station_daily_summary" > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo "✅ station_daily_summary view exists"
else
  echo "❌ station_daily_summary view not found"
  exit 1
fi

echo ""
echo "🎊 FASE 3 database setup complete!"
echo ""
echo "📋 Next steps:"
echo "  1. Refresh materialized views: REFRESH MATERIALIZED VIEW CONCURRENTLY station_hourly_metrics;"
echo "  2. Set up cron jobs for automatic refresh"
echo "  3. Update Prisma schema to include new fields"
echo "  4. Run: npx prisma generate"
echo ""
