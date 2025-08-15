/**
 * Background Service Message Handlers Tests
 * Tests message handling for instruction history and settings management
 *
 * Copyright (C) 2025 Dimitry Polivaev
 * Licensed under GPL3 or later
 */

describe('Background Service Message Handlers', () => {
  let mockStorageAdapter;
  let mockSettingsRepository;
  let mockInstructionHistoryRepository;
  let backgroundService;

  // Mock the background service class structure
  class MockBackgroundService {
    constructor() {
      this.storageAdapter = mockStorageAdapter;
      this.settingsRepository = mockSettingsRepository;
      this.instructionHistoryRepository = mockInstructionHistoryRepository;
    }

    async handleSaveInstruction(request, sendResponse) {
      try {
        const { content } = request;
        await this.instructionHistoryRepository.addInstruction(content);
        sendResponse({ success: true });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    }

    async handleGetInstructionHistory(request, sendResponse) {
      try {
        const history = await this.instructionHistoryRepository.getHistory();
        const settings = await this.settingsRepository.loadSettings();
        sendResponse({
          success: true,
          data: {
            history,
            limit: settings.historyLimit || 10
          }
        });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    }

    async handleDeleteInstruction(request, sendResponse) {
      try {
        const { id } = request;
        await this.instructionHistoryRepository.deleteInstruction(id);
        sendResponse({ success: true });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    }

    async handleRenameInstruction(request, sendResponse) {
      try {
        const { id, name } = request;
        this.validateRenameParameters(id, name);
        await this.instructionHistoryRepository.renameInstruction(id, name);
        sendResponse({ success: true });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    }

    async handleSaveSettings(request, sendResponse) {
      try {
        const { settings } = request;
        await this.settingsRepository.saveSettings(settings);
        sendResponse({ success: true });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    }

    async handleLoadSettings(_request, sendResponse) {
      try {
        const settings = await this.settingsRepository.loadSettings();
        sendResponse({ success: true, data: settings });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    }

    validateRenameParameters(id, name) {
      if (id === undefined || id === null) {
        throw new Error('Instruction ID is required');
      }
      if (name === undefined || name === null) {
        throw new Error('Instruction name is required');
      }
    }
  }

  beforeEach(() => {
    mockStorageAdapter = {
      getInstructionHistory: jest.fn(),
      setInstructionHistory: jest.fn(),
      getUserSettings: jest.fn(),
      setUserSettings: jest.fn()
    };

    mockSettingsRepository = {
      saveSettings: jest.fn(),
      loadSettings: jest.fn()
    };

    mockInstructionHistoryRepository = {
      addInstruction: jest.fn(),
      getHistory: jest.fn(),
      deleteInstruction: jest.fn(),
      renameInstruction: jest.fn()
    };

    backgroundService = new MockBackgroundService();
  });

  describe('handleSaveInstruction', () => {
    test('should save instruction and respond with success', async () => {
      const request = { content: 'Generate detailed chapters' };
      const sendResponse = jest.fn();

      const mockInstructionEntry = {
        id: 1642678800000,
        content: 'Generate detailed chapters',
        timestamp: '2022-01-20T10:00:00.000Z',
        name: '',
        isCustomName: false
      };

      mockInstructionHistoryRepository.addInstruction.mockResolvedValue(mockInstructionEntry);

      await backgroundService.handleSaveInstruction(request, sendResponse);

      expect(mockInstructionHistoryRepository.addInstruction).toHaveBeenCalledWith('Generate detailed chapters');
      expect(sendResponse).toHaveBeenCalledWith({ success: true });
    });

    test('should handle instruction save failure and respond with error', async () => {
      const request = { content: 'Test instruction' };
      const sendResponse = jest.fn();
      const saveError = new Error('Storage limit exceeded');

      mockInstructionHistoryRepository.addInstruction.mockRejectedValue(saveError);

      await backgroundService.handleSaveInstruction(request, sendResponse);

      expect(sendResponse).toHaveBeenCalledWith({
        success: false,
        error: 'Storage limit exceeded'
      });
    });

    test('should handle empty content gracefully', async () => {
      const request = { content: '' };
      const sendResponse = jest.fn();

      mockInstructionHistoryRepository.addInstruction.mockResolvedValue({
        id: 123, content: '', timestamp: '2022-01-20T10:00:00.000Z', name: '', isCustomName: false
      });

      await backgroundService.handleSaveInstruction(request, sendResponse);

      expect(mockInstructionHistoryRepository.addInstruction).toHaveBeenCalledWith('');
      expect(sendResponse).toHaveBeenCalledWith({ success: true });
    });

    test('should handle missing content property', async () => {
      const request = {}; // Missing content
      const sendResponse = jest.fn();

      mockInstructionHistoryRepository.addInstruction.mockResolvedValue({});

      await backgroundService.handleSaveInstruction(request, sendResponse);

      expect(mockInstructionHistoryRepository.addInstruction).toHaveBeenCalledWith(undefined);
    });
  });

  describe('handleGetInstructionHistory', () => {
    test('should return history with limit from settings', async () => {
      const request = {};
      const sendResponse = jest.fn();

      const mockHistory = [
        { id: 1, content: 'First instruction', timestamp: '2022-01-20T10:00:00.000Z', name: '', isCustomName: false },
        { id: 2, content: 'Second instruction', timestamp: '2022-01-20T09:00:00.000Z', name: 'Custom', isCustomName: true }
      ];

      const mockSettings = { historyLimit: 15, theme: 'dark' };

      mockInstructionHistoryRepository.getHistory.mockResolvedValue(mockHistory);
      mockSettingsRepository.loadSettings.mockResolvedValue(mockSettings);

      await backgroundService.handleGetInstructionHistory(request, sendResponse);

      expect(mockInstructionHistoryRepository.getHistory).toHaveBeenCalled();
      expect(mockSettingsRepository.loadSettings).toHaveBeenCalled();
      expect(sendResponse).toHaveBeenCalledWith({
        success: true,
        data: {
          history: mockHistory,
          limit: 15
        }
      });
    });

    test('should use default limit when settings limit is missing', async () => {
      const request = {};
      const sendResponse = jest.fn();

      const mockHistory = [];
      const mockSettings = { theme: 'light' }; // No historyLimit

      mockInstructionHistoryRepository.getHistory.mockResolvedValue(mockHistory);
      mockSettingsRepository.loadSettings.mockResolvedValue(mockSettings);

      await backgroundService.handleGetInstructionHistory(request, sendResponse);

      expect(sendResponse).toHaveBeenCalledWith({
        success: true,
        data: {
          history: mockHistory,
          limit: 10 // default
        }
      });
    });

    test('should handle history repository failure', async () => {
      const request = {};
      const sendResponse = jest.fn();

      const historyError = new Error('History retrieval failed');
      mockInstructionHistoryRepository.getHistory.mockRejectedValue(historyError);

      await backgroundService.handleGetInstructionHistory(request, sendResponse);

      expect(sendResponse).toHaveBeenCalledWith({
        success: false,
        error: 'History retrieval failed'
      });
    });

    test('should handle settings repository failure', async () => {
      const request = {};
      const sendResponse = jest.fn();

      mockInstructionHistoryRepository.getHistory.mockResolvedValue([]);
      const settingsError = new Error('Settings load failed');
      mockSettingsRepository.loadSettings.mockRejectedValue(settingsError);

      await backgroundService.handleGetInstructionHistory(request, sendResponse);

      expect(sendResponse).toHaveBeenCalledWith({
        success: false,
        error: 'Settings load failed'
      });
    });

    test('should return empty history and default limit when both operations succeed with empty data', async () => {
      const request = {};
      const sendResponse = jest.fn();

      mockInstructionHistoryRepository.getHistory.mockResolvedValue([]);
      mockSettingsRepository.loadSettings.mockResolvedValue({});

      await backgroundService.handleGetInstructionHistory(request, sendResponse);

      expect(sendResponse).toHaveBeenCalledWith({
        success: true,
        data: {
          history: [],
          limit: 10
        }
      });
    });
  });

  describe('handleDeleteInstruction', () => {
    test('should delete instruction and respond with success', async () => {
      const request = { id: 123 };
      const sendResponse = jest.fn();

      const updatedHistory = [
        { id: 456, content: 'Remaining instruction', timestamp: '2022-01-20T10:00:00.000Z', name: '', isCustomName: false }
      ];

      mockInstructionHistoryRepository.deleteInstruction.mockResolvedValue(updatedHistory);

      await backgroundService.handleDeleteInstruction(request, sendResponse);

      expect(mockInstructionHistoryRepository.deleteInstruction).toHaveBeenCalledWith(123);
      expect(sendResponse).toHaveBeenCalledWith({ success: true });
    });

    test('should handle deletion failure and respond with error', async () => {
      const request = { id: 999 };
      const sendResponse = jest.fn();

      const deleteError = new Error('Instruction not found');
      mockInstructionHistoryRepository.deleteInstruction.mockRejectedValue(deleteError);

      await backgroundService.handleDeleteInstruction(request, sendResponse);

      expect(sendResponse).toHaveBeenCalledWith({
        success: false,
        error: 'Instruction not found'
      });
    });

    test('should handle missing ID parameter', async () => {
      const request = {}; // Missing id
      const sendResponse = jest.fn();

      mockInstructionHistoryRepository.deleteInstruction.mockResolvedValue([]);

      await backgroundService.handleDeleteInstruction(request, sendResponse);

      expect(mockInstructionHistoryRepository.deleteInstruction).toHaveBeenCalledWith(undefined);
      expect(sendResponse).toHaveBeenCalledWith({ success: true });
    });

    test('should handle string ID parameter', async () => {
      const request = { id: '789' };
      const sendResponse = jest.fn();

      mockInstructionHistoryRepository.deleteInstruction.mockResolvedValue([]);

      await backgroundService.handleDeleteInstruction(request, sendResponse);

      expect(mockInstructionHistoryRepository.deleteInstruction).toHaveBeenCalledWith('789');
      expect(sendResponse).toHaveBeenCalledWith({ success: true });
    });
  });

  describe('handleRenameInstruction', () => {
    test('should rename instruction and respond with success', async () => {
      const request = { id: 456, name: 'New Custom Name' };
      const sendResponse = jest.fn();

      mockInstructionHistoryRepository.renameInstruction.mockResolvedValue();

      await backgroundService.handleRenameInstruction(request, sendResponse);

      expect(mockInstructionHistoryRepository.renameInstruction).toHaveBeenCalledWith(456, 'New Custom Name');
      expect(sendResponse).toHaveBeenCalledWith({ success: true });
    });

    test('should clear custom name when empty name provided', async () => {
      const request = { id: 789, name: '' };
      const sendResponse = jest.fn();

      mockInstructionHistoryRepository.renameInstruction.mockResolvedValue();

      await backgroundService.handleRenameInstruction(request, sendResponse);

      expect(mockInstructionHistoryRepository.renameInstruction).toHaveBeenCalledWith(789, '');
      expect(sendResponse).toHaveBeenCalledWith({ success: true });
    });

    test('should validate required parameters', async () => {
      const sendResponse = jest.fn();

      // Missing ID
      await backgroundService.handleRenameInstruction({ name: 'Test Name' }, sendResponse);
      expect(sendResponse).toHaveBeenCalledWith({
        success: false,
        error: 'Instruction ID is required'
      });

      sendResponse.mockClear();

      // Missing name
      await backgroundService.handleRenameInstruction({ id: 123 }, sendResponse);
      expect(sendResponse).toHaveBeenCalledWith({
        success: false,
        error: 'Instruction name is required'
      });

      sendResponse.mockClear();

      // Null ID
      await backgroundService.handleRenameInstruction({ id: null, name: 'Test' }, sendResponse);
      expect(sendResponse).toHaveBeenCalledWith({
        success: false,
        error: 'Instruction ID is required'
      });

      sendResponse.mockClear();

      // Null name
      await backgroundService.handleRenameInstruction({ id: 123, name: null }, sendResponse);
      expect(sendResponse).toHaveBeenCalledWith({
        success: false,
        error: 'Instruction name is required'
      });
    });

    test('should handle rename operation failure', async () => {
      const request = { id: 999, name: 'Test Name' };
      const sendResponse = jest.fn();

      const renameError = new Error('Instruction not found for rename');
      mockInstructionHistoryRepository.renameInstruction.mockRejectedValue(renameError);

      await backgroundService.handleRenameInstruction(request, sendResponse);

      expect(sendResponse).toHaveBeenCalledWith({
        success: false,
        error: 'Instruction not found for rename'
      });
    });

    test('should handle whitespace-only names', async () => {
      const request = { id: 555, name: '   ' };
      const sendResponse = jest.fn();

      mockInstructionHistoryRepository.renameInstruction.mockResolvedValue();

      await backgroundService.handleRenameInstruction(request, sendResponse);

      expect(mockInstructionHistoryRepository.renameInstruction).toHaveBeenCalledWith(555, '   ');
      expect(sendResponse).toHaveBeenCalledWith({ success: true });
    });
  });

  describe('handleSaveSettings', () => {
    test('should save settings and respond with success', async () => {
      const request = {
        settings: {
          apiKey: 'new-api-key',
          historyLimit: 20,
          theme: 'dark'
        }
      };
      const sendResponse = jest.fn();

      mockSettingsRepository.saveSettings.mockResolvedValue({
        apiKey: 'new-api-key',
        historyLimit: 20,
        theme: 'dark',
        model: 'default-model'
      });

      await backgroundService.handleSaveSettings(request, sendResponse);

      expect(mockSettingsRepository.saveSettings).toHaveBeenCalledWith({
        apiKey: 'new-api-key',
        historyLimit: 20,
        theme: 'dark'
      });
      expect(sendResponse).toHaveBeenCalledWith({ success: true });
    });

    test('should handle settings save failure', async () => {
      const request = { settings: { apiKey: 'test-key' } };
      const sendResponse = jest.fn();

      const saveError = new Error('Settings validation failed');
      mockSettingsRepository.saveSettings.mockRejectedValue(saveError);

      await backgroundService.handleSaveSettings(request, sendResponse);

      expect(sendResponse).toHaveBeenCalledWith({
        success: false,
        error: 'Settings validation failed'
      });
    });

    test('should handle missing settings object', async () => {
      const request = {}; // Missing settings
      const sendResponse = jest.fn();

      mockSettingsRepository.saveSettings.mockResolvedValue({});

      await backgroundService.handleSaveSettings(request, sendResponse);

      expect(mockSettingsRepository.saveSettings).toHaveBeenCalledWith(undefined);
      expect(sendResponse).toHaveBeenCalledWith({ success: true });
    });

    test('should handle empty settings object', async () => {
      const request = { settings: {} };
      const sendResponse = jest.fn();

      mockSettingsRepository.saveSettings.mockResolvedValue({});

      await backgroundService.handleSaveSettings(request, sendResponse);

      expect(mockSettingsRepository.saveSettings).toHaveBeenCalledWith({});
      expect(sendResponse).toHaveBeenCalledWith({ success: true });
    });
  });

  describe('handleLoadSettings', () => {
    test('should load settings and respond with success', async () => {
      const request = {};
      const sendResponse = jest.fn();

      const mockSettings = {
        apiKey: 'loaded-api-key',
        openRouterApiKey: 'loaded-openrouter-key',
        model: 'loaded-model',
        historyLimit: 25,
        autoSaveInstructions: false,
        theme: 'system',
        uiLanguage: 'en'
      };

      mockSettingsRepository.loadSettings.mockResolvedValue(mockSettings);

      await backgroundService.handleLoadSettings(request, sendResponse);

      expect(mockSettingsRepository.loadSettings).toHaveBeenCalled();
      expect(sendResponse).toHaveBeenCalledWith({
        success: true,
        data: mockSettings
      });
    });

    test('should handle settings load failure', async () => {
      const request = {};
      const sendResponse = jest.fn();

      const loadError = new Error('Settings storage corrupted');
      mockSettingsRepository.loadSettings.mockRejectedValue(loadError);

      await backgroundService.handleLoadSettings(request, sendResponse);

      expect(sendResponse).toHaveBeenCalledWith({
        success: false,
        error: 'Settings storage corrupted'
      });
    });

    test('should load default settings when none exist', async () => {
      const request = {};
      const sendResponse = jest.fn();

      const defaultSettings = {
        apiKey: '',
        openRouterApiKey: '',
        model: 'deepseek/deepseek-r1-0528:free',
        historyLimit: 10,
        autoSaveInstructions: true,
        theme: 'auto',
        uiLanguage: ''
      };

      mockSettingsRepository.loadSettings.mockResolvedValue(defaultSettings);

      await backgroundService.handleLoadSettings(request, sendResponse);

      expect(sendResponse).toHaveBeenCalledWith({
        success: true,
        data: defaultSettings
      });
    });

    test('should ignore request parameters since load does not need them', async () => {
      const request = { unnecessaryParam: 'ignored' };
      const sendResponse = jest.fn();

      const mockSettings = { apiKey: 'test' };
      mockSettingsRepository.loadSettings.mockResolvedValue(mockSettings);

      await backgroundService.handleLoadSettings(request, sendResponse);

      expect(mockSettingsRepository.loadSettings).toHaveBeenCalled();
      expect(sendResponse).toHaveBeenCalledWith({
        success: true,
        data: mockSettings
      });
    });
  });

  describe('parameter validation', () => {
    test('should validate rename parameters correctly', () => {
      // Valid parameters
      expect(() => backgroundService.validateRenameParameters(123, 'Valid Name')).not.toThrow();
      expect(() => backgroundService.validateRenameParameters('string-id', '')).not.toThrow();
      expect(() => backgroundService.validateRenameParameters(0, 'Zero ID')).not.toThrow();

      // Invalid ID parameters
      expect(() => backgroundService.validateRenameParameters(undefined, 'Name')).toThrow('Instruction ID is required');
      expect(() => backgroundService.validateRenameParameters(null, 'Name')).toThrow('Instruction ID is required');

      // Invalid name parameters
      expect(() => backgroundService.validateRenameParameters(123, undefined)).toThrow('Instruction name is required');
      expect(() => backgroundService.validateRenameParameters(123, null)).toThrow('Instruction name is required');

      // Both invalid
      expect(() => backgroundService.validateRenameParameters(null, null)).toThrow('Instruction ID is required');
    });
  });

  describe('error message consistency', () => {
    test('should provide consistent error message format across handlers', async () => {
      const sendResponse = jest.fn();
      const testError = new Error('Test error message');

      // Test each handler for consistent error response format
      mockInstructionHistoryRepository.addInstruction.mockRejectedValue(testError);
      await backgroundService.handleSaveInstruction({ content: 'test' }, sendResponse);
      expect(sendResponse).toHaveBeenCalledWith({
        success: false,
        error: 'Test error message'
      });

      sendResponse.mockClear();
      mockInstructionHistoryRepository.getHistory.mockRejectedValue(testError);
      await backgroundService.handleGetInstructionHistory({}, sendResponse);
      expect(sendResponse).toHaveBeenCalledWith({
        success: false,
        error: 'Test error message'
      });

      sendResponse.mockClear();
      mockInstructionHistoryRepository.deleteInstruction.mockRejectedValue(testError);
      await backgroundService.handleDeleteInstruction({ id: 1 }, sendResponse);
      expect(sendResponse).toHaveBeenCalledWith({
        success: false,
        error: 'Test error message'
      });

      sendResponse.mockClear();
      mockSettingsRepository.saveSettings.mockRejectedValue(testError);
      await backgroundService.handleSaveSettings({ settings: {} }, sendResponse);
      expect(sendResponse).toHaveBeenCalledWith({
        success: false,
        error: 'Test error message'
      });

      sendResponse.mockClear();
      mockSettingsRepository.loadSettings.mockRejectedValue(testError);
      await backgroundService.handleLoadSettings({}, sendResponse);
      expect(sendResponse).toHaveBeenCalledWith({
        success: false,
        error: 'Test error message'
      });
    });

    test('should provide consistent success response format across handlers', async () => {
      const sendResponse = jest.fn();

      // Test success responses
      mockInstructionHistoryRepository.addInstruction.mockResolvedValue({});
      await backgroundService.handleSaveInstruction({ content: 'test' }, sendResponse);
      expect(sendResponse).toHaveBeenCalledWith({ success: true });

      sendResponse.mockClear();
      mockInstructionHistoryRepository.deleteInstruction.mockResolvedValue([]);
      await backgroundService.handleDeleteInstruction({ id: 1 }, sendResponse);
      expect(sendResponse).toHaveBeenCalledWith({ success: true });

      sendResponse.mockClear();
      mockInstructionHistoryRepository.renameInstruction.mockResolvedValue();
      await backgroundService.handleRenameInstruction({ id: 1, name: 'test' }, sendResponse);
      expect(sendResponse).toHaveBeenCalledWith({ success: true });

      sendResponse.mockClear();
      mockSettingsRepository.saveSettings.mockResolvedValue({});
      await backgroundService.handleSaveSettings({ settings: {} }, sendResponse);
      expect(sendResponse).toHaveBeenCalledWith({ success: true });
    });
  });

  describe('integration scenarios', () => {
    test('should handle complete instruction management workflow', async () => {
      const sendResponse = jest.fn();

      // Step 1: Save instruction
      mockInstructionHistoryRepository.addInstruction.mockResolvedValue({
        id: 1, content: 'Test instruction', timestamp: '2022-01-20T10:00:00.000Z', name: '', isCustomName: false
      });
      await backgroundService.handleSaveInstruction({ content: 'Test instruction' }, sendResponse);
      expect(sendResponse).toHaveBeenCalledWith({ success: true });

      sendResponse.mockClear();

      // Step 2: Rename instruction
      mockInstructionHistoryRepository.renameInstruction.mockResolvedValue();
      await backgroundService.handleRenameInstruction({ id: 1, name: 'Custom Name' }, sendResponse);
      expect(sendResponse).toHaveBeenCalledWith({ success: true });

      sendResponse.mockClear();

      // Step 3: Get history
      const updatedHistory = [
        { id: 1, content: 'Test instruction', timestamp: '2022-01-20T10:00:00.000Z', name: 'Custom Name', isCustomName: true }
      ];
      mockInstructionHistoryRepository.getHistory.mockResolvedValue(updatedHistory);
      mockSettingsRepository.loadSettings.mockResolvedValue({ historyLimit: 10 });

      await backgroundService.handleGetInstructionHistory({}, sendResponse);
      expect(sendResponse).toHaveBeenCalledWith({
        success: true,
        data: { history: updatedHistory, limit: 10 }
      });

      sendResponse.mockClear();

      // Step 4: Delete instruction
      mockInstructionHistoryRepository.deleteInstruction.mockResolvedValue([]);
      await backgroundService.handleDeleteInstruction({ id: 1 }, sendResponse);
      expect(sendResponse).toHaveBeenCalledWith({ success: true });
    });

    test('should handle settings and instruction history coordination', async () => {
      const sendResponse = jest.fn();

      // Step 1: Update settings with new history limit
      mockSettingsRepository.saveSettings.mockResolvedValue({
        historyLimit: 5,
        apiKey: 'test-key'
      });
      await backgroundService.handleSaveSettings({
        settings: { historyLimit: 5, apiKey: 'test-key' }
      }, sendResponse);
      expect(sendResponse).toHaveBeenCalledWith({ success: true });

      sendResponse.mockClear();

      // Step 2: Get instruction history which should reflect new limit
      mockInstructionHistoryRepository.getHistory.mockResolvedValue([]);
      mockSettingsRepository.loadSettings.mockResolvedValue({
        historyLimit: 5,
        apiKey: 'test-key'
      });

      await backgroundService.handleGetInstructionHistory({}, sendResponse);
      expect(sendResponse).toHaveBeenCalledWith({
        success: true,
        data: { history: [], limit: 5 }
      });
    });
  });
});
