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

if (typeof importScripts !== 'undefined') {
  importScripts('../lang/JsModuleImporter.js');
}

JsModuleImporter.importScriptsIfNeeded([
  '../utils/url-utils.js',
  'errorhandler.js',
  '../domain/values/VideoUrl.js',
  '../domain/values/ModelId.js',
  '../domain/values/ApiCredentials.js',
  '../domain/values/GenerationProgress.js',
  '../domain/entities/VideoTranscript.js',
  '../domain/entities/ChapterGeneration.js',
  '../domain/entities/BrowserTab.js',
  '../infrastructure/repositories/SessionRepository.js',
  '../infrastructure/repositories/TabRegistry.js',
  '../infrastructure/repositories/SettingsRepository.js',
  '../domain/services/TranscriptExtractor.js',
  '../domain/services/ChapterGenerator.js',
  'prompt-generator.js',
  'BaseLLM.js',
  '../infrastructure/adapters/BrowserHttpAdapter.js',
  '../domain/services/NetworkCommunicator.js',
  '../domain/services/GeminiChapterGenerator.js',
  '../domain/services/OpenRouterChapterGenerator.js',
  '../infrastructure/adapters/GeminiApiAdapter.js',
  '../infrastructure/adapters/OpenRouterApiAdapter.js'
], ['SessionRepository', 'VideoUrl', 'ModelId', 'ChapterGeneration', 'TranscriptExtractor']);


const sessionRepository = new SessionRepository();
const tabRegistry = new TabRegistry();
const settingsRepository = new SettingsRepository();

