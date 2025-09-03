const statusEl = document.getElementById('status');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const allBtn = document.getElementById('allBtn');
const barEl = document.getElementById('bar');
const pctEl = document.getElementById('pct');
const countMetaEl = document.getElementById('countMeta');
const elapsedMetaEl = document.getElementById('elapsedMeta');
const openOptionsLink = document.getElementById('openOptionsLink');
const reportLink = document.getElementById('reportLink');

let currentTabId = null;
let captureMode = 'single'; // 'single' | 'crawl'
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
function setSelected(btn, on){ try { if (!btn) return; btn.classList.toggle('selected', !!on); btn.setAttribute('aria-pressed', on ? 'true' : 'false'); } catch {} }
function setModeUI(mode){
  captureMode = mode;
  if (mode === 'crawl'){
    setSelected(startBtn, false); setSelected(allBtn, true);
    try { startBtn.disabled = true; } catch {}
    try { allBtn.disabled = false; } catch {}
    try { stopBtn.disabled = false; } catch {}
    try { allBtn.focus(); } catch {}
  } else {
    setSelected(startBtn, true); setSelected(allBtn, false);
    try { startBtn.disabled = false; } catch {}
    try { allBtn.disabled = false; } catch {}
    try { stopBtn.disabled = true; } catch {}
  }
}
function fmtTime(ms){
  const sec = Math.max(0, Math.floor(ms/1000));
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec/60), s = sec%60;
  if (m < 60) return `${m}:${String(s).padStart(2,'0')}`;
  const h = Math.floor(m/60), m2 = m%60;
  return `${h}h ${String(m2).padStart(2,'0')}m`;
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
  setModeUI('single');
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

async function runCrawl() {
  setModeUI('crawl');
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) { setStatus('No active tab.'); return; }
    startedAt = Date.now(); lastDone = 0; lastTotal = 0; resetProgress();
    setStatus('Crawl: starting...');
    chrome.runtime.sendMessage({ type: 'GETINSPIRE_CRAWL_START', startTabId: tab.id, startUrl: tab.url });
  } catch (e) {
    setStatus('Crawl start error: ' + String(e));
  }
}
if (allBtn) allBtn.addEventListener('click', () => { if (captureMode === 'crawl') return; runCrawl(); });

stopBtn.addEventListener('click', async () => {
  currentTabId = await getActiveTabId();
  if (!currentTabId) return;

  stopBtn.disabled = true;
  if (captureMode === 'crawl') {
    setStatus('Stopping crawl...');
    try { await chrome.runtime.sendMessage({ type: 'GETINSPIRE_CRAWL_STOP' }); } catch {}
  } else {
    setStatus('Stopping...');
    try {
      await chrome.tabs.sendMessage(currentTabId, { type: 'GETINSPIRE_STOP' });
    } catch (e) {
      setStatus('Error sending stop message: ' + String(e));
    }
  }
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'GETINSPIRE_STATUS' && captureMode === 'single') setStatus(msg.text);
  if (msg.type === 'GETINSPIRE_PROGRESS' && captureMode === 'single') setProgress(msg.downloaded, msg.total);
  if (msg.type === 'GETINSPIRE_DONE' && captureMode === 'single') {
    setStatus('Downloaded ZIP.');
    stopBtn.disabled = true;
    setProgress(msg.total || 1, msg.total || 1);
  }
  if (msg.type === 'GETINSPIRE_ERROR') {
    setStatus('Error: ' + (msg.error || 'Unknown error'));
    if (captureMode === 'crawl') setModeUI('single');
    stopBtn.disabled = true;
    resetProgress();
  }
  // Crawl progress updates
  if (msg.type === 'GETINSPIRE_CRAWL_PROGRESS') {
    if (msg.running && captureMode !== 'crawl') setModeUI('crawl');
    if (captureMode !== 'crawl') return;
    if (msg.running === false) return; // ignore stale updates
    const done = Number(msg.done || 0);
    const total = Math.max(done, Number(msg.total || 0));
    const elapsed = startedAt ? Date.now() - startedAt : 0;
    const etaMs = done > 0 ? Math.max(0, Math.round((elapsed/done) * (total - done))) : 0;
    const etaTxt = done > 0 ? `, ETA ${fmtTime(etaMs)}` : '';
    setStatus((msg.status || 'Crawling...') + ` ${done}/${total}${etaTxt}`);
    setProgress(done, total);
    try {
      if (countMetaEl) countMetaEl.textContent = `${done}/${total}`;
      if (elapsedMetaEl) elapsedMetaEl.textContent = fmtTime(elapsed) + (etaTxt?(' • ' + etaTxt):'');
    } catch {}
  }
  if (msg.type === 'GETINSPIRE_CRAWL_DONE' && captureMode === 'crawl') {
    setStatus(`Crawl done: ${msg.done || 0} pages`);
    stopBtn.disabled = true;
    setModeUI('single');
    setProgress(msg.done || 1, msg.done || 1);
  }
});

// When popup opens, ask background if a crawl is running and sync UI
try {
  chrome.runtime.sendMessage({ type: 'GETINSPIRE_CRAWL_POLL' });
} catch {}

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
