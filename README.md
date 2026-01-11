# GetInspire v2.1 - Cross-Browser Extension (MV3)

**The most comprehensive web page capture tool.** Snapshot any page with pixel-perfect accuracy or crawl entire sites into offline-ready ZIP files. Captures everything: images, fonts, SVGs, videos, CSS, animations, and more.

**Works on:** Chrome, Firefox, Edge, Safari, Opera, and Brave.

## What's New in v2.1

### Cross-Browser Support
- **Chrome, Edge, Opera, Brave**: Full support via Chromium APIs
- **Firefox**: Native browser.* API support with MV3
- **Safari**: WebExtension support (macOS 12+, iOS 15.4+)
- **Unified codebase**: Single extension works across all browsers

### Smart Asset Filtering
- **Skips tracking scripts**: Google Analytics, GTM, Facebook Pixel, Hotjar, etc.
- **Skips analytics**: Mixpanel, Segment, Amplitude, FullStory, etc.
- **Skips third-party widgets**: Intercom, Drift, Zendesk, Crisp, etc.
- **40+ patterns**: Automatically filters scripts that would fail offline
- **Faster captures**: No wasted time on assets that will be blocked

### Improved Reliability
- **10s timeout per asset** (was 30s) - prevents hanging on blocked resources
- **15s hard limit** - ensures no single asset blocks the entire capture
- **Early abort**: Stops retrying when resources are blocked by ad blockers
- **Progress tracking**: Shows skipped assets count during download

### Pixel-Perfect Capture
- **Comprehensive asset discovery**: srcset, picture elements, Open Graph images, Twitter cards
- **All CSS properties**: mask-image, clip-path, cursor, filter, border-image, shape-outside
- **Pseudo-element capture**: ::before and ::after content URLs
- **Data attribute scanning**: Automatically finds images in data-src, data-bg, data-image, etc.

### Enhanced Limits (10x increase)
- **50,000 max assets** (was 2,000)
- **25 concurrent downloads** (was 15)
- **500KB embed threshold** (was 100KB) - more assets embedded inline
- **2GB max ZIP size** (was 1GB)

### Smarter Downloads
- **2 optimized fetch strategies** (was 4) - faster failure detection
- **Background fallback**: Uses extension context for CORS-blocked resources
- **Cache-first fetching**: Uses browser cache when available
- **Better error recovery**: Continues even when some assets fail

### Media & Fonts
- **Video tracks**: Captures subtitles and caption files
- **Audio elements**: Full audio file capture
- **All font variants**: Every weight, style, and format
- **Icon fonts**: FontAwesome, Material Icons fully captured

## What's New in v2.0

### Multi-Page Site Crawling
- **Crawl entire websites** with the new "Crawl site" mode
- Same-domain only crawling prevents unbounded crawls
- Configurable max pages limit (default: 10, up to 500)
- Single ZIP output with all pages and deduplicated assets
- Real-time progress tracking in popup

### Enhanced Animation Capture
- **CSS Hover States**: `:hover`, `:focus`, `:active` rules extracted and preserved
- **JS Animation Libraries**: Detection for GSAP, Anime.js, Framer Motion, Lottie, ScrollMagic
- **Scroll-Triggered Animations**: Programmatic scrolling to capture all animation states
- **Multi-Frame Canvas**: Captures 5 frames from animated canvas elements
- **Video Poster Extraction**: Automatic poster image capture for video elements

### CSS-in-JS Support
- Extracts styles from styled-components, Emotion, Linaria, JSS
- Preserves dynamic styles that would otherwise be lost

### Performance Improvements
- **25 concurrent downloads** for fast asset fetching
- **SHA-256 deduplication** prevents redundant asset downloads
- **URL normalization** strips tracking params (utm_*, fbclid, gclid)
- **50,000 max assets** for larger sites

## Install

### Chrome / Edge / Opera / Brave
1. Download or clone this repository
2. Open `chrome://extensions` (or equivalent), enable Developer mode
3. Click "Load unpacked" and select the `GetInspire/` folder
4. Pin GetInspire in the toolbar

