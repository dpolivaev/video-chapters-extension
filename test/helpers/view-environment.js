const fs = require('fs');
const path = require('path');
const vm = require('vm');

function makeElement(tagName, attributes = '') {
  const listeners = new Map();
  const classes = new Set((attributes.match(/class="([^"]*)"/)?.[1] || '').split(/\s+/));
  return {
    tagName: tagName.toUpperCase(),
    value: '',
    checked: /\bchecked\b/.test(attributes),
    disabled: /\bdisabled\b/.test(attributes),
    textContent: '',
    innerHTML: '',
    style: { display: attributes.match(/display:\s*([^;"]+)/)?.[1] || '' },
    dataset: { tab: attributes.match(/data-tab="([^"]*)"/)?.[1] },
    children: [],
    classList: {
      contains: name => classes.has(name),
      add: name => classes.add(name),
      remove: name => classes.delete(name),
      toggle(name, force = !classes.has(name)) {
        if (force) {
          classes.add(name);
        } else {
          classes.delete(name);
        }
      }
    },
    appendChild(child) {
      this.children.push(child);
    },
    addEventListener(event, listener) {
      if (!listeners.has(event)) {
        listeners.set(event, []);
      }
      listeners.get(event).push(listener);
    },
    async dispatch(event) {
      for (const listener of listeners.get(event) || []) {
        await listener({ target: this });
      }
      await new Promise(resolve => setImmediate(resolve));
    }
  };
}

function loadView(directory, className) {
  const html = fs.readFileSync(path.join(directory, path.basename(directory) + '.html'), 'utf8');
  const elements = {};
  const allElements = [];
  for (const match of html.matchAll(/<([a-z][a-z0-9-]*)\b([^>]*)>/gi)) {
    const element = makeElement(match[1], match[2]);
    const id = match[2].match(/\bid="([^"]*)"/)?.[1];
    if (id) {
      element.id = id;
      elements[id] = element;
    }
    allElements.push(element);
  }
  const document = {
    readyState: 'loading',
    addEventListener: jest.fn(),
    getElementById: id => elements[id] || null,
    querySelectorAll: selector => allElements.filter(element => element.classList.contains(selector.slice(1))),
    createElement: tagName => makeElement(tagName),
    createTextNode: textContent => ({ textContent })
  };
  const browser = {
    runtime: { sendMessage: jest.fn(async () => ({ success: true })) },
    tabs: { query: jest.fn(async () => [{ id: 7, url: 'https://youtube.com/watch?v=testid' }]) }
  };
  const context = {
    document,
    browser,
    chrome: { i18n: { getMessage: key => key } },
    window: {
      addEventListener: jest.fn(),
      close: jest.fn(),
      getSelection: () => ({ rangeCount: 0, isCollapsed: true })
    },
    navigator: { clipboard: { writeText: jest.fn(async () => {}) } },
    console: { log: jest.fn(), error: jest.fn(), debug: jest.fn(), warn: jest.fn() },
    setTimeout: jest.fn(),
    clearTimeout: jest.fn(),
    URLSearchParams,
    getLocalizedMessage: key => key,
    VideoUrl,
    VideoTranscript,
    ModelId,
    ChapterGeneration,
    InstructionEntry
  };
  const source = fs.readFileSync(path.join(directory, path.basename(directory) + '.js'), 'utf8');
  const View = vm.runInNewContext(source + '\n' + className + ';', context);
  return { View, elements, ...context };
}

function loadSessionRepository() {
  const source = fs.readFileSync(path.join(__dirname, '../../src/infrastructure/repositories/SessionRepository.js'), 'utf8');
  return vm.runInNewContext(source + '\nSessionRepository;', { ChapterGeneration });
}

module.exports = { loadView, loadSessionRepository };
