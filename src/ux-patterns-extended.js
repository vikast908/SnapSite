// Extended UX Pattern Handler - Additional patterns not covered in main handler
// This module handles edge cases and less common but important UX patterns

export async function normalizeExtendedUXPatterns(options = {}) {
  console.log('[UX Extended] Starting extended pattern normalization...');

  const results = {
    patterns: [],
    totalProcessed: 0,
    errors: []
  };

  try {
    // Process all extended patterns
    await handleSearchAndAutocomplete(results);
    await handleCookieBanners(results);
    await handleChatWidgets(results);
    await handleDateTimePickers(results);
    await handleProductViewers(results);
    await handleTogglesSwitches(results);
    await handleFloatingElements(results);
    await handleBreadcrumbs(results);
    await handleVirtualScrolling(results);
    await handlePWAPrompts(results);
    await handleRangeSliders(results);
    await handleSteppers(results);
    await handleTreeViews(results);
    await handleKanbanBoards(results);
    await handleHeatmaps(results);
    await handleCountdowns(results);
    await handleProgressRings(results);
    await handleColorPickers(results);
    await handleFileUploaders(results);
    await handleSignaturePads(results);
    await handleCaptchas(results);
    await handleAdsAndBanners(results);
    await handleNewsletterPopups(results);
    await handleExitIntentPopups(results);
    await handleInfiniteCanvas(results);
    await handleWebGL3D(results);
    await handleAudioVisualizers(results);
    await handleMarkdownEditors(results);
    await handleWYSIWYGEditors(results);
    await handleTerminals(results);

    console.log(`[UX Extended] Processed ${results.totalProcessed} extended patterns`);
  } catch (e) {
    console.error('[UX Extended] Fatal error:', e);
    results.errors.push({ pattern: 'extended-global', error: e.message });
  }

  return results;
}

// 1. SEARCH & AUTOCOMPLETE
async function handleSearchAndAutocomplete(results) {
  try {
    let count = 0;

    // Find search interfaces
    const searchElements = document.querySelectorAll(
      'input[type="search"], input[placeholder*="search" i], ' +
      '.search-box, .search-input, [class*="search"], ' +
      '.autocomplete, .typeahead, .search-suggestions'
    );

    searchElements.forEach(element => {
      try {
        // Show search suggestions if hidden
        const suggestions = element.parentElement?.querySelector(
          '.suggestions, .autocomplete-results, .search-results, ' +
          '[class*="suggest"], [class*="autocomplete"]'
        );

        if (suggestions) {
          suggestions.style.display = 'block';
          suggestions.style.visibility = 'visible';
          suggestions.style.opacity = '1';
          suggestions.style.position = 'relative';

          // Add sample suggestions for context
          if (suggestions.children.length === 0) {
            const info = document.createElement('div');
            info.style.cssText = `
              background: #f8f9fa;
              padding: 10px;
              border: 1px solid #dee2e6;
            `;
            info.textContent = 'Search suggestions area (would appear here)';
            suggestions.appendChild(info);
          }
        }

        // Show search filters if present
        const filters = document.querySelectorAll(
          '.search-filter, .filter-panel, [class*="filter"]'
        );
        filters.forEach(filter => {
          filter.style.display = 'block';
          filter.classList.remove('hidden', 'collapsed');
        });

        count++;
      } catch (e) {
        results.errors.push({ pattern: 'search', element, error: e.message });
      }
    });

    results.patterns.push({ type: 'search-autocomplete', count });
    results.totalProcessed += count;
  } catch (e) {
    console.error('[UX Extended] Search handler error:', e);
  }
}

// 2. COOKIE BANNERS & GDPR
async function handleCookieBanners(results) {
  try {
    let count = 0;

    const cookieBanners = document.querySelectorAll(
      '.cookie-banner, .cookie-consent, .gdpr-banner, ' +
      '#cookie-notice, [class*="cookie"], [class*="gdpr"], ' +
      '.privacy-banner, .consent-banner, [id*="consent"]'
    );

    cookieBanners.forEach(banner => {
      try {
        // Keep banner but make it less intrusive
        banner.style.position = 'relative';
        banner.style.bottom = 'auto';
        banner.style.top = 'auto';
        banner.style.zIndex = '1';
        banner.style.opacity = '0.9';

        // Add notice that this was a cookie banner
        const label = document.createElement('div');
        label.style.cssText = `
          background: #ffc107;
          color: #000;
          padding: 5px 10px;
          font-size: 12px;
          font-weight: bold;
        `;
        label.textContent = '⚠️ Cookie/GDPR Notice';
        banner.insertBefore(label, banner.firstChild);

        count++;
      } catch (e) {
        results.errors.push({ pattern: 'cookie-banner', element: banner, error: e.message });
      }
    });

    results.patterns.push({ type: 'cookie-banners', count });
    results.totalProcessed += count;
  } catch (e) {
    console.error('[UX Extended] Cookie banner handler error:', e);
  }
}

