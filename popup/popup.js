if (typeof browser === 'undefined') {
  var browser = chrome;
}
// Simple test to verify popup script loads
console.log('POPUP SCRIPT LOADED - Extension popup is initializing...');
console.log('Document ready state:', document.readyState);

// Update debug status immediately
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOMContentLoaded fired in popup');
});

console.log('About to define PopupManager class...');

/**
 * Main Popup Script for Video Chapters Generator
 * Handles UI interactions, video processing, and communication with content scripts
 */

class PopupManager {
  constructor() {
    this.currentVideo = null;
    this.isProcessing = false;
    this.settings = null;
    
    this.init();
  }

  /**
   * Initialize the popup
   */
  async init() {
    try {
      console.log('PopupManager: Starting initialization...');
      console.log('PopupManager: Step 1 - loadSettings');
      await this.loadSettings();
      console.log('PopupManager: Step 1 complete');
      console.log('PopupManager: Step 2 - loadCurrentVideo');
      await this.loadCurrentVideo();
      console.log('PopupManager: Step 2 complete');
      console.log('PopupManager: Step 3 - setupEventListeners');
      this.setupEventListeners();
      console.log('PopupManager: Step 3 complete');
      console.log('PopupManager: Step 4 - updateUI');
      await this.updateUI();
      console.log('PopupManager: Step 4 complete');
      // Hide the debugStatus bar after successful initialization
      // const debugStatus = document.getElementById('debugStatus');
      // if (debugStatus) {
      //   debugStatus.style.display = 'none';
      // }
      console.log('PopupManager: Initialization completed successfully');
    } catch (error) {
      console.error('PopupManager: Error initializing popup:', error, error && error.stack);
      this.showNotification('Error initializing extension', 'error');
      // Show error in debugStatus
      // const debugStatus = document.getElementById('debugStatus');
      // if (debugStatus) {
      //   debugStatus.textContent = '❌ ' + (error && error.message ? error.message : 'Popup failed to load');
      //   debugStatus.style.background = 'red';
      //   debugStatus.style.color = 'white';
      //   debugStatus.style.display = 'block';
      // }
    }
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Generate button
    document.getElementById('generateBtn').addEventListener('click', () => {
      this.generateChapters();
    });

    // Clear API key button
    document.getElementById('clearDynamicApiKeyBtn').addEventListener('click', () => {
      this.clearDynamicApiKey();
    });

    // Settings button
    document.getElementById('settingsBtn').addEventListener('click', () => {
      this.openOptions();
    });

    // View results button
    document.getElementById('viewResultsBtn').addEventListener('click', () => {
      this.viewResults();
    });

    // Input change listeners
    document.getElementById('dynamicApiKeyInput').addEventListener('input', () => {
      this.onSettingsChange();
    });

    document.getElementById('modelSelect').addEventListener('change', () => {
      this.updateApiKeyField();
      this.onSettingsChange();
    });

    // Instructions textarea
    const instructionsTextarea = document.getElementById('instructionsTextarea');
    instructionsTextarea.addEventListener('input', () => {
      this.onInstructionsChange();
    });

    // Save instructions when popup closes
    window.addEventListener('beforeunload', () => {
      this.saveCustomInstructions();
    });

    window.addEventListener('pagehide', () => {
      this.saveCustomInstructions();
    });

    window.addEventListener('blur', () => {
      this.saveCustomInstructions();
    });
  }

  /**
   * Load settings from background script
   */
  async loadSettings() {
    console.log('PopupManager: loadSettings called');
    try {
      const response = await browser.runtime.sendMessage({ action: 'loadSettings' });
      console.log('PopupManager: loadSettings response:', response);
      
      if (response && response.success) {
        this.settings = response.data;
        console.log('PopupManager: Settings loaded successfully:', this.settings);
        this.applySettingsToUI();
        return;
      } else {
        console.error('PopupManager: Failed to load settings:', response);
        throw new Error(response?.error || 'Failed to load settings');
      }
    } catch (error) {
      console.error('PopupManager: loadSettings error:', error);
      throw error;
    }
  }

