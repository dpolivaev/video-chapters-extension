/**
 * ChapterGenerator Service Tests
 * Tests coordination logic for AI chapter generation with dependency injection
 *
 * Copyright (C) 2025 Dimitry Polivaev
 * Licensed under GPL3 or later
 */

const ChapterGenerator = require('./ChapterGenerator');
const ChapterGeneration = require('../entities/ChapterGeneration');
const ApiCredentials = require('../values/ApiCredentials');
const VideoTranscript = require('../entities/VideoTranscript');
const ModelId = require('../values/ModelId');

describe('ChapterGenerator', () => {
  let chapterGenerator;
  let mockGeminiAPI;
  let mockOpenRouterAPI;
  let videoTranscript;
  let credentials;

  beforeEach(() => {
    mockGeminiAPI = {
      processSubtitles: jest.fn(),
      getAvailableModels: jest.fn()
    };

    mockOpenRouterAPI = {
      processSubtitles: jest.fn(),
      getAvailableModels: jest.fn()
    };

    chapterGenerator = new ChapterGenerator(mockGeminiAPI, mockOpenRouterAPI);

    videoTranscript = new VideoTranscript(
      'Test transcript content',
      'Test Video',
      'Test Author',
      'https://youtube.com/watch?v=test123'
    );

    credentials = new ApiCredentials('test-gemini-key', 'test-openrouter-key');
  });

  describe('constructor and configuration', () => {
    test('should store injected API dependencies', () => {
      expect(chapterGenerator.geminiAPI).toBe(mockGeminiAPI);
      expect(chapterGenerator.openRouterAPI).toBe(mockOpenRouterAPI);
    });
  });

  describe('input validation', () => {
    test('should reject invalid chapterGeneration parameter', async () => {
      const invalidInputs = [
        null,
        undefined,
        'string',
        123,
        {},
        [],
        new Date()
      ];

      for (const input of invalidInputs) {
        await expect(chapterGenerator.generateChapters(input, credentials))
          .rejects.toThrow('chapterGeneration must be a ChapterGeneration instance');
      }
    });

    test('should reject invalid credentials parameter', async () => {
      const chapterGeneration = new ChapterGeneration(videoTranscript, 'gemini-2.5-pro', 'Test instructions');
      
      const invalidInputs = [
        null,
        undefined,
        'string',
        123,
        {},
        [],
        new Date()
      ];

      for (const input of invalidInputs) {
        await expect(chapterGenerator.generateChapters(chapterGeneration, input))
          .rejects.toThrow('credentials must be an ApiCredentials instance');
      }
    });

    test('should reject non-pending chapter generation', async () => {
      const chapterGeneration = new ChapterGeneration(videoTranscript, 'gemini-2.5-pro', 'Test instructions');
      
      chapterGeneration.markCompleted('Test chapters');
      await expect(chapterGenerator.generateChapters(chapterGeneration, credentials))
        .rejects.toThrow('Chapter generation has already completed');

      const failedGeneration = new ChapterGeneration(videoTranscript, 'gemini-2.5-pro', 'Test instructions');
      failedGeneration.markFailed(new Error('Previous error'));
      await expect(chapterGenerator.generateChapters(failedGeneration, credentials))
        .rejects.toThrow('Chapter generation has already failed');
    });
  });

  describe('Gemini model processing', () => {
    test('should process Gemini models successfully', async () => {
      const chapterGeneration = new ChapterGeneration(videoTranscript, 'gemini-2.5-pro', 'Focus on technical content');
      
      const expectedResult = {
        chapters: '1. Introduction\n2. Technical Overview\n3. Conclusion',
        finishReason: 'STOP',
        model: 'gemini-2.5-pro'
      };

      mockGeminiAPI.processSubtitles.mockResolvedValue(expectedResult);

      const result = await chapterGenerator.generateChapters(chapterGeneration, credentials, 123);

      expect(mockGeminiAPI.processSubtitles).toHaveBeenCalledWith(
        videoTranscript.toSubtitleContent(),
        'Focus on technical content',
        'test-gemini-key',
        'gemini-2.5-pro',
        123
      );

      expect(result.isCompleted()).toBe(true);
      expect(result.chapters).toContain('1. Introduction');
      expect(result.chapters).toContain(videoTranscript.videoUrl.toString());
    });

    test('should handle Gemini processing without tabId', async () => {
      const chapterGeneration = new ChapterGeneration(videoTranscript, 'gemini-2.5-flash', 'Generate chapters');
      
      mockGeminiAPI.processSubtitles.mockResolvedValue({
        chapters: 'Generated chapters',
        finishReason: 'STOP'
      });

      await chapterGenerator.generateChapters(chapterGeneration, credentials);

      expect(mockGeminiAPI.processSubtitles).toHaveBeenCalledWith(
        expect.any(String),
        'Generate chapters',
        'test-gemini-key',
        'gemini-2.5-flash',
        null
      );
    });

    test('should require API key for Gemini models', async () => {
      const chapterGeneration = new ChapterGeneration(videoTranscript, 'gemini-2.5-pro', 'Test instructions');
      const noGeminiCredentials = new ApiCredentials('', 'test-openrouter-key');

      await expect(chapterGenerator.generateChapters(chapterGeneration, noGeminiCredentials))
        .rejects.toThrow('API key required for model: Gemini 2.5 Pro');
    });
  });

  describe('OpenRouter model processing', () => {
    test('should process OpenRouter models successfully', async () => {
      const chapterGeneration = new ChapterGeneration(videoTranscript, 'deepseek/deepseek-r1-0528', 'Analyze content');
      
      const expectedResult = {
        chapters: '1. Opening\n2. Main Discussion\n3. Summary',
        finishReason: 'stop',
        model: 'deepseek/deepseek-r1-0528'
      };

      mockOpenRouterAPI.processSubtitles.mockResolvedValue(expectedResult);

      const result = await chapterGenerator.generateChapters(chapterGeneration, credentials, 456);

      expect(mockOpenRouterAPI.processSubtitles).toHaveBeenCalledWith(
        videoTranscript.toSubtitleContent(),
        'Analyze content',
        'test-openrouter-key',
        'deepseek/deepseek-r1-0528',
        456
      );

      expect(result.isCompleted()).toBe(true);
      expect(result.chapters).toContain('1. Opening');
    });

    test('should handle free OpenRouter models without API key', async () => {
      const chapterGeneration = new ChapterGeneration(videoTranscript, 'deepseek/deepseek-r1-0528:free', 'Test instructions');
      const noOpenRouterCredentials = new ApiCredentials('test-gemini-key', '');
      
      mockOpenRouterAPI.processSubtitles.mockResolvedValue({
        chapters: 'Free model chapters',
        finishReason: 'stop'
      });

      const result = await chapterGenerator.generateChapters(chapterGeneration, noOpenRouterCredentials);

      expect(mockOpenRouterAPI.processSubtitles).toHaveBeenCalledWith(
        expect.any(String),
        'Test instructions',
        '',
        'deepseek/deepseek-r1-0528:free',
        null
      );

      expect(result.isCompleted()).toBe(true);
    });

    test('should require API key for paid OpenRouter models', async () => {
      const chapterGeneration = new ChapterGeneration(videoTranscript, 'anthropic/claude-3.5-sonnet', 'Test instructions');
      const noOpenRouterCredentials = new ApiCredentials('test-gemini-key', '');

      await expect(chapterGenerator.generateChapters(chapterGeneration, noOpenRouterCredentials))
        .rejects.toThrow('API key required for model: Claude 3.5 Sonnet');
    });
  });

  describe('unsupported model handling', () => {
    test('should handle unknown models that return invalid responses', async () => {
      const chapterGeneration = new ChapterGeneration(videoTranscript, 'unknown/model', 'Test instructions');

      mockOpenRouterAPI.processSubtitles.mockResolvedValue(null);

      await expect(chapterGenerator.generateChapters(chapterGeneration, credentials))
        .rejects.toThrow('Invalid response from AI provider');
    });
  });

  describe('API response validation', () => {
    test('should handle empty API response', async () => {
      const chapterGeneration = new ChapterGeneration(videoTranscript, 'gemini-2.5-pro', 'Test instructions');
      
      mockGeminiAPI.processSubtitles.mockResolvedValue(null);

      await expect(chapterGenerator.generateChapters(chapterGeneration, credentials))
        .rejects.toThrow('Invalid response from AI provider');

      expect(chapterGeneration.isFailed()).toBe(true);
    });

    test('should handle API response without chapters', async () => {
      const chapterGeneration = new ChapterGeneration(videoTranscript, 'gemini-2.5-pro', 'Test instructions');
      
      mockGeminiAPI.processSubtitles.mockResolvedValue({
        finishReason: 'STOP',
        model: 'gemini-2.5-pro'
      });

      await expect(chapterGenerator.generateChapters(chapterGeneration, credentials))
        .rejects.toThrow('Invalid response from AI provider');

      expect(chapterGeneration.isFailed()).toBe(true);
    });

    test('should handle API response with empty chapters', async () => {
      const chapterGeneration = new ChapterGeneration(videoTranscript, 'gemini-2.5-pro', 'Test instructions');
      
      mockGeminiAPI.processSubtitles.mockResolvedValue({
        chapters: '',
        finishReason: 'STOP'
      });

      await expect(chapterGenerator.generateChapters(chapterGeneration, credentials))
        .rejects.toThrow('Invalid response from AI provider');
    });
  });

  describe('video URL handling', () => {
    test('should prepend video URL when available', async () => {
      const chapterGeneration = new ChapterGeneration(videoTranscript, 'gemini-2.5-pro', 'Test instructions');
      
      mockGeminiAPI.processSubtitles.mockResolvedValue({
        chapters: '1. Chapter One\n2. Chapter Two',
        finishReason: 'STOP'
      });

      const result = await chapterGenerator.generateChapters(chapterGeneration, credentials);

      expect(result.chapters).toContain('https://www.youtube.com/watch?v=test123');
      expect(result.chapters).toContain('1. Chapter One');
    });

    test('should handle video without URL', async () => {
      const videoWithoutUrl = new VideoTranscript('Test content', 'Test Video', 'Test Author');
      const chapterGeneration = new ChapterGeneration(videoWithoutUrl, 'gemini-2.5-pro', 'Test instructions');
      
      mockGeminiAPI.processSubtitles.mockResolvedValue({
        chapters: '1. Chapter One\n2. Chapter Two',
        finishReason: 'STOP'
      });

      const result = await chapterGenerator.generateChapters(chapterGeneration, credentials);

      expect(result.chapters).toBe('1. Chapter One\n2. Chapter Two');
      expect(result.chapters).not.toContain('https://');
    });
  });

  describe('error handling and state management', () => {
    test('should mark generation as failed on API error', async () => {
      const chapterGeneration = new ChapterGeneration(videoTranscript, 'gemini-2.5-pro', 'Test instructions');
      const apiError = new Error('API rate limit exceeded');
      
      mockGeminiAPI.processSubtitles.mockRejectedValue(apiError);

      await expect(chapterGenerator.generateChapters(chapterGeneration, credentials))
        .rejects.toThrow('API rate limit exceeded');

      expect(chapterGeneration.isFailed()).toBe(true);
      expect(chapterGeneration.error).toBe('API rate limit exceeded');
    });

    test('should mark generation as failed on network error', async () => {
      const chapterGeneration = new ChapterGeneration(videoTranscript, 'deepseek/deepseek-r1-0528', 'Test instructions');
      const networkError = new Error('Network timeout');
      
      mockOpenRouterAPI.processSubtitles.mockRejectedValue(networkError);

      await expect(chapterGenerator.generateChapters(chapterGeneration, credentials))
        .rejects.toThrow('Network timeout');

      expect(chapterGeneration.isFailed()).toBe(true);
    });
  });

  describe('model capability checking', () => {
    test('should check if generation is possible with valid model and credentials', async () => {
      const canGenerate = await chapterGenerator.canGenerateChapters('gemini-2.5-pro', credentials);
      expect(canGenerate).toBe(true);
    });

    test('should return true for unknown models (treated as free)', async () => {
      const canGenerate = await chapterGenerator.canGenerateChapters('invalid-model', credentials);
      expect(canGenerate).toBe(true);
    });

    test('should return false for model without required credentials', async () => {
      const noCredentials = new ApiCredentials('', '');
      const canGenerate = await chapterGenerator.canGenerateChapters('gemini-2.5-pro', noCredentials);
      expect(canGenerate).toBe(false);
    });
  });

  describe('available models aggregation', () => {
    test('should combine models from both APIs', () => {
      const geminiModels = [
        { id: 'gemini-2.5-pro', displayName: 'Gemini 2.5 Pro' }
      ];
      
      const openRouterModels = [
        { id: 'deepseek/deepseek-r1-0528', displayName: 'DeepSeek R1' }
      ];

      mockGeminiAPI.getAvailableModels.mockReturnValue(geminiModels);
      mockOpenRouterAPI.getAvailableModels.mockReturnValue(openRouterModels);

      const allModels = chapterGenerator.getAvailableModels();

      expect(allModels).toHaveLength(2);
      expect(allModels).toContain(geminiModels[0]);
      expect(allModels).toContain(openRouterModels[0]);
    });

    test('should handle empty model lists', () => {
      mockGeminiAPI.getAvailableModels.mockReturnValue([]);
      mockOpenRouterAPI.getAvailableModels.mockReturnValue([]);

      const allModels = chapterGenerator.getAvailableModels();
      expect(allModels).toHaveLength(0);
    });
  });

  describe('legacy API processing', () => {
    test('should process with legacy API successfully for Gemini', async () => {
      mockGeminiAPI.processSubtitles.mockResolvedValue({
        chapters: '1. Legacy Chapter\n2. Legacy Summary',
        finishReason: 'STOP'
      });

      const result = await chapterGenerator.processWithLegacyAPI(
        'Legacy transcript content',
        'Legacy instructions',
        'legacy-gemini-key',
        'gemini-2.5-pro',
        789
      );

      expect(result.success).toBe(true);
      expect(result.chapters).toContain('1. Legacy Chapter');
      expect(mockGeminiAPI.processSubtitles).toHaveBeenCalledWith(
        expect.stringContaining('Legacy transcript content'),
        'Legacy instructions',
        'legacy-gemini-key',
        'gemini-2.5-pro',
        789
      );
    });

    test('should process with legacy API successfully for OpenRouter', async () => {
      mockOpenRouterAPI.processSubtitles.mockResolvedValue({
        chapters: '1. OpenRouter Chapter\n2. OpenRouter Summary',
        finishReason: 'stop'
      });

      const result = await chapterGenerator.processWithLegacyAPI(
        'Legacy transcript content',
        'Legacy instructions',
        'legacy-openrouter-key',
        'deepseek/deepseek-r1-0528',
        789
      );

      expect(result.success).toBe(true);
      expect(result.chapters).toContain('1. OpenRouter Chapter');
      expect(mockOpenRouterAPI.processSubtitles).toHaveBeenCalledWith(
        expect.stringContaining('Legacy transcript content'),
        'Legacy instructions',
        'legacy-openrouter-key',
        'deepseek/deepseek-r1-0528',
        789
      );
    });

    test('should handle legacy API errors gracefully', async () => {
      mockGeminiAPI.processSubtitles.mockRejectedValue(new Error('Legacy API error'));

      const result = await chapterGenerator.processWithLegacyAPI(
        'Legacy transcript content',
        'Legacy instructions',
        'legacy-key',
        'gemini-2.5-pro',
        789
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Legacy API error');
      expect(result.chapters).toBeUndefined();
    });
  });

  describe('edge cases', () => {
    test('should handle empty custom instructions', async () => {
      const chapterGeneration = new ChapterGeneration(videoTranscript, 'gemini-2.5-pro', '');
      
      mockGeminiAPI.processSubtitles.mockResolvedValue({
        chapters: 'Generated without instructions',
        finishReason: 'STOP'
      });

      const result = await chapterGenerator.generateChapters(chapterGeneration, credentials);

      expect(mockGeminiAPI.processSubtitles).toHaveBeenCalledWith(
        expect.any(String),
        '',
        expect.any(String),
        expect.any(String),
        null
      );
      expect(result.isCompleted()).toBe(true);
    });


    test('should handle very large transcript content', async () => {
      const largeContent = 'A'.repeat(100000);
      const largeVideoTranscript = new VideoTranscript(largeContent, 'Large Video', 'Test Author');
      const chapterGeneration = new ChapterGeneration(largeVideoTranscript, 'gemini-2.5-pro', 'Summarize this large content');
      
      mockGeminiAPI.processSubtitles.mockResolvedValue({
        chapters: 'Summary of large content',
        finishReason: 'STOP'
      });

      const result = await chapterGenerator.generateChapters(chapterGeneration, credentials);

      expect(result.isCompleted()).toBe(true);
      expect(mockGeminiAPI.processSubtitles).toHaveBeenCalledWith(
        expect.stringContaining(largeContent),
        'Summarize this large content',
        expect.any(String),
        'gemini-2.5-pro',
        null
      );
    });
  });
});