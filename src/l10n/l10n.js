/*
 license: The MIT License, Copyright (c) 2016-2024 YUKI "Piro" Hiroshi
 original:
   http://github.com/piroor/webextensions-lib-l10n
*/

const l10n = {
  updateString(string) {
    return string.replace(/__MSG_([-@.\w]+)__/g, (matched, key) => {
      return getLocalizedMessage(key) || matched;
    });
  },

  $log(message, ...args) {
    message = `l10s: ${message}`;
    if (typeof window.log === 'function') {
      window.log(message, ...args);
    } else {
      console.log(message, ...args);
    }
  },

  updateSubtree(node) {
    const texts = document.evaluate(
      'descendant::text()[contains(self::text(), "__MSG_")]',
      node,
      null,
      XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
      null
    );
    for (let i = 0, maxi = texts.snapshotLength; i < maxi; i++) {
      const text = texts.snapshotItem(i);
      text.nodeValue = this.updateString(text.nodeValue);
    }

    const attributes = document.evaluate(
      'descendant::*/attribute::*[contains(., "__MSG_")]',
      node,
      null,
      XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
      null
    );
    for (let i = 0, maxi = attributes.snapshotLength; i < maxi; i++) {
      const attribute = attributes.snapshotItem(i);
      this.$log('apply', attribute);
      attribute.value = this.updateString(attribute.value);
    }
  },

  updateDocument() {
    this.updateSubtree(document);
  }
};

document.addEventListener('DOMContentLoaded', async () => {
  // Wait for language override to initialize if available
  if (window.languageOverride && window.languageOverride.initPromise) {
    await window.languageOverride.initPromise;
  }
  l10n.updateDocument();
}, { once: true });
