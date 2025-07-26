/**
 * NetworkCommunicator Service Tests
 * Tests HTTP communication with dependency injection
 *
 * Copyright (C) 2025 Dimitry Polivaev
 * Licensed under GPL3 or later
 */

const NetworkCommunicator = require('./NetworkCommunicator');

describe('NetworkCommunicator', () => {
  let networkCommunicator;
  let mockHttpAdapter;
  let mockRetryHandler;

  beforeEach(() => {
    mockHttpAdapter = {
      fetch: jest.fn()
    };

    mockRetryHandler = {
      generateRequestId: jest.fn(() => 'request-123'),
      fetchWithRetry: jest.fn()
    };

    networkCommunicator = new NetworkCommunicator(mockHttpAdapter, mockRetryHandler);
  });

  describe('constructor', () => {
    test('should store injected dependencies', () => {
      expect(networkCommunicator.httpAdapter).toBe(mockHttpAdapter);
      expect(networkCommunicator.retryHandler).toBe(mockRetryHandler);
    });
  });

  describe('successful POST requests', () => {
    test('should make successful POST request', async () => {
      const url = 'https://api.example.com/test';
      const headers = { 'Content-Type': 'application/json' };
      const body = { message: 'test' };
      const expectedResponse = { success: true, data: 'response' };

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue(expectedResponse)
      };

      mockRetryHandler.fetchWithRetry.mockResolvedValue(mockResponse);

      const result = await networkCommunicator.post(url, headers, body);

      expect(mockRetryHandler.generateRequestId).toHaveBeenCalled();
      expect(mockRetryHandler.fetchWithRetry).toHaveBeenCalledWith(
        url,
        {
          method: 'POST',
          headers,
          body: JSON.stringify(body)
        },
        'request-123',
        null
      );
      expect(result).toEqual(expectedResponse);
    });

    test('should make POST request with tabId', async () => {
      const url = 'https://api.example.com/test';
      const headers = { 'Authorization': 'Bearer token' };
      const body = { data: 'test' };
      const tabId = 456;

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ result: 'success' })
      };

      mockRetryHandler.fetchWithRetry.mockResolvedValue(mockResponse);

      await networkCommunicator.post(url, headers, body, tabId);

      expect(mockRetryHandler.fetchWithRetry).toHaveBeenCalledWith(
        url,
        expect.objectContaining({
          method: 'POST',
          headers,
          body: JSON.stringify(body)
        }),
        'request-123',
        tabId
      );
    });

    test('should serialize body as JSON', async () => {
      const complexBody = {
        user: { name: 'John', age: 30 },
        items: [1, 2, 3],
        settings: { enabled: true }
      };

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({})
      };

      mockRetryHandler.fetchWithRetry.mockResolvedValue(mockResponse);

      await networkCommunicator.post('https://api.test.com', {}, complexBody);

      expect(mockRetryHandler.fetchWithRetry).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify(complexBody)
        }),
        expect.any(String),
        null
      );
    });
  });

  describe('HTTP error handling', () => {
    test('should handle HTTP 400 error', async () => {
      const errorData = { error: 'Bad request', code: 'INVALID_INPUT' };
      const mockResponse = {
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: jest.fn().mockResolvedValue(errorData)
      };

      mockRetryHandler.fetchWithRetry.mockResolvedValue(mockResponse);

      await expect(networkCommunicator.post('https://api.test.com', {}, {}))
        .rejects.toThrow('HTTP 400: Bad Request');

      try {
        await networkCommunicator.post('https://api.test.com', {}, {});
      } catch (error) {
        expect(error.isHttpError).toBe(true);
        expect(error.status).toBe(400);
        expect(error.responseData).toEqual(errorData);
      }
    });

    test('should handle HTTP 401 error', async () => {
      const mockResponse = {
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: jest.fn().mockResolvedValue({ message: 'Invalid token' })
      };

      mockRetryHandler.fetchWithRetry.mockResolvedValue(mockResponse);

      await expect(networkCommunicator.post('https://api.test.com', {}, {}))
        .rejects.toThrow('HTTP 401: Unauthorized');
    });

    test('should handle HTTP 500 error', async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: jest.fn().mockResolvedValue({ error: 'Server error' })
      };

      mockRetryHandler.fetchWithRetry.mockResolvedValue(mockResponse);

      await expect(networkCommunicator.post('https://api.test.com', {}, {}))
        .rejects.toThrow('HTTP 500: Internal Server Error');
    });

    test('should handle error response with invalid JSON', async () => {
      const mockResponse = {
        ok: false,
        status: 422,
        statusText: 'Unprocessable Entity',
        json: jest.fn().mockRejectedValue(new Error('Invalid JSON'))
      };

      mockRetryHandler.fetchWithRetry.mockResolvedValue(mockResponse);

      try {
        await networkCommunicator.post('https://api.test.com', {}, {});
      } catch (error) {
        expect(error.isHttpError).toBe(true);
        expect(error.status).toBe(422);
        expect(error.responseData).toEqual({});
      }
    });
  });

  describe('network error handling', () => {
    test('should handle network timeout', async () => {
      const networkError = new Error('Request timeout');
      mockRetryHandler.fetchWithRetry.mockRejectedValue(networkError);

      await expect(networkCommunicator.post('https://api.test.com', {}, {}))
        .rejects.toThrow('Network error: Request timeout');
    });

    test('should handle connection error', async () => {
      const connectionError = new Error('Connection refused');
      mockRetryHandler.fetchWithRetry.mockRejectedValue(connectionError);

      await expect(networkCommunicator.post('https://api.test.com', {}, {}))
        .rejects.toThrow('Network error: Connection refused');
    });

    test('should not wrap HTTP errors as network errors', async () => {
      const httpError = new Error('HTTP 404: Not Found');
      httpError.isHttpError = true;
      httpError.status = 404;

      mockRetryHandler.fetchWithRetry.mockRejectedValue(httpError);

      await expect(networkCommunicator.post('https://api.test.com', {}, {}))
        .rejects.toThrow('HTTP 404: Not Found');

      try {
        await networkCommunicator.post('https://api.test.com', {}, {});
      } catch (error) {
        expect(error.isHttpError).toBe(true);
        expect(error.status).toBe(404);
      }
    });
  });

  describe('error response parsing', () => {
    test('should parse valid JSON error response', async () => {
      const errorData = { error: 'Validation failed', details: ['field required'] };
      const mockResponse = {
        json: jest.fn().mockResolvedValue(errorData)
      };

      const result = await networkCommunicator.parseErrorResponse(mockResponse);
      expect(result).toEqual(errorData);
    });

    test('should handle invalid JSON in error response', async () => {
      const mockResponse = {
        json: jest.fn().mockRejectedValue(new Error('Invalid JSON'))
      };

      const result = await networkCommunicator.parseErrorResponse(mockResponse);
      expect(result).toEqual({});
    });

    test('should handle null response in error parsing', async () => {
      const mockResponse = {
        json: jest.fn().mockResolvedValue(null)
      };

      const result = await networkCommunicator.parseErrorResponse(mockResponse);
      expect(result).toBeNull();
    });
  });

  describe('edge cases', () => {
    test('should handle empty response body', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue(null)
      };

      mockRetryHandler.fetchWithRetry.mockResolvedValue(mockResponse);

      const result = await networkCommunicator.post('https://api.test.com', {}, {});
      expect(result).toBeNull();
    });

    test('should handle response JSON parsing error on success', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockRejectedValue(new Error('Invalid JSON'))
      };

      mockRetryHandler.fetchWithRetry.mockResolvedValue(mockResponse);

      await expect(networkCommunicator.post('https://api.test.com', {}, {}))
        .rejects.toThrow('Network error: Invalid JSON');
    });

    test('should generate unique request IDs', async () => {
      mockRetryHandler.generateRequestId
        .mockReturnValueOnce('request-1')
        .mockReturnValueOnce('request-2');

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({})
      };

      mockRetryHandler.fetchWithRetry.mockResolvedValue(mockResponse);

      await networkCommunicator.post('https://api.test.com', {}, {});
      await networkCommunicator.post('https://api.test.com', {}, {});

      expect(mockRetryHandler.generateRequestId).toHaveBeenCalledTimes(2);
      expect(mockRetryHandler.fetchWithRetry).toHaveBeenNthCalledWith(
        1,
        expect.any(String),
        expect.any(Object),
        'request-1',
        null
      );
      expect(mockRetryHandler.fetchWithRetry).toHaveBeenNthCalledWith(
        2,
        expect.any(String),
        expect.any(Object),
        'request-2',
        null
      );
    });
  });
});
