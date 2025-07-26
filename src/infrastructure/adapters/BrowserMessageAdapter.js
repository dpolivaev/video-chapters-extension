/**
 * Browser Message Adapter - Trivial Infrastructure
 * Zero control flow - just wires browser message API to domain coordinator
 *
 * Copyright (C) 2025 Dimitry Polivaev
 * Licensed under GPL3 or later
 */

class BrowserMessageAdapter {
  constructor(messageCoordinator) {
    this.messageCoordinator = messageCoordinator;
  }

  setupMessageListeners() {
    browser.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
      const response = await this.messageCoordinator.processMessage(request.action, request);
      sendResponse(response);
      return true;
    });
  }

  async sendMessage(tabId, message) {
    return browser.tabs.sendMessage(tabId, message);
  }

  async broadcastMessage(message) {
    const tabs = await browser.tabs.query({});
    return Promise.all(
      tabs.map(tab =>
        browser.tabs.sendMessage(tab.id, message).catch(() => {})
      )
    );
  }
}
