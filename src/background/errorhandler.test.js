const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, 'errorhandler.js'), 'utf8');

describe('RetryHandler', () => {
  let handler;
  let fetch;

  beforeEach(() => {
    fetch = jest.fn();
    const RetryHandler = vm.runInNewContext(source + '\nRetryHandler;', {
      fetch,
      AbortController,
      setTimeout,
      clearTimeout,
      console: { log: jest.fn() }
    });
    handler = new RetryHandler();
  });

  test('preserves the abort error when reporting request cancellation', async () => {
    const abortError = new Error('Request aborted');
    abortError.name = 'AbortError';
    fetch.mockRejectedValue(abortError);

    const operation = handler.fetchWithRetry('https://example.com', {}, 'request-1', 7);

    await expect(operation).rejects.toThrow('Request cancelled');
    await expect(operation).rejects.toHaveProperty('cause', abortError);
    expect(handler.activeRetries.size).toBe(0);
    expect(handler.tabRetries.size).toBe(0);
  });

  test('preserves the delay error when reporting retry cancellation', async () => {
    const delayError = new Error('Delay cancelled');
    fetch.mockRejectedValue(new Error('Network unavailable'));
    handler.delay = jest.fn().mockRejectedValue(delayError);

    const operation = handler.fetchWithRetry('https://example.com', {}, 'request-2', 7);

    await expect(operation).rejects.toThrow('Request cancelled');
    await expect(operation).rejects.toHaveProperty('cause', delayError);
    expect(handler.activeRetries.size).toBe(0);
    expect(handler.tabRetries.size).toBe(0);
  });
});
