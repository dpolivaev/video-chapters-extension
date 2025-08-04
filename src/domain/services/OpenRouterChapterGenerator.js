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
    this.MINIMUM_API_KEY_LENGTH = 20;
    this.DEFAULT_FREE_MODEL = 'deepseek/deepseek-r1-0528:free';
    this.GENERATION_TEMPERATURE = 0.7;
    this.MAX_RESPONSE_TOKENS = 8192;
    this.TOP_P_SAMPLING = 0.95;
    this.GITHUB_REFERER = 'https://github.com/dimitry-polivaev/timecodes-browser-extension';
    this.APPLICATION_TITLE = 'Video Chapters Generator';
  }

  validateApiKey(apiKey) {
    if (!apiKey || typeof apiKey !== 'string') {
      return false;
    }
    const apiKeyPattern = /^sk-or-[A-Za-z0-9_-]+$/;
    return apiKeyPattern.test(apiKey) && apiKey.length > this.MINIMUM_API_KEY_LENGTH;
  }

  allowModelWhenApiUnavailable(model) {
    console.warn('OpenRouterChapterGenerator: Could not validate model, allowing:', model);
    return true;
  }

  validateApiKeyRequired(apiKey) {
    if (!apiKey) {
      throw new Error('OpenRouter API key is required for all models (free models have no usage cost but still need authentication)');
    }
  }

  async validateModel(model) {
    try {
      const models = await this.fetchLiveModels();
      return models.some(m => m.id === model);
    } catch (error) {
      return this.allowModelWhenApiUnavailable(model);
    }
  }

  determineIfModelIsFree(modelPricing) {
    return modelPricing &&
      (modelPricing.prompt === '0' || modelPricing.prompt === 0) &&
      (modelPricing.completion === '0' || modelPricing.completion === 0);
  }

  async isModelFree(model) {
    try {
      const models = await this.fetchLiveModels();
      const modelInfo = models.find(m => m.id === model);
      if (!modelInfo) {
        console.warn('OpenRouterChapterGenerator: Model not found in API, assuming paid:', model);
        return false;
      }
      return this.determineIfModelIsFree(modelInfo.pricing);
    } catch (error) {
      console.error('OpenRouterChapterGenerator: Failed to check if model is free:', error);
      return false;
    }
  }

  async getAvailableModels() {
    try {
      const liveModels = await this.fetchLiveModels();
      return liveModels.map(model => {
        const isFree = this.determineIfModelIsFree(model.pricing);

        return {
          id: model.id,
          displayName: model.name,
          description: model.description || `${model.name} model via OpenRouter`,
          isFree,
          category: model.category || 'general',
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
        'HTTP-Referer': this.GITHUB_REFERER,
        'X-Title': this.APPLICATION_TITLE
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

  async getModelRequirements(modelId) {
    const model = await this.getModel(modelId);
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

  async getModel(modelId) {
    const models = await this.getAvailableModels();
    return models.find(m => m.id === modelId);
  }

  buildChatCompletionsUrl() {
    return `${this.baseUrl}/chat/completions`;
  }

  buildOpenRouterHeaders(apiKey) {
    const headers = {
      'Content-Type': 'application/json',
      'HTTP-Referer': this.GITHUB_REFERER,
      'X-Title': this.APPLICATION_TITLE
    };

    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    return headers;
  }

  buildChatCompletionBody(prompt, model) {
    return {
      model,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: this.GENERATION_TEMPERATURE,
      max_tokens: this.MAX_RESPONSE_TOKENS,
      top_p: this.TOP_P_SAMPLING
    };
  }

  async categorizeUnauthorizedError(model) {
    const isFreeModel = await this.isModelFree(model);
    if (isFreeModel) {
      return new Error('Free model access denied. The model may be temporarily unavailable.');
    } else {
      return new Error('Invalid API key. Please check your OpenRouter API key.');
    }
  }

  async categorizeForbiddenError(model) {
    const isFreeModel = await this.isModelFree(model);
    if (isFreeModel) {
      return new Error('Free model access forbidden. The model may have usage limits.');
    } else {
      return new Error('API access forbidden. Please check your API key permissions.');
    }
  }

  categorizeBadRequestError(errorData) {
    const errorMessage = errorData.error?.message || 'Bad request';
    return new Error(`Request error: ${errorMessage}`);
  }

  async categorizeHttpError(status, errorData, model) {
    if (status === 401) {
      return await this.categorizeUnauthorizedError(model);
    } else if (status === 403) {
      return await this.categorizeForbiddenError(model);
    } else if (status === 429) {
      return new Error('Rate limit exceeded. Please try again later.');
    } else if (status === 400) {
      return this.categorizeBadRequestError(errorData);
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

  async processSubtitles(processedContent, customInstructions, apiKey, model = this.DEFAULT_FREE_MODEL) {
    this.validateApiKeyRequired(apiKey);

    const isValidModel = await this.validateModel(model);
    if (!isValidModel) {
      throw new Error(`Invalid model: ${model}. Please check the model name.`);
    }

    const prompt = this.promptGenerator.buildPrompt(processedContent, customInstructions);
    const url = this.buildChatCompletionsUrl();
    const headers = this.buildOpenRouterHeaders(apiKey);
    const body = this.buildChatCompletionBody(prompt, model);

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
