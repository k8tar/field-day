@echo off
REM Field Day Logger - Build Installer with Administrator Privileges
REM This script must be run as Administrator

echo.
echo ========================================
echo  Field Day Logger - Installer Build
echo ========================================
echo.

REM Check if running as administrator
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: This script must be run as Administrator!
    echo Right-click and select "Run as administrator"
    pause
    exit /b 1
)

echo Running with Administrator privileges...
echo.

REM Set working directory
cd /d "%~dp0"

REM Check Node.js installation
echo Checking Node.js installation...
node --version >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: Node.js is not installed or not in PATH
    pause
    exit /b 1
)

echo Node.js version:
node --version
echo.

REM Check npm installation
echo Checking npm installation...
npm --version >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: npm is not installed or not in PATH
    pause
    exit /b 1
)

echo npm version:
npm --version
echo.

REM Install dependencies if needed
echo Installing/updating dependencies...
npm install
if %errorLevel% neq 0 (
    echo ERROR: Failed to install dependencies
    pause
    exit /b 1
)

echo.
echo Dependencies installed successfully.
echo.

REM Build the Vue.js application
echo Building Vue.js application...
npm run build
if %errorLevel% neq 0 (
    echo ERROR: Failed to build Vue.js application
    pause
    exit /b 1
)

echo.
echo Vue.js application built successfully.
echo.

REM Build the Electron application and installer
echo Building Electron application and installer...
echo This may take several minutes...
echo.

npm run electron:build
if %errorLevel% neq 0 (
    echo ERROR: Failed to build Electron application
    echo.
    echo Common issues and solutions:
    echo - Ensure Windows Defender/Antivirus is not blocking the build
    echo - Try running: npm install -g electron-builder
    echo - Check if all dependencies are properly installed
    echo.
    pause
    exit /b 1
)

echo.
echo ========================================
echo  BUILD COMPLETED SUCCESSFULLY!
echo ========================================
echo.

REM Show build output location
if exist "dist-electron" (
    echo Build output directory: dist-electron\
    echo.
    dir /b dist-electron\
    echo.
    echo Opening build output folder...
    explorer "dist-electron"
) else (
    echo WARNING: dist-electron directory not found
)

echo.
echo Build process completed. Check the dist-electron folder for your installer.
pause
