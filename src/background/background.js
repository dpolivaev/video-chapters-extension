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
  '../domain/entities/InstructionEntry.js',
  '../infrastructure/adapters/BrowserStorageAdapter.js',
  '../infrastructure/repositories/SessionRepository.js',
  '../infrastructure/repositories/TabRegistry.js',
  '../infrastructure/repositories/SettingsRepository.js',
  '../infrastructure/repositories/InstructionHistoryRepository.js',
  'prompt-generator.js',
  'BaseLLM.js',
  '../infrastructure/adapters/BrowserHttpAdapter.js',
  '../domain/services/NetworkCommunicator.js',
  '../domain/services/GeminiChapterGenerator.js',
  '../domain/services/OpenRouterChapterGenerator.js',
  '../infrastructure/adapters/GeminiApiAdapter.js',
  '../infrastructure/adapters/OpenRouterApiAdapter.js',
  '../domain/services/ChapterGenerator.js'
], ['BrowserStorageAdapter', 'SessionRepository', 'TabRegistry', 'SettingsRepository', 'InstructionHistoryRepository', 'VideoUrl', 'ModelId', 'ChapterGeneration', 'GeminiApiAdapter', 'OpenRouterApiAdapter', 'ChapterGenerator']);


const storageAdapter = new BrowserStorageAdapter();
const sessionRepository = new SessionRepository();
const tabRegistry = new TabRegistry();
const settingsRepository = new SettingsRepository(storageAdapter);
const instructionHistoryRepository = new InstructionHistoryRepository(storageAdapter, settingsRepository);

