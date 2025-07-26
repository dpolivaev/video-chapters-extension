/**
 * YouTube Integration Content Script
 * Handles subtitle extraction and communication with popup
 *
 * Copyright (C) 2025 Hamza Wasim
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

console.log('🚀 YouTubeIntegration content script loaded - CLEAN MODERN APPROACH');

/**
 * Simple retry utility for content scripts
 * Handles 5xx server errors with exponential backoff
 */
class SimpleRetryHandler {
  constructor() {
    this.maxRetries = 3;
  }

  isRetryableError(response) {
    return response && response.status >= 500 && response.status < 600;
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async fetchWithRetry(url, options = {}) {
    console.log(`🚀 CONTENT_RETRY_START: Initiating request with up to ${this.maxRetries} retries for ${url}`);
    let lastError;
    let attempt = 0;

    while (attempt <= this.maxRetries) {
      try {
        const response = await fetch(url, options);

        if (!this.isRetryableError(response)) {
          if (attempt > 0) {
            console.log(`✅ CONTENT_RETRY_SUCCESS: Request succeeded after ${attempt} retries for ${url}`);
          } else {
            console.log(`✅ CONTENT_REQUEST_SUCCESS: Request succeeded on first attempt for ${url}`);
          }
          return response;
        }

        lastError = new Error(`Server error: ${response.status} ${response.statusText}`);

        if (attempt >= this.maxRetries) {
          break;
        }

        const delay = (attempt + 1) * 5000;
        console.log(`🔄 CONTENT_RETRY: Server error ${response.status} ${response.statusText} - Retry attempt ${attempt + 1}/${this.maxRetries} after ${delay}ms for ${url}`);

        await this.delay(delay);
        attempt++;

      } catch (error) {
        lastError = error;

        if (attempt >= this.maxRetries) {
          break;
        }

        const delay = (attempt + 1) * 5000;
        console.log(`🔄 CONTENT_RETRY: Network/fetch error "${error.message}" - Retry attempt ${attempt + 1}/${this.maxRetries} after ${delay}ms for ${url}`);

        await this.delay(delay);
        attempt++;
      }
    }

    console.log(`❌ CONTENT_RETRY_FAILED: All ${this.maxRetries} retries exhausted for ${url}. Final error: ${lastError?.message || 'Unknown error'}`);
    throw lastError || new Error('All retries exhausted');
  }
}

const simpleRetryHandler = new SimpleRetryHandler();

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
          this.extractTranscriptForCopy().then(sendResponse);
          return true;
        }
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

    async extractTranscriptForCopy() {
      try {
        console.log('YouTubeIntegration: extractTranscriptForCopy called - using PROVEN working method');
        const videoUrl = window.location.href;
        const isShorts = /youtube\.com\/shorts\//.test(videoUrl);
        const videoId = isShorts ? videoUrl.split('/shorts/')[1].split(/[/?#&]/)[0] : new URLSearchParams(window.location.search).get('v');

        if (!videoId) {
          return {
            status: 'error',
            message: 'No YouTube video detected'
          };
        }

        console.log('YouTubeIntegration: Video ID detected:', videoId);
        console.log('YouTubeIntegration: Is Shorts:', isShorts);

        const transcriptObj = await this.getTranscriptDict(videoUrl);
        if (!transcriptObj.transcript || transcriptObj.transcript.length === 0) {
          return {
            status: 'error',
            message: 'No transcript available for this video'
          };
        }

        const lines = transcriptObj.transcript.map(([timestamp, text]) => `(${timestamp}) ${text}`).join('\n');
        const transcriptWithTitle = `Title: ${transcriptObj.title}\n\n${lines}`;

        return {
          status: 'success',
          transcript: transcriptWithTitle,
          title: transcriptObj.title,
          author: transcriptObj.author,
          url: window.location.href
        };
      } catch (error) {
        console.error('YouTubeIntegration: extractTranscriptForCopy error:', error);
        return {
          status: 'error',
          message: `Transcript extraction failed: ${error.message}`
        };
      }
    }

    async getTranscriptDict(videoUrl) {
      const isShorts = /youtube\.com\/shorts\//.test(videoUrl);
      const dataType = 'regular';

      const { title, author, ytData, dataKey, resolvedType } = await this.resolveYouTubeData(videoUrl, dataType);
      const segments = await this.getTranscriptItems(ytData, dataKey);

      if (!segments.length) {
        return { title, author, transcript: [] };
      }

      const transcript = this.createTranscriptArray(segments, resolvedType);
      return { title, author, transcript };
    }

    async resolveYouTubeData(videoUrl, initialType) {
      const dataKey = 'ytInitialData';

      console.log('YouTubeIntegration: Fetching page HTML for:', videoUrl);
      const html = await simpleRetryHandler.fetchWithRetry(videoUrl).then(res => res.text());
      const ytData = this.extractJsonFromHtml(html, dataKey);

      const title = ytData?.videoDetails?.title ||
        ytData?.contents?.twoColumnWatchNextResults?.results?.results?.contents?.[0]?.videoPrimaryInfoRenderer?.title?.runs?.[0]?.text ||
        ytData?.playerOverlays?.playerOverlayRenderer?.videoDetails?.playerOverlayVideoDetailsRenderer?.title?.simpleText ||
        document.querySelector('h1.ytd-watch-metadata yt-formatted-string')?.textContent ||
        document.querySelector('meta[property="og:title"]')?.content ||
        document.title.replace(' - YouTube', '') ||
        'Untitled';

      const author = ytData?.videoDetails?.author ||
        ytData?.contents?.twoColumnWatchNextResults?.results?.results?.contents?.[1]?.videoSecondaryInfoRenderer?.owner?.videoOwnerRenderer?.title?.runs?.[0]?.text ||
        document.querySelector('#owner #channel-name a')?.textContent ||
        document.querySelector('ytd-channel-name a')?.textContent ||
        document.querySelector('meta[name="author"]')?.content ||
        'Unknown Channel';

      console.log('YouTubeIntegration: Extracted title:', title);
      console.log('YouTubeIntegration: Extracted author:', author);

      const panels = ytData?.engagementPanels || [];
      const hasTranscriptPanel = panels.some(p =>
        p.engagementPanelSectionListRenderer?.content?.continuationItemRenderer?.continuationEndpoint?.getTranscriptEndpoint
      );

      console.log('YouTubeIntegration: Has transcript panel:', hasTranscriptPanel);
      console.log('YouTubeIntegration: Engagement panels found:', panels.length);

      if (!hasTranscriptPanel) {
        console.log('YouTubeIntegration: No transcript panel, trying fallback to ytInitialPlayerResponse');
        const fallbackData = this.extractJsonFromHtml(html, 'ytInitialPlayerResponse');
        const fallbackTitle = fallbackData?.videoDetails?.title || title;
        const fallbackAuthor = fallbackData?.videoDetails?.author || author;

        return {
          title: fallbackTitle,
          author: fallbackAuthor,
          ytData: fallbackData,
          dataKey: 'ytInitialPlayerResponse',
          resolvedType: 'shorts'
        };
      }

      return {
        title,
        author,
        ytData,
        dataKey,
        resolvedType: 'regular'
      };
    }

    async getTranscriptItems(ytData, dataKey) {
      if (dataKey === 'ytInitialPlayerResponse') {
        console.log('YouTubeIntegration: Using ytInitialPlayerResponse approach');
        const baseUrl = ytData?.captions?.playerCaptionsTracklistRenderer?.captionTracks?.[0]?.baseUrl;
        if (!baseUrl) {
          throw new Error('Transcript not available for this video.');
        }

        const captionUrl = baseUrl + '&fmt=json3';
        console.log('YouTubeIntegration: Fetching captions from:', captionUrl);

        try {
          const json = await simpleRetryHandler.fetchWithRetry(captionUrl).then(res => {
            if (!res.ok) {
              throw new Error(`Fetch failed with status: ${res.status}`);
            }
            return res.json();
          });
          return json.events || [];
        } catch (e) {
          console.error('YouTubeIntegration: Error fetching captions:', e);
          throw new Error('Transcript not available for this video.');
        }
      }

      console.log('YouTubeIntegration: Using ytInitialData approach with internal API');

      const continuationParams = ytData.engagementPanels?.find(p =>
        p.engagementPanelSectionListRenderer?.content?.continuationItemRenderer?.continuationEndpoint?.getTranscriptEndpoint
      )?.engagementPanelSectionListRenderer?.content?.continuationItemRenderer?.continuationEndpoint?.getTranscriptEndpoint?.params;

      if (!continuationParams) {
        throw new Error('Transcript not available for this video');
      }

      const hl = ytData.topbar?.desktopTopbarRenderer?.searchbox?.fusionSearchboxRenderer?.config?.webSearchboxConfig?.requestLanguage || 'en';
      const clientData = ytData.responseContext?.serviceTrackingParams?.[0]?.params;
      const visitorData = ytData.responseContext?.webResponseContextExtensionData?.ytConfigData?.visitorData;

      const body = {
        context: {
          client: {
            hl,
            visitorData,
            clientName: clientData?.[0]?.value,
            clientVersion: clientData?.[1]?.value
          },
          request: {
            useSsl: true
          }
        },
        params: continuationParams
      };

      console.log('YouTubeIntegration: Calling YouTube internal transcript API');
      const res = await simpleRetryHandler.fetchWithRetry('https://www.youtube.com/youtubei/v1/get_transcript?prettyPrint=false', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        throw new Error(`YouTube API request failed with status: ${res.status}`);
      }

      const json = await res.json();
      const segments = json.actions?.[0]?.updateEngagementPanelAction?.content?.transcriptRenderer?.content?.transcriptSearchPanelRenderer?.body?.transcriptSegmentListRenderer?.initialSegments || [];

      console.log('YouTubeIntegration: Retrieved transcript segments:', segments.length);
      return segments;
    }

    createTranscriptArray(items, type) {
      return type === 'regular'
        ? items.map(item => this.getSegmentData(item))
        : items.filter(e => e.segs).map(e => this.getShortsSegmentData(e));
    }

    getSegmentData(item) {
      const seg = item?.transcriptSegmentRenderer;
      if (!seg) {
        return ['', ''];
      }

      const timestamp = seg.startTimeText?.simpleText || '';
      const text = seg.snippet?.runs?.map(r => r.text).join(' ') || '';
      return [timestamp, text];
    }

    getShortsSegmentData(event) {
      const timestamp = this.msToTimestamp(event.tStartMs);
      const text = (event.segs || []).map(seg => seg.utf8).join(' ').replace(/\n/g, ' ');
      return [timestamp, text];
    }

    msToTimestamp(ms) {
      const totalSec = Math.floor(ms / 1000);
      const min = Math.floor(totalSec / 60);
      const sec = totalSec % 60;
      return `${min}:${sec.toString().padStart(2, '0')}`;
    }

    extractJsonFromHtml(html, key) {
      const regexes = [
        new RegExp(`window\\["${key}"\\]\\s*=\\s*({[\\s\\S]+?})\\s*;`),
        new RegExp(`var ${key}\\s*=\\s*({[\\s\\S]+?})\\s*;`),
        new RegExp(`${key}\\s*=\\s*({[\\s\\S]+?})\\s*;`)
      ];

      for (const regex of regexes) {
        const match = html.match(regex);
        if (match && match[1]) {
          try {
            return JSON.parse(match[1]);
          } catch (err) {
            console.warn(`⚠️ Failed to parse ${key}:`, err.message);
          }
        }
      }

      throw new Error(`${key} not found`);
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
