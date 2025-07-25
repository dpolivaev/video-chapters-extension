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
console.log("BACKGROUND SCRIPT LOADING...");

if (typeof importScripts !== "undefined") {
  importScripts("../utils/url-utils.js", "errorhandler.js", "prompt-generator.js", "llm.js", "gemini-api.js", "openrouter-api.js");
}

console.log("BACKGROUND SCRIPT: API classes loaded successfully");

let sessionResults = null;

let resultsTabId = null;

let videoTabId = null;

let videoUrl = null;

let resultsTabsById = {};

let resultsById = {};

let generationStatusById = {};

class BackgroundService {
  constructor() {
    console.log("BACKGROUND SCRIPT: BackgroundService constructor called");
    this.geminiAPI = new GeminiAPI;
    this.openRouterAPI = new OpenRouterAPI;
    this.setupMessageListeners();
    this.setupContextMenus();
    this.setupTabListeners();
    console.log("BACKGROUND SCRIPT: BackgroundService initialized successfully");
  }
  setupTabListeners() {
    if (browser.tabs && browser.tabs.onRemoved) {
      browser.tabs.onRemoved.addListener(tabId => {
        if (tabId === resultsTabId) resultsTabId = null;
        if (tabId === videoTabId) videoTabId = null;
        for (const [rid, tid] of Object.entries(resultsTabsById)) {
          if (tid === tabId) {
            delete resultsTabsById[rid];
            delete resultsById[rid];
          }
        }
      });
    }
  }
  setupMessageListeners() {
    console.log("BACKGROUND SCRIPT: Setting up message listeners...");
    browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
      console.log("BACKGROUND SCRIPT: Received message:", request.action, "from:", sender);
      switch (request.action) {
       case "processWithGemini":
        this.handleGeminiProcessing(request, sendResponse, sender);
        return true;

       case "saveInstruction":
        this.handleSaveInstruction(request, sendResponse);
        return true;

       case "getInstructionHistory":
        this.handleGetInstructionHistory(request, sendResponse);
        return true;

       case "deleteInstruction":
        this.handleDeleteInstruction(request, sendResponse);
        return true;

       case "saveSettings":
        this.handleSaveSettings(request, sendResponse);
        return true;

       case "loadSettings":
        console.log("BACKGROUND SCRIPT: Handling loadSettings request");
        this.handleLoadSettings(request, sendResponse);
        return true;

       case "getAllModels":
        this.handleGetAllModels(request, sendResponse);
        return true;

       case "setSessionResults":
        {
          if (request.resultId) {
            resultsById[request.resultId] = request.results;
            sessionResults = request.results;
            const chapters = request.results && request.results.chapters || "";
            if (!chapters.trim() || chapters.trim() === request.results.videoMetadata.url) {
              generationStatusById[request.resultId] = "pending";
            } else {
              generationStatusById[request.resultId] = "done";
            }
          }
          sendResponse({
            success: true
          });
          return true;
        }

       case "getSessionResults":
        {
          const resultId = request.resultId;
          if (resultId && resultsById[resultId]) {
            sendResponse({
              success: true,
              results: resultsById[resultId]
            });
          } else if (sessionResults) {
            sendResponse({
              success: true,
              results: sessionResults
            });
          } else {
            sendResponse({
              success: false
            });
          }
          return true;
        }

       case "getGenerationStatus":
        {
          const resultId = request.resultId;
          const status = generationStatusById[resultId] || "pending";
          sendResponse({
            success: true,
            status: status
          });
          return true;
        }

       case "openResultsTab":
        {
          const {resultId: resultId, videoTabId: vidTabId, videoUrl: vidUrl} = request;
          if (vidTabId) videoTabId = vidTabId;
          if (vidUrl) videoUrl = vidUrl;
          if (resultId && resultsTabsById[resultId]) {
            const tabId = resultsTabsById[resultId];
            browser.tabs.get(tabId).then(tab => {
              browser.tabs.update(tabId, {
                active: true
              });
              browser.windows.update(tab.windowId, {
                focused: true
              });
              sendResponse({
                success: true,
                tabId: tabId
              });
            }, async () => {
              const tab = await browser.tabs.create({
                url: browser.runtime.getURL("results/results.html") + "?resultId=" + resultId
              });
              resultsTabsById[resultId] = tab.id;
              sendResponse({
                success: true,
                tabId: tab.id
              });
            });
            return true;
          } else {
            const tab = browser.tabs.create({
              url: browser.runtime.getURL("results/results.html") + "?resultId=" + resultId
            });
            tab.then(t => {
              resultsTabsById[resultId] = t.id;
              sendResponse({
                success: true,
                tabId: t.id
              });
            });
            return true;
          }
        }

       case "setResultsTabId":
        {
          const url = sender.tab && sender.tab.url;
          const resultId = url && url.includes("resultId=") ? url.split("resultId=")[1].split("&")[0] : null;
          if (resultId && sender.tab && sender.tab.id) {
            resultsTabsById[resultId] = sender.tab.id;
          }
          resultsTabId = request.tabId;
          sendResponse({
            success: true
          });
          return true;
        }

       case "getResultsTabStatus":
        if (resultsTabId == null) {
          sendResponse({
            open: false
          });
          return true;
        }
        browser.tabs.get(resultsTabId).then(tab => sendResponse({
          open: true,
          tabId: resultsTabId
        }), err => {
          resultsTabId = null;
          sendResponse({
            open: false
          });
        });
        return true;

       case "getVideoTabInfo":
        sendResponse({
          videoTabId: videoTabId,
          videoUrl: videoUrl
        });
        return true;

       case "goBackToVideo":
        {
          if (videoTabId != null) {
            browser.tabs.get(videoTabId).then(tab => {
              if (tab.url === videoUrl) {
                browser.tabs.update(videoTabId, {
                  active: true
                });
                browser.windows.update(tab.windowId, {
                  focused: true
                });
                sendResponse({
                  success: true,
                  method: "focusOriginal"
                });
              } else {
                (async () => {
                  const tabs = await browser.tabs.query({
                    url: videoUrl
                  });
                  const filtered = tabs.filter(t => t.id !== videoTabId);
                  if (filtered.length > 0) {
                    const t = filtered[0];
                    browser.tabs.update(t.id, {
                      active: true
                    });
                    browser.windows.update(t.windowId, {
                      focused: true
                    });
                    sendResponse({
                      success: true,
                      method: "focusOther"
                    });
                  } else {
                    await browser.tabs.create({
                      url: videoUrl
                    });
                    sendResponse({
                      success: true,
                      method: "openNew"
                    });
                  }
                })();
              }
            }, async () => {
              if (videoUrl) {
                const tabs = await browser.tabs.query({
                  url: videoUrl
                });
                if (tabs.length > 0) {
                  const tab = tabs[0];
                  browser.tabs.update(tab.id, {
                    active: true
                  });
                  browser.windows.update(tab.windowId, {
                    focused: true
                  });
                  sendResponse({
                    success: true,
                    method: "focusOther"
                  });
                } else {
                  await browser.tabs.create({
                    url: videoUrl
                  });
                  sendResponse({
                    success: true,
                    method: "openNew"
                  });
                }
              } else {
                sendResponse({
                  success: false
                });
              }
            });
            return true;
          } else if (videoUrl) {
            (async () => {
              const tabs = await browser.tabs.query({
                url: videoUrl
              });
              if (tabs.length > 0) {
                const tab = tabs[0];
                browser.tabs.update(tab.id, {
                  active: true
                });
                browser.windows.update(tab.windowId, {
                  focused: true
                });
                sendResponse({
                  success: true,
                  method: "focusOther"
                });
              } else {
                await browser.tabs.create({
                  url: videoUrl
                });
                sendResponse({
                  success: true,
                  method: "openNew"
                });
              }
            })();
            return true;
          } else {
            sendResponse({
              success: false
            });
            return true;
          }
        }

       default:
        console.log("Unknown action:", request.action);
      }
    });
    console.log("BACKGROUND SCRIPT: Message listeners set up successfully");
  }
  setupContextMenus() {
    try {
      console.log("BACKGROUND SCRIPT: Setting up context menus...");
      if (!browser.contextMenus) {
        console.log("BACKGROUND SCRIPT: contextMenus API not available");
        return;
      }
      browser.runtime.onInstalled.addListener(() => {
        browser.contextMenus.create({
          id: "generateChapters",
          title: "Generate Chapters for this Video",
          contexts: [ "page" ],
          documentUrlPatterns: [ "https://www.youtube.com/watch*" ]
        });
        console.log("BACKGROUND SCRIPT: Context menu created");
      });
      browser.contextMenus.onClicked.addListener((info, tab) => {
        if (info.menuItemId === "generateChapters") {
          browser.tabs.sendMessage(tab.id, {
            action: "triggerChapterGeneration"
          });
        }
      });
      console.log("BACKGROUND SCRIPT: Context menus set up successfully");
    } catch (error) {
      console.error("BACKGROUND SCRIPT: Error setting up context menus:", error);
      console.log("BACKGROUND SCRIPT: Continuing without context menus");
    }
  }
  async handleGeminiProcessing(request, sendResponse, sender) {
    try {
      const {subtitleContent: subtitleContent, customInstructions: customInstructions, apiKey: apiKey, model: model, resultId: resultId} = request;
      const tabId = sender?.tab?.id || null; // Get tab ID for retry cancellation
      let result;
      const geminiModelIds = this.geminiAPI.availableModels.map(m => m.id);
      const openRouterModelIds = this.openRouterAPI.availableModels.map(m => m.id);
      if (geminiModelIds.includes(model)) {
        result = await this.geminiAPI.processSubtitles(subtitleContent, customInstructions, apiKey, model, tabId);
      } else if (openRouterModelIds.includes(model)) {
        result = await this.openRouterAPI.processSubtitles(subtitleContent, customInstructions, apiKey, model, tabId);
      } else {
        throw new Error(`Unknown model: ${model}`);
      }
      if (resultId && resultsById[resultId]) {
        const existingResults = resultsById[resultId];
        const videoUrl = existingResults.videoMetadata.url;
        let chaptersWithUrl = videoUrl + "\n\n" + result.chapters;
        existingResults.chapters = chaptersWithUrl;
        existingResults.model = model;
        existingResults.customInstructions = customInstructions;
        generationStatusById[resultId] = "done";
        resultsById[resultId] = existingResults;
        sessionResults = existingResults;
      }
      sendResponse({
        success: true,
        data: result
      });
    } catch (error) {
      console.error("AI processing error:", error);
      if (request.resultId) {
        generationStatusById[request.resultId] = "error";
        if (resultsById[request.resultId]) {
          const existingResults = resultsById[request.resultId];
          existingResults.error = error.message;
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
      sendResponse({
        success: false,
        error: error.message
      });
    }
  }
  async handleSaveInstruction(request, sendResponse) {
    try {
      const {content: content} = request;
      await instructionHistory.addInstruction(content);
      sendResponse({
        success: true
      });
    } catch (error) {
      console.error("Error saving instruction:", error);
      sendResponse({
        success: false,
        error: error.message
      });
    }
  }
  async handleGetInstructionHistory(request, sendResponse) {
    try {
      const result = await browser.storage.local.get([ "instructionHistory", "historyLimit" ]);
      sendResponse({
        success: true,
        data: {
          history: result.instructionHistory || [],
          limit: result.historyLimit || 10
        }
      });
    } catch (error) {
      console.error("Error getting instruction history:", error);
      sendResponse({
        success: false,
        error: error.message
      });
    }
  }
  async handleDeleteInstruction(request, sendResponse) {
    try {
      const {id: id} = request;
      const result = await browser.storage.local.get("instructionHistory");
      const history = result.instructionHistory || [];
      const updatedHistory = history.filter(instruction => instruction.id !== id);
      await browser.storage.local.set({
        instructionHistory: updatedHistory
      });
      sendResponse({
        success: true
      });
    } catch (error) {
      console.error("Error deleting instruction:", error);
      sendResponse({
        success: false,
        error: error.message
      });
    }
  }
  async handleSaveSettings(request, sendResponse) {
    try {
      const {settings: settings} = request;
      await browser.storage.sync.set({
        userSettings: settings
      });
      sendResponse({
        success: true
      });
    } catch (error) {
      console.error("Error saving settings:", error);
      sendResponse({
        success: false,
        error: error.message
      });
    }
  }
  async handleLoadSettings(request, sendResponse) {
    console.log("BACKGROUND SCRIPT: handleLoadSettings called");
    try {
      console.log("BACKGROUND SCRIPT: Getting userSettings from storage...");
      const result = await browser.storage.sync.get("userSettings");
      console.log("BACKGROUND SCRIPT: Storage result:", result);
      const defaultSettings = {
        apiKey: "",
        openRouterApiKey: "",
        model: "deepseek/deepseek-r1-0528:free"
      };
      const settings = {
        ...defaultSettings,
        ...result.userSettings || {}
      };
      if (!settings.apiKey && !settings.openRouterApiKey) {
        settings.model = "deepseek/deepseek-r1-0528:free";
      }
      console.log("BACKGROUND SCRIPT: Final settings:", settings);
      sendResponse({
        success: true,
        data: settings
      });
      console.log("BACKGROUND SCRIPT: Response sent successfully");
    } catch (error) {
      console.error("BACKGROUND SCRIPT: Error loading settings:", error);
      sendResponse({
        success: false,
        error: error.message
      });
    }
  }
  handleGetAllModels(request, sendResponse) {
    try {
      const geminiModels = this.geminiAPI.getAvailableModels();
      const openRouterModels = this.openRouterAPI.getAvailableModels();
      const allModels = [ ...openRouterModels, ...geminiModels ];
      sendResponse({
        success: true,
        data: allModels
      });
    } catch (error) {
      console.error("Error getting all models:", error);
      sendResponse({
        success: false,
        error: error.message
      });
    }
  }
}

class InstructionHistoryManager {
  constructor() {
    this.defaultLimit = 10;
  }
  async addInstruction(content) {
    const trimmedContent = content.trim();
    const result = await browser.storage.local.get([ "instructionHistory", "historyLimit" ]);
    const history = result.instructionHistory || [];
    const limit = result.historyLimit || this.defaultLimit;
    const existingIndex = history.findIndex(instruction => instruction.content.trim() === trimmedContent);
    let instructionToAdd;
    if (existingIndex !== -1) {
      const existingInstruction = history.splice(existingIndex, 1)[0];
      instructionToAdd = {
        id: existingInstruction.id,
        content: trimmedContent,
        timestamp: (new Date).toISOString()
      };
    } else {
      instructionToAdd = {
        id: Date.now(),
        content: trimmedContent,
        timestamp: (new Date).toISOString()
      };
    }
    history.unshift(instructionToAdd);
    history.splice(limit);
    await browser.storage.local.set({
      instructionHistory: history
    });
    return instructionToAdd;
  }
  async getHistory() {
    const result = await browser.storage.local.get("instructionHistory");
    return result.instructionHistory || [];
  }
  async deleteInstruction(id) {
    const result = await browser.storage.local.get("instructionHistory");
    const history = result.instructionHistory || [];
    const filteredHistory = history.filter(instruction => instruction.id !== id);
    await browser.storage.local.set({
      instructionHistory: filteredHistory
    });
    return filteredHistory;
  }
  async setHistoryLimit(limit) {
    await browser.storage.local.set({
      historyLimit: limit
    });
    const result = await browser.storage.local.get("instructionHistory");
    const history = result.instructionHistory || [];
    if (history.length > limit) {
      history.splice(limit);
      await browser.storage.local.set({
        instructionHistory: history
      });
    }
  }
  async getHistoryLimit() {
    const result = await browser.storage.local.get("historyLimit");
    return result.historyLimit || this.defaultLimit;
  }
}

class SettingsManager {
  constructor() {
    this.defaultSettings = {
      apiKey: "",
      openRouterApiKey: "",
      model: "deepseek/deepseek-r1-0528:free",
      historyLimit: 10,
      autoSaveInstructions: true,
      theme: "auto"
    };
  }
  async saveSettings(settings) {
    const currentSettings = await this.loadSettings();
    const updatedSettings = {
      ...currentSettings,
      ...settings
    };
    await browser.storage.sync.set({
      userSettings: updatedSettings
    });
    return updatedSettings;
  }
  async loadSettings() {
    const result = await browser.storage.sync.get("userSettings");
    return {
      ...this.defaultSettings,
      ...result.userSettings || {}
    };
  }
  async getSetting(key) {
    const settings = await this.loadSettings();
    return settings[key];
  }
  async setSetting(key, value) {
    const settings = await this.loadSettings();
    settings[key] = value;
    await browser.storage.sync.set({
      userSettings: settings
    });
    return value;
  }
}

const backgroundService = new BackgroundService;

const instructionHistory = new InstructionHistoryManager;

const settingsManager = new SettingsManager;

self.instructionHistory = instructionHistory;

self.settingsManager = settingsManager;

browser.runtime.onInstalled.addListener(details => {
  if (details.reason === "install") {
    console.log("Video Chapters Generator installed");
    settingsManager.saveSettings({});
  } else if (details.reason === "update") {
    console.log("Video Chapters Generator updated");
  }
});

browser.runtime.onStartup.addListener(() => {
  console.log("Video Chapters Generator started");
});