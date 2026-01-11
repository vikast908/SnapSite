// Popup script for SnapSite 2.1
// Cross-browser compatibility
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;
console.log('[SnapSite Popup] Loaded (v2.1)');

// DOM elements
const statusEl = document.getElementById('status');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const barEl = document.getElementById('bar');
const pctEl = document.getElementById('pct');
const countMetaEl = document.getElementById('countMeta');
const elapsedMetaEl = document.getElementById('elapsedMeta');
const openOptionsLink = document.getElementById('openOptionsLink');
const singleModeBtn = document.getElementById('singleModeBtn');
const crawlModeBtn = document.getElementById('crawlModeBtn');
const crawlOptions = document.getElementById('crawlOptions');
const maxPagesInput = document.getElementById('maxPages');

// State
let captureMode = 'single';
let startedAt = null;
let isCapturing = false;

// Utilities
function setStatus(text) {
  if (statusEl) statusEl.textContent = text;
}

function fmtTime(ms) {
  const sec = Math.max(0, Math.floor(ms / 1000));
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function setProgress(done, total) {
  total = Math.max(1, Number(total) || 1);
  done = Math.max(0, Math.min(total, Number(done) || 0));
  const pct = Math.floor((done * 100) / total);

  if (barEl) barEl.style.width = Math.min(99, pct) + '%';
  if (pctEl) pctEl.textContent = pct + '%';
  if (countMetaEl) countMetaEl.textContent = `${done} assets`;

  const elapsed = startedAt ? Date.now() - startedAt : 0;
  if (elapsedMetaEl) elapsedMetaEl.textContent = fmtTime(elapsed);
}

function resetProgress() {
  setProgress(0, 1);
  startedAt = null;
}

function showCapturingState() {
  isCapturing = true;
  startBtn.classList.add('hidden');
  stopBtn.classList.remove('hidden');
}

function showReadyState() {
  isCapturing = false;
  startBtn.classList.remove('hidden');
  stopBtn.classList.add('hidden');
}

// Mode selection
function setModeUI(mode) {
  captureMode = mode;

  [singleModeBtn, crawlModeBtn].forEach(btn => {
    if (btn) {
      btn.classList.remove('selected');
      btn.setAttribute('aria-pressed', 'false');
    }
  });

  if (mode === 'single' && singleModeBtn) {
    singleModeBtn.classList.add('selected');
    singleModeBtn.setAttribute('aria-pressed', 'true');
    crawlOptions?.classList.add('hidden');
  } else if (mode === 'crawl' && crawlModeBtn) {
    crawlModeBtn.classList.add('selected');
    crawlModeBtn.setAttribute('aria-pressed', 'true');
    crawlOptions?.classList.remove('hidden');
  }
}

if (singleModeBtn) {
  singleModeBtn.addEventListener('click', () => {
    if (!isCapturing) {
      setModeUI('single');
      setStatus('Ready to capture');
    }
  });
}

if (crawlModeBtn) {
  crawlModeBtn.addEventListener('click', () => {
    if (!isCapturing) {
      setModeUI('crawl');
      setStatus('Ready to crawl site');
    }
  });
}

// Start capture
if (startBtn) {
  startBtn.addEventListener('click', async () => {
    if (isCapturing) return;

    try {
      const [tab] = await browserAPI.tabs.query({ active: true, currentWindow: true });

      if (!tab) throw new Error('No active tab');
      if (tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') ||
          tab.url.startsWith('about:') || !tab.url.startsWith('http')) {
        throw new Error('Cannot capture this page');
      }

      startedAt = Date.now();
      showCapturingState();

      if (captureMode === 'crawl') {
        const maxPages = parseInt(maxPagesInput?.value) || 10;
        setStatus(`Starting crawl (max ${maxPages} pages)...`);
        setProgress(5, 100);

        const response = await browserAPI.runtime.sendMessage({
          type: 'START_CRAWL',
          tabId: tab.id,
          options: { maxPages, crawlDelay: 500 }
        });

        if (response && !response.success) {
          throw new Error(response.error || 'Failed to start crawl');
        }
      } else {
        setStatus('Starting capture...');
        setProgress(10, 100);

        const response = await browserAPI.runtime.sendMessage({
          type: 'START_CAPTURE',
          tabId: tab.id
        });

        if (response && !response.success) {
          throw new Error(response.error || 'Failed to start capture');
        }
      }
    } catch (error) {
      console.error('[SnapSite] Error:', error);
      setStatus('Error: ' + error.message);
      resetProgress();
      showReadyState();
    }
  });
}

// Stop capture
if (stopBtn) {
  stopBtn.addEventListener('click', async () => {
    setStatus('Stopping...');
    browserAPI.runtime.sendMessage({
      type: captureMode === 'crawl' ? 'STOP_CRAWL' : 'STOP_CAPTURE'
    });
  });
}

// Open settings
if (openOptionsLink) {
  openOptionsLink.addEventListener('click', (e) => {
    e.preventDefault();
    browserAPI.windows.create({
      url: browserAPI.runtime.getURL('src/options.html'),
      type: 'popup',
      width: 720,
      height: 700
    });
  });
}

// Message handler
browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[SnapSite Popup] Message:', message.type);

  switch (message.type) {
    case 'CAPTURE_STATUS':
      setStatus(message.status || 'Processing...');
      if (message.progress) {
        setProgress(message.progress.done, message.progress.total);
      }
      break;

    case 'CRAWL_PROGRESS':
      setStatus(`Crawling: ${message.current}/${message.total} pages`);
      setProgress(message.current, message.total);
      if (countMetaEl) countMetaEl.textContent = `${message.current}/${message.total} pages`;
      break;

    case 'CRAWL_COMPLETE':
      setStatus(`Done! ${message.pageCount} pages captured`);
      setProgress(100, 100);
      showReadyState();
      break;

    case 'CAPTURE_COMPLETE':
    case 'DOWNLOAD_SUCCESS':
      setStatus('Download complete!');
      setProgress(100, 100);
      showReadyState();
      break;

    case 'CAPTURE_ERROR':
      setStatus('Error: ' + (message.error || 'Unknown'));
      resetProgress();
      showReadyState();
      break;

    case 'MEMORY_WARNING':
      setStatus(`Warning: High memory (${message.percent}%)`);
      break;
  }

  sendResponse({ received: true });
  return true;
});

// Initialize
resetProgress();
setModeUI('single');
setStatus('Ready to capture');
