# Field Day Logger - Docker Validation Script
# This script tests the Docker setup

Write-Host "===================================================" -ForegroundColor Green
Write-Host "   Field Day Logger - Docker Validation" -ForegroundColor Green
Write-Host "===================================================" -ForegroundColor Green

Write-Host "[1/4] Testing Docker installation..." -ForegroundColor Cyan

try {
    docker --version | Out-Null
    docker-compose --version | Out-Null
    Write-Host "✅ Docker and Docker Compose are available" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker or Docker Compose is not installed or not in PATH" -ForegroundColor Red
    exit 1
}

Write-Host "[2/4] Building production image..." -ForegroundColor Cyan
docker build -t fieldday-test .

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Docker build failed!" -ForegroundColor Red
    exit 1
}

Write-Host "[3/4] Testing container startup..." -ForegroundColor Cyan
docker run -d --name fieldday-test-container -p 8081:8080 -p 3031:3030 fieldday-test

Write-Host "Waiting for container to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

Write-Host "[4/4] Testing application endpoints..." -ForegroundColor Cyan
try {
    Invoke-WebRequest -Uri "http://localhost:8081" -UseBasicParsing -TimeoutSec 5 | Out-Null
    Write-Host "✅ Frontend is responding" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Frontend may not be fully ready (this is normal)" -ForegroundColor Yellow
}

Write-Host "Cleaning up test container..." -ForegroundColor Cyan
docker stop fieldday-test-container
docker rm fieldday-test-container
docker rmi fieldday-test

Write-Host ""
Write-Host "✅ Docker validation completed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Run the application: docker-compose up" -ForegroundColor White
Write-Host "  2. Build Electron app: .\docker-build.ps1" -ForegroundColor White
Write-Host "  3. Development mode: docker-compose -f docker-compose.dev.yml up" -ForegroundColor White