  /**
   * Apply settings to UI elements
   */
  async applySettingsToUI() {
    console.log('PopupManager: applySettingsToUI called');
    console.log('PopupManager: Current settings:', this.settings);
    
    if (!this.settings) {
      console.log('PopupManager: No settings to apply');
      return;
    }

    const modelSelect = document.getElementById('modelSelect');
    
    console.log('PopupManager: Setting model select value:', this.settings.model);
    
    // Load models and set selected model
    await this.loadModels();
    modelSelect.value = this.settings.model || 'deepseek/deepseek-r1-0528:free';
    
    // Update the API key field based on selected model
    this.updateApiKeyField();
    
    // Restore custom instructions
    this.restoreCustomInstructions();
    
    // Update generate button state based on API keys
    console.log('PopupManager: Updating generate button state from applySettingsToUI');
    this.updateGenerateButtonState();
    // Update video meta line if currentVideo is present
    if (this.currentVideo) {
      this.displayVideoInfo();
    }
  }

  /**
   * Load available models from background
   */
  async loadModels() {
    try {
      const response = await browser.runtime.sendMessage({ action: 'getAllModels' });
      
      if (response && response.success) {
        const modelSelect = document.getElementById('modelSelect');
        modelSelect.innerHTML = ''; // Clear existing options
        
        const models = response.data;
        
        // Group models by provider
        const providers = {};
        models.forEach(model => {
          if (!providers[model.provider]) {
            providers[model.provider] = [];
          }
          providers[model.provider].push(model);
        });
        
        // Add OpenRouter models first (prioritize free models)
        if (providers.OpenRouter) {
          const openRouterGroup = document.createElement('optgroup');
          openRouterGroup.label = 'OpenRouter';
          
          // Sort to put free models first
          providers.OpenRouter.sort((a, b) => {
            if (a.isFree && !b.isFree) return -1;
            if (!a.isFree && b.isFree) return 1;
            return a.name.localeCompare(b.name);
          });
          
          providers.OpenRouter.forEach(model => {
            const option = document.createElement('option');
            option.value = model.id;
            option.textContent = model.name;
            option.title = model.description;
            openRouterGroup.appendChild(option);
          });
          
          modelSelect.appendChild(openRouterGroup);
        }
        
        // Add Gemini models
        if (providers.Gemini) {
          const geminiGroup = document.createElement('optgroup');
          geminiGroup.label = 'Gemini';
          
          providers.Gemini.forEach(model => {
            const option = document.createElement('option');
            option.value = model.id;
            option.textContent = model.name;
            option.title = model.description;
            geminiGroup.appendChild(option);
          });
          
          modelSelect.appendChild(geminiGroup);
        }
        
        console.log('PopupManager: Models loaded successfully:', models.length);
      } else {
        console.error('PopupManager: Failed to load models:', response);
        // Fallback to basic options
        this.loadFallbackModels();
      }
    } catch (error) {
      console.error('PopupManager: Error loading models:', error);
      // Fallback to basic options
      this.loadFallbackModels();
    }
  }

  /**
   * Load fallback models if API fails
   */
  loadFallbackModels() {
    const modelSelect = document.getElementById('modelSelect');
    modelSelect.innerHTML = `
      <optgroup label="OpenRouter">
        <option value="deepseek/deepseek-r1-0528:free">DeepSeek R1 0528 (Free)</option>
        <option value="deepseek/deepseek-r1-0528">DeepSeek R1 0528</option>
        <option value="deepseek/deepseek-r1">DeepSeek R1</option>
        <option value="deepseek/deepseek-r1-distill-qwen-1.5b">DeepSeek R1 Distill 1.5B</option>
      </optgroup>
      <optgroup label="Gemini">
        <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
        <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
      </optgroup>
    `;
  }

  /**
   * Update the API key field based on the selected model
   */
  updateApiKeyField() {
    const modelSelect = document.getElementById('modelSelect');
    const dynamicApiKeyInput = document.getElementById('dynamicApiKeyInput');
    const apiKeyLabel = document.getElementById('apiKeyLabel');
    const apiKeyInfo = document.getElementById('apiKeyInfo');
    const apiKeyGroup = document.getElementById('apiKeyGroup');
    
    const selectedModel = modelSelect.value;
    
    if (selectedModel.includes('gemini-')) {
      // Gemini model selected
      apiKeyLabel.textContent = 'Gemini API Key:';
      dynamicApiKeyInput.placeholder = 'Enter your Gemini API key';
      dynamicApiKeyInput.value = this.settings?.apiKey || '';
      apiKeyInfo.style.display = 'none';
      apiKeyGroup.style.display = 'block';
      
    } else if (selectedModel.includes('deepseek/')) {
      if (selectedModel.includes(':free')) {
        // Free model selected - no API key needed
        apiKeyGroup.style.display = 'none';
      } else {
        // Paid OpenRouter model selected
        apiKeyLabel.textContent = 'OpenRouter API Key:';
        dynamicApiKeyInput.placeholder = 'Enter your OpenRouter API key';
        dynamicApiKeyInput.value = this.settings?.openRouterApiKey || '';
        apiKeyInfo.style.display = 'none';
        apiKeyGroup.style.display = 'block';
      }
    } else {
      // Unknown model - show generic field
      apiKeyLabel.textContent = 'API Key:';
      dynamicApiKeyInput.placeholder = 'Enter your API key';
      dynamicApiKeyInput.value = '';
      apiKeyInfo.innerHTML = '<small>Unknown model selected</small>';
      apiKeyInfo.style.display = 'block';
      apiKeyGroup.style.display = 'block';
    }
    
    console.log('PopupManager: Updated API key field for model:', selectedModel);
  }

