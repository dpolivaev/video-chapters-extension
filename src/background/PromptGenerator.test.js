/**
 * Tests for PromptGenerator
 * Validates prompt building functionality
 */

const PromptGenerator = require('./prompt-generator');

describe('PromptGenerator', () => {
  describe('buildPrompt method', () => {
    test('should delegate to buildChapterPrompt', () => {
      const promptGenerator = new PromptGenerator();

      const processedContent = 'Test subtitle content';
      const customInstructions = 'Custom test instructions';

      const result = promptGenerator.buildPrompt(processedContent, customInstructions);

      expect(typeof result).toBe('string');
      expect(result).toContain(processedContent);
      expect(result).toContain(customInstructions);
    });

    test('should handle content without custom instructions', () => {
      const promptGenerator = new PromptGenerator();

      const result = promptGenerator.buildPrompt('test content');

      expect(typeof result).toBe('string');
      expect(result).toContain('test content');
    });
  });
});
