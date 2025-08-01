#!/bin/bash

# Field Day Logger - Docker Build Script
# This script builds the Electron application using Docker

set -e

echo "==================================================="
echo "   Field Day Logger - Docker Build Pipeline"
echo "==================================================="

# Create output directory
mkdir -p ./docker-output

echo "[1/2] Building Electron application in Docker container..."
docker build -f Dockerfile.build -t fieldday-builder .

echo "[2/2] Extracting built application..."
docker run --rm -v "$(pwd)/docker-output:/host-output" fieldday-builder

echo
echo "✅ Build completed successfully!"
echo "📦 Built application available in: ./docker-output/"
echo
echo "Contents:"
ls -la ./docker-output/

echo
echo "To run the application in Docker:"
echo "  docker-compose up"
echo
echo "To run the application locally:"
echo "  docker run -p 8080:8080 -p 3030:3030 fieldday-app"
