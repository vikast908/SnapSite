// In-memory cache to reduce duplicate permission prompts in-session
const __grantedOrigins = new Set();
// Asset cache to avoid refetching the same resources (15 minute TTL)
const __assetCache = new Map();

// Import fetch-based crawler for memory-efficient crawling
import { FetchCrawler } from './fetch-crawler.js';

// Memory monitoring
let __memoryMonitor = null;

async function checkMemoryUsage() {
  try {
    if ('memory' in performance) {
      const memInfo = performance.memory;
      const usedMB = memInfo.usedJSHeapSize / (1024 * 1024);
      const limitMB = memInfo.jsHeapSizeLimit / (1024 * 1024);
      const percentUsed = (usedMB / limitMB) * 100;

      console.log(`[Memory] Used: ${usedMB.toFixed(1)}MB / ${limitMB.toFixed(1)}MB (${percentUsed.toFixed(1)}%)`);

      return { usedMB, limitMB, percentUsed };
    }
  } catch (e) {
    console.warn('[Memory] Cannot check memory usage:', e);
  }
  return null;
}

function startMemoryMonitoring() {
  if (__memoryMonitor) return;
  __memoryMonitor = setInterval(checkMemoryUsage, 5000); // Check every 5 seconds
}

function stopMemoryMonitoring() {
  if (__memoryMonitor) {
    clearInterval(__memoryMonitor);
    __memoryMonitor = null;
  }
}

async function ensureHostPermissionFor(urlStr, sameOrigin) {
  try {
    if (sameOrigin) return true; // No extra permission needed
    const u = new URL(urlStr);
    const pattern = `${u.origin}/*`;
    if (__grantedOrigins.has(pattern)) return true;
    const has = await chrome.permissions.contains({ origins: [pattern] }).catch(() => false);
    if (has) { __grantedOrigins.add(pattern); return true; }
    const ok = await chrome.permissions.request({ origins: [pattern] }).catch(() => false);
    if (ok) { __grantedOrigins.add(pattern); return true; }
  } catch (e) { console.error(e); }
  return false;
}

