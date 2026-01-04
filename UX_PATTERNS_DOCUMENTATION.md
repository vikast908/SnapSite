# GetInspire v2.0 - Comprehensive UX Pattern Support

## Overview
GetInspire handles **20+ categories** of interactive UX patterns, ensuring that captured pages preserve all content and functionality in a static format. Version 2.0 adds enhanced animation capture and CSS-in-JS support for modern web applications.

## New in v2.0

### Enhanced Animation Capture
- **CSS Hover/Focus/Active States**: Extracted and preserved as `.gi-hover-*` classes
- **JS Animation Libraries**: Detection for GSAP, Anime.js, Framer Motion, Lottie
- **Scroll-Triggered Animations**: Programmatic scrolling captures all states
- **Multi-Frame Canvas**: Captures 5 frames from animated canvas elements

### CSS-in-JS Support
- **styled-components**: Extracts `<style data-styled>` tags
- **Emotion**: Extracts `<style data-emotion>` tags
- **Linaria**: Extracts `<style data-linaria>` tags
- **JSS**: Extracts `<style data-jss>` tags

### Multi-Page Crawling
- All UX patterns handled across multi-page crawls
- Consistent normalization across all captured pages
- Shared assets deduplicated in final ZIP

---

## Supported UX Patterns

### 1. **Accordions & Collapsibles**
- **What it handles**: FAQ sections, collapsible panels, expandable content
- **How it works**: Expands all collapsed sections, makes hidden content visible
- **Frameworks**: Bootstrap, Material UI, Ant Design, custom implementations
- **Result**: All accordion content displayed expanded with visual separators

### 2. **Tabs & Tab Panels**
- **What it handles**: Tabbed interfaces, multi-section content
- **How it works**: Shows all tab panels simultaneously, stacked vertically
- **Frameworks**: Bootstrap Tabs, Material Tabs, React Tabs, jQuery UI
- **Result**: All tab content visible with clear section indicators

### 3. **Modals, Dialogs & Popups**
- **What it handles**: Modal windows, dialog boxes, popups, overlays
- **How it works**: Displays modals inline with content, removes overlays
- **Frameworks**: Bootstrap Modal, Material Dialog, SweetAlert2
- **Result**: Modal content shown as bordered sections within page flow

### 4. **Dropdown Menus & Navigation**
- **What it handles**: Dropdown menus, mega menus, select boxes, autocomplete
- **How it works**: Expands all dropdowns, shows all menu options
- **Frameworks**: Select2, Chosen, Bootstrap Dropdown, custom selects
- **Result**: All menu items and options visible and accessible

### 5. **Carousels & Sliders**
- **What it handles**: Image carousels, content sliders, testimonials
- **How it works**: Shows all slides stacked vertically or in a grid
- **Frameworks**: Swiper, Slick, Bootstrap Carousel, Owl, Glide, Flickity
- **Result**: Every slide captured and displayed with separators

### 6. **Tooltips & Popovers**
- **What it handles**: Hover tooltips, click popovers, help text
- **How it works**: Creates visible tooltip elements next to triggers
- **Frameworks**: Bootstrap Tooltip, Tippy.js, Popper.js
- **Result**: All tooltip content displayed inline with indicators

### 7. **Image Galleries & Lightboxes**
- **What it handles**: Photo galleries, lightbox images, zoom features
- **How it works**: Loads and displays full-size images inline
- **Frameworks**: Fancybox, Magnific Popup, PhotoSwipe, Lightbox2
- **Result**: Both thumbnails and full-size images captured

### 8. **Forms & Dynamic Fields**
- **What it handles**: Multi-step forms, conditional fields, validation
- **How it works**: Shows all form steps, hidden fields, and options
- **Features**:
  - Displays hidden field values
  - Shows all conditional sections
  - Expands all form steps
  - Lists all select options
- **Result**: Complete form structure visible with annotations

### 9. **Video & Audio Players**
- **What it handles**: HTML5 video/audio, YouTube embeds, Vimeo
- **How it works**: Shows player controls, adds metadata info
- **Features**:
  - Captures video poster images (v2.0: automatic extraction)
  - Shows duration and source info
  - Preserves embed information
- **Result**: Players displayed with full controls and metadata

### 10. **Data Tables & Pagination**
- **What it handles**: Paginated tables, sortable data, DataTables
- **How it works**: Attempts to load all pages, expands collapsed rows
- **Frameworks**: DataTables, AG-Grid, React Table
- **Result**: Maximum available data displayed with pagination notes

### 11. **Sidebars & Off-Canvas Menus**
- **What it handles**: Side panels, navigation drawers, slide-out menus
- **How it works**: Opens all sidebars, displays inline with content
- **Frameworks**: Bootstrap Offcanvas, Material Drawer
- **Result**: All navigation elements visible and accessible

