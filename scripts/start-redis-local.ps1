# Start Redis Locally with Docker
# 
# Usage:
#   .\scripts\start-redis-local.ps1

Write-Host "🚀 Starting Redis locally with Docker..." -ForegroundColor Cyan
Write-Host ""

# Check if Docker is installed
try {
    docker --version | Out-Null
    Write-Host "✅ Docker is installed" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker is not installed" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install Docker Desktop from:" -ForegroundColor Yellow
    Write-Host "https://www.docker.com/products/docker-desktop" -ForegroundColor Cyan
    exit 1
}

# Check if Docker is running
try {
    docker ps | Out-Null
    Write-Host "✅ Docker is running" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker is not running" -ForegroundColor Red
    Write-Host "Please start Docker Desktop and try again" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "📦 Starting Redis container..." -ForegroundColor White

# Start Redis with docker-compose
docker-compose -f docker-compose.redis.yml up -d

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Redis started successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📊 Connection Info:" -ForegroundColor White
    Write-Host "   URL: redis://localhost:6379" -ForegroundColor Cyan
    Write-Host "   Container: park-pos-redis" -ForegroundColor Cyan
    Write-Host ""
    
    # Update .env file
    Write-Host "📝 Updating .env file..." -ForegroundColor White
    
    $redisUrl = "redis://localhost:6379"
    
    if (Test-Path ".env") {
        $envContent = Get-Content ".env" -Raw
        
        if ($envContent -match "REDIS_URL=") {
            # Replace existing REDIS_URL
            $pattern = 'REDIS_URL="[^"]*"'
            $replacement = "REDIS_URL=`"$redisUrl`""
            $envContent = $envContent -replace $pattern, $replacement
            Set-Content ".env" -Value $envContent -NoNewline
            Write-Host "✅ REDIS_URL updated in .env" -ForegroundColor Green
        } else {
            # Add REDIS_URL
            Add-Content ".env" -Value ""
            Add-Content ".env" -Value "# Redis Configuration (Local)"
            Add-Content ".env" -Value "REDIS_URL=`"$redisUrl`""
            Write-Host "✅ REDIS_URL added to .env" -ForegroundColor Green
        }
    } else {
        # Create .env file
        Set-Content ".env" -Value "# Redis Configuration (Local)"
        Add-Content ".env" -Value "REDIS_URL=`"$redisUrl`""
        Write-Host "✅ .env file created with REDIS_URL" -ForegroundColor Green
    }
    
    Write-Host ""
    Write-Host "🧪 Testing connection..." -ForegroundColor White
    Start-Sleep -Seconds 2
    
    npx tsx scripts/test-redis-connection.ts
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "============================================================" -ForegroundColor Cyan
        Write-Host "✅ REDIS CONFIGURED AND RUNNING!" -ForegroundColor Green
        Write-Host "============================================================" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "📋 Useful commands:" -ForegroundColor White
        Write-Host ""
        Write-Host "Stop Redis:" -ForegroundColor Yellow
        Write-Host "  docker-compose -f docker-compose.redis.yml down" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "View logs:" -ForegroundColor Yellow
        Write-Host "  docker logs park-pos-redis" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "Redis CLI:" -ForegroundColor Yellow
        Write-Host "  docker exec -it park-pos-redis redis-cli" -ForegroundColor Cyan
        Write-Host ""
    }
} else {
    Write-Host ""
    Write-Host "❌ Failed to start Redis" -ForegroundColor Red
    Write-Host "Check Docker logs for details" -ForegroundColor Yellow
    exit 1
}
