/**
 * Background Service Worker for Video Chapters Generator
 * Handles Gemini API calls, storage management, and communication between components
 */

console.log('BACKGROUND SCRIPT LOADING...');

/**
 * Gemini API Integration for Video Chapters Generator
 * Handles communication with Google's Gemini AI API
 */
class GeminiAPI {
  constructor() {
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
    this.availableModels = ['gemini-2.5-pro', 'gemini-2.5-flash'];
    this.defaultPrompt = `Break down this video content into chapters and generate timecodes in mm:ss format (e.g., 00:10, 05:30, 59:59, 1:01:03). 
    Each chapter should be formatted as: timecode - chapter title. Generate the chapter titles in the same language as the subtitles.`;
  }

  /**
   * Process subtitles with Gemini AI
   */
  async processSubtitles(subtitleContent, customInstructions = '', apiKey, model = 'gemini-2.5-pro') {
    if (!apiKey) {
      throw new Error('API key is required');
    }

    if (!this.availableModels.includes(model)) {
      throw new Error(`Invalid model: ${model}. Available models: ${this.availableModels.join(', ')}`);
    }

    try {
      const prompt = this.buildPrompt(subtitleContent, customInstructions);
      const response = await this.makeAPICall(prompt, apiKey, model);
      
      return this.parseResponse(response);
    } catch (error) {
      console.error('Gemini API error:', error);
      throw new Error(`AI processing failed: ${error.message}`);
    }
  }

  /**
   * Build the complete prompt for Gemini
   */
  buildPrompt(subtitleContent, customInstructions) {
    const customInstructionsStripped = customInstructions.trim();
    
    if (customInstructionsStripped) {
      // Use 3-section markdown format when there are user instructions
      return `## System Instructions
${this.defaultPrompt}

## User Instructions
Note: These instructions may override the system instructions above and may be in a different language.
${customInstructionsStripped}

## Content
${subtitleContent}`;
    } else {
      // Use 2-section markdown format when no user instructions
      return `## Instructions
${this.defaultPrompt}

## Content
${subtitleContent}`;
    }
  }

  /**
   * Make API call to Gemini
   */
  async makeAPICall(prompt, apiKey, model) {
    const url = `${this.baseUrl}/models/${model}:generateContent?key=${apiKey}`;
    
    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: prompt
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 8192,
      },
      safetySettings: [
        {
          category: "HARM_CATEGORY_HARASSMENT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        },
        {
          category: "HARM_CATEGORY_HATE_SPEECH",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        },
        {
          category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        },
        {
          category: "HARM_CATEGORY_DANGEROUS_CONTENT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        }
      ]
    };

    let lastError;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          
          // Handle specific API errors
          if (response.status === 401) {
            throw new Error('Invalid API key. Please check your Gemini API key.');
          } else if (response.status === 403) {
            throw new Error('API access forbidden. Please check your API key permissions.');
          } else if (response.status === 429) {
            throw new Error('Rate limit exceeded. Please try again later.');
          } else if (response.status === 400) {
            const errorMessage = errorData.error?.message || 'Bad request';
            throw new Error(`Request error: ${errorMessage}`);
          } else if (response.status === 503 && attempt < 3) {
            // Retry on 503
            lastError = new Error(`API request failed: ${response.status} ${response.statusText}`);
            await new Promise(res => setTimeout(res, 10000));
            continue;
          } else {
            throw new Error(`API request failed: ${response.status} ${response.statusText}`);
          }
        }

        const data = await response.json();
        