class BackgroundService {
  constructor() {
    this.geminiAPI = new GeminiApiAdapter();
    this.openRouterAPI = new OpenRouterApiAdapter();

    this.chapterGenerator = new ChapterGenerator(this.geminiAPI, this.openRouterAPI);
    this.transcriptExtractor = new TranscriptExtractor();

    this.setupMessageListeners();
    this.setupContextMenus();
    this.setupTabListeners();
  }
  setupTabListeners() {
    if (browser.tabs && browser.tabs.onRemoved) {
      browser.tabs.onRemoved.addListener(tabId => {
        tabRegistry.unregister(tabId);
        const sessionId = tabRegistry.findSessionForTab(tabId);
        if (sessionId) {
          sessionRepository.remove(sessionId);
        }
        return true;
      });
    }
  }
  setupMessageListeners() {
    browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
      switch (request.action) {
        case 'generateChapters':
          this.handleChapterGeneration(request, sendResponse, sender);
          return true;

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
          this.handleLoadSettings(request, sendResponse);
          return true;

        case 'getAllModels':
          this.handleGetAllModels(request, sendResponse);
          return true;

        case 'setSessionResults':
        {
          if (request.resultId && request.results) {
            const session = ChapterGeneration.fromSessionResults(request.results);
            sessionRepository.save(session);
          }
          sendResponse({
            success: true
          });
          return true;
        }

        case 'getSessionResults':
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

        case 'getGenerationStatus':
        {
          const resultId = request.resultId;
          const status = sessionRepository.getGenerationStatus(resultId);
          sendResponse({
            success: true,
            status
          });
          return true;
        }

        case 'openResultsTab':
        {
          const {resultId: resultId, videoTabId: vidTabId, videoUrl: vidUrl} = request;

          const shouldRegisterNewMapping = this.shouldRegisterVideoTabMapping(resultId, vidTabId, vidUrl);

          if (shouldRegisterNewMapping) {
            this.registerNewVideoTabMapping(resultId, vidTabId, vidUrl);
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
                tabId
              });
            }, async () => {
              const tab = await browser.tabs.create({
                url: browser.runtime.getURL('results/results.html') + '?resultId=' + resultId
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
              url: browser.runtime.getURL('results/results.html') + '?resultId=' + resultId
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

        case 'setResultsTabId':
        {
          const url = sender.tab && sender.tab.url;
          const resultId = url && url.includes('resultId=') ? url.split('resultId=')[1].split('&')[0] : null;
          if (resultId && sender.tab && sender.tab.id) {
            tabRegistry.registerResultsTab(resultId, sender.tab.id);
          }
          sendResponse({
            success: true
          });
          return true;
        }

        case 'getResultsTabStatus':
        {
          const currentVideoTabId = request.currentVideoTabId;
          this.handleGetResultsTabStatus(currentVideoTabId, sendResponse);
          return true;
        }

        case 'getVideoTabInfo':
        {
          const videoTabInfo = tabRegistry.getActiveVideoTab();
          sendResponse({
            videoTabId: videoTabInfo?.tabId || null,
            videoUrl: videoTabInfo?.url || null
          });
          return true;
        }

        case 'goBackToVideo':
        {
          const resultId = request.resultId;
          this.handleGoBackToVideo(resultId, sendResponse);
          return true;
        }

        default:
          return false;
      }
    });
  }
  setupContextMenus() {
    try {
      if (!browser.contextMenus) {
        return;
      }
      browser.runtime.onInstalled.addListener(() => {
        browser.contextMenus.create({
          id: 'generateChapters',
          title: 'Generate Chapters for this Video',
          contexts: [ 'page' ],
          documentUrlPatterns: [ 'https://www.youtube.com/watch*' ]
        });
      });
      browser.contextMenus.onClicked.addListener((info, tab) => {
        if (info.menuItemId === 'generateChapters') {
          browser.tabs.sendMessage(tab.id, {
            action: 'triggerChapterGeneration'
          });
        }
      });
    } catch (error) {
      // Context menus not available
    }
  }
  async handleChapterGeneration(request, sendResponse, sender) {
    try {
      const {customInstructions, apiKey, model, resultId} = request;
      const tabId = sender?.tab?.id || null;

      if (!model || typeof model !== 'string' || model.trim() === '') {
        throw new Error(`Model parameter is required and must be a non-empty string. Received: ${JSON.stringify(model)}`);
      }

      const existingSession = sessionRepository.findById(resultId);
      if (!existingSession) {
        throw new Error(`Session ${resultId} not found`);
      }

      const newGenerationSession = this.createNewGenerationSession(existingSession, model, customInstructions);

      if (request.newResultId) {
        newGenerationSession.id = request.newResultId;
      }

      sessionRepository.save(newGenerationSession);

      const modelId = new ModelId(model);
      const credentials = modelId.isGemini()
        ? new ApiCredentials(apiKey, '')
        : new ApiCredentials('', apiKey);
      const completedSession = await this.chapterGenerator.generateChapters(
        newGenerationSession,
        credentials,
        tabId
      );
      sessionRepository.save(completedSession);

      sendResponse({
        success: true,
        data: { chapters: completedSession.chapters, resultId: completedSession.id }
      });

    } catch (error) {
      const sessionIdToFail = request.newResultId || request.resultId;
      if (sessionIdToFail) {
        const session = sessionRepository.findById(sessionIdToFail);
        if (session && session.isPending()) {
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
      sendResponse({
        success: false,
        error: error.message
      });
    }
  }
  async handleGetInstructionHistory(request, sendResponse) {
    try {
      const result = await browser.storage.local.get([ 'instructionHistory', 'historyLimit' ]);
      sendResponse({
        success: true,
        data: {
          history: result.instructionHistory || [],
          limit: result.historyLimit || 10
        }
      });
    } catch (error) {
      sendResponse({
        success: false,
        error: error.message
      });
    }
  }
  async handleDeleteInstruction(request, sendResponse) {
    try {
      const {id: id} = request;
      const result = await browser.storage.local.get('instructionHistory');
      const history = result.instructionHistory || [];
      const updatedHistory = history.filter(instruction => instruction.id !== id);
      await browser.storage.local.set({
        instructionHistory: updatedHistory
      });
      sendResponse({
        success: true
      });
    } catch (error) {
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
      sendResponse({
        success: false,
        error: error.message
      });
    }
  }
  async handleLoadSettings(request, sendResponse) {
    try {
      const settings = await settingsRepository.loadSettings();

      sendResponse({
        success: true,
        data: settings
      });
    } catch (error) {
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
      sendResponse({
        success: false,
        error: error.message
      });
    }
  }

  shouldRegisterVideoTabMapping(resultId, vidTabId, vidUrl) {
    const normalizedResultId = typeof resultId === 'string' ? parseInt(resultId, 10) : resultId;
    const existingMapping = tabRegistry.resultToVideoMapping.get(normalizedResultId);
    return !existingMapping && vidTabId && vidUrl && resultId;
  }

  registerNewVideoTabMapping(resultId, vidTabId, vidUrl) {
    tabRegistry.registerVideoTabForResult(resultId, vidTabId, vidUrl);
  }

  async handleGoBackToVideo(resultId, sendResponse) {
    if (!resultId) {
      sendResponse({ success: false, error: 'Result ID is required' });
      return;
    }
    try {
      const videoTabInfo = await this.findVideoTabForResult(resultId);

      if (this.shouldFocusExistingTab(videoTabInfo)) {
        await this.focusOrCreateVideoTab(videoTabInfo.tabId, videoTabInfo.url, sendResponse);
      } else if (this.shouldCreateNewTab(videoTabInfo)) {
        await this.createNewVideoTabWithResponse(videoTabInfo.url, sendResponse);
      } else {
        this.handleNoVideoTabAvailable(sendResponse);
      }
    } catch (error) {
      this.handleGoBackToVideoError(error, sendResponse);
    }
  }

  async findVideoTabForResult(resultId) {
    let videoTabInfo = null;

    if (resultId) {
      videoTabInfo = await tabRegistry.getVideoTabForResult(resultId);
    }

    if (!videoTabInfo) {
      videoTabInfo = tabRegistry.getActiveVideoTab();
    }

    return videoTabInfo;
  }

  shouldFocusExistingTab(videoTabInfo) {
    return videoTabInfo && videoTabInfo.tabId;
  }

  shouldCreateNewTab(videoTabInfo) {
    return videoTabInfo && videoTabInfo.url && videoTabInfo.method === 'create_new';
  }

  async createNewVideoTabWithResponse(url, sendResponse) {
    try {
      const newTab = await browser.tabs.create({ url });
      sendResponse({ success: true, method: 'create_new', tabId: newTab.id });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  }

  handleNoVideoTabAvailable(sendResponse) {
    sendResponse({ success: false, error: 'No video tab registered' });
  }

  handleGoBackToVideoError(error, sendResponse) {
    sendResponse({ success: false, error: error.message });
  }

  createNewGenerationSession(baseSession, model, customInstructions) {
    const videoTranscript = baseSession.videoTranscript;

    const newSession = new ChapterGeneration(
      videoTranscript,
      model,
      customInstructions || ''
    );

    return newSession;
  }

  async handleGetResultsTabStatus(currentVideoTabId, sendResponse) {
    try {
      const resultsForCurrentVideo = await this.findResultsForVideoTab(currentVideoTabId);
      if (resultsForCurrentVideo) {
        sendResponse({
          open: true,
          tabId: resultsForCurrentVideo.tabId,
          resultId: resultsForCurrentVideo.resultId
        });
      } else {
        sendResponse({ open: false });
      }
    } catch (error) {
      sendResponse({ open: false });
    }
  }

  async findResultsForVideoTab(currentVideoTabId) {
    if (!currentVideoTabId) {
      return this.findAnyValidResultsTab();
    }

    const currentVideoTab = await this.getCurrentVideoTabInfo(currentVideoTabId);
    if (!currentVideoTab) {
      return null;
    }

    const resultsForThisVideo = this.findResultsMatchingVideoUrl(currentVideoTab.url);
    return resultsForThisVideo;
  }

  async findAnyValidResultsTab() {
    const allResultsTabIds = tabRegistry.getAllResultsTabIds();
    if (allResultsTabIds.length === 0) {
      return null;
    }

    for (const tabId of allResultsTabIds) {
      try {
        await browser.tabs.get(tabId);
        const resultId = tabRegistry.getResultIdForTab(tabId);
        return { tabId, resultId };
      } catch (error) {
        tabRegistry.cleanupResultsTab(tabId);
      }
    }
    return null;
  }

  async getCurrentVideoTabInfo(tabId) {
    try {
      const tab = await browser.tabs.get(tabId);
      return tab;
    } catch (error) {
      return null;
    }
  }

  findResultsMatchingVideoUrl(videoUrl) {
    const cleanedVideoUrl = cleanVideoURL(videoUrl);

    for (const [resultId, storedCleanedUrl] of tabRegistry.resultToVideoMapping.entries()) {
      if (storedCleanedUrl === cleanedVideoUrl) {
        const resultsTabId = tabRegistry.getResultsTab(resultId);
        if (resultsTabId) {
          return { tabId: resultsTabId, resultId };
        }
      }
    }
    return null;
  }

  async focusOrCreateVideoTab(videoTabId, videoUrl, sendResponse) {
    try {
      const tab = await browser.tabs.get(videoTabId);
      const urlsMatch = this.doCleanedUrlsMatch(tab.url, videoUrl);

      if (urlsMatch) {
        await this.focusExistingTab(videoTabId, tab.windowId);
        sendResponse({ success: true, method: 'focusOriginal' });
      } else {
        return this.findOrCreateVideoTab(videoUrl, sendResponse);
      }
    } catch (error) {
      return this.findOrCreateVideoTab(videoUrl, sendResponse);
    }
    return true;
  }

  doCleanedUrlsMatch(tabUrl, storedUrl) {
    const cleanedTabUrl = cleanVideoURL(tabUrl);
    const cleanedStoredUrl = cleanVideoURL(storedUrl);
    return cleanedTabUrl === cleanedStoredUrl;
  }

  async focusExistingTab(tabId, windowId) {
    await browser.tabs.update(tabId, { active: true });
    await browser.windows.update(windowId, { focused: true });
  }

  async findOrCreateVideoTab(videoUrl, sendResponse) {
    try {
      const allTabs = await browser.tabs.query({});
      const matchingTabs = this.findTabsWithMatchingUrl(allTabs, videoUrl);

      if (matchingTabs.length > 0) {
        await this.focusFirstMatchingTab(matchingTabs);
        sendResponse({ success: true, method: 'focusOther' });
      } else {
        await this.createNewVideoTab(videoUrl);
        sendResponse({ success: true, method: 'openNew' });
      }
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
    return true;
  }

  findTabsWithMatchingUrl(allTabs, videoUrl) {
    const cleanedTargetUrl = cleanVideoURL(videoUrl);

    return allTabs.filter(tab => {
      if (!tab.url) {
        return false;
      }
      const cleanedTabUrl = cleanVideoURL(tab.url);
      return cleanedTabUrl === cleanedTargetUrl;
    });
  }

  async focusFirstMatchingTab(matchingTabs) {
    const tab = matchingTabs[0];
    await browser.tabs.update(tab.id, { active: true });
    await browser.windows.update(tab.windowId, { focused: true });
  }

  async createNewVideoTab(videoUrl) {
    await browser.tabs.create({ url: videoUrl });
  }
}

class InstructionHistoryManager {
  constructor() {
    this.defaultLimit = 10;
  }
  async addInstruction(content) {
    const trimmedContent = content.trim();
    const result = await browser.storage.local.get([ 'instructionHistory', 'historyLimit' ]);
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
    const result = await browser.storage.local.get('instructionHistory');
    return result.instructionHistory || [];
  }
  async deleteInstruction(id) {
    const result = await browser.storage.local.get('instructionHistory');
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
    const result = await browser.storage.local.get('instructionHistory');
    const history = result.instructionHistory || [];
    if (history.length > limit) {
      history.splice(limit);
      await browser.storage.local.set({
        instructionHistory: history
      });
    }
  }
  async getHistoryLimit() {
    const result = await browser.storage.local.get('historyLimit');
    return result.historyLimit || this.defaultLimit;
  }
}

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
    const result = await browser.storage.sync.get('userSettings');
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

const _backgroundService = new BackgroundService();

const instructionHistory = new InstructionHistoryManager;

const settingsManager = new SettingsManager;


browser.runtime.onInstalled.addListener(details => {
  if (details.reason === 'install') {
    settingsManager.saveSettings({});
  }
});

browser.runtime.onStartup.addListener(() => {
  // Extension started
});
