// Simple background script for GetInspire
console.log('[GetInspire BG] Background script loaded');

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[GetInspire BG] Received message:', message.type);

  if (message.type === 'START_CAPTURE') {
    handleStartCapture(message.tabId);
  } else if (message.type === 'DOWNLOAD_ZIP') {
    handleDownloadZip(message.data);
  }
});

async function handleStartCapture(tabId) {
  console.log('[GetInspire BG] Starting capture for tab:', tabId);

  try {
    // First, inject JSZip
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['src/vendor/jszip.min.js']
    });
    console.log('[GetInspire BG] JSZip injected successfully');

    // Small delay to ensure JSZip is fully loaded
    await new Promise(resolve => setTimeout(resolve, 100));

    // Then inject content script (use simple version for testing)
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['src/content-simple.js'] // Changed to simple version for debugging
    });

    console.log('[GetInspire BG] Content scripts injected successfully');
  } catch (error) {
    console.error('[GetInspire BG] Failed to inject scripts:', error);
    console.error('[GetInspire BG] Error details:', error.stack);

    // Send error back to popup
    chrome.runtime.sendMessage({
      type: 'CAPTURE_ERROR',
      error: error.message
    }).catch(err => console.error('[GetInspire BG] Failed to send error message:', err));
  }
}

async function handleDownloadZip(data) {
  console.log('[GetInspire BG] Downloading ZIP file');

  try {
    // Create blob URL and download
    const blob = new Blob([data.zipData], { type: 'application/zip' });
    const url = URL.createObjectURL(blob);

    await chrome.downloads.download({
      url: url,
      filename: data.filename,
      saveAs: true
    });

    // Clean up blob URL after a delay
    setTimeout(() => URL.revokeObjectURL(url), 60000);

    // Send success message to popup
    chrome.runtime.sendMessage({ type: 'DOWNLOAD_SUCCESS' });
  } catch (error) {
    console.error('[GetInspire BG] Download failed:', error);
    chrome.runtime.sendMessage({
      type: 'DOWNLOAD_ERROR',
      error: error.message
    });
  }
}