// 3. CHAT WIDGETS
async function handleChatWidgets(results) {
  try {
    let count = 0;

    const chatWidgets = document.querySelectorAll(
      '.chat-widget, .live-chat, #chat-widget, ' +
      '[class*="intercom"], [class*="zendesk"], [class*="tawk"], ' +
      '[class*="crisp"], [class*="drift"], [class*="freshchat"], ' +
      '.fb-customerchat, .chatbot, [class*="messenger"]'
    );

    chatWidgets.forEach(widget => {
      try {
        // Make chat widget visible but not obtrusive
        widget.style.position = 'relative';
        widget.style.display = 'block';
        widget.style.visibility = 'visible';
        widget.style.bottom = 'auto';
        widget.style.right = 'auto';
        widget.style.zIndex = '1';

        // Expand if minimized
        widget.classList.remove('minimized', 'collapsed', 'hidden');
        widget.classList.add('expanded', 'open');

        // Add chat widget indicator
        const info = document.createElement('div');
        info.style.cssText = `
          background: #4CAF50;
          color: white;
          padding: 10px;
          margin: 10px 0;
          border-radius: 20px;
        `;
        info.textContent = '💬 Chat Widget (captured in expanded state)';
        widget.parentNode?.insertBefore(info, widget);

        count++;
      } catch (e) {
        results.errors.push({ pattern: 'chat-widget', element: widget, error: e.message });
      }
    });

    results.patterns.push({ type: 'chat-widgets', count });
    results.totalProcessed += count;
  } catch (e) {
    console.error('[UX Extended] Chat widget handler error:', e);
  }
}

// 4. DATE/TIME PICKERS & CALENDARS
async function handleDateTimePickers(results) {
  try {
    let count = 0;

    // Find date/time inputs and calendars
    const dateElements = document.querySelectorAll(
      'input[type="date"], input[type="datetime-local"], input[type="time"], ' +
      'input[type="month"], input[type="week"], ' +
      '.datepicker, .calendar, .date-picker, ' +
      '[class*="picker"], [class*="calendar"], ' +
      '.flatpickr-calendar, .react-datepicker'
    );

    dateElements.forEach(element => {
      try {
        // Show calendar dropdowns
        const calendar = element.parentElement?.querySelector(
          '.calendar-dropdown, .picker-dropdown, [class*="calendar"]'
        ) || document.querySelector('.flatpickr-calendar, .react-datepicker-popper');

        if (calendar) {
          calendar.style.display = 'block';
          calendar.style.visibility = 'visible';
          calendar.style.position = 'relative';
          calendar.style.opacity = '1';
        }

        // Add date picker info
        if (element.tagName === 'INPUT') {
          const info = document.createElement('div');
          info.style.cssText = `
            background: #e3f2fd;
            padding: 5px;
            margin: 5px 0;
            font-size: 12px;
            border-left: 3px solid #2196F3;
          `;
          info.textContent = `📅 Date/Time Input: ${element.value || 'No value set'}`;
          element.parentNode?.insertBefore(info, element.nextSibling);
        }

        count++;
      } catch (e) {
        results.errors.push({ pattern: 'date-picker', element, error: e.message });
      }
    });

    results.patterns.push({ type: 'date-time-pickers', count });
    results.totalProcessed += count;
  } catch (e) {
    console.error('[UX Extended] Date picker handler error:', e);
  }
}

