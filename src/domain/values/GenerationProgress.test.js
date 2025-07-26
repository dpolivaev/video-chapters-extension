/**
 * GenerationProgress Value Object Tests
 * Tests progress state representation and factory methods
 *
 * Copyright (C) 2025 Dimitry Polivaev
 * Licensed under GPL3 or later
 */

const GenerationProgress = require('./GenerationProgress');

describe('GenerationProgress', () => {
  describe('constructor and validation', () => {
    test('should create progress with valid values', () => {
      const progress = new GenerationProgress(50, 'Processing...', false);
      expect(progress.percent).toBe(50);
      expect(progress.message).toBe('Processing...');
      expect(progress.isComplete).toBe(false);
    });

    test('should clamp percent to valid range', () => {
      const tooLow = new GenerationProgress(-10, 'message');
      const tooHigh = new GenerationProgress(150, 'message');

      expect(tooLow.percent).toBe(0);
      expect(tooHigh.percent).toBe(100);
    });

    test('should floor percent to integer', () => {
      const progress = new GenerationProgress(75.8, 'message');
      expect(progress.percent).toBe(75);
    });

    test('should handle empty or null message', () => {
      const noMessage = new GenerationProgress(50);
      const nullMessage = new GenerationProgress(50, null);

      expect(noMessage.message).toBe('');
      expect(nullMessage.message).toBe('');
    });

    test('should convert isComplete to boolean', () => {
      const truthy = new GenerationProgress(100, 'done', 'truthy');
      const falsy = new GenerationProgress(50, 'processing', 0);

      expect(truthy.isComplete).toBe(true);
      expect(falsy.isComplete).toBe(false);
    });
  });

  describe('factory methods', () => {
    test('should create pending progress', () => {
      const progress = GenerationProgress.pending();
      expect(progress.percent).toBe(30);
      expect(progress.message).toBe('Generating chapters...');
      expect(progress.isComplete).toBe(false);
    });

    test('should create in-progress with default message', () => {
      const progress = GenerationProgress.inProgress();
      expect(progress.percent).toBe(60);
      expect(progress.message).toBe('Still generating chapters...');
      expect(progress.isComplete).toBe(false);
    });

    test('should create in-progress with custom message', () => {
      const progress = GenerationProgress.inProgress('Custom progress message');
      expect(progress.percent).toBe(60);
      expect(progress.message).toBe('Custom progress message');
      expect(progress.isComplete).toBe(false);
    });

    test('should create long-running with default message', () => {
      const progress = GenerationProgress.longRunning();
      expect(progress.percent).toBe(90);
      expect(progress.message).toBe('Generation is taking longer than expected...');
      expect(progress.isComplete).toBe(false);
    });

    test('should create long-running with custom message', () => {
      const progress = GenerationProgress.longRunning('Still working on it...');
      expect(progress.percent).toBe(90);
      expect(progress.message).toBe('Still working on it...');
      expect(progress.isComplete).toBe(false);
    });

    test('should create completed progress', () => {
      const progress = GenerationProgress.completed();
      expect(progress.percent).toBe(100);
      expect(progress.message).toBe('Chapters generated successfully!');
      expect(progress.isComplete).toBe(true);
    });

    test('should create failed progress with Error object', () => {
      const error = new Error('Network timeout');
      const progress = GenerationProgress.failed(error);
      expect(progress.percent).toBe(0);
      expect(progress.message).toBe('Generation failed: Network timeout');
      expect(progress.isComplete).toBe(true);
    });

    test('should create failed progress with string error', () => {
      const progress = GenerationProgress.failed('API key invalid');
      expect(progress.percent).toBe(0);
      expect(progress.message).toBe('Generation failed: API key invalid');
      expect(progress.isComplete).toBe(true);
    });

    test('should create timed out progress', () => {
      const progress = GenerationProgress.timedOut();
      expect(progress.percent).toBe(0);
      expect(progress.message).toBe('Generation timed out. Please try again.');
      expect(progress.isComplete).toBe(true);
    });
  });

  describe('state detection', () => {
    test('should detect successful completion', () => {
      const successful = GenerationProgress.completed();
      const failed = GenerationProgress.failed('error');
      const pending = GenerationProgress.pending();

      expect(successful.isSuccessful()).toBe(true);
      expect(failed.isSuccessful()).toBe(false);
      expect(pending.isSuccessful()).toBe(false);
    });

    test('should detect failure', () => {
      const failed = GenerationProgress.failed('error');
      const timedOut = GenerationProgress.timedOut();
      const successful = GenerationProgress.completed();
      const pending = GenerationProgress.pending();

      expect(failed.isFailed()).toBe(true);
      expect(timedOut.isFailed()).toBe(true);
      expect(successful.isFailed()).toBe(false);
      expect(pending.isFailed()).toBe(false);
    });

    test('should detect pending state', () => {
      const pending = GenerationProgress.pending();
      const inProgress = GenerationProgress.inProgress();
      const completed = GenerationProgress.completed();
      const failed = GenerationProgress.failed('error');

      expect(pending.isPending()).toBe(true);
      expect(inProgress.isPending()).toBe(true);
      expect(completed.isPending()).toBe(false);
      expect(failed.isPending()).toBe(false);
    });
  });

  describe('string representation', () => {
    test('should convert to string with percent and message', () => {
      const progress = new GenerationProgress(75, 'Almost done...');
      expect(progress.toString()).toBe('75% - Almost done...');
    });

    test('should handle empty message in string conversion', () => {
      const progress = new GenerationProgress(50, '');
      expect(progress.toString()).toBe('50% - ');
    });
  });

  describe('immutability', () => {
    test('should be immutable after creation', () => {
      const progress = new GenerationProgress(50, 'Processing...', false);
      expect(Object.isFrozen(progress)).toBe(true);

      const originalPercent = progress.percent;
      const originalMessage = progress.message;
      const originalComplete = progress.isComplete;

      progress.percent = 100;
      progress.message = 'Changed';
      progress.isComplete = true;

      expect(progress.percent).toBe(originalPercent);
      expect(progress.message).toBe(originalMessage);
      expect(progress.isComplete).toBe(originalComplete);
    });
  });

  describe('edge cases', () => {
    test('should handle extreme percent values', () => {
      const veryNegative = new GenerationProgress(-1000, 'test');
      const veryPositive = new GenerationProgress(5000, 'test');

      expect(veryNegative.percent).toBe(0);
      expect(veryPositive.percent).toBe(100);
    });

    test('should handle decimal percent values', () => {
      const progress = new GenerationProgress(33.33333, 'test');
      expect(progress.percent).toBe(33);
    });

    test('should handle various falsy completion values', () => {
      const testCases = [false, 0, '', null, undefined];

      testCases.forEach(value => {
        const progress = new GenerationProgress(50, 'test', value);
        expect(progress.isComplete).toBe(false);
      });
    });

    test('should handle various truthy completion values', () => {
      const testCases = [true, 1, 'true', {}, []];

      testCases.forEach(value => {
        const progress = new GenerationProgress(50, 'test', value);
        expect(progress.isComplete).toBe(true);
      });
    });
  });
});
