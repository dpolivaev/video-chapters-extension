/**
 * API Error Handling Tests
 * Tests error categorization and handling logic
 *
 * Copyright (C) 2025 Dimitry Polivaev
 * Licensed under GPL3 or later
 */

const categorizeApiError = (status, errorData) => {
  if (status === 401) {
    return new Error('Invalid API key. Please check your API key.');
  } else if (status === 403) {
    return new Error('API access forbidden. Please check your API key permissions.');
  } else if (status === 429) {
    return new Error('Rate limit exceeded. Please try again later.');
  } else if (status === 400) {
    const errorMessage = errorData.error?.message || 'Bad request';
    return new Error(`Request error: ${errorMessage}`);
  } else {
    return new Error(`API request failed: ${status}`);
  }
};

describe('API Error Handling', () => {
  test('should categorize HTTP errors correctly', () => {
    expect(categorizeApiError(401, {}).message).toContain('Invalid API key');
    expect(categorizeApiError(403, {}).message).toContain('API access forbidden');
    expect(categorizeApiError(429, {}).message).toContain('Rate limit exceeded');
    
    const badRequestError = categorizeApiError(400, { error: { message: 'Custom error' } });
    expect(badRequestError.message).toContain('Custom error');
    
    expect(categorizeApiError(500, {}).message).toContain('API request failed: 500');
  });
});