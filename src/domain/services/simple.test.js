/**
 * Simple Domain Logic Test - Demonstrates Testability
 * Shows that pure domain functions can be easily tested
 *
 * Copyright (C) 2025 Dimitry Polivaev
 * Licensed under GPL3 or later
 */

const geminiValidateApiKey = (apiKey) => {
  if (!apiKey || typeof apiKey !== 'string') {
    return false;
  }
  const apiKeyPattern = /^[A-Za-z0-9_-]+$/;
  return apiKeyPattern.test(apiKey) && apiKey.length > 10;
};

const openRouterValidateApiKey = (apiKey) => {
  if (!apiKey || typeof apiKey !== 'string') {
    return false;
  }
  const apiKeyPattern = /^sk-or-[A-Za-z0-9_-]+$/;
  return apiKeyPattern.test(apiKey) && apiKey.length > 20;
};

const parseGeminiResponse = (responseData) => {
  const candidate = responseData.candidates[0];
  if (!candidate) {
    throw new Error('No candidates in response');
  }

  if (candidate.finishReason === 'SAFETY') {
    throw new Error('Response was blocked by safety filters');
  }

  const content = candidate.content;
  if (!content || !content.parts || !content.parts[0]) {
    throw new Error('No content in response');
  }

  const text = content.parts[0].text;
  if (!text) {
    throw new Error('Empty response from AI');
  }

  return {
    chapters: text.trim(),
    finishReason: candidate.finishReason,
    model: responseData.modelVersion || 'unknown'
  };
};

describe('Domain Logic Tests', () => {
  describe('Gemini API Key Validation', () => {
    test('should reject null/undefined', () => {
      expect(geminiValidateApiKey(null)).toBe(false);
      expect(geminiValidateApiKey(undefined)).toBe(false);
    });

    test('should reject invalid characters', () => {
      expect(geminiValidateApiKey('invalid@key#here')).toBe(false);
    });

    test('should accept valid keys', () => {
      expect(geminiValidateApiKey('validApiKey123-_')).toBe(true);
    });
  });

  describe('OpenRouter API Key Validation', () => {
    test('should reject keys without sk-or prefix', () => {
      expect(openRouterValidateApiKey('invalidkey123')).toBe(false);
    });

    test('should accept valid OpenRouter keys', () => {
      expect(openRouterValidateApiKey('sk-or-validkey123456789012345')).toBe(true);
    });
  });

  describe('Gemini Response Parsing', () => {
    test('should parse valid response', () => {
      const mockResponse = {
        candidates: [{
          content: {
            parts: [{ text: '1. Chapter One\n2. Chapter Two' }]
          },
          finishReason: 'STOP'
        }],
        modelVersion: 'gemini-2.5-pro'
      };

      const result = parseGeminiResponse(mockResponse);
      expect(result.chapters).toBe('1. Chapter One\n2. Chapter Two');
      expect(result.model).toBe('gemini-2.5-pro');
    });

    test('should handle safety-blocked response', () => {
      const mockResponse = {
        candidates: [{
          finishReason: 'SAFETY'
        }]
      };

      expect(() => parseGeminiResponse(mockResponse))
        .toThrow('Response was blocked by safety filters');
    });
  });
});
