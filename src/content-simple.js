// Simplified content script for basic capture testing
(async function() {
  console.log('[GetInspire] Simple capture starting...');

  // Check if already running
  if (window.__GETINSPIRE_RUNNING__) {
    console.log('[GetInspire] Already running, exiting');
    alert('Capture already in progress!');
    return;
  }
  window.__GETINSPIRE_RUNNING__ = true;

  // Check if JSZip is available
  if (!window.JSZip) {
    console.error('[GetInspire] JSZip not loaded!');
    alert('JSZip library not loaded! Please reload the page and try again.');
    window.__GETINSPIRE_RUNNING__ = false;
    return;
  }

  try {
    // Send status to popup
    chrome.runtime.sendMessage({
      type: 'CAPTURE_STATUS',
      status: 'Starting basic capture...'
    }).catch(err => console.warn('Failed to send message:', err));

    console.log('[GetInspire] Collecting page HTML...');

    // Get basic HTML
    const htmlContent = document.documentElement.outerHTML;
    console.log('[GetInspire] HTML collected:', htmlContent.length, 'characters');

    // Create ZIP file
    console.log('[GetInspire] Creating ZIP...');
    chrome.runtime.sendMessage({
      type: 'CAPTURE_STATUS',
      status: 'Creating ZIP file...'
    }).catch(err => console.warn('Failed to send message:', err));

    const zip = new JSZip();
    zip.file('index.html', htmlContent);

    // Add simple readme
    const readme = `# Captured Page
URL: ${window.location.href}
Title: ${document.title}
Captured: ${new Date().toISOString()}

This is a basic HTML capture without assets.
`;
    zip.file('README.md', readme);

    // Generate ZIP
    console.log('[GetInspire] Generating ZIP blob...');
    chrome.runtime.sendMessage({
      type: 'CAPTURE_STATUS',
      status: 'Generating ZIP...'
    }).catch(err => console.warn('Failed to send message:', err));

    const zipBlob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });

    console.log('[GetInspire] ZIP created:', zipBlob.size, 'bytes');

    // Create filename
    const hostname = window.location.hostname.replace(/[^a-z0-9]/gi, '-');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `${hostname}-${timestamp}.zip`;

    // Download
    console.log('[GetInspire] Initiating download...');
    chrome.runtime.sendMessage({
      type: 'CAPTURE_STATUS',
      status: 'Starting download...'
    }).catch(err => console.warn('Failed to send message:', err));

    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();

    // Clean up after a short delay
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1000);

    // Send success message
    console.log('[GetInspire] Download initiated successfully!');
    chrome.runtime.sendMessage({
      type: 'CAPTURE_STATUS',
      status: 'Download started! Check your downloads folder.'
    }).catch(err => console.warn('Failed to send message:', err));

    // Show alert to user
    alert(`Capture complete! Downloading: ${filename}`);

  } catch (error) {
    console.error('[GetInspire] Capture failed:', error);
    chrome.runtime.sendMessage({
      type: 'CAPTURE_ERROR',
      error: error.message
    }).catch(err => console.warn('Failed to send error message:', err));
    alert('Capture failed: ' + error.message);
  } finally {
    // Clean up
    window.__GETINSPIRE_RUNNING__ = false;
  }
})();
