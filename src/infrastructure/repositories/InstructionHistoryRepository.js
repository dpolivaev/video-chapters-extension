/**
 * InstructionHistoryRepository
 * Single source of truth for instruction history storage
 *
 * Copyright (C) 2025 Dimitry Polivaev
 * Licensed under GPL3 or later
 */

class InstructionHistoryRepository {
  constructor(storageAdapter, settingsRepository) {
    if (!storageAdapter) {
      throw new Error('storageAdapter is required');
    }
    if (!settingsRepository) {
      throw new Error('settingsRepository is required');
    }
    this.storageAdapter = storageAdapter;
    this.settingsRepository = settingsRepository;
    this.defaultLimit = 10;
  }

  async addInstruction(content) {
    const trimmedContent = content.trim();
    const history = await this.getHistory();
    const limit = await this.getHistoryLimit();

    const instructionToAdd = this.createOrUpdateInstruction(trimmedContent, history);
    const updatedHistory = this.addToHistoryWithLimit(instructionToAdd, history, limit);

    await this.storageAdapter.setInstructionHistory(updatedHistory);
    return instructionToAdd;
  }

  createOrUpdateInstruction(content, history) {
    const existingIndex = history.findIndex(instruction => instruction.content.trim() === content);

    if (existingIndex !== -1) {
      const existing = history.splice(existingIndex, 1)[0];
      return new InstructionEntry(
        existing.id,
        content,
        (new Date).toISOString(),
        existing.name || '',
        !!existing.isCustomName
      ).toStorageObject();
    }

    return new InstructionEntry(
      Date.now(),
      content,
      (new Date).toISOString()
    ).toStorageObject();
  }

  addToHistoryWithLimit(instruction, history, limit) {
    history.unshift(instruction);
    history.splice(limit);
    return history;
  }

  async renameInstruction(id, name) {
    const history = await this.getHistory();
    const entryIndex = history.findIndex(item => item.id === id);

    if (entryIndex === -1) {
      return;
    }

    const currentEntry = InstructionEntry.fromStorageObject(history[entryIndex]);
    const updatedEntry = currentEntry.updateName(name);
    history[entryIndex] = updatedEntry.toStorageObject();

    await this.storageAdapter.setInstructionHistory(history);
  }

  async getHistory() {
    return await this.storageAdapter.getInstructionHistory() || [];
  }

  async deleteInstruction(id) {
    const history = await this.getHistory();
    const filteredHistory = history.filter(instruction => instruction.id !== id);
    await this.storageAdapter.setInstructionHistory(filteredHistory);
    return filteredHistory;
  }

  async setHistoryLimit(limit) {
    await this.storageAdapter.setHistoryLimit(limit);
    const history = await this.getHistory();
    if (history.length > limit) {
      history.splice(limit);
      await this.storageAdapter.setInstructionHistory(history);
    }
  }

  async getHistoryLimit() {
    try {
      const limit = await this.storageAdapter.getHistoryLimit();
      return limit !== undefined && limit !== null ? limit : this.defaultLimit;
    } catch (error) {
      console.error('Error loading history limit from local storage:', error);
      return this.defaultLimit;
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = InstructionHistoryRepository;
}