chrome.runtime.onMessage.addListener(async (msg, sender) => {
  // Maintain abort controllers for background fetches so content can cancel promptly
  if (!globalThis.__bgFetchControllers) globalThis.__bgFetchControllers = new Map();
  const bgCtrls = globalThis.__bgFetchControllers;
  if (msg?.type === 'GETINSPIRE_CRAWL_POLL') {
    try { sendCrawlProgress(); } catch (e) { console.error(e); }
    return;
  }
  if (msg?.type === 'GETINSPIRE_CRAWL_HEARTBEAT') {
    try {
      if (__crawlSession?.running) {
        if (!__crawlSession.active) { setTimeout(() => { try { crawlPump(); } catch (e) { console.error(e); } }, 0); }
        sendCrawlProgress();
      }
    } catch (e) { console.error(e); }
    return;
  }
  // Content script snapshot result (crawl aggregate mode)
  if (msg?.type === 'GETINSPIRE_SNAPSHOT_RESULT') {
    try {
      if (!__crawlSession || !__crawlSession.running) return;
      const tabId = sender?.tab?.id;
      const pageUrl = msg.package?.pageUrl || (sender?.url || '');
      const title = msg.package?.title || pageUrl;
      const slug = sanitizeFilename(pageUrl).slice(0,80) || 'page';
      const aggId = __crawlSession.aggTabId;
      if (aggId) {
        // Send directly to aggregator tab
        await chrome.tabs.sendMessage(aggId, {
          type: 'GETINSPIRE_AGG_ADD_PAGE',
          slug,
          pageUrl,
          title,
          indexHtml: msg.package?.indexHtml || '',
          assets: msg.package?.assets || [],
          reportJson: msg.package?.reportJson || '',
          readmeMd: msg.package?.readmeMd || '',
          quickCheckHtml: msg.package?.quickCheckHtml || '',
          extras: msg.package?.extras || []
        }).catch((e) => {
          console.error('Failed to send page to aggregator:', e);
        });
      }
      if (tabId) markCrawlPageDone(tabId);
    } catch (e) { console.error(e); }
    return; // handled
  }
  // On-demand fetch proxy (fallback for CORS/credentials issues in content)
  if (msg?.type === 'GETINSPIRE_FETCH') {
    try {
      const url = msg.url;
      const same = (() => { try { return new URL(url).origin === (sender?.origin || sender?.url && new URL(sender.url).origin); } catch { return false; } })();
      // Ensure per-origin host permission for cross-origin requests
      const canFetch = await ensureHostPermissionFor(url, same);
      if (!canFetch) throw new Error('perm-denied: ' + (new URL(url)).origin);
      try { await ensureGoogleMailHeaderRule(url); } catch {}
      // Check cache first
      const cacheKey = url;
      const cached = __assetCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < 15 * 60 * 1000) { // 15 min cache
        chrome.tabs.sendMessage(sender.tab.id, { type: 'GETINSPIRE_FETCH_RESULT', id: msg.id, ok: true, arrayBuffer: cached.buffer, contentType: cached.type });
        return;
      }
      const ctl = new AbortController();
      if (msg.id) { try { bgCtrls.set(msg.id, ctl); } catch {} }
      const res = await fetch(url, { credentials: 'include', mode: 'cors', signal: ctl.signal });
      if (!res.ok) throw new Error('status ' + res.status);
      const buf = await res.arrayBuffer();
      const type = res.headers.get('content-type') || 'application/octet-stream';
      // Cache the response
      __assetCache.set(cacheKey, { buffer: buf, type, timestamp: Date.now() });
      // Clean old cache entries
      if (__assetCache.size > 500) {
        const now = Date.now();
        for (const [k, v] of __assetCache) {
          if (now - v.timestamp > 15 * 60 * 1000) __assetCache.delete(k);
        }
      }
      chrome.tabs.sendMessage(sender.tab.id, { type: 'GETINSPIRE_FETCH_RESULT', id: msg.id, ok: true, arrayBuffer: buf, contentType: type });
    } catch (e) {
      try { chrome.tabs.sendMessage(sender?.tab?.id, { type: 'GETINSPIRE_FETCH_RESULT', id: msg.id, ok: false, error: String(e) }); } catch (e2) { console.error(e2); }
    } finally {
      if (msg?.id) { try { bgCtrls.delete(msg.id); } catch {} }
    }
    return; // handled
  }
  if (msg?.type === 'GETINSPIRE_FETCH_CANCEL') {
    try {
      const id = msg.id;
      const ctl = id && bgCtrls.get(id);
      if (ctl) { try { ctl.abort('cancelled'); } catch {} }
    } catch {}
    return;
  }
  // Progress badge updates per-tab
  if (msg?.type === 'GETINSPIRE_PROGRESS') {
    try {
      const tabId = sender?.tab?.id;
      if (!tabId) return;
      const total = Math.max(1, Number(msg.total) || 1);
      const done = Math.max(0, Math.min(total, Number(msg.downloaded) || 0));
      const pct = Math.max(0, Math.min(99, Math.floor((done * 100) / total)));
      await chrome.action.setBadgeBackgroundColor({ tabId, color: '#3b82f6' });
      await chrome.action.setBadgeText({ tabId, text: `${pct}%` });
    } catch (e) { console.error(e); }
    return;
  }

  // Error badge (e.g., stopped or endless)
  if (msg?.type === 'GETINSPIRE_ERROR') {
    try {
      const tabId = sender?.tab?.id;
      if (tabId) {
        await chrome.action.setBadgeBackgroundColor({ tabId, color: '#ef4444' });
        await chrome.action.setBadgeText({ tabId, text: 'ERR' });
        setTimeout(async () => { try { await chrome.action.setBadgeText({ tabId, text: '' }); } catch (e) { console.error(e); } }, 4000);
      }
      // Surface error to crawler if relevant
      try {
        if (__crawlSession && tabId && __crawlSession.pageByTabId?.has(tabId)) {
          markCrawlPageDone(tabId);
        }
      } catch {}
    } catch (e) { console.error(e); }
    return; // also let popup handle the message
  }

  if (msg?.type === 'GETINSPIRE_DOWNLOAD_ZIP') {
    try {
      let blobUrl = msg.blobUrl;
      if (!blobUrl && msg.arrayBuffer) {
        // Fallback for older sender: construct blob URL here if provided an ArrayBuffer
        const blob = new Blob([msg.arrayBuffer], { type: 'application/zip' });
        const URLRef = (globalThis.URL || self.URL);
        if (!URLRef?.createObjectURL) throw new TypeError('URL.createObjectURL is not available in background');
        blobUrl = URLRef.createObjectURL(blob);
      }
      if (!blobUrl) throw new Error('No blobUrl provided for download');
      // Handle incognito mode - fallback to local storage if sync fails
      let getinspireOptions;
      try {
        const result = await chrome.storage.sync.get('getinspireOptions');
        getinspireOptions = result.getinspireOptions;
      } catch (e) {
        console.warn('[Incognito] Sync storage failed, using local storage:', e);
        try {
          const result = await chrome.storage.local.get('getinspireOptions');
          getinspireOptions = result.getinspireOptions;
        } catch (e2) {
          console.warn('[Incognito] Local storage also failed, using defaults:', e2);
          getinspireOptions = {};
        }
      }
      const saveWithoutPrompt = Boolean(getinspireOptions?.saveWithoutPrompt);
      await chrome.downloads.download({
        url: blobUrl,
        filename: msg.filename,
        saveAs: !saveWithoutPrompt,
        conflictAction: 'uniquify'
      });
      // Note: the object URL is created in the content script and revoked there.
      // We avoid revoking from the service worker to prevent runtime errors in
      // environments where URL.revokeObjectURL is not available.
      chrome.runtime.sendMessage({ type: 'GETINSPIRE_DONE' });
      try {
        // If a crawl session is active and this tab belongs to it, mark page done
        if (__crawlSession && sender?.tab?.id && __crawlSession.pageByTabId?.has(sender.tab.id)) {
          markCrawlPageDone(sender.tab.id);
        }
      } catch (e) { console.error(e); }
      try {
        if (sender?.tab?.id) {
          await chrome.action.setBadgeBackgroundColor({ tabId: sender.tab.id, color: '#16a34a' });
          await chrome.action.setBadgeText({ tabId: sender.tab.id, text: 'OK' });
          setTimeout(async () => { try { await chrome.action.setBadgeText({ tabId: sender.tab.id, text: '' }); } catch (e) { console.error(e); } }, 3000);
        }
      } catch (e) { console.error(e); }
    } catch (e) {
      chrome.runtime.sendMessage({ type: 'GETINSPIRE_ERROR', error: String(e) });
      try {
        if (sender?.tab?.id) {
          await chrome.action.setBadgeBackgroundColor({ tabId: sender.tab.id, color: '#ef4444' });
          await chrome.action.setBadgeText({ tabId: sender.tab.id, text: 'ERR' });
          setTimeout(async () => { try { await chrome.action.setBadgeText({ tabId: sender.tab.id, text: '' }); } catch (e) { console.error(e); } }, 4000);
        }
      } catch (e2) { console.error(e2); }
    }
  }
  // Handle MHTML requests from content script
  if (msg?.type === 'GETINSPIRE_MHTML') {
    try {
      const tabId = sender?.tab?.id;
      if (!tabId) throw new Error('no-tab');
      const blob = await chrome.pageCapture.saveAsMHTML({ tabId });
      const ab = await blob.arrayBuffer();
      chrome.tabs.sendMessage(tabId, { type: 'GETINSPIRE_MHTML_RESULT', id: msg.id, ok: true, arrayBuffer: ab });
    } catch (e) {
      try { chrome.tabs.sendMessage(sender?.tab?.id, { type: 'GETINSPIRE_MHTML_RESULT', id: msg.id, ok: false, error: String(e) }); } catch (e2) { console.error(e2); }
    }
    return;
  }
});