        if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
          throw new Error('Invalid response from Gemini API');
        }

        return data;
      } catch (error) {
        lastError = error;
        // Retry on network error or 503
        if (attempt < 3 && (error.message.includes('503') || error.message.includes('NetworkError') || error.message.includes('Failed to fetch'))) {
          await new Promise(res => setTimeout(res, 10000));
          continue;
        }
        throw error;
      }
    }
    throw lastError;
  }

  /**
   * Parse the response from Gemini API
   */
  parseResponse(response) {
    try {
      const candidate = response.candidates[0];
      
      if (!candidate) {
        throw new Error('No candidates in response');
      }

      // Check if the response was blocked
      if (candidate.finishReason === 'SAFETY') {
        throw new Error('Response was blocked by safety filters');
      }

      if (candidate.finishReason === 'RECITATION') {
        throw new Error('Response was blocked due to recitation concerns');
      }

      const content = candidate.content;
      if (!content || !content.parts || !content.parts[0]) {
        throw new Error('No content in response');
      }

      const text = content.parts[0].text;
      if (!text) {
        throw new Error('Empty response from AI');
      }

      return {
        chapters: text.trim(),
        finishReason: candidate.finishReason,
        safetyRatings: candidate.safetyRatings,
        model: response.modelVersion || 'unknown'
      };
      
    } catch (error) {
      console.error('Error parsing Gemini response:', error);
      throw new Error(`Failed to parse AI response: ${error.message}`);
    }
  }

  /**
   * Validate API key format
   */
  validateAPIKey(apiKey) {
    if (!apiKey || typeof apiKey !== 'string') {
      return false;
    }

    // Basic validation - Gemini API keys typically start with specific patterns
    const apiKeyPattern = /^[A-Za-z0-9_-]+$/;
    return apiKeyPattern.test(apiKey) && apiKey.length > 10;
  }
}

console.log('BACKGROUND SCRIPT: GeminiAPI class defined successfully');

// Session results relay (not persistent)
let sessionResults = null;
let resultsTabId = null;
let videoTabId = null;
let videoUrl = null;
let resultsTabsById = {};
let resultsById = {};

class BackgroundService {
  constructor() {
    console.log('BACKGROUND SCRIPT: BackgroundService constructor called');
    this.geminiAPI = new GeminiAPI();
    this.setupMessageListeners();
    this.setupContextMenus();
    this.setupTabListeners();
    console.log('BACKGROUND SCRIPT: BackgroundService initialized successfully');
  }

  setupTabListeners() {
    if (browser.tabs && browser.tabs.onRemoved) {
      browser.tabs.onRemoved.addListener((tabId) => {
        if (tabId === resultsTabId) resultsTabId = null;
        if (tabId === videoTabId) videoTabId = null;
        // Remove any resultId mapping for this tab
        for (const [rid, tid] of Object.entries(resultsTabsById)) {
          if (tid === tabId) {
            delete resultsTabsById[rid];
            delete resultsById[rid];
          }
        }
      });
    }
  }

