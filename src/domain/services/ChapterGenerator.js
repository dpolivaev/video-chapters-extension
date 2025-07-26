/**
 * ChapterGenerator Domain Service
 * Coordinates AI chapter generation process
 *
 * Copyright (C) 2025 Dimitry Polivaev
 * Licensed under GPL3 or later
 */

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
      const subtitleContent = chapterGeneration.videoTranscript.toSubtitleContent();
      const apiKey = credentials.getKeyForModel(modelId.toString());

      if (modelId.requiresApiKey() && !apiKey) {
        throw new Error(`API key required for model: ${modelId.getDisplayName()}`);
      }

      let result;

      if (modelId.isGemini()) {
        result = await this.geminiAPI.processSubtitles(
          subtitleContent,
          chapterGeneration.customInstructions,
          apiKey,
          modelId.toString(),
          tabId
        );
      } else if (modelId.isOpenRouter()) {
        result = await this.openRouterAPI.processSubtitles(
          subtitleContent,
          chapterGeneration.customInstructions,
          apiKey,
          modelId.toString(),
          tabId
        );
      } else {
        throw new Error(`Unsupported model provider: ${modelId.provider}`);
      }

      if (!result || !result.chapters) {
        throw new Error('Invalid response from AI provider');
      }

      let chaptersWithUrl = result.chapters;
      if (chapterGeneration.videoTranscript.hasVideoUrl()) {
        chaptersWithUrl = chapterGeneration.videoTranscript.videoUrl.toString() + '\n\n' + result.chapters;
      }

      chapterGeneration.markCompleted(chaptersWithUrl);
      return chapterGeneration;

    } catch (error) {
      chapterGeneration.markFailed(error);
      throw error;
    }
  }

  async canGenerateChapters(modelId, credentials) {
    try {
      const model = new ModelId(modelId);
      return credentials.canUseModel(model.toString());
    } catch (error) {
      return false;
    }
  }

  getAvailableModels() {
    const geminiModels = this.geminiAPI.getAvailableModels();
    const openRouterModels = this.openRouterAPI.getAvailableModels();

    return [...openRouterModels, ...geminiModels];
  }

  async processWithLegacyAPI(subtitleContent, customInstructions, apiKey, modelId, tabId) {
    try {
      const videoTranscript = new VideoTranscript(subtitleContent, 'Legacy Video', 'Legacy Author');
      const chapterGeneration = new ChapterGeneration(videoTranscript, modelId, customInstructions);
      const credentials = modelId.includes('gemini-')
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

