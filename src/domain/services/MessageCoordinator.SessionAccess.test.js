/**
 * MessageCoordinator Session Access Tests
 * Tests for session data retrieval regression
 *
 * Copyright (C) 2025 Dimitry Polivaev
 * Licensed under GPL3 or later
 */

const MessageCoordinator = require('./MessageCoordinator');

describe('MessageCoordinator Session Access', () => {
  let messageCoordinator;
  let mockSessionRepository;

  beforeEach(() => {
    mockSessionRepository = {
      get: jest.fn()
    };

    messageCoordinator = new MessageCoordinator(
      null, // chapterGenerator not needed for this test
      mockSessionRepository,
      null, // settingsRepository not needed
      null  // instructionHistory not needed
    );
  });

  describe('handleGetSessionResults response format', () => {
    test('should return session data in session property, not results property', async () => {
      const mockSession = {
        toPlainObject: jest.fn().mockReturnValue({
          resultId: 'test123',
          videoMetadata: {
            title: 'Test Video',
            author: 'Test Author',
            url: 'https://www.youtube.com/watch?v=test123'
          },
          processedContent: {
            content: 'Test transcript content'
          },
          chapters: 'Test chapters',
          model: 'gemini-2.5-pro'
        })
      };

      mockSessionRepository.get.mockReturnValue(mockSession);

      const request = { sessionId: 'test123' };
      const result = await messageCoordinator.handleGetSessionResults(request);

      expect(result.success).toBe(true);
      expect(result.session).toBeDefined();
      expect(result.results).toBeUndefined(); // Should NOT have results property

      // Verify the session data structure
      expect(result.session.videoMetadata).toBeDefined();
      expect(result.session.videoMetadata.url).toBe('https://www.youtube.com/watch?v=test123');
      expect(result.session.processedContent).toBeDefined();
      expect(result.session.chapters).toBe('Test chapters');
    });

    test('should include all necessary video metadata for popup reconstruction', async () => {
      const mockSession = {
        toPlainObject: jest.fn().mockReturnValue({
          resultId: 'test456',
          videoMetadata: {
            title: 'Another Test Video',
            author: 'Another Author',
            url: 'https://www.youtube.com/watch?v=test456'
          },
          processedContent: {
            content: 'Another test transcript'
          }
        })
      };

      mockSessionRepository.get.mockReturnValue(mockSession);

      const result = await messageCoordinator.handleGetSessionResults({ sessionId: 'test456' });

      expect(result.success).toBe(true);
      expect(result.session.videoMetadata.title).toBe('Another Test Video');
      expect(result.session.videoMetadata.author).toBe('Another Author');
      expect(result.session.videoMetadata.url).toBe('https://www.youtube.com/watch?v=test456');
      expect(result.session.processedContent.content).toBe('Another test transcript');
    });

    test('should fail when session not found', async () => {
      mockSessionRepository.get.mockReturnValue(null);

      const request = { sessionId: 'nonexistent' };

      await expect(messageCoordinator.handleGetSessionResults(request))
        .rejects.toThrow('Session not found');
    });

    test('should fail when session ID not provided', async () => {
      const request = {};

      await expect(messageCoordinator.handleGetSessionResults(request))
        .rejects.toThrow('Session ID is required');
    });
  });

  describe('message routing integration', () => {
    test('should route getSessionResults action to handleGetSessionResults', async () => {
      const mockSession = {
        toPlainObject: jest.fn().mockReturnValue({
          resultId: 'routing-test',
          videoMetadata: { title: 'Routing Test' }
        })
      };

      mockSessionRepository.get.mockReturnValue(mockSession);

      const result = await messageCoordinator.processMessage('getSessionResults', { sessionId: 'routing-test' });

      expect(result.success).toBe(true);
      expect(result.session).toBeDefined();
      expect(result.session.videoMetadata.title).toBe('Routing Test');
    });
  });
});
