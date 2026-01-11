// Options page for SnapSite
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;
console.log('[SnapSite Options] Initializing');

// Defaults
const defaults = {
  maxMillis: 120000,
  maxAssets: 50000,
  maxZipMB: 2000,
  concurrency: 25,
  redact: false,
  saveWithoutPrompt: false,
  skipVideo: false,
  replaceIframesWithPoster: true,
  stripScripts: false,
  showOverlay: true,
  fontFallback: true,
  denylist: []
};

// DOM elements
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
  themeToggle: document.getElementById('themeToggle'),
  themeIcon: document.getElementById('themeIcon'),
  themeLabel: document.getElementById('themeLabel')
};

// Theme management
let currentTheme = 'light';

function updateThemeUI(theme) {
  const sunIcon = `<circle cx="12" cy="12" r="5"/><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>`;
  const moonIcon = `<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>`;

  if (els.themeIcon) {
    els.themeIcon.innerHTML = theme === 'dark' ? moonIcon : sunIcon;
  }
  if (els.themeLabel) {
    els.themeLabel.textContent = theme === 'dark' ? 'Dark' : 'Light';
  }
}

function setTheme(theme) {
  currentTheme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  updateThemeUI(theme);
  browserAPI.storage.sync.set({ snapsiteTheme: theme });
}

function toggleTheme() {
  setTheme(currentTheme === 'dark' ? 'light' : 'dark');
}

// Initialize theme
browserAPI.storage.sync.get(['snapsiteTheme'], (result) => {
  currentTheme = result.snapsiteTheme === 'dark' ? 'dark' : 'light';
  updateThemeUI(currentTheme);
});

if (els.themeToggle) {
  els.themeToggle.addEventListener('click', toggleTheme);
}

// Load settings
function loadSettings() {
  browserAPI.storage.sync.get(['snapsiteOptions'], (result) => {
    const opts = result.snapsiteOptions || {};

    // Number inputs (convert ms to seconds for display)
    if (els.maxMillis) els.maxMillis.value = Math.floor((opts.maxMillis ?? defaults.maxMillis) / 1000);
    if (els.maxAssets) els.maxAssets.value = opts.maxAssets ?? defaults.maxAssets;
    if (els.maxZipMB) els.maxZipMB.value = opts.maxZipMB ?? defaults.maxZipMB;
    if (els.concurrency) els.concurrency.value = opts.concurrency ?? defaults.concurrency;

    // Checkboxes
    if (els.redact) els.redact.checked = opts.redact ?? defaults.redact;
    if (els.saveWithoutPrompt) els.saveWithoutPrompt.checked = opts.saveWithoutPrompt ?? defaults.saveWithoutPrompt;
    if (els.skipVideo) els.skipVideo.checked = opts.skipVideo ?? defaults.skipVideo;
    if (els.replaceIframesWithPoster) els.replaceIframesWithPoster.checked = opts.replaceIframesWithPoster ?? defaults.replaceIframesWithPoster;
    if (els.stripScripts) els.stripScripts.checked = opts.stripScripts ?? defaults.stripScripts;
    if (els.showOverlay) els.showOverlay.checked = opts.showOverlay ?? defaults.showOverlay;
    if (els.fontFallback) els.fontFallback.checked = opts.fontFallback ?? defaults.fontFallback;

    // Denylist
    const denylist = opts.denylist ?? defaults.denylist;
    if (els.denylist) els.denylist.value = Array.isArray(denylist) ? denylist.join('\n') : '';

    console.log('[SnapSite Options] Loaded');
  });
}

// Save settings
function saveSettings() {
  const denylistLines = (els.denylist?.value || '')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);

  const getNum = (el, def, mult = 1) => {
    const v = Number(el?.value);
    return (Number.isFinite(v) && v > 0) ? v * mult : def;
  };

  const options = {
    maxMillis: getNum(els.maxMillis, defaults.maxMillis, 1000),
    maxAssets: getNum(els.maxAssets, defaults.maxAssets),
    maxZipMB: getNum(els.maxZipMB, defaults.maxZipMB),
    concurrency: getNum(els.concurrency, defaults.concurrency),
    redact: els.redact?.checked ?? defaults.redact,
    saveWithoutPrompt: els.saveWithoutPrompt?.checked ?? defaults.saveWithoutPrompt,
    skipVideo: els.skipVideo?.checked ?? defaults.skipVideo,
    replaceIframesWithPoster: els.replaceIframesWithPoster?.checked ?? defaults.replaceIframesWithPoster,
    stripScripts: els.stripScripts?.checked ?? defaults.stripScripts,
    showOverlay: els.showOverlay?.checked ?? defaults.showOverlay,
    fontFallback: els.fontFallback?.checked ?? defaults.fontFallback,
    denylist: denylistLines
  };

  browserAPI.storage.sync.set({ snapsiteOptions: options }, () => {
    console.log('[SnapSite Options] Saved');
    if (els.saved) {
      els.saved.classList.add('show');
      setTimeout(() => els.saved.classList.remove('show'), 2000);
    }
  });
}

// Preset patterns
const presets = {
  social: [
    'https?://([^/]+\\.)?(twitter\\.com|x\\.com)/',
    'https?://([^/]+\\.)?(facebook\\.com|instagram\\.com|tiktok\\.com)/',
    'https?://([^/]+\\.)?reddit\\.com/',
    'https?://([^/]+\\.)?linkedin\\.com/feed'
  ],
  search: [
    'https?://(www\\.)?google\\.[^/]+/search',
    'https?://(www\\.)?bing\\.com/search',
    'https?://(www\\.)?duckduckgo\\.com/'
  ]
};

function addPreset(patterns) {
  const current = (els.denylist?.value || '')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0);

  const unique = [...new Set([...current, ...patterns])];
  if (els.denylist) els.denylist.value = unique.join('\n');
}

// Event listeners
if (els.saveBtn) {
  els.saveBtn.addEventListener('click', (e) => {
    e.preventDefault();
    saveSettings();
  });
}

if (els.presetSocial) {
  els.presetSocial.addEventListener('click', () => addPreset(presets.social));
}

if (els.presetSearch) {
  els.presetSearch.addEventListener('click', () => addPreset(presets.search));
}

// Initialize
loadSettings();
