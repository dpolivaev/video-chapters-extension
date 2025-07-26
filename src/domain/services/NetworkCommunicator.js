/**
 * Network Communicator - Pure Domain Logic
 * Handles HTTP operations without framework dependencies
 *
 * Copyright (C) 2025 Dimitry Polivaev
 * Licensed under GPL3 or later
 */

class NetworkCommunicator {
  constructor(httpAdapter, retryHandler) {
    this.httpAdapter = httpAdapter;
    this.retryHandler = retryHandler;
  }

  async post(url, headers, body, tabId = null) {
    const requestId = this.retryHandler.generateRequestId();

    try {
      const response = await this.retryHandler.fetchWithRetry(
        url,
        {
          method: 'POST',
          headers,
          body: JSON.stringify(body)
        },
        requestId,
        tabId
      );

      if (!response.ok) {
        const errorData = await this.parseErrorResponse(response);
        const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
        error.isHttpError = true;
        error.status = response.status;
        error.responseData = errorData;
        throw error;
      }

      return await response.json();
    } catch (error) {
      if (error.isHttpError) {
        throw error;
      }
      throw new Error(`Network error: ${error.message}`);
    }
  }

  async parseErrorResponse(response) {
    try {
      return await response.json();
    } catch {
      return {};
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = NetworkCommunicator;
}
