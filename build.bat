@echo off
echo ========================================
echo  Field Day Logger - Quick Build Script
echo ========================================
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo ✓ Node.js found: 
node --version

REM Install dependencies if node_modules doesn't exist
if not exist node_modules (
    echo.
    echo Installing dependencies...
    npm install
    if %errorlevel% neq 0 (
        echo ERROR: Failed to install dependencies
        pause
        exit /b 1
    )
    echo ✓ Dependencies installed
)

REM Build the Vue.js application
echo.
echo Building Vue.js application...
npm run build
if %errorlevel% neq 0 (
    echo ERROR: Failed to build Vue.js application
    pause
    exit /b 1
)
echo ✓ Vue.js application built

REM Install electron-builder if not already installed
npm list electron-builder >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo Installing electron-builder...
    npm install --save-dev electron-builder concurrently wait-on
    if %errorlevel% neq 0 (
        echo ERROR: Failed to install electron-builder
        pause
        exit /b 1
    )
    echo ✓ electron-builder installed
)

REM Update package.json with build configuration
echo.
echo Updating package.json for Electron build...
copy /Y package-build.json package.json
echo ✓ Package.json updated

REM Build Electron application
echo.
echo Building Electron application...
npm run electron:pack
if %errorlevel% neq 0 (
    echo ERROR: Failed to build Electron application
    pause
    exit /b 1
)
echo ✓ Electron application built

REM Check if Inno Setup is available
iscc /? >nul 2>&1
if %errorlevel% equ 0 (
    echo.
    echo Creating Windows installer with Inno Setup...
    iscc installer\field-day-logger.iss
    if %errorlevel% equ 0 (
        echo ✓ Windows installer created
    ) else (
        echo WARNING: Failed to create installer, but application was built successfully
    )
) else (
    echo.
    echo WARNING: Inno Setup not found - skipping installer creation
    echo To create an installer, install Inno Setup from https://jrsoftware.org/isinfo.php
)

echo.
echo ========================================
echo  Build Complete!
echo ========================================
echo.
echo Built files location:
echo - Electron app: dist-electron\
if exist installer\*.exe echo - Windows installer: installer\
echo.
echo You can now distribute these files.
echo.
pause