// 5. PRODUCT VIEWERS (360°, ZOOM)
async function handleProductViewers(results) {
  try {
    let count = 0;

    const productViewers = document.querySelectorAll(
      '.product-zoom, .image-zoom, .zoom-container, ' +
      '[class*="360"], [class*="viewer"], [class*="zoom"], ' +
      '.magic-zoom, .cloud-zoom, .elevate-zoom'
    );

    productViewers.forEach(viewer => {
      try {
        // Show zoomed version if available
        const zoomedImage = viewer.querySelector(
          'img[data-zoom], img[data-large], .zoom-image'
        );

        if (zoomedImage) {
          const largeUrl = zoomedImage.getAttribute('data-zoom') ||
                          zoomedImage.getAttribute('data-large');

          if (largeUrl) {
            // Create a visible zoomed version
            const zoomDisplay = document.createElement('div');
            zoomDisplay.style.cssText = `
              border: 2px solid #4CAF50;
              padding: 10px;
              margin: 10px 0;
              background: #f5f5f5;
            `;

            const img = document.createElement('img');
            img.src = largeUrl;
            img.style.cssText = 'max-width: 100%; height: auto;';

            const label = document.createElement('div');
            label.style.cssText = `
              background: #4CAF50;
              color: white;
              padding: 5px;
              margin-bottom: 10px;
            `;
            label.textContent = '🔍 Zoomed/High-resolution version';

            zoomDisplay.appendChild(label);
            zoomDisplay.appendChild(img);
            viewer.parentNode?.insertBefore(zoomDisplay, viewer.nextSibling);
          }
        }

        // Handle 360 viewers
        if (viewer.className.includes('360')) {
          const info = document.createElement('div');
          info.style.cssText = `
            background: #9C27B0;
            color: white;
            padding: 10px;
            margin: 10px 0;
          `;
          info.textContent = '🔄 360° Product View (captured as static image)';
          viewer.parentNode?.insertBefore(info, viewer);
        }

        count++;
      } catch (e) {
        results.errors.push({ pattern: 'product-viewer', element: viewer, error: e.message });
      }
    });

    results.patterns.push({ type: 'product-viewers', count });
    results.totalProcessed += count;
  } catch (e) {
    console.error('[UX Extended] Product viewer handler error:', e);
  }
}

// 6. TOGGLES & SWITCHES
async function handleTogglesSwitches(results) {
  try {
    let count = 0;

    const toggles = document.querySelectorAll(
      'input[type="checkbox"], input[type="radio"], ' +
      '.toggle, .switch, .toggle-switch, ' +
      '[class*="toggle"], [class*="switch"], ' +
      '.custom-control-input, .form-check-input'
    );

    toggles.forEach(toggle => {
      try {
        // Add visual indicator of state
        if (toggle.tagName === 'INPUT') {
          const state = toggle.checked ? 'ON' : 'OFF';
          const type = toggle.type;

          const indicator = document.createElement('span');
          indicator.style.cssText = `
            display: inline-block;
            background: ${toggle.checked ? '#4CAF50' : '#f44336'};
            color: white;
            padding: 2px 6px;
            margin-left: 5px;
            border-radius: 3px;
            font-size: 11px;
            font-weight: bold;
          `;
          indicator.textContent = `${type.toUpperCase()}: ${state}`;

          if (toggle.parentNode) {
            toggle.parentNode.insertBefore(indicator, toggle.nextSibling);
          }
        }

        count++;
      } catch (e) {
        results.errors.push({ pattern: 'toggle', element: toggle, error: e.message });
      }
    });

    results.patterns.push({ type: 'toggles-switches', count });
    results.totalProcessed += count;
  } catch (e) {
    console.error('[UX Extended] Toggle handler error:', e);
  }
}

// 7. FLOATING ACTION BUTTONS
async function handleFloatingElements(results) {
  try {
    let count = 0;

    const floatingElements = document.querySelectorAll(
      '.fab, .floating-action-button, .float-button, ' +
      '[class*="floating"], [class*="fab-"], ' +
      '.back-to-top, .scroll-to-top, .goto-top'
    );

    floatingElements.forEach(element => {
      try {
        // Convert floating to inline
        element.style.position = 'relative';
        element.style.bottom = 'auto';
        element.style.right = 'auto';
        element.style.top = 'auto';
        element.style.left = 'auto';
        element.style.zIndex = 'auto';

        // Add indicator
        element.setAttribute('data-was-floating', 'true');

        const info = document.createElement('div');
        info.style.cssText = `
          background: #FF5722;
          color: white;
          padding: 5px 10px;
          margin: 10px 0;
          border-radius: 20px;
          display: inline-block;
        `;
        info.textContent = '⬆️ Floating Button (normally fixed position)';
        element.parentNode?.insertBefore(info, element);

        count++;
      } catch (e) {
        results.errors.push({ pattern: 'floating-element', element, error: e.message });
      }
    });

    results.patterns.push({ type: 'floating-elements', count });
    results.totalProcessed += count;
  } catch (e) {
    console.error('[UX Extended] Floating element handler error:', e);
  }
}

