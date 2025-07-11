@echo off
REM Field Day Logger - Test Pipeline for Windows
REM Runs automated tests for the application

echo 🧪 Field Day Logger - Test Pipeline
echo ====================================
echo.

setlocal enabledelayedexpansion
set TESTS_PASSED=0
set TESTS_FAILED=0

REM Function to run a test and track results
:run_test
set test_name=%~1
set test_command=%~2

echo Running: %test_name%
echo Command: %test_command%
echo.

call %test_command% >nul 2>&1
if !errorlevel! equ 0 (
    echo ✅ PASSED: %test_name%
    set /a TESTS_PASSED+=1
) else (
    echo ❌ FAILED: %test_name%
    set /a TESTS_FAILED+=1
)
echo.
goto :eof

REM Unit Tests
echo 🔬 Running Unit Tests...
call :run_test "Unit Tests" "npm run test:unit"

REM Lint Check
echo 🔍 Running Code Quality Checks...
call :run_test "ESLint Code Quality" "npm run lint"

REM Build Test
echo 🏗️ Testing Production Build...
call :run_test "Production Build" "npm run build"

REM UI Validation Tests
echo 🖥️ Running UI Validation Tests...
call :run_test "Final Validation Test" "node tests/test-final-validation.js"

REM Test Summary
echo 📊 Test Summary
echo ===============
echo Tests Passed: %TESTS_PASSED%
echo Tests Failed: %TESTS_FAILED%
echo.

if %TESTS_FAILED% equ 0 (
    echo 🎉 All tests passed! Ready for release.
    exit /b 0
) else (
    echo 💥 Some tests failed. Please fix before release.
    exit /b 1
)
