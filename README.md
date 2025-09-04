GetInspire - Chrome Extension (MV3)

Snapshot any finite web page into a ZIP that works offline: index.html + assets, plus a Quick Check page and a Fetch Report.

Install (Load Unpacked)
- Open Chrome and go to `chrome://extensions`, enable Developer mode
- Click "Load unpacked" and select the `GetInspire/` folder
- Pin GetInspire in the toolbar

Use
- Open a normal, finite page (blog, docs, landing page)
- Click "Capture this page" in the popup (or use shortcut Ctrl+Shift+S)
- Save the ZIP, unzip it, open `quick-check.html` for a fast sanity check, then `index.html`
  - Quick Check embeds the report inline, so it works even when the browser blocks `fetch()` on `file://` URLs.

What's Included
- `index.html`: DOM snapshot with local asset paths
- `assets/`: downloaded CSS/JS/images/fonts/media
- `report/README.md` and `report/fetch-report.json`: human + machine summary
- `quick-check.html`: loads `index.html` in an iframe and summarizes the report
- `report/asset-manifest.json`: original URL + local path, bytes, mime, sha256
- `report/page.mhtml`: browser-native MHTML snapshot (when available)

Endless Pages & Limits
- Denylist blocks known infinite feeds/search pages
- Heuristic auto-scrolls until bottom is stable
- Caps: runtime, max assets, ZIP size, and concurrency (configurable in Options)

Settings
- Options page lets you adjust caps, redact behavior, denylist, and whether to save without prompt
  - Defaults are shared across the extension; the Options page imports them from `src/defaults.js`.
  - Strip Scripts: optionally remove scripts and inline handlers for offline safety.
  - Redaction: off by default to avoid altering captured text. Enable "Redact authenticated text" in Options if you want sensitive text (emails/tokens/user areas) replaced in the saved HTML.

Permissions
- The extension requests per-origin host access only when needed to fetch cross-origin assets in the background. Chrome may prompt you the first time an asset needs fetching from a new domain.
- Core actions (injecting on the active tab, downloads, storage, context menus) don't require broad host access.

Notes
- Third-party iframes stay external by design and may not work offline
- Cross-origin assets can be blocked by CORS/CSP; failures are listed in the report
- The popup shows live progress during capture
- In-page overlay shows status with a Stop button during capture

---

New: Video Downloader

- Click the download icon in the popup header to detect the currently playing/visible video on the page.
- A quality menu appears. Click a quality to start the download in the background.
- Supported: direct files (MP4/WebM/Ogg) and non-encrypted HLS (.m3u8) streams. Progress shows in the popup bar for HLS.
- Permissions: for some hosts, Chrome prompts for per-origin access the first time. Accept the prompt to proceed.
- Not supported: DRM/Widevine, encrypted HLS (SAMPLE-AES/AES-128), and ciphered/MSE-only streams many sites use (including many YouTube/course videos). These won't expose downloadable URLs in-page.

Popup UI Updates

- Top right actions: [Settings] [Report issue].
- Progress line shows percentage, counts, and elapsed time during captures and HLS downloads.
- Settings opens in a small popup window (not a browser tab) with all options from `src/options.html`.

Options Enhancements

- Added toggles: "Show overlay" and "Font fallback" alongside existing settings.
- Denylist presets: quick buttons to insert common social/search patterns (then click Save).
- "Save without prompt": if enabled, ZIP and video downloads won't ask for a filename.

Icons & Branding

- Updated logo and toolbar icons.
- Source SVG: `assets/logo.svg`.
- Generated PNGs: `assets/icons/16.png`, `32.png`, `48.png`, `128.png`.
- Rebuild icons after changing the SVG:

  ```bash
  npm install
  node tools/build-icons.js
  ```

Troubleshooting Video Downloads

- Permission denied for video host: click the quality again and accept Chrome’s permission prompt. The prompt must be accepted under your click.
- No downloadable video found on YouTube: many videos are protected via MSE/DRM; the extension cannot extract those in-page.
- Encrypted HLS message: the stream uses encryption (e.g., SAMPLE-AES). Decryption is out of scope for the in-extension downloader.

Roadmap (Optional)

- DASH (MPD) parsing support for broader site coverage.

Developer Notes

- Key files: `src/content.js`, `src/background.js`, `src/popup.*`, `src/options.*`, `src/defaults.js`.
- Commands: use the keyboard shortcut `Ctrl+Shift+S` or popup button to capture; `Ctrl+Shift+X` to stop.
- Testing tips:
  - Use the Quick Check page in the ZIP for a fast sanity pass.
  - Inspect `report/README.md` and `report/asset-manifest.json` for coverage and failures.

