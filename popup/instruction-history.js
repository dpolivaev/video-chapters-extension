/**
 * Instruction History View for Browser Extension
 * Handles the display and user interaction with instruction history
 */

if (typeof browser === 'undefined') {
  var browser = chrome;
}

class InstructionHistoryView {
  constructor() {
    this.modal = null;
    this.historyList = null;
    this.limitInput = null;
    this.instructionsTextarea = null;
    this.instructionsPlaceholder = null;
    
    this.init();
  }

  /**
   * Initialize the history view
   */
  async init() {
    this.modal = document.getElementById('historyModal');
    this.historyList = document.getElementById('historyList');
    this.limitInput = document.getElementById('historyLimitInput');
    this.instructionsTextarea = document.getElementById('instructionsTextarea');
    this.instructionsPlaceholder = document.getElementById('instructionsPlaceholder');
    
    this.setupEventListeners();
    await this.loadHistoryLimit();
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // History button
    document.getElementById('historyBtn').addEventListener('click', () => {
      this.showDialog();
    });

    // Close modal
    document.getElementById('closeHistoryModal').addEventListener('click', () => {
      this.hideDialog();
    });

    // Close modal when clicking outside
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.hideDialog();
      }
    });

    // History limit change
    this.limitInput.addEventListener('change', () => {
      this.onLimitChange();
    });

    // Instructions textarea changes
    this.instructionsTextarea.addEventListener('input', () => {
      this.onInstructionsChange();
    });

    // ESC key to close modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.modal.style.display === 'block') {
        this.hideDialog();
      }
    });
  }

  /**
   * Show the history dialog
   */
  async showDialog() {
    try {
      await this.loadHistory();
      this.modal.style.display = 'block';
      
      // Focus the modal for accessibility
      this.modal.focus();
      
    } catch (error) {
      console.error('Error showing history dialog:', error);
      this.showNotification('Error loading instruction history', 'error');
    }
  }

  /**
   * Hide the history dialog
   */
  hideDialog() {
    this.modal.style.display = 'none';
  }

  /**
   * Load instruction history from storage
   */
  async loadHistory() {
    try {
      const response = await browser.runtime.sendMessage({ action: 'getInstructionHistory' });
      
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

  /**
   * Display history in the modal
   */
  displayHistory(history) {
    this.historyList.innerHTML = '';
    
    if (!history || history.length === 0) {
      const noHistoryDiv = document.createElement('div');
      noHistoryDiv.className = 'no-history';
      noHistoryDiv.textContent = 'No previous instructions found.\nInstructions will be saved when you process a video.';
      this.historyList.appendChild(noHistoryDiv);
      return;
    }

    // Create history entries (newest first)
    history.forEach((entry, index) => {
      const entryElement = this.createHistoryEntry(entry, index);
      this.historyList.appendChild(entryElement);
    });
  }

  /**
   * Create a history entry element
   */
  createHistoryEntry(entry, originalIndex) {
    const entryDiv = document.createElement('div');
    entryDiv.className = 'history-entry';

    // Parse timestamp
    let timestampStr = 'Unknown time';
    try {
      const date = new Date(entry.timestamp);
      timestampStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } catch (e) {
      console.warn('Failed to parse timestamp:', entry.timestamp);
    }

    // Create elements safely without innerHTML
    const headerDiv = document.createElement('div');
    headerDiv.className = 'history-entry-header';
    
    const timestampDiv = document.createElement('div');
    timestampDiv.className = 'history-timestamp';
    timestampDiv.textContent = timestampStr;
    headerDiv.appendChild(timestampDiv);
    
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

    // Add event listeners
    selectBtn.addEventListener('click', () => {
      this.selectInstruction(entry.content);
    });

    deleteBtn.addEventListener('click', () => {
      this.deleteInstruction(entry.id, entryDiv);
    });

    return entryDiv;
  }

  /**
   * Select an instruction and load it into the textarea
   */
  selectInstruction(content) {
    this.instructionsTextarea.value = content;
    this.onInstructionsChange();
    this.hideDialog();
    
    // Focus the textarea
    this.instructionsTextarea.focus();
    
    this.showNotification('Instruction loaded', 'success');
  }

  /**
   * Delete an instruction from history
   */
  async deleteInstruction(id, entryElement) {
    if (!confirm('Are you sure you want to delete this instruction?')) {
      return;
    }

    try {
      const response = await browser.runtime.sendMessage({ action: 'deleteInstruction', id });
      
      if (!response || !response.success) {
        throw new Error(response?.error || 'Failed to delete instruction');
      }

      // Remove the element from UI
      entryElement.remove();
      
      // Check if we need to show "no history" message
      if (this.historyList.children.length === 0) {
        this.displayHistory([]);
      }
      
      this.showNotification('Instruction deleted', 'success');
      
    } catch (error) {
      console.error('Error deleting instruction:', error);
      this.showNotification('Error deleting instruction', 'error');
    }
  }

  /**
   * Handle history limit change
   */
  async onLimitChange() {
    try {
      const newLimit = parseInt(this.limitInput.value);
      if (isNaN(newLimit) || newLimit < 1 || newLimit > 50) {
        this.limitInput.value = 10; // Reset to default
        return;
      }

      // Save the new limit
      const response = await browser.runtime.sendMessage({ 
        action: 'saveSettings', 
        settings: { historyLimit: newLimit } 
      });
      
      if (!response || !response.success) {
        throw new Error(response?.error || 'Failed to save settings');
      }

      // Reload history to apply the new limit
      await this.loadHistory();
      
    } catch (error) {
      console.error('Error updating history limit:', error);
      this.showNotification('Error updating history limit', 'error');
    }
  }

  /**
   * Handle instructions textarea changes
   */
  onInstructionsChange() {
    const content = this.instructionsTextarea.value.trim();
    
    // Show/hide placeholder based on content
    if (content) {
      this.instructionsPlaceholder.style.display = 'none';
    } else {
      this.instructionsPlaceholder.style.display = 'block';
    }
  }

  /**
   * Load history limit from storage
   */
  async loadHistoryLimit() {
    try {
      const response = await browser.runtime.sendMessage({ action: 'loadSettings' });
      
      if (response && response.success) {
        this.limitInput.value = response.data.historyLimit || 10;
      } else {
        throw new Error(response?.error || 'Failed to load settings');
      }
    } catch (error) {
      console.error('Error loading history limit:', error);
      this.limitInput.value = 10; // Default value
    }
  }

  /**
   * Save instruction to history
   */
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

  /**
   * Escape HTML for safe display
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Show notification
   */
  showNotification(message, type = 'info') {
    // This will be implemented by the main popup script
    if (window.showNotification) {
      window.showNotification(message, type);
    } else {
      console.log(`${type.toUpperCase()}: ${message}`);
    }
  }
}

// Initialize the instruction history view when DOM is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.instructionHistory = new InstructionHistoryView();
  });
} else {
  window.instructionHistory = new InstructionHistoryView();
} 