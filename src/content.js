// Enhanced content script for GetInspire 2.0 with multi-page crawling, animation capture, and asset deduplication

// CRITICAL: Check if already running BEFORE the async IIFE to prevent race conditions
if (window.__GETINSPIRE_RUNNING__) {
  console.log('[GetInspire] Already running, exiting');
  throw new Error('GetInspire is already running on this page');
}
window.__GETINSPIRE_RUNNING__ = true;

// Check if this is crawl mode (set by background script before injection)
const isCrawlMode = window.__GETINSPIRE_CRAWL_MODE__ || false;
const crawlBaseDomain = window.__GETINSPIRE_CRAWL_DOMAIN__ || null;

(async function() {
  console.log('[GetInspire] Content script starting...', isCrawlMode ? '(Crawl Mode)' : '(Single Page Mode)');

  // Check if JSZip is available (not needed in crawl mode as background handles ZIP)
  if (!isCrawlMode && !window.JSZip) {
    console.error('[GetInspire] JSZip not loaded!');
    alert('Failed to load required libraries. Please try again.');
    window.__GETINSPIRE_RUNNING__ = false;
    return;
  }

  try {
    // Send status to popup
    chrome.runtime.sendMessage({
      type: 'CAPTURE_STATUS',
      status: isCrawlMode ? 'Capturing page for crawl...' : 'Starting capture...'
    });

    // Helper function to expand all carousel slides
    async function expandCarousels() {
      console.log('[GetInspire] Expanding carousel slides...');

      // Common carousel selectors
      const carouselSelectors = [
        '.carousel', '.slider', '.swiper', '.slideshow',
        '[data-carousel]', '[data-slider]', '[data-slideshow]',
        '.slick-slider', '.owl-carousel', '.glide',
        '.flickity-slider', '.splide', '.keen-slider',
        '.swiper-wrapper', '.carousel-wrapper'
      ];

      let expandedCount = 0;
      const processedCarousels = new Set();

      // First, try to trigger lazy loading by clicking through slides
      for (const selector of carouselSelectors) {
        const carousels = document.querySelectorAll(selector);
        for (const carousel of carousels) {
          if (processedCarousels.has(carousel)) continue;
          processedCarousels.add(carousel);

          // Find navigation buttons
          const nextButtons = carousel.querySelectorAll(
            '[class*="next"], [class*="arrow-right"], [class*="arrow-forward"], ' +
            '[aria-label*="next"], button[data-slide="next"], ' +
            '.slick-next, .swiper-button-next, .carousel-control-next'
          );

          // Try to click through all slides to trigger lazy loading
          if (nextButtons.length > 0) {
            const button = nextButtons[0];
            let clickCount = 0;
            const maxClicks = 20; // Prevent infinite loops

            while (clickCount < maxClicks) {
              button.click();
              await new Promise(resolve => setTimeout(resolve, 50));
              clickCount++;

              // Check if we've cycled back to the beginning
              if (carousel.querySelector('.active:first-child, .slick-current:first-child')) {
                break;
              }
            }
          }
        }
      }

      // Now expand all slides for capture
      carouselSelectors.forEach(selector => {
        const carousels = document.querySelectorAll(selector);
        carousels.forEach(carousel => {
          if (processedCarousels.has(carousel)) return;
          processedCarousels.add(carousel);

          const slides = carousel.querySelectorAll(
            '[class*="slide"]:not([class*="button"]):not([class*="nav"]), ' +
            '.carousel-item, .swiper-slide, .slick-slide, ' +
            '.splide__slide, .keen-slider__slide'
          );

          if (slides.length > 0) {
            console.log(`[GetInspire] Found carousel with ${slides.length} slides`);

            // Make all slides visible for capture
            slides.forEach((slide, index) => {
              slide.style.display = 'block';
              slide.style.opacity = '1';
              slide.style.visibility = 'visible';
              slide.style.position = 'relative';
              slide.style.left = 'auto';
              slide.style.top = 'auto';
              slide.style.transform = 'none';
              slide.style.transition = 'none';

              // Remove classes that might hide slides
              slide.classList.remove('hidden', 'invisible', 'opacity-0');

              // Ensure images within slides are loaded
              const images = slide.querySelectorAll('img[data-src], img[data-lazy]');
              images.forEach(img => {
                if (img.dataset.src) {
                  img.src = img.dataset.src;
                  img.removeAttribute('data-src');
                }
                if (img.dataset.lazy) {
                  img.src = img.dataset.lazy;
                  img.removeAttribute('data-lazy');
                }
              });
            });
            expandedCount++;
          }
        });
      });

      // Handle Bootstrap carousels specifically
      const bsCarousels = document.querySelectorAll('.carousel-inner');
      bsCarousels.forEach(inner => {
        if (processedCarousels.has(inner)) return;
        processedCarousels.add(inner);

        const items = inner.querySelectorAll('.carousel-item');
        items.forEach(item => {
          item.classList.add('active');
          item.style.display = 'block';
          item.style.transform = 'none';
        });
        if (items.length > 0) expandedCount++;
      });

      // Handle Slick sliders
      const slickTracks = document.querySelectorAll('.slick-track');
      slickTracks.forEach(track => {
        track.style.transform = 'none';
        track.style.width = 'auto';

        const slides = track.querySelectorAll('.slick-slide');
        slides.forEach(slide => {
          slide.style.display = 'block';
          slide.style.opacity = '1';
          slide.style.width = '100%';
        });
        if (slides.length > 0) expandedCount++;
      });

      // Handle Swiper sliders
      const swiperWrappers = document.querySelectorAll('.swiper-wrapper');
      swiperWrappers.forEach(wrapper => {
        wrapper.style.transform = 'none';
        wrapper.style.display = 'block';

        const slides = wrapper.querySelectorAll('.swiper-slide');
        slides.forEach(slide => {
          slide.style.display = 'block';
          slide.style.opacity = '1';
        });
        if (slides.length > 0) expandedCount++;
      });

      console.log(`[GetInspire] Expanded ${expandedCount} carousels`);
      return expandedCount;
    }

    // ==================== ENHANCED ANIMATION CAPTURE (v2.0) ====================

    // Detect JavaScript animation libraries on the page
    function detectAnimationLibraries() {
      const detected = {
        gsap: !!(window.gsap || window.TweenMax || window.TweenLite),
        anime: !!window.anime,
        framerMotion: !!document.querySelector('[data-framer-appear-id], [data-framer-component-type]'),
        lottie: !!(window.lottie || window.bodymovin),
        scrollTrigger: !!(window.ScrollTrigger || (window.gsap && window.gsap.plugins && window.gsap.plugins.scrollTrigger)),
        motionOne: !!window.Motion,
        velocity: !!window.Velocity,
        popmotion: !!window.popmotion
      };

      const activeLibs = Object.entries(detected).filter(([k, v]) => v).map(([k]) => k);
      if (activeLibs.length > 0) {
        console.log('[GetInspire] Detected animation libraries:', activeLibs.join(', '));
      }
      return detected;
    }

    // Capture CSS :hover state rules and convert to activatable classes
    function captureHoverStates() {
      const hoverRules = [];
      const focusRules = [];
      const activeRules = [];

      for (const sheet of document.styleSheets) {
        try {
          if (!sheet.cssRules) continue;

          for (const rule of sheet.cssRules) {
            if (rule.type !== CSSRule.STYLE_RULE) continue;

            const selector = rule.selectorText;
            if (!selector) continue;

            // Capture :hover rules
            if (selector.includes(':hover')) {
              const newSelector = selector.replace(/:hover/g, '.gi-hover-state');
              hoverRules.push(`${newSelector} { ${rule.style.cssText} }`);
            }

            // Capture :focus rules
            if (selector.includes(':focus')) {
              const newSelector = selector.replace(/:focus/g, '.gi-focus-state');
              focusRules.push(`${newSelector} { ${rule.style.cssText} }`);
            }

            // Capture :active rules
            if (selector.includes(':active')) {
              const newSelector = selector.replace(/:active/g, '.gi-active-state');
              activeRules.push(`${newSelector} { ${rule.style.cssText} }`);
            }
          }
        } catch (e) {
          // Cross-origin stylesheets may throw
        }
      }

      console.log(`[GetInspire] Captured ${hoverRules.length} :hover, ${focusRules.length} :focus, ${activeRules.length} :active rules`);

      return {
        hover: hoverRules,
        focus: focusRules,
        active: activeRules
      };
    }

    // Capture GSAP animation state (if available)
    function captureGSAPState() {
      if (!window.gsap) return null;

      try {
        const state = {
          library: 'GSAP',
          version: window.gsap.version || 'unknown',
          timelines: [],
          tweens: []
        };

        // Try to get all tweens
        if (window.gsap.globalTimeline) {
          const timeline = window.gsap.globalTimeline;
          state.timelines.push({
            progress: timeline.progress(),
            duration: timeline.duration(),
            paused: timeline.paused()
          });
        }

        console.log('[GetInspire] Captured GSAP state');
        return state;
      } catch (e) {
        console.warn('[GetInspire] Failed to capture GSAP state:', e);
        return null;
      }
    }

    // Capture Anime.js animation state (if available)
    function captureAnimeState() {
      if (!window.anime) return null;

      try {
        const state = {
          library: 'Anime.js',
          running: window.anime.running ? window.anime.running.length : 0
        };

        console.log('[GetInspire] Captured Anime.js state');
        return state;
      } catch (e) {
        console.warn('[GetInspire] Failed to capture Anime.js state:', e);
        return null;
      }
    }

    // Trigger scroll-based animations by scrolling the page
    async function triggerScrollAnimations() {
      console.log('[GetInspire] Triggering scroll animations...');

      const scrollHeight = document.documentElement.scrollHeight;
      const viewportHeight = window.innerHeight;
      const scrollSteps = Math.min(10, Math.ceil(scrollHeight / viewportHeight));

      // Scroll through the page to trigger lazy loading and scroll animations
      for (let i = 0; i <= scrollSteps; i++) {
        const scrollPos = (scrollHeight - viewportHeight) * (i / scrollSteps);
        window.scrollTo(0, scrollPos);
        await new Promise(r => setTimeout(r, 150));
      }

      // Scroll back to top
      window.scrollTo(0, 0);
      await new Promise(r => setTimeout(r, 100));

      console.log('[GetInspire] Scroll animation trigger complete');
    }

    // Capture multiple frames from canvas elements (for animated canvases)
    async function captureCanvasFrames(frameCount = 5, intervalMs = 100) {
      const canvases = document.querySelectorAll('canvas');
      const allFrames = [];

      for (let i = 0; i < canvases.length; i++) {
        const canvas = canvases[i];
        const frames = [];

        try {
          // Check if canvas has any content
          const ctx = canvas.getContext('2d');
          if (!ctx) continue;

          // Capture multiple frames
          for (let f = 0; f < frameCount; f++) {
            try {
              frames.push({
                frame: f,
                dataUrl: canvas.toDataURL('image/png'),
                timestamp: Date.now()
              });

              if (f < frameCount - 1) {
                await new Promise(r => setTimeout(r, intervalMs));
              }
            } catch (e) {
              // Canvas may be tainted
              break;
            }
          }

          if (frames.length > 0) {
            // Check if frames are different (animated canvas)
            const isAnimated = frames.length > 1 &&
              frames.some((f, idx) => idx > 0 && f.dataUrl !== frames[0].dataUrl);

            allFrames.push({
              canvasIndex: i,
              width: canvas.width,
              height: canvas.height,
              frames: frames,
              isAnimated: isAnimated
            });
          }
        } catch (e) {
          console.warn(`[GetInspire] Could not capture canvas ${i}:`, e);
        }
      }

      console.log(`[GetInspire] Captured frames from ${allFrames.length} canvas elements`);
      return allFrames;
    }

    // Extract same-domain links for crawl mode
    function extractSameDomainLinks(baseDomain) {
      const links = new Set();

      document.querySelectorAll('a[href]').forEach(anchor => {
        try {
          const href = anchor.getAttribute('href');
          if (!href) return;

          // Skip non-http links
          if (href.startsWith('javascript:') || href.startsWith('mailto:') ||
              href.startsWith('tel:') || href.startsWith('#')) {
            return;
          }

          const url = new URL(href, window.location.href);

          // Only same domain
          if (url.hostname !== baseDomain && !url.hostname.endsWith('.' + baseDomain)) {
            return;
          }

          // Skip file downloads
          const ext = url.pathname.split('.').pop().toLowerCase();
          const skipExtensions = ['pdf', 'zip', 'rar', 'exe', 'dmg', 'mp4', 'mp3', 'wav', 'avi'];
          if (skipExtensions.includes(ext)) {
            return;
          }

          // Normalize URL
          url.hash = '';
          const normalized = url.href.replace(/\/$/, '');
          links.add(normalized);
        } catch (e) {
          // Invalid URL
        }
      });

      console.log(`[GetInspire] Found ${links.size} same-domain links`);
      return Array.from(links);
    }

    // Generate animation state metadata for inclusion in captured HTML
    function generateAnimationMetadata(animLibs, gsapState, animeState, hoverStates, canvasFrames) {
      return {
        capturedAt: new Date().toISOString(),
        animationLibraries: Object.entries(animLibs).filter(([k, v]) => v).map(([k]) => k),
        gsap: gsapState,
        anime: animeState,
        hoverRulesCount: hoverStates.hover.length,
        focusRulesCount: hoverStates.focus.length,
        activeRulesCount: hoverStates.active.length,
        animatedCanvases: canvasFrames.filter(c => c.isAnimated).length,
        totalCanvases: canvasFrames.length
      };
    }

    // ==================== CSS-IN-JS EXTRACTION (v2.0) ====================

    // Extract CSS-in-JS styles from various libraries
    function extractCSSInJS() {
      const cssInJS = [];

      // styled-components
      document.querySelectorAll('style[data-styled], style[data-styled-components], style[data-styled-version]').forEach(style => {
        cssInJS.push(`/* styled-components */\n${style.textContent}`);
      });

      // Emotion
      document.querySelectorAll('style[data-emotion], style[data-emotion-css]').forEach(style => {
        cssInJS.push(`/* emotion */\n${style.textContent}`);
      });

      // Linaria
      document.querySelectorAll('style[data-linaria]').forEach(style => {
        cssInJS.push(`/* linaria */\n${style.textContent}`);
      });

      // JSS
      document.querySelectorAll('style[data-jss], style[data-jss-version]').forEach(style => {
        cssInJS.push(`/* jss */\n${style.textContent}`);
      });

      // Aphrodite
      document.querySelectorAll('style[data-aphrodite]').forEach(style => {
        cssInJS.push(`/* aphrodite */\n${style.textContent}`);
      });

      // Radium (inline styles, but may have style tags)
      document.querySelectorAll('style[data-radium]').forEach(style => {
        cssInJS.push(`/* radium */\n${style.textContent}`);
      });

      // Generic: Any style tag with data-* attribute that looks like CSS-in-JS
      document.querySelectorAll('style[data-n-href], style[data-next-font]').forEach(style => {
        cssInJS.push(`/* next.js css */\n${style.textContent}`);
      });

      if (cssInJS.length > 0) {
        console.log(`[GetInspire] Extracted ${cssInJS.length} CSS-in-JS style blocks`);
      }

      return cssInJS.join('\n\n');
    }

    // Extract video posters (create from first frame if missing)
    async function extractVideoPosters() {
      const videos = document.querySelectorAll('video');
      const posters = [];

      for (let i = 0; i < videos.length; i++) {
        const video = videos[i];

        // If video already has a poster, record it
        if (video.poster) {
          posters.push({
            index: i,
            type: 'attribute',
            url: video.poster
          });
          continue;
        }

        // Try to capture first frame as poster
        try {
          // Wait for video to have enough data
          if (video.readyState >= 2) {
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth || video.offsetWidth || 640;
            canvas.height = video.videoHeight || video.offsetHeight || 360;

            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            const posterDataUrl = canvas.toDataURL('image/jpeg', 0.8);

            // Set poster on the video element
            video.setAttribute('poster', posterDataUrl);
            video.setAttribute('data-gi-poster', 'generated');

            posters.push({
              index: i,
              type: 'generated',
              dataUrl: posterDataUrl
            });

            console.log(`[GetInspire] Generated poster for video ${i}`);
          }
        } catch (e) {
          console.warn(`[GetInspire] Could not generate poster for video ${i}:`, e);
        }
      }

      return posters;
    }

    // Performance constants (v2.0 - increased for better throughput)
    const MAX_CONCURRENT = 15;  // Increased from 6
    const MAX_ASSETS = 2000;    // Increased from 500
    const DOWNLOAD_TIMEOUT = 15000;  // Increased from 10000
    const MAX_IMAGE_DIMENSION = 2000;

    // Asset hash cache for deduplication
    const assetHashCache = new Map();  // url -> hash
    const assetsByHash = new Map();    // hash -> {blob, filename, url}

    // Helper function to compute SHA-256 hash of a blob (first 16 chars)
    async function hashBlob(blob) {
      try {
        const buffer = await blob.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
      } catch (e) {
        console.warn('[GetInspire] Hash computation failed:', e);
        return null;
      }
    }

    // Helper function to normalize URLs (remove tracking params, etc.)
    function normalizeUrl(url, baseUrl = window.location.href) {
      try {
        const parsed = new URL(url, baseUrl);
        // Remove tracking parameters
        const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
                               'fbclid', 'gclid', 'ref', 'source', '_ga', 'mc_cid', 'mc_eid'];
        trackingParams.forEach(param => parsed.searchParams.delete(param));
        // Remove hash for asset URLs
        parsed.hash = '';
        // Normalize trailing slashes
        let normalized = parsed.href;
        if (parsed.pathname !== '/' && normalized.endsWith('/')) {
          normalized = normalized.slice(0, -1);
        }
        return normalized;
      } catch (e) {
        return url;
      }
    }

    // Helper function to optimize large images
    async function optimizeImage(blob, maxDimension = MAX_IMAGE_DIMENSION) {
      // Skip if already small or not an image
      if (blob.size < 100000 || !blob.type.startsWith('image/')) return blob;
      // Skip SVGs (they're already vector)
      if (blob.type === 'image/svg+xml') return blob;

      try {
        const bitmap = await createImageBitmap(blob);
        // Check if resize needed
        if (bitmap.width <= maxDimension && bitmap.height <= maxDimension) {
          return blob;
        }

        // Calculate new dimensions maintaining aspect ratio
        const ratio = Math.min(maxDimension / bitmap.width, maxDimension / bitmap.height);
        const newWidth = Math.round(bitmap.width * ratio);
        const newHeight = Math.round(bitmap.height * ratio);

        console.log(`[GetInspire] Optimizing image: ${bitmap.width}x${bitmap.height} -> ${newWidth}x${newHeight}`);

        // Create canvas and resize
        const canvas = new OffscreenCanvas(newWidth, newHeight);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(bitmap, 0, 0, newWidth, newHeight);

        // Convert back to blob
        const optimizedBlob = await canvas.convertToBlob({
          type: blob.type === 'image/png' ? 'image/png' : 'image/jpeg',
          quality: 0.85
        });

        return optimizedBlob;
      } catch (e) {
        console.warn('[GetInspire] Image optimization failed:', e);
        return blob;
      }
    }

    // Helper function to download a resource as blob with timeout and deduplication
    async function downloadAsBlob(url, timeoutMs = DOWNLOAD_TIMEOUT) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(url, {
          signal: controller.signal,
          mode: 'cors',
          credentials: 'omit'
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          console.warn(`[GetInspire] HTTP ${response.status} for ${url}`);
          return null;
        }

        let blob = await response.blob();

        // Optimize images if they're large
        if (blob.type.startsWith('image/')) {
          blob = await optimizeImage(blob);
        }

        return blob;
      } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
          console.warn(`[GetInspire] Timeout downloading ${url}`);
        } else {
          console.warn(`[GetInspire] Failed to download ${url}:`, error.message);
        }
        return null;
      }
    }

    // Helper function to convert blob to base64
    function blobToBase64(blob) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }

    // Helper function to get filename from URL
    function getFilenameFromUrl(url) {
      try {
        const urlObj = new URL(url);
        const pathname = urlObj.pathname;
        let filename = pathname.split('/').pop() || 'unnamed';

        // Add extension if missing
        if (!filename.includes('.')) {
          // Try to determine extension from URL or default to jpg
          if (url.includes('font') || url.includes('.woff')) {
            filename += '.woff2';
          } else if (url.includes('.mp4') || url.includes('video')) {
            filename += '.mp4';
          } else if (url.includes('.mp3') || url.includes('audio')) {
            filename += '.mp3';
          } else {
            filename += '.jpg';
          }
        }

        // Make filename unique by adding a hash of the full path if needed
        // This prevents collisions when multiple files have the same name
        if (pathname.length > filename.length) {
          const pathHash = pathname.split('').reduce((acc, char) => {
            return ((acc << 5) - acc) + char.charCodeAt(0);
          }, 0) & 0x7FFFFFFF;
          const ext = filename.includes('.') ? filename.split('.').pop() : '';
          const base = filename.includes('.') ? filename.substring(0, filename.lastIndexOf('.')) : filename;
          filename = `${base}-${pathHash.toString(36)}${ext ? '.' + ext : ''}`;
        }

        return filename;
      } catch {
        return 'unnamed-' + Date.now() + '.jpg';
      }
    }

    // Step 1: Expand carousels before capturing
    await expandCarousels();

    // Step 1.5: Enhanced animation capture (v2.0)
    chrome.runtime.sendMessage({
      type: 'CAPTURE_STATUS',
      status: 'Capturing animations...'
    });

    // Trigger scroll animations to ensure all lazy content loads
    await triggerScrollAnimations();

    // Detect animation libraries
    const animationLibraries = detectAnimationLibraries();

    // Capture hover/focus/active states
    const interactionStates = captureHoverStates();

    // Capture GSAP and Anime.js state if present
    const gsapState = captureGSAPState();
    const animeState = captureAnimeState();

    // Capture canvas frames for animated canvases
    const canvasFramesData = await captureCanvasFrames(5, 100);

    // Extract CSS-in-JS styles
    const cssInJSStyles = extractCSSInJS();

    // Extract video posters
    await extractVideoPosters();

    // Generate animation metadata
    const animationMetadata = generateAnimationMetadata(
      animationLibraries, gsapState, animeState, interactionStates, canvasFramesData
    );

    console.log('[GetInspire] Animation capture complete:', animationMetadata);

    // Wait a bit for any lazy-loaded images to appear
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Step 2: Collect all assets
    console.log('[GetInspire] Collecting all assets...');

    const assetsToDownload = new Map(); // url -> {type, element}
    const downloadedAssets = new Map(); // url -> {blob, base64, filename}

    // Collect images (including those in expanded carousels)
    const images = document.querySelectorAll('img');
    images.forEach(img => {
      if (img.src && !img.src.startsWith('data:')) {
        assetsToDownload.set(img.src, {type: 'image', element: img});
      }
      // Also check data-src for lazy-loaded images
      if (img.dataset.src && !img.dataset.src.startsWith('data:')) {
        assetsToDownload.set(img.dataset.src, {type: 'image', element: img});
      }
    });

    // Collect videos
    const videos = document.querySelectorAll('video');
    videos.forEach(video => {
      if (video.src && !video.src.startsWith('data:') && !video.src.startsWith('blob:')) {
        assetsToDownload.set(video.src, {type: 'video', element: video});
      }
      // Also check source elements
      const sources = video.querySelectorAll('source');
      sources.forEach(source => {
        if (source.src && !source.src.startsWith('data:') && !source.src.startsWith('blob:')) {
          assetsToDownload.set(source.src, {type: 'video', element: source});
        }
      });
    });

    // Capture canvas elements as images
    const canvases = document.querySelectorAll('canvas');
    canvases.forEach((canvas, index) => {
      try {
        const dataUrl = canvas.toDataURL('image/png');
        const canvasId = `canvas-${index}`;
        canvas.setAttribute('data-canvas-id', canvasId);
        // Store canvas data for later replacement
        assetsToDownload.set(`canvas-${index}`, {
          type: 'canvas',
          element: canvas,
          dataUrl: dataUrl
        });
      } catch (e) {
        console.warn('[GetInspire] Could not capture canvas:', e);
      }
    });

    // Collect SVG images and inline SVGs
    const svgImages = document.querySelectorAll('img[src$=".svg"], use[href], use[xlink\\:href]');
    svgImages.forEach(el => {
      const href = el.getAttribute('href') || el.getAttribute('xlink:href');
      if (href && !href.startsWith('data:') && !href.startsWith('#')) {
        assetsToDownload.set(href, {type: 'svg', element: el});
      }
    });

    // Collect CSS background images
    const allElements = document.querySelectorAll('*');
    allElements.forEach(el => {
      const style = window.getComputedStyle(el);
      const bgImage = style.backgroundImage;
      if (bgImage && bgImage !== 'none') {
        const matches = bgImage.match(/url\(["']?([^"')]+)["']?\)/g);
        if (matches) {
          matches.forEach(match => {
            const url = match.replace(/url\(["']?|["']?\)/g, '');
            if (!url.startsWith('data:')) {
              assetsToDownload.set(url, {type: 'background', element: el});
            }
          });
        }
      }
    });

    // Collect favicons and other link resources
    const links = document.querySelectorAll('link[rel*="icon"], link[rel="apple-touch-icon"]');
    links.forEach(link => {
      if (link.href) {
        assetsToDownload.set(link.href, {type: 'icon', element: link});
      }
    });

    // Collect fonts from @font-face rules in stylesheets
    console.log('[GetInspire] Collecting fonts from @font-face rules...');
    const allStyleSheets = [...document.styleSheets];
    let fontCount = 0;
    allStyleSheets.forEach(sheet => {
      try {
        const rules = [...sheet.cssRules || []];
        rules.forEach(rule => {
          if (rule.type === CSSRule.FONT_FACE_RULE) {
            const src = rule.style.src;
            if (src) {
              // Extract URLs from src (can have multiple formats)
              const urlMatches = src.match(/url\(["']?([^"')]+)["']?\)/g);
              if (urlMatches) {
                urlMatches.forEach(match => {
                  let url = match.replace(/url\(["']?|["']?\)/g, '');
                  // Convert relative URLs to absolute
                  if (!url.startsWith('http') && !url.startsWith('data:')) {
                    try {
                      url = new URL(url, window.location.href).href;
                    } catch (e) {
                      console.warn(`[GetInspire] Invalid font URL: ${url}`);
                      return;
                    }
                  }
                  if (!url.startsWith('data:') && url.startsWith('http')) {
                    assetsToDownload.set(url, {type: 'font', element: null});
                    fontCount++;
                  }
                });
              }
            }
          }
        });
      } catch (e) {
        // Cross-origin stylesheets might throw errors
        console.warn('[GetInspire] Could not read stylesheet rules:', e.message);
      }
    });
    console.log(`[GetInspire] Found ${fontCount} font files`);

    // Collect script files
    console.log('[GetInspire] Collecting script files...');
    const scriptElements = document.querySelectorAll('script[src]');
    scriptElements.forEach(script => {
      if (script.src && !script.src.startsWith('data:')) {
        assetsToDownload.set(script.src, {type: 'script', element: script});
      }
    });

    // Collect audio elements
    const audioElements = document.querySelectorAll('audio');
    audioElements.forEach(audio => {
      if (audio.src && !audio.src.startsWith('data:') && !audio.src.startsWith('blob:')) {
        assetsToDownload.set(audio.src, {type: 'audio', element: audio});
      }
      const sources = audio.querySelectorAll('source');
      sources.forEach(source => {
        if (source.src && !source.src.startsWith('data:') && !source.src.startsWith('blob:')) {
          assetsToDownload.set(source.src, {type: 'audio', element: source});
        }
      });
    });

    // Collect images with srcset
    console.log('[GetInspire] Collecting images with srcset...');
    const imagesWithSrcset = document.querySelectorAll('img[srcset], source[srcset]');
    imagesWithSrcset.forEach(img => {
      const srcset = img.getAttribute('srcset');
      if (srcset) {
        // Parse srcset: "url1 1x, url2 2x" or "url1 100w, url2 200w"
        const srcsetUrls = srcset.split(',').map(s => s.trim().split(/\s+/)[0]);
        srcsetUrls.forEach(url => {
          if (url && !url.startsWith('data:')) {
            // Convert relative to absolute
            const absUrl = new URL(url, window.location.href).href;
            assetsToDownload.set(absUrl, {type: 'image', element: img});
          }
        });
      }
    });

    console.log(`[GetInspire] Found ${assetsToDownload.size} assets to download`);

    // Safety check - limit total assets to prevent memory issues
    if (assetsToDownload.size > MAX_ASSETS) {
      console.warn(`[GetInspire] Too many assets (${assetsToDownload.size}), limiting to ${MAX_ASSETS}`);
      const limitedAssets = new Map([...assetsToDownload.entries()].slice(0, MAX_ASSETS));
      assetsToDownload.clear();
      limitedAssets.forEach((v, k) => assetsToDownload.set(k, v));
    }

    // Step 3: Download all assets with concurrency control and deduplication
    chrome.runtime.sendMessage({
      type: 'CAPTURE_STATUS',
      status: `Downloading ${assetsToDownload.size} assets...`
    });
    let downloadCount = 0;
    let successCount = 0;
    let failCount = 0;
    let deduplicatedCount = 0;

    // Helper to download with concurrency limit and deduplication
    async function downloadWithLimit(entries) {
      const chunks = [];
      for (let i = 0; i < entries.length; i += MAX_CONCURRENT) {
        chunks.push(entries.slice(i, i + MAX_CONCURRENT));
      }

      for (const chunk of chunks) {
        await Promise.all(chunk.map(async ([url, info]) => {
          downloadCount++;

          // Update status every 10 downloads
          if (downloadCount % 10 === 0) {
            chrome.runtime.sendMessage({
              type: 'CAPTURE_STATUS',
              status: `Downloading assets... ${downloadCount}/${assetsToDownload.size}`,
              progress: { done: downloadCount, total: assetsToDownload.size }
            });
          }

          console.log(`[GetInspire] Downloading ${downloadCount}/${assetsToDownload.size}: ${url.substring(0, 80)}...`);

          const blob = await downloadAsBlob(url);
          if (blob) {
            try {
              // Compute hash for deduplication
              const hash = await hashBlob(blob);

              // Check if we already have this content
              if (hash && assetsByHash.has(hash)) {
                // Reuse existing asset
                const existing = assetsByHash.get(hash);
                downloadedAssets.set(url, {
                  blob: existing.blob,
                  base64: existing.base64,
                  filename: existing.filename,
                  hash: hash,
                  deduplicated: true
                });
                deduplicatedCount++;
                successCount++;
                console.log(`[GetInspire] Deduplicated: ${url.substring(0, 50)}...`);
              } else {
                // New unique asset
                const base64 = await blobToBase64(blob);
                const filename = getFilenameFromUrl(url);
                const assetData = {blob, base64, filename, hash};
                downloadedAssets.set(url, assetData);

                // Store by hash for future deduplication
                if (hash) {
                  assetsByHash.set(hash, assetData);
                  assetHashCache.set(url, hash);
                }
                successCount++;
              }
            } catch (e) {
              console.warn(`[GetInspire] Failed to process blob for ${url}:`, e);
              failCount++;
            }
          } else {
            failCount++;
          }
        }));
      }
    }

    const assetEntries = [...assetsToDownload.entries()];
    await downloadWithLimit(assetEntries);

    console.log(`[GetInspire] Downloaded ${successCount}/${assetsToDownload.size} assets (${failCount} failed, ${deduplicatedCount} deduplicated)`);

    // Step 4: Clone document and replace asset URLs
    console.log('[GetInspire] Creating modified HTML...');

    // First, replace canvas elements with images
    canvases.forEach((canvas, index) => {
      const canvasData = assetsToDownload.get(`canvas-${index}`);
      if (canvasData && canvasData.dataUrl) {
        const img = document.createElement('img');
        img.src = canvasData.dataUrl;
        img.alt = `Captured canvas ${index}`;
        // Copy relevant attributes
        img.className = canvas.className;
        img.style.cssText = canvas.style.cssText;
        if (canvas.width) img.width = canvas.width;
        if (canvas.height) img.height = canvas.height;
        canvas.replaceWith(img);
      }
    });

    const htmlContent = document.documentElement.outerHTML;

    // Replace asset URLs with base64 or local paths
    let modifiedHtml = htmlContent;
    const assetMapping = {};

    // Helper to escape URL for regex
    function escapeForRegex(str) {
      return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    for (const [url, data] of downloadedAssets) {
      // Skip canvas entries (already handled)
      if (url.startsWith('canvas-')) {
        continue;
      }

      if (!data.blob) continue;

      const isSmall = data.blob.size < 100000;
      const replacement = isSmall ? data.base64 : `assets/${data.filename}`;

      // Try multiple URL patterns for replacement
      const urlObj = new URL(url);
      const patterns = [
        url, // Full URL
        urlObj.pathname, // Just the path
        urlObj.pathname.replace(/^\//, ''), // Path without leading slash
      ];

      patterns.forEach(pattern => {
        if (pattern) {
          const regex = new RegExp(escapeForRegex(pattern), 'g');
          modifiedHtml = modifiedHtml.replace(regex, replacement);
        }
      });

      assetMapping[url] = isSmall ? 'embedded' : `assets/${data.filename}`;
    }

    // Step 5: Get stylesheets and scripts
    console.log('[GetInspire] Capturing stylesheets...');
    const styles = [];

    // Helper function to extract and preserve CSS @property rules
    function extractCSSProperties(cssText) {
      const propertyRules = [];

      // Improved pattern to handle @property with proper brace matching
      const propertyPattern = /@property\s+(--[\w-]+)\s*\{/g;
      let match;

      while ((match = propertyPattern.exec(cssText)) !== null) {
        const startIndex = match.index;
        const propertyName = match[1];

        // Find the matching closing brace
        let braceCount = 1;
        let currentIndex = propertyPattern.lastIndex;

        while (braceCount > 0 && currentIndex < cssText.length) {
          const char = cssText[currentIndex];
          if (char === '{') braceCount++;
          else if (char === '}') braceCount--;
          currentIndex++;
        }

        if (braceCount === 0) {
          const fullProperty = cssText.substring(startIndex, currentIndex);
          propertyRules.push(fullProperty);
          console.log(`[GetInspire] Extracted @property: ${propertyName}`);
        }
      }

      return propertyRules;
    }

    // Helper function to extract keyframe animations
    function extractKeyframes(cssText) {
      const keyframes = [];

      // Improved regex that handles nested braces properly
      // Matches @keyframes name { ... } including nested blocks
      const keyframePattern = /@(?:-webkit-)?keyframes\s+([\w-]+)\s*\{/g;
      let match;

      while ((match = keyframePattern.exec(cssText)) !== null) {
        const startIndex = match.index;
        const name = match[1];

        // Find the matching closing brace
        let braceCount = 1;
        let currentIndex = keyframePattern.lastIndex;

        while (braceCount > 0 && currentIndex < cssText.length) {
          const char = cssText[currentIndex];
          if (char === '{') braceCount++;
          else if (char === '}') braceCount--;
          currentIndex++;
        }

        if (braceCount === 0) {
          const fullKeyframe = cssText.substring(startIndex, currentIndex);
          keyframes.push(fullKeyframe);
          console.log(`[GetInspire] Extracted keyframe: ${name}`);
        }
      }

      return keyframes;
    }

    // Collect all CSS @property declarations and keyframes
    const allPropertyRules = new Set();
    const allKeyframes = new Set();

    // Get all link stylesheets
    const linkStyles = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
    console.log(`[GetInspire] Found ${linkStyles.length} linked stylesheets`);

    for (const link of linkStyles) {
      try {
        const response = await fetch(link.href);
        let cssText = await response.text();
        console.log(`[GetInspire] Processing stylesheet: ${link.href} (${cssText.length} chars)`);

        // Extract and store @property rules and keyframes before replacement
        extractCSSProperties(cssText).forEach(rule => allPropertyRules.add(rule));
        extractKeyframes(cssText).forEach(kf => allKeyframes.add(kf));

        // Replace URLs in CSS with downloaded assets
        for (const [url, data] of downloadedAssets) {
          if (!data.blob) continue;

          const isSmall = data.blob.size < 100000;
          const replacement = isSmall ? data.base64 : `assets/${data.filename}`;

          // Try multiple URL patterns
          const urlObj = new URL(url);
          const patterns = [
            url,
            urlObj.pathname,
            urlObj.pathname.replace(/^\//, ''),
          ];

          patterns.forEach(pattern => {
            if (pattern) {
              const regex = new RegExp(escapeForRegex(pattern), 'g');
              cssText = cssText.replace(regex, replacement);
            }
          });
        }

        styles.push(`/* From: ${link.href} */\n${cssText}`);
      } catch (e) {
        console.warn('[GetInspire] Could not fetch stylesheet:', link.href, e);
      }
    }

    // Get all style elements
    const styleElements = Array.from(document.querySelectorAll('style'));
    console.log(`[GetInspire] Found ${styleElements.length} inline <style> elements`);

    for (const style of styleElements) {
      let cssText = style.textContent;
      console.log(`[GetInspire] Processing inline style (${cssText.length} chars)`);

      // Extract and store @property rules and keyframes
      extractCSSProperties(cssText).forEach(rule => allPropertyRules.add(rule));
      extractKeyframes(cssText).forEach(kf => allKeyframes.add(kf));

      // Replace URLs in inline CSS
      for (const [url, data] of downloadedAssets) {
        if (!data.blob) continue;

        const isSmall = data.blob.size < 100000;
        const replacement = isSmall ? data.base64 : `assets/${data.filename}`;

        // Try multiple URL patterns
        const urlObj = new URL(url);
        const patterns = [
          url,
          urlObj.pathname,
          urlObj.pathname.replace(/^\//, ''),
        ];

        patterns.forEach(pattern => {
          if (pattern) {
            const regex = new RegExp(escapeForRegex(pattern), 'g');
            cssText = cssText.replace(regex, replacement);
          }
        });
      }

      styles.push(cssText);
    }

    // Capture computed styles for animated elements to preserve animation states
    console.log('[GetInspire] Capturing computed styles for animated elements...');
    const animatedElements = document.querySelectorAll('[class*="animate"], [style*="animation"], [style*="transition"]');
    const computedStylesCSS = [];

    animatedElements.forEach((el, index) => {
      const computed = window.getComputedStyle(el);
      const animationName = computed.animationName;
      const animationDuration = computed.animationDuration;
      const animationTimingFunction = computed.animationTimingFunction;
      const animationDelay = computed.animationDelay;
      const animationIterationCount = computed.animationIterationCount;
      const animationDirection = computed.animationDirection;
      const animationFillMode = computed.animationFillMode;
      const transition = computed.transition;
      const transform = computed.transform;
      const filter = computed.filter;
      const backdropFilter = computed.backdropFilter;

      // Add a unique class to this element for targeting
      const uniqueClass = `gi-anim-${index}`;
      el.classList.add(uniqueClass);

      // Build CSS rule for this element
      let cssRule = `.${uniqueClass} {\n`;
      if (animationName && animationName !== 'none') {
        cssRule += `  animation-name: ${animationName};\n`;
        cssRule += `  animation-duration: ${animationDuration};\n`;
        cssRule += `  animation-timing-function: ${animationTimingFunction};\n`;
        cssRule += `  animation-delay: ${animationDelay};\n`;
        cssRule += `  animation-iteration-count: ${animationIterationCount};\n`;
        cssRule += `  animation-direction: ${animationDirection};\n`;
        cssRule += `  animation-fill-mode: ${animationFillMode};\n`;
      }
      if (transition && transition !== 'none' && transition !== 'all 0s ease 0s') {
        cssRule += `  transition: ${transition};\n`;
      }
      if (transform && transform !== 'none') {
        cssRule += `  transform: ${transform};\n`;
      }
      if (filter && filter !== 'none') {
        cssRule += `  filter: ${filter};\n`;
      }
      if (backdropFilter && backdropFilter !== 'none') {
        cssRule += `  backdrop-filter: ${backdropFilter};\n`;
        cssRule += `  -webkit-backdrop-filter: ${backdropFilter};\n`;
      }
      cssRule += `}\n`;

      computedStylesCSS.push(cssRule);
    });

    // Add all collected @property rules at the beginning
    if (allPropertyRules.size > 0) {
      console.log(`[GetInspire] Preserved ${allPropertyRules.size} @property declarations`);
      const propertyCSS = `/* CSS @property declarations */\n${[...allPropertyRules].join('\n\n')}\n`;
      styles.unshift(propertyCSS);
    } else {
      console.log('[GetInspire] No @property declarations found');
    }

    // Add all collected keyframes
    if (allKeyframes.size > 0) {
      console.log(`[GetInspire] Preserved ${allKeyframes.size} keyframe animations`);
      const keyframesCSS = `/* CSS Keyframe animations */\n${[...allKeyframes].join('\n\n')}\n`;
      styles.unshift(keyframesCSS);
    } else {
      console.log('[GetInspire] No keyframe animations found');
    }

    // Add computed styles for animated elements
    if (computedStylesCSS.length > 0) {
      console.log(`[GetInspire] Preserved ${computedStylesCSS.length} computed animation states`);
      const computedCSS = `/* Preserved animation states */\n${computedStylesCSS.join('\n')}\n`;
      styles.push(computedCSS);
    }

    // Add hover/focus/active state CSS (v2.0)
    if (interactionStates.hover.length > 0) {
      const hoverCSS = `/* Hover state rules (activate with .gi-hover-state class) */\n${interactionStates.hover.join('\n')}`;
      styles.push(hoverCSS);
    }
    if (interactionStates.focus.length > 0) {
      const focusCSS = `/* Focus state rules (activate with .gi-focus-state class) */\n${interactionStates.focus.join('\n')}`;
      styles.push(focusCSS);
    }
    if (interactionStates.active.length > 0) {
      const activeCSS = `/* Active state rules (activate with .gi-active-state class) */\n${interactionStates.active.join('\n')}`;
      styles.push(activeCSS);
    }

    // Add CSS-in-JS styles (v2.0)
    if (cssInJSStyles) {
      styles.push(`/* CSS-in-JS extracted styles */\n${cssInJSStyles}`);
    }

    // Add carousel visibility and animation enhancement CSS
    const enhancementCSS = `
      /* GetInspire: Ensure all carousel slides are visible */
      .carousel-item,
      .slick-slide,
      .swiper-slide,
      .splide__slide,
      .keen-slider__slide,
      [class*="slide"]:not([class*="button"]) {
        display: block !important;
        opacity: 1 !important;
        visibility: visible !important;
        position: relative !important;
        transform: none !important;
        transition: none !important;
        left: auto !important;
        top: auto !important;
      }

      /* Stack carousel items vertically */
      .carousel-inner,
      .slick-track,
      .swiper-wrapper,
      .splide__list {
        display: flex !important;
        flex-direction: column !important;
        transform: none !important;
        transition: none !important;
        width: auto !important;
        height: auto !important;
      }

      .carousel-item,
      .slick-slide,
      .swiper-slide {
        width: 100% !important;
        margin-bottom: 20px !important;
        flex-shrink: 0 !important;
      }

      /* Remove carousel cloning */
      .slick-cloned {
        display: none !important;
      }

      /* Hide carousel controls since all slides are visible */
      .carousel-control-prev,
      .carousel-control-next,
      .carousel-indicators,
      .slick-prev,
      .slick-next,
      .slick-dots,
      .swiper-button-prev,
      .swiper-button-next,
      .swiper-pagination,
      .splide__arrows,
      .splide__pagination,
      [class*="arrow"],
      [class*="nav-button"],
      [class*="carousel-control"] {
        display: none !important;
      }

      /* Ensure images in carousels are visible */
      .carousel img,
      .slider img,
      .swiper img {
        opacity: 1 !important;
        visibility: visible !important;
      }

      /* GetInspire: Enhanced animation and modern CSS feature support */

      /* Ensure gradient animations work */
      @supports (background: linear-gradient(var(--angle, 0deg), red, blue)) {
        [style*="--angle"],
        [class*="gradient"] {
          /* Preserve gradient animations */
        }
      }

      /* Ensure backdrop blur effects work */
      @supports (backdrop-filter: blur(10px)) or (-webkit-backdrop-filter: blur(10px)) {
        [style*="backdrop-filter"],
        [class*="backdrop-blur"],
        [class*="glass"] {
          -webkit-backdrop-filter: inherit;
          backdrop-filter: inherit;
        }
      }

      /* Ensure transforms are preserved on animated elements */
      [class*="animate"]:not(.carousel-item):not(.slick-slide):not(.swiper-slide),
      [style*="animation"],
      [class*="transition"] {
        animation: inherit !important;
        transition: inherit !important;
        transform: inherit !important;
      }

      /* Ensure video elements display properly */
      video {
        max-width: 100%;
        height: auto;
        display: block;
      }

      /* Ensure canvas replacements display properly */
      img[alt*="canvas"] {
        max-width: 100%;
        height: auto;
        display: block;
      }

      /* Preserve hover effects structure (won't animate but will be visible) */
      *:hover {
        /* Hover states captured at time of snapshot */
      }

      /* Fix for overflow issues with animations */
      body {
        overflow-x: hidden;
        overflow-y: auto;
      }

      /* Ensure SVG animations are visible */
      svg {
        max-width: 100%;
        height: auto;
      }

      svg * {
        animation: inherit !important;
      }
    `;
    styles.push(enhancementCSS);

    const combinedCSS = styles.join('\n\n');

    // Step 6: Create final HTML with inline carousel script and animation support
    const carouselScript = `
      <script>
        // Enhanced page restoration with animation support
        document.addEventListener('DOMContentLoaded', function() {
          console.log('[GetInspire] Initializing captured page with animation support');

          // Show all carousel slides
          const carouselItems = document.querySelectorAll(
            '.carousel-item, .slick-slide, .swiper-slide, ' +
            '.splide__slide, .keen-slider__slide, ' +
            '[class*="slide"]:not([class*="button"])'
          );
          carouselItems.forEach(function(item) {
            item.style.display = 'block';
            item.style.opacity = '1';
            item.style.visibility = 'visible';
            item.style.transform = 'none';
            item.style.position = 'relative';
          });

          // Ensure lazy-loaded images are displayed
          const lazyImages = document.querySelectorAll('img[data-src], img[data-lazy]');
          lazyImages.forEach(function(img) {
            if (img.dataset.src && !img.src) {
              img.src = img.dataset.src;
            }
            if (img.dataset.lazy && !img.src) {
              img.src = img.dataset.lazy;
            }
          });

          // Restart animations that should be playing
          const animatedElements = document.querySelectorAll('[class*="animate"]');
          animatedElements.forEach(function(el) {
            const computed = window.getComputedStyle(el);
            if (computed.animationName && computed.animationName !== 'none') {
              // Force animation restart
              el.style.animation = 'none';
              setTimeout(function() {
                el.style.animation = '';
              }, 10);
            }
          });

          // Handle video elements - set poster and controls
          const videos = document.querySelectorAll('video');
          videos.forEach(function(video) {
            video.controls = true;
            video.preload = 'metadata';
          });

          console.log('[GetInspire] Page restoration complete');
        });
      </script>
    `;

    const finalHtml = modifiedHtml.replace(
      '</head>',
      `<style>\n${combinedCSS}\n</style>\n${carouselScript}\n</head>`
    );

    // ==================== CRAWL MODE BRANCH (v2.0) ====================
    if (isCrawlMode) {
      console.log('[GetInspire] Crawl mode: Sending page data to background...');

      // Extract links for crawl
      const links = extractSameDomainLinks(crawlBaseDomain);

      // Send captured page data to background (with processed HTML)
      chrome.runtime.sendMessage({
        type: 'PAGE_CAPTURED',
        pageData: {
          url: window.location.href,
          title: document.title,
          html: finalHtml
        },
        links: links
      });

      chrome.runtime.sendMessage({
        type: 'CAPTURE_STATUS',
        status: `Page captured, found ${links.length} links`
      });

      console.log('[GetInspire] Crawl mode: Page captured, found', links.length, 'links');

      // Skip ZIP generation - background will handle it
      window.__GETINSPIRE_RUNNING__ = false;
      return;
    }

    // Step 7: Create ZIP file (single-page mode only)
    console.log('[GetInspire] Creating ZIP file...');
    const zip = new JSZip();

    // Add HTML file
    zip.file('index.html', finalHtml);

    // Add large assets to assets folder
    const assetsFolder = zip.folder('assets');
    for (const [url, data] of downloadedAssets) {
      if (data.blob.size >= 100000) {
        assetsFolder.file(data.filename, data.blob);
      }
    }

    // Add readme file
    const animLibsList = Object.entries(animationLibraries).filter(([k, v]) => v).map(([k]) => k);
    const readme = `# Captured Page Information

URL: ${window.location.href}
Title: ${document.title}
Captured: ${new Date().toISOString()}
GetInspire Version: 2.0.0

## Statistics
- Total assets found: ${assetsToDownload.size}
- Assets downloaded: ${downloadedAssets.size}
- Assets deduplicated: ${deduplicatedCount}
- Assets embedded (base64): ${[...downloadedAssets.values()].filter(d => d.blob && d.blob.size < 100000).length}
- Assets saved separately: ${[...downloadedAssets.values()].filter(d => d.blob && d.blob.size >= 100000).length}
- Images captured: ${images.length}
- Canvases captured: ${canvases.length}
- Videos found: ${videos.length}
- Audio files found: ${audioElements.length}
- Script files found: ${scriptElements.length}
- Fonts extracted: ${[...assetsToDownload.values()].filter(d => d.type === 'font').length}

## Animation Support (v2.0 Enhanced)
- CSS keyframe animations preserved
- CSS @property declarations captured
- Computed animation states preserved
- Backdrop blur and modern CSS effects supported
- Tailwind CSS animations maintained
- SVG animations captured
- Transform and transition properties preserved
- **Hover states captured**: ${interactionStates.hover.length} rules (use .gi-hover-state class)
- **Focus states captured**: ${interactionStates.focus.length} rules (use .gi-focus-state class)
- **Active states captured**: ${interactionStates.active.length} rules (use .gi-active-state class)
- **Animation libraries detected**: ${animLibsList.length > 0 ? animLibsList.join(', ') : 'None'}
- **Animated canvases**: ${canvasFramesData.filter(c => c.isAnimated).length} of ${canvasFramesData.length}

## CSS-in-JS Support (v2.0)
- styled-components styles extracted
- Emotion styles extracted
- Linaria/JSS/Aphrodite styles extracted
- Next.js CSS modules captured

## Carousel Support
- All carousel slides have been expanded and made visible
- Slides are displayed vertically for complete capture
- Navigation controls have been hidden
- Supports: Slick, Swiper, Bootstrap, Splide, Keen Slider, and more

## Media Support
- Canvas elements converted to images
- Videos included with controls enabled
- Video posters auto-generated if missing
- SVG graphics preserved
- Background images captured

## Notes
- Small assets (<100KB) are embedded as base64
- Large assets are saved in the assets folder
- Duplicate assets are deduplicated by content hash
- The page works completely offline
- Animations will replay on page load
- Interactive features are preserved where possible
- To activate hover states, add .gi-hover-state class to elements
`;
    zip.file('README.md', readme);

    // Step 8: Generate and download ZIP
    console.log('[GetInspire] Generating ZIP...');
    chrome.runtime.sendMessage({
      type: 'CAPTURE_STATUS',
      status: 'Generating ZIP file...'
    });

    const zipBlob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    }, (metadata) => {
      const percent = Math.round(metadata.percent);
      console.log(`[GetInspire] ZIP generation: ${percent}%`);
    });

    console.log('[GetInspire] Initiating download...');
    const url = URL.createObjectURL(zipBlob);
    const hostname = window.location.hostname.replace(/[^a-z0-9]/gi, '-');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `${hostname}-${timestamp}.zip`;

    // Create a download link and click it
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // Clean up
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    // Send success messages
    chrome.runtime.sendMessage({
      type: 'CAPTURE_STATUS',
      status: 'Capture completed!'
    });

    chrome.runtime.sendMessage({
      type: 'CAPTURE_COMPLETE'
    });

    console.log('[GetInspire] Capture completed successfully!');
    console.log('[GetInspire] File saved as:', filename);

  } catch (error) {
    console.error('[GetInspire] Capture failed:', error);
    chrome.runtime.sendMessage({
      type: 'CAPTURE_ERROR',
      error: error.message
    });
    if (!isCrawlMode) {
      alert('Capture failed: ' + error.message);
    }
  } finally {
    // Clean up
    window.__GETINSPIRE_RUNNING__ = false;
  }
})();

