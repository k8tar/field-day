@echo off
REM Windows Firewall Configuration for Field Day Logger (Port 8080 Only)
REM This script opens port 8080 for Field Day Logger communication
REM Run as Administrator

echo ========================================
echo Field Day Logger - Windows Firewall Setup
echo ========================================
echo.
echo This script will open Windows Firewall port for Field Day Logger instances
echo to communicate with each other on the local network.
echo.
echo Port to be opened:
echo - 8080 (TCP) - All Field Day instances (hardcoded, HTTPS enabled)
echo.
echo Note: All Field Day instances now use port 8080 exclusively with HTTPS.
echo Multiple stations should run on different machines/IP addresses.
echo.

REM Check if running as administrator
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: This script must be run as Administrator!
    echo.
    echo Right-click on this file and select "Run as administrator"
    echo.
    pause
    exit /b 1
)

echo Configuring Windows Firewall...
echo.

echo Adding inbound firewall rule...

REM Add inbound rule for Field Day Logger port 8080
netsh advfirewall firewall add rule name="Field Day Logger - Port 8080" dir=in action=allow protocol=TCP localport=8080 profile=private,domain
if %errorLevel% equ 0 (
    echo ✓ Port 8080 inbound rule added successfully
) else (
    echo ✗ Failed to add port 8080 inbound rule
)

echo.
echo Adding outbound firewall rule...

REM Add outbound rule for Field Day Logger port 8080
netsh advfirewall firewall add rule name="Field Day Logger - Port 8080 Out" dir=out action=allow protocol=TCP localport=8080 profile=private,domain
if %errorLevel% equ 0 (
    echo ✓ Port 8080 outbound rule added successfully
) else (
    echo ✗ Failed to add port 8080 outbound rule
)

echo.
echo ========================================
echo Windows Firewall Configuration Complete
echo ========================================
echo.
echo Field Day Logger is now configured to communicate on port 8080.
echo.
echo Summary:
echo ✓ Inbound TCP port 8080 - Allow Field Day Logger connections (HTTPS)
echo ✓ Outbound TCP port 8080 - Allow Field Day Logger connections (HTTPS)
echo.
echo Next steps:
echo 1. Start Field Day Logger: npm run dev
echo 2. The app will automatically use port 8080 with HTTPS
echo 3. Other stations can discover this instance automatically
echo 4. Use Network Modal to see connected stations
echo 5. Accept browser security warnings for self-signed certificates
echo.
echo For multiple stations:
echo - Run each instance on a different machine
echo - All will use port 8080 with HTTPS (hardcoded)
echo - Use "Auto" mode for automatic discovery
echo - Use "Host" mode on main logging station
echo - Use "Join" mode on additional stations
echo - You may need to accept security warnings in browsers
echo.

echo Press any key to exit...
pause >nul
