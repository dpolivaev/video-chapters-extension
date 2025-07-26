/**
 * ModelId Integration Tests
 * Tests ModelId business rules integration scenarios
 *
 * Copyright (C) 2025 Dimitry Polivaev
 * Licensed under GPL3 or later
 */

const validateModelId = (id) => {
  if (!id || typeof id !== 'string') {
    throw new Error('Model ID must be a non-empty string');
  }
  return id;
};

const extractProvider = (id) => {
  if (id.includes('gemini-')) {
    return 'Gemini';
  }
  if (id.includes('/')) {
    return 'OpenRouter';
  }
  return 'Unknown';
};

const checkIfModelIsFree = (id) => {
  return id.includes(':free');
};

const requiresApiKey = (id) => {
  const provider = extractProvider(id);
  const isFree = checkIfModelIsFree(id);

  if (provider === 'Gemini') {
    return true;
  }
  if (provider === 'OpenRouter' && !isFree) {
    return true;
  }
  return false;
};

const getModelDisplayName = (id) => {
  if (id.includes('gemini-2.5-pro')) {
    return 'Gemini 2.5 Pro';
  }
  if (id.includes('gemini-2.5-flash')) {
    return 'Gemini 2.5 Flash';
  }
  if (id.includes('deepseek-r1-0528:free')) {
    return 'DeepSeek R1 (Free)';
  }
  if (id.includes('claude-3.5-sonnet')) {
    return 'Claude 3.5 Sonnet';
  }
  if (id.includes('gpt-4o')) {
    return 'GPT-4o';
  }

  const parts = id.split('/');
  const modelPart = parts[parts.length - 1];
  return modelPart.replace(/:free$/, ' (Free)');
};

describe('ModelId Integration', () => {
  describe('Model ID validation integration', () => {
    test('should validate model IDs correctly', () => {
      expect(validateModelId('gemini-2.5-pro')).toBe('gemini-2.5-pro');
      expect(() => validateModelId('')).toThrow('Model ID must be a non-empty string');
      expect(() => validateModelId(null)).toThrow('Model ID must be a non-empty string');
      expect(() => validateModelId(123)).toThrow('Model ID must be a non-empty string');
    });

    test('should extract providers correctly', () => {
      expect(extractProvider('gemini-2.5-pro')).toBe('Gemini');
      expect(extractProvider('anthropic/claude-3.5-sonnet')).toBe('OpenRouter');
      expect(extractProvider('custom-model')).toBe('Unknown');
    });

    test('should detect free models', () => {
      expect(checkIfModelIsFree('deepseek/deepseek-r1-0528:free')).toBe(true);
      expect(checkIfModelIsFree('deepseek/deepseek-r1-0528')).toBe(false);
      expect(checkIfModelIsFree('gemini-2.5-pro')).toBe(false);
    });

    test('should determine API key requirements', () => {
      expect(requiresApiKey('gemini-2.5-pro')).toBe(true);
      expect(requiresApiKey('anthropic/claude-3.5-sonnet')).toBe(true);
      expect(requiresApiKey('deepseek/deepseek-r1-0528:free')).toBe(false);
      expect(requiresApiKey('unknown-model')).toBe(false);
    });

    test('should generate display names', () => {
      expect(getModelDisplayName('gemini-2.5-pro')).toBe('Gemini 2.5 Pro');
      expect(getModelDisplayName('deepseek/deepseek-r1-0528:free')).toBe('DeepSeek R1 (Free)');
      expect(getModelDisplayName('custom/model:free')).toBe('model (Free)');
      expect(getModelDisplayName('simple-model')).toBe('simple-model');
    });
  });

  describe('edge cases in model processing', () => {
    test('should handle edge cases in model processing', () => {
      expect(extractProvider('')).toBe('Unknown');
      expect(checkIfModelIsFree('')).toBe(false);
      expect(requiresApiKey('')).toBe(false);
    });
  });
});
