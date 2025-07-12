@echo off
echo ===================================================
echo   Field Day Logger - Complete Startup
echo ===================================================
echo.

echo [1/3] Building Rust Backend Service...
cd /d "%~dp0backend-service"
cargo build --release
if errorlevel 1 (
    echo ERROR: Backend build failed!
    pause
    exit /b 1
)

echo.
echo [2/3] Starting Backend Service...
start "Field Day Backend" cmd /k "target\release\fieldday-backend.exe --port 3030 --discovery-port 3030 --verbose"

echo.
echo [3/3] Starting Frontend Development Server...
cd /d "%~dp0"
timeout /t 5 /nobreak > nul
npm run dev

pause
