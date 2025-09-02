// In-memory cache to reduce duplicate permission prompts in-session
const __grantedOrigins = new Set();

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
  // On-demand fetch proxy (fallback for CORS/credentials issues in content)
  if (msg?.type === 'GETINSPIRE_FETCH') {
    try {
      const url = msg.url;
      const same = (() => { try { return new URL(url).origin === (sender?.origin || sender?.url && new URL(sender.url).origin); } catch { return false; } })();
      // Ensure per-origin host permission for cross-origin requests
      const canFetch = await ensureHostPermissionFor(url, same);
      if (!canFetch) throw new Error('perm-denied: ' + (new URL(url)).origin);
      const res = await fetch(url, { credentials: same ? 'include' : 'omit', mode: 'cors' });
      if (!res.ok) throw new Error('status ' + res.status);
      const buf = await res.arrayBuffer();
      const type = res.headers.get('content-type') || 'application/octet-stream';
      chrome.tabs.sendMessage(sender.tab.id, { type: 'GETINSPIRE_FETCH_RESULT', id: msg.id, ok: true, arrayBuffer: buf, contentType: type });
    } catch (e) {
      try { chrome.tabs.sendMessage(sender?.tab?.id, { type: 'GETINSPIRE_FETCH_RESULT', id: msg.id, ok: false, error: String(e) }); } catch (e2) { console.error(e2); }
    }
    return; // handled
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
      const { getinspireOptions } = await chrome.storage.sync.get('getinspireOptions');
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

// ---- Video downloader: info + download ----
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === 'GETINSPIRE_VIDEO_INFO') {
    (async () => {
      try {
        const info = await analyzeVideoUrl(msg.url, sender);
        sendResponse({ ok: true, info });
      } catch (e) {
        sendResponse({ ok: false, error: String(e) });
      }
    })();
    return true; // async
  }
  if (msg?.type === 'GETINSPIRE_VIDEO_DOWNLOAD') {
    (async () => {
      try {
        await downloadVideoVariant(msg.variant, sender);
        sendResponse({ ok: true });
      } catch (e) {
        try { chrome.runtime.sendMessage({ type: 'GETINSPIRE_ERROR', error: String(e) }); } catch {}
        sendResponse({ ok: false, error: String(e) });
      }
    })();
    return true;
  }
});

async function analyzeVideoUrl(urlStr, sender){
  const out = { variants: [] };
  const same = (() => { try { return new URL(urlStr).origin === (sender?.origin || sender?.url && new URL(sender.url).origin); } catch { return false; } })();
  const okPerm = await ensureHostPermissionFor(urlStr, same);
  if (!okPerm) throw new Error('Permission denied for video host');
  const res = await fetch(urlStr, { method: 'GET', credentials: 'include', mode: 'cors' }).catch(()=>null);
  if (!res) throw new Error('Fetch failed');
  const ct = (res.headers.get('content-type') || '').toLowerCase();
  const textPeek = (!ct || /m3u8|mpegurl/i.test(ct) || /text|application\/octet-stream/i.test(ct)) ? await res.clone().text().catch(()=> '') : '';
  // HLS master or media playlist
  if (/m3u8|mpegurl/i.test(ct) || /^#extm3u/i.test(textPeek.trim())){
    const base = res.url || urlStr;
    const body = textPeek || await res.text();
    const master = parseM3U8Master(body, base);
    if (master.variants.length) {
      out.variants = master.variants.map(v => ({
        type: 'hls-variant', url: v.url, bandwidth: v.bandwidth || 0, resolution: v.resolution || '', label: labelForVariant(v)
      }));
    } else {
      // Single playlist (no variants)
      out.variants = [{ type: 'hls-playlist', url: base, label: 'Auto' }];
    }
    return out;
  }
  // Direct MP4/WEBM etc.
  if (/video\//.test(ct) || /octet-stream/.test(ct) || /mp4|webm|ogg/i.test(urlStr)){
    out.variants = [{ type: 'file', url: res.url || urlStr, label: 'Source' }];
    return out;
  }
  throw new Error('No downloadable stream detected (may be DRM/MSE)');
}

function labelForVariant(v){
  const r = v.resolution || '';
  const bw = v.bandwidth ? Math.round(v.bandwidth/1000)+'kbps' : '';
  return [r, bw].filter(Boolean).join(' ');
}

