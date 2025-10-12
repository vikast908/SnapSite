# GetInspire Debugging Guide

## Changes Made to Fix Basic Capture

### 1. Created Simplified Content Script (`content-simple.js`)
- Minimal version that only captures basic HTML
- Better error handling and console logging
- Direct download without complex asset handling
- Clear status messages sent to popup

### 2. Updated Background Script (`background.js`)
- Added delay between JSZip injection and content script injection
- Better error logging with stack traces
- Separated JSZip and content script injection
- Using `content-simple.js` for testing

### 3. Enhanced Popup Script (`popup.js`)
- Better URL validation (checks for edge://, about:, etc.)
- Progress bar updates based on status messages
- Improved error handling and user feedback
- Better message listener with response handling

## Testing Steps

### Step 1: Reload the Extension
1. Open Chrome/Edge and go to `chrome://extensions` (or `edge://extensions`)
2. Find **GetInspire** in the list
3. Click the **Reload** button (circular arrow icon)
4. Check for any errors in the extension card

### Step 2: Open Test Page
1. Open the file: `test-page.html` in your browser
   - Or navigate to any simple website like https://example.com

### Step 3: Open Browser Console
1. Press `F12` or `Ctrl+Shift+I` to open DevTools
2. Go to the **Console** tab
3. Keep this open to see logs

### Step 4: Test the Capture
1. Click the GetInspire extension icon in the toolbar
2. Click **"This page"** button
3. Watch the console for log messages

### Expected Console Output:
```
[GetInspire Popup] Start button clicked
[GetInspire Popup] Active tab: 123 https://...
[GetInspire BG] Starting capture for tab: 123
[GetInspire BG] JSZip injected successfully
[GetInspire BG] Content scripts injected successfully
[GetInspire] Simple capture starting...
[GetInspire] Collecting page HTML...
[GetInspire] HTML collected: XXXXX characters
[GetInspire] Creating ZIP...
[GetInspire] Generating ZIP blob...
[GetInspire] ZIP created: XXXXX bytes
[GetInspire] Initiating download...
[GetInspire] Download initiated successfully!
```

### Step 5: Check Downloads
- A ZIP file should be downloaded to your downloads folder
- Filename format: `hostname-YYYY-MM-DDTHH-MM-SS.zip`
- Extract and open `index.html` to verify capture

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
- Use the included `test-page.html`

### Issue 3: No console logs appear
**Cause:** Content script not injecting
**Solution:**
- Check extension permissions in chrome://extensions
- Make sure "Site access" is set to "On click" or "On all sites"
- Reload the extension and try again

### Issue 4: Extension icon is greyed out
**Cause:** Extension not active on current tab
**Solution:**
- Click the extension icon anyway
- Or navigate to a regular webpage

### Issue 5: "Message port closed" errors
**Cause:** Popup closed before capture finished
**Solution:**
- Keep popup open during capture
- Or check Downloads folder (capture may have completed anyway)

## Advanced Debugging

### View Background Service Worker Logs
1. Go to `chrome://extensions`
2. Find GetInspire
3. Click **"service worker"** link (under "Inspect views")
4. View console logs for background script

### View Content Script Logs
1. Open page you want to capture
2. Press F12 to open DevTools
3. Go to Console tab
4. Look for messages starting with `[GetInspire]`

### Check Extension Permissions
1. Go to `chrome://extensions`
2. Click **Details** on GetInspire
3. Scroll to **Permissions** section
4. Should show:
   - Read and change your data on all websites
   - Download files
   - Storage

### Manifest V3 Issues
If you see errors about Manifest V2:
1. Check that `manifest.json` has `"manifest_version": 3`
2. Reload the extension

## Switching Back to Full Version

Once basic capture works, to switch back to the full version:

1. Edit `src/background.js`
2. Change line 32 from:
   ```javascript
   files: ['src/content-simple.js'] // Changed to simple version for debugging
   ```
   To:
   ```javascript
   files: ['src/content.js'] // Full version with asset downloading
   ```
3. Reload the extension

## Still Not Working?

If capture still fails after trying everything:

1. Check browser console for red error messages
2. Copy the full error message
3. Check if it's a permission issue
4. Try on a different website
5. Try restarting the browser

### Check Browser Version
- Chrome/Edge must be version 88 or higher for Manifest V3
- Run: `chrome://version` to check

### Test JSZip Separately
Open browser console on any page and run:
```javascript
// Test if you can load JSZip manually
var script = document.createElement('script');
script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
document.head.appendChild(script);
setTimeout(() => console.log('JSZip available:', typeof JSZip), 1000);
```

If this works, the issue is with the extension's JSZip file.

## Next Steps After Fixing

Once basic capture works:
1. Test the full version (`content.js`)
2. Test on pages with images and CSS
3. Test on complex websites
4. Verify carousel expansion works
5. Check asset downloading

## File Structure
```
GetInspire/
├── src/
│   ├── background.js         (Updated with better logging)
│   ├── content.js            (Original full version)
│   ├── content-simple.js     (New: minimal test version)
│   ├── popup.js              (Updated with better error handling)
│   ├── popup.html
│   └── vendor/
│       └── jszip.min.js
├── test-page.html            (New: simple test page)
├── manifest.json
└── DEBUGGING.md              (This file)
```
