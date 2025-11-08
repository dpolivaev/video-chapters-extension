/**
 * Language Override System for Chaptotek
 * Provides ability to override browser language with user-selected language
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

if (typeof browser === 'undefined') {
  const browser = chrome;
}

class LanguageOverride {
  constructor() {
    this.overrideLanguage = null;
    this.messageCache = new Map();
    this.initialized = false;
    this.initPromise = this.initializeLanguageOverride();
  }

  async initializeLanguageOverride() {
    try {
      const response = await browser.runtime.sendMessage({
        action: 'getUserLanguage'
      });
      if (response.success && response.data) {
        this.overrideLanguage = response.data;
        await this.loadMessages(this.overrideLanguage);
      }
      this.initialized = true;
    } catch (error) {
      console.debug('Error loading language override:', error);
      this.initialized = true;
    }
    return this.initialized;
  }

  async loadMessages(languageCode) {
    try {
      const messagesUrl = browser.runtime.getURL(`_locales/${languageCode}/messages.json`);
      const response = await fetch(messagesUrl);
      if (response.ok) {
        const messages = await response.json();
        this.messageCache.set(languageCode, messages);
      }
    } catch (error) {
      console.debug(`Error loading messages for ${languageCode}:`, error);
    }
  }

  getMessage(messageName, substitutions = []) {
    if (this.overrideLanguage && this.messageCache.has(this.overrideLanguage)) {
      const messages = this.messageCache.get(this.overrideLanguage);
      const messageData = messages[messageName];

      if (messageData && messageData.message) {
        let message = messageData.message;

        if (substitutions && substitutions.length > 0) {
          substitutions.forEach((substitution, index) => {
            message = message.replace(new RegExp(`\\$${index + 1}`, 'g'), substitution);
          });
        }

        return message;
      }
    }

    return chrome.i18n.getMessage(messageName, substitutions);
  }
}

const languageOverride = new LanguageOverride();

function getLocalizedMessage(messageName, substitutions) {
  return languageOverride.getMessage(messageName, substitutions);
}

window.getLocalizedMessage = getLocalizedMessage;
window.languageOverride = languageOverride;
