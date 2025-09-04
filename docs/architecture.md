# Architecture

## Architecture Overview

```mermaid
graph LR
  A[User] -->|clicks Capture| P[Popup UI]
  P -->|chrome.scripting.executeScript| C[Content Script]
  P -->|Stop/Status| C
  C -->|DOM scan + collect URLs| D[Page DOM]
  C -->|normalize/lazyload fix| D
  C -->|fetch assets same origin| Net[Network]
  C -->|GETINSPIRE_FETCH fallback| B[Background SW]
  B -->|fetch with per-origin permission| Net
  C -->|build ZIP via JSZip| Z[Blob]
  C -->|send blobUrl + filename| B
  B -->|chrome.downloads.download| File[ZIP File]
  Z -.->|quick-check.html and report files| File
  P -->|shows progress/errors| A
  O[Options Page] -->|save settings| Sync[chrome.storage.sync]
  C -->|read defaults+options| Sync
```

## Capture Flow

```mermaid
flowchart TD
  start([Start]) --> scan[Scan page: auto-scroll until height stable]
  scan --> norm[Normalize: eager images, preload video metadata]
  norm --> collect[Collect asset URLs from DOM, styles, srcset]
  collect --> fetch[Download assets with concurrency + caps]
  fetch --> rewrite[Rewrite index.html + CSS urls to local paths]
  rewrite --> report[Build report + manifest + quick-check]
  report --> zip[Build ZIP two pass embed report size]
  zip --> dl[Trigger download via background]
  dl --> done([Done])
```

## Sequence: Main Capture

```mermaid
sequenceDiagram
  participant U as User
  participant P as Popup
  participant B as Background SW
  participant T as Tab
  participant C as Content Script

  U->>P: Click "Capture this page"
  P->>T: chrome.scripting.executeScript(JSZip, content.js)
  C->>C: Auto-scroll until page height stable
  C->>C: Normalize + Collect assets
  C->>B: GETINSPIRE_FETCH (fallback for cross-origin)
  B->>C: Result(arrayBuffer, contentType) or error
  C->>C: Build ZIP (Blob)
  C->>B: GETINSPIRE_DOWNLOAD_ZIP(blobUrl, filename)
  B->>B: chrome.downloads.download(...)
  B-->>P: GETINSPIRE_DONE
  P-->>U: Show "Downloaded ZIP"
```

## Sequence: Policy Fallback (MHTML)

Some sites are enterprise-managed or block scripting via policy. The popup falls back to a single-file MHTML snapshot.

```mermaid
sequenceDiagram
  participant U as User
  participant P as Popup
  participant B as Background SW

  U->>P: Click Capture
  P->>P: Injection fails with policy error
  P->>B: GETINSPIRE_SAVE_MHTML_DIRECT(tabId)
  B->>B: pageCapture.saveAsMHTML
  B->>U: Download .mhtml file
```

## Blobs and Object URLs

- Blob: immutable, in-memory object that represents binary data. JSZip produces a `Blob` containing the assembled ZIP.
- Object URL: temporary URL created by `URL.createObjectURL(blob)` used to hand the Blob to the background for `chrome.downloads.download`.
- Lifetime: we revoke it after download (`URL.revokeObjectURL`) to release memory. See:
  - `src/content.js` (buildZip + handoff)
  - `src/background.js` (revocation handled in the creating context)
- Why not ArrayBuffer only? Object URLs avoid large message copies across the extension boundary on some browsers and are widely supported. A fallback path exists to reconstruct the Blob in the background if needed.

## Operational Flows

- Endless detection: height-stability heuristic avoids false positives on dynamic pages. Iteration cap now proceeds with capture when reached.
- Redaction: off by default. When enabled, conservative selectors replace sensitive text with lorem-ipsum in the saved HTML; live page is never modified.
- Denylist: blocks known infinite feeds by URL regex; editable in Options. YouTube `/feed/playlists` is allowed, other YouTube feed pages are blocked.
