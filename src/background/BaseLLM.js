/**
 * Base LLM Class for Video Chapters Generator
 * Provides shared logic and interface for all LLM provider integrations
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
class BaseLLM {
  constructor(providerName) {
    this.providerName = providerName;
    this.promptGenerator = new PromptGenerator;
    this.availableModels = [];
    this.baseUrl = '';
  }
  async processSubtitles(processedContent, _customInstructions = '', _apiKey, _model) {
    throw new Error('processSubtitles must be implemented by subclass');
  }
  async makeAPICall(_prompt, _apiKey, _model) {
    throw new Error('makeAPICall must be implemented by subclass');
  }
  parseResponse(_response) {
    throw new Error('parseResponse must be implemented by subclass');
  }
  validateAPIKey(apiKey) {
    if (!apiKey || typeof apiKey !== 'string') {
      return false;
    }
    return apiKey.length > 10;
  }
  getAvailableModels() {
    throw new Error(`getAvailableModels() must be implemented by ${this.constructor.name}`);
  }
  getModelDisplayName(modelId) {
    const model = this.availableModels.find(m => m.id === modelId);
    return model?.displayName || modelId;
  }
  getModelDescription(modelId) {
    const model = this.availableModels.find(m => m.id === modelId);
    return model?.description || 'AI language model';
  }
  isModelFree(modelId) {
    const model = this.availableModels.find(m => m.id === modelId);
    return model?.isFree || false;
  }
  getModel(modelId) {
    return this.availableModels.find(m => m.id === modelId);
  }
  categorizeError(errorMessage, model) {
    if (errorMessage.includes('Invalid API key') || errorMessage.includes('Unauthorized')) {
      return {
        category: 'invalid_api_key',
        suggestion: `Please check your ${this.providerName} API key in the extension options.`
      };
    } else if (errorMessage.includes('Rate limit') || errorMessage.includes('429')) {
      return {
        category: 'rate_limit',
        suggestion: 'Please wait a moment and try again.'
      };
    } else if (errorMessage.includes('Free model access denied') || errorMessage.includes('Free model access forbidden')) {
      return {
        category: 'free_model_unavailable',
        suggestion: this.isModelFree(model) ? 'Try switching to a paid model or try again later.' : 'Model temporarily unavailable.'
      };
    } else if (errorMessage.includes('context length') || errorMessage.includes('too long')) {
      return {
        category: 'content_too_long',
        suggestion: 'The video content is too long. Try with a shorter video or split the content.'
      };
    } else if (errorMessage.includes('safety') || errorMessage.includes('blocked')) {
      return {
        category: 'content_filtered',
        suggestion: 'Content was filtered by safety systems. Try with different content.'
      };
    } else {
      return {
        category: 'general_error',
        suggestion: 'Please try again or switch to a different model.'
      };
    }
  }
  buildPrompt(processedContent, customInstructions = '', _promptType = 'chapter') {
    const prompt = this.promptGenerator.buildChapterPrompt(processedContent, customInstructions);
    return this.promptGenerator.adaptPromptForProvider(prompt, this.providerName.toLowerCase(), null);
  }
  async testAPIKey(apiKey, model = null) {
    const testModel = model || this.availableModels[0]?.id;
    if (!testModel) {
      throw new Error('No models available for testing');
    }
    if (!this.validateAPIKey(apiKey)) {
      throw new Error('Invalid API key format');
    }
    try {
      const testPrompt = this.promptGenerator.buildTestPrompt();
      const response = await this.makeAPICall(testPrompt, apiKey, testModel);
      const result = this.parseResponse(response);
      return {
        valid: true,
        model: result.model || testModel,
        message: 'API key is valid'
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }
  getProviderInfo() {
    return {
      name: this.providerName,
      baseUrl: this.baseUrl,
      modelCount: this.availableModels.length,
      freeModels: this.availableModels.filter(m => m.isFree).length
    };
  }
}
