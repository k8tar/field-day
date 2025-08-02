# Field Day Logger - Complete Build Guide

This directory contains comprehensive build scripts for building all variants of the Field Day Logger application.

## Available Build Scripts

### 1. Complete Build Scripts
- **`build-all-simple.bat`** - Simple batch script for Windows (recommended)
- **`build-all.sh`** - Bash script for Linux/macOS/WSL  
- **`build-all.ps1`** - PowerShell script for Windows (advanced)
- **`build-all.bat`** - Windows batch wrapper for PowerShell script

### 2. Individual Build Scripts
- **`build.bat`** / **`build.sh`** - Basic web application build
- **`docker-build.ps1`** / **`docker-build.sh`** - Docker container builds only

## Quick Start

### Windows (Simple Batch - Recommended)
```batch
REM Build everything
.\build-all-simple.bat

REM Build with options
.\build-all-simple.bat -CleanFirst
.\build-all-simple.bat -SkipDocker
.\build-all-simple.bat -SkipElectron
```

### Windows (PowerShell - Advanced)
```powershell
# Build everything
.\build-all.ps1

# Build with options  
.\build-all.ps1 -CleanFirst
.\build-all.ps1 -SkipDocker
```

### Linux/macOS/WSL (Bash)
```bash
# Make executable first
chmod +x build-all.sh

# Build everything
./build-all.sh

# Build with options
./build-all.sh --clean
./build-all.sh --skip-docker
./build-all.sh --skip-electron
```

## Build Options

| Option | PowerShell | Bash | Description |
|--------|------------|------|-------------|
| Clean first | `-CleanFirst` | `--clean` | Remove build directories before building |
| Skip web build | `-SkipWeb` | `--skip-web` | Skip Vite web application build |
| Skip Electron | `-SkipElectron` | `--skip-electron` | Skip Electron desktop application build |
| Skip Docker | `-SkipDocker` | `--skip-docker` | Skip Docker container builds |
| Help | `-Help` | `--help` | Show usage information |

## What Gets Built

### 1. Web Application (`npm run build`)
- **Output**: `./dist/`
- **Description**: Vite-built web application ready for deployment
- **Technologies**: Vue 3, TypeScript, Vite

### 2. Electron Application (`npm run electron:build`)
- **Output**: `./dist-electron/`
- **Description**: Native desktop application for Windows/macOS/Linux
- **Technologies**: Electron, Vue 3, TypeScript

### 3. Docker Containers
- **`fieldday-app:latest`** - Main application container
- **`fieldday-builder:latest`** - Build environment container
- **`fieldday-app:dev`** - Development container (if Dockerfile.dev exists)

## Prerequisites

### Required
- **Node.js** (v18 or later) - [Download](https://nodejs.org/)
- **npm** (comes with Node.js)

### Optional
- **Docker** (for container builds) - [Download](https://docker.com/)
- **Git** (for development)

## Build Outputs

After successful builds, you'll find:

```
field-day/
├── dist/                  # Web application (ready for web server)
├── dist-electron/         # Electron desktop app
├── docker-output/         # Docker build artifacts
└── node_modules/          # Dependencies
```

## Running the Built Applications

### Web Application
```bash
# Development server
npm run dev

# Production preview
npm run serve
```

### Electron Application
```bash
# Run development version
npm run electron:dev

# Run built version
npm run electron
```

### Docker Containers
```bash
# Run with docker-compose (recommended)
docker-compose up

# Run individual container
docker run -p 8080:8080 -p 3030:3030 fieldday-app:latest
```

## Troubleshooting

### Common Issues

#### 1. "Node.js not found"
- Install Node.js from [nodejs.org](https://nodejs.org/)
- Restart your terminal after installation

#### 2. "Docker not found" 
- Install Docker from [docker.com](https://docker.com/)
- Use `--skip-docker` option to build without Docker

#### 3. "Permission denied" (Linux/macOS)
```bash
chmod +x build-all.sh
./build-all.sh
```

#### 4. PowerShell execution policy (Windows)
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Build Performance Tips

1. **Use clean builds sparingly** - Only when troubleshooting
2. **Skip unused targets** - Use skip options for faster iteration
3. **Docker builds are slowest** - Skip for development
4. **Use npm ci instead of npm install** - Faster, more reliable installs

## Development Workflow

### Quick Development Build
```bash
# Web only (fastest)
./build-all.sh --skip-electron --skip-docker

# Or just use dev server
npm run dev
```

### Release Build
```bash
# Build everything with clean start
./build-all.sh --clean
```

### Testing Builds
```bash
# Build and test web app
npm run build && npm run serve

# Build and test Electron app  
npm run electron:build && npm run electron

# Build and test Docker
docker-compose up
```

## CI/CD Integration

These scripts are designed to work in CI/CD environments:

```yaml
# GitHub Actions example
- name: Build all variants
  run: |
    chmod +x build-all.sh
    ./build-all.sh --skip-docker  # Skip Docker in CI if needed
```

## Support

For build issues:
1. Check the prerequisites are installed
2. Try a clean build: `--clean` or `-CleanFirst`
3. Check individual build scripts in case of specific failures
4. Review the error messages - they usually indicate the specific issue

For application issues, see the main README.md file.
