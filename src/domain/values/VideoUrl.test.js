/**
 * VideoUrl Value Object Tests
 * Tests YouTube URL validation, cleaning, and video ID extraction
 *
 * Copyright (C) 2025 Dimitry Polivaev
 * Licensed under GPL3 or later
 */

const VideoUrl = require('./VideoUrl');

describe('VideoUrl', () => {
  describe('constructor and validation', () => {
    test('should create VideoUrl with valid YouTube watch URL', () => {
      const url = new VideoUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
      expect(url.value).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    });

    test('should create VideoUrl with valid YouTube shorts URL', () => {
      const url = new VideoUrl('https://www.youtube.com/shorts/abc123');
      expect(url.value).toBe('https://www.youtube.com/shorts/abc123');
    });

    test('should clean URL by removing extra parameters', () => {
      const dirtyUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLrAXtmRdnEQy6nuLMHjMjFNjSWQ6hClLy&index=1&t=30s';
      const url = new VideoUrl(dirtyUrl);
      expect(url.value).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    });

    test('should clean shorts URL by removing parameters', () => {
      const dirtyUrl = 'https://www.youtube.com/shorts/abc123?feature=share';
      const url = new VideoUrl(dirtyUrl);
      expect(url.value).toBe('https://www.youtube.com/shorts/abc123');
    });

    test('should reject null or undefined URLs', () => {
      expect(() => new VideoUrl(null)).toThrow('URL must be a non-empty string');
      expect(() => new VideoUrl(undefined)).toThrow('URL must be a non-empty string');
    });

    test('should reject non-string URLs', () => {
      expect(() => new VideoUrl(123)).toThrow('URL must be a non-empty string');
      expect(() => new VideoUrl({})).toThrow('URL must be a non-empty string');
      expect(() => new VideoUrl([])).toThrow('URL must be a non-empty string');
    });

    test('should reject empty string URLs', () => {
      expect(() => new VideoUrl('')).toThrow('URL must be a non-empty string');
      expect(() => new VideoUrl('   ')).toThrow('Invalid YouTube URL - must be a watch or shorts URL');
    });

    test('should reject non-YouTube URLs', () => {
      expect(() => new VideoUrl('https://vimeo.com/123456')).toThrow('Invalid YouTube URL - must be a watch or shorts URL');
      expect(() => new VideoUrl('https://example.com')).toThrow('Invalid YouTube URL - must be a watch or shorts URL');
    });

    test('should reject YouTube URLs that are not watch or shorts', () => {
      expect(() => new VideoUrl('https://www.youtube.com/channel/UC123')).toThrow('Invalid YouTube URL - must be a watch or shorts URL');
      expect(() => new VideoUrl('https://www.youtube.com/playlist?list=123')).toThrow('Invalid YouTube URL - must be a watch or shorts URL');
    });
  });

  describe('URL type detection', () => {
    test('should detect watch URLs correctly', () => {
      const url = new VideoUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
      expect(url.isWatchUrl()).toBe(true);
      expect(url.isShortsUrl()).toBe(false);
    });

    test('should detect shorts URLs correctly', () => {
      const url = new VideoUrl('https://www.youtube.com/shorts/abc123');
      expect(url.isWatchUrl()).toBe(false);
      expect(url.isShortsUrl()).toBe(true);
    });
  });

  describe('video ID extraction', () => {
    test('should extract video ID from watch URL', () => {
      const url = new VideoUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
      expect(url.getVideoId()).toBe('dQw4w9WgXcQ');
    });

    test('should extract video ID from shorts URL', () => {
      const url = new VideoUrl('https://www.youtube.com/shorts/abc123def');
      expect(url.getVideoId()).toBe('abc123def');
    });

    test('should return null for malformed URLs', () => {
      const url = new VideoUrl('https://www.youtube.com/watch?list=123');
      url.value = 'https://www.youtube.com/invalid';
      expect(url.getVideoId()).toBe(null);
    });
  });

  describe('string representation', () => {
    test('should convert to string correctly', () => {
      const urlString = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
      const url = new VideoUrl(urlString);
      expect(url.toString()).toBe(urlString);
      expect(String(url)).toBe(urlString);
    });
  });

  describe('immutability', () => {
    test('should be immutable after creation', () => {
      const url = new VideoUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
      expect(Object.isFrozen(url)).toBe(true);
      
      const originalValue = url.value;
      url.value = 'changed';
      expect(url.value).toBe(originalValue);
    });
  });

  describe('edge cases', () => {
    test('should handle URLs with no video ID parameter using fallback cleaning', () => {
      const url = new VideoUrl('https://www.youtube.com/watch');
      expect(url.value).toBe('https://www.youtube.com/watch');
      expect(url.getVideoId()).toBe(null);
    });

    test('should handle complex URL structures', () => {
      const complexUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1m30s&start_radio=1&list=RDdQw4w9WgXcQ';
      const url = new VideoUrl(complexUrl);
      expect(url.value).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
      expect(url.getVideoId()).toBe('dQw4w9WgXcQ');
    });

    test('should handle shorts URL with complex paths', () => {
      const shortsUrl = 'https://www.youtube.com/shorts/abc123?si=xyz&feature=share';
      const url = new VideoUrl(shortsUrl);
      expect(url.value).toBe('https://www.youtube.com/shorts/abc123');
      expect(url.getVideoId()).toBe('abc123');
    });
  });
});