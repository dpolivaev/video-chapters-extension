/**
 * Browser HTTP Adapter - Trivial Infrastructure
 * Zero control flow - just wraps browser fetch API
 *
 * Copyright (C) 2025 Dimitry Polivaev
 * Licensed under GPL3 or later
 */

class BrowserHttpAdapter {
  async fetch(url, options) {
    return fetch(url, options);
  }
}
