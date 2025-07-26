/**
 * Jest Setup - Load domain classes for testing
 * Makes domain classes available globally in test environment
 *
 * Copyright (C) 2025 Dimitry Polivaev
 * Licensed under GPL3 or later
 */

const path = require('path');
const fs = require('fs');

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