/**
 * ModelId Value Object Tests
 * Tests ModelId class with JSON serialization and proper constructor validation
 *
 * Copyright (C) 2025 Dimitry Polivaev
 * Licensed under GPL3 or later
 */

const ModelId = require('./ModelId');

describe('ModelId Value Object', () => {
  describe('constructor and validation', () => {
    test('should create ModelId with explicit parameters', () => {
      const modelId = new ModelId('gemini-2.5-pro', 'Gemini', false);

      expect(modelId.value).toBe('gemini-2.5-pro');
      expect(modelId.provider).toBe('Gemini');
      expect(modelId.isFree).toBe(false);
    });

    test('should throw error for invalid id', () => {
      expect(() => new ModelId(null, 'Gemini', false)).toThrow('Model ID must be a non-empty string');
      expect(() => new ModelId(undefined, 'Gemini', false)).toThrow('Model ID must be a non-empty string');
      expect(() => new ModelId('', 'Gemini', false)).toThrow('Model ID must be a non-empty string');
      expect(() => new ModelId(123, 'Gemini', false)).toThrow('Model ID must be a non-empty string');
    });

    test('should throw error for invalid provider', () => {
      expect(() => new ModelId('test', null, false)).toThrow('Provider must be a non-empty string');
      expect(() => new ModelId('test', undefined, false)).toThrow('Provider must be a non-empty string');
      expect(() => new ModelId('test', '', false)).toThrow('Provider must be a non-empty string');
      expect(() => new ModelId('test', 123, false)).toThrow('Provider must be a non-empty string');
    });

    test('should accept optional pricing parameter', () => {
      expect(() => new ModelId('test', 'Provider')).not.toThrow();
      expect(() => new ModelId('test', 'Provider', null)).not.toThrow();
      expect(() => new ModelId('test', 'Provider', { prompt: '0', completion: '0' })).not.toThrow();
    });

    test('should be frozen after creation', () => {
      const modelId = new ModelId('test', 'Provider', { prompt: '0', completion: '0' });
      expect(Object.isFrozen(modelId)).toBe(true);
    });
  });

  describe('provider detection', () => {
    test('should correctly identify Gemini models', () => {
      const geminiPro = new ModelId('gemini-2.5-pro', 'Gemini', false);
      const geminiFlash = new ModelId('gemini-3-flash-preview', 'Gemini', false);

      expect(geminiPro.isGemini()).toBe(true);
      expect(geminiPro.isOpenRouter()).toBe(false);
      expect(geminiFlash.isGemini()).toBe(true);
      expect(geminiFlash.isOpenRouter()).toBe(false);
    });

    test('should correctly identify OpenRouter models', () => {
      const openRouterGemini = new ModelId('google/gemini-2.5-pro', 'OpenRouter', false);
      const freeModel = new ModelId('deepseek/deepseek-r1-0528:free', 'OpenRouter', true);

      expect(openRouterGemini.isGemini()).toBe(false);
      expect(openRouterGemini.isOpenRouter()).toBe(true);
      expect(freeModel.isGemini()).toBe(false);
      expect(freeModel.isOpenRouter()).toBe(true);
    });
  });

  describe('JSON serialization', () => {
    test('should serialize to JSON correctly', () => {
      const pricing = { prompt: '0.000002', completion: '0.000008' };
      const modelId = new ModelId('google/gemini-2.5-pro', 'OpenRouter', pricing);
      const json = modelId.toJSON();

      expect(json).toEqual({
        value: 'google/gemini-2.5-pro',
        provider: 'OpenRouter',
        pricing
      });
    });

    test('should deserialize from JSON correctly', () => {
      const jsonData = {
        value: 'deepseek/deepseek-r1-0528:free',
        provider: 'OpenRouter',
        pricing: { prompt: '0', completion: '0' }
      };

      const modelId = ModelId.fromJSON(jsonData);

      expect(modelId.value).toBe('deepseek/deepseek-r1-0528:free');
      expect(modelId.provider).toBe('OpenRouter');
      expect(modelId.isFree).toBe(true);
      expect(modelId.isOpenRouter()).toBe(true);
    });

    test('should maintain data integrity through JSON cycle', () => {
      const pricing = { prompt: '0.000003', completion: '0.000015' };
      const original = new ModelId('anthropic/claude-3.5-sonnet', 'OpenRouter', pricing);

      // Serialize to JSON
      const jsonData = original.toJSON();

      // Simulate browser storage JSON cycle
      const storedData = JSON.parse(JSON.stringify(jsonData));

      // Deserialize back to ModelId
      const restored = ModelId.fromJSON(storedData);

      expect(restored.value).toBe(original.value);
      expect(restored.provider).toBe(original.provider);
      expect(restored.isFree).toBe(original.isFree);
      expect(restored.isOpenRouter()).toBe(original.isOpenRouter());
    });
  });

  describe('routing behavior', () => {
    test('should route direct Gemini models to Gemini API', () => {
      const directGemini = new ModelId('gemini-2.5-pro', 'Gemini', false);

      expect(directGemini.isGemini()).toBe(true);
      expect(directGemini.isOpenRouter()).toBe(false);
    });

    test('should route OpenRouter Gemini models to OpenRouter API', () => {
      const openRouterGemini = new ModelId('google/gemini-2.5-pro', 'OpenRouter', false);

      expect(openRouterGemini.isGemini()).toBe(false);
      expect(openRouterGemini.isOpenRouter()).toBe(true);
    });

    test('should handle free models correctly', () => {
      const freeModel = new ModelId('deepseek/deepseek-r1-0528:free', 'OpenRouter', true);
      const paidModel = new ModelId('deepseek/deepseek-r1-0528', 'OpenRouter', false);

      expect(freeModel.isFree).toBe(true);
      expect(paidModel.isFree).toBe(false);
      expect(freeModel.isOpenRouter()).toBe(true);
      expect(paidModel.isOpenRouter()).toBe(true);
    });
  });

  describe('toString method', () => {
    test('should return model value as string', () => {
      const modelId = new ModelId('test-model', 'Provider', false);
      expect(modelId.toString()).toBe('test-model');
    });
  });
});
