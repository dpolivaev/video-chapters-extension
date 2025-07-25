# Video Chapters Generator - Refactoring Plan

## Overview
This document outlines refactoring opportunities to improve code quality, maintainability, and adherence to Domain-Driven Design (DDD) principles and single responsibility principle (SRP).

## DDD Principles Applied
Following Domain-Driven Design to create expressive, maintainable code:
- **Ubiquitous Language**: Domain-specific terminology
- **Bounded Contexts**: Clear separation of concerns
- **Value Objects**: Immutable domain concepts
- **Domain Services**: Business logic operations
- **Anti-Pattern Avoidance**: No generic *Controller, *Manager, *Provider suffixes

## ✅ Completed Refactoring
- **Dead Code Removal**: Removed unused chapter formatting methods (~100 lines of dead code)

## 🔧 Priority Refactoring Opportunities

### 1. **PopupView Class (popup.js) - God Class [HIGH PRIORITY]**

**Current Issues:**
- **700+ lines** in single class
- **Multiple responsibilities**: UI management, settings, video detection, API calls, model validation
- **Complex methods**: `loadCurrentVideo()`, `generateChapters()`, `updateGenerateButtonState()`
- **Mixed concerns**: Business logic intertwined with DOM manipulation

**DDD-Compliant Refactoring:**

```javascript
// Value Objects - Immutable domain concepts
class VideoUrl {
  constructor(url) {
    this.value = this.validate(url);
  }
  
  validate(url) {
    if (!url.includes('youtube.com/watch') && !url.includes('youtube.com/shorts')) {
      throw new Error('Invalid YouTube URL');
    }
    return this.clean(url);
  }
  
  clean(url) {
    // Remove unnecessary parameters
    return url.split('&')[0];
  }
}

class ModelId {
  constructor(id) {
    this.value = id;
    this.provider = this.extractProvider(id);
    this.isFree = id.includes(':free');
  }
  
  extractProvider(id) {
    if (id.includes('gemini-')) return 'Gemini';
    if (id.includes('/')) return 'OpenRouter';
    return 'Unknown';
  }
}

class ApiCredentials {
  constructor(geminiKey = '', openRouterKey = '') {
    this.geminiKey = geminiKey;
    this.openRouterKey = openRouterKey;
  }
  
  canUseModel(modelId) {
    const model = new ModelId(modelId);
    if (model.provider === 'Gemini') return !!this.geminiKey;
    if (model.provider === 'OpenRouter' && !model.isFree) return !!this.openRouterKey;
    return true;
  }
}

// Domain Services - Business operations
class YouTubeVideoDiscovery {
  async findCurrentVideo(tab) {
    if (this.isResultsPage(tab)) {
      return this.loadFromSession(tab);
    }
    return this.extractFromYouTube(tab);
  }
  
  isResultsPage(tab) {
    return tab.url.includes('results/results.html');
  }
  
  async loadFromSession(tab) {
    // Load video data from session
  }
  
  async extractFromYouTube(tab) {
    // Extract from YouTube page
  }
}

class TranscriptExtractor {
  async extractFromTab(tabId) {
    const response = await browser.tabs.sendMessage(tabId, {
      action: "copyTranscript"
    });
    
    if (response?.status === "success") {
      return new VideoTranscript(response.transcript, response.title, response.author);
    }
    
    throw new Error('Failed to extract transcript');
  }
}

class ModelSelection {
  constructor(availableModels, credentials) {
    this.availableModels = availableModels;
    this.credentials = credentials;
  }
  
  validate(modelId) {
    const model = new ModelId(modelId);
    return {
      isValid: this.credentials.canUseModel(modelId),
      requiresKey: this.requiresApiKey(model),
      provider: model.provider
    };
  }
  
  requiresApiKey(model) {
    return model.provider === 'Gemini' || 
           (model.provider === 'OpenRouter' && !model.isFree);
  }
}

// Entities - Core domain objects
class VideoTranscript {
  constructor(content, title, author) {
    this.content = content;
    this.title = title;
    this.author = author;
    this.extractedAt = new Date();
  }
  
  toSubtitleContent() {
    return `Video Title: ${this.title}\n\nTranscript Content:\n${this.content}`;
  }
}

class ChapterGeneration {
  constructor(videoTranscript, modelId, customInstructions = '') {
    this.id = Date.now();
    this.videoTranscript = videoTranscript;
    this.modelId = modelId;
    this.customInstructions = customInstructions;
    this.status = 'pending';
    this.result = null;
    this.error = null;
    this.createdAt = new Date();
  }
  
  markCompleted(chapters) {
    this.status = 'completed';
    this.result = chapters;
  }
  
  markFailed(error) {
    this.status = 'failed';
    this.error = error;
  }
}

// Aggregates - Group related entities
class PopupSession {
  constructor() {
    this.currentVideo = null;
    this.modelSelection = null;
    this.credentials = null;
    this.isProcessing = false;
  }
  
  setVideo(videoTranscript) {
    this.currentVideo = videoTranscript;
  }
  
  canGenerateChapters() {
    return this.currentVideo && 
           this.modelSelection?.validate(this.modelSelection.selectedModel).isValid &&
           !this.isProcessing;
  }
  
  startGeneration(modelId, customInstructions) {
    if (!this.canGenerateChapters()) {
      throw new Error('Cannot start generation');
    }
    
    this.isProcessing = true;
    return new ChapterGeneration(this.currentVideo, modelId, customInstructions);
  }
}
```

