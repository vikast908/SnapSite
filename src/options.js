;(async () => {
  // Load shared defaults from src/defaults.js
  const { defaults } = await import(chrome.runtime.getURL('src/defaults.js')).catch(() => ({ defaults: {
    maxMillis: 90_000,
    maxAssets: 2500,
    maxZipMB: 750,
    concurrency: 8,
    requestTimeoutMs: 20_000,
    scrollIdleMs: 2_000,
    maxScrollIterations: 200,
    // Keep in sync with src/defaults.js
    redact: false,
    saveWithoutPrompt: false,
    skipVideo: false,
    replaceIframesWithPoster: true,
    stripScripts: true,
    denylist: [
      String(/https?:\/\/(www\.)?google\.[^\/]+\/search/i),
      String(/https?:\/\/([^\/]+\.)?(x\.com|twitter\.com)\//i),
      String(/https?:\/\/([^\/]+\.)?(facebook\.com|instagram\.com|tiktok\.com)\//i),
      String(/https?:\/\/([^\/]+\.)?(reddit\.com)\//i),
      String(/https?:\/\/([^\/]+\.)?linkedin\.com\/feed/i),
      String(/https?:\/\/([^\/]+\.)?pinterest\.[^\/]+\//i),
      String(/https?:\/\/([^\/]+\.)?medium\.com\/$/i),
      String(/https?:\/\/news\.google\.com\//i),
      String(/https?:\/\/([^\/]+\.)?quora\.com\//i),
      // Allow YouTube Playlists feed (finite), block other /feed pages
      String(/https?:\/\/([^\/]+\.)?youtube\.com\/feed\/(?!playlists)/i),
      String(/https?:\/\/([^\/]+\.)?tumblr\.com\/dashboard/i),
    ],
  }}));

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

  function load() {
    chrome.storage.sync.get('getinspireOptions', (obj) => {
      const v = obj.getinspireOptions || defaults;
      els.maxMillis.value = Math.floor((v.maxMillis ?? defaults.maxMillis) / 1000);
      els.maxAssets.value = v.maxAssets ?? defaults.maxAssets;
      els.maxZipMB.value = v.maxZipMB ?? defaults.maxZipMB;
      els.concurrency.value = v.concurrency ?? defaults.concurrency;
      els.redact.checked = v.redact ?? defaults.redact;
      els.saveWithoutPrompt.checked = v.saveWithoutPrompt ?? defaults.saveWithoutPrompt;
      els.skipVideo.checked = v.skipVideo ?? defaults.skipVideo;
      els.replaceIframesWithPoster.checked = v.replaceIframesWithPoster ?? defaults.replaceIframesWithPoster;
      els.stripScripts.checked = v.stripScripts ?? defaults.stripScripts;
      if (els.showOverlay) els.showOverlay.checked = v.showOverlay ?? defaults.showOverlay;
      if (els.fontFallback) els.fontFallback.checked = v.fontFallback ?? defaults.fontFallback;
      const list = (Array.isArray(v.denylist) ? v.denylist : defaults.denylist)
        .map(s => s.replace(/^\/(.*)\/i$/, '/$1/i')).join('\n');
      els.denylist.value = list;
    });
    // Load theme
    chrome.storage.sync.get('getinspireTheme', (obj) => {
      const mode = obj?.getinspireTheme;
      const v = (mode === 'dark' || mode === 'light' || mode === 'auto') ? mode : 'auto';
      if (els.themeAuto) els.themeAuto.checked = (v === 'auto');
      if (els.themeLight) els.themeLight.checked = (v === 'light');
      if (els.themeDark) els.themeDark.checked = (v === 'dark');
    });
  }

  function save() {
    const deny = els.denylist.value
      .split(/\n+/)
      .map(s => s.trim())
      .filter(Boolean);

    const getNum = (el, def, mul = 1) => {
      const n = Number(el.value);
      return Number.isFinite(n) && n > 0 ? n * mul : def;
    };

    const conf = {
      maxMillis: getNum(els.maxMillis, defaults.maxMillis, 1000),
      maxAssets: getNum(els.maxAssets, defaults.maxAssets),
      maxZipMB: getNum(els.maxZipMB, defaults.maxZipMB),
      concurrency: getNum(els.concurrency, defaults.concurrency),
      redact: Boolean(els.redact.checked),
      saveWithoutPrompt: Boolean(els.saveWithoutPrompt.checked),
      skipVideo: Boolean(els.skipVideo.checked),
      replaceIframesWithPoster: Boolean(els.replaceIframesWithPoster.checked),
      stripScripts: Boolean(els.stripScripts.checked),
      showOverlay: Boolean(els.showOverlay && els.showOverlay.checked),
      fontFallback: Boolean(els.fontFallback && els.fontFallback.checked),
      denylist: deny
    };

    // Persist theme option
    let theme = 'auto';
    try {
      if (els.themeLight?.checked) theme = 'light';
      else if (els.themeDark?.checked) theme = 'dark';
      else theme = 'auto';
    } catch {}

    chrome.storage.sync.set({ getinspireOptions: conf, getinspireTheme: theme }, () => {
      els.saved.style.display = 'inline';
      setTimeout(() => (els.saved.style.display = 'none'), 1000);
      try { window.getInspireTheme && window.getInspireTheme.set(theme); } catch {}
    });
  }

  els.saveBtn.addEventListener('click', save);
  document.addEventListener('DOMContentLoaded', load);

  function addPreset(lines) {
    const current = els.denylist.value.split(/\n+/).map(s => s.trim()).filter(Boolean);
    const set = new Set(current);
    for (const ln of lines) set.add(ln);
    els.denylist.value = Array.from(set).join('\n');
  }

  // Common presets
  const presetSocial = [
    String(/https?:\/\/([^\/]+\.)?(x\.com|twitter\.com)\//i),
    String(/https?:\/\/([^\/]+\.)?(facebook\.com|instagram\.com|tiktok\.com)\//i),
    String(/https?:\/\/([^\/]+\.)?(reddit\.com)\//i),
    String(/https?:\/\/([^\/]+\.)?linkedin\.com\/feed/i),
    String(/https?:\/\/([^\/]+\.)?pinterest\.[^\/]+\//i),
    String(/https?:\/\/([^\/]+\.)?tumblr\.com\/dashboard/i),
  ];
  const presetSearch = [
    String(/https?:\/\/(www\.)?google\.[^\/]+\/search/i),
    String(/https?:\/\/(www\.)?bing\.com\/search/i),
    String(/https?:\/\/(www\.)?duckduckgo\.com\//i),
    String(/https?:\/\/(www\.)?yandex\.[^\/]+\/search/i),
    String(/https?:\/\/(www\.)?baidu\.[^\/]+\/s/i),
    String(/https?:\/\/news\.google\.com\//i),
  ];

  if (els.presetSocial) els.presetSocial.addEventListener('click', () => addPreset(presetSocial));
  if (els.presetSearch) els.presetSearch.addEventListener('click', () => addPreset(presetSearch));
})();
