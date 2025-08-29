/**
 * ChapterGeneration Entity Tests
 * Tests actual ChapterGeneration class with proper imports
 *
 * Copyright (C) 2025 Dimitry Polivaev
 * Licensed under GPL3 or later
 */

const ChapterGeneration = require('./ChapterGeneration');
const VideoTranscript = require('./VideoTranscript');
const ModelId = require('../values/ModelId');

describe('ChapterGeneration Entity', () => {
  let mockVideoTranscript;

  beforeEach(() => {
    mockVideoTranscript = new VideoTranscript(
      'Test subtitle content',
      'Test Video Title',
      'Test Author',
      'https://youtube.com/watch?v=testid'
    );
  });

  describe('constructor and initialization', () => {
    test('should create with valid parameters', () => {
      const geminiModel = new ModelId('gemini-2.5-pro', 'Gemini');
      const generation = new ChapterGeneration(
        mockVideoTranscript,
        geminiModel,
        'Custom instructions'
      );

      expect(generation.id).toBeDefined();
      expect(generation.videoTranscript).toBe(mockVideoTranscript);
      expect(generation.modelId.toString()).toBe('gemini-2.5-pro');
      expect(generation.customInstructions).toBe('Custom instructions');
      expect(generation.status).toBe('pending');
      expect(generation.chapters).toBe(null);
      expect(generation.error).toBe(null);
      expect(generation.createdAt).toBeInstanceOf(Date);
      expect(generation.completedAt).toBe(null);
    });

    test('should validate VideoTranscript instance', () => {
      const geminiModel = new ModelId('gemini-2.5-pro', 'Gemini');
      expect(() => {
        new ChapterGeneration('invalid', geminiModel);
      }).toThrow('videoTranscript must be a VideoTranscript instance');
    });

    test('should generate unique IDs', () => {
      const geminiModel = new ModelId('gemini-2.5-pro', 'Gemini');
      const generation1 = new ChapterGeneration(mockVideoTranscript, geminiModel);
      const generation2 = new ChapterGeneration(mockVideoTranscript, geminiModel);

      expect(generation1.id).not.toBe(generation2.id);
      expect(typeof generation1.id).toBe('number');
    });
  });

  describe('status management', () => {
    let generation;

    beforeEach(() => {
      const geminiModel = new ModelId('gemini-2.5-pro', 'Gemini');
      generation = new ChapterGeneration(mockVideoTranscript, geminiModel);
    });

    test('should start with pending status', () => {
      expect(generation.isPending()).toBe(true);
      expect(generation.isCompleted()).toBe(false);
      expect(generation.isFailed()).toBe(false);
    });

    test('should mark as completed successfully', () => {
      generation.markCompleted('1. Introduction\n2. Main Content');

      expect(generation.isCompleted()).toBe(true);
      expect(generation.isPending()).toBe(false);
      expect(generation.chapters).toBe('1. Introduction\n2. Main Content');
      expect(generation.error).toBe(null);
      expect(generation.completedAt).toBeInstanceOf(Date);
    });

    test('should mark as failed successfully', () => {
      generation.markFailed(new Error('API key invalid'));

      expect(generation.isFailed()).toBe(true);
      expect(generation.isPending()).toBe(false);
      expect(generation.error).toBe('API key invalid');
      expect(generation.chapters).toBe(null);
      expect(generation.completedAt).toBeInstanceOf(Date);
    });

    test('should not allow completion from non-pending state', () => {
      generation.markCompleted('Test chapters');

      expect(() => {
        generation.markCompleted('More chapters');
      }).toThrow('Cannot complete generation with status: completed');
    });

    test('should not allow completion with invalid chapters', () => {
      expect(() => {
        generation.markCompleted('');
      }).toThrow('Chapters must be a non-empty string');

      expect(() => {
        generation.markCompleted(null);
      }).toThrow('Chapters must be a non-empty string');
    });
  });

  describe('custom instructions', () => {
    test('should detect presence of custom instructions', () => {
      const geminiModel = new ModelId('gemini-2.5-pro', 'Gemini');
      const withInstructions = new ChapterGeneration(
        mockVideoTranscript,
        geminiModel,
        'Focus on technical details'
      );
      const withoutInstructions = new ChapterGeneration(
        mockVideoTranscript,
        geminiModel
      );

      expect(withInstructions.hasCustomInstructions()).toBe(true);
      expect(withoutInstructions.hasCustomInstructions()).toBe(false);
    });
  });

  describe('duration calculations', () => {
    test('should calculate duration correctly', () => {
      const geminiModel = new ModelId('gemini-2.5-pro', 'Gemini');
      const generation = new ChapterGeneration(mockVideoTranscript, geminiModel);

      const durationMs = generation.getDurationMs();
      const durationSeconds = generation.getDurationSeconds();

      expect(durationMs).toBeGreaterThanOrEqual(0);
      expect(durationSeconds).toBe(Math.floor(durationMs / 1000));
    });
  });

  describe('serialization', () => {
    test('should convert to session results format', () => {
      const geminiModel = new ModelId('gemini-2.5-pro', 'Gemini');
      const generation = new ChapterGeneration(
        mockVideoTranscript,
        geminiModel,
        'Custom instructions'
      );
      generation.markCompleted('1. Intro\n2. Content');

      const results = generation.toSessionResults();

      expect(results.resultId).toBe(generation.id);
      expect(results.chapters).toBe('1. Intro\n2. Content');
      expect(results.model).toEqual({
        value: 'gemini-2.5-pro',
        provider: 'Gemini',
        pricing: null
      });
      expect(results.customInstructions).toBe('Custom instructions');
      expect(results.status).toBe('completed');
    });

    test('should create from session results', () => {
      const sessionResults = {
        resultId: 123456789,
        processedContent: {
          content: 'Test content',
          language: 'en'
        },
        chapters: '1. Test Chapter',
        timestamp: Date.now() - 1000,
        model: 'gemini-2.5-pro',
        customInstructions: 'Test instructions',
        videoMetadata: {
          title: 'Test Video',
          author: 'Test Author',
          url: 'https://youtube.com/watch?v=testid'
        },
        status: 'completed'
      };

      const generation = ChapterGeneration.fromSessionResults(sessionResults);

      expect(generation.id).toBe(123456789);
      expect(generation.modelId.toString()).toBe('gemini-2.5-pro');
      expect(generation.customInstructions).toBe('Test instructions');
      expect(generation.isCompleted()).toBe(true);
      expect(generation.chapters).toBe('1. Test Chapter');
    });
  });
});
