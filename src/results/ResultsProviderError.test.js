/**
 * Results Page Provider Error Regression Test
 * Captures the "Provider must be a non-empty string" error
 */

const ModelId = require('../domain/values/ModelId');

describe('Results Page Provider Error', () => {
  test('should fail when creating ModelId with empty provider', () => {
    // This should FAIL - captures the current error condition
    expect(() => {
      new ModelId('test-model', '', false);
    }).toThrow('Provider must be a non-empty string');
  });

  test('should fail when creating ModelId with null provider', () => {
    // This should FAIL - captures another error condition
    expect(() => {
      new ModelId('test-model', null, false);
    }).toThrow('Provider must be a non-empty string');
  });

  test('should fail when creating ModelId with undefined provider', () => {
    // This should FAIL - captures another error condition
    expect(() => {
      new ModelId('test-model', undefined, false);
    }).toThrow('Provider must be a non-empty string');
  });

  describe('ModelId.fromJSON graceful error handling (FIXED)', () => {
    test('should handle malformed JSON data gracefully with defaults', () => {
      const malformedData = [
        { value: 'test', provider: '', isFree: false }, // Empty provider
        { value: 'test', provider: null, isFree: false }, // Null provider
        { value: 'test', provider: undefined, isFree: false }, // Undefined provider
        { value: 'test', isFree: false }, // Missing provider
        { provider: 'Test', isFree: false }, // Missing value
        null, // Null data
        undefined, // Undefined data
        'string-data', // Legacy string data
        {}  // Empty object
      ];

      // Fixed: Should not throw, should return default ModelId
      malformedData.forEach((data, _index) => {
        expect(() => {
          const result = ModelId.fromJSON(data);
          expect(result).toBeInstanceOf(ModelId);
          expect(result.value).toBe('deepseek/deepseek-r1-0528:free');
          expect(result.provider).toBe('OpenRouter');
          expect(result.isFree).toBe(true);
        }).not.toThrow();
      });
    });

    test('should handle valid JSON data correctly', () => {
      const validData = { value: 'google/gemini-2.5-pro', provider: 'OpenRouter', isFree: false };

      const result = ModelId.fromJSON(validData);

      expect(result.value).toBe('google/gemini-2.5-pro');
      expect(result.provider).toBe('OpenRouter');
      expect(result.isFree).toBe(false);
    });
  });
});
