console.log('[GetInspire Test] Script loaded');
console.log('[GetInspire Test] window.JSZip:', typeof window.JSZip);
console.log('[GetInspire Test] chrome.runtime:', typeof chrome.runtime);

// Test basic message passing
chrome.runtime.sendMessage({ type: 'TEST', message: 'Hello from test content script' }, (response) => {
  console.log('[GetInspire Test] Got response:', response);
  if (chrome.runtime.lastError) {
    console.error('[GetInspire Test] Error:', chrome.runtime.lastError);
  }
});

// After 2 seconds, trigger actual capture
setTimeout(() => {
  console.log('[GetInspire Test] Starting actual capture after 2 seconds');
  alert('Check console - JSZip available: ' + (typeof window.JSZip !== 'undefined'));
}, 2000);