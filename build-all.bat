@echo off
REM Field Day Logger - Build All Wrapper
REM This script runs the PowerShell build script with proper execution policy

echo Running Field Day Logger build script...
echo.

powershell.exe -ExecutionPolicy Bypass -File "%~dp0build-all.ps1" %*
