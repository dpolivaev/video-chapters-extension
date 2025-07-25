/**
 * BrowserTab Entity
 * Represents a browser tab with extension-specific context
 *
 * Copyright (C) 2025 Dimitry Polivaev
 * Licensed under GPL3 or later
 */

class BrowserTab {
  constructor(id, url, type = 'unknown') {
    this.id = this.validateId(id);
    this.url = url ? new VideoUrl(url) : null;
    this.type = this.validateType(type);
    this.createdAt = new Date();
  }
  
  validateId(id) {
    if (!Number.isInteger(id) || id < 0) {
      throw new Error('Tab ID must be a non-negative integer');
    }
    return id;
  }
  
  validateType(type) {
    const validTypes = ['video', 'results', 'unknown'];
    if (!validTypes.includes(type)) {
      throw new Error(`Tab type must be one of: ${validTypes.join(', ')}`);
    }
    return type;
  }
  
  isYouTubeVideo() {
    return this.type === 'video';
  }
  
  isResultsPage() {
    return this.type === 'results';
  }
  
  hasUrl() {
    return this.url !== null;
  }
  
  getVideoId() {
    return this.url ? this.url.getVideoId() : null;
  }
  
  matches(tabInfo) {
    return this.id === tabInfo.id && 
           (!tabInfo.url || this.url?.toString() === tabInfo.url);
  }
  
  static createVideoTab(id, url) {
    return new BrowserTab(id, url, 'video');
  }
  
  static createResultsTab(id, url) {
    return new BrowserTab(id, url, 'results');
  }
  
  static fromBrowserTab(tab) {
    let type = 'unknown';
    
    if (tab.url) {
      if ((tab.url.includes('youtube.com/watch') || tab.url.includes('youtube.com/shorts'))) {
        type = 'video';
      } else if (tab.url.includes('results/results.html')) {
        type = 'results';
      }
    }
    
    return new BrowserTab(tab.id, tab.url, type);
  }
  
  equals(other) {
    return other instanceof BrowserTab &&
           this.id === other.id &&
           this.type === other.type &&
           (this.url ? this.url.equals(other.url) : !other.url);
  }
  
  toString() {
    return `BrowserTab(id=${this.id}, type=${this.type}, url=${this.url?.toString() || 'null'})`;
  }
}


