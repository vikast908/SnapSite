// Comprehensive UX Pattern Handler for GetInspire
// Ensures all interactive elements are captured properly

export async function normalizeAllUXPatterns(options = {}) {
  console.log('[UX Normalizer] Starting comprehensive UX pattern normalization...');

  const results = {
    patterns: [],
    totalProcessed: 0,
    errors: []
  };

  try {
    // Process all patterns in sequence for better control
    await handleAccordionsAndCollapsibles(results);
    await handleTabsAndTabPanels(results);
    await handleModalsAndDialogs(results);
    await handleDropdownsAndMenus(results);
    await handleTooltipsAndPopovers(results);
    await handleImageGalleriesAndLightboxes(results);
    await handleFormsAndInputs(results);
    await handleVideoAndAudioPlayers(results);
    await handleDataTablesAndPagination(results);
    await handleSidebarsAndOffCanvas(results);
    await handleStickyAndFixed(results);
    await handleLoadingAndSkeleton(results);
    await handleAlerts(results);
    await handleSocialEmbeds(results);
    await handleCodeBlocks(results);
    await handleCharts(results);
    await handleMaps(results);
    await handleTimelines(results);
    await handleComments(results);
    await handleRatings(results);

    console.log(`[UX Normalizer] Processed ${results.totalProcessed} patterns`);
  } catch (e) {
    console.error('[UX Normalizer] Fatal error:', e);
    results.errors.push({ pattern: 'global', error: e.message });
  }

  return results;
}

// 1. ACCORDIONS & COLLAPSIBLES
async function handleAccordionsAndCollapsibles(results) {
  try {
    const selectors = [
      // Common accordion patterns
      '.accordion', '.collapse', '.collapsible',
      '[data-accordion]', '[data-collapse]', '[data-toggle="collapse"]',
      '.accordion-item', '.accordion-panel', '.accordion-content',
      // Framework specific
      '.ui-accordion', '.mdc-accordion', '.mat-accordion',
      '.ant-collapse', '.el-collapse', '.v-expansion-panel',
      // Common classes
      '[class*="accordion"]', '[class*="collapse"]', '[class*="expand"]',
      // ARIA patterns
      '[role="tablist"] [role="tab"]',
      '[aria-expanded="false"]', '[aria-expanded="true"]',
      // FAQ patterns
      '.faq-item', '.faq-question', '.question-answer',
      'details', 'summary'
    ];

    const elements = document.querySelectorAll(selectors.join(', '));
    let count = 0;

    elements.forEach(el => {
      try {
        // Expand collapsed content
        if (el.hasAttribute('aria-expanded')) {
          el.setAttribute('aria-expanded', 'true');
        }

        // Remove collapsed classes
        el.classList.remove('collapsed', 'is-collapsed', 'closed', 'hidden');
        el.classList.add('expanded', 'open', 'active');

        // Show hidden content
        const content = el.querySelector('.accordion-body, .accordion-content, .collapse-content, .panel-body');
        if (content) {
          content.style.display = 'block';
          content.style.height = 'auto';
          content.style.maxHeight = 'none';
          content.style.overflow = 'visible';
          content.style.visibility = 'visible';
          content.style.opacity = '1';
        }

        // Handle HTML5 details/summary
        if (el.tagName === 'DETAILS') {
          el.setAttribute('open', 'open');
        }

        // Handle Bootstrap collapse
        if (el.classList.contains('collapse')) {
          el.classList.add('show');
          el.style.height = 'auto';
        }

        count++;
      } catch (e) {
        results.errors.push({ pattern: 'accordion', element: el, error: e.message });
      }
    });

    results.patterns.push({ type: 'accordions', count });
    results.totalProcessed += count;
  } catch (e) {
    console.error('[UX] Accordion handler error:', e);
  }
}

