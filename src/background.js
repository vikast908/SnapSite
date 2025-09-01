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
  } catch {}
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
      try { chrome.tabs.sendMessage(sender?.tab?.id, { type: 'GETINSPIRE_FETCH_RESULT', id: msg.id, ok: false, error: String(e) }); } catch {}
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
    } catch {}
    return;
  }

  // Error badge (e.g., stopped or endless)
  if (msg?.type === 'GETINSPIRE_ERROR') {
    try {
      const tabId = sender?.tab?.id;
      if (tabId) {
        await chrome.action.setBadgeBackgroundColor({ tabId, color: '#ef4444' });
        await chrome.action.setBadgeText({ tabId, text: 'ERR' });
        setTimeout(async () => { try { await chrome.action.setBadgeText({ tabId, text: '' }); } catch {} }, 4000);
      }
    } catch {}
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
      setTimeout(() => { try { (globalThis.URL || self.URL).revokeObjectURL(blobUrl); } catch {} }, 30000);
      chrome.runtime.sendMessage({ type: 'GETINSPIRE_DONE' });
      try {
        if (sender?.tab?.id) {
          await chrome.action.setBadgeBackgroundColor({ tabId: sender.tab.id, color: '#16a34a' });
          await chrome.action.setBadgeText({ tabId: sender.tab.id, text: 'OK' });
          setTimeout(async () => { try { await chrome.action.setBadgeText({ tabId: sender.tab.id, text: '' }); } catch {} }, 3000);
        }
      } catch {}
    } catch (e) {
      chrome.runtime.sendMessage({ type: 'GETINSPIRE_ERROR', error: String(e) });
      try {
        if (sender?.tab?.id) {
          await chrome.action.setBadgeBackgroundColor({ tabId: sender.tab.id, color: '#ef4444' });
          await chrome.action.setBadgeText({ tabId: sender.tab.id, text: 'ERR' });
          setTimeout(async () => { try { await chrome.action.setBadgeText({ tabId: sender.tab.id, text: '' }); } catch {} }, 4000);
        }
      } catch {}
    }
  }
});

// Context menu: Capture this page
chrome.runtime.onInstalled.addListener(() => {
  try {
    chrome.contextMenus.create({
      id: 'GETINSPIRE_CAPTURE_PAGE',
      title: 'GetInspire: Capture this page',
      contexts: ['page']
    });
  } catch {}
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
