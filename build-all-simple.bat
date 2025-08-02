@echo off
REM Field Day Logger - Complete Build Script
REM Builds all variants: Web, Electron, and Docker containers

setlocal

set SKIP_ELECTRON=false
set SKIP_DOCKER=false
set SKIP_WEB=false
set CLEAN_FIRST=false

REM Parse command line arguments
:parse_args
if "%~1"=="" goto start_build
if /i "%~1"=="-SkipElectron" set SKIP_ELECTRON=true && shift && goto parse_args
if /i "%~1"=="-SkipDocker" set SKIP_DOCKER=true && shift && goto parse_args
if /i "%~1"=="-SkipWeb" set SKIP_WEB=true && shift && goto parse_args
if /i "%~1"=="-CleanFirst" set CLEAN_FIRST=true && shift && goto parse_args
if /i "%~1"=="-Help" goto show_help
shift
goto parse_args

:show_help
echo Field Day Logger - Complete Build Script
echo.
echo Usage: build-all-simple.bat [options]
echo.
echo Options:
echo     -SkipElectron    Skip Electron application build
echo     -SkipDocker      Skip Docker container builds
echo     -SkipWeb         Skip web application build
echo     -CleanFirst      Clean build directories before building
echo     -Help            Show this help message
echo.
echo Examples:
echo     build-all-simple.bat                    # Build everything
echo     build-all-simple.bat -SkipDocker        # Build web and Electron only
echo     build-all-simple.bat -CleanFirst        # Clean then build everything
goto :eof

:start_build
echo ==========================================================
echo    Field Day Logger - Complete Build Pipeline
echo ==========================================================
echo.

REM Check Node.js
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js not found. Please install from https://nodejs.org/
    exit /b 1
)
echo ✓ Node.js found

REM Install dependencies if needed
if not exist node_modules (
    echo Installing dependencies...
    npm install
    if %errorlevel% neq 0 (
        echo ERROR: Failed to install dependencies
        exit /b 1
    )
)

REM Clean build directories if requested
if "%CLEAN_FIRST%"=="true" (
    echo Cleaning build directories...
    if exist dist rmdir /s /q dist
    if exist dist-electron rmdir /s /q dist-electron
    if exist docker-output rmdir /s /q docker-output
)

REM Build web application
if "%SKIP_WEB%"=="false" (
    echo Building web application...
    npm run build
    if %errorlevel% neq 0 (
        echo ERROR: Web build failed
        exit /b 1
    )
    echo ✓ Web build complete
)

REM Build Electron application
if "%SKIP_ELECTRON%"=="false" (
    echo Building Electron application...
    npm run electron:build
    if %errorlevel% neq 0 (
        echo Note: Electron build may require additional setup
    ) else (
        echo ✓ Electron build complete
    )
)

REM Build Docker containers
if "%SKIP_DOCKER%"=="false" (
    docker --version >nul 2>&1
    if %errorlevel% neq 0 (
        echo Warning: Docker not found, skipping container builds
    ) else (
        echo Building Docker containers...
        
        echo   Building main application container...
        docker build -t fieldday-app:latest .
        if %errorlevel% equ 0 echo ✓ Main container built
        
        echo   Building Electron build container...
        docker build -f Dockerfile.build -t fieldday-builder:latest .
        if %errorlevel% equ 0 echo ✓ Build container built
        
        if exist Dockerfile.dev (
            echo   Building development container...
            docker build -f Dockerfile.dev -t fieldday-app:dev .
            if %errorlevel% equ 0 echo ✓ Development container built
        )
    )
)

echo.
echo 🚀 Build process complete!
echo.
echo Quick start commands:
echo   npm run dev        # Development server
echo   npm run electron   # Run Electron app
echo   docker-compose up  # Run in Docker
echo.
