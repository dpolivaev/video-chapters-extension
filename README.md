# Video Chapters Generator

A cross-browser extension that automatically generates AI-powered chapter timecodes for YouTube videos using multiple AI providers (Google Gemini, OpenRouter) and subtitle analysis.


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

### Firefox Add-on

Download the latest Firefox add-on (.xpi file) from the [GitHub Releases](https://github.com/dpolivaev/timecodes-browser-extension/releases) section and install it directly in Firefox.

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

## Privacy & Security

* **Local Storage Only**: All your data is stored solely in your browser's local storage and never leaves your device except when explicitly sent to Gemini (Google's LLM).
* **No External Data Collection**: The extension does not send any data to external servers, except to your selected AI provider for processing the transcript.
* **No DOM Parsing**: Subtitles are not extracted from the webpage DOM.
* **Transcript Retrieval**: The extension retrieves subtitles from YouTube by issuing the same requests the browser makes when the user opens the transcript panel, and sends them to your selected AI provider for processing.
* **Minimal Permissions**: The extension requests only the permissions necessary for integration with YouTube and session storage.
* **Session-Only Results**: Generated chapters are stored only for the current browser session and are not persisted.
* **Provider Choice**: You control which AI service processes your data by selecting the model. Data is only sent to the provider of your chosen model.
* **API Key Security**: API keys are stored locally in your browser and only transmitted to their respective services.

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

* Subtitle retrieval logic is based on code by **Hamza Wasim**, used with permission.

---

## Development

For development-related information, please see [DEVELOPMENT.md](DEVELOPMENT.md).
