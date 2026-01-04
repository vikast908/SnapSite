// Popup script for GetInspire 2.0
console.log('[GetInspire Popup] Loaded (v2.0)');

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

// v2.0 DOM elements
const singleModeBtn = document.getElementById('singleModeBtn');
const crawlModeBtn = document.getElementById('crawlModeBtn');
const crawlOptions = document.getElementById('crawlOptions');
const maxPagesInput = document.getElementById('maxPages');

// State tracking
let captureMode = 'single'; // 'single' or 'crawl'
let startedAt = null;
let lastDone = 0;
let lastTotal = 1;
let isCrawling = false;

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

  // Update mode buttons
  if (singleModeBtn && crawlModeBtn) {
    if (mode === 'crawl') {
      singleModeBtn.classList.remove('selected');
      singleModeBtn.setAttribute('aria-pressed', 'false');
      crawlModeBtn.classList.add('selected');
      crawlModeBtn.setAttribute('aria-pressed', 'true');
      if (crawlOptions) crawlOptions.style.display = 'block';
    } else {
      singleModeBtn.classList.add('selected');
      singleModeBtn.setAttribute('aria-pressed', 'true');
      crawlModeBtn.classList.remove('selected');
      crawlModeBtn.setAttribute('aria-pressed', 'false');
      if (crawlOptions) crawlOptions.style.display = 'none';
    }
  }

  // Update stop button state
  if (isCrawling) {
    try { stopBtn.disabled = false; } catch (e) {}
  } else {
    try { stopBtn.disabled = true; } catch (e) {}
  }
}

// Mode toggle handlers (v2.0)
if (singleModeBtn) {
  singleModeBtn.addEventListener('click', () => {
    if (captureMode !== 'single' && !isCrawling) {
      setModeUI('single');
      setStatus('Ready to capture this page');
    }
  });
}

