/**
 * Regression Tests for PromptGenerator
 * Tests for buildPrompt method missing error
 */

const PromptGenerator = require('./prompt-generator');

describe('PromptGenerator Regression Tests', () => {
  describe('buildPrompt method', () => {
    test('should have buildPrompt method that delegates to buildChapterPrompt', () => {
      const promptGenerator = new PromptGenerator();

      const subtitleContent = 'Test subtitle content';
      const customInstructions = 'Custom test instructions';

      expect(() => {
        const result = promptGenerator.buildPrompt(subtitleContent, customInstructions);
        expect(typeof result).toBe('string');
        expect(result).toContain(subtitleContent);
        expect(result).toContain(customInstructions);
      }).not.toThrow();

      expect(typeof promptGenerator.buildPrompt).toBe('function');
    });

    test('should no longer throw buildPrompt is not a function error (was fixed)', () => {
      const promptGenerator = new PromptGenerator();

      expect(() => {
        promptGenerator.buildPrompt('test content', 'test instructions');
      }).not.toThrow();
    });
  });
});
