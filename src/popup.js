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