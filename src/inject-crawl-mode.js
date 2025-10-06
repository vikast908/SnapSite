// Flags read by content.js to tweak behavior when running under site crawl
try {
  window.__GETINSPIRE_MODE = 'crawl';
  // Show a tiny overlay in crawl mode even if popup is closed
  window.__GETINSPIRE_SUPPRESS_OVERLAY = false;
  window.__GETINSPIRE_FORCE_OVERLAY = true;
  window.__GETINSPIRE_OVERLAY_MODE = 'mini';
} catch {}
