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
      setTimeout(() => {
        try {
          const URLRef = (globalThis.URL || self.URL);
          if (URLRef && typeof URLRef.revokeObjectURL === 'function') {
            URLRef.revokeObjectURL(blobUrl);
          }
        } catch (e) { /* ignore revoke failures */ }
      }, 30000);
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
    const blob = await chrome.pageCapture.saveAsMHTML({ tabId });
    const URLRef = (globalThis.URL || self.URL);
    if (!URLRef || typeof URLRef.createObjectURL !== 'function') {
      throw new TypeError('URL.createObjectURL is not available in background');
    }
    const url = URLRef.createObjectURL(blob);
    let pageUrl = '';
    try { const [t] = await chrome.tabs.query({ active: true, currentWindow: true }); pageUrl = t?.url || ''; } catch {}
    const host = (() => { try { return new URL(pageUrl).hostname.replace(/[^a-z0-9.-]/gi,'-'); } catch { return 'page'; } })();
    const filename = `getinspire-mhtml-${host}-${new Date().toISOString().replace(/[:.]/g,'-')}.mhtml`;
    await chrome.downloads.download({ url, filename, saveAs: true, conflictAction: 'uniquify' });
    setTimeout(() => {
      try {
        const URLRef2 = (globalThis.URL || self.URL);
        if (URLRef2 && typeof URLRef2.revokeObjectURL === 'function') {
          URLRef2.revokeObjectURL(url);
        }
      } catch (e) { /* ignore revoke failures */ }
    }, 30000);
  } catch (e) {
    chrome.runtime.sendMessage({ type: 'GETINSPIRE_ERROR', error: String(e) });
  }
});
