# Force Prisma Client Regeneration
# This script attempts to regenerate Prisma Client with retries

Write-Host "🔄 Intentando regenerar Prisma Client..." -ForegroundColor Cyan

# Attempt 1: Try to generate directly
Write-Host "`n📌 Intento 1: Generación directa..." -ForegroundColor Yellow
try {
    npx prisma generate 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Cliente regenerado exitosamente" -ForegroundColor Green
        exit 0
    }
} catch {
    Write-Host "❌ Intento 1 falló" -ForegroundColor Red
}

# Attempt 2: Wait and retry
Write-Host "`n📌 Intento 2: Esperando 2 segundos y reintentando..." -ForegroundColor Yellow
Start-Sleep -Seconds 2
try {
    npx prisma generate 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Cliente regenerado exitosamente" -ForegroundColor Green
        exit 0
    }
} catch {
    Write-Host "❌ Intento 2 falló" -ForegroundColor Red
}

# Attempt 3: Try to remove the .prisma directory
Write-Host "`n📌 Intento 3: Intentando eliminar directorio .prisma..." -ForegroundColor Yellow
$prismaPath = "node_modules\.prisma"
if (Test-Path $prismaPath) {
    try {
        Remove-Item -Path $prismaPath -Recurse -Force -ErrorAction Stop
        Write-Host "✓ Directorio .prisma eliminado" -ForegroundColor Green
        Start-Sleep -Seconds 1
        npx prisma generate
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Cliente regenerado exitosamente" -ForegroundColor Green
            exit 0
        }
    } catch {
        Write-Host "❌ No se pudo eliminar .prisma" -ForegroundColor Red
    }
}

Write-Host "`n❌ No se pudo regenerar el cliente automáticamente" -ForegroundColor Red
Write-Host "`n💡 Solución manual requerida:" -ForegroundColor Yellow
Write-Host "   1. Cierra VSCode completamente (Alt+F4)" -ForegroundColor White
Write-Host "   2. Abre PowerShell en este directorio" -ForegroundColor White
Write-Host "   3. Ejecuta: npx prisma generate" -ForegroundColor White
Write-Host "   4. Abre VSCode de nuevo" -ForegroundColor White

exit 1
