#!/usr/bin/env node
/**
 * Validation Script for Video Chapters Generator Extension
 * Checks for common issues and validates the extension build and source
 *
 * Copyright (C) 2025 Dimitry Polivaev
 *
 * This file is part of Video Chapters Generator.
 *
 * Video Chapters Generator is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Video Chapters Generator is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Video Chapters Generator. If not, see <https://www.gnu.org/licenses/>.
 */
const fs = require('fs-extra');

const path = require('path');

const chalk = require('chalk');

const ora = require('ora');

const {program: program} = require('commander');

class ExtensionValidator {
  constructor(options = {}) {
    this.options = {
      package: options.package || false,
      verbose: options.verbose || false,
      output: options.output || 'dist/chrome'
    };
    this.srcDir = process.cwd();
    this.distDir = path.join(process.cwd(), this.options.output);
    this.spinner = null;
    this.errors = [];
    this.warnings = [];
  }
  async validate() {
    try {
      this.log(chalk.blue('🔍 Validating Video Chapters Generator Extension\n'));
      if (this.options.package) {
        await this.validatePackage();
      } else {
        await this.validateSource();
      }
      this.showResults();
    } catch (error) {
      this.logError('Validation failed:', error);
      process.exit(1);
    }
  }
  async validateSource() {
    await this.validateManifest();
    await this.validateSourceFiles();
    await this.validateIcons();
    await this.validatePermissions();
  }
  async validatePackage() {
    if (!await fs.pathExists(this.distDir)) {
      this.addError('Build directory does not exist. Run "npm run build" first.');
      return;
    }
    await this.validateBuiltManifest();
    await this.validateBuiltFiles();
    await this.validateBuiltIcons();
    await this.validatePackageSize();
  }
  async validateManifest() {
    this.spinner = ora('Validating manifest.json').start();
    const manifestPath = path.join(this.srcDir, 'manifest.json');
    if (!await fs.pathExists(manifestPath)) {
      this.addError('manifest.json not found');
      this.spinner.fail('Manifest validation failed');
      return;
    }
    try {
      const manifest = await fs.readJson(manifestPath);
      const requiredFields = [ 'name', 'version', 'manifest_version', 'description' ];
      for (const field of requiredFields) {
        if (!manifest[field]) {
          this.addError(`manifest.json missing required field: ${field}`);
        }
      }
      if (manifest.version && !/^\d+\.\d+\.\d+$/.test(manifest.version)) {
        this.addWarning('Version should follow semantic versioning (x.y.z)');
      }
      if (manifest.manifest_version !== 3) {
        this.addWarning('Using manifest version 2. Consider upgrading to version 3.');
      }
      if (manifest.permissions && manifest.permissions.length > 5) {
        this.addWarning('Extension requests many permissions. Consider minimizing.');
      }
      if (manifest.host_permissions && manifest.host_permissions.includes('*://*/*')) {
        this.addWarning('Extension requests access to all websites. Consider being more specific.');
      }
      this.spinner.succeed('Manifest validation passed');
    } catch (error) {
      this.addError(`Invalid manifest.json: ${error.message}`);
      this.spinner.fail('Manifest validation failed');
    }
  }
  async validateSourceFiles() {
    this.spinner = ora('Validating source files').start();
    const requiredFiles = [ 'background/background.js', 'background/gemini-api.js', 'content/content.js', 'content/content.css', 'popup/popup.html', 'popup/popup.css', 'popup/popup.js', 'popup/instruction-history.js', 'results/results.html', 'results/results.css', 'results/results.js' ];
    for (const file of requiredFiles) {
      const filePath = path.join(this.srcDir, file);
      if (!await fs.pathExists(filePath)) {
        this.addError(`Required file missing: ${file}`);
      }
    }
    await this.validateJavaScriptFiles();
    this.spinner.succeed('Source files validation completed');
  }
  async validateJavaScriptFiles() {
    const jsFiles = [ 'background/background.js', 'content/content.js', 'popup/popup.js' ];
    for (const file of jsFiles) {
      const filePath = path.join(this.srcDir, file);
      if (await fs.pathExists(filePath)) {
        const content = await fs.readFile(filePath, 'utf8');
        if (content.includes('console.log')) {
          this.addWarning(`${file} contains console.log statements`);
        }
        if (/api[_-]?key.*['""][A-Za-z0-9]{20,}['""]/i.test(content)) {
          this.addError(`${file} may contain hardcoded API key`);
        }
        if (content.includes('eval(')) {
          this.addError(`${file} uses eval() which is not allowed`);
        }
      }
    }
  }
  async validateIcons() {
    this.spinner = ora('Validating icons').start();
    const iconsDir = path.join(this.srcDir, 'icons');
    const requiredSizes = [ 16, 48, 128 ];
    if (!await fs.pathExists(iconsDir)) {
      this.addWarning('Icons directory not found. Placeholder icons will be generated.');
      this.spinner.succeed('Icons validation completed (will use placeholders)');
      return;
    }
    for (const size of requiredSizes) {
      const iconPath = path.join(iconsDir, `icon${size}.png`);
      if (!await fs.pathExists(iconPath)) {
        this.addWarning(`Icon missing: icon${size}.png`);
      }
    }
    this.spinner.succeed('Icons validation completed');
  }
  async validatePermissions() {
    this.spinner = ora('Validating permissions').start();
    const manifestPath = path.join(this.srcDir, 'manifest.json');
    const manifest = await fs.readJson(manifestPath);
    const permissions = manifest.permissions || [];
    const hostPermissions = manifest.host_permissions || [];
    if (permissions.includes('activeTab') && permissions.includes('tabs')) {
      this.addWarning('Both activeTab and tabs permissions requested. activeTab may be sufficient.');
    }
    if (hostPermissions.length === 0) {
      this.addWarning('No host permissions specified. Extension may not work on YouTube.');
    }
    if (!hostPermissions.includes('https://www.youtube.com/*')) {
      this.addError('Missing YouTube host permission');
    }
    this.spinner.succeed('Permissions validation completed');
  }
  async validateBuiltManifest() {
    this.spinner = ora('Validating built manifest').start();
    const manifestPath = path.join(this.distDir, 'manifest.json');
    if (!await fs.pathExists(manifestPath)) {
      this.addError('Built manifest.json not found');
      this.spinner.fail('Built manifest validation failed');
      return;
    }
    try {
      const manifest = await fs.readJson(manifestPath);
      if (manifest.content_security_policy) {
        if (manifest.content_security_policy.includes('unsafe-eval')) {
          this.addError('CSP contains unsafe-eval');
        }
      }
      this.spinner.succeed('Built manifest validation passed');
    } catch (error) {
      this.addError(`Invalid built manifest.json: ${error.message}`);
      this.spinner.fail('Built manifest validation failed');
    }
  }
  async validateBuiltFiles() {
    this.spinner = ora('Validating built files').start();
    const requiredFiles = [ 'background/background.js', 'content/content.js', 'popup/popup.html', 'options/options.html' ];
    for (const file of requiredFiles) {
      const filePath = path.join(this.distDir, file);
      if (!await fs.pathExists(filePath)) {
        this.addError(`Built file missing: ${file}`);
      }
    }
    this.spinner.succeed('Built files validation completed');
  }
  async validateBuiltIcons() {
    this.spinner = ora('Validating built icons').start();
    const iconsDir = path.join(this.distDir, 'icons');
    const requiredSizes = [ 16, 48, 128 ];
    if (!await fs.pathExists(iconsDir)) {
      this.addError('Built icons directory not found');
      this.spinner.fail('Built icons validation failed');
      return;
    }
    for (const size of requiredSizes) {
      const iconPath = path.join(iconsDir, `icon${size}.png`);
      if (!await fs.pathExists(iconPath)) {
        this.addError(`Built icon missing: icon${size}.png`);
      } else {
        const stats = await fs.stat(iconPath);
        if (stats.size > 50 * 1024) {
          this.addWarning(`Icon ${size}x${size} is quite large (${Math.round(stats.size / 1024)}KB)`);
        }
      }
    }
    this.spinner.succeed('Built icons validation completed');
  }
  async validatePackageSize() {
    this.spinner = ora('Validating package size').start();
    const totalSize = await this.calculateDirectorySize(this.distDir);
    const sizeMB = totalSize / (1024 * 1024);
    if (sizeMB > 5) {
      this.addWarning(`Package size is ${sizeMB.toFixed(1)}MB. Chrome Web Store has a 5MB limit.`);
    } else if (sizeMB > 2) {
      this.addWarning(`Package size is ${sizeMB.toFixed(1)}MB. Consider optimizing for faster installation.`);
    }
    this.spinner.succeed(`Package size validation completed (${sizeMB.toFixed(1)}MB)`);
  }
  async calculateDirectorySize(dirPath) {
    let totalSize = 0;
    const items = await fs.readdir(dirPath);
    for (const item of items) {
      const itemPath = path.join(dirPath, item);
      const stats = await fs.stat(itemPath);
      if (stats.isDirectory()) {
        totalSize += await this.calculateDirectorySize(itemPath);
      } else {
        totalSize += stats.size;
      }
    }
    return totalSize;
  }
  addError(message) {
    this.errors.push(message);
  }
  addWarning(message) {
    this.warnings.push(message);
  }
  showResults() {
    this.log('');
    if (this.errors.length === 0 && this.warnings.length === 0) {
      this.log(chalk.green('✅ Validation passed! No issues found.\n'));
      return;
    }
    if (this.errors.length > 0) {
      this.log(chalk.red(`❌ ${this.errors.length} Error(s) Found:`));
      this.errors.forEach(error => {
        this.log(chalk.red(`   • ${error}`));
      });
      this.log('');
    }
    if (this.warnings.length > 0) {
      this.log(chalk.yellow(`⚠️  ${this.warnings.length} Warning(s) Found:`));
      this.warnings.forEach(warning => {
        this.log(chalk.yellow(`   • ${warning}`));
      });
      this.log('');
    }
    if (this.errors.length > 0) {
      this.log(chalk.red('Please fix all errors before proceeding.\n'));
      process.exit(1);
    } else {
      this.log(chalk.green('Validation completed with warnings only.\n'));
    }
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

program.option('-p, --package', 'Validate built package instead of source').option('-v, --verbose', 'Verbose output').option('-o, --output <dir>', 'Output directory', 'dist/chrome').parse();

const validator = new ExtensionValidator(program.opts());

validator.validate().catch(error => {
  console.error(chalk.red('Validation failed:'), error);
  process.exit(1);
});
