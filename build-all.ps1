# Field Day Logger - Complete Build Script
# Builds all variants: Web, Electron, and Docker containers

param(
    [switch]$SkipElectron,
    [switch]$SkipDocker,
    [switch]$SkipWeb,
    [switch]$CleanFirst,
    [switch]$Help
)

# Set error handling
$ErrorActionPreference = "Stop"

function Show-Help {
    Write-Host @"
Field Day Logger - Complete Build Script

Usage: .\build-all.ps1 [options]

Options:
    -SkipElectron    Skip Electron application build
    -SkipDocker      Skip Docker container builds
    -SkipWeb         Skip web application build
    -CleanFirst      Clean build directories before building
    -Help            Show this help message

Examples:
    .\build-all.ps1                    # Build everything
    .\build-all.ps1 -SkipDocker        # Build web and Electron only
    .\build-all.ps1 -CleanFirst        # Clean then build everything
"@
}

function Test-Prerequisites {
    Write-Host "[PREREQ] Checking prerequisites..." -ForegroundColor Cyan
    
    # Check Node.js
    try {
        $nodeVersion = & node --version 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "[OK] Node.js found: $nodeVersion" -ForegroundColor Green
        } else {
            throw "Node.js command failed"
        }
    } catch {
        Write-Host "[ERROR] Node.js not found. Please install from https://nodejs.org/" -ForegroundColor Red
        exit 1
    }
    
    # Check npm
    try {
        $npmVersion = & npm --version 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "[OK] npm found: v$npmVersion" -ForegroundColor Green
        } else {
            throw "npm command failed"
        }
    } catch {
        Write-Host "[ERROR] npm not found" -ForegroundColor Red
        exit 1
    }
    
    # Check Docker (only if not skipping Docker builds)
    if (-not $SkipDocker) {
        try {
            $dockerVersion = & docker --version 2>$null
            if ($LASTEXITCODE -eq 0) {
                Write-Host "[OK] Docker found: $dockerVersion" -ForegroundColor Green
            } else {
                Write-Host "[WARNING] Docker not found. Docker builds will be skipped." -ForegroundColor Yellow
                $script:SkipDocker = $true
            }
        } catch {
            Write-Host "[WARNING] Docker not found. Docker builds will be skipped." -ForegroundColor Yellow
            $script:SkipDocker = $true
        }
    }
    
    Write-Host ""
}

function Invoke-CleanBuild {
    Write-Host "[CLEAN] Cleaning build directories..." -ForegroundColor Cyan
    
    $dirsToClean = @("dist", "dist-electron", "docker-output", "build")
    
    foreach ($dir in $dirsToClean) {
        if (Test-Path $dir) {
            Write-Host "  Removing $dir..." -ForegroundColor Yellow
            Remove-Item -Recurse -Force $dir -ErrorAction SilentlyContinue
        }
    }
    
    Write-Host "[OK] Build directories cleaned" -ForegroundColor Green
    Write-Host ""
}

function Install-Dependencies {
    Write-Host "[DEPS] Installing dependencies..." -ForegroundColor Cyan
    
    if (-not (Test-Path "node_modules")) {
        Write-Host "  Installing npm packages..." -ForegroundColor Yellow
        & npm install
        if ($LASTEXITCODE -ne 0) {
            Write-Host "[ERROR] Failed to install dependencies" -ForegroundColor Red
            exit 1
        }
        Write-Host "[OK] Dependencies installed" -ForegroundColor Green
    } else {
        Write-Host "  Updating dependencies..." -ForegroundColor Yellow
        & npm ci
        if ($LASTEXITCODE -ne 0) {
            Write-Host "[WARNING] npm ci failed, trying npm install..." -ForegroundColor Yellow
            & npm install
            if ($LASTEXITCODE -ne 0) {
                Write-Host "[ERROR] Failed to update dependencies" -ForegroundColor Red
                exit 1
            }
        }
        Write-Host "[OK] Dependencies updated" -ForegroundColor Green
    }
    
    Write-Host ""
}

