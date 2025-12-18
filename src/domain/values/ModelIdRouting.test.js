/**
 * ModelId Integration Tests
 * Tests the specific bug fix for OpenRouter Gemini routing
 *
 * Copyright (C) 2025 Dimitry Polivaev
 * Licensed under GPL3 or later
 */

const ModelId = require('./ModelId');

describe('ModelId Routing Bug Fix', () => {
  describe('OpenRouter Gemini routing', () => {
    test('should route direct Gemini models to Gemini API', () => {
      const directGemini = new ModelId('gemini-2.5-pro', 'Gemini', false);

      // Should use Gemini API
      expect(directGemini.isGemini()).toBe(true);
      expect(directGemini.isOpenRouter()).toBe(false);
    });

    test('should route OpenRouter Gemini models to OpenRouter API (bug fix)', () => {
      // This was the bug: OpenRouter Gemini models were incorrectly routed to Gemini API
      const openRouterGemini = new ModelId('google/gemini-2.5-pro', 'OpenRouter', false);

      // Should use OpenRouter API, NOT Gemini API
      expect(openRouterGemini.isOpenRouter()).toBe(true);
      expect(openRouterGemini.isGemini()).toBe(false);
    });

    test('should handle both Gemini variants correctly', () => {
      const directGeminiPro = new ModelId('gemini-2.5-pro', 'Gemini', false);
      const directGeminiFlash = new ModelId('gemini-3-flash-preview', 'Gemini', false);
      const openRouterGeminiPro = new ModelId('google/gemini-2.5-pro', 'OpenRouter', false);
      const openRouterGeminiFlash = new ModelId('google/gemini-3-flash-preview', 'OpenRouter', false);

      // Direct Gemini models
      expect(directGeminiPro.isGemini()).toBe(true);
      expect(directGeminiFlash.isGemini()).toBe(true);

      // OpenRouter Gemini models
      expect(openRouterGeminiPro.isOpenRouter()).toBe(true);
      expect(openRouterGeminiFlash.isOpenRouter()).toBe(true);

      // Verify no cross-contamination
      expect(openRouterGeminiPro.isGemini()).toBe(false);
      expect(directGeminiPro.isOpenRouter()).toBe(false);
    });
  });

  describe('API key routing simulation', () => {
    test('should determine correct API key type for direct Gemini', () => {
      const directGemini = new ModelId('gemini-2.5-pro', 'Gemini', false);

      // Simulate popup logic
      const shouldUseGeminiApiKey = directGemini.isGemini();
      const shouldUseOpenRouterApiKey = directGemini.isOpenRouter();

      expect(shouldUseGeminiApiKey).toBe(true);
      expect(shouldUseOpenRouterApiKey).toBe(false);
    });

    test('should determine correct API key type for OpenRouter Gemini', () => {
      const openRouterGemini = new ModelId('google/gemini-2.5-pro', 'OpenRouter', false);

      // Simulate popup logic
      const shouldUseGeminiApiKey = openRouterGemini.isGemini();
      const shouldUseOpenRouterApiKey = openRouterGemini.isOpenRouter();

      expect(shouldUseGeminiApiKey).toBe(false);
      expect(shouldUseOpenRouterApiKey).toBe(true);
    });
  });

  describe('JSON storage integration', () => {
    test('should maintain routing behavior after JSON serialization cycle', () => {
      const original = new ModelId('google/gemini-2.5-pro', 'OpenRouter', false);

      // Serialize (popup saves to storage)
      const jsonData = original.toJSON();

      // Deserialize (settings load from storage)
      const restored = ModelId.fromJSON(jsonData);

      // Routing behavior should be identical
      expect(restored.isOpenRouter()).toBe(original.isOpenRouter());
      expect(restored.isGemini()).toBe(original.isGemini());
      expect(restored.isOpenRouter()).toBe(true);
      expect(restored.isGemini()).toBe(false);
    });
  });
});
