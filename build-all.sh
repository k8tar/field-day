#!/bin/bash

# Field Day Logger - Complete Build Script
# Builds all variants: Web, Electron, and Docker containers

set -e

# Default options
SKIP_ELECTRON=false
SKIP_DOCKER=false
SKIP_WEB=false
CLEAN_FIRST=false
SHOW_HELP=false

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
GRAY='\033[0;37m'
NC='\033[0m' # No Color

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-electron)
            SKIP_ELECTRON=true
            shift
            ;;
        --skip-docker)
            SKIP_DOCKER=true
            shift
            ;;
        --skip-web)
            SKIP_WEB=true
            shift
            ;;
        --clean)
            CLEAN_FIRST=true
            shift
            ;;
        --help|-h)
            SHOW_HELP=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            SHOW_HELP=true
            shift
            ;;
    esac
done

if [ "$SHOW_HELP" = true ]; then
    cat << EOF
Field Day Logger - Complete Build Script

Usage: ./build-all.sh [options]

Options:
    --skip-electron    Skip Electron application build
    --skip-docker      Skip Docker container builds
    --skip-web         Skip web application build
    --clean            Clean build directories before building
    --help, -h         Show this help message

Examples:
    ./build-all.sh                     # Build everything
    ./build-all.sh --skip-docker       # Build web and Electron only
    ./build-all.sh --clean             # Clean then build everything
EOF
    exit 0
fi

echo -e "${GREEN}"
cat << 'EOF'
===========================================================
   Field Day Logger - Complete Build Pipeline
===========================================================
EOF
echo -e "${NC}"

# Function to check prerequisites
check_prerequisites() {
    echo -e "${CYAN}[PREREQ] Checking prerequisites...${NC}"
    
    # Check Node.js
    if command -v node >/dev/null 2>&1; then
        NODE_VERSION=$(node --version)
        echo -e "${GREEN}✓ Node.js found: $NODE_VERSION${NC}"
    else
        echo -e "${RED}❌ Node.js not found. Please install from https://nodejs.org/${NC}"
        exit 1
    fi
    
    # Check npm
    if command -v npm >/dev/null 2>&1; then
        NPM_VERSION=$(npm --version)
        echo -e "${GREEN}✓ npm found: $NPM_VERSION${NC}"
    else
        echo -e "${RED}❌ npm not found${NC}"
        exit 1
    fi
    
    # Check Docker (only if not skipping Docker builds)
    if [ "$SKIP_DOCKER" = false ]; then
        if command -v docker >/dev/null 2>&1; then
            DOCKER_VERSION=$(docker --version)
            echo -e "${GREEN}✓ Docker found: $DOCKER_VERSION${NC}"
        else
            echo -e "${YELLOW}⚠️ Docker not found. Docker builds will be skipped.${NC}"
            SKIP_DOCKER=true
        fi
    fi
    
    echo ""
}

# Function to clean build directories
clean_build() {
    echo -e "${CYAN}[CLEAN] Cleaning build directories...${NC}"
    
    DIRS_TO_CLEAN=("dist" "dist-electron" "docker-output" "build")
    
    for dir in "${DIRS_TO_CLEAN[@]}"; do
        if [ -d "$dir" ]; then
            echo -e "${YELLOW}  Removing $dir...${NC}"
            rm -rf "$dir"
        fi
    done
    
    echo -e "${GREEN}✓ Build directories cleaned${NC}"
    echo ""
}

# Function to install dependencies
install_dependencies() {
    echo -e "${CYAN}[DEPS] Installing dependencies...${NC}"
    
    if [ ! -d "node_modules" ]; then
        echo -e "${YELLOW}  Installing npm packages...${NC}"
        npm install
    else
        echo -e "${YELLOW}  Dependencies already installed, updating...${NC}"
        npm ci
    fi
    
    echo -e "${GREEN}✓ Dependencies ready${NC}"
    echo ""
}

# Function to build web application
build_web_app() {
    echo -e "${CYAN}[WEB] Building web application...${NC}"
    
    npm run build
    
    echo -e "${GREEN}✓ Web application built successfully${NC}"
    echo -e "${GRAY}  Output: ./dist/${NC}"
    echo ""
}

