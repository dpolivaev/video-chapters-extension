// Browser compatibility
if (typeof browser === 'undefined') {
  var browser = chrome;
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async function() {
  // Load saved API keys
  await loadApiKeys();
  
  // Fetch and display version and build info
  await loadVersionInfo();
  
  // Setup event listeners
  setupEventListeners();
});

// Load saved API keys from storage
async function loadApiKeys() {
  try {
    const result = await browser.storage.sync.get('userSettings');
    const settings = result.userSettings || {};
    
    document.getElementById('apiKey').value = settings.apiKey || '';
    document.getElementById('openRouterApiKey').value = settings.openRouterApiKey || '';
  } catch (error) {
    console.error('Error loading API keys:', error);
    showStatus('Error loading settings!', 'error');
  }
}

// Save Gemini API key to storage
async function saveApiKey() {
  try {
    const apiKey = document.getElementById('apiKey').value;
    
    // Get existing settings to preserve other values
    const result = await browser.storage.sync.get('userSettings');
    const existingSettings = result.userSettings || {};
    
    // Update only the Gemini apiKey
    const updatedSettings = { ...existingSettings, apiKey };
    
    await browser.storage.sync.set({ userSettings: updatedSettings });
    showStatus('Gemini API Key saved!', 'success');
  } catch (error) {
    console.error('Error saving Gemini API key:', error);
    showStatus('Error saving Gemini API key!', 'error');
  }
}

// Save OpenRouter API key to storage
async function saveOpenRouterApiKey() {
  try {
    const openRouterApiKey = document.getElementById('openRouterApiKey').value;
    
    // Get existing settings to preserve other values
    const result = await browser.storage.sync.get('userSettings');
    const existingSettings = result.userSettings || {};
    
    // Update only the OpenRouter apiKey
    const updatedSettings = { ...existingSettings, openRouterApiKey };
    
    await browser.storage.sync.set({ userSettings: updatedSettings });
    showStatus('OpenRouter API Key saved!', 'success');
  } catch (error) {
    console.error('Error saving OpenRouter API key:', error);
    showStatus('Error saving OpenRouter API key!', 'error');
  }
}

// Load version and build time information
async function loadVersionInfo() {
  try {
    // Fetch version from manifest
    const manifestResponse = await fetch(chrome.runtime.getURL('manifest.json'));
    if (manifestResponse.ok) {
      const manifest = await manifestResponse.json();
      const versionEl = document.getElementById('version');
      if (versionEl) versionEl.textContent = manifest.version || 'Unknown';
    }
  } catch (error) {
    console.error('Error loading version:', error);
    const versionEl = document.getElementById('version');
    if (versionEl) versionEl.textContent = 'Unknown';
  }

  try {
    // Fetch build time from build info
    const buildInfoResponse = await fetch(chrome.runtime.getURL('build-info.json'));
    if (buildInfoResponse.ok) {
      const buildInfo = await buildInfoResponse.json();
      const buildTimeEl = document.getElementById('buildTime');
      if (buildTimeEl) buildTimeEl.textContent = buildInfo.buildTime || 'Unknown';
    }
  } catch (error) {
    console.error('Error loading build info:', error);
    const buildTimeEl = document.getElementById('buildTime');
    if (buildTimeEl) buildTimeEl.textContent = 'Unknown';
  }
}

// Show status message
function showStatus(message, type = 'info') {
  const statusEl = document.getElementById('status');
  if (statusEl) {
    statusEl.textContent = message;
    statusEl.className = type;
    
    // Clear status after 3 seconds
    setTimeout(() => {
      statusEl.textContent = '';
      statusEl.className = '';
    }, 3000);
  }
}

// Setup event listeners
function setupEventListeners() {
  const saveButton = document.getElementById('save');
  if (saveButton) {
    saveButton.addEventListener('click', saveApiKey);
  }
  
  const saveOpenRouterButton = document.getElementById('saveOpenRouter');
  if (saveOpenRouterButton) {
    saveOpenRouterButton.addEventListener('click', saveOpenRouterApiKey);
  }
  
  // Save on Enter key in API key fields
  const apiKeyInput = document.getElementById('apiKey');
  if (apiKeyInput) {
    apiKeyInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        saveApiKey();
      }
    });
  }
  
  const openRouterApiKeyInput = document.getElementById('openRouterApiKey');
  if (openRouterApiKeyInput) {
    openRouterApiKeyInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        saveOpenRouterApiKey();
      }
    });
  }
} 