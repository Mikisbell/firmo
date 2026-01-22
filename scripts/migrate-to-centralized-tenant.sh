#!/bin/bash

# Script para migrar archivos a usar getTenantId() centralizado
# Uso: bash scripts/migrate-to-centralized-tenant.sh

echo "🔄 Migrando archivos a getTenantId() centralizado..."

# Lista de archivos a migrar
files=(
  "src/app/api/admin/reports/route.ts"
  "src/app/api/admin/terminals/route.ts"
  "src/app/api/admin/analytics/top-products/route.ts"
  "src/app/api/admin/analytics/realtime/route.ts"
  "src/app/api/admin/promotions/route.ts"
  "src/app/api/admin/promotions/[id]/route.ts"
  "src/app/api/admin/analytics/hourly/route.ts"
  "src/app/api/admin/products/[id]/route.ts"
  "src/app/api/admin/products/route.ts"
  "src/app/api/admin/analytics/history/route.ts"
  "src/app/api/admin/analytics/comparison/route.ts"
  "src/app/api/admin/employees/route.ts"
  "src/app/api/admin/employees/[id]/route.ts"
  "src/app/api/admin/delivery/metrics/route.ts"
  "src/app/api/admin/dashboard/stats/route.ts"
  "src/app/api/admin/delivery/history/route.ts"
  "src/app/api/admin/delivery/driver-metrics/route.ts"
  "src/app/api/admin/config/route.ts"
  "src/app/api/admin/audit/events/route.ts"
  "src/app/api/admin/audit/alerts/route.ts"
)

count=0

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo "  ✓ Migrando: $file"
    
    # Agregar import si no existe
    if ! grep -q "import { getTenantId }" "$file"; then
      # Buscar la última línea de imports y agregar después
      sed -i "/^import.*from/a import { getTenantId } from '@/src/core/config/tenant';" "$file"
    fi
    
    # Reemplazar const TENANT_ID hardcodeado
    sed -i "s/const TENANT_ID = process\.env\.TENANT_ID || 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';/const TENANT_ID = getTenantId();/" "$file"
    
    ((count++))
  else
    echo "  ⚠ No encontrado: $file"
  fi
done

echo ""
echo "✅ Migración completada: $count archivos actualizados"
echo ""
echo "Próximos pasos:"
echo "1. Verificar cambios: git diff"
echo "2. Ejecutar tests: npm run build"
echo "3. Commitear: git add . && git commit -m 'refactor: migrate to centralized getTenantId()'"
