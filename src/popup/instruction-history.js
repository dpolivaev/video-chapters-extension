/**
 * Instruction History View for Video Chapters Generator
 * Handles the display and user interaction with instruction history
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

/* global InstructionEntry, InstructionNameEditController */
if (typeof browser === 'undefined') {
  const browser = chrome;
}

class InstructionHistoryView {
  constructor() {
    this.modal = null;
    this.historyList = null;
    this.limitInput = null;
    this.instructionsTextarea = null;
    this.instructionsPlaceholder = null;
    this.nameEditController = new InstructionNameEditController({
      showError: (message) => this.showNotification(message, 'error')
    });
    this.init();
  }
  async init() {
    this.modal = document.getElementById('historyModal');
    this.historyList = document.getElementById('historyList');
    this.limitInput = document.getElementById('historyLimitInput');
    this.instructionsTextarea = document.getElementById('instructionsTextarea');
    this.instructionsPlaceholder = document.getElementById('instructionsPlaceholder');

    this.setupEventListeners();
    await this.loadHistoryLimit();
  }
  setupEventListeners() {
    document.getElementById('historyBtn').addEventListener('click', () => {
      this.showDialog();
    });
    document.getElementById('closeHistoryModal').addEventListener('click', () => {
      this.flushLastEditedIfNeeded();
      this.hideDialog();
    });
    this.modal.addEventListener('click', e => {
      if (e.target === this.modal) {
        this.flushLastEditedIfNeeded();
        this.hideDialog();
      }
    });
    this.limitInput.addEventListener('change', () => {
      this.onLimitChange();
    });
    this.instructionsTextarea.addEventListener('input', () => {
      this.onInstructionsChange();
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && this.modal.style.display === 'block') {
        this.flushLastEditedIfNeeded();
        this.hideDialog();
      }
    });
  }
  async showDialog() {
    try {
      await this.loadHistory();
      this.modal.style.display = 'block';
      this.modal.focus();
    } catch (error) {
      console.error('Error showing history dialog:', error);
      this.showNotification('Error loading instruction history', 'error');
    }
  }
  hideDialog() {
    this.modal.style.display = 'none';
  }
  async loadHistory() {
    try {
      const response = await browser.runtime.sendMessage({
        action: 'getInstructionHistory'
      });
      if (response && response.success) {
        this.displayHistory(response.data.history);
        this.limitInput.value = response.data.limit;
        return;
      } else {
        throw new Error(response?.error || 'Failed to load history');
      }
    } catch (error) {
      console.error('Error loading history:', error);
      throw error;
    }
  }
  displayHistory(history) {
    this.historyList.innerHTML = '';
    if (!history || history.length === 0) {
      const noHistoryDiv = document.createElement('div');
      noHistoryDiv.className = 'no-history';
      noHistoryDiv.textContent = 'No previous instructions found.\nInstructions will be saved when you process a video.';
      this.historyList.appendChild(noHistoryDiv);
      return;
    }
    history.forEach((entry, index) => {
      const instructionEntry = InstructionEntry.fromStorageObject(entry);
      const entryElement = this.createHistoryEntry(instructionEntry, index);
      this.historyList.appendChild(entryElement);
    });
  }
  createHistoryEntry(entry) {
    const entryDiv = document.createElement('div');
    entryDiv.className = 'history-entry';
    const headerDiv = document.createElement('div');
    headerDiv.className = 'history-entry-header';
    const nameInput = this.createNameInput(entry);
    headerDiv.appendChild(nameInput);
    const contentDiv = document.createElement('div');
    contentDiv.className = 'history-content';
    const textDiv = document.createElement('div');
    textDiv.className = 'history-text';
    textDiv.textContent = entry.content;
    contentDiv.appendChild(textDiv);
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'history-actions';
    const selectBtn = document.createElement('button');
    selectBtn.className = 'btn-select';
    selectBtn.textContent = 'Select';
    selectBtn.setAttribute('data-content', entry.content);
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-delete';
    deleteBtn.textContent = 'Delete';
    deleteBtn.setAttribute('data-id', entry.id);
    actionsDiv.appendChild(selectBtn);
    actionsDiv.appendChild(deleteBtn);
    entryDiv.appendChild(headerDiv);
    entryDiv.appendChild(contentDiv);
    entryDiv.appendChild(actionsDiv);
    this.setupNameInputEventListeners(nameInput, entry);
    selectBtn.addEventListener('click', () => {
      this.nameEditController.flushPendingEdit(this.historyList);
      this.selectInstruction(entry.content);
    });
    deleteBtn.addEventListener('click', () => {
      this.deleteInstruction(entry.id, entryDiv);
    });
    return entryDiv;
  }

  createNameInput(entry) {
    const nameInput = document.createElement('input');
    nameInput.className = 'history-name-input';
    nameInput.type = 'text';
    nameInput.placeholder = entry.getFormattedTimestamp();
    nameInput.value = entry.getNameFieldValue();
    nameInput.setAttribute('data-id', entry.id);
    nameInput.autocomplete = 'off';
    nameInput.spellcheck = false;
    return nameInput;
  }

  setupNameInputEventListeners(nameInput, entry) {
    nameInput.addEventListener('focus', async () => {
      await this.nameEditController.startEditing(entry.id, nameInput.value);
    });

    nameInput.addEventListener('input', () => {
      this.nameEditController.markAsDirty(entry.id, nameInput.value);
    });

    nameInput.addEventListener('blur', async () => {
      await this.nameEditController.finishEditing(entry.id, nameInput.value, entry);
    });
  }
  flushLastEditedIfNeeded() {
    this.nameEditController.flushPendingEdit(this.historyList);
  }
  selectInstruction(content) {
    this.instructionsTextarea.value = content;
    this.onInstructionsChange();
    this.hideDialog();
    this.instructionsTextarea.focus();
    this.showNotification('Instruction loaded', 'success');
  }
  async deleteInstruction(id, entryElement) {
    if (!confirm('Are you sure you want to delete this instruction?')) {
      return;
    }
    try {
      const response = await browser.runtime.sendMessage({
        action: 'deleteInstruction',
        id
      });
      if (!response || !response.success) {
        throw new Error(response?.error || 'Failed to delete instruction');
      }
      entryElement.remove();
      if (this.historyList.children.length === 0) {
        this.displayHistory([]);
      }
      this.showNotification('Instruction deleted', 'success');
    } catch (error) {
      console.error('Error deleting instruction:', error);
      this.showNotification('Error deleting instruction', 'error');
    }
  }
  async onLimitChange() {
    try {
      const newLimit = parseInt(this.limitInput.value);
      if (isNaN(newLimit) || newLimit < 1 || newLimit > 50) {
        this.limitInput.value = 10;
        return;
      }
      const response = await browser.runtime.sendMessage({
        action: 'saveSettings',
        settings: {
          historyLimit: newLimit
        }
      });
      if (!response || !response.success) {
        throw new Error(response?.error || 'Failed to save settings');
      }
    } catch (error) {
      console.error('Error updating history limit:', error);
      this.showNotification('Error updating history limit', 'error');
    }
  }
  onInstructionsChange() {
    const content = this.instructionsTextarea.value.trim();
    if (content) {
      this.instructionsPlaceholder.style.display = 'none';
    } else {
      this.instructionsPlaceholder.style.display = 'block';
    }
  }
  async loadHistoryLimit() {
    try {
      const response = await browser.runtime.sendMessage({
        action: 'loadSettings'
      });
      if (response && response.success) {
        this.limitInput.value = response.data.historyLimit || 10;
      } else {
        throw new Error(response?.error || 'Failed to load settings');
      }
    } catch (error) {
      console.error('Error loading history limit:', error);
      this.limitInput.value = 10;
    }
  }
  async saveInstruction(content) {
    if (!content || !content.trim()) {
      return;
    }
    try {
      const response = await browser.runtime.sendMessage({
        action: 'saveInstruction',
        content: content.trim()
      });
      if (!response || !response.success) {
        throw new Error(response?.error || 'Failed to save instruction');
      }
    } catch (error) {
      console.error('Error saving instruction:', error);
      throw error;
    }
  }
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  showNotification(message, type = 'info') {
    if (window.showNotification) {
      window.showNotification(message, type);
    } else {
      console.log(`${type.toUpperCase()}: ${message}`);
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.instructionHistory = new InstructionHistoryView;
  });
} else {
  window.instructionHistory = new InstructionHistoryView;
}
