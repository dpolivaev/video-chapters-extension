/**
 * Gemini Response Parsing Tests
 * Tests Gemini API response parsing logic
 *
 * Copyright (C) 2025 Dimitry Polivaev
 * Licensed under GPL3 or later
 */

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

describe('Gemini Response Parsing', () => {
  test('should parse valid Gemini responses', () => {
    const validResponse = {
      candidates: [{
        content: {
          parts: [{ text: '1. Chapter One\n2. Chapter Two' }]
        },
        finishReason: 'STOP'
      }],
      modelVersion: 'gemini-2.5-pro'
    };

    const result = parseGeminiResponse(validResponse);
    expect(result.chapters).toBe('1. Chapter One\n2. Chapter Two');
    expect(result.finishReason).toBe('STOP');
    expect(result.model).toBe('gemini-2.5-pro');
  });

  test('should handle safety-blocked responses', () => {
    const blockedResponse = {
      candidates: [{
        finishReason: 'SAFETY'
      }]
    };

    expect(() => parseGeminiResponse(blockedResponse))
      .toThrow('Response was blocked by safety filters');
  });

  test('should handle empty responses', () => {
    const emptyResponse = {
      candidates: [{
        content: { parts: [{ text: '' }] }
      }]
    };

    expect(() => parseGeminiResponse(emptyResponse))
      .toThrow('Empty response from AI');
  });

  test('should handle malformed responses', () => {
    expect(() => parseGeminiResponse({ candidates: [] }))
      .toThrow('No candidates in response');
    
    expect(() => parseGeminiResponse({ candidates: [{}] }))
      .toThrow('No content in response');
  });

  test('should handle various data types gracefully', () => {
    expect(() => parseGeminiResponse(null)).toThrow();
    expect(() => parseGeminiResponse(undefined)).toThrow();
    expect(() => parseGeminiResponse('string')).toThrow();
  });
});