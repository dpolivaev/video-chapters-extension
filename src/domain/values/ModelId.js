/**
 * ModelId Value Object
 * Represents a validated AI model identifier with provider information
 *
 * Copyright (C) 2025 Dimitry Polivaev
 * Licensed under GPL3 or later
 */

class ModelId {
  constructor(id, provider, pricing = null) {
    if (!id || typeof id !== 'string') {
      throw new Error('Model ID must be a non-empty string');
    }
    if (!provider || typeof provider !== 'string') {
      throw new Error('Provider must be a non-empty string');
    }

    this.value = id;
    this.provider = provider;
    this.pricing = pricing;
    Object.freeze(this);
  }

  get isFree() {
    if (!this.pricing) {
      return false;
    }
    const promptPrice = parseFloat(this.pricing.prompt || 0);
    const completionPrice = parseFloat(this.pricing.completion || 0);
    return promptPrice === 0 && completionPrice === 0;
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

    return new ModelId(data.value, data.provider, data.pricing);
  }

  static getDefault() {
    const defaultPricing = { prompt: '0', completion: '0' };
    return new ModelId('deepseek/deepseek-r1-0528:free', 'OpenRouter', defaultPricing);
  }

  toJSON() {
    return {
      value: this.value,
      provider: this.provider,
      pricing: this.pricing
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
    const baseName = this.getDisplayNameWithoutFree();
    if (this.isFree) {
      const freeMessage = chrome.i18n && chrome.i18n.getMessage ? chrome.i18n.getMessage('free') : 'Free';
      return `${baseName} (${freeMessage})`;
    }

    if (this.pricing && this.pricing.prompt) {
      const promptPrice = parseFloat(this.pricing.prompt);
      const completionPrice = parseFloat(this.pricing.completion || 0);

      if (promptPrice > 0 || completionPrice > 0) {
        // Convert to tokens per cent (1 cent = $0.01) and round down to 2 significant digits
        const roundToTwoDigits = (value) => {
          if (value < 10) {
            return Math.floor(value);
          }

          const digits = Math.floor(Math.log10(value)) + 1;
          if (digits <= 2) {
            return Math.floor(value);
          }

          const divisor = Math.pow(10, digits - 2);
          return Math.floor(value / divisor) * divisor;
        };

        const promptTokensPerCent = roundToTwoDigits(0.01 / promptPrice);
        const completionTokensPerCent = roundToTwoDigits(0.01 / completionPrice);

        if (promptPrice === completionPrice) {
          return `${baseName} (${promptTokensPerCent})`;
        } else {
          return `${baseName} (${promptTokensPerCent}/${completionTokensPerCent})`;
        }
      }
    }

    return baseName;
  }

  getDisplayNameWithoutFree() {
    const familyMappings = {
      'gemini': 'Gemini',
      'deepseek': 'DeepSeek',
      'claude': 'Claude',
      'gpt': 'GPT',
      'llama': 'Llama'
    };

    // Extract model name from path and remove :free suffix
    const parts = this.value.split('/');
    const modelPart = parts[parts.length - 1].replace(/:free$/, '');

    // Split by hyphens, but keep digit-hyphen-digit patterns together
    const components = modelPart.split(/-(?!\d)|(?<!\d)-/);

    if (components.length === 0) {
      return modelPart;
    }

    const result = [];
    const familyName = components[0].toLowerCase();

    // Map family name
    if (familyMappings[familyName]) {
      result.push(familyMappings[familyName]);
    } else {
      // Capitalize first letter of unknown family
      result.push(familyName.charAt(0).toUpperCase() + familyName.slice(1));
    }

    // Process remaining components (versions, types, etc.)
    for (let i = 1; i < components.length; i++) {
      const component = components[i];
      // Capitalize letters at the beginning and after non-letter characters
      const formatted = component.replace(/^[a-z]|[^a-zA-Z][a-z]/g, match => match.toUpperCase());
      result.push(formatted);
    }

    return result.join(' ');
  }

}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ModelId;
}
