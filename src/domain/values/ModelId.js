/**
 * ModelId Value Object
 * Represents a validated AI model identifier with provider information
 *
 * Copyright (C) 2025 Dimitry Polivaev
 * Licensed under GPL3 or later
 */

class ModelId {
  constructor(id) {
    this.value = this.validate(id);
    this.provider = this.extractProvider(id);
    this.isFree = this.checkIfFree(id);
    Object.freeze(this);
  }
  
  validate(id) {
    if (!id || typeof id !== 'string') {
      throw new Error('Model ID must be a non-empty string');
    }
    return id;
  }
  
  extractProvider(id) {
    if (id.includes('gemini-')) {
      return 'Gemini';
    }
    
    if (id.includes('/')) {
      return 'OpenRouter';
    }
    
    return 'Unknown';
  }
  
  checkIfFree(id) {
    return id.includes(':free');
  }
  
  toString() {
    return this.value;
  }
  
  equals(other) {
    return other instanceof ModelId && this.value === other.value;
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
    if (this.value.includes('gemini-2.5-pro')) return 'Gemini 2.5 Pro';
    if (this.value.includes('gemini-2.5-flash')) return 'Gemini 2.5 Flash';
    if (this.value.includes('deepseek-r1-0528:free')) return 'DeepSeek R1 (Free)';
    if (this.value.includes('deepseek-r1-0528')) return 'DeepSeek R1';
    if (this.value.includes('claude-3.5-sonnet')) return 'Claude 3.5 Sonnet';
    if (this.value.includes('claude-3.5-haiku')) return 'Claude 3.5 Haiku';
    if (this.value.includes('gpt-4o-mini')) return 'GPT-4o Mini';
    if (this.value.includes('gpt-4o')) return 'GPT-4o';
    if (this.value.includes('llama-3.3-70b')) return 'Llama 3.3 70B';
    
    return this.extractModelNameFromPath();}
  
  extractModelNameFromPath() {
    const parts = this.value.split('/');
    const modelPart = parts[parts.length - 1];
    return this.formatModelName(modelPart);
  }
  
  formatModelName(modelPart) {
    return modelPart.replace(/:free$/, ' (Free)');
  }
}