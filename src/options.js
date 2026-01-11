// Options page functionality for GetInspire
// Cross-browser compatibility: Use browser.* if available (Firefox), otherwise use chrome.*
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

(async () => {
  console.log('[GetInspire Options] Initializing...');

  // Load shared defaults
  const { defaults } = await import(browserAPI.runtime.getURL('src/defaults.js')).catch(() => ({
    defaults: {
      maxMillis: 20_000,
      maxAssets: 5000,
      maxZipMB: 1000,
      concurrency: 20,
      redact: false,
      saveWithoutPrompt: false,
      skipVideo: false,
      replaceIframesWithPoster: true,
      stripScripts: true,
      showOverlay: false,
      fontFallback: true,
      denylist: []
    }
  }));

  // Get all form elements
  const els = {
    maxMillis: document.getElementById('maxMillis'),
    maxAssets: document.getElementById('maxAssets'),
    maxZipMB: document.getElementById('maxZipMB'),
    concurrency: document.getElementById('concurrency'),
    denylist: document.getElementById('denylist'),
    redact: document.getElementById('redact'),
    saveWithoutPrompt: document.getElementById('saveWithoutPrompt'),
    skipVideo: document.getElementById('skipVideo'),
    replaceIframesWithPoster: document.getElementById('replaceIframesWithPoster'),
    stripScripts: document.getElementById('stripScripts'),
    showOverlay: document.getElementById('showOverlay'),
    fontFallback: document.getElementById('fontFallback'),
    saveBtn: document.getElementById('saveBtn'),
    saved: document.getElementById('saved'),
    presetSocial: document.getElementById('presetSocial'),
    presetSearch: document.getElementById('presetSearch'),
    themeAuto: document.getElementById('themeAuto'),
    themeLight: document.getElementById('themeLight'),
    themeDark: document.getElementById('themeDark'),
  };

  // Load settings from storage
  function loadSettings() {
    console.log('[GetInspire Options] Loading settings...');

    browserAPI.storage.sync.get(['getinspireOptions', 'getinspireTheme'], (result) => {
      const options = result.getinspireOptions || {};
      const theme = result.getinspireTheme || 'auto';

      // Load number inputs (convert milliseconds to seconds for display)
      els.maxMillis.value = Math.floor((options.maxMillis ?? defaults.maxMillis) / 1000);
      els.maxAssets.value = options.maxAssets ?? defaults.maxAssets;
      els.maxZipMB.value = options.maxZipMB ?? defaults.maxZipMB;
      els.concurrency.value = options.concurrency ?? defaults.concurrency;

      // Load checkboxes
      els.redact.checked = options.redact ?? defaults.redact;
      els.saveWithoutPrompt.checked = options.saveWithoutPrompt ?? defaults.saveWithoutPrompt;
      els.skipVideo.checked = options.skipVideo ?? defaults.skipVideo;
      els.replaceIframesWithPoster.checked = options.replaceIframesWithPoster ?? defaults.replaceIframesWithPoster;
      els.stripScripts.checked = options.stripScripts ?? defaults.stripScripts;
      els.showOverlay.checked = options.showOverlay ?? defaults.showOverlay;
      els.fontFallback.checked = options.fontFallback ?? defaults.fontFallback;

      // Load denylist
      const denylist = options.denylist ?? defaults.denylist;
      els.denylist.value = Array.isArray(denylist) ? denylist.join('\n') : '';

      // Load theme
      els.themeAuto.checked = (theme === 'auto');
      els.themeLight.checked = (theme === 'light');
      els.themeDark.checked = (theme === 'dark');

      console.log('[GetInspire Options] Settings loaded successfully');
    });
  }

  // Save settings to storage
  function saveSettings() {
    console.log('[GetInspire Options] Saving settings...');

    // Parse denylist
    const denylistLines = els.denylist.value
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    // Get number values
    const getNumber = (element, defaultValue, multiplier = 1) => {
      const value = Number(element.value);
      return (Number.isFinite(value) && value > 0) ? value * multiplier : defaultValue;
    };

    // Build options object
    const options = {
      maxMillis: getNumber(els.maxMillis, defaults.maxMillis, 1000), // Convert seconds to ms
      maxAssets: getNumber(els.maxAssets, defaults.maxAssets),
      maxZipMB: getNumber(els.maxZipMB, defaults.maxZipMB),
      concurrency: getNumber(els.concurrency, defaults.concurrency),
      redact: els.redact.checked,
      saveWithoutPrompt: els.saveWithoutPrompt.checked,
      skipVideo: els.skipVideo.checked,
      replaceIframesWithPoster: els.replaceIframesWithPoster.checked,
      stripScripts: els.stripScripts.checked,
      showOverlay: els.showOverlay.checked,
      fontFallback: els.fontFallback.checked,
      denylist: denylistLines
    };

    // Get selected theme
    let theme = 'auto';
    if (els.themeLight.checked) theme = 'light';
    else if (els.themeDark.checked) theme = 'dark';

    // Save to storage
    browserAPI.storage.sync.set({
      getinspireOptions: options,
      getinspireTheme: theme
    }, () => {
      console.log('[GetInspire Options] Settings saved successfully');

      // Show success message with animation
      els.saved.classList.add('show');
      setTimeout(() => {
        els.saved.classList.remove('show');
      }, 2000);

      // Update theme immediately
      if (window.getInspireTheme) {
        window.getInspireTheme.set(theme);
      }
    });
  }

  // Add preset patterns to denylist
  function addPreset(patterns) {
    const currentLines = els.denylist.value
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    const uniqueLines = new Set([...currentLines, ...patterns]);
    els.denylist.value = Array.from(uniqueLines).join('\n');

    // Add visual feedback
    els.denylist.style.borderColor = 'var(--ui-accent)';
    setTimeout(() => {
      els.denylist.style.borderColor = '';
    }, 300);
  }

  // Preset patterns
  const socialPresets = [
    '/https?:\\/\\/([^\\/]+\\.)?(x\\.com|twitter\\.com)\\//i',
    '/https?:\\/\\/([^\\/]+\\.)?(facebook\\.com|instagram\\.com|tiktok\\.com)\\//i',
    '/https?:\\/\\/([^\\/]+\\.)?(reddit\\.com)\\//i',
    '/https?:\\/\\/([^\\/]+\\.)?linkedin\\.com\\/feed/i',
    '/https?:\\/\\/([^\\/]+\\.)?pinterest\\.[^\\/]+\\//i',
    '/https?:\\/\\/([^\\/]+\\.)?tumblr\\.com\\/dashboard/i'
  ];

  const searchPresets = [
    '/https?:\\/\\/(www\\.)?google\\.[^\\/]+\\/search/i',
    '/https?:\\/\\/(www\\.)?bing\\.com\\/search/i',
    '/https?:\\/\\/(www\\.)?duckduckgo\\.com\\//i',
    '/https?:\\/\\/news\\.google\\.com\\//i'
  ];

  // Event listeners
  els.saveBtn.addEventListener('click', (e) => {
    e.preventDefault();

    // Add button feedback
    els.saveBtn.style.transform = 'scale(0.95)';
    setTimeout(() => {
      els.saveBtn.style.transform = '';
    }, 100);

    saveSettings();
  });

  if (els.presetSocial) {
    els.presetSocial.addEventListener('click', () => {
      addPreset(socialPresets);
    });
  }

  if (els.presetSearch) {
    els.presetSearch.addEventListener('click', () => {
      addPreset(searchPresets);
    });
  }

  // Add micro-interactions for number inputs
  [els.maxMillis, els.maxAssets, els.maxZipMB, els.concurrency].forEach(input => {
    if (!input) return;

    input.addEventListener('focus', () => {
      input.style.borderColor = 'var(--ui-accent)';
    });

    input.addEventListener('blur', () => {
      input.style.borderColor = '';
    });

    input.addEventListener('input', () => {
      // Validate on input
      const value = Number(input.value);
      if (!Number.isFinite(value) || value <= 0) {
        input.style.borderColor = '#ef4444';
      } else {
        input.style.borderColor = 'var(--ui-accent)';
      }
    });
  });

  // Add micro-interactions for textarea
  if (els.denylist) {
    els.denylist.addEventListener('focus', () => {
      els.denylist.style.borderColor = 'var(--ui-accent)';
    });

    els.denylist.addEventListener('blur', () => {
      els.denylist.style.borderColor = '';
    });
  }

  // Add theme change listeners for immediate feedback
  [els.themeAuto, els.themeLight, els.themeDark].forEach(radio => {
    if (!radio) return;

    radio.addEventListener('change', () => {
      let theme = 'auto';
      if (els.themeLight.checked) theme = 'light';
      else if (els.themeDark.checked) theme = 'dark';

      // Apply theme immediately (before save)
      if (window.getInspireTheme) {
        window.getInspireTheme.set(theme);
      }
    });
  });

  // Initialize: Load settings when page is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadSettings);
  } else {
    loadSettings();
  }

  console.log('[GetInspire Options] Initialization complete');
})();
