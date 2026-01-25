#!/usr/bin/env node

/**
 * Build Pipeline for Field Day Logger
 * Builds the Electron application and creates Windows installer using Inno Setup
 */

import { execSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class BuildPipeline {
  constructor() {
    this.projectRoot = __dirname;
    this.distDir = path.join(__dirname, 'dist-electron');
    this.installerDir = path.join(__dirname, 'installer');
    this.logFile = path.join(__dirname, 'build.log');
    this.isccPath = null; // Will be set by checkPrerequisites
    
    console.log('🚀 Field Day Logger Build Pipeline Starting...\n');
  }

  log(message, isError = false) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;
    
    console.log(isError ? `❌ ${message}` : `✅ ${message}`);
    
    // Append to log file
    fs.appendFileSync(this.logFile, logMessage + '\n');
  }

  async runCommand(command, description, options = {}) {
    this.log(`Starting: ${description}`);
    
    try {
      const result = execSync(command, {
        cwd: this.projectRoot,
        stdio: 'pipe',
        encoding: 'utf8',
        ...options
      });
      
      this.log(`Completed: ${description}`);
      return result;
    } catch (error) {
      this.log(`Failed: ${description} - ${error.message}`, true);
      throw error;
    }
  }

  async checkPrerequisites() {
    this.log('Checking prerequisites...');
    
    // Check Node.js version
    try {
      const nodeVersion = execSync('node --version', { encoding: 'utf8' }).trim();
      this.log(`Node.js version: ${nodeVersion}`);
    } catch (error) {
      throw new Error('Node.js is not installed or not in PATH');
    }

    // Check npm
    try {
      const npmVersion = execSync('npm --version', { encoding: 'utf8' }).trim();
      this.log(`npm version: ${npmVersion}`);
    } catch (error) {
      throw new Error('npm is not installed or not in PATH');
    }

    // Check Rust/Cargo
    try {
      const cargoVersion = execSync('cargo --version', { encoding: 'utf8' }).trim();
      this.log(`Cargo version: ${cargoVersion}`);
    } catch (error) {
      throw new Error('Rust/Cargo is not installed or not in PATH. Please install Rust from https://rustup.rs/');
    }

    // Check if Inno Setup is available (optional for non-Windows builds)
    if (process.platform === 'win32') {
      // Try common installation paths directly (for Windows)
      const potentialPaths = [
        'C:\\Program Files (x86)\\Inno Setup 6\\iscc.exe',
        'C:\\Program Files\\Inno Setup 6\\iscc.exe',
        'C:\\Program Files (x86)\\Inno Setup\\iscc.exe',
        'C:\\Program Files\\Inno Setup\\iscc.exe',
      ];
      
      let found = false;
      for (const potentialPath of potentialPaths) {
        if (fs.existsSync(potentialPath)) {
          this.log('Inno Setup Compiler found at: ' + potentialPath);
          this.isccPath = potentialPath;
          found = true;
          break;
        }
      }
      
      if (!found) {
        this.log('Inno Setup Compiler not found - installer creation will be skipped', true);
      }
    }

    this.log('Prerequisites check completed');
  }

  async installDependencies() {
    // Check if node_modules exists and skip if it does
    const nodeModulesPath = path.join(this.projectRoot, 'node_modules');
    if (fs.existsSync(nodeModulesPath)) {
      this.log('Dependencies already installed, skipping npm install');
      return;
    }
    
    try {
      await this.runCommand('npm ci', 'Installing dependencies');
    } catch (error) {
      // If npm ci fails (e.g., file lock), try npm install as fallback
      this.log('npm ci failed, trying npm install as fallback...');
      await this.runCommand('npm install', 'Installing dependencies (fallback)');
    }
  }

  async buildRustBackend() {
    this.log('Building Rust backend service...');
    
    const backendDir = path.join(this.projectRoot, 'backend-service');
    const releaseDir = path.join(backendDir, 'target', 'release');
    
    // Check if backend binary already exists
    const binaryName = process.platform === 'win32' ? 'fieldday-backend.exe' : 'fieldday-backend';
    const binaryPath = path.join(releaseDir, binaryName);
    
    if (fs.existsSync(binaryPath)) {
      this.log(`Backend binary already exists at ${binaryPath}`);
      return;
    }
    
    try {
      this.log('Compiling Rust backend (this may take a few minutes)...');
      execSync('cargo build --release', {
        cwd: backendDir,
        stdio: 'inherit'
      });
      this.log('Rust backend compilation completed');
    } catch (error) {
      throw new Error(`Failed to compile Rust backend: ${error.message}`);
    }
  }

  async buildVueApp() {
    await this.runCommand('npm run build', 'Building Vue application');
  }

  async buildElectronApp() {
    await this.runCommand('npm run electron:pack', 'Building Electron application');
  }

  async createWindowsInstaller() {
    if (process.platform !== 'win32') {
      this.log('Skipping Windows installer creation (not on Windows)');
      return;
    }

    // Check if Inno Setup compiler was found
    if (!this.isccPath) {
      this.log('Inno Setup not available - skipping installer creation', true);
      return;
    }

    // Ensure installer directory exists
    if (!fs.existsSync(this.installerDir)) {
      fs.mkdirSync(this.installerDir, { recursive: true });
    }

    // Create installer using Inno Setup
    const issFile = path.join(this.installerDir, 'field-day-logger.iss');
    const command = this.isccPath.includes(' ') 
      ? `"${this.isccPath}" "${issFile}"`
      : `${this.isccPath} "${issFile}"`;
    
    await this.runCommand(command, 'Creating Windows installer with Inno Setup');
  }

  async createDistributionPackages() {
    this.log('Creating distribution packages...');

    // Create ZIP archive of the built application
    const distUnpacked = path.join(this.distDir, 'win-unpacked');
    if (fs.existsSync(distUnpacked)) {
      await this.runCommand(
        `powershell Compress-Archive -Path "${distUnpacked}\\*" -DestinationPath "${this.distDir}\\FieldDayLogger-Portable.zip" -Force`,
        'Creating portable ZIP package'
      );
    }

    this.log('Distribution packages created');
  }

  async generateBuildInfo() {
    // Ensure dist-electron directory exists
    if (!fs.existsSync(this.distDir)) {
      fs.mkdirSync(this.distDir, { recursive: true });
    }
    
    const buildInfo = {
      buildDate: new Date().toISOString(),
      version: this.getPackageVersion(),
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      files: this.getBuiltFiles()
    };

    fs.writeFileSync(
      path.join(this.distDir, 'build-info.json'),
      JSON.stringify(buildInfo, null, 2)
    );

    this.log('Build information generated');
  }

  getPackageVersion() {
    try {
      const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      return packageJson.version;
    } catch (error) {
      return '1.0.0';
    }
  }

  getBuiltFiles() {
    const files = [];
    
    if (fs.existsSync(this.distDir)) {
      const scan = (dir, prefix = '') => {
        const items = fs.readdirSync(dir);
        items.forEach(item => {
          const itemPath = path.join(dir, item);
          const relativePath = path.join(prefix, item);
          
          if (fs.statSync(itemPath).isDirectory()) {
            scan(itemPath, relativePath);
          } else {
            const stats = fs.statSync(itemPath);
            files.push({
              path: relativePath,
              size: stats.size,
              modified: stats.mtime.toISOString()
            });
          }
        });
      };
      
      scan(this.distDir);
    }
    
    return files;
  }

  async cleanup() {
    this.log('Performing cleanup...');
    
    // Clean up temporary files
    const tempFiles = [
      'build.tmp',
      'dist.tmp'
    ];
    
    tempFiles.forEach(file => {
      const filePath = path.join(this.projectRoot, file);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    });
    
    this.log('Cleanup completed');
  }

  async generateSummary() {
    const summary = [];
    summary.push('🎉 Build Pipeline Completed Successfully!\n');
    
    if (fs.existsSync(this.distDir)) {
      const files = fs.readdirSync(this.distDir);
      summary.push('📦 Generated Files:');
      files.forEach(file => {
        const filePath = path.join(this.distDir, file);
        const stats = fs.statSync(filePath);
        const sizeKB = Math.round(stats.size / 1024);
        summary.push(`   • ${file} (${sizeKB} KB)`);
      });
    }

    if (fs.existsSync(this.installerDir)) {
      const installerFiles = fs.readdirSync(this.installerDir).filter(f => f.endsWith('.exe'));
      if (installerFiles.length > 0) {
        summary.push('\n🔧 Installer:');
        installerFiles.forEach(file => {
          summary.push(`   • ${file}`);
        });
      }
    }

    summary.push('\n🚀 Ready for distribution!');
    
    const summaryText = summary.join('\n');
    console.log('\n' + summaryText);
    
    // Save summary to file
    fs.writeFileSync(path.join(this.distDir, 'build-summary.txt'), summaryText);
  }

  async run() {
    const startTime = Date.now();
    
    try {
      // Initialize log file
      fs.writeFileSync(this.logFile, `Field Day Logger Build Started: ${new Date().toISOString()}\n`);
      
      await this.checkPrerequisites();
      await this.installDependencies();
      await this.buildRustBackend();
      await this.buildVueApp();
      await this.buildElectronApp();
      await this.createWindowsInstaller();
      await this.createDistributionPackages();
      await this.generateBuildInfo();
      await this.cleanup();
      await this.generateSummary();
      
      const duration = Math.round((Date.now() - startTime) / 1000);
      this.log(`\n🎉 Build pipeline completed successfully in ${duration}s!`);
      
    } catch (error) {
      this.log(`\n💥 Build pipeline failed: ${error.message}`, true);
      console.error('\nBuild failed! Check build.log for details.');
      process.exit(1);
    }
  }
}

// Run the build pipeline
const pipeline = new BuildPipeline();
pipeline.run();
