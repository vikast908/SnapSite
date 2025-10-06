const statusEl = document.getElementById('status');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const barEl = document.getElementById('bar');
const pctEl = document.getElementById('pct');
const countMetaEl = document.getElementById('countMeta');
const elapsedMetaEl = document.getElementById('elapsedMeta');
const openOptionsLink = document.getElementById('openOptionsLink');
const reportLink = document.getElementById('reportLink');
// Simple popup script for GetInspire
console.log('[GetInspire Popup] Loaded');

const captureBtn = document.getElementById('captureBtn');
const statusDiv = document.getElementById('status');

// Handle capture button click
captureBtn.addEventListener('click', async () => {
  console.log('[GetInspire Popup] Capture button clicked');

  // Disable button
  captureBtn.disabled = true;
  setStatus('Starting capture...', 'normal');

  try {
    // Get the active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

function setStatus(s) { if (statusEl) statusEl.textContent = s; }
function setSelected(btn, on){ try { if (!btn) return; btn.classList.toggle('selected', !!on); btn.setAttribute('aria-pressed', on ? 'true' : 'false'); } catch {} }
function setModeUI(mode){
  captureMode = mode;
  if (mode === 'crawl'){
    setSelected(startBtn, false);
    try { startBtn.disabled = true; } catch {}
    try { stopBtn.disabled = false; } catch {}
  } else {
    setSelected(startBtn, true);
    try { startBtn.disabled = false; } catch {}
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

    if (!tab) {
      throw new Error('No active tab found');
    }


    console.log('[GetInspire Popup] Active tab:', tab.id, tab.url);

    // Check if we can inject into this tab
    if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
      throw new Error('Cannot capture browser pages');
    }

    // Send message to background script to start capture
    chrome.runtime.sendMessage({
      type: 'START_CAPTURE',
      tabId: tab.id
    });

    setStatus('Capture in progress...', 'normal');

// Crawl functionality removed from UI but backend functionality remains intact
    // Re-enable button after 5 seconds
    setTimeout(() => {
      captureBtn.disabled = false;
      setStatus('Ready to capture', 'normal');
    }, 5000);


  } catch (error) {
    console.error('[GetInspire Popup] Error:', error);
    setStatus('Error: ' + error.message, 'error');
    captureBtn.disabled = false;
  }
});

// Listen for messages from background/content scripts
chrome.runtime.onMessage.addListener((message) => {
  console.log('[GetInspire Popup] Received message:', message);

  if (message.type === 'CAPTURE_STATUS') {
    setStatus(message.status, 'normal');
  } else if (message.type === 'CAPTURE_ERROR') {
    setStatus('Error: ' + message.error, 'error');
    captureBtn.disabled = false;
  } else if (message.type === 'DOWNLOAD_SUCCESS') {
    setStatus('Download completed!', 'success');
    captureBtn.disabled = false;
  }
});

function setStatus(text, type = 'normal') {
  statusDiv.textContent = text;
  statusDiv.className = '';

  if (type === 'error') {
    statusDiv.className = 'error';
  } else if (type === 'success') {
    statusDiv.className = 'success';
  }
}