// (Removed: legacy video downloader and yt-dlp bridge)

// Context menu: Capture this page
chrome.runtime.onInstalled.addListener(() => {
  try {
    chrome.contextMenus.create({
      id: 'GETINSPIRE_CAPTURE_PAGE',
      title: 'GetInspire: Capture this page',
      contexts: ['page']
    });
  } catch (e) { console.error(e); }
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'GETINSPIRE_CAPTURE_PAGE' && tab?.id) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['src/vendor/jszip.min.js', 'src/content.js']
      });
    } catch (e) {
      chrome.runtime.sendMessage({ type: 'GETINSPIRE_ERROR', error: String(e) });
    }
  } 
});

// Keyboard shortcut: Capture via command
try {
  chrome.commands.onCommand.addListener(async (command) => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) return;
      if (command === 'capture-page') {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['src/vendor/jszip.min.js', 'src/content.js']
        });
      } else if (command === 'stop-capture') {
        try { await chrome.tabs.sendMessage(tab.id, { type: 'GETINSPIRE_STOP' }); } catch {}
      }
    } catch (e) {
      try { chrome.runtime.sendMessage({ type: 'GETINSPIRE_ERROR', error: String(e) }); } catch {}
    }
  });
} catch (e) { console.error(e); }

// Fallback for popup when scripting is blocked by policy
chrome.runtime.onMessage.addListener(async (msg, sender) => {
  if (msg?.type !== 'GETINSPIRE_SAVE_MHTML_DIRECT') return; // not ours
  try {
    const tabId = msg.tabId || (sender?.tab?.id);
    if (!tabId) throw new Error('no-tab');
    let pageUrl = '';
    try { const t = await chrome.tabs.get(tabId); pageUrl = t?.url || ''; } catch {}
    // Popup is responsible for requesting any needed host permission under a
    // user gesture. Here we just attempt the capture.
    const blob = await chrome.pageCapture.saveAsMHTML({ tabId });

    const URLRef = (globalThis.URL || self.URL);
    if (!URLRef || typeof URLRef.createObjectURL !== 'function') {
      throw new TypeError('URL.createObjectURL is not available in background');
    }
    const url = URLRef.createObjectURL(blob);
    const host = (() => { try { return new URL(pageUrl).hostname.replace(/[^a-z0-9.-]/gi,'-'); } catch { return 'page'; } })();
    const filename = `getinspire-mhtml-${host}-${new Date().toISOString().replace(/[:.]/g,'-')}.mhtml`;
    await chrome.downloads.download({ url, filename, saveAs: true, conflictAction: 'uniquify' });
    // Do not attempt to revoke from the service worker; if an offscreen
    // document is introduced for MHTML in the future, handle revocation there.
  } catch (e) {
    chrome.runtime.sendMessage({ type: 'GETINSPIRE_ERROR', error: String(e) });
  }
});

