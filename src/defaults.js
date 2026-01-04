export const defaults = {
  maxMillis: 20_000,
  maxAssets: 5000,
  maxZipMB: 1000,
  concurrency: 15,  // Increased for better performance
  requestTimeoutMs: 15_000,  // Increased timeout
  scrollIdleMs: 1_500,
  maxScrollIterations: 30,
  // Redaction replaces matched text with lorem-ipsum in the saved HTML.
  // Default to false to avoid surprising users with "text junk" captures.
  redact: false,
  saveWithoutPrompt: false,
  skipVideo: false,
  replaceIframesWithPoster: true,
  stripScripts: true,
  fontFallback: true,
  showOverlay: false,
  expandCarousels: true,  // Expand all carousel slides for capture
  normalizeUX: true,  // Normalize all interactive UX patterns

  // Crawling options (v2.0)
  enableCrawl: true,
  defaultMaxPages: 10,
  crawlDelay: 500,  // ms between page captures
  memoryWarningPct: 80,  // Warn at 80% memory usage

  // Animation capture options (v2.0)
  captureHoverStates: true,
  captureScrollAnimations: true,
  captureCanvasFrames: true,
  canvasFrameCount: 5,
  detectAnimationLibraries: true,  // GSAP, Anime.js, etc.

  // Image optimization (v2.0)
  optimizeImages: false,
  maxImageDimension: 2000,
  imageQuality: 0.85,

  // CSS-in-JS extraction (v2.0)
  extractCSSInJS: true,

  // Asset deduplication (v2.0)
  deduplicateAssets: true,

  denylist: [
    String(/https?:\/\/(www\.)?google\.[^\/]+\/search/i),
    String(/https?:\/\/([^\/]+\.)?(x\.com|twitter\.com)\//i),
    String(/https?:\/\/([^\/]+\.)?(facebook\.com|instagram\.com|tiktok\.com)\//i),
    String(/https?:\/\/([^\/]+\.)?(reddit\.com)\//i),
    String(/https?:\/\/([^\/]+\.)?linkedin\.com\/feed/i),
    String(/https?:\/\/([^\/]+\.)?pinterest\.[^\/]+\//i),
    String(/https?:\/\/([^\/]+\.)?medium\.com\/$/i),
    String(/https?:\/\/news\.google\.com\//i),
    String(/https?:\/\/([^\/]+\.)?quora\.com\//i),
    // Allow YouTube Playlists feed (finite), block other /feed pages
    String(/https?:\/\/([^\/]+\.)?youtube\.com\/feed\/(?!playlists)/i),
    String(/https?:\/\/([^\/]+\.)?tumblr\.com\/dashboard/i),
  ],
};
