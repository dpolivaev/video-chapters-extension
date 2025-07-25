/**
 * Main Popup Script for Video Chapters Generator
 * Handles UI interactions and user interface for video processing
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

console.log("POPUP SCRIPT LOADED - Extension popup is initializing...");

console.log("Document ready state:", document.readyState);

document.addEventListener("DOMContentLoaded", () => {
  console.log("DOMContentLoaded fired in popup");
});

console.log("About to define PopupView class...");

class PopupView {
  constructor() {
    this.currentVideo = null;
    this.isProcessing = false;
    this.settings = null;
    this.allModels = [];
    this.init();
  }
  async init() {
    try {
      console.log("PopupView: Starting initialization...");
      console.log("PopupView: Step 1 - loadSettings");
      await this.loadSettings();
      console.log("PopupView: Step 1 complete");
      console.log("PopupView: Step 2 - loadCurrentVideo");
      await this.loadCurrentVideo();
      console.log("PopupView: Step 2 complete");
      console.log("PopupView: Step 3 - setupEventListeners");
      this.setupEventListeners();
      console.log("PopupView: Step 3 complete");
      console.log("PopupView: Step 4 - updateUI");
      await this.updateUI();
      console.log("PopupView: Step 4 complete");
      console.log("PopupView: Initialization completed successfully");
    } catch (error) {
      console.error("PopupView: Error initializing popup:", error, error && error.stack);
      this.showNotification(chrome.i18n.getMessage('error_initializing_extension'), "error");
    }
  }
  setupEventListeners() {
    document.getElementById("generateBtn").addEventListener("click", () => {
      this.generateChapters();
    });
    document.getElementById("clearDynamicApiKeyBtn").addEventListener("click", () => {
      this.clearDynamicApiKey();
    });
    document.getElementById("settingsBtn").addEventListener("click", () => {
      this.openOptions();
    });
    document.getElementById("viewResultsBtn").addEventListener("click", () => {
      this.viewResults();
    });
    document.getElementById("dynamicApiKeyInput").addEventListener("input", () => {
      this.onSettingsChange();
    });
    document.getElementById("modelSelect").addEventListener("change", () => {
      this.updateApiKeyField();
      this.onSettingsChange();
    });
    const instructionsTextarea = document.getElementById("instructionsTextarea");
    instructionsTextarea.addEventListener("input", () => {
      this.onInstructionsChange();
    });
    window.addEventListener("beforeunload", () => {
      this.saveCustomInstructions();
    });
    window.addEventListener("pagehide", () => {
      this.saveCustomInstructions();
    });
    window.addEventListener("blur", () => {
      this.saveCustomInstructions();
    });
  }
  async loadSettings() {
    console.log("PopupView: loadSettings called");
    try {
      const response = await browser.runtime.sendMessage({
        action: "loadSettings"
      });
      console.log("PopupView: loadSettings response:", response);
      if (response && response.success) {
        this.settings = response.data;
        console.log("PopupView: Settings loaded successfully:", this.settings);
        this.applySettingsToUI();
        return;
      } else {
        console.error("PopupView: Failed to load settings:", response);
        throw new Error(response?.error || "Failed to load settings");
      }
    } catch (error) {
      console.error("PopupView: loadSettings error:", error);
      throw error;
    }
  }
  async applySettingsToUI() {
    console.log("PopupView: applySettingsToUI called");
    console.log("PopupView: Current settings:", this.settings);
    if (!this.settings) {
      console.log("PopupView: No settings to apply");
      return;
    }
    const modelSelect = document.getElementById("modelSelect");
    console.log("PopupView: Setting model select value:", this.settings.model);
    await this.loadModels();
    modelSelect.value = this.settings.model || "deepseek/deepseek-r1-0528:free";
    this.updateApiKeyField();
    this.restoreCustomInstructions();
    console.log("PopupView: Updating generate button state from applySettingsToUI");
    this.updateGenerateButtonState();
    if (this.currentVideo) {
      this.displayVideoInfo();
    }
  }
  async loadModels() {
    try {
      const response = await browser.runtime.sendMessage({
        action: "getAllModels"
      });
      if (response && response.success) {
        const modelSelect = document.getElementById("modelSelect");
        modelSelect.innerHTML = "";
        const models = response.data;
        this.allModels = models;
        const providers = {};
        models.forEach(model => {
          if (!providers[model.provider]) {
            providers[model.provider] = [];
          }
          providers[model.provider].push(model);
        });
        if (providers.OpenRouter) {
          const openRouterGroup = document.createElement("optgroup");
          openRouterGroup.label = "OpenRouter";
          providers.OpenRouter.sort((a, b) => {
            if (a.isFree && !b.isFree) return -1;
            if (!a.isFree && b.isFree) return 1;
            return a.name.localeCompare(b.name);
          });
          providers.OpenRouter.forEach(model => {
            const option = document.createElement("option");
            option.value = model.id;
            option.textContent = model.name;
            option.title = model.description;
            openRouterGroup.appendChild(option);
          });
          modelSelect.appendChild(openRouterGroup);
        }
        if (providers.Gemini) {
          const geminiGroup = document.createElement("optgroup");
          geminiGroup.label = "Gemini";
          providers.Gemini.forEach(model => {
            const option = document.createElement("option");
            option.value = model.id;
            option.textContent = model.name;
            option.title = model.description;
            geminiGroup.appendChild(option);
          });
          modelSelect.appendChild(geminiGroup);
        }
        console.log("PopupView: Models loaded successfully:", models.length);
      } else {
        console.error("PopupView: Failed to load models:", response);
        this.loadFallbackModels();
      }
    } catch (error) {
      console.error("PopupView: Error loading models:", error);
      this.loadFallbackModels();
    }
  }
  loadFallbackModels() {
    const modelSelect = document.getElementById("modelSelect");
    modelSelect.innerHTML = `\n      <optgroup label="OpenRouter">\n        <option value="deepseek/deepseek-r1-0528:free">DeepSeek R1 0528 (Free)</option>\n        <option value="deepseek/deepseek-r1-0528">DeepSeek R1 0528</option>\n        <option value="deepseek/deepseek-r1">DeepSeek R1</option>\n        <option value="deepseek/deepseek-r1-distill-qwen-1.5b">DeepSeek R1 Distill 1.5B</option>\n      </optgroup>\n      <optgroup label="Gemini">\n        <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>\n        <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>\n      </optgroup>\n    `;
  }
  updateApiKeyField() {
    const modelSelect = document.getElementById("modelSelect");
    const dynamicApiKeyInput = document.getElementById("dynamicApiKeyInput");
    const apiKeyLabel = document.getElementById("apiKeyLabel");
    const apiKeyInfo = document.getElementById("apiKeyInfo");
    const apiKeyGroup = document.getElementById("apiKeyGroup");
    const selectedModel = modelSelect.value;
    if (selectedModel.includes("gemini-")) {
      apiKeyLabel.textContent = "Gemini API Key:";
      dynamicApiKeyInput.placeholder = "Enter your Gemini API key";
      dynamicApiKeyInput.value = this.settings?.apiKey || "";
      apiKeyInfo.style.display = "none";
      apiKeyGroup.style.display = "block";
    } else if (this.isOpenRouterModel(selectedModel)) {
      const modelInfo = this.getModelInfo(selectedModel);
      if (modelInfo && modelInfo.isFree) {
        apiKeyGroup.style.display = "none";
      } else {
        apiKeyLabel.textContent = "OpenRouter API Key:";
        dynamicApiKeyInput.placeholder = "Enter your OpenRouter API key";
        dynamicApiKeyInput.value = this.settings?.openRouterApiKey || "";
        apiKeyInfo.style.display = "none";
        apiKeyGroup.style.display = "block";
      }
    } else {
      apiKeyLabel.textContent = "API Key:";
      dynamicApiKeyInput.placeholder = "Enter your API key";
      dynamicApiKeyInput.value = "";
      apiKeyInfo.innerHTML = "<small>Unknown model selected</small>";
      apiKeyInfo.style.display = "block";
      apiKeyGroup.style.display = "block";
    }
    console.log("PopupView: Updated API key field for model:", selectedModel);
  }
  getModelInfo(modelId) {
    return this.allModels.find(model => model.id === modelId);
  }
  isOpenRouterModel(modelId) {
    const modelInfo = this.getModelInfo(modelId);
    return modelInfo && modelInfo.provider === "OpenRouter";
  }
  async restoreCustomInstructions() {
    try {
      const result = await browser.storage.local.get("lastCustomInstructions");
      const lastInstructions = result.lastCustomInstructions;
      if (lastInstructions && lastInstructions.trim()) {
        const instructionsTextarea = document.getElementById("instructionsTextarea");
        instructionsTextarea.value = lastInstructions;
        console.log("PopupView: Restored custom instructions");
        if (window.instructionHistory) {
          window.instructionHistory.onInstructionsChange();
        }
      }
    } catch (error) {
      console.error("PopupView: Error restoring custom instructions:", error);
    }
  }
  async loadCurrentVideo() {
    try {
      console.log("PopupView: loadCurrentVideo started");
      console.log("PopupView: Querying for active tab...");
      const [tab] = await browser.tabs.query({
        active: true,
        currentWindow: true
      });
      console.log("PopupView: Current tab result:", tab);
      if (!tab) {
        console.log("PopupView: No tab found");
        this.showNoVideoMessage(chrome.i18n.getMessage('no_active_tab_found'));
        return;
      }
      if (!tab.url) {
        console.log("PopupView: Tab has no URL");
        this.showNoVideoMessage(chrome.i18n.getMessage('tab_has_no_url'));
        return;
      }
      console.log("PopupView: Tab URL:", tab.url);
      if (!tab.url.includes("youtube.com/watch") && !tab.url.includes("youtube.com/shorts")) {
        console.log("PopupView: Not a YouTube video page");
        this.showNoVideoMessage(chrome.i18n.getMessage('not_a_youtube_video_page'));
        return;
      }
      console.log("PopupView: YouTube video page detected, trying transcript extraction...");
      this.showLoadingMessage();
      try {
        console.log("PopupView: Trying working transcript extraction method...");
        const transcriptResponse = await browser.tabs.sendMessage(tab.id, {
          action: "copyTranscript"
        });
        if (transcriptResponse && transcriptResponse.status === "success" && transcriptResponse.transcript) {
          console.log("PopupView: ✅ Working transcript extraction successful!");
          console.log("PopupView: Title:", transcriptResponse.title);
          console.log("PopupView: Transcript length:", transcriptResponse.transcript.length);
          const subtitleContent = `Video Title: ${transcriptResponse.title}\n\nTranscript Content:\n${transcriptResponse.transcript}`;
          this.currentVideo = {
            title: transcriptResponse.title,
            author: transcriptResponse.author || "YouTube Video",
            url: cleanVideoURL(transcriptResponse.url || tab.url),
            subtitleContent: subtitleContent,
            tabId: tab.id
          };
          console.log("PopupView: ✅ currentVideo set with transcript data:", {
            title: this.currentVideo.title,
            author: this.currentVideo.author,
            url: this.currentVideo.url,
            hasSubtitleContent: !!this.currentVideo.subtitleContent
          });
          this.displayVideoInfo();
          return;
        } else {
          console.log("PopupView: Working transcript extraction failed:", transcriptResponse);
          console.log("PopupView: Response status:", transcriptResponse?.status);
          console.log("PopupView: Response message:", transcriptResponse?.message);
          const errorMessage = transcriptResponse?.message || "Transcript extraction failed";
          this.showNoVideoMessage(chrome.i18n.getMessage('transcript_extraction_failed') + ': ' + errorMessage);
          return;
        }
      } catch (transcriptError) {
        console.log("PopupView: Transcript extraction error:", transcriptError);
        this.showNoVideoMessage(chrome.i18n.getMessage('error_extracting_transcript') + ': ' + transcriptError.message);
        return;
      }
    } catch (error) {
      console.error("PopupView: Error in loadCurrentVideo:", error);
      this.showNoVideoMessage(chrome.i18n.getMessage('error') + ': ' + error.message);
    }
  }
  showLoadingMessage() {
    const videoMetaLine = document.getElementById("videoMetaLine");
    if (videoMetaLine) {
      videoMetaLine.textContent = chrome.i18n.getMessage('loading_video_info');
    }
    this.updateUI();
  }
  showNoVideoMessage(message = chrome.i18n.getMessage('please_navigate_to_youtube')) {
    console.log("PopupView: showNoVideoMessage called with:", message);
    const videoMetaLine = document.getElementById("videoMetaLine");
    if (videoMetaLine) {
      videoMetaLine.textContent = message || chrome.i18n.getMessage('video_info_not_loaded');
    }
    this.updateUI();
  }
  displayVideoInfo() {
    console.log("PopupView: displayVideoInfo called");
    console.log("PopupView: currentVideo:", this.currentVideo);
    const videoMetaLine = document.getElementById("videoMetaLine");
    if (!this.currentVideo) {
      videoMetaLine.textContent = chrome.i18n.getMessage('video_info_not_loaded');
      return;
    }
    const title = this.currentVideo.title || chrome.i18n.getMessage('unknown_title');
    const author = this.currentVideo.author || chrome.i18n.getMessage('unknown_author');
    const url = cleanVideoURL(this.currentVideo.url || "");
    videoMetaLine.textContent = "";
    const urlLink = document.createElement("a");
    urlLink.href = url;
    urlLink.target = "_blank";
    urlLink.rel = "noopener noreferrer";
    urlLink.textContent = url;
    videoMetaLine.appendChild(urlLink);
    videoMetaLine.appendChild(document.createTextNode(" • "));
    videoMetaLine.appendChild(document.createTextNode(title));
    videoMetaLine.appendChild(document.createTextNode(" • "));
    videoMetaLine.appendChild(document.createTextNode(author));
    this.updateUI();
  }
  async generateChapters() {
    if (this.isProcessing) return;
    const dynamicApiKey = document.getElementById("dynamicApiKeyInput").value.trim();
    const model = document.getElementById("modelSelect").value;
    const customInstructions = document.getElementById("instructionsTextarea").value.trim();
    let apiKey = "";
    if (model.includes("gemini-")) {
      apiKey = dynamicApiKey;
      if (!apiKey) {
        this.showNotification(chrome.i18n.getMessage('gemini_api_key_required'), "error");
        return;
      }
    } else if (this.isOpenRouterModel(model)) {
      const modelInfo = this.getModelInfo(model);
      if (modelInfo && !modelInfo.isFree) {
        apiKey = dynamicApiKey;
        if (!apiKey) {
          this.showNotification(chrome.i18n.getMessage('openrouter_api_key_required'), "error");
          return;
        }
      }
    }
    if (!this.currentVideo) {
      this.showNotification(chrome.i18n.getMessage('no_video_detected'), "error");
      return;
    }
    try {
      if (customInstructions && window.instructionHistory) {
        await window.instructionHistory.saveInstruction(customInstructions);
      }
      // Use the transcript content that was already extracted in loadCurrentVideo()
      if (!this.currentVideo.subtitleContent) {
        throw new Error(chrome.i18n.getMessage('no_transcript_available'));
      }
      const subtitleContent = this.currentVideo.subtitleContent;
      const resultId = Date.now();
      this._lastResultId = resultId;
      const cleanUrl = cleanVideoURL(this.currentVideo.url);
      let chaptersWithUrl = cleanUrl + "\n\n";
      const sessionResults = {
        resultId: resultId,
        subtitles: {
          content: subtitleContent
        },
        chapters: chaptersWithUrl,
        timestamp: resultId,
        model: model,
        customInstructions: customInstructions,
        videoMetadata: {
          title: this.currentVideo.title,
          author: this.currentVideo.author,
          url: cleanUrl
        }
      };
      await browser.runtime.sendMessage({
        action: "setSessionResults",
        results: sessionResults,
        resultId: resultId
      });
      browser.runtime.sendMessage({
        action: "processWithGemini",
        subtitleContent: subtitleContent,
        customInstructions: customInstructions,
        apiKey: apiKey,
        model: model,
        resultId: resultId
      });
      const [tab] = await browser.tabs.query({
        active: true,
        currentWindow: true
      });
      let videoUrl = null;
      if (this.currentVideo && this.currentVideo.url) {
        videoUrl = cleanVideoURL(this.currentVideo.url);
      } else if (tab && tab.url) {
        videoUrl = cleanVideoURL(tab.url);
      }
      await browser.runtime.sendMessage({
        action: "openResultsTab",
        videoTabId: tab.id,
        videoUrl: videoUrl,
        resultId: resultId
      });
      window.close();
    } catch (error) {
      console.error("PopupView: Error generating chapters:", error);
      this.showNotification("Error: " + error.message, "error");
    }
  }
  async sendMessageToTab(message) {
    if (!this.currentVideo || !this.currentVideo.tabId) {
      throw new Error("No active tab");
    }
    return await browser.tabs.sendMessage(this.currentVideo.tabId, message);
  }
  updateProcessingState(processing) {
    const generateBtn = document.getElementById("generateBtn");
    const progressSection = document.getElementById("progressSection");
    if (processing) {
      generateBtn.disabled = true;
      generateBtn.textContent = chrome.i18n.getMessage('processing_button');
      progressSection.style.display = "block";
    } else {
      generateBtn.disabled = false;
      generateBtn.textContent = chrome.i18n.getMessage('generate_chapters_button');
      progressSection.style.display = "none";
      this.updateProgress(0, "");
    }
  }
  updateProgress(percentage, message) {
    const progressFill = document.getElementById("progressFill");
    const progressMessage = document.getElementById("progressMessage");
    progressFill.style.width = percentage + "%";
    progressMessage.textContent = message;
  }
  async viewResults() {
    const [tab] = await browser.tabs.query({
      active: true,
      currentWindow: true
    });
    let videoUrl = null;
    if (this.currentVideo && this.currentVideo.url) {
      videoUrl = cleanVideoURL(this.currentVideo.url);
    } else if (tab && tab.url) {
      videoUrl = cleanVideoURL(tab.url);
    }
    const resultId = this._lastResultId;
    await browser.runtime.sendMessage({
      action: "openResultsTab",
      videoTabId: tab.id,
      videoUrl: videoUrl,
      resultId: resultId
    });
    window.close();
  }
  async clearDynamicApiKey() {
    try {
      const modelSelect = document.getElementById("modelSelect");
      const selectedModel = modelSelect.value;
      document.getElementById("dynamicApiKeyInput").value = "";
      await this.saveSettings();
      if (selectedModel.includes("gemini-")) {
        this.showNotification(chrome.i18n.getMessage('api_key_cleared_gemini'), "success");
      } else if (this.isOpenRouterModel(selectedModel)) {
        const modelInfo = this.getModelInfo(selectedModel);
        if (modelInfo && !modelInfo.isFree) {
          this.showNotification(chrome.i18n.getMessage('api_key_cleared_openrouter'), "success");
        } else {
          this.showNotification(chrome.i18n.getMessage('api_key_cleared'), "success");
        }
      } else {
        this.showNotification(chrome.i18n.getMessage('api_key_cleared'), "success");
      }
    } catch (error) {
      console.error("Error clearing API key:", error);
      this.showNotification(chrome.i18n.getMessage('error_clearing_api_key'), "error");
    }
  }
  openOptions() {
    browser.runtime.openOptionsPage();
  }
  onSettingsChange() {
    this.updateGenerateButtonState();
    this.saveSettings();
  }
  onInstructionsChange() {
    if (window.instructionHistory) {
      window.instructionHistory.onInstructionsChange();
    }
  }
  async saveCustomInstructions() {
    try {
      const instructionsTextarea = document.getElementById("instructionsTextarea");
      const customInstructions = instructionsTextarea.value.trim();
      if (customInstructions) {
        await browser.storage.local.set({
          lastCustomInstructions: customInstructions
        });
        console.log("PopupView: Custom instructions saved to storage");
      } else {
        await browser.storage.local.remove("lastCustomInstructions");
        console.log("PopupView: Custom instructions removed from storage");
      }
    } catch (error) {
      console.error("PopupView: Error saving custom instructions:", error);
    }
  }
  updateGenerateButtonState() {
    console.log("PopupView: updateGenerateButtonState called");
    const generateBtn = document.getElementById("generateBtn");
    const dynamicApiKey = document.getElementById("dynamicApiKeyInput").value.trim();
    const model = document.getElementById("modelSelect").value;
    console.log("PopupView: Dynamic API key present:", !!dynamicApiKey);
    console.log("PopupView: Selected model:", model);
    console.log("PopupView: isProcessing:", this.isProcessing);
    console.log("PopupView: currentVideo present:", !!this.currentVideo);
    let canUseModel = false;
    let reasonDisabled = "";
    if (model.includes("gemini-")) {
      canUseModel = !!dynamicApiKey;
      if (!canUseModel) reasonDisabled = chrome.i18n.getMessage('gemini_api_key_required');
    } else if (this.isOpenRouterModel(model)) {
      const modelInfo = this.getModelInfo(model);
      if (modelInfo && modelInfo.isFree) {
        canUseModel = true;
      } else {
        canUseModel = !!dynamicApiKey;
        if (!canUseModel) reasonDisabled = chrome.i18n.getMessage('openrouter_api_key_required');
      }
    } else {
      canUseModel = false;
      reasonDisabled = "Unknown model selected";
    }
    const shouldEnable = canUseModel && !this.isProcessing && this.currentVideo;
    console.log("PopupView: Should enable generate button:", shouldEnable);
    generateBtn.disabled = !shouldEnable;
    if (!canUseModel) {
      console.log("PopupView: Generate button disabled -", reasonDisabled);
    } else if (this.isProcessing) {
      console.log("PopupView: Generate button disabled - currently processing");
    } else if (!this.currentVideo) {
      console.log("PopupView: Generate button disabled - no current video");
    } else {
      console.log("PopupView: Generate button enabled");
    }
  }
  async saveSettings() {
    try {
      const modelSelect = document.getElementById("modelSelect");
      const dynamicApiKeyInput = document.getElementById("dynamicApiKeyInput");
      const selectedModel = modelSelect.value;
      const dynamicApiKey = dynamicApiKeyInput.value.trim();
      const existingSettings = this.settings || {};
      const settings = {
        ...existingSettings,
        model: selectedModel
      };
      if (selectedModel.includes("gemini-")) {
        settings.apiKey = dynamicApiKey;
      } else if (this.isOpenRouterModel(selectedModel)) {
        const modelInfo = this.getModelInfo(selectedModel);
        if (modelInfo && !modelInfo.isFree) {
          settings.openRouterApiKey = dynamicApiKey;
        }
      }
      const response = await browser.runtime.sendMessage({
        action: "saveSettings",
        settings: settings
      });
      if (!response || !response.success) {
        throw new Error(response?.error || "Failed to save settings");
      }
      this.settings = settings;
    } catch (error) {
      console.error("Error saving settings:", error);
    }
  }
  async updateUI() {
    this.updateGenerateButtonState();
    try {
      const response = await browser.runtime.sendMessage({
        action: "getResultsTabStatus"
      });
      if (response && response.open) {
        document.getElementById("viewResultsBtn").style.display = "inline-block";
      } else {
        document.getElementById("viewResultsBtn").style.display = "none";
      }
    } catch (e) {
      document.getElementById("viewResultsBtn").style.display = "none";
    }
  }
  showNotification(message, type = "info") {
    const container = document.getElementById("notificationContainer");
    const notification = document.createElement("div");
    notification.className = `notification ${type}`;
    notification.textContent = message;
    container.appendChild(notification);
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 3e3);
  }
}

window.showNotification = function(message, type = "info") {
  if (window.popupManager) {
    window.popupManager.showNotification(message, type);
  }
};

console.log("About to initialize PopupView...");

console.log("Document ready state at init:", document.readyState);

if (document.readyState === "loading") {
  console.log("Document still loading, waiting for DOMContentLoaded...");
  document.addEventListener("DOMContentLoaded", () => {
    console.log("DOMContentLoaded fired, creating PopupView...");
    try {
      window.popupManager = new PopupView;
      console.log("PopupView created successfully");
    } catch (error) {
      console.error("Error creating PopupView:", error);
    }
  });
} else {
  console.log("Document already loaded, creating PopupView immediately...");
  try {
    window.popupManager = new PopupView;
    console.log("PopupView created successfully");
  } catch (error) {
    console.error("Error creating PopupView:", error);
  }
}