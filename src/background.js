// Simple background script for GetInspire
console.log('[GetInspire BG] Background script loaded');

// Track which tabs are currently capturing to prevent duplicate injections
const capturingTabs = new Set();

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[GetInspire BG] Received message:', message.type);

  if (message.type === 'START_CAPTURE') {
    handleStartCapture(message.tabId, sendResponse);
    return true; // Keep message channel open for async response
  } else if (message.type === 'DOWNLOAD_ZIP') {
    handleDownloadZip(message.data);
  } else if (message.type === 'CAPTURE_COMPLETE' || message.type === 'CAPTURE_ERROR') {
    // Remove tab from capturing set when done
    if (sender.tab) {
      capturingTabs.delete(sender.tab.id);
    }
  }

  return false;
});

async function handleStartCapture(tabId, sendResponse) {
  console.log('[GetInspire BG] Starting capture for tab:', tabId);

  // Check if this tab is already capturing
  if (capturingTabs.has(tabId)) {
    console.warn('[GetInspire BG] Capture already in progress for tab:', tabId);
    sendResponse({ success: false, error: 'Capture already in progress for this tab' });
    return;
  }

  // Mark this tab as capturing
  capturingTabs.add(tabId);

  // Set a timeout to automatically clear this tab after 5 minutes (in case of stalled capture)
  const timeoutId = setTimeout(() => {
    if (capturingTabs.has(tabId)) {
      console.warn('[GetInspire BG] Capture timeout for tab:', tabId, '- clearing...');
      capturingTabs.delete(tabId);
    }
  }, 5 * 60 * 1000); // 5 minutes

  try {
    // First, inject JSZip
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['src/vendor/jszip.min.js']
    });
    console.log('[GetInspire BG] JSZip injected successfully');

    // Small delay to ensure JSZip is fully loaded
    await new Promise(resolve => setTimeout(resolve, 100));

    // Then inject content script
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['src/content.js']
    });

    console.log('[GetInspire BG] Content scripts injected successfully');

    // Send success response back to popup
    sendResponse({ success: true });
  } catch (error) {
    console.error('[GetInspire BG] Failed to inject scripts:', error);
    console.error('[GetInspire BG] Error details:', error.stack);

    // Remove from capturing tabs on error
    capturingTabs.delete(tabId);

    // Send error response back to popup
    sendResponse({ success: false, error: error.message });

    // Also send error back to popup via message
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