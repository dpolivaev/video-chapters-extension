/**
 * SettingsRepository
 * Manages persistent user settings storage
 *
 * Copyright (C) 2025 Dimitry Polivaev
 * Licensed under GPL3 or later
 */

class SettingsRepository {
  constructor(browserAPI = browser) {
    this.browser = browserAPI;
    this.storageKey = 'userSettings';
    this.defaultSettings = {
      apiKey: '',
      openRouterApiKey: '',
      model: 'deepseek/deepseek-r1-0528:free',
      historyLimit: 10,
      autoSaveInstructions: true,
      theme: 'auto'
    };
  }

  async save(credentials, selectedModel, additionalSettings = {}) {
    if (!(credentials instanceof ApiCredentials)) {
      throw new Error('credentials must be an ApiCredentials instance');
    }

    if (!(selectedModel instanceof ModelId)) {
      throw new Error('selectedModel must be a ModelId instance');
    }

    const settings = {
      ...this.defaultSettings,
      ...additionalSettings,
      apiKey: credentials.geminiKey,
      openRouterApiKey: credentials.openRouterKey,
      model: selectedModel.toString(),
      selectedModel: selectedModel.toJSON()
    };

    try {
      await this.browser.storage.sync.set({
        [this.storageKey]: settings
      });

      return settings;
    } catch (error) {
      throw new Error(`Failed to save settings: ${error.message}`);
    }
  }

  async load() {
    try {
      const result = await this.browser.storage.sync.get(this.storageKey);
      const storedSettings = result[this.storageKey] || {};

      const settings = {
        ...this.defaultSettings,
        ...storedSettings
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
          theme: settings.theme
        }
      };
    } catch (error) {
      return {
        credentials: new ApiCredentials(),
        selectedModel: new ModelId('deepseek/deepseek-r1-0528:free', 'OpenRouter', true),
        additionalSettings: {
          historyLimit: this.defaultSettings.historyLimit,
          autoSaveInstructions: this.defaultSettings.autoSaveInstructions,
          theme: this.defaultSettings.theme
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
      const credentials = new ApiCredentials(
        legacySettings.apiKey || '',
        legacySettings.openRouterApiKey || ''
      );

      const selectedModel = legacySettings.selectedModel
        ? ModelId.fromJSON(legacySettings.selectedModel)
        : new ModelId('deepseek/deepseek-r1-0528:free', 'OpenRouter', true);

      const additionalSettings = {
        historyLimit: legacySettings.historyLimit || this.defaultSettings.historyLimit,
        autoSaveInstructions: legacySettings.autoSaveInstructions !== undefined
          ? legacySettings.autoSaveInstructions
          : this.defaultSettings.autoSaveInstructions,
        theme: legacySettings.theme || this.defaultSettings.theme
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
      await this.browser.storage.sync.remove(this.storageKey);
      return this.defaultSettings;
    } catch (error) {
      throw new Error(`Failed to reset settings: ${error.message}`);
    }
  }
}

