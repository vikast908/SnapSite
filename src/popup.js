const statusEl = document.getElementById('status');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const barEl = document.getElementById('bar');
const pctEl = document.getElementById('pct');
const countMetaEl = document.getElementById('countMeta');
const elapsedMetaEl = document.getElementById('elapsedMeta');
const openOptionsLink = document.getElementById('openOptionsLink');
const reportLink = document.getElementById('reportLink');

let currentTabId = null;
let startedAt = 0;
let lastTotal = 0;
let lastDone = 0;

async function getActiveTabId() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    return tabs?.[0]?.id || null;
  } catch { return null; }
}

function setStatus(s) { if (statusEl) statusEl.textContent = s; }
function fmtTime(ms){
  const sec = Math.max(0, Math.floor(ms/1000));
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec/60), s = sec%60;
  return `${m}:${String(s).padStart(2,'0')}`;
}
function setProgress(done, total) {
  total = Math.max(1, Number(total) || 1);
  done = Math.max(0, Math.min(total, Number(done) || 0));
  const pct = Math.floor((done * 100) / total);
  if (barEl) barEl.style.width = Math.min(99, pct) + '%';
  if (pctEl) pctEl.textContent = pct + '%';
  lastDone = done; lastTotal = total;
  // Meta: counts, elapsed, ETA
  try {
    if (countMetaEl) countMetaEl.textContent = `${done}/${total}`;
    const elapsed = startedAt ? Date.now() - startedAt : 0;
    if (elapsedMetaEl) elapsedMetaEl.textContent = fmtTime(elapsed);
  } catch {}
}
function resetProgress() { setProgress(0, 1); }

async function runCapture() {
  currentTabId = await getActiveTabId();
  if (!currentTabId) {
    setStatus('No active tab.');
    return;
  }
  setStatus('Starting...');
  resetProgress();
  stopBtn.disabled = false;
  startedAt = Date.now(); lastDone = 0; lastTotal = 0;
  try {
    await chrome.scripting.executeScript({
      target: { tabId: currentTabId },
      files: ['src/vendor/jszip.min.js', 'src/content.js']
    });
  } catch (e) {
    const msg = String(e || '');
    // Helpful guidance + fallback for sites that block scripting via policy
    if (/ExtensionsSettings policy|cannot be scripted/i.test(msg)) {
      setStatus('Site blocks scripting. Requesting permission, then saving MHTML...');
      try {
        // Request per-origin permission under user gesture (popup click)
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const url = tabs?.[0]?.url || '';
        let origin = '';
        try { origin = new URL(url).origin + '/*'; } catch {}
        if (origin) {
          const have = await chrome.permissions.contains({ origins: [origin] }).catch(() => false);
          if (!have) {
            const ok = await chrome.permissions.request({ origins: [origin] }).catch(() => false);
            if (!ok) throw new Error('Permission denied for ' + origin);
          }
        }
        await chrome.runtime.sendMessage({ type: 'GETINSPIRE_SAVE_MHTML_DIRECT', tabId: currentTabId });
        setStatus('Saved MHTML snapshot.');
      } catch (e2) {
        setStatus('Unable to save MHTML: ' + String(e2));
      }
    } else {
      setStatus('Error injecting scripts: ' + msg);
    }
    stopBtn.disabled = true;
    resetProgress();
  }
}

startBtn.addEventListener('click', runCapture);

stopBtn.addEventListener('click', async () => {
  currentTabId = await getActiveTabId();
  if (!currentTabId) return;

  stopBtn.disabled = true;
  setStatus('Stopping...');
  try {
    await chrome.tabs.sendMessage(currentTabId, { type: 'GETINSPIRE_STOP' });
  } catch (e) {
    setStatus('Error sending stop message: ' + String(e));
  }
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'GETINSPIRE_STATUS') setStatus(msg.text);
  if (msg.type === 'GETINSPIRE_PROGRESS') setProgress(msg.downloaded, msg.total);
  if (msg.type === 'GETINSPIRE_DONE') {
    setStatus('Downloaded ZIP.');
    stopBtn.disabled = true;
    setProgress(msg.total || 1, msg.total || 1);
  }
  if (msg.type === 'GETINSPIRE_ERROR') {
    setStatus('Error: ' + (msg.error || 'Unknown error'));
    stopBtn.disabled = true;
    resetProgress();
  }
});

// Quick actions
if (openOptionsLink) openOptionsLink.addEventListener('click', async (e) => {
  e.preventDefault();
  try {
    const url = chrome.runtime.getURL('src/options.html');
    if (chrome.windows && chrome.windows.create) {
      await chrome.windows.create({ url, type: 'popup', width: 760, height: 720, focused: true });
    } else {
      window.open(url, 'GetInspireOptions', 'width=760,height=720,noopener,noreferrer');
    }
  } catch (err) {
    try { window.open(chrome.runtime.getURL('src/options.html'), 'GetInspireOptions', 'width=760,height=720,noopener,noreferrer'); } catch {}
  }
});
if (reportLink) reportLink.addEventListener('click', async (e) => {
  e.preventDefault();
  try {
    const manifest = chrome.runtime.getManifest?.() || { version: '' };
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const page = tab?.url || '';
    const body = [
      'Please describe the issue here...',
      '',
      `Version: ${manifest.version}`,
      `Page: ${page}`,
      `Progress: ${lastDone}/${lastTotal}`,
    ].join('%0A');
    const subj = encodeURIComponent('GetInspire feedback');
    const href = `mailto:?subject=${subj}&body=${body}`;
    // Open in a new tab context to respect popup restrictions
    chrome.tabs.create({ url: href });
  } catch {}
});

// (inline quick settings removed)
