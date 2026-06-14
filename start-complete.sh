#!/bin/bash

echo "==================================================="
echo "   Field Day Logger - Complete Startup"
echo "==================================================="
echo

echo "[1/3] Building Rust Backend Service..."
cd "$(dirname "$0")/backend-service"
cargo build --release
if [ $? -ne 0 ]; then
    echo "ERROR: Backend build failed!"
    exit 1
fi

echo
echo "[2/3] Starting Backend Service..."
gnome-terminal -- bash -c "./target/release/fieldday-backend --port 3030 --discovery-port 3030 --verbose; exec bash" &

echo
echo "[3/3] Starting Frontend Development Server..."
cd "$(dirname "$0")"
sleep 5
npm run dev
