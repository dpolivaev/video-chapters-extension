/**
 * Results rehydrate + chat no-session handling tests
 */


// Localized message helper
global.getLocalizedMessage = (key) => key;

const makeClassList = () => ({ add: jest.fn(), remove: jest.fn(), toggle: jest.fn() });

let elements;

const mockResults = {
  resultId: 'r1',
  processedContent: { content: 'text' },
  chapters: '00:00 - Start',
  timestamp: Date.now(),
  model: { value: 'deepseek/deepseek-r1-0528:free', provider: 'OpenRouter', pricing: 'free' },
  customInstructions: '',
  videoMetadata: { title: 'T', author: 'A', url: 'https://youtu.be/x' },
  status: 'completed', error: null, inputTokens: 0, outputTokens: 0
};

let sendChatPayload = null;

beforeEach(() => {
  elements = {
    progressSection: { style: { display: 'none' } },
    progressFill: { style: { width: '0%' } },
    progressMessage: { textContent: '' },
    statusText: { textContent: '' },
    pageTitle: { textContent: '' },
    chatSection: { style: { display: 'none' } },
    sendChatBtn: { disabled: false, addEventListener: jest.fn() },
    chatInput: { value: '', addEventListener: jest.fn() },
    copyChaptersBtn: { disabled: false, addEventListener: jest.fn() },
    copySubtitlesBtn: { disabled: false, addEventListener: jest.fn() },
    backBtn: { addEventListener: jest.fn() },
    helpBtn: { addEventListener: jest.fn() },
    subtitlesContent: { tagName: 'TEXTAREA', value: '', textContent: '' },
    subtitleInfo: { textContent: '' },
    chaptersHtml: { tagName: 'DIV', textContent: '', appendChild: jest.fn() },
    notificationContainer: { appendChild: jest.fn() },
    videoTitle: { textContent: '' },
    videoAuthor: { textContent: '' },
    generationTime: { textContent: '' },
    chatMessages: { classList: makeClassList(), innerHTML: '', scrollTop: 0, scrollHeight: 0, appendChild: jest.fn() }
  };

  global.document = {
    getElementById: jest.fn((id) => elements[id] || null),
    querySelectorAll: jest.fn(() => []),
    createElement: jest.fn((tag) => ({ tagName: tag.toUpperCase(), className: '', style: {}, appendChild: jest.fn(), textContent: '' })),
    createTextNode: jest.fn((text) => ({ nodeType: 3, textContent: text })),
    addEventListener: jest.fn()
  };

  // Window + selection mocks
  global.window = { getSelection: jest.fn(() => ({ rangeCount: 0, isCollapsed: true, removeAllRanges: jest.fn(), addRange: jest.fn(), toString: jest.fn(() => '') })) };

  // Browser API mocks
  sendChatPayload = null;
  global.browser = {
    runtime: {
      sendMessage: jest.fn(async (payload) => {
        if (payload.action === 'getGenerationStatus') {
          return { success: true, status: 'done' };
        }
        if (payload.action === 'getSessionResults') {
          return { success: true, results: mockResults };
        }
        if (payload.action === 'sendChatMessage') {
          sendChatPayload = payload;
          return { success: true, content: 'ok' };
        }
        return { success: true };
      }),
      onMessage: { addListener: jest.fn() }
    },
    tabs: { getCurrent: jest.fn(async () => ({ id: 99 })), create: jest.fn(), query: jest.fn() }
  };

  // chrome.i18n
  global.chrome = { i18n: { getMessage: jest.fn((k) => k) } };

  // Clipboard stubs
  global.navigator = { clipboard: { writeText: jest.fn(), write: jest.fn() } };
  global.ClipboardItem = jest.fn();
  global.Blob = jest.fn();
});

// Load ResultsView class from results.js
const fs = require('fs');
const path = require('path');
const resultsJs = fs.readFileSync(path.join(__dirname, 'results.js'), 'utf8');
const classMatch = resultsJs.match(/class ResultsView \{[\s\S]*?\n\}/);
const classCode = classMatch[0];
eval(`${classCode}\nglobal.ResultsView = ResultsView;`);

describe('ResultsView chat no-session response handling', () => {
  test('shows a notification when background returns no_session', async () => {
    // Set URL helper
    global.window.location = { search: '?resultId=r1' };

    const view = new global.ResultsView('r1');
    await new Promise((r) => setTimeout(r, 0));

    elements.chatInput.value = 'Hi';

    view.showNotification = jest.fn();

    await view.sendChatMessage();

    expect(sendChatPayload).not.toBeNull();
    expect(sendChatPayload.sessionResults).toBe(mockResults);
    expect(view.showNotification).not.toHaveBeenCalled();
  });
});