// ---------------- Site crawl orchestrator ----------------
let __crawlSession = null;

function sendCrawlProgress() {
  try {
    if (!__crawlSession) return;
    const done = __crawlSession.doneCount;
    const total = done + __crawlSession.queue.length;
    const status = `Crawling ${done}/${total}`;
    chrome.runtime.sendMessage({ type: 'GETINSPIRE_CRAWL_PROGRESS', running: !!__crawlSession?.running, done, total, status });
    // Also reflect crawl progress on the extension badge so the user can
    // see progress without keeping the popup open.
    try {
      chrome.action.setBadgeBackgroundColor({ color: '#a855f7' });
      chrome.action.setBadgeText({ text: String(done) });
      chrome.action.setTitle({ title: status });
    } catch (e) { console.error(e); }
  } catch (e) { console.error(e); }
}

async function ensureGoogleMailHeaderRule(testUrl){
  try {
    const u = new URL(testUrl);
    const h = u.hostname || '';
    if (!(/googleusercontent\.com$/i.test(h) || /gstatic\.com$/i.test(h))) return;
  } catch { return; }
  const ruleId = 941101; // separate from googlevideo rule
  const rule = {
    id: ruleId,
    priority: 1,
    action: {
      type: 'modifyHeaders',
      requestHeaders: [
        { header: 'referer', operation: 'set', value: 'https://mail.google.com/' },
        { header: 'origin', operation: 'set', value: 'https://mail.google.com' }
      ]
    },
    condition: {
      regexFilter: '^https?:\\/\\/([a-z0-9.-]+\\.)?(googleusercontent\\.com|gstatic\\.com)\\/.*',
      requestDomains: ['googleusercontent.com','gstatic.com'],
      isUrlFilterCaseSensitive: false,
      resourceTypes: ['main_frame','sub_frame','xmlhttprequest','image','stylesheet','font','other']
    }
  };
  try {
    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: [ruleId] });
  } catch {}
  await chrome.declarativeNetRequest.updateDynamicRules({ addRules: [rule] });
}

