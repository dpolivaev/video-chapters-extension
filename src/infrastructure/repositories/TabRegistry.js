/**
 * TabRegistry
 * Manages browser tab tracking and relationships
 *
 * Copyright (C) 2025 Dimitry Polivaev
 * Licensed under GPL3 or later
 */

class TabRegistry {
  constructor() {
    this.tabs = new Map();
    this.currentVideoTab = null;
    this.sessionTabMapping = new Map(); // sessionId -> tabId
  }
  
  register(browserTab) {
    if (!(browserTab instanceof BrowserTab)) {
      throw new Error('Can only register BrowserTab instances');
    }
    
    this.tabs.set(browserTab.id, browserTab);
    
    if (browserTab.isYouTubeVideo()) {
      this.currentVideoTab = browserTab;
    }
    
    return browserTab;
  }
  
  unregister(tabId) {
    const tab = this.tabs.get(tabId);
    if (tab) {
      this.tabs.delete(tabId);
      
      if (this.currentVideoTab?.id === tabId) {
        this.currentVideoTab = null;
      }
      
      for (const [sessionId, mappedTabId] of this.sessionTabMapping.entries()) {
        if (mappedTabId === tabId) {
          this.sessionTabMapping.delete(sessionId);
        }
      }
      
      this.cleanupResultsTab(tabId);
      
      return true;
    }
    return false;
  }
  
  findById(tabId) {
    return this.tabs.get(tabId) || null;
  }
  
  getCurrentVideoTab() {
    if (this.currentVideoTab && !this.tabs.has(this.currentVideoTab.id)) {
      this.currentVideoTab = null;
    }
    
    return this.currentVideoTab;
  }
  
  associateWithSession(sessionId, tabId) {
    if (!this.tabs.has(tabId)) {
      throw new Error(`Tab ${tabId} is not registered`);
    }
    
    this.sessionTabMapping.set(sessionId, tabId);
  }
  
  findTabForSession(sessionId) {
    const tabId = this.sessionTabMapping.get(sessionId);
    return tabId ? this.findById(tabId) : null;
  }
  
  findSessionForTab(tabId) {
    for (const [sessionId, mappedTabId] of this.sessionTabMapping.entries()) {
      if (mappedTabId === tabId) {
        return sessionId;
      }
    }
    return null;
  }
  
  getAllVideoTabs() {
    return Array.from(this.tabs.values()).filter(tab => tab.isYouTubeVideo());
  }
  
  getAllResultsTabs() {
    return Array.from(this.tabs.values()).filter(tab => tab.isResultsPage());
  }
  
  clear() {
    this.tabs.clear();
    this.currentVideoTab = null;
    this.sessionTabMapping.clear();
  }
  
  getCount() {
    return this.tabs.size;
  }
  
  getVideoTabInfo() {
    const videoTab = this.getCurrentVideoTab();
    return {
      videoTabId: videoTab?.id || null,
      videoUrl: videoTab?.url?.toString() || null
    };
  }
  
  registerFromBrowserTab(tab) {
    const browserTab = BrowserTab.fromBrowserTab(tab);
    return this.register(browserTab);
  }
  
  validateTab(tabId, expectedUrl) {
    const tab = this.findById(tabId);
    if (!tab) return false;
    
    if (expectedUrl) {
      return tab.url?.toString() === expectedUrl;
    }
    
    return true;
  }
  
  registerVideoTab(tabId, url) {
    try {
      const browserTab = BrowserTab.createVideoTab(tabId, url);
      this.register(browserTab);
    } catch (error) {
      console.warn('Failed to register video tab:', error);
    }
  }
  
  registerResultsTab(resultId, tabId) {
    this.resultsTabs = this.resultsTabs || new Map();
    this.resultsTabs.set(resultId, tabId);
  }
  
  getResultsTab(resultId) {
    this.resultsTabs = this.resultsTabs || new Map();
    return this.resultsTabs.get(resultId);
  }
  
  getActiveVideoTab() {
    const videoTab = this.getCurrentVideoTab();
    if (!videoTab) return null;
    
    return {
      tabId: videoTab.id,
      url: videoTab.url?.toString()
    };
  }
  
  getActiveResultsTab() {
    this.resultsTabs = this.resultsTabs || new Map();
    const resultTabIds = Array.from(this.resultsTabs.values());
    return resultTabIds.length > 0 ? resultTabIds[0] : null;
  }
  
  getAllResultsTabIds() {
    this.resultsTabs = this.resultsTabs || new Map();
    return Array.from(this.resultsTabs.values());
  }
  
  cleanupResultsTab(tabId) {
    this.resultsTabs = this.resultsTabs || new Map();
    for (const [resultId, storedTabId] of this.resultsTabs.entries()) {
      if (storedTabId === tabId) {
        this.resultsTabs.delete(resultId);
      }
    }
  }
  
  getResultIdForTab(tabId) {
    this.resultsTabs = this.resultsTabs || new Map();
    for (const [resultId, storedTabId] of this.resultsTabs.entries()) {
      if (storedTabId === tabId) {
        return resultId;
      }
    }
    return null;
  }
}