### 2. **BackgroundService Class (background.js) - Message Handler Monolith [HIGH PRIORITY]**

**Current Issues:**
- **550+ lines** with giant switch statement
- **15+ message types** in single method
- **Mixed storage concerns**: Sessions, settings, tabs all managed together
- **Global state variables** scattered throughout file

**DDD-Compliant Refactoring:**

```javascript
// Domain Entities
class GenerationSession {
  constructor(id, videoTranscript, modelId, customInstructions) {
    this.id = id;
    this.videoTranscript = videoTranscript;
    this.modelId = modelId;
    this.customInstructions = customInstructions;
    this.status = 'pending';
    this.chapters = null;
    this.error = null;
    this.createdAt = new Date();
  }
  
  complete(chapters) {
    this.status = 'completed';
    this.chapters = chapters;
  }
  
  fail(error) {
    this.status = 'failed';
    this.error = error;
  }
}

class BrowserTab {
  constructor(id, url, type) {
    this.id = id;
    this.url = new VideoUrl(url);
    this.type = type; // 'video' | 'results'
  }
  
  isYouTubeVideo() {
    return this.type === 'video';
  }
  
  isResultsPage() {
    return this.type === 'results';
  }
}

// Repositories - Data access abstraction
class SessionRepository {
  constructor() {
    this.sessions = new Map();
    this.sessionsByTab = new Map();
  }
  
  save(session) {
    this.sessions.set(session.id, session);
  }
  
  findById(sessionId) {
    return this.sessions.get(sessionId);
  }
  
  findByTabId(tabId) {
    return this.sessionsByTab.get(tabId);
  }
  
  associateWithTab(sessionId, tabId) {
    this.sessionsByTab.set(tabId, sessionId);
  }
}

class TabRegistry {
  constructor() {
    this.tabs = new Map();
    this.videoTab = null;
  }
  
  register(tab) {
    this.tabs.set(tab.id, tab);
    if (tab.isYouTubeVideo()) {
      this.videoTab = tab;
    }
  }
  
  unregister(tabId) {
    this.tabs.delete(tabId);
    if (this.videoTab?.id === tabId) {
      this.videoTab = null;
    }
  }
  
  findById(tabId) {
    return this.tabs.get(tabId);
  }
  
  getCurrentVideoTab() {
    return this.videoTab;
  }
}

// Domain Services
class ChapterGenerator {
  constructor(geminiAPI, openRouterAPI) {
    this.geminiAPI = geminiAPI;
    this.openRouterAPI = openRouterAPI;
  }
  
  async generateChapters(session, credentials) {
    try {
      const modelId = new ModelId(session.modelId);
      let result;
      
      if (modelId.provider === 'Gemini') {
        result = await this.geminiAPI.processSubtitles(
          session.videoTranscript.toSubtitleContent(),
          session.customInstructions,
          credentials.geminiKey,
          session.modelId
        );
      } else {
        result = await this.openRouterAPI.processSubtitles(
          session.videoTranscript.toSubtitleContent(),
          session.customInstructions,
          credentials.openRouterKey,
          session.modelId
        );
      }
      
      session.complete(result.chapters);
      return session;
    } catch (error) {
      session.fail(error.message);
      throw error;
    }
  }
}

class TabNavigator {
  constructor(tabRegistry) {
    this.tabRegistry = tabRegistry;
  }
  
  async openResultsPage(sessionId, videoTab) {
    const url = browser.runtime.getURL(`results/results.html?resultId=${sessionId}`);
    
    // Check if results tab already exists for this session
    const existingTab = this.findResultsTabForSession(sessionId);
    if (existingTab) {
      await browser.tabs.update(existingTab.id, { active: true });
      return existingTab;
    }
    
    const resultsTab = await browser.tabs.create({ url });
    this.tabRegistry.register(new BrowserTab(resultsTab.id, url, 'results'));
    return resultsTab;
  }
  
  async returnToVideo() {
    const videoTab = this.tabRegistry.getCurrentVideoTab();
    if (!videoTab) {
      throw new Error('No video tab available');
    }
    
    await browser.tabs.update(videoTab.id, { active: true });
    return videoTab;
  }
}

// Application Services - Coordinate use cases
class ExtensionMessageBus {
  constructor(sessionRepo, tabRegistry, chapterGenerator, tabNavigator) {
    this.sessionRepo = sessionRepo;
    this.tabRegistry = tabRegistry;
    this.chapterGenerator = chapterGenerator;
    this.tabNavigator = tabNavigator;
    
    this.messageHandlers = new Map([
      ['processWithGemini', this.handleChapterGeneration.bind(this)],
      ['setSessionResults', this.handleSetSession.bind(this)],
      ['getSessionResults', this.handleGetSession.bind(this)],
      ['openResultsTab', this.handleOpenResults.bind(this)],
      ['goBackToVideo', this.handleReturnToVideo.bind(this)],
      ['saveSettings', this.handleSaveSettings.bind(this)],
      ['loadSettings', this.handleLoadSettings.bind(this)]
    ]);
  }
  
  async handleMessage(request, sender, sendResponse) {
    const handler = this.messageHandlers.get(request.action);
    if (handler) {
      try {
        const result = await handler(request, sender);
        sendResponse({ success: true, data: result });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    } else {
      sendResponse({ success: false, error: 'Unknown action' });
    }
  }
  
  async handleChapterGeneration(request, sender) {
    const session = new GenerationSession(
      request.resultId,
      new VideoTranscript(request.subtitleContent),
      request.model,
      request.customInstructions
    );
    
    this.sessionRepo.save(session);
    
    const credentials = new ApiCredentials(request.apiKey);
    return this.chapterGenerator.generateChapters(session, credentials);
  }
  
  async handleSetSession(request) {
    const session = GenerationSession.fromResults(request.results);
    this.sessionRepo.save(session);
    return session.id;
  }
  
  async handleGetSession(request) {
    const session = this.sessionRepo.findById(request.resultId);
    if (!session) {
      throw new Error('Session not found');
    }
    return session.toResults();
  }
}
```
```

### 3. **ResultsView Class (results.js) - Mixed UI Concerns [MEDIUM PRIORITY]**

**Current Issues:**
- **400+ lines** with multiple responsibilities
- **Polling logic** embedded in main class
- **Mixed formatting and UI concerns**

**DDD-Compliant Refactoring:**

```javascript
// Value Objects
class GenerationProgress {
  constructor(percent, message, isComplete = false) {
    this.percent = Math.max(0, Math.min(100, percent));
    this.message = message;
    this.isComplete = isComplete;
  }
  