// 2. TABS & TAB PANELS
async function handleTabsAndTabPanels(results) {
  try {
    const tabContainers = document.querySelectorAll(
      '.tabs, .tab-container, [role="tablist"], ' +
      '.nav-tabs, .mat-tab-group, .ant-tabs, ' +
      '.el-tabs, .v-tabs, [class*="tab-"]'
    );

    let count = 0;
    tabContainers.forEach(container => {
      try {
        // Find all tabs and panels
        const tabs = container.querySelectorAll(
          '[role="tab"], .tab, .tab-link, .nav-link, ' +
          '[data-toggle="tab"], [data-tab], .tab-button'
        );

        const panels = container.querySelectorAll(
          '[role="tabpanel"], .tab-pane, .tab-panel, ' +
          '.tab-content, [class*="tab-pane"]'
        );

        // Show all tab panels
        panels.forEach(panel => {
          panel.style.display = 'block';
          panel.style.visibility = 'visible';
          panel.style.opacity = '1';
          panel.classList.add('active', 'show', 'in');
          panel.classList.remove('fade', 'hidden', 'd-none');

          // Add visual separator
          if (panels.length > 1) {
            panel.style.borderTop = '2px solid #dee2e6';
            panel.style.marginTop = '20px';
            panel.style.paddingTop = '20px';
          }
        });

        // Mark all tabs as viewed
        tabs.forEach(tab => {
          tab.classList.add('visited');
        });

        count++;
      } catch (e) {
        results.errors.push({ pattern: 'tabs', element: container, error: e.message });
      }
    });

    results.patterns.push({ type: 'tabs', count });
    results.totalProcessed += count;
  } catch (e) {
    console.error('[UX] Tabs handler error:', e);
  }
}

// 3. MODALS & DIALOGS
async function handleModalsAndDialogs(results) {
  try {
    const modals = document.querySelectorAll(
      '.modal, .dialog, [role="dialog"], .popup, ' +
      '.overlay, .lightbox, [class*="modal"], ' +
      '.mdc-dialog, .mat-dialog, .ant-modal, ' +
      '.el-dialog, .v-dialog, .swal2-container'
    );

    let count = 0;
    modals.forEach(modal => {
      try {
        // Make modal visible but position it inline
        modal.style.position = 'relative';
        modal.style.display = 'block';
        modal.style.opacity = '1';
        modal.style.visibility = 'visible';
        modal.style.zIndex = 'auto';
        modal.style.transform = 'none';
        modal.style.top = 'auto';
        modal.style.left = 'auto';

        // Remove backdrop/overlay
        const backdrop = modal.querySelector('.modal-backdrop, .overlay-backdrop');
        if (backdrop) backdrop.remove();

        // Add border for visibility
        modal.style.border = '2px solid #007bff';
        modal.style.margin = '20px 0';
        modal.style.padding = '20px';
        modal.style.borderRadius = '8px';

        modal.classList.add('show', 'in', 'open');
        modal.classList.remove('fade', 'hidden');

        count++;
      } catch (e) {
        results.errors.push({ pattern: 'modal', element: modal, error: e.message });
      }
    });

    // Also capture modal content that might be in portal/teleport elements
    const portalContent = document.querySelectorAll(
      '[data-teleport], [data-portal], #modal-root, #dialog-root'
    );
    portalContent.forEach(portal => {
      portal.style.display = 'block';
      portal.style.position = 'relative';
    });

    results.patterns.push({ type: 'modals', count });
    results.totalProcessed += count;
  } catch (e) {
    console.error('[UX] Modal handler error:', e);
  }
}

// 4. DROPDOWNS & MENUS
async function handleDropdownsAndMenus(results) {
  try {
    const dropdowns = document.querySelectorAll(
      '.dropdown-menu, .dropdown-content, [class*="dropdown"], ' +
      '.submenu, .sub-menu, .mega-menu, .context-menu, ' +
      '[role="menu"], [aria-haspopup="true"], ' +
      '.select-dropdown, .autocomplete-dropdown'
    );

    let count = 0;
    dropdowns.forEach(dropdown => {
      try {
        dropdown.style.display = 'block';
        dropdown.style.visibility = 'visible';
        dropdown.style.opacity = '1';
        dropdown.style.position = 'relative';
        dropdown.style.height = 'auto';
        dropdown.style.overflow = 'visible';

        dropdown.classList.add('show', 'open', 'active');
        dropdown.classList.remove('hidden', 'collapsed');

        // Add visual indication
        dropdown.style.backgroundColor = dropdown.style.backgroundColor || '#f8f9fa';
        dropdown.style.border = '1px solid #dee2e6';
        dropdown.style.padding = '10px';
        dropdown.style.marginTop = '10px';

        count++;
      } catch (e) {
        results.errors.push({ pattern: 'dropdown', element: dropdown, error: e.message });
      }
    });

    // Expand select2, chosen, and other custom selects
    const customSelects = document.querySelectorAll(
      '.select2-dropdown, .chosen-drop, .vs__dropdown-menu'
    );
    customSelects.forEach(select => {
      select.style.display = 'block';
      select.style.position = 'relative';
    });

    results.patterns.push({ type: 'dropdowns', count });
    results.totalProcessed += count;
  } catch (e) {
    console.error('[UX] Dropdown handler error:', e);
  }
}

