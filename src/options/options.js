/**
 * Options Page Script for Chaptotek
 * Handles extension options UI, API key management, and version info
 *
 * Copyright (C) 2025 Dimitry Polivaev
 *
 * This file is part of Chaptotek.
 *
 * Chaptotek is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Chaptotek is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Chaptotek. If not, see <https://www.gnu.org/licenses/>.
 */
if (typeof browser === 'undefined') {
  const browser = chrome;
}

document.addEventListener('DOMContentLoaded', async function() {
  await loadApiKeys();
  await loadLanguageSettings();
  await loadVersionInfo();
  setupEventListeners();
});

async function loadApiKeys() {
  try {
    const response = await browser.runtime.sendMessage({
      action: 'loadSettings'
    });
    if (response && response.success) {
      const settings = response.data;
      document.getElementById('apiKey').value = settings.apiKey || '';
      document.getElementById('openRouterApiKey').value = settings.openRouterApiKey || '';

      // Update help button visibility
      updateApiHelpVisibility();
    } else {
      throw new Error(response?.error || 'Failed to load settings');
    }
  } catch (error) {
    console.error('Error loading API keys:', error);
    showStatus(getLocalizedMessage('error_loading_settings'), 'error');
  }
}

function updateApiHelpVisibility() {
  const geminiKey = document.getElementById('apiKey').value;
  const openRouterKey = document.getElementById('openRouterApiKey').value;

  const geminiBtn = document.getElementById('geminiKeyBtn');
  const openRouterBtn = document.getElementById('openRouterKeyBtn');

  if (geminiBtn) {
    geminiBtn.classList.toggle('hidden', geminiKey.length > 0);
  }

  if (openRouterBtn) {
    openRouterBtn.classList.toggle('hidden', openRouterKey.length > 0);
  }
}

async function saveAllSettings() {
  try {
    const apiKey = document.getElementById('apiKey').value;
    const openRouterApiKey = document.getElementById('openRouterApiKey').value;
    const languageSelect = document.getElementById('languageSelect');
    const selectedLanguage = languageSelect.value;
    const historyLimitInput = document.getElementById('historyLimitInput');
    const historyLimit = parseInt(historyLimitInput.value);

    // Validate history limit
    if (isNaN(historyLimit) || historyLimit < 1 || historyLimit > 50) {
      showStatus('History limit must be between 1 and 50', 'error');
      historyLimitInput.value = 10;
      return;
    }

    const response = await browser.runtime.sendMessage({
      action: 'saveSettings',
      settings: {
        apiKey,
        openRouterApiKey,
        uiLanguage: selectedLanguage,
        historyLimit
      }
    });

    if (!response || !response.success) {
      throw new Error(response?.error || 'Failed to save settings');
    }

    showStatus(getLocalizedMessage('settings_saved_successfully'), 'success');

    // Reload page if language was changed
    if (selectedLanguage !== getInitialLanguage()) {
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    }
  } catch (error) {
    console.error('Error saving settings:', error);
    showStatus(getLocalizedMessage('error_saving_settings'), 'error');
  }
}

async function loadLanguageSettings() {
  try {
    const response = await browser.runtime.sendMessage({
      action: 'loadSettings'
    });
    if (response && response.success) {
      const settings = response.data;
      const languageSelect = document.getElementById('languageSelect');
      if (languageSelect) {
        const language = settings.uiLanguage || '';
        languageSelect.value = language;
        initialLanguage = language; // Store initial value for comparison
      }

      // Load history limit setting
      const historyLimitInput = document.getElementById('historyLimitInput');
      if (historyLimitInput) {
        historyLimitInput.value = settings.historyLimit || 10;
      }
    } else {
      throw new Error(response?.error || 'Failed to load settings');
    }
  } catch (error) {
    console.error('Error loading language settings:', error);
    showStatus(getLocalizedMessage('error_loading_settings'), 'error');
  }
}

let initialLanguage = '';

function getInitialLanguage() {
  return initialLanguage;
}

async function loadVersionInfo() {
  try {
    const manifestResponse = await fetch(chrome.runtime.getURL('manifest.json'));
    if (manifestResponse.ok) {
      const manifest = await manifestResponse.json();
      const versionEl = document.getElementById('version');
      if (versionEl) {
        versionEl.textContent = manifest.version || 'Unknown';
      }
    }
  } catch (error) {
    console.error('Error loading version:', error);
    const versionEl = document.getElementById('version');
    if (versionEl) {
      versionEl.textContent = 'Unknown';
    }
  }
  try {
    const buildInfoResponse = await fetch(chrome.runtime.getURL('build-info.json'));
    if (buildInfoResponse.ok) {
      const buildInfo = await buildInfoResponse.json();
      const buildTimeEl = document.getElementById('buildTime');
      if (buildTimeEl) {
        buildTimeEl.textContent = buildInfo.buildTime || 'Unknown';
      }
    }
  } catch (error) {
    console.error('Error loading build info:', error);
    const buildTimeEl = document.getElementById('buildTime');
    if (buildTimeEl) {
      buildTimeEl.textContent = 'Unknown';
    }
  }
}

function showStatus(message, type = 'info') {
  const statusEl = document.getElementById('status');
  if (statusEl) {
    statusEl.textContent = message;
    statusEl.className = `status-message ${type} show`;

    // Clear the message after 4 seconds
    setTimeout(() => {
      statusEl.classList.remove('show');
      // Wait for fade out animation to complete before clearing
      setTimeout(() => {
        if (!statusEl.classList.contains('show')) {
          statusEl.textContent = '';
          statusEl.className = 'status-message';
        }
      }, 300);
    }, 4000);
  }
}

function setupEventListeners() {
  const saveButton = document.getElementById('saveAll');
  if (saveButton) {
    saveButton.addEventListener('click', saveAllSettings);
  }

  const apiKeyInput = document.getElementById('apiKey');
  if (apiKeyInput) {
    apiKeyInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        saveAllSettings();
      }
    });
    apiKeyInput.addEventListener('input', updateApiHelpVisibility);
  }

  const openRouterApiKeyInput = document.getElementById('openRouterApiKey');
  if (openRouterApiKeyInput) {
    openRouterApiKeyInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        saveAllSettings();
      }
    });
    openRouterApiKeyInput.addEventListener('input', updateApiHelpVisibility);
  }

  const helpButton = document.getElementById('helpBtn');
  if (helpButton) {
    helpButton.addEventListener('click', openHelp);
  }
}

function openHelp() {
  browser.tabs.create({ url: browser.runtime.getURL('help/help.html') });
}
