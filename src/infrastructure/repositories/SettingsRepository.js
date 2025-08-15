/**
 * SettingsRepository
 * Manages persistent user settings storage
 *
 * Copyright (C) 2025 Dimitry Polivaev
 * Licensed under GPL3 or later
 */

class SettingsRepository {
  constructor(storageAdapter) {
    if (!storageAdapter) {
      throw new Error('storageAdapter is required');
    }
    this.storageAdapter = storageAdapter;
    this.defaultSettings = {
      apiKey: '',
      openRouterApiKey: '',
      model: 'deepseek/deepseek-r1-0528:free',
      historyLimit: 10,
      autoSaveInstructions: true,
      theme: 'auto',
      uiLanguage: ''
    };
  }

  async save(credentials, selectedModel, additionalSettings = {}) {
    if (!(credentials instanceof ApiCredentials)) {
      throw new Error('credentials must be an ApiCredentials instance');
    }

    if (!(selectedModel instanceof ModelId)) {
      throw new Error('selectedModel must be a ModelId instance');
    }

    const allSettings = {
      ...this.defaultSettings,
      ...additionalSettings,
      apiKey: credentials.geminiKey,
      openRouterApiKey: credentials.openRouterKey,
      model: selectedModel.toString(),
      selectedModel: selectedModel.toJSON()
    };

    try {
      // Split settings between sync and local storage
      await this._saveSyncSettings(allSettings);
      await this._saveLocalSettings(allSettings);
      return allSettings;
    } catch (error) {
      throw new Error(`Failed to save settings: ${error.message}`);
    }
  }

  async load() {
    try {
      // Load from both sync and local storage and merge
      const syncSettings = await this._loadSyncSettings();
      const localSettings = await this._loadLocalSettings();

      // Clean up orphaned historyLimit from sync storage if it exists
      await this._cleanupOrphanedHistoryLimit(syncSettings);

      const settings = {
        ...this.defaultSettings,
        ...syncSettings,
        ...localSettings
      };

      if (!settings.apiKey && !settings.openRouterApiKey) {
        settings.model = 'deepseek/deepseek-r1-0528:free';
      }

      return {
        credentials: new ApiCredentials(settings.apiKey, settings.openRouterApiKey),
        selectedModel: settings.selectedModel ? ModelId.fromJSON(settings.selectedModel) : new ModelId('deepseek/deepseek-r1-0528:free', 'OpenRouter', true),
        additionalSettings: {
          historyLimit: settings.historyLimit,
          autoSaveInstructions: settings.autoSaveInstructions,
          theme: settings.theme,
          uiLanguage: settings.uiLanguage
        }
      };
    } catch (error) {
      return {
        credentials: new ApiCredentials(),
        selectedModel: new ModelId('deepseek/deepseek-r1-0528:free', 'OpenRouter', true),
        additionalSettings: {
          historyLimit: this.defaultSettings.historyLimit,
          autoSaveInstructions: this.defaultSettings.autoSaveInstructions,
          theme: this.defaultSettings.theme,
          uiLanguage: this.defaultSettings.uiLanguage
        }
      };
    }
  }

  async updateCredentials(credentials) {
    const currentSettings = await this.load();
    return this.save(
      credentials,
      currentSettings.selectedModel,
      currentSettings.additionalSettings
    );
  }

  async updateSelectedModel(selectedModel) {
    const currentSettings = await this.load();
    return this.save(
      currentSettings.credentials,
      selectedModel,
      currentSettings.additionalSettings
    );
  }

  async updateSetting(key, value) {
    const currentSettings = await this.load();
    const updatedAdditionalSettings = {
      ...currentSettings.additionalSettings,
      [key]: value
    };

    return this.save(
      currentSettings.credentials,
      currentSettings.selectedModel,
      updatedAdditionalSettings
    );
  }

  async saveSettings(legacySettings) {
    try {
      // Load existing settings first to preserve what's not being updated
      const currentSettings = await this.load();

      const credentials = new ApiCredentials(
        legacySettings.apiKey !== undefined ? legacySettings.apiKey : currentSettings.credentials.geminiKey,
        legacySettings.openRouterApiKey !== undefined ? legacySettings.openRouterApiKey : currentSettings.credentials.openRouterKey
      );

      const selectedModel = legacySettings.selectedModel
        ? ModelId.fromJSON(legacySettings.selectedModel)
        : currentSettings.selectedModel;

      const additionalSettings = {
        historyLimit: legacySettings.historyLimit !== undefined ? legacySettings.historyLimit : currentSettings.additionalSettings.historyLimit,
        autoSaveInstructions: legacySettings.autoSaveInstructions !== undefined
          ? legacySettings.autoSaveInstructions
          : currentSettings.additionalSettings.autoSaveInstructions,
        theme: legacySettings.theme !== undefined ? legacySettings.theme : currentSettings.additionalSettings.theme,
        uiLanguage: legacySettings.uiLanguage !== undefined ? legacySettings.uiLanguage : currentSettings.additionalSettings.uiLanguage
      };

      return this.save(credentials, selectedModel, additionalSettings);
    } catch (error) {
      throw new Error(`Failed to save legacy settings: ${error.message}`);
    }
  }

  async loadSettings() {
    const { credentials, selectedModel, additionalSettings } = await this.load();

    return {
      apiKey: credentials.geminiKey,
      openRouterApiKey: credentials.openRouterKey,
      model: selectedModel.toString(),
      ...additionalSettings
    };
  }

  async reset() {
    try {
      await this.storageAdapter.removeUserSettings();
      await this.storageAdapter.removeHistoryLimit();
      return this.defaultSettings;
    } catch (error) {
      throw new Error(`Failed to reset settings: ${error.message}`);
    }
  }

  // Private helper methods for dual storage management

  async _cleanupOrphanedHistoryLimit(syncSettings) {
    // Clean up orphaned historyLimit from sync storage during migration
    if (syncSettings && syncSettings.historyLimit !== undefined) {
      try {
        // Migrate the value to local storage if not already there
        const localLimit = await this.storageAdapter.getHistoryLimit();
        if (localLimit === undefined) {
          await this.storageAdapter.setHistoryLimit(syncSettings.historyLimit);
        }

        // Remove historyLimit from sync storage by re-saving without it
        const { historyLimit: _, ...cleanSyncSettings } = syncSettings;
        if (Object.keys(cleanSyncSettings).length > 0) {
          await this.storageAdapter.setUserSettings(cleanSyncSettings);
        }
      } catch (error) {
        // Don't fail the load operation if cleanup fails
        console.warn('Failed to cleanup orphaned historyLimit from sync storage:', error.message);
      }
    }
  }

  async _loadSyncSettings() {
    return await this.storageAdapter.getUserSettings() || {};
  }

  async _loadLocalSettings() {
    const historyLimit = await this.storageAdapter.getHistoryLimit();
    return {
      ...(historyLimit !== undefined && { historyLimit })
    };
  }

  async _saveSyncSettings(allSettings) {
    const { historyLimit: _, ...syncSettings } = allSettings;
    await this.storageAdapter.setUserSettings(syncSettings);
  }

  async _saveLocalSettings(allSettings) {
    if (allSettings.historyLimit !== undefined) {
      await this.storageAdapter.setHistoryLimit(allSettings.historyLimit);
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = SettingsRepository;
}

