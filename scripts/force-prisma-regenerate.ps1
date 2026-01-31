# Script para forzar regeneración de Prisma Client
# Uso: .\scripts\force-prisma-regenerate.ps1

Write-Host "🔄 Forzando regeneración de Prisma Client..." -ForegroundColor Cyan

# Paso 1: Intentar detener procesos Node.js
Write-Host "`n📌 Paso 1: Verificando procesos Node.js..." -ForegroundColor Yellow
$nodeProcesses = Get-Process -Name node -ErrorAction SilentlyContinue
if ($nodeProcesses) {
    Write-Host "⚠️  Procesos Node.js encontrados:" -ForegroundColor Yellow
    $nodeProcesses | Format-Table Id, ProcessName, StartTime
    
    $response = Read-Host "¿Deseas cerrar estos procesos? (S/N)"
    if ($response -eq "S" -or $response -eq "s") {
        Stop-Process -Name node -Force -ErrorAction SilentlyContinue
        Write-Host "✓ Procesos cerrados" -ForegroundColor Green
        Start-Sleep -Seconds 2
    }
} else {
    Write-Host "✓ No hay procesos Node.js corriendo" -ForegroundColor Green
}

# Paso 2: Eliminar directorio .prisma
Write-Host "`n📌 Paso 2: Eliminando directorio .prisma..." -ForegroundColor Yellow
$prismaPath = "node_modules\.prisma"
if (Test-Path $prismaPath) {
    try {
        Remove-Item -Path $prismaPath -Recurse -Force -ErrorAction Stop
        Write-Host "✓ Directorio .prisma eliminado" -ForegroundColor Green
    } catch {
        Write-Host "⚠️  No se pudo eliminar .prisma (puede estar en uso)" -ForegroundColor Yellow
        Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
    }
} else {
    Write-Host "✓ Directorio .prisma no existe" -ForegroundColor Green
}

# Paso 3: Regenerar cliente
Write-Host "`n📌 Paso 3: Regenerando cliente de Prisma..." -ForegroundColor Yellow
try {
    npx prisma generate
    Write-Host "✓ Cliente regenerado exitosamente" -ForegroundColor Green
} catch {
    Write-Host "❌ Error al regenerar cliente" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Paso 4: Verificar
Write-Host "`n📌 Paso 4: Verificando..." -ForegroundColor Yellow
Write-Host "Ejecutando pruebas de base de datos..." -ForegroundColor Cyan
npx tsx scripts/test-fase3-database.ts

Write-Host "`n✅ Proceso completado" -ForegroundColor Green
