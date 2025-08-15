/**
 * SettingsRepository Tests
 * Tests settings persistence, credential management, and model configuration
 *
 * Copyright (C) 2025 Dimitry Polivaev
 * Licensed under GPL3 or later
 */

const SettingsRepository = require('./SettingsRepository');
const ApiCredentials = require('../../domain/values/ApiCredentials');
const ModelId = require('../../domain/values/ModelId');

describe('SettingsRepository', () => {
  let mockStorageAdapter;
  let repository;

  beforeEach(() => {
    mockStorageAdapter = {
      getUserSettings: jest.fn(),
      setUserSettings: jest.fn(),
      removeUserSettings: jest.fn()
    };
    repository = new SettingsRepository(mockStorageAdapter);
  });

  describe('constructor and initialization', () => {
    test('should require storageAdapter parameter', () => {
      expect(() => new SettingsRepository()).toThrow('storageAdapter is required');
      expect(() => new SettingsRepository(null)).toThrow('storageAdapter is required');
      expect(() => new SettingsRepository(undefined)).toThrow('storageAdapter is required');
    });

    test('should initialize with correct default settings', () => {
      expect(repository.defaultSettings).toEqual({
        apiKey: '',
        openRouterApiKey: '',
        model: 'deepseek/deepseek-r1-0528:free',
        historyLimit: 10,
        autoSaveInstructions: true,
        theme: 'auto',
        uiLanguage: ''
      });
    });

    test('should use provided storage adapter', () => {
      expect(repository.storageAdapter).toBe(mockStorageAdapter);
    });
  });

  describe('save method', () => {
    const sampleCredentials = new ApiCredentials('test-gemini-key', 'test-openrouter-key');
    const sampleModel = new ModelId('gemini-2.5-pro', 'Gemini', false);
    const sampleAdditionalSettings = { historyLimit: 15, theme: 'dark' };

    test('should save complete settings with all parameters', async () => {
      mockStorageAdapter.setUserSettings.mockResolvedValue();

      const result = await repository.save(sampleCredentials, sampleModel, sampleAdditionalSettings);

      expect(mockStorageAdapter.setUserSettings).toHaveBeenCalledWith({
        apiKey: 'test-gemini-key',
        openRouterApiKey: 'test-openrouter-key',
        model: 'gemini-2.5-pro',
        selectedModel: sampleModel.toJSON(),
        historyLimit: 15,
        autoSaveInstructions: true,
        theme: 'dark',
        uiLanguage: ''
      });
      expect(result).toEqual(expect.objectContaining({
        apiKey: 'test-gemini-key',
        openRouterApiKey: 'test-openrouter-key',
        model: 'gemini-2.5-pro',
        historyLimit: 15,
        theme: 'dark'
      }));
    });

    test('should merge additional settings with defaults', async () => {
      mockStorageAdapter.setUserSettings.mockResolvedValue();
      const partialSettings = { historyLimit: 20 };

      await repository.save(sampleCredentials, sampleModel, partialSettings);

      expect(mockStorageAdapter.setUserSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          historyLimit: 20,
          autoSaveInstructions: true, // default preserved
          theme: 'auto', // default preserved
          uiLanguage: '' // default preserved
        })
      );
    });

    test('should save with empty additional settings', async () => {
      mockStorageAdapter.setUserSettings.mockResolvedValue();

      await repository.save(sampleCredentials, sampleModel);

      expect(mockStorageAdapter.setUserSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: 'test-gemini-key',
          openRouterApiKey: 'test-openrouter-key',
          model: 'gemini-2.5-pro',
          selectedModel: sampleModel.toJSON(),
          historyLimit: 10,
          autoSaveInstructions: true,
          theme: 'auto',
          uiLanguage: ''
        })
      );
    });

    test('should require ApiCredentials instance', async () => {
      await expect(repository.save('invalid', sampleModel)).rejects.toThrow('credentials must be an ApiCredentials instance');
      await expect(repository.save({}, sampleModel)).rejects.toThrow('credentials must be an ApiCredentials instance');
      await expect(repository.save(null, sampleModel)).rejects.toThrow('credentials must be an ApiCredentials instance');
    });

    test('should require ModelId instance', async () => {
      await expect(repository.save(sampleCredentials, 'invalid')).rejects.toThrow('selectedModel must be a ModelId instance');
      await expect(repository.save(sampleCredentials, {})).rejects.toThrow('selectedModel must be a ModelId instance');
      await expect(repository.save(sampleCredentials, null)).rejects.toThrow('selectedModel must be a ModelId instance');
    });

    test('should propagate storage adapter errors', async () => {
      const storageError = new Error('Storage quota exceeded');
      mockStorageAdapter.setUserSettings.mockRejectedValue(storageError);

      await expect(repository.save(sampleCredentials, sampleModel)).rejects.toThrow('Failed to save settings: Storage quota exceeded');
    });

    test('should include both model string and JSON representation', async () => {
      mockStorageAdapter.setUserSettings.mockResolvedValue();
      const complexModel = new ModelId('anthropic/claude-3.5-sonnet', 'OpenRouter', false);

      await repository.save(sampleCredentials, complexModel);

      expect(mockStorageAdapter.setUserSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'anthropic/claude-3.5-sonnet',
          selectedModel: complexModel.toJSON()
        })
      );
    });
  });

  describe('load method', () => {
    test('should load stored settings successfully', async () => {
      const storedSettings = {
        apiKey: 'stored-gemini-key',
        openRouterApiKey: 'stored-openrouter-key',
        model: 'gemini-2.5-flash',
        selectedModel: {
          value: 'gemini-2.5-flash',
          provider: 'Gemini',
          isFree: false
        },
        historyLimit: 25,
        autoSaveInstructions: false,
        theme: 'light',
        uiLanguage: 'es'
      };
      mockStorageAdapter.getUserSettings.mockResolvedValue(storedSettings);

      const result = await repository.load();

      expect(result.credentials.geminiKey).toBe('stored-gemini-key');
      expect(result.credentials.openRouterKey).toBe('stored-openrouter-key');
      expect(result.selectedModel.toString()).toBe('gemini-2.5-flash');
      expect(result.additionalSettings).toEqual({
        historyLimit: 25,
        autoSaveInstructions: false,
        theme: 'light',
        uiLanguage: 'es'
      });
    });

    test('should merge stored settings with defaults for missing values', async () => {
      const partialStoredSettings = {
        apiKey: 'partial-key',
        historyLimit: 5
        // Missing other settings
      };
      mockStorageAdapter.getUserSettings.mockResolvedValue(partialStoredSettings);

      const result = await repository.load();

      expect(result.credentials.geminiKey).toBe('partial-key');
      expect(result.credentials.openRouterKey).toBe(''); // default
      expect(result.additionalSettings.historyLimit).toBe(5); // stored
      expect(result.additionalSettings.autoSaveInstructions).toBe(true); // default
      expect(result.additionalSettings.theme).toBe('auto'); // default
    });

    test('should return defaults when no settings are stored', async () => {
      mockStorageAdapter.getUserSettings.mockResolvedValue(null);

      const result = await repository.load();

      expect(result.credentials.geminiKey).toBe('');
      expect(result.credentials.openRouterKey).toBe('');
      expect(result.selectedModel.toString()).toBe('deepseek/deepseek-r1-0528:free');
      expect(result.additionalSettings).toEqual({
        historyLimit: 10,
        autoSaveInstructions: true,
        theme: 'auto',
        uiLanguage: ''
      });
    });

    test('should return defaults when storage adapter returns undefined', async () => {
      mockStorageAdapter.getUserSettings.mockResolvedValue(undefined);

      const result = await repository.load();

      expect(result.credentials).toEqual(new ApiCredentials('', ''));
      expect(result.selectedModel.toString()).toBe('deepseek/deepseek-r1-0528:free');
      expect(result.additionalSettings.historyLimit).toBe(10);
    });

    test('should set default free model when no API keys are present', async () => {
      const settingsWithoutKeys = { historyLimit: 15 };
      mockStorageAdapter.getUserSettings.mockResolvedValue(settingsWithoutKeys);

      const result = await repository.load();

      expect(result.selectedModel.toString()).toBe('deepseek/deepseek-r1-0528:free');
      expect(result.selectedModel.isFree).toBe(true);
    });

    test('should handle storage adapter errors gracefully', async () => {
      mockStorageAdapter.getUserSettings.mockRejectedValue(new Error('Storage unavailable'));

      const result = await repository.load();

      // Should return defaults despite error
      expect(result.credentials).toEqual(new ApiCredentials('', ''));
      expect(result.selectedModel.toString()).toBe('deepseek/deepseek-r1-0528:free');
      expect(result.additionalSettings.historyLimit).toBe(10);
    });

    test('should reconstruct ModelId from stored JSON representation', async () => {
      const storedSettings = {
        selectedModel: {
          value: 'openai/gpt-4o',
          provider: 'OpenRouter',
          isFree: false
        }
      };
      mockStorageAdapter.getUserSettings.mockResolvedValue(storedSettings);

      const result = await repository.load();

      expect(result.selectedModel.toString()).toBe('openai/gpt-4o');
      expect(result.selectedModel.provider).toBe('OpenRouter');
      expect(result.selectedModel.isFree).toBe(false);
    });

    test('should use fallback when selectedModel JSON is invalid', async () => {
      const storedSettings = {
        selectedModel: 'invalid-json-structure'
      };
      mockStorageAdapter.getUserSettings.mockResolvedValue(storedSettings);

      const result = await repository.load();

      expect(result.selectedModel.toString()).toBe('deepseek/deepseek-r1-0528:free');
    });
  });

  describe('credential update operations', () => {
    test('should update credentials while preserving other settings', async () => {
      const existingSettings = {
        credentials: new ApiCredentials('old-gemini', 'old-openrouter'),
        selectedModel: new ModelId('gemini-2.5-pro', 'Gemini', false),
        additionalSettings: { historyLimit: 15, theme: 'dark' }
      };
      jest.spyOn(repository, 'load').mockResolvedValue(existingSettings);
      jest.spyOn(repository, 'save').mockResolvedValue({});

      const newCredentials = new ApiCredentials('new-gemini', 'new-openrouter');
      await repository.updateCredentials(newCredentials);

      expect(repository.save).toHaveBeenCalledWith(
        newCredentials,
        existingSettings.selectedModel,
        existingSettings.additionalSettings
      );
    });

    test('should update selected model while preserving other settings', async () => {
      const existingSettings = {
        credentials: new ApiCredentials('gemini-key', 'openrouter-key'),
        selectedModel: new ModelId('old-model', 'Gemini', false),
        additionalSettings: { historyLimit: 20, theme: 'light' }
      };
      jest.spyOn(repository, 'load').mockResolvedValue(existingSettings);
      jest.spyOn(repository, 'save').mockResolvedValue({});

      const newModel = new ModelId('anthropic/claude-3.5-sonnet', 'OpenRouter', false);
      await repository.updateSelectedModel(newModel);

      expect(repository.save).toHaveBeenCalledWith(
        existingSettings.credentials,
        newModel,
        existingSettings.additionalSettings
      );
    });

    test('should update individual setting while preserving others', async () => {
      const existingSettings = {
        credentials: new ApiCredentials('gemini-key', 'openrouter-key'),
        selectedModel: new ModelId('gemini-2.5-pro', 'Gemini', false),
        additionalSettings: { historyLimit: 10, theme: 'auto', uiLanguage: 'en' }
      };
      jest.spyOn(repository, 'load').mockResolvedValue(existingSettings);
      jest.spyOn(repository, 'save').mockResolvedValue({});

      await repository.updateSetting('historyLimit', 30);

      expect(repository.save).toHaveBeenCalledWith(
        existingSettings.credentials,
        existingSettings.selectedModel,
        { historyLimit: 30, theme: 'auto', uiLanguage: 'en' }
      );
    });

    test('should add new setting to additional settings', async () => {
      const existingSettings = {
        credentials: new ApiCredentials('key1', 'key2'),
        selectedModel: new ModelId('model', 'Provider', true),
        additionalSettings: { historyLimit: 10 }
      };
      jest.spyOn(repository, 'load').mockResolvedValue(existingSettings);
      jest.spyOn(repository, 'save').mockResolvedValue({});

      await repository.updateSetting('newSetting', 'newValue');

      expect(repository.save).toHaveBeenCalledWith(
        existingSettings.credentials,
        existingSettings.selectedModel,
        { historyLimit: 10, newSetting: 'newValue' }
      );
    });
  });

  describe('legacy settings support', () => {
    test('should save legacy settings format', async () => {
      const currentSettings = {
        credentials: new ApiCredentials('current-gemini', 'current-openrouter'),
        selectedModel: new ModelId('current-model', 'Current', true),
        additionalSettings: { historyLimit: 10, theme: 'auto' }
      };
      jest.spyOn(repository, 'load').mockResolvedValue(currentSettings);
      jest.spyOn(repository, 'save').mockResolvedValue({});

      const legacySettings = {
        apiKey: 'legacy-gemini-key',
        historyLimit: 25,
        theme: 'dark'
      };

      await repository.saveSettings(legacySettings);

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          geminiKey: 'legacy-gemini-key',
          openRouterKey: 'current-openrouter' // preserved from current
        }),
        currentSettings.selectedModel, // preserved from current
        expect.objectContaining({
          historyLimit: 25, // from legacy
          theme: 'dark', // from legacy
          autoSaveInstructions: undefined, // these are undefined in legacy format
          uiLanguage: undefined // these are undefined in legacy format
        })
      );
    });

    test('should handle partial legacy settings updates', async () => {
      const currentSettings = {
        credentials: new ApiCredentials('gemini', 'openrouter'),
        selectedModel: new ModelId('model', 'Provider', false),
        additionalSettings: { historyLimit: 5, autoSaveInstructions: false, theme: 'light' }
      };
      jest.spyOn(repository, 'load').mockResolvedValue(currentSettings);
      jest.spyOn(repository, 'save').mockResolvedValue({});

      const partialLegacySettings = {
        openRouterApiKey: 'new-openrouter-key'
        // Only updating one field
      };

      await repository.saveSettings(partialLegacySettings);

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          geminiKey: 'gemini', // preserved
          openRouterKey: 'new-openrouter-key' // updated
        }),
        currentSettings.selectedModel, // preserved
        currentSettings.additionalSettings // preserved
      );
    });

    test('should handle undefined values in legacy settings', async () => {
      const currentSettings = {
        credentials: new ApiCredentials('current-key', ''),
        selectedModel: new ModelId('model', 'Provider', true),
        additionalSettings: { historyLimit: 15 }
      };
      jest.spyOn(repository, 'load').mockResolvedValue(currentSettings);
      jest.spyOn(repository, 'save').mockResolvedValue({});

      const legacySettingsWithUndefined = {
        apiKey: undefined,
        openRouterApiKey: 'defined-key',
        historyLimit: undefined
      };

      await repository.saveSettings(legacySettingsWithUndefined);

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          geminiKey: 'current-key', // preserved because undefined
          openRouterKey: 'defined-key' // updated
        }),
        currentSettings.selectedModel,
        expect.objectContaining({
          historyLimit: 15 // preserved because undefined
        })
      );
    });

    test('should propagate errors from legacy settings save', async () => {
      jest.spyOn(repository, 'load').mockRejectedValue(new Error('Load failed'));

      await expect(repository.saveSettings({})).rejects.toThrow('Failed to save legacy settings: Load failed');
    });

    test('should load settings in legacy format', async () => {
      const storedSettings = {
        apiKey: 'legacy-gemini',
        openRouterApiKey: 'legacy-openrouter',
        model: 'legacy-model-string',
        historyLimit: 8,
        theme: 'custom'
      };
      mockStorageAdapter.getUserSettings.mockResolvedValue(storedSettings);

      const result = await repository.loadSettings();

      expect(result).toEqual({
        apiKey: 'legacy-gemini',
        openRouterApiKey: 'legacy-openrouter',
        model: 'deepseek/deepseek-r1-0528:free', // defaults to free model when no selectedModel JSON
        historyLimit: 8,
        autoSaveInstructions: true, // default
        theme: 'custom',
        uiLanguage: '' // default
      });
    });
  });

  describe('reset functionality', () => {
    test('should reset settings to defaults', async () => {
      mockStorageAdapter.removeUserSettings.mockResolvedValue();

      const result = await repository.reset();

      expect(mockStorageAdapter.removeUserSettings).toHaveBeenCalled();
      expect(result).toEqual(repository.defaultSettings);
    });

    test('should propagate storage adapter errors during reset', async () => {
      const resetError = new Error('Cannot remove settings');
      mockStorageAdapter.removeUserSettings.mockRejectedValue(resetError);

      await expect(repository.reset()).rejects.toThrow('Failed to reset settings: Cannot remove settings');
    });
  });

  describe('business logic validation', () => {
    test('should maintain settings consistency across operations', async () => {
      // Test that multiple operations don't interfere with each other
      const credentials = new ApiCredentials('test-key', '');
      const model = new ModelId('test-model', 'Test', true);
      const settings = { historyLimit: 5 };

      mockStorageAdapter.setUserSettings.mockResolvedValue();
      mockStorageAdapter.getUserSettings.mockResolvedValue({
        apiKey: 'test-key',
        model: 'test-model',
        selectedModel: model.toJSON(),
        historyLimit: 5,
        autoSaveInstructions: true,
        theme: 'auto',
        uiLanguage: ''
      });

      // Save then load
      await repository.save(credentials, model, settings);
      const loaded = await repository.load();

      expect(loaded.credentials.geminiKey).toBe('test-key');
      expect(loaded.selectedModel.toString()).toBe('test-model');
      expect(loaded.additionalSettings.historyLimit).toBe(5);
    });

    test('should handle settings validation errors appropriately', async () => {
      // This test validates that the repository properly validates input types
      const invalidCredentials = 'not-an-api-credentials-object';
      const validModel = new ModelId('valid-model', 'Provider', true);

      await expect(repository.save(invalidCredentials, validModel))
        .rejects.toThrow('credentials must be an ApiCredentials instance');
    });

    test('should preserve data types through save and load cycle', async () => {
      const credentials = new ApiCredentials('key1', 'key2');
      const model = new ModelId('complex/model:free', 'OpenRouter', true);
      const additionalSettings = {
        historyLimit: 42,
        autoSaveInstructions: false,
        theme: 'system',
        uiLanguage: 'fr'
      };

      mockStorageAdapter.setUserSettings.mockResolvedValue();
      await repository.save(credentials, model, additionalSettings);

      // Mock what would be stored
      const storedData = mockStorageAdapter.setUserSettings.mock.calls[0][0];
      mockStorageAdapter.getUserSettings.mockResolvedValue(storedData);

      const loaded = await repository.load();

      expect(typeof loaded.additionalSettings.historyLimit).toBe('number');
      expect(typeof loaded.additionalSettings.autoSaveInstructions).toBe('boolean');
      expect(typeof loaded.additionalSettings.theme).toBe('string');
      expect(loaded.credentials instanceof ApiCredentials).toBe(true);
      expect(loaded.selectedModel instanceof ModelId).toBe(true);
    });
  });
});
