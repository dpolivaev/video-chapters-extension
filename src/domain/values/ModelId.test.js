/**
 * ModelId Value Object Tests
 * Tests actual ModelId class with proper imports
 *
 * Copyright (C) 2025 Dimitry Polivaev
 * Licensed under GPL3 or later
 */

const ModelId = require('./ModelId');

describe('ModelId Value Object', () => {
  describe('constructor and validation', () => {
    test('should create ModelId with valid string', () => {
      const modelId = new ModelId('gemini-2.5-pro');
      
      expect(modelId.value).toBe('gemini-2.5-pro');
      expect(modelId.provider).toBe('Gemini');
      expect(modelId.isFree).toBe(false);
    });

    test('should throw error for null or undefined', () => {
      expect(() => new ModelId(null)).toThrow('Model ID must be a non-empty string');
      expect(() => new ModelId(undefined)).toThrow('Model ID must be a non-empty string');
    });

    test('should throw error for empty string', () => {
      expect(() => new ModelId('')).toThrow('Model ID must be a non-empty string');
    });

    test('should throw error for non-string input', () => {
      expect(() => new ModelId(123)).toThrow('Model ID must be a non-empty string');
      expect(() => new ModelId({})).toThrow('Model ID must be a non-empty string');
    });

    test('should be immutable', () => {
      const modelId = new ModelId('gemini-2.5-pro');
      
      expect(Object.isFrozen(modelId)).toBe(true);
      
      const originalValue = modelId.value;
      modelId.value = 'changed';
      expect(modelId.value).toBe(originalValue);
    });
  });

  describe('provider detection', () => {
    test('should detect Gemini provider', () => {
      const modelId = new ModelId('gemini-2.5-pro');
      
      expect(modelId.provider).toBe('Gemini');
      expect(modelId.isGemini()).toBe(true);
      expect(modelId.isOpenRouter()).toBe(false);
    });

    test('should detect OpenRouter provider', () => {
      const modelId = new ModelId('anthropic/claude-3.5-sonnet');
      
      expect(modelId.provider).toBe('OpenRouter');
      expect(modelId.isOpenRouter()).toBe(true);
      expect(modelId.isGemini()).toBe(false);
    });

    test('should detect unknown provider', () => {
      const modelId = new ModelId('custom-model');
      
      expect(modelId.provider).toBe('Unknown');
      expect(modelId.isGemini()).toBe(false);
      expect(modelId.isOpenRouter()).toBe(false);
    });
  });

  describe('free model detection', () => {
    test('should detect free models', () => {
      const freeModel = new ModelId('deepseek/deepseek-r1-0528:free');
      
      expect(freeModel.isFree).toBe(true);
    });

    test('should detect paid models', () => {
      const paidModel = new ModelId('deepseek/deepseek-r1-0528');
      
      expect(paidModel.isFree).toBe(false);
    });
  });

  describe('API key requirements', () => {
    test('should require API key for Gemini models', () => {
      const geminiPro = new ModelId('gemini-2.5-pro');
      const geminiFlash = new ModelId('gemini-2.5-flash');
      
      expect(geminiPro.requiresApiKey()).toBe(true);
      expect(geminiFlash.requiresApiKey()).toBe(true);
    });

    test('should require API key for paid OpenRouter models', () => {
      const paidModel = new ModelId('anthropic/claude-3.5-sonnet');
      
      expect(paidModel.requiresApiKey()).toBe(true);
    });

    test('should not require API key for free OpenRouter models', () => {
      const freeModel = new ModelId('deepseek/deepseek-r1-0528:free');
      
      expect(freeModel.requiresApiKey()).toBe(false);
    });
  });

  describe('display names', () => {
    test('should provide display names for known models', () => {
      const testCases = [
        ['gemini-2.5-pro', 'Gemini 2.5 Pro'],
        ['gemini-2.5-flash', 'Gemini 2.5 Flash'],
        ['deepseek/deepseek-r1-0528:free', 'DeepSeek R1 (Free)'],
        ['anthropic/claude-3.5-sonnet', 'Claude 3.5 Sonnet'],
        ['openai/gpt-4o', 'GPT-4o']
      ];

      testCases.forEach(([modelStr, expectedName]) => {
        const modelId = new ModelId(modelStr);
        expect(modelId.getDisplayName()).toBe(expectedName);
      });
    });

    test('should handle Llama models specifically', () => {
      const llamaModel = new ModelId('meta-llama/llama-3.3-70b');
      expect(llamaModel.getDisplayName()).toBe('Llama 3.3 70B');

      const llamaFreeModel = new ModelId('meta-llama/llama-3.3-70b:free');
      expect(llamaFreeModel.getDisplayName()).toBe('Llama 3.3 70B');
    });

    test('should extract model names from paths', () => {
      const modelWithPath = new ModelId('unknown/custom-model-name');
      expect(modelWithPath.getDisplayName()).toBe('custom-model-name');

      const freeModelWithPath = new ModelId('provider/model-name:free');
      expect(freeModelWithPath.getDisplayName()).toBe('model-name (Free)');
    });

    test('should format model names correctly', () => {
      const customFreeModel = new ModelId('custom/test-model:free');
      expect(customFreeModel.getDisplayName()).toBe('test-model (Free)');

      const customPaidModel = new ModelId('custom/test-model');
      expect(customPaidModel.getDisplayName()).toBe('test-model');
    });
  });

  describe('string representation', () => {
    test('should convert to string correctly', () => {
      const modelId = new ModelId('gemini-2.5-pro');
      
      expect(modelId.toString()).toBe('gemini-2.5-pro');
      expect(String(modelId)).toBe('gemini-2.5-pro');
    });
  });
});