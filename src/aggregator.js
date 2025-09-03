;(function(){
  if (window.__GETINSPIRE_AGG_RUNNING__) return;
  window.__GETINSPIRE_AGG_RUNNING__ = true;

  let zip = null;
  const pages = [];
  let startedAt = Date.now();
  let siteTitle = '';

  function ensureZip(){ if (!zip) zip = new (window.JSZip||function(){ throw new Error('JSZip missing'); })(); }
  function escHtml(s){ return String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c])); }
  function slugify(input){ try{ const u = new URL(input); const s = (u.hostname + u.pathname).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,''); return s || 'page'; }catch{ return String(input||'page').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')||'page'; } }

  chrome.runtime.onMessage.addListener(async (msg) => {
    if (msg?.type === 'GETINSPIRE_AGG_INIT'){
      try { ensureZip(); } catch (e) { console.error(e); return; }
      startedAt = Date.now();
      siteTitle = String(msg?.title || 'GetInspire Site Snapshot');
      try { chrome.runtime.sendMessage({ type:'GETINSPIRE_CRAWL_PROGRESS', done: 0, total: 0, status:'Aggregator ready' }); } catch {}
    }
    if (msg?.type === 'GETINSPIRE_AGG_ADD_PAGE'){
      try {
        ensureZip();
        const slug = msg.slug || slugify(msg.pageUrl||('page-'+(pages.length+1)));
        const base = `pages/${slug}/`;
        // page index
        zip.file(base + 'index.html', msg.indexHtml || '<!doctype html><title>Empty</title>');
        // assets
        const assets = Array.isArray(msg.assets) ? msg.assets : [];
        for (const a of assets){
          try {
            const raw = a.arrayBuffer || a.ab || a.data || null;
            if (!raw) continue;
            const blob = raw instanceof Blob ? raw : new Blob([raw], { type: a.mime || 'application/octet-stream' });
            zip.file(base + (a.path || 'assets/asset'), blob);
          } catch (e) { console.error(e); }
        }
        // extras (manifest, mhtml, readme, quick-check, report)
        if (msg.readmeMd) zip.file(base + 'report/README.md', msg.readmeMd);
        if (msg.reportJson) zip.file(base + 'report/fetch-report.json', msg.reportJson);
        if (msg.quickCheckHtml) zip.file(base + 'quick-check.html', msg.quickCheckHtml);
        if (Array.isArray(msg.extras)){
          for (const ex of msg.extras){
            try {
              const p = base + (ex.path || 'extra.bin');
              if (ex.type === 'text') zip.file(p, String(ex.data||''));
              else if (ex.type === 'blob' && ex.data) zip.file(p, ex.data);
              else if (ex.type === 'arrayBuffer' && ex.data) zip.file(p, ex.data);
            } catch (e) { console.error(e); }
          }
        }
        pages.push({ slug, title: msg.title || msg.pageUrl || slug, url: msg.pageUrl || '' });
      } catch (e) { console.error(e); }
    }
    if (msg?.type === 'GETINSPIRE_AGG_FINALIZE'){
      try {
        ensureZip();
        const elapsed = Math.max(0, Date.now()-startedAt);
        const list = pages.map(p => `<li><a href="pages/${p.slug}/index.html">${escHtml(p.title)}</a></li>`).join('\n');
        const idx = `<!doctype html><html><head><meta charset="utf-8"/><title>${escHtml(siteTitle)}</title><meta name="viewport" content="width=device-width, initial-scale=1"/><style>body{font:14px system-ui,sans-serif;margin:16px}h1{font-size:18px}ul{line-height:1.6}</style></head><body><h1>${escHtml(siteTitle)}</h1><p>Pages: ${pages.length} • Generated in ${Math.round(elapsed/1000)}s</p><ul>${list}</ul></body></html>`;
        // If an index already exists, keep the first one; else add
        if (!zip.files['index.html']) zip.file('index.html', idx);
        const blob = await zip.generateAsync({ type:'blob' });
        const URLRef = (window.URL||self.URL);
        const blobUrl = URLRef.createObjectURL(blob);
        const filename = msg.filename || `getinspire-site-${new Date().toISOString().replace(/[:.]/g,'-')}.zip`;
        chrome.runtime.sendMessage({ type:'GETINSPIRE_DOWNLOAD_ZIP', blobUrl, filename });
        setTimeout(()=>{ try { URLRef.revokeObjectURL(blobUrl); } catch{} }, 45000);
      } catch (e) { console.error(e); }
    }
  });
})();
