// Lightweight theme manager for extension pages (popup/options/setup)
// Exposes window.getInspireTheme with get/set/cycle helpers and applies on load.
(function(){
  // Cross-browser compatibility
  const browserAPI = typeof browser !== 'undefined' ? browser : chrome;
  const KEY = 'getinspireTheme'; // 'light' | 'dark'
  let current = 'light';

  function effective(mode){
    if (mode === 'dark') return 'dark';
    return 'light'; // Default to light
  }

  function apply(mode){
    const eff = effective(mode);
    const root = document.documentElement;
    if (!root) return;
    root.setAttribute('data-theme', eff);
    current = mode;
    try { updateActionIcon(eff); } catch {}
  }


  function get(cb){
    try {
      browserAPI.storage?.sync?.get(KEY, (obj) => {
        const v = obj && obj[KEY];
        const mode = (v === 'dark') ? 'dark' : 'light';
        cb(mode);
      });
    } catch {
      cb('light');
    }
  }

  function set(mode, cb){
    const v = (mode === 'dark') ? 'dark' : 'light';
    try {
      browserAPI.storage?.sync?.set({ [KEY]: v }, () => {
        apply(v);
        cb && cb(v);
      });
    } catch {
      apply(v);
      cb && cb(v);
    }
  }

  function cycle(cb){
    get((mode) => {
      const next = (mode === 'dark') ? 'light' : 'dark';
      set(next, cb);
    });
  }

  function init(){
    get((mode) => { apply(mode); });
  }

  async function updateActionIcon(eff){
    if (!chrome?.action?.setIcon) return;
    const base = (p) => browserAPI.runtime.getURL(p);
    const darkSet = {
      16: 'assets/icons-dark/16.png',
      32: 'assets/icons-dark/32.png',
      48: 'assets/icons-dark/48.png',
      128: 'assets/icons-dark/128.png',
    };
    const lightSet = {
      16: 'assets/icons/16.png',
      32: 'assets/icons/32.png',
      48: 'assets/icons/48.png',
      128: 'assets/icons/128.png',
    };
    async function exists(path){
      try { const r = await fetch(base(path), { method:'HEAD' }); return r.ok; } catch { return false; }
    }
    let use = lightSet;
    if (eff === 'dark'){
      // Prefer a dark icon set if present; fallback to default
      const ok = await exists(darkSet[16]);
      use = ok ? darkSet : lightSet;
    }
    try { await browserAPI.action.setIcon({ path: Object.fromEntries(Object.entries(use).map(([k,v])=>[k, base(v)])) }); } catch {}
  }

  // Expose API for pages to use
  window.getInspireTheme = {
    get,
    set,
    cycle,
    apply,
  };

  // Auto-apply on load
  try { init(); } catch {}
})();
