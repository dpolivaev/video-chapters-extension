/**
 * ApiCredentials Value Object Tests
 * Tests API credential validation and model compatibility
 *
 * Copyright (C) 2025 Dimitry Polivaev
 * Licensed under GPL3 or later
 */

const ApiCredentials = require('./ApiCredentials');

describe('ApiCredentials', () => {
  describe('constructor and validation', () => {
    test('should create credentials with both keys', () => {
      const credentials = new ApiCredentials('gemini-key-123', 'openrouter-key-456');
      expect(credentials.geminiKey).toBe('gemini-key-123');
      expect(credentials.openRouterKey).toBe('openrouter-key-456');
    });

    test('should create credentials with only Gemini key', () => {
      const credentials = new ApiCredentials('gemini-key-123');
      expect(credentials.geminiKey).toBe('gemini-key-123');
      expect(credentials.openRouterKey).toBe('');
    });

    test('should create credentials with only OpenRouter key', () => {
      const credentials = new ApiCredentials('', 'openrouter-key-456');
      expect(credentials.geminiKey).toBe('');
      expect(credentials.openRouterKey).toBe('openrouter-key-456');
    });

    test('should create empty credentials by default', () => {
      const credentials = new ApiCredentials();
      expect(credentials.geminiKey).toBe('');
      expect(credentials.openRouterKey).toBe('');
    });

    test('should trim whitespace from keys', () => {
      const credentials = new ApiCredentials('  gemini-key  ', '  openrouter-key  ');
      expect(credentials.geminiKey).toBe('gemini-key');
      expect(credentials.openRouterKey).toBe('openrouter-key');
    });

    test('should reject non-string keys', () => {
      expect(() => new ApiCredentials(123, 'valid-key')).toThrow('Gemini API key must be a string');
      expect(() => new ApiCredentials('valid-key', 456)).toThrow('OpenRouter API key must be a string');
      expect(() => new ApiCredentials({}, 'valid-key')).toThrow('Gemini API key must be a string');
      expect(() => new ApiCredentials('valid-key', [])).toThrow('OpenRouter API key must be a string');
    });
  });

  describe('key presence detection', () => {
    test('should detect presence of Gemini key', () => {
      const withGemini = new ApiCredentials('gemini-key', '');
      const withoutGemini = new ApiCredentials('', 'openrouter-key');
      
      expect(withGemini.hasGeminiKey()).toBe(true);
      expect(withoutGemini.hasGeminiKey()).toBe(false);
    });

    test('should detect presence of OpenRouter key', () => {
      const withOpenRouter = new ApiCredentials('', 'openrouter-key');
      const withoutOpenRouter = new ApiCredentials('gemini-key', '');
      
      expect(withOpenRouter.hasOpenRouterKey()).toBe(true);
      expect(withoutOpenRouter.hasOpenRouterKey()).toBe(false);
    });

    test('should handle empty and whitespace-only keys', () => {
      const emptyKeys = new ApiCredentials('', '');
      const whitespaceKeys = new ApiCredentials('   ', '   ');
      
      expect(emptyKeys.hasGeminiKey()).toBe(false);
      expect(emptyKeys.hasOpenRouterKey()).toBe(false);
      expect(whitespaceKeys.hasGeminiKey()).toBe(false);
      expect(whitespaceKeys.hasOpenRouterKey()).toBe(false);
    });
  });

  describe('model compatibility', () => {
    test('should allow Gemini models with Gemini key', () => {
      const credentials = new ApiCredentials('gemini-key', '');
      expect(credentials.canUseModel('gemini-2.5-pro')).toBe(true);
      expect(credentials.canUseModel('gemini-2.5-flash')).toBe(true);
    });

    test('should reject Gemini models without Gemini key', () => {
      const credentials = new ApiCredentials('', 'openrouter-key');
      expect(credentials.canUseModel('gemini-2.5-pro')).toBe(false);
    });

    test('should allow paid OpenRouter models with OpenRouter key', () => {
      const credentials = new ApiCredentials('', 'openrouter-key');
      expect(credentials.canUseModel('openai/gpt-4o')).toBe(true);
      expect(credentials.canUseModel('anthropic/claude-3.5-sonnet')).toBe(true);
    });

    test('should reject paid OpenRouter models without OpenRouter key', () => {
      const credentials = new ApiCredentials('gemini-key', '');
      expect(credentials.canUseModel('openai/gpt-4o')).toBe(false);
    });

    test('should allow free OpenRouter models without key', () => {
      const credentials = new ApiCredentials('', '');
      expect(credentials.canUseModel('deepseek/deepseek-r1-0528:free')).toBe(true);
      expect(credentials.canUseModel('meta-llama/llama-3.3-70b:free')).toBe(true);
    });
  });

  describe('key retrieval for models', () => {
    test('should return correct key for Gemini models', () => {
      const credentials = new ApiCredentials('gemini-key-123', 'openrouter-key-456');
      expect(credentials.getKeyForModel('gemini-2.5-pro')).toBe('gemini-key-123');
    });

    test('should return correct key for OpenRouter models', () => {
      const credentials = new ApiCredentials('gemini-key-123', 'openrouter-key-456');
      expect(credentials.getKeyForModel('openai/gpt-4o')).toBe('openrouter-key-456');
      expect(credentials.getKeyForModel('deepseek/deepseek-r1-0528:free')).toBe('openrouter-key-456');
    });

    test('should return empty string for unknown models', () => {
      const credentials = new ApiCredentials('gemini-key', 'openrouter-key');
      expect(credentials.getKeyForModel('unknown-model')).toBe('');
    });
  });

  describe('immutable updates', () => {
    test('should create new instance with updated Gemini key', () => {
      const original = new ApiCredentials('old-gemini', 'openrouter-key');
      const updated = original.withGeminiKey('new-gemini');
      
      expect(original.geminiKey).toBe('old-gemini');
      expect(updated.geminiKey).toBe('new-gemini');
      expect(updated.openRouterKey).toBe('openrouter-key');
      expect(updated).not.toBe(original);
    });

    test('should create new instance with updated OpenRouter key', () => {
      const original = new ApiCredentials('gemini-key', 'old-openrouter');
      const updated = original.withOpenRouterKey('new-openrouter');
      
      expect(original.openRouterKey).toBe('old-openrouter');
      expect(updated.openRouterKey).toBe('new-openrouter');
      expect(updated.geminiKey).toBe('gemini-key');
      expect(updated).not.toBe(original);
    });
  });

  describe('free model usage', () => {
    test('should always allow free model usage', () => {
      const emptyCredentials = new ApiCredentials();
      expect(emptyCredentials.canUseFreeModel()).toBe(true);
      
      const withKeys = new ApiCredentials('gemini', 'openrouter');
      expect(withKeys.canUseFreeModel()).toBe(true);
    });
  });

  describe('immutability', () => {
    test('should be immutable after creation', () => {
      const credentials = new ApiCredentials('gemini-key', 'openrouter-key');
      expect(Object.isFrozen(credentials)).toBe(true);
      
      const originalGemini = credentials.geminiKey;
      const originalOpenRouter = credentials.openRouterKey;
      
      credentials.geminiKey = 'changed';
      credentials.openRouterKey = 'changed';
      
      expect(credentials.geminiKey).toBe(originalGemini);
      expect(credentials.openRouterKey).toBe(originalOpenRouter);
    });
  });
});