/**
 * Results Page Script for Video Chapters Generator
 * Handles display and user interaction with generated chapters and subtitles
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

function getResultIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("resultId");
}

class ResultsView {
  constructor(resultId) {
    this.resultId = resultId;
    this.results = null;
    this.currentFormat = "text";
    this.geminiAPI = null;
    this.userSwitchedTab = false;
    this.status = "pending";
    this.progress = 0;
    this.progressTimeout = null;
    this.init();
  }
  async init() {
    try {
      await this.checkStatusAndInit();
    } catch (error) {
      console.error("Error initializing results:", error);
      this.showError("Error loading results: " + error.message);
      this.hideProgress();
    }
  }
  async checkStatusAndInit() {
    this.status = await this.getGenerationStatus();
    if (this.status === "done") {
      await this.loadResults();
      this.setupEventListeners();
      this.setupTabSwitching();
      this.initializeGeminiAPI();
      this.switchTab("chapters");
      this.updateDisplay();
      this.hideProgress();
    } else if (this.status === "error") {
      this.setupEventListeners();
      this.setupTabSwitching();
      this.initializeGeminiAPI();
      await this.loadResults();
      this.handleGenerationError();
    } else {
      this.switchTab("subtitles");
      this.showProgress("Generating chapters...", 30);
      this.setupEventListeners();
      this.setupTabSwitching();
      this.initializeGeminiAPI();
      await this.loadResults();
      this.updateDisplay();
      this.pollForCompletion();
      this.startProgressTimeout();
    }
  }
  async getGenerationStatus() {
    try {
      const response = await browser.runtime.sendMessage({
        action: "getGenerationStatus",
        resultId: this.resultId
      });
      if (response && response.success) return response.status;
    } catch (e) {}
    return "pending";
  }
  showProgress(message, percent) {
    const section = document.getElementById("progressSection");
    const fill = document.getElementById("progressFill");
    const msg = document.getElementById("progressMessage");
    section.style.display = "block";
    fill.style.width = (percent || 30) + "%";
    msg.textContent = message || "Generating chapters...";
  }
  hideProgress() {
    const section = document.getElementById("progressSection");
    section.style.display = "none";
    if (this.progressTimeout) {
      clearTimeout(this.progressTimeout);
      this.progressTimeout = null;
    }
  }
  async pollForCompletion() {
    if (this.status === "done" || this.status === "error") return;
    let elapsed = 0;
    const poll = async () => {
      const status = await this.getGenerationStatus();
      if (status === "done") {
        this.status = "done";
        await this.loadResults();
        this.updateDisplay();
        if (!this.userSwitchedTab) this.switchTab("chapters");
        this.hideProgress();
      } else if (status === "error") {
        this.status = "error";
        this.hideProgress();
        await this.loadResults();
        this.handleGenerationError();
      } else {
        elapsed += 2;
        if (elapsed >= 300) {
          this.showProgress("Generation is taking longer than expected...", 90);
        } else if (elapsed >= 60) {
          this.showProgress("Still generating chapters, please wait...", 60);
        }
        setTimeout(poll, 2e3);
      }
    };
    poll();
  }
  startProgressTimeout() {
    this.progressTimeout = setTimeout(() => {
      this.showProgress("Generation timed out. Please try again.", 100);
    }, 5 * 60 * 1e3);
  }
  async handleGenerationError() {
    let errorMessage = "Chapter generation failed.";
    let suggestion = "Please try again.";
    if (this.results && this.results.error) {
      errorMessage = this.results.error;
      if (this.results.errorType && this.results.errorType.suggestion) {
        suggestion = this.results.errorType.suggestion;
      }
    }
    this.showNotification(`${errorMessage} ${suggestion}`, "error");
    document.getElementById("statusText").textContent = "Generation failed";
    const chaptersContent = document.getElementById("chaptersContent");
    if (chaptersContent) {
      chaptersContent.value = `Error: ${errorMessage}\n\nSuggestion: ${suggestion}\n\nPlease try again or switch to a different model.`;
      chaptersContent.classList.add("error-content");
    }
    if (!this.userSwitchedTab) {
      this.switchTab("chapters");
    }
  }
  initializeGeminiAPI() {
    this.geminiAPI = {
      formatChapters: (chapters, format) => {
        switch (format) {
         case "youtube":
          return this.formatForYouTube(chapters);

         case "json":
          return this.formatAsJSON(chapters);

         case "csv":
          return this.formatAsCSV(chapters);

         default:
          return chapters;
        }
      }
    };
  }
  setupEventListeners() {
    document.querySelectorAll(".tab-btn").forEach(btn => {
      btn.addEventListener("click", e => {
        this.switchTab(e.target.dataset.tab);
      });
    });
    document.getElementById("copyChaptersBtn").addEventListener("click", () => {
      this.copyToClipboard("chapters");
    });
    document.getElementById("copySubtitlesBtn").addEventListener("click", () => {
      this.copyToClipboard("subtitles");
    });
    document.getElementById("backBtn").addEventListener("click", async () => {
      await browser.runtime.sendMessage({
        action: "goBackToVideo"
      });
    });
    document.addEventListener("keydown", e => {
      if ((e.ctrlKey || e.metaKey) && e.key === "c" && !e.target.matches("textarea")) {
        e.preventDefault();
        const activeTab = document.querySelector(".tab-btn.active");
        if (activeTab) {
          this.copyToClipboard(activeTab.dataset.tab);
        }
      }
      if (e.key >= "1" && e.key <= "2" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        const tabIndex = parseInt(e.key) - 1;
        const tabs = [ "chapters", "subtitles" ];
        if (tabs[tabIndex]) {
          this.switchTab(tabs[tabIndex]);
        }
      }
    });
  }
  setupTabSwitching() {
    const tabBtns = document.querySelectorAll(".tab-btn");
    const tabPanes = document.querySelectorAll(".tab-pane");
    tabBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        const targetTab = btn.dataset.tab;
        tabBtns.forEach(b => b.classList.remove("active"));
        tabPanes.forEach(p => p.classList.remove("active"));
        btn.classList.add("active");
        const targetPane = document.getElementById(targetTab + "Tab");
        if (targetPane) {
          targetPane.classList.add("active");
        }
        if (this.status !== "done" && targetTab !== "subtitles") this.userSwitchedTab = true;
        if (this.status === "pending") this.userSwitchedTab = true;
      });
    });
  }
  async loadResults() {
    try {
      const response = await browser.runtime.sendMessage({
        action: "getSessionResults",
        resultId: this.resultId
      });
      if (response && response.success && response.results) {
        this.results = response.results;
        this.updatePageTitle();
        return;
      } else {
        throw new Error("No results found in this session. Please generate chapters first.");
      }
    } catch (error) {
      console.error("Error loading results:", error);
      throw error;
    }
  }
  updateDisplay() {
    if (!this.results) return;
    this.updateVideoInfo();
    this.updateChaptersDisplay();
    this.updateSubtitlesDisplay();
    document.getElementById("statusText").textContent = "";
  }
  updateVideoInfo() {
    const metadata = this.results.videoMetadata;
    if (!metadata) return;
    document.getElementById("videoTitle").textContent = metadata.title || "Unknown Title";
    document.getElementById("videoAuthor").textContent = metadata.author || "Unknown Author";
    if (this.results.timestamp) {
      const date = new Date(this.results.timestamp);
      const timeStr = date.toLocaleDateString() + " at " + date.toLocaleTimeString();
      document.getElementById("generationTime").textContent = `Generated on ${timeStr}`;
    }
  }
  updatePageTitle() {
    const pageTitle = document.getElementById("pageTitle");
    const userInstructions = document.getElementById("userInstructions");
    if (!pageTitle) return;
    let title = "Chapters";
    if (this.results && this.results.model) {
      const modelName = this.getModelDisplayName(this.results.model);
      title += ` (${modelName})`;
    }
    pageTitle.textContent = title;
    if (userInstructions) {
      if (this.results && this.results.customInstructions && this.results.customInstructions.trim()) {
        userInstructions.textContent = `"${this.results.customInstructions.trim()}"`;
        userInstructions.style.display = "block";
      } else {
        userInstructions.style.display = "none";
      }
    }
  }
  getModelDisplayName(model) {
    if (model.includes("gemini-2.5-pro")) return "Gemini 2.5 Pro";
    if (model.includes("gemini-2.5-flash")) return "Gemini 2.5 Flash";
    if (model.includes("deepseek-r1-0528:free")) return "DeepSeek R1 Free";
    if (model.includes("deepseek-r1-0528")) return "DeepSeek R1";
    if (model.includes("deepseek-r1")) return "DeepSeek R1";
    if (model.includes("claude-3.5-sonnet")) return "Claude 3.5 Sonnet";
    if (model.includes("claude-3.5-haiku")) return "Claude 3.5 Haiku";
    if (model.includes("gpt-4o-mini")) return "GPT-4o Mini";
    if (model.includes("gpt-4o")) return "GPT-4o";
    if (model.includes("llama-3.3-70b")) return "Llama 3.3 70B";
    const parts = model.split("/");
    const modelPart = parts[parts.length - 1];
    return modelPart.replace(/:free$/, " (Free)");
  }
  updateChaptersDisplay() {
    if (!this.results || !this.results.chapters) return;
    const chaptersContent = document.getElementById("chaptersContent");
    chaptersContent.value = this.results.chapters;
  }
  updateSubtitlesDisplay() {
    if (!this.results || !this.results.subtitles) return;
    const subtitlesContent = document.getElementById("subtitlesContent");
    const subtitleInfo = document.getElementById("subtitleInfo");
    subtitlesContent.value = this.results.subtitles.content || "";
    const info = [];
    if (this.results.subtitles.language) {
      info.push(`Language: ${this.results.subtitles.language}`);
    }
    if (this.results.subtitles.trackName) {
      info.push(`Track: ${this.results.subtitles.trackName}`);
    }
    if (this.results.subtitles.isAutoGenerated) {
      info.push("Auto-generated");
    }
    subtitleInfo.textContent = info.join(" • ");
  }
  switchTab(tabName) {
    const tabBtns = document.querySelectorAll(".tab-btn");
    const tabPanes = document.querySelectorAll(".tab-pane");
    tabBtns.forEach(btn => {
      btn.classList.toggle("active", btn.dataset.tab === tabName);
    });
    tabPanes.forEach(pane => {
      pane.classList.toggle("active", pane.id === tabName + "Tab");
    });
  }
  async copyToClipboard(contentType) {
    try {
      let content = "";
      let contentName = "";
      if (contentType === "chapters") {
        content = document.getElementById("chaptersContent").value;
        contentName = "Chapters";
      } else if (contentType === "subtitles") {
        content = document.getElementById("subtitlesContent").value;
        contentName = "Subtitles";
      }
      if (!content.trim()) {
        this.showNotification(`No ${contentName.toLowerCase()} to copy`, "warning");
        return;
      }
      await navigator.clipboard.writeText(content);
      this.showNotification(`${contentName} copied to clipboard!`, "success");
    } catch (error) {
      console.error("Error copying to clipboard:", error);
      this.showNotification("Failed to copy to clipboard", "error");
    }
  }
  formatForYouTube(chapters) {
    const lines = chapters.split("\n").filter(line => line.trim());
    return lines.map(line => {
      if (line.includes(" - ")) {
        return line.replace(" - ", " ");
      }
      return line;
    }).join("\n");
  }
  formatAsJSON(chapters) {
    const lines = chapters.split("\n").filter(line => line.trim());
    const parsed = lines.map(line => {
      const match = line.match(/^(\d{1,2}:\d{2}(?::\d{2})?)\s*[-–]\s*(.+)$/);
      if (match) {
        return {
          timestamp: match[1],
          title: match[2].trim(),
          seconds: this.timestampToSeconds(match[1])
        };
      }
      return {
        timestamp: "",
        title: line,
        seconds: 0
      };
    }).filter(item => item.title);
    return JSON.stringify(parsed, null, 2);
  }
  formatAsCSV(chapters) {
    const lines = chapters.split("\n").filter(line => line.trim());
    const header = "Timestamp,Title,Seconds\n";
    const rows = lines.map(line => {
      const match = line.match(/^(\d{1,2}:\d{2}(?::\d{2})?)\s*[-–]\s*(.+)$/);
      if (match) {
        return `"${match[1]}","${match[2].trim().replace(/"/g, '""')}",${this.timestampToSeconds(match[1])}`;
      }
      return `"","${line.replace(/"/g, '""')}",0`;
    }).filter(row => row.split(",")[1] !== '""');
    return header + rows.join("\n");
  }
  timestampToSeconds(timestamp) {
    const parts = timestamp.split(":").map(Number);
    if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    } else if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    return 0;
  }
  hideLoading() {}
  showLoading() {}
  showError(message) {
    this.showNotification(message, "error");
    document.getElementById("statusText").textContent = "Error loading results";
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
  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", async () => {
    const resultId = getResultIdFromUrl();
    if (browser && browser.runtime && browser.tabs) {
      try {
        const tab = await browser.tabs.getCurrent && await browser.tabs.getCurrent();
        if (tab && tab.id) {
          await browser.runtime.sendMessage({
            action: "setResultsTabId",
            tabId: tab.id
          });
        }
      } catch (e) {}
    }
    new ResultsView(resultId);
  });
} else {
  (async () => {
    const resultId = getResultIdFromUrl();
    if (browser && browser.runtime && browser.tabs) {
      try {
        const tab = await browser.tabs.getCurrent && await browser.tabs.getCurrent();
        if (tab && tab.id) {
          await browser.runtime.sendMessage({
            action: "setResultsTabId",
            tabId: tab.id
          });
        }
      } catch (e) {}
    }
    new ResultsView(resultId);
  })();
}