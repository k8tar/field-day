# Quick Build Guide

## One-Command Build (Everything Automated)

### Local Build
**Windows:**
```bash
npm run build:installer
```

**macOS:**
```bash
npm run dist:mac
```

**Linux:**
```bash
npm run dist:linux
```

This command will:
1. ✅ Compile the Rust backend (if not already compiled)
2. ✅ Build the Vue.js frontend
3. ✅ Package everything into an Electron app
4. ✅ Create a platform-specific installer/executable

**Output locations:**
- **Windows**: `installer/Field Day Logger Setup 1.0.0.exe`
- **macOS**: `dist-electron/Field Day Logger-1.0.0.dmg`
- **Linux**: `dist-electron/field-day-logger-1.0.0.AppImage`

## GitHub Automated Releases

### Create a Release
Simply push a version tag:
```bash
git tag v1.0.0
git push origin v1.0.0
```

This automatically triggers:
1. ✅ Windows build (Windows GitHub runner)
2. ✅ macOS build (macOS GitHub runner)
3. ✅ Linux build (Ubuntu GitHub runner)
4. ✅ Creates GitHub Release with all installers attached

View progress at: `https://github.com/your-repo/actions`

## Prerequisites

### Local Development
- Node.js 18+
- Rust 1.70+ (for backend compilation)
- Inno Setup 6+ (Windows only, for installer creation)

### Install Rust (if not already installed)
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

## Development Workflow

**Hot-reload development:**
```bash
npm run electron:dev
```

**Development build without installer:**
```bash
npm run build
npm run electron
```

## Troubleshooting

### "Cargo not found"
- Install Rust: https://rustup.rs/
- Restart your terminal after installation

### "Inno Setup not found" (Windows)
- Install Inno Setup: https://jrsoftware.org/isdl.php
- Or install via Chocolatey: `choco install innosetup`

### Build fails in GitHub Actions
- Check the Actions tab for error logs
- Common issues:
  - Rust version conflicts: Use `dtolnay/rust-toolchain@stable`
  - Node cache issues: Clear and rebuild
  - Cargo dependency issues: Delete `backend-service/Cargo.lock` and retry

## Build Timeline

Expected build times:
- **Local (first build)**: 5-10 minutes (Rust compilation)
- **Local (subsequent builds)**: 2-3 minutes (Rust cached)
- **GitHub Actions**: 15-20 minutes total (parallel builds)

## Version Management

Update the version in:
1. `package.json` - `"version": "1.0.0"`
2. Create git tag: `git tag v1.0.0`
3. Push: `git push origin v1.0.0`

GitHub Actions will automatically create a release with that version number.