function parseAttrs(line){
  const obj = {}; const s = line.replace(/^.*?:/,'');
  for (const m of s.matchAll(/([A-Z0-9-]+)=(("[^"]+")|([^,]+))/gi)){
    const k = m[1]; let v = m[3] || m[4] || '';
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1,-1);
    obj[k] = v;
  }
  return obj;
}

function absUrl(base, rel){ try { return new URL(rel, base).href; } catch { return rel; } }

function parseM3U8Master(text, base){
  const lines = text.split(/\r?\n/);
  const variants = [];
  for (let i=0;i<lines.length;i++){
    const L = lines[i].trim();
    if (/^#EXT-X-STREAM-INF/i.test(L)){
      const attrs = parseAttrs(L);
      const url = absUrl(base, (lines[i+1]||'').trim());
      const resStr = attrs.RESOLUTION || '';
      const resolution = resStr ? resStr.split('x')[1] ? `${resStr.split('x')[1]}p` : resStr : '';
      variants.push({ url, bandwidth: Number(attrs.BANDWIDTH||0), resolution });
      i++;
    }
  }
  return { variants };
}

function parseM3U8Media(text, base){
  const lines = text.split(/\r?\n/);
  const segments = []; let initUrl = null; let encrypted = false; let keyMethod = 'NONE';
  for (let i=0;i<lines.length;i++){
    const L = lines[i].trim();
    if (/^#EXT-X-KEY/i.test(L)){
      const attrs = parseAttrs(L);
      keyMethod = (attrs.METHOD||'NONE').toUpperCase();
      if (keyMethod && keyMethod !== 'NONE') encrypted = true;
    }
    if (/^#EXT-X-MAP/i.test(L)){
      const attrs = parseAttrs(L);
      if (attrs.URI) initUrl = absUrl(base, attrs.URI);
    }
    if (/^#EXTINF/i.test(L)){
      const url = absUrl(base, (lines[i+1]||'').trim());
      segments.push({ url });
      i++;
    }
  }
  return { initUrl, segments, encrypted, keyMethod };
}

let __videoDownloading = false;
async function downloadVideoVariant(variant, sender){
  if (__videoDownloading) throw new Error('Another download is in progress');
  __videoDownloading = true;
  try {
    const url = variant?.url || '';
    const same = (() => { try { return new URL(url).origin === (sender?.origin || sender?.url && new URL(sender.url).origin); } catch { return false; } })();

    // If it's an explicit file variant, skip fetching and let the browser download directly
    if (String(variant?.type||'').toLowerCase() === 'file'){
      const host = (() => { try { return new URL(url).hostname.replace(/[^a-z0-9.-]/gi,'-'); } catch { return 'video'; } })();
      const ext = (() => {
        // Prefer explicit extension from URL; otherwise infer from mime
        const m = (url.split('?')[0]||'').match(/\.(mp4|webm|ogg|mov|m4v)$/i);
        if (m) return m[1].toLowerCase();
        const mt = String(variant.mimeType||'');
        if (/webm/i.test(mt)) return 'webm';
        if (/ogg|ogv/i.test(mt)) return 'ogv';
        if (/quicktime|mov/i.test(mt)) return 'mov';
        return 'mp4';
      })();
      const filename = `getinspire-video-${host}-${new Date().toISOString().replace(/[:.]/g,'-')}.${ext}`;
      const { getinspireOptions } = await chrome.storage.sync.get('getinspireOptions');
      const saveWithoutPrompt = Boolean(getinspireOptions?.saveWithoutPrompt);
      await chrome.downloads.download({ url, filename, saveAs: !saveWithoutPrompt, conflictAction: 'uniquify' });
      try { chrome.runtime.sendMessage({ type:'GETINSPIRE_VIDEO_STATUS', text:'Video download started' }); } catch {}
      return;
    }

    // For HLS or unknown: fetch and inspect (requires host permission)
    const can = await ensureHostPermissionFor(url, same);
    if (!can) throw new Error('Permission denied for video host');
    const res = await fetch(url, { credentials: 'include', mode: 'cors' });
    const ct = (res.headers.get('content-type')||'').toLowerCase();
    const base = res.url || url;
    const textPeek = (!ct || /m3u8|mpegurl/i.test(ct) || /text|application\/octet-stream/i.test(ct)) ? await res.clone().text().catch(()=> '') : '';

    if (/m3u8|mpegurl/i.test(ct) || /^#extm3u/i.test(textPeek.trim()) || /\.m3u8(\?|$)/i.test(url)){
      const body = textPeek || await res.text();
      let playlistUrl = base;
      // If the selected variant is a master stream ref, ensure we fetch media playlist
      if (/^#EXTM3U/i.test(body) && /#EXT-X-STREAM-INF/i.test(body)){
        // pick highest bandwidth
        const master = parseM3U8Master(body, base);
        const best = master.variants.sort((a,b)=> (b.bandwidth||0)-(a.bandwidth||0))[0];
        if (!best) throw new Error('No HLS variants found');
        playlistUrl = best.url;
      }
      const plistRes = await fetch(playlistUrl, { credentials: 'include', mode: 'cors' });
      const plistText = await plistRes.text();
      const media = parseM3U8Media(plistText, playlistUrl);
      if (media.encrypted) throw new Error(`Encrypted HLS (${media.keyMethod}) is not supported.`);
      const segs = media.segments;
      const total = segs.length + (media.initUrl?1:0);
      let done = 0;
      const blobs = [];
      const report = (d,t) => { try { chrome.runtime.sendMessage({ type:'GETINSPIRE_VIDEO_PROGRESS', done:d, total:t }); } catch {} };
      report(0,total);
      if (media.initUrl){
        const okPerm = await ensureHostPermissionFor(media.initUrl, same);
        if (!okPerm) throw new Error('Permission denied for init segment');
        const r = await fetch(media.initUrl, { credentials: 'include', mode: 'cors' }); blobs.push(await r.arrayBuffer()); done++; report(done,total);
      }
      for (const s of segs){
        const okPerm = await ensureHostPermissionFor(s.url, same);
        if (!okPerm) throw new Error('Permission denied for segment host');
        const r = await fetch(s.url, { credentials: 'include', mode: 'cors' }); blobs.push(await r.arrayBuffer()); done++; report(done,total);
      }
      const typeGuess = segs[0]?.url.endsWith('.ts') ? 'video/mp2t' : 'video/mp4';
      const blob = new Blob(blobs, { type: typeGuess });
      const URLRef = (globalThis.URL || self.URL);
      const blobUrl = URLRef.createObjectURL(blob);
      const host = (() => { try { return new URL(url).hostname.replace(/[^a-z0-9.-]/gi,'-'); } catch { return 'video'; } })();
      const filename = `getinspire-video-${host}-${new Date().toISOString().replace(/[:.]/g,'-')}.${typeGuess==='video/mp2t'?'ts':'mp4'}`;
      const { getinspireOptions } = await chrome.storage.sync.get('getinspireOptions');
      const saveWithoutPrompt = Boolean(getinspireOptions?.saveWithoutPrompt);
      await chrome.downloads.download({ url: blobUrl, filename, saveAs: !saveWithoutPrompt, conflictAction: 'uniquify' });
      try { chrome.runtime.sendMessage({ type:'GETINSPIRE_VIDEO_STATUS', text:'Video download started' }); } catch {}
      setTimeout(()=>{ try { URLRef.revokeObjectURL(blobUrl); } catch {} }, 30000);
      return;
    }

    // Direct file case
    const host = (() => { try { return new URL(url).hostname.replace(/[^a-z0-9.-]/gi,'-'); } catch { return 'video'; } })();
    const ext = (() => { const m = (url.split('?')[0]||'').match(/\.(mp4|webm|ogg|mov|m4v)$/i); return m?m[1].toLowerCase():'mp4'; })();
    const filename = `getinspire-video-${host}-${new Date().toISOString().replace(/[:.]/g,'-')}.${ext}`;
    const { getinspireOptions } = await chrome.storage.sync.get('getinspireOptions');
    const saveWithoutPrompt = Boolean(getinspireOptions?.saveWithoutPrompt);
    await chrome.downloads.download({ url, filename, saveAs: !saveWithoutPrompt, conflictAction: 'uniquify' });
    try { chrome.runtime.sendMessage({ type:'GETINSPIRE_VIDEO_STATUS', text:'Video download started' }); } catch {}
  } finally {
    __videoDownloading = false;
  }
}

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
