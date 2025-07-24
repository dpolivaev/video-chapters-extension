/**
 * Results Page Script for Video Chapters Generator
 * Handles display and management of generated chapters and subtitles
 */

if (typeof browser === 'undefined') {
  var browser = chrome;
}

// Helper to get resultId from URL
function getResultIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('resultId');
}

class ResultsManager {
  constructor(resultId) {
    this.resultId = resultId;
    this.results = null;
    this.currentFormat = 'text';
    this.geminiAPI = null;
    this.userSwitchedTab = false;
    this.status = 'pending';
    this.progress = 0;
    this.progressTimeout = null;
    this.init();
  }

  /**
   * Initialize the results manager
   */
  async init() {
    try {
      await this.checkStatusAndInit();
    } catch (error) {
      console.error('Error initializing results:', error);
      this.showError('Error loading results: ' + error.message);
      this.hideProgress();
    }
  }

  async checkStatusAndInit() {
    this.status = await this.getGenerationStatus();
    if (this.status === 'done') {
      await this.loadResults();
      this.setupEventListeners();
      this.setupTabSwitching();
      this.initializeGeminiAPI();
      this.switchTab('chapters');
      this.updateDisplay();
      this.hideProgress();
    } else {
      this.switchTab('subtitles');
      this.showProgress('Generating chapters...', 30);
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
      const response = await browser.runtime.sendMessage({ action: 'getGenerationStatus', resultId: this.resultId });
      if (response && response.success) return response.status;
    } catch (e) {}
    return 'pending';
  }

  showProgress(message, percent) {
    const section = document.getElementById('progressSection');
    const fill = document.getElementById('progressFill');
    const msg = document.getElementById('progressMessage');
    section.style.display = 'block';
    fill.style.width = (percent || 30) + '%';
    msg.textContent = message || 'Generating chapters...';
  }

  hideProgress() {
    const section = document.getElementById('progressSection');
    section.style.display = 'none';
    if (this.progressTimeout) {
      clearTimeout(this.progressTimeout);
      this.progressTimeout = null;
    }
  }

  async pollForCompletion() {
    if (this.status === 'done') return;
    let elapsed = 0;
    const poll = async () => {
      const status = await this.getGenerationStatus();
      if (status === 'done') {
        this.status = 'done';
        await this.loadResults();
        this.updateDisplay();
        if (!this.userSwitchedTab) this.switchTab('chapters');
        this.hideProgress();
      } else {
        elapsed += 2;
        if (elapsed >= 300) {
          this.showProgress('Generation is taking longer than expected...', 90);
        } else if (elapsed >= 60) {
          this.showProgress('Still generating chapters, please wait...', 60);
        }
        setTimeout(poll, 2000);
      }
    };
    poll();
  }

  startProgressTimeout() {
    this.progressTimeout = setTimeout(() => {
      this.showProgress('Generation timed out. Please try again.', 100);
    }, 5 * 60 * 1000);
  }

