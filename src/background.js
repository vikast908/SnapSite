// GetInspire 2.0 Background Script with Multi-Page Crawling Support
console.log('[GetInspire BG] Background script loaded (v2.0)');

// Track which tabs are currently capturing to prevent duplicate injections
const capturingTabs = new Set();

// ==================== CRAWL STATE MANAGEMENT (v2.0) ====================

const crawlState = {
  isRunning: false,
  queue: [],              // URLs to crawl
  visited: new Set(),     // Already crawled URLs
  pages: [],              // Captured page data [{url, html, title}]
  assets: new Map(),      // hash -> {blob, filename} for deduplication
  assetUrlToHash: new Map(), // url -> hash mapping
  baseDomain: null,
  maxPages: 100,
  currentTabId: null,
  startTime: null,
  crawlDelay: 500,        // ms between page captures
  pageCount: 0
};

function resetCrawlState() {
  crawlState.isRunning = false;
  crawlState.queue = [];
  crawlState.visited.clear();
  crawlState.pages = [];
  crawlState.assets.clear();
  crawlState.assetUrlToHash.clear();
  crawlState.baseDomain = null;
  crawlState.currentTabId = null;
  crawlState.startTime = null;
  crawlState.pageCount = 0;
}

// ==================== MESSAGE HANDLING ====================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[GetInspire BG] Received message:', message.type);

  switch (message.type) {
    case 'START_CAPTURE':
      handleStartCapture(message.tabId, sendResponse);
      return true; // Keep message channel open for async response

    case 'START_CRAWL':
      handleStartCrawl(message.tabId, message.options, sendResponse);
      return true;

    case 'STOP_CRAWL':
      handleStopCrawl(sendResponse);
      return true;

    case 'PAGE_CAPTURED':
      handlePageCaptured(message.pageData, message.links, sender);
      break;

    case 'ASSET_REGISTER':
      handleAssetRegister(message.url, message.hash, message.data, sendResponse);
      return true;

    case 'ASSET_CHECK':
      handleAssetCheck(message.hash, sendResponse);
      return true;

    case 'DOWNLOAD_ZIP':
      handleDownloadZip(message.data);
      break;

    case 'CAPTURE_COMPLETE':
    case 'CAPTURE_ERROR':
      // Remove tab from capturing set when done
      if (sender.tab) {
        capturingTabs.delete(sender.tab.id);
      }
      break;

    default:
      console.log('[GetInspire BG] Unknown message type:', message.type);
  }

  return false;
});

// ==================== SINGLE PAGE CAPTURE ====================

async function handleStartCapture(tabId, sendResponse) {
  console.log('[GetInspire BG] Starting single-page capture for tab:', tabId);

  // Check if this tab is already capturing
  if (capturingTabs.has(tabId)) {
    console.warn('[GetInspire BG] Capture already in progress for tab:', tabId);
    sendResponse({ success: false, error: 'Capture already in progress for this tab' });
    return;
  }

  // Mark this tab as capturing
  capturingTabs.add(tabId);

  // Set a timeout to automatically clear this tab after 5 minutes
  setTimeout(() => {
    if (capturingTabs.has(tabId)) {
      console.warn('[GetInspire BG] Capture timeout for tab:', tabId, '- clearing...');
      capturingTabs.delete(tabId);
    }
  }, 5 * 60 * 1000);

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
    sendResponse({ success: true });
  } catch (error) {
    console.error('[GetInspire BG] Failed to inject scripts:', error);
    capturingTabs.delete(tabId);
    sendResponse({ success: false, error: error.message });

    chrome.runtime.sendMessage({
      type: 'CAPTURE_ERROR',
      error: error.message
    }).catch(() => {});
  }
}

// ==================== MULTI-PAGE CRAWL (v2.0) ====================

