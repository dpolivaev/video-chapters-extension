/**
 * InstructionEntry Domain Entity Tests
 * Tests instruction entry business logic and data validation
 *
 * Copyright (C) 2025 Dimitry Polivaev
 * Licensed under GPL3 or later
 */

const InstructionEntry = require('./InstructionEntry');

describe('InstructionEntry', () => {
  const sampleId = 1642678800000; // January 20, 2022 10:00:00 GMT
  const sampleTimestamp = '2022-01-20T10:00:00.000Z';
  const sampleContent = 'Generate detailed chapters with timestamps';

  describe('constructor and basic properties', () => {
    test('should create instruction entry with all parameters', () => {
      const entry = new InstructionEntry(sampleId, sampleContent, sampleTimestamp, 'My Custom Name', true);

      expect(entry.id).toBe(sampleId);
      expect(entry.content).toBe(sampleContent);
      expect(entry.timestamp).toBe(sampleTimestamp);
      expect(entry.name).toBe('My Custom Name');
      expect(entry.isCustomName).toBe(true);
    });

    test('should create instruction entry with default name parameters', () => {
      const entry = new InstructionEntry(sampleId, sampleContent, sampleTimestamp);

      expect(entry.id).toBe(sampleId);
      expect(entry.content).toBe(sampleContent);
      expect(entry.timestamp).toBe(sampleTimestamp);
      expect(entry.name).toBe('');
      expect(entry.isCustomName).toBe(false);
    });

    test('should trim content when creating entry', () => {
      const paddedContent = '  Generate chapters with descriptions  ';
      const entry = new InstructionEntry(sampleId, paddedContent, sampleTimestamp);

      expect(entry.content).toBe('Generate chapters with descriptions');
    });

    test('should handle empty content after trimming', () => {
      const emptyContent = '   ';
      const entry = new InstructionEntry(sampleId, emptyContent, sampleTimestamp);

      expect(entry.content).toBe('');
    });
  });

  describe('display name logic', () => {
    test('should return custom name when entry has custom name', () => {
      const entry = new InstructionEntry(sampleId, sampleContent, sampleTimestamp, 'Video Analysis Task', true);

      expect(entry.getDisplayName()).toBe('Video Analysis Task');
    });

    test('should return formatted timestamp when no custom name is set', () => {
      const entry = new InstructionEntry(sampleId, sampleContent, sampleTimestamp, '', false);

      const displayName = entry.getDisplayName();
      // Should match format: MM/DD/YYYY HH:MM
      expect(displayName).toMatch(/\d{1,2}\/\d{1,2}\/\d{4} \d{1,2}:\d{2}/);
    });

    test('should return formatted timestamp when custom name is empty string despite flag', () => {
      const entry = new InstructionEntry(sampleId, sampleContent, sampleTimestamp, '', true);

      const displayName = entry.getDisplayName();
      expect(displayName).toMatch(/\d{1,2}\/\d{1,2}\/\d{4} \d{1,2}:\d{2}/);
    });

    test('should return formatted timestamp when custom name is whitespace only despite flag', () => {
      const entry = new InstructionEntry(sampleId, sampleContent, sampleTimestamp, '   ', true);

      const displayName = entry.getDisplayName();
      expect(displayName).toMatch(/\d{1,2}\/\d{1,2}\/\d{4} \d{1,2}:\d{2}/);
    });

    test('should prioritize custom name over timestamp when both exist', () => {
      const entry = new InstructionEntry(sampleId, sampleContent, sampleTimestamp, 'Chapter Analysis', true);

      expect(entry.getDisplayName()).toBe('Chapter Analysis');
      expect(entry.getDisplayName()).not.toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/);
    });
  });

  describe('timestamp formatting', () => {
    test('should format valid ISO timestamp correctly', () => {
      const entry = new InstructionEntry(sampleId, sampleContent, '2022-03-15T14:30:45.123Z');

      const formatted = entry.getFormattedTimestamp();
      expect(formatted).toMatch(/\d{1,2}\/\d{1,2}\/\d{4} \d{1,2}:\d{2}/);
    });

    test('should format valid Date timestamp correctly', () => {
      const dateTimestamp = new Date('2022-06-10T09:15:30').toISOString();
      const entry = new InstructionEntry(sampleId, sampleContent, dateTimestamp);

      const formatted = entry.getFormattedTimestamp();
      expect(formatted).toMatch(/\d{1,2}\/\d{1,2}\/\d{4} \d{1,2}:\d{2}/);
    });

    test('should handle invalid timestamp gracefully', () => {
      const entry = new InstructionEntry(sampleId, sampleContent, 'invalid-date-string');

      // JavaScript Date constructor creates "Invalid Date" for invalid input
      const result = entry.getFormattedTimestamp();
      expect(result).toContain('Invalid Date');
    });

    test('should handle null timestamp', () => {
      const entry = new InstructionEntry(sampleId, sampleContent, null);

      // null gets converted to 0 (epoch time) by Date constructor
      const result = entry.getFormattedTimestamp();
      expect(result).toMatch(/\d{1,2}\/\d{1,2}\/\d{4} \d{1,2}:\d{2}/);
    });

    test('should handle empty timestamp', () => {
      const entry = new InstructionEntry(sampleId, sampleContent, '');

      // Empty string creates "Invalid Date"
      const result = entry.getFormattedTimestamp();
      expect(result).toContain('Invalid Date');
    });
  });

  describe('name management', () => {
    test('should update name and set custom name flag when name provided', () => {
      const originalEntry = new InstructionEntry(sampleId, sampleContent, sampleTimestamp);
      const updatedEntry = originalEntry.updateName('New Custom Name');

      expect(updatedEntry.name).toBe('New Custom Name');
      expect(updatedEntry.isCustomName).toBe(true);
      expect(updatedEntry.id).toBe(originalEntry.id);
      expect(updatedEntry.content).toBe(originalEntry.content);
      expect(updatedEntry.timestamp).toBe(originalEntry.timestamp);
    });

    test('should clear custom name flag when empty name provided', () => {
      const originalEntry = new InstructionEntry(sampleId, sampleContent, sampleTimestamp, 'Old Name', true);
      const updatedEntry = originalEntry.updateName('');

      expect(updatedEntry.name).toBe('');
      expect(updatedEntry.isCustomName).toBe(false);
    });

    test('should clear custom name flag when whitespace-only name provided', () => {
      const originalEntry = new InstructionEntry(sampleId, sampleContent, sampleTimestamp, 'Old Name', true);
      const updatedEntry = originalEntry.updateName('   ');

      expect(updatedEntry.name).toBe('');
      expect(updatedEntry.isCustomName).toBe(false);
    });

    test('should trim name when updating', () => {
      const originalEntry = new InstructionEntry(sampleId, sampleContent, sampleTimestamp);
      const updatedEntry = originalEntry.updateName('  Trimmed Name  ');

      expect(updatedEntry.name).toBe('Trimmed Name');
      expect(updatedEntry.isCustomName).toBe(true);
    });

    test('should handle null name by treating as empty', () => {
      const originalEntry = new InstructionEntry(sampleId, sampleContent, sampleTimestamp, 'Original Name', true);
      const updatedEntry = originalEntry.updateName(null);

      expect(updatedEntry.name).toBe('');
      expect(updatedEntry.isCustomName).toBe(false);
    });

    test('should handle undefined name by treating as empty', () => {
      const originalEntry = new InstructionEntry(sampleId, sampleContent, sampleTimestamp, 'Original Name', true);
      const updatedEntry = originalEntry.updateName(undefined);

      expect(updatedEntry.name).toBe('');
      expect(updatedEntry.isCustomName).toBe(false);
    });

    test('should create new instance when updating name (immutability)', () => {
      const originalEntry = new InstructionEntry(sampleId, sampleContent, sampleTimestamp);
      const updatedEntry = originalEntry.updateName('New Name');

      expect(updatedEntry).not.toBe(originalEntry);
      expect(originalEntry.name).toBe('');
      expect(originalEntry.isCustomName).toBe(false);
      expect(updatedEntry.name).toBe('New Name');
      expect(updatedEntry.isCustomName).toBe(true);
    });
  });

  describe('custom name detection', () => {
    test('should detect entry has custom name when flag is true and name is non-empty', () => {
      const entry = new InstructionEntry(sampleId, sampleContent, sampleTimestamp, 'Custom Name', true);

      expect(entry.hasCustomName()).toBe(true);
    });

    test('should detect entry has no custom name when flag is false', () => {
      const entry = new InstructionEntry(sampleId, sampleContent, sampleTimestamp, 'Some Name', false);

      expect(entry.hasCustomName()).toBe(false);
    });

    test('should detect entry has no custom name when name is empty despite flag', () => {
      const entry = new InstructionEntry(sampleId, sampleContent, sampleTimestamp, '', true);

      expect(entry.hasCustomName()).toBe(false);
    });

    test('should detect entry has no custom name when name is whitespace despite flag', () => {
      const entry = new InstructionEntry(sampleId, sampleContent, sampleTimestamp, '   ', true);

      expect(entry.hasCustomName()).toBe(false);
    });

    test('should return correct name field value for form editing', () => {
      const customNameEntry = new InstructionEntry(sampleId, sampleContent, sampleTimestamp, 'Edit Me', true);
      const timestampEntry = new InstructionEntry(sampleId, sampleContent, sampleTimestamp, '', false);

      expect(customNameEntry.getNameFieldValue()).toBe('Edit Me');
      expect(timestampEntry.getNameFieldValue()).toBe('');
    });

    test('should return empty string for name field when no custom name is set', () => {
      const entry = new InstructionEntry(sampleId, sampleContent, sampleTimestamp, 'Generated Timestamp', false);

      expect(entry.getNameFieldValue()).toBe('');
    });
  });

  describe('storage serialization', () => {
    test('should convert to storage object with all properties', () => {
      const entry = new InstructionEntry(sampleId, sampleContent, sampleTimestamp, 'Storage Test', true);
      const storageObj = entry.toStorageObject();

      expect(storageObj).toEqual({
        id: sampleId,
        content: sampleContent,
        timestamp: sampleTimestamp,
        name: 'Storage Test',
        isCustomName: true
      });
    });

    test('should convert to storage object with default name values', () => {
      const entry = new InstructionEntry(sampleId, sampleContent, sampleTimestamp);
      const storageObj = entry.toStorageObject();

      expect(storageObj).toEqual({
        id: sampleId,
        content: sampleContent,
        timestamp: sampleTimestamp,
        name: '',
        isCustomName: false
      });
    });

    test('should create from storage object with all properties', () => {
      const storageObj = {
        id: sampleId,
        content: sampleContent,
        timestamp: sampleTimestamp,
        name: 'From Storage',
        isCustomName: true
      };

      const entry = InstructionEntry.fromStorageObject(storageObj);

      expect(entry.id).toBe(sampleId);
      expect(entry.content).toBe(sampleContent);
      expect(entry.timestamp).toBe(sampleTimestamp);
      expect(entry.name).toBe('From Storage');
      expect(entry.isCustomName).toBe(true);
    });

    test('should create from storage object with missing name properties using defaults', () => {
      const storageObj = {
        id: sampleId,
        content: sampleContent,
        timestamp: sampleTimestamp
      };

      const entry = InstructionEntry.fromStorageObject(storageObj);

      expect(entry.id).toBe(sampleId);
      expect(entry.content).toBe(sampleContent);
      expect(entry.timestamp).toBe(sampleTimestamp);
      expect(entry.name).toBe('');
      expect(entry.isCustomName).toBe(false);
    });

    test('should handle storage object with null name gracefully', () => {
      const storageObj = {
        id: sampleId,
        content: sampleContent,
        timestamp: sampleTimestamp,
        name: null,
        isCustomName: undefined
      };

      const entry = InstructionEntry.fromStorageObject(storageObj);

      expect(entry.name).toBe('');
      expect(entry.isCustomName).toBe(false);
    });

    test('should maintain data integrity through serialization round trip', () => {
      const originalEntry = new InstructionEntry(sampleId, sampleContent, sampleTimestamp, 'Round Trip Test', true);
      const storageObj = originalEntry.toStorageObject();
      const restoredEntry = InstructionEntry.fromStorageObject(storageObj);

      expect(restoredEntry.id).toBe(originalEntry.id);
      expect(restoredEntry.content).toBe(originalEntry.content);
      expect(restoredEntry.timestamp).toBe(originalEntry.timestamp);
      expect(restoredEntry.name).toBe(originalEntry.name);
      expect(restoredEntry.isCustomName).toBe(originalEntry.isCustomName);
    });
  });

  describe('edge cases and error handling', () => {
    test('should handle very long content strings', () => {
      const longContent = 'Generate chapters '.repeat(100);
      const entry = new InstructionEntry(sampleId, longContent, sampleTimestamp);

      expect(entry.content).toBe(longContent.trim());
      expect(entry.content.length).toBeGreaterThan(1000);
    });

    test('should handle special characters in content', () => {
      const specialContent = 'Genérate châpters with émojis 🎥 and symbols @#$%';
      const entry = new InstructionEntry(sampleId, specialContent, sampleTimestamp);

      expect(entry.content).toBe(specialContent);
    });

    test('should handle special characters in custom names', () => {
      const specialName = 'Análisis de Vídeo 🎬 (Test #1)';
      const entry = new InstructionEntry(sampleId, sampleContent, sampleTimestamp);
      const updatedEntry = entry.updateName(specialName);

      expect(updatedEntry.name).toBe(specialName);
      expect(updatedEntry.hasCustomName()).toBe(true);
    });

    test('should handle numeric IDs as numbers or strings consistently', () => {
      const numericId = 12345;
      const stringId = '67890';

      const entryNumeric = new InstructionEntry(numericId, sampleContent, sampleTimestamp);
      const entryString = new InstructionEntry(stringId, sampleContent, sampleTimestamp);

      expect(entryNumeric.id).toBe(numericId);
      expect(entryString.id).toBe(stringId);
    });
  });
});
