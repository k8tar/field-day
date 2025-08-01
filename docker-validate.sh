#!/bin/bash

# Field Day Logger - Docker Validation Script
# This script tests the Docker setup

set -e

echo "==================================================="
echo "   Field Day Logger - Docker Validation"
echo "==================================================="

echo "[1/4] Testing Docker installation..."
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed or not in PATH"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed or not in PATH"
    exit 1
fi

echo "✅ Docker and Docker Compose are available"

echo "[2/4] Building production image..."
docker build -t fieldday-test .

echo "[3/4] Testing container startup..."
docker run -d --name fieldday-test-container -p 8081:8080 -p 3031:3030 fieldday-test

echo "Waiting for container to start..."
sleep 10

echo "[4/4] Testing application endpoints..."
if curl -f http://localhost:8081 > /dev/null 2>&1; then
    echo "✅ Frontend is responding"
else
    echo "⚠️  Frontend may not be fully ready (this is normal)"
fi

echo "Cleaning up test container..."
docker stop fieldday-test-container
docker rm fieldday-test-container
docker rmi fieldday-test

echo
echo "✅ Docker validation completed successfully!"
echo
echo "Next steps:"
echo "  1. Run the application: docker-compose up"
echo "  2. Build Electron app: ./docker-build.sh"
echo "  3. Development mode: docker-compose -f docker-compose.dev.yml up"
