// Enhanced content script for GetInspire with asset downloading and carousel support
(async function() {
  console.log('[GetInspire] Content script starting...');

  // Check if already running
  if (window.__GETINSPIRE_RUNNING__) {
    console.log('[GetInspire] Already running, exiting');
    return;
  }
  window.__GETINSPIRE_RUNNING__ = true;

  // Check if JSZip is available
  if (!window.JSZip) {
    console.error('[GetInspire] JSZip not loaded!');
    alert('Failed to load required libraries. Please try again.');
    window.__GETINSPIRE_RUNNING__ = false;
    return;
  }

  try {
    // Send status to popup
    chrome.runtime.sendMessage({
      type: 'CAPTURE_STATUS',
      status: 'Starting capture...'
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
      document.querySelectorAll('img, source').forEach(el => {
        convertAttrs(el, pairs);
        if (el.tagName === 'IMG') { try { el.loading = 'eager'; el.decoding = 'sync'; } catch {} }
      });
      if (includeVideo) {
        document.querySelectorAll('video, audio, source').forEach(el => convertAttrs(el, pairs));
        document.querySelectorAll('video').forEach(v => { try { v.preload = 'metadata'; } catch {} });
      }
      // Wait briefly for image decodes
      const pending = Array.from(document.images).filter(im => im.src && !im.complete).slice(0, 200);
      await Promise.race([
        Promise.allSettled(pending.map(im => im.decode ? im.decode().catch(()=>{}) : new Promise(r=>{ im.addEventListener('load',r,{once:true}); im.addEventListener('error',r,{once:true}); setTimeout(r,1500);}))),
        new Promise(r => setTimeout(r, 2500))
      ]);
      // Loosen obvious carousels so slides aren't cropped, but preserve transforms
      // to maintain carousel positioning and animations.
      const isYouTubeDomain = /(^|\.)youtube\.com$/i.test(location.hostname||'');
      const carSel = '[class*="carousel"], [class*="slider"], [class*="slick"], [class*="swiper"], [data-carousel]';
      document.querySelectorAll(carSel).forEach(c => {
        try {
          const cs = getComputedStyle(c);
          // Only expand overflow if carousel is a direct wrapper with hidden overflow
          // Check if it's likely a carousel container (has multiple children)
          const childCount = c.children.length;
          if (childCount > 1 && (cs.overflowX === 'hidden' || /hidden|clip/.test(cs.overflow))) {
            // Instead of making overflow visible (breaks layout), try overflow-x auto
            c.style.overflowX = 'auto';
            c.style.scrollBehavior = 'smooth';
          }
          // Preserve transforms entirely - they're essential for carousel positioning
          // Removing transforms breaks translateX-based slide positioning
        } catch {}
      });
      // Global transform stripping removed (caused giant icons on some sites).
    } catch (e) { console.error(e); }
  }

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

    // Helper function to download a resource as blob
    async function downloadAsBlob(url) {
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.blob();
      } catch (error) {
        console.warn(`[GetInspire] Failed to download ${url}:`, error);
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
        const filename = pathname.split('/').pop() || 'unnamed';
        // Add extension if missing
        if (!filename.includes('.')) {
          return filename + '.jpg';
        }
        return filename;
      } catch {
        return 'unnamed.jpg';
      }
    }

    // Step 1: Expand carousels before capturing
    await expandCarousels();

    // Wait a bit for any lazy-loaded images to appear
    await new Promise(resolve => setTimeout(resolve, 2000));

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

    console.log(`[GetInspire] Found ${assetsToDownload.size} assets to download`);

    // Step 3: Download all assets
    chrome.runtime.sendMessage({
      type: 'CAPTURE_STATUS',
      status: `Downloading ${assetsToDownload.size} assets...`
    });

    let downloadCount = 0;
    for (const [url, info] of assetsToDownload) {
      downloadCount++;
      console.log(`[GetInspire] Downloading asset ${downloadCount}/${assetsToDownload.size}: ${url}`);

      const blob = await downloadAsBlob(url);
      if (blob) {
        const base64 = await blobToBase64(blob);
        const filename = getFilenameFromUrl(url);
        downloadedAssets.set(url, {blob, base64, filename});
      }
    }

    console.log(`[GetInspire] Downloaded ${downloadedAssets.size} assets successfully`);

    // Step 4: Clone document and replace asset URLs
    console.log('[GetInspire] Creating modified HTML...');
    const htmlContent = document.documentElement.outerHTML;

    // Replace image URLs with base64 or local paths
    let modifiedHtml = htmlContent;
    const assetMapping = {};

    for (const [url, data] of downloadedAssets) {
      // For small images (< 100KB), embed as base64
      if (data.blob.size < 100000) {
        modifiedHtml = modifiedHtml.replace(
          new RegExp(url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
          data.base64
        );
        assetMapping[url] = 'embedded';
      } else {
        // For larger images, save separately and update path
        const localPath = `assets/${data.filename}`;
        modifiedHtml = modifiedHtml.replace(
          new RegExp(url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
          localPath
        );
        assetMapping[url] = localPath;
      }
    }

    // Step 5: Get stylesheets and scripts
    console.log('[GetInspire] Capturing stylesheets...');
    const styles = [];
    const scripts = [];

    // Get all link stylesheets
    const linkStyles = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
    for (const link of linkStyles) {
      try {
        const response = await fetch(link.href);
        let cssText = await response.text();

        // Replace URLs in CSS with downloaded assets
        for (const [url, data] of downloadedAssets) {
          if (data.blob.size < 100000) {
            cssText = cssText.replace(
              new RegExp(url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
              data.base64
            );
          } else {
            cssText = cssText.replace(
              new RegExp(url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
              `assets/${data.filename}`
            );
          }
        }

        styles.push(`/* From: ${link.href} */\n${cssText}`);
      } catch (e) {
        console.warn('[GetInspire] Could not fetch stylesheet:', link.href);
      }
    }

    // Get all style elements
    const styleElements = Array.from(document.querySelectorAll('style'));
    for (const style of styleElements) {
      let cssText = style.textContent;

      // Replace URLs in inline CSS
      for (const [url, data] of downloadedAssets) {
        if (data.blob.size < 100000) {
          cssText = cssText.replace(
            new RegExp(url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
            data.base64
          );
        } else {
          cssText = cssText.replace(
            new RegExp(url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
            `assets/${data.filename}`
          );
        }
      }

      styles.push(cssText);
    }

    // Add carousel visibility CSS
    const carouselCSS = `
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
    `;
    styles.push(carouselCSS);

    const combinedCSS = styles.join('\n\n');

    // Step 6: Create final HTML with inline carousel script
    const carouselScript = `
      <script>
        // Basic carousel functionality preservation
        document.addEventListener('DOMContentLoaded', function() {
          console.log('[GetInspire] Initializing captured carousel display');

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
        });
      </script>
    `;

    const finalHtml = modifiedHtml.replace(
      '</head>',
      `<style>\n${combinedCSS}\n</style>\n${carouselScript}\n</head>`
    );

    // Step 7: Create ZIP file
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
    const readme = `# Captured Page Information

URL: ${window.location.href}
Title: ${document.title}
Captured: ${new Date().toISOString()}

## Statistics
- Total assets found: ${assetsToDownload.size}
- Assets downloaded: ${downloadedAssets.size}
- Assets embedded (base64): ${[...downloadedAssets.values()].filter(d => d.blob.size < 100000).length}
- Assets saved separately: ${[...downloadedAssets.values()].filter(d => d.blob.size >= 100000).length}

## Carousel Support
- All carousel slides have been expanded and made visible
- Slides are displayed vertically for complete capture
- Navigation controls have been hidden

## Notes
- Small images (<100KB) are embedded as base64
- Large images are saved in the assets folder
- The page should work completely offline
- Carousel slides are all visible (not interactive)
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

    // Send success message
    chrome.runtime.sendMessage({
      type: 'CAPTURE_STATUS',
      status: 'Capture completed!'
    });

    console.log('[GetInspire] Capture completed successfully!');
    console.log('[GetInspire] File saved as:', filename);

  } catch (error) {
    console.error('[GetInspire] Capture failed:', error);
    chrome.runtime.sendMessage({
      type: 'CAPTURE_ERROR',
      error: error.message
    });
    alert('Capture failed: ' + error.message);
  } finally {
    // Clean up
    window.__GETINSPIRE_RUNNING__ = false;
  }
})();