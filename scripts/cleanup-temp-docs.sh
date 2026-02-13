#!/bin/bash

# Script de Limpieza de Documentación Temporal
# Fecha: 13 Febrero 2026
# Propósito: Mover archivos temporales a backup antes de eliminar

set -e  # Exit on error

echo "🧹 Iniciando limpieza de documentación temporal..."
echo ""

# Crear carpeta de backup con timestamp
BACKUP_DIR="backup/docs-temporales-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo "📦 Creando backup en: $BACKUP_DIR"
echo ""

# Contador de archivos
COUNT=0

# Función para mover archivos
move_files() {
    local pattern=$1
    local description=$2
    
    echo "📁 Moviendo $description..."
    
    # Usar find para manejar patrones correctamente
    find . -maxdepth 1 -name "$pattern" -type f 2>/dev/null | while read -r file; do
        if [ -f "$file" ]; then
            mv "$file" "$BACKUP_DIR/"
            COUNT=$((COUNT + 1))
            echo "  ✓ $file"
        fi
    done
}

# 1. Resúmenes de Sesión (~80 archivos)
echo "1️⃣ Resúmenes de Sesión"
move_files "RESUMEN_SESION_*.md" "resúmenes de sesión"
move_files "SESSION_SUMMARY_*.md" "session summaries"
move_files "RESUMEN_EJECUTIVO_*.md" "resúmenes ejecutivos"
move_files "RESUMEN_FINAL_*.md" "resúmenes finales"
move_files "RESUMEN_COMPLETO_*.md" "resúmenes completos"
move_files "RESUMEN_CORRECCIONES_*.md" "resúmenes de correcciones"
move_files "RESUMEN_FIX_*.md" "resúmenes de fixes"
echo ""

# 2. Fixes Temporales (~50 archivos)
echo "2️⃣ Fixes Temporales"
move_files "FIX_*.md" "fixes"
move_files "SOLUCION_*.md" "soluciones"
move_files "CORRECCION_*.md" "correcciones"
move_files "*_FIX_*.md" "archivos con _FIX_"
move_files "*_FIXED_*.md" "archivos con _FIXED_"
move_files "*_FIXES_*.md" "archivos con _FIXES_"
echo ""

# 3. Análisis Temporales (~30 archivos)
echo "3️⃣ Análisis Temporales"
move_files "ANALISIS_*.md" "análisis"
move_files "DIAGNOSTICO_*.md" "diagnósticos"
move_files "INVESTIGACION_*.md" "investigaciones"
move_files "AUDITORIA_*.md" "auditorías (excepto docs/)"
echo ""

# 4. Progreso/Status Temporales (~20 archivos)
echo "4️⃣ Progreso y Status"
move_files "PROGRESO_*.md" "progreso"
move_files "STATUS_*.md" "status"
move_files "ESTADO_*.md" "estado (excepto docs/)"
echo ""

# 5. Deployment Temporales (~10 archivos)
echo "5️⃣ Deployment Temporales"
move_files "VERCEL_*.md" "vercel"
move_files "DEPLOYMENT_*.md" "deployment (excepto docs/)"
move_files "PRODUCTION_*.md" "production"
echo ""

# 6. Multi-Tenant Temporales
echo "6️⃣ Multi-Tenant Temporales"
move_files "MULTI_TENANT_*.md" "multi-tenant"
move_files "RLS_*.md" "RLS"
move_files "TESTING_*.md" "testing"
move_files "TASK_*.md" "tasks"
echo ""

