/**
 * Jest Configuration for Video Chapters Generator
 * Pure domain logic testing without browser dependencies
 *
 * Copyright (C) 2025 Dimitry Polivaev
 * Licensed under GPL3 or later
 */

module.exports = {
  testEnvironment: 'node',
  
  testMatch: [
    '**/src/domain/**/*.test.js'
  ],
  
  collectCoverageFrom: [
    'src/domain/**/*.js',
    '!src/domain/**/*.test.js'
  ],
  
  coverageDirectory: 'coverage',
  
  coverageReporters: [
    'text',
    'lcov',
    'html'
  ],
  
  setupFilesAfterEnv: [
    '<rootDir>/jest.setup.js'
  ],
  
  clearMocks: true,
  restoreMocks: true
};