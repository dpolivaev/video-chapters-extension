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
if (typeof browser === 'undefined') {
  const browser = chrome;
}

function getResultIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('resultId');
}

class ResultsView {
  constructor(resultId) {
    this.resultId = resultId;
    this.results = null;
    this.userSwitchedTab = false;
    this.status = 'pending';
    this.progress = 0;
    this.progressTimeout = null;
    this.init();
  }
  async init() {
    try {
      await this.checkStatusAndInit();
    } catch (error) {
      console.error('Error initializing results:', error);
      this.showError(getLocalizedMessage('error_loading_results') + ': ' + error.message);
      this.hideProgress();
    }
  }
  async checkStatusAndInit() {
    this.status = await this.getGenerationStatus();

    if (this.status === 'done') {
      await this.loadResults();
      this.setupEventListeners();
      this.setupTabSwitching();
      this.switchTab('chapters');
      this.updateDisplay();
      this.hideProgress();
    } else if (this.status === 'error') {
      this.setupEventListeners();
      this.setupTabSwitching();
      await this.loadResults();
      this.handleGenerationError();
    } else {
      await this.loadResults();

      if (this.isGenerationComplete()) {
        this.status = 'done';
        this.setupEventListeners();
        this.setupTabSwitching();
        this.switchTab('chapters');
        this.updateDisplay();
        this.hideProgress();
      } else {
        this.switchTab('subtitles');
        this.showProgress(getLocalizedMessage('progress_generating_chapters'), 30);
        this.setupEventListeners();
        this.setupTabSwitching();
        this.updateDisplay();
        this.pollForCompletion();
        this.startProgressTimeout();
      }
    }
  }
  async getGenerationStatus() {
    try {
      const response = await browser.runtime.sendMessage({
        action: 'getGenerationStatus',
        resultId: this.resultId
      });
      if (response && response.success) {
        return response.status;
      }
    } catch (e) {
      console.debug('Status check failed silently', e);
    }
    return 'pending';
  }
  isGenerationComplete() {
    if (!this.results || !this.results.chapters) {
      return false;
    }

    const chapters = this.results.chapters.trim();
    if (!chapters) {
      return false;
    }

    const videoUrl = this.results.videoMetadata?.url || '';
    const isJustUrl = chapters === videoUrl || chapters === videoUrl + '\n\n';

    return !isJustUrl;
  }
  showProgress(message, percent) {
    const section = document.getElementById('progressSection');
    const fill = document.getElementById('progressFill');
    const msg = document.getElementById('progressMessage');
    section.style.display = 'block';
    fill.style.width = (percent || 30) + '%';
    msg.textContent = message || getLocalizedMessage('progress_generating_chapters');
  }
  hideProgress() {
    const section = document.getElementById('progressSection');
    section.style.display = 'none';
    if (this.progressTimeout) {
      clearTimeout(this.progressTimeout);
      this.progressTimeout = null;
    }
    if (this.pollingTimeout) {
      clearTimeout(this.pollingTimeout);
      this.pollingTimeout = null;
    }
  }
  async pollForCompletion() {
    if (this.status === 'done' || this.status === 'error') {
      return;
    }

    if (this.pollingTimeout) {
      clearTimeout(this.pollingTimeout);
      this.pollingTimeout = null;
    }

    let elapsed = 0;
    const poll = async () => {
      if (this.status === 'done' || this.status === 'error') {
        return;
      }

      const status = await this.getGenerationStatus();

      if (status === 'done') {
        this.status = 'done';
        await this.loadResults();
        this.updateDisplay();
        if (!this.userSwitchedTab) {
          this.switchTab('chapters');
        }
        this.hideProgress();
        if (this.pollingTimeout) {
          clearTimeout(this.pollingTimeout);
          this.pollingTimeout = null;
        }
        return;
      } else if (status === 'error') {
        this.status = 'error';
        this.hideProgress();
        await this.loadResults();
        this.handleGenerationError();
        if (this.pollingTimeout) {
          clearTimeout(this.pollingTimeout);
          this.pollingTimeout = null;
        }
        return;
      } else {
        elapsed += 2;
        if (elapsed >= 300) {
          this.showProgress(getLocalizedMessage('generation_is_taking_longer_than_expected'), 90);
        } else if (elapsed >= 60) {
          this.showProgress(getLocalizedMessage('still_generating_chapters_please_wait'), 60);
        }
        this.pollingTimeout = setTimeout(poll, 2e3);
      }
    };
    poll();
  }
  startProgressTimeout() {
    this.progressTimeout = setTimeout(() => {
      this.showProgress(getLocalizedMessage('generation_timed_out_please_try_again'), 100);
    }, 5 * 60 * 1e3);
  }
  async handleGenerationError() {
    let errorMessage = getLocalizedMessage('chapter_generation_failed');
    let suggestion = getLocalizedMessage('please_try_again');
    if (this.results && this.results.error) {
      errorMessage = this.results.error;
      if (this.results.errorType && this.results.errorType.suggestion) {
        suggestion = this.results.errorType.suggestion;
      }
    }
    this.showNotification(errorMessage + ' ' + suggestion, 'error');
    document.getElementById('statusText').textContent = getLocalizedMessage('generation_failed');
    const chaptersContent = document.getElementById('chaptersContent');
    if (chaptersContent) {
      chaptersContent.value = getLocalizedMessage('error') + ': ' + errorMessage + '\n\n' + getLocalizedMessage('please_try_again') + '\n\n' + getLocalizedMessage('general_error');
      chaptersContent.classList.add('error-content');
    }
    if (!this.userSwitchedTab) {
      this.switchTab('chapters');
    }
  }
  setupEventListeners() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        this.switchTab(e.target.dataset.tab);
      });
    });
    document.getElementById('copyChaptersBtn').addEventListener('click', () => {
      this.copyToClipboard('chapters');
    });
    document.getElementById('copySubtitlesBtn').addEventListener('click', () => {
      this.copyToClipboard('subtitles');
    });
    document.getElementById('backBtn').addEventListener('click', async () => {
      await browser.runtime.sendMessage({
        action: 'goBackToVideo',
        resultId: this.resultId
      });
    });
    document.getElementById('helpBtn').addEventListener('click', () => {
      this.openHelp();
    });
    document.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'c' && !e.target.matches('textarea')) {
        e.preventDefault();
        const activeTab = document.querySelector('.tab-btn.active');
        if (activeTab) {
          this.copyToClipboard(activeTab.dataset.tab);
        }
      }
      if (e.key >= '1' && e.key <= '2' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        const tabIndex = parseInt(e.key) - 1;
        const tabs = [ 'chapters', 'subtitles' ];
        if (tabs[tabIndex]) {
          this.switchTab(tabs[tabIndex]);
        }
      }
    });
  }
  setupTabSwitching() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.dataset.tab;
        tabBtns.forEach(b => b.classList.remove('active'));
        tabPanes.forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        const targetPane = document.getElementById(targetTab + 'Tab');
        if (targetPane) {
          targetPane.classList.add('active');
        }
        if (this.status !== 'done' && targetTab !== 'subtitles') {
          this.userSwitchedTab = true;
        }
        if (this.status === 'pending') {
          this.userSwitchedTab = true;
        }
      });
    });
  }
  async loadResults() {
    try {
      const response = await browser.runtime.sendMessage({
        action: 'getSessionResults',
        resultId: this.resultId
      });
      if (response && response.success && response.results) {
        this.results = response.results;
        this.updatePageTitle();
        return;
      } else {
        throw new Error(getLocalizedMessage('no_results_found_in_this_session_please_generate_chapters_first'));
      }
    } catch (error) {
      console.error('Error loading results:', error);
      throw error;
    }
  }
  updateDisplay() {
    if (!this.results) {
      return;
    }
    this.updateVideoInfo();
    this.updateChaptersDisplay();
    this.updateSubtitlesDisplay();
    document.getElementById('statusText').textContent = '';
  }
  updateVideoInfo() {
    const metadata = this.results.videoMetadata;
    if (!metadata) {
      return;
    }
    document.getElementById('videoTitle').textContent = metadata.title || getLocalizedMessage('unknown_title');
    document.getElementById('videoAuthor').textContent = metadata.author || getLocalizedMessage('unknown_author');
    if (this.results.timestamp) {
      const date = new Date(this.results.timestamp);
      const timeStr = date.toLocaleDateString() + ' at ' + date.toLocaleTimeString();
      document.getElementById('generationTime').textContent = getLocalizedMessage('generated_on') + ' ' + timeStr;
    }
  }
  updatePageTitle() {
    const pageTitle = document.getElementById('pageTitle');
    const userInstructions = document.getElementById('userInstructions');
    if (!pageTitle) {
      return;
    }
    let title = getLocalizedMessage('results_page_title');
    if (this.results && this.results.model) {
      const modelName = this.getModelDisplayName(this.results.model);
      title += ` (${modelName})`;
    }
    pageTitle.textContent = title;
    if (userInstructions) {
      if (this.results && this.results.customInstructions && this.results.customInstructions.trim()) {
        userInstructions.textContent = '"' + this.results.customInstructions.trim() + '"';
        userInstructions.style.display = 'block';
      } else {
        userInstructions.style.display = 'none';
      }
    }
  }
  getModelDisplayName(model) {
    if (model.includes('gemini-2.5-pro')) {
      return 'Gemini 2.5 Pro';
    }
    if (model.includes('gemini-2.5-flash')) {
      return 'Gemini 2.5 Flash';
    }
    if (model.includes('deepseek-r1-0528:free')) {
      return 'DeepSeek R1 (Free)';
    }
    if (model.includes('deepseek-r1-0528')) {
      return 'DeepSeek R1';
    }
    if (model.includes('deepseek-r1')) {
      return 'DeepSeek R1';
    }
    if (model.includes('claude-3.5-sonnet')) {
      return 'Claude 3.5 Sonnet';
    }
    if (model.includes('claude-3.5-haiku')) {
      return 'Claude 3.5 Haiku';
    }
    if (model.includes('gpt-4o-mini')) {
      return 'GPT-4o Mini';
    }
    if (model.includes('gpt-4o')) {
      return 'GPT-4o';
    }
    if (model.includes('llama-3.3-70b')) {
      return 'Llama 3.3 70B';
    }
    const parts = model.split('/');
    const modelPart = parts[parts.length - 1];
    const freeText = getLocalizedMessage('free') || 'Free';
    return modelPart.replace(/:free$/, ' (' + freeText + ')');
  }
  updateChaptersDisplay() {
    if (!this.results || !this.results.chapters) {
      return;
    }
    const chaptersHtml = document.getElementById('chaptersHtml');
    chaptersHtml.textContent = '';

    const videoId = this.results.videoMetadata?.url && this.extractVideoId(this.results.videoMetadata.url);

    if (videoId) {
      this.renderChaptersWithVideoLink(chaptersHtml, videoId);
    } else {
      this.renderChaptersAsPlainText(chaptersHtml);
    }

    this.appendDisclaimer(chaptersHtml);
  }
  renderChaptersWithVideoLink(container, videoId) {
    const urlLink = document.createElement('a');
    urlLink.href = this.results.videoMetadata.url;
    urlLink.textContent = this.results.videoMetadata.url;
    container.appendChild(urlLink);

    container.appendChild(document.createElement('br'));
    container.appendChild(document.createElement('br'));

    this.renderChaptersWithTimestampLinks(container, videoId);
  }

  renderChaptersWithTimestampLinks(container, videoId) {
    const chapters = this.results.chapters.split('\n');
    chapters.forEach((line, index) => {
      if (index > 0) {
        container.appendChild(document.createElement('br'));
      }

      const match = line.match(/^((?:\d+:)?\d{1,2}:\d{2})\s*-\s*(.+)$/);
      if (match) {
        const [, timestamp, title] = match;
        const ytFormat = this.formatTimestampForYoutube(timestamp);

        const timestampLink = document.createElement('a');
        timestampLink.href = `https://youtube.com/watch?v=${videoId}&t=${ytFormat}`;
        timestampLink.textContent = timestamp;
        container.appendChild(timestampLink);

        const separator = document.createTextNode(' - ');
        container.appendChild(separator);

        const titleText = document.createTextNode(title);
        container.appendChild(titleText);
      } else {
        const lineText = document.createTextNode(line);
        container.appendChild(lineText);
      }
    });
  }

  renderChaptersAsPlainText(container) {
    if (this.results.videoMetadata?.url) {
      const urlText = document.createTextNode(this.results.videoMetadata.url);
      container.appendChild(urlText);
      container.appendChild(document.createElement('br'));
      container.appendChild(document.createElement('br'));
    }

    const chaptersLines = this.results.chapters.split('\n');
    chaptersLines.forEach((line, index) => {
      if (index > 0) {
        container.appendChild(document.createElement('br'));
      }
      const lineText = document.createTextNode(line);
      container.appendChild(lineText);
    });
  }
  updateSubtitlesDisplay() {
    if (!this.results || !this.results.processedContent) {
      return;
    }
    const subtitlesContent = document.getElementById('subtitlesContent');
    const subtitleInfo = document.getElementById('subtitleInfo');
    subtitlesContent.value = this.results.processedContent.content || '';
    const info = [];
    if (this.results.processedContent.language) {
      info.push(`${getLocalizedMessage('language')}: ${this.results.processedContent.language}`);
    }
    if (this.results.processedContent.trackName) {
      info.push(`${getLocalizedMessage('track')}: ${this.results.processedContent.trackName}`);
    }
    if (this.results.processedContent.isAutoGenerated) {
      info.push(getLocalizedMessage('auto_generated'));
    }
    subtitleInfo.textContent = info.join(' • ');
  }
  switchTab(tabName) {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');
    tabBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    tabPanes.forEach(pane => {
      pane.classList.toggle('active', pane.id === tabName + 'Tab');
    });
  }
  async copyToClipboard(contentType) {
    try {
      let element;
      let contentName = '';
      if (contentType === 'chapters') {
        element = document.getElementById('chaptersHtml');
        contentName = 'Chapters';
      } else if (contentType === 'subtitles') {
        element = document.getElementById('subtitlesContent');
        contentName = 'Subtitles';
      }

      const content = element.tagName === 'TEXTAREA' ? element.value : element.textContent;
      if (!element || !content.trim()) {
        this.showNotification(getLocalizedMessage('no_' + contentName.toLowerCase() + '_to_copy'), 'warning');
        return;
      }

      const selection = window.getSelection();

      if (selection.rangeCount > 0 && !selection.isCollapsed) {
        const range = selection.getRangeAt(0);
        const fragment = range.cloneContents();
        const tempDiv = document.createElement('div');
        tempDiv.appendChild(fragment);

        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': new Blob([tempDiv.innerHTML], { type: 'text/html' }),
            'text/plain': new Blob([selection.toString()], { type: 'text/plain' })
          })
        ]);
      } else {
        if (element.tagName === 'TEXTAREA') {
          await navigator.clipboard.writeText(element.value);
        } else {
          const range = document.createRange();
          range.selectNodeContents(element);
          selection.removeAllRanges();
          selection.addRange(range);

          await navigator.clipboard.write([
            new ClipboardItem({
              'text/html': new Blob([element.innerHTML], { type: 'text/html' }),
              'text/plain': new Blob([selection.toString()], { type: 'text/plain' })
            })
          ]);

          selection.removeAllRanges();
        }
      }

      this.showNotification(getLocalizedMessage(contentName.toLowerCase() + '_copied'), 'success');
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      this.showNotification(getLocalizedMessage('failed_to_copy'), 'error');
    }
  }
  hideLoading() {}
  showLoading() {}
  showError(message) {
    this.showNotification(message, 'error');
    document.getElementById('statusText').textContent = getLocalizedMessage('error_loading_results');
  }
  showNotification(message, type = 'info') {
    const container = document.getElementById('notificationContainer');
    const notification = document.createElement('div');
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
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  extractVideoId(url) {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/,
      /youtube\.com\/embed\/([^&\n?#]+)/
    ];
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return match[1];
      }
    }
    return null;
  }
  formatTimestampForYoutube(timestamp) {
    const parts = timestamp.split(':');
    if (parts.length === 3) {
      return `${parseInt(parts[0])}h${parseInt(parts[1])}m${parseInt(parts[2])}s`;
    } else {
      return `${parseInt(parts[0])}m${parseInt(parts[1])}s`;
    }
  }
  openHelp() {
    browser.tabs.create({ url: browser.runtime.getURL('help/help.html') });
  }

  appendDisclaimer(container) {
    if (!this.results?.model) {
      return;
    }

    container.appendChild(document.createElement('br'));
    container.appendChild(document.createElement('br'));

    const disclaimerElement = this.buildDisclaimerElement();
    container.appendChild(disclaimerElement);
  }

  buildDisclaimerElement() {
    const element = document.createElement('div');
    element.style.fontStyle = 'italic';
    element.style.fontSize = 'smaller';
    element.style.color = '#666';

    const isFirefox = this.detectFirefox();
    const modelName = '"' + this.getModelDisplayName(this.results.model) + '"';
    const disclaimerKey = isFirefox ? 'disclaimer_firefox' : 'disclaimer_chrome';
    const disclaimerText = getLocalizedMessage(disclaimerKey, [modelName]);

    const parts = disclaimerText.split('%EXTENSION_LINK%');

    if (parts.length === 2) {
      element.appendChild(document.createTextNode(parts[0]));

      const link = document.createElement('a');
      link.href = 'https://dpolivaev.github.io/video-chapters-extension/';
      link.target = '_blank';
      link.textContent = '"Video Chapters Generator"';
      element.appendChild(link);

      element.appendChild(document.createTextNode(parts[1]));
    } else {
      element.textContent = disclaimerText;
    }

    return element;
  }

  detectFirefox() {
    return typeof InstallTrigger !== 'undefined' || navigator.userAgent.includes('Firefox');
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', async () => {
    const resultId = getResultIdFromUrl();
    if (browser && browser.runtime && browser.tabs) {
      try {
        const tab = await browser.tabs.getCurrent && await browser.tabs.getCurrent();
        if (tab && tab.id) {
          await browser.runtime.sendMessage({
            action: 'setResultsTabId',
            tabId: tab.id
          });
        }
      } catch (e) {
        // Ignore errors in status check
      }
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
            action: 'setResultsTabId',
            tabId: tab.id
          });
        }
      } catch (e) {
        // Ignore errors in status check
      }
    }
    new ResultsView(resultId);
  })();
}
