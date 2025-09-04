# Changelog

## Unreleased

### New: Video Downloader
- Click the download icon in the popup header to detect the currently playing/visible video on the page.
- A quality menu appears. Click a quality to start the download in the background.
- Supported: direct files (MP4/WebM/Ogg) and non-encrypted HLS (.m3u8) streams. Progress shows in the popup bar for HLS.
- Permissions: for some hosts, Chrome prompts for per-origin access the first time. Accept the prompt to proceed.
- Not supported: DRM/Widevine, encrypted HLS (SAMPLE-AES/AES-128), and ciphered/MSE-only streams many sites use (including many YouTube/course videos). These won't expose downloadable URLs in-page.

### Popup UI Updates
- Top right actions: [Settings] [Report issue].
- Progress line shows percentage, counts, and elapsed time during captures and HLS downloads.
- Settings opens in a small popup window (not a browser tab) with all options from `src/options.html`.

### Options Enhancements
- Added toggles: "Show overlay" and "Font fallback" alongside existing settings.
- Denylist presets: quick buttons to insert common social/search patterns (then click Save).
- "Save without prompt": if enabled, ZIP and video downloads won't ask for a filename.

### Icons & Branding
- Updated logo and toolbar icons.
- Source SVG: `assets/logo.svg`.
- Generated PNGs: `assets/icons/16.png`, `32.png`, `48.png`, `128.png`.
- Rebuild icons after changing the SVG:
  ```bash
  npm install
  node tools/build-icons.js
  ```

### Troubleshooting Video Downloads
- Permission denied for video host: click the quality again and accept Chrome’s permission prompt. The prompt must be accepted under your click.
- No downloadable video found on YouTube: many videos are protected via MSE/DRM; the extension cannot extract those in-page.
- Encrypted HLS message: the stream uses encryption (e.g., SAMPLE-AES). Decryption is out of scope for the in-extension downloader.
