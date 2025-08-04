/**
 * OpenRouterChapterGenerator Service Tests
 * Tests OpenRouter API business logic with dependency injection
 *
 * Copyright (C) 2025 Dimitry Polivaev
 * Licensed under GPL3 or later
 */

const OpenRouterChapterGenerator = require('./OpenRouterChapterGenerator');

describe('OpenRouterChapterGenerator', () => {
  let openRouterGenerator;
  let mockNetworkCommunicator;
  let mockPromptGenerator;

  beforeEach(() => {
    mockNetworkCommunicator = {
      post: jest.fn(),
      get: jest.fn()
    };

    mockPromptGenerator = {
      buildPrompt: jest.fn()
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

    openRouterGenerator = new OpenRouterChapterGenerator(mockNetworkCommunicator, mockPromptGenerator);
  });

  describe('constructor and configuration', () => {
    test('should store injected dependencies', () => {
      expect(openRouterGenerator.networkCommunicator).toBe(mockNetworkCommunicator);
      expect(openRouterGenerator.promptGenerator).toBe(mockPromptGenerator);
    });

    test('should set correct base URL', () => {
      expect(openRouterGenerator.baseUrl).toBe('https://openrouter.ai/api/v1');
    });

    test('should provide available models including free models', async () => {
      const models = await openRouterGenerator.getAvailableModels();
      expect(models.length).toBeGreaterThan(0);

      const freeModel = models.find(m => m.isFree === true);
      expect(freeModel).toBeDefined();
      expect(freeModel.id).toBe('deepseek/deepseek-r1-0528:free');
    });

    test('should include various model categories', async () => {
      const models = await openRouterGenerator.getAvailableModels();
      const categories = models.map(m => m.category);

      expect(categories).toContain('reasoning');
      expect(categories).toContain('fast');
      expect(categories).toContain('premium');
    });

    test('should return immutable copy of models', async () => {
      const models1 = await openRouterGenerator.getAvailableModels();
      const models2 = await openRouterGenerator.getAvailableModels();

      expect(models1).not.toBe(models2);
      expect(models1).toEqual(models2);
    });
  });

  describe('model validation', () => {
    test('should accept valid OpenRouter models', async () => {
      expect(await openRouterGenerator.validateModel('deepseek/deepseek-r1-0528:free')).toBe(true);
      expect(await openRouterGenerator.validateModel('deepseek/deepseek-r1-0528')).toBe(true);
      expect(await openRouterGenerator.validateModel('anthropic/claude-3.5-sonnet')).toBe(true);
    });

    test('should reject invalid models', async () => {
      const invalidModels = [
        'gemini-2.5-pro', // This would be direct Gemini, not OpenRouter
        'gpt-4-invalid',
        'unknown/model',
        '',
        null,
        undefined,
        123
      ];

      for (const model of invalidModels) {
        expect(await openRouterGenerator.validateModel(model)).toBe(false);
      }
    });
  });

  describe('free model detection', () => {
    test('should correctly identify free models', async () => {
      expect(await openRouterGenerator.isModelFree('deepseek/deepseek-r1-0528:free')).toBe(true);
    });

    test('should correctly identify paid models', async () => {
      expect(await openRouterGenerator.isModelFree('deepseek/deepseek-r1-0528')).toBe(false);
      expect(await openRouterGenerator.isModelFree('anthropic/claude-3.5-sonnet')).toBe(false);
      expect(await openRouterGenerator.isModelFree('openai/gpt-4o')).toBe(false);
    });

    test('should handle edge cases in free model detection', async () => {
      expect(await openRouterGenerator.isModelFree('')).toBe(false);
      expect(await openRouterGenerator.isModelFree(null)).toBe(false);
      expect(await openRouterGenerator.isModelFree(undefined)).toBe(false);
    });
  });

  describe('provider categorization', () => {
    test('should categorize DeepSeek models correctly', () => {
      expect(openRouterGenerator.getModelProvider('deepseek/deepseek-r1-0528')).toBe('DeepSeek');
      expect(openRouterGenerator.getModelProvider('deepseek/deepseek-r1-distill-qwen-1.5b')).toBe('DeepSeek');
    });

    test('should categorize Anthropic models correctly', () => {
      expect(openRouterGenerator.getModelProvider('anthropic/claude-3.5-sonnet')).toBe('Anthropic');
      expect(openRouterGenerator.getModelProvider('anthropic/claude-3.5-haiku')).toBe('Anthropic');
    });

    test('should categorize OpenAI models correctly', () => {
      expect(openRouterGenerator.getModelProvider('openai/gpt-4o')).toBe('OpenAI');
      expect(openRouterGenerator.getModelProvider('openai/gpt-4o-mini')).toBe('OpenAI');
    });

    test('should categorize Meta models correctly', () => {
      expect(openRouterGenerator.getModelProvider('meta-llama/llama-3.3-70b')).toBe('Meta');
      expect(openRouterGenerator.getModelProvider('meta-llama/llama-3.3-70b:free')).toBe('Meta');
    });

    test('should categorize Google models correctly', () => {
      expect(openRouterGenerator.getModelProvider('google/gemini-2.5-pro')).toBe('Google');
    });

    test('should handle unknown providers', () => {
      expect(openRouterGenerator.getModelProvider('unknown/model')).toBe('Unknown');
      expect(openRouterGenerator.getModelProvider('invalid-format')).toBe('Unknown');
      expect(openRouterGenerator.getModelProvider('')).toBe('Unknown');
    });
  });

  describe('URL building', () => {
    test('should build correct chat completions URL', () => {
      const url = openRouterGenerator.buildChatCompletionsUrl();
      expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
    });
  });

  describe('request headers', () => {
    test('should build OpenRouter headers without API key', () => {
      const headers = openRouterGenerator.buildOpenRouterHeaders('');

      expect(headers).toEqual({
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/dimitry-polivaev/timecodes-browser-extension',
        'X-Title': 'Video Chapters Generator'
      });
    });

    test('should build OpenRouter headers with API key', () => {
      const apiKey = 'sk-or-v1-test-key-123';
      const headers = openRouterGenerator.buildOpenRouterHeaders(apiKey);

      expect(headers).toEqual({
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://github.com/dimitry-polivaev/timecodes-browser-extension',
        'X-Title': 'Video Chapters Generator'
      });
    });

    test('should include referer and title for OpenRouter attribution', () => {
      const headers = openRouterGenerator.buildOpenRouterHeaders('');

      expect(headers['HTTP-Referer']).toBe('https://github.com/dimitry-polivaev/timecodes-browser-extension');
      expect(headers['X-Title']).toBe('Video Chapters Generator');
    });
  });

  describe('request body building', () => {
    test('should build chat completion request body', () => {
      const prompt = 'Generate chapters for this video';
      const model = 'deepseek/deepseek-r1-0528:free';

      const body = openRouterGenerator.buildChatCompletionBody(prompt, model);

      expect(body).toEqual({
        model,
        messages: [{
          role: 'user',
          content: prompt
        }],
        temperature: 0.7,
        max_tokens: 8192,
        top_p: 0.95
      });
    });

    test('should use consistent generation parameters', () => {
      const body = openRouterGenerator.buildChatCompletionBody('test prompt', 'test/model');

      expect(body.temperature).toBe(0.7);
      expect(body.max_tokens).toBe(8192);
      expect(body.top_p).toBe(0.95);
    });
  });

  describe('response parsing', () => {
    test('should parse successful OpenRouter response', () => {
      const responseData = {
        choices: [{
          message: {
            content: '1. Introduction\n2. Main Content\n3. Conclusion'
          },
          finish_reason: 'stop'
        }],
        model: 'deepseek/deepseek-r1-0528:free',
        usage: {
          prompt_tokens: 100,
          completion_tokens: 50,
          total_tokens: 150
        }
      };

      const result = openRouterGenerator.parseApiResponse(responseData);

      expect(result).toEqual({
        chapters: '1. Introduction\n2. Main Content\n3. Conclusion',
        finishReason: 'stop',
        model: 'deepseek/deepseek-r1-0528:free'
      });
    });

    test('should handle response without usage data', () => {
      const responseData = {
        choices: [{
          message: {
            content: 'Chapter content'
          },
          finish_reason: 'stop'
        }],
        model: 'test/model'
      };

      const result = openRouterGenerator.parseApiResponse(responseData);

      expect(result.usage).toBeUndefined();
      expect(result.chapters).toBe('Chapter content');
    });

    test('should handle empty content response', () => {
      const responseData = {
        choices: [{
          message: {
            content: ''
          }
        }]
      };

      expect(() => openRouterGenerator.parseApiResponse(responseData))
        .toThrow('No content in response');
    });

    test('should handle malformed responses', () => {
      expect(() => openRouterGenerator.parseApiResponse({ choices: [] }))
        .toThrow('No choices in response');

      expect(() => openRouterGenerator.parseApiResponse({ choices: [{}] }))
        .toThrow('No content in response');

      expect(() => openRouterGenerator.parseApiResponse(null))
        .toThrow();
    });
  });

  describe('full processing workflow', () => {
    test('should process subtitles with free model successfully', async () => {
      const processedContent = 'Video transcript content here';
      const customInstructions = 'Focus on technical details';
      const model = 'deepseek/deepseek-r1-0528:free';

      const expectedPrompt = 'Generated prompt content';
      const expectedResponse = {
        choices: [{
          message: {
            content: '1. Intro\n2. Technical Overview\n3. Conclusion'
          },
          finish_reason: 'stop'
        }],
        model
      };

      mockPromptGenerator.buildPrompt.mockReturnValue(expectedPrompt);
      mockNetworkCommunicator.post.mockResolvedValue(expectedResponse);

      const result = await openRouterGenerator.processSubtitles(
        processedContent,
        customInstructions,
        'test-api-key', // API key required for all models
        model
      );

      expect(mockPromptGenerator.buildPrompt).toHaveBeenCalledWith(
        processedContent,
        customInstructions
      );

      expect(mockNetworkCommunicator.post).toHaveBeenCalledWith(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-api-key',
          'HTTP-Referer': 'https://github.com/dimitry-polivaev/timecodes-browser-extension',
          'X-Title': 'Video Chapters Generator'
        },
        {
          model,
          messages: [{
            role: 'user',
            content: expectedPrompt
          }],
          temperature: 0.7,
          max_tokens: 8192,
          top_p: 0.95
        }
      );

      expect(result).toEqual({
        chapters: '1. Intro\n2. Technical Overview\n3. Conclusion',
        finishReason: 'stop',
        model
      });
    });

    test('should process subtitles with paid model and API key', async () => {
      const apiKey = 'sk-or-v1-test-key-123';
      const model = 'anthropic/claude-3.5-sonnet';

      mockPromptGenerator.buildPrompt.mockReturnValue('test prompt');
      mockNetworkCommunicator.post.mockResolvedValue({
        choices: [{
          message: { content: 'chapters' },
          finish_reason: 'stop'
        }]
      });

      await openRouterGenerator.processSubtitles('content', 'instructions', apiKey, model);

      expect(mockNetworkCommunicator.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          'Authorization': `Bearer ${apiKey}`
        }),
        expect.any(Object)
      );
    });

    test('should handle network errors during processing', async () => {
      const networkError = new Error('Network timeout');
      mockPromptGenerator.buildPrompt.mockReturnValue('test prompt');
      mockNetworkCommunicator.post.mockRejectedValue(networkError);

      await expect(
        openRouterGenerator.processSubtitles('content', 'instructions', 'test-api-key', 'deepseek/deepseek-r1-0528:free')
      ).rejects.toThrow('AI processing failed: Network timeout');
    });

    test('should handle API errors during processing', async () => {
      const apiError = new Error('HTTP 401: Unauthorized');
      apiError.isHttpError = true;
      apiError.status = 401;

      mockPromptGenerator.buildPrompt.mockReturnValue('test prompt');
      mockNetworkCommunicator.post.mockRejectedValue(apiError);

      await expect(
        openRouterGenerator.processSubtitles('content', 'instructions', 'invalid-key', 'anthropic/claude-3.5-sonnet')
      ).rejects.toThrow();
    });
  });

  describe('edge cases', () => {
    test('should handle empty subtitle content', async () => {
      mockPromptGenerator.buildPrompt.mockReturnValue('prompt for empty content');
      mockNetworkCommunicator.post.mockResolvedValue({
        choices: [{
          message: { content: 'No chapters available' },
          finish_reason: 'stop'
        }]
      });

      const result = await openRouterGenerator.processSubtitles('', '', 'test-api-key', 'deepseek/deepseek-r1-0528:free');

      expect(result.chapters).toBe('No chapters available');
    });

    test('should handle null custom instructions', async () => {
      mockPromptGenerator.buildPrompt.mockReturnValue('prompt');
      mockNetworkCommunicator.post.mockResolvedValue({
        choices: [{
          message: { content: 'chapters' },
          finish_reason: 'stop'
        }]
      });

      await openRouterGenerator.processSubtitles('content', null, 'test-api-key', 'deepseek/deepseek-r1-0528:free');

      expect(mockPromptGenerator.buildPrompt).toHaveBeenCalledWith('content', null);
    });

    test('should handle model validation failure', async () => {
      await expect(
        openRouterGenerator.processSubtitles('content', 'instructions', 'sk-or-v1-test-key', 'invalid-model')
      ).rejects.toThrow('Invalid model: invalid-model');
    });
  });
});
