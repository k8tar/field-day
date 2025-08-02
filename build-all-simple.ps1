# Field Day Logger - Simple Build Script for PowerShell
# This script builds all variants: Web, Electron, and Docker

param(
    [switch]$Help,
    [switch]$SkipWeb,
    [switch]$SkipElectron, 
    [switch]$SkipDocker,
    [switch]$Clean
)

function Show-Help {
    Write-Host "Field Day Logger - Simple Build Script" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Usage: .\build-all-simple.ps1 [options]" -ForegroundColor White
    Write-Host ""
    Write-Host "Options:" -ForegroundColor Yellow
    Write-Host "  -Help         Show this help message" -ForegroundColor Gray
    Write-Host "  -SkipWeb      Skip building the web application" -ForegroundColor Gray
    Write-Host "  -SkipElectron Skip building the Electron application" -ForegroundColor Gray
    Write-Host "  -SkipDocker   Skip building Docker containers" -ForegroundColor Gray
    Write-Host "  -Clean        Clean build directories before building" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Examples:" -ForegroundColor Yellow
    Write-Host "  .\build-all-simple.ps1              # Build everything" -ForegroundColor Gray
    Write-Host "  .\build-all-simple.ps1 -SkipDocker  # Skip Docker builds" -ForegroundColor Gray
    Write-Host "  .\build-all-simple.ps1 -Clean       # Clean and build all" -ForegroundColor Gray
    Write-Host ""
}

if ($Help) {
    Show-Help
    exit 0
}

Write-Host "=== Field Day Logger - Complete Build System ===" -ForegroundColor Cyan
Write-Host ""

# Check prerequisites
Write-Host "Checking prerequisites..." -ForegroundColor Yellow

try {
    $nodeVersion = & node --version 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "* Node.js found: $nodeVersion" -ForegroundColor Green
    } else {
        Write-Host "* Node.js not found. Please install from https://nodejs.org/" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "* Node.js not found. Please install from https://nodejs.org/" -ForegroundColor Red
    exit 1
}

try {
    $npmVersion = & npm --version 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "* npm found: v$npmVersion" -ForegroundColor Green
    } else {
        Write-Host "* npm not found" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "* npm not found" -ForegroundColor Red
    exit 1
}

if (-not $SkipDocker) {
    try {
        $dockerVersion = & docker --version 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "* Docker found: $dockerVersion" -ForegroundColor Green
        } else {
            Write-Host "* Docker not found. Docker builds will be skipped." -ForegroundColor Yellow
            $SkipDocker = $true
        }
    } catch {
        Write-Host "* Docker not found. Docker builds will be skipped." -ForegroundColor Yellow
        $SkipDocker = $true
    }
}

Write-Host ""

# Clean if requested
if ($Clean) {
    Write-Host "Cleaning build directories..." -ForegroundColor Yellow
    if (Test-Path "dist") { Remove-Item -Recurse -Force "dist" }
    if (Test-Path "dist-electron") { Remove-Item -Recurse -Force "dist-electron" }
    Write-Host "* Build directories cleaned" -ForegroundColor Green
    Write-Host ""
}

# Install/update dependencies
Write-Host "Installing dependencies..." -ForegroundColor Yellow

if (-not (Test-Path "node_modules")) {
    Write-Host "  Installing npm packages..." -ForegroundColor Gray
    & npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "* Failed to install dependencies" -ForegroundColor Red
        exit 1
    }
    Write-Host "* Dependencies installed" -ForegroundColor Green
} else {
    Write-Host "  Updating dependencies..." -ForegroundColor Gray
    & npm ci
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  npm ci failed, trying npm install..." -ForegroundColor Yellow
        & npm install
        if ($LASTEXITCODE -ne 0) {
            Write-Host "* Failed to update dependencies" -ForegroundColor Red
            exit 1
        }
    }
    Write-Host "* Dependencies updated" -ForegroundColor Green
}
Write-Host ""

$startTime = Get-Date
$buildResults = @()

