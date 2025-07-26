/**
 * JavaScript Module Importer Utility
 * Handles script loading for browser extensions
 *
 * Copyright (C) 2025 Dimitry Polivaev
 * Licensed under GPL3 or later
 */

class JsModuleImporter {
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

  static export(classConstructor) {
    if (typeof module !== 'undefined' && module.exports) {
      module.exports = classConstructor;
    }
    return classConstructor;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = JsModuleImporter;
}