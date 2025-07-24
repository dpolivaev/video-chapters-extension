/**
 * Background Service Worker for Video Chapters Generator
 * Handles AI API calls, storage management, and communication between components
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

console.log('BACKGROUND SCRIPT LOADING...');

// Import scripts for service worker compatibility (Chrome Manifest V3)
if (typeof importScripts !== 'undefined') {
  importScripts(
    'prompt-generator.js',
    'llm.js',
    'gemini-api.js',
    'openrouter-api.js'
  );
}

console.log('BACKGROUND SCRIPT: API classes loaded successfully');

// Session results relay (not persistent)
let sessionResults = null;
let resultsTabId = null;
let videoTabId = null;
let videoUrl = null;
let resultsTabsById = {};
let resultsById = {};
let generationStatusById = {};

class BackgroundService {
  constructor() {
    console.log('BACKGROUND SCRIPT: BackgroundService constructor called');
    this.geminiAPI = new GeminiAPI();
    this.openRouterAPI = new OpenRouterAPI();
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
        case 'getAllModels':
          this.handleGetAllModels(request, sendResponse);
          return true;
        case 'setSessionResults': {
          // Store results by resultId
          if (request.resultId) {
            resultsById[request.resultId] = request.results;
            sessionResults = request.results;
            // Track status: if chapters is empty or only contains the URL, mark as pending; else done
            const chapters = (request.results && request.results.chapters) || '';
            if (!chapters.trim() || chapters.trim() === request.results.videoMetadata.url) {
              generationStatusById[request.resultId] = 'pending';
            } else {
              generationStatusById[request.resultId] = 'done';
            }
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
        case 'getGenerationStatus': {
          const resultId = request.resultId;
          const status = generationStatusById[resultId] || 'pending';
          sendResponse({ success: true, status });
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
   * Handle AI processing (routes to appropriate API based on model)
   */
  async handleGeminiProcessing(request, sendResponse) {
    try {
      const { subtitleContent, customInstructions, apiKey, model, resultId } = request;
      
      let result;
      
      // Route to appropriate API based on model
      const geminiModelIds = this.geminiAPI.availableModels.map(m => m.id);
      const openRouterModelIds = this.openRouterAPI.availableModels.map(m => m.id);
      
      if (geminiModelIds.includes(model)) {
        // Use Gemini API
        result = await this.geminiAPI.processSubtitles(
          subtitleContent,
          customInstructions,
          apiKey,
          model
        );
      } else if (openRouterModelIds.includes(model)) {
        // Use OpenRouter API
        result = await this.openRouterAPI.processSubtitles(
          subtitleContent,
          customInstructions,
          apiKey,
          model
        );
      } else {
        throw new Error(`Unknown model: ${model}`);
      }

      // If resultId is provided, update the stored results
      if (resultId && resultsById[resultId]) {
        const existingResults = resultsById[resultId];
        const videoUrl = existingResults.videoMetadata.url;
        let chaptersWithUrl = videoUrl + '\n\n' + result.chapters;
        
        existingResults.chapters = chaptersWithUrl;
        existingResults.model = model;
        existingResults.customInstructions = customInstructions;
        generationStatusById[resultId] = 'done';
        
        resultsById[resultId] = existingResults;
        sessionResults = existingResults;
      }

      sendResponse({ success: true, data: result });
    } catch (error) {
      console.error('AI processing error:', error);
      
      // If resultId is provided, mark as error and store error details
      if (request.resultId) {
        generationStatusById[request.resultId] = 'error';
        
        // Update the stored results to include error information
        if (resultsById[request.resultId]) {
          const existingResults = resultsById[request.resultId];
          existingResults.error = error.message;
          
          // Use the appropriate API's categorizeError method
          const geminiModelIds = this.geminiAPI.availableModels.map(m => m.id);
          if (geminiModelIds.includes(request.model)) {
            existingResults.errorType = this.geminiAPI.categorizeError(error.message, request.model);
          } else {
            existingResults.errorType = this.openRouterAPI.categorizeError(error.message, request.model);
          }
          
          resultsById[request.resultId] = existingResults;
          sessionResults = existingResults;
        }
      }
      
      sendResponse({ success: false, error: error.message });
    }
  }

  /**
   * Handle saving instruction to history
   */
  async handleSaveInstruction(request, sendResponse) {
    try {
      const { content } = request;
      
      // Delegate to the model
      await instructionHistory.addInstruction(content);

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
        openRouterApiKey: '',
        model: 'deepseek/deepseek-r1-0528:free'  // Default to free DeepSeek R1
      };

      const settings = { ...defaultSettings, ...(result.userSettings || {}) };
      
      // If no API keys are set, ensure we default to a free model
      if (!settings.apiKey && !settings.openRouterApiKey) {
        settings.model = 'deepseek/deepseek-r1-0528:free';
      }
      
      console.log('BACKGROUND SCRIPT: Final settings:', settings);

      sendResponse({ success: true, data: settings });
      console.log('BACKGROUND SCRIPT: Response sent successfully');
    } catch (error) {
      console.error('BACKGROUND SCRIPT: Error loading settings:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  /**
   * Handle getting all available models
   */
  handleGetAllModels(request, sendResponse) {
    try {
      const geminiModels = this.geminiAPI.getAvailableModels();
      const openRouterModels = this.openRouterAPI.getAvailableModels();
      
      const allModels = [...openRouterModels, ...geminiModels];
      
      sendResponse({ success: true, data: allModels });
    } catch (error) {
      console.error('Error getting all models:', error);
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
    const trimmedContent = content.trim();
    const result = await browser.storage.local.get(['instructionHistory', 'historyLimit']);
    const history = result.instructionHistory || [];
    const limit = result.historyLimit || this.defaultLimit;

    // Check for existing duplicate (exact match after trimming, case sensitive)
    const existingIndex = history.findIndex(instruction => instruction.content.trim() === trimmedContent);
    
    let instructionToAdd;
    
    if (existingIndex !== -1) {
      // Found duplicate - remove it and preserve its ID
      const existingInstruction = history.splice(existingIndex, 1)[0];
      instructionToAdd = {
        id: existingInstruction.id, // Preserve original ID
        content: trimmedContent, // Save trimmed content
        timestamp: new Date().toISOString() // Update timestamp
      };
    } else {
      // No duplicate - create new instruction
      instructionToAdd = {
        id: Date.now(),
        content: trimmedContent, // Save trimmed content
        timestamp: new Date().toISOString()
      };
    }

    // Add to beginning of array
    history.unshift(instructionToAdd);

    // Keep only specified number of instructions
    history.splice(limit);

    await browser.storage.local.set({ instructionHistory: history });
    return instructionToAdd;
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
      openRouterApiKey: '',
      model: 'deepseek/deepseek-r1-0528:free',
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