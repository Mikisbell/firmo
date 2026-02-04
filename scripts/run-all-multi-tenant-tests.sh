#!/bin/bash

# 🧪 Script para ejecutar TODAS las pruebas Multi-Tenant en orden
# 
# Uso: bash scripts/run-all-multi-tenant-tests.sh
# 
# Ejecuta:
# 1. Unit Tests (Vitest)
# 2. Integration Tests (TypeScript)
# 3. Property-Based Tests (fast-check)
# 4. E2E Tests (Playwright)

set -e

echo "🧪 Multi-Tenant Testing Suite"
echo "════════════════════════════════════════════════════════════"
echo ""

# Colores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Contadores
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
TOTAL_TIME=0

# Función para ejecutar pruebas
run_test_suite() {
  local name=$1
  local command=$2
  local start_time=$(date +%s%N)

  echo -e "${YELLOW}▶ $name${NC}"
  echo "  Comando: $command"
  echo ""

  if eval "$command"; then
    local end_time=$(date +%s%N)
    local duration=$(( (end_time - start_time) / 1000000 ))
    echo -e "${GREEN}✅ $name PASSED (${duration}ms)${NC}"
    ((PASSED_TESTS++))
    TOTAL_TIME=$((TOTAL_TIME + duration))
  else
    echo -e "${RED}❌ $name FAILED${NC}"
    ((FAILED_TESTS++))
  fi

  echo ""
  ((TOTAL_TESTS++))
}

# FASE 1: Unit Tests
echo -e "${YELLOW}FASE 1: Unit Tests${NC}"
echo "════════════════════════════════════════════════════════════"
echo ""

run_test_suite \
  "Unit Tests: Provisioning Service" \
  "npm run test -- src/core/tenant/__tests__/provisioning.unit.test.ts --run"

echo ""

# FASE 2: Integration Tests
echo -e "${YELLOW}FASE 2: Integration Tests${NC}"
echo "════════════════════════════════════════════════════════════"
echo ""

run_test_suite \
  "Integration Tests: APIs + Supabase" \
  "npx ts-node scripts/test-multi-tenant-integration.ts"

echo ""

# FASE 3: Property-Based Tests (si existen)
echo -e "${YELLOW}FASE 3: Property-Based Tests${NC}"
echo "════════════════════════════════════════════════════════════"
echo ""

if [ -f "src/core/tenant/__tests__/isolation.property.test.ts" ]; then
  run_test_suite \
    "Property Tests: Tenant Isolation" \
    "npm run test -- src/core/tenant/__tests__/isolation.property.test.ts --run"
else
  echo -e "${YELLOW}⚠ Property tests no encontrados (opcional)${NC}"
fi

echo ""

# FASE 4: E2E Tests
echo -e "${YELLOW}FASE 4: E2E Tests${NC}"
echo "════════════════════════════════════════════════════════════"
echo ""

run_test_suite \
  "E2E Tests: Provisioning UI" \
  "npm run test:e2e -- e2e/multi-tenant-provisioning.spec.ts"

echo ""

# Resumen Final
echo "════════════════════════════════════════════════════════════"
echo -e "${YELLOW}📊 RESUMEN FINAL${NC}"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "Total de suites: $TOTAL_TESTS"
echo -e "${GREEN}✅ Pasadas: $PASSED_TESTS${NC}"
echo -e "${RED}❌ Fallidas: $FAILED_TESTS${NC}"
echo "⏱️  Tiempo total: ${TOTAL_TIME}ms"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
  echo -e "${GREEN}🎉 TODAS LAS PRUEBAS PASARON${NC}"
  echo ""
  exit 0
else
  echo -e "${RED}⚠️  ALGUNAS PRUEBAS FALLARON${NC}"
  echo ""
  exit 1
fi
