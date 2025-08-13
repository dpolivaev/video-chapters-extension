/**
 * ApiCredentials Value Object
 * Represents API credentials for different providers
 *
 * Copyright (C) 2025 Dimitry Polivaev
 * Licensed under GPL3 or later
 */

// Load ModelId for Node.js environment (tests), skip if already loaded in browser
if (typeof ModelId === 'undefined' && typeof require !== 'undefined') {
  const ModelId = require('./ModelId');
}

class ApiCredentials {
  constructor(geminiKey = '', openRouterKey = '') {
    this.geminiKey = this.validateKey(geminiKey, 'Gemini');
    this.openRouterKey = this.validateKey(openRouterKey, 'OpenRouter');
    Object.freeze(this);
  }

  validateKey(key, provider) {
    if (key && typeof key !== 'string') {
      throw new Error(`${provider} API key must be a string`);
    }
    return key.trim();
  }

  canUseModel(model) {
    if (model.isGemini()) {
      return !!this.geminiKey;
    }

    if (model.isOpenRouter()) {
      return !!this.openRouterKey;
    }

    return false;
  }


  getKeyForModel(model) {
    if (model.isGemini()) {
      return this.geminiKey;
    }

    if (model.isOpenRouter()) {
      return this.openRouterKey;
    }

    return '';
  }

  hasGeminiKey() {
    return !!this.geminiKey;
  }

  hasOpenRouterKey() {
    return !!this.openRouterKey;
  }

  withGeminiKey(key) {
    return new ApiCredentials(key, this.openRouterKey);
  }

  withOpenRouterKey(key) {
    return new ApiCredentials(this.geminiKey, key);
  }

}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ApiCredentials;
}