# Function to build Electron application
build_electron_app() {
    echo -e "${CYAN}[ELECTRON] Building Electron application...${NC}"
    
    # Check if electron-builder is available
    if ! npm list electron-builder >/dev/null 2>&1; then
        echo -e "${YELLOW}  Installing electron-builder...${NC}"
        npm install --save-dev electron-builder
    fi
    
    # Build for current platform
    npm run electron:build
    
    echo -e "${GREEN}✓ Electron application built successfully${NC}"
    echo -e "${GRAY}  Output: ./dist-electron/${NC}"
    echo ""
}

# Function to build Docker containers
build_docker_containers() {
    echo -e "${CYAN}[DOCKER] Building Docker containers...${NC}"
    
    # Build the main application container
    echo -e "${YELLOW}  Building main application container...${NC}"
    docker build -t fieldday-app:latest .
    
    # Build the build container
    echo -e "${YELLOW}  Building Electron build container...${NC}"
    docker build -f Dockerfile.build -t fieldday-builder:latest .
    
    # Build development container if exists
    if [ -f "Dockerfile.dev" ]; then
        echo -e "${YELLOW}  Building development container...${NC}"
        if ! docker build -f Dockerfile.dev -t fieldday-app:dev .; then
            echo -e "${YELLOW}⚠️ Development Docker build failed${NC}"
        fi
    fi
    
    echo -e "${GREEN}✓ Docker containers built successfully${NC}"
    echo -e "${GRAY}  Images: fieldday-app:latest, fieldday-builder:latest${NC}"
    echo ""
}

# Function to calculate directory size
get_dir_size() {
    if [ -d "$1" ]; then
        du -sh "$1" 2>/dev/null | cut -f1 || echo "Unknown"
    else
        echo "Not found"
    fi
}

# Function to show build summary
show_build_summary() {
    echo -e "${GREEN}"
    cat << 'EOF'
===========================================================
   Build Summary
===========================================================
EOF
    echo -e "${NC}"
    
    if [ "$SKIP_WEB" = false ] && [ -d "dist" ]; then
        WEB_SIZE=$(get_dir_size "dist")
        echo -e "${GREEN}✓ Web Application: ./dist/ ($WEB_SIZE)${NC}"
    fi
    
    if [ "$SKIP_ELECTRON" = false ] && [ -d "dist-electron" ]; then
        ELECTRON_SIZE=$(get_dir_size "dist-electron")
        echo -e "${GREEN}✓ Electron Application: ./dist-electron/ ($ELECTRON_SIZE)${NC}"
    fi
    
    if [ "$SKIP_DOCKER" = false ]; then
        echo -e "${GREEN}✓ Docker Images:${NC}"
        if command -v docker >/dev/null 2>&1; then
            docker images fieldday-* --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}" | while read line; do
                echo -e "${GRAY}  $line${NC}"
            done
        fi
    fi
    
    echo ""
    echo -e "${GREEN}🚀 All builds completed successfully!${NC}"
    echo ""
    echo -e "${CYAN}Quick start commands:${NC}"
    echo -e "${GRAY}  Web (dev):      npm run dev${NC}"
    echo -e "${GRAY}  Web (prod):     npm run serve${NC}"
    echo -e "${GRAY}  Electron:       npm run electron${NC}"
    echo -e "${GRAY}  Docker:         docker-compose up${NC}"
    echo ""
}

# Main execution
main() {
    START_TIME=$(date +%s)
    
    check_prerequisites
    
    if [ "$CLEAN_FIRST" = true ]; then
        clean_build
    fi
    
    install_dependencies
    
    if [ "$SKIP_WEB" = false ]; then
        build_web_app
    fi
    
    if [ "$SKIP_ELECTRON" = false ]; then
        build_electron_app
    fi
    
    if [ "$SKIP_DOCKER" = false ]; then
        build_docker_containers
    fi
    
    END_TIME=$(date +%s)
    DURATION=$((END_TIME - START_TIME))
    MINUTES=$((DURATION / 60))
    SECONDS=$((DURATION % 60))
    
    echo -e "${CYAN}⏱️ Total build time: ${MINUTES}:$(printf '%02d' $SECONDS)${NC}"
    
    show_build_summary
}

# Error handling
trap 'echo -e "\n${RED}❌ Build failed${NC}"; exit 1' ERR

# Run main function
main
