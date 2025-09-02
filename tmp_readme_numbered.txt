   1: GetInspire - Chrome Extension (MV3)
   2: 
   3: Snapshot any finite web page into a ZIP that works offline: index.html + assets, plus a Quick Check page and a Fetch Report.
   4: 
   5: Install (Load Unpacked)
   6: - Open Chrome and go to `chrome://extensions`, enable Developer mode
   7: - Click "Load unpacked" and select the `GetInspire/` folder
   8: - Pin GetInspire in the toolbar
   9: 
  10: Use
  11: - Open a normal, finite page (blog, docs, landing page)
  12: - Click "Capture this page" in the popup (or use shortcut Ctrl+Shift+S)
  13: - Save the ZIP, unzip it, open `quick-check.html` for a fast sanity check, then `index.html`
  14:   - Quick Check embeds the report inline, so it works even when the browser blocks `fetch()` on `file://` URLs.
  15: 
  16: What's Included
  17: - `index.html`: DOM snapshot with local asset paths
  18: - `assets/`: downloaded CSS/JS/images/fonts/media
  19: - `report/README.md` and `report/fetch-report.json`: human + machine summary
  20: - `quick-check.html`: loads `index.html` in an iframe and summarizes the report
  21: - `report/asset-manifest.json`: original URL + local path, bytes, mime, sha256
  22: - `report/page.mhtml`: browser-native MHTML snapshot (when available)
  23: 
  24: Endless Pages & Limits
  25: - Denylist blocks known infinite feeds/search pages
  26: - Heuristic auto-scrolls until bottom is stable
  27: - Caps: runtime, max assets, ZIP size, and concurrency (configurable in Options)
  28: 
  29: Settings
  30: - Options page lets you adjust caps, redact behavior, denylist, and whether to save without prompt
  31:   - Defaults are shared across the extension; the Options page imports them from `src/defaults.js`.
  32:   - Strip Scripts: optionally remove scripts and inline handlers for offline safety.
  33:   - Redaction: off by default to avoid altering captured text. Enable "Redact authenticated text" in Options if you want sensitive text (emails/tokens/user areas) replaced in the saved HTML.
  34: 
  35: Permissions
  36: - The extension requests per-origin host access only when needed to fetch cross-origin assets in the background. Chrome may prompt you the first time an asset needs fetching from a new domain.
  37: - Core actions (injecting on the active tab, downloads, storage, context menus) don't require broad host access.
  38: 
  39: Notes
  40: - Third-party iframes stay external by design and may not work offline
  41: - Cross-origin assets can be blocked by CORS/CSP; failures are listed in the report
  42: - The popup shows live progress during capture
  43: - In-page overlay shows status with a Stop button during capture
  44: 
  45: ---
  46: 
  47: Architecture Overview
  48: 
  49: ```mermaid
  50: graph LR
  51:   A[User] -->|clicks Capture| P[Popup UI]
  52:   P -->|chrome.scripting.executeScript| C[Content Script]
  53:   P -->|Stop/Status| C
  54:   C -->|DOM scan + collect URLs| D[Page DOM]
  55:   C -->|normalize/lazyload fix| D
  56:   C -->|fetch assets same origin| Net[Network]
  57:   C -->|GETINSPIRE_FETCH fallback| B[Background SW]
  58:   B -->|fetch with per-origin permission| Net
  59:   C -->|build ZIP via JSZip| Z[Blob]
  60:   C -->|send blobUrl + filename| B
  61:   B -->|chrome.downloads.download| File[ZIP File]
  62:   Z -.->|quick-check.html and report files| File
  63:   P -->|shows progress/errors| A
  64:   O[Options Page] -->|save settings| Sync[chrome.storage.sync]
  65:   C -->|read defaults+options| Sync
  66: ```
  67: 
  68: Capture Flow
  69: 
  70: ```mermaid
  71: flowchart TD
  72:   start([Start]) --> scan[Scan page: auto-scroll until height stable]
  73:   scan --> norm[Normalize: eager images, preload video metadata]
  74:   norm --> collect[Collect asset URLs from DOM, styles, srcset]
  75:   collect --> fetch[Download assets with concurrency + caps]
  76:   fetch --> rewrite[Rewrite index.html + CSS urls to local paths]
  77:   rewrite --> report[Build report + manifest + quick-check]
  78:   report --> zip[Build ZIP two pass embed report size]
  79:   zip --> dl[Trigger download via background]
  80:   dl --> done([Done])
  81: ```
  82: 
  83: Sequence: Main Capture
  84: 
  85: ```mermaid
  86: sequenceDiagram
  87:   participant U as User
  88:   participant P as Popup
  89:   participant B as Background SW
  90:   participant T as Tab
  91:   participant C as Content Script
  92: 
  93:   U->>P: Click "Capture this page"
  94:   P->>T: chrome.scripting.executeScript(JSZip, content.js)
  95:   C->>C: Auto-scroll until page height stable
  96:   C->>C: Normalize + Collect assets
  97:   C->>B: GETINSPIRE_FETCH (fallback for cross-origin)
  98:   B->>C: Result(arrayBuffer, contentType) or error
  99:   C->>C: Build ZIP (Blob)
 100:   C->>B: GETINSPIRE_DOWNLOAD_ZIP(blobUrl, filename)
 101:   B->>B: chrome.downloads.download(...)
 102:   B-->>P: GETINSPIRE_DONE
 103:   P-->>U: Show "Downloaded ZIP"
 104: ```
 105: 
 106: Sequence: Policy Fallback (MHTML)
 107: 
 108: Some sites are enterprise-managed or block scripting via policy. The popup falls back to a single-file MHTML snapshot.
 109: 
 110: ```mermaid
 111: sequenceDiagram
 112:   participant U as User
 113:   participant P as Popup
 114:   participant B as Background SW
 115: 
 116:   U->>P: Click Capture
 117:   P->>P: Injection fails with policy error
 118:   P->>B: GETINSPIRE_SAVE_MHTML_DIRECT(tabId)
 119:   B->>B: pageCapture.saveAsMHTML
 120:   B->>U: Download .mhtml file
 121: ```
 122: 
 123: Blobs and Object URLs
 124: 
 125: - Blob: immutable, in-memory object that represents binary data. JSZip produces a `Blob` containing the assembled ZIP.
 126: - Object URL: temporary URL created by `URL.createObjectURL(blob)` used to hand the Blob to the background for `chrome.downloads.download`.
 127: - Lifetime: we revoke it after download (`URL.revokeObjectURL`) to release memory. See:
 128:   - `src/content.js` (buildZip + handoff)
 129:   - `src/background.js` (revocation handled in the creating context)
 130: - Why not ArrayBuffer only? Object URLs avoid large message copies across the extension boundary on some browsers and are widely supported. A fallback path exists to reconstruct the Blob in the background if needed.
 131: 
 132: Operational Flows
 133: 
 134: - Endless detection: height-stability heuristic avoids false positives on dynamic pages. Iteration cap now proceeds with capture when reached.
 135: - Redaction: off by default. When enabled, conservative selectors replace sensitive text with lorem-ipsum in the saved HTML; live page is never modified.
 136: - Denylist: blocks known infinite feeds by URL regex; editable in Options. YouTube `/feed/playlists` is allowed, other YouTube feed pages are blocked.
 137: 
 138: Developer Notes
 139: 
 140: - Key files: `src/content.js`, `src/background.js`, `src/popup.*`, `src/options.*`, `src/defaults.js`.
 141: - Commands: use the keyboard shortcut `Ctrl+Shift+S` or popup button to capture; `Ctrl+Shift+X` to stop.
 142: - Testing tips:
 143:   - Use the Quick Check page in the ZIP for a fast sanity pass.
 144:   - Inspect `report/README.md` and `report/asset-manifest.json` for coverage and failures.