  /**
   * Restore custom instructions from storage
   */
  async restoreCustomInstructions() {
    try {
      const result = await browser.storage.local.get('lastCustomInstructions');
      const lastInstructions = result.lastCustomInstructions;
      
      if (lastInstructions && lastInstructions.trim()) {
        const instructionsTextarea = document.getElementById('instructionsTextarea');
        instructionsTextarea.value = lastInstructions;
        console.log('PopupManager: Restored custom instructions');
        
        // Trigger UI update
        if (window.instructionHistory) {
          window.instructionHistory.onInstructionsChange();
        }
      }
    } catch (error) {
      console.error('PopupManager: Error restoring custom instructions:', error);
    }
  }

  /**
   * Load current video information
   */
  async loadCurrentVideo() {
    try {
      console.log('PopupManager: loadCurrentVideo started');
      
      // Get current active tab
      console.log('PopupManager: Querying for active tab...');
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      console.log('PopupManager: Current tab result:', tab);
      
      if (!tab) {
        console.log('PopupManager: No tab found');
        this.showNoVideoMessage('No active tab found');
        return;
      }
      
      if (!tab.url) {
        console.log('PopupManager: Tab has no URL');
        this.showNoVideoMessage('Tab has no URL');
        return;
      }
      
      console.log('PopupManager: Tab URL:', tab.url);

      // Check if it's a YouTube watch page or shorts page
      if (!tab.url.includes('youtube.com/watch') && !tab.url.includes('youtube.com/shorts')) {
        console.log('PopupManager: Not a YouTube video page');
        this.showNoVideoMessage('Current tab is not a YouTube video page');
        return;
      }

      console.log('PopupManager: YouTube video page detected, trying transcript extraction...');
      this.showLoadingMessage();

      // First try the working extension approach
      try {
        console.log('PopupManager: Trying working transcript extraction method...');
        const transcriptResponse = await browser.tabs.sendMessage(tab.id, { action: 'copyTranscript' });
        
        if (transcriptResponse && transcriptResponse.status === 'success' && transcriptResponse.transcript) {
          console.log('PopupManager: ✅ Working transcript extraction successful!');
          console.log('PopupManager: Title:', transcriptResponse.title);
          console.log('PopupManager: Transcript length:', transcriptResponse.transcript.length);
          
          // Convert the transcript format for our processing
          const subtitleContent = `Video Title: ${transcriptResponse.title}\n\nTranscript Content:\n${transcriptResponse.transcript}`;
          
          this.currentVideo = {
            title: transcriptResponse.title,
            author: transcriptResponse.author || 'YouTube Video', // Use extracted author or fallback
            url: transcriptResponse.url || tab.url,
            subtitleContent: subtitleContent,
            tabId: tab.id
          };
          
          console.log('PopupManager: ✅ currentVideo set with transcript data:', {
            title: this.currentVideo.title,
            author: this.currentVideo.author,
            url: this.currentVideo.url,
            hasSubtitleContent: !!this.currentVideo.subtitleContent
          });
          
          this.displayVideoInfo();
          return;
        } else {
          console.log('PopupManager: Working transcript extraction failed:', transcriptResponse);
          console.log('PopupManager: Response status:', transcriptResponse?.status);
          console.log('PopupManager: Response message:', transcriptResponse?.message);
          
          // Show the error message to the user
          const errorMessage = transcriptResponse?.message || 'Transcript extraction failed';
          this.showNoVideoMessage(`Transcript extraction failed: ${errorMessage}`);
          return;
        }
      } catch (transcriptError) {
        console.log('PopupManager: Transcript extraction error:', transcriptError);
        this.showNoVideoMessage(`Error extracting transcript: ${transcriptError.message}`);
        return;
      }

    } catch (error) {
      console.error('PopupManager: Error in loadCurrentVideo:', error);
      this.showNoVideoMessage('Error: ' + error.message);
    }
  }