class BackgroundService {
  constructor() {
    this.geminiAPI = new GeminiApiAdapter();

    this.openRouterAPI = new OpenRouterApiAdapter(this);
    this.chapterGenerator = new ChapterGenerator(this.geminiAPI, this.openRouterAPI);

    this.setupMessageListeners();
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

        case 'renameInstruction':
          this.handleRenameInstruction(request, sendResponse);
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
            console.log('BackgroundService: Session saved:', session.id);
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
            console.log('BackgroundService: No session found for ID:', resultId);
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

        case 'getLastCustomInstructions':
          this.handleGetLastCustomInstructions(request, sendResponse);
          return true;

        case 'saveLastCustomInstructions':
          this.handleSaveLastCustomInstructions(request, sendResponse);
          return true;

        case 'removeLastCustomInstructions':
          this.handleRemoveLastCustomInstructions(request, sendResponse);
          return true;

        case 'getUserLanguage':
          this.handleGetUserLanguage(request, sendResponse);
          return true;

        case 'sendChatMessage':
          this.handleChatMessage(request, sendResponse);
          return true;

        default:
          return false;
      }
    });
  }
  async handleChapterGeneration(request, sendResponse, sender) {
    try {
      const {customInstructions, apiKey, modelId, resultId} = request;
      const tabId = sender?.tab?.id || null;

      if (!modelId || !modelId.value || !modelId.provider) {
        throw new Error(`ModelId parameter is required and must be a valid ModelId object. Received: ${JSON.stringify(modelId)}`);
      }

      const existingSession = sessionRepository.findById(resultId);
      if (!existingSession) {
        throw new Error(`Session ${resultId} not found`);
      }

      // Recreate ModelId object from received data (JSON serialization strips methods)
      const fullModelId = new ModelId(modelId.value, modelId.provider, modelId.isFree);
      const newGenerationSession = this.createNewGenerationSession(existingSession, fullModelId, customInstructions);

      if (request.newResultId) {
        newGenerationSession.id = request.newResultId;
      }

      sessionRepository.save(newGenerationSession);

      const credentials = fullModelId.isGemini()
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
      await instructionHistoryRepository.addInstruction(content);
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
      const history = await instructionHistoryRepository.getHistory();
      const settings = await settingsRepository.loadSettings();
      sendResponse({
        success: true,
        data: {
          history,
          limit: settings.historyLimit || 10
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
      await instructionHistoryRepository.deleteInstruction(id);
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
  async handleRenameInstruction(request, sendResponse) {
    try {
      const { id, name } = request;
      this.validateRenameParameters(id, name);
      await instructionHistoryRepository.renameInstruction(id, name);
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

  validateRenameParameters(id, name) {
    if (id === null || id === undefined || id === '') {
      throw new Error('Instruction ID is required');
    }
    if (name === null || name === undefined) {
      throw new Error('Name parameter is required');
    }
    if (typeof name !== 'string') {
      throw new Error('Name must be a string');
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
  async handleLoadSettings(_request, sendResponse) {
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
  async handleGetAllModels(_request, sendResponse) {
    try {
      const openRouterModels = await this.fetchOpenRouterModels();
      const geminiModels = this.getGeminiModels();
      const allModels = [...openRouterModels, ...geminiModels];

      // Cache for fast lookup
      this.cachedModels = allModels;

      sendResponse({
        success: true,
        data: allModels
      });
    } catch (error) {
      console.error('BackgroundService: handleGetAllModels - Error:', error);
      sendResponse({
        success: false,
        error: error.message
      });
    }
  }

  async fetchOpenRouterModels() {
    const CURATED_MODELS = this.getBestAvailableModels();

    try {
      const response = await fetch('https://openrouter.ai/api/v1/models', {
        headers: {
          'HTTP-Referer': 'https://github.com/dimitry-polivaev/timecodes-browser-extension',
          'X-Title': 'Video Chapters Generator'
        }
      });

      if (!response.ok) {
        throw new Error(`OpenRouter API error: ${response.status}`);
      }

      const data = await response.json();

      if (!data.data || data.data.length === 0) {
        throw new Error('OpenRouter API returned no models');
      }

      return data.data
        .filter(model => CURATED_MODELS.includes(model.id))
        .map(model => this.transformToStandardModelFormat(model));
    } catch (error) {
      console.error('BackgroundService: OpenRouter API fetch failed:', error);
      // Return empty array when OpenRouter API is unavailable
      return [];
    }
  }

  getBestAvailableModels() {
    return [
      ...this.getBestFreeModels(),
      ...this.getBestPaidModels()
    ];
  }

  getBestFreeModels() {
    return [
      'deepseek/deepseek-r1-0528:free',
      'meta-llama/llama-3.3-70b-instruct:free',
      'z-ai/glm-4.5-air:free',
      'qwen/qwen-2.5-72b-instruct:free'
    ];
  }

  getBestPaidModels() {
    return [
      'deepseek/deepseek-r1-0528',
      'anthropic/claude-3.5-sonnet',
      'anthropic/claude-3.5-haiku',
      'openai/gpt-4o',
      'openai/gpt-4o-mini',
      'meta-llama/llama-3.3-70b-instruct',
      'google/gemini-2.5-pro',
      'google/gemini-2.5-flash'
    ];
  }

  transformToStandardModelFormat(model) {
    const isFree = this.determineIfModelIsFree(model);
    return new ModelId(model.id, 'OpenRouter', isFree);
  }

  determineIfModelIsFree(model) {
    return model.pricing &&
      (model.pricing.prompt === '0' || model.pricing.prompt === 0) &&
      (model.pricing.completion === '0' || model.pricing.completion === 0);
  }


  getGeminiModels() {
    return [
      new ModelId('gemini-2.5-pro', 'Gemini', false),
      new ModelId('gemini-2.5-flash', 'Gemini', false)
    ];
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

  async handleGetLastCustomInstructions(request, sendResponse) {
    try {
      const instructions = await storageAdapter.getLastCustomInstructions();
      sendResponse({
        success: true,
        data: instructions
      });
    } catch (error) {
      console.error('Error getting last custom instructions:', error);
      sendResponse({
        success: false,
        error: error.message
      });
    }
  }

  async handleSaveLastCustomInstructions(request, sendResponse) {
    try {
      const { instructions } = request;
      if (instructions && instructions.trim()) {
        await storageAdapter.setLastCustomInstructions(instructions);
      } else {
        await storageAdapter.removeLastCustomInstructions();
      }
      sendResponse({
        success: true
      });
    } catch (error) {
      console.error('Error saving last custom instructions:', error);
      sendResponse({
        success: false,
        error: error.message
      });
    }
  }

  async handleRemoveLastCustomInstructions(request, sendResponse) {
    try {
      await storageAdapter.removeLastCustomInstructions();
      sendResponse({
        success: true
      });
    } catch (error) {
      console.error('Error removing last custom instructions:', error);
      sendResponse({
        success: false,
        error: error.message
      });
    }
  }

  async handleGetUserLanguage(request, sendResponse) {
    try {
      const settings = await settingsRepository.load();
      sendResponse({
        success: true,
        data: settings.additionalSettings.uiLanguage
      });
    } catch (error) {
      console.error('Error getting user language:', error);
      sendResponse({
        success: false,
        error: error.message
      });
    }
  }

  async handleChatMessage(request, sendResponse) {
    try {
      const { resultId, message, chatHistory } = request;

      if (!resultId || !message) {
        throw new Error('ResultId and message are required for chat');
      }

      // Get the original session to get model and settings
      const session = sessionRepository.findById(resultId);
      if (!session) {
        // Try to find by active session as fallback
        const activeSession = sessionRepository.getActiveSession();
        if (activeSession && activeSession.id.toString() === resultId.toString()) {
          const sessionResults = activeSession.toSessionResults();
          await this.processChatMessage(message, chatHistory, sessionResults, sendResponse);
          return;
        }
        throw new Error(`Session ${resultId} not found. Available sessions: ${Array.from(sessionRepository.sessions.keys()).join(', ')}`);
      }

      const sessionResults = session.toSessionResults();
      await this.processChatMessage(message, chatHistory, sessionResults, sendResponse);

    } catch (error) {
      console.error('Chat message error:', error);
      sendResponse({
        success: false,
        error: error.message
      });
    }
  }

  async processChatMessage(message, chatHistory, sessionResults, sendResponse) {
    try {
      const modelId = new ModelId(sessionResults.model.value, sessionResults.model.provider, sessionResults.model.isFree);

      // Get API key from settings (not stored in session for security)
      const settingsData = await settingsRepository.load();
      const credentials = settingsData.credentials;

      const apiKey = modelId.isGemini()
        ? credentials.geminiKey
        : credentials.openRouterKey;

      if (!apiKey) {
        throw new Error(`API key required for model: ${modelId.getDisplayName()}. Please configure your ${modelId.isGemini() ? 'Gemini' : 'OpenRouter'} API key in extension settings.`);
      }

      // Build conversation messages from chat history
      const conversationMessages = this.buildConversationMessages(chatHistory, sessionResults);

      // Generate response using the appropriate API adapter with conversation messages
      let response;

      if (modelId.isGemini()) {
        response = await this.geminiAPI.processSubtitles(
          conversationMessages, // Pass array of messages instead of string
          '', // No custom instructions for chat
          apiKey,
          modelId.toString()
        );
      } else if (modelId.isOpenRouter()) {
        response = await this.openRouterAPI.processSubtitles(
          conversationMessages, // Pass array of messages instead of string
          '', // No custom instructions for chat
          apiKey,
          modelId.toString()
        );
      } else {
        throw new Error(`Unsupported model provider: ${modelId.provider}`);
      }

      sendResponse({
        success: true,
        content: response.chapters,
        inputTokens: response.inputTokens || 0,
        outputTokens: response.outputTokens || 0
      });

    } catch (error) {
      console.error('Error processing chat message:', error);
      sendResponse({
        success: false,
        error: error.message
      });
    }
  }

  buildConversationMessages(chatHistory, _sessionResults) {
    // Convert chat history to conversation messages format
    const messages = [];

    // Add all messages from chat history maintaining proper conversation structure
    if (chatHistory && chatHistory.length > 0) {
      chatHistory.forEach(msg => {
        messages.push({
          role: msg.role,
          content: msg.content
        });
      });
    }

    return messages;
  }
}

const _backgroundService = new BackgroundService();

browser.runtime.onInstalled.addListener(details => {
  if (details.reason === 'install') {
    settingsRepository.saveSettings({});
  }
});

browser.runtime.onStartup.addListener(() => {
  handleExtensionStartup();
});

function handleExtensionStartup() {
}
