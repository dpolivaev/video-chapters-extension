/**
 * BrowserTab Entity Tests
 * Tests browser tab representation and validation
 *
 * Copyright (C) 2025 Dimitry Polivaev
 * Licensed under GPL3 or later
 */

let BrowserTab;

function isNodeJsEnvironment() {
  return typeof require !== 'undefined' && typeof module !== 'undefined';
}

if (isNodeJsEnvironment()) {
  BrowserTab = require('./BrowserTab');
} else {
  throw new Error('BrowserTab tests require Node.js environment');
}

describe('BrowserTab', () => {
  const validId = 123;
  const validVideoUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
  const validShortsUrl = 'https://www.youtube.com/shorts/abc123';

  describe('constructor and validation', () => {
    test('should create tab with all parameters', () => {
      const tab = new BrowserTab(validId, validVideoUrl, 'video');

      expect(tab.id).toBe(validId);
      expect(tab.url.toString()).toBe(validVideoUrl);
      expect(tab.type).toBe('video');
      expect(tab.createdAt).toBeInstanceOf(Date);
    });

    test('should create tab with minimal parameters', () => {
      const tab = new BrowserTab(validId);

      expect(tab.id).toBe(validId);
      expect(tab.url).toBeNull();
      expect(tab.type).toBe('unknown');
    });

    test('should create tab with null URL', () => {
      const tab = new BrowserTab(validId, null, 'unknown');

      expect(tab.id).toBe(validId);
      expect(tab.url).toBeNull();
      expect(tab.type).toBe('unknown');
    });

    test('should reject invalid tab IDs', () => {
      expect(() => new BrowserTab(-1)).toThrow('Tab ID must be a non-negative integer');
      expect(() => new BrowserTab(1.5)).toThrow('Tab ID must be a non-negative integer');
      expect(() => new BrowserTab('123')).toThrow('Tab ID must be a non-negative integer');
      expect(() => new BrowserTab(null)).toThrow('Tab ID must be a non-negative integer');
      expect(() => new BrowserTab({})).toThrow('Tab ID must be a non-negative integer');
    });

    test('should accept zero as valid tab ID', () => {
      const tab = new BrowserTab(0);
      expect(tab.id).toBe(0);
    });

    test('should reject invalid tab types', () => {
      expect(() => new BrowserTab(validId, validVideoUrl, 'invalid')).toThrow('Tab type must be one of: video, results, unknown');
      expect(() => new BrowserTab(validId, validVideoUrl, '')).toThrow('Tab type must be one of: video, results, unknown');
      expect(() => new BrowserTab(validId, validVideoUrl, null)).toThrow('Tab type must be one of: video, results, unknown');
    });

    test('should accept all valid tab types', () => {
      const videoTab = new BrowserTab(validId, validVideoUrl, 'video');
      const resultsTab = new BrowserTab(validId, null, 'results'); // Results tab without URL
      const unknownTab = new BrowserTab(validId, null, 'unknown');

      expect(videoTab.type).toBe('video');
      expect(resultsTab.type).toBe('results');
      expect(unknownTab.type).toBe('unknown');
    });
  });

  describe('type detection methods', () => {
    test('should detect YouTube video tabs', () => {
      const videoTab = new BrowserTab(validId, validVideoUrl, 'video');
      const nonVideoTab = new BrowserTab(validId, validVideoUrl, 'unknown');

      expect(videoTab.isYouTubeVideo()).toBe(true);
      expect(nonVideoTab.isYouTubeVideo()).toBe(false);
    });

    test('should detect results page tabs', () => {
      const resultsTab = new BrowserTab(validId, null, 'results');
      const nonResultsTab = new BrowserTab(validId, validVideoUrl, 'video');

      expect(resultsTab.isResultsPage()).toBe(true);
      expect(nonResultsTab.isResultsPage()).toBe(false);
    });
  });

  describe('URL handling', () => {
    test('should detect presence of URL', () => {
      const withUrl = new BrowserTab(validId, validVideoUrl);
      const withoutUrl = new BrowserTab(validId);

      expect(withUrl.hasUrl()).toBe(true);
      expect(withoutUrl.hasUrl()).toBe(false);
    });

    test('should extract video ID from YouTube URLs', () => {
      const videoTab = new BrowserTab(validId, validVideoUrl, 'video');
      const shortsTab = new BrowserTab(validId, validShortsUrl, 'video');

      expect(videoTab.getVideoId()).toBe('dQw4w9WgXcQ');
      expect(shortsTab.getVideoId()).toBe('abc123');
    });

    test('should return null video ID when no URL', () => {
      const tab = new BrowserTab(validId);
      expect(tab.getVideoId()).toBeNull();
    });
  });

  describe('tab matching', () => {
    test('should match tab with same ID and URL', () => {
      const tab = new BrowserTab(validId, validVideoUrl, 'video');
      const tabInfo = { id: validId, url: validVideoUrl };

      expect(tab.matches(tabInfo)).toBe(true);
    });

    test('should match tab with same ID and no URL in tabInfo', () => {
      const tab = new BrowserTab(validId, validVideoUrl, 'video');
      const tabInfo = { id: validId };

      expect(tab.matches(tabInfo)).toBe(true);
    });

    test('should not match tab with different ID', () => {
      const tab = new BrowserTab(validId, validVideoUrl, 'video');
      const tabInfo = { id: 999, url: validVideoUrl };

      expect(tab.matches(tabInfo)).toBe(false);
    });

    test('should not match tab with different URL', () => {
      const tab = new BrowserTab(validId, validVideoUrl, 'video');
      const tabInfo = { id: validId, url: 'https://www.youtube.com/watch?v=different' };

      expect(tab.matches(tabInfo)).toBe(false);
    });

    test('should handle null URL in tab when matching', () => {
      const tab = new BrowserTab(validId, null, 'unknown');
      const tabInfo = { id: validId, url: validVideoUrl };

      expect(tab.matches(tabInfo)).toBe(false);
    });
  });

  describe('factory methods', () => {
    test('should create video tab', () => {
      const tab = BrowserTab.createVideoTab(validId, validVideoUrl);

      expect(tab.id).toBe(validId);
      expect(tab.url.toString()).toBe(validVideoUrl);
      expect(tab.type).toBe('video');
      expect(tab.isYouTubeVideo()).toBe(true);
    });

    test('should create results tab', () => {
      const tab = BrowserTab.createResultsTab(validId, null);

      expect(tab.id).toBe(validId);
      expect(tab.url).toBeNull();
      expect(tab.type).toBe('results');
      expect(tab.isResultsPage()).toBe(true);
    });

    test('should create from browser tab object with YouTube watch URL', () => {
      const browserTab = {
        id: validId,
        url: validVideoUrl
      };

      const tab = BrowserTab.fromBrowserTab(browserTab);

      expect(tab.id).toBe(validId);
      expect(tab.url.toString()).toBe(validVideoUrl);
      expect(tab.type).toBe('video');
    });

    test('should create from browser tab object with YouTube shorts URL', () => {
      const browserTab = {
        id: validId,
        url: validShortsUrl
      };

      const tab = BrowserTab.fromBrowserTab(browserTab);

      expect(tab.id).toBe(validId);
      expect(tab.type).toBe('video');
    });

    test('should create from browser tab object with results URL', () => {
      const browserTab = {
        id: validId,
        url: 'chrome-extension://abc/results/results.html'
      };

      const tab = BrowserTab.fromBrowserTab(browserTab);

      expect(tab.id).toBe(validId);
      expect(tab.type).toBe('results');
      expect(tab.url).toBeNull(); // Non-YouTube URLs don't create VideoUrl objects
    });

    test('should create unknown type from browser tab with other URL', () => {
      const browserTab = {
        id: validId,
        url: 'https://example.com'
      };

      const tab = BrowserTab.fromBrowserTab(browserTab);

      expect(tab.id).toBe(validId);
      expect(tab.type).toBe('unknown');
      expect(tab.url).toBeNull(); // Non-YouTube URLs don't create VideoUrl objects
    });

    test('should create unknown type from browser tab with no URL', () => {
      const browserTab = {
        id: validId
      };

      const tab = BrowserTab.fromBrowserTab(browserTab);

      expect(tab.id).toBe(validId);
      expect(tab.type).toBe('unknown');
      expect(tab.url).toBeNull();
    });
  });

  describe('string representation', () => {
    test('should convert to string with URL', () => {
      const tab = new BrowserTab(validId, validVideoUrl, 'video');
      const stringRep = tab.toString();

      expect(stringRep).toContain(`id=${validId}`);
      expect(stringRep).toContain('type=video');
      expect(stringRep).toContain(`url=${validVideoUrl}`);
    });

    test('should convert to string without URL', () => {
      const tab = new BrowserTab(validId, null, 'unknown');
      const stringRep = tab.toString();

      expect(stringRep).toContain(`id=${validId}`);
      expect(stringRep).toContain('type=unknown');
      expect(stringRep).toContain('url=null');
    });
  });

  describe('timestamp handling', () => {
    test('should set creation timestamp', () => {
      const before = new Date();
      const tab = new BrowserTab(validId, validVideoUrl, 'video');
      const after = new Date();

      expect(tab.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(tab.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('edge cases', () => {
    test('should handle very large tab IDs', () => {
      const largeId = 2147483647; // Max 32-bit integer
      const tab = new BrowserTab(largeId);
      expect(tab.id).toBe(largeId);
    });

    test('should handle URLs with special characters', () => {
      const specialUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1m30s&feature=share';
      const tab = new BrowserTab(validId, specialUrl, 'video');

      expect(tab.hasUrl()).toBe(true);
      expect(tab.url.toString()).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ'); // Cleaned URL
    });

    test('should handle tab matching with undefined properties', () => {
      const tab = new BrowserTab(validId, validVideoUrl, 'video');
      const tabInfo = { id: validId, url: undefined };

      expect(tab.matches(tabInfo)).toBe(true);
    });
  });
});