function sanitizeFilename(text) {
  return String(text || '')
    .replace(/[^a-z0-9_.-]/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'page';
}

async function waitTabComplete(tabId, timeoutMs = 15000) {
  const start = Date.now();
  try {
    const t = await chrome.tabs.get(tabId).catch(() => null);
    if (t?.status === 'complete') return;
  } catch {}
  return new Promise((resolve) => {
    const onUpd = (id, info) => {
      if (id === tabId && info.status === 'complete') {
        cleanup(); resolve();
      }
    };
    const timer = setTimeout(() => { try { cleanup(); } catch {}; resolve(); }, timeoutMs);
    function cleanup(){ try { chrome.tabs.onUpdated.removeListener(onUpd); } catch {}; try { clearTimeout(timer); } catch {} }
    try { chrome.tabs.onUpdated.addListener(onUpd); } catch {}
  });
}

async function extractLinks(tabId, baseUrl) {
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId },
      func: (base) => {
        const out = new Set();
        const abs = (href) => {
          try { return new URL(href, base || document.baseURI).href; } catch { return null; }
        };
        const canonicalize = (u) => {
          try {
            const t = new URL(u);
            t.hash = '';
            const drop = ['utm_source','utm_medium','utm_campaign','utm_term','utm_content','gclid','fbclid','mc_cid','mc_eid','yclid','_hsmi','_hsenc','mkt_tok','ref'];
            for (const k of drop) t.searchParams.delete(k);
            if ([...t.searchParams.keys()].length === 0) t.search = '';
            t.protocol = t.protocol.toLowerCase();
            t.hostname = t.hostname.toLowerCase();
            if (t.pathname.length > 1 && /\/$/.test(t.pathname)) t.pathname = t.pathname.replace(/\/+$/,'');
            return t.href;
          } catch { return u; }
        };
        const skipExt = /\.(png|jpe?g|gif|webp|svg|ico|css|js|mjs|json|map|xml|txt|pdf|zip|rar|7z|tar|gz|mp4|webm|og[gv]|mp3|wav|mov|avi|mkv|dmg|exe|msi)(\?.*)?$/i;
        const skipScheme = /^(#|javascript:|mailto:|tel:|data:|blob:)/i;
        const links = document.querySelectorAll('a[href]');
        for (const a of links) {
          const href = (a.href || '').trim();
          if (!href || skipScheme.test(href)) continue;
          try {
            const uo = new URL(href, base || document.baseURI);
            if (!/^https?:$/i.test(uo.protocol)) continue;
            if (skipExt.test(uo.pathname)) continue;
            uo.hash = '';
            out.add(canonicalize(uo.href));
          } catch {}
        }
        return Array.from(out);
      },
      args: [baseUrl || '']
    });
    return Array.isArray(result) ? result : [];
  } catch (e) { console.error(e); return []; }
}

async function captureTabToZipOrMHTMLElse(tabId, pageUrl) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['src/vendor/jszip.min.js', 'src/inject-crawl-mode.js', 'src/content.js']
    });
    return true;
  } catch (e) {
    console.warn('Crawl: content inject failed, saving MHTML instead', e);
    try {
      const blob = await chrome.pageCapture.saveAsMHTML({ tabId });
      const ab = await blob.arrayBuffer();
      // Forward to aggregator as a page with MHTML only
      if (__crawlSession?.aggTabId) {
        const slug = sanitizeFilename(pageUrl).slice(0,80) || 'page';
        const indexHtml = `<!doctype html>\n<html><head><meta charset="utf-8" />\n<meta http-equiv="refresh" content="0; url=report/page.mhtml">\n<title>Snapshot</title></head><body>\n<p>Open <a href="report/page.mhtml">page.mhtml</a>.</p></body></html>`;
        await chrome.runtime.sendMessage({
          type: 'GETINSPIRE_AGG_ADD_PAGE',
          slug,
          pageUrl,
          title: pageUrl,
          indexHtml,
          assets: [],
          extras: [{ path: 'report/page.mhtml', type: 'arrayBuffer', data: ab }]
        }).catch(()=>{});
      }
      return true;
    } catch (e2) {
      console.error('Crawl: MHTML fallback failed', e2);
      return false;
    }
  }
}

function markCrawlPageDone(tabId) {
  try {
    if (!__crawlSession) return;
    const rec = __crawlSession.pageByTabId.get(tabId);
    if (!rec) return;
    __crawlSession.pageByTabId.delete(tabId);
    __crawlSession.doneCount++;
    try { chrome.tabs.remove(tabId).catch(()=>{}); } catch {}
    sendCrawlProgress();
    // Resolve waiter if any
    const res = __crawlSession.pageDoneResolvers.get(tabId);
    if (res) { try { res(); } catch {}; __crawlSession.pageDoneResolvers.delete(tabId); }
    // Kick next
    if (!__crawlSession.running) return;
    setTimeout(() => { try { crawlPump(); } catch (e) { console.error(e); } }, 50);
  } catch (e) { console.error(e); }
}

