/**
 * Browser API Polyfill for Cross-Browser Extension Compatibility
 * Supports: Chrome, Firefox, Edge, Safari, Opera, Brave
 *
 * This creates a unified `browser` API that works across all browsers.
 * Chrome uses chrome.*, Firefox uses browser.* with Promises
 */

(function() {
  'use strict';

  // Check if we're in a browser extension context
  const isBrowserExtension = typeof chrome !== 'undefined' || typeof browser !== 'undefined';

  if (!isBrowserExtension) {
    console.warn('[GetInspire] Not running in browser extension context');
    return;
  }

  // If browser API already exists (Firefox), use it
  if (typeof globalThis.browser !== 'undefined' && globalThis.browser.runtime) {
    // Firefox - browser API already available with Promises
    // Make chrome available as alias
    if (typeof globalThis.chrome === 'undefined') {
      globalThis.chrome = globalThis.browser;
    }
    return;
  }

  // Chrome/Edge/Opera/Brave - wrap chrome API with Promise support
  if (typeof chrome !== 'undefined' && chrome.runtime) {

    // Helper to promisify callback-based API
    function promisify(fn, context) {
      return function(...args) {
        return new Promise((resolve, reject) => {
          fn.call(context, ...args, (result) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(result);
            }
          });
        });
      };
    }

    // Create browser namespace if it doesn't exist
    if (typeof globalThis.browser === 'undefined') {
      globalThis.browser = {};
    }

    // Runtime API
    globalThis.browser.runtime = {
      ...chrome.runtime,
      sendMessage: function(message) {
        return new Promise((resolve, reject) => {
          chrome.runtime.sendMessage(message, (response) => {
            if (chrome.runtime.lastError) {
              // Don't reject on "receiving end does not exist" - common when popup is closed
              if (chrome.runtime.lastError.message.includes('Receiving end does not exist')) {
                resolve(undefined);
              } else {
                reject(new Error(chrome.runtime.lastError.message));
              }
            } else {
              resolve(response);
            }
          });
        });
      },
      getURL: chrome.runtime.getURL,
      getManifest: chrome.runtime.getManifest,
      onMessage: chrome.runtime.onMessage,
      onInstalled: chrome.runtime.onInstalled,
      id: chrome.runtime.id
    };

    // Tabs API
    if (chrome.tabs) {
      globalThis.browser.tabs = {
        ...chrome.tabs,
        query: promisify(chrome.tabs.query, chrome.tabs),
        get: promisify(chrome.tabs.get, chrome.tabs),
        create: promisify(chrome.tabs.create, chrome.tabs),
        update: promisify(chrome.tabs.update, chrome.tabs),
        remove: promisify(chrome.tabs.remove, chrome.tabs),
        sendMessage: function(tabId, message) {
          return new Promise((resolve, reject) => {
            chrome.tabs.sendMessage(tabId, message, (response) => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
              } else {
                resolve(response);
              }
            });
          });
        },
        onUpdated: chrome.tabs.onUpdated,
        onRemoved: chrome.tabs.onRemoved
      };
    }

    // Storage API
    if (chrome.storage) {
      globalThis.browser.storage = {
        local: {
          get: promisify(chrome.storage.local.get, chrome.storage.local),
          set: promisify(chrome.storage.local.set, chrome.storage.local),
          remove: promisify(chrome.storage.local.remove, chrome.storage.local),
          clear: promisify(chrome.storage.local.clear, chrome.storage.local)
        },
        sync: {
          get: promisify(chrome.storage.sync.get, chrome.storage.sync),
          set: promisify(chrome.storage.sync.set, chrome.storage.sync),
          remove: promisify(chrome.storage.sync.remove, chrome.storage.sync),
          clear: promisify(chrome.storage.sync.clear, chrome.storage.sync)
        },
        onChanged: chrome.storage.onChanged
      };
    }

    // Downloads API
    if (chrome.downloads) {
      globalThis.browser.downloads = {
        ...chrome.downloads,
        download: promisify(chrome.downloads.download, chrome.downloads),
        onChanged: chrome.downloads.onChanged
      };
    }

    // Scripting API (MV3)
    if (chrome.scripting) {
      globalThis.browser.scripting = {
        ...chrome.scripting,
        executeScript: promisify(chrome.scripting.executeScript, chrome.scripting),
        insertCSS: promisify(chrome.scripting.insertCSS, chrome.scripting),
        removeCSS: chrome.scripting.removeCSS ? promisify(chrome.scripting.removeCSS, chrome.scripting) : undefined
      };
    }

    // Windows API
    if (chrome.windows) {
      globalThis.browser.windows = {
        ...chrome.windows,
        create: promisify(chrome.windows.create, chrome.windows),
        update: promisify(chrome.windows.update, chrome.windows),
        remove: promisify(chrome.windows.remove, chrome.windows),
        get: promisify(chrome.windows.get, chrome.windows),
        getAll: promisify(chrome.windows.getAll, chrome.windows),
        getCurrent: promisify(chrome.windows.getCurrent, chrome.windows)
      };
    }

    // Action API (MV3) / BrowserAction API (MV2)
    const actionAPI = chrome.action || chrome.browserAction;
    if (actionAPI) {
      globalThis.browser.action = {
        setIcon: promisify(actionAPI.setIcon, actionAPI),
        setTitle: promisify(actionAPI.setTitle, actionAPI),
        setBadgeText: promisify(actionAPI.setBadgeText, actionAPI),
        setBadgeBackgroundColor: promisify(actionAPI.setBadgeBackgroundColor, actionAPI),
        onClicked: actionAPI.onClicked
      };
      // Alias for MV2 compatibility
      globalThis.browser.browserAction = globalThis.browser.action;
    }

    console.log('[GetInspire] Browser polyfill loaded (Chrome-based browser)');
  }
})();