### 12. **Sticky & Fixed Elements**
- **What it handles**: Sticky headers, fixed navigation, parallax sections
- **How it works**: Converts to relative positioning for proper capture
- **Features**:
  - Removes fixed positioning
  - Neutralizes parallax effects
  - Maintains visual hierarchy
- **Result**: All elements captured in document flow

### 13. **Loading States & Skeletons**
- **What it handles**: Loading spinners, skeleton screens, placeholders
- **How it works**: Hides loaders, shows actual content
- **Result**: Clean capture without loading indicators

### 14. **Alerts & Notifications**
- **What it handles**: Alert boxes, toasts, snackbars, flash messages
- **How it works**: Makes all notifications visible inline
- **Frameworks**: Toastr, Noty, Bootstrap Alerts
- **Result**: All messages displayed with emphasis

### 15. **Social Media Embeds**
- **What it handles**: Twitter/X, Facebook, Instagram embeds
- **How it works**: Adds informational placeholders for embeds
- **Result**: Embed information preserved with visual indicators

### 16. **Code Blocks & Syntax Highlighting**
- **What it handles**: Code snippets, syntax highlighted blocks
- **How it works**: Ensures proper formatting and visibility
- **Frameworks**: Prism.js, Highlight.js, CodeMirror
- **Result**: Code displayed with proper formatting

### 17. **Charts & Graphs**
- **What it handles**: Interactive charts, data visualizations
- **How it works**: Captures as static images with metadata
- **Frameworks**: Chart.js, D3.js, Highcharts, ApexCharts
- **Result**: Charts preserved as static visuals

### 18. **Interactive Maps**
- **What it handles**: Google Maps, Leaflet, Mapbox
- **How it works**: Captures current view as static image
- **Result**: Map view preserved with location info

### 19. **Timelines & Progress Indicators**
- **What it handles**: Timeline components, progress bars, roadmaps
- **How it works**: Expands all timeline items, shows all states
- **Result**: Complete timeline visible with all events

### 20. **Comments & Reviews**
- **What it handles**: Comment sections, review systems, discussions
- **How it works**: Expands threads, loads more comments, shows replies
- **Frameworks**: Disqus, Facebook Comments, custom systems
- **Result**: All available comments captured

---

## v2.0 Animation Library Support

### Detected Libraries
GetInspire v2.0 automatically detects and notes:

| Library | Detection Method | State Capture |
|---------|------------------|---------------|
| GSAP/TweenMax | `window.gsap`, `window.TweenMax` | Timeline state |
| Anime.js | `window.anime` | Animation progress |
| Framer Motion | `[data-framer-appear-id]` | React components |
| Lottie | `window.lottie`, `window.bodymovin` | Player state |
| ScrollMagic | `window.ScrollMagic` | Scene triggers |
| ScrollTrigger | `window.ScrollTrigger` | GSAP integration |
| AOS | `window.AOS` | Scroll animations |

### Hover State Capture
v2.0 extracts CSS pseudo-class rules:
- `:hover` -> `.gi-hover-active`
- `:focus` -> `.gi-focus-active`
- `:active` -> `.gi-active-active`

These classes can be manually toggled to see hover effects in the captured page.

### Canvas Animation Capture
For animated canvas elements, v2.0 captures:
- 5 frames at 100ms intervals
- Creates a sprite sheet or GIF
- Falls back to single frame if no animation detected

---

## How It Works

### Automatic Detection
The extension automatically detects UX patterns using:
- **CSS class patterns** (e.g., `.accordion`, `.modal`, `.carousel`)
- **Data attributes** (e.g., `data-toggle`, `data-carousel`)
- **ARIA roles** (e.g., `role="dialog"`, `role="tabpanel"`)
- **Framework-specific selectors** (Bootstrap, Material UI, etc.)
- **Animation library globals** (v2.0)

### Processing Steps
1. **Detection**: Identifies all interactive elements
2. **Animation capture**: Extract hover states, detect libraries (v2.0)
3. **Expansion**: Opens/expands collapsed content
4. **Normalization**: Converts dynamic to static display
5. **Asset Loading**: Forces lazy-loaded content to load
6. **Visual Enhancement**: Adds separators and indicators
7. **Capture**: Preserves everything in the final snapshot

### Visual Indicators
When captured, the extension adds:
- **Section separators** between expanded content
- **Labels** for form steps and hidden fields
- **Info boxes** for media embeds and interactive elements
- **Borders** around important sections
- **Animation library badges** (v2.0)

---

## Configuration

