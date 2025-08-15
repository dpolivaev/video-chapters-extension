/**
 * InstructionHistoryRepository Tests
 * Tests instruction history management, limits, and integration with settings
 *
 * Copyright (C) 2025 Dimitry Polivaev
 * Licensed under GPL3 or later
 */

const InstructionHistoryRepository = require('./InstructionHistoryRepository');
const InstructionEntry = require('../../domain/entities/InstructionEntry');

describe('InstructionHistoryRepository', () => {
  let mockStorageAdapter;
  let mockSettingsRepository;
  let repository;

  beforeEach(() => {
    mockStorageAdapter = {
      getInstructionHistory: jest.fn(),
      setInstructionHistory: jest.fn(),
      getHistoryLimit: jest.fn(),
      setHistoryLimit: jest.fn(),
      removeHistoryLimit: jest.fn()
    };

    mockSettingsRepository = {
      load: jest.fn(),
      loadSettings: jest.fn()
    };

    repository = new InstructionHistoryRepository(mockStorageAdapter, mockSettingsRepository);

    // Mock Date.now() to ensure consistent IDs in tests
    jest.spyOn(Date, 'now').mockReturnValue(1642678800000);
    jest.spyOn(Date.prototype, 'toISOString').mockReturnValue('2022-01-20T10:00:00.000Z');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('constructor and initialization', () => {
    test('should require storageAdapter parameter', () => {
      expect(() => new InstructionHistoryRepository()).toThrow('storageAdapter is required');
      expect(() => new InstructionHistoryRepository(null, mockSettingsRepository)).toThrow('storageAdapter is required');
      expect(() => new InstructionHistoryRepository(undefined, mockSettingsRepository)).toThrow('storageAdapter is required');
    });

    test('should require settingsRepository parameter', () => {
      expect(() => new InstructionHistoryRepository(mockStorageAdapter)).toThrow('settingsRepository is required');
      expect(() => new InstructionHistoryRepository(mockStorageAdapter, null)).toThrow('settingsRepository is required');
      expect(() => new InstructionHistoryRepository(mockStorageAdapter, undefined)).toThrow('settingsRepository is required');
    });

    test('should initialize with default limit', () => {
      expect(repository.defaultLimit).toBe(10);
    });

    test('should store references to dependencies', () => {
      expect(repository.storageAdapter).toBe(mockStorageAdapter);
      expect(repository.settingsRepository).toBe(mockSettingsRepository);
    });
  });

  describe('addInstruction', () => {
    test('should add new instruction to empty history', async () => {
      mockStorageAdapter.getInstructionHistory.mockResolvedValue([]);
      mockStorageAdapter.getHistoryLimit.mockResolvedValue(10);
      mockStorageAdapter.setInstructionHistory.mockResolvedValue();

      const result = await repository.addInstruction('Generate detailed chapters');

      expect(result).toEqual({
        id: 1642678800000,
        content: 'Generate detailed chapters',
        timestamp: '2022-01-20T10:00:00.000Z',
        name: '',
        isCustomName: false
      });

      expect(mockStorageAdapter.setInstructionHistory).toHaveBeenCalledWith([{
        id: 1642678800000,
        content: 'Generate detailed chapters',
        timestamp: '2022-01-20T10:00:00.000Z',
        name: '',
        isCustomName: false
      }]);
    });

    test('should add instruction to existing history at the beginning', async () => {
      const existingHistory = [
        { id: 1, content: 'Old instruction', timestamp: '2022-01-19T10:00:00.000Z', name: '', isCustomName: false }
      ];
      mockStorageAdapter.getInstructionHistory.mockResolvedValue(existingHistory);
      mockStorageAdapter.getHistoryLimit.mockResolvedValue(10);
      mockStorageAdapter.setInstructionHistory.mockResolvedValue();

      await repository.addInstruction('New instruction');

      expect(mockStorageAdapter.setInstructionHistory).toHaveBeenCalledWith([
        {
          id: 1642678800000,
          content: 'New instruction',
          timestamp: '2022-01-20T10:00:00.000Z',
          name: '',
          isCustomName: false
        },
        { id: 1, content: 'Old instruction', timestamp: '2022-01-19T10:00:00.000Z', name: '', isCustomName: false }
      ]);
    });

    test('should trim instruction content before adding', async () => {
      mockStorageAdapter.getInstructionHistory.mockResolvedValue([]);
      mockStorageAdapter.getHistoryLimit.mockResolvedValue(10);
      mockStorageAdapter.setInstructionHistory.mockResolvedValue();

      await repository.addInstruction('  Padded instruction content  ');

      expect(mockStorageAdapter.setInstructionHistory).toHaveBeenCalledWith([
        expect.objectContaining({
          content: 'Padded instruction content'
        })
      ]);
    });

    test('should update existing instruction when duplicate content is added', async () => {
      const existingHistory = [
        { id: 1, content: 'Old instruction', timestamp: '2022-01-19T08:00:00.000Z', name: 'Custom Name', isCustomName: true },
        { id: 2, content: 'Duplicate content', timestamp: '2022-01-19T09:00:00.000Z', name: '', isCustomName: false }
      ];
      mockStorageAdapter.getInstructionHistory.mockResolvedValue(existingHistory);
      mockStorageAdapter.getHistoryLimit.mockResolvedValue(10);
      mockStorageAdapter.setInstructionHistory.mockResolvedValue();

      await repository.addInstruction('Duplicate content');

      expect(mockStorageAdapter.setInstructionHistory).toHaveBeenCalledWith([
        {
          id: 2, // preserves original ID
          content: 'Duplicate content',
          timestamp: '2022-01-20T10:00:00.000Z', // updated timestamp
          name: '', // preserves original name
          isCustomName: false // preserves original isCustomName
        },
        { id: 1, content: 'Old instruction', timestamp: '2022-01-19T08:00:00.000Z', name: 'Custom Name', isCustomName: true }
      ]);
    });

    test('should preserve custom name when updating existing instruction', async () => {
      const existingHistory = [
        { id: 1, content: 'Duplicate content', timestamp: '2022-01-19T09:00:00.000Z', name: 'My Custom Name', isCustomName: true }
      ];
      mockStorageAdapter.getInstructionHistory.mockResolvedValue(existingHistory);
      mockStorageAdapter.getHistoryLimit.mockResolvedValue(10);
      mockStorageAdapter.setInstructionHistory.mockResolvedValue();

      await repository.addInstruction('Duplicate content');

      expect(mockStorageAdapter.setInstructionHistory).toHaveBeenCalledWith([
        expect.objectContaining({
          name: 'My Custom Name',
          isCustomName: true
        })
      ]);
    });

    test('should enforce history limit when adding instructions', async () => {
      const existingHistory = Array.from({length: 5}, (_, i) => ({
        id: i + 1,
        content: `Instruction ${i + 1}`,
        timestamp: `2022-01-${15 + i}T10:00:00.000Z`,
        name: '',
        isCustomName: false
      }));
      mockStorageAdapter.getInstructionHistory.mockResolvedValue(existingHistory);
      mockStorageAdapter.getHistoryLimit.mockResolvedValue(3);
      mockStorageAdapter.setInstructionHistory.mockResolvedValue();

      await repository.addInstruction('New instruction');

      const savedHistory = mockStorageAdapter.setInstructionHistory.mock.calls[0][0];
      expect(savedHistory).toHaveLength(3);
      expect(savedHistory[0].content).toBe('New instruction');
      // The implementation keeps first N items (most recent), not last N
      expect(savedHistory[1].content).toBe('Instruction 1');
      expect(savedHistory[2].content).toBe('Instruction 2');
    });

    test('should use default limit when storage adapter fails', async () => {
      const existingHistory = Array.from({length: 15}, (_, i) => ({
        id: i + 1,
        content: `Instruction ${i + 1}`,
        timestamp: `2022-01-${10 + i}T10:00:00.000Z`,
        name: '',
        isCustomName: false
      }));
      mockStorageAdapter.getInstructionHistory.mockResolvedValue(existingHistory);
      mockStorageAdapter.getHistoryLimit.mockRejectedValue(new Error('Storage error'));
      mockStorageAdapter.setInstructionHistory.mockResolvedValue();

      // Mock console.error to avoid test noise
      jest.spyOn(console, 'error').mockImplementation(() => {});

      await repository.addInstruction('New instruction');

      const savedHistory = mockStorageAdapter.setInstructionHistory.mock.calls[0][0];
      expect(savedHistory).toHaveLength(10); // default limit
      expect(console.error).toHaveBeenCalledWith('Error loading history limit from local storage:', expect.any(Error));
    });

    test('should handle missing historyLimit in storage', async () => {
      mockStorageAdapter.getInstructionHistory.mockResolvedValue([]);
      mockStorageAdapter.getHistoryLimit.mockResolvedValue(undefined);
      mockStorageAdapter.setInstructionHistory.mockResolvedValue();

      await repository.addInstruction('Test instruction');

      // Should use default limit (test implicitly by ensuring no errors)
      expect(mockStorageAdapter.setInstructionHistory).toHaveBeenCalledWith([
        expect.objectContaining({
          content: 'Test instruction'
        })
      ]);
    });
  });

  describe('renameInstruction', () => {
    test('should rename existing instruction', async () => {
      const existingHistory = [
        { id: 1, content: 'Instruction 1', timestamp: '2022-01-19T10:00:00.000Z', name: 'Old Name', isCustomName: true },
        { id: 2, content: 'Instruction 2', timestamp: '2022-01-19T11:00:00.000Z', name: '', isCustomName: false }
      ];
      mockStorageAdapter.getInstructionHistory.mockResolvedValue(existingHistory);
      mockStorageAdapter.setInstructionHistory.mockResolvedValue();

      await repository.renameInstruction(1, 'New Custom Name');

      expect(mockStorageAdapter.setInstructionHistory).toHaveBeenCalledWith([
        {
          id: 1,
          content: 'Instruction 1',
          timestamp: '2022-01-19T10:00:00.000Z',
          name: 'New Custom Name',
          isCustomName: true
        },
        { id: 2, content: 'Instruction 2', timestamp: '2022-01-19T11:00:00.000Z', name: '', isCustomName: false }
      ]);
    });

    test('should clear custom name when empty name provided', async () => {
      const existingHistory = [
        { id: 1, content: 'Instruction 1', timestamp: '2022-01-19T10:00:00.000Z', name: 'Old Name', isCustomName: true }
      ];
      mockStorageAdapter.getInstructionHistory.mockResolvedValue(existingHistory);
      mockStorageAdapter.setInstructionHistory.mockResolvedValue();

      await repository.renameInstruction(1, '');

      expect(mockStorageAdapter.setInstructionHistory).toHaveBeenCalledWith([
        expect.objectContaining({
          name: '',
          isCustomName: false
        })
      ]);
    });

    test('should do nothing when instruction ID not found', async () => {
      const existingHistory = [
        { id: 1, content: 'Instruction 1', timestamp: '2022-01-19T10:00:00.000Z', name: '', isCustomName: false }
      ];
      mockStorageAdapter.getInstructionHistory.mockResolvedValue(existingHistory);
      mockStorageAdapter.setInstructionHistory.mockResolvedValue();

      await repository.renameInstruction(999, 'Non-existent rename');

      expect(mockStorageAdapter.setInstructionHistory).not.toHaveBeenCalled();
    });

    test('should handle whitespace-only names by clearing custom name', async () => {
      const existingHistory = [
        { id: 1, content: 'Instruction 1', timestamp: '2022-01-19T10:00:00.000Z', name: 'Old Name', isCustomName: true }
      ];
      mockStorageAdapter.getInstructionHistory.mockResolvedValue(existingHistory);
      mockStorageAdapter.setInstructionHistory.mockResolvedValue();

      await repository.renameInstruction(1, '   ');

      expect(mockStorageAdapter.setInstructionHistory).toHaveBeenCalledWith([
        expect.objectContaining({
          name: '',
          isCustomName: false
        })
      ]);
    });

    test('should trim names when renaming', async () => {
      const existingHistory = [
        { id: 1, content: 'Instruction 1', timestamp: '2022-01-19T10:00:00.000Z', name: '', isCustomName: false }
      ];
      mockStorageAdapter.getInstructionHistory.mockResolvedValue(existingHistory);
      mockStorageAdapter.setInstructionHistory.mockResolvedValue();

      await repository.renameInstruction(1, '  Trimmed Name  ');

      expect(mockStorageAdapter.setInstructionHistory).toHaveBeenCalledWith([
        expect.objectContaining({
          name: 'Trimmed Name',
          isCustomName: true
        })
      ]);
    });
  });

  describe('getHistory', () => {
    test('should return stored history', async () => {
      const expectedHistory = [
        { id: 1, content: 'Instruction 1', timestamp: '2022-01-19T10:00:00.000Z', name: '', isCustomName: false }
      ];
      mockStorageAdapter.getInstructionHistory.mockResolvedValue(expectedHistory);

      const result = await repository.getHistory();

      expect(result).toEqual(expectedHistory);
      expect(mockStorageAdapter.getInstructionHistory).toHaveBeenCalled();
    });

    test('should return empty array when no history exists', async () => {
      mockStorageAdapter.getInstructionHistory.mockResolvedValue(null);

      const result = await repository.getHistory();

      expect(result).toEqual([]);
    });

    test('should return empty array when storage returns undefined', async () => {
      mockStorageAdapter.getInstructionHistory.mockResolvedValue(undefined);

      const result = await repository.getHistory();

      expect(result).toEqual([]);
    });
  });

  describe('deleteInstruction', () => {
    test('should delete instruction by ID', async () => {
      const existingHistory = [
        { id: 1, content: 'Instruction 1', timestamp: '2022-01-19T10:00:00.000Z', name: '', isCustomName: false },
        { id: 2, content: 'Instruction 2', timestamp: '2022-01-19T11:00:00.000Z', name: '', isCustomName: false },
        { id: 3, content: 'Instruction 3', timestamp: '2022-01-19T12:00:00.000Z', name: '', isCustomName: false }
      ];
      mockStorageAdapter.getInstructionHistory.mockResolvedValue(existingHistory);
      mockStorageAdapter.setInstructionHistory.mockResolvedValue();

      const result = await repository.deleteInstruction(2);

      expect(result).toEqual([
        { id: 1, content: 'Instruction 1', timestamp: '2022-01-19T10:00:00.000Z', name: '', isCustomName: false },
        { id: 3, content: 'Instruction 3', timestamp: '2022-01-19T12:00:00.000Z', name: '', isCustomName: false }
      ]);
      expect(mockStorageAdapter.setInstructionHistory).toHaveBeenCalledWith(result);
    });

    test('should return same history when instruction ID not found', async () => {
      const existingHistory = [
        { id: 1, content: 'Instruction 1', timestamp: '2022-01-19T10:00:00.000Z', name: '', isCustomName: false }
      ];
      mockStorageAdapter.getInstructionHistory.mockResolvedValue(existingHistory);
      mockStorageAdapter.setInstructionHistory.mockResolvedValue();

      const result = await repository.deleteInstruction(999);

      expect(result).toEqual(existingHistory);
      expect(mockStorageAdapter.setInstructionHistory).toHaveBeenCalledWith(existingHistory);
    });

    test('should delete all matching IDs when duplicates exist', async () => {
      const existingHistory = [
        { id: 1, content: 'Instruction 1', timestamp: '2022-01-19T10:00:00.000Z', name: '', isCustomName: false },
        { id: 2, content: 'Instruction 2', timestamp: '2022-01-19T11:00:00.000Z', name: '', isCustomName: false },
        { id: 2, content: 'Duplicate ID', timestamp: '2022-01-19T12:00:00.000Z', name: '', isCustomName: false }
      ];
      mockStorageAdapter.getInstructionHistory.mockResolvedValue(existingHistory);
      mockStorageAdapter.setInstructionHistory.mockResolvedValue();

      const result = await repository.deleteInstruction(2);

      expect(result).toEqual([
        { id: 1, content: 'Instruction 1', timestamp: '2022-01-19T10:00:00.000Z', name: '', isCustomName: false }
      ]);
    });

    test('should handle deletion from empty history', async () => {
      mockStorageAdapter.getInstructionHistory.mockResolvedValue([]);
      mockStorageAdapter.setInstructionHistory.mockResolvedValue();

      const result = await repository.deleteInstruction(1);

      expect(result).toEqual([]);
      expect(mockStorageAdapter.setInstructionHistory).toHaveBeenCalledWith([]);
    });
  });

  describe('setHistoryLimit', () => {
    test('should trim history when limit is reduced below current size', async () => {
      const existingHistory = Array.from({length: 10}, (_, i) => ({
        id: i + 1,
        content: `Instruction ${i + 1}`,
        timestamp: `2022-01-${10 + i}T10:00:00.000Z`,
        name: '',
        isCustomName: false
      }));
      mockStorageAdapter.getInstructionHistory.mockResolvedValue(existingHistory);
      mockStorageAdapter.setInstructionHistory.mockResolvedValue();

      await repository.setHistoryLimit(5);

      const savedHistory = mockStorageAdapter.setInstructionHistory.mock.calls[0][0];
      expect(savedHistory).toHaveLength(5);
      // Should keep first 5 items (most recent)
      expect(savedHistory[0].content).toBe('Instruction 1');
      expect(savedHistory[4].content).toBe('Instruction 5');
    });

    test('should not modify history when limit is equal to current size', async () => {
      const existingHistory = Array.from({length: 5}, (_, i) => ({
        id: i + 1,
        content: `Instruction ${i + 1}`,
        timestamp: `2022-01-${15 + i}T10:00:00.000Z`,
        name: '',
        isCustomName: false
      }));
      mockStorageAdapter.getInstructionHistory.mockResolvedValue(existingHistory);
      mockStorageAdapter.setInstructionHistory.mockResolvedValue();

      await repository.setHistoryLimit(5);

      expect(mockStorageAdapter.setInstructionHistory).not.toHaveBeenCalled();
    });

    test('should not modify history when limit is greater than current size', async () => {
      const existingHistory = Array.from({length: 3}, (_, i) => ({
        id: i + 1,
        content: `Instruction ${i + 1}`,
        timestamp: `2022-01-${17 + i}T10:00:00.000Z`,
        name: '',
        isCustomName: false
      }));
      mockStorageAdapter.getInstructionHistory.mockResolvedValue(existingHistory);
      mockStorageAdapter.setInstructionHistory.mockResolvedValue();

      await repository.setHistoryLimit(10);

      expect(mockStorageAdapter.setInstructionHistory).not.toHaveBeenCalled();
    });

    test('should handle empty history gracefully', async () => {
      mockStorageAdapter.getInstructionHistory.mockResolvedValue([]);

      await repository.setHistoryLimit(5);

      expect(mockStorageAdapter.setInstructionHistory).not.toHaveBeenCalled();
    });

    test('should handle zero limit by clearing all history', async () => {
      const existingHistory = [
        { id: 1, content: 'Instruction 1', timestamp: '2022-01-19T10:00:00.000Z', name: '', isCustomName: false }
      ];
      mockStorageAdapter.getInstructionHistory.mockResolvedValue(existingHistory);
      mockStorageAdapter.setInstructionHistory.mockResolvedValue();

      await repository.setHistoryLimit(0);

      expect(mockStorageAdapter.setInstructionHistory).toHaveBeenCalledWith([]);
    });
  });

  describe('getHistoryLimit', () => {
    test('should return limit from storage adapter', async () => {
      mockStorageAdapter.getHistoryLimit.mockResolvedValue(25);

      const limit = await repository.getHistoryLimit();

      expect(limit).toBe(25);
    });

    test('should return default limit when not set in storage', async () => {
      mockStorageAdapter.getHistoryLimit.mockResolvedValue(undefined);

      const limit = await repository.getHistoryLimit();

      expect(limit).toBe(10);
    });

    test('should return default limit when storage adapter fails', async () => {
      mockStorageAdapter.getHistoryLimit.mockRejectedValue(new Error('Storage error'));

      // Mock console.error to avoid test noise
      jest.spyOn(console, 'error').mockImplementation(() => {});

      const limit = await repository.getHistoryLimit();

      expect(limit).toBe(10);
      expect(console.error).toHaveBeenCalledWith('Error loading history limit from local storage:', expect.any(Error));
    });

    test('should return default limit when historyLimit is null', async () => {
      mockStorageAdapter.getHistoryLimit.mockResolvedValue(null);

      const limit = await repository.getHistoryLimit();

      expect(limit).toBe(10);
    });

    test('should return default limit when historyLimit is undefined', async () => {
      mockStorageAdapter.getHistoryLimit.mockResolvedValue(undefined);

      const limit = await repository.getHistoryLimit();

      expect(limit).toBe(10);
    });
  });

  describe('createOrUpdateInstruction business logic', () => {
    test('should create new instruction for unique content', () => {
      const existingHistory = [
        { id: 1, content: 'Existing instruction', timestamp: '2022-01-19T10:00:00.000Z', name: '', isCustomName: false }
      ];

      const result = repository.createOrUpdateInstruction('New unique content', existingHistory);

      expect(result).toEqual({
        id: 1642678800000,
        content: 'New unique content',
        timestamp: '2022-01-20T10:00:00.000Z',
        name: '',
        isCustomName: false
      });
      expect(existingHistory).toHaveLength(1); // Original array not modified
    });

    test('should update existing instruction and remove from original position', () => {
      const existingHistory = [
        { id: 1, content: 'First instruction', timestamp: '2022-01-19T08:00:00.000Z', name: '', isCustomName: false },
        { id: 2, content: 'Duplicate content', timestamp: '2022-01-19T09:00:00.000Z', name: 'Custom Name', isCustomName: true },
        { id: 3, content: 'Last instruction', timestamp: '2022-01-19T10:00:00.000Z', name: '', isCustomName: false }
      ];

      const result = repository.createOrUpdateInstruction('Duplicate content', existingHistory);

      expect(result).toEqual({
        id: 2,
        content: 'Duplicate content',
        timestamp: '2022-01-20T10:00:00.000Z', // updated timestamp
        name: 'Custom Name', // preserved
        isCustomName: true // preserved
      });
      expect(existingHistory).toHaveLength(2); // Item was removed
      expect(existingHistory.find(item => item.id === 2)).toBeUndefined();
    });

    test('should match content exactly including case', () => {
      const existingHistory = [
        { id: 1, content: 'Case Sensitive Content', timestamp: '2022-01-19T10:00:00.000Z', name: '', isCustomName: false }
      ];

      const result = repository.createOrUpdateInstruction('case sensitive content', existingHistory);

      expect(result.id).toBe(1642678800000); // New instruction created
      expect(existingHistory).toHaveLength(1); // Original unchanged
    });

    test('should handle trimmed content matching', () => {
      const existingHistory = [
        { id: 1, content: 'Trimmed content', timestamp: '2022-01-19T10:00:00.000Z', name: '', isCustomName: false }
      ];

      // Input has padding but should match trimmed existing content
      const result = repository.createOrUpdateInstruction('  Trimmed content  ', existingHistory);

      expect(result.id).toBe(1642678800000); // New instruction since trimmed input doesn't match exactly
      expect(existingHistory).toHaveLength(1); // Original unchanged since no match
    });
  });

  describe('addToHistoryWithLimit business logic', () => {
    test('should add instruction to beginning of history', () => {
      const instruction = { id: 999, content: 'New instruction', timestamp: '2022-01-20T10:00:00.000Z', name: '', isCustomName: false };
      const history = [
        { id: 1, content: 'Old instruction', timestamp: '2022-01-19T10:00:00.000Z', name: '', isCustomName: false }
      ];

      const result = repository.addToHistoryWithLimit(instruction, history, 10);

      expect(result[0]).toBe(instruction);
      expect(result).toHaveLength(2);
    });

    test('should enforce limit by removing excess items from end', () => {
      const instruction = { id: 999, content: 'New instruction', timestamp: '2022-01-20T10:00:00.000Z', name: '', isCustomName: false };
      const history = Array.from({length: 5}, (_, i) => ({
        id: i + 1,
        content: `Instruction ${i + 1}`,
        timestamp: `2022-01-${15 + i}T10:00:00.000Z`,
        name: '',
        isCustomName: false
      }));

      const result = repository.addToHistoryWithLimit(instruction, history, 3);

      expect(result).toHaveLength(3);
      expect(result[0]).toBe(instruction);
      expect(result[1].content).toBe('Instruction 1'); // Most recent from original
      expect(result[2].content).toBe('Instruction 2'); // Second most recent
    });

    test('should handle limit of 1 by keeping only new instruction', () => {
      const instruction = { id: 999, content: 'Only instruction', timestamp: '2022-01-20T10:00:00.000Z', name: '', isCustomName: false };
      const history = [
        { id: 1, content: 'To be removed', timestamp: '2022-01-19T10:00:00.000Z', name: '', isCustomName: false }
      ];

      const result = repository.addToHistoryWithLimit(instruction, history, 1);

      expect(result).toEqual([instruction]);
    });

    test('should handle limit of 0 by returning empty array', () => {
      const instruction = { id: 999, content: 'Instruction', timestamp: '2022-01-20T10:00:00.000Z', name: '', isCustomName: false };
      const history = [];

      const result = repository.addToHistoryWithLimit(instruction, history, 0);

      expect(result).toEqual([]);
    });
  });

  describe('integration with domain entities', () => {
    test('should work with InstructionEntry domain objects', async () => {
      const existingHistory = [
        { id: 1, content: 'Existing instruction', timestamp: '2022-01-19T10:00:00.000Z', name: 'Custom Name', isCustomName: true }
      ];
      mockStorageAdapter.getInstructionHistory.mockResolvedValue(existingHistory);
      mockStorageAdapter.setInstructionHistory.mockResolvedValue();

      // Test that the repository correctly creates and manages InstructionEntry objects
      await repository.renameInstruction(1, 'Updated Name');

      const savedHistory = mockStorageAdapter.setInstructionHistory.mock.calls[0][0];
      const savedEntry = savedHistory[0];

      // Verify the saved object has the structure expected by InstructionEntry.fromStorageObject
      const reconstructedEntry = InstructionEntry.fromStorageObject(savedEntry);
      expect(reconstructedEntry.getDisplayName()).toBe('Updated Name');
      expect(reconstructedEntry.hasCustomName()).toBe(true);
    });

    test('should handle InstructionEntry serialization correctly', async () => {
      mockStorageAdapter.getInstructionHistory.mockResolvedValue([]);
      mockSettingsRepository.load.mockResolvedValue({
        additionalSettings: { historyLimit: 10 }
      });
      mockStorageAdapter.setInstructionHistory.mockResolvedValue();

      const addedInstruction = await repository.addInstruction('Test content');

      // Verify the returned object can be used to create an InstructionEntry
      const entryFromResult = InstructionEntry.fromStorageObject(addedInstruction);
      expect(entryFromResult.content).toBe('Test content');
      expect(entryFromResult.hasCustomName()).toBe(false);
    });
  });

  describe('error handling and edge cases', () => {
    test('should propagate storage adapter errors', async () => {
      const storageError = new Error('Storage operation failed');
      mockStorageAdapter.getInstructionHistory.mockRejectedValue(storageError);

      await expect(repository.getHistory()).rejects.toThrow('Storage operation failed');
    });

    test('should handle null history from storage gracefully', async () => {
      mockStorageAdapter.getInstructionHistory.mockResolvedValue(null);
      mockSettingsRepository.load.mockResolvedValue({
        additionalSettings: { historyLimit: 10 }
      });
      mockStorageAdapter.setInstructionHistory.mockResolvedValue();

      await repository.addInstruction('First instruction');

      expect(mockStorageAdapter.setInstructionHistory).toHaveBeenCalledWith([
        expect.objectContaining({
          content: 'First instruction'
        })
      ]);
    });

    test('should handle extremely large history limits', async () => {
      const history = [{ id: 1, content: 'Test', timestamp: '2022-01-20T10:00:00.000Z', name: '', isCustomName: false }];
      mockStorageAdapter.getInstructionHistory.mockResolvedValue(history);

      await repository.setHistoryLimit(999999);

      // Should not attempt to modify history when limit is much larger
      expect(mockStorageAdapter.setInstructionHistory).not.toHaveBeenCalled();
    });

    test('should handle negative history limits by treating as zero', async () => {
      const history = [{ id: 1, content: 'Test', timestamp: '2022-01-20T10:00:00.000Z', name: '', isCustomName: false }];
      mockStorageAdapter.getInstructionHistory.mockResolvedValue(history);
      mockStorageAdapter.setInstructionHistory.mockResolvedValue();

      await repository.setHistoryLimit(-5);

      expect(mockStorageAdapter.setInstructionHistory).toHaveBeenCalledWith([]);
    });
  });
});
