// Lightweight theme manager for extension pages (popup/options/setup)
// Exposes window.getInspireTheme with get/set/cycle helpers and applies on load.
(function(){
  // Cross-browser compatibility
  const browserAPI = typeof browser !== 'undefined' ? browser : chrome;
  const KEY = 'getinspireTheme'; // 'auto' | 'light' | 'dark'
  let current = 'auto';
  let mql = null;

  function effective(mode){
    if (mode === 'dark') return 'dark';
    if (mode === 'light') return 'light';
    try { return (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light'; }
    catch { return 'light'; }
  }

  function apply(mode){
    const eff = effective(mode);
    const root = document.documentElement;
    if (!root) return;
    if (mode === 'auto') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', eff);
    }
    // Always set an effective attribute for CSS targeting convenience
    root.setAttribute('data-theme-effective', eff);
    current = mode;
    try { updateActionIcon(eff); } catch {}
  }

  function onMqlChange(){
    if (current === 'auto') apply('auto');
  }

  function attachMql(){
    try {
      if (!window.matchMedia) return;
      if (mql) { mql.removeEventListener?.('change', onMqlChange); mql = null; }
      mql = window.matchMedia('(prefers-color-scheme: dark)');
      mql.addEventListener?.('change', onMqlChange);
    } catch {}
  }

  function get(cb){
    try {
      browserAPI.storage?.sync?.get(KEY, (obj) => {
        const v = obj && obj[KEY];
        const mode = (v === 'light' || v === 'dark' || v === 'auto') ? v : 'auto';
        cb(mode);
      });
    } catch {
      cb('auto');
    }
  }

  function set(mode, cb){
    const v = (mode === 'light' || mode === 'dark') ? mode : 'auto';
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
      const next = mode === 'auto' ? 'dark' : (mode === 'dark' ? 'light' : 'auto');
      set(next, cb);
    });
  }

  function init(){
    attachMql();
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
