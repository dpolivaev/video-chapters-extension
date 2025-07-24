# Video Chapters Generator

A cross-browser extension that automatically generates AI-powered chapter timecodes for YouTube videos using multiple AI providers (Google Gemini, OpenRouter) and subtitle analysis.

Copyright (C) 2025 Dimitry Polivaev

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program. If not, see [https://www.gnu.org/licenses/](https://www.gnu.org/licenses/).

---

## Features

* **One-Click Chapter Generation**: Generate chapters directly from YouTube video pages
* **Multiple AI Providers**: Choose from Google Gemini (direct API) or OpenRouter (with access to DeepSeek R1, Claude, GPT-4o, Llama, and more)
* **Free Model Options**: Use DeepSeek R1 for free without requiring an API key
* **Model Selection**: Choose from 11+ different AI models based on your needs and budget
* **Custom Instructions**: Add personalized instructions to tailor chapter generation to your needs
* **Instruction History**: Save and reuse successful instruction prompts
* **Smart Tab Management**: Intelligent handling of results tabs and video navigation
* **Session-Based Results**: Results are stored only for the current browser session
* **Cross-Browser Support**: Works on both Chrome (Manifest V3) and Firefox (Manifest V2)
* **Dynamic API Key Management**: Automatically shows the correct API key field based on selected model
* **Multiple Export Formats**: Copy chapters in various formats for different use cases

---

## Installation

### Chrome Web Store

*Coming soon*

### Manual Installation

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

---

## Setup

### Model Selection & API Configuration

The extension supports multiple AI providers with different models:

#### Free Options (No API Key Required)
* **DeepSeek R1 Free**: Latest reasoning model, completely free to use

#### Gemini Models (Direct Google API)
* **Gemini 2.5 Pro**: Most capable model for complex analysis
* **Gemini 2.5 Flash**: Faster model optimized for speed

#### OpenRouter Models (Single API Key for Multiple Providers)
* **DeepSeek R1**: Advanced reasoning capabilities
* **Claude 3.5 Sonnet/Haiku**: Anthropic's powerful models
* **GPT-4o/GPT-4o Mini**: OpenAI's latest models
* **Llama 3.3 70B**: Meta's advanced open-source model
* **Gemini via OpenRouter**: Access Gemini through OpenRouter

### API Key Setup

#### Option 1: Use Free Models
1. Click the extension icon and select "DeepSeek R1 0528 (Free)"
2. No API key required - start generating chapters immediately!

#### Option 2: Gemini Direct API
1. Get a free Gemini API key from [Google AI Studio](https://ai.google.dev)
2. Open extension options page and enter your Gemini API key
3. Select any Gemini model in the popup

#### Option 3: OpenRouter (Multiple Models)
1. Create a free account at [OpenRouter](https://openrouter.ai)
2. Generate an API key from your OpenRouter dashboard
3. Open extension options page and enter your OpenRouter API key  
4. Select any OpenRouter model in the popup

**Note**: API keys are stored securely in your browser's local storage and never leave your device except when sent to the respective AI service.

---

## Usage

### Generating Chapters

1. **Navigate to any YouTube video**
2. **Open the extension popup** by clicking the extension icon
3. **Select your preferred AI model** from the dropdown (defaults to free DeepSeek R1)
4. **Enter API key if required** (automatically shows the correct field based on selected model)
5. **Add custom instructions** (optional) to guide the AI in generating specific types of chapters
6. **Click "Generate Chapters"** to start the process
7. **View results** in the automatically opened results tab with model and prompt information displayed

### Custom Instructions

Add specific instructions to customize chapter generation:

* "Focus on key topics and main points"
* "Create chapters for educational content with clear learning objectives"
* "Generate chapters suitable for tutorial videos"
* "Emphasize important announcements and updates"

### Instruction History

* **Save frequently used instructions** for easy reuse
* **Click on saved instructions** to automatically fill the input field
* **Delete instructions** you no longer need

### Results Management

* **View Results**: Opens results in a new tab (or focuses existing tab for the same generation)
* **Back to Video**: Smart navigation that returns to the original video tab
* **Copy Chapters**: Copy generated chapters with video URL included
* **Session Storage**: Results are only available during the current browser session

---

## Architecture

### File Structure

```
timecodes-browser-extension/
├── manifest.chrome.json
├── manifest.firefox.json
├── background/
│   ├── background.js           # Main service worker
│   ├── llm.js                 # Base class for all LLM providers
│   ├── prompt-generator.js    # Centralized prompt building
│   ├── gemini-api.js         # Direct Google Gemini API integration
│   └── openrouter-api.js     # OpenRouter API with multiple models
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

* **`llm.js`**: Base class with shared functionality (error handling, response parsing, token estimation)
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

---

## Development

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

---

## Privacy & Security

* **Local Storage Only**: All your data is stored solely in your browser’s local storage and never leaves your device except when explicitly sent to Gemini (Google’s LLM).
* **No External Data Collection**: The extension does not send any data to external servers, except to your selected AI provider for processing the transcript.
* **No DOM Parsing**: Subtitles are not extracted from the webpage DOM.
* **Transcript Retrieval**: The extension retrieves subtitles from YouTube by issuing the same requests the browser makes when the user opens the transcript panel, and sends them to your selected AI provider for processing.
* **Minimal Permissions**: The extension requests only the permissions necessary for integration with YouTube and session storage.
* **Session-Only Results**: Generated chapters are stored only for the current browser session and are not persisted.
* **Provider Choice**: You control which AI service processes your data by selecting the model. Data is only sent to the provider of your chosen model.
* **API Key Security**: API keys are stored locally in your browser and only transmitted to their respective services.

---

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

---

## License

This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.

You should have received a copy of the GNU General Public License along with this program. If not, see [https://www.gnu.org/licenses/](https://www.gnu.org/licenses/).

---

## Recent Updates

### v2.0.0 - Multi-Provider AI Support

* **🚀 New Providers**: Added OpenRouter integration with 8+ AI models
* **🆓 Free Options**: DeepSeek R1 available for free without API key
* **🎯 Model Selection**: Choose from Gemini, Claude, GPT-4o, Llama, and more
* **🏗️ Modular Architecture**: Clean separation of AI providers with shared functionality
* **🔧 Smart UI**: Dynamic API key field based on selected model
* **📊 Provider Info**: Results page shows which model and custom instructions were used

---

## Acknowledgments

* Subtitle retrieval logic is based on code by **Hamza Wasim**, reused with permission.