if (crawlModeBtn) {
  crawlModeBtn.addEventListener('click', () => {
    if (captureMode !== 'crawl' && !isCrawling) {
      setModeUI('crawl');
      setStatus('Ready to crawl site');
    }
  });
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
    console.log('[GetInspire Popup] Start button clicked, mode:', captureMode);

    // Prevent multiple clicks while capturing
    if (startBtn.disabled) {
      console.log('[GetInspire Popup] Start button already disabled, ignoring click');
      return;
    }

    // Disable button and add click animation
    startBtn.disabled = true;
    startBtn.style.opacity = '0.6';
    startBtn.style.cursor = 'not-allowed';
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

      // Check for other special URLs
      if (tab.url.startsWith('edge://') || tab.url.startsWith('about:') || !tab.url.startsWith('http')) {
        throw new Error('Cannot capture this type of page. Please navigate to a regular website.');
      }

      // Start capture
      startedAt = Date.now();

      if (captureMode === 'crawl') {
        // ==================== CRAWL MODE (v2.0) ====================
        const maxPages = parseInt(maxPagesInput?.value) || 10;
        isCrawling = true;

        setStatus(`Starting crawl (max ${maxPages} pages)...`);
        setProgress(5, 100);

        // Enable stop button
        if (stopBtn) stopBtn.disabled = false;

        // Send START_CRAWL message to background
        const response = await chrome.runtime.sendMessage({
          type: 'START_CRAWL',
          tabId: tab.id,
          options: {
            maxPages: maxPages,
            crawlDelay: 500
          }
        });

        console.log('[GetInspire Popup] Crawl message sent, response:', response);

        if (response && !response.success) {
          throw new Error(response.error || 'Failed to start crawl');
        }

        setStatus('Crawling site...');
        setProgress(10, 100);

      } else {
        // ==================== SINGLE PAGE MODE ====================
        setStatus('Starting capture...');
        setProgress(10, 100);

        // Send message to background script to start capture
        const response = await chrome.runtime.sendMessage({
          type: 'START_CAPTURE',
          tabId: tab.id
        });

        console.log('[GetInspire Popup] Message sent, response:', response);

        // Check if injection was successful
        if (response && !response.success) {
          throw new Error(response.error || 'Failed to inject scripts');
        }

        setStatus('Scripts injected, processing page...');
        setProgress(30, 100);
      }

    } catch (error) {
      console.error('[GetInspire Popup] Error:', error);
      setStatus('Error: ' + error.message);
      resetProgress();
      isCrawling = false;

      // Re-enable button on error
      startBtn.disabled = false;
      startBtn.style.opacity = '1';
      startBtn.style.cursor = 'pointer';
      if (stopBtn) stopBtn.disabled = true;
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
  stopBtn.addEventListener('click', async () => {
    console.log('[GetInspire Popup] Stop button clicked');

    if (isCrawling) {
      setStatus('Stopping crawl...');
      const response = await chrome.runtime.sendMessage({ type: 'STOP_CRAWL' });
      console.log('[GetInspire Popup] Stop crawl response:', response);
    } else {
      setStatus('Stopping...');
      chrome.runtime.sendMessage({ type: 'STOP_CAPTURE' });
    }
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
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[GetInspire Popup] Received message:', message.type);

  try {
    switch (message.type) {
      case 'CAPTURE_STATUS': {
        const status = message.status || 'Processing...';
        setStatus(status);

        // Update progress based on status text
        if (status.includes('Starting')) {
          setProgress(25, 100);
        } else if (status.includes('ZIP')) {
          setProgress(50, 100);
        } else if (status.includes('Generating')) {
          setProgress(75, 100);
        } else if (status.includes('download')) {
          setProgress(90, 100);
        }

        if (message.progress) {
          setProgress(message.progress.done, message.progress.total);
        }
        break;
      }

      case 'CRAWL_PROGRESS': {
        // v2.0: Handle crawl progress updates
        const { current, total, url } = message;
        setStatus(`Crawling: ${current}/${total} pages`);
        setProgress(current, total);

        // Update meta info
        if (countMetaEl) countMetaEl.textContent = `${current}/${total} pages`;
        break;
      }

      case 'CRAWL_COMPLETE': {
        // v2.0: Handle crawl completion
        const { pageCount, duration } = message;
        const durationSec = Math.round((duration || 0) / 1000);
        setStatus(`Crawl complete! ${pageCount} pages captured`);
        setProgress(100, 100);
        isCrawling = false;

        // Re-enable UI
        if (startBtn) {
          startBtn.disabled = false;
          startBtn.style.opacity = '1';
          startBtn.style.cursor = 'pointer';
        }
        if (stopBtn) stopBtn.disabled = true;
        break;
      }

      case 'MEMORY_WARNING': {
        // v2.0: Handle memory warnings
        setStatus(`Warning: High memory (${message.percent}%)`);
        break;
      }

      case 'CAPTURE_ERROR': {
        console.error('[GetInspire Popup] Capture error:', message.error);
        setStatus('Error: ' + (message.error || 'Unknown error'));
        resetProgress();
        isCrawling = false;

        // Re-enable start button
        if (startBtn) {
          startBtn.disabled = false;
          startBtn.style.opacity = '1';
          startBtn.style.cursor = 'pointer';
        }
        if (stopBtn) stopBtn.disabled = true;

        // Show alert for critical errors (non-crawl mode only)
        if (!isCrawling && message.error && message.error.length < 100) {
          setTimeout(() => alert('Capture failed: ' + message.error), 100);
        }
        break;
      }

      case 'DOWNLOAD_SUCCESS': {
        setStatus('Download completed!');
        setProgress(100, 100);
        isCrawling = false;

        // Re-enable start button
        if (startBtn) {
          startBtn.disabled = false;
          startBtn.style.opacity = '1';
          startBtn.style.cursor = 'pointer';
        }
        if (stopBtn) stopBtn.disabled = true;
        break;
      }

      case 'CAPTURE_COMPLETE': {
        setStatus('Capture completed!');
        setProgress(100, 100);

        // Re-enable start button
        if (startBtn) {
          startBtn.disabled = false;
          startBtn.style.opacity = '1';
          startBtn.style.cursor = 'pointer';
        }
        if (stopBtn) stopBtn.disabled = true;
        break;
      }

      default:
        console.log('[GetInspire Popup] Unknown message type:', message.type);
    }
  } catch (error) {
    console.error('[GetInspire Popup] Error handling message:', error);
  }

  // Always send a response to avoid "message port closed" errors
  sendResponse({ received: true });
  return true; // Keep channel open for async responses
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
