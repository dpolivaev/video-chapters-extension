/**
 * GenerationProgress Value Object
 * Represents the progress state of chapter generation
 *
 * Copyright (C) 2025 Dimitry Polivaev
 * Licensed under GPL3 or later
 */

class GenerationProgress {
  constructor(percent, message, isComplete = false) {
    this.percent = Math.max(0, Math.min(100, Math.floor(percent)));
    this.message = message || '';
    this.isComplete = Boolean(isComplete);
    Object.freeze(this);
  }
  
  static pending() {
    return new GenerationProgress(30, 'Generating chapters...');
  }
  
  static inProgress(message = 'Still generating chapters...') {
    return new GenerationProgress(60, message);
  }
  
  static longRunning(message = 'Generation is taking longer than expected...') {
    return new GenerationProgress(90, message);
  }
  
  static completed() {
    return new GenerationProgress(100, 'Chapters generated successfully!', true);
  }
  
  static failed(error) {
    const message = error instanceof Error ? error.message : String(error);
    return new GenerationProgress(0, `Generation failed: ${message}`, true);
  }
  
  static timedOut() {
    return new GenerationProgress(0, 'Generation timed out. Please try again.', true);
  }
  
  isSuccessful() {
    return this.isComplete && this.percent === 100;
  }
  
  isFailed() {
    return this.isComplete && this.percent === 0;
  }
  
  isPending() {
    return !this.isComplete;
  }
  
  
  toString() {
    return `${this.percent}% - ${this.message}`;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = GenerationProgress;
}
