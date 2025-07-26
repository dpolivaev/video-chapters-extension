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
const {program: program} = require('commander');
const Jimp = require('jimp');
const {minify: minify} = require('terser');
const { glob } = require('glob');

const config = {
  srcDir: path.join(process.cwd(), 'src'),
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
  get manifestPath() {
    return path.join(process.cwd(), this.manifestFile);
  },
  // Special files that need individual handling
  specialFiles: {
    vendor: ['vendor/browser-polyfill.js'],
    legal: ['LICENSE', 'README.md']
  },
  iconSizes: [ 16, 48, 128 ],
  minifyOptions: {
    compress: {
      drop_console: true,
      drop_debugger: true
    },
    mangle: true,
    format: {
      comments: /Copyright \(C\)/
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

  async discoverFiles(extension) {
    const files = [];

    if (extension === '.json') {
      files.push(config.manifestFile);
    }

    const srcFiles = await glob(`src/**/*${extension}`, { 
      ignore: ['**/*.test.js', '**/*.spec.js'],
      cwd: process.cwd() 
    });
    
    files.push(...srcFiles.map(file => path.relative('src', file)));

    for (const fileList of Object.values(config.specialFiles)) {
      for (const file of fileList) {
        if (path.extname(file) === extension) {
          files.push(file);
        }
      }
    }

    return files;
  }

  async getAllRequiredFiles() {
    const jsFiles = await this.discoverFiles('.js');
    const cssFiles = await this.discoverFiles('.css');
    const htmlFiles = await this.discoverFiles('.html');
    const jsonFiles = await this.discoverFiles('.json');

    return [...jsFiles, ...cssFiles, ...htmlFiles, ...jsonFiles];
  }

  async build() {
    try {
      this.log(chalk.blue('🔨 Building Video Chapters Generator Extension\n'));
      await this.setup();
      await this.validateSource();
      await this.createDistDirectory();
      await this.copyStaticFiles();
      await this.copyLocales();
      await this.processManifest();
      await this.processJavaScript();
      await this.processCSS();
      await this.processHTML();
      await this.generateIcons();
      await this.validateBuild();
      this.log(chalk.green('✅ Build completed successfully!'));
      this.log(chalk.gray(`📁 Output: ${config.distDir}`));
      const manifestPath = path.join(config.distDir, 'manifest.json');
      const manifest = await fs.readJson(manifestPath);
      const buildInfo = {
        buildTime: (new Date).toISOString(),
        version: manifest.version
      };
      await fs.writeFile(path.join(config.distDir, 'build-info.json'), JSON.stringify(buildInfo, null, 2));
    } catch (error) {
      this.logError('Build failed:', error);
      process.exit(1);
    }
  }
  async setup() {
    this.spinner = ora('Setting up build environment').start();
    await fs.remove(config.distDir);
    await fs.remove(config.tempDir);
    await fs.ensureDir(config.distDir);
    await fs.ensureDir(config.tempDir);
    this.spinner.succeed('Build environment ready');
  }
  async validateSource() {
    this.spinner = ora('Validating source files').start();
    const missing = [];

    // Check src directory exists
    if (!await fs.pathExists(config.srcDir)) {
      missing.push('src/ (directory)');
    }

    // Check manifest file (in root)
    if (!await fs.pathExists(config.manifestPath)) {
      missing.push(config.manifestFile);
    }

    // Check special files
    for (const fileList of Object.values(config.specialFiles)) {
      for (const file of fileList) {
        const filePath = path.join(process.cwd(), file);
        if (!await fs.pathExists(filePath)) {
          missing.push(file);
        }
      }
    }

    if (missing.length > 0) {
      this.spinner.fail('Missing required files/directories');
      throw new Error(`Missing: ${missing.join(', ')}`);
    }
    this.spinner.succeed('Source files validated');
  }
  async createDistDirectory() {
    this.spinner = ora('Creating distribution structure').start();

    // Create dist root
    await fs.ensureDir(config.distDir);

    // Recursively create directory structure from src/
    const createDirStructure = async (srcDir, distDir) => {
      if (!(await fs.pathExists(srcDir))) {
        return;
      }

      const entries = await fs.readdir(srcDir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const srcSubDir = path.join(srcDir, entry.name);
          const distSubDir = path.join(distDir, entry.name);
          await fs.ensureDir(distSubDir);
          await createDirStructure(srcSubDir, distSubDir);
        }
      }
    };

    await createDirStructure(config.srcDir, config.distDir);

    // Create additional required directories
    await fs.ensureDir(path.join(config.distDir, 'icons'));
    await fs.ensureDir(path.join(config.distDir, 'vendor'));

    // Copy vendor files immediately
    await fs.copy(path.join(process.cwd(), 'vendor', 'browser-polyfill.js'), path.join(config.distDir, 'vendor', 'browser-polyfill.js'));

    this.spinner.succeed('Distribution structure created');
  }
  async copyStaticFiles() {
    this.spinner = ora('Copying static files').start();

    // Copy legal files (from root directory)
    for (const file of config.specialFiles.legal) {
      const srcPath = path.join(process.cwd(), file);
      if (await fs.pathExists(srcPath)) {
        await fs.copy(srcPath, path.join(config.distDir, file));
      }
    }

    this.spinner.succeed('Static files copied');
  }
  async copyLocales() {
    this.spinner = ora('Copying locales').start();
    const localesSrc = path.join(config.srcDir, '_locales');
    const localesDest = path.join(config.distDir, '_locales');
    if (await fs.pathExists(localesSrc)) {
      await fs.copy(localesSrc, localesDest);
      this.spinner.succeed('Locales copied');
    } else {
      this.spinner.info('No _locales directory to copy');
    }
  }
  async processManifest() {
    this.spinner = ora('Processing manifest').start();
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    const packageJson = await fs.readJson(packageJsonPath);
    const version = packageJson.version;
    const manifestPath = config.manifestPath;
    const manifest = await fs.readJson(manifestPath);
    manifest.version = version;
    console.log(`  → Replaced version placeholder with ${version}`);
    await fs.writeJson(path.join(config.distDir, 'manifest.json'), manifest, {
      spaces: 2
    });
    this.spinner.succeed(`Manifest processed (version: ${version})`);
  }
  async processJavaScript() {
    this.spinner = ora('Processing JavaScript files').start();
    const jsFiles = await this.discoverFiles('.js');

    for (const file of jsFiles) {
      // Skip vendor files as they're copied directly in createDistDirectory
      if (file.startsWith('vendor/')) {
        continue;
      }

      // Determine source path - special files come from root, others from src/
      const isSpecialFile = Object.values(config.specialFiles).flat().includes(file);
      const srcPath = isSpecialFile ?
        path.join(process.cwd(), file) :
        path.join(config.srcDir, file);

      const distPath = path.join(config.distDir, file);
      let content = await fs.readFile(srcPath, 'utf8');

      // Special handling for background.js
      if (file === 'background/background.js') {
        const polyfillPath = path.join(process.cwd(), 'vendor', 'browser-polyfill.js');
        const polyfill = await fs.readFile(polyfillPath, 'utf8');
        content = polyfill + '\n' + content;
      }

      content = this.processImports(content);

      if (this.options.production && !this.options.dev) {
        const result = await minify(content, config.minifyOptions);
        content = result.code;
      }

      await fs.writeFile(distPath, content);
    }

    this.spinner.succeed('JavaScript files processed');
  }
  async processCSS() {
    this.spinner = ora('Processing CSS files').start();
    const cssFiles = await this.discoverFiles('.css');

    for (const file of cssFiles) {
      // Determine source path - special files come from root, others from src/
      const isSpecialFile = Object.values(config.specialFiles).flat().includes(file);
      const srcPath = isSpecialFile ?
        path.join(process.cwd(), file) :
        path.join(config.srcDir, file);

      const distPath = path.join(config.distDir, file);
      let content = await fs.readFile(srcPath, 'utf8');

      if (this.options.production && !this.options.dev) {
        content = this.minifyCSS(content);
      }

      await fs.writeFile(distPath, content);
    }

    this.spinner.succeed('CSS files processed');
  }
  async processHTML() {
    this.spinner = ora('Processing HTML files').start();
    const htmlFiles = await this.discoverFiles('.html');

    for (const file of htmlFiles) {
      // Determine source path - special files come from root, others from src/
      const isSpecialFile = Object.values(config.specialFiles).flat().includes(file);
      const srcPath = isSpecialFile ?
        path.join(process.cwd(), file) :
        path.join(config.srcDir, file);

      const distPath = path.join(config.distDir, file);

      // Copy HTML file first, then process
      await fs.copy(srcPath, distPath);

      let content = await fs.readFile(distPath, 'utf8');
      if (this.options.production && !this.options.dev) {
        content = this.minifyHTML(content);
      }
      await fs.writeFile(distPath, content);
    }

    this.spinner.succeed('HTML files processed');
  }
  async generateIcons() {
    this.spinner = ora('Generating icons').start();
    const iconsDir = path.join(process.cwd(), 'icons');
    const distIconsDir = path.join(config.distDir, 'icons');
    if (await fs.pathExists(iconsDir)) {
      await fs.copy(iconsDir, distIconsDir);
      this.spinner.succeed('Icons copied');
      return;
    }
    await this.generatePlaceholderIcons();
    this.spinner.succeed('Placeholder icons generated');
  }

  async generatePlaceholderIcons() {
    const iconsDir = path.join(config.distDir, 'icons');
    await fs.ensureDir(iconsDir);

    // Create simple placeholder icons for each required size
    for (const size of config.iconSizes) {
      const iconPath = path.join(iconsDir, `icon${size}.png`);
      // Create a simple colored square as placeholder
      const canvas = await new Promise((resolve, reject) => {
        try {
          const canvas = require('canvas').createCanvas(size, size);
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#4CAF50';
          ctx.fillRect(0, 0, size, size);
          ctx.fillStyle = '#ffffff';
          ctx.font = `${size / 4}px Arial`;
          ctx.textAlign = 'center';
          ctx.fillText('VCG', size / 2, size / 2);
          resolve(canvas);
        } catch (error) {
          // If canvas is not available, create a minimal PNG
          resolve(null);
        }
      });

      if (canvas) {
        const buffer = canvas.toBuffer('image/png');
        await fs.writeFile(iconPath, buffer);
      } else {
        // Fallback: create a minimal valid PNG file
        const minimalPng = Buffer.from([
          0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
          0x00, 0x00, 0x00, 0x0D, // IHDR chunk length
          0x49, 0x48, 0x44, 0x52, // IHDR
          0x00, 0x00, 0x00, size, 0x00, 0x00, 0x00, size, // width x height
          0x08, 0x02, 0x00, 0x00, 0x00 // bit depth, color type, compression, filter, interlace
        ]);
        await fs.writeFile(iconPath, minimalPng);
      }
    }
  }
  async validateBuild() {
    this.spinner = ora('Validating build').start();

    // Check manifest
    const manifest = await fs.readJson(path.join(config.distDir, 'manifest.json'));
    if (!manifest.version) {
      throw new Error('Manifest missing version');
    }

    // Check that all discovered source files were built
    const allFiles = await this.getAllRequiredFiles();
    const missing = [];

    for (const file of allFiles) {
      // Skip manifest as it's renamed to manifest.json
      if (file === config.manifestFile) {
        continue;
      }

      const filePath = path.join(config.distDir, file);
      if (!await fs.pathExists(filePath)) {
        missing.push(file);
      }
    }

    if (missing.length > 0) {
      throw new Error(`Missing build files: ${missing.join(', ')}`);
    }

    this.spinner.succeed('Build validation passed');
  }
  processImports(content) {
    content = content.replace(/import\s*{\s*(.+?)\s*}\s*from\s*['"](.*?)['"];?/g, '// Import: $1 from $2');
    content = content.replace(/export\s*{\s*(.+?)\s*};?/g, '// Export: $1');
    content = content.replace(/export\s+class\s+(\w+)/g, 'class $1');
    return content;
  }
  minifyCSS(css) {
    return css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').replace(/;\s*}/g, '}')
      .replace(/\s*{\s*/g, '{').replace(/\s*}\s*/g, '}').replace(/;\s*/g, ';').trim();
  }
  minifyHTML(html) {
    return html.replace(/<!--[\s\S]*?-->/g, '').replace(/\s+/g, ' ').replace(/>\s+</g, '><').trim();
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

program.option('-d, --dev', 'Development build').option('-p, --production', 'Production build')
  .option('-f, --firefox', 'Firefox compatibility').option('-v, --verbose', 'Verbose output').parse();

const builder = new ExtensionBuilder(program.opts());

builder.build().catch(error => {
  console.error(chalk.red('Build failed:'), error);
  process.exit(1);
});