  static pending() {
    return new GenerationProgress(30, 'Generating chapters...');
  }
  
  static inProgress(message) {
    return new GenerationProgress(60, message);
  }
  
  static completed() {
    return new GenerationProgress(100, 'Complete', true);
  }
  
  static failed(error) {
    return new GenerationProgress(0, `Failed: ${error}`, true);
  }
}

class ChapterCollection {
  constructor(chapters, videoMetadata, generatedAt) {
    this.chapters = chapters;
    this.videoMetadata = videoMetadata;
    this.generatedAt = generatedAt;
  }
  
  getDisplayText() {
    return this.chapters;
  }
  
  isEmpty() {
    return !this.chapters || this.chapters.trim() === '';
  }
}

// Domain Services  
class GenerationStatusTracker {
  constructor(sessionId) {
    this.sessionId = sessionId;
    this.pollInterval = null;
    this.timeoutHandle = null;
    this.observers = [];
  }
  
  subscribe(observer) {
    this.observers.push(observer);
  }
  
  async startTracking() {
    this.pollInterval = setInterval(async () => {
      try {
        const status = await this.checkStatus();
        this.notifyObservers(status);
        
        if (status.isComplete) {
          this.stopTracking();
        }
      } catch (error) {
        this.notifyObservers(GenerationProgress.failed(error.message));
        this.stopTracking();
      }
    }, 2000);
    
    // Set timeout for long-running generations
    this.timeoutHandle = setTimeout(() => {
      this.notifyObservers(GenerationProgress.failed('Generation timed out'));
      this.stopTracking();
    }, 5 * 60 * 1000);
  }
  
