GetInspire - Chrome Extension (MV3)

Snapshot any finite web page into a ZIP that works offline: index.html + assets, plus a Quick Check page and a Fetch Report.

Install (Load Unpacked)
- Open Chrome and go to `chrome://extensions`, enable Developer mode
- Click "Load unpacked" and select the `GetInspire/` folder
- Pin GetInspire in the toolbar

Use
- Open a normal, finite page (blog, docs, landing page)
- Click "Capture this page" in the popup
- Save the ZIP, unzip it, open `quick-check.html` for a fast sanity check, then `index.html`

What's Included
- `index.html`: DOM snapshot with local asset paths
- `assets/`: downloaded CSS/JS/images/fonts/media
- `report/README.md` and `report/fetch-report.json`: human + machine summary
- `quick-check.html`: loads `index.html` in an iframe and summarizes the report

Endless Pages & Limits
- Denylist blocks known infinite feeds/search pages
- Heuristic auto-scrolls until bottom is stable
- Caps: runtime, max assets, ZIP size, and concurrency (configurable in Options)

Settings
- Options page lets you adjust caps, redact behavior, denylist, and whether to save without prompt

Permissions
- The extension requests per-origin host access only when needed to fetch cross-origin assets in the background. Chrome may prompt you the first time an asset needs fetching from a new domain.
- Core actions (injecting on the active tab, downloads, storage, context menus) don't require broad host access.

Notes
- Third-party iframes stay external by design and may not work offline
- Cross-origin assets can be blocked by CORS/CSP; failures are listed in the report
