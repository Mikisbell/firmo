#!/bin/bash
# Ejecutar pruebas funcionales con variables de entorno cargadas

cd /mnt/e/FREECLOUD/FREECLOUD-IA/PROYECTOS/park

# Cargar variables de entorno
export $(grep -v '^#' .env | xargs)

# Ejecutar script
echo "🚀 Iniciando pruebas funcionales..."
echo "Conectando a: $(echo $DIRECT_URL | sed 's/:[^:]*@/:****@/')"
echo ""

node scripts/test-functional-flow.mjs 2>&1
