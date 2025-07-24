/**
 * YouTube Subtitle Extractor for Video Chapters Generator
 * Extracts subtitle data from YouTube using internal APIs and DOM
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
class YouTubeSubtitleExtractor {
  constructor() {
    console.log("YouTubeSubtitleExtractor: Constructor called");
    this.playerData = null;
    this.videoId = null;
    console.log("YouTubeSubtitleExtractor: Constructor completed");
  }
  initialize() {
    console.log("YouTubeSubtitleExtractor: initialize called");
    this.videoId = this.extractVideoId();
    console.log("YouTubeSubtitleExtractor: videoId extracted:", this.videoId);
    this.playerData = this.getPlayerData();
    console.log("YouTubeSubtitleExtractor: playerData obtained:", !!this.playerData);
    if (!this.playerData) {
      console.warn("YouTubeSubtitleExtractor: YouTube player data not found");
      return false;
    }
    console.log("YouTubeSubtitleExtractor: initialize completed successfully");
    return true;
  }
  extractVideoId() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get("v");
  }
  getPlayerData() {
    const sources = [ () => window.ytInitialPlayerResponse, () => window.ytInitialData?.contents?.twoColumnWatchNextResults?.results?.results?.contents?.[0]?.videoPrimaryInfoRenderer?.videoActions?.menuRenderer?.topLevelButtons?.[0]?.toggleButtonRenderer?.defaultServiceEndpoint?.shareEntityServiceEndpoint?.serializedShareEntity && window.ytInitialPlayerResponse, () => {
      const scripts = document.querySelectorAll("script");
      for (const script of scripts) {
        const content = script.textContent;
        if (content && content.includes("ytInitialPlayerResponse")) {
          const match = content.match(/var ytInitialPlayerResponse = ({.*?});/);
          if (match) {
            try {
              return JSON.parse(match[1]);
            } catch (e) {
              console.warn("Failed to parse ytInitialPlayerResponse from script", e);
            }
          }
        }
      }
      return null;
    } ];
    for (const source of sources) {
      try {
        const data = source();
        if (data) return data;
      } catch (e) {
        console.warn("Failed to get player data from source", e);
      }
    }
    return null;
  }
  getAvailableTracks() {
    if (!this.playerData || !this.playerData.captions) {
      console.log("YouTubeSubtitleExtractor: No captions data in playerData");
      if (this.playerData) {
        console.log("YouTubeSubtitleExtractor: PlayerData keys:", Object.keys(this.playerData));
        console.log("YouTubeSubtitleExtractor: PlayerData structure:", {
          hasVideoDetails: !!this.playerData.videoDetails,
          hasPlayabilityStatus: !!this.playerData.playabilityStatus,
          hasCaptions: !!this.playerData.captions,
          hasStreamingData: !!this.playerData.streamingData
        });
      }
      return [];
    }
    const captionTracks = this.playerData.captions.playerCaptionsTracklistRenderer?.captionTracks || [];
    console.log("YouTubeSubtitleExtractor: Raw caption tracks from playerData:", captionTracks);
    if (window.ytInitialPlayerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks) {
      const globalTracks = window.ytInitialPlayerResponse.captions.playerCaptionsTracklistRenderer.captionTracks;
      console.log("YouTubeSubtitleExtractor: Global ytInitialPlayerResponse caption tracks:", globalTracks);
      if (captionTracks.length === 0 && globalTracks.length > 0) {
        console.log("YouTubeSubtitleExtractor: Using global tracks as fallback");
        return this.parseCaptionTracks(globalTracks);
      }
    }
    return this.parseCaptionTracks(captionTracks);
  }
  parseCaptionTracks(captionTracks) {
    const tracks = [];
    for (const track of captionTracks) {
      console.log("YouTubeSubtitleExtractor: Processing track:", {
        languageCode: track.languageCode,
        name: track.name?.simpleText,
        vssId: track.vssId,
        baseUrl: track.baseUrl ? "present" : "missing",
        kind: track.kind,
        isTranslatable: track.isTranslatable
      });
      const trackData = {
        language: track.languageCode,
        name: track.name?.simpleText || track.name?.runs?.[0]?.text || `${track.languageCode} captions`,
        vssId: track.vssId,
        baseUrl: track.baseUrl,
        isAutoGenerated: track.kind === "asr",
        isTranslatable: track.isTranslatable || false,
        kind: track.kind
      };
      tracks.push(trackData);
    }
    console.log("YouTubeSubtitleExtractor: Parsed tracks:", tracks);
    return tracks;
  }
  getGroupedTracks() {
    console.log("YouTubeSubtitleExtractor: getGroupedTracks called");
    const tracks = this.getAvailableTracks();
    console.log("YouTubeSubtitleExtractor: Available tracks:", tracks);
    const grouped = {
      original: [],
      standard: [],
      auto_translated: []
    };
    const processedLanguages = new Set;
    for (const track of tracks) {
      if (track.vssId && track.vssId.endsWith(".orig")) {
        const baseLang = track.language;
        grouped.original.push(baseLang);
        processedLanguages.add(baseLang);
      } else if (track.isAutoGenerated && !track.vssId?.includes(".")) {
        grouped.standard.push(track.language);
        processedLanguages.add(track.language);
      }
    }
    for (const track of tracks) {
      if (track.vssId && track.vssId.includes(".") && !track.vssId.endsWith(".orig")) {
        const baseLang = track.language;
        if (!processedLanguages.has(baseLang)) {
          grouped.auto_translated.push(baseLang);
          processedLanguages.add(baseLang);
        }
      }
    }
    grouped.original = [ ...new Set(grouped.original) ].sort();
    grouped.standard = [ ...new Set(grouped.standard) ].sort();
    grouped.auto_translated = [ ...new Set(grouped.auto_translated) ].sort();
    return grouped;
  }
  selectTrack(languagePreference = null) {
    const tracks = this.getAvailableTracks();
    if (!tracks.length) return null;
    if (languagePreference) {
      const exactMatch = tracks.find(track => track.language === languagePreference);
      if (exactMatch) return exactMatch;
      const originalMatch = tracks.find(track => track.language === languagePreference && track.vssId?.endsWith(".orig"));
      if (originalMatch) return originalMatch;
      const autoTranslated = tracks.find(track => track.language === languagePreference);
      if (autoTranslated) return autoTranslated;
    }
    const originalTrack = tracks.find(track => track.vssId?.endsWith(".orig"));
    if (originalTrack) return originalTrack;
    const majorLanguages = [ "en", "es", "fr", "de", "it", "pt", "ru", "uk", "ja", "ko", "zh", "ar" ];
    for (const lang of majorLanguages) {
      const track = tracks.find(t => t.language === lang);
      if (track) return track;
    }
    return tracks[0];
  }
  async fetchCaptions(track) {
    if (!track || !track.baseUrl) {
      throw new Error("Invalid track or missing baseUrl");
    }
    console.log("YouTubeSubtitleExtractor: Using modern 2025 extraction method...");
    console.log("YouTubeSubtitleExtractor: Track info:", {
      language: track.language,
      name: track.name,
      isAutoGenerated: track.isAutoGenerated
    });
    try {
      const transcriptData = await this.extractFromTranscript(track);
      if (transcriptData) {
        console.log("YouTubeSubtitleExtractor: Success with transcript extraction");
        return transcriptData;
      }
      const embeddedData = this.extractFromPageData(track);
      if (embeddedData) {
        console.log("YouTubeSubtitleExtractor: Success with embedded page data");
        return embeddedData;
      }
      const fetchedData = await this.tryModernFetch(track);
      if (fetchedData) {
        console.log("YouTubeSubtitleExtractor: Success with modern fetch");
        return fetchedData;
      }
      const domData = this.extractFromSubtitleDOM(track);
      if (domData) {
        console.log("YouTubeSubtitleExtractor: Success with DOM extraction");
        return domData;
      }
      throw new Error("All modern extraction methods failed - this video may not have accessible subtitles");
    } catch (error) {
      console.log("YouTubeSubtitleExtractor: Error in modern extraction:", error);
      throw error;
    }
  }
  convertJSON3ToSRT(events) {
    console.log("YouTubeSubtitleExtractor: Converting JSON3 events to SRT...");
    let srtContent = "";
    let index = 1;
    for (const event of events) {
      if (!event.segs || !Array.isArray(event.segs) || event.segs.length === 0) {
        continue;
      }
      const startTime = (event.tStartMs || 0) / 1e3;
      const duration = (event.dDurationMs || 3e3) / 1e3;
      const endTime = startTime + duration;
      const text = event.segs.map(seg => seg.utf8 || "").join("").trim().replace(/\n/g, " ").replace(/\s+/g, " ");
      if (text && text.length > 0) {
        srtContent += `${index}\n`;
        srtContent += `${this.formatTime(startTime)} --\x3e ${this.formatTime(endTime)}\n`;
        srtContent += `${text}\n\n`;
        index++;
      }
    }
    const finalSRT = srtContent.trim();
    console.log("YouTubeSubtitleExtractor: SRT conversion complete:", {
      totalEntries: index - 1,
      contentLength: finalSRT.length,
      firstEntry: finalSRT.split("\n\n")[0]
    });
    return finalSRT;
  }
  generateSubtitlePlaceholder(track) {
    console.log("YouTubeSubtitleExtractor: Generating subtitle placeholder...");
    const videoId = this.videoId || this.extractVideoId();
    const placeholder = `SUBTITLE EXTRACTION NOTICE\n\nVideo: ${videoId || "Unknown"}\nLanguage: ${track.language || "Unknown"} (${track.name || "Unknown"})\nType: ${track.isAutoGenerated ? "Auto-generated" : "Manual"}\n\nUnfortunately, this video's subtitles could not be extracted automatically due to YouTube's API restrictions for browser extensions.\n\nTo generate chapters for this video, you have a few options:\n\n1. MANUAL METHOD: \n   - Turn on captions in the YouTube player\n   - Copy the subtitle text manually\n   - Paste it into the custom instructions field\n\n2. ALTERNATIVE VIDEOS:\n   - Try videos with manually created subtitles (not auto-generated)\n   - Look for videos with embedded subtitle data\n\n3. EXTERNAL TOOLS:\n   - Use yt-dlp or similar tools to download subtitles\n   - Import the subtitle file content\n\nThe extension works best with videos that have:\n- Manual subtitles/captions\n- Embedded subtitle data\n- Multiple language options\n\nAuto-generated subtitles (like this video) are often protected by CORS policies that prevent browser extensions from accessing them directly.`;
    return placeholder;
  }
  extractEmbeddedSubtitles(track) {
    console.log("YouTubeSubtitleExtractor: Looking for embedded subtitle data...");
    try {
      if (this.playerData && this.playerData.captions) {
        const captionTracks = this.playerData.captions.playerCaptionsTracklistRenderer?.captionTracks;
        if (captionTracks) {
          const matchingTrack = captionTracks.find(t => t.languageCode === track.language || t.vssId === track.vssId);
          if (matchingTrack && matchingTrack.subtitles) {
            console.log("YouTubeSubtitleExtractor: Found embedded subtitle content");
            return this.convertEmbeddedToSRT(matchingTrack.subtitles);
          }
        }
      }
      if (window.ytInitialPlayerResponse?.captions?.playerCaptionsTracklistRenderer) {
        const renderer = window.ytInitialPlayerResponse.captions.playerCaptionsTracklistRenderer;
        if (renderer.captionTracks) {
          for (const captionTrack of renderer.captionTracks) {
            if ((captionTrack.languageCode === track.language || captionTrack.vssId === track.vssId) && captionTrack.subtitles) {
              console.log("YouTubeSubtitleExtractor: Found subtitle content in ytInitialPlayerResponse");
              return this.convertEmbeddedToSRT(captionTrack.subtitles);
            }
          }
        }
      }
      return null;
    } catch (error) {
      console.error("YouTubeSubtitleExtractor: Error extracting embedded subtitles:", error);
      return null;
    }
  }
  async extractFromPlayerTrack(track) {
    console.log("YouTubeSubtitleExtractor: Attempting to extract from player track...");
    try {
      const player = document.querySelector("#movie_player");
      if (player && player.getSubtitlesUserSettings) {
        try {
          const subtitleSettings = player.getSubtitlesUserSettings();
          console.log("YouTubeSubtitleExtractor: Player subtitle settings:", subtitleSettings);
          return this.extractFromDOM();
        } catch (playerError) {
          console.log("YouTubeSubtitleExtractor: Player method access failed:", playerError);
        }
      }
      return null;
    } catch (error) {
      console.error("YouTubeSubtitleExtractor: Error extracting from player track:", error);
      return null;
    }
  }
  extractFromDOM() {
    console.log("YouTubeSubtitleExtractor: Attempting to extract from DOM...");
    try {
      const subtitleContainers = [ ".ytp-caption-segment", ".captions-text", ".ytp-caption-window-container .ytp-caption-window-container", '[class*="caption"]', '[class*="subtitle"]' ];
      for (const selector of subtitleContainers) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          console.log(`YouTubeSubtitleExtractor: Found ${elements.length} subtitle elements with selector: ${selector}`);
          return "Subtitle extraction from DOM requires the video to be playing with captions enabled. Please use a video with embedded subtitle data or consider using the auto-generated captions if available.";
        }
      }
      return null;
    } catch (error) {
      console.error("YouTubeSubtitleExtractor: Error extracting from DOM:", error);
      return null;
    }
  }
  convertEmbeddedToSRT(subtitles) {
    console.log("YouTubeSubtitleExtractor: Converting embedded subtitles to SRT...");
    try {
      if (!Array.isArray(subtitles)) {
        console.warn("YouTubeSubtitleExtractor: Subtitles is not an array:", typeof subtitles);
        return null;
      }
      let srtContent = "";
      let index = 1;
      for (const subtitle of subtitles) {
        if (subtitle.text && (subtitle.startTime !== undefined || subtitle.start !== undefined)) {
          const startTime = subtitle.startTime || subtitle.start || 0;
          const duration = subtitle.duration || subtitle.dur || 3;
          const endTime = startTime + duration;
          const text = subtitle.text.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/<[^>]*>/g, "").trim();
          if (text) {
            srtContent += `${index}\n`;
            srtContent += `${this.formatTime(startTime)} --\x3e ${this.formatTime(endTime)}\n`;
            srtContent += `${text}\n\n`;
            index++;
          }
        }
      }
      console.log("YouTubeSubtitleExtractor: Successfully converted embedded subtitles, entries:", index - 1);
      return srtContent.trim();
    } catch (error) {
      console.error("YouTubeSubtitleExtractor: Error converting embedded subtitles:", error);
      return null;
    }
  }
  parseSubtitleXML(xmlText) {
    console.log("YouTubeSubtitleExtractor: parseSubtitleXML called with text length:", xmlText.length);
    if (!xmlText || xmlText.trim().length === 0) {
      throw new Error("Empty XML content received");
    }
    const parser = new DOMParser;
    const xmlDoc = parser.parseFromString(xmlText, "text/xml");
    const parserError = xmlDoc.querySelector("parsererror");
    if (parserError) {
      console.error("YouTubeSubtitleExtractor: XML parsing error:", parserError.textContent);
      console.error("YouTubeSubtitleExtractor: Problematic XML:", xmlText.substring(0, 1e3));
      throw new Error("Failed to parse subtitle XML: " + parserError.textContent);
    }
    const textElements = xmlDoc.querySelectorAll("text");
    console.log("YouTubeSubtitleExtractor: Found text elements:", textElements.length);
    if (textElements.length === 0) {
      console.warn("YouTubeSubtitleExtractor: No text elements found in XML");
      console.log("YouTubeSubtitleExtractor: XML document structure:", xmlDoc.documentElement?.tagName);
      const alternativeSelectors = [ "p", "caption", "timedtext", "transcript" ];
      for (const selector of alternativeSelectors) {
        const elements = xmlDoc.querySelectorAll(selector);
        if (elements.length > 0) {
          console.log(`YouTubeSubtitleExtractor: Found ${elements.length} elements with selector '${selector}'`);
        }
      }
    }
    let srtContent = "";
    let index = 1;
    for (const textElement of textElements) {
      const start = parseFloat(textElement.getAttribute("start") || "0");
      const duration = parseFloat(textElement.getAttribute("dur") || "0");
      const end = start + duration;
      const text = textElement.textContent.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
      if (text) {
        srtContent += `${index}\n`;
        srtContent += `${this.formatTime(start)} --\x3e ${this.formatTime(end)}\n`;
        srtContent += `${text}\n\n`;
        index++;
      }
    }
    return srtContent.trim();
  }
  parseJSON3Subtitles(jsonText) {
    console.log("YouTubeSubtitleExtractor: parseJSON3Subtitles called");
    try {
      const data = JSON.parse(jsonText);
      if (!data.events || !Array.isArray(data.events)) {
        throw new Error("Invalid JSON3 format - no events array");
      }
      let srtContent = "";
      let index = 1;
      for (const event of data.events) {
        if (!event.segs || !Array.isArray(event.segs)) continue;
        const startTime = event.tStartMs / 1e3;
        const duration = event.dDurationMs / 1e3;
        const endTime = startTime + duration;
        const text = event.segs.map(seg => seg.utf8 || "").join("").trim();
        if (text) {
          srtContent += `${index}\n`;
          srtContent += `${this.formatTime(startTime)} --\x3e ${this.formatTime(endTime)}\n`;
          srtContent += `${text}\n\n`;
          index++;
        }
      }
      console.log("YouTubeSubtitleExtractor: JSON3 parsing successful, entries:", index - 1);
      return srtContent.trim();
    } catch (error) {
      console.error("YouTubeSubtitleExtractor: JSON3 parsing error:", error);
      throw new Error("Failed to parse JSON3 subtitles: " + error.message);
    }
  }
  parseVTTSubtitles(vttText) {
    console.log("YouTubeSubtitleExtractor: parseVTTSubtitles called");
    try {
      const lines = vttText.split("\n");
      let srtContent = "";
      let index = 1;
      let i = 0;
      while (i < lines.length && !lines[i].includes("--\x3e")) {
        i++;
      }
      while (i < lines.length) {
        const line = lines[i].trim();
        if (line.includes("--\x3e")) {
          const timeMatch = line.match(/(\d{2}:\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}\.\d{3})/);
          if (timeMatch) {
            const startTime = timeMatch[1].replace(".", ",");
            const endTime = timeMatch[2].replace(".", ",");
            i++;
            let text = "";
            while (i < lines.length && lines[i].trim() !== "") {
              const textLine = lines[i].trim();
              if (textLine && !textLine.includes("--\x3e")) {
                text += (text ? " " : "") + textLine;
              }
              i++;
            }
            if (text) {
              srtContent += `${index}\n`;
              srtContent += `${startTime} --\x3e ${endTime}\n`;
              srtContent += `${text}\n\n`;
              index++;
            }
          }
        }
        i++;
      }
      console.log("YouTubeSubtitleExtractor: VTT parsing successful, entries:", index - 1);
      return srtContent.trim();
    } catch (error) {
      console.error("YouTubeSubtitleExtractor: VTT parsing error:", error);
      throw new Error("Failed to parse VTT subtitles: " + error.message);
    }
  }
  formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor(seconds % 3600 / 60);
    const secs = Math.floor(seconds % 60);
    const milliseconds = Math.floor(seconds % 1 * 1e3);
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")},${milliseconds.toString().padStart(3, "0")}`;
  }
  getVideoMetadata() {
    console.log("YouTubeSubtitleExtractor: getVideoMetadata called");
    console.log("YouTubeSubtitleExtractor: playerData available:", !!this.playerData);
    if (!this.playerData) {
      console.log("YouTubeSubtitleExtractor: No playerData, returning null");
      return null;
    }
    const videoDetails = this.playerData.videoDetails;
    console.log("YouTubeSubtitleExtractor: videoDetails available:", !!videoDetails);
    if (!videoDetails) {
      console.log("YouTubeSubtitleExtractor: No videoDetails, returning null");
      return null;
    }
    const metadata = {
      title: videoDetails.title,
      author: videoDetails.author,
      lengthSeconds: parseInt(videoDetails.lengthSeconds),
      videoId: videoDetails.videoId,
      shortDescription: videoDetails.shortDescription
    };
    console.log("YouTubeSubtitleExtractor: getVideoMetadata returning:", metadata);
    return metadata;
  }
  async extractSubtitles(languagePreference = null) {
    if (!this.initialize()) {
      throw new Error("Failed to initialize YouTube player data");
    }
    const selectedTrack = this.selectTrack(languagePreference);
    if (!selectedTrack) {
      throw new Error("No subtitle tracks available for this video");
    }
    const captionContent = await this.fetchCaptions(selectedTrack);
    const metadata = this.getVideoMetadata();
    return {
      language: selectedTrack.language,
      trackName: selectedTrack.name,
      isAutoGenerated: selectedTrack.isAutoGenerated,
      content: captionContent,
      metadata: metadata,
      availableTracks: this.getGroupedTracks()
    };
  }
  extractFromPageData(track) {
    try {
      console.log("YouTubeSubtitleExtractor: === Method 1: Checking embedded page data ===");
      const sources = [ () => {
        console.log("YouTubeSubtitleExtractor: Checking window.ytInitialPlayerResponse");
        if (window.ytInitialPlayerResponse) {
          console.log("YouTubeSubtitleExtractor: Found window.ytInitialPlayerResponse");
          return window.ytInitialPlayerResponse;
        }
        return null;
      }, () => {
        console.log("YouTubeSubtitleExtractor: Checking script tags for ytInitialPlayerResponse");
        const scripts = document.querySelectorAll("script");
        for (const script of scripts) {
          if (script.textContent && script.textContent.includes("ytInitialPlayerResponse")) {
            try {
              console.log("YouTubeSubtitleExtractor: Found script with ytInitialPlayerResponse");
              const match = script.textContent.match(/var ytInitialPlayerResponse = ({.+?});/);
              if (match) {
                console.log("YouTubeSubtitleExtractor: Extracted ytInitialPlayerResponse from script");
                return JSON.parse(match[1]);
              }
            } catch (e) {
              console.log("YouTubeSubtitleExtractor: Error parsing script content:", e);
            }
          }
        }
        return null;
      }, () => {
        console.log("YouTubeSubtitleExtractor: Using existing playerData");
        if (this.playerData && this.playerData.captions) {
          console.log("YouTubeSubtitleExtractor: Found captions in existing playerData");
          return this.playerData;
        }
        return null;
      }, () => {
        console.log("YouTubeSubtitleExtractor: Checking window.ytplayer");
        if (window.ytplayer && window.ytplayer.config && window.ytplayer.config.args) {
          console.log("YouTubeSubtitleExtractor: Found ytplayer config");
          return window.ytplayer.config.args;
        }
        return null;
      } ];
      for (let i = 0; i < sources.length; i++) {
        try {
          const data = sources[i]();
          if (data && data.captions) {
            console.log(`YouTubeSubtitleExtractor: Found captions in source ${i + 1}`);
            console.log("YouTubeSubtitleExtractor: Captions structure:", Object.keys(data.captions));
            if (data.captions.playerCaptionsTracklistRenderer) {
              console.log("YouTubeSubtitleExtractor: Found playerCaptionsTracklistRenderer");
              const renderer = data.captions.playerCaptionsTracklistRenderer;
              console.log("YouTubeSubtitleExtractor: Renderer keys:", Object.keys(renderer));
              if (renderer.captionTracks) {
                console.log("YouTubeSubtitleExtractor: Found captionTracks, count:", renderer.captionTracks.length);
                renderer.captionTracks.forEach((track, i) => {
                  console.log(`YouTubeSubtitleExtractor: Track ${i}:`, {
                    languageCode: track.languageCode,
                    name: track.name?.simpleText,
                    isTranslatable: track.isTranslatable,
                    hasBaseUrl: !!track.baseUrl
                  });
                });
                const matchingTrack = renderer.captionTracks.find(t => t.languageCode === track.language);
                if (matchingTrack) {
                  console.log("YouTubeSubtitleExtractor: Found matching track");
                  if (matchingTrack.captionEvents && Array.isArray(matchingTrack.captionEvents)) {
                    console.log("YouTubeSubtitleExtractor: Found captionEvents in track");
                    return this.convertEventsToSRT(matchingTrack.captionEvents);
                  }
                  if (matchingTrack.subtitles && Array.isArray(matchingTrack.subtitles)) {
                    console.log("YouTubeSubtitleExtractor: Found subtitles in track");
                    return this.convertSubtitleArrayToSRT(matchingTrack.subtitles);
                  }
                }
              }
            }
          } else if (data) {
            console.log(`YouTubeSubtitleExtractor: Source ${i + 1} data found but no captions:`, Object.keys(data));
          }
        } catch (e) {
          console.log(`YouTubeSubtitleExtractor: Error in source ${i + 1}:`, e);
        }
      }
      console.log("YouTubeSubtitleExtractor: Checking for existing subtitle DOM elements");
      const result = this.extractFromExistingSubtitles();
      if (result) {
        return result;
      }
      console.log("YouTubeSubtitleExtractor: No embedded subtitle data found");
      return null;
    } catch (error) {
      console.log("YouTubeSubtitleExtractor: Error in extractFromPageData:", error);
      return null;
    }
  }
  extractFromExistingSubtitles() {
    try {
      const subtitleElements = document.querySelectorAll(".caption-visual-line");
      if (subtitleElements.length > 0) {
        console.log("YouTubeSubtitleExtractor: Found existing subtitle elements, attempting extraction...");
        const subtitleTexts = Array.from(subtitleElements).map(el => el.textContent?.trim()).filter(Boolean);
        if (subtitleTexts.length > 0) {
          console.log("YouTubeSubtitleExtractor: Extracted subtitle texts:", subtitleTexts.length);
          let srtContent = "";
          subtitleTexts.forEach((text, index) => {
            const startTime = this.secondsToSRT(index * 3);
            const endTime = this.secondsToSRT((index + 1) * 3);
            srtContent += `${index + 1}\n`;
            srtContent += `${startTime} --\x3e ${endTime}\n`;
            srtContent += `${text}\n\n`;
          });
          return srtContent.trim();
        }
      }
      return null;
    } catch (error) {
      console.log("YouTubeSubtitleExtractor: Error extracting existing subtitles:", error);
      return null;
    }
  }
  async openTranscriptPanel() {
    try {
      console.log("YouTubeSubtitleExtractor: Attempting to auto-open transcript panel...");
      const transcriptButtons = [ "#menu-button", 'button[aria-label*="More actions"]', 'button[aria-label*="Show more"]', "ytd-menu-renderer #button", 'button[aria-label*="Show transcript" i]', 'button[aria-label*="transcript" i]', 'button[title*="transcript" i]', 'button[aria-label*="Показать расшифровку" i]', 'button[aria-label*="расшифровка" i]', "ytd-menu-service-item-renderer", "tp-yt-paper-item" ];
      let transcriptOpened = false;
      console.log("YouTubeSubtitleExtractor: Looking for more menu button...");
      const moreButton = document.querySelector('#menu-button, button[aria-label*="More actions"], button[aria-label*="Show more"]');
      if (moreButton) {
        console.log("YouTubeSubtitleExtractor: Found more menu button, clicking...");
        moreButton.click();
        await new Promise(resolve => setTimeout(resolve, 1e3));
        console.log("YouTubeSubtitleExtractor: Looking for transcript option in menu...");
        for (let attempt = 0; attempt < 5; attempt++) {
          const menuItems = document.querySelectorAll("ytd-menu-service-item-renderer, tp-yt-paper-item, ytd-menu-navigation-item-renderer");
          console.log(`YouTubeSubtitleExtractor: Found ${menuItems.length} menu items on attempt ${attempt + 1}`);
          for (const item of menuItems) {
            const text = item.textContent?.toLowerCase() || "";
            const ariaLabel = item.getAttribute("aria-label")?.toLowerCase() || "";
            if (text.includes("transcript") || text.includes("расшифровка") || ariaLabel.includes("transcript") || ariaLabel.includes("расшифровка")) {
              console.log("YouTubeSubtitleExtractor: Found transcript menu item:", text || ariaLabel);
              item.click();
              transcriptOpened = true;
              break;
            }
          }
          if (transcriptOpened) break;
          await new Promise(resolve => setTimeout(resolve, 300));
        }
        if (!transcriptOpened) {
          console.log("YouTubeSubtitleExtractor: Trying to click potential transcript menu items...");
          const potentialItems = document.querySelectorAll("ytd-menu-service-item-renderer, tp-yt-paper-item");
          for (const item of potentialItems) {
            const itemText = item.textContent?.trim() || "";
            if (itemText.length > 0 && itemText.length < 50) {
              console.log("YouTubeSubtitleExtractor: Trying menu item:", itemText);
              item.click();
              await new Promise(resolve => setTimeout(resolve, 500));
              const transcriptElements = document.querySelectorAll("ytd-transcript-segment-renderer, .ytd-transcript-segment-renderer");
              if (transcriptElements.length > 0) {
                console.log("YouTubeSubtitleExtractor: Transcript panel appeared!");
                transcriptOpened = true;
                break;
              }
            }
          }
        }
      }
      if (transcriptOpened) {
        console.log("YouTubeSubtitleExtractor: Transcript panel opened, waiting for content to load...");
        for (let i = 0; i < 10; i++) {
          await new Promise(resolve => setTimeout(resolve, 500));
          const transcriptElements = document.querySelectorAll("ytd-transcript-segment-renderer, .ytd-transcript-segment-renderer");
          if (transcriptElements.length > 0) {
            console.log(`YouTubeSubtitleExtractor: Found ${transcriptElements.length} transcript segments loaded`);
            return true;
          }
        }
        console.log("YouTubeSubtitleExtractor: Transcript panel opened but no content loaded yet");
        return true;
      } else {
        console.log("YouTubeSubtitleExtractor: Could not find or open transcript panel");
        return false;
      }
    } catch (error) {
      console.log("YouTubeSubtitleExtractor: Error opening transcript panel:", error);
      return false;
    }
  }
  async extractFromTranscript(track) {
    try {
      console.log("YouTubeSubtitleExtractor: === Method 1: Checking YouTube transcript ===");
      let transcriptData = this.getTranscriptData();
      if (transcriptData.length === 0) {
        console.log("YouTubeSubtitleExtractor: No existing transcript found, attempting to auto-open...");
        const opened = await this.openTranscriptPanel();
        if (opened) {
          transcriptData = this.getTranscriptData();
        }
      }
      console.log(`YouTubeSubtitleExtractor: Extracted ${transcriptData.length} transcript segments`);
      if (transcriptData.length > 0) {
        return this.convertTranscriptToSRT(transcriptData);
      }
      return null;
    } catch (error) {
      console.log("YouTubeSubtitleExtractor: Error extracting transcript:", error);
      return null;
    }
  }
  getTranscriptData() {
    const transcriptSelectors = [ "ytd-transcript-segment-renderer", ".ytd-transcript-segment-renderer", "#segments-container ytd-transcript-segment-renderer", ".segment-start-offset", ".ytd-transcript-body-renderer .segment", '[data-testid="transcript-segment"]', ".transcript-segment", ".captions-segment" ];
    let transcriptData = [];
    console.log("YouTubeSubtitleExtractor: Looking for transcript segments...");
    for (const selector of transcriptSelectors) {
      const elements = document.querySelectorAll(selector);
      console.log(`YouTubeSubtitleExtractor: Found ${elements.length} elements for transcript selector: ${selector}`);
      if (elements.length > 0) {
        elements.forEach((element, index) => {
          const timestampElement = element.querySelector('.segment-start-offset, .ytd-transcript-segment-renderer .segment-timestamp, [class*="timestamp"]');
          const textElement = element.querySelector('.segment-text, .ytd-transcript-segment-renderer [class*="text"], .segment-content');
          let timestamp = null;
          let text = null;
          if (timestampElement && textElement) {
            timestamp = timestampElement.textContent?.trim();
            text = textElement.textContent?.trim();
          } else {
            const elementText = element.textContent?.trim() || "";
            const timestampMatch = elementText.match(/^(\d{1,2}:\d{2})\s+(.+)/);
            if (timestampMatch) {
              timestamp = timestampMatch[1];
              text = timestampMatch[2];
            } else {
              const timeMatch = elementText.match(/\d{1,2}:\d{2}/);
              if (timeMatch && elementText.length > timeMatch[0].length + 3) {
                timestamp = timeMatch[0];
                text = elementText.replace(timeMatch[0], "").trim();
              }
            }
          }
          if (timestamp && text && timestamp.match(/^\d{1,2}:\d{2}$/) && text.length > 5 && !text.includes("YouTube") && !text.includes("Поиск") && !text.includes("Смотреть") && !text.includes("Поделиться") && !text.includes("Копировать") && !text.includes("воспроизведение") && !text.toLowerCase().includes("loading") && !text.toLowerCase().includes("error")) {
            transcriptData.push({
              timestamp: timestamp,
              text: text
            });
            console.log(`YouTubeSubtitleExtractor: Found segment ${index}: ${timestamp} - ${text.substring(0, 50)}...`);
          }
        });
        if (transcriptData.length > 0) {
          break;
        }
      }
    }
    if (transcriptData.length === 0) {
      console.log("YouTubeSubtitleExtractor: Looking for transcript in page data...");
      if (window.ytInitialData) {
        const findTranscriptInData = (obj, path = "") => {
          if (typeof obj !== "object" || !obj) return null;
          for (const key in obj) {
            if (key.toLowerCase().includes("transcript") && typeof obj[key] === "object") {
              console.log(`YouTubeSubtitleExtractor: Found transcript key: ${path}.${key}`);
              return obj[key];
            }
            if (typeof obj[key] === "object" && path.length < 50) {
              const result = findTranscriptInData(obj[key], `${path}.${key}`);
              if (result) return result;
            }
          }
          return null;
        };
        const transcriptObj = findTranscriptInData(window.ytInitialData);
        if (transcriptObj) {
          console.log("YouTubeSubtitleExtractor: Found transcript in ytInitialData");
        }
      }
    }
    console.log(`YouTubeSubtitleExtractor: Final transcript data count: ${transcriptData.length}`);
    return transcriptData;
  }
  convertTranscriptToSRT(transcriptData) {
    let srtContent = "";
    transcriptData.forEach((segment, index) => {
      const [minutes, seconds] = segment.timestamp.split(":").map(Number);
      const startTime = `00:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")},000`;
      let endTime;
      if (index + 1 < transcriptData.length) {
        const [nextMin, nextSec] = transcriptData[index + 1].timestamp.split(":").map(Number);
        endTime = `00:${nextMin.toString().padStart(2, "0")}:${nextSec.toString().padStart(2, "0")},000`;
      } else {
        const endSec = seconds + 10;
        const endMin = minutes + Math.floor(endSec / 60);
        endTime = `00:${endMin.toString().padStart(2, "0")}:${(endSec % 60).toString().padStart(2, "0")},000`;
      }
      srtContent += `${index + 1}\n`;
      srtContent += `${startTime} --\x3e ${endTime}\n`;
      srtContent += `${segment.text}\n\n`;
    });
    console.log("YouTubeSubtitleExtractor: Generated SRT from transcript data with real timestamps");
    return srtContent.trim();
  }
  async tryModernFetch(track) {
    try {
      console.log("YouTubeSubtitleExtractor: === Method 3: Trying modern fetch ===");
      const formats = [ "json3", "srv3", "ttml", "vtt" ];
      for (const format of formats) {
        try {
          const url = new URL(track.baseUrl);
          url.searchParams.set("fmt", format);
          console.log(`YouTubeSubtitleExtractor: Trying format ${format}...`);
          const response = await fetch(url.toString(), {
            credentials: "include",
            headers: {
              Accept: "*/*",
              "Sec-Fetch-Dest": "empty",
              "Sec-Fetch-Mode": "cors",
              "Sec-Fetch-Site": "same-origin"
            }
          });
          if (response.ok) {
            const content = await response.text();
            if (content && content.length > 0) {
              console.log(`YouTubeSubtitleExtractor: Success with format ${format}, length: ${content.length}`);
              if (format === "json3") {
                return this.parseJSON3Subtitles(content);
              } else {
                return this.parseSubtitleXML(content);
              }
            }
          }
        } catch (error) {
          console.log(`YouTubeSubtitleExtractor: Format ${format} failed:`, error.message);
        }
      }
      return null;
    } catch (error) {
      console.log("YouTubeSubtitleExtractor: tryModernFetch failed:", error);
      return null;
    }
  }
  async extractFromSubtitleRenderer(track) {
    try {
      console.log("YouTubeSubtitleExtractor: === Method 3: Subtitle renderer extraction ===");
      const subtitleElements = document.querySelectorAll(".caption-visual-line");
      console.log("YouTubeSubtitleExtractor: Found subtitle elements:", subtitleElements.length);
      if (subtitleElements.length > 0) {
        console.log("YouTubeSubtitleExtractor: Subtitle elements found but extraction not implemented yet");
        return null;
      }
      const player = document.querySelector("#movie_player");
      console.log("YouTubeSubtitleExtractor: Found player element:", !!player);
      if (player) {
        console.log("YouTubeSubtitleExtractor: Player element available, checking methods...");
        console.log("YouTubeSubtitleExtractor: Player methods available:", {
          getSubtitlesUserSettings: typeof player.getSubtitlesUserSettings,
          getVideoData: typeof player.getVideoData,
          getPlayerState: typeof player.getPlayerState
        });
        if (player.getSubtitlesUserSettings) {
          try {
            const subtitleData = player.getSubtitlesUserSettings();
            console.log("YouTubeSubtitleExtractor: Got subtitle data from player:", subtitleData);
            return null;
          } catch (e) {
            console.log("YouTubeSubtitleExtractor: Player subtitle access failed:", e);
          }
        }
      }
      console.log("YouTubeSubtitleExtractor: No subtitle renderer data available");
      return null;
    } catch (error) {
      console.log("YouTubeSubtitleExtractor: Error in extractFromSubtitleRenderer:", error);
      return null;
    }
  }
  extractTextFromCaptionData(captionData, track) {
    try {
      if (!captionData.playerCaptionsTracklistRenderer) {
        return null;
      }
      const tracks = captionData.playerCaptionsTracklistRenderer.captionTracks;
      if (!tracks || !Array.isArray(tracks)) {
        return null;
      }
      const matchingTrack = tracks.find(t => t.languageCode === track.language || t.baseUrl === track.baseUrl);
      if (!matchingTrack) {
        return null;
      }
      if (matchingTrack.subtitles && Array.isArray(matchingTrack.subtitles)) {
        console.log("YouTubeSubtitleExtractor: Found direct subtitle data");
        return this.convertSubtitleArrayToSRT(matchingTrack.subtitles);
      }
      return null;
    } catch (error) {
      console.log("YouTubeSubtitleExtractor: Error in extractTextFromCaptionData:", error);
      return null;
    }
  }
  convertSubtitleArrayToSRT(subtitles) {
    try {
      let srtContent = "";
      subtitles.forEach((subtitle, index) => {
        const startTime = this.millisecondsToSRT(subtitle.startTime || 0);
        const endTime = this.millisecondsToSRT((subtitle.startTime || 0) + (subtitle.duration || 2e3));
        const text = subtitle.text || "";
        srtContent += `${index + 1}\n`;
        srtContent += `${startTime} --\x3e ${endTime}\n`;
        srtContent += `${text.trim()}\n\n`;
      });
      return srtContent.trim();
    } catch (error) {
      console.log("YouTubeSubtitleExtractor: Error converting subtitle array:", error);
      return null;
    }
  }
  millisecondsToSRT(ms) {
    const totalSeconds = Math.floor(ms / 1e3);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor(totalSeconds % 3600 / 60);
    const seconds = totalSeconds % 60;
    const milliseconds = ms % 1e3;
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")},${milliseconds.toString().padStart(3, "0")}`;
  }
  extractFromSubtitleDOM(track) {
    try {
      console.log("YouTubeSubtitleExtractor: === Method 4: DOM subtitle extraction ===");
      const selectors = [ ".caption-window", ".ytp-caption-window-container", ".captions-text", ".ytp-caption-segment", '[class*="caption"]', '[class*="subtitle"]' ];
      let allTexts = [];
      let foundElements = 0;
      for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        console.log(`YouTubeSubtitleExtractor: Found ${elements.length} elements for selector: ${selector}`);
        elements.forEach(element => {
          const text = element.textContent?.trim();
          if (text && text.length > 3 && !allTexts.includes(text)) {
            allTexts.push(text);
            foundElements++;
          }
        });
      }
      console.log(`YouTubeSubtitleExtractor: Extracted subtitle texts: ${allTexts.length}`);
      if (allTexts.length > 0) {
        const videoLength = this.playerData?.videoDetails?.lengthSeconds || 1200;
        const videoTitle = this.playerData?.videoDetails?.title || "Video";
        let subtitleContent = `SUBTITLE CONTENT EXTRACTED FROM: ${videoTitle}\n`;
        subtitleContent += `VIDEO LENGTH: ${Math.floor(videoLength / 60)} minutes ${videoLength % 60} seconds\n\n`;
        subtitleContent += `AVAILABLE SUBTITLE SEGMENTS:\n`;
        subtitleContent += allTexts.join(" ");
        subtitleContent += `\n\nNOTE: These are subtitle segments currently visible in the player. `;
        subtitleContent += `Please analyze the content and create meaningful chapters with appropriate timecodes `;
        subtitleContent += `distributed across the ${Math.floor(videoLength / 60)}-minute video duration.`;
        console.log("YouTubeSubtitleExtractor: Generated subtitle content compilation for AI analysis");
        return subtitleContent;
      }
      return null;
    } catch (error) {
      console.log("YouTubeSubtitleExtractor: Error extracting from subtitle DOM:", error);
      return null;
    }
  }
}

window.YouTubeSubtitleExtractor = YouTubeSubtitleExtractor;