  /**
   * Show loading message
   */
  showLoadingMessage() {
    const videoMetaLine = document.getElementById('videoMetaLine');
    if (videoMetaLine) {
      videoMetaLine.textContent = 'Loading video info...';
    }
    this.updateUI();
  }

  /**
   * Show no video message
   */
  showNoVideoMessage(message = 'Please navigate to a YouTube video page and click the extension icon.') {
    console.log('PopupManager: showNoVideoMessage called with:', message);
    const videoMetaLine = document.getElementById('videoMetaLine');
    if (videoMetaLine) {
      videoMetaLine.textContent = message || 'Not loaded';
    }
    this.updateUI();
  }

  /**
   * Display video information in the UI
   */
  displayVideoInfo() {
    console.log('PopupManager: displayVideoInfo called');
    console.log('PopupManager: currentVideo:', this.currentVideo);
    const videoMetaLine = document.getElementById('videoMetaLine');
    if (!this.currentVideo) {
      videoMetaLine.textContent = 'Not loaded';
      return;
    }
    const title = this.currentVideo.title || 'No title available';
    const author = this.currentVideo.author || 'No author available';
    const url = this.currentVideo.url || '';
    
    // Create elements safely without innerHTML
    videoMetaLine.textContent = '';
    
    // Create and append the URL link
    const urlLink = document.createElement('a');
    urlLink.href = url;
    urlLink.target = '_blank';
    urlLink.rel = 'noopener noreferrer';
    urlLink.textContent = url;
    videoMetaLine.appendChild(urlLink);
    
    // Add bullet separator
    videoMetaLine.appendChild(document.createTextNode(' • '));
    
    // Add title
    videoMetaLine.appendChild(document.createTextNode(title));
    
    // Add bullet separator
    videoMetaLine.appendChild(document.createTextNode(' • '));
    
    // Add author
    videoMetaLine.appendChild(document.createTextNode(author));
    
    this.updateUI();
  }

  /**
   * Generate chapters
   */
  async generateChapters() {
    if (this.isProcessing) return;

    const dynamicApiKey = document.getElementById('dynamicApiKeyInput').value.trim();
    const model = document.getElementById('modelSelect').value;
    const customInstructions = document.getElementById('instructionsTextarea').value.trim();

    // Determine which API key to use based on the selected model
    let apiKey = '';
    if (model.includes('gemini-')) {
      apiKey = dynamicApiKey;
      if (!apiKey) {
        this.showNotification('Please enter your Gemini API key for this model', 'error');
        return;
      }
    } else if (model.includes('deepseek/')) {
      // Free models don't need API key
      if (!model.includes(':free')) {
        apiKey = dynamicApiKey;
        if (!apiKey) {
          this.showNotification('Please enter your OpenRouter API key for this model', 'error');
          return;
        }
      }
    }

    if (!this.currentVideo) {
      this.showNotification('No video detected. Please navigate to a YouTube video page.', 'error');
      return;
    }

    try {
      if (customInstructions && window.instructionHistory) {
        await window.instructionHistory.saveInstruction(customInstructions);
      }

      let subtitleContent = null;

      if (this.currentVideo.subtitleContent) {
        subtitleContent = this.currentVideo.subtitleContent;
      } else {
        const subtitleResponse = await this.sendMessageToTab({
          action: 'extractSubtitles'
        });
        if (!subtitleResponse || !subtitleResponse.success) {
          throw new Error(subtitleResponse?.error || 'Failed to extract subtitles');
        }
        subtitleContent = subtitleResponse.data.content;
      }

      const resultId = Date.now();
      this._lastResultId = resultId;
      let chaptersWithUrl = this.currentVideo.url + '\n\n';
      const sessionResults = {
        resultId,
        subtitles: { content: subtitleContent },
        chapters: chaptersWithUrl,
        timestamp: resultId,
        videoMetadata: {
          title: this.currentVideo.title,
          author: this.currentVideo.author,
          url: this.currentVideo.url
        }
      };
      await browser.runtime.sendMessage({ action: 'setSessionResults', results: sessionResults, resultId });

      // Start generation in background (no await - let it run async)
      browser.runtime.sendMessage({
        action: 'processWithGemini',
        subtitleContent: subtitleContent,
        customInstructions: customInstructions,
        apiKey: apiKey,
        model: model,
        resultId: resultId
      });

      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      let videoUrl = null;
      if (this.currentVideo && this.currentVideo.url) {
        videoUrl = this.currentVideo.url;
      } else if (tab && tab.url) {
        videoUrl = tab.url;
      }
      await browser.runtime.sendMessage({ action: 'openResultsTab', videoTabId: tab.id, videoUrl, resultId });
      window.close();
    } catch (error) {
      console.error('PopupManager: Error generating chapters:', error);
      this.showNotification('Error: ' + error.message, 'error');
    }
  }

