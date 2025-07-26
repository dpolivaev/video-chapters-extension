/**
 * Message Coordinator - Pure Domain Logic
 * Coordinates communication between components without browser dependencies
 *
 * Copyright (C) 2025 Dimitry Polivaev
 * Licensed under GPL3 or later
 */

let VideoTranscript, ModelId, ApiCredentials, ChapterGeneration, BrowserTab;

function isNodeJsEnvironment() {
  return typeof require !== 'undefined' && typeof module !== 'undefined';
}

if (isNodeJsEnvironment()) {
  VideoTranscript = require('../entities/VideoTranscript');
  ModelId = require('../values/ModelId');
  ApiCredentials = require('../values/ApiCredentials');
  ChapterGeneration = require('../entities/ChapterGeneration');
  BrowserTab = require('../entities/BrowserTab');
}

class MessageCoordinator {
  constructor(chapterGenerator, transcriptExtractor, sessionRepository, settingsRepository, instructionHistory) {
    this.chapterGenerator = chapterGenerator;
    this.transcriptExtractor = transcriptExtractor;
    this.sessionRepository = sessionRepository;
    this.settingsRepository = settingsRepository;
    this.instructionHistory = instructionHistory;
  }

  async handleGeminiProcessing(request) {
    const { videoId, subtitles, customInstructions, apiKey, model } = request;

    if (!videoId) {
      throw new Error('Video ID is required');
    }

    if (!subtitles || subtitles.length === 0) {
      throw new Error('No subtitles found for this video');
    }

    if (!model) {
      throw new Error('Model is required');
    }

    const youtubeUrl = videoId.includes('youtube.com') ? videoId : `https://www.youtube.com/watch?v=${videoId}`;
    const videoTranscript = new VideoTranscript(subtitles, 'Video Title', 'Video Author', youtubeUrl);
    const credentials = new ApiCredentials(apiKey, '');
    
    const chapterGeneration = new ChapterGeneration(
      videoTranscript,
      model,
      customInstructions
    );

    const result = await this.chapterGenerator.generateChapters(
      chapterGeneration,
      credentials
    );

    this.sessionRepository.save(chapterGeneration);

    return {
      success: true,
      resultId: chapterGeneration.id,
      videoId: videoId,
      chapters: result.chapters || chapterGeneration.chapters,
      model: model,
      finishReason: result.finishReason || 'completed'
    };
  }

  async handleSaveInstruction(request) {
    const { instruction } = request;

    if (!instruction || instruction.trim().length === 0) {
      throw new Error('Instruction cannot be empty');
    }

    this.instructionHistory.save(instruction.trim());

    return { success: true };
  }

  async handleGetInstructionHistory() {
    const instructions = this.instructionHistory.getAll();

    return {
      success: true,
      instructions: instructions
    };
  }

  async handleDeleteInstruction(request) {
    const { index } = request;

    if (typeof index !== 'number' || index < 0) {
      throw new Error('Invalid instruction index');
    }

    const deleted = this.instructionHistory.delete(index);

    if (!deleted) {
      throw new Error('Instruction not found');
    }

    return { success: true };
  }

  async handleSaveSettings(request) {
    const { settings } = request;

    if (!settings || typeof settings !== 'object') {
      throw new Error('Invalid settings object');
    }

    await this.settingsRepository.save(settings);

    return { success: true };
  }

  async handleLoadSettings() {
    const settings = await this.settingsRepository.load();

    return {
      success: true,
      settings: settings
    };
  }

  async handleGetAllModels() {
    const geminiModels = this.chapterGenerator.geminiAPI.getAvailableModels();
    const openRouterModels = this.chapterGenerator.openRouterAPI.getAvailableModels();

    return {
      success: true,
      models: {
        gemini: geminiModels,
        openrouter: openRouterModels
      }
    };
  }

  async handleSetSessionResults(request) {
    const { resultId, results } = request;

    if (!resultId || !results) {
      throw new Error('Result ID and results are required');
    }

    const session = ChapterGeneration.fromSessionResults(results);
    this.sessionRepository.save(session);

    return { success: true };
  }

  async handleGetSessionResults(request) {
    const { sessionId } = request;

    if (!sessionId) {
      throw new Error('Session ID is required');
    }

    const session = this.sessionRepository.get(sessionId);

    if (!session) {
      throw new Error('Session not found');
    }

    return {
      success: true,
      session: session.toPlainObject()
    };
  }

  async handleTabRegistration(request) {
    const { tabId, videoId, action } = request;

    if (!tabId || !videoId) {
      throw new Error('Tab ID and Video ID are required');
    }

    const youtubeUrl = `https://youtube.com/watch?v=${videoId}`;
    const tabType = action === 'process' ? 'video' : (action || 'unknown');
    const browserTab = new BrowserTab(tabId, youtubeUrl, tabType);

    return {
      success: true,
      tab: {
        id: browserTab.id,
        url: browserTab.url?.toString() || null,
        type: browserTab.type,
        videoId: browserTab.getVideoId()
      }
    };
  }

  async processMessage(action, request) {
    try {
      switch (action) {
        case 'processWithGemini':
          return await this.handleGeminiProcessing(request);
        
        case 'saveInstruction':
          return await this.handleSaveInstruction(request);
        
        case 'getInstructionHistory':
          return await this.handleGetInstructionHistory(request);
        
        case 'deleteInstruction':
          return await this.handleDeleteInstruction(request);
        
        case 'saveSettings':
          return await this.handleSaveSettings(request);
        
        case 'loadSettings':
          return await this.handleLoadSettings(request);
        
        case 'getAllModels':
          return await this.handleGetAllModels(request);
        
        case 'setSessionResults':
          return await this.handleSetSessionResults(request);
        
        case 'getSessionResults':
          return await this.handleGetSessionResults(request);
        
        case 'registerTab':
          return await this.handleTabRegistration(request);
        
        default:
          throw new Error(`Unknown action: ${action}`);
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = MessageCoordinator;
}