// 5. TOOLTIPS & POPOVERS
async function handleTooltipsAndPopovers(results) {
  try {
    // Find elements with tooltips
    const tooltipElements = document.querySelectorAll(
      '[title], [data-tooltip], [data-tip], [data-toggle="tooltip"], ' +
      '[data-toggle="popover"], [aria-describedby], ' +
      '.tooltip-trigger, .has-tooltip'
    );

    let count = 0;
    tooltipElements.forEach(el => {
      try {
        const tooltipText = el.getAttribute('title') ||
                          el.getAttribute('data-tooltip') ||
                          el.getAttribute('data-tip') ||
                          el.getAttribute('data-original-title');

        if (tooltipText) {
          // Create visible tooltip element
          const tooltip = document.createElement('div');
          tooltip.className = 'captured-tooltip';
          tooltip.style.cssText = `
            display: block;
            position: relative;
            background: #333;
            color: white;
            padding: 5px 10px;
            border-radius: 4px;
            font-size: 12px;
            margin: 5px 0;
            max-width: 300px;
          `;
          tooltip.textContent = tooltipText;

          // Insert after the element
          el.parentNode.insertBefore(tooltip, el.nextSibling);
          count++;
        }
      } catch (e) {
        results.errors.push({ pattern: 'tooltip', element: el, error: e.message });
      }
    });

    // Show existing tooltip/popover elements
    const existingTooltips = document.querySelectorAll(
      '.tooltip, .popover, [role="tooltip"]'
    );
    existingTooltips.forEach(tooltip => {
      tooltip.style.display = 'block';
      tooltip.style.opacity = '1';
      tooltip.style.visibility = 'visible';
      tooltip.style.position = 'relative';
    });

    results.patterns.push({ type: 'tooltips', count });
    results.totalProcessed += count;
  } catch (e) {
    console.error('[UX] Tooltip handler error:', e);
  }
}

// 6. IMAGE GALLERIES & LIGHTBOXES
async function handleImageGalleriesAndLightboxes(results) {
  try {
    const galleries = document.querySelectorAll(
      '.gallery, .image-gallery, .photo-gallery, ' +
      '[class*="gallery"], [class*="lightbox"], ' +
      '.fancybox, .magnific-popup, .photoswipe, ' +
      '.lg-container, .pswp, .mfp-container'
    );

    let count = 0;

    // First, find all thumbnail images and ensure full-size versions are loaded
    const galleryImages = document.querySelectorAll(
      'a[href*=".jpg"], a[href*=".jpeg"], a[href*=".png"], ' +
      'a[href*=".webp"], a[href*=".gif"], ' +
      '[data-src], [data-full], [data-large], ' +
      '.gallery-item img, .thumbnail'
    );

    galleryImages.forEach(item => {
      try {
        let fullSizeUrl = null;

        if (item.tagName === 'A') {
          fullSizeUrl = item.href;
        } else {
          fullSizeUrl = item.getAttribute('data-src') ||
                       item.getAttribute('data-full') ||
                       item.getAttribute('data-large') ||
                       item.getAttribute('data-original');
        }

        if (fullSizeUrl && !fullSizeUrl.startsWith('javascript:')) {
          // Create full-size image element
          const fullImage = document.createElement('img');
          fullImage.src = fullSizeUrl;
          fullImage.style.cssText = `
            display: block;
            max-width: 100%;
            height: auto;
            margin: 10px 0;
            border: 1px solid #ddd;
            padding: 5px;
          `;
          fullImage.setAttribute('data-gallery-image', 'true');

          // Insert after thumbnail
          if (item.parentNode) {
            item.parentNode.insertBefore(fullImage, item.nextSibling);
          }
          count++;
        }
      } catch (e) {
        results.errors.push({ pattern: 'gallery-image', element: item, error: e.message });
      }
    });

    // Handle masonry and grid layouts
    const masonryGrids = document.querySelectorAll(
      '.masonry, .grid, .isotope, [class*="masonry"]'
    );
    masonryGrids.forEach(grid => {
      grid.style.height = 'auto';
      grid.style.overflow = 'visible';
    });

    results.patterns.push({ type: 'galleries', count });
    results.totalProcessed += count;
  } catch (e) {
    console.error('[UX] Gallery handler error:', e);
  }
}

