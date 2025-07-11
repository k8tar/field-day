#!/bin/bash

echo "========================================"
echo " Field Day Logger - Quick Build Script"
echo "========================================"
echo

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js is not installed or not in PATH"
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi

echo "✓ Node.js found: $(node --version)"

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo
    echo "Installing dependencies..."
    npm install
    if [ $? -ne 0 ]; then
        echo "ERROR: Failed to install dependencies"
        exit 1
    fi
    echo "✓ Dependencies installed"
fi

# Build the Vue.js application
echo
echo "Building Vue.js application..."
npm run build
if [ $? -ne 0 ]; then
    echo "ERROR: Failed to build Vue.js application"
    exit 1
fi
echo "✓ Vue.js application built"

# Install electron-builder if not already installed
if ! npm list electron-builder &> /dev/null; then
    echo
    echo "Installing electron-builder..."
    npm install --save-dev electron-builder concurrently wait-on
    if [ $? -ne 0 ]; then
        echo "ERROR: Failed to install electron-builder"
        exit 1
    fi
    echo "✓ electron-builder installed"
fi

# Update package.json with build configuration
echo
echo "Updating package.json for Electron build..."
cp package-build.json package.json
echo "✓ Package.json updated"

# Build Electron application
echo
echo "Building Electron application..."
npm run electron:pack
if [ $? -ne 0 ]; then
    echo "ERROR: Failed to build Electron application"
    exit 1
fi
echo "✓ Electron application built"

echo
echo "========================================"
echo " Build Complete!"
echo "========================================"
echo
echo "Built files location:"
echo "- Electron app: dist-electron/"
echo
echo "You can now distribute these files."
echo

# Make the script executable
chmod +x "$0"
