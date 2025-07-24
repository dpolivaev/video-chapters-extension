/**
 * YouTube Integration Content Script
 * Handles subtitle extraction and communication with popup
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
  var browser = chrome;
}

// Content script for YouTube integration
console.log('🚀 YouTubeIntegration content script loaded - NEW PROVEN APPROACH');

// Prevent multiple injections
if (window.hasYouTubeIntegration) {
  console.log('YouTubeIntegration: Script already loaded, skipping...');
} else {
  window.hasYouTubeIntegration = true;

class YouTubeIntegration {
  constructor() {
    this.subtitleExtractor = null;
    this.isProcessing = false;
  }

  /**
   * Initialize the integration
   */
  init() {
    console.log('YouTubeIntegration: Starting init...');
    // Just setup message listener for when popup requests data
    this.setupMessageListener();
  }

  /**
   * Setup message listener for popup requests
   */
  setupMessageListener() {
    // Listen for messages from popup/background
    browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
      console.log('YouTubeIntegration: Received message:', request);
      
      if (request.action === 'getSubtitleData') {
        this.getSubtitleData().then(sendResponse);
        return true; // Will respond asynchronously
      }
      
      if (request.action === 'copyTranscript') {
        this.extractTranscriptForCopy().then(sendResponse);
        return true; // Will respond asynchronously
      }
      
      if (request.action === 'generateChapters') {
        this.handleGenerateChapters(request).then(sendResponse);
        return true; // Will respond asynchronously
      }
    });
  }

  /**
   * Extract current video ID
   */
  extractVideoId() {
    console.log('YouTubeIntegration: extractVideoId called');
    console.log('YouTubeIntegration: Current URL:', window.location.href);
    const urlParams = new URLSearchParams(window.location.search);
    const videoId = urlParams.get('v');
    console.log('YouTubeIntegration: Extracted video ID:', videoId);
    return videoId;
  }

  /**
   * Get subtitle data from current YouTube page
   */
  async getSubtitleData(sendResponse) {
    console.log('YouTubeIntegration: getSubtitleData called');
    
    if (this.isProcessing) {
      console.log('YouTubeIntegration: Already processing, returning');
      sendResponse({ success: false, error: 'Already processing subtitle data.' });
      return;
    }

    const videoId = this.extractVideoId();
    console.log('YouTubeIntegration: Extracted video ID:', videoId);
    
    if (!videoId) {
      console.log('YouTubeIntegration: No video ID found');
      sendResponse({ success: false, error: 'No video ID found. Please make sure you are on a YouTube video page.' });
      return;
    }

    try {
      console.log('YouTubeIntegration: Starting processing...');
      this.isProcessing = true;

      console.log('YouTubeIntegration: Initializing subtitle extractor...');
      this.subtitleExtractor = new YouTubeSubtitleExtractor();
      console.log('YouTubeIntegration: Subtitle extractor created:', this.subtitleExtractor);
      
      console.log('YouTubeIntegration: Calling initialize on subtitle extractor...');
      const initSuccess = this.subtitleExtractor.initialize();
      console.log('YouTubeIntegration: Subtitle extractor initialized:', initSuccess);
      
      if (!initSuccess) {
        throw new Error('Failed to initialize subtitle extractor - YouTube player data not found');
      }
      
      console.log('YouTubeIntegration: Getting available tracks...');
      const availableTracks = this.subtitleExtractor.getGroupedTracks();
      console.log('YouTubeIntegration: Available tracks:', availableTracks);
      
      console.log('YouTubeIntegration: Getting video metadata...');
      const videoMetadata = this.subtitleExtractor.getVideoMetadata();
      console.log('YouTubeIntegration: Video metadata:', videoMetadata);
      
      // Return subtitle data directly
      const subtitleData = {
        videoId: videoId,
        availableTracks: availableTracks,
        metadata: videoMetadata,
        extractor: this.subtitleExtractor // Keep reference for subtitle downloading
      };

      console.log('YouTubeIntegration: Returning subtitle data to popup');
      sendResponse({ success: true, data: subtitleData });

    } catch (error) {
      console.error('YouTubeIntegration: Error in getSubtitleData:', error);
      console.error('YouTubeIntegration: Error stack:', error.stack);
      sendResponse({ success: false, error: error.message });
    } finally {
      console.log('YouTubeIntegration: Cleaning up...');
      this.isProcessing = false;
      console.log('YouTubeIntegration: getSubtitleData completed');
    }
  }

  /**
     * Extract transcript using the proven working approach from successful extensions
     */
    async extractTranscriptForCopy() {
      try {
        console.log('YouTubeIntegration: extractTranscriptForCopy called - using PROVEN working method');
        
        const videoUrl = window.location.href;
        const isShorts = /youtube\.com\/shorts\//.test(videoUrl);
        const videoId = isShorts
          ? videoUrl.split("/shorts/")[1].split(/[/?#&]/)[0]
          : new URLSearchParams(window.location.search).get("v");

        if (!videoId) {
          return { 
            status: 'error', 
            message: 'No YouTube video detected' 
          };
        }

        console.log('YouTubeIntegration: Video ID detected:', videoId);
        console.log('YouTubeIntegration: Is Shorts:', isShorts);

        // Use the proven working approach from successful extensions
        const transcriptObj = await this.getTranscriptDict(videoUrl);
        
        if (!transcriptObj.transcript || transcriptObj.transcript.length === 0) {
          return { 
            status: 'error', 
            message: 'No transcript available for this video' 
          };
        }

        // Convert to the exact format that working extensions use
        const lines = transcriptObj.transcript.map(
          ([timestamp, text]) => `(${timestamp}) ${text}`
        ).join("\n");

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

  /**
     * Main transcript extraction logic - exact copy from working extension
     */
    async getTranscriptDict(videoUrl) {
      const isShorts = /youtube\.com\/shorts\//.test(videoUrl);
      const dataType = "regular";
      const { title, author, ytData, dataKey, resolvedType } = await this.resolveYouTubeData(videoUrl, dataType);
      const segments = await this.getTranscriptItems(ytData, dataKey);
      if (!segments.length) return { title, author, transcript: [] };
      const transcript = this.createTranscriptArray(segments, resolvedType);
      return { title, author, transcript };
    }

    /**
     * Resolve YouTube's internal data - exact copy from working extension
     */
    async resolveYouTubeData(videoUrl, initialType) {
      const dataKey = "ytInitialData";
      console.log('YouTubeIntegration: Fetching page HTML for:', videoUrl);
      const html = await fetch(videoUrl).then(res => res.text());
      let ytData = this.extractJsonFromHtml(html, dataKey);

      // Extract title from multiple possible locations
      let title = ytData?.videoDetails?.title || 
                ytData?.contents?.twoColumnWatchNextResults?.results?.results?.contents?.[0]?.videoPrimaryInfoRenderer?.title?.runs?.[0]?.text ||
                ytData?.playerOverlays?.playerOverlayRenderer?.videoDetails?.playerOverlayVideoDetailsRenderer?.title?.simpleText ||
                document.querySelector('h1.ytd-watch-metadata yt-formatted-string')?.textContent ||
                document.querySelector('meta[property="og:title"]')?.content ||
                document.title.replace(' - YouTube', '') ||
                'Untitled';

      // Extract author/channel from multiple possible locations
      let author = ytData?.videoDetails?.author ||
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
        const fallbackData = this.extractJsonFromHtml(html, "ytInitialPlayerResponse");
        
        // Try to extract title and author from fallback data too
        const fallbackTitle = fallbackData?.videoDetails?.title || title;
        const fallbackAuthor = fallbackData?.videoDetails?.author || author;
        
        return {
          title: fallbackTitle,
          author: fallbackAuthor,
          ytData: fallbackData,
          dataKey: "ytInitialPlayerResponse",
          resolvedType: "shorts"
        };
      }

      return {
        title,
        author,
        ytData,
        dataKey,
        resolvedType: "regular"
      };
    }

    /**
     * Get transcript items using YouTube's internal API - exact copy from working extension
     */
    async getTranscriptItems(ytData, dataKey) {
      if (dataKey === "ytInitialPlayerResponse") {
        console.log('YouTubeIntegration: Using ytInitialPlayerResponse approach');
        const baseUrl = ytData?.captions?.playerCaptionsTracklistRenderer?.captionTracks?.[0]?.baseUrl;
        if (!baseUrl) throw new Error("Transcript not available for this video.");
        const captionUrl = baseUrl + "&fmt=json3";
        console.log('YouTubeIntegration: Fetching captions from:', captionUrl);
        try {
          const json = await fetch(captionUrl).then(res => {
            if (!res.ok) throw new Error(`Fetch failed with status: ${res.status}`);
            return res.json();
          });
        return json.events || [];
        } catch (e) {
          console.error("YouTubeIntegration: Error fetching captions:", e);
          throw new Error("Transcript not available for this video.");
        }
      }

      console.log('YouTubeIntegration: Using ytInitialData approach with internal API');
      const continuationParams = ytData.engagementPanels?.find(p =>
        p.engagementPanelSectionListRenderer?.content?.continuationItemRenderer?.continuationEndpoint?.getTranscriptEndpoint
      )?.engagementPanelSectionListRenderer?.content?.continuationItemRenderer?.continuationEndpoint?.getTranscriptEndpoint?.params;

      if (!continuationParams) throw new Error("Transcript not available for this video");

      const hl = ytData.topbar?.desktopTopbarRenderer?.searchbox?.fusionSearchboxRenderer?.config?.webSearchboxConfig?.requestLanguage || "en";
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
          request: { useSsl: true }
        },
        params: continuationParams
      };

      console.log('YouTubeIntegration: Calling YouTube internal transcript API');
      const res = await fetch("https://www.youtube.com/youtubei/v1/get_transcript?prettyPrint=false", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        throw new Error(`YouTube API request failed with status: ${res.status}`);
      }

      const json = await res.json();
      const segments = json.actions?.[0]?.updateEngagementPanelAction?.content?.transcriptRenderer
        ?.content?.transcriptSearchPanelRenderer?.body?.transcriptSegmentListRenderer?.initialSegments || [];
      
      console.log('YouTubeIntegration: Retrieved transcript segments:', segments.length);
      return segments;
    }

    /**
     * Create transcript array from segments - exact copy from working extension
     */
    createTranscriptArray(items, type) {
      return type === "regular"
        ? items.map(item => this.getSegmentData(item))
        : items.filter(e => e.segs).map(e => this.getShortsSegmentData(e));
    }

    /**
     * Extract data from regular video segments - exact copy from working extension
     */
    getSegmentData(item) {
      const seg = item?.transcriptSegmentRenderer;
      if (!seg) return ["", ""];
      const timestamp = seg.startTimeText?.simpleText || "";
      const text = seg.snippet?.runs?.map(r => r.text).join(" ") || "";
      return [timestamp, text];
    }

    /**
     * Extract data from shorts video segments - exact copy from working extension
     */
    getShortsSegmentData(event) {
      const timestamp = this.msToTimestamp(event.tStartMs);
      const text = (event.segs || []).map(seg => seg.utf8).join(" ").replace(/\n/g, " ");
      return [timestamp, text];
    }

    /**
     * Convert milliseconds to timestamp - exact copy from working extension
     */
    msToTimestamp(ms) {
      const totalSec = Math.floor(ms / 1000);
      const min = Math.floor(totalSec / 60);
      const sec = totalSec % 60;
      return `${min}:${sec.toString().padStart(2, "0")}`;
    }

    /**
     * Extract JSON from HTML - exact copy from working extension
     */
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

// Message listener for communication with popup/background
browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractSubtitles') {
    handleSubtitleExtraction(request, sendResponse);
    return true; // Keep message channel open for async response
  }
});

/**
 * Handle subtitle extraction request
 */
async function handleSubtitleExtraction(request, sendResponse) {
  try {
    const extractor = new YouTubeSubtitleExtractor();
    const result = await extractor.extractSubtitles();
    sendResponse({ success: true, data: result });
  } catch (error) {
    console.error('Subtitle extraction error:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Initialize when the page loads
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

} // End of script injection guard 