// 7. FORMS & DYNAMIC INPUTS
async function handleFormsAndInputs(results) {
  try {
    let count = 0;

    // Handle hidden form fields
    const hiddenInputs = document.querySelectorAll(
      'input[type="hidden"]'
    );
    hiddenInputs.forEach(input => {
      // Make hidden inputs visible for debugging
      const label = document.createElement('div');
      label.style.cssText = `
        background: #fff3cd;
        border: 1px solid #ffc107;
        padding: 5px;
        margin: 5px 0;
        font-size: 11px;
        font-family: monospace;
      `;
      label.textContent = `Hidden field: ${input.name || 'unnamed'} = "${input.value}"`;
      input.parentNode.insertBefore(label, input);
    });

    // Expand conditional form sections
    const conditionalSections = document.querySelectorAll(
      '.form-section.hidden, .conditional-field, ' +
      '[data-condition], [v-if], [ng-if], [*ngIf]'
    );
    conditionalSections.forEach(section => {
      section.style.display = 'block';
      section.style.visibility = 'visible';
      section.classList.remove('hidden', 'd-none');
      count++;
    });

    // Show validation messages
    const validationMessages = document.querySelectorAll(
      '.error-message, .validation-message, .invalid-feedback, ' +
      '.form-error, [class*="error"], [class*="validation"]'
    );
    validationMessages.forEach(msg => {
      msg.style.display = 'block';
      msg.style.opacity = '0.7';
    });

    // Handle multi-step forms - show all steps
    const formSteps = document.querySelectorAll(
      '.form-step, .wizard-step, .step-content, ' +
      '[class*="step-"], [data-step]'
    );
    formSteps.forEach(step => {
      step.style.display = 'block';
      step.style.opacity = '1';
      step.style.visibility = 'visible';

      // Add step indicator
      const stepNum = step.getAttribute('data-step') || 'Step';
      const indicator = document.createElement('div');
      indicator.style.cssText = `
        background: #007bff;
        color: white;
        padding: 5px 15px;
        margin: 10px 0;
        border-radius: 20px;
        display: inline-block;
        font-weight: bold;
      `;
      indicator.textContent = stepNum;
      step.insertBefore(indicator, step.firstChild);
      count++;
    });

    // Capture select/dropdown options
    const selects = document.querySelectorAll('select');
    selects.forEach(select => {
      if (select.options.length > 1) {
        const optionsList = document.createElement('div');
        optionsList.style.cssText = `
          background: #f8f9fa;
          border: 1px solid #dee2e6;
          padding: 10px;
          margin: 5px 0;
          font-size: 12px;
        `;
        optionsList.innerHTML = `<strong>Options:</strong><br>` +
          Array.from(select.options).map(opt =>
            `• ${opt.text} (${opt.value})`
          ).join('<br>');
        select.parentNode.insertBefore(optionsList, select.nextSibling);
      }
    });

    results.patterns.push({ type: 'forms', count });
    results.totalProcessed += count;
  } catch (e) {
    console.error('[UX] Forms handler error:', e);
  }
}

