;(async () => {
  if (window.__GETINSPIRE_RUNNING__) return;
  window.__GETINSPIRE_RUNNING__ = true;

  // --- defaults, can be overridden from options ---
  const { defaults } = await import(chrome.runtime.getURL('src/defaults.js'));

  const state = {
    stopped: false,
    started: Date.now(),
    report: baseReport(),
  };

  // Options loaded at runtime, available to helpers via closure
  let options;
  let overlay = null;

  const sendStatus = (text) => {
    try { if (overlay) overlay.setStatus(text); } catch {}
    chrome.runtime.sendMessage({ type: 'GETINSPIRE_STATUS', text }).catch(() => {});
  };
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
    try { if (overlay) overlay.remove(); } catch {}
  };

  chrome.runtime.onMessage.addListener(onRuntimeMessage);

  ;(async function main() {
    if (!window.JSZip) return fail('Internal error: ZIP library missing.');
    options = await loadOptions();
    if (options.showOverlay) overlay = createOverlay();
    const denylistRe = compileDenylist(options.denylist);

    // Denylist gate
    state.report.endlessDetection.deniedByList = denylistRe.some(re => re.test(location.href));
    if (state.report.endlessDetection.deniedByList) {
      state.report.endlessDetection.reason = 'denylist';
      return fail('This URL matches the denylist (likely an endless feed). You can override this in Options.');
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

    // Normalize lazy media and stabilize carousels before we snapshot
    try {
      sendStatus('Normalizing lazy media & carousels...');
      await normalizePageForSnapshot({ includeVideo: !options.skipVideo });
    } catch (e) { console.error(e); }

    // For highly dynamic apps (e.g., YouTube), wait for real content to
    // replace skeletons before snapshotting. This avoids saving a page of
    // placeholders.
    try {
      const host = location.hostname || '';
      const path = location.pathname || '';
      const isYouTube = /(^|\.)youtube\.com$/i.test(host);
      const isPlaylistSurface = /\/playlist|\/feed\/playlists/i.test(path);
      if (isYouTube && isPlaylistSurface) {
        sendStatus('Waiting for playlists to render...');
        await waitForYouTubePlaylistReady(9000).catch(()=>{});
      }
    } catch (e) { console.error(e); }

    // Redaction happens on cloned snapshot below (not mutating live DOM)

    // Collect assets & initial HTML snapshot
    sendStatus('Collecting assets...');
    const collected = await collectPageAssets({ replaceIframesWithPoster: options.replaceIframesWithPoster });
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
      } catch (e) { console.error(e); }
    }

    // Download assets with concurrency and caps
    const totalAssets = collected.urls.size;
    sendStatus(`Downloading ${totalAssets} assets...`);
    try { chrome.runtime.sendMessage({ type: 'GETINSPIRE_PROGRESS', downloaded: 0, total: totalAssets }); } catch (e) { console.error(e); }
    try { if (overlay) overlay.setProgress(0, totalAssets); } catch {}
    const dres = await downloadAllAssets(collected.urls, {
      concurrency: options.concurrency,
      maxAssets: options.maxAssets,
      maxZipBytes: options.maxZipMB * 1024 * 1024,
      started: state.started,
      maxMillis: options.maxMillis,
      requestTimeoutMs: defaults.requestTimeoutMs,
      onProgress: (done, total) => { try { if (overlay) overlay.setProgress(done, total); } catch {} }
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
    // Force-strip scripts on YouTube so the saved page renders as a static
    // snapshot offline (their app JS tends to blank the DOM when network is missing).
    const ytForceStrip = ((/(^|\.)youtube\.com$/i.test(location.hostname||'')) && /\/playlist|\/feed\/playlists/i.test(location.pathname||''));
    // Site-specific CSS fixes (applied inline to the saved HTML)
    let siteCss = '';
    try {
      const isYT = /(^|\.)youtube\.com$/i.test(location.hostname||'');
      if (isYT) {
        siteCss += [
          // Hide transient spinners/overlays and top nav progress bar
          'ytd-thumbnail-overlay-loading-preview-renderer,',
          'tp-yt-paper-spinner,',
          'paper-spinner,',
          'yt-page-navigation-progress,',
          'ytd-shimmer { display: none !important; }',
        ].join('\n');
      }
    } catch {}
    const htmlRewritten = await rewriteHtmlAndCss(htmlForRewrite, dres.map, collected.inlineCssTexts, { stripScripts: ytForceStrip || options.stripScripts, iframeRepls: collected.iframeRepls || [], fontFallback: options.fontFallback, siteCss });

    // Assemble report content
    state.report.pageUrl = location.href;
    state.report.capturedAt = new Date().toISOString();
    state.report.stats.durationMs = Date.now() - state.started;
    state.report.notes.push('Third-party iframes left as-is; may not work offline');
    state.report.stats.coveragePct = totalAssets ? Math.round((dres.successCount * 100) / totalAssets) : 100;

    // Build manifest and optionally include MHTML snapshot (if permitted)
    const manifest = buildAssetManifest(dres.map);
    let mhtmlAb = null;
    try { mhtmlAb = await getMHTML(8000).catch(() => null); } catch {}

    // Use rewritten HTML as the primary index to avoid blank pages on systems
    // where file:// MHTML viewing is disabled. MHTML is still included as an
    // artifact under report/page.mhtml.
    const indexHtmlOut = bannered(htmlRewritten);

    // Build ZIP with two-pass to embed accurate report size
    sendStatus('Packing ZIP...');
    const { blob: blob1 } = await buildZip({
      indexHtml: indexHtmlOut,
      assets: dres.map,
      reportJson: JSON.stringify(state.report, null, 2),
      readmeMd: buildReadme(state.report),
      quickCheckHtml: quickCheckHtml(state.report),
      extras: [
        { path: 'report/asset-manifest.json', type: 'text', data: JSON.stringify(manifest, null, 2) },
        ...(mhtmlAb ? [{ path: 'report/page.mhtml', type: 'blob', data: new Blob([mhtmlAb], { type: 'multipart/related' }) }] : [])
      ],
      sizeCap: options.maxZipMB * 1024 * 1024,
    });
    state.report.stats.zipBytes = blob1.size;
    state.report.stats.durationMs = Date.now() - state.started;

    const { blob } = await buildZip({
      indexHtml: indexHtmlOut,
      assets: dres.map,
      reportJson: JSON.stringify(state.report, null, 2),
      readmeMd: buildReadme(state.report),
      quickCheckHtml: quickCheckHtml(state.report),
      extras: [
        { path: 'report/asset-manifest.json', type: 'text', data: JSON.stringify(manifest, null, 2) },
        ...(mhtmlAb ? [{ path: 'report/page.mhtml', type: 'blob', data: new Blob([mhtmlAb], { type: 'multipart/related' }) }] : [])
      ],
      sizeCap: options.maxZipMB * 1024 * 1024,
    });

    if (state.stopped) return fail('Stopped by user.');

    // Hand off to background for download
    const safeHost = location.hostname.replace(/[^a-z0-9.-]/gi, '-');
    const filename = `getinspire-${safeHost}-${new Date().toISOString().replace(/[:.]/g,'-')}.zip`;
    const URLRef = (window.URL || self.URL);
    const blobUrl = URLRef.createObjectURL(blob);
    chrome.runtime.sendMessage({ type: 'GETINSPIRE_DOWNLOAD_ZIP', blobUrl, filename });
    // Revoke in the creating context as a fallback/safety
    try { setTimeout(() => { try { URLRef.revokeObjectURL(blobUrl); } catch {} }, 30000); } catch {}
      try { chrome.runtime.sendMessage({ type: 'GETINSPIRE_PROGRESS', downloaded: totalAssets, total: totalAssets }); } catch (e) { console.error(e); }
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
        coveragePct: 0,
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

  function mhtmlLauncherHtml() {
    const target = 'report/page.mhtml';
    const html = `<!doctype html>\n<html><head><meta charset="utf-8" />\n<meta http-equiv="refresh" content="0; url=${target}">\n<title>GetInspire Snapshot</title>\n<style>body{font:14px system-ui,sans-serif;padding:16px}</style></head>\n<body>\n<p>If you are not redirected, open <a href="${target}">page.mhtml</a>.</p>\n</body></html>`;
    return bannered(html);
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
            skipVideo: o.skipVideo ?? defaults.skipVideo,
            stripScripts: o.stripScripts ?? defaults.stripScripts,
            fontFallback: o.fontFallback ?? defaults.fontFallback,
            showOverlay: o.showOverlay ?? defaults.showOverlay,
            replaceIframesWithPoster: o.replaceIframesWithPoster ?? defaults.replaceIframesWithPoster,
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
        } catch (e) { console.error(e); }
    }
    return out;
  }

  async function autoScrollUntilStable({ idleMs, maxIters, started, maxMillis }) {
    // Consider the page "stable" when content height hasn't grown for
    // a while, rather than when there are no DOM mutations. This avoids
    // false positives on dynamic pages (e.g., media timers, live chats).
    return new Promise((resolve, reject) => {
      let iter = 0;
      let lastH = document.documentElement.scrollHeight;
      let lastHChange = Date.now();

      const step = () => {
        if (Date.now() - started > maxMillis) {
          return reject(new Error('Page took too long; likely endless.'));
        }
        if (state.stopped) {
          return reject(new Error('Stopped by user.'));
        }

        const doc = document.documentElement;
        const atBottom = Math.abs(window.scrollY + window.innerHeight - doc.scrollHeight) < 4;
        if (!atBottom) window.scrollTo(0, doc.scrollHeight);

        // Track only changes in page height as a sign of new content.
        const h = doc.scrollHeight;
        if (Math.abs(h - lastH) > 2) { lastH = h; lastHChange = Date.now(); }

        iter++;
        const heightIdle = Date.now() - lastHChange > idleMs;
        if (atBottom && heightIdle) return resolve({ stabilized: true });
        // If we hit the iteration cap, proceed anyway to avoid false
        // endless-detection on dynamic but finite pages (e.g., video sites).
        if (iter > maxIters) return resolve({ stabilized: true, reason: 'iter-cap' });
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

    // ID/class hints (kept conservative to avoid false positives)
    // Removed overly-generic terms like "name", "member", "customer", and "dashboard".
    const hintRe = /(user|username|account|profile|email|token|auth|secure|private)/i;
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

  async function collectPageAssets({ replaceIframesWithPoster = true } = {}) {
    const urls = new Set();
    const skipped = [];
    const inlineCssTexts = [];
    const iframeRepls = [];

    const add = (u, ctx) => {
      try {
        if (!u) return;
        if (u.startsWith('data:')) { skipped.push({ url: u.slice(0, 64) + (u.length > 64 ? '...' : ''), reason: 'data-uri' }); return; }
        const abs = new URL(u, document.baseURI).href;
        urls.add(abs);
        } catch (e) { console.error(e); }
    };

    // Elements with src (exclude iframes; optional: skip video)
    document.querySelectorAll('img[src], script[src], audio[src], video[src], track[src], source[src]').forEach(el => {
      const tag = el.tagName;
      if (tag === 'IFRAME') return;
      if ((tag === 'VIDEO' || (tag === 'SOURCE' && el.closest('video')) || (tag === 'TRACK' && el.closest('video'))) && (options?.skipVideo ?? true)) {
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

    // Computed background and mask images (covers CSS modules/classes)
    document.querySelectorAll('*').forEach(el => {
      try {
        const cs = getComputedStyle(el);
        const props = [
          'background-image','background','mask','mask-image','border-image-source','list-style-image','content','cursor'
        ];
        for (const p of props) {
          const v = cs.getPropertyValue(p);
          if (v && v.includes('url(')) extractCssUrls(v).forEach(u => add(u));
        }
      } catch (e) { /* ignore */ }
    });

    // External video iframes → poster thumbnails (e.g., YouTube)
    if (replaceIframesWithPoster) {
      document.querySelectorAll('iframe[src]').forEach(ifr => {
        const src = ifr.getAttribute('src');
        if (!src) return;
        const yt = youtubePosterFromEmbed(src);
        if (yt) {
          add(yt.posterUrl);
          iframeRepls.push({ originalSrc: new URL(src, document.baseURI).href, posterUrl: yt.posterUrl, linkUrl: yt.linkUrl, title: ifr.getAttribute('title') || 'Video' });
        }
      });
    }

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
        } catch (e) { console.error(e); }
    }));

    // Preload links for styles/scripts/fonts/images/modules
    document.querySelectorAll('link[rel="preload"][as][href], link[rel="modulepreload"][href]').forEach(el => {
      const as = (el.getAttribute('as')||'').toLowerCase();
      if (['style','script','font','image','fetch',''].includes(as)) add(el.getAttribute('href'));
    });

    // Canonical README/Markdown images
    document.querySelectorAll('img[data-canonical-src]').forEach(el => { const u = el.getAttribute('data-canonical-src'); if (u) add(u); });

    // CurrentSrc of images (selected candidate from srcset/picture)
    document.querySelectorAll('img').forEach(im => { try { if (im.currentSrc && !im.currentSrc.startsWith('data:')) add(im.currentSrc); } catch {} });

    // External SVG sprite references via <use>
    // Avoid namespaced attribute selectors which can be invalid in querySelectorAll
    document.querySelectorAll('use').forEach(u => {
      let val = u.getAttribute('href') || u.getAttribute('xlink:href');
      // Fallback to explicit namespace API if present
      try {
        if (!val && typeof u.getAttributeNS === 'function') {
          val = u.getAttributeNS('http://www.w3.org/1999/xlink', 'href');
        }
      } catch {}
      if (!val) return;
      if (val.startsWith('#')) return;
      add(val);
    });

    const html = serializeDomWithDeclarativeShadowDom();
    return { urls, html, skipped, inlineCssTexts, totalAssetCandidates: urls.size, iframeRepls };
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

  // Serialize the current document to HTML and materialize shadow DOM
  // into Declarative Shadow DOM (<template shadowroot="open">) so that
  // components such as YouTube's Polymer elements render offline.
  function serializeDomWithDeclarativeShadowDom() {
    try {
      const marker = 'data-getinspire-shadow-host';
      const hosts = [];
      let counter = 0;
      // Mark hosts that have an open shadow root and collect their HTML
      document.querySelectorAll('*').forEach(el => {
        try {
          if (el.shadowRoot) {
            const id = 's' + (++counter);
            el.setAttribute(marker, id);
            let html = '';
            try { html = el.shadowRoot.innerHTML || ''; } catch {}
            hosts.push({ id, html });
          }
        } catch {}
      });

      const raw = '<!doctype html>\n' + document.documentElement.outerHTML;

      // Clean markers from the live page right away (best-effort)
      try { document.querySelectorAll('[' + marker + ']').forEach(el => el.removeAttribute(marker)); } catch {}

      const parsed = new DOMParser().parseFromString(raw, 'text/html');
      for (const h of hosts) {
        try {
          const host = parsed.querySelector('[' + marker + '="' + h.id + '"]');
          if (!host) continue;
          try { host.removeAttribute(marker); } catch {}
          const tmpl = parsed.createElement('template');
          // Use the widely supported attribute name
          tmpl.setAttribute('shadowroot', 'open');
          tmpl.innerHTML = h.html || '';
          host.insertBefore(tmpl, host.firstChild);
        } catch {}
      }
      return '<!doctype html>\n' + parsed.documentElement.outerHTML;
    } catch (e) {
      // Fallback to plain outerHTML if anything goes wrong
      try { return '<!doctype html>\n' + document.documentElement.outerHTML; } catch { return '<!doctype html>'; }
    }
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
      controllers.forEach((c) => { try { c.abort(); } catch (e) { console.error(e); } });
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
          if ((options?.skipVideo ?? true) && isVideoUrl(url)) {
            state.report.skipped.push({ url, reason: 'video' });
            skipCount++;
            return resolve();
          }
            controller = new AbortController();
            controllers.add(controller);
            toId = setTimeout(() => { try { controller.abort('timeout'); } catch (e) { console.error(e); } }, cfg.requestTimeoutMs || 20000);
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
            const sha256 = await sha256Base64(blob).catch(() => null);
            const ext = extFromUrlOrMime(url, mime);
            const base = safeBaseName(url);
            const filename = dedupe(`${base}${ext}`);
            const path = `assets/${filename}`;
            totalBytes += bytes;
            if (totalBytes > cfg.maxZipBytes) { markStop('zip-too-large'); throw new Error('zip-too-large'); }
            map.set(url, { path, mime, bytes, blob, sha256, isCss: mime.startsWith('text/css') || url.endsWith('.css') });
            return resolve();
          }
          if (!res.ok) throw new Error(String(res.status || 'fetch-failed'));
          const blob = await res.blob();
          const bytes = blob.size || 0;
          const mime = blob.type || 'application/octet-stream';
          const sha256 = await sha256Base64(blob).catch(() => null);
          const ext = extFromUrlOrMime(url, mime);
          const base = safeBaseName(url);
          const filename = dedupe(`${base}${ext}`);
          const path = `assets/${filename}`;
          totalBytes += bytes;
          if (totalBytes > cfg.maxZipBytes) { markStop('zip-too-large'); throw new Error('zip-too-large'); }
          map.set(url, { path, mime, bytes, blob, sha256, isCss: mime.startsWith('text/css') || url.endsWith('.css') });
        } catch (e) {
          const reason = String(e?.message || e);
          failures.push({ url, status: parseInt(reason) || 0, reason });
        } finally {
          inFlight--;
            try { chrome.runtime.sendMessage({ type: 'GETINSPIRE_PROGRESS', downloaded: (map.size + failures.length + skipCount), total: queue.length }); } catch (e) { console.error(e); }
            try { if (cfg?.onProgress) cfg.onProgress((map.size + failures.length + skipCount), queue.length); } catch {}
            try { if (toId) clearTimeout(toId); } catch (e) { console.error(e); }
            try { if (controller) controllers.delete(controller); } catch (e) { console.error(e); }
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
            try { chrome.runtime.onMessage.removeListener(onMsg); } catch (e) { console.error(e); }
          if (!msg.ok) return reject(new Error(msg.error || 'fetch-failed'));
          const blob = new Blob([msg.arrayBuffer], { type: msg.contentType || 'application/octet-stream' });
          resolve({ blob, mime: msg.contentType || 'application/octet-stream' });
        }
      };
      chrome.runtime.onMessage.addListener(onMsg);
      chrome.runtime.sendMessage({ type: 'GETINSPIRE_FETCH', id, url }).catch(err => {
          try { chrome.runtime.onMessage.removeListener(onMsg); } catch (e) { console.error(e); }
        reject(err);
      });
      // Safety timeout
      setTimeout(() => {
          try { chrome.runtime.onMessage.removeListener(onMsg); } catch (e) { console.error(e); }
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
    } catch (e) { console.error(e); }
    const table = {
      // Images
      'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/gif': '.gif', 'image/svg+xml': '.svg',
      'image/avif': '.avif', 'image/x-icon': '.ico', 'image/vnd.microsoft.icon': '.ico',
      // Styles & Scripts
      'text/css': '.css', 'text/javascript': '.js', 'application/javascript': '.js', 'application/x-javascript': '.js',
      'application/json': '.json', 'application/manifest+json': '.json', 'text/plain': '.txt',
      // Fonts
      'font/woff2': '.woff2', 'font/woff': '.woff', 'font/ttf': '.ttf', 'font/otf': '.otf', 'application/vnd.ms-fontobject': '.eot',
      // Audio
      'audio/mpeg': '.mp3', 'audio/ogg': '.ogg', 'audio/wav': '.wav', 'audio/aac': '.aac', 'audio/flac': '.flac', 'audio/midi': '.midi', 'audio/x-midi': '.midi',
      // Video
      'video/mp4': '.mp4', 'video/webm': '.webm', 'application/vnd.apple.mpegurl': '.m3u8', 'application/x-mpegURL': '.m3u8', 'video/MP2T': '.ts'
    };
    return table[mime] || '';
  }
  function safeBaseName(url) {
    return url.replace(/[^a-z0-9]+/gi, '-').slice(0, 80) || 'asset';
  }

  async function rewriteHtmlAndCss(html, map, inlineCssTexts, opts = {}) {
    // Rewrites only when a URL exists in map; leaves others untouched.
    const base = document.baseURI;

    // Neutralize <base> tag which can break offline paths
    html = html.replace(/<base\b[^>]*>/i, '');
    // Remove CSP meta tag to allow local asset loading
    html = html.replace(/<meta[^>]+http-equiv=["']content-security-policy["'][^>]*>/gi, '');
    // Remove attributes that block local loading
    html = html.replace(/\s(integrity|crossorigin|referrerpolicy|nonce)=(["'][^"']*["']|[^\s>]+)/gi, '');
    // Convert rel=preload as=style to rel=stylesheet so CSS applies offline
    html = html.replace(/<link\b([^>]*\brel=(["'])preload\2[^>]*\bas=(["'])style\3[^>]*?)>/gi, (m, attrs) => {
      let a = attrs
        .replace(/\brel=(["'])preload\1/i, 'rel="stylesheet"')
        .replace(/\bas=(["'])style\1/i, '')
        .replace(/\bonload=(["'])[\s\S]*?\1/gi, '')
        .replace(/\bmedia=(["'])print\1/gi, 'media="all"');
      a = a.replace(/\s(integrity|crossorigin|referrerpolicy|nonce)=(["'][^"']*["']|[^\s>]+)/gi, '');
      return `<link ${a}>`;
    });

    // src|href|poster (preserve fragments like #icon)
    html = html.replace(/\b(src|href|poster)=(["'])([^"']+)(\2)/gi, (m, a, q, u) => {
      try {
        const abs = new URL(u, base).href;
        const entry = map.get(abs);
        if (!entry) return m;
        const hash = u.includes('#') ? u.slice(u.indexOf('#')) : '';
        return `${a}=${q}${entry.path}${hash}${q}`;
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

    // Additional safety CSS (responsive images, hide sr-only) when enabled
    if (opts.fontFallback) {
      const safetyCss = `\n<style id="getinspire-safety">img{max-width:100%;height:auto}.sr-only,.sr-only-focusable:not(:focus){position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}</style>`;
      html = html.replace(/<head\b[^>]*>/i, (m) => m + safetyCss);
    }
    // Site-specific CSS fixes injection
    if (opts.siteCss) {
      const siteCssTag = `\n<style id="getinspire-site-fixes">${opts.siteCss}</style>`;
      html = html.replace(/<head\b[^>]*>/i, (m) => m + siteCssTag);
    }

    // Add optional font fallback for better symbol rendering (₹ etc.)
    if (opts.fontFallback) {
      const fallbackCss = `\n<style id="getinspire-font-fallback">\n  @font-face {\n    font-family: "GetInspireSymbolFallback";\n    src: local("Nirmala UI"), local("Segoe UI Symbol"), local("Arial Unicode MS"), local("DejaVu Sans"), local("Noto Sans"), local("Noto Sans Symbols");\n    unicode-range: U+20A0-20CF; /* currency block includes ₹ */\n    font-display: swap;\n  }\n  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans', 'Helvetica Neue', Arial, 'GetInspireSymbolFallback', 'Noto Color Emoji', 'Segoe UI Emoji', sans-serif; }\n</style>`;
      html = html.replace(/<head\b[^>]*>/i, (m) => m + fallbackCss);
    }

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

    // Prefer canonical README image sources when available
    html = html.replace(/<img\b([^>]*?data-canonical-src=(["'])([^"']+)\2[^>]*)>/gi, (m, attrs, q, val) => {
      try {
        const abs = new URL(val, base).href; const entry = map.get(abs); if (!entry) return m;
        if (/\bsrc=(["'])([^"']+)\1/i.test(attrs)) return m.replace(/\bsrc=(["'])([^"']+)\1/i, `src="${entry.path}"`);
        return m.replace(/<img\b/, `<img src="${entry.path}" `);
      } catch { return m; }
    });

    // Rewrite external SVG sprite references in <use>
    html = html.replace(/<use\b([^>]*?(?:xlink:href|href)=(["'])([^"']+)\2[^>]*)>/gi, (m, attrs, q, val) => {
      try {
        const abs = new URL(val, base).href; const entry = map.get(abs); if (!entry) return m;
        const hash = val.includes('#') ? val.slice(val.indexOf('#')) : '';
        return `<use ${attrs.replace(/(?:xlink:href|href)=(["'])([^"']+)\1/i, `href="${entry.path}${hash}"`)}>`;
      } catch { return m; }
    });

    // Replace third-party iframes with downloaded thumbnails where available
    if (opts.iframeRepls && opts.iframeRepls.length) {
      for (const r of opts.iframeRepls) {
        try {
          const absPoster = new URL(r.posterUrl, base).href;
          const entry = map.get(absPoster);
          if (!entry) continue;
          const imgTag = `<a href="${r.linkUrl || r.originalSrc}" target="_blank" rel="noopener noreferrer"><img src="${entry.path}" alt="${(r.title||'Video').replace(/["<>]/g,'')}" style="max-width:100%;height:auto;display:block;border:0"/></a>`;
          const srcEsc = r.originalSrc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const pat = new RegExp(`<iframe[^>]*?src=(["'])${srcEsc}\\1[\s\S]*?>[\s\S]*?<\\/iframe>`, 'gi');
          html = html.replace(pat, imgTag);
        } catch (e) { console.error(e); }
      }
    }

    // Optionally strip scripts and inline handlers for offline safety
    if (opts.stripScripts) {
      html = html.replace(/<script\b[\s\S]*?<\/script>/gi, '');
      html = html.replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
      html = html.replace(/\bhref\s*=\s*(["']?)javascript:[^"'>\s]+\1/gi, 'href="#"');
    }

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

  async function buildZip({ indexHtml, assets, reportJson, readmeMd, quickCheckHtml, extras = [], sizeCap }) {
    const zip = new window.JSZip();
    zip.file('index.html', indexHtml);
    zip.file('quick-check.html', quickCheckHtml);
    zip.file('report/README.md', readmeMd);
    zip.file('report/fetch-report.json', reportJson);
    for (const ex of extras) {
      try {
        let data = ex.data;
        if (ex.type === 'text' && typeof data !== 'string') data = String(data);
        if (ex.type === 'arrayBuffer' && data && data.byteLength !== undefined && !(data instanceof Uint8Array)) data = new Uint8Array(data);
        if (data instanceof ArrayBuffer) data = new Uint8Array(data);
        zip.file(ex.path, data);
      } catch (e) { console.error('Failed to add extra to ZIP:', ex?.path, e); }
    }
    for (const [_, entry] of assets) {
      zip.file(entry.path, entry.blob);
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    if (blob.size > sizeCap) throw new Error('ZIP too large. Try limiting the page.');
    return { blob };
  }

  function quickCheckHtml(report) {
    // Embed report inline to avoid fetch() issues on file:// URLs
    const reportInline = (() => {
      try { return JSON.stringify(report).replace(/</g, '\\u003c'); } catch { return 'null'; }
    })();
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
      <iframe src="./index.html"></iframe>
    </main>
    <script>
      (function(){
        var r = (function(){ try { return (window.__GETINSPIRE_REPORT__ = ${reportInline}); } catch (e) { return null; } })();
        if (!r) {
          try {
            return fetch('./report/fetch-report.json').then(function(resp){ return resp.json(); }).then(applyReport);
          } catch (e) {
            document.getElementById('summary').textContent = 'Report not available';
            return;
          }
        }
        applyReport(r);
      })();

      function applyReport(r){
        const s = r.stats || {};
        const ok = s.assetsDownloaded || 0;
        const fail = s.assetsFailed || 0;
        const skip = s.assetsSkipped || 0;
        document.getElementById('summary').innerHTML = 
          '<div><b>URL:</b> <code>' + (r.pageUrl||'') + '</code></div>' +
          '<div><b>Captured:</b> ' + (r.capturedAt||'') + '</div>' +
          '<div><b>Assets:</b> ' + ok + ' ok, ' + fail + ' failed, ' + skip + ' skipped</div>' +
          (s.coveragePct != null ? ('<div><b>Coverage:</b> ' + s.coveragePct + '%</div>') : '') +
          '<div><b>ZIP:</b> ' + (s.zipBytes||0) + ' bytes</div>' +
          '<div><b>Notes:</b> ' + (r.notes||[]).join('; ') + '</div>';
        const ul = document.getElementById('fails');
        (r.failures||[]).slice(0,20).forEach(f => {
          const li = document.createElement('li');
          li.textContent = (f.status?('['+f.status+'] '):'') + f.url + (f.reason?(' - ' + f.reason):'');
          ul.appendChild(li);
        });
      }
    </script>
  </body>
  </html>`;
  }

  // ---- Site-specific waits ----
  async function waitForYouTubePlaylistReady(timeoutMs = 8000) {
    const t0 = Date.now();
    const ok = () => {
      try {
        // Consider ready when at least one playlist renderer has a thumbnail
        // image with a resolved http(s) src (not data:), or when shimmer is gone
        const items = Array.from(document.querySelectorAll('ytd-playlist-renderer'));
        const hasThumb = items.some(i => {
          const im = i.querySelector('img');
          return im && typeof im.src === 'string' && /^https?:/i.test(im.src);
        });
        const shimmering = document.querySelector('ytd-shimmer, [animated][hidden][aria-busy="true"]');
        return (items.length > 0 && hasThumb) || !shimmering;
      } catch { return false; }
    };
    while (Date.now() - t0 < timeoutMs) {
      if (ok()) return true;
      // Nudge scroll to trigger lazy loading
      try { window.scrollBy(0, 200); } catch {}
      await new Promise(r => setTimeout(r, 300));
    }
    return false;
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
    if (report.stats.coveragePct != null) lines.push(`- Coverage: ${report.stats.coveragePct}%`);
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

  // ---- Normalization helpers for better fidelity ----
  async function normalizePageForSnapshot({ includeVideo }) {
    try {
      // Convert common lazy attributes to real src/srcset
      const convertAttrs = (el, pairs) => {
        for (const [from, to] of pairs) {
          const v = el.getAttribute(from);
          if (v && !el.getAttribute(to)) el.setAttribute(to, v);
        }
      };
      const pairs = [
        ['data-src','src'], ['data-original','src'], ['data-lazy','src'], ['data-lazy-src','src'], ['data-llsrc','src'],
        ['data-srcset','srcset'], ['data-lazy-srcset','srcset'], ['data-llsrcset','srcset']
      ];
      document.querySelectorAll('img, source').forEach(el => {
        convertAttrs(el, pairs);
        if (el.tagName === 'IMG') { try { el.loading = 'eager'; el.decoding = 'sync'; } catch {} }
      });
      if (includeVideo) {
        document.querySelectorAll('video, audio, source').forEach(el => convertAttrs(el, pairs));
        document.querySelectorAll('video').forEach(v => { try { v.preload = 'metadata'; } catch {} });
      }
      // Wait briefly for image decodes
      const pending = Array.from(document.images).filter(im => im.src && !im.complete).slice(0, 200);
      await Promise.race([
        Promise.allSettled(pending.map(im => im.decode ? im.decode().catch(()=>{}) : new Promise(r=>{ im.addEventListener('load',r,{once:true}); im.addEventListener('error',r,{once:true}); setTimeout(r,1500);}))),
        new Promise(r => setTimeout(r, 2500))
      ]);
      // Loosen obvious carousels so slides aren't cropped, but avoid global
      // transform resets which can badly distort iconography (e.g., YouTube).
      const isYouTubeDomain = /(^|\.)youtube\.com$/i.test(location.hostname||'');
      const carSel = '[class*="carousel"], [class*="slider"], [class*="slick"], [class*="swiper"], [data-carousel]';
      document.querySelectorAll(carSel).forEach(c => {
        try {
          const cs = getComputedStyle(c);
          if (cs.overflowX === 'hidden' || /hidden|clip/.test(cs.overflow)) c.style.overflow = 'visible';
          // Only neutralize transforms on typical carousel wrappers; skip on YouTube
          if (!isYouTubeDomain && cs.transform && cs.transform !== 'none') c.style.transform = 'none';
        } catch {}
      });
      // Global transform stripping removed (caused giant icons on some sites).
    } catch (e) { console.error(e); }
  }

  function youtubePosterFromEmbed(src) {
    try {
      const u = new URL(src, document.baseURI);
      if (/youtube\.com\/embed\//.test(u.href)) {
        const id = u.pathname.split('/').pop();
        return { posterUrl: `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`, linkUrl: `https://www.youtube.com/watch?v=${id}` };
      }
      if (/youtu\.be\//.test(u.href)) {
        const id = u.pathname.split('/').pop();
        return { posterUrl: `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`, linkUrl: `https://www.youtube.com/watch?v=${id}` };
      }
    } catch {}
    return null;
  }

  // ---- helpers: digest, manifest, overlay, mhtml ----
  async function sha256Base64(blob) {
    const buf = await blob.arrayBuffer();
    const hash = await crypto.subtle.digest('SHA-256', buf);
    let binary = '';
    const bytes = new Uint8Array(hash);
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return 'sha256-' + btoa(binary);
  }

  function buildAssetManifest(map) {
    const out = { generatedAt: new Date().toISOString(), assets: [] };
    for (const [url, info] of map) out.assets.push({ url, path: info.path, bytes: info.bytes, mime: info.mime, sha256: info.sha256 || null });
    return out;
  }

  function createOverlay() {
    try {
      const root = document.createElement('div');
      root.style.cssText = 'position:fixed;top:12px;right:12px;z-index:2147483647;background:rgba(0,0,0,0.8);color:#fff;padding:8px 10px;border-radius:8px;font:12px/1.4 system-ui,sans-serif;box-shadow:0 2px 12px rgba(0,0,0,0.4);min-width:200px;pointer-events:auto;';
      root.innerHTML = '<div id="gi-status">Starting...</div><div style="margin-top:6px;height:6px;background:#333;border-radius:3px;overflow:hidden;"><div id="gi-bar" style="height:100%;width:0%;background:#3b82f6;transition:width .2s ease"></div></div><div style="margin-top:6px;text-align:right"><button id="gi-stop" style="background:#ef4444;color:#fff;border:0;border-radius:6px;padding:4px 8px;cursor:pointer">Stop</button></div>';
      document.documentElement.appendChild(root);
      const statusEl = root.querySelector('#gi-status');
      const barEl = root.querySelector('#gi-bar');
      const stopBtn = root.querySelector('#gi-stop');
      stopBtn.addEventListener('click', () => {
        try { chrome.runtime.sendMessage({ type: 'GETINSPIRE_STOP' }); } catch {}
        stopBtn.disabled = true;
      });
      return {
        setStatus(s){ if (statusEl) statusEl.textContent = s; },
        setProgress(done,total){ total=Math.max(1,Number(total)||1); done=Math.max(0,Math.min(total,Number(done)||0)); const pct = Math.floor((done*100)/total); if (barEl) barEl.style.width = Math.min(99,pct)+'%'; },
        remove(){ try { root.remove(); } catch {} }
      };
    } catch { return { setStatus(){}, setProgress(){}, remove(){} }; }
  }

  function getMHTML(timeoutMs = 8000) {
    return new Promise((resolve, reject) => {
      try {
        const id = Math.random().toString(36).slice(2);
        const onMsg = (msg) => {
          if (msg?.type === 'GETINSPIRE_MHTML_RESULT' && msg.id === id) {
            try { chrome.runtime.onMessage.removeListener(onMsg); } catch {}
            if (!msg.ok) return reject(new Error(msg.error || 'mhtml-failed'));
            resolve(msg.arrayBuffer);
          }
        };
        chrome.runtime.onMessage.addListener(onMsg);
        chrome.runtime.sendMessage({ type: 'GETINSPIRE_MHTML', id }).catch(err => {
          try { chrome.runtime.onMessage.removeListener(onMsg); } catch {}
          reject(err);
        });
        setTimeout(() => { try { chrome.runtime.onMessage.removeListener(onMsg); } catch {}; reject(new Error('mhtml-timeout')); }, timeoutMs);
      } catch (e) { reject(e); }
    });
  }

})();