### Options
```javascript
{
  expandCarousels: true,       // Expand all carousel slides
  normalizeUX: true,           // Apply all UX normalizations
  captureHoverStates: true,    // v2.0: Capture hover CSS rules
  captureScrollAnimations: true, // v2.0: Trigger scroll animations
  captureCanvasFrames: true,   // v2.0: Multi-frame canvas capture
  canvasFrameCount: 5,         // v2.0: Number of frames
  detectAnimationLibraries: true, // v2.0: Detect GSAP, Anime.js, etc.
  extractCSSInJS: true         // v2.0: Extract styled-components, etc.
}
```

### Performance Impact
- **Processing time**: 2-5 seconds for complex pages
- **Animation overhead**: 300-800ms (v2.0)
- **Memory usage**: Proportional to content amount
- **Final file size**: Larger due to expanded content + animation data

---

## Benefits

### For Users
- **Complete content capture** - Nothing hidden or missing
- **Animation preservation** - Hover states and transitions (v2.0)
- **No JavaScript needed** - Works offline after capture
- **Searchable content** - All text is accessible
- **Print-friendly** - Everything visible for printing

### For Developers
- **Framework agnostic** - Works with any UI library
- **CSS-in-JS support** - styled-components, Emotion (v2.0)
- **Extensible** - Easy to add new patterns
- **Debugging info** - Hidden fields and data visible
- **Documentation** - Preserves all states

---

## Common Use Cases

### 1. **Documentation Sites**
- Captures all code examples
- Expands all collapsible sections
- Preserves syntax highlighting
- Multi-page crawl for entire docs (v2.0)

### 2. **E-commerce**
- Shows all product images in galleries
- Expands size/color options
- Displays all tabs (description, reviews, specs)
- Crawl entire product catalog (v2.0)

### 3. **News & Blogs**
- Loads all comments
- Expands "Read more" sections
- Captures social embeds
- Crawl multiple articles (v2.0)

### 4. **Web Applications**
- Shows all form fields
- Displays modal content
- Preserves data tables
- Captures CSS-in-JS styles (v2.0)

### 5. **Portfolio Sites**
- Captures all gallery images
- Preserves hover animations (v2.0)
- Multi-page crawl for all projects (v2.0)

---

## Limitations & Notes

### What Gets Captured
- Static content representation
- All visible and hidden text
- Images and media references
- Form structure and options
- Layout and styling
- Hover state CSS rules (v2.0)
- Animation library state (v2.0)

### What Doesn't Work Offline
- Interactive functionality
- Dynamic calculations
- Real-time updates
- Form submissions
- Video playback (only poster)
- Active JavaScript animations

### Best Practices
1. **Wait for page load** - Let dynamic content fully load
2. **Check expanded content** - Verify all sections are visible
3. **Review capture** - Check that important content is included
4. **Large pages** - May require more time
5. **Use crawl mode** - For multi-page sites (v2.0)

---

## Technical Implementation

### File Structure
```
src/
├── content.js          # Main capture + animation detection (v2.0)
├── background.js       # Crawl orchestration (v2.0)
├── popup.js            # Mode selector (v2.0)
└── defaults.js         # Configuration options (v2.0 additions)
```

### Animation Detection API (v2.0)
```javascript
function detectAnimationLibraries() {
  return {
    gsap: !!(window.gsap || window.TweenMax || window.TweenLite),
    anime: !!window.anime,
    framerMotion: !!document.querySelector('[data-framer-appear-id]'),
    lottie: !!(window.lottie || window.bodymovin),
    scrollMagic: !!window.ScrollMagic,
    scrollTrigger: !!window.ScrollTrigger,
    aos: !!window.AOS
  };
}
```

### Hover State Extraction (v2.0)
```javascript
function extractHoverStyles(sheet) {
  for (const rule of sheet.cssRules) {
    if (rule.selectorText?.includes(':hover')) {
      // Convert :hover to .gi-hover-active class
      const newSelector = rule.selectorText.replace(/:hover/g, '.gi-hover-active');
      hoverStyles.push(`${newSelector} { ${rule.style.cssText} }`);
    }
  }
}
```

---

## Testing Checklist

Test the extension on sites with:
- [ ] Bootstrap components
- [ ] Material UI elements
- [ ] React components (with CSS-in-JS)
- [ ] Vue.js interfaces
- [ ] jQuery plugins
- [ ] Custom implementations
- [ ] GSAP animations (v2.0)
- [ ] Anime.js animations (v2.0)
- [ ] Framer Motion (v2.0)
- [ ] styled-components (v2.0)

---

## Summary

GetInspire v2.0 provides **comprehensive UX pattern support** with enhanced animation capture, ensuring that virtually any interactive web page can be captured with all its content visible and accessible. The extension intelligently detects and normalizes 20+ categories of UI patterns, plus modern animation libraries and CSS-in-JS solutions, making it one of the most thorough web capture tools available.

Whether you're archiving documentation, saving e-commerce products, or preserving web applications, GetInspire ensures that no content is left hidden or inaccessible in your captures.