// 8. VIDEO & AUDIO PLAYERS
async function handleVideoAndAudioPlayers(results) {
  try {
    let count = 0;

    // Handle video players
    const videos = document.querySelectorAll('video');
    videos.forEach(video => {
      try {
        // Show video controls
        video.controls = true;
        video.style.display = 'block';

        // Capture video poster if not set
        if (!video.poster && video.currentTime === 0) {
          video.currentTime = 1; // Move to 1 second to get a frame
        }

        // Add video information
        const info = document.createElement('div');
        info.style.cssText = `
          background: #17a2b8;
          color: white;
          padding: 10px;
          margin: 5px 0;
          border-radius: 4px;
        `;
        info.innerHTML = `
          <strong>Video:</strong> ${video.src || 'embedded'}<br>
          Duration: ${video.duration ? Math.round(video.duration) + 's' : 'unknown'}<br>
          ${video.poster ? 'Has poster image' : 'No poster'}
        `;
        video.parentNode.insertBefore(info, video);
        count++;
      } catch (e) {
        results.errors.push({ pattern: 'video', element: video, error: e.message });
      }
    });

    // Handle audio players
    const audios = document.querySelectorAll('audio');
    audios.forEach(audio => {
      audio.controls = true;
      audio.style.display = 'block';
      audio.style.width = '100%';
      count++;
    });

    // Handle iframe embeds (YouTube, Vimeo, etc.)
    const iframes = document.querySelectorAll(
      'iframe[src*="youtube"], iframe[src*="vimeo"], ' +
      'iframe[src*="dailymotion"], iframe[src*="twitch"]'
    );
    iframes.forEach(iframe => {
      // Add embed information
      const info = document.createElement('div');
      info.style.cssText = `
        background: #dc3545;
        color: white;
        padding: 10px;
        margin: 5px 0;
        border-radius: 4px;
      `;
      info.innerHTML = `
        <strong>Embedded Video:</strong><br>
        ${iframe.src}<br>
        Size: ${iframe.width || 'auto'} × ${iframe.height || 'auto'}
      `;
      iframe.parentNode.insertBefore(info, iframe);
    });

    results.patterns.push({ type: 'media-players', count });
    results.totalProcessed += count;
  } catch (e) {
    console.error('[UX] Media handler error:', e);
  }
}

// 9. DATA TABLES & PAGINATION
async function handleDataTablesAndPagination(results) {
  try {
    let count = 0;

    // Find paginated tables
    const tables = document.querySelectorAll(
      'table, .datatable, .data-table, [class*="table"]'
    );

    tables.forEach(table => {
      try {
        // Look for pagination controls
        const paginationContainer = table.closest('.dataTables_wrapper') ||
                                   table.parentElement;
        const pagination = paginationContainer?.querySelector(
          '.pagination, .dataTables_paginate, .pager, [class*="pagination"]'
        );

        if (pagination) {
          // Try to load all pages
          const showAllButton = paginationContainer.querySelector(
            '[value="-1"], [value="all"], .show-all'
          );
          if (showAllButton) {
            showAllButton.click();
          }

          // Or set page length to maximum
          const lengthSelect = paginationContainer.querySelector(
            'select[name*="length"], .dataTables_length select'
          );
          if (lengthSelect) {
            const options = lengthSelect.options;
            if (options.length > 0) {
              lengthSelect.selectedIndex = options.length - 1;
              lengthSelect.dispatchEvent(new Event('change'));
            }
          }

          // Add pagination info
          const info = document.createElement('div');
          info.style.cssText = `
            background: #6c757d;
            color: white;
            padding: 10px;
            margin: 10px 0;
            border-radius: 4px;
          `;
          info.textContent = 'Note: This table may have additional pages. Showing available data.';
          table.parentNode.insertBefore(info, table);
          count++;
        }

        // Expand any collapsed rows
        const collapsedRows = table.querySelectorAll(
          'tr.collapsed, tr.hidden, [data-collapsed="true"]'
        );
        collapsedRows.forEach(row => {
          row.classList.remove('collapsed', 'hidden');
          row.style.display = '';
        });

        // Show any detail rows
        const detailRows = table.querySelectorAll(
          '.detail-row, .child-row, [class*="detail"]'
        );
        detailRows.forEach(row => {
          row.style.display = '';
        });
      } catch (e) {
        results.errors.push({ pattern: 'table', element: table, error: e.message });
      }
    });

    results.patterns.push({ type: 'tables', count });
    results.totalProcessed += count;
  } catch (e) {
    console.error('[UX] Table handler error:', e);
  }
}

// 10. SIDEBARS & OFF-CANVAS
async function handleSidebarsAndOffCanvas(results) {
  try {
    const sidebars = document.querySelectorAll(
      '.sidebar, .offcanvas, .drawer, .sidenav, ' +
      '[class*="sidebar"], [class*="drawer"], ' +
      '.navigation-drawer, .side-panel'
    );

    let count = 0;
    sidebars.forEach(sidebar => {
      try {
        sidebar.style.display = 'block';
        sidebar.style.visibility = 'visible';
        sidebar.style.transform = 'translateX(0)';
        sidebar.style.position = 'relative';
        sidebar.style.opacity = '1';
        sidebar.style.left = '0';
        sidebar.style.right = '0';

        sidebar.classList.add('show', 'open', 'active');
        sidebar.classList.remove('collapsed', 'closed', 'hidden');

        // Add visual separator
        sidebar.style.border = '2px solid #6c757d';
        sidebar.style.margin = '20px 0';
        sidebar.style.padding = '20px';

        count++;
      } catch (e) {
        results.errors.push({ pattern: 'sidebar', element: sidebar, error: e.message });
      }
    });

    results.patterns.push({ type: 'sidebars', count });
    results.totalProcessed += count;
  } catch (e) {
    console.error('[UX] Sidebar handler error:', e);
  }
}