async function handleStartCrawl(tabId, options, sendResponse) {
  console.log('[GetInspire BG] Starting crawl for tab:', tabId, 'options:', options);

  if (crawlState.isRunning) {
    sendResponse({ success: false, error: 'Crawl already in progress' });
    return;
  }

  try {
    // Get the current tab URL
    const tab = await chrome.tabs.get(tabId);
    const startUrl = tab.url;
    const urlObj = new URL(startUrl);

    // Reset and initialize crawl state
    resetCrawlState();
    crawlState.isRunning = true;
    crawlState.baseDomain = urlObj.hostname;
    crawlState.maxPages = options.maxPages || 100;
    crawlState.currentTabId = tabId;
    crawlState.startTime = Date.now();
    crawlState.crawlDelay = options.crawlDelay || 500;

    // Add starting URL to queue
    const normalizedStart = normalizeUrl(startUrl);
    crawlState.queue.push(normalizedStart);

    console.log('[GetInspire BG] Crawl initialized:', {
      baseDomain: crawlState.baseDomain,
      maxPages: crawlState.maxPages,
      startUrl: normalizedStart
    });

    sendResponse({ success: true });

    // Start crawling
    await processNextPage();

  } catch (error) {
    console.error('[GetInspire BG] Failed to start crawl:', error);
    resetCrawlState();
    sendResponse({ success: false, error: error.message });
  }
}

function handleStopCrawl(sendResponse) {
  console.log('[GetInspire BG] Stopping crawl...');

  if (crawlState.isRunning) {
    crawlState.isRunning = false;

    // If we have pages, generate the ZIP
    if (crawlState.pages.length > 0) {
      generateCrawlZip().then(() => {
        resetCrawlState();
        if (sendResponse) sendResponse({ success: true, pagesCaputred: crawlState.pages.length });
      });
    } else {
      resetCrawlState();
      if (sendResponse) sendResponse({ success: true, pagesCaptured: 0 });
    }
  } else {
    if (sendResponse) sendResponse({ success: false, error: 'No crawl in progress' });
  }
}

async function processNextPage() {
  if (!crawlState.isRunning) {
    console.log('[GetInspire BG] Crawl stopped');
    return;
  }

  // Check if we've reached the max pages
  if (crawlState.pageCount >= crawlState.maxPages) {
    console.log('[GetInspire BG] Reached max pages limit:', crawlState.maxPages);
    await finishCrawl();
    return;
  }

  // Get next URL from queue
  let nextUrl = null;
  while (crawlState.queue.length > 0 && !nextUrl) {
    const candidate = crawlState.queue.shift();
    if (!crawlState.visited.has(candidate)) {
      nextUrl = candidate;
    }
  }

  if (!nextUrl) {
    console.log('[GetInspire BG] No more URLs to crawl');
    await finishCrawl();
    return;
  }

  // Mark as visited
  crawlState.visited.add(nextUrl);
  crawlState.pageCount++;

  console.log(`[GetInspire BG] Crawling page ${crawlState.pageCount}/${crawlState.maxPages}: ${nextUrl}`);

  // Update popup with progress
  chrome.runtime.sendMessage({
    type: 'CRAWL_PROGRESS',
    current: crawlState.pageCount,
    total: Math.min(crawlState.maxPages, crawlState.queue.length + crawlState.pageCount),
    url: nextUrl
  }).catch(() => {});

  try {
    // Navigate to the URL
    await chrome.tabs.update(crawlState.currentTabId, { url: nextUrl });

    // Wait for page to load
    await waitForPageLoad(crawlState.currentTabId);

    // Add a small delay for dynamic content
    await new Promise(r => setTimeout(r, crawlState.crawlDelay));

    // Inject scripts for crawl mode capture
    await injectCrawlScripts(crawlState.currentTabId, crawlState.baseDomain);

  } catch (error) {
    console.error('[GetInspire BG] Error processing page:', nextUrl, error);

    // Continue to next page on error
    await new Promise(r => setTimeout(r, 500));
    await processNextPage();
  }
}

async function waitForPageLoad(tabId, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const checkComplete = async () => {
      try {
        const tab = await chrome.tabs.get(tabId);
        if (tab.status === 'complete') {
          resolve();
        } else if (Date.now() - startTime > timeoutMs) {
          resolve(); // Timeout, but continue anyway
        } else {
          setTimeout(checkComplete, 200);
        }
      } catch (e) {
        reject(e);
      }
    };

    checkComplete();
  });
}

