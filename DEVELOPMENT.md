# Video Chapters Generator - Development Guide

This document contains development-related information for the Video Chapters Generator browser extension.

## Installation for Development

1. Clone this repository:

   ```bash
   git clone https://github.com/your-username/timecodes-browser-extension.git
   cd timecodes-browser-extension
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Build the extension:

   ```bash
   npm run build
   ```

4. Load in Chrome:

   * Open `chrome://extensions/`
   * Enable "Developer mode"
   * Click "Load unpacked"
   * Select the `dist/chrome/` directory

5. Load in Firefox:

   * Open `about:debugging`
   * Click "This Firefox"
   * Click "Load Temporary Add-on"
   * Select any file in the `dist/firefox/` directory

## Architecture

### File Structure

```
timecodes-browser-extension/
├── manifest.chrome.json
├── manifest.firefox.json
├── background/
│   ├── background.js           # Main service worker
│   ├── BaseLLM.js              # Base class for all LLM providers
│   ├── prompt-generator.js     # Centralized prompt building
│   ├── gemini-api.js           # Direct Google Gemini API integration
│   └── openrouter-api.js       # OpenRouter API with multiple models
├── content/
│   ├── content.js
│   └── content.css
├── popup/
│   ├── popup.html
│   ├── popup.css
│   ├── popup.js
│   └── instruction-history.js
├── results/
│   ├── results.html
│   ├── results.css
│   └── results.js
├── options/
│   ├── options.html
│   ├── options.css
│   └── options.js
├── icons/
├── scripts/
│   ├── build.js
│   ├── generate-icons.js
│   ├── package.js
│   ├── clean.js
│   └── validate.js
└── vendor/
    └── browser-polyfill.js
```

- Chrome build uses `manifest.chrome.json` (Manifest V3)
- Firefox build uses `manifest.firefox.json` (Manifest V2)

### Modular LLM Architecture

The extension uses a modular architecture for AI provider integration:

* **`BaseLLM.js`**: Base class with shared functionality (error handling, response parsing, token estimation)
* **`prompt-generator.js`**: Centralized prompt building for different use cases and output formats  
* **`gemini-api.js`**: Direct Google Gemini API integration (extends BaseLLM)
* **`openrouter-api.js`**: OpenRouter API integration with 8+ models (extends BaseLLM)
* **Dynamic routing**: Background script automatically routes requests to the appropriate API based on selected model

### Cross-Browser Compatibility

The extension uses a build system to generate separate distributions for Chrome and Firefox:

* **Chrome**: Uses Manifest V3 with service workers
* **Firefox**: Uses Manifest V2 with background pages
* **Browser Polyfill**: Ensures consistent API usage across browsers

### Data Flow

1. **Content Script** extracts video ID and subtitles from YouTube
2. **Background Script** handles API communication and session storage
3. **Popup** provides user interface for configuration and triggering
4. **Results Page** displays generated chapters with smart navigation

### Session Storage Architecture

* **No Persistent Storage**: Results are only stored during the current browser session
* **Background Script Relay**: Manages communication between popup and results pages
* **Unique Result IDs**: Each generation gets a unique timestamp-based ID
* **Smart Tab Management**: Tracks video tabs and results tabs for intelligent navigation

## Development Tasks

### Building

```bash
npm install
npm run build
npm run build:chrome
npm run build:firefox
```

### Packaging

```bash
npm run package
npm run package:chrome
npm run package:firefox
```

### Validation

```bash
npm run validate
npm run validate:chrome
npm run validate:firefox
```

### Testing

```bash
npm run test
npm run generate-icons
```

### API Integration

The extension integrates with multiple AI APIs through a modular architecture:

#### Google Gemini API (Direct)
* **Retry Logic**: Handles 503 errors with up to 3 retry attempts
* **Error Handling**: Distinguishes between retryable and non-retryable errors  
* **Rate Limiting**: Respects API rate limits and quota restrictions

#### OpenRouter API (Multiple Providers)
* **Unified Interface**: Single API for accessing DeepSeek, Claude, GPT-4o, Llama, and Gemini
* **Free Model Support**: Handles models that don't require API keys
* **Provider-Specific Error Handling**: Tailored error messages based on model type and provider
* **Dynamic Authentication**: Automatically handles authentication based on model selection

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes following the existing code style
4. Test with both Chrome and Firefox
5. Submit a pull request

### Code Style

* **Minimal Changes**: Keep changes focused and minimal
* **No Unnecessary Comments**: Remove comments unless essential for understanding
* **Cross-Browser Compatibility**: Test changes on both Chrome and Firefox
* **Follow User Preferences**: Respect existing patterns and user-defined rules 