  /**
   * Initialize Gemini API for format conversion
   */
  initializeGeminiAPI() {
    // We'll import this dynamically if needed for format conversion
    this.geminiAPI = {
      formatChapters: (chapters, format) => {
        switch (format) {
          case 'youtube':
            return this.formatForYouTube(chapters);
          case 'json':
            return this.formatAsJSON(chapters);
          case 'csv':
            return this.formatAsCSV(chapters);
          default:
            return chapters;
        }
      }
    };
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.switchTab(e.target.dataset.tab);
      });
    });

    // Copy buttons
    document.getElementById('copyChaptersBtn').addEventListener('click', () => {
      this.copyToClipboard('chapters');
    });
    document.getElementById('copySubtitlesBtn').addEventListener('click', () => {
      this.copyToClipboard('subtitles');
    });

    // Navigation buttons
    document.getElementById('backBtn').addEventListener('click', async () => {
      // Ask background to handle smart navigation back to video tab
      await browser.runtime.sendMessage({ action: 'goBackToVideo' });
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Ctrl/Cmd + C: Copy current tab content
      if ((e.ctrlKey || e.metaKey) && e.key === 'c' && !e.target.matches('textarea')) {
        e.preventDefault();
        const activeTab = document.querySelector('.tab-btn.active');
        if (activeTab) {
          this.copyToClipboard(activeTab.dataset.tab);
        }
      }
      // Tab switching with numbers
      if (e.key >= '1' && e.key <= '2' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        const tabIndex = parseInt(e.key) - 1;
        const tabs = ['chapters', 'subtitles'];
        if (tabs[tabIndex]) {
          this.switchTab(tabs[tabIndex]);
        }
      }
    });
  }

  /**
   * Setup tab switching functionality
   */
  setupTabSwitching() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');

    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.dataset.tab;
        
        // Remove active class from all tabs and panes
        tabBtns.forEach(b => b.classList.remove('active'));
        tabPanes.forEach(p => p.classList.remove('active'));
        
        // Add active class to clicked tab and corresponding pane
        btn.classList.add('active');
        const targetPane = document.getElementById(targetTab + 'Tab');
        if (targetPane) {
          targetPane.classList.add('active');
        }
        if (this.status !== 'done' && targetTab !== 'subtitles') this.userSwitchedTab = true;
        if (this.status === 'pending') this.userSwitchedTab = true;
      });
    });
  }

  /**
   * Load results from background session relay
   */
  async loadResults() {
    try {
      const response = await browser.runtime.sendMessage({ action: 'getSessionResults', resultId: this.resultId });
      if (response && response.success && response.results) {
        this.results = response.results;
        return;
      } else {
        throw new Error('No results found in this session. Please generate chapters first.');
      }
    } catch (error) {
      console.error('Error loading results:', error);
      throw error;
    }
  }

  /**
   * Update the display with loaded results
   */
  updateDisplay() {
    if (!this.results) return;

    // Update video metadata
    this.updateVideoInfo();
    
    // Update content
    this.updateChaptersDisplay();
    this.updateSubtitlesDisplay();
    
    // Update status
    document.getElementById('statusText').textContent = '';
  }

  /**
   * Update video information section
   */
  updateVideoInfo() {
    const metadata = this.results.videoMetadata;
    if (!metadata) return;

    document.getElementById('videoTitle').textContent = metadata.title || 'Unknown Title';
    document.getElementById('videoAuthor').textContent = metadata.author || 'Unknown Author';
    
    // Format generation time
    if (this.results.timestamp) {
      const date = new Date(this.results.timestamp);
      const timeStr = date.toLocaleDateString() + ' at ' + date.toLocaleTimeString();
      document.getElementById('generationTime').textContent = `Generated on ${timeStr}`;
    }
  }

  /**
   * Update chapters display
   */
  updateChaptersDisplay() {
    if (!this.results || !this.results.chapters) return;

    const chaptersContent = document.getElementById('chaptersContent');
    chaptersContent.value = this.results.chapters;
  }

  /**
   * Update subtitles display
   */
  updateSubtitlesDisplay() {
    if (!this.results || !this.results.subtitles) return;

    const subtitlesContent = document.getElementById('subtitlesContent');
    const subtitleInfo = document.getElementById('subtitleInfo');
    
    subtitlesContent.value = this.results.subtitles.content || '';
    
    // Update subtitle info
    const info = [];
    if (this.results.subtitles.language) {
      info.push(`Language: ${this.results.subtitles.language}`);
    }
    if (this.results.subtitles.trackName) {
      info.push(`Track: ${this.results.subtitles.trackName}`);
    }
    if (this.results.subtitles.isAutoGenerated) {
      info.push('Auto-generated');
    }
    
    subtitleInfo.textContent = info.join(' • ');
  }

  /**
   * Switch to a specific tab
   */
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

  /**
   * Copy content to clipboard
   */
  async copyToClipboard(contentType) {
    try {
      let content = '';
      let contentName = '';
      
      if (contentType === 'chapters') {
        content = document.getElementById('chaptersContent').value;
        contentName = 'Chapters';
      } else if (contentType === 'subtitles') {
        content = document.getElementById('subtitlesContent').value;
        contentName = 'Subtitles';
      }
      
      if (!content.trim()) {
        this.showNotification(`No ${contentName.toLowerCase()} to copy`, 'warning');
        return;
      }
      
      await navigator.clipboard.writeText(content);
      this.showNotification(`${contentName} copied to clipboard!`, 'success');
      
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      this.showNotification('Failed to copy to clipboard', 'error');
    }
  }

  /**
   * Format conversion methods
   */
  formatForYouTube(chapters) {
    // Simple YouTube format: timestamp followed by title
    const lines = chapters.split('\n').filter(line => line.trim());
    return lines.map(line => {
      // If line already contains a dash, assume it's formatted correctly
      if (line.includes(' - ')) {
        return line.replace(' - ', ' ');
      }
      return line;
    }).join('\n');
  }

  formatAsJSON(chapters) {
    const lines = chapters.split('\n').filter(line => line.trim());
    const parsed = lines.map(line => {
      const match = line.match(/^(\d{1,2}:\d{2}(?::\d{2})?)\s*[-–]\s*(.+)$/);
      if (match) {
        return {
          timestamp: match[1],
          title: match[2].trim(),
          seconds: this.timestampToSeconds(match[1])
        };
      }
      return { timestamp: '', title: line, seconds: 0 };
    }).filter(item => item.title);
    
    return JSON.stringify(parsed, null, 2);
  }

  formatAsCSV(chapters) {
    const lines = chapters.split('\n').filter(line => line.trim());
    const header = 'Timestamp,Title,Seconds\n';
    const rows = lines.map(line => {
      const match = line.match(/^(\d{1,2}:\d{2}(?::\d{2})?)\s*[-–]\s*(.+)$/);
      if (match) {
        return `"${match[1]}","${match[2].trim().replace(/"/g, '""')}",${this.timestampToSeconds(match[1])}`;
      }
      return `"","${line.replace(/"/g, '""')}",0`;
    }).filter(row => row.split(',')[1] !== '""');
    
    return header + rows.join('\n');
  }

  /**
   * Convert timestamp to seconds
   */
  timestampToSeconds(timestamp) {
    const parts = timestamp.split(':').map(Number);
    if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    } else if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    return 0;
  }

  /**
   * Hide loading overlay
   */
  hideLoading() {}

  /**
   * Show loading overlay
   */
  showLoading() {}

  /**
   * Show error message
   */
  showError(message) {
    this.showNotification(message, 'error');
    document.getElementById('statusText').textContent = 'Error loading results';
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

  /**
   * Escape HTML for safe display
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize the results manager when the page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', async () => {
    // Notify background of this tab's ID for tracking, with resultId
    const resultId = getResultIdFromUrl();
    if (browser && browser.runtime && browser.tabs) {
      try {
        const tab = await browser.tabs.getCurrent && await browser.tabs.getCurrent();
        if (tab && tab.id) {
          await browser.runtime.sendMessage({ action: 'setResultsTabId', tabId: tab.id });
        }
      } catch (e) {}
    }
    new ResultsManager(resultId);
  });
} else {
  (async () => {
    const resultId = getResultIdFromUrl();
    if (browser && browser.runtime && browser.tabs) {
      try {
        const tab = await browser.tabs.getCurrent && await browser.tabs.getCurrent();
        if (tab && tab.id) {
          await browser.runtime.sendMessage({ action: 'setResultsTabId', tabId: tab.id });
        }
      } catch (e) {}
    }
    new ResultsManager(resultId);
  })();
} 