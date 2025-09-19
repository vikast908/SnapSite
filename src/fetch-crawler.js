// Memory-efficient fetch-based crawler for GetInspire
// This approach doesn't open tabs, just fetches HTML and extracts content

export class FetchCrawler {
  constructor(options = {}) {
    this.options = {
      maxPages: options.maxPages || 10,
      maxTime: options.maxTime || 30000, // 30 seconds
      sameOriginOnly: true,
      userAgent: 'GetInspire Crawler',
      ...options
    };

    this.visited = new Set();
    this.queue = [];
    this.results = [];
    this.startTime = Date.now();
  }

  async crawl(startUrl) {
    console.log('[FetchCrawler] Starting fetch-based crawl:', startUrl);

    this.queue.push(startUrl);
    const startHost = new URL(startUrl).hostname;

    while (this.queue.length > 0 && this.results.length < this.options.maxPages) {
      // Check time limit
      if (Date.now() - this.startTime > this.options.maxTime) {
        console.log('[FetchCrawler] Time limit reached');
        break;
      }

      const url = this.queue.shift();
      if (this.visited.has(url)) continue;
      this.visited.add(url);

      try {
        console.log(`[FetchCrawler] Fetching ${url}`);
        const result = await this.fetchPage(url);

        if (result) {
          this.results.push(result);

          // Extract links from HTML
          const links = this.extractLinks(result.html, url);

          // Add same-origin links to queue
          for (const link of links) {
            try {
              const linkHost = new URL(link).hostname;
              if (linkHost === startHost && !this.visited.has(link) && !this.queue.includes(link)) {
                this.queue.push(link);
              }
            } catch (e) {
              // Invalid URL, skip
            }
          }
        }

        // Small delay to prevent overwhelming the server
        await new Promise(r => setTimeout(r, 100));

      } catch (error) {
        console.warn(`[FetchCrawler] Failed to fetch ${url}:`, error);
      }
    }

    console.log(`[FetchCrawler] Completed. Fetched ${this.results.length} pages`);
    return this.results;
  }

  async fetchPage(url) {
    try {
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'omit',
        cache: 'no-cache',
        headers: {
          'User-Agent': this.options.userAgent
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const html = await response.text();
      const title = this.extractTitle(html) || new URL(url).pathname;

      return {
        url,
        title,
        html,
        size: html.length,
        timestamp: Date.now()
      };

    } catch (error) {
      console.warn(`[FetchCrawler] Fetch failed for ${url}:`, error.message);
      return null;
    }
  }

  extractTitle(html) {
    try {
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\\/title>/i);
      return titleMatch ? titleMatch[1].trim() : null;
    } catch (e) {
      return null;
    }
  }

  extractLinks(html, baseUrl) {
    const links = new Set();

    try {
      // Simple regex to extract href attributes
      const hrefRegex = /href\\s*=\\s*["']([^"']+)["']/gi;
      let match;

      while ((match = hrefRegex.exec(html)) !== null) {
        try {
          let href = match[1];

          // Skip non-HTTP(S) links
          if (href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:')) {
            continue;
          }

          // Convert relative URLs to absolute
          const absoluteUrl = new URL(href, baseUrl).href;

          // Skip file extensions that are likely not pages
          if (/\\.(jpg|jpeg|png|gif|webp|svg|pdf|zip|css|js|ico)$/i.test(absoluteUrl)) {
            continue;
          }

          links.add(absoluteUrl);
        } catch (e) {
          // Invalid URL, skip
        }
      }
    } catch (e) {
      console.warn('[FetchCrawler] Link extraction failed:', e);
    }

    return Array.from(links);
  }

  // Convert results to aggregator format
  toAggregatorFormat() {
    return this.results.map(result => {
      const slug = this.urlToSlug(result.url);

      return {
        slug,
        pageUrl: result.url,
        title: result.title,
        indexHtml: this.cleanHtml(result.html),
        assets: [], // No assets in fetch-only mode
        reportJson: JSON.stringify({
          url: result.url,
          title: result.title,
          size: result.size,
          method: 'fetch-only',
          timestamp: result.timestamp
        }),
        readmeMd: `# ${result.title}\\n\\nFetched from: ${result.url}\\nSize: ${result.size} bytes\\nMethod: Fetch-only (no assets)`,
        quickCheckHtml: `<!DOCTYPE html><html><head><title>Quick Check</title></head><body><h1>${result.title}</h1><p>URL: <a href="${result.url}">${result.url}</a></p><p>Method: Fetch-only</p></body></html>`,
        extras: []
      };
    });
  }

  urlToSlug(url) {
    try {
      const pathname = new URL(url).pathname;
      return pathname.replace(/[^a-z0-9]/gi, '-').replace(/--+/g, '-').replace(/^-|-$/g, '') || 'page';
    } catch (e) {
      return 'page';
    }
  }

  cleanHtml(html) {
    // Basic HTML cleaning for fetch-only mode
    try {
      // Add basic styling to make it readable
      const styledHtml = html.replace(
        /<head>/i,
        `<head><style>
          body { font-family: system-ui, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; }
          .fetch-notice { background: #fff3cd; border: 1px solid #ffc107; padding: 10px; margin: 20px 0; }
        </style>`
      );

      // Add notice about fetch-only mode
      return styledHtml.replace(
        /<body[^>]*>/i,
        `$&<div class="fetch-notice">
          <strong>📄 Fetch-Only Mode:</strong> This page was captured using basic HTML fetch.
          For full fidelity including styles and assets, use the regular "This Page" capture mode.
        </div>`
      );
    } catch (e) {
      return html;
    }
  }
}

// Export for use in background script
export default FetchCrawler;