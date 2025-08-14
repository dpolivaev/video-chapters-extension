/**
 * Gemini Chapter Generator - Pure Domain Logic
 * Contains all Gemini API business logic without framework dependencies
 *
 * Copyright (C) 2025 Dimitry Polivaev
 * Licensed under GPL3 or later
 */

class GeminiChapterGenerator {
  constructor(networkCommunicator, promptGenerator) {
    this.networkCommunicator = networkCommunicator;
    this.promptGenerator = promptGenerator;
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
    this.availableModels = [
      {
        id: 'gemini-2.5-pro',
        displayName: 'Gemini 2.5 Pro',
        description: 'Most capable model for complex reasoning and analysis',
        isFree: false,
        category: 'premium',
        capabilities: ['reasoning', 'coding', 'analysis']
      },
      {
        id: 'gemini-2.5-flash',
        displayName: 'Gemini 2.5 Flash',
        description: 'Faster model optimized for speed while maintaining quality',
        isFree: false,
        category: 'fast',
        capabilities: ['speed', 'general']
      }
    ];
  }

  validateApiKey(apiKey) {
    if (!apiKey || typeof apiKey !== 'string') {
      return false;
    }
    const apiKeyPattern = /^[A-Za-z0-9_-]+$/;
    return apiKeyPattern.test(apiKey) && apiKey.length > 10;
  }

  validateModel(model) {
    return this.availableModels.some(m => m.id === model);
  }

  getAvailableModels() {
    return [...this.availableModels];
  }

  buildRequestUrl(model, apiKey) {
    return `${this.baseUrl}/models/${model}:generateContent?key=${apiKey}`;
  }

  buildRequestBody(prompt) {
    return {
      contents: [
        {
          parts: [
            {
              text: prompt
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 8192
      },
      safetySettings: [
        {
          category: 'HARM_CATEGORY_HARASSMENT',
          threshold: 'BLOCK_NONE'
        },
        {
          category: 'HARM_CATEGORY_HATE_SPEECH',
          threshold: 'BLOCK_NONE'
        },
        {
          category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
          threshold: 'BLOCK_NONE'
        },
        {
          category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
          threshold: 'BLOCK_NONE'
        }
      ]
    };
  }

  buildHttpHeaders() {
    return {
      'Content-Type': 'application/json'
    };
  }

  categorizeHttpError(status, errorData) {
    if (status === 401) {
      return new Error('Invalid API key. Please check your Gemini API key.');
    } else if (status === 403) {
      return new Error('API access forbidden. Please check your API key permissions.');
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
    if (!responseData.candidates || !responseData.candidates[0] || !responseData.candidates[0].content) {
      throw new Error('Invalid response from Gemini API');
    }
    return responseData;
  }

  parseApiResponse(responseData) {
    const candidate = responseData.candidates[0];
    if (!candidate) {
      throw new Error('No candidates in response');
    }

    if (candidate.finishReason === 'SAFETY') {
      throw new Error('Response was blocked by safety filters');
    }

    if (candidate.finishReason === 'RECITATION') {
      throw new Error('Response was blocked due to recitation concerns');
    }

    const content = candidate.content;
    if (!content || !content.parts || !content.parts[0]) {
      throw new Error('No content in response');
    }

    const text = content.parts[0].text;
    if (!text) {
      throw new Error('Empty response from AI');
    }

    return {
      chapters: text.trim(),
      finishReason: candidate.finishReason,
      safetyRatings: candidate.safetyRatings,
      model: responseData.modelVersion || 'unknown'
    };
  }

  async processSubtitles(processedContent, customInstructions, apiKey, model = 'gemini-2.5-pro') {
    if (!this.validateApiKey(apiKey)) {
      throw new Error('API key is required');
    }

    if (!this.validateModel(model)) {
      const availableIds = this.availableModels.map(m => m.id);
      throw new Error(`Invalid model: ${model}. Available models: ${availableIds.join(', ')}`);
    }

    const prompt = this.promptGenerator.buildPrompt(processedContent, customInstructions);
    const url = this.buildRequestUrl(model, apiKey);
    const headers = this.buildHttpHeaders();
    const body = this.buildRequestBody(prompt);

    try {
      const responseData = await this.networkCommunicator.post(url, headers, body);
      this.validateHttpResponse(responseData);
      return this.parseApiResponse(responseData);
    } catch (error) {
      if (error.isHttpError) {
        throw this.categorizeHttpError(error.status, error.responseData);
      }
      throw new Error(`AI processing failed: ${error.message}`);
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = GeminiChapterGenerator;
}
