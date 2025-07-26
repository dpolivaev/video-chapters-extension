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

  static importScriptsIfNeeded(scripts, checkClasses = []) {
    if (typeof importScripts === 'undefined') {
      return;
    }

    const globalScope = typeof global !== 'undefined' ? global : 
                       typeof window !== 'undefined' ? window : self;
    
    const allClassesLoaded = checkClasses.every(className => 
      typeof globalScope[className] !== 'undefined'
    );

    if (!allClassesLoaded) {
      try {
        importScripts(...scripts);
      } catch (error) {
        console.warn('ImportScripts failed (likely Firefox with manifest loading):', error.message);
      }
    }
  }

  static isNodeJsEnvironment() {
    return typeof require !== 'undefined' && typeof module !== 'undefined';
  }

  static loadFromNodeJsModules(dependencies) {
    const globalScope = typeof global !== 'undefined' ? global : 
                       typeof window !== 'undefined' ? window : self;
    const loaded = {};
    for (const [name, path] of Object.entries(dependencies)) {
      if (typeof globalScope[name] === 'undefined') {
        loaded[name] = require(path);
        globalScope[name] = loaded[name];
      } else {
        loaded[name] = globalScope[name];
      }
    }
    return loaded;
  }

  static loadFromBrowserGlobals(dependencies) {
    const globalScope = typeof global !== 'undefined' ? global : 
                       typeof window !== 'undefined' ? window : self;
    const loaded = {};
    for (const name of Object.keys(dependencies)) {
      loaded[name] = globalScope[name];
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