# GetInspire v2.0 Debugging Guide

## Testing Steps

### Step 1: Reload the Extension
1. Open Chrome/Edge and go to `chrome://extensions` (or `edge://extensions`)
2. Find **GetInspire** in the list
3. Click the **Reload** button (circular arrow icon)
4. Check for any errors in the extension card

### Step 2: Open Test Page
1. Navigate to any website like https://example.com
2. Or open a local documentation site for crawl testing

### Step 3: Open Browser Console
1. Press `F12` or `Ctrl+Shift+I` to open DevTools
2. Go to the **Console** tab
3. Keep this open to see logs

### Step 4: Test Single Page Capture
1. Click the GetInspire extension icon in the toolbar
2. Ensure **"This page"** is selected
3. Click **Start**
4. Watch the console for log messages

### Step 5: Test Crawl Mode (v2.0)
1. Click the GetInspire extension icon
2. Select **"Crawl site"**
3. Set max pages (e.g., 5 for testing)
4. Click **Start**
5. Watch progress in the popup ("X/Y pages")

## Expected Console Output

### Single Page Capture:
```
[GetInspire Popup] Start button clicked
[GetInspire Popup] Active tab: 123 https://...
[GetInspire BG] Starting capture for tab: 123
[GetInspire BG] JSZip injected successfully
[GetInspire BG] Content scripts injected successfully
[GetInspire] Capture starting...
[GetInspire] Detecting animation libraries...
[GetInspire] Capturing hover states...
[GetInspire] Extracting CSS-in-JS styles...
[GetInspire] Collecting assets with deduplication...
[GetInspire] Downloading assets (15 concurrent)...
[GetInspire] Creating ZIP...
[GetInspire] Download initiated successfully!
```

### Crawl Mode (v2.0):
```
[GetInspire Popup] Crawl mode selected
[GetInspire Popup] Starting crawl with maxPages: 10
[GetInspire BG] START_CRAWL received
[GetInspire BG] Initializing crawl state for domain: example.com
[GetInspire BG] Processing page 1: https://example.com
[GetInspire BG] Page captured, found 5 new links
[GetInspire BG] Processing page 2: https://example.com/about
[GetInspire BG] Page captured, found 3 new links
...
[GetInspire BG] Crawl complete: 10 pages captured
[GetInspire BG] Generating multi-page ZIP...
[GetInspire BG] Download initiated: site-capture.zip
```

## Common Issues and Solutions

### Issue 1: "JSZip not loaded"
**Cause:** JSZip library failed to inject
**Solution:**
- Check that `src/vendor/jszip.min.js` exists
- Reload the extension
- Try on a different website