// 8. BREADCRUMBS
async function handleBreadcrumbs(results) {
  try {
    let count = 0;

    const breadcrumbs = document.querySelectorAll(
      '.breadcrumb, .breadcrumbs, nav[aria-label*="breadcrumb"], ' +
      '[class*="breadcrumb"], .navigation-path'
    );

    breadcrumbs.forEach(breadcrumb => {
      try {
        // Ensure breadcrumbs are visible
        breadcrumb.style.display = 'block';
        breadcrumb.style.visibility = 'visible';

        // Add visual enhancement
        breadcrumb.style.background = '#f8f9fa';
        breadcrumb.style.padding = '10px';
        breadcrumb.style.borderRadius = '4px';
        breadcrumb.style.marginBottom = '20px';

        count++;
      } catch (e) {
        results.errors.push({ pattern: 'breadcrumb', element: breadcrumb, error: e.message });
      }
    });

    results.patterns.push({ type: 'breadcrumbs', count });
    results.totalProcessed += count;
  } catch (e) {
    console.error('[UX Extended] Breadcrumb handler error:', e);
  }
}

// 9. VIRTUAL SCROLLING
async function handleVirtualScrolling(results) {
  try {
    let count = 0;

    // Detect virtual scrolling containers
    const virtualScrolls = document.querySelectorAll(
      '.virtual-scroll, .virtual-list, .infinite-list, ' +
      '[class*="virtual"], .react-window, .vue-virtual-scroller'
    );

    virtualScrolls.forEach(container => {
      try {
        // Try to expand virtual scroll containers
        container.style.height = 'auto';
        container.style.maxHeight = 'none';
        container.style.overflow = 'visible';

        // Force render all items if possible
        const items = container.querySelectorAll('[role="row"], .list-item, .virtual-item');
        items.forEach(item => {
          item.style.display = 'block';
          item.style.visibility = 'visible';
        });

        // Add notice
        const info = document.createElement('div');
        info.style.cssText = `
          background: #3F51B5;
          color: white;
          padding: 10px;
          margin: 10px 0;
        `;
        info.textContent = '📜 Virtual Scrolling Container (showing available items)';
        container.parentNode?.insertBefore(info, container);

        count++;
      } catch (e) {
        results.errors.push({ pattern: 'virtual-scroll', element: container, error: e.message });
      }
    });

    results.patterns.push({ type: 'virtual-scrolling', count });
    results.totalProcessed += count;
  } catch (e) {
    console.error('[UX Extended] Virtual scrolling handler error:', e);
  }
}

// 10. PWA INSTALL PROMPTS
async function handlePWAPrompts(results) {
  try {
    let count = 0;

    const pwaPrompts = document.querySelectorAll(
      '.pwa-prompt, .install-prompt, .add-to-homescreen, ' +
      '[class*="install"], [class*="a2hs"]'
    );

    pwaPrompts.forEach(prompt => {
      try {
        // Make PWA prompts visible but not blocking
        prompt.style.position = 'relative';
        prompt.style.display = 'block';
        prompt.style.zIndex = '1';

        const label = document.createElement('div');
        label.style.cssText = `
          background: #673AB7;
          color: white;
          padding: 5px 10px;
          font-size: 12px;
        `;
        label.textContent = '📱 PWA Install Prompt';
        prompt.insertBefore(label, prompt.firstChild);

        count++;
      } catch (e) {
        results.errors.push({ pattern: 'pwa-prompt', element: prompt, error: e.message });
      }
    });

    results.patterns.push({ type: 'pwa-prompts', count });
    results.totalProcessed += count;
  } catch (e) {
    console.error('[UX Extended] PWA prompt handler error:', e);
  }
}

