/**
 * ChapterGenerator Domain Service
 * Coordinates AI chapter generation process
 *
 * Copyright (C) 2025 Dimitry Polivaev
 * Licensed under GPL3 or later
 */

// Load ModelId for Node.js environment (tests), skip if already loaded in browser
if (typeof ModelId === 'undefined' && typeof require !== 'undefined') {
  const ModelId = require('../values/ModelId');
}

class ChapterGenerator {
  constructor(geminiAPI, openRouterAPI) {
    this.geminiAPI = geminiAPI;
    this.openRouterAPI = openRouterAPI;
  }

  async generateChapters(chapterGeneration, credentials, tabId = null) {
    if (!(chapterGeneration instanceof ChapterGeneration)) {
      throw new Error('chapterGeneration must be a ChapterGeneration instance');
    }

    if (!(credentials instanceof ApiCredentials)) {
      throw new Error('credentials must be an ApiCredentials instance');
    }

    if (!chapterGeneration.isPending()) {
      const status = chapterGeneration.status;
      if (status === 'completed') {
        throw new Error('Chapter generation has already completed');
      } else if (status === 'failed') {
        throw new Error('Chapter generation has already failed');
      } else {
        throw new Error(`Chapter generation is not in pending state (current: ${status})`);
      }
    }

    try {
      const modelId = chapterGeneration.modelId;
      const processedContent = chapterGeneration.videoTranscript.toProcessedContent();
      const apiKey = credentials.getKeyForModel(modelId);

      if (modelId.requiresApiKey() && !apiKey) {
        throw new Error(`API key required for model: ${modelId.getDisplayName()}`);
      }

      let result;

      if (modelId.isGemini()) {
        result = await this.geminiAPI.processSubtitles(
          processedContent,
          chapterGeneration.customInstructions,
          apiKey,
          modelId.toString(),
          tabId
        );
      } else if (modelId.isOpenRouter()) {
        console.log('ChapterGenerator: Calling OpenRouter API with:', { model: modelId.toString(), hasApiKey: !!apiKey });
        result = await this.openRouterAPI.processSubtitles(
          processedContent,
          chapterGeneration.customInstructions,
          apiKey,
          modelId.toString(),
          tabId
        );
        console.log('ChapterGenerator: OpenRouter result:', result);
      } else {
        throw new Error(`Unsupported model provider: ${modelId.provider}`);
      }

      if (!result || !result.chapters) {
        throw new Error('Invalid response from AI provider');
      }

      chapterGeneration.markCompleted(result.chapters);
      return chapterGeneration;

    } catch (error) {
      chapterGeneration.markFailed(error);
      throw error;
    }
  }

  async canGenerateChapters(modelId, credentials) {
    try {
      // modelId should be a ModelId instance, not a string
      if (!(modelId instanceof ModelId)) {
        throw new Error('modelId must be a ModelId instance');
      }
      return credentials.canUseModel(modelId);
    } catch (error) {
      return false;
    }
  }

  getAvailableModels() {
    const geminiModels = this.geminiAPI.getAvailableModels();
    const openRouterModels = this.openRouterAPI.getAvailableModels();

    return [...openRouterModels, ...geminiModels];
  }

  async processWithLegacyAPI(processedContent, customInstructions, apiKey, modelId, tabId) {
    try {
      const videoTranscript = new VideoTranscript(processedContent, 'Legacy Video', 'Legacy Author');
      // modelId should be a ModelId instance, not a string
      if (!(modelId instanceof ModelId)) {
        throw new Error('modelId must be a ModelId instance');
      }
      const chapterGeneration = new ChapterGeneration(videoTranscript, modelId, customInstructions);
      const credentials = modelId.isGemini()
        ? new ApiCredentials(apiKey, '')
        : new ApiCredentials('', apiKey);

      const result = await this.generateChapters(chapterGeneration, credentials, tabId);

      return {
        chapters: result.chapters,
        success: true
      };
    } catch (error) {
      return {
        error: error.message,
        success: false
      };
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ChapterGenerator;
}

