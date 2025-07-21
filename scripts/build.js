#!/usr/bin/env node

/**
 * Build Script for Video Chapters Generator Extension
 * Handles compilation, minification, and preparation
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
      'background/gemini-api.js',
      'content/content.js',
      'content/content.css',
      'content/youtube-subtitle-extractor.js',
      'popup/popup.html',
      'popup/popup.css',
      'popup/popup.js',
      'popup/instruction-history.js',
      'results/results.html',
      'results/results.css',
      'results/results.js'
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
      await this.createOptionsPage();
      
      // Final validation
      await this.validateBuild();
      
      this.log(chalk.green('✅ Build completed successfully!'));
      this.log(chalk.gray(`📁 Output: ${config.distDir}`));
      
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
      'results/results.html'
    ];
    
    for (const file of htmlFiles) {
      await fs.copy(
        path.join(config.srcDir, file),
        path.join(config.distDir, file)
      );
    }
    
    this.spinner.succeed('Static files copied');
  }

  /**
   * Process manifest.json
   */
  async processManifest() {
    this.spinner = ora('Processing manifest').start();
    
    let manifestPath = path.join(config.srcDir, config.manifestFile);
    const manifest = await fs.readJson(manifestPath);
    // Write only manifest.json for browser compatibility
    await fs.writeJson(
      path.join(config.distDir, 'manifest.json'),
      manifest,
      { spaces: 2 }
    );
    this.spinner.succeed('Manifest processed');
  }

  /**
   * Process JavaScript files
   */
  async processJavaScript() {
    this.spinner = ora('Processing JavaScript files').start();
    
    const jsFiles = [
      'background/background.js',
      'background/gemini-api.js',
      'content/content.js',
      'content/youtube-subtitle-extractor.js',
      'popup/popup.js',
      'popup/instruction-history.js',
      'results/results.js'
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
      'results/results.css'
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
      'results/results.html'
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
   * Create options page
   */
  async createOptionsPage() {
    this.spinner = ora('Creating options page').start();
    
    const optionsHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Video Chapters Generator - Options</title>
  <link rel="stylesheet" href="options.css">
</head>
<body>
  <div class="container">
    <header>
      <h1>Video Chapters Generator</h1>
      <p>Configure your extension settings</p>
    </header>
    
    <main>
      <section class="setting-group">
        <h2>Gemini API</h2>
        <label for="apiKey">API Key:</label>
        <input type="password" id="apiKey" placeholder="Enter your Gemini API key">
        <button id="clearApiKey">Clear</button>
      </section>
      
      <section class="setting-group">
        <h2>Default Settings</h2>
        <label for="defaultModel">Default Model:</label>
        <select id="defaultModel">
          <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
          <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
        </select>
        
        <label for="historyLimit">Instruction History Limit:</label>
        <input type="number" id="historyLimit" min="1" max="50" value="10">
      </section>
      
      <section class="setting-group">
        <h2>About</h2>
        <p>Version: 1.0.0</p>
        <p>Created by Dimitry Polivaev</p>
      </section>
    </main>
    
    <footer>
      <button id="saveSettings" class="btn-primary">Save Settings</button>
      <button id="resetSettings" class="btn-secondary">Reset to Defaults</button>
    </footer>
  </div>
  
  <script src="options.js"></script>
</body>
</html>`;

    const optionsCSS = `
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  margin: 0;
  padding: 20px;
  background: #f5f5f5;
}

.container {
  max-width: 600px;
  margin: 0 auto;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  overflow: hidden;
}

header {
  background: #4A90E2;
  color: white;
  padding: 20px;
  text-align: center;
}

header h1 {
  margin: 0 0 8px 0;
  font-size: 24px;
}

header p {
  margin: 0;
  opacity: 0.9;
}

main {
  padding: 20px;
}

.setting-group {
  margin-bottom: 24px;
  padding-bottom: 20px;
  border-bottom: 1px solid #eee;
}

.setting-group:last-child {
  border-bottom: none;
}

.setting-group h2 {
  margin: 0 0 16px 0;
  font-size: 18px;
  color: #333;
}

label {
  display: block;
  margin-bottom: 4px;
  font-weight: 500;
}

input, select {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  margin-bottom: 12px;
  font-size: 14px;
}

button {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  margin-right: 8px;
}

.btn-primary {
  background: #4A90E2;
  color: white;
}

.btn-secondary {
  background: #f5f5f5;
  color: #333;
  border: 1px solid #ddd;
}

footer {
  padding: 20px;
  background: #f9f9f9;
  text-align: right;
}
`;

    const optionsJS = `
class OptionsManager {
  constructor() {
    this.init();
  }
  
  async init() {
    await this.loadSettings();
    this.setupEventListeners();
  }
  
  async loadSettings() {
    const result = await chrome.storage.sync.get(['userSettings']);
    const settings = result.userSettings || {};
    
    document.getElementById('apiKey').value = settings.apiKey || '';
    document.getElementById('defaultModel').value = settings.model || 'gemini-2.5-pro';
    document.getElementById('historyLimit').value = settings.historyLimit || 10;
  }
  
  async saveSettings() {
    const settings = {
      apiKey: document.getElementById('apiKey').value,
      model: document.getElementById('defaultModel').value,
      historyLimit: parseInt(document.getElementById('historyLimit').value)
    };
    
    await chrome.storage.sync.set({ userSettings: settings });
    
    // Show success message
    const btn = document.getElementById('saveSettings');
    const originalText = btn.textContent;
    btn.textContent = 'Saved!';
    btn.style.background = '#2196F3';
    
    setTimeout(() => {
      btn.textContent = originalText;
      btn.style.background = '#4CAF50';
    }, 2000);
  }
  
  setupEventListeners() {
    document.getElementById('saveSettings').addEventListener('click', () => {
      this.saveSettings();
    });
    
    document.getElementById('resetSettings').addEventListener('click', () => {
      if (confirm('Reset all settings to defaults?')) {
        document.getElementById('apiKey').value = '';
        document.getElementById('defaultModel').value = 'gemini-2.5-pro';
        document.getElementById('historyLimit').value = 10;
      }
    });
    
    document.getElementById('clearApiKey').addEventListener('click', () => {
      document.getElementById('apiKey').value = '';
    });
  }
}

new OptionsManager();
`;
    
    await fs.writeFile(path.join(config.distDir, 'options', 'options.html'), optionsHTML);
    await fs.writeFile(path.join(config.distDir, 'options', 'options.css'), optionsCSS);
    await fs.writeFile(path.join(config.distDir, 'options', 'options.js'), optionsJS);
    
    this.spinner.succeed('Options page created');
  }

  /**
   * Generate placeholder icons
   */
  async generatePlaceholderIcons() {
    for (const size of config.iconSizes) {
      const image = new Jimp(size, size, '#4CAF50');
      
      // Add text
      const font = await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE);
      const text = 'YC';
      const textWidth = Jimp.measureText(font, text);
      const textHeight = Jimp.measureTextHeight(font, text);
      
      image.print(
        font,
        (size - textWidth) / 2,
        (size - textHeight) / 2,
        text
      );
      
      await image.writeAsync(path.join(config.distDir, 'icons', `icon${size}.png`));
    }
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
      'background/gemini-api.js',
      'content/content.js',
      'content/content.css',
      'content/youtube-subtitle-extractor.js',
      'popup/popup.html',
      'popup/popup.css',
      'popup/popup.js',
      'popup/instruction-history.js',
      'results/results.html',
      'results/results.css',
      'results/results.js'
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