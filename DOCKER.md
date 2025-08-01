# Docker Usage Guide for Field Day Logger

This guide explains how to use Docker to run and build the Field Day Logger application.

## Prerequisites

- Docker Desktop (Windows/macOS) or Docker Engine (Linux)
- Docker Compose (usually included with Docker Desktop)

## Quick Start

### Running the Application

To run the complete application (frontend + backend) in Docker:

```bash
# Build and start the application
docker-compose up

# Or run in background
docker-compose up -d

# To stop
docker-compose down
```

The application will be available at:
- Frontend: http://localhost:8080
- Backend API: http://localhost:3030

### Development Mode

For development with hot-reload:

```bash
# Start development environment
docker-compose -f docker-compose.dev.yml up

# Or run in background
docker-compose -f docker-compose.dev.yml up -d
```

### Building Electron Application

To build the Electron desktop application using Docker:

**Linux/macOS:**
```bash
./docker-build.sh
```

**Windows (PowerShell):**
```powershell
.\docker-build.ps1
```

**Manual build:**
```bash
# Build the builder image
docker build -f Dockerfile.build -t fieldday-builder .

# Extract built application
mkdir -p docker-output
docker run --rm -v "$(pwd)/docker-output:/host-output" fieldday-builder
```

The built Electron application will be available in the `docker-output/` directory.

## Docker Files Overview

- `Dockerfile` - Production runtime image for web application
- `Dockerfile.build` - Build environment for Electron application
- `Dockerfile.dev` - Development environment with hot-reload
- `docker-compose.yml` - Production web application stack
- `docker-compose.dev.yml` - Development stack with volume mounts
- `.dockerignore` - Files to exclude from Docker build context

## Docker Images

### Production Image (`Dockerfile`)
- Multi-stage build for optimized size
- Rust backend + Vue.js frontend
- Serves frontend on port 8080
- Backend API on port 3030
- Health checks included

### Build Image (`Dockerfile.build`)
- Contains all build tools (Node.js, Rust, Electron dependencies)
- Builds cross-platform Electron applications
- Outputs to mounted volume for extraction

### Development Image (`Dockerfile.dev`)
- Development tools included
- Volume mounts for live code changes
- Hot-reload enabled

## Environment Variables

The following environment variables can be configured:

- `NODE_ENV` - Set to 'development' or 'production'
- `CHOKIDAR_USEPOLLING` - Enable file watching in containers

## Ports

- `8080` - Frontend web interface
- `3030` - Backend API and discovery service

## Volume Mounts

### Development
- Source code mounted for live editing
- Node modules excluded to prevent conflicts
- Cargo target directory excluded for faster builds

### Build Output
- `./docker-output:/host-output` - Extract built Electron applications

## Troubleshooting

### Build Issues

If you encounter build issues:

1. Clear Docker cache:
   ```bash
   docker system prune -a
   ```

2. Rebuild without cache:
   ```bash
   docker-compose build --no-cache
   ```

3. Check disk space:
   ```bash
   docker system df
   ```

### Performance Issues

For better performance in development:

1. Use Docker Desktop with WSL2 backend (Windows)
2. Allocate more memory to Docker (Settings > Resources)
3. Use volume mounts sparingly for large directories

### Windows Specific

On Windows, you may need to:

1. Enable WSL2 integration in Docker Desktop
2. Run PowerShell as Administrator for some operations
3. Use PowerShell scripts instead of bash scripts

## Architecture

The Docker setup follows these principles:

- **Multi-stage builds** for optimized production images
- **Separate environments** for development and production
- **Health checks** for reliability
- **Volume optimization** for development workflow
- **Cross-platform compatibility** for Electron builds

## Security

- Base images are regularly updated
- No unnecessary packages in production images
- Development tools excluded from production
- Health checks prevent running unhealthy containers

## CI/CD Integration

These Docker configurations can be used in CI/CD pipelines:

```yaml
# Example GitHub Actions step
- name: Build Electron App
  run: |
    docker build -f Dockerfile.build -t fieldday-builder .
    docker run --rm -v ${{ github.workspace }}/output:/host-output fieldday-builder
```