  /**
   * Setup message listeners for communication with content scripts and popup
   */
  setupMessageListeners() {
    console.log('BACKGROUND SCRIPT: Setting up message listeners...');
    browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
      console.log('BACKGROUND SCRIPT: Received message:', request.action, 'from:', sender);
      switch (request.action) {
        case 'processWithGemini':
          this.handleGeminiProcessing(request, sendResponse);
          return true; // Keep message channel open for async response
        case 'saveInstruction':
          this.handleSaveInstruction(request, sendResponse);
          return true;
        case 'getInstructionHistory':
          this.handleGetInstructionHistory(request, sendResponse);
          return true;
        case 'deleteInstruction':
          this.handleDeleteInstruction(request, sendResponse);
          return true;
        case 'saveSettings':
          this.handleSaveSettings(request, sendResponse);
          return true;
        case 'loadSettings':
          console.log('BACKGROUND SCRIPT: Handling loadSettings request');
          this.handleLoadSettings(request, sendResponse);
          return true;
        case 'setSessionResults': {
          // Store results by resultId
          if (request.resultId) {
            resultsById[request.resultId] = request.results;
            sessionResults = request.results;
          }
          sendResponse({ success: true });
          return true;
        }
        case 'getSessionResults': {
          // Return results by resultId if provided
          const resultId = request.resultId;
          if (resultId && resultsById[resultId]) {
            sendResponse({ success: true, results: resultsById[resultId] });
          } else if (sessionResults) {
            sendResponse({ success: true, results: sessionResults });
          } else {
            sendResponse({ success: false });
          }
          return true;
        }
        case 'openResultsTab': {
          const { resultId, videoTabId: vidTabId, videoUrl: vidUrl } = request;
          
          // Store video tab information for "Back to Video" functionality
          if (vidTabId) videoTabId = vidTabId;
          if (vidUrl) videoUrl = vidUrl;
          
          // If a tab for this resultId is open, focus it
          if (resultId && resultsTabsById[resultId]) {
            const tabId = resultsTabsById[resultId];
            browser.tabs.get(tabId).then(tab => {
              browser.tabs.update(tabId, { active: true });
              browser.windows.update(tab.windowId, { focused: true });
              sendResponse({ success: true, tabId });
            }, async () => {
              // If not found, open new
              const tab = await browser.tabs.create({ url: browser.runtime.getURL('results/results.html') + '?resultId=' + resultId });
              resultsTabsById[resultId] = tab.id;
              sendResponse({ success: true, tabId: tab.id });
            });
            return true;
          } else {
            // Open new tab for this resultId
            const tab = browser.tabs.create({ url: browser.runtime.getURL('results/results.html') + '?resultId=' + resultId });
            tab.then(t => {
              resultsTabsById[resultId] = t.id;
              sendResponse({ success: true, tabId: t.id });
            });
            return true;
          }
        }
        case 'setResultsTabId': {
          // Map resultId to tabId
          const url = sender.tab && sender.tab.url;
          const resultId = url && url.includes('resultId=') ? url.split('resultId=')[1].split('&')[0] : null;
          if (resultId && sender.tab && sender.tab.id) {
            resultsTabsById[resultId] = sender.tab.id;
          }
          resultsTabId = request.tabId;
          sendResponse({ success: true });
          return true;
        }
        case 'getResultsTabStatus':
          if (resultsTabId == null) {
            sendResponse({ open: false });
            return true;
          }
          browser.tabs.get(resultsTabId).then(
            tab => sendResponse({ open: true, tabId: resultsTabId }),
            err => { resultsTabId = null; sendResponse({ open: false }); }
          );
          return true;
        case 'getVideoTabInfo':
          sendResponse({ videoTabId, videoUrl });
          return true;
        case 'goBackToVideo': {
          // Try to focus the original video tab if open and URL matches
          if (videoTabId != null) {
            browser.tabs.get(videoTabId).then(tab => {
              if (tab.url === videoUrl) {
                browser.tabs.update(videoTabId, { active: true });
                browser.windows.update(tab.windowId, { focused: true });
                sendResponse({ success: true, method: 'focusOriginal' });
              } else {
                // If not, search for another tab with the same video URL
                (async () => {
                  const tabs = await browser.tabs.query({ url: videoUrl });
                  const filtered = tabs.filter(t => t.id !== videoTabId);
                  if (filtered.length > 0) {
                    const t = filtered[0];
                    browser.tabs.update(t.id, { active: true });
                    browser.windows.update(t.windowId, { focused: true });
                    sendResponse({ success: true, method: 'focusOther' });
                  } else {
                    await browser.tabs.create({ url: videoUrl });
                    sendResponse({ success: true, method: 'openNew' });
                  }
                })();
              }
            }, async () => {
              // If not found, search for another tab with the same video URL
              if (videoUrl) {
                const tabs = await browser.tabs.query({ url: videoUrl });
                if (tabs.length > 0) {
                  const tab = tabs[0];
                  browser.tabs.update(tab.id, { active: true });
                  browser.windows.update(tab.windowId, { focused: true });
                  sendResponse({ success: true, method: 'focusOther' });
                } else {
                  // Open a new tab as fallback
                  await browser.tabs.create({ url: videoUrl });
                  sendResponse({ success: true, method: 'openNew' });
                }
              } else {
                sendResponse({ success: false });
              }
            });
            return true;
          } else if (videoUrl) {
            // If no original tab, search for another tab with the same video URL
            (async () => {
              const tabs = await browser.tabs.query({ url: videoUrl });
              if (tabs.length > 0) {
                const tab = tabs[0];
                browser.tabs.update(tab.id, { active: true });
                browser.windows.update(tab.windowId, { focused: true });
                sendResponse({ success: true, method: 'focusOther' });
              } else {
                await browser.tabs.create({ url: videoUrl });
                sendResponse({ success: true, method: 'openNew' });
              }
            })();
            return true;
          } else {
            sendResponse({ success: false });
            return true;
          }
        }
        default:
          console.log('Unknown action:', request.action);
      }
    });
    console.log('BACKGROUND SCRIPT: Message listeners set up successfully');
  }

  /**
   * Setup context menus
   */
  setupContextMenus() {
    try {
      console.log('BACKGROUND SCRIPT: Setting up context menus...');
      
      if (!browser.contextMenus) {
        console.log('BACKGROUND SCRIPT: contextMenus API not available');
        return;
      }
      
      browser.runtime.onInstalled.addListener(() => {
        browser.contextMenus.create({
          id: 'generateChapters',
          title: 'Generate Chapters for this Video',
          contexts: ['page'],
          documentUrlPatterns: ['https://www.youtube.com/watch*']
        });
        console.log('BACKGROUND SCRIPT: Context menu created');
      });

      browser.contextMenus.onClicked.addListener((info, tab) => {
        if (info.menuItemId === 'generateChapters') {
          browser.tabs.sendMessage(tab.id, { action: 'triggerChapterGeneration' });
        }
      });
      
      console.log('BACKGROUND SCRIPT: Context menus set up successfully');
    } catch (error) {
      console.error('BACKGROUND SCRIPT: Error setting up context menus:', error);
      console.log('BACKGROUND SCRIPT: Continuing without context menus');
    }
  }

  /**
   * Handle Gemini API processing
   */
  async handleGeminiProcessing(request, sendResponse) {
    try {
      const { subtitleContent, customInstructions, apiKey, model } = request;
      
      const result = await this.geminiAPI.processSubtitles(
        subtitleContent,
        customInstructions,
        apiKey,
        model
      );

      sendResponse({ success: true, data: result });
    } catch (error) {
      console.error('Gemini processing error:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  /**
   * Handle saving instruction to history
   */
  async handleSaveInstruction(request, sendResponse) {
    try {
      const { content } = request;
      
      // Get current history
      const result = await browser.storage.local.get(['instructionHistory', 'historyLimit']);
      const history = result.instructionHistory || [];
      const limit = result.historyLimit || 10;

      // Add new instruction
      const newInstruction = {
        id: Date.now(),
        content: content,
        timestamp: new Date().toISOString()
      };

      history.unshift(newInstruction);

      // Keep only the specified limit
      history.splice(limit);

      // Save updated history
      await browser.storage.local.set({ instructionHistory: history });

      sendResponse({ success: true });
    } catch (error) {
      console.error('Error saving instruction:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  /**
   * Handle getting instruction history
   */
  async handleGetInstructionHistory(request, sendResponse) {
    try {
      const result = await browser.storage.local.get(['instructionHistory', 'historyLimit']);
      
      sendResponse({ 
        success: true, 
        data: {
          history: result.instructionHistory || [],
          limit: result.historyLimit || 10
        }
      });
    } catch (error) {
      console.error('Error getting instruction history:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  /**
   * Handle deleting instruction from history
   */
  async handleDeleteInstruction(request, sendResponse) {
    try {
      const { id } = request;
      
      const result = await browser.storage.local.get('instructionHistory');
      const history = result.instructionHistory || [];

      const updatedHistory = history.filter(instruction => instruction.id !== id);
      
      await browser.storage.local.set({ instructionHistory: updatedHistory });

      sendResponse({ success: true });
    } catch (error) {
      console.error('Error deleting instruction:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  /**
   * Handle saving settings
   */
  async handleSaveSettings(request, sendResponse) {
    try {
      const { settings } = request;
      
      // Save to sync storage for cross-device sync
      await browser.storage.sync.set({ userSettings: settings });

      sendResponse({ success: true });
    } catch (error) {
      console.error('Error saving settings:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  /**
   * Handle loading settings
   */
  async handleLoadSettings(request, sendResponse) {
    console.log('BACKGROUND SCRIPT: handleLoadSettings called');
    try {
      console.log('BACKGROUND SCRIPT: Getting userSettings from storage...');
      const result = await browser.storage.sync.get('userSettings');
      console.log('BACKGROUND SCRIPT: Storage result:', result);
      
      const defaultSettings = {
        apiKey: '',
        model: 'gemini-2.5-pro'
      };

      const settings = { ...defaultSettings, ...(result.userSettings || {}) };
      console.log('BACKGROUND SCRIPT: Final settings:', settings);

      sendResponse({ success: true, data: settings });
      console.log('BACKGROUND SCRIPT: Response sent successfully');
    } catch (error) {
      console.error('BACKGROUND SCRIPT: Error loading settings:', error);
      sendResponse({ success: false, error: error.message });
    }
  }
}

// Instruction History Manager
class InstructionHistoryManager {
  constructor() {
    this.defaultLimit = 10;
  }

  /**
   * Add instruction to history
   */
  async addInstruction(content) {
    const result = await browser.storage.local.get(['instructionHistory', 'historyLimit']);
    const history = result.instructionHistory || [];
    const limit = result.historyLimit || this.defaultLimit;

    const newInstruction = {
      id: Date.now(),
      content: content.trim(),
      timestamp: new Date().toISOString()
    };

    // Add to beginning of array
    history.unshift(newInstruction);

    // Keep only specified number of instructions
    history.splice(limit);

    await browser.storage.local.set({ instructionHistory: history });
    return newInstruction;
  }

  /**
   * Get instruction history
   */
  async getHistory() {
    const result = await browser.storage.local.get('instructionHistory');
    return result.instructionHistory || [];
  }

  /**
   * Delete instruction by ID
   */
  async deleteInstruction(id) {
    const result = await browser.storage.local.get('instructionHistory');
    const history = result.instructionHistory || [];
    
    const filteredHistory = history.filter(instruction => instruction.id !== id);
    
    await browser.storage.local.set({ instructionHistory: filteredHistory });
    return filteredHistory;
  }

  /**
   * Set history limit
   */
  async setHistoryLimit(limit) {
    await browser.storage.local.set({ historyLimit: limit });
    
    // Trim existing history if needed
    const result = await browser.storage.local.get('instructionHistory');
    const history = result.instructionHistory || [];
    
    if (history.length > limit) {
      history.splice(limit);
      await browser.storage.local.set({ instructionHistory: history });
    }
  }

  /**
   * Get history limit
   */
  async getHistoryLimit() {
    const result = await browser.storage.local.get('historyLimit');
    return result.historyLimit || this.defaultLimit;
  }
}

// Settings Manager
class SettingsManager {
  constructor() {
    this.defaultSettings = {
      apiKey: '',
      model: 'gemini-2.5-pro',
      historyLimit: 10,
      autoSaveInstructions: true,
      theme: 'auto'
    };
  }

  /**
   * Save settings
   */
  async saveSettings(settings) {
    const currentSettings = await this.loadSettings();
    const updatedSettings = { ...currentSettings, ...settings };
    
    await browser.storage.sync.set({ userSettings: updatedSettings });
    return updatedSettings;
  }

  /**
   * Load settings
   */
  async loadSettings() {
    const result = await browser.storage.sync.get('userSettings');
    return { ...this.defaultSettings, ...(result.userSettings || {}) };
  }

  /**
   * Get specific setting
   */
  async getSetting(key) {
    const settings = await this.loadSettings();
    return settings[key];
  }

  /**
   * Set specific setting
   */
  async setSetting(key, value) {
    const settings = await this.loadSettings();
    settings[key] = value;
    await browser.storage.sync.set({ userSettings: settings });
    return value;
  }
}

// Initialize background service
const backgroundService = new BackgroundService();
const instructionHistory = new InstructionHistoryManager();
const settingsManager = new SettingsManager();

// Make managers available globally
self.instructionHistory = instructionHistory;
self.settingsManager = settingsManager;

// Handle installation
browser.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Video Chapters Generator installed');
    // Set default settings
    settingsManager.saveSettings({});
  } else if (details.reason === 'update') {
    console.log('Video Chapters Generator updated');
  }
});

// Handle extension startup
browser.runtime.onStartup.addListener(() => {
  console.log('Video Chapters Generator started');
}); 