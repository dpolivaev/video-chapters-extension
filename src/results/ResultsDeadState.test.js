/**
 * Results Dead-State Tests
 * Verifies results page behavior when session is missing (e.g., worker restart or history-opened tab)
 */


// Basic localized message helper
global.getLocalizedMessage = (key) => key;

// Minimal DOM stubs used by ResultsView
const makeClassList = () => ({ add: jest.fn(), remove: jest.fn(), toggle: jest.fn() });

let elements;

beforeEach(() => {
  elements = {
    progressSection: { style: { display: 'none' } },
    progressFill: { style: { width: '0%' } },
    progressMessage: { textContent: '' },
    statusText: { textContent: '' },
    pageTitle: { textContent: '' },
    chatSection: { style: { display: 'none' } },
    sendChatBtn: { disabled: false },
    chatInput: { value: '', addEventListener: jest.fn() },
    copyChaptersBtn: { disabled: false, addEventListener: jest.fn() },
    copySubtitlesBtn: { disabled: false, addEventListener: jest.fn() },
    subtitlesContent: { tagName: 'TEXTAREA', value: '', textContent: '' },
    chaptersHtml: { tagName: 'DIV', textContent: '' },
    notificationContainer: { appendChild: jest.fn() },
    videoTitle: { textContent: '' },
    videoAuthor: { textContent: '' },
    generationTime: { textContent: '' },
    chatMessages: { classList: makeClassList(), innerHTML: '', scrollTop: 0, scrollHeight: 0 }
  };

  global.document = {
    getElementById: jest.fn((id) => elements[id] || null),
    querySelectorAll: jest.fn(() => []),
    createElement: jest.fn((tag) => ({ tagName: tag.toUpperCase(), className: '', style: {}, appendChild: jest.fn(), textContent: '' }))
  };

  global.window = { getSelection: jest.fn(() => ({ rangeCount: 0, isCollapsed: true, removeAllRanges: jest.fn(), addRange: jest.fn(), toString: jest.fn(() => '') })) };

  // Mock browser APIs
  global.browser = {
    runtime: {
      sendMessage: jest.fn(async (payload) => {
        if (payload.action === 'getGenerationStatus') {
          return { success: true, status: 'not_found' };
        }
        if (payload.action === 'getSessionResults') {
          return { success: false };
        }
        // Any other actions should not be called in dead-state
        return { success: false };
      })
    },
    tabs: { create: jest.fn(), getCurrent: jest.fn() }
  };

  // Minimal chrome.i18n stub
  global.chrome = { i18n: { getMessage: jest.fn((k) => k) } };

  // Clipboard stubs
  global.navigator = { clipboard: { writeText: jest.fn(), write: jest.fn() } };
  global.ClipboardItem = jest.fn();
  global.Blob = jest.fn();
});

// Load and extract ResultsView class from results.js (without executing module side-effects)
const fs = require('fs');
const path = require('path');
const resultsJs = fs.readFileSync(path.join(__dirname, 'results.js'), 'utf8');
const classMatch = resultsJs.match(/class ResultsView \{[\s\S]*?\n\}/);
const classCode = classMatch[0];
eval(`${classCode}\nglobal.ResultsView = ResultsView;`);

describe('ResultsView dead-state when session missing', () => {
  test('initializes into dead state without throwing or polling', async () => {
    new global.ResultsView('123');

    // Let async init settle
    await new Promise((r) => setTimeout(r, 0));

    expect(elements.progressSection.style.display).toBe('none');

    expect(elements.chatSection.style.display).toBe('none');
    expect(elements.sendChatBtn.disabled).toBe(true);

    expect(elements.pageTitle.textContent).toMatch(/results/i);
    expect(elements.statusText.textContent.toLowerCase()).toContain('no_session_available'.toLowerCase());
  });

  test('sendChatMessage is a no-op in dead-state', async () => {
    const view = new global.ResultsView('456');
    await new Promise((r) => setTimeout(r, 0));

    // Try to send chat
    await view.sendChatMessage();

    // Should not forward a chat message to background if no session
    expect(browser.runtime.sendMessage).not.toHaveBeenCalledWith(expect.objectContaining({ action: 'sendChatMessage' }));
  });
});
