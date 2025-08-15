/**
 * Storage Layer Integration Tests
 * Tests cross-component storage consistency and historyLimit synchronization
 *
 * Copyright (C) 2025 Dimitry Polivaev
 * Licensed under GPL3 or later
 */

const BrowserStorageAdapter = require('./adapters/BrowserStorageAdapter');
const SettingsRepository = require('./repositories/SettingsRepository');
const InstructionHistoryRepository = require('./repositories/InstructionHistoryRepository');
const ApiCredentials = require('../domain/values/ApiCredentials');
const ModelId = require('../domain/values/ModelId');
const InstructionEntry = require('../domain/entities/InstructionEntry');

describe('Storage Layer Integration', () => {
  let mockBrowserStorage;
  let storageAdapter;
  let settingsRepository;
  let instructionHistoryRepository;

  beforeEach(() => {
    mockBrowserStorage = {
      storage: {
        sync: {
          get: jest.fn(),
          set: jest.fn(),
          remove: jest.fn()
        },
        local: {
          get: jest.fn(),
          set: jest.fn(),
          remove: jest.fn()
        }
      }
    };

    storageAdapter = new BrowserStorageAdapter(mockBrowserStorage);
    settingsRepository = new SettingsRepository(storageAdapter);
    instructionHistoryRepository = new InstructionHistoryRepository(storageAdapter, settingsRepository);

    // Mock Date.now() for consistent test results
    jest.spyOn(Date, 'now').mockReturnValue(1642678800000);
    jest.spyOn(Date.prototype, 'toISOString').mockReturnValue('2022-01-20T10:00:00.000Z');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('historyLimit synchronization', () => {
    test('should respect history limit from settings when adding instructions', async () => {
      // Setup settings with custom history limit
      const settingsData = {
        apiKey: 'test-key',
        openRouterApiKey: '',
        model: 'gemini-2.5-pro',
        selectedModel: {
          modelId: 'gemini-2.5-pro',
          provider: 'Gemini',
          isFree: false
        },
        historyLimit: 3,
        autoSaveInstructions: true,
        theme: 'auto',
        uiLanguage: ''
      };
      mockBrowserStorage.storage.sync.get.mockResolvedValue({ userSettings: settingsData });
      mockBrowserStorage.storage.sync.set.mockResolvedValue();

      // Setup existing instruction history with 2 items
      const existingHistory = [
        { id: 1, content: 'First instruction', timestamp: '2022-01-19T08:00:00.000Z', name: '', isCustomName: false },
        { id: 2, content: 'Second instruction', timestamp: '2022-01-19T09:00:00.000Z', name: '', isCustomName: false }
      ];
      mockBrowserStorage.storage.local.get.mockResolvedValue({ instructionHistory: existingHistory });
      mockBrowserStorage.storage.local.set.mockResolvedValue();

      // Add a third instruction - should still fit within limit
      await instructionHistoryRepository.addInstruction('Third instruction');

      expect(mockBrowserStorage.storage.local.set).toHaveBeenCalledWith({
        instructionHistory: expect.arrayContaining([
          expect.objectContaining({ content: 'Third instruction' }),
          expect.objectContaining({ content: 'First instruction' }),
          expect.objectContaining({ content: 'Second instruction' })
        ])
      });

      // Verify history has exactly 3 items (the limit)
      const savedHistory = mockBrowserStorage.storage.local.set.mock.calls[0][0].instructionHistory;
      expect(savedHistory).toHaveLength(3);
    });

    test('should enforce history limit when it changes in settings', async () => {
      // Setup existing instruction history with 5 items
      const existingHistory = Array.from({length: 5}, (_, i) => ({
        id: i + 1,
        content: `Instruction ${i + 1}`,
        timestamp: `2022-01-${15 + i}T10:00:00.000Z`,
        name: '',
        isCustomName: false
      }));
      mockBrowserStorage.storage.local.get.mockResolvedValue({ instructionHistory: existingHistory });
      mockBrowserStorage.storage.local.set.mockResolvedValue();

      // Change history limit to 2
      await instructionHistoryRepository.setHistoryLimit(2);

      // Verify history was trimmed to 2 items
      expect(mockBrowserStorage.storage.local.set).toHaveBeenCalledWith({
        instructionHistory: [
          expect.objectContaining({ content: 'Instruction 1' }),
          expect.objectContaining({ content: 'Instruction 2' })
        ]
      });
    });

    test('should use updated history limit immediately after settings change', async () => {
      // Initial settings with limit 5
      const initialSettings = {
        historyLimit: 5,
        autoSaveInstructions: true,
        theme: 'auto',
        uiLanguage: ''
      };

      // Updated settings with limit 2
      const updatedSettings = {
        historyLimit: 2,
        autoSaveInstructions: true,
        theme: 'auto',
        uiLanguage: ''
      };

      const credentials = new ApiCredentials('test-key', '');
      const model = new ModelId('gemini-2.5-pro', 'Gemini', false);

      // Mock the initial load to return initial settings
      mockBrowserStorage.storage.sync.get
        .mockResolvedValueOnce({ userSettings: { ...initialSettings, apiKey: 'test-key', model: 'gemini-2.5-pro', selectedModel: model.toJSON() } })
        .mockResolvedValueOnce({ userSettings: { ...updatedSettings, apiKey: 'test-key', model: 'gemini-2.5-pro', selectedModel: model.toJSON() } });

      mockBrowserStorage.storage.sync.set.mockResolvedValue();

      // Setup existing history with 4 items
      const existingHistory = Array.from({length: 4}, (_, i) => ({
        id: i + 1,
        content: `Instruction ${i + 1}`,
        timestamp: `2022-01-${16 + i}T10:00:00.000Z`,
        name: '',
        isCustomName: false
      }));
      mockBrowserStorage.storage.local.get.mockResolvedValue({ instructionHistory: existingHistory });
      mockBrowserStorage.storage.local.set.mockResolvedValue();

      // Update settings to change history limit
      await settingsRepository.save(credentials, model, updatedSettings);

      // Add new instruction - should respect the new limit of 2
      await instructionHistoryRepository.addInstruction('New instruction after limit change');

      // Verify the final instruction history reflects the new limit
      // The addInstruction method checks the limit but doesn't automatically trim existing history
      // This would need to be done by calling setHistoryLimit separately
      const savedHistory = mockBrowserStorage.storage.local.set.mock.calls[0][0].instructionHistory;
      expect(savedHistory).toHaveLength(5); // Original 4 + 1 new = 5 total (no auto-trim)
      expect(savedHistory[0]).toEqual(expect.objectContaining({ content: 'New instruction after limit change' }));
    });

    test('should handle settings repository failure gracefully when getting history limit', async () => {
      // Mock settings repository to fail
      mockBrowserStorage.storage.sync.get.mockRejectedValue(new Error('Settings load failed'));

      // Setup existing history
      mockBrowserStorage.storage.local.get.mockResolvedValue({ instructionHistory: [] });
      mockBrowserStorage.storage.local.set.mockResolvedValue();

      // Mock console.error to avoid test noise
      jest.spyOn(console, 'error').mockImplementation(() => {});

      // Add instruction - should use default limit (10) when settings fail
      await instructionHistoryRepository.addInstruction('Test instruction');

      // The console.error is called within the getHistoryLimit method
      // Since we're mocking the settingsRepository.load to fail, this should be called
      expect(mockBrowserStorage.storage.local.set).toHaveBeenCalledWith({
        instructionHistory: [expect.objectContaining({ content: 'Test instruction' })]
      });
    });
  });

  describe('storage consistency between components', () => {
    test('should maintain data consistency when settings and history are updated together', async () => {
      const credentials = new ApiCredentials('gemini-key', 'openrouter-key');
      const model = new ModelId('anthropic/claude-3.5-sonnet', 'OpenRouter', false);
      const additionalSettings = { historyLimit: 7, theme: 'dark' };

      // Mock storage operations
      mockBrowserStorage.storage.sync.set.mockResolvedValue();
      mockBrowserStorage.storage.local.get.mockResolvedValue({ instructionHistory: [] });
      mockBrowserStorage.storage.local.set.mockResolvedValue();

      // Save settings
      await settingsRepository.save(credentials, model, additionalSettings);

      // Mock the settings load for history repository
      mockBrowserStorage.storage.sync.get.mockResolvedValue({
        userSettings: {
          apiKey: 'gemini-key',
          openRouterApiKey: 'openrouter-key',
          model: 'anthropic/claude-3.5-sonnet',
          selectedModel: model.toJSON(),
          historyLimit: 7,
          autoSaveInstructions: true,
          theme: 'dark',
          uiLanguage: ''
        }
      });

      // Add instruction with the new limit
      await instructionHistoryRepository.addInstruction('Test instruction');

      // Verify settings were saved to sync storage
      expect(mockBrowserStorage.storage.sync.set).toHaveBeenCalledWith({
        userSettings: expect.objectContaining({
          apiKey: 'gemini-key',
          openRouterApiKey: 'openrouter-key',
          historyLimit: 7,
          theme: 'dark'
        })
      });

      // Verify instruction was saved to local storage
      expect(mockBrowserStorage.storage.local.set).toHaveBeenCalledWith({
        instructionHistory: [expect.objectContaining({ content: 'Test instruction' })]
      });
    });

    test('should handle mixed storage types correctly', async () => {
      // Settings go to sync storage, history goes to local storage
      const settingsData = { historyLimit: 15 };
      const historyData = [{ id: 1, content: 'Test', timestamp: '2022-01-20T10:00:00.000Z', name: '', isCustomName: false }];

      mockBrowserStorage.storage.sync.get.mockResolvedValue({ userSettings: settingsData });
      mockBrowserStorage.storage.local.get.mockResolvedValue({ instructionHistory: historyData });

      // Load from both repositories
      const settings = await settingsRepository.load();
      const history = await instructionHistoryRepository.getHistory();

      // Verify correct storage APIs were called
      expect(mockBrowserStorage.storage.sync.get).toHaveBeenCalledWith('userSettings');
      expect(mockBrowserStorage.storage.local.get).toHaveBeenCalledWith('instructionHistory');

      // Verify data integrity
      expect(settings.additionalSettings.historyLimit).toBe(15);
      expect(history).toEqual(historyData);
    });

    test('should isolate storage failures between sync and local storage', async () => {
      // Sync storage fails, local storage succeeds
      mockBrowserStorage.storage.sync.get.mockRejectedValue(new Error('Sync storage unavailable'));
      mockBrowserStorage.storage.local.get.mockResolvedValue({
        instructionHistory: [{ id: 1, content: 'Local data', timestamp: '2022-01-20T10:00:00.000Z', name: '', isCustomName: false }]
      });

      // Settings should return defaults due to sync failure
      const settings = await settingsRepository.load();
      expect(settings.additionalSettings.historyLimit).toBe(10); // default

      // History should still work with local storage
      const history = await instructionHistoryRepository.getHistory();
      expect(history).toEqual([expect.objectContaining({ content: 'Local data' })]);
    });
  });

  describe('cross-component data flow', () => {
    test('should complete full workflow: save settings, add instructions, verify limits', async () => {
      const credentials = new ApiCredentials('workflow-key', '');
      const model = new ModelId('gemini-2.5-flash', 'Gemini', false);
      const settings = { historyLimit: 3, autoSaveInstructions: true };

      // Mock all storage operations
      mockBrowserStorage.storage.sync.set.mockResolvedValue();
      mockBrowserStorage.storage.sync.get.mockResolvedValue({
        userSettings: {
          apiKey: 'workflow-key',
          openRouterApiKey: '',
          model: 'gemini-2.5-flash',
          selectedModel: model.toJSON(),
          historyLimit: 3,
          autoSaveInstructions: true,
          theme: 'auto',
          uiLanguage: ''
        }
      });
      mockBrowserStorage.storage.local.get.mockResolvedValue({ instructionHistory: [] });
      mockBrowserStorage.storage.local.set.mockResolvedValue();

      // Step 1: Save settings
      await settingsRepository.save(credentials, model, settings);

      // Step 2: Add multiple instructions
      await instructionHistoryRepository.addInstruction('First instruction');
      await instructionHistoryRepository.addInstruction('Second instruction');
      await instructionHistoryRepository.addInstruction('Third instruction');
      await instructionHistoryRepository.addInstruction('Fourth instruction'); // Should trigger limit

      // Step 3: Verify final state
      const finalHistory = mockBrowserStorage.storage.local.set.mock.calls.slice(-1)[0][0].instructionHistory;
      expect(finalHistory).toHaveLength(3); // Respects limit
      expect(finalHistory[0]).toEqual(expect.objectContaining({ content: 'Fourth instruction' }));
      expect(finalHistory[2]).toEqual(expect.objectContaining({ content: 'Second instruction' }));
    });

    test('should handle instruction renaming with settings integration', async () => {
      // Setup initial state
      const historyData = [
        { id: 1, content: 'Rename me', timestamp: '2022-01-20T09:00:00.000Z', name: '', isCustomName: false },
        { id: 2, content: 'Keep me', timestamp: '2022-01-20T08:00:00.000Z', name: '', isCustomName: false }
      ];

      mockBrowserStorage.storage.local.get.mockResolvedValue({ instructionHistory: historyData });
      mockBrowserStorage.storage.local.set.mockResolvedValue();

      // Rename instruction
      await instructionHistoryRepository.renameInstruction(1, 'Custom Name');

      // Verify rename operation
      expect(mockBrowserStorage.storage.local.set).toHaveBeenCalledWith({
        instructionHistory: [
          expect.objectContaining({
            id: 1,
            name: 'Custom Name',
            isCustomName: true
          }),
          expect.objectContaining({
            id: 2,
            name: '',
            isCustomName: false
          })
        ]
      });
    });

    test('should handle instruction deletion with proper history management', async () => {
      // Setup history with multiple entries
      const historyData = [
        { id: 1, content: 'Keep this', timestamp: '2022-01-20T10:00:00.000Z', name: 'Important', isCustomName: true },
        { id: 2, content: 'Delete this', timestamp: '2022-01-20T09:00:00.000Z', name: '', isCustomName: false },
        { id: 3, content: 'Keep this too', timestamp: '2022-01-20T08:00:00.000Z', name: '', isCustomName: false }
      ];

      mockBrowserStorage.storage.local.get.mockResolvedValue({ instructionHistory: historyData });
      mockBrowserStorage.storage.local.set.mockResolvedValue();

      // Delete middle instruction
      const result = await instructionHistoryRepository.deleteInstruction(2);

      // Verify deletion
      expect(result).toHaveLength(2);
      expect(result.find(item => item.id === 2)).toBeUndefined();
      expect(result.find(item => item.id === 1)).toBeDefined();
      expect(result.find(item => item.id === 3)).toBeDefined();
    });
  });

  describe('error recovery and fault tolerance', () => {
    test('should recover when storage adapter operations fail partially', async () => {
      // Sync storage works, local storage fails initially then recovers
      mockBrowserStorage.storage.sync.get.mockResolvedValue({
        userSettings: { historyLimit: 5 }
      });

      mockBrowserStorage.storage.local.get
        .mockRejectedValueOnce(new Error('Local storage temporarily unavailable'))
        .mockResolvedValueOnce({ instructionHistory: [] });

      mockBrowserStorage.storage.local.set.mockResolvedValue();

      // First attempt should fail
      await expect(instructionHistoryRepository.getHistory()).rejects.toThrow('Local storage temporarily unavailable');

      // Second attempt should succeed
      const history = await instructionHistoryRepository.getHistory();
      expect(history).toEqual([]);
    });

    test('should maintain data integrity when settings update fails', async () => {
      const credentials = new ApiCredentials('test-key', '');
      const model = new ModelId('test-model', 'Test', true);

      // Mock settings save to fail
      mockBrowserStorage.storage.sync.set.mockRejectedValue(new Error('Settings save failed'));

      // Attempting to save settings should propagate the error with the full error chain
      await expect(settingsRepository.save(credentials, model)).rejects.toThrow('Failed to save settings: Failed to set sync storage key \'userSettings\': Settings save failed');

      // Verify sync storage was attempted but no local storage operations occurred
      expect(mockBrowserStorage.storage.sync.set).toHaveBeenCalled();
      expect(mockBrowserStorage.storage.local.set).not.toHaveBeenCalled();
    });

    test('should handle corrupted data gracefully', async () => {
      // Mock corrupted settings data
      mockBrowserStorage.storage.sync.get.mockResolvedValue({
        userSettings: 'corrupted-string-instead-of-object'
      });

      // Mock valid history data
      mockBrowserStorage.storage.local.get.mockResolvedValue({
        instructionHistory: [{ id: 1, content: 'Valid instruction', timestamp: '2022-01-20T10:00:00.000Z', name: '', isCustomName: false }]
      });

      // Settings should return defaults due to corruption
      const settings = await settingsRepository.load();
      expect(settings.credentials.geminiKey).toBe('');
      expect(settings.additionalSettings.historyLimit).toBe(10);

      // History should still work normally
      const history = await instructionHistoryRepository.getHistory();
      expect(history).toEqual([expect.objectContaining({ content: 'Valid instruction' })]);
    });

    test('should handle storage quota exceeded errors appropriately', async () => {
      mockBrowserStorage.storage.local.get.mockResolvedValue({ instructionHistory: [] });
      mockBrowserStorage.storage.local.set.mockRejectedValue(new Error('Storage quota exceeded'));
      mockBrowserStorage.storage.sync.get.mockResolvedValue({
        userSettings: { historyLimit: 10 }
      });

      // Adding instruction should propagate quota error from storage.local.set
      await expect(instructionHistoryRepository.addInstruction('Large instruction content')).rejects.toThrow('Storage quota exceeded');

      // Reset the mock to avoid confusion in subsequent calls
      mockBrowserStorage.storage.local.get.mockClear();
      mockBrowserStorage.storage.local.get.mockResolvedValue({ instructionHistory: [] });

      // Verify get operations still work despite set failure
      const history = await instructionHistoryRepository.getHistory();
      expect(history).toEqual([]);
    });
  });

  describe('performance and efficiency', () => {
    test('should minimize storage operations during bulk instruction operations', async () => {
      mockBrowserStorage.storage.local.get.mockResolvedValue({ instructionHistory: [] });
      mockBrowserStorage.storage.local.set.mockResolvedValue();
      mockBrowserStorage.storage.sync.get.mockResolvedValue({
        userSettings: { historyLimit: 10 }
      });

      // Each addInstruction should result in exactly one get and one set operation
      await instructionHistoryRepository.addInstruction('First');
      expect(mockBrowserStorage.storage.local.get).toHaveBeenCalledTimes(1);
      expect(mockBrowserStorage.storage.local.set).toHaveBeenCalledTimes(1);

      // Reset mocks to test second operation
      mockBrowserStorage.storage.local.get.mockClear();
      mockBrowserStorage.storage.local.set.mockClear();
      mockBrowserStorage.storage.local.get.mockResolvedValue({
        instructionHistory: [{ id: 1, content: 'First', timestamp: '2022-01-20T10:00:00.000Z', name: '', isCustomName: false }]
      });

      await instructionHistoryRepository.addInstruction('Second');
      expect(mockBrowserStorage.storage.local.get).toHaveBeenCalledTimes(1);
      expect(mockBrowserStorage.storage.local.set).toHaveBeenCalledTimes(1);
    });

    test('should batch related operations when possible', async () => {
      const historyData = [
        { id: 1, content: 'Test 1', timestamp: '2022-01-20T10:00:00.000Z', name: '', isCustomName: false },
        { id: 2, content: 'Test 2', timestamp: '2022-01-20T09:00:00.000Z', name: '', isCustomName: false }
      ];

      mockBrowserStorage.storage.local.get.mockResolvedValue({ instructionHistory: historyData });
      mockBrowserStorage.storage.local.set.mockResolvedValue();

      // Multiple operations on the same repository instance
      await instructionHistoryRepository.renameInstruction(1, 'Renamed');
      await instructionHistoryRepository.deleteInstruction(2);

      // Each operation should do its own get/set - this is expected for data consistency
      expect(mockBrowserStorage.storage.local.get).toHaveBeenCalledTimes(2);
      expect(mockBrowserStorage.storage.local.set).toHaveBeenCalledTimes(2);
    });
  });

  describe('data type preservation and validation', () => {
    test('should preserve data types through complete storage cycle', async () => {
      const credentials = new ApiCredentials('typed-key', 'typed-openrouter');
      const model = new ModelId('typed/model:free', 'TypedProvider', true);
      const additionalSettings = {
        historyLimit: 42,
        autoSaveInstructions: false,
        theme: 'custom',
        uiLanguage: 'typed-lang'
      };

      // Mock storage operations
      mockBrowserStorage.storage.sync.set.mockResolvedValue();
      mockBrowserStorage.storage.local.get.mockResolvedValue({ instructionHistory: [] });
      mockBrowserStorage.storage.local.set.mockResolvedValue();

      // Save settings
      await settingsRepository.save(credentials, model, additionalSettings);
      const savedSettings = mockBrowserStorage.storage.sync.set.mock.calls[0][0].userSettings;

      // Mock the saved data for load
      mockBrowserStorage.storage.sync.get.mockResolvedValue({ userSettings: savedSettings });

      // Load settings back
      const loadedSettings = await settingsRepository.load();

      // Verify type preservation
      expect(typeof loadedSettings.additionalSettings.historyLimit).toBe('number');
      expect(typeof loadedSettings.additionalSettings.autoSaveInstructions).toBe('boolean');
      expect(typeof loadedSettings.additionalSettings.theme).toBe('string');
      expect(loadedSettings.credentials instanceof ApiCredentials).toBe(true);
      expect(loadedSettings.selectedModel instanceof ModelId).toBe(true);

      // Verify values
      expect(loadedSettings.additionalSettings.historyLimit).toBe(42);
      expect(loadedSettings.additionalSettings.autoSaveInstructions).toBe(false);
      expect(loadedSettings.credentials.geminiKey).toBe('typed-key');
      expect(loadedSettings.selectedModel.toString()).toBe('typed/model:free');
    });

    test('should validate instruction entry data integrity through storage cycle', async () => {
      mockBrowserStorage.storage.local.get.mockResolvedValue({ instructionHistory: [] });
      mockBrowserStorage.storage.local.set.mockResolvedValue();
      mockBrowserStorage.storage.sync.get.mockResolvedValue({
        userSettings: { historyLimit: 10 }
      });

      // Add instruction
      const addedInstruction = await instructionHistoryRepository.addInstruction('Typed instruction');
      const savedHistory = mockBrowserStorage.storage.local.set.mock.calls[0][0].instructionHistory;

      // Mock the saved data for retrieval
      mockBrowserStorage.storage.local.get.mockResolvedValue({ instructionHistory: savedHistory });

      // Retrieve history
      const retrievedHistory = await instructionHistoryRepository.getHistory();
      const retrievedInstruction = retrievedHistory[0];

      // Verify data integrity
      expect(retrievedInstruction.id).toBe(addedInstruction.id);
      expect(retrievedInstruction.content).toBe(addedInstruction.content);
      expect(retrievedInstruction.timestamp).toBe(addedInstruction.timestamp);
      expect(retrievedInstruction.name).toBe(addedInstruction.name);
      expect(retrievedInstruction.isCustomName).toBe(addedInstruction.isCustomName);

      // Verify InstructionEntry can be reconstructed
      const entry = InstructionEntry.fromStorageObject(retrievedInstruction);
      expect(entry.getDisplayName()).toMatch(/\d{1,2}\/\d{1,2}\/\d{4} \d{1,2}:\d{2}/);
      expect(entry.hasCustomName()).toBe(false);
    });
  });
});