### Firefox
1. Open `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on"
3. Select the `manifest.json` file from the `GetInspire/` folder

### Safari (macOS)
1. Enable "Allow unsigned extensions" in Safari's Develop menu
2. Open Safari > Settings > Extensions
3. Enable GetInspire

## Use

### Single Page Capture
- Open a normal, finite page (blog, docs, landing page)
- Click the GetInspire icon and select **"Single Page"**
- Click **Start capture** and save the ZIP
- Unzip and open `index.html` - works completely offline with no console errors

### Multi-Page Site Crawl
- Open any page on the site you want to capture
- Click the GetInspire icon and select **"Crawl Site"**
- Set the max pages limit (default: 10)
- Click **Start capture** to begin crawling
- Progress shows "X/Y pages" as the crawl proceeds
- Final ZIP contains all captured pages with shared assets

### Crawl Features
- **Scope**: Same domain only - external links are skipped
- **Progress**: Real-time page count and progress bar
- **Stop anytime**: Click Stop to end the crawl early
- **Memory warnings**: Alerts at 80% memory usage
- **Continues in background**: Crawl continues even if you close the popup

## What's Included

### Single Page Capture
- `index.html`: DOM snapshot with local asset paths and preserved animations
- `assets/`: downloaded CSS/JS/images/fonts/media/videos
- `report/README.md` and `report/fetch-report.json`: human + machine summary
- `quick-check.html`: loads `index.html` in an iframe and summarizes the report
- `report/asset-manifest.json`: original URL + local path, bytes, mime, sha256

### Multi-Page Crawl
```
site-capture.zip
├── index.html        (first/home page)
├── page-1.html       (subsequent pages)
├── page-2.html
├── ...
├── assets/           (deduplicated across all pages)
│   ├── image-abc123.jpg
│   ├── font-def456.woff2
│   └── ...
└── report/
    └── README.md
```

## Offline Compatibility

GetInspire creates truly offline-ready captures with zero console errors:

### Automatic Filtering (v2.1)
The following script types are automatically skipped during capture:
- **Analytics**: Google Analytics, GTM, Mixpanel, Segment, Amplitude
- **Tracking**: Facebook Pixel, Hotjar, FullStory, Mouseflow, Crazy Egg
- **Widgets**: Intercom, Drift, Zendesk, Crisp, Tawk.to, LiveChat
- **Auth**: Google Sign-In, Facebook Login, reCAPTCHA
- **Error tracking**: Sentry, Bugsnag, Rollbar, LogRocket
- **A/B testing**: Optimizely, VWO

### Asset Handling
- **CSS Inlined**: All stylesheets embedded directly in HTML
- **Fonts Embedded**: Web fonts converted to base64 (up to 500KB each)
- **Images Embedded**: Assets under 500KB embedded as base64 data URIs
- **Large Assets**: Saved to `assets/` folder with correct references
- **srcset Preserved**: All responsive image variants captured

### Comprehensive Asset Types
| Asset Type | Captured |
|------------|----------|
| Images (jpg, png, gif, webp, avif) | Yes |
| SVG (inline, external, sprites) | Yes |
| Fonts (woff, woff2, ttf, otf, eot) | Yes |
| Videos (mp4, webm) + posters | Yes |
| Audio (mp3, wav, ogg) | Yes |
| CSS (external, inline, computed) | Yes |
| Favicons (all sizes) | Yes |
| Open Graph / Twitter images | Yes |
| Background images | Yes |
| Mask images / clip-paths | Yes |
| Cursor images | Yes |
| Subtitles / captions (vtt, srt) | Yes |

### Why This Matters
When you open a captured page from `file://`, browsers enforce strict security:
- CORS blocks loading external scripts/fonts
- CSP policies block inline styles
- Relative paths resolve incorrectly

GetInspire handles all of this automatically so your captured pages just work.