async function injectCrawlScripts(tabId, baseDomain) {
  try {
    // Set crawl mode variables
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: (domain) => {
        window.__GETINSPIRE_CRAWL_MODE__ = true;
        window.__GETINSPIRE_CRAWL_DOMAIN__ = domain;
      },
      args: [baseDomain]
    });

    // Inject JSZip (still needed for individual page processing)
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['src/vendor/jszip.min.js']
    });

    await new Promise(r => setTimeout(r, 100));

    // Inject content script
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['src/content.js']
    });

    console.log('[GetInspire BG] Crawl scripts injected for tab:', tabId);
  } catch (error) {
    console.error('[GetInspire BG] Failed to inject crawl scripts:', error);
    throw error;
  }
}

function handlePageCaptured(pageData, links, sender) {
  if (!crawlState.isRunning) return;

  console.log('[GetInspire BG] Page captured:', pageData.url, 'with', links?.length || 0, 'links');

  // Store page data
  crawlState.pages.push({
    url: pageData.url,
    title: pageData.title,
    html: pageData.html,
    assets: pageData.assets || []
  });

  // Add new links to queue (filtered to same domain)
  if (links && Array.isArray(links)) {
    for (const link of links) {
      const normalized = normalizeUrl(link);
      if (!crawlState.visited.has(normalized) && !crawlState.queue.includes(normalized)) {
        // Verify same domain
        try {
          const linkUrl = new URL(normalized);
          if (linkUrl.hostname === crawlState.baseDomain ||
              linkUrl.hostname.endsWith('.' + crawlState.baseDomain)) {
            crawlState.queue.push(normalized);
          }
        } catch (e) {}
      }
    }
  }

  console.log('[GetInspire BG] Queue size:', crawlState.queue.length, 'Visited:', crawlState.visited.size);

  // Process next page
  setTimeout(() => processNextPage(), 100);
}

function handleAssetRegister(url, hash, data, sendResponse) {
  if (hash && !crawlState.assets.has(hash)) {
    crawlState.assets.set(hash, {
      filename: data.filename,
      blob: data.blob
    });
  }
  if (url && hash) {
    crawlState.assetUrlToHash.set(url, hash);
  }
  sendResponse({ success: true });
}

function handleAssetCheck(hash, sendResponse) {
  const exists = crawlState.assets.has(hash);
  sendResponse({ exists: exists });
}

async function finishCrawl() {
  console.log('[GetInspire BG] Finishing crawl with', crawlState.pages.length, 'pages');

  crawlState.isRunning = false;

  if (crawlState.pages.length > 0) {
    await generateCrawlZip();
  }

  // Send completion message
  chrome.runtime.sendMessage({
    type: 'CRAWL_COMPLETE',
    pageCount: crawlState.pages.length,
    duration: Date.now() - crawlState.startTime
  }).catch(() => {});

  resetCrawlState();
}

