/**
 * OpenRouter Chapter Generator - Pure Domain Logic
 * Contains all OpenRouter API business logic without framework dependencies
 *
 * Copyright (C) 2025 Dimitry Polivaev
 * Licensed under GPL3 or later
 */

class OpenRouterChapterGenerator {
  constructor(networkCommunicator, promptGenerator) {
    this.networkCommunicator = networkCommunicator;
    this.promptGenerator = promptGenerator;
    this.baseUrl = 'https://openrouter.ai/api/v1';
    // No static models - Single Source of Truth is the OpenRouter API
  }

  validateApiKey(apiKey) {
    if (!apiKey || typeof apiKey !== 'string') {
      return false;
    }
    const apiKeyPattern = /^sk-or-[A-Za-z0-9_-]+$/;
    return apiKeyPattern.test(apiKey) && apiKey.length > 20;
  }

  async validateModel(model) {
    try {
      const models = await this.fetchLiveModels();
      return models.some(m => m.id === model);
    } catch (error) {
      // If API fails, allow any model (let API validation handle it)
      console.warn('OpenRouterChapterGenerator: Could not validate model, allowing:', model);
      return true;
    }
  }

  async isModelFree(model) {
    try {
      const models = await this.fetchLiveModels();
      const modelInfo = models.find(m => m.id === model);
      if (!modelInfo) {
        console.warn('OpenRouterChapterGenerator: Model not found in API, assuming paid:', model);
        return false;
      }
      const isFree = modelInfo.pricing &&
        (modelInfo.pricing.prompt === '0' || modelInfo.pricing.prompt === 0) &&
        (modelInfo.pricing.completion === '0' || modelInfo.pricing.completion === 0);
      return isFree;
    } catch (error) {
      console.error('OpenRouterChapterGenerator: Failed to check if model is free:', error);
      // If API fails, assume it's paid to be safe
      return false;
    }
  }

  async getAvailableModels() {
    try {
      const liveModels = await this.fetchLiveModels();
      return liveModels.map(model => {
        const isFree = model.pricing &&
          (model.pricing.prompt === '0' || model.pricing.prompt === 0) &&
          (model.pricing.completion === '0' || model.pricing.completion === 0);

        return {
          id: model.id,
          displayName: model.name,
          description: model.description || `${model.name} model via OpenRouter`,
          isFree,
          category: isFree ? 'free' : 'paid',
          capabilities: ['general']
        };
      });
    } catch (error) {
      console.error('OpenRouterChapterGenerator: Failed to get available models:', error);
      return [];
    }
  }

  async fetchLiveModels() {
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

    return data.data;
  }

  async getModelsByCategory() {
    try {
      const models = await this.getAvailableModels();
      const categories = {
        free: models.filter(m => m.isFree),
        reasoning: models.filter(m => m.category === 'reasoning' && !m.isFree),
        premium: models.filter(m => m.category === 'premium'),
        fast: models.filter(m => m.category === 'fast' && !m.isFree),
        general: models.filter(m => m.category === 'general')
      };

      Object.keys(categories).forEach(key => {
        if (categories[key].length === 0) {
          delete categories[key];
        }
      });

      return categories;
    } catch (error) {
      console.error('OpenRouterChapterGenerator: Failed to get models by category:', error);
      return {};
    }
  }

  getModelProvider(modelId) {
    if (modelId.startsWith('deepseek/')) {
      return 'DeepSeek';
    }
    if (modelId.startsWith('google/')) {
      return 'Google';
    }
    if (modelId.startsWith('anthropic/')) {
      return 'Anthropic';
    }
    if (modelId.startsWith('openai/')) {
      return 'OpenAI';
    }
    if (modelId.startsWith('meta-llama/')) {
      return 'Meta';
    }
    return 'Unknown';
  }

  getModelRequirements(modelId) {
    const model = this.getModel(modelId);
    if (!model) {
      return {};
    }

    return {
      requiresApiKey: !model.isFree,
      estimatedCost: model.isFree ? 'Free' : 'Pay-per-use',
      category: model.category,
      capabilities: model.capabilities
    };
  }

  getModel(modelId) {
    return this.availableModels.find(m => m.id === modelId);
  }

  buildRequestUrl() {
    return `${this.baseUrl}/chat/completions`;
  }

  async buildHttpHeaders(apiKey, _model) {
    const headers = {
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://github.com/dimitry-polivaev/timecodes-browser-extension',
      'X-Title': 'Video Chapters Generator'
    };

    // OpenRouter requires API key for all models
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    return headers;
  }

  buildRequestBody(prompt, model) {
    return {
      model,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 8192,
      top_p: 0.95
    };
  }

  async categorizeHttpError(status, errorData, model) {
    if (status === 401) {
      const isFreeModel = await this.isModelFree(model);
      if (isFreeModel) {
        return new Error('Free model access denied. The model may be temporarily unavailable.');
      } else {
        return new Error('Invalid API key. Please check your OpenRouter API key.');
      }
    } else if (status === 403) {
      const isFreeModel = await this.isModelFree(model);
      if (isFreeModel) {
        return new Error('Free model access forbidden. The model may have usage limits.');
      } else {
        return new Error('API access forbidden. Please check your API key permissions.');
      }
    } else if (status === 429) {
      return new Error('Rate limit exceeded. Please try again later.');
    } else if (status === 400) {
      const errorMessage = errorData.error?.message || 'Bad request';
      return new Error(`Request error: ${errorMessage}`);
    } else {
      return new Error(`API request failed: ${status}`);
    }
  }

  validateHttpResponse(responseData) {
    if (!responseData.choices || !responseData.choices[0] || !responseData.choices[0].message) {
      throw new Error('Invalid response from OpenRouter API');
    }
    return responseData;
  }

  parseApiResponse(responseData) {
    const choice = responseData.choices[0];
    if (!choice) {
      throw new Error('No choices in response');
    }

    const message = choice.message;
    if (!message || !message.content) {
      throw new Error('No content in response');
    }

    const text = message.content;
    if (!text) {
      throw new Error('Empty response from AI');
    }

    return {
      chapters: text.trim(),
      finishReason: choice.finish_reason,
      model: responseData.model || 'unknown'
    };
  }

  async processSubtitles(processedContent, customInstructions, apiKey, model = 'deepseek/deepseek-r1-0528:free') {
    // OpenRouter requires API key for all models, even free ones
    if (!apiKey) {
      throw new Error('OpenRouter API key is required for all models (free models have no usage cost but still need authentication)');
    }

    const isValidModel = await this.validateModel(model);
    if (!isValidModel) {
      throw new Error(`Invalid model: ${model}. Please check the model name.`);
    }

    const prompt = this.promptGenerator.buildPrompt(processedContent, customInstructions);
    const url = this.buildRequestUrl();
    const headers = await this.buildHttpHeaders(apiKey, model);
    const body = this.buildRequestBody(prompt, model);

    try {
      const responseData = await this.networkCommunicator.post(url, headers, body);
      console.log('OpenRouterChapterGenerator: Raw API response:', responseData);
      this.validateHttpResponse(responseData);
      const result = this.parseApiResponse(responseData);
      console.log('OpenRouterChapterGenerator: Parsed result:', result);
      return result;
    } catch (error) {
      if (error.isHttpError) {
        throw await this.categorizeHttpError(error.status, error.responseData, model);
      }
      throw new Error(`AI processing failed: ${error.message}`);
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = OpenRouterChapterGenerator;
}