// 11. RANGE SLIDERS
async function handleRangeSliders(results) {
  try {
    let count = 0;

    const sliders = document.querySelectorAll(
      'input[type="range"], .range-slider, .slider-input, ' +
      '[class*="slider"], .noUiSlider, .rc-slider'
    );

    sliders.forEach(slider => {
      try {
        if (slider.tagName === 'INPUT' && slider.type === 'range') {
          const value = slider.value || slider.getAttribute('value') || '50';
          const min = slider.min || '0';
          const max = slider.max || '100';

          const info = document.createElement('div');
          info.style.cssText = `
            background: #FFC107;
            padding: 5px;
            margin: 5px 0;
            font-size: 12px;
            border-radius: 3px;
          `;
          info.textContent = `🎚️ Range: ${value} (${min}-${max})`;
          slider.parentNode?.insertBefore(info, slider.nextSibling);
        }

        count++;
      } catch (e) {
        results.errors.push({ pattern: 'range-slider', element: slider, error: e.message });
      }
    });

    results.patterns.push({ type: 'range-sliders', count });
    results.totalProcessed += count;
  } catch (e) {
    console.error('[UX Extended] Range slider handler error:', e);
  }
}

// 12. STEPPERS & WIZARDS
async function handleSteppers(results) {
  try {
    let count = 0;

    const steppers = document.querySelectorAll(
      '.stepper, .wizard, .steps, .step-wizard, ' +
      '[class*="stepper"], [class*="wizard"], ' +
      '.mat-stepper, .bs-stepper'
    );

    steppers.forEach(stepper => {
      try {
        // Show all steps
        const steps = stepper.querySelectorAll(
          '.step, .wizard-step, [class*="step-"]'
        );

        steps.forEach((step, index) => {
          step.style.display = 'block';
          step.style.visibility = 'visible';
          step.style.opacity = '1';

          // Add step number
          const stepIndicator = document.createElement('div');
          stepIndicator.style.cssText = `
            background: linear-gradient(45deg, #2196F3, #4CAF50);
            color: white;
            padding: 10px 15px;
            margin: 10px 0;
            border-radius: 25px;
            display: inline-block;
            font-weight: bold;
          `;
          stepIndicator.textContent = `Step ${index + 1}`;
          step.insertBefore(stepIndicator, step.firstChild);
        });

        count++;
      } catch (e) {
        results.errors.push({ pattern: 'stepper', element: stepper, error: e.message });
      }
    });

    results.patterns.push({ type: 'steppers', count });
    results.totalProcessed += count;
  } catch (e) {
    console.error('[UX Extended] Stepper handler error:', e);
  }
}

// 13. TREE VIEWS
async function handleTreeViews(results) {
  try {
    let count = 0;

    const trees = document.querySelectorAll(
      '.tree, .tree-view, .treeview, [class*="tree"], ' +
      '.jstree, .fancytree, ul[role="tree"]'
    );

    trees.forEach(tree => {
      try {
        // Expand all tree nodes
        const nodes = tree.querySelectorAll(
          '.tree-node, .tree-item, li[role="treeitem"], ' +
          '[class*="node"], [class*="branch"]'
        );

        nodes.forEach(node => {
          node.classList.remove('collapsed', 'closed');
          node.classList.add('expanded', 'open');

          // Show children
          const children = node.querySelector('ul, .children, .tree-children');
          if (children) {
            children.style.display = 'block';
            children.style.visibility = 'visible';
          }
        });

        // Add tree indicator
        tree.style.border = '1px solid #4CAF50';
        tree.style.padding = '10px';
        tree.style.background = '#f1f8f4';

        count++;
      } catch (e) {
        results.errors.push({ pattern: 'tree-view', element: tree, error: e.message });
      }
    });

    results.patterns.push({ type: 'tree-views', count });
    results.totalProcessed += count;
  } catch (e) {
    console.error('[UX Extended] Tree view handler error:', e);
  }
}

// 14. KANBAN BOARDS
async function handleKanbanBoards(results) {
  try {
    let count = 0;

    const kanbanBoards = document.querySelectorAll(
      '.kanban, .kanban-board, .board, [class*="kanban"], ' +
      '.trello-board, .task-board'
    );

    kanbanBoards.forEach(board => {
      try {
        // Ensure all columns are visible
        const columns = board.querySelectorAll(
          '.kanban-column, .board-column, .list, [class*="column"]'
        );

        columns.forEach(column => {
          column.style.display = 'inline-block';
          column.style.visibility = 'visible';
          column.style.verticalAlign = 'top';
          column.style.minWidth = '250px';
          column.style.margin = '10px';
        });

        // Show all cards
        const cards = board.querySelectorAll(
          '.kanban-card, .card, .task, [class*="card"]'
        );

        cards.forEach(card => {
          card.style.display = 'block';
          card.style.visibility = 'visible';
        });

        count++;
      } catch (e) {
        results.errors.push({ pattern: 'kanban', element: board, error: e.message });
      }
    });

    results.patterns.push({ type: 'kanban-boards', count });
    results.totalProcessed += count;
  } catch (e) {
    console.error('[UX Extended] Kanban board handler error:', e);
  }
}