// 11. STICKY & FIXED ELEMENTS
async function handleStickyAndFixed(results) {
  try {
    let count = 0;

    // Handle sticky/fixed headers and footers
    const stickyElements = document.querySelectorAll(
      '[style*="position: fixed"], [style*="position: sticky"], ' +
      '.sticky, .fixed, .sticky-top, .fixed-top, ' +
      '.sticky-header, .fixed-header'
    );

    stickyElements.forEach(el => {
      try {
        // Convert to relative positioning for capture
        el.style.position = 'relative';
        el.style.top = 'auto';
        el.style.bottom = 'auto';
        el.style.left = 'auto';
        el.style.right = 'auto';
        el.style.zIndex = 'auto';

        // Add indicator
        el.setAttribute('data-was-sticky', 'true');
        count++;
      } catch (e) {
        results.errors.push({ pattern: 'sticky', element: el, error: e.message });
      }
    });

    // Handle parallax sections
    const parallaxElements = document.querySelectorAll(
      '.parallax, [data-parallax], [class*="parallax"]'
    );
    parallaxElements.forEach(el => {
      el.style.transform = 'none';
      el.style.backgroundAttachment = 'scroll';
    });

    results.patterns.push({ type: 'sticky-elements', count });
    results.totalProcessed += count;
  } catch (e) {
    console.error('[UX] Sticky handler error:', e);
  }
}

// 12. LOADING STATES & SKELETONS
async function handleLoadingAndSkeleton(results) {
  try {
    let count = 0;

    // Remove loading overlays
    const loadingOverlays = document.querySelectorAll(
      '.loading, .loader, .spinner, .skeleton, ' +
      '[class*="loading"], [class*="spinner"], ' +
      '.placeholder, .shimmer'
    );

    loadingOverlays.forEach(loader => {
      try {
        // Hide or minimize loading indicators
        loader.style.display = 'none';
        count++;
      } catch (e) {
        results.errors.push({ pattern: 'loader', element: loader, error: e.message });
      }
    });

    // Show content that might be hidden during loading
    const hiddenContent = document.querySelectorAll(
      '[style*="visibility: hidden"], [style*="display: none"], ' +
      '.hidden-until-loaded, .fade-in'
    );
    hiddenContent.forEach(el => {
      if (!el.closest('.modal, .dropdown-menu, .tooltip')) {
        el.style.visibility = 'visible';
        el.style.display = '';
        el.style.opacity = '1';
      }
    });

    results.patterns.push({ type: 'loading-states', count });
    results.totalProcessed += count;
  } catch (e) {
    console.error('[UX] Loading handler error:', e);
  }
}

// 13. ALERTS & NOTIFICATIONS
async function handleAlerts(results) {
  try {
    const alerts = document.querySelectorAll(
      '.alert, .notification, .toast, .snackbar, ' +
      '[role="alert"], [class*="alert"], [class*="notice"], ' +
      '.message, .flash-message'
    );

    let count = 0;
    alerts.forEach(alert => {
      try {
        alert.style.display = 'block';
        alert.style.visibility = 'visible';
        alert.style.opacity = '1';
        alert.style.position = 'relative';

        // Add visual emphasis
        alert.style.border = '2px solid currentColor';
        alert.style.margin = '10px 0';

        count++;
      } catch (e) {
        results.errors.push({ pattern: 'alert', element: alert, error: e.message });
      }
    });

    results.patterns.push({ type: 'alerts', count });
    results.totalProcessed += count;
  } catch (e) {
    console.error('[UX] Alert handler error:', e);
  }
}

