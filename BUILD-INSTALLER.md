# Field Day Logger - Installer Build Instructions

## Prerequisites

1. **Node.js 18+** and npm installed
2. **Windows Administrator privileges** (required for installer creation)
3. **Windows Defender/Antivirus exclusions** (recommended)

## Option 1: Using the Automated PowerShell Script (Recommended)

1. **Right-click** on `build-installer-admin.ps1`
2. Select **"Run with PowerShell"**
3. If prompted, click **"Yes"** to allow administrator privileges
4. The script will automatically:
   - Check prerequisites
   - Install dependencies
   - Build the Vue.js application
   - Build the Electron installer
   - Open the output folder

## Option 2: Using the Batch Script

1. **Right-click** on `build-installer-admin.bat`
2. Select **"Run as administrator"**
3. Follow the on-screen instructions

## Option 3: Manual Command Line (Administrator)

1. Open **Command Prompt as Administrator**:
   - Press `Win + X`
   - Select "Command Prompt (Admin)" or "PowerShell (Admin)"

2. Navigate to the project directory:
   ```cmd
   cd C:\git\field-day
   ```

3. Install dependencies:
   ```cmd
   npm install
   ```

4. Build the application:
   ```cmd
   npm run build
   ```

5. Build the installer:
   ```cmd
   npm run electron:build
   ```

## What Gets Built

The build process creates:

1. **NSIS Installer** (`dist-electron/Field Day Logger Setup 2.0.0.exe`)
   - Full Windows installer with Start Menu shortcuts
   - Desktop shortcut option
   - Uninstaller included

2. **Portable Executable** (`dist-electron/Field Day Logger-2.0.0-portable.exe`)
   - Standalone executable
   - No installation required
   - Can run from USB drive

## Build Output Location

All build artifacts are placed in the `dist-electron/` directory:

```
dist-electron/
├── Field Day Logger Setup 2.0.0.exe      # Full installer
├── Field Day Logger-2.0.0-portable.exe   # Portable version
├── win-unpacked/                          # Unpacked application files
└── builder-effective-config.yaml         # Build configuration used
```

## Troubleshooting

### Common Issues:

1. **"Access Denied" or Permission Errors**
   - Ensure you're running as Administrator
   - Add project folder to Windows Defender exclusions

2. **"electron-builder not found"**
   ```cmd
   npm install -g electron-builder
   ```

3. **Build Fails with "EPERM" errors**
   - Close any running instances of the application
   - Disable real-time antivirus scanning temporarily

4. **"node-gyp" errors**
   - Install Visual Studio Build Tools:
     ```cmd
     npm install -g windows-build-tools
     ```

### Windows Defender Exclusions (Recommended):

Add these folders to Windows Defender exclusions:
- Project folder: `C:\git\field-day`
- Node modules: `C:\git\field-day\node_modules`
- Build output: `C:\git\field-day\dist-electron`

**To add exclusions:**
1. Open Windows Security
2. Go to "Virus & threat protection"
3. Click "Manage settings" under "Virus & threat protection settings"
4. Scroll down to "Exclusions" and click "Add or remove exclusions"
5. Add the folders listed above

## Verification

After a successful build:

1. Check that `dist-electron/` folder exists
2. Verify both installer and portable versions are created
3. Test the installer by running it (installs to `%LOCALAPPDATA%\Programs\Field Day Logger`)
4. Test the portable version by running it directly

## Distribution

The generated files can be distributed to users:
- **Field Day Logger Setup 2.0.0.exe** - For standard installation
- **Field Day Logger-2.0.0-portable.exe** - For portable use

Both versions are fully functional and include all necessary dependencies.