# 7. Otros Temporales
echo "7️⃣ Otros Temporales"
move_files "WAITER_*.md" "waiter"
move_files "PLAYWRIGHT_*.md" "playwright"
move_files "PRODUCTOS_*.md" "productos"
move_files "FASE_*.md" "fases"
move_files "PHASE*.md" "phases"
move_files "P2_*.md" "P2"
move_files "P3_*.md" "P3"
move_files "ADMIN_*.md" "admin"
move_files "CRITICAL_*.md" "critical"
move_files "COMPREHENSIVE_*.md" "comprehensive"
move_files "COMPLETE_*.md" "complete"
move_files "COMANDOS_*.md" "comandos"
move_files "DEBUG_*.md" "debug"
move_files "BROWSER_*.md" "browser"
move_files "FINAL_*.md" "final"
move_files "NEXT_*.md" "next"
move_files "START_*.md" "start"
move_files "SPEC_*.md" "spec"
move_files "SISTEMA_*.md" "sistema"
move_files "SDET_*.md" "SDET"
move_files "VITEST_*.md" "vitest"
move_files "IMPLEMENTATION_*.md" "implementation"
move_files "CODE_*.md" "code"
move_files "SECURITY_*.md" "security"
move_files "LOGIN_*.md" "login"
move_files "DEVICE_*.md" "device"
move_files "PROBLEMA_*.md" "problema"
move_files "BACKEND_*.md" "backend"
move_files "ACCION_*.md" "accion"
move_files "EXPLICACION_*.md" "explicacion"
move_files "ARQUITECTURA_*.md" "arquitectura"
move_files "ECOSYSTEM_*.md" "ecosystem"
move_files "KIRO_*.md" "kiro"
move_files "NETWORK_*.md" "network"
move_files "AUTOPSY_*.md" "autopsy"
move_files "E2E_*.md" "E2E"
move_files "REALTIME_*.md" "realtime"
move_files "VERIFICACION_*.md" "verificacion"
move_files "VALIDACION_*.md" "validacion"
move_files "PRUEBAS_*.md" "pruebas"
move_files "SUPABASE_*.md" "supabase"
move_files "QUICK_*.md" "quick"
move_files "SESION_*.md" "sesion"
move_files "REPORTE_*.md" "reporte"
move_files "ARCHITECTURE_*.md" "architecture"
move_files "DASHBOARD_*.md" "dashboard"
move_files "DATABASE_*.md" "database"
move_files "DELIVERY_*.md" "delivery"
move_files "DIAGNOSIS_*.md" "diagnosis"
move_files "ESLINT_*.md" "eslint"
move_files "BUILD_*.md" "build"
move_files "CONFIGURACION_*.md" "configuracion"
move_files "CURRENT_*.md" "current"
move_files "REMAINING_*.md" "remaining"
move_files "REDIS_*.md" "redis"
move_files "SAGA_*.md" "saga"
move_files "TAILWIND_*.md" "tailwind"
move_files "TYPESCRIPT_*.md" "typescript"
move_files "POR_*.md" "por"
move_files "PIN_*.md" "pin"
move_files "TODAS_*.md" "todas"
move_files "FASES_*.md" "fases"
move_files "ASSIGNMENT_*.md" "assignment"
move_files "SIDEBAR_*.md" "sidebar"
move_files "ANALYTICS_*.md" "analytics"
move_files "SIGUIENTE_*.md" "siguiente"
move_files "SOLUCIONES_*.md" "soluciones"
echo ""

# Comprimir backup
echo "🗜️  Comprimiendo backup..."
cd backup
tar -czf "docs-temporales-$(date +%Y%m%d-%H%M%S).tar.gz" "$(basename $BACKUP_DIR)"
cd ..
echo ""

# Resumen
echo "✅ Limpieza completada!"
echo ""
echo "📊 Resumen:"
echo "  - Archivos movidos: $COUNT"
echo "  - Backup creado en: $BACKUP_DIR"
echo "  - Backup comprimido: backup/docs-temporales-*.tar.gz"
echo ""
echo "🔍 Para restaurar archivos:"
echo "  cd backup && tar -xzf docs-temporales-*.tar.gz"
echo ""
echo "⚠️  IMPORTANTE: Verifica que docs/HISTORY.md contiene toda la información valiosa"
echo "   antes de eliminar el backup."
echo ""
