/**
 * Browser Storage Adapter - Single Source of Truth for Browser Storage
 * Eliminates all direct browser.storage calls throughout the codebase
 *
 * Copyright (C) 2025 Dimitry Polivaev
 * Licensed under GPL3 or later
 */

class BrowserStorageAdapter {
  constructor(browserAPI = browser) {
    this.browser = browserAPI;
    this.STORAGE_KEYS = {
      USER_SETTINGS: 'userSettings',
      INSTRUCTION_HISTORY: 'instructionHistory',
      LAST_CUSTOM_INSTRUCTIONS: 'lastCustomInstructions',
      CURRENT_INSTRUCTION_NAME: 'currentInstructionName',
      HISTORY_LIMIT: 'historyLimit'
    };
  }

  async getSyncStorage(key) {
    try {
      const result = await this.browser.storage.sync.get(key);
      return result[key];
    } catch (error) {
      throw new Error(`Failed to get sync storage key '${key}': ${error.message}`);
    }
  }

  async setSyncStorage(key, value) {
    try {
      await this.browser.storage.sync.set({ [key]: value });
    } catch (error) {
      throw new Error(`Failed to set sync storage key '${key}': ${error.message}`);
    }
  }

  async removeSyncStorage(key) {
    try {
      await this.browser.storage.sync.remove(key);
    } catch (error) {
      throw new Error(`Failed to remove sync storage key '${key}': ${error.message}`);
    }
  }

  async getLocalStorage(key) {
    try {
      const result = await this.browser.storage.local.get(key);
      return result[key];
    } catch (error) {
      throw new Error(`Failed to get local storage key '${key}': ${error.message}`);
    }
  }

  async setLocalStorage(key, value) {
    try {
      await this.browser.storage.local.set({ [key]: value });
    } catch (error) {
      throw new Error(`Failed to set local storage key '${key}': ${error.message}`);
    }
  }

  async removeLocalStorage(key) {
    try {
      await this.browser.storage.local.remove(key);
    } catch (error) {
      throw new Error(`Failed to remove local storage key '${key}': ${error.message}`);
    }
  }

  getUserSettings() {
    return this.getSyncStorage(this.STORAGE_KEYS.USER_SETTINGS);
  }

  setUserSettings(settings) {
    return this.setSyncStorage(this.STORAGE_KEYS.USER_SETTINGS, settings);
  }

  removeUserSettings() {
    return this.removeSyncStorage(this.STORAGE_KEYS.USER_SETTINGS);
  }

  getInstructionHistory() {
    return this.getLocalStorage(this.STORAGE_KEYS.INSTRUCTION_HISTORY);
  }

  setInstructionHistory(history) {
    return this.setLocalStorage(this.STORAGE_KEYS.INSTRUCTION_HISTORY, history);
  }

  getLastCustomInstructions() {
    return this.getLocalStorage(this.STORAGE_KEYS.LAST_CUSTOM_INSTRUCTIONS);
  }

  setLastCustomInstructions(instructions) {
    return this.setLocalStorage(this.STORAGE_KEYS.LAST_CUSTOM_INSTRUCTIONS, instructions);
  }

  removeLastCustomInstructions() {
    return this.removeLocalStorage(this.STORAGE_KEYS.LAST_CUSTOM_INSTRUCTIONS);
  }

  getCurrentInstructionName() {
    return this.getLocalStorage(this.STORAGE_KEYS.CURRENT_INSTRUCTION_NAME);
  }

  setCurrentInstructionName(name) {
    return this.setLocalStorage(this.STORAGE_KEYS.CURRENT_INSTRUCTION_NAME, name);
  }

  removeCurrentInstructionName() {
    return this.removeLocalStorage(this.STORAGE_KEYS.CURRENT_INSTRUCTION_NAME);
  }

  getHistoryLimit() {
    return this.getLocalStorage(this.STORAGE_KEYS.HISTORY_LIMIT);
  }

  setHistoryLimit(limit) {
    return this.setLocalStorage(this.STORAGE_KEYS.HISTORY_LIMIT, limit);
  }

  removeHistoryLimit() {
    return this.removeLocalStorage(this.STORAGE_KEYS.HISTORY_LIMIT);
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = BrowserStorageAdapter;
}
