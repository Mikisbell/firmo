# Redis Upstash Setup Script (PowerShell)
# 
# Este script te guía para configurar Redis en Upstash
# 
# Usage:
#   .\scripts\setup-redis-upstash.ps1

Write-Host "🚀 REDIS UPSTASH SETUP" -ForegroundColor Cyan
Write-Host "============================================================"
Write-Host ""

# Check if REDIS_URL is already set
if ($env:REDIS_URL) {
    Write-Host "⚠️  REDIS_URL ya está configurado:" -ForegroundColor Yellow
    Write-Host "   $env:REDIS_URL"
    Write-Host ""
    $replace = Read-Host "¿Deseas reemplazarlo? (y/n)"
    if ($replace -ne "y") {
        Write-Host "❌ Setup cancelado" -ForegroundColor Red
        exit 0
    }
}

Write-Host "📋 Pasos para configurar Redis en Upstash:" -ForegroundColor White
Write-Host ""
Write-Host "1. Ir a https://console.upstash.com"
Write-Host "2. Crear cuenta (puedes usar GitHub login)"
Write-Host "3. Click 'Create Database'"
Write-Host "4. Configuración recomendada:"
Write-Host "   - Name: park-pos-delivery"
Write-Host "   - Type: Regional"
Write-Host "   - Region: us-east-1 (o más cercano a tu Supabase)"
Write-Host "   - TLS: Enabled"
Write-Host "   - Eviction: allkeys-lru"
Write-Host "5. Click 'Create'"
Write-Host "6. En la página de la database, copiar 'Redis URL'"
Write-Host ""

$created = Read-Host "¿Ya creaste la database en Upstash? (y/n)"

if ($created -ne "y") {
    Write-Host ""
    Write-Host "❌ Por favor crea la database primero y vuelve a ejecutar este script" -ForegroundColor Red
    exit 0
}

Write-Host ""
Write-Host "📝 Ingresa tu REDIS_URL de Upstash:" -ForegroundColor White
Write-Host "   (Formato: rediss://default:password@host.upstash.io:6379)"
Write-Host ""
$redis_url = Read-Host "REDIS_URL"

if ([string]::IsNullOrWhiteSpace($redis_url)) {
    Write-Host "❌ REDIS_URL no puede estar vacío" -ForegroundColor Red
    exit 1
}

# Validate format
if (-not ($redis_url -match "^redis")) {
    Write-Host "❌ REDIS_URL debe comenzar con 'redis://' o 'rediss://'" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "✅ REDIS_URL válido" -ForegroundColor Green
Write-Host ""

# Update .env file
if (Test-Path ".env") {
    Write-Host "📝 Actualizando .env..." -ForegroundColor White
    
    $envContent = Get-Content ".env" -Raw
    
    # Check if REDIS_URL exists in .env
    if ($envContent -match "^REDIS_URL=") {
        # Replace existing
        $envContent = $envContent -replace "^REDIS_URL=.*", "REDIS_URL=`"$redis_url`""
        Set-Content ".env" -Value $envContent -NoNewline
        Write-Host "✅ REDIS_URL actualizado en .env" -ForegroundColor Green
    } else {
        # Append
        Add-Content ".env" -Value "`n# Redis Configuration (Upstash)"
        Add-Content ".env" -Value "REDIS_URL=`"$redis_url`""
        Write-Host "✅ REDIS_URL agregado a .env" -ForegroundColor Green
    }
} else {
    Write-Host "⚠️  Archivo .env no encontrado, creando..." -ForegroundColor Yellow
    Set-Content ".env" -Value "# Redis Configuration (Upstash)"
    Add-Content ".env" -Value "REDIS_URL=`"$redis_url`""
    Write-Host "✅ Archivo .env creado con REDIS_URL" -ForegroundColor Green
}

Write-Host ""
Write-Host "🧪 Probando conexión Redis..." -ForegroundColor White
Write-Host ""

# Test connection
npx tsx scripts/test-redis-connection.ts

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Cyan
    Write-Host "✅ REDIS CONFIGURADO EXITOSAMENTE" -ForegroundColor Green
    Write-Host "============================================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "📋 Próximos pasos:" -ForegroundColor White
    Write-Host ""
    Write-Host "1. Configurar en Vercel:"
    Write-Host "   - Ir a tu proyecto en Vercel"
    Write-Host "   - Settings → Environment Variables"
    Write-Host "   - Agregar: REDIS_URL = $redis_url"
    Write-Host ""
    Write-Host "2. Deploy:"
    Write-Host "   git add .env"
    Write-Host "   git commit -m `"feat: configure Redis for production`""
    Write-Host "   git push"
    Write-Host ""
    Write-Host "3. Verificar en producción:"
    Write-Host "   - Ver logs en Vercel"
    Write-Host "   - Buscar: 'Delivery Redis connected successfully'"
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "❌ Error al probar conexión Redis" -ForegroundColor Red
    Write-Host "   Verifica que el REDIS_URL sea correcto"
    exit 1
}
