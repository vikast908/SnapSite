// Popup script for GetInspire
console.log('[GetInspire Popup] Loaded');

// Get DOM elements
const statusEl = document.getElementById('status');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const barEl = document.getElementById('bar');
const pctEl = document.getElementById('pct');
const countMetaEl = document.getElementById('countMeta');
const elapsedMetaEl = document.getElementById('elapsedMeta');
const openOptionsLink = document.getElementById('openOptionsLink');
const reportLink = document.getElementById('reportLink');

// State tracking
let captureMode = 'single'; // 'single' or 'crawl'
let startedAt = null;
let lastDone = 0;
let lastTotal = 1;

// Utility functions
function setStatus(text) {
  if (statusEl) statusEl.textContent = text;
}

function setSelected(btn, on) {
  try {
    if (!btn) return;
    btn.classList.toggle('selected', !!on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  } catch (e) {
    console.error('Error setting selected state:', e);
  }
}

function setModeUI(mode) {
  captureMode = mode;
  if (mode === 'crawl') {
    setSelected(startBtn, false);
    try { startBtn.disabled = true; } catch (e) {}
    try { stopBtn.disabled = false; } catch (e) {}
  } else {
    setSelected(startBtn, true);
    try { startBtn.disabled = false; } catch (e) {}
    try { stopBtn.disabled = true; } catch (e) {}
  }
}

function fmtTime(ms) {
  const sec = Math.max(0, Math.floor(ms / 1000));
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m < 60) return `${m}:${String(s).padStart(2, '0')}`;
  const h = Math.floor(m / 60);
  const m2 = m % 60;
  return `${h}h ${String(m2).padStart(2, '0')}m`;
}

function setProgress(done, total) {
  total = Math.max(1, Number(total) || 1);
  done = Math.max(0, Math.min(total, Number(done) || 0));
  const pct = Math.floor((done * 100) / total);

  if (barEl) barEl.style.width = Math.min(99, pct) + '%';
  if (pctEl) pctEl.textContent = pct + '%';

  lastDone = done;
  lastTotal = total;

  // Update meta info
  try {
    if (countMetaEl) countMetaEl.textContent = `${done}/${total}`;
    const elapsed = startedAt ? Date.now() - startedAt : 0;
    if (elapsedMetaEl) elapsedMetaEl.textContent = fmtTime(elapsed);
  } catch (e) {
    console.error('Error updating progress meta:', e);
  }
}

function resetProgress() {
  setProgress(0, 1);
  startedAt = null;
}

// Event handlers
if (startBtn) {
  startBtn.addEventListener('click', async () => {
    console.log('[GetInspire Popup] Start button clicked');

    try {
      // Get the active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab) {
        throw new Error('No active tab found');
      }

      console.log('[GetInspire Popup] Active tab:', tab.id, tab.url);

      // Check if we can inject into this tab
      if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
        throw new Error('Cannot capture browser pages');
      }

      // Start capture
      startedAt = Date.now();
      setStatus('Starting capture...');
      setProgress(0, 1);

      // Send message to background script to start capture
      chrome.runtime.sendMessage({
        type: 'START_CAPTURE',
        tabId: tab.id
      });

      setStatus('Capture in progress...');

    } catch (error) {
      console.error('[GetInspire Popup] Error:', error);
      setStatus('Error: ' + error.message);
      resetProgress();
    }
  });
}

if (stopBtn) {
  stopBtn.addEventListener('click', () => {
    console.log('[GetInspire Popup] Stop button clicked');
    setStatus('Stopping...');
    // TODO: Implement stop functionality
  });
}

if (openOptionsLink) {
  openOptionsLink.addEventListener('click', (e) => {
    e.preventDefault();
    console.log('[GetInspire Popup] Opening options');
    chrome.windows.create({
      url: 'src/options.html',
      type: 'popup',
      width: 800,
      height: 600
    });
  });
}

if (reportLink) {
  reportLink.addEventListener('click', (e) => {
    e.preventDefault();
    console.log('[GetInspire Popup] Opening issue reporter');
    chrome.tabs.create({
      url: 'https://github.com/vikast908/GetInspire/issues'
    });
  });
}

// Listen for messages from background/content scripts
chrome.runtime.onMessage.addListener((message) => {
  console.log('[GetInspire Popup] Received message:', message);

  if (message.type === 'CAPTURE_STATUS') {
    setStatus(message.status || 'Processing...');
    if (message.progress) {
      setProgress(message.progress.done, message.progress.total);
    }
  } else if (message.type === 'CAPTURE_ERROR') {
    setStatus('Error: ' + (message.error || 'Unknown error'));
    resetProgress();
  } else if (message.type === 'DOWNLOAD_SUCCESS') {
    setStatus('Download completed!');
    setProgress(100, 100);
  } else if (message.type === 'CAPTURE_COMPLETE') {
    setStatus('Capture completed!');
    setProgress(100, 100);
  }
});

// Initialize UI
resetProgress();
setModeUI('single');
setStatus('Ready to start');
