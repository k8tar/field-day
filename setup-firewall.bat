@echo off
REM Windows Firewall Configuration for Field Day Logger
REM This script opens the necessary ports for multi-instance communication
REM Run as Administrator

echo ========================================
echo Field Day Logger - Windows Firewall Setup
echo ========================================
echo.
echo This script will open Windows Firewall ports for Field Day Logger instances
echo to communicate with each other on the local network.
echo.
echo Port to be opened:
echo - 8080 (TCP) - All Field Day instances (hardcoded)
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

echo Running as Administrator - proceeding with firewall configuration...
echo.

REM Add inbound rules for Field Day Logger ports
echo Adding inbound firewall rules...

netsh advfirewall firewall add rule name="Field Day Logger - Port 8080" dir=in action=allow protocol=TCP localport=8080 profile=private,domain
if %errorLevel% equ 0 (
    echo ✓ Port 8080 inbound rule added successfully
) else (
    echo ✗ Failed to add port 8080 inbound rule
)

netsh advfirewall firewall add rule name="Field Day Logger - Port 8081" dir=in action=allow protocol=TCP localport=8081 profile=private,domain
if %errorLevel% equ 0 (
    echo ✓ Port 8081 inbound rule added successfully
) else (
    echo ✗ Failed to add port 8081 inbound rule
)

netsh advfirewall firewall add rule name="Field Day Logger - Port 8082" dir=in action=allow protocol=TCP localport=8082 profile=private,domain
if %errorLevel% equ 0 (
    echo ✓ Port 8082 inbound rule added successfully
) else (
    echo ✗ Failed to add port 8082 inbound rule
)

netsh advfirewall firewall add rule name="Field Day Logger - Port 8083" dir=in action=allow protocol=TCP localport=8083 profile=private,domain
if %errorLevel% equ 0 (
    echo ✓ Port 8083 inbound rule added successfully
) else (
    echo ✗ Failed to add port 8083 inbound rule
)

echo.
echo Adding outbound firewall rules...

REM Add outbound rules for Field Day Logger ports
netsh advfirewall firewall add rule name="Field Day Logger - Port 8080 Out" dir=out action=allow protocol=TCP localport=8080 profile=private,domain
if %errorLevel% equ 0 (
    echo ✓ Port 8080 outbound rule added successfully
) else (
    echo ✗ Failed to add port 8080 outbound rule
)

netsh advfirewall firewall add rule name="Field Day Logger - Port 8081 Out" dir=out action=allow protocol=TCP localport=8081 profile=private,domain
if %errorLevel% equ 0 (
    echo ✓ Port 8081 outbound rule added successfully
) else (
    echo ✗ Failed to add port 8081 outbound rule
)

netsh advfirewall firewall add rule name="Field Day Logger - Port 8082 Out" dir=out action=allow protocol=TCP localport=8082 profile=private,domain
if %errorLevel% equ 0 (
    echo ✓ Port 8082 outbound rule added successfully
) else (
    echo ✗ Failed to add port 8082 outbound rule
)

netsh advfirewall firewall add rule name="Field Day Logger - Port 8083 Out" dir=out action=allow protocol=TCP localport=8083 profile=private,domain
if %errorLevel% equ 0 (
    echo ✓ Port 8083 outbound rule added successfully
) else (
    echo ✗ Failed to add port 8083 outbound rule
)

echo.
echo ========================================
echo Windows Firewall Configuration Complete
echo ========================================
echo.
echo The following ports are now open in Windows Firewall:
echo - 8080, 8081, 8082, 8083 (TCP In/Out)
echo.
echo You can now run multiple Field Day Logger instances and they should
echo be able to communicate with each other.
echo.
echo To test:
echo 1. Start first instance: npm run dev (will use port 8080)
echo 2. Start second instance: PORT=8081 npm run dev
echo 3. In the Network modal, set first as Host, second as Client
echo.
pause
