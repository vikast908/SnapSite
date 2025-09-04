// Lightweight theme manager for extension pages (popup/options/setup)
// Exposes window.getInspireTheme with get/set/cycle helpers and applies on load.
(function(){
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
      chrome.storage?.sync?.get(KEY, (obj) => {
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
      chrome.storage?.sync?.set({ [KEY]: v }, () => {
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

