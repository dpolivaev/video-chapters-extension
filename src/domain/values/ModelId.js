/**
 * ModelId Value Object
 * Represents a validated AI model identifier with provider information
 *
 * Copyright (C) 2025 Dimitry Polivaev
 * Licensed under GPL3 or later
 */

class ModelId {
  constructor(id, provider, isFree) {
    if (!id || typeof id !== 'string') {
      throw new Error('Model ID must be a non-empty string');
    }
    if (!provider || typeof provider !== 'string') {
      throw new Error('Provider must be a non-empty string');
    }
    if (typeof isFree !== 'boolean') {
      throw new Error('isFree must be a boolean');
    }

    this.value = id;
    this.provider = provider;
    this.isFree = isFree;
    Object.freeze(this);
  }

  static fromJSON(data) {
    // Handle malformed or missing data gracefully
    if (!data || typeof data !== 'object') {
      return ModelId.getDefault();
    }

    // Validate required fields
    if (!data.value || typeof data.value !== 'string') {
      return ModelId.getDefault();
    }

    if (!data.provider || typeof data.provider !== 'string') {
      return ModelId.getDefault();
    }

    if (typeof data.isFree !== 'boolean') {
      return ModelId.getDefault();
    }

    return new ModelId(data.value, data.provider, data.isFree);
  }

  static getDefault() {
    return new ModelId('deepseek/deepseek-r1-0528:free', 'OpenRouter', true);
  }

  toJSON() {
    return {
      value: this.value,
      provider: this.provider,
      isFree: this.isFree
    };
  }

  toString() {
    return this.value;
  }


  isGemini() {
    return this.provider === 'Gemini';
  }

  isOpenRouter() {
    return this.provider === 'OpenRouter';
  }

  requiresApiKey() {
    if (this.isGemini()) {
      return true;
    }

    if (this.isOpenRouter() && !this.isFree) {
      return true;
    }

    return false;
  }

  getDisplayName() {
    if (this.value.includes('gemini-2.5-pro')) {
      return 'Gemini 2.5 Pro';
    }
    if (this.value.includes('gemini-2.5-flash')) {
      return 'Gemini 2.5 Flash';
    }
    if (this.value.includes('deepseek-r1-0528:free')) {
      return 'DeepSeek R1 (Free)';
    }
    if (this.value.includes('deepseek-r1-0528')) {
      return 'DeepSeek R1';
    }
    if (this.value.includes('claude-3.5-sonnet')) {
      return 'Claude 3.5 Sonnet';
    }
    if (this.value.includes('claude-3.5-haiku')) {
      return 'Claude 3.5 Haiku';
    }
    if (this.value.includes('gpt-4o-mini')) {
      return 'GPT-4o Mini';
    }
    if (this.value.includes('gpt-4o')) {
      return 'GPT-4o';
    }
    if (this.value.includes('llama-3.3-70b')) {
      return 'Llama 3.3 70B';
    }

    return this.extractModelNameFromPath();
  }

  getDisplayNameWithoutFree() {
    if (this.value.includes('gemini-2.5-pro')) {
      return 'Gemini 2.5 Pro';
    }
    if (this.value.includes('gemini-2.5-flash')) {
      return 'Gemini 2.5 Flash';
    }
    if (this.value.includes('deepseek-r1-0528')) {
      return 'DeepSeek R1';
    }
    if (this.value.includes('claude-3.5-sonnet')) {
      return 'Claude 3.5 Sonnet';
    }
    if (this.value.includes('claude-3.5-haiku')) {
      return 'Claude 3.5 Haiku';
    }
    if (this.value.includes('gpt-4o-mini')) {
      return 'GPT-4o Mini';
    }
    if (this.value.includes('gpt-4o')) {
      return 'GPT-4o';
    }
    if (this.value.includes('llama-3.3-70b')) {
      return 'Llama 3.3 70B';
    }

    return this.extractModelNameFromPathWithoutFree();
  }

  extractModelNameFromPath() {
    const parts = this.value.split('/');
    const modelPart = parts[parts.length - 1];
    return this.formatModelName(modelPart);
  }

  extractModelNameFromPathWithoutFree() {
    const parts = this.value.split('/');
    const modelPart = parts[parts.length - 1];
    return this.formatModelNameWithoutFree(modelPart);
  }

  formatModelName(modelPart) {
    return modelPart.replace(/:free$/, ' (Free)');
  }

  formatModelNameWithoutFree(modelPart) {
    return modelPart.replace(/:free$/, '');
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ModelId;
}
