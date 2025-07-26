/**
 * OpenRouter API Adapter - Trivial Infrastructure
 * Zero control flow - just dependency wiring for browser extension
 *
 * Copyright (C) 2025 Dimitry Polivaev
 * Licensed under GPL3 or later
 */

if (typeof importScripts !== 'undefined') {
  if (typeof retryHandler === 'undefined') {
    importScripts('../background/errorhandler.js');
  }
  if (typeof BrowserHttpAdapter === 'undefined') {
    importScripts('BrowserHttpAdapter.js');
  }
  if (typeof NetworkCommunicator === 'undefined') {
    importScripts('../domain/services/NetworkCommunicator.js');
  }
  if (typeof OpenRouterChapterGenerator === 'undefined') {
    importScripts('../domain/services/OpenRouterChapterGenerator.js');
  }
}

class OpenRouterApiAdapter extends BaseLLM {
  constructor() {
    super('OpenRouter');

    const httpAdapter = new BrowserHttpAdapter();
    const networkCommunicator = new NetworkCommunicator(httpAdapter, retryHandler);

    this.openRouterChapterGenerator = new OpenRouterChapterGenerator(networkCommunicator, this.promptGenerator);
    this.availableModels = this.openRouterChapterGenerator.getAvailableModels();
  }

  async processSubtitles(subtitleContent, customInstructions = '', apiKey, model = 'deepseek/deepseek-r1-0528:free', tabId = null) {
    return this.openRouterChapterGenerator.processSubtitles(subtitleContent, customInstructions, apiKey, model);
  }

  async makeAPICall(prompt, apiKey, model, tabId = null) {
    const url = this.openRouterChapterGenerator.buildRequestUrl();
    const headers = this.openRouterChapterGenerator.buildHttpHeaders(apiKey, model);
    const body = this.openRouterChapterGenerator.buildRequestBody(prompt, model);

    return this.openRouterChapterGenerator.networkCommunicator.post(url, headers, body, tabId);
  }

  parseResponse(response) {
    return this.openRouterChapterGenerator.parseApiResponse(response);
  }

  validateAPIKey(apiKey) {
    return this.openRouterChapterGenerator.validateApiKey(apiKey);
  }

  isModelFree(modelId) {
    return this.openRouterChapterGenerator.isModelFree(modelId);
  }

  getModelsByCategory() {
    return this.openRouterChapterGenerator.getModelsByCategory();
  }

  getModelProvider(modelId) {
    return this.openRouterChapterGenerator.getModelProvider(modelId);
  }

  getModelRequirements(modelId) {
    return this.openRouterChapterGenerator.getModelRequirements(modelId);
  }
}
