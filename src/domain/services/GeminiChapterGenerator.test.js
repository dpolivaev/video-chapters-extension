/**
 * GeminiChapterGenerator Service Tests
 * Tests Gemini API business logic with dependency injection
 *
 * Copyright (C) 2025 Dimitry Polivaev
 * Licensed under GPL3 or later
 */

const GeminiChapterGenerator = require('./GeminiChapterGenerator');

describe('GeminiChapterGenerator', () => {
  let geminiGenerator;
  let mockNetworkCommunicator;
  let mockPromptGenerator;

  beforeEach(() => {
    mockNetworkCommunicator = {
      post: jest.fn()
    };

    mockPromptGenerator = {
      buildPrompt: jest.fn()
    };

    geminiGenerator = new GeminiChapterGenerator(mockNetworkCommunicator, mockPromptGenerator);
  });

  describe('constructor and configuration', () => {
    test('should store injected dependencies', () => {
      expect(geminiGenerator.networkCommunicator).toBe(mockNetworkCommunicator);
      expect(geminiGenerator.promptGenerator).toBe(mockPromptGenerator);
    });

    test('should set correct base URL', () => {
      expect(geminiGenerator.baseUrl).toBe('https://generativelanguage.googleapis.com/v1beta');
    });

    test('should provide available models', () => {
      const models = geminiGenerator.getAvailableModels();
      expect(models).toHaveLength(2);
      expect(models.find(m => m.id === 'gemini-2.5-pro')).toBeDefined();
      expect(models.find(m => m.id === 'gemini-2.5-flash')).toBeDefined();
    });

    test('should return immutable copy of models', () => {
      const models1 = geminiGenerator.getAvailableModels();
      const models2 = geminiGenerator.getAvailableModels();

      expect(models1).not.toBe(models2);
      expect(models1).toEqual(models2);
    });
  });

  describe('API key validation', () => {
    test('should accept valid API keys', () => {
      const validKeys = [
        'AIzaSyAbCdEfGhIjKlMnOpQrStUvWxYz123456789',
        'valid-api-key-123',
        'VALID_API_KEY_456',
        'mix3d-K3y_w1th-numb3rs'
      ];

      validKeys.forEach(key => {
        expect(geminiGenerator.validateApiKey(key)).toBe(true);
      });
    });

    test('should reject invalid API keys', () => {
      const invalidKeys = [
        null,
        undefined,
        '',
        'short',
        'key with spaces',
        'key@with#special!chars',
        123,
        {},
        []
      ];

      invalidKeys.forEach(key => {
        expect(geminiGenerator.validateApiKey(key)).toBe(false);
      });
    });

    test('should require minimum key length', () => {
      expect(geminiGenerator.validateApiKey('1234567890')).toBe(false); // exactly 10
      expect(geminiGenerator.validateApiKey('12345678901')).toBe(true);  // 11 chars
    });
  });

  describe('model validation', () => {
    test('should accept valid models', () => {
      expect(geminiGenerator.validateModel('gemini-2.5-pro')).toBe(true);
      expect(geminiGenerator.validateModel('gemini-2.5-flash')).toBe(true);
    });

    test('should reject invalid models', () => {
      const invalidModels = [
        'gemini-1.5-pro',
        'gpt-4',
        'claude-3',
        '',
        null,
        undefined,
        123
      ];

      invalidModels.forEach(model => {
        expect(geminiGenerator.validateModel(model)).toBe(false);
      });
    });
  });

  describe('URL building', () => {
    test('should build correct request URL', () => {
      const model = 'gemini-2.5-pro';
      const apiKey = 'test-api-key-123';

      const url = geminiGenerator.buildRequestUrl(model, apiKey);

      expect(url).toBe(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=test-api-key-123'
      );
    });

    test('should handle different models', () => {
      const apiKey = 'test-key';

      const proUrl = geminiGenerator.buildRequestUrl('gemini-2.5-pro', apiKey);
      const flashUrl = geminiGenerator.buildRequestUrl('gemini-2.5-flash', apiKey);

      expect(proUrl).toContain('gemini-2.5-pro');
      expect(flashUrl).toContain('gemini-2.5-flash');
    });
  });

  describe('request headers', () => {
    test('should build correct headers', () => {
      const headers = geminiGenerator.buildHttpHeaders();

      expect(headers).toEqual({
        'Content-Type': 'application/json'
      });
    });
  });

  describe('request body building', () => {
    test('should build request body with prompt', () => {
      const prompt = 'Generate chapters for this video';

      const body = geminiGenerator.buildRequestBody(prompt);

      expect(body).toEqual({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 8192
        },
        safetySettings: [
          {
            category: 'HARM_CATEGORY_HARASSMENT',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE'
          },
          {
            category: 'HARM_CATEGORY_HATE_SPEECH',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE'
          },
          {
            category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE'
          },
          {
            category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE'
          }
        ]
      });
    });

    test('should use consistent generation config', () => {
      const body = geminiGenerator.buildRequestBody('test prompt');

      expect(body.generationConfig.temperature).toBe(0.7);
      expect(body.generationConfig.topK).toBe(40);
      expect(body.generationConfig.topP).toBe(0.95);
      expect(body.generationConfig.maxOutputTokens).toBe(8192);
    });
  });

  describe('response parsing', () => {
    test('should parse successful response', () => {
      const responseData = {
        candidates: [{
          content: {
            parts: [{ text: '1. Introduction\n2. Main Content\n3. Conclusion' }]
          },
          finishReason: 'STOP'
        }],
        modelVersion: 'gemini-2.5-pro'
      };

      const result = geminiGenerator.parseApiResponse(responseData);

      expect(result).toEqual({
        chapters: '1. Introduction\n2. Main Content\n3. Conclusion',
        finishReason: 'STOP',
        model: 'gemini-2.5-pro'
      });
    });

    test('should handle missing model version', () => {
      const responseData = {
        candidates: [{
          content: {
            parts: [{ text: 'Chapter content' }]
          },
          finishReason: 'STOP'
        }]
      };

      const result = geminiGenerator.parseApiResponse(responseData);

      expect(result.model).toBe('unknown');
    });

    test('should handle safety-blocked responses', () => {
      const responseData = {
        candidates: [{
          finishReason: 'SAFETY'
        }]
      };

      expect(() => geminiGenerator.parseApiResponse(responseData))
        .toThrow('Response was blocked by safety filters');
    });

    test('should handle empty response', () => {
      const responseData = {
        candidates: [{
          content: { parts: [{ text: '' }] }
        }]
      };

      expect(() => geminiGenerator.parseApiResponse(responseData))
        .toThrow('Empty response from AI');
    });

    test('should handle malformed responses', () => {
      expect(() => geminiGenerator.parseApiResponse({ candidates: [] }))
        .toThrow('No candidates in response');

      expect(() => geminiGenerator.parseApiResponse({ candidates: [{}] }))
        .toThrow('No content in response');

      expect(() => geminiGenerator.parseApiResponse(null))
        .toThrow();
    });
  });

  describe('full processing workflow', () => {
    test('should process subtitles successfully', async () => {
      const processedContent = 'Video transcript content here';
      const customInstructions = 'Focus on technical details';
      const apiKey = 'test-api-key-123';
      const model = 'gemini-2.5-pro';

      const expectedPrompt = 'Generated prompt content';
      const expectedResponse = {
        candidates: [{
          content: {
            parts: [{ text: '1. Intro\n2. Technical Overview\n3. Conclusion' }]
          },
          finishReason: 'STOP'
        }]
      };

      mockPromptGenerator.buildPrompt.mockReturnValue(expectedPrompt);
      mockNetworkCommunicator.post.mockResolvedValue(expectedResponse);

      const result = await geminiGenerator.processSubtitles(
        processedContent,
        customInstructions,
        apiKey,
        model
      );

      expect(mockPromptGenerator.buildPrompt).toHaveBeenCalledWith(
        processedContent,
        customInstructions
      );

      expect(mockNetworkCommunicator.post).toHaveBeenCalledWith(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=test-api-key-123',
        { 'Content-Type': 'application/json' },
        {
          contents: [{
            parts: [{ text: expectedPrompt }]
          }],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 8192
          },
          safetySettings: [
            {
              category: 'HARM_CATEGORY_HARASSMENT',
              threshold: 'BLOCK_MEDIUM_AND_ABOVE'
            },
            {
              category: 'HARM_CATEGORY_HATE_SPEECH',
              threshold: 'BLOCK_MEDIUM_AND_ABOVE'
            },
            {
              category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
              threshold: 'BLOCK_MEDIUM_AND_ABOVE'
            },
            {
              category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
              threshold: 'BLOCK_MEDIUM_AND_ABOVE'
            }
          ]
        }
      );

      expect(result).toEqual({
        chapters: '1. Intro\n2. Technical Overview\n3. Conclusion',
        finishReason: 'STOP',
        model: 'unknown'
      });
    });

    test('should handle network errors during processing', async () => {
      const networkError = new Error('Network timeout');
      mockPromptGenerator.buildPrompt.mockReturnValue('test prompt');
      mockNetworkCommunicator.post.mockRejectedValue(networkError);

      await expect(
        geminiGenerator.processSubtitles('content', 'instructions', 'valid-api-key-123', 'gemini-2.5-pro')
      ).rejects.toThrow('AI processing failed: Network timeout');
    });

    test('should handle API errors during processing', async () => {
      const apiError = new Error('HTTP 401: Unauthorized');
      apiError.isHttpError = true;
      apiError.status = 401;

      mockPromptGenerator.buildPrompt.mockReturnValue('test prompt');
      mockNetworkCommunicator.post.mockRejectedValue(apiError);

      await expect(
        geminiGenerator.processSubtitles('content', 'instructions', 'valid-api-key-123', 'gemini-2.5-pro')
      ).rejects.toThrow();
    });
  });

  describe('edge cases', () => {
    test('should handle empty subtitle content', async () => {
      mockPromptGenerator.buildPrompt.mockReturnValue('prompt for empty content');
      mockNetworkCommunicator.post.mockResolvedValue({
        candidates: [{
          content: { parts: [{ text: 'No chapters available' }] },
          finishReason: 'STOP'
        }]
      });

      const result = await geminiGenerator.processSubtitles('', '', 'valid-api-key-123', 'gemini-2.5-pro');

      expect(result.chapters).toBe('No chapters available');
    });

    test('should handle null custom instructions', async () => {
      mockPromptGenerator.buildPrompt.mockReturnValue('prompt');
      mockNetworkCommunicator.post.mockResolvedValue({
        candidates: [{
          content: { parts: [{ text: 'chapters' }] },
          finishReason: 'STOP'
        }]
      });

      await geminiGenerator.processSubtitles('content', null, 'valid-api-key-123', 'gemini-2.5-pro');

      expect(mockPromptGenerator.buildPrompt).toHaveBeenCalledWith('content', null);
    });

    test('should handle processing without tabId', async () => {
      mockPromptGenerator.buildPrompt.mockReturnValue('prompt');
      mockNetworkCommunicator.post.mockResolvedValue({
        candidates: [{
          content: { parts: [{ text: 'chapters' }] },
          finishReason: 'STOP'
        }]
      });

      await geminiGenerator.processSubtitles('content', 'instructions', 'valid-api-key-123', 'gemini-2.5-pro');

      expect(mockNetworkCommunicator.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.any(Object)
      );
    });
  });
});