async function crawlPump() {
  const S = __crawlSession;
  if (!S || S.stopped) return finishCrawl('stopped');

  // Check memory usage and switch to fetch-only mode if needed
  const memInfo = await checkMemoryUsage();
  if (memInfo && memInfo.usedMB > S.memoryLimit) {
    console.warn(`[Memory] Usage ${memInfo.usedMB.toFixed(1)}MB exceeds limit ${S.memoryLimit}MB, switching to fetch-only mode`);
    return await crawlWithFetchMode();
  }

  // Check time limit
  try {
    if (S.startedAt && S.maxMillis && (Date.now() - S.startedAt > S.maxMillis)) {
      return finishCrawl('timeout');
    }
  } catch {}

  if (S.doneCount >= S.maxPages) return finishCrawl('limit');
  if (S.queue.length === 0) return finishCrawl('done');
  if (S.processing) return; // Already processing

  const nextUrl = S.queue.shift();
  if (!nextUrl || S.visited.has(nextUrl)) {
    setTimeout(() => crawlPump(), 100);
    return;
  }

  S.visited.add(nextUrl);
  S.processing = true;
  sendCrawlProgress();

  try {
    // Determine crawl mode: 'smart', 'single-tab', 'fetch-only'
    if (S.crawlMode === 'fetch-only') {
      return await processFetchOnlyPage(nextUrl);
    }

    // SINGLE TAB APPROACH - Reuse the crawl tab
    let tabId = S.crawlTabId;

    if (!tabId) {
      // Create single reusable tab for crawling
      const tab = await chrome.tabs.create({
        url: nextUrl,
        active: false,
        pinned: true
      });
      tabId = S.crawlTabId = tab.id;
    } else {
      // Navigate existing tab to new URL
      await chrome.tabs.update(tabId, { url: nextUrl });
    }

    // Wait for page to load
    await waitTabComplete(tabId, 15000);

    // Small delay for dynamic content
    await new Promise(r => setTimeout(r, 1000));

    // Extract links
    const links = await extractLinks(tabId, nextUrl);
    let startHost = '';
    try { startHost = new URL(S.startUrl).hostname || ''; } catch {}

    for (const u of links) {
      try {
        const uh = new URL(u).hostname || '';
        if (uh === startHost && !S.visited.has(u) && !S.seen.has(u)) {
          S.seen.add(u);
          S.queue.push(u);
        }
      } catch {}
    }

    // Inject and capture
    const injected = await captureTabToZipOrMHTMLElse(tabId, nextUrl);

    // Wait for capture to complete
    await new Promise(resolve => {
      S.pageDoneResolvers.set(tabId, resolve);
      setTimeout(resolve, 10000); // Max 10s wait
    });

    S.doneCount++;
    sendCrawlProgress();

  } catch (e) {
    console.error('Crawl error for URL:', nextUrl, e);
    S.doneCount++;
  } finally {
    S.processing = false;
    S.pageDoneResolvers.clear();

    // Continue with next page
    if (S.running) {
      setTimeout(() => crawlPump(), 500);
    }
  }
}

// Fetch-only mode for memory-efficient crawling
async function crawlWithFetchMode() {
  const S = __crawlSession;
  console.log('[FetchCrawler] Switching to fetch-only mode due to memory constraints');

  try {
    // Use FetchCrawler for remaining URLs
    const remainingUrls = [S.startUrl, ...S.queue];
    const fetchCrawler = new FetchCrawler({
      maxPages: S.maxPages - S.doneCount,
      maxTime: S.maxMillis - (Date.now() - S.startedAt),
      userAgent: 'GetInspire Crawler (Memory-Safe Mode)'
    });

    const results = await fetchCrawler.crawl(S.startUrl);

    // Convert to aggregator format and send to aggregator tab
    const aggResults = fetchCrawler.toAggregatorFormat();

    for (const result of aggResults) {
      if (S.aggTabId) {
        await chrome.tabs.sendMessage(S.aggTabId, {
          type: 'GETINSPIRE_AGG_ADD_PAGE',
          slug: result.slug,
          package: result
        }).catch(e => console.warn('[FetchCrawler] Failed to send to aggregator:', e));
      }
      S.doneCount++;
      sendCrawlProgress();
    }

    return finishCrawl('fetch-complete');
  } catch (e) {
    console.error('[FetchCrawler] Error in fetch mode:', e);
    return finishCrawl('fetch-error');
  }
}

