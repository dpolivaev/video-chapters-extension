#!/usr/bin/env node

/**
 * Package Script for Video Chapters Generator Extension
 * Creates ZIP files for store submission
 */

const fs = require('fs-extra');
const path = require('path');
const archiver = require('archiver');
const chalk = require('chalk');
const ora = require('ora');
const { program } = require('commander');

class ExtensionPackager {
  constructor(options = {}) {
    this.options = {
      verbose: options.verbose || false,
      output: options.output || 'dist/chrome'
    };
    
    this.distDir = path.join(process.cwd(), this.options.output);
    this.outputDir = path.join(process.cwd(), 'dist', 'packages');
    this.spinner = null;
  }

  /**
   * Main packaging process
   */
  async package() {
    try {
      this.log(chalk.blue('📦 Packaging Video Chapters Generator Extension\n'));
      
      // Validate build exists
      await this.validateBuild();
      
      // Get version from manifest
      const version = await this.getVersion();
      
      // Create packages
      await this.createMainPackage(version);
      await this.createVersionedPackage(version);
      
      // Show summary
      this.showSummary(version);
      
    } catch (error) {
      this.logError('Packaging failed:', error);
      process.exit(1);
    }
  }

  /**
   * Validate that build directory exists and is complete
   */
  async validateBuild() {
    this.spinner = ora('Validating build directory').start();
    
    if (!await fs.pathExists(this.distDir)) {
      throw new Error('Build directory does not exist. Run "npm run build" first.');
    }
    
    const manifestPath = path.join(this.distDir, 'manifest.json');
    if (!await fs.pathExists(manifestPath)) {
      throw new Error('manifest.json not found in build directory');
    }
    
    // Check for essential files
    const essentialFiles = [
      'background/background.js',
      'content/content.js',
      'popup/popup.html',
      'icons/icon16.png'
    ];
    
    for (const file of essentialFiles) {
      const filePath = path.join(this.distDir, file);
      if (!await fs.pathExists(filePath)) {
        throw new Error(`Essential file missing: ${file}`);
      }
    }
    
    this.spinner.succeed('Build validation passed');
  }

  /**
   * Get version from manifest
   */
  async getVersion() {
    const manifestPath = path.join(this.distDir, 'manifest.json');
    const manifest = await fs.readJson(manifestPath);
    return manifest.version;
  }

  /**
   * Create main package for store submission
   */
  async createMainPackage(version) {
    this.spinner = ora('Creating main package').start();
    
    await fs.ensureDir(this.outputDir);
    
    const browserName = this.options.output.includes('firefox') ? 'firefox' : 'chrome';
    const outputPath = path.join(this.outputDir, `video-chapters-extension-${browserName}.zip`);
    
    await this.createZip(this.distDir, outputPath);
    
    this.spinner.succeed(`Main package created: video-chapters-extension-${browserName}.zip`);
  }

  /**
   * Create versioned package for backup
   */
  async createVersionedPackage(version) {
    this.spinner = ora('Creating versioned package').start();
    
    const browserName = this.options.output.includes('firefox') ? 'firefox' : 'chrome';
    const mainZipPath = path.join(this.outputDir, `video-chapters-extension-${browserName}.zip`);
    const versionedZipPath = path.join(this.outputDir, `video-chapters-extension-${browserName}-v${version}.zip`);
    
    await fs.copy(mainZipPath, versionedZipPath);
    
    this.spinner.succeed(`Versioned package created: video-chapters-extension-${browserName}-v${version}.zip`);
  }

  /**
   * Create ZIP file
   */
  async createZip(sourceDir, outputPath) {
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(outputPath);
      const archive = archiver('zip', {
        zlib: { level: 9 } // Maximum compression
      });

      output.on('close', () => {
        resolve();
      });

      archive.on('error', (err) => {
        reject(err);
      });

      archive.pipe(output);
      
      // Add all files from source directory, excluding any .zip files
      archive.glob('**/*', {
        cwd: sourceDir,
        ignore: ['*.zip', '**/*.zip']
      });
      
      archive.finalize();
    });
  }

  /**
   * Show packaging summary
   */
  async showSummary(version) {
    this.log(chalk.green('\n✅ Packaging completed successfully!\n'));
    
    const browserName = this.options.output.includes('firefox') ? 'firefox' : 'chrome';
    // Get file sizes
    const mainPackagePath = path.join(this.outputDir, `video-chapters-extension-${browserName}.zip`);
    const versionedPackagePath = path.join(this.outputDir, `video-chapters-extension-${browserName}-v${version}.zip`);
    
    const mainSize = await this.getFileSize(mainPackagePath);
    const versionedSize = await this.getFileSize(versionedPackagePath);
    
    this.log(chalk.bold('📦 Package Information:'));
    this.log(`   Version: ${chalk.cyan(version)}`);
    this.log(`   Main package: ${chalk.gray(`video-chapters-extension-${browserName}.zip`)} (${mainSize})`);
    this.log(`   Versioned package: ${chalk.gray(`video-chapters-extension-${browserName}-v${version}.zip`)} (${versionedSize})`);
    this.log(`   Output directory: ${chalk.gray(this.outputDir)}\n`);
    
    this.log(chalk.bold('🚀 Next Steps:'));
    this.log('   1. Test the extension by loading the dist/ directory in Chrome/Edge');
    this.log(`   2. Upload video-chapters-extension-${browserName}.zip to the ${browserName === 'chrome' ? 'Chrome Web Store' : 'Firefox Add-ons'}`);
    this.log('   3. Keep the versioned ZIP as a backup');
    this.log('   4. Keep the versioned ZIP as a backup\n');
    
    // Store size warnings
    if (await this.getFileSizeBytes(mainPackagePath) > 5 * 1024 * 1024) { // 5MB
      this.log(chalk.yellow('⚠️  Warning: Package size is larger than 5MB. Consider optimizing.'));
    }
  }

  /**
   * Get human-readable file size
   */
  async getFileSize(filePath) {
    const stats = await fs.stat(filePath);
    const bytes = stats.size;
    
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  /**
   * Get file size in bytes
   */
  async getFileSizeBytes(filePath) {
    const stats = await fs.stat(filePath);
    return stats.size;
  }

  /**
   * Logging utilities
   */
  log(message) {
    if (this.spinner) {
      this.spinner.stop();
    }
    console.log(message);
  }

  logError(message, error) {
    if (this.spinner) {
      this.spinner.fail(message);
    }
    console.error(chalk.red(message));
    if (this.options.verbose && error) {
      console.error(error);
    }
  }
}

// CLI setup
program
  .option('-v, --verbose', 'Verbose output')
  .option('-o, --output <dir>', 'Output directory', 'dist/chrome')
  .parse();

// Run packaging
const packager = new ExtensionPackager(program.opts());
packager.package().catch(error => {
  console.error(chalk.red('Packaging failed:'), error);
  process.exit(1);
}); 