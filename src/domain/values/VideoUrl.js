/**
 * VideoUrl Value Object
 * Represents a validated and cleaned YouTube video URL
 *
 * Copyright (C) 2025 Dimitry Polivaev
 * Licensed under GPL3 or later
 */

class VideoUrl {
  constructor(url) {
    this.value = this.validate(url);
    Object.freeze(this);
  }

  validate(url) {
    if (!url || typeof url !== 'string') {
      throw new Error('URL must be a non-empty string');
    }

    if (!url.includes('youtube.com/watch') && !url.includes('youtube.com/shorts') && !url.includes('youtube.com/live')) {
      throw new Error('Invalid YouTube URL - must be a watch, shorts, or live URL');
    }

    return this.clean(url);
  }

  clean(url) {
    return this.removeUnnecessaryParameters(url);
  }

  removeUnnecessaryParameters(url) {
    const urlObj = new URL(url);
    const videoId = urlObj.searchParams.get('v');

    if (url.includes('youtube.com/watch') && videoId) {
      return `https://www.youtube.com/watch?v=${videoId}`;
    }

    if (url.includes('youtube.com/shorts/')) {
      const shortsId = this.extractShortsId(url);
      return `https://www.youtube.com/shorts/${shortsId}`;
    }

    if (url.includes('youtube.com/live/')) {
      const liveId = this.extractLiveId(url);
      return `https://www.youtube.com/live/${liveId}`;
    }

    return this.fallbackCleanUrl(url);
  }

  extractShortsId(url) {
    return url.split('/shorts/')[1].split('?')[0];
  }

  extractLiveId(url) {
    return url.split('/live/')[1].split('?')[0];
  }

  fallbackCleanUrl(url) {
    return url.split('&')[0];
  }

  toString() {
    return this.value;
  }


  isWatchUrl() {
    return this.value.includes('/watch?v=');
  }

  isShortsUrl() {
    return this.value.includes('/shorts/');
  }

  isLiveUrl() {
    return this.value.includes('/live/');
  }

  getVideoId() {
    if (this.isWatchUrl()) {
      const url = new URL(this.value);
      return url.searchParams.get('v');
    }

    if (this.isShortsUrl()) {
      return this.value.split('/shorts/')[1];
    }

    if (this.isLiveUrl()) {
      return this.value.split('/live/')[1];
    }

    return null;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = VideoUrl;
}

