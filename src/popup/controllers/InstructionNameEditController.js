/**
 * Instruction Name Edit Controller for Video Chapters Generator
 * Handles the business logic for editing instruction names inline
 *
 * Copyright (C) 2025 Dimitry Polivaev
 *
 * This file is part of Video Chapters Generator.
 *
 * Video Chapters Generator is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Video Chapters Generator is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Video Chapters Generator. If not, see <https://www.gnu.org/licenses/>.
 */

class InstructionNameEditController {
  constructor(notificationHandler) {
    this.notificationHandler = notificationHandler;
    this.activeEdit = { id: null, originalValue: '', isDirty: false };
  }

  startEditing(instructionId, currentValue) {
    this.activeEdit = {
      id: instructionId,
      originalValue: currentValue,
      isDirty: false
    };
  }

  markAsDirty(instructionId, _newValue) {
    if (this.activeEdit.id === instructionId) {
      this.activeEdit.isDirty = true;
    }
  }

  async finishEditing(instructionId, newValue, originalEntry) {
    if (!this.shouldSaveChanges(instructionId, newValue, originalEntry)) {
      this.clearActiveEdit();
      return false;
    }

    try {
      await this.saveNameChange(instructionId, newValue);
      this.clearActiveEdit();
      return true;
    } catch (error) {
      this.handleSaveError(error);
      return false;
    }
  }

  shouldSaveChanges(instructionId, newValue, originalEntry) {
    if (this.activeEdit.id !== instructionId || !this.activeEdit.isDirty) {
      return false;
    }

    const trimmedValue = (newValue || '').trim();
    const originalValue = originalEntry.getNameFieldValue();

    return trimmedValue !== originalValue;
  }

  async saveNameChange(instructionId, newValue) {
    const response = await browser.runtime.sendMessage({
      action: 'renameInstruction',
      id: instructionId,
      name: (newValue || '').trim()
    });

    if (!response || !response.success) {
      throw new Error(response?.error || 'Failed to save name change');
    }
  }

  handleSaveError(error) {
    console.error('Error saving instruction name:', error);
    this.notificationHandler.showError('Error saving name');
  }

  clearActiveEdit() {
    this.activeEdit = { id: null, originalValue: '', isDirty: false };
  }

  flushPendingEdit(historyListElement) {
    if (!this.hasPendingEdit()) {
      return;
    }

    try {
      const inputElement = historyListElement.querySelector(
        `input.history-name-input[data-id="${this.activeEdit.id}"]`
      );
      if (inputElement) {
        inputElement.blur();
      }
    } catch (error) {
      this.clearActiveEdit();
    }
  }

  hasPendingEdit() {
    return this.activeEdit.isDirty && this.activeEdit.id !== null;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = InstructionNameEditController;
}