  stopTracking() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = null;
    }
  }
  
  async checkStatus() {
    const response = await browser.runtime.sendMessage({
      action: "getGenerationStatus",
      resultId: this.sessionId
    });
    
    if (response?.success) {
      switch (response.status) {
        case 'done':
          return GenerationProgress.completed();
        case 'error':
          return GenerationProgress.failed('Generation failed');
        default:
          return GenerationProgress.inProgress('Still generating...');
      }
    }
    
    throw new Error('Failed to check status');
  }
  
  notifyObservers(progress) {
    this.observers.forEach(observer => observer(progress));
  }
}

class ClipboardWriter {
  async writeText(text, contentType) {
    if (!text?.trim()) {
      throw new Error(`No ${contentType} to copy`);
    }
    
    try {
      await navigator.clipboard.writeText(text);
      return `${contentType} copied to clipboard!`;
    } catch (error) {
      throw new Error('Failed to copy to clipboard');
    }
  }
}

// Application Services
class ResultsPageOrchestrator {
  constructor(sessionId) {
    this.sessionId = sessionId;
    this.statusTracker = new GenerationStatusTracker(sessionId);
    this.clipboardWriter = new ClipboardWriter();
    this.currentSession = null;
    this.ui = new ResultsPageUI();
  }
  
  async initialize() {
    try {
      await this.loadSession();
      this.setupEventHandlers();
      
      if (this.currentSession.status === 'pending') {
        this.startStatusTracking();
      }
      
      this.ui.render(this.currentSession);
    } catch (error) {
      this.ui.showError(error.message);
    }
  }
  
  async loadSession() {
    const response = await browser.runtime.sendMessage({
      action: "getSessionResults",
      resultId: this.sessionId
    });
    
    if (!response?.success || !response.results) {
      throw new Error('Session not found');
    }
    
    this.currentSession = GenerationSession.fromResults(response.results);
  }
  
  setupEventHandlers() {
    this.ui.onCopyChapters(() => this.copyContent('chapters'));
    this.ui.onCopySubtitles(() => this.copyContent('subtitles'));
    this.ui.onBackToVideo(() => this.navigateToVideo());
  }
  
  startStatusTracking() {
    this.statusTracker.subscribe((progress) => {
      this.ui.updateProgress(progress);
      
      if (progress.isComplete && !progress.message.includes('Failed')) {
        this.loadSession(); // Refresh session data
      }
    });
    
    this.statusTracker.startTracking();
  }
  
  async copyContent(contentType) {
    try {
      const text = contentType === 'chapters' 
        ? this.currentSession.chapters
        : this.currentSession.videoTranscript.content;
        
      const message = await this.clipboardWriter.writeText(text, contentType);
      this.ui.showNotification(message, 'success');
    } catch (error) {
      this.ui.showNotification(error.message, 'error');
    }
  }
  
  async navigateToVideo() {
    try {
      await browser.runtime.sendMessage({ action: "goBackToVideo" });
    } catch (error) {
      this.ui.showNotification('Failed to navigate to video', 'error');
    }
  }
}

// UI Layer - Separate from business logic
class ResultsPageUI {
  constructor() {
    this.elements = {
      progressSection: document.getElementById('progressSection'),
      progressFill: document.getElementById('progressFill'),
      progressMessage: document.getElementById('progressMessage'),
      chaptersContent: document.getElementById('chaptersContent'),
      subtitlesContent: document.getElementById('subtitlesContent'),
      videoTitle: document.getElementById('videoTitle'),
      videoAuthor: document.getElementById('videoAuthor')
    };
  }
  
  render(session) {
    this.updateVideoInfo(session.videoTranscript);
    this.updateChapters(session.chapters);
    this.updateSubtitles(session.videoTranscript.content);
  }
  
  updateProgress(progress) {
    this.elements.progressFill.style.width = `${progress.percent}%`;
    this.elements.progressMessage.textContent = progress.message;
    
    if (progress.isComplete) {
      this.elements.progressSection.style.display = 'none';
    }
  }
  
  showError(message) {
    // Error display logic
  }
  
  showNotification(message, type) {
    // Notification display logic
  }
  
  onCopyChapters(handler) {
    document.getElementById('copyChaptersBtn').addEventListener('click', handler);
  }
  
  onCopySubtitles(handler) {
    document.getElementById('copySubtitlesBtn').addEventListener('click', handler);
  }
  
