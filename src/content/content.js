/**
 * YouTube Integration Content Script
 * Handles subtitle extraction and communication with popup
 *
 * Copyright (C) 2025 Hamza Wasim
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


console.log('🚀 YouTubeIntegration content script loaded - CLEAN MODERN APPROACH');

if (window.hasYouTubeIntegration) {
  console.log('YouTubeIntegration: Script already loaded, skipping...');
} else {
  window.hasYouTubeIntegration = true;

  class YouTubeIntegration {
    constructor() {
    }

    init() {
      console.log('YouTubeIntegration: Starting init...');
      this.setupMessageListener();
    }

    setupMessageListener() {
      browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
        console.log('YouTubeIntegration: Received message:', request);
        if (request.action === 'copyTranscript') {
          this.extractTranscriptData().then(sendResponse);
          return true;
        }
        return false;
      });
    }

    extractVideoId() {
      console.log('YouTubeIntegration: extractVideoId called');
      console.log('YouTubeIntegration: Current URL:', window.location.href);
      const urlParams = new URLSearchParams(window.location.search);
      const videoId = urlParams.get('v');
      console.log('YouTubeIntegration: Extracted video ID:', videoId);
      return videoId;
    }

    async extractTranscriptData() {
      try {
        console.log('YouTubeIntegration: extractTranscriptData called - returning raw data for domain layer');
        const videoUrl = window.location.href;
        const isShorts = /youtube\.com\/shorts\//.test(videoUrl);
        const isLive = /youtube\.com\/live\//.test(videoUrl);

        let videoId;
        if (isShorts) {
          videoId = videoUrl.split('/shorts/')[1].split(/[/?#&]/)[0];
        } else if (isLive) {
          videoId = videoUrl.split('/live/')[1].split(/[/?#&]/)[0];
        } else {
          videoId = new URLSearchParams(window.location.search).get('v');
        }

        if (!videoId) {
          return {
            status: 'error',
            message: 'No YouTube video detected'
          };
        }

        console.log('YouTubeIntegration: Video ID detected:', videoId);
        console.log('YouTubeIntegration: Is Shorts:', isShorts);
        console.log('YouTubeIntegration: Is Live:', isLive);

        const transcriptObj = await this.getTranscriptDict();
        if (!transcriptObj.transcript || transcriptObj.transcript.length === 0) {
          return {
            status: 'error',
            message: 'No transcript available for this video'
          };
        }

        const lines = transcriptObj.transcript.map(([timestamp, text]) => `(${timestamp}) ${text}`).join('\n');

        return {
          status: 'success',
          transcript: lines,
          title: transcriptObj.title,
          author: transcriptObj.author,
          url: window.location.href
        };
      } catch (error) {
        console.error('YouTubeIntegration: extractTranscriptData error:', error);
        return {
          status: 'error',
          message: `Transcript extraction failed: ${error.message}`
        };
      }
    }

    async getTranscriptDict() {
      const metadata = this.getVideoMetadata();
      const transcript = await this.scrapeTranscriptFromDom();
      if (!transcript.length) {
        return { title: metadata.title, author: metadata.author, transcript: [] };
      }
      return {
        title: metadata.title,
        author: metadata.author,
        transcript
      };
    }

    getVideoMetadata() {
      const title =
        document.querySelector('h1.ytd-watch-metadata yt-formatted-string')?.textContent?.trim() ||
        document.querySelector('meta[property="og:title"]')?.content ||
        document.title.replace(' - YouTube', '') ||
        'Untitled';

      const author =
        document.querySelector('#owner #channel-name a')?.textContent?.trim() ||
        document.querySelector('ytd-channel-name a')?.textContent?.trim() ||
        document.querySelector('meta[itemprop="author"]')?.content ||
        'Unknown Channel';

      return { title, author };
    }

    async scrapeTranscriptFromDom() {
      const { panel, openedByScript } = await this.ensureTranscriptPanelOpen();
      const segments = await this.waitForTranscriptSegments(panel, 8000);
      if (!segments.length) {
        if (openedByScript) {
          this.closeTranscriptPanel(panel);
        }
        throw new Error('Transcript panel loaded but no segments were found');
      }

      const transcript = segments.map(segment => {
        const timestamp =
          segment.querySelector('.segment-time')?.textContent?.trim() ||
          segment.querySelector('#segment-time')?.textContent?.trim() ||
          '';
        const text =
          segment.querySelector('.segment-text')?.textContent?.trim() ||
          segment.querySelector('#segment-text')?.textContent?.trim() ||
          '';
        return [timestamp, text];
      }).filter(([, text]) => text.length > 0);

      if (openedByScript) {
        this.closeTranscriptPanel(panel);
      }

      return transcript;
    }

    async ensureTranscriptPanelOpen() {
      const existingPanel = document.querySelector('ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-searchable-transcript"]');
      if (existingPanel && this.isTranscriptPanelExpanded(existingPanel)) {
        const existingSegments = existingPanel.querySelectorAll('ytd-transcript-segment-renderer');
        if (existingSegments.length) {
          return { panel: existingPanel, openedByScript: false };
        }
      }

      if (await this.clickTranscriptToggleButton()) {
        const panel = await this.waitForTranscriptPanel(8000);
        if (panel) {
          return { panel, openedByScript: true };
        }
      }

      if (await this.openTranscriptViaMenu()) {
        const panel = await this.waitForTranscriptPanel(8000);
        if (panel) {
          return { panel, openedByScript: true };
        }
      }

      const fallbackPanel = await this.waitForTranscriptPanel(8000);
      if (fallbackPanel) {
        return { panel: fallbackPanel, openedByScript: true };
      }

      throw new Error('Unable to open transcript panel automatically');
    }

    isTranscriptPanelExpanded(panel) {
      if (!panel) {
        return false;
      }
      const visibility = panel.getAttribute('visibility');
      return visibility === 'ENGAGEMENT_PANEL_VISIBILITY_EXPANDED' || visibility === 'VISIBLE';
    }

    async clickTranscriptToggleButton() {
      const button = document.querySelector('button[aria-controls="engagement-panel-searchable-transcript"]');
      if (!button) {
        return false;
      }
      button.click();
      await this.delay(300);
      return true;
    }

    async openTranscriptViaMenu() {
      const menuButton = document.querySelector('ytd-watch-metadata ytd-menu-renderer yt-icon-button#button, ytd-watch-metadata ytd-menu-renderer button[aria-label][id="button"]');
      if (!menuButton) {
        return false;
      }

      menuButton.click();
      const menuItem = await this.waitForTranscriptMenuItem(5000);
      if (!menuItem) {
        return false;
      }

      menuItem.click();
      return true;
    }

    async waitForTranscriptMenuItem(timeout = 5000) {
      const start = performance.now();
      while (performance.now() - start < timeout) {
        const items = Array.from(document.querySelectorAll('ytd-menu-service-item-renderer'));
        const transcriptItem = items.find(item => this.isTranscriptMenuItem(item));
        if (transcriptItem) {
          return transcriptItem;
        }
        await this.delay(100);
      }
      return null;
    }

    isTranscriptMenuItem(item) {
      if (!item) {
        return false;
      }

      const text = item.textContent?.trim().toLowerCase() || '';
      if (text.includes('transcript')) {
        return true;
      }

      const endpoint = item.data?.endpoint ||
        item.__data?.data?.endpoint ||
        item.__data?.endpoint;

      if (endpoint?.getTranscriptEndpoint) {
        return true;
      }

      const panelIdentifier = endpoint?.showEngagementPanelEndpoint?.panelIdentifier;
      return typeof panelIdentifier === 'string' && panelIdentifier.includes('transcript');
    }

    async waitForTranscriptPanel(timeout = 5000) {
      const panel = await this.waitForElement('ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-searchable-transcript"]', timeout);
      if (panel) {
        panel.setAttribute('visibility', 'ENGAGEMENT_PANEL_VISIBILITY_EXPANDED');
      }
      return panel;
    }

    async waitForTranscriptSegments(panel, timeout = 8000) {
      const start = performance.now();
      while (performance.now() - start < timeout) {
        const segments = panel.querySelectorAll('ytd-transcript-segment-renderer');
        if (segments.length) {
          return Array.from(segments);
        }
        await this.delay(150);
      }
      return [];
    }

    async waitForElement(selector, timeout = 5000) {
      const start = performance.now();
      while (performance.now() - start < timeout) {
        const element = document.querySelector(selector);
        if (element) {
          return element;
        }
        await this.delay(100);
      }
      return null;
    }

    async delay(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }

    closeTranscriptPanel(panel) {
      if (!panel) {
        return;
      }

      const closeButton = panel.querySelector('#close-button, button[aria-label][id="close-button"]');
      if (closeButton) {
        closeButton.click();
        return;
      }

      const toggleButton = document.querySelector('button[aria-controls="engagement-panel-searchable-transcript"]');
      if (toggleButton) {
        toggleButton.click();
        return;
      }

      panel.setAttribute('visibility', 'ENGAGEMENT_PANEL_VISIBILITY_HIDDEN');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      console.log('YouTubeIntegration: DOM loaded, initializing...');
      const integration = new YouTubeIntegration();
      integration.init();
    });
  } else {
    console.log('YouTubeIntegration: Document ready, initializing...');
    const integration = new YouTubeIntegration();
    integration.init();
  }
}
