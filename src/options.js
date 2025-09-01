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
    redact: true,
    saveWithoutPrompt: false,
    skipVideo: true,
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
      String(/https?:\/\/([^\/]+\.)?youtube\.com\/feed\//i),
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
    stripScripts: document.getElementById('stripScripts'),
    saveBtn: document.getElementById('saveBtn'),
    saved: document.getElementById('saved')
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
      els.stripScripts.checked = v.stripScripts ?? defaults.stripScripts;
      const list = (Array.isArray(v.denylist) ? v.denylist : defaults.denylist)
        .map(s => s.replace(/^\/(.*)\/i$/, '/$1/i')).join('\n');
      els.denylist.value = list;
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
      stripScripts: Boolean(els.stripScripts.checked),
      denylist: deny
    };

    chrome.storage.sync.set({ getinspireOptions: conf }, () => {
      els.saved.style.display = 'inline';
      setTimeout(() => (els.saved.style.display = 'none'), 1000);
    });
  }

  els.saveBtn.addEventListener('click', save);
  document.addEventListener('DOMContentLoaded', load);
})();