// Additional pattern handlers...

// 15. HEATMAPS
async function handleHeatmaps(results) {
  try {
    let count = 0;
    const heatmaps = document.querySelectorAll('.heatmap, [class*="heatmap"], .heat-map');
    heatmaps.forEach(heatmap => {
      heatmap.style.display = 'block';
      heatmap.style.visibility = 'visible';
      count++;
    });
    results.patterns.push({ type: 'heatmaps', count });
    results.totalProcessed += count;
  } catch (e) {
    console.error('[UX Extended] Heatmap handler error:', e);
  }
}

// 16. COUNTDOWNS
async function handleCountdowns(results) {
  try {
    let count = 0;
    const countdowns = document.querySelectorAll(
      '.countdown, .timer, [class*="countdown"], [class*="timer"]'
    );
    countdowns.forEach(countdown => {
      // Add static time display
      const info = document.createElement('div');
      info.style.cssText = 'background: #FF5722; color: white; padding: 5px; margin: 5px 0;';
      info.textContent = `⏰ Countdown Timer (captured at current state)`;
      countdown.parentNode?.insertBefore(info, countdown);
      count++;
    });
    results.patterns.push({ type: 'countdowns', count });
    results.totalProcessed += count;
  } catch (e) {
    console.error('[UX Extended] Countdown handler error:', e);
  }
}

// 17. PROGRESS RINGS
async function handleProgressRings(results) {
  try {
    let count = 0;
    const progressRings = document.querySelectorAll(
      '.progress-ring, .progress-circle, .circular-progress, ' +
      'circle[class*="progress"], svg[class*="progress"]'
    );
    progressRings.forEach(ring => {
      ring.style.display = 'block';
      ring.style.visibility = 'visible';
      count++;
    });
    results.patterns.push({ type: 'progress-rings', count });
    results.totalProcessed += count;
  } catch (e) {
    console.error('[UX Extended] Progress ring handler error:', e);
  }
}

// 18. COLOR PICKERS
async function handleColorPickers(results) {
  try {
    let count = 0;
    const colorPickers = document.querySelectorAll(
      'input[type="color"], .color-picker, [class*="color-picker"], ' +
      '.spectrum, .colorpicker'
    );
    colorPickers.forEach(picker => {
      if (picker.tagName === 'INPUT' && picker.type === 'color') {
        const info = document.createElement('span');
        info.style.cssText = `
          display: inline-block;
          width: 20px; height: 20px;
          background: ${picker.value};
          border: 2px solid #000;
          margin-left: 5px;
        `;
        picker.parentNode?.insertBefore(info, picker.nextSibling);
      }
      count++;
    });
    results.patterns.push({ type: 'color-pickers', count });
    results.totalProcessed += count;
  } catch (e) {
    console.error('[UX Extended] Color picker handler error:', e);
  }
}

// 19. FILE UPLOADERS
async function handleFileUploaders(results) {
  try {
    let count = 0;
    const fileUploaders = document.querySelectorAll(
      'input[type="file"], .file-upload, .dropzone, ' +
      '[class*="upload"], [class*="dropzone"]'
    );
    fileUploaders.forEach(uploader => {
      const info = document.createElement('div');
      info.style.cssText = 'background: #9C27B0; color: white; padding: 5px; margin: 5px 0;';
      info.textContent = '📁 File Upload Area';
      uploader.parentNode?.insertBefore(info, uploader);
      count++;
    });
    results.patterns.push({ type: 'file-uploaders', count });
    results.totalProcessed += count;
  } catch (e) {
    console.error('[UX Extended] File uploader handler error:', e);
  }
}

// 20. SIGNATURE PADS
async function handleSignaturePads(results) {
  try {
    let count = 0;
    const signaturePads = document.querySelectorAll(
      '.signature-pad, .signature, canvas[class*="signature"], ' +
      '[class*="signature-pad"]'
    );
    signaturePads.forEach(pad => {
      const info = document.createElement('div');
      info.style.cssText = 'background: #00BCD4; color: white; padding: 5px; margin: 5px 0;';
      info.textContent = '✍️ Signature Pad Area';
      pad.parentNode?.insertBefore(info, pad);
      count++;
    });
    results.patterns.push({ type: 'signature-pads', count });
    results.totalProcessed += count;
  } catch (e) {
    console.error('[UX Extended] Signature pad handler error:', e);
  }
}

