# Field Day Logger - Build Scripts

This repository contains comprehensive build scripts for the Field Day Logger application.

## 🚀 Quick Start

### Windows Users (Recommended)
```batch
.\build-all-simple.bat
```

### Linux/macOS/WSL Users  
```bash
chmod +x build-all.sh
./build-all.sh
```

## 📋 What Gets Built

1. **Web Application** (`./dist/`) - Vue.js web app ready for deployment
2. **Electron Desktop App** (`./dist-electron/`) - Native desktop application
3. **Docker Containers** - Containerized versions for deployment

## 🛠️ Build Options

| Windows Batch | Linux/macOS | Description |
|---------------|-------------|-------------|
| `-CleanFirst` | `--clean` | Clean build directories first |
| `-SkipWeb` | `--skip-web` | Skip web application build |
| `-SkipElectron` | `--skip-electron` | Skip desktop application build |
| `-SkipDocker` | `--skip-docker` | Skip Docker container builds |
| `-Help` | `--help` | Show usage information |

## 📖 Examples

```batch
# Windows: Build everything with clean start
.\build-all-simple.bat -CleanFirst

# Windows: Build only web application  
.\build-all-simple.bat -SkipElectron -SkipDocker

# Linux/macOS: Build everything except Docker
./build-all.sh --skip-docker
```

## 📋 Prerequisites

- **Node.js** (v18+) - [Download](https://nodejs.org/)
- **Docker** (optional) - [Download](https://docker.com/)

## 📚 Full Documentation

See [BUILD-GUIDE.md](BUILD-GUIDE.md) for complete documentation including:
- Detailed build process explanation
- Troubleshooting guide
- CI/CD integration
- Development workflows

## 🔧 Quick Commands After Building

```bash
# Run development server
npm run dev

# Run built Electron app
npm run electron

# Run Docker containers
docker-compose up
```

## 🆘 Need Help?

1. Check prerequisites are installed: `node --version`
2. Try a clean build: add `-CleanFirst` or `--clean`
3. See [BUILD-GUIDE.md](BUILD-GUIDE.md) for troubleshooting
4. Check individual build scripts if one specific build fails
