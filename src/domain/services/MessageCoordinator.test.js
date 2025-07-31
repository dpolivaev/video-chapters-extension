/**
 * MessageCoordinator Service Tests
 * Tests message coordination class with dependency injection
 *
 * Copyright (C) 2025 Dimitry Polivaev
 * Licensed under GPL3 or later
 */

const MessageCoordinator = require('./MessageCoordinator');

describe('MessageCoordinator', () => {
  let messageCoordinator;
  let mockChapterGenerator;
  let mockSessionRepository;
  let mockSettingsRepository;
  let mockInstructionHistory;

  beforeEach(() => {
    mockChapterGenerator = {
      generateChapters: jest.fn(),
      geminiAPI: {
        getAvailableModels: jest.fn()
      },
      openRouterAPI: {
        getAvailableModels: jest.fn()
      }
    };


    mockSessionRepository = {
      save: jest.fn(),
      get: jest.fn()
    };

    mockSettingsRepository = {
      save: jest.fn(),
      load: jest.fn()
    };

    mockInstructionHistory = {
      save: jest.fn(),
      getAll: jest.fn(),
      delete: jest.fn()
    };

    messageCoordinator = new MessageCoordinator(
      mockChapterGenerator,
      mockSessionRepository,
      mockSettingsRepository,
      mockInstructionHistory
    );
  });

  describe('constructor and configuration', () => {
    test('should store injected dependencies', () => {
      expect(messageCoordinator.chapterGenerator).toBe(mockChapterGenerator);
      expect(messageCoordinator.sessionRepository).toBe(mockSessionRepository);
      expect(messageCoordinator.settingsRepository).toBe(mockSettingsRepository);
      expect(messageCoordinator.instructionHistory).toBe(mockInstructionHistory);
    });
  });

  describe('chapter generation', () => {
    test('should handle chapter generation successfully', async () => {
      const request = {
        videoId: 'test123',
        subtitles: 'Test subtitle content',
        customInstructions: 'Generate chapters',
        apiKey: 'test-api-key',
        model: 'gemini-2.5-pro'
      };

      // Create a completed chapter generation to return
      const completedGeneration = {
        id: 'gen123',
        chapters: '1. Chapter One\n2. Chapter Two',
        isCompleted: () => true
      };

      mockChapterGenerator.generateChapters.mockResolvedValue(completedGeneration);

      const result = await messageCoordinator.handleChapterGeneration(request);

      expect(result.success).toBe(true);
      expect(result.videoId).toBe('test123');
      expect(result.chapters).toBe('1. Chapter One\n2. Chapter Two');
      expect(mockSessionRepository.save).toHaveBeenCalled();
    });

    test('should require video ID', async () => {
      const request = {
        subtitles: 'Test content',
        customInstructions: 'Generate chapters',
        apiKey: 'test-key',
        model: 'gemini-2.5-pro'
      };

      await expect(messageCoordinator.handleChapterGeneration(request))
        .rejects.toThrow('Video ID is required');
    });

    test('should require subtitles', async () => {
      const request = {
        videoId: 'test123',
        customInstructions: 'Generate chapters',
        apiKey: 'test-key',
        model: 'gemini-2.5-pro'
      };

      await expect(messageCoordinator.handleChapterGeneration(request))
        .rejects.toThrow('No subtitles found for this video');
    });

    test('should handle empty subtitles array', async () => {
      const request = {
        videoId: 'test123',
        subtitles: [],
        customInstructions: 'Generate chapters',
        apiKey: 'test-key',
        model: 'gemini-2.5-pro'
      };

      await expect(messageCoordinator.handleChapterGeneration(request))
        .rejects.toThrow('No subtitles found for this video');
    });
  });

  describe('instruction management', () => {
    test('should save instruction successfully', async () => {
      const request = { instruction: '  Focus on technical content  ' };

      const result = await messageCoordinator.handleSaveInstruction(request);

      expect(result.success).toBe(true);
      expect(mockInstructionHistory.save).toHaveBeenCalledWith('Focus on technical content');
    });

    test('should reject empty instruction', async () => {
      const request = { instruction: '   ' };

      await expect(messageCoordinator.handleSaveInstruction(request))
        .rejects.toThrow('Instruction cannot be empty');
    });

    test('should reject null instruction', async () => {
      const request = { instruction: null };

      await expect(messageCoordinator.handleSaveInstruction(request))
        .rejects.toThrow('Instruction cannot be empty');
    });

    test('should get instruction history', async () => {
      const mockInstructions = [
        'Focus on technical content',
        'Include timestamps',
        'Summarize main points'
      ];

      mockInstructionHistory.getAll.mockReturnValue(mockInstructions);

      const result = await messageCoordinator.handleGetInstructionHistory();

      expect(result.success).toBe(true);
      expect(result.instructions).toEqual(mockInstructions);
    });

    test('should delete instruction by index', async () => {
      mockInstructionHistory.delete.mockReturnValue(true);

      const request = { index: 1 };
      const result = await messageCoordinator.handleDeleteInstruction(request);

      expect(result.success).toBe(true);
      expect(mockInstructionHistory.delete).toHaveBeenCalledWith(1);
    });

    test('should handle instruction not found', async () => {
      mockInstructionHistory.delete.mockReturnValue(false);

      const request = { index: 99 };

      await expect(messageCoordinator.handleDeleteInstruction(request))
        .rejects.toThrow('Instruction not found');
    });

    test('should reject invalid instruction index', async () => {
      const request = { index: -1 };
      await expect(messageCoordinator.handleDeleteInstruction(request))
        .rejects.toThrow('Invalid instruction index');

      const request2 = { index: 'string' };
      await expect(messageCoordinator.handleDeleteInstruction(request2))
        .rejects.toThrow('Invalid instruction index');

      const request3 = { index: null };
      await expect(messageCoordinator.handleDeleteInstruction(request3))
        .rejects.toThrow('Invalid instruction index');
    });
  });

  describe('settings management', () => {
    test('should save settings successfully', async () => {
      const request = {
        settings: {
          defaultModel: 'gemini-2.5-pro',
          apiKeys: { gemini: 'test-key' }
        }
      };

      const result = await messageCoordinator.handleSaveSettings(request);

      expect(result.success).toBe(true);
      expect(mockSettingsRepository.save).toHaveBeenCalledWith(request.settings);
    });

    test('should reject invalid settings', async () => {
      const invalidSettings = [null, undefined, 'string', 123];

      for (const settings of invalidSettings) {
        const request = { settings };
        await expect(messageCoordinator.handleSaveSettings(request))
          .rejects.toThrow('Invalid settings object');
      }
    });

    test('should load settings successfully', async () => {
      const mockSettings = {
        defaultModel: 'gemini-2.5-pro',
        apiKeys: { gemini: 'saved-key' }
      };

      mockSettingsRepository.load.mockResolvedValue(mockSettings);

      const result = await messageCoordinator.handleLoadSettings();

      expect(result.success).toBe(true);
      expect(result.settings).toEqual(mockSettings);
    });
  });

  describe('model management', () => {
    test('should get all available models', async () => {
      const geminiModels = [
        { id: 'gemini-2.5-pro', displayName: 'Gemini 2.5 Pro' }
      ];

      const openRouterModels = [
        { id: 'deepseek/deepseek-r1-0528', displayName: 'DeepSeek R1' }
      ];

      mockChapterGenerator.geminiAPI.getAvailableModels.mockReturnValue(geminiModels);
      mockChapterGenerator.openRouterAPI.getAvailableModels.mockReturnValue(openRouterModels);

      const result = await messageCoordinator.handleGetAllModels();

      expect(result.success).toBe(true);
      expect(result.models.gemini).toEqual(geminiModels);
      expect(result.models.openrouter).toEqual(openRouterModels);
    });
  });

  describe('session management', () => {
    test('should set session results', async () => {
      const request = {
        resultId: 'result123',
        results: {
          chapters: '1. Test Chapter',
          model: 'gemini-2.5-pro'
        }
      };

      // Mock the static method that doesn't exist yet
      const mockFromSessionResults = jest.fn().mockReturnValue({
        id: 'session123',
        chapters: '1. Test Chapter'
      });

      // Temporarily mock the method
      const ChapterGeneration = require('../entities/ChapterGeneration');
      ChapterGeneration.fromSessionResults = mockFromSessionResults;

      const result = await messageCoordinator.handleSetSessionResults(request);

      expect(result.success).toBe(true);
      expect(mockSessionRepository.save).toHaveBeenCalled();
    });

    test('should require result ID and results', async () => {
      await expect(messageCoordinator.handleSetSessionResults({}))
        .rejects.toThrow('Result ID and results are required');

      await expect(messageCoordinator.handleSetSessionResults({ resultId: 'test' }))
        .rejects.toThrow('Result ID and results are required');
    });

    test('should get session results', async () => {
      const mockSession = {
        id: 'session123',
        chapters: 'test chapters',
        toPlainObject: jest.fn().mockReturnValue({
          id: 'session123',
          chapters: 'test chapters',
          model: 'gemini-2.5-pro'
        })
      };

      mockSessionRepository.get.mockReturnValue(mockSession);

      const request = { sessionId: 'session123' };
      const result = await messageCoordinator.handleGetSessionResults(request);

      expect(result.success).toBe(true);
      expect(result.session).toBeDefined();
      expect(mockSessionRepository.get).toHaveBeenCalledWith('session123');
    });

    test('should handle session not found', async () => {
      mockSessionRepository.get.mockReturnValue(null);

      const request = { sessionId: 'nonexistent' };

      await expect(messageCoordinator.handleGetSessionResults(request))
        .rejects.toThrow('Session not found');
    });

    test('should require session ID', async () => {
      await expect(messageCoordinator.handleGetSessionResults({}))
        .rejects.toThrow('Session ID is required');
    });
  });

  describe('tab registration', () => {
    test('should register tab successfully', async () => {
      const request = {
        tabId: 123,
        videoId: 'abc123',
        action: 'process'
      };

      const result = await messageCoordinator.handleTabRegistration(request);

      expect(result.success).toBe(true);
      expect(result.tab).toBeDefined();
      expect(result.tab.id).toBe(123);
      expect(result.tab.type).toBe('video');
      expect(result.tab.videoId).toBe('abc123');
      expect(result.tab.url).toBe('https://www.youtube.com/watch?v=abc123');
    });

    test('should require tab ID and video ID', async () => {
      await expect(messageCoordinator.handleTabRegistration({}))
        .rejects.toThrow('Tab ID and Video ID are required');

      await expect(messageCoordinator.handleTabRegistration({ tabId: 123 }))
        .rejects.toThrow('Tab ID and Video ID are required');

      await expect(messageCoordinator.handleTabRegistration({ videoId: 'test' }))
        .rejects.toThrow('Tab ID and Video ID are required');
    });
  });

  describe('message processing coordination', () => {
    test('should route generateChapters action', async () => {
      const request = {
        videoId: 'test123',
        subtitles: 'Test content',
        customInstructions: 'Generate chapters',
        apiKey: 'test-key',
        model: 'gemini-2.5-pro'
      };

      const mockResult = {
        id: 'gen123',
        chapters: 'Test chapters'
      };

      mockChapterGenerator.generateChapters.mockResolvedValue(mockResult);

      const result = await messageCoordinator.processMessage('generateChapters', request);

      expect(result.success).toBe(true);
      expect(result.chapters).toBe('Test chapters');
    });

    test('AI should receive same formatted content as subtitle tab displays', async () => {
      const rawSubtitles = '(0:00) Я только что прошла невероятную игру\n(0:02) Берлога.\n(0:02) Пришёл и поиграл немного в видеоигры';
      const videoTitle = 'Как российских школьников вовлекли в разработку военных дронов под видом кружков';
      const videoAuthor = 'Test Author';

      const request = {
        videoId: 'test123',
        subtitles: rawSubtitles,
        videoTitle,
        videoAuthor,
        customInstructions: '',
        apiKey: 'test-key',
        model: 'gemini-2.5-pro'
      };

      let capturedChapterGeneration = null;
      mockChapterGenerator.generateChapters.mockImplementation((chapterGeneration) => {
        capturedChapterGeneration = chapterGeneration;
        return Promise.resolve({ id: 'test', chapters: 'test chapters' });
      });

      await messageCoordinator.processMessage('generateChapters', request);

      const VideoTranscript = require('../entities/VideoTranscript');
      const expectedVideoTranscript = new VideoTranscript(rawSubtitles, videoTitle, videoAuthor, 'https://www.youtube.com/watch?v=test123');
      const expectedProcessedContent = expectedVideoTranscript.toProcessedContent();
      const aiReceivedContent = capturedChapterGeneration.videoTranscript.toProcessedContent();

      expect(aiReceivedContent).toBe(expectedProcessedContent);
      expect(aiReceivedContent).toContain(`Title: ${videoTitle}`);
      expect(aiReceivedContent).toContain('\n\nTranscript Content:\n');
    });

    test('should route saveInstruction action', async () => {
      const request = { instruction: 'Test instruction' };

      const result = await messageCoordinator.processMessage('saveInstruction', request);

      expect(result.success).toBe(true);
      expect(mockInstructionHistory.save).toHaveBeenCalledWith('Test instruction');
    });

    test('should route getInstructionHistory action', async () => {
      mockInstructionHistory.getAll.mockReturnValue(['instruction1', 'instruction2']);

      const result = await messageCoordinator.processMessage('getInstructionHistory', {});

      expect(result.success).toBe(true);
      expect(result.instructions).toHaveLength(2);
    });

    test('should route deleteInstruction action', async () => {
      mockInstructionHistory.delete.mockReturnValue(true);

      const result = await messageCoordinator.processMessage('deleteInstruction', { index: 0 });

      expect(result.success).toBe(true);
    });

    test('should route saveSettings action', async () => {
      const request = { settings: { test: 'value' } };

      const result = await messageCoordinator.processMessage('saveSettings', request);

      expect(result.success).toBe(true);
    });

    test('should route loadSettings action', async () => {
      mockSettingsRepository.load.mockResolvedValue({ test: 'value' });

      const result = await messageCoordinator.processMessage('loadSettings', {});

      expect(result.success).toBe(true);
      expect(result.settings).toEqual({ test: 'value' });
    });

    test('should route getAllModels action', async () => {
      mockChapterGenerator.geminiAPI.getAvailableModels.mockReturnValue([]);
      mockChapterGenerator.openRouterAPI.getAvailableModels.mockReturnValue([]);

      const result = await messageCoordinator.processMessage('getAllModels', {});

      expect(result.success).toBe(true);
      expect(result.models).toBeDefined();
    });

    test('should route registerTab action', async () => {
      const request = { tabId: 123, videoId: 'abc123' };

      const result = await messageCoordinator.processMessage('registerTab', request);

      expect(result.success).toBe(true);
      expect(result.tab).toBeDefined();
      expect(result.tab.id).toBe(123);
      expect(result.tab.videoId).toBe('abc123');
    });

    test('should handle unknown actions', async () => {
      const result = await messageCoordinator.processMessage('unknownAction', {});

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown action: unknownAction');
    });

    test('should handle errors gracefully', async () => {
      mockChapterGenerator.generateChapters.mockRejectedValue(new Error('API error'));

      const request = {
        videoId: 'test123',
        subtitles: 'Test content',
        customInstructions: 'Generate chapters',
        apiKey: 'test-key',
        model: 'gemini-2.5-pro'
      };

      const result = await messageCoordinator.processMessage('generateChapters', request);

      expect(result.success).toBe(false);
      expect(result.error).toBe('API error');
    });
  });

  describe('session ID generation', () => {
    test('should generate unique session IDs', () => {
      const id1 = messageCoordinator.generateSessionId();
      const id2 = messageCoordinator.generateSessionId();

      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^session_\d+_[a-z0-9]+$/);
      expect(id2).toMatch(/^session_\d+_[a-z0-9]+$/);
    });

    test('should include timestamp in session ID', () => {
      const beforeTime = Date.now();
      const sessionId = messageCoordinator.generateSessionId();
      const afterTime = Date.now();

      const timestamp = parseInt(sessionId.split('_')[1]);
      expect(timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(timestamp).toBeLessThanOrEqual(afterTime);
    });
  });

  describe('edge cases', () => {
    test('should handle async errors in settings operations', async () => {
      mockSettingsRepository.load.mockRejectedValue(new Error('Storage error'));

      const result = await messageCoordinator.processMessage('loadSettings', {});

      expect(result.success).toBe(false);
      expect(result.error).toBe('Storage error');
    });

    test('should handle instruction history errors', async () => {
      mockInstructionHistory.getAll.mockImplementation(() => {
        throw new Error('History access error');
      });

      const result = await messageCoordinator.processMessage('getInstructionHistory', {});

      expect(result.success).toBe(false);
      expect(result.error).toBe('History access error');
    });

    test('should handle malformed requests gracefully', async () => {
      const result = await messageCoordinator.processMessage('saveInstruction', {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('Instruction cannot be empty');
    });
  });
});
