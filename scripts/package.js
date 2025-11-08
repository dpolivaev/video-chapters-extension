#!/usr/bin/env node
/**
 * Package Script for Chaptotek Extension
 * Creates ZIP files for store submission and distribution
 *
 * Copyright (C) 2025 Dimitry Polivaev
 *
 * This file is part of Chaptotek.
 *
 * Chaptotek is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Chaptotek is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Chaptotek. If not, see <https://www.gnu.org/licenses/>.
 */
const fs = require('fs-extra');

const path = require('path');

const archiver = require('archiver');

const chalk = require('chalk');

const ora = require('ora');

const {execSync} = require('child_process');

const {program: program} = require('commander');

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
  async package() {
    try {
      this.log(chalk.blue('📦 Packaging Chaptotek Extension\n'));
      await this.validateBuild();
      const version = await this.getVersion();
      await this.createVersionedPackage(version);
      this.showSummary(version);
    } catch (error) {
      this.logError('Packaging failed:', error);
      process.exit(1);
    }
  }
  async packageSource() {
    try {
      this.log(chalk.blue('📦 Creating Source Code Package\n'));
      const version = await this.getSourceVersion();
      await this.createSourcePackage(version);
      this.showSourceSummary(version);
    } catch (error) {
      this.logError('Source packaging failed:', error);
      process.exit(1);
    }
  }
  async validateBuild() {
    this.spinner = ora('Validating build directory').start();
    if (!await fs.pathExists(this.distDir)) {
      throw new Error('Build directory does not exist. Run "npm run build" first.');
    }
    const manifestPath = path.join(this.distDir, 'manifest.json');
    if (!await fs.pathExists(manifestPath)) {
      throw new Error('manifest.json not found in build directory');
    }
    const essentialFiles = [ 'background/background.js', 'content/content.js', 'popup/popup.html', 'icons/icon16.png' ];
    for (const file of essentialFiles) {
      const filePath = path.join(this.distDir, file);
      if (!await fs.pathExists(filePath)) {
        throw new Error(`Essential file missing: ${file}`);
      }
    }
    this.spinner.succeed('Build validation passed');
  }
  async getVersion() {
    const manifestPath = path.join(this.distDir, 'manifest.json');
    const manifest = await fs.readJson(manifestPath);
    return manifest.version;
  }
  async getSourceVersion() {
    const packagePath = path.join(process.cwd(), 'package.json');
    const packageJson = await fs.readJson(packagePath);
    return packageJson.version;
  }
  async createVersionedPackage(version) {
    this.spinner = ora('Creating versioned package').start();
    await fs.ensureDir(this.outputDir);
    let browserName;
    if (this.options.output.includes('firefox-store')) {
      browserName = 'firefox-store';
    } else if (this.options.output.includes('firefox-dev')) {
      browserName = 'firefox-dev';
    } else if (this.options.output.includes('firefox')) {
      browserName = 'firefox';
    } else {
      browserName = 'chrome';
    }
    const versionedZipPath = path.join(this.outputDir, `video-chapters-extension-${browserName}-v${version}.zip`);
    await this.createZip(this.distDir, versionedZipPath);
    this.spinner.succeed(`Versioned package created: video-chapters-extension-${browserName}-v${version}.zip`);
  }
  async createSourcePackage(version) {
    this.spinner = ora('Creating source code package').start();
    await fs.ensureDir(this.outputDir);
    const outputPath = path.join(this.outputDir, `video-chapters-extension-source-v${version}.zip`);
    await this.createSourceZip(outputPath);
    this.spinner.succeed(`Source package created: video-chapters-extension-source-v${version}.zip`);
  }
  async createZip(sourceDir, outputPath) {
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(outputPath);
      const archive = archiver('zip', {
        zlib: {
          level: 9
        }
      });
      output.on('close', () => {
        resolve();
      });
      archive.on('error', err => {
        reject(err);
      });
      archive.pipe(output);
      archive.glob('**/*', {
        cwd: sourceDir,
        ignore: [ '*.zip', '**/*.zip' ]
      });
      archive.finalize();
    });
  }
  async createSourceZip(outputPath) {
    return new Promise((resolve, reject) => {
      try {
        const gitFiles = execSync('git ls-files', { encoding: 'utf8', cwd: process.cwd() }).trim().split('\n').filter(file => file.length > 0);
        const output = fs.createWriteStream(outputPath);
        const archive = archiver('zip', {
          zlib: {
            level: 9
          }
        });
        output.on('close', () => {
          resolve();
        });
        archive.on('error', err => {
          reject(err);
        });
        archive.pipe(output);
        for (const file of gitFiles) {
          if (file.startsWith('web-store-submissions/')) {
            continue;
          }
          const filePath = path.join(process.cwd(), file);
          if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            archive.file(filePath, {
              name: file
            });
          }
        }
        archive.finalize();
      } catch (error) {
        reject(error);
      }
    });
  }
  async showSummary(version) {
    this.log(chalk.green('\n✅ Packaging completed successfully!\n'));
    let browserName;
    if (this.options.output.includes('firefox-store')) {
      browserName = 'firefox-store';
    } else if (this.options.output.includes('firefox-dev')) {
      browserName = 'firefox-dev';  
    } else if (this.options.output.includes('firefox')) {
      browserName = 'firefox';
    } else {
      browserName = 'chrome';
    }
    const versionedPackagePath = path.join(this.outputDir, `video-chapters-extension-${browserName}-v${version}.zip`);
    const versionedSize = await this.getFileSize(versionedPackagePath);
    this.log(chalk.bold('📦 Package Information:'));
    this.log(`   Version: ${chalk.cyan(version)}`);
    this.log(`   Package: ${chalk.gray(`video-chapters-extension-${browserName}-v${version}.zip`)} (${versionedSize})`);
    this.log(`   Output directory: ${chalk.gray(this.outputDir)}\n`);
    this.log(chalk.bold('🚀 Next Steps:'));
    this.log('   1. Test the extension by loading the dist/ directory in Chrome/Edge');
    const storeName = browserName.includes('firefox') ? 'Firefox Add-ons' : 'Chrome Web Store';
    this.log(`   2. Upload video-chapters-extension-${browserName}-v${version}.zip to the ${storeName}`);
    this.log('   3. Archive the ZIP file for future reference\n');
    if (await this.getFileSizeBytes(versionedPackagePath) > 5 * 1024 * 1024) {
      this.log(chalk.yellow('⚠️  Warning: Package size is larger than 5MB. Consider optimizing.'));
    }
  }
  async showSourceSummary(version) {
    this.log(chalk.green('\n✅ Source packaging completed successfully!\n'));
    const sourcePackagePath = path.join(this.outputDir, `video-chapters-extension-source-v${version}.zip`);
    const sourceSize = await this.getFileSize(sourcePackagePath);
    this.log(chalk.bold('📦 Source Package Information:'));
    this.log(`   Version: ${chalk.cyan(version)}`);
    this.log(`   Source package: ${chalk.gray(`video-chapters-extension-source-v${version}.zip`)} (${sourceSize})`);
    this.log(`   Output directory: ${chalk.gray(this.outputDir)}\n`);
    this.log(chalk.bold('ℹ️  Package Contents:'));
    this.log('   Contains all git-tracked files, excluding web-store-submissions/');
    this.log('   Suitable for code review or distribution purposes\n');
  }
  async getFileSize(filePath) {
    const stats = await fs.stat(filePath);
    const bytes = stats.size;
    if (bytes < 1024) {
      return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  async getFileSizeBytes(filePath) {
    const stats = await fs.stat(filePath);
    return stats.size;
  }
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

program.option('-v, --verbose', 'Verbose output').option('-o, --output <dir>', 'Output directory', 'dist/chrome').option('-s, --source', 'Create source code package').parse();

const packager = new ExtensionPackager(program.opts());

if (program.opts().source) {
  packager.packageSource().catch(error => {
    console.error(chalk.red('Source packaging failed:'), error);
    process.exit(1);
  });
} else {
  packager.package().catch(error => {
    console.error(chalk.red('Packaging failed:'), error);
    process.exit(1);
  });
}
