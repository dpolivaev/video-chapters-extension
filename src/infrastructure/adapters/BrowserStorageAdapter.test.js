/**
 * BrowserStorageAdapter Tests
 * Tests centralized storage operations for sync and local storage
 *
 * Copyright (C) 2025 Dimitry Polivaev
 * Licensed under GPL3 or later
 */

const BrowserStorageAdapter = require('./BrowserStorageAdapter');

describe('BrowserStorageAdapter', () => {
  let mockBrowser;
  let adapter;

  beforeEach(() => {
    mockBrowser = {
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
    adapter = new BrowserStorageAdapter(mockBrowser);
  });

  describe('constructor', () => {
    test('should initialize with default browser API when not provided', () => {
      // In Node environment, browser is not defined, so we expect a ReferenceError
      // This is expected behavior in the test environment
      expect(() => new BrowserStorageAdapter()).toThrow('browser is not defined');
    });

    test('should initialize with custom browser API', () => {
      const customAdapter = new BrowserStorageAdapter(mockBrowser);
      expect(customAdapter.browser).toBe(mockBrowser);
    });

    test('should define storage keys for domain operations', () => {
      expect(adapter.STORAGE_KEYS.USER_SETTINGS).toBe('userSettings');
      expect(adapter.STORAGE_KEYS.INSTRUCTION_HISTORY).toBe('instructionHistory');
      expect(adapter.STORAGE_KEYS.LAST_CUSTOM_INSTRUCTIONS).toBe('lastCustomInstructions');
    });
  });

  describe('sync storage operations', () => {
    test('should get sync storage value successfully', async () => {
      const expectedValue = { model: 'gemini-pro', apiKey: 'test-key' };
      mockBrowser.storage.sync.get.mockResolvedValue({ testKey: expectedValue });

      const result = await adapter.getSyncStorage('testKey');

      expect(result).toEqual(expectedValue);
      expect(mockBrowser.storage.sync.get).toHaveBeenCalledWith('testKey');
    });

    test('should return undefined when sync storage key does not exist', async () => {
      mockBrowser.storage.sync.get.mockResolvedValue({});

      const result = await adapter.getSyncStorage('nonexistent');

      expect(result).toBeUndefined();
      expect(mockBrowser.storage.sync.get).toHaveBeenCalledWith('nonexistent');
    });

    test('should set sync storage value successfully', async () => {
      const testValue = { setting: 'value' };
      mockBrowser.storage.sync.set.mockResolvedValue();

      await adapter.setSyncStorage('testKey', testValue);

      expect(mockBrowser.storage.sync.set).toHaveBeenCalledWith({ testKey: testValue });
    });

    test('should remove sync storage key successfully', async () => {
      mockBrowser.storage.sync.remove.mockResolvedValue();

      await adapter.removeSyncStorage('testKey');

      expect(mockBrowser.storage.sync.remove).toHaveBeenCalledWith('testKey');
    });

    test('should throw descriptive error when sync get fails', async () => {
      const originalError = new Error('Storage quota exceeded');
      mockBrowser.storage.sync.get.mockRejectedValue(originalError);

      await expect(adapter.getSyncStorage('testKey')).rejects.toThrow(
        "Failed to get sync storage key 'testKey': Storage quota exceeded"
      );
    });

    test('should throw descriptive error when sync set fails', async () => {
      const originalError = new Error('Network error');
      mockBrowser.storage.sync.set.mockRejectedValue(originalError);

      await expect(adapter.setSyncStorage('testKey', 'value')).rejects.toThrow(
        "Failed to set sync storage key 'testKey': Network error"
      );
    });

    test('should throw descriptive error when sync remove fails', async () => {
      const originalError = new Error('Permission denied');
      mockBrowser.storage.sync.remove.mockRejectedValue(originalError);

      await expect(adapter.removeSyncStorage('testKey')).rejects.toThrow(
        "Failed to remove sync storage key 'testKey': Permission denied"
      );
    });
  });

  describe('local storage operations', () => {
    test('should get local storage value successfully', async () => {
      const expectedHistory = [{ id: 1, content: 'test instruction' }];
      mockBrowser.storage.local.get.mockResolvedValue({ testKey: expectedHistory });

      const result = await adapter.getLocalStorage('testKey');

      expect(result).toEqual(expectedHistory);
      expect(mockBrowser.storage.local.get).toHaveBeenCalledWith('testKey');
    });

    test('should return undefined when local storage key does not exist', async () => {
      mockBrowser.storage.local.get.mockResolvedValue({});

      const result = await adapter.getLocalStorage('nonexistent');

      expect(result).toBeUndefined();
      expect(mockBrowser.storage.local.get).toHaveBeenCalledWith('nonexistent');
    });

    test('should set local storage value successfully', async () => {
      const testData = [{ instruction: 'generate chapters' }];
      mockBrowser.storage.local.set.mockResolvedValue();

      await adapter.setLocalStorage('testKey', testData);

      expect(mockBrowser.storage.local.set).toHaveBeenCalledWith({ testKey: testData });
    });

    test('should remove local storage key successfully', async () => {
      mockBrowser.storage.local.remove.mockResolvedValue();

      await adapter.removeLocalStorage('testKey');

      expect(mockBrowser.storage.local.remove).toHaveBeenCalledWith('testKey');
    });

    test('should throw descriptive error when local get fails', async () => {
      const originalError = new Error('Database locked');
      mockBrowser.storage.local.get.mockRejectedValue(originalError);

      await expect(adapter.getLocalStorage('testKey')).rejects.toThrow(
        "Failed to get local storage key 'testKey': Database locked"
      );
    });

    test('should throw descriptive error when local set fails', async () => {
      const originalError = new Error('Disk full');
      mockBrowser.storage.local.set.mockRejectedValue(originalError);

      await expect(adapter.setLocalStorage('testKey', 'value')).rejects.toThrow(
        "Failed to set local storage key 'testKey': Disk full"
      );
    });

    test('should throw descriptive error when local remove fails', async () => {
      const originalError = new Error('Access denied');
      mockBrowser.storage.local.remove.mockRejectedValue(originalError);

      await expect(adapter.removeLocalStorage('testKey')).rejects.toThrow(
        "Failed to remove local storage key 'testKey': Access denied"
      );
    });
  });

  describe('user settings operations', () => {
    test('should get user settings from sync storage', async () => {
      const expectedSettings = { apiKey: 'test-key', model: 'gemini-pro' };
      mockBrowser.storage.sync.get.mockResolvedValue({ userSettings: expectedSettings });

      const result = await adapter.getUserSettings();

      expect(result).toEqual(expectedSettings);
      expect(mockBrowser.storage.sync.get).toHaveBeenCalledWith('userSettings');
    });

    test('should set user settings to sync storage', async () => {
      const settings = { apiKey: 'new-key', historyLimit: 15 };
      mockBrowser.storage.sync.set.mockResolvedValue();

      await adapter.setUserSettings(settings);

      expect(mockBrowser.storage.sync.set).toHaveBeenCalledWith({ userSettings: settings });
    });

    test('should remove user settings from sync storage', async () => {
      mockBrowser.storage.sync.remove.mockResolvedValue();

      await adapter.removeUserSettings();

      expect(mockBrowser.storage.sync.remove).toHaveBeenCalledWith('userSettings');
    });

    test('should propagate errors from underlying sync operations', async () => {
      const storageError = new Error('Sync disabled');
      mockBrowser.storage.sync.get.mockRejectedValue(storageError);

      await expect(adapter.getUserSettings()).rejects.toThrow(
        "Failed to get sync storage key 'userSettings': Sync disabled"
      );
    });
  });

  describe('instruction history operations', () => {
    test('should get instruction history from local storage', async () => {
      const expectedHistory = [
        { id: 1, content: 'Generate detailed chapters', timestamp: '2025-01-15T10:30:00Z' },
        { id: 2, content: 'Focus on key topics only', timestamp: '2025-01-15T11:00:00Z' }
      ];
      mockBrowser.storage.local.get.mockResolvedValue({ instructionHistory: expectedHistory });

      const result = await adapter.getInstructionHistory();

      expect(result).toEqual(expectedHistory);
      expect(mockBrowser.storage.local.get).toHaveBeenCalledWith('instructionHistory');
    });

    test('should set instruction history to local storage', async () => {
      const history = [
        { id: 1, content: 'Updated instruction', timestamp: '2025-01-15T12:00:00Z' }
      ];
      mockBrowser.storage.local.set.mockResolvedValue();

      await adapter.setInstructionHistory(history);

      expect(mockBrowser.storage.local.set).toHaveBeenCalledWith({ instructionHistory: history });
    });

    test('should propagate errors from underlying local operations', async () => {
      const storageError = new Error('Local storage unavailable');
      mockBrowser.storage.local.get.mockRejectedValue(storageError);

      await expect(adapter.getInstructionHistory()).rejects.toThrow(
        "Failed to get local storage key 'instructionHistory': Local storage unavailable"
      );
    });
  });

  describe('last custom instructions operations', () => {
    test('should get last custom instructions from local storage', async () => {
      const expectedInstructions = 'Generate chapters with timestamps and descriptions';
      mockBrowser.storage.local.get.mockResolvedValue({ lastCustomInstructions: expectedInstructions });

      const result = await adapter.getLastCustomInstructions();

      expect(result).toBe(expectedInstructions);
      expect(mockBrowser.storage.local.get).toHaveBeenCalledWith('lastCustomInstructions');
    });

    test('should set last custom instructions to local storage', async () => {
      const instructions = 'Create chapters with detailed summaries';
      mockBrowser.storage.local.set.mockResolvedValue();

      await adapter.setLastCustomInstructions(instructions);

      expect(mockBrowser.storage.local.set).toHaveBeenCalledWith({ lastCustomInstructions: instructions });
    });

    test('should remove last custom instructions from local storage', async () => {
      mockBrowser.storage.local.remove.mockResolvedValue();

      await adapter.removeLastCustomInstructions();

      expect(mockBrowser.storage.local.remove).toHaveBeenCalledWith('lastCustomInstructions');
    });

    test('should propagate errors from underlying local operations', async () => {
      const storageError = new Error('Storage corrupted');
      mockBrowser.storage.local.set.mockRejectedValue(storageError);

      await expect(adapter.setLastCustomInstructions('test')).rejects.toThrow(
        "Failed to set local storage key 'lastCustomInstructions': Storage corrupted"
      );
    });
  });

  describe('storage type consistency', () => {
    test('should use sync storage for user settings consistently', async () => {
      mockBrowser.storage.sync.get.mockResolvedValue({ userSettings: {} });
      mockBrowser.storage.sync.set.mockResolvedValue();
      mockBrowser.storage.sync.remove.mockResolvedValue();

      await adapter.getUserSettings();
      await adapter.setUserSettings({});
      await adapter.removeUserSettings();

      expect(mockBrowser.storage.sync.get).toHaveBeenCalledTimes(1);
      expect(mockBrowser.storage.sync.set).toHaveBeenCalledTimes(1);
      expect(mockBrowser.storage.sync.remove).toHaveBeenCalledTimes(1);
      expect(mockBrowser.storage.local.get).not.toHaveBeenCalled();
      expect(mockBrowser.storage.local.set).not.toHaveBeenCalled();
      expect(mockBrowser.storage.local.remove).not.toHaveBeenCalled();
    });

    test('should use local storage for instruction history consistently', async () => {
      mockBrowser.storage.local.get.mockResolvedValue({ instructionHistory: [] });
      mockBrowser.storage.local.set.mockResolvedValue();

      await adapter.getInstructionHistory();
      await adapter.setInstructionHistory([]);

      expect(mockBrowser.storage.local.get).toHaveBeenCalledTimes(1);
      expect(mockBrowser.storage.local.set).toHaveBeenCalledTimes(1);
      expect(mockBrowser.storage.sync.get).not.toHaveBeenCalled();
      expect(mockBrowser.storage.sync.set).not.toHaveBeenCalled();
    });

    test('should use local storage for last custom instructions consistently', async () => {
      mockBrowser.storage.local.get.mockResolvedValue({ lastCustomInstructions: 'test' });
      mockBrowser.storage.local.set.mockResolvedValue();
      mockBrowser.storage.local.remove.mockResolvedValue();

      await adapter.getLastCustomInstructions();
      await adapter.setLastCustomInstructions('test');
      await adapter.removeLastCustomInstructions();

      expect(mockBrowser.storage.local.get).toHaveBeenCalledTimes(1);
      expect(mockBrowser.storage.local.set).toHaveBeenCalledTimes(1);
      expect(mockBrowser.storage.local.remove).toHaveBeenCalledTimes(1);
      expect(mockBrowser.storage.sync.get).not.toHaveBeenCalled();
      expect(mockBrowser.storage.sync.set).not.toHaveBeenCalled();
      expect(mockBrowser.storage.sync.remove).not.toHaveBeenCalled();
    });
  });

  describe('error message format consistency', () => {
    test('should provide consistent error message format for all operations', async () => {
      const testError = new Error('Test error');

      mockBrowser.storage.sync.get.mockRejectedValue(testError);
      mockBrowser.storage.sync.set.mockRejectedValue(testError);
      mockBrowser.storage.sync.remove.mockRejectedValue(testError);
      mockBrowser.storage.local.get.mockRejectedValue(testError);
      mockBrowser.storage.local.set.mockRejectedValue(testError);
      mockBrowser.storage.local.remove.mockRejectedValue(testError);

      const operations = [
        () => adapter.getSyncStorage('key'),
        () => adapter.setSyncStorage('key', 'value'),
        () => adapter.removeSyncStorage('key'),
        () => adapter.getLocalStorage('key'),
        () => adapter.setLocalStorage('key', 'value'),
        () => adapter.removeLocalStorage('key')
      ];

      for (const operation of operations) {
        await expect(operation()).rejects.toThrow(/^Failed to (get|set|remove) (sync|local) storage key 'key': Test error$/);
      }
    });
  });

  describe('historyLimit methods', () => {
    test('should get history limit from local storage', async () => {
      const expectedLimit = 15;
      mockBrowser.storage.local.get.mockResolvedValue({ historyLimit: expectedLimit });

      const result = await adapter.getHistoryLimit();

      expect(mockBrowser.storage.local.get).toHaveBeenCalledWith('historyLimit');
      expect(result).toBe(expectedLimit);
    });

    test('should set history limit in local storage', async () => {
      const limit = 20;
      mockBrowser.storage.local.set.mockResolvedValue();

      await adapter.setHistoryLimit(limit);

      expect(mockBrowser.storage.local.set).toHaveBeenCalledWith({ historyLimit: limit });
    });

    test('should remove history limit from local storage', async () => {
      mockBrowser.storage.local.remove.mockResolvedValue();

      await adapter.removeHistoryLimit();

      expect(mockBrowser.storage.local.remove).toHaveBeenCalledWith('historyLimit');
    });

    test('should handle errors in history limit operations', async () => {
      const testError = new Error('Storage error');
      mockBrowser.storage.local.get.mockRejectedValue(testError);
      mockBrowser.storage.local.set.mockRejectedValue(testError);
      mockBrowser.storage.local.remove.mockRejectedValue(testError);

      await expect(adapter.getHistoryLimit()).rejects.toThrow('Failed to get local storage key \'historyLimit\': Storage error');
      await expect(adapter.setHistoryLimit(10)).rejects.toThrow('Failed to set local storage key \'historyLimit\': Storage error');
      await expect(adapter.removeHistoryLimit()).rejects.toThrow('Failed to remove local storage key \'historyLimit\': Storage error');
    });
  });
});
