#!/bin/bash

# Field Day Logger - Test Pipeline
# Runs automated tests for the application

echo "🧪 Field Day Logger - Test Pipeline"
echo "===================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test results tracking
TESTS_PASSED=0
TESTS_FAILED=0

# Function to run a test and track results
run_test() {
    local test_name="$1"
    local test_command="$2"
    
    echo -e "${YELLOW}Running: $test_name${NC}"
    echo "Command: $test_command"
    echo ""
    
    if eval "$test_command"; then
        echo -e "${GREEN}✅ PASSED: $test_name${NC}"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}❌ FAILED: $test_name${NC}"
        ((TESTS_FAILED++))
    fi
    echo ""
}

# Unit Tests
echo "🔬 Running Unit Tests..."
run_test "Unit Tests" "npm run test:unit"

# Lint Check
echo "🔍 Running Code Quality Checks..."
run_test "ESLint Code Quality" "npm run lint"

# Build Test
echo "🏗️ Testing Production Build..."
run_test "Production Build" "npm run build"

# UI Validation Tests
echo "🖥️ Running UI Validation Tests..."
run_test "Final Validation Test" "node tests/test-final-validation.js"

# Test Summary
echo "📊 Test Summary"
echo "==============="
echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 All tests passed! Ready for release.${NC}"
    exit 0
else
    echo -e "${RED}💥 Some tests failed. Please fix before release.${NC}"
    exit 1
fi
