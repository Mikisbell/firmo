#!/bin/bash

# Redis Upstash Setup Script
# 
# Este script te guía para configurar Redis en Upstash
# 
# Usage:
#   bash scripts/setup-redis-upstash.sh

echo "🚀 REDIS UPSTASH SETUP"
echo "============================================================"
echo ""

# Check if REDIS_URL is already set
if [ -n "$REDIS_URL" ]; then
    echo "⚠️  REDIS_URL ya está configurado:"
    echo "   $REDIS_URL"
    echo ""
    read -p "¿Deseas reemplazarlo? (y/n): " replace
    if [ "$replace" != "y" ]; then
        echo "❌ Setup cancelado"
        exit 0
    fi
fi

echo "📋 Pasos para configurar Redis en Upstash:"
echo ""
echo "1. Ir a https://console.upstash.com"
echo "2. Crear cuenta (puedes usar GitHub login)"
echo "3. Click 'Create Database'"
echo "4. Configuración recomendada:"
echo "   - Name: park-pos-delivery"
echo "   - Type: Regional"
echo "   - Region: us-east-1 (o más cercano a tu Supabase)"
echo "   - TLS: Enabled"
echo "   - Eviction: allkeys-lru"
echo "5. Click 'Create'"
echo "6. En la página de la database, copiar 'Redis URL'"
echo ""

read -p "¿Ya creaste la database en Upstash? (y/n): " created

if [ "$created" != "y" ]; then
    echo ""
    echo "❌ Por favor crea la database primero y vuelve a ejecutar este script"
    exit 0
fi

echo ""
echo "📝 Ingresa tu REDIS_URL de Upstash:"
echo "   (Formato: rediss://default:password@host.upstash.io:6379)"
echo ""
read -p "REDIS_URL: " redis_url

if [ -z "$redis_url" ]; then
    echo "❌ REDIS_URL no puede estar vacío"
    exit 1
fi

# Validate format
if [[ ! "$redis_url" =~ ^redis ]]; then
    echo "❌ REDIS_URL debe comenzar con 'redis://' o 'rediss://'"
    exit 1
fi

echo ""
echo "✅ REDIS_URL válido"
echo ""

# Update .env file
if [ -f ".env" ]; then
    echo "📝 Actualizando .env..."
    
    # Check if REDIS_URL exists in .env
    if grep -q "^REDIS_URL=" .env; then
        # Replace existing
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS
            sed -i '' "s|^REDIS_URL=.*|REDIS_URL=\"$redis_url\"|" .env
        else
            # Linux
            sed -i "s|^REDIS_URL=.*|REDIS_URL=\"$redis_url\"|" .env
        fi
        echo "✅ REDIS_URL actualizado en .env"
    else
        # Append
        echo "" >> .env
        echo "# Redis Configuration (Upstash)" >> .env
        echo "REDIS_URL=\"$redis_url\"" >> .env
        echo "✅ REDIS_URL agregado a .env"
    fi
else
    echo "⚠️  Archivo .env no encontrado, creando..."
    echo "# Redis Configuration (Upstash)" > .env
    echo "REDIS_URL=\"$redis_url\"" >> .env
    echo "✅ Archivo .env creado con REDIS_URL"
fi

echo ""
echo "🧪 Probando conexión Redis..."
echo ""

# Test connection
npx tsx scripts/test-redis-connection.ts

if [ $? -eq 0 ]; then
    echo ""
    echo "============================================================"
    echo "✅ REDIS CONFIGURADO EXITOSAMENTE"
    echo "============================================================"
    echo ""
    echo "📋 Próximos pasos:"
    echo ""
    echo "1. Configurar en Vercel:"
    echo "   - Ir a tu proyecto en Vercel"
    echo "   - Settings → Environment Variables"
    echo "   - Agregar: REDIS_URL = $redis_url"
    echo ""
    echo "2. Deploy:"
    echo "   git add .env"
    echo "   git commit -m \"feat: configure Redis for production\""
    echo "   git push"
    echo ""
    echo "3. Verificar en producción:"
    echo "   - Ver logs en Vercel"
    echo "   - Buscar: 'Delivery Redis connected successfully'"
    echo ""
else
    echo ""
    echo "❌ Error al probar conexión Redis"
    echo "   Verifica que el REDIS_URL sea correcto"
    exit 1
fi
