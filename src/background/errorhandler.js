/**
 * Retry utility for handling server errors (5xx) with exponential backoff
 * and tab-based cancellation support
 */

class RetryHandler {
  constructor() {
    this.activeRetries = new Map(); // Maps requestId to retry controller
    this.tabRetries = new Map(); // Maps tabId to Set of requestIds
    this.setupTabListeners();
  }

  /**
   * Listen for tab close events to cancel associated retries
   */
  setupTabListeners() {
    if (typeof browser !== 'undefined' && browser.tabs) {
      browser.tabs.onRemoved.addListener((tabId) => {
        this.cancelRetriesForTab(tabId);
      });

      browser.windows.onRemoved.addListener(() => {
        // Cancel all retries when any window is closed
        // This handles the case where the entire browser window is closed
        this.cancelAllRetries();
      });
    }
  }

  /**
   * Cancel all retries associated with a specific tab
   */
  cancelRetriesForTab(tabId) {
    const requestIds = this.tabRetries.get(tabId);
    if (requestIds) {
      for (const requestId of requestIds) {
        this.cancelRetry(requestId);
      }
      this.tabRetries.delete(tabId);
    }
  }

  /**
   * Cancel all active retries
   */
  cancelAllRetries() {
    for (const requestId of this.activeRetries.keys()) {
      this.cancelRetry(requestId);
    }
    this.activeRetries.clear();
    this.tabRetries.clear();
  }

  /**
   * Cancel a specific retry
   */
  cancelRetry(requestId) {
    const controller = this.activeRetries.get(requestId);
    if (controller) {
      controller.abort();
      this.activeRetries.delete(requestId);
    }
  }

  /**
   * Register a retry with a tab for cancellation tracking
   */
  registerRetryForTab(requestId, tabId) {
    if (!this.tabRetries.has(tabId)) {
      this.tabRetries.set(tabId, new Set());
    }
    this.tabRetries.get(tabId).add(requestId);
  }

  /**
   * Check if an error is a server error (5xx) that should be retried
   */
  isRetryableError(response) {
    return response && response.status >= 500 && response.status < 600;
  }

  /**
   * Perform fetch with retry logic for 5xx errors
   * @param {string} url - The URL to fetch
   * @param {object} options - Fetch options
   * @param {string} requestId - Unique identifier for this request
   * @param {number} tabId - Tab ID for cancellation tracking (optional)
   * @param {number} maxRetries - Maximum number of retries (default: 3)
   * @returns {Promise<Response>} - The fetch response
   */
  async fetchWithRetry(url, options = {}, requestId, tabId = null, maxRetries = 3) {
    const controller = new AbortController();
    const mergedOptions = {
      ...options,
      signal: controller.signal
    };

    // Register this retry for cancellation
    this.activeRetries.set(requestId, controller);
    if (tabId !== null) {
      this.registerRetryForTab(requestId, tabId);
    }

    console.log(`🚀 RETRY_START: Initiating request with up to ${maxRetries} retries for ${url}`);

    let lastError;
    let attempt = 0;

    try {
      while (attempt <= maxRetries) {
        try {
          // Check if cancelled before making request
          if (controller.signal.aborted) {
            throw new Error('Request cancelled');
          }

          const response = await fetch(url, mergedOptions);

          // If it's not a 5xx error, return the response (success or non-retryable error)
          if (!this.isRetryableError(response)) {
            if (attempt > 0) {
              console.log(`✅ RETRY_SUCCESS: Request succeeded after ${attempt} retries for ${url}`);
            } else {
              console.log(`✅ REQUEST_SUCCESS: Request succeeded on first attempt for ${url}`);
            }
            return response;
          }

          // It's a 5xx error, prepare for retry
          lastError = new Error(`Server error: ${response.status} ${response.statusText}`);
          
          // If we've exhausted retries, throw the error
          if (attempt >= maxRetries) {
            break;
          }

          // Calculate delay: 5s, 10s, 15s for attempts 1, 2, 3
          const delay = (attempt + 1) * 5000;
          console.log(`🔄 RETRY: Server error ${response.status} ${response.statusText} - Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms for ${url}`);

          // Wait with cancellation support
          await this.delay(delay, controller.signal);
          attempt++;

        } catch (error) {
          // If it's an AbortError, the request was cancelled
          if (error.name === 'AbortError' || error.message === 'Request cancelled') {
            console.log(`🚫 RETRY_CANCELLED: Request cancelled after ${attempt} attempts for ${url}`);
            throw new Error('Request cancelled');
          }

          // For other errors (network issues, etc.), retry if we haven't exhausted attempts
          lastError = error;
          
          if (attempt >= maxRetries) {
            break;
          }

          const delay = (attempt + 1) * 5000;
          console.log(`🔄 RETRY: Network/fetch error "${error.message}" - Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms for ${url}`);
          
          try {
            await this.delay(delay, controller.signal);
            attempt++;
          } catch (delayError) {
            // Delay was cancelled
            throw new Error('Request cancelled');
          }
        }
      }

      // All retries exhausted
      console.log(`❌ RETRY_FAILED: All ${maxRetries} retries exhausted for ${url}. Final error: ${lastError?.message || 'Unknown error'}`);
      throw lastError || new Error('All retries exhausted');

    } finally {
      // Clean up tracking
      this.activeRetries.delete(requestId);
      if (tabId !== null) {
        const requestIds = this.tabRetries.get(tabId);
        if (requestIds) {
          requestIds.delete(requestId);
          if (requestIds.size === 0) {
            this.tabRetries.delete(tabId);
          }
        }
      }
    }
  }

  /**
   * Delay with cancellation support
   */
  delay(ms, signal) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(resolve, ms);
      
      if (signal) {
        signal.addEventListener('abort', () => {
          clearTimeout(timeout);
          reject(new Error('Delay cancelled'));
        });
      }
    });
  }

  /**
   * Generate a unique request ID
   */
  generateRequestId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}

// Create singleton instance
const retryHandler = new RetryHandler();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = retryHandler;
} else if (typeof window !== 'undefined') {
  window.retryHandler = retryHandler;
} 