// 21. CAPTCHAS
async function handleCaptchas(results) {
  try {
    let count = 0;
    const captchas = document.querySelectorAll(
      '.g-recaptcha, .h-captcha, [class*="captcha"], ' +
      '#recaptcha, iframe[src*="recaptcha"], iframe[src*="hcaptcha"]'
    );
    captchas.forEach(captcha => {
      const info = document.createElement('div');
      info.style.cssText = 'background: #F44336; color: white; padding: 10px; margin: 10px 0;';
      info.textContent = '🤖 CAPTCHA Verification (not functional in capture)';
      captcha.parentNode?.insertBefore(info, captcha);
      count++;
    });
    results.patterns.push({ type: 'captchas', count });
    results.totalProcessed += count;
  } catch (e) {
    console.error('[UX Extended] CAPTCHA handler error:', e);
  }
}

// 22. ADS & BANNERS
async function handleAdsAndBanners(results) {
  try {
    let count = 0;
    const ads = document.querySelectorAll(
      '.ad, .advertisement, .banner-ad, [class*="ad-"], ' +
      'ins.adsbygoogle, iframe[src*="doubleclick"], ' +
      '[id*="google_ads"], [class*="sponsored"]'
    );
    ads.forEach(ad => {
      // Make ads less prominent but visible
      ad.style.opacity = '0.5';
      ad.style.border = '1px dashed #999';

      const label = document.createElement('div');
      label.style.cssText = 'background: #666; color: white; padding: 2px 5px; font-size: 10px;';
      label.textContent = 'Advertisement';
      ad.insertBefore(label, ad.firstChild);
      count++;
    });
    results.patterns.push({ type: 'ads-banners', count });
    results.totalProcessed += count;
  } catch (e) {
    console.error('[UX Extended] Ads handler error:', e);
  }
}

// 23. NEWSLETTER POPUPS
async function handleNewsletterPopups(results) {
  try {
    let count = 0;
    const newsletters = document.querySelectorAll(
      '.newsletter-popup, .subscribe-popup, .email-signup, ' +
      '[class*="newsletter"], [class*="subscribe"], ' +
      '.mailchimp-popup'
    );
    newsletters.forEach(newsletter => {
      newsletter.style.position = 'relative';
      newsletter.style.display = 'block';
      newsletter.style.zIndex = '1';
      newsletter.style.border = '2px solid #4CAF50';
      newsletter.style.margin = '20px 0';
      count++;
    });
    results.patterns.push({ type: 'newsletter-popups', count });
    results.totalProcessed += count;
  } catch (e) {
    console.error('[UX Extended] Newsletter handler error:', e);
  }
}

// 24. EXIT INTENT POPUPS
async function handleExitIntentPopups(results) {
  try {
    let count = 0;
    const exitIntents = document.querySelectorAll(
      '.exit-intent, .exit-popup, [class*="exit-intent"], ' +
      '[data-exit-intent]'
    );
    exitIntents.forEach(popup => {
      popup.style.display = 'block';
      popup.style.position = 'relative';
      popup.style.visibility = 'visible';

      const label = document.createElement('div');
      label.style.cssText = 'background: #FF9800; color: white; padding: 5px;';
      label.textContent = '🚪 Exit Intent Popup';
      popup.insertBefore(label, popup.firstChild);
      count++;
    });
    results.patterns.push({ type: 'exit-intent-popups', count });
    results.totalProcessed += count;
  } catch (e) {
    console.error('[UX Extended] Exit intent handler error:', e);
  }
}

// 25. INFINITE CANVAS
async function handleInfiniteCanvas(results) {
  try {
    let count = 0;
    const canvases = document.querySelectorAll(
      '.infinite-canvas, .drawing-board, .whiteboard, ' +
      'canvas[class*="draw"], canvas[class*="board"]'
    );
    canvases.forEach(canvas => {
      const info = document.createElement('div');
      info.style.cssText = 'background: #795548; color: white; padding: 10px; margin: 10px 0;';
      info.textContent = '🎨 Drawing Canvas (captured as static image)';
      canvas.parentNode?.insertBefore(info, canvas);
      count++;
    });
    results.patterns.push({ type: 'infinite-canvas', count });
    results.totalProcessed += count;
  } catch (e) {
    console.error('[UX Extended] Canvas handler error:', e);
  }
}