function Build-WebApp {
    Write-Host "[WEB] Building web application..." -ForegroundColor Cyan
    
    & npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Web build failed" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "[OK] Web application built successfully" -ForegroundColor Green
    if (Test-Path "dist") {
        $webSize = [math]::Round((Get-ChildItem -Recurse "dist" -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum / 1MB, 2)
        Write-Host "  Output: ./dist/ $webSize MB" -ForegroundColor Gray
    }
    Write-Host ""
}


function Build-ElectronApp {
    Write-Host "[ELECTRON] Building Electron application..." -ForegroundColor Cyan
    
    # Check if electron-builder is available
    try {
        & npx electron-builder --help 2>$null | Out-Null
        if ($LASTEXITCODE -ne 0) {
            Write-Host "  Installing electron-builder..." -ForegroundColor Yellow
            & npm install --save-dev electron-builder
            if ($LASTEXITCODE -ne 0) {
                Write-Host "[ERROR] Failed to install electron-builder" -ForegroundColor Red
                exit 1
            }
        }
    } catch {
        Write-Host "  Installing electron-builder..." -ForegroundColor Yellow
        & npm install --save-dev electron-builder
        if ($LASTEXITCODE -ne 0) {
            Write-Host "[ERROR] Failed to install electron-builder" -ForegroundColor Red
            exit 1
        }
    }
    
    # Build for current platform
    & npm run electron:build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[WARNING] Electron build failed - may require additional setup" -ForegroundColor Yellow
        Write-Host "  Note: Electron builds often need platform-specific dependencies" -ForegroundColor Gray
    } else {
        Write-Host "[OK] Electron application built successfully" -ForegroundColor Green
        if (Test-Path "dist-electron") {
            $electronSize = [math]::Round((Get-ChildItem -Recurse "dist-electron" -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum / 1MB, 2)
            Write-Host "  Output: ./dist-electron/ $electronSize MB" -ForegroundColor Gray
        }
    }
    Write-Host ""
}


function Build-DockerContainers {
    Write-Host "[DOCKER] Building Docker containers..." -ForegroundColor Cyan
    
    $success = $true
    
    # Build the main application container
    Write-Host "  Building main application container..." -ForegroundColor Yellow
    & docker build -t fieldday-app:latest .
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  [OK] Main container built: fieldday-app:latest" -ForegroundColor Green
    } else {
        Write-Host "  [ERROR] Main container build failed" -ForegroundColor Red
        $success = $false
    }
    
    # Build the build container
    Write-Host "  Building Electron build container..." -ForegroundColor Yellow
    & docker build -f Dockerfile.build -t fieldday-builder:latest .
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  [OK] Build container built: fieldday-builder:latest" -ForegroundColor Green
    } else {
        Write-Host "  [ERROR] Build container build failed" -ForegroundColor Red
        $success = $false
    }
    
    # Build development container if exists
    if (Test-Path "Dockerfile.dev") {
        Write-Host "  Building development container..." -ForegroundColor Yellow
        & docker build -f Dockerfile.dev -t fieldday-app:dev .
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  [OK] Development container built: fieldday-app:dev" -ForegroundColor Green
        } else {
            Write-Host "  [ERROR] Development container build failed" -ForegroundColor Yellow
        }
    }
    
    if ($success) {
        Write-Host "[OK] Docker containers built successfully" -ForegroundColor Green
    } else {
        Write-Host "[WARNING] Some Docker builds failed" -ForegroundColor Yellow
    }
    Write-Host ""
}

function Show-BuildSummary {
    Write-Host @"
===========================================================
   Build Summary
===========================================================
"@ -ForegroundColor Green
    
    $buildOutputs = @()
    
    if (-not $SkipWeb -and (Test-Path "dist")) {
        $webSize = [math]::Round((Get-ChildItem -Recurse "dist" -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum / 1MB, 2)
        $buildOutputs += "[OK] Web Application: ./dist/ ($webSize MB)"
    }
    
    if (-not $SkipElectron -and (Test-Path "dist-electron")) {
        $electronSize = [math]::Round((Get-ChildItem -Recurse "dist-electron" -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum / 1MB, 2)
        $buildOutputs += "[OK] Electron Application: ./dist-electron/ ($electronSize MB)"
    }
    
    if (-not $SkipDocker) {
        try {
            $dockerImages = & docker images fieldday-* --format "{{.Repository}}:{{.Tag}} ({{.Size}})" 2>$null
            if ($dockerImages) {
                $buildOutputs += "[OK] Docker Images:"
                foreach ($image in $dockerImages) {
                    $buildOutputs += "  - $image"
                }
            }
        } catch {
            # Ignore docker command errors
        }
    }
    
    if ($buildOutputs.Count -gt 0) {
        foreach ($output in $buildOutputs) {
            Write-Host $output -ForegroundColor Green
        }
    } else {
        Write-Host "No build outputs found" -ForegroundColor Yellow
    }
    
    Write-Host ""
    Write-Host "[DONE] All builds completed!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Quick start commands:" -ForegroundColor Cyan
    Write-Host "  npm run dev        # Development server" -ForegroundColor Gray
    Write-Host "  npm run serve      # Preview built web app" -ForegroundColor Gray
    Write-Host "  npm run electron   # Run Electron app" -ForegroundColor Gray
    Write-Host "  docker-compose up  # Run in Docker" -ForegroundColor Gray
    Write-Host ""
}

# Main execution
if ($Help) {
    Show-Help
    exit 0
}

try {
    $startTime = Get-Date
    
    Write-Host @"
===========================================================
   Field Day Logger - Complete Build Pipeline
===========================================================
"@ -ForegroundColor Green
    
    Test-Prerequisites
    
    if ($CleanFirst) {
        Invoke-CleanBuild
    }
    
    Install-Dependencies
    
    if (-not $SkipWeb) {
        Build-WebApp
    }
    
    if (-not $SkipElectron) {
        Build-ElectronApp
    }
    
    if (-not $SkipDocker) {
        Build-DockerContainers
    }
    
    $endTime = Get-Date
    $duration = $endTime - $startTime
    $minutes = [math]::Floor($duration.TotalMinutes)
    $seconds = $duration.Seconds

    Write-Host "Total build time: $minutes`:$($seconds.ToString('00'))" -ForegroundColor Cyan

    Show-BuildSummary
    
} catch {
    Write-Host ""
    Write-Host "[ERROR] Build failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Stack trace:" -ForegroundColor Gray
    Write-Host $_.ScriptStackTrace -ForegroundColor Gray
    exit 1
}