async function generateCrawlZip() {
  console.log('[GetInspire BG] Generating crawl ZIP...');

  chrome.runtime.sendMessage({
    type: 'CAPTURE_STATUS',
    status: `Generating ZIP with ${crawlState.pages.length} pages...`
  }).catch(() => {});

  try {
    // We need to load JSZip in the background context
    // Since service workers can't use importScripts for local files easily,
    // we'll create the ZIP by sending data to a tab

    // For now, create a simple multi-page structure
    const pages = crawlState.pages;
    const hostname = crawlState.baseDomain.replace(/[^a-z0-9]/gi, '-');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `${hostname}-crawl-${pages.length}pages-${timestamp}.zip`;

    // Generate index with links to all pages
    let indexHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Crawl: ${crawlState.baseDomain}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; }
    h1 { color: #333; }
    .page-list { list-style: none; padding: 0; }
    .page-list li { padding: 10px; border-bottom: 1px solid #eee; }
    .page-list a { color: #0066cc; text-decoration: none; }
    .page-list a:hover { text-decoration: underline; }
    .meta { color: #666; font-size: 14px; margin-top: 20px; }
  </style>
</head>
<body>
  <h1>Captured Site: ${crawlState.baseDomain}</h1>
  <p>Captured ${pages.length} pages on ${new Date().toLocaleString()}</p>
  <h2>Pages</h2>
  <ul class="page-list">
`;

    pages.forEach((page, index) => {
      const pageFilename = index === 0 ? 'page-0.html' : `page-${index}.html`;
      indexHtml += `    <li><a href="${pageFilename}">${page.title || page.url}</a><br><small>${page.url}</small></li>\n`;
    });

    indexHtml += `  </ul>
  <div class="meta">
    <p>Generated by GetInspire 2.0</p>
    <p>Crawl duration: ${Math.round((Date.now() - crawlState.startTime) / 1000)}s</p>
  </div>
</body>
</html>`;

    // Send the ZIP data to a content script for generation
    // Since background service workers have limited blob handling,
    // we'll use a different approach - inject into current tab

    await chrome.scripting.executeScript({
      target: { tabId: crawlState.currentTabId },
      func: async (pagesData, indexContent, zipFilename) => {
        // Create ZIP using JSZip (should already be loaded)
        if (!window.JSZip) {
          console.error('[GetInspire] JSZip not available for ZIP generation');
          return;
        }

        const zip = new JSZip();

        // Add index
        zip.file('index.html', indexContent);

        // Add each page
        pagesData.forEach((page, index) => {
          zip.file(`page-${index}.html`, page.html);
        });

        // Add README
        const readme = `# Crawl Capture

Domain: ${pagesData[0]?.url ? new URL(pagesData[0].url).hostname : 'Unknown'}
Pages: ${pagesData.length}
Captured: ${new Date().toISOString()}

## Pages Captured
${pagesData.map((p, i) => `${i + 1}. ${p.title || 'Untitled'} - ${p.url}`).join('\n')}

Generated by GetInspire 2.0
`;
        zip.file('README.md', readme);

        // Generate and download
        const blob = await zip.generateAsync({
          type: 'blob',
          compression: 'DEFLATE',
          compressionOptions: { level: 6 }
        });

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = zipFilename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);

        console.log('[GetInspire] Crawl ZIP downloaded:', zipFilename);
      },
      args: [pages, indexHtml, filename]
    });

    console.log('[GetInspire BG] Crawl ZIP generation initiated');

  } catch (error) {
    console.error('[GetInspire BG] Failed to generate crawl ZIP:', error);
    chrome.runtime.sendMessage({
      type: 'CAPTURE_ERROR',
      error: 'Failed to generate ZIP: ' + error.message
    }).catch(() => {});
  }
}

// ==================== UTILITY FUNCTIONS ====================

function normalizeUrl(url) {
  try {
    const parsed = new URL(url);
    // Remove tracking parameters
    const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
                           'fbclid', 'gclid', 'ref', 'source', '_ga'];
    trackingParams.forEach(param => parsed.searchParams.delete(param));
    // Remove hash
    parsed.hash = '';
    // Normalize trailing slash
    let normalized = parsed.href;
    if (parsed.pathname !== '/' && normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1);
    }
    return normalized;
  } catch (e) {
    return url;
  }
}

// ==================== DOWNLOAD HANDLING ====================

async function handleDownloadZip(data) {
  console.log('[GetInspire BG] Downloading ZIP file');

  try {
    const blob = new Blob([data.zipData], { type: 'application/zip' });
    const url = URL.createObjectURL(blob);

    await chrome.downloads.download({
      url: url,
      filename: data.filename,
      saveAs: true
    });

    setTimeout(() => URL.revokeObjectURL(url), 60000);
    chrome.runtime.sendMessage({ type: 'DOWNLOAD_SUCCESS' }).catch(() => {});
  } catch (error) {
    console.error('[GetInspire BG] Download failed:', error);
    chrome.runtime.sendMessage({
      type: 'DOWNLOAD_ERROR',
      error: error.message
    }).catch(() => {});
  }
}

// ==================== MEMORY MONITORING ====================

// Check memory usage periodically during crawl
setInterval(() => {
  if (crawlState.isRunning && performance.memory) {
    const usedHeapSize = performance.memory.usedJSHeapSize;
    const totalHeapSize = performance.memory.jsHeapSizeLimit;
    const usagePercent = Math.round((usedHeapSize / totalHeapSize) * 100);

    if (usagePercent > 80) {
      console.warn('[GetInspire BG] High memory usage:', usagePercent + '%');
      chrome.runtime.sendMessage({
        type: 'MEMORY_WARNING',
        percent: usagePercent
      }).catch(() => {});
    }
  }
}, 10000);