# Build Web Application
if (-not $SkipWeb) {
    Write-Host "Building web application..." -ForegroundColor Yellow
    & npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "* Web build failed" -ForegroundColor Red
        exit 1
    } else {
        Write-Host "* Web application built successfully" -ForegroundColor Green
        if (Test-Path "dist") {
            $webSize = [math]::Round((Get-ChildItem -Recurse "dist" -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum / 1MB, 2)
            Write-Host "  Output: ./dist/ ($webSize MB)" -ForegroundColor Gray
            $buildResults += "Web Application: ./dist/ ($webSize MB)"
        }
    }
    Write-Host ""
}

# Build Electron Application  
if (-not $SkipElectron) {
    Write-Host "Building Electron application..." -ForegroundColor Yellow
    
    # Check if electron-builder is available
    try {
        & npx electron-builder --help 2>$null | Out-Null
        if ($LASTEXITCODE -ne 0) {
            Write-Host "  Installing electron-builder..." -ForegroundColor Gray
            & npm install --save-dev electron-builder
            if ($LASTEXITCODE -ne 0) {
                Write-Host "* Failed to install electron-builder" -ForegroundColor Red
                exit 1
            }
        }
    } catch {
        Write-Host "  Installing electron-builder..." -ForegroundColor Gray
        & npm install --save-dev electron-builder
        if ($LASTEXITCODE -ne 0) {
            Write-Host "* Failed to install electron-builder" -ForegroundColor Red
            exit 1
        }
    }
    
    & npm run electron:build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "* Electron build failed - may require additional setup" -ForegroundColor Yellow
        Write-Host "  Note: Electron builds often need platform-specific dependencies" -ForegroundColor Gray
    } else {
        Write-Host "* Electron application built successfully" -ForegroundColor Green
        if (Test-Path "dist-electron") {
            $electronSize = [math]::Round((Get-ChildItem -Recurse "dist-electron" -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum / 1MB, 2)
            Write-Host "  Output: ./dist-electron/ ($electronSize MB)" -ForegroundColor Gray
            $buildResults += "Electron Application: ./dist-electron/ ($electronSize MB)"
        }
    }
    Write-Host ""
}

# Build Docker Containers
if (-not $SkipDocker) {
    Write-Host "Building Docker containers..." -ForegroundColor Yellow
    
    $dockerSuccess = $true
    
    # Build main container
    Write-Host "  Building main application container..." -ForegroundColor Gray
    & docker build -t fieldday-app:latest .
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  * Main container built: fieldday-app:latest" -ForegroundColor Green
    } else {
        Write-Host "  * Main container build failed" -ForegroundColor Red
        $dockerSuccess = $false
    }
    
    # Build build container
    Write-Host "  Building Electron build container..." -ForegroundColor Gray
    & docker build -f Dockerfile.build -t fieldday-builder:latest .
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  * Build container built: fieldday-builder:latest" -ForegroundColor Green
    } else {
        Write-Host "  * Build container build failed" -ForegroundColor Red
        $dockerSuccess = $false
    }
    
    # Build dev container if exists
    if (Test-Path "Dockerfile.dev") {
        Write-Host "  Building development container..." -ForegroundColor Gray
        & docker build -f Dockerfile.dev -t fieldday-dev:latest .
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  * Development container built: fieldday-dev:latest" -ForegroundColor Green
        } else {
            Write-Host "  * Development container build failed" -ForegroundColor Red
            $dockerSuccess = $false
        }
    }
    
    if ($dockerSuccess) {
        Write-Host "* Docker containers built successfully" -ForegroundColor Green
        $buildResults += "Docker Images: fieldday-app:latest, fieldday-builder:latest"
    } else {
        Write-Host "* Some Docker builds failed" -ForegroundColor Yellow
    }
    Write-Host ""
}

# Show summary
$endTime = Get-Date
$duration = $endTime - $startTime
$minutes = [math]::Floor($duration.TotalMinutes)
$seconds = $duration.Seconds

Write-Host "=== Build Complete ===" -ForegroundColor Cyan
Write-Host "Total build time: $minutes`:$($seconds.ToString('00'))" -ForegroundColor Gray
Write-Host ""

if ($buildResults.Count -gt 0) {
    Write-Host "Build outputs:" -ForegroundColor Green
    foreach ($result in $buildResults) {
        Write-Host "  * $result" -ForegroundColor Gray
    }
} else {
    Write-Host "No builds completed successfully." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Build script finished!" -ForegroundColor Cyan
