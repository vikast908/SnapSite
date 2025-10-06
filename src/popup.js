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
const themeToggle = document.getElementById('themeToggle');
const themeIcon = document.getElementById('themeIcon');

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

// Event handlers with micro-interactions
if (startBtn) {
  startBtn.addEventListener('click', async () => {
    console.log('[GetInspire Popup] Start button clicked');

    // Add click animation
    startBtn.style.transform = 'scale(0.95)';
    setTimeout(() => {
      startBtn.style.transform = '';
    }, 100);

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

  // Add hover effect
  startBtn.addEventListener('mouseenter', () => {
    startBtn.style.transform = 'translateY(-1px)';
  });

  startBtn.addEventListener('mouseleave', () => {
    startBtn.style.transform = '';
  });
}

if (stopBtn) {
  stopBtn.addEventListener('click', () => {
    console.log('[GetInspire Popup] Stop button clicked');
    setStatus('Stopping...');
    chrome.runtime.sendMessage({ type: 'STOP_CAPTURE' });
  });
}

if (openOptionsLink) {
  openOptionsLink.addEventListener('click', (e) => {
    e.preventDefault();
    console.log('[GetInspire Popup] Opening options');

    // Add click animation
    openOptionsLink.style.transform = 'rotate(90deg) scale(0.9)';
    setTimeout(() => {
      openOptionsLink.style.transform = '';
    }, 200);

    chrome.windows.create({
      url: 'src/options.html',
      type: 'popup',
      width: 900,
      height: 700
    });
  });

  // Add hover effect
  openOptionsLink.addEventListener('mouseenter', () => {
    openOptionsLink.style.transform = 'rotate(45deg)';
  });

  openOptionsLink.addEventListener('mouseleave', () => {
    openOptionsLink.style.transform = '';
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

// Theme management
let currentTheme = 'auto';

// Update theme icon based on current theme
function updateThemeIcon(theme) {
  const sunIcon = `<circle cx="12" cy="12" r="5"/><path d="M12 1v6m0 6v6M4.22 4.22l4.24 4.24m5.08 5.08l4.24 4.24M1 12h6m6 0h6M4.22 19.78l4.24-4.24m5.08-5.08l4.24-4.24"/>`;
  const moonIcon = `<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>`;
  const autoIcon = `<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41"/>`;

  if (theme === 'light') {
    themeIcon.innerHTML = sunIcon;
    themeToggle.title = 'Switch to Dark Theme';
  } else if (theme === 'dark') {
    themeIcon.innerHTML = moonIcon;
    themeToggle.title = 'Switch to Auto Theme';
  } else {
    themeIcon.innerHTML = autoIcon;
    themeToggle.title = 'Switch to Light Theme';
  }
}

// Apply theme to popup
function applyTheme(theme) {
  currentTheme = theme;
  const html = document.documentElement;

  // Remove existing theme attributes
  html.removeAttribute('data-theme');

  if (theme === 'light') {
    html.setAttribute('data-theme', 'light');
  } else if (theme === 'dark') {
    html.setAttribute('data-theme', 'dark');
  }
  // For 'auto', we don't set data-theme, so it uses system preference

  updateThemeIcon(theme);

  // Save theme
  chrome.storage.sync.set({ getinspireTheme: theme });
}

// Cycle through themes: auto -> light -> dark -> auto
function cycleTheme() {
  const nextTheme = currentTheme === 'auto' ? 'light' : (currentTheme === 'light' ? 'dark' : 'auto');
  applyTheme(nextTheme);

  // Add animation feedback
  themeToggle.style.transform = 'rotate(180deg)';
  setTimeout(() => {
    themeToggle.style.transform = '';
  }, 300);
}

// Load initial theme
chrome.storage.sync.get(['getinspireTheme'], (result) => {
  const theme = result.getinspireTheme || 'auto';
  applyTheme(theme);
});

// Theme toggle event
if (themeToggle) {
  themeToggle.addEventListener('click', (e) => {
    e.preventDefault();
    cycleTheme();
  });
}

// Initialize UI
resetProgress();
setModeUI('single');
setStatus('Ready to start');
