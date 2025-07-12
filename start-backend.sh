#!/bin/bash

echo "Starting Field Day Logger Backend Service..."

cd "$(dirname "$0")/backend-service"

if [ ! -f "target/release/fieldday-backend" ]; then
    echo "Building backend service..."
    cargo build --release
    if [ $? -ne 0 ]; then
        echo "Build failed!"
        exit 1
    fi
fi

echo "Starting backend service on port 3030..."
./target/release/fieldday-backend --port 3030 --discovery-port 8080 --verbose