// 14. SOCIAL MEDIA EMBEDS
async function handleSocialEmbeds(results) {
  try {
    let count = 0;

    // Twitter/X embeds
    const tweets = document.querySelectorAll(
      '.twitter-tweet, .twitter-timeline, [data-tweet-id]'
    );
    tweets.forEach(tweet => {
      const info = document.createElement('div');
      info.style.cssText = 'background: #1DA1F2; color: white; padding: 10px; margin: 10px 0;';
      info.textContent = 'Twitter/X Embed: ' + (tweet.getAttribute('data-tweet-id') || 'Timeline');
      tweet.parentNode.insertBefore(info, tweet);
      count++;
    });

    // Facebook embeds
    const fbEmbeds = document.querySelectorAll(
      '.fb-post, .fb-video, .fb-comments, [class^="fb-"]'
    );
    fbEmbeds.forEach(fb => {
      const info = document.createElement('div');
      info.style.cssText = 'background: #1877F2; color: white; padding: 10px; margin: 10px 0;';
      info.textContent = 'Facebook Embed';
      fb.parentNode.insertBefore(info, fb);
      count++;
    });

    // Instagram embeds
    const igEmbeds = document.querySelectorAll(
      '.instagram-media, [data-instgrm-permalink]'
    );
    igEmbeds.forEach(ig => {
      const info = document.createElement('div');
      info.style.cssText = 'background: linear-gradient(45deg, #833AB4, #FD1D1D); color: white; padding: 10px; margin: 10px 0;';
      info.textContent = 'Instagram Embed';
      ig.parentNode.insertBefore(info, ig);
      count++;
    });

    results.patterns.push({ type: 'social-embeds', count });
    results.totalProcessed += count;
  } catch (e) {
    console.error('[UX] Social embed handler error:', e);
  }
}

// 15. CODE BLOCKS & SYNTAX HIGHLIGHTING
async function handleCodeBlocks(results) {
  try {
    let count = 0;

    // Ensure code blocks are visible and properly formatted
    const codeBlocks = document.querySelectorAll(
      'pre, code, .code-block, .highlight, ' +
      '[class*="language-"], [class*="hljs"]'
    );

    codeBlocks.forEach(block => {
      try {
        block.style.overflow = 'visible';
        block.style.maxHeight = 'none';
        block.style.whiteSpace = 'pre-wrap';
        block.style.wordBreak = 'break-word';

        // Ensure line numbers are visible if present
        const lineNumbers = block.querySelector('.line-numbers, .linenos');
        if (lineNumbers) {
          lineNumbers.style.display = 'inline-block';
        }

        count++;
      } catch (e) {
        results.errors.push({ pattern: 'code-block', element: block, error: e.message });
      }
    });

    results.patterns.push({ type: 'code-blocks', count });
    results.totalProcessed += count;
  } catch (e) {
    console.error('[UX] Code block handler error:', e);
  }
}

// 16. CHARTS & GRAPHS
async function handleCharts(results) {
  try {
    let count = 0;

    // Common chart libraries
    const charts = document.querySelectorAll(
      'canvas[id*="chart"], canvas[class*="chart"], ' +
      '.chart, .graph, [class*="chart"], ' +
      '.highcharts-container, .d3-chart, .chartjs-render-monitor, ' +
      '.apexcharts-canvas, .echarts, .plotly'
    );

    charts.forEach(chart => {
      try {
        // Ensure chart is visible
        chart.style.display = 'block';
        chart.style.visibility = 'visible';

        // Add info about chart
        const info = document.createElement('div');
        info.style.cssText = `
          background: #28a745;
          color: white;
          padding: 10px;
          margin: 10px 0;
          border-radius: 4px;
        `;
        info.textContent = 'Interactive Chart/Graph (captured as static image)';
        chart.parentNode.insertBefore(info, chart);

        count++;
      } catch (e) {
        results.errors.push({ pattern: 'chart', element: chart, error: e.message });
      }
    });

    results.patterns.push({ type: 'charts', count });
    results.totalProcessed += count;
  } catch (e) {
    console.error('[UX] Chart handler error:', e);
  }
}

