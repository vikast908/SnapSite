export const defaults = {
  // ==================== CORE LIMITS (v2.1 Increased) ====================
  maxMillis: 120_000,           // 2 minutes max capture time (was 20s)
  maxAssets: 50_000,            // 50k assets max (was 5k)
  maxZipMB: 2000,               // 2GB max ZIP size (was 1GB)
  concurrency: 25,              // 25 parallel downloads (was 15)
  requestTimeoutMs: 30_000,     // 30s timeout per request (was 15s)
  scrollIdleMs: 1_000,          // 1s scroll idle detection (was 1.5s)
  maxScrollIterations: 50,      // More scroll iterations (was 30)

  // ==================== CAPTURE OPTIONS ====================
  redact: false,                // Don't redact text by default
  saveWithoutPrompt: false,     // Show save dialog
  skipVideo: false,             // Include videos
  replaceIframesWithPoster: false, // Keep iframes when possible
  stripScripts: false,          // Keep all scripts (local viewing)
  fontFallback: false,          // Don't use fallback fonts - capture exact fonts
  showOverlay: false,           // Don't show overlay during capture
  expandCarousels: true,        // Expand all carousel slides
  normalizeUX: true,            // Normalize interactive elements

  // ==================== CRAWLING (v2.0) ====================
  enableCrawl: true,
  defaultMaxPages: 50,          // 50 pages default (was 10)
  crawlDelay: 300,              // 300ms between captures (was 500ms)
  memoryWarningPct: 90,         // Warn at 90% memory (was 80%)

  // ==================== ANIMATION CAPTURE (v2.0) ====================
  captureHoverStates: true,
  captureScrollAnimations: true,
  captureCanvasFrames: true,
  canvasFrameCount: 10,         // 10 frames per canvas (was 5)
  detectAnimationLibraries: true,

  // ==================== IMAGE HANDLING (v2.1 Enhanced) ====================
  optimizeImages: false,        // Don't optimize - keep original quality
  maxImageDimension: 8192,      // 8K max dimension (was 2000)
  imageQuality: 1.0,            // 100% quality (was 85%)
  captureSrcset: true,          // Capture all srcset variants
  captureWebP: true,            // Capture WebP images
  captureAVIF: true,            // Capture AVIF images
  captureRetina: true,          // Capture @2x/@3x images

  // ==================== CSS CAPTURE (v2.1 Enhanced) ====================
  extractCSSInJS: true,
  captureComputedStyles: true,  // Capture all computed styles
  capturePseudoElements: true,  // Capture ::before/::after
  captureCSSVariables: true,    // Capture CSS custom properties
  captureCSSMasks: true,        // Capture mask-image, clip-path
  captureFilters: true,         // Capture CSS filters

  // ==================== FONT CAPTURE (v2.1 Enhanced) ====================
  captureFonts: true,           // Download all fonts
  embedFontsAsBase64: true,     // Embed fonts inline
  captureIconFonts: true,       // FontAwesome, Material Icons, etc.
  captureFontVariants: true,    // All weights/styles
  maxFontSizeMB: 50,            // Max 50MB per font file

  // ==================== MEDIA CAPTURE (v2.1 Enhanced) ====================
  captureAudio: true,           // Capture audio files
  captureVideoPosters: true,    // Capture video poster frames
  captureSubtitles: true,       // Capture track/subtitle files
  maxVideoSizeMB: 500,          // Max 500MB per video
  maxAudioSizeMB: 100,          // Max 100MB per audio

  // ==================== SVG & ICONS (v2.1 Enhanced) ====================
  captureSVGSprites: true,      // Capture external SVG sprites
  inlineSVGs: true,             // Inline external SVGs
  captureFavicons: true,        // All favicon sizes
  captureOGImages: true,        // Open Graph images
  captureTwitterCards: true,    // Twitter card images

  // ==================== ASSET HANDLING (v2.1) ====================
  deduplicateAssets: true,
  embedSmallAssets: true,       // Embed assets < threshold as base64
  embedThresholdKB: 500,        // Embed if < 500KB (was 100KB)
  retryFailedAssets: true,      // Retry failed downloads
  maxRetries: 3,                // 3 retry attempts
  retryDelayMs: 1000,           // 1s between retries

  // ==================== ADVANCED OPTIONS ====================
  captureDataAttributes: true,  // Capture data-* image sources
  captureInlineStyles: true,    // Capture inline style URLs
  preserveARIA: true,           // Preserve ARIA attributes
  preserveDataAttrs: true,      // Preserve all data-* attributes
  preserveCustomElements: true, // Preserve web component structure

  denylist: [],
};
