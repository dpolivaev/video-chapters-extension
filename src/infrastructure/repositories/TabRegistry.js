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
    this.videoUrlToTabMapping = new Map(); // cleanedVideoUrl -> {tabId, url, lastSeen}
    this.resultToVideoMapping = new Map(); // resultId -> cleanedVideoUrl
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
    this.videoUrlToTabMapping.clear();
    this.resultToVideoMapping.clear();
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
  
  registerVideoTabForResult(resultId, tabId, url) {
    const cleanedUrl = this.cleanVideoURL(url);
    const normalizedResultId = this.ensureNumericResultId(resultId);
    
    this.storeVideoTabMapping(cleanedUrl, tabId, url);
    this.storeResultToVideoMapping(normalizedResultId, cleanedUrl);
    
    this.registerVideoTab(tabId, url);
  }

  ensureNumericResultId(resultId) {
    return typeof resultId === 'string' ? parseInt(resultId, 10) : resultId;
  }

  storeVideoTabMapping(cleanedUrl, tabId, url) {
    this.videoUrlToTabMapping.set(cleanedUrl, {
      tabId: tabId,
      url: url,
      lastSeen: Date.now()
    });
  }

  storeResultToVideoMapping(normalizedResultId, cleanedUrl) {
    this.resultToVideoMapping.set(normalizedResultId, cleanedUrl);
  }
  
  cleanVideoURL(url) {
    if (!url || typeof url !== 'string') return url;
    
    try {
      const urlObj = new URL(url);
      urlObj.searchParams.delete('t');
      return urlObj.toString();
    } catch (e) {
      return url;
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
  
  async getVideoTabForResult(resultId) {
    const normalizedResultId = this.ensureNumericResultId(resultId);
    const cleanedUrl = this.findCleanedUrlForResult(normalizedResultId);
    
    if (!cleanedUrl) {
      return null;
    }
    
    const videoTabInfo = this.findVideoTabInfoForUrl(cleanedUrl);
    if (!videoTabInfo) {
      return null;
    }
    
    const validatedTabInfo = await this.validateExistingTab(videoTabInfo, cleanedUrl);
    if (validatedTabInfo) {
      return validatedTabInfo;
    }
    
    return await this.findTabByCleanedUrl(cleanedUrl);
  }

  findCleanedUrlForResult(normalizedResultId) {
    return this.resultToVideoMapping.get(normalizedResultId);
  }

  findVideoTabInfoForUrl(cleanedUrl) {
    return this.videoUrlToTabMapping.get(cleanedUrl);
  }

  async validateExistingTab(videoTabInfo, expectedCleanedUrl) {
    try {
      if (this.isBrowserTabsApiAvailable()) {
        const currentTab = await browser.tabs.get(videoTabInfo.tabId);
        const currentCleanedUrl = this.cleanVideoURL(currentTab.url);
        
        if (this.urlsMatch(currentCleanedUrl, expectedCleanedUrl)) {
          return this.createDirectTabResult(videoTabInfo);
        }
      }
    } catch (error) {
      // Tab no longer exists
    }
    return null;
  }

  isBrowserTabsApiAvailable() {
    return typeof browser !== 'undefined' && browser.tabs && browser.tabs.get;
  }

  urlsMatch(url1, url2) {
    return url1 === url2;
  }

  createDirectTabResult(videoTabInfo) {
    videoTabInfo.lastSeen = Date.now();
    return {
      tabId: videoTabInfo.tabId,
      url: videoTabInfo.url,
      method: "direct"
    };
  }
  
  async findTabByCleanedUrl(targetCleanedUrl) {
    try {
      if (this.isBrowserTabQueryApiAvailable()) {
        const allTabs = await browser.tabs.query({});
        const matchingTab = this.searchForMatchingTab(allTabs, targetCleanedUrl);
        
        if (matchingTab) {
          this.updateMappingWithDiscoveredTab(targetCleanedUrl, matchingTab);
          return this.createDiscoveredTabResult(matchingTab);
        }
      }
    } catch (error) {
      // Tab search failed
    }
    
    return this.createNewTabFallbackResult(targetCleanedUrl);
  }

  isBrowserTabQueryApiAvailable() {
    return typeof browser !== 'undefined' && browser.tabs && browser.tabs.query;
  }

  searchForMatchingTab(allTabs, targetCleanedUrl) {
    for (const tab of allTabs) {
      if (!tab.url) continue;
      
      const tabCleanedUrl = this.cleanVideoURL(tab.url);
      if (tabCleanedUrl === targetCleanedUrl) {
        return tab;
      }
    }
    return null;
  }

  updateMappingWithDiscoveredTab(targetCleanedUrl, tab) {
    this.videoUrlToTabMapping.set(targetCleanedUrl, {
      tabId: tab.id,
      url: tab.url,
      lastSeen: Date.now()
    });
  }

  createDiscoveredTabResult(tab) {
    return {
      tabId: tab.id,
      url: tab.url,
      method: "discovered"
    };
  }

  createNewTabFallbackResult(targetCleanedUrl) {
    return {
      tabId: null,
      url: targetCleanedUrl,
      method: "create_new"
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