### Issue 2: "Cannot capture browser pages"
**Cause:** Trying to capture chrome://, edge://, or about: pages
**Solution:**
- Navigate to a regular website (http:// or https://)

### Issue 3: No console logs appear
**Cause:** Content script not injecting
**Solution:**
- Check extension permissions in chrome://extensions
- Make sure "Site access" is set to "On click" or "On all sites"
- Reload the extension and try again

### Issue 4: Crawl stops after first page
**Cause:** Same-domain check failing or no links found
**Solution:**
- Check background console for link extraction logs
- Verify the site has internal links
- Check if links use same host (www vs non-www matters)

### Issue 5: Crawl progress not updating
**Cause:** Message passing issues
**Solution:**
- Keep popup open during crawl
- Check background service worker console
- Verify CRAWL_PROGRESS messages are being sent

### Issue 6: Duplicate assets in ZIP
**Cause:** Deduplication not working
**Solution:**
- Check console for SHA-256 hash logs
- Verify `deduplicateAssets: true` in defaults
- Reload extension

### Issue 7: Hover states not captured
**Cause:** CSS rules not extracted
**Solution:**
- Check console for "Capturing hover states" log
- Verify `captureHoverStates: true` in defaults
- Some sites may have complex CSS structures

### Issue 8: Animation library not detected
**Cause:** Library loaded after detection runs
**Solution:**
- Wait for page to fully load before capturing
- Check console for detection results
- Some libraries use non-standard globals

## Advanced Debugging

### View Background Service Worker Logs
1. Go to `chrome://extensions`
2. Find GetInspire
3. Click **"service worker"** link (under "Inspect views")
4. View console logs for background script
5. Look for crawl state and message handling logs

### View Content Script Logs
1. Open page you want to capture
2. Press F12 to open DevTools
3. Go to Console tab
4. Look for messages starting with `[GetInspire]`

### Check Crawl State
In background service worker console:
```javascript
// View current crawl state
console.log(crawlState);

// Check queue
console.log(crawlState.queue);

// Check visited URLs
console.log([...crawlState.visited]);

// Check captured pages count
console.log(crawlState.pages.length);
```

### Check Extension Permissions
1. Go to `chrome://extensions`
2. Click **Details** on GetInspire
3. Scroll to **Permissions** section
4. Should show:
   - Read and change your data on all websites
   - Download files
   - Storage
   - Access browser tabs (v2.0)

### Manifest V3 Issues
If you see errors about Manifest V2:
1. Check that `manifest.json` has `"manifest_version": 3`
2. Verify `version: "2.0.0"` is set
3. Reload the extension

## Debugging Specific Features

### Animation Library Detection
```javascript
// Run in page console to test detection
(function() {
  const libs = {
    gsap: !!(window.gsap || window.TweenMax || window.TweenLite),
    anime: !!window.anime,
    framerMotion: !!document.querySelector('[data-framer-appear-id]'),
    lottie: !!(window.lottie || window.bodymovin),
    scrollMagic: !!window.ScrollMagic,
    scrollTrigger: !!window.ScrollTrigger,
    aos: !!window.AOS
  };
  console.log('Detected animation libraries:', libs);
})();
```

### CSS-in-JS Detection
```javascript
// Check for styled-components, Emotion, etc.
document.querySelectorAll('style[data-styled], style[data-styled-components], style[data-emotion], style[data-linaria], style[data-jss]').forEach(s => {
  console.log('CSS-in-JS found:', s.dataset);
});
```

### Asset Deduplication Test
```javascript
// In content script context
// Check if assets are being deduplicated
console.log('Asset hash cache:', state.assetHashes);
```

## File Structure (v2.0)
```
GetInspire/
├── src/
│   ├── background.js         (Crawl orchestration + message handling)
│   ├── content.js            (Page capture + animation detection)
│   ├── defaults.js           (Config with v2.0 options)
│   ├── popup.js              (Mode selector + crawl handlers)
│   ├── popup.html            (UI with mode toggle)
│   ├── options.js            (Settings logic)
│   ├── options.html          (Settings UI)
│   ├── theme.js              (Theme management)
│   ├── ui.css                (Shared styles)
│   └── vendor/
│       └── jszip.min.js
├── manifest.json             (v2.0.0 with tabs permission)
├── assets/
│   └── icons/
└── DEBUGGING.md              (This file)
```

## Still Not Working?

If capture still fails after trying everything:

1. Check browser console for red error messages
2. Check background service worker console
3. Copy the full error message
4. Check if it's a permission issue
5. Try on a different website
6. Try restarting the browser

### Check Browser Version
- Chrome/Edge must be version 88 or higher for Manifest V3
- Run: `chrome://version` to check

### Test JSZip Separately
Open browser console on any page and run:
```javascript
var script = document.createElement('script');
script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
document.head.appendChild(script);
setTimeout(() => console.log('JSZip available:', typeof JSZip), 1000);
```

## Performance Debugging

### Check Concurrent Downloads
```javascript
// In content script - check concurrency
console.log('MAX_CONCURRENT:', 15);  // Should be 15 in v2.0
```

### Monitor Memory Usage
```javascript
// Check memory in background script
if (performance.memory) {
  const usage = performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit * 100;
  console.log('Memory usage:', usage.toFixed(1) + '%');
}
```

### Check Deduplication Efficiency
After a crawl, check the background console for:
```
[GetInspire BG] Deduplication saved X duplicate assets
[GetInspire BG] Final asset count: Y (from Z total)
```

## Reporting Issues

When reporting issues, include:
1. Browser and version
2. Extension version (2.0.0)
3. URL of problem site (if shareable)
4. Console logs from both page and background service worker
5. Steps to reproduce
6. Whether issue is single-page or crawl mode
