#!/usr/bin/env node

/**
 * Build Script for Video Chapters Generator Extension
 * Handles compilation, minification, and preparation of extension files
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
const { program } = require('commander');
const Jimp = require('jimp');
const { minify } = require('terser');

// Configuration
const config = {
  srcDir: process.cwd(),
  get distDir() {
    if (process.argv.includes('--firefox')) {
      return path.join(process.cwd(), 'dist', 'firefox');
    } else {
      return path.join(process.cwd(), 'dist', 'chrome');
    }
  },
  tempDir: path.join(process.cwd(), '.tmp'),
  get manifestFile() {
    return process.argv.includes('--firefox') ? 'manifest.firefox.json' : 'manifest.chrome.json';
  },
  get requiredFiles() {
    return [
      this.manifestFile,
      'background/background.js',
      'background/prompt-generator.js',
      'background/llm.js',
      'background/gemini-api.js',
      'background/openrouter-api.js',
      'content/content.js',
      'content/content.css',
      'content/youtube-subtitle-extractor.js',
      'popup/popup.html',
      'popup/popup.css',
      'popup/popup.js',
      'popup/instruction-history.js',
      'results/results.html',
      'results/results.css',
      'results/results.js',
      'options/options.html',
      'options/options.css',
      'options/options.js',
      'vendor/browser-polyfill.js'
    ];
  },
  iconSizes: [16, 48, 128],
  minifyOptions: {
    compress: {
      drop_console: true,
      drop_debugger: true
    },
    mangle: true,
    format: {
      comments: false
    }
  }
};

class ExtensionBuilder {
  constructor(options = {}) {
    this.options = {
      dev: options.dev || false,
      production: options.production || false,
      firefox: options.firefox || false,
      verbose: options.verbose || false
    };
    
    this.spinner = null;
  }

  /**
   * Main build process
   */
  async build() {
    try {
      this.log(chalk.blue('🔨 Building Video Chapters Generator Extension\n'));
      
      // Setup
      await this.setup();
      
      // Validate source files
      await this.validateSource();
      
      // Create distribution directory
      await this.createDistDirectory();
      
      // Copy and process files
      await this.copyStaticFiles();
      await this.processManifest();
      await this.processJavaScript();
      await this.processCSS();
      await this.processHTML();
      await this.generateIcons();
      await this.validateBuild();
      
      this.log(chalk.green('✅ Build completed successfully!'));
      this.log(chalk.gray(`📁 Output: ${config.distDir}`));

      // Write build-info.json with build time and version from manifest
      const manifestPath = path.join(config.distDir, 'manifest.json');
      const manifest = await fs.readJson(manifestPath);
      const buildInfo = {
        buildTime: new Date().toISOString(),
        version: manifest.version
      };
      await fs.writeFile(path.join(config.distDir, 'build-info.json'), JSON.stringify(buildInfo, null, 2));
      
    } catch (error) {
      this.logError('Build failed:', error);
      process.exit(1);
    }
  }

  /**
   * Setup build environment
   */
  async setup() {
    this.spinner = ora('Setting up build environment').start();
    
    // Clean previous builds
    await fs.remove(config.distDir);
    await fs.remove(config.tempDir);
    
    // Create directories
    await fs.ensureDir(config.distDir);
    await fs.ensureDir(config.tempDir);
    
    this.spinner.succeed('Build environment ready');
  }

  /**
   * Validate source files exist
   */
  async validateSource() {
    this.spinner = ora('Validating source files').start();
    
    const missing = [];
    
    for (const file of config.requiredFiles) {
      const filePath = path.join(config.srcDir, file);
      if (!await fs.pathExists(filePath)) {
        missing.push(file);
      }
    }
    
    if (missing.length > 0) {
      this.spinner.fail('Missing required files');
      throw new Error(`Missing files: ${missing.join(', ')}`);
    }
    
    this.spinner.succeed('Source files validated');
  }

  /**
   * Create distribution directory structure
   */
  async createDistDirectory() {
    this.spinner = ora('Creating distribution structure').start();
    
    const dirs = [
      'background',
      'content', 
      'popup',
      'results',
      'options',
      'icons',
      'vendor'
    ];
    
    for (const dir of dirs) {
      await fs.ensureDir(path.join(config.distDir, dir));
    }
    // Copy browser-polyfill.js to vendor in dist
    await fs.copy(
      path.join(config.srcDir, 'vendor', 'browser-polyfill.js'),
      path.join(config.distDir, 'vendor', 'browser-polyfill.js')
    );
    this.spinner.succeed('Distribution structure created');
  }

  /**
   * Copy static files
   */
  async copyStaticFiles() {
    this.spinner = ora('Copying static files').start();
    
    // Copy HTML files
    const htmlFiles = [
      'popup/popup.html',
      'results/results.html',
      'options/options.html'
    ];
    
    for (const file of htmlFiles) {
      await fs.copy(
        path.join(config.srcDir, file),
        path.join(config.distDir, file)
      );
    }
    
    // Copy CSS files
    const cssFiles = [
      'options/options.css'
    ];
    for (const file of cssFiles) {
      await fs.copy(
        path.join(config.srcDir, file),
        path.join(config.distDir, file)
      );
    }
    
    // Copy JS files
    const jsFiles = [
      'options/options.js'
    ];
    for (const file of jsFiles) {
      await fs.copy(
        path.join(config.srcDir, file),
        path.join(config.distDir, file)
      );
    }
    
    // Copy license and legal files (GPL-3.0 compliance)
    const legalFiles = [
      'LICENSE',
      'README.md'
    ];
    for (const file of legalFiles) {
      const srcPath = path.join(config.srcDir, file);
      if (await fs.pathExists(srcPath)) {
        await fs.copy(srcPath, path.join(config.distDir, file));
      }
    }
    
    this.spinner.succeed('Static files copied');
  }

  /**
   * Process manifest.json
   */
  async processManifest() {
    this.spinner = ora('Processing manifest').start();
    
    // Read package.json to get the version (single source of truth)
    const packageJsonPath = path.join(config.srcDir, 'package.json');
    const packageJson = await fs.readJson(packageJsonPath);
    const version = packageJson.version;
    
    let manifestPath = path.join(config.srcDir, config.manifestFile);
    const manifest = await fs.readJson(manifestPath);
    
    manifest.version = version;
    console.log(`  → Replaced version placeholder with ${version}`);

    // Write only manifest.json for browser compatibility
    await fs.writeJson(
      path.join(config.distDir, 'manifest.json'),
      manifest,
      { spaces: 2 }
    );
    this.spinner.succeed(`Manifest processed (version: ${version})`);
  }

  /**
   * Process JavaScript files
   */
  async processJavaScript() {
    this.spinner = ora('Processing JavaScript files').start();
    
    const jsFiles = [
      'background/background.js',
      'background/prompt-generator.js',
      'background/llm.js',
      'background/gemini-api.js',
      'background/openrouter-api.js',
      'content/content.js',
      'content/youtube-subtitle-extractor.js',
      'popup/popup.js',
      'popup/instruction-history.js',
      'results/results.js',
      'options/options.js'
    ];
    
    for (const file of jsFiles) {
      const srcPath = path.join(config.srcDir, file);
      const distPath = path.join(config.distDir, file);
      let content = await fs.readFile(srcPath, 'utf8');
      if (file === 'background/background.js') {
        // Prepend polyfill
        const polyfillPath = path.join(config.srcDir, 'vendor', 'browser-polyfill.js');
        const polyfill = await fs.readFile(polyfillPath, 'utf8');
        content = polyfill + '\n' + content;
      }
      // Process imports for browser compatibility
      content = this.processImports(content);
      // Minify for production
      if (this.options.production && !this.options.dev) {
        const result = await minify(content, config.minifyOptions);
        content = result.code;
      }
      await fs.writeFile(distPath, content);
    }
    
    this.spinner.succeed('JavaScript files processed');
  }

  /**
   * Process CSS files
   */
  async processCSS() {
    this.spinner = ora('Processing CSS files').start();
    
    const cssFiles = [
      'content/content.css',
      'popup/popup.css',
      'results/results.css',
      'options/options.css'
    ];
    
    for (const file of cssFiles) {
      const srcPath = path.join(config.srcDir, file);
      const distPath = path.join(config.distDir, file);
      
      let content = await fs.readFile(srcPath, 'utf8');
      
      // Minify CSS for production
      if (this.options.production && !this.options.dev) {
        content = this.minifyCSS(content);
      }
      
      await fs.writeFile(distPath, content);
    }
    
    this.spinner.succeed('CSS files processed');
  }

  /**
   * Process HTML files
   */
  async processHTML() {
    this.spinner = ora('Processing HTML files').start();
    
    const htmlFiles = [
      'popup/popup.html',
      'results/results.html',
      'options/options.html'
    ];
    
    for (const file of htmlFiles) {
      const distPath = path.join(config.distDir, file);
      let content = await fs.readFile(distPath, 'utf8');
      
      // Minify HTML for production
      if (this.options.production && !this.options.dev) {
        content = this.minifyHTML(content);
      }
      
      await fs.writeFile(distPath, content);
    }
    
    this.spinner.succeed('HTML files processed');
  }

  /**
   * Generate or copy icons
   */
  async generateIcons() {
    this.spinner = ora('Generating icons').start();
    
    const iconsDir = path.join(config.srcDir, 'icons');
    const distIconsDir = path.join(config.distDir, 'icons');
    
    // Check if icons already exist
    if (await fs.pathExists(iconsDir)) {
      // Copy existing icons
      await fs.copy(iconsDir, distIconsDir);
      this.spinner.succeed('Icons copied');
      return;
    }
    
    // Generate placeholder icons
    await this.generatePlaceholderIcons();
    this.spinner.succeed('Placeholder icons generated');
  }

  /**
   * Validate build output
   */
  async validateBuild() {
    this.spinner = ora('Validating build').start();
    
    // Check manifest
    const manifest = await fs.readJson(path.join(config.distDir, 'manifest.json'));
    if (!manifest.version) {
      throw new Error('Manifest missing version');
    }
    
    // Check required files (excluding the browser-specific manifest)
    const requiredFiles = [
      'background/background.js',
      'background/prompt-generator.js',
      'background/llm.js',
      'background/gemini-api.js',
      'background/openrouter-api.js',
      'content/content.js',
      'content/content.css',
      'content/youtube-subtitle-extractor.js',
      'popup/popup.html',
      'popup/popup.css',
      'popup/popup.js',
      'popup/instruction-history.js',
      'results/results.html',
      'results/results.css',
      'results/results.js',
      'options/options.html',
      'options/options.css',
      'options/options.js'
    ];
    
    for (const file of requiredFiles) {
      const filePath = path.join(config.distDir, file);
      if (!await fs.pathExists(filePath)) {
        throw new Error(`Missing build file: ${file}`);
      }
    }
    
    this.spinner.succeed('Build validation passed');
  }

  /**
   * Process ES6 imports for browser compatibility
   */
  processImports(content) {
    // Convert ES6 imports to browser-compatible format
    content = content.replace(
      /import\s*{\s*(.+?)\s*}\s*from\s*['"](.*?)['"];?/g,
      '// Import: $1 from $2'
    );
    
    content = content.replace(
      /export\s*{\s*(.+?)\s*};?/g,
      '// Export: $1'
    );
    
    content = content.replace(
      /export\s+class\s+(\w+)/g,
      'class $1'
    );
    
    return content;
  }

  /**
   * Minify CSS
   */
  minifyCSS(css) {
    return css
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove comments
      .replace(/\s+/g, ' ') // Collapse whitespace
      .replace(/;\s*}/g, '}') // Remove unnecessary semicolons
      .replace(/\s*{\s*/g, '{') // Remove spaces around braces
      .replace(/\s*}\s*/g, '}')
      .replace(/;\s*/g, ';')
      .trim();
  }

  /**
   * Minify HTML
   */
  minifyHTML(html) {
    return html
      .replace(/<!--[\s\S]*?-->/g, '') // Remove comments
      .replace(/\s+/g, ' ') // Collapse whitespace
      .replace(/>\s+</g, '><') // Remove whitespace between tags
      .trim();
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
  .option('-d, --dev', 'Development build')
  .option('-p, --production', 'Production build')
  .option('-f, --firefox', 'Firefox compatibility')
  .option('-v, --verbose', 'Verbose output')
  .parse();

// Run build
const builder = new ExtensionBuilder(program.opts());
builder.build().catch(error => {
  console.error(chalk.red('Build failed:'), error);
  process.exit(1);
}); 