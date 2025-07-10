@echo off
REM Script to start the dev server with custom station info for network testing

REM Default values
set CALLSIGN=%~1
set DESIGNATOR=%~2
set PORT=%~3

if "%CALLSIGN%"=="" set CALLSIGN=K8TAR
if "%DESIGNATOR%"=="" set DESIGNATOR=1A
if "%PORT%"=="" set PORT=4173

echo Starting Field Day Logger with:
echo   Callsign: %CALLSIGN%
echo   Designator: %DESIGNATOR%
echo   Port: %PORT%

REM Set environment variables
set STATION_CALLSIGN=%CALLSIGN%
set STATION_DESIGNATOR=%DESIGNATOR%
set QSO_COUNT=0
set STATION_SCORE=0

REM Start the dev server on the specified port
npm run dev -- --port %PORT%
