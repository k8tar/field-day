# Field Day Logger - Build Installer (PowerShell)
# This script will request administrator privileges if needed

param(
    [switch]$Force
)

# Check if running as administrator
function Test-Administrator {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

# Restart script with administrator privileges if needed
if (-not (Test-Administrator)) {
    Write-Host "Requesting administrator privileges..." -ForegroundColor Yellow
    $scriptPath = $MyInvocation.MyCommand.Path
    Start-Process PowerShell -ArgumentList "-ExecutionPolicy Bypass -File `"$scriptPath`" -Force" -Verb RunAs
    exit
}

Write-Host ""
Write-Host "========================================"
Write-Host " Field Day Logger - Installer Build"
Write-Host "========================================"
Write-Host ""

Write-Host "Running with Administrator privileges..." -ForegroundColor Green
Write-Host ""

# Set working directory to script location
Set-Location $PSScriptRoot

# Check Node.js installation
Write-Host "Checking Node.js installation..." -ForegroundColor Cyan
try {
    $nodeVersion = node --version
    Write-Host "Node.js version: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Node.js is not installed or not in PATH" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Check npm installation
Write-Host "Checking npm installation..." -ForegroundColor Cyan
try {
    $npmVersion = npm --version
    Write-Host "npm version: $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "ERROR: npm is not installed or not in PATH" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""

# Install dependencies
Write-Host "Installing/updating dependencies..." -ForegroundColor Cyan
try {
    npm install
    Write-Host "Dependencies installed successfully." -ForegroundColor Green
} catch {
    Write-Host "ERROR: Failed to install dependencies" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""

# Build Vue.js application
Write-Host "Building Vue.js application..." -ForegroundColor Cyan
try {
    npm run build
    Write-Host "Vue.js application built successfully." -ForegroundColor Green
} catch {
    Write-Host "ERROR: Failed to build Vue.js application" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""

# Build Electron application
Write-Host "Building Electron application and installer..." -ForegroundColor Cyan
Write-Host "This may take several minutes..." -ForegroundColor Yellow
Write-Host ""

try {
    npm run electron:build
    Write-Host ""
    Write-Host "========================================"
    Write-Host " BUILD COMPLETED SUCCESSFULLY!"
    Write-Host "========================================"
    Write-Host ""
} catch {
    Write-Host ""
    Write-Host "ERROR: Failed to build Electron application" -ForegroundColor Red
    Write-Host ""
    Write-Host "Common issues and solutions:" -ForegroundColor Yellow
    Write-Host "- Ensure Windows Defender/Antivirus is not blocking the build"
    Write-Host "- Try running: npm install -g electron-builder"
    Write-Host "- Check if all dependencies are properly installed"
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

# Show build output
if (Test-Path "dist-electron") {
    Write-Host "Build output directory: dist-electron\" -ForegroundColor Green
    Write-Host ""
    Get-ChildItem "dist-electron" | ForEach-Object { Write-Host $_.Name -ForegroundColor Cyan }
    Write-Host ""
    Write-Host "Opening build output folder..." -ForegroundColor Yellow
    Start-Process "dist-electron"
} else {
    Write-Host "WARNING: dist-electron directory not found" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Build process completed. Check the dist-electron folder for your installer." -ForegroundColor Green
Read-Host "Press Enter to exit"
