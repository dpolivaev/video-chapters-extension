/**
 * HTTP Error Handling Tests
 * Tests error categorization and handling for both Gemini and OpenRouter APIs
 *
 * Copyright (C) 2025 Dimitry Polivaev
 * Licensed under GPL3 or later
 */

const GeminiChapterGenerator = require('./GeminiChapterGenerator');
const OpenRouterChapterGenerator = require('./OpenRouterChapterGenerator');

describe('HTTP Error Handling', () => {
  let geminiGenerator;
  let openRouterGenerator;
  let mockNetworkCommunicator;
  let mockPromptGenerator;

  beforeEach(() => {
    mockNetworkCommunicator = {
      post: jest.fn(),
      get: jest.fn()
    };

    mockPromptGenerator = {
      buildPrompt: jest.fn().mockReturnValue('test prompt')
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            id: 'deepseek/deepseek-r1-0528:free',
            name: 'DeepSeek R1 Free',
            category: 'reasoning',
            pricing: { prompt: '0', completion: '0' }
          },
          {
            id: 'deepseek/deepseek-r1-0528',
            name: 'DeepSeek R1',
            category: 'reasoning',
            pricing: { prompt: '0.27', completion: '1.10' }
          },
          {
            id: 'anthropic/claude-3.5-sonnet',
            name: 'Claude 3.5 Sonnet',
            category: 'premium',
            pricing: { prompt: '3', completion: '15' }
          },
          {
            id: 'openai/gpt-4o-mini',
            name: 'GPT-4o Mini',
            category: 'fast',
            pricing: { prompt: '0.15', completion: '0.6' }
          }
        ]
      })
    });

    geminiGenerator = new GeminiChapterGenerator(mockNetworkCommunicator, mockPromptGenerator);
    openRouterGenerator = new OpenRouterChapterGenerator(mockNetworkCommunicator, mockPromptGenerator);
  });

  describe('Gemini HTTP Error Categorization', () => {
    test('should handle 401 Unauthorized errors', async () => {
      const httpError = new Error('HTTP 401: Unauthorized');
      httpError.isHttpError = true;
      httpError.status = 401;
      httpError.responseData = { error: { message: 'Invalid API key' } };

      mockNetworkCommunicator.post.mockRejectedValue(httpError);

      await expect(
        geminiGenerator.processSubtitles('content', 'instructions', 'valid-gemini-api-key-123', 'gemini-2.5-pro')
      ).rejects.toThrow('Invalid API key. Please check your Gemini API key.');
    });

    test('should handle 403 Forbidden errors', async () => {
      const httpError = new Error('HTTP 403: Forbidden');
      httpError.isHttpError = true;
      httpError.status = 403;
      httpError.responseData = {};

      mockNetworkCommunicator.post.mockRejectedValue(httpError);

      await expect(
        geminiGenerator.processSubtitles('content', 'instructions', 'valid-gemini-api-key-123', 'gemini-2.5-pro')
      ).rejects.toThrow('API access forbidden. Please check your API key permissions.');
    });

    test('should handle 429 Rate Limit errors', async () => {
      const httpError = new Error('HTTP 429: Too Many Requests');
      httpError.isHttpError = true;
      httpError.status = 429;
      httpError.responseData = {};

      mockNetworkCommunicator.post.mockRejectedValue(httpError);

      await expect(
        geminiGenerator.processSubtitles('content', 'instructions', 'valid-gemini-api-key-123', 'gemini-2.5-pro')
      ).rejects.toThrow('Rate limit exceeded. Please try again later.');
    });

    test('should handle 400 Bad Request errors', async () => {
      const httpError = new Error('HTTP 400: Bad Request');
      httpError.isHttpError = true;
      httpError.status = 400;
      httpError.responseData = {
        error: { message: 'Invalid request format' }
      };

      mockNetworkCommunicator.post.mockRejectedValue(httpError);

      await expect(
        geminiGenerator.processSubtitles('content', 'instructions', 'valid-gemini-api-key-123', 'gemini-2.5-pro')
      ).rejects.toThrow('Request error: Invalid request format');
    });

    test('should handle 400 Bad Request with no error message', async () => {
      const httpError = new Error('HTTP 400: Bad Request');
      httpError.isHttpError = true;
      httpError.status = 400;
      httpError.responseData = {};

      mockNetworkCommunicator.post.mockRejectedValue(httpError);

      await expect(
        geminiGenerator.processSubtitles('content', 'instructions', 'valid-gemini-api-key-123', 'gemini-2.5-pro')
      ).rejects.toThrow('Request error: Bad request');
    });

    test('should handle other HTTP status codes', async () => {
      const httpError = new Error('HTTP 500: Internal Server Error');
      httpError.isHttpError = true;
      httpError.status = 500;
      httpError.responseData = {};

      mockNetworkCommunicator.post.mockRejectedValue(httpError);

      await expect(
        geminiGenerator.processSubtitles('content', 'instructions', 'valid-gemini-api-key-123', 'gemini-2.5-pro')
      ).rejects.toThrow('API request failed: 500');
    });

    test('should handle malformed response validation', async () => {
      const malformedResponse = {};
      mockNetworkCommunicator.post.mockResolvedValue(malformedResponse);

      await expect(
        geminiGenerator.processSubtitles('content', 'instructions', 'valid-gemini-api-key-123', 'gemini-2.5-pro')
      ).rejects.toThrow('Invalid response from Gemini API');
    });

    test('should handle RECITATION safety block', async () => {
      mockNetworkCommunicator.post.mockResolvedValue({
        candidates: [{
          finishReason: 'RECITATION',
          content: {
            parts: [{ text: 'blocked' }]
          }
        }]
      });

      await expect(
        geminiGenerator.processSubtitles('content', 'instructions', 'valid-gemini-api-key-123', 'gemini-2.5-pro')
      ).rejects.toThrow('Response was blocked due to recitation concerns');
    });
  });

  describe('OpenRouter HTTP Error Categorization', () => {
    test('should handle 401 Unauthorized for free models', async () => {
      const httpError = new Error('HTTP 401: Unauthorized');
      httpError.isHttpError = true;
      httpError.status = 401;
      httpError.responseData = {};

      mockNetworkCommunicator.post.mockRejectedValue(httpError);

      await expect(
        openRouterGenerator.processSubtitles('content', 'instructions', '', 'deepseek/deepseek-r1-0528:free')
      ).rejects.toThrow('OpenRouter API key is required for all models (free models have no usage cost but still need authentication)');
    });

    test('should handle 401 Unauthorized for paid models', async () => {
      const httpError = new Error('HTTP 401: Unauthorized');
      httpError.isHttpError = true;
      httpError.status = 401;
      httpError.responseData = {};

      mockNetworkCommunicator.post.mockRejectedValue(httpError);

      await expect(
        openRouterGenerator.processSubtitles('content', 'instructions', 'invalid-key', 'anthropic/claude-3.5-sonnet')
      ).rejects.toThrow('Invalid API key. Please check your OpenRouter API key.');
    });

    test('should handle 403 Forbidden for free models', async () => {
      const httpError = new Error('HTTP 403: Forbidden');
      httpError.isHttpError = true;
      httpError.status = 403;
      httpError.responseData = {};

      mockNetworkCommunicator.post.mockRejectedValue(httpError);

      await expect(
        openRouterGenerator.processSubtitles('content', 'instructions', '', 'deepseek/deepseek-r1-0528:free')
      ).rejects.toThrow('OpenRouter API key is required for all models (free models have no usage cost but still need authentication)');
    });

    test('should handle 403 Forbidden for paid models', async () => {
      const httpError = new Error('HTTP 403: Forbidden');
      httpError.isHttpError = true;
      httpError.status = 403;
      httpError.responseData = {};

      mockNetworkCommunicator.post.mockRejectedValue(httpError);

      await expect(
        openRouterGenerator.processSubtitles('content', 'instructions', 'test-key', 'anthropic/claude-3.5-sonnet')
      ).rejects.toThrow('API access forbidden. Please check your API key permissions.');
    });

    test('should handle 429 Rate Limit errors', async () => {
      const httpError = new Error('HTTP 429: Too Many Requests');
      httpError.isHttpError = true;
      httpError.status = 429;
      httpError.responseData = {};

      mockNetworkCommunicator.post.mockRejectedValue(httpError);

      await expect(
        openRouterGenerator.processSubtitles('content', 'instructions', 'test-key', 'anthropic/claude-3.5-sonnet')
      ).rejects.toThrow('Rate limit exceeded. Please try again later.');
    });

    test('should handle 400 Bad Request with error message', async () => {
      const httpError = new Error('HTTP 400: Bad Request');
      httpError.isHttpError = true;
      httpError.status = 400;
      httpError.responseData = {
        error: { message: 'Model not supported' }
      };

      mockNetworkCommunicator.post.mockRejectedValue(httpError);

      await expect(
        openRouterGenerator.processSubtitles('content', 'instructions', 'sk-or-valid-key-12345678901234567890', 'anthropic/claude-3.5-sonnet')
      ).rejects.toThrow('Request error: Model not supported');
    });

    test('should handle other HTTP status codes', async () => {
      const httpError = new Error('HTTP 502: Bad Gateway');
      httpError.isHttpError = true;
      httpError.status = 502;
      httpError.responseData = {};

      mockNetworkCommunicator.post.mockRejectedValue(httpError);

      await expect(
        openRouterGenerator.processSubtitles('content', 'instructions', 'test-key', 'anthropic/claude-3.5-sonnet')
      ).rejects.toThrow('API request failed: 502');
    });
  });

  describe('API Key Validation', () => {
    test('should validate OpenRouter API key format', () => {
      expect(openRouterGenerator.validateApiKey('sk-or-valid-key-12345678901234567890')).toBe(true);
      expect(openRouterGenerator.validateApiKey('sk-or-short')).toBe(false);
      expect(openRouterGenerator.validateApiKey('invalid-format')).toBe(false);
      expect(openRouterGenerator.validateApiKey('')).toBe(false);
      expect(openRouterGenerator.validateApiKey(null)).toBe(false);
      expect(openRouterGenerator.validateApiKey(123)).toBe(false);
    });

    test('should validate Gemini API key format', () => {
      expect(geminiGenerator.validateApiKey('valid-api-key-123')).toBe(true);
      expect(geminiGenerator.validateApiKey('short')).toBe(false);
      expect(geminiGenerator.validateApiKey('key with spaces')).toBe(false);
      expect(geminiGenerator.validateApiKey('')).toBe(false);
      expect(geminiGenerator.validateApiKey(null)).toBe(false);
      expect(geminiGenerator.validateApiKey({})).toBe(false);
    });
  });

  describe('Model Utilities Coverage', () => {

    test('should get model requirements', async () => {
      const freeModelReqs = await openRouterGenerator.getModelRequirements('deepseek/deepseek-r1-0528:free');
      expect(freeModelReqs.requiresApiKey).toBe(false);
      expect(freeModelReqs.estimatedCost).toBe('Free');

      const paidModelReqs = await openRouterGenerator.getModelRequirements('anthropic/claude-3.5-sonnet');
      expect(paidModelReqs.requiresApiKey).toBe(true);
      expect(paidModelReqs.estimatedCost).toBe('Pay-per-use');
    });

    test('should get specific model info', async () => {
      const model = await openRouterGenerator.getModel('deepseek/deepseek-r1-0528:free');
      expect(model).toBeDefined();
      expect(model.id).toBe('deepseek/deepseek-r1-0528:free');
      expect(model.isFree).toBe(true);

      const nonexistentModel = await openRouterGenerator.getModel('nonexistent/model');
      expect(nonexistentModel).toBeUndefined();
    });
  });

  describe('Response Validation Edge Cases', () => {
    test('should handle OpenRouter response validation failure', async () => {
      const responseWithoutChoices = {};
      mockNetworkCommunicator.post.mockResolvedValue(responseWithoutChoices);

      await expect(
        openRouterGenerator.processSubtitles('content', 'instructions', 'test-key', 'anthropic/claude-3.5-sonnet')
      ).rejects.toThrow('Invalid response from OpenRouter API');
    });

    test('should handle response without message', async () => {
      const responseWithChoicesButNoMessage = {
        choices: [{}]
      };
      mockNetworkCommunicator.post.mockResolvedValue(responseWithChoicesButNoMessage);

      await expect(
        openRouterGenerator.processSubtitles('content', 'instructions', 'sk-or-valid-key-12345678901234567890', 'anthropic/claude-3.5-sonnet')
      ).rejects.toThrow('AI processing failed: Invalid response from OpenRouter API');
    });

    test('should handle response with empty content', async () => {
      mockNetworkCommunicator.post.mockResolvedValue({
        choices: [{
          message: {
            content: ''
          }
        }]
      });

      await expect(
        openRouterGenerator.processSubtitles('content', 'instructions', 'sk-or-valid-key-12345678901234567890', 'anthropic/claude-3.5-sonnet')
      ).rejects.toThrow('No content in response');
    });
  });
});
