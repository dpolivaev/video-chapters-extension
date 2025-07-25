/**
 * Options Page Script for Video Chapters Generator
 * Handles extension options UI, API key management, and version info
 *
 * Copyright (C) 2025 Dimitry Polivaev
 *
 * This file is part of Video Chapters Generator.
 *
 * Video Chapters Generator is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Video Chapters Generator is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Video Chapters Generator. If not, see <https://www.gnu.org/licenses/>.
 */
if (typeof browser === "undefined") {
  var browser = chrome;
}

document.addEventListener("DOMContentLoaded", async function() {
  await loadApiKeys();
  await loadVersionInfo();
  setupEventListeners();
});

async function loadApiKeys() {
  try {
    const result = await browser.storage.sync.get("userSettings");
    const settings = result.userSettings || {};
    document.getElementById("apiKey").value = settings.apiKey || "";
    document.getElementById("openRouterApiKey").value = settings.openRouterApiKey || "";
  } catch (error) {
    console.error("Error loading API keys:", error);
    showStatus(chrome.i18n.getMessage('error_loading_settings'), "error");
  }
}

async function saveApiKey() {
  try {
    const apiKey = document.getElementById("apiKey").value;
    const result = await browser.storage.sync.get("userSettings");
    const existingSettings = result.userSettings || {};
    const updatedSettings = {
      ...existingSettings,
      apiKey: apiKey
    };
    await browser.storage.sync.set({
      userSettings: updatedSettings
    });
    showStatus(chrome.i18n.getMessage('gemini_api_key_saved'), "success");
  } catch (error) {
    console.error("Error saving Gemini API key:", error);
    showStatus(chrome.i18n.getMessage('error_saving_gemini_api_key'), "error");
  }
}

async function saveOpenRouterApiKey() {
  try {
    const openRouterApiKey = document.getElementById("openRouterApiKey").value;
    const result = await browser.storage.sync.get("userSettings");
    const existingSettings = result.userSettings || {};
    const updatedSettings = {
      ...existingSettings,
      openRouterApiKey: openRouterApiKey
    };
    await browser.storage.sync.set({
      userSettings: updatedSettings
    });
    showStatus(chrome.i18n.getMessage('openrouter_api_key_saved'), "success");
  } catch (error) {
    console.error("Error saving OpenRouter API key:", error);
    showStatus(chrome.i18n.getMessage('error_saving_openrouter_api_key'), "error");
  }
}

async function loadVersionInfo() {
  try {
    const manifestResponse = await fetch(chrome.runtime.getURL("manifest.json"));
    if (manifestResponse.ok) {
      const manifest = await manifestResponse.json();
      const versionEl = document.getElementById("version");
      if (versionEl) versionEl.textContent = manifest.version || "Unknown";
    }
  } catch (error) {
    console.error("Error loading version:", error);
    const versionEl = document.getElementById("version");
    if (versionEl) versionEl.textContent = "Unknown";
  }
  try {
    const buildInfoResponse = await fetch(chrome.runtime.getURL("build-info.json"));
    if (buildInfoResponse.ok) {
      const buildInfo = await buildInfoResponse.json();
      const buildTimeEl = document.getElementById("buildTime");
      if (buildTimeEl) buildTimeEl.textContent = buildInfo.buildTime || "Unknown";
    }
  } catch (error) {
    console.error("Error loading build info:", error);
    const buildTimeEl = document.getElementById("buildTime");
    if (buildTimeEl) buildTimeEl.textContent = "Unknown";
  }
}

function showStatus(message, type = "info") {
  const statusEl = document.getElementById("status");
  if (statusEl) {
    statusEl.textContent = message;
    statusEl.className = type;
    setTimeout(() => {
      statusEl.textContent = "";
      statusEl.className = "";
    }, 3e3);
  }
}

function setupEventListeners() {
  const saveButton = document.getElementById("save");
  if (saveButton) {
    saveButton.addEventListener("click", saveApiKey);
  }
  const saveOpenRouterButton = document.getElementById("saveOpenRouter");
  if (saveOpenRouterButton) {
    saveOpenRouterButton.addEventListener("click", saveOpenRouterApiKey);
  }
  const apiKeyInput = document.getElementById("apiKey");
  if (apiKeyInput) {
    apiKeyInput.addEventListener("keypress", function(e) {
      if (e.key === "Enter") {
        saveApiKey();
      }
    });
  }
  const openRouterApiKeyInput = document.getElementById("openRouterApiKey");
  if (openRouterApiKeyInput) {
    openRouterApiKeyInput.addEventListener("keypress", function(e) {
      if (e.key === "Enter") {
        saveOpenRouterApiKey();
      }
    });
  }
}