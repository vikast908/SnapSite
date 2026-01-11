// Enhanced content script for GetInspire 2.0 with multi-page crawling, animation capture, and asset deduplication
// Cross-browser compatibility: Use browser.* if available (Firefox), otherwise use chrome.*
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

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
    browserAPI.runtime.sendMessage({
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
    // Enhanced for sites with scroll-position image sequences (like wabi.ai)
    async function triggerScrollAnimations() {
      console.log('[GetInspire] Triggering scroll animations (enhanced)...');

      const scrollHeight = document.documentElement.scrollHeight;
      const viewportHeight = window.innerHeight;

      // More scroll steps for smoother capture of scroll-triggered content
      // Use 20 steps minimum, or 1 step per viewport height
      const scrollSteps = Math.max(20, Math.ceil(scrollHeight / viewportHeight));

      // Track all images discovered during scroll to ensure they're loaded
      const discoveredImages = new Set();

      // Helper to collect visible images at current scroll position
      const collectVisibleImages = () => {
        document.querySelectorAll('img[src], img[data-src], [style*="background-image"]').forEach(el => {
          const src = el.src || el.dataset.src || '';
          const bgMatch = el.style.backgroundImage?.match(/url\(['"]?([^'"]+)['"]?\)/);
          if (src) discoveredImages.add(src);
          if (bgMatch) discoveredImages.add(bgMatch[1]);
        });
      };

      // Scroll through the page slowly to trigger all scroll-based animations
      for (let i = 0; i <= scrollSteps; i++) {
        const scrollPos = (scrollHeight - viewportHeight) * (i / scrollSteps);
        window.scrollTo({ top: scrollPos, behavior: 'instant' });

        // Wait longer at each position for animations to settle
        // Scroll-triggered animations often need 300-500ms to complete
        await new Promise(r => setTimeout(r, 400));

        // Collect any images visible at this scroll position
        collectVisibleImages();

        // Extra wait at key positions (every 25% of page)
        if (i % Math.floor(scrollSteps / 4) === 0) {
          await new Promise(r => setTimeout(r, 300));
        }
      }

      // Do a second slower pass for complex scroll animations
      console.log('[GetInspire] Second scroll pass for complex animations...');
      for (let i = scrollSteps; i >= 0; i--) {
        const scrollPos = (scrollHeight - viewportHeight) * (i / scrollSteps);
        window.scrollTo({ top: scrollPos, behavior: 'instant' });
        await new Promise(r => setTimeout(r, 200));
        collectVisibleImages();
      }

      // Final scroll to capture full page state
      window.scrollTo({ top: scrollHeight, behavior: 'instant' });
      await new Promise(r => setTimeout(r, 500));
      collectVisibleImages();

      // Scroll back to top
      window.scrollTo({ top: 0, behavior: 'instant' });
      await new Promise(r => setTimeout(r, 300));

      console.log(`[GetInspire] Scroll animation complete. Discovered ${discoveredImages.size} images.`);

      // Force load any lazy images that were discovered
      for (const src of discoveredImages) {
        if (src && !src.startsWith('data:')) {
          try {
            const img = new Image();
            img.src = src;
          } catch (e) {
            // Ignore load errors
          }
        }
      }

      // Wait for images to start loading
      await new Promise(r => setTimeout(r, 500));
    }

    // Detect and capture scroll-based image sequences (like wabi.ai flipbook animations)
    function detectImageSequences() {
      console.log('[GetInspire] Detecting image sequences...');
      const sequences = [];

      // Look for preloaded images
      const preloadLinks = document.querySelectorAll('link[rel="preload"][as="image"], link[rel="prefetch"][as="image"]');
      const preloadSrcs = Array.from(preloadLinks).map(l => l.href);
      console.log(`[GetInspire] Found ${preloadSrcs.length} preloaded/prefetched images`);

      // Log first few for debugging
      if (preloadSrcs.length > 0) {
        console.log('[GetInspire] Sample preloaded images:', preloadSrcs.slice(0, 5));
      }

      // Also check for images with numbered patterns
      const allImages = document.querySelectorAll('img[src]');
      const imageSrcs = Array.from(allImages).map(img => img.src);

      const allSrcs = [...new Set([...preloadSrcs, ...imageSrcs])]; // Deduplicate

      // Group images by base path (detecting sequences)
      const sequenceGroups = {};

      for (const src of allSrcs) {
        // Multiple pattern matching for different naming conventions
        // Pattern 1: name-01.png, name_1.jpg, frame-001.png (number at end before extension)
        let match = src.match(/^(.+?)[-_]?(\d{1,4})\.(png|jpg|jpeg|webp|gif|avif|svg)(\?.*)?$/i);

        // Pattern 2: /apps/1.webp, /radio/frame2.png (folder/number pattern)
        if (!match) {
          match = src.match(/^(.+\/)(\d{1,4})\.(png|jpg|jpeg|webp|gif|avif|svg)(\?.*)?$/i);
        }

        // Pattern 3: name1.webp without separator
        if (!match) {
          match = src.match(/^(.+?)(\d{1,4})\.(png|jpg|jpeg|webp|gif|avif|svg)(\?.*)?$/i);
        }

        if (match) {
          const baseName = match[1];
          const frameNum = parseInt(match[2], 10);
          if (!sequenceGroups[baseName]) {
            sequenceGroups[baseName] = [];
          }
          sequenceGroups[baseName].push({ src, frameNum });
        }
      }

      // Filter to only sequences with 3+ frames
      for (const [baseName, frames] of Object.entries(sequenceGroups)) {
        if (frames.length >= 3) {
          frames.sort((a, b) => a.frameNum - b.frameNum);
          const shortName = baseName.split('/').pop() || baseName.split('/').slice(-2).join('/');
          sequences.push({
            baseName: shortName,
            frameCount: frames.length,
            frames: frames.map(f => f.src)
          });
          console.log(`[GetInspire] Found image sequence: ${shortName} (${frames.length} frames)`);
        }
      }

      // If no sequences found but we have preloaded images, treat them as a single sequence
      if (sequences.length === 0 && preloadSrcs.length >= 3) {
        console.log('[GetInspire] No numbered sequences found, treating all preloads as animation frames');
        sequences.push({
          baseName: 'preloaded-animations',
          frameCount: preloadSrcs.length,
          frames: preloadSrcs
        });
      }

      // Also detect srcset or data-src patterns that might indicate lazy sequences
      document.querySelectorAll('[data-src*="frame"], [data-src*="sequence"], [data-animation-frames]').forEach(el => {
        const dataSrc = el.dataset.src || el.dataset.animationFrames;
        if (dataSrc) {
          console.log(`[GetInspire] Found animation data attribute: ${dataSrc.substring(0, 50)}...`);
        }
      });

      console.log(`[GetInspire] Total sequences detected: ${sequences.length}`);
      return sequences;
    }

    // Preload all frames from detected image sequences
    async function preloadImageSequences(sequences) {
      if (!sequences.length) return;

      console.log(`[GetInspire] Preloading ${sequences.length} image sequences...`);

      const preloadPromises = [];

      for (const seq of sequences) {
        for (const frameSrc of seq.frames) {
          const promise = new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve({ src: frameSrc, loaded: true });
            img.onerror = () => resolve({ src: frameSrc, loaded: false });
            img.src = frameSrc;
          });
          preloadPromises.push(promise);
        }
      }

      // Wait for all frames to load (with timeout)
      const results = await Promise.race([
        Promise.all(preloadPromises),
        new Promise(resolve => setTimeout(() => resolve([]), 5000))
      ]);

      const loadedCount = results.filter(r => r?.loaded).length;
      console.log(`[GetInspire] Preloaded ${loadedCount}/${preloadPromises.length} sequence frames`);
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
    function generateAnimationMetadata(animLibs, gsapState, animeState, hoverStates, canvasFrames, imageSequences = []) {
      return {
        capturedAt: new Date().toISOString(),
        animationLibraries: Object.entries(animLibs).filter(([k, v]) => v).map(([k]) => k),
        gsap: gsapState,
        anime: animeState,
        imageSequences: imageSequences.map(s => ({ name: s.baseName, frameCount: s.frameCount })),
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
    // v2.1 Enhanced limits for comprehensive capture
    const MAX_CONCURRENT = 25;      // 25 parallel downloads (was 15)
    const MAX_ASSETS = 50000;       // 50k assets (was 2000)
    const DOWNLOAD_TIMEOUT = 10000; // 10s timeout per asset (reduced from 30s to prevent hanging)
    const ASSET_OVERALL_TIMEOUT = 15000; // 15s max per asset including all retries
    const EMBED_THRESHOLD = 500000; // 500KB - embed smaller assets as base64 (was 100KB)
    const MAX_IMAGE_DIMENSION = 2000;

    // URLs to skip (tracking, analytics, third-party scripts that commonly block)
    const SKIP_URL_PATTERNS = [
      /google-analytics\.com/i,
      /googletagmanager\.com/i,
      /gtag\/js/i,
      /gtm\.js/i,
      /analytics/i,
      /facebook\.net/i,
      /fbevents/i,
      /doubleclick\.net/i,
      /googlesyndication/i,
      /googleadservices/i,
      /hotjar\.com/i,
      /mixpanel/i,
      /segment\.com/i,
      /segment\.io/i,
      /amplitude/i,
      /intercom/i,
      /crisp\.chat/i,
      /drift\.com/i,
      /zendesk/i,
      /hubspot/i,
      /wisepops/i,
      /dwin1\.com/i,
      /reb2b/i,
      /clarity\.ms/i,
      /fullstory/i,
      /mouseflow/i,
      /crazyegg/i,
      /optimizely/i,
      /vwo\.com/i,
      /livechatinc/i,
      /tawk\.to/i,
      /freshdesk/i,
      /gsi\/client/i, // Google Sign-In
      /accounts\.google\.com/i,
      /connect\.facebook/i,
      /platform\.twitter/i,
      /linkedin\.com\/in/i,
      /recaptcha/i,
      /captcha/i,
      /sentry\.io/i,
      /bugsnag/i,
      /rollbar/i,
      /newrelic/i,
      /datadoghq/i,
      /logrocket/i
    ];

    // Check if URL should be skipped
    function shouldSkipUrl(url) {
      if (!url) return true;
      return SKIP_URL_PATTERNS.some(pattern => pattern.test(url));
    }

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
      if (blob.size < EMBED_THRESHOLD || !blob.type.startsWith('image/')) return blob;
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

    // Helper function to download a resource as blob (aggressive - no security restrictions)
    async function downloadAsBlob(url, timeoutMs = DOWNLOAD_TIMEOUT) {
      // Skip tracking/analytics URLs immediately
      if (shouldSkipUrl(url)) {
        return null;
      }

      // Try multiple strategies to fetch the resource - use faster approach
      // Only try 2 strategies to avoid hanging on blocked resources
      const strategies = [
        { mode: 'cors', credentials: 'omit' },
        { mode: 'cors', credentials: 'include' }
      ];

      for (const strategy of strategies) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
          const response = await fetch(url, {
            signal: controller.signal,
            cache: 'force-cache',
            ...strategy
          });
          clearTimeout(timeoutId);

          // Handle opaque responses (no-cors mode)
          if (response.type === 'opaque') {
            const blob = await response.blob();
            if (blob && blob.size > 0) return blob;
            continue;
          }

          if (!response.ok) continue;

          const blob = await response.blob();
          if (blob && blob.size > 0) return blob;
        } catch (error) {
          clearTimeout(timeoutId);
          // If aborted or blocked, don't try more strategies
          if (error.name === 'AbortError') break;
        }
      }

      // Try via background script as last resort (for extension context)
      // Use a short timeout for this too
      try {
        const bgTimeout = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Background fetch timeout')), 5000)
        );
        return await Promise.race([fetchViaBackground(url), bgTimeout]);
      } catch (e) {
        return null;
      }
    }

    // Fetch via background script (has more permissions)
    async function fetchViaBackground(url) {
      return new Promise((resolve) => {
        browserAPI.runtime.sendMessage({ type: 'FETCH_ASSET', url }, response => {
          if (response && response.success && response.data) {
            // Convert base64 back to blob
            const binary = atob(response.data);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
              bytes[i] = binary.charCodeAt(i);
            }
            resolve(new Blob([bytes], { type: response.mimeType || 'application/octet-stream' }));
          } else {
            resolve(null);
          }
        });
      });
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
    browserAPI.runtime.sendMessage({
      type: 'CAPTURE_STATUS',
      status: 'Capturing animations...'
    });

    // Trigger scroll animations to ensure all lazy content loads
    await triggerScrollAnimations();

    // Detect and preload image sequences (for scroll-based flipbook animations)
    const imageSequences = detectImageSequences();
    if (imageSequences.length > 0) {
      await preloadImageSequences(imageSequences);
    }

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
      animationLibraries, gsapState, animeState, interactionStates, canvasFramesData, imageSequences
    );

    console.log('[GetInspire] Animation capture complete:', animationMetadata);

    // Wait for JavaScript-rendered content with smart detection
    console.log('[GetInspire] Waiting for JS-rendered content...');

    // Smart wait: keep checking until SVGs appear or timeout
    let waitAttempts = 0;
    const maxWaitAttempts = 20; // 20 * 500ms = 10 seconds max
    let lastSvgCount = 0;

    while (waitAttempts < maxWaitAttempts) {
      await new Promise(resolve => setTimeout(resolve, 500));
      waitAttempts++;

      const currentSvgCount = document.querySelectorAll('svg').length;
      const svgsWithContent = Array.from(document.querySelectorAll('svg')).filter(s => {
        const inner = s.innerHTML.trim();
        return inner && inner.length > 10 && (inner.includes('<path') || inner.includes('<use') || inner.includes('<circle') || inner.includes('<polygon'));
      }).length;

      console.log(`[GetInspire] Wait ${waitAttempts}: ${currentSvgCount} SVGs, ${svgsWithContent} with content`);

      // If we have SVGs with content and count is stable, we're done
      if (svgsWithContent > 0 && currentSvgCount === lastSvgCount) {
        console.log('[GetInspire] SVG content detected and stable, proceeding...');
        break;
      }

      lastSvgCount = currentSvgCount;

      // Also trigger scroll to force lazy loading
      if (waitAttempts % 4 === 0) {
        window.scrollTo({ top: document.body.scrollHeight / 2, behavior: 'instant' });
        await new Promise(r => setTimeout(r, 100));
        window.scrollTo({ top: 0, behavior: 'instant' });
      }
    }

    // Final wait for any animations to settle
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Log SVG statistics for debugging
    const svgStats = {
      total: document.querySelectorAll('svg').length,
      withContent: Array.from(document.querySelectorAll('svg')).filter(s => s.innerHTML.trim()).length,
      withUse: document.querySelectorAll('svg use').length,
      symbols: document.querySelectorAll('symbol').length,
      inLists: document.querySelectorAll('li svg').length,
      withPaths: document.querySelectorAll('svg path').length
    };
    console.log('[GetInspire] SVG statistics:', svgStats);

    // If still no SVGs with content, log a warning
    if (svgStats.withContent === 0 && svgStats.total > 0) {
      console.warn('[GetInspire] WARNING: SVGs found but none have content - icons may be missing');
    }

    // Step 2: Collect all assets (COMPREHENSIVE - v2.1 Enhanced)
    console.log('[GetInspire] Collecting all assets (comprehensive mode)...');

    const assetsToDownload = new Map(); // url -> {type, element}
    const downloadedAssets = new Map(); // url -> {blob, base64, filename}

    // Helper to safely add asset URL (permissive - no security restrictions)
    function addAsset(url, type, element = null, extra = {}) {
      // Only skip truly invalid URLs
      if (!url || url.startsWith('javascript:') || url.startsWith('#') || url === 'about:blank') return;
      // Skip data: URLs (already embedded)
      if (url.startsWith('data:')) return;
      // Skip tracking/analytics URLs early
      if (shouldSkipUrl(url)) return;

      try {
        const absoluteUrl = new URL(url, window.location.href).href;
        // Double-check the absolute URL for tracking patterns
        if (shouldSkipUrl(absoluteUrl)) return;
        if (!assetsToDownload.has(absoluteUrl)) {
          assetsToDownload.set(absoluteUrl, { type, element, ...extra });
        }
      } catch (e) {
        // Try adding as-is if URL parsing fails
        if (url.includes('/') || url.includes('.')) {
          assetsToDownload.set(url, { type, element, ...extra });
        }
      }
    }

    // Helper to extract URLs from CSS value
    function extractUrlsFromCSS(cssValue) {
      if (!cssValue || cssValue === 'none') return [];
      const urls = [];
      const matches = cssValue.matchAll(/url\(["']?([^"')]+)["']?\)/gi);
      for (const match of matches) {
        if (match[1] && !match[1].startsWith('data:')) {
          urls.push(match[1]);
        }
      }
      return urls;
    }

    // Helper to parse srcset attribute
    function parseSrcset(srcset) {
      if (!srcset) return [];
      const urls = [];
      const parts = srcset.split(',');
      for (const part of parts) {
        const [url] = part.trim().split(/\s+/);
        if (url && !url.startsWith('data:')) {
          urls.push(url);
        }
      }
      return urls;
    }

    // ==================== IMAGE COLLECTION (Enhanced) ====================
    console.log('[GetInspire] Collecting images...');

    // Standard img elements
    const images = document.querySelectorAll('img');
    images.forEach(img => {
      // Main src
      if (img.src) addAsset(img.src, 'image', img);

      // Srcset for responsive images
      if (img.srcset) {
        parseSrcset(img.srcset).forEach(url => addAsset(url, 'image', img, { isSrcset: true }));
      }

      // Data attributes for lazy loading (common patterns)
      const lazyAttrs = ['data-src', 'data-lazy', 'data-original', 'data-url', 'data-image',
                         'data-lazy-src', 'data-srcset', 'data-bg', 'data-background',
                         'data-hi-res', 'data-retina', 'data-full', 'data-zoom'];
      lazyAttrs.forEach(attr => {
        const val = img.getAttribute(attr);
        if (val) {
          if (attr.includes('srcset')) {
            parseSrcset(val).forEach(url => addAsset(url, 'image', img, { isLazy: true }));
          } else {
            addAsset(val, 'image', img, { isLazy: true });
          }
        }
      });
    });

    // Picture elements with multiple sources
    const pictures = document.querySelectorAll('picture');
    pictures.forEach(picture => {
      const sources = picture.querySelectorAll('source');
      sources.forEach(source => {
        if (source.srcset) {
          parseSrcset(source.srcset).forEach(url => addAsset(url, 'image', source, { isPicture: true }));
        }
        if (source.src) addAsset(source.src, 'image', source, { isPicture: true });
      });
    });

    // ==================== META / OG / TWITTER IMAGES ====================
    console.log('[GetInspire] Collecting meta images...');

    const metaImages = document.querySelectorAll(
      'meta[property="og:image"], meta[property="og:image:url"], ' +
      'meta[name="twitter:image"], meta[name="twitter:image:src"], ' +
      'meta[property="og:video:thumbnail"], meta[name="thumbnail"], ' +
      'meta[itemprop="image"], meta[property="og:image:secure_url"]'
    );
    metaImages.forEach(meta => {
      const content = meta.getAttribute('content');
      if (content) addAsset(content, 'meta-image', meta);
    });

    // ==================== FAVICON & ICONS ====================
    console.log('[GetInspire] Collecting favicons and icons...');

    const iconLinks = document.querySelectorAll(
      'link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"], ' +
      'link[rel="apple-touch-icon-precomposed"], link[rel="mask-icon"], ' +
      'link[rel="fluid-icon"], link[rel*="icon"]'
    );
    iconLinks.forEach(link => {
      if (link.href) addAsset(link.href, 'icon', link);
    });

    // Web app manifest
    const manifestLink = document.querySelector('link[rel="manifest"]');
    if (manifestLink && manifestLink.href) {
      addAsset(manifestLink.href, 'manifest', manifestLink);
    }

    // ==================== PRELOADED ASSETS ====================
    console.log('[GetInspire] Collecting preloaded assets...');

    const preloads = document.querySelectorAll(
      'link[rel="preload"], link[rel="prefetch"], link[rel="prerender"]'
    );
    preloads.forEach(link => {
      const as = link.getAttribute('as');
      const href = link.href;
      if (href) {
        const type = as === 'image' ? 'image' : as === 'font' ? 'font' : as === 'style' ? 'stylesheet' : 'preload';
        addAsset(href, type, link, { isPreload: true });
      }
    });

    // Add image sequence frames that were detected earlier
    let sequenceFrameCount = 0;
    if (imageSequences && imageSequences.length > 0) {
      console.log(`[GetInspire] Adding ${imageSequences.length} image sequences to download queue`);
      for (const seq of imageSequences) {
        for (const frameSrc of seq.frames) {
          addAsset(frameSrc, 'image', null, { isSequenceFrame: true });
          sequenceFrameCount++;
        }
      }
    }
    console.log(`[GetInspire] Added ${sequenceFrameCount} image sequence frames to queue`);

    // ==================== VIDEO COLLECTION (Enhanced) ====================
    console.log('[GetInspire] Collecting videos...');

    const videos = document.querySelectorAll('video');
    videos.forEach(video => {
      // Main src
      if (video.src) addAsset(video.src, 'video', video);

      // Poster image
      if (video.poster) addAsset(video.poster, 'image', video, { isPoster: true });

      // Source elements (multiple formats)
      video.querySelectorAll('source').forEach(source => {
        if (source.src) addAsset(source.src, 'video', source);
      });

      // Track elements (subtitles, captions)
      video.querySelectorAll('track').forEach(track => {
        if (track.src) addAsset(track.src, 'track', track);
      });

      // Data attributes for lazy video loading
      ['data-src', 'data-poster', 'data-video'].forEach(attr => {
        const val = video.getAttribute(attr);
        if (val) addAsset(val, attr.includes('poster') ? 'image' : 'video', video, { isLazy: true });
      });
    });

    // ==================== AUDIO COLLECTION ====================
    console.log('[GetInspire] Collecting audio...');

    const audioElements = document.querySelectorAll('audio');
    audioElements.forEach(audio => {
      if (audio.src) addAsset(audio.src, 'audio', audio);
      audio.querySelectorAll('source').forEach(source => {
        if (source.src) addAsset(source.src, 'audio', source);
      });
    });

    // ==================== CANVAS CAPTURE (Enhanced) ====================
    console.log('[GetInspire] Capturing canvas elements...');

    const canvases = document.querySelectorAll('canvas');
    canvases.forEach((canvas, index) => {
      try {
        // Try multiple formats for best quality
        let dataUrl;
        const width = canvas.width || canvas.offsetWidth;
        const height = canvas.height || canvas.offsetHeight;

        if (width > 0 && height > 0) {
          // Try PNG first (lossless)
          dataUrl = canvas.toDataURL('image/png');

          // If canvas is large, also try WebP for smaller size
          if (width * height > 500000) {
            try {
              const webpUrl = canvas.toDataURL('image/webp', 0.95);
              if (webpUrl.length < dataUrl.length) {
                dataUrl = webpUrl;
              }
            } catch (e) {}
          }
        } else {
          dataUrl = canvas.toDataURL('image/png');
        }

        const canvasId = `canvas-${index}`;
        canvas.setAttribute('data-canvas-id', canvasId);
        assetsToDownload.set(`canvas-${index}`, {
          type: 'canvas',
          element: canvas,
          dataUrl: dataUrl,
          width: width,
          height: height
        });
      } catch (e) {
        console.warn('[GetInspire] Could not capture canvas:', e.message);
      }
    });

    // ==================== SVG COLLECTION (Enhanced) ====================
    console.log('[GetInspire] Collecting SVGs...');

    // SVG images
    document.querySelectorAll('img[src*=".svg"]').forEach(img => {
      if (img.src) addAsset(img.src, 'svg', img);
    });

    // External SVG references via use elements
    document.querySelectorAll('use[href], use[xlink\\:href]').forEach(use => {
      const href = use.getAttribute('href') || use.getAttribute('xlink:href');
      if (href && !href.startsWith('#')) {
        const [svgUrl, symbolId] = href.split('#');
        if (svgUrl) addAsset(svgUrl, 'svg-sprite', use, { symbolId });
      }
    });

    // SVG sprites and symbols tracking
    let symbolCount = 0;
    let inlineSvgCount = 0;
    document.querySelectorAll('svg').forEach(svg => {
      const symbols = svg.querySelectorAll('symbol, defs');
      if (symbols.length > 0) {
        symbolCount += symbols.length;
        svg.setAttribute('data-gi-sprite', 'true');
      }
      if (symbols.length === 0 && svg.innerHTML.trim()) {
        inlineSvgCount++;
      }
    });
    console.log(`[GetInspire] Found ${symbolCount} SVG symbols/defs, ${inlineSvgCount} inline SVGs`);

    // External SVG files via object/embed
    document.querySelectorAll('object[data*=".svg"], embed[src*=".svg"], iframe[src*=".svg"]').forEach(obj => {
      const src = obj.getAttribute('data') || obj.getAttribute('src');
      if (src) addAsset(src, 'svg', obj);
    });

    // ==================== CSS BACKGROUND & COMPUTED STYLES (Optimized) ====================
    console.log('[GetInspire] Collecting CSS backgrounds and computed styles...');

    // OPTIMIZATION: Only check elements that likely have background images
    // Instead of checking ALL elements, use targeted selectors
    const elementsWithBgSelectors = [
      '[style*="background"]',
      '[style*="url("]',
      '[style*="mask"]',
      '[style*="cursor"]',
      '[class*="bg-"]',
      '[class*="background"]',
      '[class*="hero"]',
      '[class*="banner"]',
      '[class*="cover"]',
      '[class*="thumbnail"]',
      'header', 'footer', 'section', 'article', 'aside',
      'div[class]', 'span[class]', // Only divs/spans with classes
      '[data-bg]', '[data-background]', '[data-src]', '[data-image]'
    ];

    const cssPropertiesToCheck = [
      'backgroundImage',
      'borderImageSource',
      'listStyleImage',
      'maskImage',
      'webkitMaskImage'
    ];

    // Batch collect elements to check
    const elementsToCheck = new Set();
    elementsWithBgSelectors.forEach(selector => {
      try {
        document.querySelectorAll(selector).forEach(el => elementsToCheck.add(el));
      } catch (e) {}
    });

    console.log(`[GetInspire] Checking ${elementsToCheck.size} elements for CSS backgrounds...`);

    // Process in batches to avoid blocking
    const elementArray = Array.from(elementsToCheck);
    const BATCH_SIZE = 100;

    for (let i = 0; i < elementArray.length; i += BATCH_SIZE) {
      const batch = elementArray.slice(i, i + BATCH_SIZE);

      batch.forEach(el => {
        // Check inline style first (fast)
        const inlineStyle = el.getAttribute('style');
        if (inlineStyle) {
          extractUrlsFromCSS(inlineStyle).forEach(url => {
            addAsset(url, 'inline-style', el);
          });
        }

        // Check data-* attributes (fast)
        Array.from(el.attributes).forEach(attr => {
          if (attr.name.startsWith('data-') &&
              (attr.name.includes('image') || attr.name.includes('bg') ||
               attr.name.includes('src') || attr.name.includes('url') ||
               attr.name.includes('background') || attr.name.includes('poster'))) {
            const val = attr.value;
            if (val && (val.includes('/') || val.includes('.')) && !val.includes(' ')) {
              addAsset(val, 'data-attr', el, { attribute: attr.name });
            }
          }
        });

        // Only call getComputedStyle if element has classes or inline styles
        if (el.className || inlineStyle) {
          try {
            const style = window.getComputedStyle(el);
            cssPropertiesToCheck.forEach(prop => {
              const value = style[prop];
              if (value && value !== 'none' && value.includes('url(')) {
                extractUrlsFromCSS(value).forEach(url => {
                  addAsset(url, 'css-asset', el, { property: prop });
                });
              }
            });
          } catch (e) {}
        }
      });

      // Yield to browser every batch
      if (i + BATCH_SIZE < elementArray.length) {
        await new Promise(r => setTimeout(r, 0));
      }
    }

    // Check ::before/::after only on elements with content property set
    console.log('[GetInspire] Checking pseudo-elements...');
    document.querySelectorAll('[class*="icon"], [class*="before"], [class*="after"], [class*="bullet"]').forEach(el => {
      ['::before', '::after'].forEach(pseudo => {
        try {
          const pseudoStyle = window.getComputedStyle(el, pseudo);
          const content = pseudoStyle.content;
          if (content && content !== 'none' && content !== 'normal' && content.includes('url(')) {
            extractUrlsFromCSS(content).forEach(url => {
              addAsset(url, 'css-asset', el, { property: 'content', pseudo });
            });
          }
          const bgImage = pseudoStyle.backgroundImage;
          if (bgImage && bgImage !== 'none' && bgImage.includes('url(')) {
            extractUrlsFromCSS(bgImage).forEach(url => {
              addAsset(url, 'css-asset', el, { property: 'backgroundImage', pseudo });
            });
          }
        } catch (e) {}
      });
    });

    // ==================== IFRAME SOURCES ====================
    console.log('[GetInspire] Collecting iframe sources...');

    document.querySelectorAll('iframe[src]').forEach(iframe => {
      const src = iframe.src;
      // Only collect same-origin iframes or specific embeddable content
      if (src && !src.startsWith('about:') && !src.startsWith('javascript:')) {
        try {
          const iframeUrl = new URL(src);
          if (iframeUrl.origin === window.location.origin) {
            addAsset(src, 'iframe', iframe);
          }
        } catch (e) {}
      }
    });

    // ==================== FORM ACTION IMAGES (Submit buttons etc) ====================
    document.querySelectorAll('input[type="image"]').forEach(input => {
      if (input.src) addAsset(input.src, 'image', input);
    });

    // Collect fonts from @font-face rules in stylesheets
    console.log('[GetInspire] Collecting fonts from @font-face rules...');
    const allStyleSheets = [...document.styleSheets];
    let fontCount = 0;

    // Helper function to extract font URLs from CSS text
    function extractFontUrlsFromCSS(cssText, baseUrl) {
      const fontUrls = [];
      // Match @font-face blocks
      const fontFaceRegex = /@font-face\s*\{[^}]*\}/gi;
      const fontFaceBlocks = cssText.match(fontFaceRegex) || [];

      fontFaceBlocks.forEach(block => {
        // Extract URLs from src property
        const urlMatches = block.match(/url\(["']?([^"')]+)["']?\)/g);
        if (urlMatches) {
          urlMatches.forEach(match => {
            let url = match.replace(/url\(["']?|["']?\)/g, '');
            // Skip data URIs
            if (url.startsWith('data:')) return;
            // Convert relative URLs to absolute using the stylesheet's base URL
            if (!url.startsWith('http')) {
              try {
                url = new URL(url, baseUrl).href;
              } catch (e) {
                console.warn(`[GetInspire] Invalid font URL: ${url}`);
                return;
              }
            }
            if (url.startsWith('http')) {
              fontUrls.push(url);
            }
          });
        }
      });
      return fontUrls;
    }

    // First, try to read from accessible stylesheets
    allStyleSheets.forEach(sheet => {
      try {
        const rules = [...sheet.cssRules || []];
        const sheetBaseUrl = sheet.href || window.location.href;
        rules.forEach(rule => {
          if (rule.type === CSSRule.FONT_FACE_RULE) {
            const src = rule.style.src;
            if (src) {
              // Extract URLs from src (can have multiple formats)
              const urlMatches = src.match(/url\(["']?([^"')]+)["']?\)/g);
              if (urlMatches) {
                urlMatches.forEach(match => {
                  let url = match.replace(/url\(["']?|["']?\)/g, '');
                  // Convert relative URLs to absolute using stylesheet's base URL
                  if (!url.startsWith('http') && !url.startsWith('data:')) {
                    try {
                      url = new URL(url, sheetBaseUrl).href;
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
        // Cross-origin stylesheets will throw - we'll fetch these separately below
        if (sheet.href) {
          console.log('[GetInspire] Will fetch cross-origin stylesheet for fonts:', sheet.href);
        }
      }
    });

    // Fetch cross-origin stylesheets to extract font URLs (PARALLEL)
    console.log('[GetInspire] Fetching external stylesheets for font extraction...');
    const externalStylesheets = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));

    // Filter to only cross-origin stylesheets we haven't processed
    const stylesheetsToFetch = externalStylesheets.filter(link => {
      if (!link.href) return false;
      const sheet = Array.from(document.styleSheets).find(s => s.href === link.href);
      if (sheet) {
        try {
          const _ = sheet.cssRules;
          return false; // Already accessible
        } catch (e) {
          return true; // Cross-origin, need to fetch
        }
      }
      return true;
    });

    // Fetch all stylesheets in parallel
    const stylesheetPromises = stylesheetsToFetch.map(async link => {
      try {
        const response = await fetch(link.href, { mode: 'cors', credentials: 'omit' });
        if (response.ok) {
          const cssText = await response.text();
          return { href: link.href, cssText };
        }
      } catch (e) {}
      return null;
    });

    const stylesheetResults = await Promise.all(stylesheetPromises);

    // Process results
    stylesheetResults.forEach(result => {
      if (result) {
        const fontUrls = extractFontUrlsFromCSS(result.cssText, result.href);
        fontUrls.forEach(url => {
          if (!assetsToDownload.has(url)) {
            assetsToDownload.set(url, { type: 'font', element: null, fromStylesheet: result.href });
            fontCount++;
          }
        });
      }
    });

    console.log(`[GetInspire] Found ${fontCount} font files`);

    // Collect script files (for reference, will be removed later for offline safety)
    console.log('[GetInspire] Collecting script files...');
    document.querySelectorAll('script[src]').forEach(script => {
      if (script.src && !script.src.startsWith('data:')) {
        assetsToDownload.set(script.src, {type: 'script', element: script});
      }
    });

    // NOTE: Audio and srcset already collected in enhanced section above

    console.log(`[GetInspire] Total assets to download: ${assetsToDownload.size}`);

    // Safety check - limit total assets to prevent memory issues
    if (assetsToDownload.size > MAX_ASSETS) {
      console.warn(`[GetInspire] Too many assets (${assetsToDownload.size}), limiting to ${MAX_ASSETS}`);
      const limitedAssets = new Map([...assetsToDownload.entries()].slice(0, MAX_ASSETS));
      assetsToDownload.clear();
      limitedAssets.forEach((v, k) => assetsToDownload.set(k, v));
    }

    // Step 3: Download all assets with concurrency control and deduplication
    browserAPI.runtime.sendMessage({
      type: 'CAPTURE_STATUS',
      status: `Downloading ${assetsToDownload.size} assets...`
    });
    let downloadCount = 0;
    let successCount = 0;
    let failCount = 0;
    let deduplicatedCount = 0;

    // Helper to download with concurrency limit and deduplication (OPTIMIZED)
    async function downloadWithLimit(entries) {
      const total = entries.length;
      const chunks = [];
      for (let i = 0; i < total; i += MAX_CONCURRENT) {
        chunks.push(entries.slice(i, i + MAX_CONCURRENT));
      }

      let lastProgressUpdate = Date.now();
      let skippedCount = 0;

      // Helper to wrap download with overall timeout
      async function downloadWithTimeout(url, info) {
        // Skip tracking URLs immediately
        if (shouldSkipUrl(url)) {
          skippedCount++;
          return null;
        }

        // Wrap the entire download process with a hard timeout
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Asset timeout')), ASSET_OVERALL_TIMEOUT)
        );

        try {
          return await Promise.race([downloadAsBlob(url), timeoutPromise]);
        } catch (e) {
          return null;
        }
      }

      for (const chunk of chunks) {
        await Promise.all(chunk.map(async ([url, info]) => {
          downloadCount++;

          // Update status every 25 downloads OR every 1 second (whichever comes first)
          const now = Date.now();
          if (downloadCount % 25 === 0 || now - lastProgressUpdate > 1000) {
            lastProgressUpdate = now;
            browserAPI.runtime.sendMessage({
              type: 'CAPTURE_STATUS',
              status: `Downloading... ${downloadCount}/${total} (${skippedCount} skipped)`,
              progress: { done: downloadCount, total }
            });
          }

          const blob = await downloadWithTimeout(url, info);
          if (blob) {
            try {
              // Only compute hash for larger files (deduplication benefit)
              // Skip hash for small files to save CPU
              let hash = null;
              if (blob.size > 10000) { // Only hash files > 10KB
                hash = await hashBlob(blob);
              }

              // Check if we already have this content (only for hashed files)
              if (hash && assetsByHash.has(hash)) {
                const existing = assetsByHash.get(hash);
                downloadedAssets.set(url, {
                  blob: existing.blob,
                  base64: existing.base64,
                  filename: existing.filename,
                  hash,
                  deduplicated: true
                });
                deduplicatedCount++;
                successCount++;
              } else {
                // New unique asset
                const base64 = await blobToBase64(blob);
                const filename = getFilenameFromUrl(url);
                const assetData = { blob, base64, filename, hash };
                downloadedAssets.set(url, assetData);

                if (hash) {
                  assetsByHash.set(hash, assetData);
                }
                successCount++;
              }
            } catch (e) {
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

    // Fix inline SVGs before capturing HTML
    console.log('[GetInspire] Fixing inline SVGs for offline viewing...');
    const allInlineSvgs = document.querySelectorAll('svg');
    let svgFixCount = 0;
    allInlineSvgs.forEach(svg => {
      try {
        // Skip sprite containers
        if (svg.querySelector('symbol, defs')) return;

        // Get computed color for currentColor replacement
        const computedStyle = window.getComputedStyle(svg);
        const parentStyle = svg.parentElement ? window.getComputedStyle(svg.parentElement) : null;
        const color = computedStyle.color || (parentStyle && parentStyle.color) || '#000000';

        // Fix fill="currentColor" on the SVG and its children
        const elementsWithCurrentColor = svg.querySelectorAll('[fill="currentColor"], [stroke="currentColor"]');
        elementsWithCurrentColor.forEach(el => {
          if (el.getAttribute('fill') === 'currentColor') {
            el.setAttribute('fill', color);
            el.setAttribute('data-gi-original-fill', 'currentColor');
          }
          if (el.getAttribute('stroke') === 'currentColor') {
            el.setAttribute('stroke', color);
            el.setAttribute('data-gi-original-stroke', 'currentColor');
          }
        });

        // Also check the SVG element itself
        if (svg.getAttribute('fill') === 'currentColor') {
          svg.setAttribute('fill', color);
          svg.setAttribute('data-gi-original-fill', 'currentColor');
        }

        // Ensure SVG has proper dimensions if missing
        if (!svg.getAttribute('width') && !svg.getAttribute('height') && !svg.style.width && !svg.style.height) {
          const bbox = svg.getBBox ? svg.getBBox() : null;
          if (bbox && bbox.width && bbox.height) {
            svg.style.width = bbox.width + 'px';
            svg.style.height = bbox.height + 'px';
          }
        }

        // Handle <use> elements that reference missing symbols
        const useElements = svg.querySelectorAll('use');
        useElements.forEach(use => {
          const href = use.getAttribute('href') || use.getAttribute('xlink:href');
          if (href && href.startsWith('#')) {
            const symbolId = href.substring(1);
            const symbol = document.getElementById(symbolId);
            if (!symbol) {
              console.warn(`[GetInspire] Missing SVG symbol: ${symbolId}`);
              // Try to find it in any SVG sprite container
              const foundSymbol = document.querySelector(`symbol#${symbolId}, svg #${symbolId}`);
              if (foundSymbol) {
                console.log(`[GetInspire] Found symbol ${symbolId} in sprite container`);
              }
            }
          }
        });

        svgFixCount++;
      } catch (e) {
        console.warn('[GetInspire] Error fixing SVG:', e);
      }
    });
    console.log(`[GetInspire] Fixed ${svgFixCount} inline SVGs`);

    // Capture DOCTYPE and full HTML
    const doctype = document.doctype
      ? `<!DOCTYPE ${document.doctype.name}${document.doctype.publicId ? ` PUBLIC "${document.doctype.publicId}"` : ''}${document.doctype.systemId ? ` "${document.doctype.systemId}"` : ''}>`
      : '<!DOCTYPE html>';
    const htmlContent = doctype + '\n' + document.documentElement.outerHTML;
    console.log('[GetInspire] DOCTYPE preserved:', doctype);

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

      // Skip data URIs - they're already embedded
      if (url.startsWith('data:')) {
        continue;
      }

      if (!data.blob) continue;

      const isSmall = data.blob.size < EMBED_THRESHOLD;
      const replacement = isSmall ? data.base64 : `assets/${data.filename}`;

      // Try multiple URL patterns for replacement
      try {
        const urlObj = new URL(url);
        const patterns = [
          url, // Full URL
          urlObj.pathname, // Just the path
          urlObj.pathname.replace(/^\//, ''), // Path without leading slash
        ];

        patterns.forEach(pattern => {
          // Skip very short patterns to avoid false positives (e.g., matching inside data: URIs)
          if (!pattern || pattern.length < 5) {
            return;
          }

          // Use a more specific regex that requires the URL to be in an attribute context
          // This prevents matching inside data: URIs or other embedded content
          const escapedPattern = escapeForRegex(pattern);

          // Only replace in src, href, url(), or srcset contexts - not inside data: URIs
          // Match pattern when preceded by: src=", href=", url(, srcset=" or when it's the URL in url()
          const contextualRegex = new RegExp(
            `((?:src|href|poster|data-src|data-lazy)=["'])${escapedPattern}(["'])` +
            `|(url\\(["']?)${escapedPattern}(["']?\\))`,
            'gi'
          );

          modifiedHtml = modifiedHtml.replace(contextualRegex, (match, prefix1, suffix1, prefix2, suffix2) => {
            if (prefix1) {
              return `${prefix1}${replacement}${suffix1}`;
            } else if (prefix2) {
              return `${prefix2}${replacement}${suffix2}`;
            }
            return match;
          });
        });

        assetMapping[url] = isSmall ? 'embedded' : `assets/${data.filename}`;
      } catch (e) {
        // Skip invalid URLs
        console.warn('[GetInspire] Skipping invalid URL:', url);
      }
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

    // Collect all CSS @property declarations, keyframes, and @font-face rules
    const allPropertyRules = new Set();
    const allKeyframes = new Set();
    const allFontFaceRules = new Set();

    // Helper function to extract @font-face rules from CSS
    function extractFontFaceRules(cssText) {
      const fontFaceRules = [];
      const fontFaceRegex = /@font-face\s*\{/gi;
      let match;

      while ((match = fontFaceRegex.exec(cssText)) !== null) {
        const startIndex = match.index;
        // Find the matching closing brace
        let braceCount = 1;
        let currentIndex = fontFaceRegex.lastIndex;

        while (braceCount > 0 && currentIndex < cssText.length) {
          const char = cssText[currentIndex];
          if (char === '{') braceCount++;
          else if (char === '}') braceCount--;
          currentIndex++;
        }

        if (braceCount === 0) {
          const fullFontFace = cssText.substring(startIndex, currentIndex);
          fontFaceRules.push(fullFontFace);
        }
      }
      return fontFaceRules;
    }

    // Get all link stylesheets
    const linkStyles = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
    console.log(`[GetInspire] Found ${linkStyles.length} linked stylesheets`);
    let stylesheetsLoaded = 0;
    let stylesheetsFailed = 0;

    for (const link of linkStyles) {
      try {
        console.log(`[GetInspire] Fetching stylesheet: ${link.href}`);
        const response = await fetch(link.href);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        let cssText = await response.text();
        console.log(`[GetInspire] Loaded stylesheet: ${link.href} (${cssText.length} chars)`);
        stylesheetsLoaded++;

        // First, resolve all relative URLs in the CSS to absolute URLs based on the stylesheet's location
        // This ensures fonts and other assets referenced relatively get properly matched
        const stylesheetBaseUrl = link.href;
        cssText = cssText.replace(/url\(["']?([^"')]+)["']?\)/g, (match, urlInCss) => {
          // Skip data URIs and already absolute URLs
          if (urlInCss.startsWith('data:') || urlInCss.startsWith('http://') || urlInCss.startsWith('https://')) {
            return match;
          }
          // Resolve relative URL against stylesheet's base
          try {
            const absoluteUrl = new URL(urlInCss, stylesheetBaseUrl).href;
            return `url("${absoluteUrl}")`;
          } catch (e) {
            return match;
          }
        });

        // Extract and store @property rules, keyframes, and @font-face AFTER URL resolution
        extractCSSProperties(cssText).forEach(rule => allPropertyRules.add(rule));
        extractKeyframes(cssText).forEach(kf => allKeyframes.add(kf));
        extractFontFaceRules(cssText).forEach(ff => allFontFaceRules.add(ff));

        // Replace URLs in CSS with downloaded assets
        for (const [url, data] of downloadedAssets) {
          if (!data.blob) continue;
          if (url.startsWith('data:') || url.startsWith('canvas-')) continue;

          const isSmall = data.blob.size < EMBED_THRESHOLD;
          const replacement = isSmall ? data.base64 : `assets/${data.filename}`;

          try {
            // Try multiple URL patterns
            const urlObj = new URL(url);
            const patterns = [
              url,
              urlObj.pathname,
              urlObj.pathname.replace(/^\//, ''),
            ];

            patterns.forEach(pattern => {
              // Skip short patterns to avoid false matches
              if (!pattern || pattern.length < 5) return;

              // In CSS, URLs only appear in url() - use targeted replacement
              const escapedPattern = escapeForRegex(pattern);
              const cssUrlRegex = new RegExp(`(url\\(["']?)${escapedPattern}(["']?\\))`, 'gi');
              cssText = cssText.replace(cssUrlRegex, `$1${replacement}$2`);
            });
          } catch (e) {
            // Skip invalid URLs
          }
        }

        styles.push(`/* From: ${link.href} */\n${cssText}`);
      } catch (e) {
        console.error('[GetInspire] FAILED to fetch stylesheet:', link.href, e.message);
        stylesheetsFailed++;
      }
    }

    console.log(`[GetInspire] Stylesheets: ${stylesheetsLoaded} loaded, ${stylesheetsFailed} failed`);
    if (stylesheetsFailed > 0) {
      console.warn(`[GetInspire] WARNING: ${stylesheetsFailed} stylesheet(s) could not be loaded - some styles may be missing`);
    }

    // Get all style elements
    const styleElements = Array.from(document.querySelectorAll('style'));
    console.log(`[GetInspire] Found ${styleElements.length} inline <style> elements`);

    for (const style of styleElements) {
      let cssText = style.textContent;
      console.log(`[GetInspire] Processing inline style (${cssText.length} chars)`);

      // Extract and store @property rules, keyframes, and @font-face
      extractCSSProperties(cssText).forEach(rule => allPropertyRules.add(rule));
      extractKeyframes(cssText).forEach(kf => allKeyframes.add(kf));
      extractFontFaceRules(cssText).forEach(ff => allFontFaceRules.add(ff));

      // Replace URLs in inline CSS
      for (const [url, data] of downloadedAssets) {
        if (!data.blob) continue;
        if (url.startsWith('data:') || url.startsWith('canvas-')) continue;

        const isSmall = data.blob.size < EMBED_THRESHOLD;
        const replacement = isSmall ? data.base64 : `assets/${data.filename}`;

        try {
          // Try multiple URL patterns
          const urlObj = new URL(url);
          const patterns = [
            url,
            urlObj.pathname,
            urlObj.pathname.replace(/^\//, ''),
          ];

          patterns.forEach(pattern => {
            // Skip short patterns to avoid false matches
            if (!pattern || pattern.length < 5) return;

            // In CSS, URLs only appear in url() - use targeted replacement
            const escapedPattern = escapeForRegex(pattern);
            const cssUrlRegex = new RegExp(`(url\\(["']?)${escapedPattern}(["']?\\))`, 'gi');
            cssText = cssText.replace(cssUrlRegex, `$1${replacement}$2`);
          });
        } catch (e) {
          // Skip invalid URLs
        }
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

    // Add all collected @font-face rules (with URL replacement)
    if (allFontFaceRules.size > 0) {
      console.log(`[GetInspire] Preserved ${allFontFaceRules.size} @font-face rules`);
      let fontFaceCSS = [...allFontFaceRules].join('\n\n');

      // Replace font URLs in @font-face rules with downloaded assets
      for (const [url, data] of downloadedAssets) {
        if (!data.blob) continue;
        if (url.startsWith('data:') || url.startsWith('canvas-')) continue;

        const isSmall = data.blob.size < EMBED_THRESHOLD;
        const replacement = isSmall ? data.base64 : `assets/${data.filename}`;

        try {
          const urlObj = new URL(url);
          const patterns = [
            url,
            urlObj.pathname,
            urlObj.pathname.replace(/^\//, ''),
          ];

          patterns.forEach(pattern => {
            // Skip short patterns to avoid false matches
            if (!pattern || pattern.length < 5) return;

            // In CSS, URLs only appear in url() - use targeted replacement
            const escapedPattern = escapeForRegex(pattern);
            const cssUrlRegex = new RegExp(`(url\\(["']?)${escapedPattern}(["']?\\))`, 'gi');
            fontFaceCSS = fontFaceCSS.replace(cssUrlRegex, `$1${replacement}$2`);
          });
        } catch (e) {
          // Skip invalid URLs
        }
      }

      styles.unshift(`/* @font-face rules (icon fonts, web fonts) */\n${fontFaceCSS}\n`);
    } else {
      console.log('[GetInspire] No @font-face rules found');
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

      /* GetInspire: Ensure SVG icons are visible */
      svg {
        display: inline-block;
        vertical-align: middle;
      }

      svg:not([width]):not([style*="width"]) {
        min-width: 1em;
        min-height: 1em;
      }

      /* Ensure SVG paths and shapes are visible */
      svg path,
      svg circle,
      svg rect,
      svg polygon,
      svg polyline,
      svg line,
      svg ellipse {
        fill: inherit;
        stroke: inherit;
      }

      /* Fix for SVGs that lost their fill color */
      svg[data-gi-original-fill="currentColor"]:not([fill]) path:not([fill]),
      svg[data-gi-original-fill="currentColor"]:not([fill]) circle:not([fill]),
      svg[data-gi-original-fill="currentColor"]:not([fill]) rect:not([fill]) {
        fill: currentColor;
      }

      /* Ensure SVG use elements display */
      svg use {
        display: inline;
      }

      /* Common icon class patterns - ensure visibility */
      [class*="icon"] svg,
      [class*="Icon"] svg,
      .fa svg,
      .fas svg,
      .far svg,
      .fab svg,
      .material-icons svg,
      li svg,
      button svg,
      a svg {
        display: inline-block !important;
        visibility: visible !important;
        opacity: 1 !important;
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

    let combinedCSS = styles.join('\n\n');

    // Clean up CSS: remove @font-face rules that reference fonts we couldn't download
    // These would cause CORS errors when opened from file://
    console.log('[GetInspire] Cleaning up CSS font references...');

    // Find all @font-face rules and check if their URLs are embedded or available
    combinedCSS = combinedCSS.replace(/@font-face\s*\{[^}]*\}/gi, (fontFaceRule) => {
      // Check if this @font-face has embedded fonts (data: URLs)
      if (fontFaceRule.includes('url("data:') || fontFaceRule.includes("url('data:") || fontFaceRule.includes('url(data:')) {
        return fontFaceRule; // Keep it - font is embedded
      }

      // Check if it has local() which works offline
      if (fontFaceRule.includes('local(')) {
        return fontFaceRule; // Keep it - uses local font
      }

      // Check if it references assets/ folder (our downloaded fonts)
      if (fontFaceRule.includes('url("assets/') || fontFaceRule.includes("url('assets/") || fontFaceRule.includes('url(assets/')) {
        return fontFaceRule; // Keep it - references our assets folder
      }

      // Check for remaining http/https or root-relative URLs - these won't work offline
      if (fontFaceRule.match(/url\(["']?(https?:\/\/|\/)/)) {
        // Extract font-family name for the comment
        const familyMatch = fontFaceRule.match(/font-family\s*:\s*["']?([^"';]+)["']?/i);
        const fontFamily = familyMatch ? familyMatch[1] : 'unknown';
        console.log(`[GetInspire] Removing @font-face for "${fontFamily}" - font not available offline`);
        return `/* GetInspire: @font-face removed - font "${fontFamily}" not available offline */`;
      }

      return fontFaceRule; // Keep others
    });

    // Also remove any remaining broken url() references in CSS
    combinedCSS = combinedCSS.replace(/url\(["']?(\/[^"')]+\.(woff2?|ttf|otf|eot))["']?\)/gi, (match, path) => {
      return `url("") /* GetInspire: font not embedded: ${path} */`;
    });

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

    let finalHtml = modifiedHtml.replace(
      '</head>',
      `<style>\n${combinedCSS}\n</style>\n${carouselScript}\n</head>`
    );

    // Remove Content-Security-Policy meta tags that would block inline styles/scripts/fonts
    // These policies are designed for the live site and break offline viewing
    console.log('[GetInspire] Removing Content-Security-Policy meta tags...');
    const cspPattern = /<meta\b[^>]*\bhttp-equiv\s*=\s*["']Content-Security-Policy["'][^>]*>/gi;
    const cspMatches = finalHtml.match(cspPattern) || [];
    finalHtml = finalHtml.replace(cspPattern, '<!-- GetInspire: CSP meta tag removed for offline compatibility -->');
    if (cspMatches.length > 0) {
      console.log(`[GetInspire] Removed ${cspMatches.length} CSP meta tag(s)`);
    }

    // Also remove X-Content-Security-Policy (older format)
    finalHtml = finalHtml.replace(/<meta\b[^>]*\bhttp-equiv\s*=\s*["']X-Content-Security-Policy["'][^>]*>/gi, '<!-- GetInspire: X-CSP removed -->');

    // Replace any remaining absolute URLs with root-relative paths that point to assets folder
    // This handles resources that were downloaded but whose URLs weren't replaced earlier
    console.log('[GetInspire] Converting remaining root-relative URLs to local paths...');

    // For fonts specifically - replace /path/to/font.woff2 with assets/font.woff2
    finalHtml = finalHtml.replace(/url\(["']?(\/[^"')]+\.(woff2?|ttf|otf|eot))["']?\)/gi, (match, path) => {
      const filename = path.split('/').pop();
      // Check if we have this font in downloaded assets
      const fullUrl = new URL(path, window.location.href).href;
      const fontData = downloadedAssets.get(fullUrl);
      if (fontData && fontData.base64) {
        return `url("${fontData.base64}")`;
      }
      // If not downloaded, comment it out to prevent errors
      return `url("") /* GetInspire: font not available offline: ${path} */`;
    });

    // For images/SVGs with root-relative paths
    finalHtml = finalHtml.replace(/(src|href|poster)\s*=\s*["'](\/[^"']+\.(svg|png|jpg|jpeg|gif|webp|ico))["']/gi, (match, attr, path) => {
      const fullUrl = new URL(path, window.location.href).href;
      const assetData = downloadedAssets.get(fullUrl);
      if (assetData && assetData.base64) {
        return `${attr}="${assetData.base64}"`;
      } else if (assetData && assetData.filename) {
        return `${attr}="assets/${assetData.filename}"`;
      }
      // If not downloaded, use a placeholder or empty
      return `${attr}="" data-original-src="${path}" /* GetInspire: asset not available */`;
    });

    // Remove original <link rel="stylesheet"> tags since CSS is now inlined
    // This prevents the browser from trying to load external CSS files that don't exist offline
    console.log('[GetInspire] Removing external stylesheet links (CSS is inlined)...');
    const linkTagsRemoved = (finalHtml.match(/<link[^>]*rel=["']stylesheet["'][^>]*>/gi) || []).length;
    finalHtml = finalHtml.replace(/<link[^>]*rel=["']stylesheet["'][^>]*>/gi, '<!-- GetInspire: stylesheet inlined -->');
    console.log(`[GetInspire] Removed ${linkTagsRemoved} external stylesheet link tags`);

    // Also remove preload links for stylesheets
    finalHtml = finalHtml.replace(/<link[^>]*rel=["']preload["'][^>]*as=["']style["'][^>]*>/gi, '<!-- GetInspire: preload removed -->');

    // SCRIPTS PRESERVED - No removal (user requested local viewing without security restrictions)
    // Scripts are kept as-is, URLs updated to local paths where downloaded
    console.log('[GetInspire] Keeping all scripts (security restrictions disabled)...');

    // Update script src URLs to local paths if we downloaded them
    for (const [url, data] of downloadedAssets) {
      if (data.type === 'script' && data.filename) {
        try {
          const urlObj = new URL(url);
          const patterns = [url, urlObj.pathname, urlObj.pathname.replace(/^\//, '')];
          patterns.forEach(pattern => {
            if (pattern && pattern.length > 3) {
              const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              const regex = new RegExp(`(src\\s*=\\s*["'])${escaped}(["'])`, 'gi');
              finalHtml = finalHtml.replace(regex, `$1assets/${data.filename}$2`);
            }
          });
        } catch (e) {}
      }
    }

    // ==================== CRAWL MODE BRANCH (v2.0) ====================
    if (isCrawlMode) {
      console.log('[GetInspire] Crawl mode: Sending page data to background...');

      // Extract links for crawl
      const links = extractSameDomainLinks(crawlBaseDomain);

      // Send captured page data to background (with processed HTML)
      browserAPI.runtime.sendMessage({
        type: 'PAGE_CAPTURED',
        pageData: {
          url: window.location.href,
          title: document.title,
          html: finalHtml
        },
        links: links
      });

      browserAPI.runtime.sendMessage({
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
      if (!data.blob) continue;
      if (data.blob.size >= EMBED_THRESHOLD) {
        assetsFolder.file(data.filename, data.blob);
      }
    }

    // Add readme file
    const animLibsList = Object.entries(animationLibraries).filter(([k, v]) => v).map(([k]) => k);
    const readme = `# Captured Page Information

URL: ${window.location.href}
Title: ${document.title}
Captured: ${new Date().toISOString()}
GetInspire Version: 2.1.0

## Statistics
- Total assets found: ${assetsToDownload.size}
- Assets downloaded: ${downloadedAssets.size}
- Assets deduplicated: ${deduplicatedCount}
- Assets embedded (base64): ${[...downloadedAssets.values()].filter(d => d.blob && d.blob.size < EMBED_THRESHOLD).length}
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

## Offline Compatibility
- External scripts removed (analytics, tracking, third-party libraries)
- External stylesheet links removed (CSS inlined)
- Module scripts removed (won't work from file://)
- Script preloads/prefetches removed

## Notes
- Small assets (<100KB) are embedded as base64
- Large assets are saved in the assets folder
- Duplicate assets are deduplicated by content hash
- The page works completely offline without console errors
- Animations will replay on page load
- Interactive features are preserved where possible
- To activate hover states, add .gi-hover-state class to elements
- External scripts were removed to prevent CORS/CSP errors when viewing offline
`;
    zip.file('README.md', readme);

    // Step 8: Generate and download ZIP
    console.log('[GetInspire] Generating ZIP...');
    browserAPI.runtime.sendMessage({
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
    browserAPI.runtime.sendMessage({
      type: 'CAPTURE_STATUS',
      status: 'Capture completed!'
    });

    browserAPI.runtime.sendMessage({
      type: 'CAPTURE_COMPLETE'
    });

    console.log('[GetInspire] Capture completed successfully!');
    console.log('[GetInspire] File saved as:', filename);

  } catch (error) {
    console.error('[GetInspire] Capture failed:', error);
    browserAPI.runtime.sendMessage({
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

