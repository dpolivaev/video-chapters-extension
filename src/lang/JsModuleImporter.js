/**
 * JavaScript Module Importer Utility
 * Handles dual loading for browser extensions and Node.js testing
 *
 * Copyright (C) 2025 Dimitry Polivaev
 * Licensed under GPL3 or later
 */

class JsModuleImporter {
  static require(dependencies) {
    if (this.isNodeJsEnvironment()) {
      return this.loadFromNodeJsModules(dependencies);
    } else {
      return this.loadFromBrowserGlobals(dependencies);
    }
  }

  static isNodeJsEnvironment() {
    return typeof require !== 'undefined' && typeof module !== 'undefined';
  }

  static loadFromNodeJsModules(dependencies) {
    const loaded = {};
    for (const [name, path] of Object.entries(dependencies)) {
      if (typeof global[name] === 'undefined') {
        loaded[name] = require(path);
        global[name] = loaded[name];
      } else {
        loaded[name] = global[name];
      }
    }
    return loaded;
  }

  static loadFromBrowserGlobals(dependencies) {
    const loaded = {};
    for (const name of Object.keys(dependencies)) {
      loaded[name] = global[name] || window[name];
    }
    return loaded;
  }

  static export(className, classConstructor) {
    if (typeof module !== 'undefined' && module.exports) {
      module.exports = classConstructor;
    }
    return classConstructor;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = JsModuleImporter;
}