# Build Testing Instructions

Since you're on Windows, follow these steps to test the build:

## Prerequisites Check

Before building, ensure you have:

```powershell
# Check Node.js
node --version   # Should be 18+

# Check npm  
npm --version    # Should be 8+

# Check Rust
rustc --version  # Should be 1.70+
cargo --version  # Should be 1.70+

# Check Inno Setup (Windows only)
& "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" /?
```

If any are missing:
- **Node.js**: https://nodejs.org (LTS 18+)
- **Rust**: https://rustup.rs
- **Inno Setup**: `choco install innosetup` or https://jrsoftware.org/isdl.php

## Run the Build

Open PowerShell or Command Prompt in the project directory:

```powershell
cd C:\git\field-day

# One-command build (everything automated)
npm run build:installer
```

This will:
1. ✅ Check prerequisites (Node, npm, Cargo, Inno Setup)
2. ✅ Install npm dependencies
3. ✅ Compile Rust backend (`cargo build --release`)
4. ✅ Build Vue.js frontend
5. ✅ Package Electron app
6. ✅ Create Windows installer

**Estimated time**: 5-15 minutes (first build compiles Rust from scratch)

## Expected Output

Look for these files after successful build:

```
installer/
  └─ Field Day Logger Setup 1.0.0.exe     ← Windows installer

dist-electron/
  ├─ Field Day Logger 1.0.0.exe           ← Standalone executable
  └─ win-unpacked/                        ← Unpacked app files
```

## Test the Result

1. **Run the installer**:
   ```powershell
   & ".\installer\Field Day Logger Setup 1.0.0.exe"
   ```

2. **Or run the portable exe directly**:
   ```powershell
   & ".\dist-electron\Field Day Logger 1.0.0.exe"
   ```

3. **Or run unpacked during development**:
   ```powershell
   & ".\dist-electron\win-unpacked\Field Day Logger.exe"
   ```

## Troubleshooting

### "Cargo not found"
- Install Rust: `rustup-init.exe` from https://rustup.rs
- Restart PowerShell after installation

### Build times
- **First build**: 5-15 minutes (Rust compiler needs to build dependencies)
- **Subsequent builds**: 2-3 minutes (cached)

### Clean rebuild
```powershell
# Remove old build artifacts
rm -r dist-electron, installer, backend-service\target\release

# Rebuild from scratch
npm run build:installer
```

### GitHub Actions Alternative

If local build is problematic, test via GitHub:
```bash
git tag v1.0.0-test
git push origin v1.0.0-test
```

Then watch the build at: `https://github.com/your-repo/actions`

The GitHub workflow will build on Windows, macOS, and Linux in parallel.
