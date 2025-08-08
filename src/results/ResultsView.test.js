/**
 * ResultsView Tests
 * Tests clipboard functionality and textarea content detection
 *
 * Copyright (C) 2025 Dimitry Polivaev
 * Licensed under GPL3 or later
 */

/* global ResultsView */

// Mock DOM environment
global.navigator = {
  clipboard: {
    writeText: jest.fn().mockResolvedValue(),
    write: jest.fn().mockResolvedValue()
  }
};

global.window = {
  getSelection: jest.fn(() => ({
    rangeCount: 0,
    isCollapsed: true,
    removeAllRanges: jest.fn(),
    addRange: jest.fn(),
    toString: jest.fn(() => 'selected text')
  }))
};

global.document = {
  createElement: jest.fn((tag) => ({
    tagName: tag.toUpperCase(),
    appendChild: jest.fn(),
    innerHTML: 'mock html'
  })),
  createRange: jest.fn(() => ({
    selectNodeContents: jest.fn(),
    cloneContents: jest.fn(() => ({
      innerHTML: 'mock fragment'
    }))
  })),
  getElementById: jest.fn()
};

global.ClipboardItem = jest.fn();
global.Blob = jest.fn();

// Mock chrome.i18n
global.chrome = {
  i18n: {
    getMessage: jest.fn((key) => key)
  }
};

// Mock getLocalizedMessage function
global.getLocalizedMessage = jest.fn((key) => key);

// Load the ResultsView class
const fs = require('fs');
const path = require('path');
const resultsJs = fs.readFileSync(path.join(__dirname, 'results.js'), 'utf8');

// Extract just the ResultsView class for testing
const classMatch = resultsJs.match(/class ResultsView \{[\s\S]*?\n\}/);
const classCode = classMatch[0];

// Create a testable version
eval(`
${classCode}
global.ResultsView = ResultsView;
`);

describe('ResultsView clipboard functionality', () => {
  let resultsView;
  let mockTextarea;
  let mockDiv;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock elements
    mockTextarea = {
      tagName: 'TEXTAREA',
      value: 'Test textarea content',
      textContent: '', // textContent is empty for textarea
      innerHTML: '<textarea>Test textarea content</textarea>'
    };

    mockDiv = {
      tagName: 'DIV',
      textContent: 'Test div content',
      innerHTML: '<div>Test div content</div>'
    };

    // Mock document.getElementById
    document.getElementById.mockImplementation((id) => {
      if (id === 'subtitlesContent') {
        return mockTextarea;
      }
      if (id === 'chaptersHtml') {
        return mockDiv;
      }
      return null;
    });

    // Create ResultsView instance with minimal setup
    resultsView = new Object();
    resultsView.showNotification = jest.fn();

    // Bind the copyToClipboard method
    resultsView.copyToClipboard = ResultsView.prototype.copyToClipboard.bind(resultsView);
  });

  describe('textarea content detection', () => {
    test('should detect empty textarea correctly', async () => {
      mockTextarea.value = '';
      mockTextarea.textContent = '';

      await resultsView.copyToClipboard('subtitles');

      expect(resultsView.showNotification).toHaveBeenCalledWith('no_subtitles_to_copy', 'warning');
      expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
    });

    test('should detect non-empty textarea correctly', async () => {
      mockTextarea.value = 'Test content';
      mockTextarea.textContent = ''; // Important: textContent is empty for textarea

      await resultsView.copyToClipboard('subtitles');

      expect(resultsView.showNotification).not.toHaveBeenCalledWith('no_subtitles_to_copy', 'warning');
    });

    test('should detect whitespace-only textarea correctly', async () => {
      mockTextarea.value = '   \n\t   ';
      mockTextarea.textContent = '';

      await resultsView.copyToClipboard('subtitles');

      expect(resultsView.showNotification).toHaveBeenCalledWith('no_subtitles_to_copy', 'warning');
      expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
    });
  });

  describe('div content detection', () => {
    test('should detect empty div correctly', async () => {
      mockDiv.textContent = '';

      await resultsView.copyToClipboard('chapters');

      expect(resultsView.showNotification).toHaveBeenCalledWith('no_chapters_to_copy', 'warning');
    });

    test('should detect non-empty div correctly', async () => {
      mockDiv.textContent = 'Test content';

      await resultsView.copyToClipboard('chapters');

      expect(resultsView.showNotification).not.toHaveBeenCalledWith('no_chapters_to_copy', 'warning');
    });
  });

  describe('clipboard copying behavior', () => {
    test('should copy textarea content using writeText', async () => {
      mockTextarea.value = 'Test textarea content';

      await resultsView.copyToClipboard('subtitles');

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Test textarea content');
      expect(resultsView.showNotification).toHaveBeenCalledWith('subtitles_copied', 'success');
    });

    test('should copy div content using clipboard API', async () => {
      mockDiv.textContent = 'Test div content';

      await resultsView.copyToClipboard('chapters');

      expect(navigator.clipboard.write).toHaveBeenCalled();
      expect(resultsView.showNotification).toHaveBeenCalledWith('chapters_copied', 'success');
    });
  });
});
