#!/bin/bash
# Script to start the dev server with custom station info for network testing

# Default values
CALLSIGN=${1:-"K8TAR"}
DESIGNATOR=${2:-"1A"}
PORT=${3:-"8080"}

echo "Starting Field Day Logger with:"
echo "  Callsign: $CALLSIGN"
echo "  Designator: $DESIGNATOR"
echo "  Port: $PORT"

# Set environment variables
export STATION_CALLSIGN="$CALLSIGN"
export STATION_DESIGNATOR="$DESIGNATOR"
export QSO_COUNT="0"
export STATION_SCORE="0"

# Start the dev server on the specified port
npm run dev -- --port $PORT