// Process single page in fetch-only mode
async function processFetchOnlyPage(url) {
  const S = __crawlSession;

  try {
    const fetchCrawler = new FetchCrawler({
      maxPages: 1,
      maxTime: 10000,
      userAgent: 'GetInspire Crawler (Fetch Mode)'
    });

    const result = await fetchCrawler.fetchPage(url);

    if (result && S.aggTabId) {
      const aggResult = {
        slug: fetchCrawler.urlToSlug(url),
        pageUrl: url,
        title: result.title,
        indexHtml: fetchCrawler.cleanHtml(result.html),
        assets: [],
        reportJson: JSON.stringify({
          url: result.url,
          title: result.title,
          size: result.size,
          method: 'fetch-only',
          timestamp: result.timestamp
        }),
        readmeMd: `# ${result.title}\n\nFetched from: ${url}\nSize: ${result.size} bytes\nMethod: Fetch-only (no assets)`,
        quickCheckHtml: `<!DOCTYPE html><html><head><title>Quick Check</title></head><body><h1>${result.title}</h1><p>URL: <a href="${url}">${url}</a></p><p>Method: Fetch-only</p></body></html>`,
        extras: []
      };

      await chrome.tabs.sendMessage(S.aggTabId, {
        type: 'GETINSPIRE_AGG_ADD_PAGE',
        slug: aggResult.slug,
        package: aggResult
      }).catch(e => console.warn('[FetchCrawler] Failed to send to aggregator:', e));

      // Extract links from HTML for crawling
      const links = fetchCrawler.extractLinks(result.html, url);
      let startHost = '';
      try { startHost = new URL(S.startUrl).hostname || ''; } catch {}

      for (const u of links) {
        try {
          const uh = new URL(u).hostname || '';
          if (uh === startHost && !S.visited.has(u) && !S.seen.has(u)) {
            S.seen.add(u);
            S.queue.push(u);
          }
        } catch {}
      }
    }

    S.doneCount++;
    sendCrawlProgress();

  } catch (e) {
    console.error('[FetchCrawler] Error processing page:', url, e);
    S.doneCount++;
  } finally {
    S.processing = false;

    // Continue with next page
    if (S.running) {
      setTimeout(() => crawlPump(), 200);
    }
  }
}

function finishCrawl(reason) {
  try {
    if (!__crawlSession) return;
    __crawlSession.running = false;
    const done = __crawlSession.doneCount;

    // Stop memory monitoring
    stopMemoryMonitoring();

    // Close the single crawl tab
    try {
      if (__crawlSession.crawlTabId) {
        chrome.tabs.remove(__crawlSession.crawlTabId).catch(()=>{});
      }
    } catch {}

    // Ask aggregator to finalize a single ZIP
    try {
      const startUrl = __crawlSession.startUrl || '';
      const host = (() => { try { return new URL(startUrl).hostname.replace(/[^a-z0-9.-]/gi,'-'); } catch { return 'site'; } })();
      const filename = `getinspire-site-${host}-${new Date().toISOString().replace(/[:.]/g,'-')}.zip`;
      if (__crawlSession.aggTabId) {
        // Send finalize command to aggregator tab
        chrome.tabs.sendMessage(__crawlSession.aggTabId, { type:'GETINSPIRE_AGG_FINALIZE', filename }).catch((e) => {
          console.error('Failed to finalize aggregator:', e);
        });
        // Close aggregator tab after a delay
        setTimeout(() => {
          try { chrome.tabs.remove(__crawlSession.aggTabId).catch(()=>{}); } catch {}
        }, 3000);
      }
    } catch (e) { console.error(e); }
    chrome.runtime.sendMessage({ type: 'GETINSPIRE_CRAWL_DONE', done, reason });
    // Clear global badge after crawl completes
    try { chrome.action.setBadgeText({ text: '' }); } catch (e) { console.error(e); }
  } catch (e) { console.error(e); }
}

