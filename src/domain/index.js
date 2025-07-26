/**
 * Domain Layer Exports
 * Main entry point for domain classes
 *
 * Copyright (C) 2025 Dimitry Polivaev
 * Licensed under GPL3 or later
 */

if (typeof importScripts !== 'undefined') {
  importScripts(
    'values/VideoUrl.js',
    'values/ModelId.js',
    'values/ApiCredentials.js',
    'values/GenerationProgress.js',
    'entities/VideoTranscript.js',
    'entities/ChapterGeneration.js',
    'entities/BrowserTab.js',
    'services/TranscriptExtractor.js'
  );
}