// 26. WEBGL/3D VIEWERS
async function handleWebGL3D(results) {
  try {
    let count = 0;
    const webglElements = document.querySelectorAll(
      'canvas[class*="three"], canvas[class*="webgl"], ' +
      '.three-scene, .webgl-content, .3d-viewer'
    );
    webglElements.forEach(element => {
      const info = document.createElement('div');
      info.style.cssText = 'background: #E91E63; color: white; padding: 10px; margin: 10px 0;';
      info.textContent = '🎮 3D/WebGL Content (captured as static view)';
      element.parentNode?.insertBefore(info, element);
      count++;
    });
    results.patterns.push({ type: 'webgl-3d', count });
    results.totalProcessed += count;
  } catch (e) {
    console.error('[UX Extended] WebGL handler error:', e);
  }
}

// 27. AUDIO VISUALIZERS
async function handleAudioVisualizers(results) {
  try {
    let count = 0;
    const visualizers = document.querySelectorAll(
      '.visualizer, .audio-visualizer, .waveform, ' +
      'canvas[class*="visualizer"], [class*="waveform"]'
    );
    visualizers.forEach(viz => {
      const info = document.createElement('div');
      info.style.cssText = 'background: #3F51B5; color: white; padding: 10px; margin: 10px 0;';
      info.textContent = '🎵 Audio Visualizer (captured as static)';
      viz.parentNode?.insertBefore(info, viz);
      count++;
    });
    results.patterns.push({ type: 'audio-visualizers', count });
    results.totalProcessed += count;
  } catch (e) {
    console.error('[UX Extended] Visualizer handler error:', e);
  }
}

// 28. MARKDOWN EDITORS
async function handleMarkdownEditors(results) {
  try {
    let count = 0;
    const editors = document.querySelectorAll(
      '.markdown-editor, .md-editor, .CodeMirror, ' +
      '[class*="markdown"], .simplemde, .easymde'
    );
    editors.forEach(editor => {
      // Show both source and preview if available
      const preview = editor.querySelector('.preview, .markdown-preview');
      if (preview) {
        preview.style.display = 'block';
      }
      count++;
    });
    results.patterns.push({ type: 'markdown-editors', count });
    results.totalProcessed += count;
  } catch (e) {
    console.error('[UX Extended] Markdown editor handler error:', e);
  }
}

// 29. WYSIWYG EDITORS
async function handleWYSIWYGEditors(results) {
  try {
    let count = 0;
    const editors = document.querySelectorAll(
      '.wysiwyg, .rich-text-editor, .ck-editor, ' +
      '.tox-tinymce, .froala-editor, .quill, ' +
      '[contenteditable="true"]'
    );
    editors.forEach(editor => {
      editor.style.minHeight = '200px';
      editor.style.border = '1px solid #ddd';
      editor.style.padding = '10px';
      count++;
    });
    results.patterns.push({ type: 'wysiwyg-editors', count });
    results.totalProcessed += count;
  } catch (e) {
    console.error('[UX Extended] WYSIWYG editor handler error:', e);
  }
}

// 30. TERMINALS/CONSOLES
async function handleTerminals(results) {
  try {
    let count = 0;
    const terminals = document.querySelectorAll(
      '.terminal, .console, .xterm, [class*="terminal"], ' +
      '.command-line, .shell'
    );
    terminals.forEach(terminal => {
      terminal.style.display = 'block';
      terminal.style.background = '#000';
      terminal.style.color = '#0f0';
      terminal.style.fontFamily = 'monospace';
      terminal.style.padding = '10px';
      count++;
    });
    results.patterns.push({ type: 'terminals', count });
    results.totalProcessed += count;
  } catch (e) {
    console.error('[UX Extended] Terminal handler error:', e);
  }
}

// Export all handlers
export {
  handleSearchAndAutocomplete,
  handleCookieBanners,
  handleChatWidgets,
  handleDateTimePickers,
  handleProductViewers,
  handleTogglesSwitches,
  handleFloatingElements,
  handleBreadcrumbs,
  handleVirtualScrolling,
  handlePWAPrompts,
  handleRangeSliders,
  handleSteppers,
  handleTreeViews,
  handleKanbanBoards
};