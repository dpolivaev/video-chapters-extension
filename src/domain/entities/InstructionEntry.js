/**
 * Instruction Entry Domain Entity for Chaptotek
 * Represents a saved instruction with business methods for display and validation
 *
 * Copyright (C) 2025 Dimitry Polivaev
 *
 * This file is part of Chaptotek.
 *
 * Chaptotek is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Chaptotek is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Chaptotek. If not, see <https://www.gnu.org/licenses/>.
 */

class InstructionEntry {
  constructor(id, content, timestamp, name = '', isCustomName = false) {
    this.id = id;
    this.content = content.trim();
    this.timestamp = timestamp;
    this.name = name;
    this.isCustomName = isCustomName;
  }

  getDisplayName() {
    if (this.isCustomName && this.name.trim()) {
      return this.name;
    }
    return this.getFormattedTimestamp();
  }

  getFormattedTimestamp() {
    try {
      const date = new Date(this.timestamp);
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return 'Unknown time';
    }
  }

  updateName(newName) {
    const trimmedName = (newName || '').trim();
    return new InstructionEntry(
      this.id,
      this.content,
      this.timestamp,
      trimmedName,
      trimmedName.length > 0
    );
  }

  hasCustomName() {
    return this.isCustomName && this.name.trim().length > 0;
  }

  getNameFieldValue() {
    return this.isCustomName ? (this.name || '') : '';
  }

  static fromStorageObject(obj) {
    return new InstructionEntry(
      obj.id,
      obj.content,
      obj.timestamp,
      obj.name || '',
      !!obj.isCustomName
    );
  }

  toStorageObject() {
    return {
      id: this.id,
      content: this.content,
      timestamp: this.timestamp,
      name: this.name,
      isCustomName: this.isCustomName
    };
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = InstructionEntry;
}