// 17. MAPS
async function handleMaps(results) {
  try {
    let count = 0;

    // Common map containers
    const maps = document.querySelectorAll(
      '#map, .map, [class*="map"], [id*="map"], ' +
      '.gm-style, .leaflet-container, .mapboxgl-map, ' +
      '.ol-viewport, .cesium-viewer'
    );

    maps.forEach(map => {
      try {
        // Ensure map is visible
        map.style.display = 'block';
        map.style.visibility = 'visible';
        map.style.minHeight = '400px';

        // Add info about map
        const info = document.createElement('div');
        info.style.cssText = `
          background: #17a2b8;
          color: white;
          padding: 10px;
          margin: 10px 0;
          border-radius: 4px;
        `;
        info.textContent = 'Interactive Map (captured as static view)';
        map.parentNode.insertBefore(info, map);

        count++;
      } catch (e) {
        results.errors.push({ pattern: 'map', element: map, error: e.message });
      }
    });

    results.patterns.push({ type: 'maps', count });
    results.totalProcessed += count;
  } catch (e) {
    console.error('[UX] Map handler error:', e);
  }
}

// 18. TIMELINES
async function handleTimelines(results) {
  try {
    let count = 0;

    const timelines = document.querySelectorAll(
      '.timeline, [class*="timeline"], .chronology, ' +
      '.history, .roadmap'
    );

    timelines.forEach(timeline => {
      try {
        // Expand all timeline items
        const items = timeline.querySelectorAll(
          '.timeline-item, .timeline-event, [class*="timeline-"]'
        );

        items.forEach(item => {
          item.style.display = 'block';
          item.style.visibility = 'visible';
          item.style.opacity = '1';
        });

        // Ensure timeline is fully visible
        timeline.style.height = 'auto';
        timeline.style.overflow = 'visible';

        count++;
      } catch (e) {
        results.errors.push({ pattern: 'timeline', element: timeline, error: e.message });
      }
    });

    results.patterns.push({ type: 'timelines', count });
    results.totalProcessed += count;
  } catch (e) {
    console.error('[UX] Timeline handler error:', e);
  }
}

// 19. COMMENTS & DISCUSSIONS
async function handleComments(results) {
  try {
    let count = 0;

    // Expand comment sections
    const commentSections = document.querySelectorAll(
      '.comments, .comment-section, #comments, ' +
      '.discussion, [class*="comment"], ' +
      '.disqus-thread, #disqus_thread'
    );

    commentSections.forEach(section => {
      try {
        section.style.display = 'block';
        section.style.visibility = 'visible';

        // Expand collapsed comments
        const showMoreButtons = section.querySelectorAll(
          '.show-more, .load-more, [class*="more"], ' +
          'button[class*="expand"], a[class*="more"]'
        );

        showMoreButtons.forEach(btn => {
          if (btn.click) btn.click();
        });

        // Show hidden replies
        const replies = section.querySelectorAll(
          '.replies, .comment-replies, [class*="reply"]'
        );
        replies.forEach(reply => {
          reply.style.display = 'block';
        });

        count++;
      } catch (e) {
        results.errors.push({ pattern: 'comments', element: section, error: e.message });
      }
    });

    results.patterns.push({ type: 'comments', count });
    results.totalProcessed += count;
  } catch (e) {
    console.error('[UX] Comments handler error:', e);
  }
}

// 20. RATINGS & REVIEWS
async function handleRatings(results) {
  try {
    let count = 0;

    const ratings = document.querySelectorAll(
      '.rating, .stars, .review, [class*="rating"], ' +
      '[class*="star"], .score'
    );

    ratings.forEach(rating => {
      try {
        rating.style.display = 'block';
        rating.style.visibility = 'visible';

        // Ensure star icons are visible
        const stars = rating.querySelectorAll(
          '.star, .fa-star, [class*="star"]'
        );
        stars.forEach(star => {
          star.style.display = 'inline-block';
          star.style.visibility = 'visible';
        });

        count++;
      } catch (e) {
        results.errors.push({ pattern: 'rating', element: rating, error: e.message });
      }
    });

    results.patterns.push({ type: 'ratings', count });
    results.totalProcessed += count;
  } catch (e) {
    console.error('[UX] Ratings handler error:', e);
  }
}

// Export additional utility functions
export {
  handleAccordionsAndCollapsibles,
  handleTabsAndTabPanels,
  handleModalsAndDialogs,
  handleDropdownsAndMenus,
  handleTooltipsAndPopovers,
  handleImageGalleriesAndLightboxes,
  handleFormsAndInputs,
  handleVideoAndAudioPlayers,
  handleDataTablesAndPagination,
  handleSidebarsAndOffCanvas
};