# Field Day Logger - Docker Build Script
# This script builds the Electron application using Docker

Write-Host "===================================================" -ForegroundColor Green
Write-Host "   Field Day Logger - Docker Build Pipeline" -ForegroundColor Green
Write-Host "===================================================" -ForegroundColor Green

# Create output directory
if (!(Test-Path "./docker-output")) {
    New-Item -ItemType Directory -Path "./docker-output" -Force
}

Write-Host "[1/2] Building Electron application in Docker container..." -ForegroundColor Cyan
docker build -f Dockerfile.build -t fieldday-builder .

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Docker build failed!" -ForegroundColor Red
    exit 1
}

Write-Host "[2/2] Extracting built application..." -ForegroundColor Cyan
docker run --rm -v "${PWD}/docker-output:/host-output" fieldday-builder

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Application extraction failed!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "✅ Build completed successfully!" -ForegroundColor Green
Write-Host "📦 Built application available in: ./docker-output/" -ForegroundColor Yellow
Write-Host ""
Write-Host "Contents:" -ForegroundColor Cyan
Get-ChildItem "./docker-output/"

Write-Host ""
Write-Host "To run the application in Docker:" -ForegroundColor Cyan
Write-Host "  docker-compose up" -ForegroundColor White
Write-Host ""
Write-Host "To run the application locally:" -ForegroundColor Cyan
Write-Host "  docker run -p 8080:8080 -p 3030:3030 fieldday-app" -ForegroundColor White
