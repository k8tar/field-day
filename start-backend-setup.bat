@echo off
echo Field Day Logger Backend Service Setup
echo.

echo Checking Rust version...
rustc --version
echo.

echo Select build option:
echo [1] Build with current dependencies (requires Rust 1.82+)
echo [2] Build with simplified dependencies (Rust 1.81+)
echo [3] Skip backend build and use existing binary
echo.

set /p choice="Enter choice (1-3): "

cd /d "%~dp0backend-service"

if "%choice%"=="1" (
    echo Building with current dependencies...
    cargo build --release
) else if "%choice%"=="2" (
    echo Building with simplified dependencies...
    copy Cargo-simple.toml Cargo.toml
    copy src\config_manager_simple.rs src\config_manager.rs
    cargo build --release
) else if "%choice%"=="3" (
    echo Skipping build...
    if not exist "target\release\fieldday-backend.exe" (
        echo ERROR: No existing binary found!
        echo Please choose option 1 or 2 to build the backend.
        pause
        exit /b 1
    )
) else (
    echo Invalid choice!
    pause
    exit /b 1
)

if errorlevel 1 (
    echo.
    echo Build failed! 
    echo.
    echo If you're getting dependency version errors, try:
    echo 1. Update Rust: rustup update
    echo 2. Or use option 2 for simplified dependencies
    echo.
    pause
    exit /b 1
)

echo.
echo Build successful! Starting backend service...
echo.
target\release\fieldday-backend.exe --port 3030 --discovery-port 3030 --verbose

pause