  /**
   * Send message to current tab
   */
  async sendMessageToTab(message) {
    if (!this.currentVideo || !this.currentVideo.tabId) {
      throw new Error('No active tab');
    }

    return await browser.tabs.sendMessage(this.currentVideo.tabId, message);
  }

  /**
   * Update processing state UI
   */
  updateProcessingState(processing) {
    const generateBtn = document.getElementById('generateBtn');
    const progressSection = document.getElementById('progressSection');

    if (processing) {
      generateBtn.disabled = true;
      generateBtn.textContent = 'Processing...';
      progressSection.style.display = 'block';
    } else {
      generateBtn.disabled = false;
      generateBtn.textContent = 'Generate Chapters';
      progressSection.style.display = 'none';
      this.updateProgress(0, '');
    }
  }

  /**
   * Update progress bar and message
   */
  updateProgress(percentage, message) {
    const progressFill = document.getElementById('progressFill');
    const progressMessage = document.getElementById('progressMessage');

    progressFill.style.width = percentage + '%';
    progressMessage.textContent = message;
  }

  /**
   * View results
   */
  async viewResults() {
    // Get the current tab (the video tab)
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    let videoUrl = null;
    if (this.currentVideo && this.currentVideo.url) {
      videoUrl = this.currentVideo.url;
    } else if (tab && tab.url) {
      videoUrl = tab.url;
    }
    const resultId = this._lastResultId;
    await browser.runtime.sendMessage({ action: 'openResultsTab', videoTabId: tab.id, videoUrl, resultId });
    
    // Close the popup after opening results
    window.close();
  }

  /**
   * Clear dynamic API key
   */
  async clearDynamicApiKey() {
    try {
      const modelSelect = document.getElementById('modelSelect');
      const selectedModel = modelSelect.value;
      
      document.getElementById('dynamicApiKeyInput').value = '';
      await this.saveSettings();
      
      if (selectedModel.includes('gemini-')) {
        this.showNotification('Gemini API key cleared', 'success');
      } else if (selectedModel.includes('deepseek/') && !selectedModel.includes(':free')) {
        this.showNotification('OpenRouter API key cleared', 'success');
      } else {
        this.showNotification('API key cleared', 'success');
      }
    } catch (error) {
      console.error('Error clearing API key:', error);
      this.showNotification('Error clearing API key', 'error');
    }
  }

  /**
   * Open options page
   */
  openOptions() {
    browser.runtime.openOptionsPage();
  }

  /**
   * Handle settings change
   */
  onSettingsChange() {
    this.updateGenerateButtonState();
    this.saveSettings();
  }

  /**
   * Handle instructions change
   */
  onInstructionsChange() {
    // Delegate to instruction history manager
    if (window.instructionHistory) {
      window.instructionHistory.onInstructionsChange();
    }
  }

  /**
   * Save custom instructions to storage
   */
  async saveCustomInstructions() {
    try {
      const instructionsTextarea = document.getElementById('instructionsTextarea');
      const customInstructions = instructionsTextarea.value.trim();

      if (customInstructions) {
        await browser.storage.local.set({ lastCustomInstructions: customInstructions });
        console.log('PopupManager: Custom instructions saved to storage');
      } else {
        await browser.storage.local.remove('lastCustomInstructions');
        console.log('PopupManager: Custom instructions removed from storage');
      }
    } catch (error) {
      console.error('PopupManager: Error saving custom instructions:', error);
    }
  }

