(() => {
  if (window.__GETINSPIRE_RUNNING__) return;
  window.__GETINSPIRE_RUNNING__ = true;

  // --- defaults, can be overridden from options ---
  const defaults = {
    maxMillis: 90_000,
    maxAssets: 2500,
    maxZipMB: 750,
    concurrency: 8,
    requestTimeoutMs: 20000,
    scrollIdleMs: 2000,
    maxScrollIterations: 200,
    redact: true,
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
      String(/https?:\/\/([^\/]+\.)?tumblr\.com\/dashboard/i)
    ],
  };

  const state = {
    stopped: false,
    started: Date.now(),
    report: baseReport(),
  };

  const sendStatus = (text) => chrome.runtime.sendMessage({ type: 'GETINSPIRE_STATUS', text }).catch(() => {});
  const fail = (msg) => {
    chrome.runtime.sendMessage({ type: 'GETINSPIRE_ERROR', error: msg }).catch(() => {});
    cleanup();
    throw new Error(msg);
  };
  const onRuntimeMessage = (msg) => {
    if (msg?.type === 'GETINSPIRE_STOP') state.stopped = true;
  };

  const cleanup = () => {
    chrome.runtime.onMessage.removeListener(onRuntimeMessage);
    window.__GETINSPIRE_RUNNING__ = false;
  };

  chrome.runtime.onMessage.addListener(onRuntimeMessage);

  ;(async function main() {
    if (!window.JSZip) return fail('Internal error: ZIP library missing.');
    const options = await loadOptions();
    // expose for collection helpers
    window.__GETINSPIRE_OPTIONS__ = options;
    const denylistRe = compileDenylist(options.denylist);

    // Denylist gate
    state.report.endlessDetection.deniedByList = denylistRe.some(re => re.test(location.href));
    if (state.report.endlessDetection.deniedByList) {
      state.report.endlessDetection.reason = 'denylist';
      return fail('This page appears endless (infinite feed). Try a page that has a clear end.');
    }

    // Auto-scroll & stabilization
    sendStatus('Scrolling to load all content...');
    const sc = await autoScrollUntilStable({
      idleMs: options.scrollIdleMs,
      maxIters: options.maxScrollIterations,
      started: state.started,
      maxMillis: options.maxMillis,
    }).catch(e => ({ stabilized: false, reason: e?.message || String(e) }));
    if (!sc?.stabilized) {
      state.report.endlessDetection.stabilized = false;
      state.report.endlessDetection.reason = sc?.reason || 'unstable';
      return fail(sc?.reason || 'Page took too long; likely endless.');
    }
    state.report.endlessDetection.stabilized = true;

    if (state.stopped) return fail('Stopped by user.');

    // Redaction happens on cloned snapshot below (not mutating live DOM)

    // Collect assets & initial HTML snapshot
    sendStatus('Collecting assets...');
    const collected = await collectPageAssets();
    state.report.skipped.push(...collected.skipped);
    state.report.stats.assetsSkipped = state.report.skipped.length;
    if (state.stopped) return fail('Stopped by user.');

    // Redact on cloned snapshot (do not mutate live page)
    let htmlForRewrite = collected.html;
    if (options.redact) {
      sendStatus('Redacting authenticated text...');
      try {
        const red = redactHtml(collected.html);
        htmlForRewrite = red.html;
        for (const r of red.redactions) state.report.redactions.push(r);
      } catch {}
    }

    // Download assets with concurrency and caps
    const totalAssets = collected.urls.size;
    sendStatus(`Downloading ${totalAssets} assets...`);
    try { chrome.runtime.sendMessage({ type: 'GETINSPIRE_PROGRESS', downloaded: 0, total: totalAssets }); } catch {}
    const dres = await downloadAllAssets(collected.urls, {
      concurrency: options.concurrency,
      maxAssets: options.maxAssets,
      maxZipBytes: options.maxZipMB * 1024 * 1024,
      started: state.started,
      maxMillis: options.maxMillis,
      requestTimeoutMs: defaults.requestTimeoutMs,
    });
    if (dres.stopReason) {
      const reason = dres.stopReason;
      if (reason === 'zip-too-large') return fail('ZIP too large. Try limiting the page.');
      if (reason === 'asset-cap') return fail('Too many assets. Try limiting the page.');
      if (reason === 'timeout') return fail('Page took too long; likely endless.');
      if (reason === 'stopped') return fail('Stopped by user.');
      return fail('Capture stopped.');
    }
    state.report.stats.assetsTotal = collected.urls.size;
    state.report.stats.assetsDownloaded = dres.successCount;
    state.report.stats.assetsFailed = dres.failures.length;
    state.report.stats.assetsSkipped = state.report.skipped.length; // updated after potential in-download skips
    for (const f of dres.failures) state.report.failures.push(f);

    if (state.stopped) return fail('Stopped by user.');

    // Rewrite HTML and CSS to local paths
    sendStatus('Rewriting HTML & CSS...');
    const htmlRewritten = await rewriteHtmlAndCss(htmlForRewrite, dres.map, collected.inlineCssTexts);

    // Assemble report content
    state.report.pageUrl = location.href;
    state.report.capturedAt = new Date().toISOString();
    state.report.stats.durationMs = Date.now() - state.started;
    state.report.notes.push('Third-party iframes left as-is; may not work offline');

    // Build ZIP with two-pass to embed accurate report size
    sendStatus('Packing ZIP...');
    const { blob: blob1 } = await buildZip({
      indexHtml: bannered(htmlRewritten),
      assets: dres.map,
      reportJson: JSON.stringify(state.report, null, 2),
      readmeMd: buildReadme(state.report),
      quickCheckHtml: quickCheckHtml(),
      sizeCap: options.maxZipMB * 1024 * 1024,
    });
    state.report.stats.zipBytes = blob1.size;
    state.report.stats.durationMs = Date.now() - state.started;

    const { blob } = await buildZip({
      indexHtml: bannered(htmlRewritten),
      assets: dres.map,
      reportJson: JSON.stringify(state.report, null, 2),
      readmeMd: buildReadme(state.report),
      quickCheckHtml: quickCheckHtml(),
      sizeCap: options.maxZipMB * 1024 * 1024,
    });

    if (state.stopped) return fail('Stopped by user.');

    // Hand off to background for download
    const safeHost = location.hostname.replace(/[^a-z0-9.-]/gi, '-');
    const filename = `getinspire-${safeHost}-${new Date().toISOString().replace(/[:.]/g,'-')}.zip`;
    const URLRef = (window.URL || self.URL);
    const blobUrl = URLRef.createObjectURL(blob);
    chrome.runtime.sendMessage({ type: 'GETINSPIRE_DOWNLOAD_ZIP', blobUrl, filename });
    try { chrome.runtime.sendMessage({ type: 'GETINSPIRE_PROGRESS', downloaded: totalAssets, total: totalAssets }); } catch {}
    sendStatus('Done.');
    cleanup();
  })().catch(e => fail(e?.message || String(e)));

  // ---------- helpers ----------

  function baseReport() {
    return {
      pageUrl: '',
      capturedAt: '',
      stats: {
        assetsTotal: 0,
        assetsDownloaded: 0,
        assetsFailed: 0,
        assetsSkipped: 0,
        zipBytes: 0,
        durationMs: 0
      },
      endlessDetection: {
        deniedByList: false,
        stabilized: false,
        reason: null
      },
      failures: [],
      skipped: [],
      redactions: [],
      notes: []
    };
  }

  function bannered(html) {
    return `<!-- Saved by GetInspire on ${new Date().toISOString()} from ${location.href} -->\n` + html;
  }

  async function loadOptions() {
    return new Promise((resolve) => {
      try {
        chrome.storage.sync.get('getinspireOptions', (obj) => {
          const o = obj.getinspireOptions || {};
          resolve({
            maxMillis: o.maxMillis ?? defaults.maxMillis,
            maxAssets: o.maxAssets ?? defaults.maxAssets,
            maxZipMB: o.maxZipMB ?? defaults.maxZipMB,
            concurrency: o.concurrency ?? defaults.concurrency,
            scrollIdleMs: defaults.scrollIdleMs,
            maxScrollIterations: defaults.maxScrollIterations,
            redact: o.redact ?? defaults.redact,
            skipVideo: o.skipVideo ?? true,
            // Respect an explicitly empty denylist. Previously, clearing the
            // denylist in the options page would fall back to the built-in
            // defaults because we checked for a non-zero length. This made it
            // impossible for users to opt out of the default denylist.
            // Accept any array (including empty) from storage and only fall
            // back to defaults when the value is missing or invalid.
            denylist: Array.isArray(o.denylist) ? o.denylist : defaults.denylist,
          });
        });
      } catch {
        resolve({ ...defaults });
      }
    });
  }

  function compileDenylist(strs) {
    const out = [];
    for (const s of strs || []) {
      try {
        const m = /^\/(.*)\/(\w+)?$/.exec(String(s).trim());
        if (m) out.push(new RegExp(m[1], m[2] || 'i'));
      } catch {}
    }
    return out;
  }

  async function autoScrollUntilStable({ idleMs, maxIters, started, maxMillis }) {
    return new Promise((resolve, reject) => {
      let lastChange = Date.now();
      let iter = 0;
      const obs = new MutationObserver(() => { lastChange = Date.now(); });
      obs.observe(document.documentElement, { childList: true, subtree: true, attributes: true, characterData: true });

      const step = () => {
        if (Date.now() - started > maxMillis) {
          obs.disconnect();
          return reject(new Error('Page took too long; likely endless.'));
        }
        if (state.stopped) {
          obs.disconnect();
          return reject(new Error('Stopped by user.'));
        }
        const atBottom = Math.abs(window.scrollY + window.innerHeight - document.documentElement.scrollHeight) < 4;
        if (!atBottom) window.scrollTo(0, document.documentElement.scrollHeight);
        iter++;
        const idle = Date.now() - lastChange > idleMs;
        if (atBottom && idle) { obs.disconnect(); return resolve({ stabilized: true }); }
        if (iter > maxIters) { obs.disconnect(); return reject(new Error('This page appears unbounded (infinite feed).')); }
        setTimeout(step, 300);
      };
      step();
    });
  }

  function redactDomHeuristic(rootDoc) {
    const results = [];
    const candidates = new Set();

    // Attribute-based
    const attrSelectors = [
      '[data-user]', '[data-username]', '[data-email]', '[data-profile]', '[data-account]', '[data-private]', '[data-auth]',
      '[data-customer]', '[data-member]', '[data-name]',
      '[data-reactroot]', '[data-hydrate]', '[data-hydration]', '[data-props]', '[data-state]', '[data-initial-state]',
      '[data-testid*="user"]', '[data-qa*="user"]'
    ];
    for (const sel of attrSelectors) rootDoc.querySelectorAll(sel).forEach(el => candidates.add(el));

    // ID/class hints
    const hintRe = /(user|account|profile|email|token|auth|dashboard|name|customer|member|secure|private)/i;
    rootDoc.querySelectorAll('*').forEach(el => {
      if (hintRe.test(el.id) || Array.from(el.classList || []).some(c => hintRe.test(c))) candidates.add(el);
    });

    // Limit redactions to avoid runaway
    let count = 0;
    for (const el of candidates) {
      if (count > 200) break;
      const text = el.textContent?.trim();
      if (!text) continue;
      const length = Math.min(text.length, 2000);
      replaceTextNodes(el, randomLoremOfLength(length));
      results.push({ selector: uniqueSelector(el), length, reason: 'authenticated' });
      count++;
    }
    return results;
  }

  function redactTextPatterns(rootDoc, patterns, cap = 200) {
    const results = [];
    const base = rootDoc.body || rootDoc;
    const walker = rootDoc.createTreeWalker(base, NodeFilter.SHOW_TEXT, null);
    let n, count = 0;
    while ((n = walker.nextNode())) {
      if (!n.parentElement) continue;
      const tag = n.parentElement.tagName;
      if (tag === 'SCRIPT' || tag === 'STYLE' || n.parentElement.isContentEditable) continue;
      let t = n.nodeValue || '';
      let replaced = false;
      for (const { re, label } of patterns) {
        if (re.test(t)) {
          const newText = randomLoremOfLength(t.length);
          n.nodeValue = newText;
          results.push({ selector: uniqueSelector(n.parentElement), length: t.length, reason: label });
          replaced = true; count++;
          break;
        }
      }
      if (count >= cap) break;
    }
    return results;
  }

  function replaceTextNodes(root, replacement) {
    const doc = root.ownerDocument || document;
    const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    const chunks = splitLorem(replacement);
    let i = 0;
    const nodes = [];
    while (true) {
      const n = walker.nextNode();
      if (!n) break;
      nodes.push(n);
    }
    for (const n of nodes) {
      const part = chunks[i % chunks.length];
      n.nodeValue = part;
      i++;
    }
  }

  function randomLoremOfLength(n) {
    const words = 'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua'.split(' ');
    let out = '';
    while (out.length < n) {
      out += (out ? ' ' : '') + words[Math.floor(Math.random() * words.length)];
    }
    return out.slice(0, n);
  }
  function splitLorem(s) {
    const parts = [];
    const chunk = Math.max(8, Math.floor(s.length / 6));
    for (let i = 0; i < s.length; i += chunk) parts.push(s.slice(i, i + chunk));
    return parts.length ? parts : [s];
  }

  function uniqueSelector(el) {
    if (el.id) return `#${cssEscape(el.id)}`;
    const parts = [];
    let cur = el;
    while (cur && parts.length < 4) {
      let sel = cur.tagName.toLowerCase();
      if (cur.classList && cur.classList.length) sel += '.' + Array.from(cur.classList).slice(0,2).map(cssEscape).join('.');
      parts.unshift(sel);
      cur = cur.parentElement;
    }
    return parts.join(' > ');
  }
  
  function redactHtml(html) {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const redactions = [];
      for (const r of redactDomHeuristic(doc)) redactions.push(r);
      const extra = redactTextPatterns(doc, [
        { re: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/ig, label: 'email' },
        { re: /\b[a-z0-9]{24,}\b/ig, label: 'token-like' }
      ], 200);
      for (const r of extra) redactions.push(r);
      const out = '<!doctype html>\n' + doc.documentElement.outerHTML;
      return { html: out, redactions };
    } catch (e) {
      return { html, redactions: [] };
    }
  }
  function cssEscape(s) { return String(s).replace(/[^a-z0-9_-]/gi, '-'); }

  async function collectPageAssets() {
    const urls = new Set();
    const skipped = [];
    const inlineCssTexts = [];

    const add = (u, ctx) => {
      try {
        if (!u) return;
        if (u.startsWith('data:')) { skipped.push({ url: u.slice(0, 64) + (u.length > 64 ? '...' : ''), reason: 'data-uri' }); return; }
        const abs = new URL(u, document.baseURI).href;
        urls.add(abs);
      } catch {}
    };

    // Elements with src (exclude iframes; optional: skip video)
    document.querySelectorAll('img[src], script[src], audio[src], video[src], track[src], source[src]').forEach(el => {
      const tag = el.tagName;
      if (tag === 'IFRAME') return;
      if ((tag === 'VIDEO' || (tag === 'SOURCE' && el.closest('video')) || (tag === 'TRACK' && el.closest('video'))) && (window.__GETINSPIRE_OPTIONS__?.skipVideo ?? true)) {
        const u = el.getAttribute('src');
        if (u) skipped.push({ url: new URL(u, document.baseURI).href, reason: 'video' });
        return;
      }
      add(el.getAttribute('src'));
    });
    // poster
    document.querySelectorAll('video[poster]').forEach(el => add(el.getAttribute('poster')));
    // srcset
    document.querySelectorAll('img[srcset], source[srcset]').forEach(el => {
      const ss = el.getAttribute('srcset');
      if (!ss) return;
      ss.split(',').forEach(part => add(part.trim().split(/\s+/)[0]));
    });
    // Stylesheets and icons
    document.querySelectorAll('link[rel~="stylesheet"][href], link[rel~="icon"][href], link[rel~="apple-touch-icon"][href], link[rel~="mask-icon"][href]').forEach(el => add(el.getAttribute('href')));

    // Inline style attributes
    document.querySelectorAll('[style]').forEach(el => {
      const style = el.getAttribute('style');
      if (!style) return;
      extractCssUrls(style).forEach(u => add(u));
      inlineCssTexts.push(style);
    });

    // Inline <style> blocks
    document.querySelectorAll('style').forEach(st => {
      const text = st.textContent || '';
      if (text) {
        extractCssUrls(text).forEach(u => add(u));
        extractCssImports(text).forEach(u => add(u));
        inlineCssTexts.push(text);
      }
    });

    // External stylesheets: fetch to follow their @import and url() for completeness
    await Promise.all(Array.from(document.querySelectorAll('link[rel~="stylesheet"][href]')).map(async (link) => {
      try {
        const same = new URL(link.href, document.baseURI).origin === location.origin;
        const res = await fetch(link.href, { credentials: same ? 'include' : 'omit', mode: 'cors' });
        if (!res.ok) return;
        const text = await res.text();
        extractCssUrls(text).forEach(u => add(new URL(u, link.href).href));
        extractCssImports(text).forEach(u => add(new URL(u, link.href).href));
      } catch {}
    }));

    // Preload links for styles/scripts/fonts/images
    document.querySelectorAll('link[rel="preload"][as][href]').forEach(el => {
      const as = (el.getAttribute('as')||'').toLowerCase();
      if (['style','script','font','image','fetch'].includes(as)) add(el.getAttribute('href'));
    });

    const html = '<!doctype html>\n' + document.documentElement.outerHTML;
    return { urls, html, skipped, inlineCssTexts };
  }

  function extractCssUrls(cssText) {
    const out = [];
    const re = /url\(([^)]+)\)/g; let m;
    while ((m = re.exec(cssText))) {
      const raw = m[1].trim().replace(/^['"]|['"]$/g,'');
      if (!raw.startsWith('data:')) out.push(raw);
    }
    return out;
  }
  function extractCssImports(cssText) {
    const out = [];
    const re = /@import\s+(?:url\()?\s*['"]?([^'"\)]+)['"]?\s*\)?/g; let m;
    while ((m = re.exec(cssText))) out.push(m[1]);
    return out;
  }

  async function downloadAllAssets(urls, cfg) {
    const map = new Map(); // url -> { path, mime, bytes, blob }
    const failures = [];
    const seenName = new Map();
    const queue = Array.from(urls);
    let idx = 0;
    let inFlight = 0;
    let totalBytes = 0;
    let stopReason = '';
    const controllers = new Set();
    let skipCount = 0;

    const markStop = (reason) => {
      if (!stopReason) stopReason = reason;
      // Abort any in-flight fetches
      controllers.forEach((c) => { try { c.abort(); } catch {} });
    };

    const next = () => new Promise((resolve) => {
      const run = async () => {
        if (idx >= queue.length) return resolve();
        if (map.size >= cfg.maxAssets) { markStop('asset-cap'); return resolve(); }
        if (Date.now() - cfg.started > cfg.maxMillis) { markStop('timeout'); return resolve(); }
        if (state.stopped) { markStop('stopped'); return resolve(); }
        if (stopReason) return resolve();
        const url = queue[idx++];
        inFlight++;
        let controller = null; let toId = null;
        try {
          // Skip video assets if configured or detected
          if ((window.__GETINSPIRE_OPTIONS__?.skipVideo ?? true) && isVideoUrl(url)) {
            state.report.skipped.push({ url, reason: 'video' });
            skipCount++;
            return resolve();
          }
          controller = new AbortController();
          controllers.add(controller);
          toId = setTimeout(() => { try { controller.abort('timeout'); } catch {} }, cfg.requestTimeoutMs || 20000);
          const same = new URL(url, document.baseURI).origin === location.origin;
          let res;
          try {
            res = await fetch(url, { credentials: same ? 'include' : 'omit', mode: 'cors', signal: controller.signal });
          } catch (err) {
            res = undefined;
          }
          if (!res || !res.ok) {
            // Try background fetch proxy as a fallback for CORS/3P cookie issues
            const fetched = await fetchViaBackground(url).catch(() => null);
            if (!fetched) throw new Error('Failed to fetch');
            const { blob, mime } = fetched;
            const bytes = blob.size || 0;
            const ext = extFromUrlOrMime(url, mime);
            const base = safeBaseName(url);
            const filename = dedupe(`${base}${ext}`);
            const path = `assets/${filename}`;
            totalBytes += bytes;
            if (totalBytes > cfg.maxZipBytes) { markStop('zip-too-large'); throw new Error('zip-too-large'); }
            map.set(url, { path, mime, bytes, blob, isCss: mime.startsWith('text/css') || url.endsWith('.css') });
            return resolve();
          }
          if (!res.ok) throw new Error(String(res.status || 'fetch-failed'));
          const blob = await res.blob();
          const bytes = blob.size || 0;
          const mime = blob.type || 'application/octet-stream';
          const ext = extFromUrlOrMime(url, mime);
          const base = safeBaseName(url);
          const filename = dedupe(`${base}${ext}`);
          const path = `assets/${filename}`;
          totalBytes += bytes;
          if (totalBytes > cfg.maxZipBytes) { markStop('zip-too-large'); throw new Error('zip-too-large'); }
          map.set(url, { path, mime, bytes, blob, isCss: mime.startsWith('text/css') || url.endsWith('.css') });
        } catch (e) {
          const reason = String(e?.message || e);
          failures.push({ url, status: parseInt(reason) || 0, reason });
        } finally {
          inFlight--;
          try { chrome.runtime.sendMessage({ type: 'GETINSPIRE_PROGRESS', downloaded: (map.size + failures.length + skipCount), total: queue.length }); } catch {}
          try { if (toId) clearTimeout(toId); } catch {}
          try { if (controller) controllers.delete(controller); } catch {}
          resolve();
        }
      };
      run();
    });

    const workers = [];
    for (let i = 0; i < cfg.concurrency; i++) workers.push((async function loop(){
      while (idx < queue.length && map.size < cfg.maxAssets && !state.stopped && !stopReason) {
        await next();
      }
    })());
    await Promise.all(workers);

    function dedupe(name) {
      const count = (seenName.get(name) || 0) + 1;
      seenName.set(name, count);
      if (count === 1) return name;
      const dot = name.lastIndexOf('.');
      if (dot === -1) return `${name}-${count}`;
      return `${name.slice(0, dot)}-${count}${name.slice(dot)}`;
    }

    return { map, failures, successCount: map.size, totalBytes, stopReason };
  }

  function isVideoUrl(url) {
    try {
      const p = new URL(url, document.baseURI).pathname.toLowerCase();
      return [
        '.mp4', '.webm', '.m4v', '.mov', '.ogv', '.m3u8', '.ts', '.m2ts', '.3gp'
      ].some(ext => p.endsWith(ext));
    } catch { return false; }
  }

  function fetchViaBackground(url) {
    return new Promise((resolve, reject) => {
      const id = Math.random().toString(36).slice(2);
      const onMsg = (msg) => {
        if (msg?.type === 'GETINSPIRE_FETCH_RESULT' && msg.id === id) {
          try { chrome.runtime.onMessage.removeListener(onMsg); } catch {}
          if (!msg.ok) return reject(new Error(msg.error || 'fetch-failed'));
          const blob = new Blob([msg.arrayBuffer], { type: msg.contentType || 'application/octet-stream' });
          resolve({ blob, mime: msg.contentType || 'application/octet-stream' });
        }
      };
      chrome.runtime.onMessage.addListener(onMsg);
      chrome.runtime.sendMessage({ type: 'GETINSPIRE_FETCH', id, url }).catch(err => {
        try { chrome.runtime.onMessage.removeListener(onMsg); } catch {}
        reject(err);
      });
      // Safety timeout
      setTimeout(() => {
        try { chrome.runtime.onMessage.removeListener(onMsg); } catch {}
        reject(new Error('fetch-timeout'));
      }, 25000);
    });
  }

  function extFromUrlOrMime(url, mime) {
    try {
      const p = new URL(url).pathname;
      const dot = p.lastIndexOf('.');
      if (dot !== -1 && dot > p.lastIndexOf('/')) {
        const ext = p.slice(dot).split(/[?#]/)[0];
        if (ext.length <= 6) return ext;
      }
    } catch {}
    const table = {
      'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/gif': '.gif', 'image/svg+xml': '.svg',
      'text/css': '.css', 'text/javascript': '.js', 'application/javascript': '.js', 'application/x-javascript': '.js',
      'font/woff2': '.woff2', 'font/woff': '.woff', 'font/ttf': '.ttf',
      'audio/mpeg': '.mp3', 'video/mp4': '.mp4'
    };
    return table[mime] || '';
  }
  function safeBaseName(url) {
    return url.replace(/[^a-z0-9]+/gi, '-').slice(0, 80) || 'asset';
  }

  async function rewriteHtmlAndCss(html, map, inlineCssTexts) {
    // Rewrites only when a URL exists in map; leaves others untouched.
    const base = document.baseURI;

    // Neutralize <base> tag which can break offline paths
    html = html.replace(/<base\b[^>]*>/i, '');

    // src|href|poster
    html = html.replace(/\b(src|href|poster)=(["'])([^"']+)(\2)/gi, (m, a, q, u) => {
      try {
        const abs = new URL(u, base).href;
        const entry = map.get(abs);
        return `${a}=${q}${entry ? entry.path : u}${q}`;
      } catch { return m; }
    });

    // srcset
    html = html.replace(/\bsrcset=(["'])([^"']+)(\1)/gi, (m, q, val) => {
      const parts = val.split(',').map(part => {
        const [u, d] = part.trim().split(/\s+/);
        try {
          const abs = new URL(u, base).href;
          const entry = map.get(abs);
          return (entry ? entry.path : u) + (d ? (' ' + d) : '');
        } catch { return part; }
      });
      return `srcset=${q}${parts.join(', ')}${q}`;
    });

    // Inline style attributes url(...)
    html = html.replace(/style=(["'])([^"']*)(\1)/gi, (m, q, s) => {
      const rewritten = s.replace(/url\(([^)]+)\)/g, (mm, inside) => {
        let raw = inside.trim().replace(/^['"]|['"]$/g,'');
        if (raw.startsWith('data:')) return mm;
        try {
          const abs = new URL(raw, base).href;
          const entry = map.get(abs);
          return entry ? `url(${entry.path})` : mm;
        } catch { return mm; }
      });
      return `style=${q}${rewritten}${q}`;
    });

    // Inline <style> blocks url() and @import
    html = html.replace(/<style(\b[^>]*)>([\s\S]*?)<\/style>/gi, (m, attrs, css) => {
      const css1 = css
        .replace(/url\(([^)]+)\)/g, (mm, inside) => {
          const raw = inside.trim().replace(/^['"]|['"]$/g,'');
          if (raw.startsWith('data:')) return mm;
          try {
            const abs = new URL(raw, base).href;
            const entry = map.get(abs);
            return entry ? `url(${entry.path})` : mm;
          } catch { return mm; }
        })
        .replace(/@import\s+(?:url\()?\s*['"]?([^'"\)]+)['"]?\s*\)?/g, (mm, u) => {
          try {
            const abs = new URL(u, base).href;
            const entry = map.get(abs);
            return entry ? `@import url(${entry.path})` : mm;
          } catch { return mm; }
        });
      return `<style${attrs}>${css1}</style>`;
    });

    // Downloaded CSS files: rewrite their contents
    for (const [origUrl, info] of map) {
      if (info.isCss) {
        const cssText = await info.blob.text();
        const rewrittenCss = cssText
          .replace(/url\(([^)]+)\)/g, (m2, inside) => {
            const raw = inside.trim().replace(/^['"]|['"]$/g,'');
            if (raw.startsWith('data:')) return m2;
            try {
              const abs = new URL(raw, origUrl).href;
              const entry = map.get(abs);
              return entry ? `url(${entry.path})` : m2;
            } catch { return m2; }
          })
          .replace(/@import\s+(?:url\()?\s*['"]?([^'"\)]+)['"]?\s*\)?/g, (m2, u) => {
            try {
              const abs = new URL(u, origUrl).href;
              const entry = map.get(abs);
              return entry ? `@import url(${entry.path})` : m2;
            } catch { return m2; }
          });
        map.set(origUrl, { ...info, blob: new Blob([rewrittenCss], { type: 'text/css' }) });
      }
    }

    return html;
  }

  async function buildZip({ indexHtml, assets, reportJson, readmeMd, quickCheckHtml, sizeCap }) {
    const zip = new window.JSZip();
    zip.file('index.html', indexHtml);
    zip.file('quick-check.html', quickCheckHtml);
    zip.file('report/README.md', readmeMd);
    zip.file('report/fetch-report.json', reportJson);
    for (const [_, entry] of assets) {
      zip.file(entry.path, entry.blob);
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    if (blob.size > sizeCap) throw new Error('ZIP too large. Try limiting the page.');
    return { blob };
  }

  function quickCheckHtml() {
    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>GetInspire Quick Check</title>
    <style>
      body { font: 14px/1.5 system-ui, sans-serif; margin: 0; display: grid; grid-template-columns: 320px 1fr; height: 100vh; }
      aside { padding: 12px; border-right: 1px solid #ddd; overflow:auto; }
      main { height: 100%; }
      iframe { width: 100%; height: 100%; border: 0; }
      h2 { margin: 8px 0; font-size: 16px; }
      .ok { color: #0a0; }
      .fail { color: #a00; }
      code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; }
      ul { padding-left: 18px; }
    </style>
  </head>
  <body>
    <aside>
      <h2>Quick Check</h2>
      <div id="summary">Loading report...</div>
      <h3>Top failures</h3>
      <ul id="fails"></ul>
    </aside>
    <main>
      <iframe src="index.html"></iframe>
    </main>
    <script>
      fetch('report/fetch-report.json').then(r => r.json()).then(r => {
        const s = r.stats || {};
        const ok = s.assetsDownloaded || 0;
        const fail = s.assetsFailed || 0;
        const skip = s.assetsSkipped || 0;
        document.getElementById('summary').innerHTML = 
          '<div><b>URL:</b> <code>' + (r.pageUrl||'') + '</code></div>' +
          '<div><b>Captured:</b> ' + (r.capturedAt||'') + '</div>' +
          '<div><b>Assets:</b> ' + ok + ' ok, ' + fail + ' failed, ' + skip + ' skipped</div>' +
          '<div><b>ZIP:</b> ' + (s.zipBytes||0) + ' bytes</div>' +
          '<div><b>Notes:</b> ' + (r.notes||[]).join('; ') + '</div>';
        const ul = document.getElementById('fails');
        (r.failures||[]).slice(0,20).forEach(f => {
          const li = document.createElement('li');
          li.textContent = (f.status?('['+f.status+'] '):'') + f.url + (f.reason?(' - ' + f.reason):'');
          ul.appendChild(li);
        });
      }).catch(e => {
        document.getElementById('summary').textContent = 'Report not found: ' + e;
      });
    </script>
  </body>
  </html>`;
  }

  function buildReadme(report) {
    const lines = [];
    lines.push(`# GetInspire Fetch Report`);
    lines.push('');
    lines.push(`Source: ${report.pageUrl}`);
    lines.push(`Captured: ${report.capturedAt}`);
    lines.push('');
    lines.push('## Summary');
    lines.push(`- Assets total: ${report.stats.assetsTotal}`);
    lines.push(`- Downloaded: ${report.stats.assetsDownloaded}`);
    lines.push(`- Failed: ${report.stats.assetsFailed}`);
    lines.push(`- Skipped: ${report.stats.assetsSkipped}`);
    lines.push(`- ZIP bytes: ${report.stats.zipBytes}`);
    lines.push(`- Duration ms: ${report.stats.durationMs}`);
    lines.push('');
    lines.push('## Endless detection');
    lines.push(`- Denied by list: ${report.endlessDetection.deniedByList}`);
    lines.push(`- Stabilized: ${report.endlessDetection.stabilized}`);
    lines.push(`- Reason: ${report.endlessDetection.reason ?? 'n/a'}`);
    lines.push('');
    lines.push('## Failures (top 20)');
    for (const f of report.failures.slice(0,20)) lines.push(`- ${f.status||''} ${f.url} - ${f.reason||''}`);
    lines.push('');
    lines.push('## Redactions');
    for (const r of report.redactions) lines.push(`- ${r.selector} (len=${r.length}) - ${r.reason}`);
    lines.push('');
    lines.push('## Notes');
    for (const n of report.notes) lines.push(`- ${n}`);
    lines.push('');
    lines.push('## Limitations');
    lines.push('- Third-party iframes left as-is and may not work offline.');
    lines.push('- Back-end APIs are not mirrored.');
    lines.push('- Infinite feeds are blocked or timed out by heuristic.');
    return lines.join('\n');
  }

})();