## Animation & Modern CSS Support
- **CSS Keyframe Animations**: All `@keyframes` rules are extracted and preserved
- **CSS @property**: Modern CSS custom properties with animation support captured
- **Hover/Focus/Active States**: Pseudo-class rules captured as `.gi-hover-*` classes
- **Computed Animation States**: Animation properties (duration, timing, delay) preserved
- **Backdrop Blur & Effects**: Modern CSS filter effects like backdrop-filter maintained
- **Tailwind Animations**: Dynamic animation classes from Tailwind CSS preserved
- **Transform & Transition**: All transform and transition properties captured
- **SVG Animations**: Inline SVG animations preserved
- **Canvas Elements**: Animated canvas elements capture multiple frames
- **Video Support**: Video elements included with poster images and controls

### Animation Library Detection
GetInspire detects and notes the presence of:
- **GSAP / TweenMax / TweenLite**: Animation library states captured
- **Anime.js**: Animation states preserved
- **Framer Motion**: React animation data captured
- **Lottie / Bodymovin**: Animation player detection
- **ScrollMagic / ScrollTrigger**: Scroll animation states
- **AOS (Animate On Scroll)**: Intersection-based animations

## Carousel Support
- Automatically detects and expands all carousel slides
- Supported libraries: Slick, Swiper, Bootstrap Carousel, Splide, Keen Slider, Owl Carousel, Flickity, Glide
- All slides displayed vertically in the captured page
- Navigation controls automatically hidden since all content is visible

## Endless Pages & Limits
- Heuristic auto-scrolls until bottom is stable
- Caps: runtime, max assets, ZIP size, and concurrency (configurable in Options)
- Optional denylist in settings to block specific URL patterns

## Settings
- Options page lets you adjust caps, redact behavior, denylist, and whether to save without prompt
- **Theme**: Light, Dark, or Auto (system)
- **Strip Scripts**: Optionally remove scripts and inline handlers for offline safety
- **Redaction**: Off by default. Enable "Redact authenticated text" to replace sensitive text in saved HTML
- **Crawl settings**: Max pages, delay between captures, memory warnings
- **Animation settings**: Hover states, scroll animations, canvas frames

## Permissions
- The extension requests `tabs` permission for crawl navigation
- `host_permissions: <all_urls>` enables cross-origin asset fetching
- Core actions (injecting on the active tab, downloads, storage) work with standard permissions

## Browser Compatibility

| Browser | Version | Status |
|---------|---------|--------|
| Chrome | 88+ | Full support |
| Edge | 88+ | Full support |
| Firefox | 109+ | Full support |
| Safari | 15.4+ | Full support |
| Opera | 74+ | Full support |
| Brave | Latest | Full support |

## Notes
- Third-party iframes stay external by design and may not work offline
- Tracking/analytics scripts are automatically skipped (won't cause errors)
- The popup shows live progress during capture
- For crawls, progress shows "X/Y pages" with real-time updates
- In-page overlay shows status with a Stop button during capture

## Changelog

### v2.1.0
- **Cross-browser support** - Works on Chrome, Firefox, Edge, Safari, Opera, Brave
- **Smart filtering** - Automatically skips 40+ tracking/analytics script patterns
- **Faster timeouts** - 10s per asset (was 30s), 15s hard limit prevents hanging
- **Pixel-perfect capture** - Comprehensive asset discovery with srcset, picture, OG images
- **Higher limits** - 50k assets, 25 concurrent downloads
- **Optimized fetch** - 2 strategies instead of 4, faster failure detection
- **500KB embed threshold** - More assets embedded inline (was 100KB)
- **Removed MHTML mode** - ZIP-only for better offline compatibility
- Simplified UI with "Single Page" and "Crawl Site" modes

### v2.0.0
- Added multi-page site crawling with same-domain scope
- Added CSS hover/focus/active state capture
- Added JS animation library detection (GSAP, Anime.js, Framer Motion, Lottie)
- Added scroll-triggered animation capture
- Added multi-frame canvas capture
- Added CSS-in-JS extraction (styled-components, Emotion, Linaria, JSS)
- Added SHA-256 asset deduplication
- Added video poster extraction
- Increased concurrency to 15 (was 6)
- Increased max assets to 2000 (was 500)
- Added URL normalization (strips tracking params)
- Added memory usage warnings
- New popup UI with mode selector

### v1.x
- Single page capture
- Basic animation support
- Carousel expansion
- Asset downloading with concurrency
