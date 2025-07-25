/**
 * TranscriptExtractor Service Tests
 * Tests transcript extraction business logic with dependency injection
 *
 * Copyright (C) 2025 Dimitry Polivaev
 * Licensed under GPL3 or later
 */

const TranscriptExtractor = require('./TranscriptExtractor');
const VideoTranscript = require('../entities/VideoTranscript');

describe('TranscriptExtractor', () => {
  let transcriptExtractor;
  let mockBrowserAPI;

  beforeEach(() => {
    mockBrowserAPI = {
      tabs: {
        sendMessage: jest.fn(),
        get: jest.fn(),
        query: jest.fn()
      }
    };

    transcriptExtractor = new TranscriptExtractor(mockBrowserAPI);
  });

  describe('constructor and configuration', () => {
    test('should store injected browser API', () => {
      expect(transcriptExtractor.browser).toBe(mockBrowserAPI);
    });

    test('should use default browser API when none provided', () => {
      global.browser = { tabs: {} };
      const defaultExtractor = new TranscriptExtractor();
      expect(defaultExtractor.browser).toBe(global.browser);
      delete global.browser;
    });
  });

  describe('tab ID validation', () => {
    test('should reject invalid tab IDs', async () => {
      const invalidTabIds = [
        null,
        undefined,
        '',
        'string',
        -1,
        1.5,
        NaN,
        Infinity,
        {},
        []
      ];

      for (const tabId of invalidTabIds) {
        await expect(transcriptExtractor.extractFromTab(tabId))
          .rejects.toThrow('Invalid tab ID');
      }
    });

    test('should accept valid tab IDs', async () => {
      const validTabIds = [0, 1, 42, 999];

      mockBrowserAPI.tabs.sendMessage.mockResolvedValue({
        status: 'success',
        transcript: 'Test transcript',
        title: 'Test Video',
        author: 'Test Author',
        url: 'https://youtube.com/watch?v=test'
      });

      for (const tabId of validTabIds) {
        await expect(transcriptExtractor.extractFromTab(tabId))
          .resolves.toBeInstanceOf(VideoTranscript);
      }
    });
  });

  describe('YouTube page detection', () => {
    test('should identify YouTube watch pages', () => {
      const youtubeUrls = [
        'https://youtube.com/watch?v=dQw4w9WgXcQ',
        'https://www.youtube.com/watch?v=test123',
        'http://youtube.com/watch?v=abc&t=30s',
        'https://m.youtube.com/watch?v=mobile'
      ];

      youtubeUrls.forEach(url => {
        expect(transcriptExtractor.isYouTubePage(url)).toBe(true);
      });
    });

    test('should identify YouTube shorts pages', () => {
      const shortsUrls = [
        'https://youtube.com/shorts/abcd1234',
        'https://www.youtube.com/shorts/xyz789',
        'http://youtube.com/shorts/test'
      ];

      shortsUrls.forEach(url => {
        expect(transcriptExtractor.isYouTubePage(url)).toBe(true);
      });
    });

    test('should reject non-YouTube URLs', () => {
      const nonYouTubeUrls = [
        null,
        undefined,
        '',
        'https://google.com',
        'https://vimeo.com/video',
        'https://youtube.com/channel/test',
        'https://youtube.com/playlist?list=test',
        'https://youtube.com',
        'https://twitch.tv/video'
      ];

      nonYouTubeUrls.forEach(url => {
        expect(transcriptExtractor.isYouTubePage(url)).toBe(false);
      });
    });
  });

  describe('transcript extraction from tab', () => {
    test('should extract transcript successfully', async () => {
      const mockResponse = {
        status: 'success',
        transcript: 'This is a test transcript',
        title: 'Test Video Title',
        author: 'Test Channel',
        url: 'https://youtube.com/watch?v=test123',
        language: 'en',
        trackName: 'English',
        isAutoGenerated: false
      };

      mockBrowserAPI.tabs.sendMessage.mockResolvedValue(mockResponse);

      const result = await transcriptExtractor.extractFromTab(123);

      expect(result).toBeInstanceOf(VideoTranscript);
      expect(result.content).toBe('This is a test transcript');
      expect(result.title).toBe('Test Video Title');
      expect(result.author).toBe('Test Channel');
    });

    test('should handle missing optional fields with defaults', async () => {
      const mockResponse = {
        status: 'success',
        transcript: 'Test transcript',
        url: 'https://youtube.com/watch?v=test'
      };

      mockBrowserAPI.tabs.sendMessage.mockResolvedValue(mockResponse);

      const result = await transcriptExtractor.extractFromTab(123);

      expect(result.title).toBe('Unknown Title');
      expect(result.author).toBe('Unknown Author');
      expect(result.isAutoGenerated).toBe(false);
    });

    test('should handle extraction failure response', async () => {
      const mockResponse = {
        status: 'error',
        message: 'No transcript available'
      };

      mockBrowserAPI.tabs.sendMessage.mockResolvedValue(mockResponse);

      await expect(transcriptExtractor.extractFromTab(123))
        .rejects.toThrow('No transcript available');
    });

    test('should handle response without transcript', async () => {
      const mockResponse = {
        status: 'success'
      };

      mockBrowserAPI.tabs.sendMessage.mockResolvedValue(mockResponse);

      await expect(transcriptExtractor.extractFromTab(123))
        .rejects.toThrow('Failed to extract transcript from tab');
    });

    test('should handle connection errors with user-friendly message', async () => {
      const connectionError = new Error('Could not establish connection: Receiving end does not exist');
      mockBrowserAPI.tabs.sendMessage.mockRejectedValue(connectionError);

      await expect(transcriptExtractor.extractFromTab(123))
        .rejects.toThrow('Unable to access YouTube page. Please refresh the page and try again.');
    });

    test('should handle extension context invalidation', async () => {
      const contextError = new Error('Extension context invalidated');
      mockBrowserAPI.tabs.sendMessage.mockRejectedValue(contextError);

      await expect(transcriptExtractor.extractFromTab(123))
        .rejects.toThrow('Extension was reloaded. Please refresh the page and try again.');
    });

    test('should handle generic errors', async () => {
      const genericError = new Error('Network timeout');
      mockBrowserAPI.tabs.sendMessage.mockRejectedValue(genericError);

      await expect(transcriptExtractor.extractFromTab(123))
        .rejects.toThrow('Transcript extraction failed: Network timeout');
    });
  });

  describe('tab capability checking', () => {
    test('should return true for YouTube tabs', async () => {
      mockBrowserAPI.tabs.get.mockResolvedValue({
        url: 'https://youtube.com/watch?v=test123'
      });

      const canExtract = await transcriptExtractor.canExtractFromTab(123);
      expect(canExtract).toBe(true);
    });

    test('should return false for non-YouTube tabs', async () => {
      mockBrowserAPI.tabs.get.mockResolvedValue({
        url: 'https://google.com'
      });

      const canExtract = await transcriptExtractor.canExtractFromTab(123);
      expect(canExtract).toBe(false);
    });

    test('should return false when tab access fails', async () => {
      mockBrowserAPI.tabs.get.mockRejectedValue(new Error('Tab not found'));

      const canExtract = await transcriptExtractor.canExtractFromTab(123);
      expect(canExtract).toBe(false);
    });

    test('should handle tab with no URL', async () => {
      mockBrowserAPI.tabs.get.mockResolvedValue({});

      const canExtract = await transcriptExtractor.canExtractFromTab(123);
      expect(canExtract).toBe(false);
    });
  });

  describe('current tab extraction', () => {
    test('should extract from current active tab successfully', async () => {
      const mockTab = {
        id: 456,
        url: 'https://youtube.com/watch?v=current'
      };

      const mockResponse = {
        status: 'success',
        transcript: 'Current tab transcript',
        title: 'Current Video',
        author: 'Current Author',
        url: mockTab.url
      };

      mockBrowserAPI.tabs.query.mockResolvedValue([mockTab]);
      mockBrowserAPI.tabs.sendMessage.mockResolvedValue(mockResponse);

      const result = await transcriptExtractor.extractFromCurrentTab();

      expect(mockBrowserAPI.tabs.query).toHaveBeenCalledWith({
        active: true,
        currentWindow: true
      });
      expect(mockBrowserAPI.tabs.sendMessage).toHaveBeenCalledWith(456, {
        action: 'copyTranscript'
      });
      expect(result).toBeInstanceOf(VideoTranscript);
    });

    test('should fail when no active tab found', async () => {
      mockBrowserAPI.tabs.query.mockResolvedValue([]);

      await expect(transcriptExtractor.extractFromCurrentTab())
        .rejects.toThrow('Failed to extract from current tab: No active tab found');
    });

    test('should fail when current tab is not YouTube', async () => {
      const mockTab = {
        id: 456,
        url: 'https://google.com'
      };

      mockBrowserAPI.tabs.query.mockResolvedValue([mockTab]);

      await expect(transcriptExtractor.extractFromCurrentTab())
        .rejects.toThrow('Failed to extract from current tab: Current tab is not a YouTube video page');
    });

    test('should handle tab query errors', async () => {
      mockBrowserAPI.tabs.query.mockRejectedValue(new Error('Permission denied'));

      await expect(transcriptExtractor.extractFromCurrentTab())
        .rejects.toThrow('Failed to extract from current tab: Permission denied');
    });

    test('should handle extraction errors from current tab', async () => {
      const mockTab = {
        id: 456,
        url: 'https://youtube.com/watch?v=current'
      };

      mockBrowserAPI.tabs.query.mockResolvedValue([mockTab]);
      mockBrowserAPI.tabs.sendMessage.mockRejectedValue(new Error('Content script not ready'));

      await expect(transcriptExtractor.extractFromCurrentTab())
        .rejects.toThrow('Transcript extraction failed: Content script not ready');
    });
  });

  describe('edge cases', () => {
    test('should handle null tab ID gracefully', async () => {
      await expect(transcriptExtractor.extractFromTab(null))
        .rejects.toThrow('Invalid tab ID');
    });

    test('should handle undefined response from sendMessage', async () => {
      mockBrowserAPI.tabs.sendMessage.mockResolvedValue(undefined);

      await expect(transcriptExtractor.extractFromTab(123))
        .rejects.toThrow('Failed to extract transcript from tab');
    });

    test('should handle empty response from sendMessage', async () => {
      mockBrowserAPI.tabs.sendMessage.mockResolvedValue({});

      await expect(transcriptExtractor.extractFromTab(123))
        .rejects.toThrow('Failed to extract transcript from tab');
    });

    test('should handle response with empty transcript', async () => {
      const mockResponse = {
        status: 'success',
        transcript: '',
        title: 'Empty Video',
        url: 'https://youtube.com/watch?v=empty'
      };

      mockBrowserAPI.tabs.sendMessage.mockResolvedValue(mockResponse);

      await expect(transcriptExtractor.extractFromTab(123))
        .rejects.toThrow('Failed to extract transcript from tab');
    });
  });
});
