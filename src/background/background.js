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

if (typeof importScripts !== "undefined") {
  if (typeof SessionRepository === "undefined") {
    importScripts(
      "../utils/url-utils.js",
      "errorhandler.js",
      "../domain/values/VideoUrl.js",
      "../domain/values/ModelId.js", 
      "../domain/values/ApiCredentials.js",
      "../domain/values/GenerationProgress.js",
      "../domain/entities/VideoTranscript.js",
      "../domain/entities/ChapterGeneration.js",
      "../domain/entities/BrowserTab.js",
      "../infrastructure/repositories/SessionRepository.js",
      "../infrastructure/repositories/TabRegistry.js",
      "../infrastructure/repositories/SettingsRepository.js",
      "../domain/services/TranscriptExtractor.js",
      "../domain/services/ChapterGenerator.js",
      "prompt-generator.js", 
      "llm.js", 
      "gemini-api.js", 
      "openrouter-api.js"
    );
  }
}


const sessionRepository = new SessionRepository();
const tabRegistry = new TabRegistry();
const settingsRepository = new SettingsRepository();

class BackgroundService {
  constructor() {
    console.log("BACKGROUND SCRIPT: BackgroundService constructor called");
    this.geminiAPI = new GeminiAPI;
    this.openRouterAPI = new OpenRouterAPI;
    
    this.chapterGenerator = new ChapterGenerator(this.geminiAPI, this.openRouterAPI);
    this.transcriptExtractor = new TranscriptExtractor();
    
    this.setupMessageListeners();
    this.setupContextMenus();
    this.setupTabListeners();
    console.log("BACKGROUND SCRIPT: BackgroundService initialized successfully");
  }
  setupTabListeners() {
    if (browser.tabs && browser.tabs.onRemoved) {
      browser.tabs.onRemoved.addListener(tabId => {
        tabRegistry.unregister(tabId);
        const sessionId = tabRegistry.findSessionForTab(tabId);
        if (sessionId) {
          sessionRepository.remove(sessionId);
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
          if (request.resultId && request.results) {
            const session = ChapterGeneration.fromSessionResults(request.results);
            console.log(`BACKGROUND: Creating session - requestId: ${request.resultId}, sessionId: ${session.id}`);
            sessionRepository.save(session);
            console.log(`BACKGROUND: Session saved, repository now has ${sessionRepository.sessions.size} sessions`);
          }
          sendResponse({
            success: true
          });
          return true;
        }

       case "getSessionResults":
        {
          const resultId = request.resultId;
          if (resultId) {
            const session = sessionRepository.findById(resultId);
            if (session) {
              sendResponse({
                success: true,
                results: session.toSessionResults()
              });
              return true;
            }
          }
          const activeSession = sessionRepository.getActiveSession();
          if (activeSession) {
            sendResponse({
              success: true,
              results: activeSession.toSessionResults()
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
          console.log(`BACKGROUND: Repository state - total sessions: ${sessionRepository.sessions.size}`);
          const allKeys = Array.from(sessionRepository.sessions.keys());
          console.log(`BACKGROUND: All session IDs:`, allKeys);
          console.log(`BACKGROUND: Search ID type:`, typeof resultId, "value:", resultId);
          console.log(`BACKGROUND: Stored ID types:`, allKeys.map(k => typeof k));
          
          const session = sessionRepository.findById(resultId);
          const status = sessionRepository.getGenerationStatus(resultId);
          console.log(`BACKGROUND: getGenerationStatus for ${resultId} - session exists:`, !!session, "status:", status);
          if (session) {
            console.log("BACKGROUND: Session details - status:", session.status, "isPending:", session.isPending(), "isCompleted:", session.isCompleted());
          }
          sendResponse({
            success: true,
            status: status
          });
          return true;
        }

       case "openResultsTab":
        {
          const {resultId: resultId, videoTabId: vidTabId, videoUrl: vidUrl} = request;
          if (vidTabId && vidUrl) {
            tabRegistry.registerVideoTab(vidTabId, vidUrl);
          }
          const existingResultsTab = tabRegistry.getResultsTab(resultId);
          if (existingResultsTab) {
            const tabId = existingResultsTab;
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
              tabRegistry.registerResultsTab(resultId, tab.id);
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
              tabRegistry.registerResultsTab(resultId, t.id);
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
            tabRegistry.registerResultsTab(resultId, sender.tab.id);
          }
          sendResponse({
            success: true
          });
          return true;
        }

       case "getResultsTabStatus":
        {
          const allResultsTabIds = tabRegistry.getAllResultsTabIds();
          if (allResultsTabIds.length === 0) {
            sendResponse({ open: false });
            return true;
          }
          
          const validateTab = async (tabId) => {
            try {
              await browser.tabs.get(tabId);
              return tabId;
            } catch (error) {
              tabRegistry.cleanupResultsTab(tabId);
              return null;
            }
          };
          
          Promise.all(allResultsTabIds.map(validateTab))
            .then(validTabIds => {
              const firstValidTab = validTabIds.find(id => id !== null);
              if (firstValidTab) {
                sendResponse({
                  open: true,
                  tabId: firstValidTab
                });
              } else {
                sendResponse({ open: false });
              }
            })
            .catch(err => {
              console.error("Error validating results tabs:", err);
              sendResponse({ open: false });
            });
          return true;
        }

       case "getVideoTabInfo":
        {
          const videoTabInfo = tabRegistry.getActiveVideoTab();
          sendResponse({
            videoTabId: videoTabInfo?.tabId || null,
            videoUrl: videoTabInfo?.url || null
          });
          return true;
        }

       case "goBackToVideo":
        {
          const videoTabInfo = tabRegistry.getActiveVideoTab();
          if (videoTabInfo) {
            return this.focusOrCreateVideoTab(videoTabInfo.tabId, videoTabInfo.url, sendResponse);
          } else {
            sendResponse({ success: false });
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
      const {subtitleContent, customInstructions, apiKey, model, resultId} = request;
      const tabId = sender?.tab?.id || null;
      
      const existingSession = sessionRepository.findById(resultId);
      if (!existingSession) {
        throw new Error(`Session ${resultId} not found`);
      }
      const modelId = new ModelId(model);
      const credentials = modelId.isGemini() 
        ? new ApiCredentials(apiKey, '')
        : new ApiCredentials('', apiKey);
      const completedSession = await this.chapterGenerator.generateChapters(
        existingSession, 
        credentials, 
        tabId
      );
      sessionRepository.save(completedSession);
      console.log(`BACKGROUND: Session ${resultId} saved with status:`, completedSession.status);
      console.log(`BACKGROUND: Session ID in completedSession:`, completedSession.id);
      console.log(`BACKGROUND: Repository has ${sessionRepository.sessions.size} sessions`);
      const verifySession = sessionRepository.findById(resultId);
      console.log(`BACKGROUND: Verification - session exists:`, !!verifySession);
      
      sendResponse({
        success: true,
        data: { chapters: completedSession.chapters }
      });
      
    } catch (error) {
      console.error("AI processing error:", error);
      if (request.resultId) {
        const session = sessionRepository.findById(request.resultId);
        if (session) {
          session.markFailed(error.message);
          sessionRepository.save(session);
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
      const {settings} = request;
      
      await settingsRepository.saveSettings(settings);
      
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
      const settings = await settingsRepository.loadSettings();
      console.log("BACKGROUND SCRIPT: Settings loaded:", settings);
      
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
  
  async focusOrCreateVideoTab(videoTabId, videoUrl, sendResponse) {
    try {
      const tab = await browser.tabs.get(videoTabId);
      if (tab.url === videoUrl) {
        await browser.tabs.update(videoTabId, { active: true });
        await browser.windows.update(tab.windowId, { focused: true });
        sendResponse({ success: true, method: "focusOriginal" });
      } else {
        return this.findOrCreateVideoTab(videoUrl, sendResponse);
      }
    } catch (error) {
      return this.findOrCreateVideoTab(videoUrl, sendResponse);
    }
    return true;
  }
  
  async findOrCreateVideoTab(videoUrl, sendResponse) {
    try {
      const tabs = await browser.tabs.query({ url: videoUrl });
      if (tabs.length > 0) {
        const tab = tabs[0];
        await browser.tabs.update(tab.id, { active: true });
        await browser.windows.update(tab.windowId, { focused: true });
        sendResponse({ success: true, method: "focusOther" });
      } else {
        await browser.tabs.create({ url: videoUrl });
        sendResponse({ success: true, method: "openNew" });
      }
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
    return true;
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