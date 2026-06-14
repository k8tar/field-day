# Field Day Logger - Build Pipeline

This directory contains the build pipeline and distribution files for the Field Day Logger Electron application.

## Quick Start

### Prerequisites
- **Node.js 18+** and npm
- **Inno Setup** (Windows only, for installer creation)
- **Git** for version control

### Building the Application

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Development build:**
   ```bash
   npm run electron:dev
   ```

3. **Production build:**
   ```bash
   npm run build:installer
   ```

4. **Build Windows installer (requires Administrator privileges):**
   - See [BUILD-INSTALLER.md](BUILD-INSTALLER.md) for detailed instructions
   - Use `build-installer-admin.ps1` or `build-installer-admin.bat`
   - Or run `npm run electron:build` as Administrator

## Build Scripts

### Main Build Commands
- `npm run build` - Build Vue.js application for production
- `npm run electron:dev` - Run in development mode with hot reload
- `npm run electron:pack` - Package Electron app (no installer)
- `npm run electron:dist` - Build and package with electron-builder
- `npm run build:installer` - Full build pipeline with installer
- `npm run release` - Complete release build

### Platform-Specific Builds
- `npm run dist:win` - Windows build (NSIS installer, portable, zip)
- `npm run dist:mac` - macOS build (DMG, zip)
- `npm run dist:linux` - Linux build (AppImage, deb, rpm)
- `npm run dist:deb` - Linux Debian package (.deb)
- `npm run dist:rpm` - Linux RPM package (.rpm)

## Build Pipeline Overview

The build pipeline (`build-pipeline.js`) performs these steps:

1. **Prerequisites Check**
   - Verify Node.js and npm installation
   - Check for Inno Setup (Windows)

2. **Dependency Installation**
   - Install all npm dependencies

3. **Vue.js Build**
   - Build the frontend application
   - Output to `dist/` directory

4. **Electron Packaging**
   - Package the Electron application
   - Create platform-specific executables
   - Output to `dist-electron/` directory

5. **Installer Creation**
   - Generate Windows installer using Inno Setup
   - Create portable ZIP packages
   - Output to `installer/` directory

6. **Build Documentation**
   - Generate build info and summary
   - Create distribution manifest

## Files and Directories

### Core Files
- `electron-main.js` - Electron main process entry point
- `src/preload.js` - Electron preload script for security
- `build-pipeline.js` - Complete build automation script
- `package-build.json` - Extended package.json with electron-builder config

### Build Configuration
- `installer/field-day-logger.iss` - Inno Setup script for Windows installer
- `.github/workflows/build-release.yml` - GitHub Actions CI/CD pipeline

### Output Directories
- `dist/` - Built Vue.js application
- `dist-electron/` - Packaged Electron applications
- `installer/` - Generated installer files

## Electron Builder Configuration

The application uses electron-builder with these features:

### Windows
- **NSIS Installer** - Full installation with Start Menu and Desktop shortcuts
- **Portable** - Standalone executable requiring no installation
- **ZIP** - Compressed archive for manual deployment

### macOS
- **DMG** - Standard macOS disk image installer
- **ZIP** - Compressed archive for manual deployment
- **Universal Binary** - Supports both Intel and Apple Silicon

### Linux
- **AppImage** - Universal Linux application bundle
- **DEB** - Debian/Ubuntu package
- **RPM** - Red Hat/CentOS/Fedora package

## Inno Setup Installer Features

The Windows installer includes:

- **Custom Installation Directory** - User can choose install location
- **Desktop Shortcut** - Optional desktop icon creation
- **Start Menu Integration** - Program group with shortcuts
- **Uninstaller** - Clean removal with optional data retention
- **Registry Integration** - Application registration
- **Modern UI** - Clean, professional installer interface
- **Background Installation** - Handles application data directories

## GitHub Actions CI/CD

The project includes automated builds for:

- **Windows** - Builds on `windows-latest` with Inno Setup
- **macOS** - Builds on `macos-latest` with DMG creation
- **Linux** - Builds on `ubuntu-latest` with multiple package formats
- **Release** - Automatic GitHub releases on version tags

### Triggering Builds

**Manual Trigger:**
```bash
# Trigger workflow manually
git push origin main
```

**Release Trigger:**
```bash
# Create and push a version tag
git tag v1.0.0
git push origin v1.0.0
```

## Local Development

### Development Mode
```bash
# Start development server with hot reload
npm run electron:dev
```

### Testing Builds
```bash
# Quick build test
npm run electron:pack

# Full build test
npm run build:installer
```

### Build Verification
```bash
# Check build output
ls -la dist-electron/
ls -la installer/
```

## Distribution

### Manual Distribution
1. Run `npm run build:installer`
2. Distribute files from `dist-electron/` and `installer/` directories

### Automated Distribution
1. Push version tag to trigger GitHub Actions
2. Download built artifacts from GitHub releases
3. Distribute to users

## Troubleshooting

### Common Issues

**Node.js Version:**
- Ensure Node.js 18+ is installed
- Check with `node --version`

**Inno Setup Not Found:**
- Install Inno Setup from https://jrsoftware.org/isinfo.php
- Add to PATH or use full path to ISCC.exe

**Build Failures:**
- Check `build.log` for detailed error information
- Ensure all dependencies are installed with `npm ci`

**Permission Issues:**
- Run build scripts with appropriate permissions
- On Windows, consider running as Administrator for installer creation

### Debugging
```bash
# Enable verbose logging
DEBUG=electron-builder npm run electron:dist

# Check build log
cat build.log

# Clean and rebuild
rm -rf dist dist-electron node_modules
npm install
npm run build:installer
```

## Security Considerations

The Electron application implements security best practices:

- **Context Isolation** - Enabled to prevent code injection
- **Node Integration Disabled** - Renderer process cannot access Node.js directly
- **Preload Script** - Secure API exposure to renderer
- **Content Security Policy** - Prevents XSS attacks
- **Secure Defaults** - All security features enabled by default

## Performance Optimization

Build optimizations include:

- **Tree Shaking** - Remove unused code
- **Minification** - Compress JavaScript and CSS
- **Asset Optimization** - Optimize images and resources
- **Lazy Loading** - Load components on demand
- **Bundle Splitting** - Separate vendor and application code

## Maintenance

### Updating Dependencies
```bash
# Check for outdated packages
npm outdated

# Update dependencies
npm update

# Update major versions (review breaking changes)
npm install package@latest
```

### Version Management
```bash
# Update version number
npm version patch|minor|major

# Update version in multiple files
# - package.json
# - installer/field-day-logger.iss
# - electron-main.js (if hardcoded)
```

This build pipeline provides a complete solution for building, packaging, and distributing the Field Day Logger application across all major platforms.