  onBackToVideo(handler) {
    document.getElementById('backBtn').addEventListener('click', handler);
  }
}
```

### 4. **Global State Elimination [HIGH PRIORITY]**

**Current Issues:**
```javascript
// background.js - Global variables everywhere
let sessionResults = null;
let resultsTabId = null;
let videoTabId = null; 
let videoUrl = null;
let resultsTabsById = {};
let resultsById = {};
let generationStatusById = {};
```

**Solution:**
- Move all state into `ApplicationState` class
- Pass state through dependency injection
- Remove global variable access

### 5. **Error Handling Standardization [MEDIUM PRIORITY]**

**Current Issues:**
- **Scattered try-catch blocks**
- **Inconsistent error responses**
- **Mixed error handling patterns**

**Suggested Refactoring:**

```javascript
class ErrorHandler {
  static createResponse(success, data = null, error = null) {
    return { success, data, error };
  }
  
  static handleAsyncOperation(operation) {
    return async (...args) => {
      try {
        const result = await operation(...args);
        return ErrorHandler.createResponse(true, result);
      } catch (error) {
        console.error("Operation failed:", error);
        return ErrorHandler.createResponse(false, null, error.message);
      }
    };
  }
  
  static wrapMessageHandler(handler) {
    return async (request, sender, sendResponse) => {
      try {
        const result = await handler(request, sender);
        sendResponse(ErrorHandler.createResponse(true, result));
      } catch (error) {
        console.error("Message handler failed:", error);
        sendResponse(ErrorHandler.createResponse(false, null, error.message));
      }
    };
  }
}
```

## 🎯 **DDD-Based Implementation Strategy**

### Phase 1: Domain Foundation (Week 1)
1. **Value Objects** - Immutable domain concepts
   - `VideoUrl`, `ModelId`, `ApiCredentials`
   - `GenerationProgress`, `Timecode`
   
2. **Entities** - Core domain objects
   - `VideoTranscript`, `ChapterGeneration`
   - `GenerationSession`, `BrowserTab`

3. **Domain Services** - Business operations
   - `TranscriptExtractor`, `ChapterGenerator`
   - `YouTubeVideoDiscovery`

### Phase 2: Repositories & Infrastructure (Week 2)
1. **Repository Layer** - Data access abstraction
   - `SessionRepository`, `SettingsRepository`
   - `TabRegistry`

2. **Domain Services** - Complex business logic
   - `GenerationStatusTracker`, `ClipboardWriter`
   - `TabNavigator`

### Phase 3: Application Services (Week 3)
1. **Orchestrators** - Coordinate use cases
   - `ResultsPageOrchestrator`
   - `ExtensionMessageBus`

2. **Anti-corruption Layer** - Interface with browser APIs
   - Wrap browser extension APIs
   - Clean domain boundaries

### Phase 4: UI Layer & Integration (Week 4)
1. **UI Components** - Pure presentation
   - `ResultsPageUI`, `PopupUI`
   - Event handling with callbacks

2. **Integration Testing**
   - End-to-end workflows
   - Domain model validation

## 📊 **Expected Benefits**

### Domain-Driven Design Advantages
- **Ubiquitous Language**: Code matches business terminology
- **Rich Domain Model**: Business logic encapsulated in domain objects
- **Clear Boundaries**: Well-defined contexts and responsibilities
- **Expressive Code**: Classes and methods reflect domain concepts

### Code Quality
- **Reduced complexity**: Value objects and entities encapsulate behavior
- **Better testability**: Pure domain logic, isolated from infrastructure
- **Improved readability**: Domain-centric naming and structure
- **Type Safety**: Value objects prevent invalid states

### Maintainability  
- **Easier debugging**: Domain concepts map to real-world problems
- **Safer changes**: Bounded contexts limit impact of modifications
- **Better documentation**: Self-documenting domain model
- **Knowledge Preservation**: Business rules captured in code

### Development Velocity
- **Faster feature development**: Rich domain model provides building blocks
- **Easier onboarding**: Domain concepts are intuitive
- **Reduced bugs**: Value objects prevent invalid data
- **Evolutionary Architecture**: Clean boundaries enable safe refactoring

## 🚨 **Risks & Mitigation**

### Risks
- **Temporary instability** during refactoring
- **Increased complexity** if over-engineered
- **Breaking existing functionality**

### Mitigation
- **Incremental refactoring** - one component at a time
- **Comprehensive testing** after each phase
- **Keep existing functionality** as integration tests
- **Rollback plan** for each phase

## 📋 **Validation Checklist**

After each refactoring phase:
- [ ] All existing functionality works
- [ ] Build passes successfully  
- [ ] No new console errors
- [ ] Extension loads in both Chrome and Firefox
- [ ] Chapter generation works end-to-end
- [ ] Settings save/load correctly
- [ ] Results page displays properly

---

*This refactoring plan prioritizes maintainability and code quality while preserving all existing functionality.*