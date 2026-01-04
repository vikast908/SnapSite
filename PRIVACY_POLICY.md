# Privacy Policy for GetInspire

**Last Updated:** January 4, 2026

## Overview

GetInspire is a Chrome extension that saves web pages and entire websites as offline ZIP files. This privacy policy explains how the extension handles your data.

## Data Collection

**GetInspire does not collect, transmit, or store any personal data.** All processing happens entirely on your local device.

### What We Don't Collect
- No personal information
- No browsing history
- No analytics or usage tracking
- No cookies or identifiers
- No data sent to external servers

### Local Storage Only
The extension stores your preferences (theme, capture settings, etc.) locally in Chrome's storage API. This data:
- Never leaves your device
- Is not accessible to us or any third party
- Can be cleared by uninstalling the extension

## Permissions Explained

GetInspire requests the following permissions solely to provide its core functionality:

| Permission | Purpose |
|------------|---------|
| `activeTab` | Access the current tab to capture its content when you click the extension |
| `scripting` | Inject scripts to extract page content, styles, and assets |
| `downloads` | Save the captured ZIP file to your computer |
| `storage` | Store your local preferences (theme, settings) |
| `tabs` | Navigate between pages during multi-page site crawls |
| `pageCapture` | Capture complete page snapshots including MHTML format |
| `host_permissions` | Fetch assets (images, CSS, fonts) from any domain to include in offline captures |

## How Your Data Is Processed

1. **Page Capture**: When you initiate a capture, the extension reads the current page's HTML, CSS, and assets
2. **Local Processing**: All content is processed entirely in your browser
3. **ZIP Creation**: Assets are bundled into a ZIP file on your device
4. **Download**: The ZIP is saved to your local downloads folder
5. **No Transmission**: At no point is any data sent to external servers

## Third-Party Services

GetInspire does not use any third-party services, analytics, or tracking tools.

## Data Security

Since all data processing occurs locally on your device and no data is transmitted externally, your captured content remains entirely under your control.

## Children's Privacy

GetInspire does not knowingly collect any information from children under 13 years of age.

## Changes to This Policy

We may update this privacy policy from time to time. Any changes will be reflected in the "Last Updated" date above.

## Contact

If you have questions about this privacy policy, please open an issue at:
https://github.com/vikast908/GetInspire/issues

## Open Source

GetInspire is open source software. You can review the complete source code at:
https://github.com/vikast908/GetInspire
