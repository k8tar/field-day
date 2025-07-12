@echo off
echo Starting Field Day Logger Backend Service...

cd /d "%~dp0backend-service"

if not exist "target\release\fieldday-backend.exe" (
    echo Building backend service...
    cargo build --release
    if errorlevel 1 (
        echo Build failed!
        pause
        exit /b 1
    )
)

echo Starting backend service on port 3030...
target\release\fieldday-backend.exe --port 3030 --discovery-port 3030 --verbose

pause