  /**
   * Update the state of the generate button
   */
  updateGenerateButtonState() {
    console.log('PopupManager: updateGenerateButtonState called');
    const generateBtn = document.getElementById('generateBtn');
    const dynamicApiKey = document.getElementById('dynamicApiKeyInput').value.trim();
    const model = document.getElementById('modelSelect').value;
    
    console.log('PopupManager: Dynamic API key present:', !!dynamicApiKey);
    console.log('PopupManager: Selected model:', model);
    console.log('PopupManager: isProcessing:', this.isProcessing);
    console.log('PopupManager: currentVideo present:', !!this.currentVideo);
    
    // Check if the selected model can be used
    let canUseModel = false;
    let reasonDisabled = '';
    
    if (model.includes('gemini-')) {
      canUseModel = !!dynamicApiKey;
      if (!canUseModel) reasonDisabled = 'Gemini API key required for this model';
    } else if (model.includes('deepseek/')) {
      if (model.includes(':free')) {
        canUseModel = true; // Free models don't need API key
      } else {
        canUseModel = !!dynamicApiKey;
        if (!canUseModel) reasonDisabled = 'OpenRouter API key required for this model';
      }
    } else {
      canUseModel = false;
      reasonDisabled = 'Unknown model selected';
    }
    
    const shouldEnable = canUseModel && !this.isProcessing && this.currentVideo;
    console.log('PopupManager: Should enable generate button:', shouldEnable);
    
    generateBtn.disabled = !shouldEnable;
    
    if (!canUseModel) {
      console.log('PopupManager: Generate button disabled -', reasonDisabled);
    } else if (this.isProcessing) {
      console.log('PopupManager: Generate button disabled - currently processing');
    } else if (!this.currentVideo) {
      console.log('PopupManager: Generate button disabled - no current video');
    } else {
      console.log('PopupManager: Generate button enabled');
    }
  }

  /**
   * Save settings
   */
  async saveSettings() {
    try {
      const modelSelect = document.getElementById('modelSelect');
      const dynamicApiKeyInput = document.getElementById('dynamicApiKeyInput');
      const selectedModel = modelSelect.value;
      const dynamicApiKey = dynamicApiKeyInput.value.trim();
      
      // Get existing settings to preserve values
      const existingSettings = this.settings || {};
      
      const settings = {
        ...existingSettings,
        model: selectedModel
      };
      
      // Update the appropriate API key field based on selected model
      if (selectedModel.includes('gemini-')) {
        settings.apiKey = dynamicApiKey;
      } else if (selectedModel.includes('deepseek/') && !selectedModel.includes(':free')) {
        settings.openRouterApiKey = dynamicApiKey;
      }

      const response = await browser.runtime.sendMessage({ action: 'saveSettings', settings });
      
      if (!response || !response.success) {
        throw new Error(response?.error || 'Failed to save settings');
      }

      this.settings = settings;

    } catch (error) {
      console.error('Error saving settings:', error);
    }
  }

  /**
   * Update UI based on current state
   */
  async updateUI() {
    this.updateGenerateButtonState();
    // Check if results tab is open
    try {
      const response = await browser.runtime.sendMessage({ action: 'getResultsTabStatus' });
      if (response && response.open) {
        document.getElementById('viewResultsBtn').style.display = 'inline-block';
      } else {
        document.getElementById('viewResultsBtn').style.display = 'none';
      }
    } catch (e) {
      document.getElementById('viewResultsBtn').style.display = 'none';
    }
  }

  /**
   * Show notification
   */
  showNotification(message, type = 'info') {
    const container = document.getElementById('notificationContainer');
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    container.appendChild(notification);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 3000);
  }
}

// Global notification function for other modules
window.showNotification = function(message, type = 'info') {
  if (window.popupManager) {
    window.popupManager.showNotification(message, type);
  }
};

console.log('About to initialize PopupManager...');
console.log('Document ready state at init:', document.readyState);

// Initialize when DOM is loaded
if (document.readyState === 'loading') {
  console.log('Document still loading, waiting for DOMContentLoaded...');
  document.addEventListener('DOMContentLoaded', () => {
    console.log('DOMContentLoaded fired, creating PopupManager...');
    try {
      window.popupManager = new PopupManager();
      console.log('PopupManager created successfully');
    } catch (error) {
      console.error('Error creating PopupManager:', error);
    }
  });
} else {
  console.log('Document already loaded, creating PopupManager immediately...');
  try {
    window.popupManager = new PopupManager();
    console.log('PopupManager created successfully');
  } catch (error) {
    console.error('Error creating PopupManager:', error);
  }
} 