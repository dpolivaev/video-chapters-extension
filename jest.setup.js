/**
 * Jest Setup - Load domain classes for testing
 * Makes domain classes available globally in test environment
 *
 * Copyright (C) 2025 Dimitry Polivaev
 * Licensed under GPL3 or later
 */

const path = require('path');
const fs = require('fs');

global.JsModuleImporter = require('./src/lang/JsModuleImporter');

// Bootstrap all domain classes globally for Jest/Node.js
const domainClasses = {
  // Values
  VideoUrl: './src/domain/values/VideoUrl',
  ModelId: './src/domain/values/ModelId',
  ApiCredentials: './src/domain/values/ApiCredentials',
  GenerationProgress: './src/domain/values/GenerationProgress',

  // Entities
  VideoTranscript: './src/domain/entities/VideoTranscript',
  ChapterGeneration: './src/domain/entities/ChapterGeneration',
  BrowserTab: './src/domain/entities/BrowserTab',

  // Services (that don't have complex dependencies)
  NetworkCommunicator: './src/domain/services/NetworkCommunicator',
  GeminiChapterGenerator: './src/domain/services/GeminiChapterGenerator',
  OpenRouterChapterGenerator: './src/domain/services/OpenRouterChapterGenerator'
};

for (const [className, path] of Object.entries(domainClasses)) {
  if (!global[className]) {
    try {
      global[className] = require(path);
    } catch (error) {
      console.warn(`Could not load ${className} from ${path}:`, error.message);
    }
  }
}

function loadClassFromFile(filePath) {
  const fullPath = path.join(__dirname, filePath);
  const content = fs.readFileSync(fullPath, 'utf8');

  const licenseHeaderEnd = content.indexOf('*/');
  const startIndex = licenseHeaderEnd !== -1 ? licenseHeaderEnd + 2 : 0;
  const classCode = content.substring(startIndex);

  global.eval(classCode);
}

loadClassFromFile('src/domain/services/NetworkCommunicator.js');
loadClassFromFile('src/domain/services/GeminiChapterGenerator.js');
loadClassFromFile('src/domain/services/OpenRouterChapterGenerator.js');