// Feature detection utilities
const BrowserCompat = {
  // Check if running in Firefox
  isFirefox: typeof InstallTrigger !== 'undefined' || navigator.userAgent.includes('Firefox'),

  // Check if running in Safari
  isSafari: /^((?!chrome|android).)*safari/i.test(navigator.userAgent),

  // Check if running in Edge (Chromium)
  isEdge: navigator.userAgent.includes('Edg/'),

  // Check if running in Opera
  isOpera: navigator.userAgent.includes('OPR/') || navigator.userAgent.includes('Opera'),

  // Check if running in Brave
  isBrave: navigator.brave !== undefined,

  // Check if running in Chrome
  isChrome: /Chrome/.test(navigator.userAgent) && !/Edg|OPR|Brave/.test(navigator.userAgent),

  // Get browser name
  getBrowserName: function() {
    if (this.isBrave) return 'Brave';
    if (this.isFirefox) return 'Firefox';
    if (this.isSafari) return 'Safari';
    if (this.isEdge) return 'Edge';
    if (this.isOpera) return 'Opera';
    if (this.isChrome) return 'Chrome';
    return 'Unknown';
  },

  // Check if Manifest V3 is supported
  supportsMV3: function() {
    // Firefox 109+ supports MV3, Safari 15.4+ supports MV3
    return !this.isFirefox || (this.isFirefox && this.getFirefoxVersion() >= 109);
  },

  // Get Firefox version
  getFirefoxVersion: function() {
    const match = navigator.userAgent.match(/Firefox\/(\d+)/);
    return match ? parseInt(match[1]) : 0;
  },

  // Check if service workers are supported (for background scripts)
  supportsServiceWorker: function() {
    return 'serviceWorker' in navigator && !this.isSafari;
  },

  // Check if the scripting API is available
  hasScriptingAPI: function() {
    return typeof chrome !== 'undefined' && chrome.scripting !== undefined;
  },

  // Check if downloads API is available
  hasDownloadsAPI: function() {
    return typeof chrome !== 'undefined' && chrome.downloads !== undefined;
  }
};

// Export for module environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { BrowserCompat };
}