chrome.runtime.onMessage.addListener(async (msg, sender) => {
  if (msg?.type === 'GETINSPIRE_CRAWL_START') {
    try {
      if (__crawlSession?.running) {
        // Stop previous
        __crawlSession.stopped = true;
      }
      const startUrl = msg.startUrl || (await chrome.tabs.get(msg.startTabId).catch(()=>({url:''}))).url || '';
      if (!startUrl) { chrome.runtime.sendMessage({ type:'GETINSPIRE_ERROR', error: 'No start URL' }); return; }
      // Normalize start URL for consistent deduplication
      const normalizedStartUrl = (() => {
        try {
          const u = new URL(startUrl);
          u.hash = '';
          return u.href;
        } catch { return startUrl; }
      })();

      // Get crawl mode and memory limit from options (incognito-safe)
      let getinspireOptions;
      try {
        const result = await chrome.storage.sync.get('getinspireOptions');
        getinspireOptions = result.getinspireOptions;
      } catch (e) {
        console.warn('[Incognito] Sync storage failed for crawl options, using local storage:', e);
        try {
          const result = await chrome.storage.local.get('getinspireOptions');
          getinspireOptions = result.getinspireOptions;
        } catch (e2) {
          console.warn('[Incognito] Local storage also failed for crawl options, using defaults:', e2);
          getinspireOptions = {};
        }
      }
      const crawlMode = getinspireOptions?.crawlMode || 'smart';
      const memoryLimit = getinspireOptions?.memoryLimit || 500; // MB

      __crawlSession = {
        running: true,
        stopped: false,
        processing: false, // Track if currently processing a page
        queue: [normalizedStartUrl],
        visited: new Set(),
        seen: new Set([normalizedStartUrl]),
        pageDoneResolvers: new Map(),
        doneCount: 0,
        // Memory-safe limits
        maxPages: Number.isFinite(msg.maxPages) ? msg.maxPages : 25,
        // Shorter time limit - 1 minute max
        maxMillis: Number.isFinite(msg.maxMillis) ? msg.maxMillis : 60 * 1000,
        startTabId: msg.startTabId || null,
        aggTabId: null,
        crawlTabId: null, // Single reusable tab for crawling
        startUrl: normalizedStartUrl,
        startedAt: Date.now(),
        crawlMode, // 'smart', 'single-tab', 'fetch-only'
        memoryLimit, // Memory limit in MB
      };

      // Start memory monitoring
      startMemoryMonitoring();
      console.log(`[Crawl] Starting with mode: ${crawlMode}, memory limit: ${memoryLimit}MB`);

      // Open a dedicated aggregator host page (stable even if user navigates)
      try {
        const aggUrl = chrome.runtime.getURL('src/aggregator.html');
        const aggTab = await chrome.tabs.create({
          url: aggUrl,
          active: false,
          pinned: true  // Keep it minimal
        });
        __crawlSession.aggTabId = aggTab.id;
        await waitTabComplete(__crawlSession.aggTabId, 10000).catch(()=>{});
        // Wait a bit for aggregator to initialize
        await new Promise(resolve => setTimeout(resolve, 500));
        // Send init message to aggregator tab
        await chrome.tabs.sendMessage(__crawlSession.aggTabId, {
          type: 'GETINSPIRE_AGG_INIT',
          title: `GetInspire Site Snapshot: ${new URL(normalizedStartUrl).hostname}`
        }).catch((e) => {
          console.error('Failed to init aggregator:', e);
        });
        // Wait for aggregator to be ready
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (e) { console.error('Aggregator host failed', e); }
      sendCrawlProgress();
      // Start crawling after aggregator is ready
      setTimeout(() => crawlPump(), 1000);
    } catch (e) {
      console.error(e);
      chrome.runtime.sendMessage({ type:'GETINSPIRE_ERROR', error: String(e) });
    }
  }
  if (msg?.type === 'GETINSPIRE_CRAWL_STOP') {
    try {
      if (!__crawlSession) return;
      __crawlSession.stopped = true;
      __crawlSession.running = false;
      try { for (const tabId of __crawlSession.pageByTabId.keys()) chrome.tabs.remove(tabId).catch(()=>{}); } catch {}
      finishCrawl('stopped');
      __crawlSession = null;
    } catch (e) { console.error(e); }
  }
});
