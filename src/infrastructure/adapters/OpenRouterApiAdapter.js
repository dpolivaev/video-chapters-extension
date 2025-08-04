/**
 * OpenRouter API Adapter - Minimal wrapper for BackgroundService integration
 *
 * Copyright (C) 2025 Dimitry Polivaev
 * Licensed under GPL3 or later
 */

class OpenRouterApiAdapter {
  constructor(backgroundService) {
    this.backgroundService = backgroundService;
  }

  async getAvailableModels() {
    return this.backgroundService.fetchOpenRouterModels();
  }

  async processSubtitles(processedContent, customInstructions, apiKey, model) {
    // Create a minimal OpenRouterChapterGenerator for processing
    const httpAdapter = new BrowserHttpAdapter();
    const networkCommunicator = new NetworkCommunicator(httpAdapter, retryHandler);
    const promptGenerator = new PromptGenerator();
    const generator = new OpenRouterChapterGenerator(networkCommunicator, promptGenerator);

    return generator.processSubtitles(processedContent, customInstructions, apiKey, model);
  }
}
