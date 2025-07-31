/**
 * Gemini API Adapter - Trivial Infrastructure
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
  if (typeof GeminiChapterGenerator === 'undefined') {
    importScripts('../domain/services/GeminiChapterGenerator.js');
  }
}

class GeminiApiAdapter extends BaseLLM {
  constructor() {
    super('Gemini');

    const httpAdapter = new BrowserHttpAdapter();
    const networkCommunicator = new NetworkCommunicator(httpAdapter, retryHandler);

    this.geminiChapterGenerator = new GeminiChapterGenerator(networkCommunicator, this.promptGenerator);
    this.availableModels = this.geminiChapterGenerator.getAvailableModels();
  }

  async processSubtitles(processedContent, customInstructions = '', apiKey, model = 'gemini-2.5-pro') {
    return this.geminiChapterGenerator.processSubtitles(processedContent, customInstructions, apiKey, model);
  }

  async makeAPICall(prompt, apiKey, model) {
    const url = this.geminiChapterGenerator.buildRequestUrl(model, apiKey);
    const headers = this.geminiChapterGenerator.buildHttpHeaders();
    const body = this.geminiChapterGenerator.buildRequestBody(prompt);

    return this.geminiChapterGenerator.networkCommunicator.post(url, headers, body);
  }

  parseResponse(response) {
    return this.geminiChapterGenerator.parseApiResponse(response);
  }

  validateAPIKey(apiKey) {
    return this.geminiChapterGenerator.validateApiKey(apiKey);
  }
}
