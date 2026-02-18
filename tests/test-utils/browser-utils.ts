/**
 * @fileoverview Browser test utilities for common browser test operations
 *
 * This module provides comprehensive utilities for browser testing scenarios including:
 * - Mock page objects for testing UI components
 * - DOM structure simulation utilities
 * - Test URL generation for different scenarios
 * - Browser state assertions and validation
 * - Screenshot comparison and visual testing
 * - Network request mocking and interception
 * - Performance measurement utilities
 *
 * @module browser-utils
 */

import type { Page, BrowserContext, Locator, Response } from 'playwright';
import * as fs from 'fs/promises';
import * as path from 'path';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Configuration for mock page objects
 */
export interface MockPageConfig {
  /** URL for the mock page */
  url: string;
  /** Page title */
  title?: string;
  /** HTML content */
  content?: string;
  /** CSS styles */
  styles?: string;
  /** JavaScript code */
  scripts?: string;
  /** Meta tags */
  meta?: Record<string, string>;
  /** Viewport configuration */
  viewport?: { width: number; height: number };
}

/**
 * DOM element mock configuration
 */
export interface MockElementConfig {
  /** Element tag name */
  tag: string;
  /** Element ID */
  id?: string;
  /** Element classes */
  className?: string;
  /** Element text content */
  textContent?: string;
  /** Element HTML content */
  innerHTML?: string;
  /** Element attributes */
  attributes?: Record<string, string>;
  /** Child elements */
  children?: MockElementConfig[];
  /** Custom styles */
  style?: Record<string, string>;
}

/**
 * Test URL configuration options
 */
export interface TestUrlConfig {
  /** Base URL scheme */
  scheme?: 'http' | 'https';
  /** Host name */
  host?: string;
  /** Port number */
  port?: number;
  /** URL path */
  path?: string;
  /** Query parameters */
  query?: Record<string, string>;
  /** URL fragment */
  fragment?: string;
}

/**
 * Browser state assertion configuration
 */
export interface BrowserStateConfig {
  /** Expected page title */
  title?: string;
  /** Expected URL pattern */
  url?: string | RegExp;
  /** Expected elements to be present */
  elementsPresent?: string[];
  /** Expected elements to be absent */
  elementsAbsent?: string[];
  /** Expected text content */
  textContent?: Array<{ selector: string; text: string | RegExp }>;
  /** Expected attributes */
  attributes?: Array<{ selector: string; attribute: string; value: string | RegExp }>;
  /** Expected styles */
  styles?: Array<{ selector: string; property: string; value: string | RegExp }>;
  /** Network state expectations */
  network?: {
    idle?: boolean;
    pendingRequests?: number;
    failedRequests?: number;
  };
}

/**
 * Screenshot comparison configuration
 */
export interface ScreenshotCompareConfig {
  /** Threshold for pixel differences (0-1) */
  threshold?: number;
  /** Include only specific regions */
  clip?: { x: number; y: number; width: number; height: number };
  /** Mask specific elements */
  mask?: string[];
  /** Disable animations during screenshot */
  disableAnimations?: boolean;
  /** Wait for specific conditions before screenshot */
  waitFor?: string | (() => Promise<boolean>);
}

/**
 * Mock network request configuration
 */
export interface MockRequestConfig {
  /** URL pattern to match */
  pattern: string | RegExp;
  /** HTTP method */
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  /** Response status */
  status?: number;
  /** Response headers */
  headers?: Record<string, string>;
  /** Response body */
  body?: string | object;
  /** Response delay in ms */
  delay?: number;
  /** Whether to fail the request */
  fail?: boolean;
}

/**
 * Performance measurement result
 */
export interface PerformanceMeasurement {
  /** Start timestamp */
  startTime: number;
  /** End timestamp */
  endTime: number;
  /** Total duration in ms */
  duration: number;
  /** Navigation timing metrics */
  timing?: {
    domContentLoaded: number;
    loadComplete: number;
    firstPaint: number;
    firstContentfulPaint: number;
    largestContentfulPaint: number;
  };
  /** Resource loading metrics */
  resources?: Array<{
    name: string;
    type: string;
    size: number;
    duration: number;
  }>;
  /** Memory usage metrics */
  memory?: {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  };
}

// ============================================================================
// Mock Page Object Utilities
// ============================================================================

/**
 * Create a mock page with predefined content and behavior
 */
export async function createMockPage(page: Page, config: MockPageConfig): Promise<void> {
  const {
    url,
    title = 'Mock Test Page',
    content = '',
    styles = '',
    scripts = '',
    meta = {},
    viewport
  } = config;

  // Set viewport if specified
  if (viewport) {
    await page.setViewportSize(viewport);
  }

  // Build HTML content
  const metaTags = Object.entries(meta)
    .map(([name, content]) => `<meta name="${name}" content="${content}">`)
    .join('\n  ');

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  ${metaTags}
  <style>
    body {
      margin: 0;
      padding: 20px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #333;
    }
    .test-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
    }
    ${styles}
  </style>
</head>
<body>
  <div class="test-container">
    ${content}
  </div>
  <script>
    // Test helper functions
    window.__testHelpers = {
      triggerEvent: function(selector, eventType) {
        const element = document.querySelector(selector);
        if (element) {
          const event = new Event(eventType, { bubbles: true });
          element.dispatchEvent(event);
        }
      },

      setInputValue: function(selector, value) {
        const element = document.querySelector(selector);
        if (element) {
          element.value = value;
          element.dispatchEvent(new Event('input', { bubbles: true }));
          element.dispatchEvent(new Event('change', { bubbles: true }));
        }
      },

      getComputedStyle: function(selector, property) {
        const element = document.querySelector(selector);
        if (element) {
          return window.getComputedStyle(element).getPropertyValue(property);
        }
        return null;
      }
    };

    ${scripts}
  </script>
</body>
</html>`;

  // Navigate to the URL and set content
  await page.goto(url);
  await page.setContent(html, { waitUntil: 'domcontentloaded' });
}

/**
 * Create mock DOM structure from configuration
 */
export function createMockDOMStructure(elements: MockElementConfig[]): string {
  function renderElement(config: MockElementConfig): string {
    const { tag, id, className, textContent, innerHTML, attributes = {}, children = [], style = {} } = config;

    const attrs: string[] = [];
    if (id) attrs.push(`id="${id}"`);
    if (className) attrs.push(`class="${className}"`);

    // Add custom attributes
    Object.entries(attributes).forEach(([key, value]) => {
      attrs.push(`${key}="${value}"`);
    });

    // Add inline styles
    const styleEntries = Object.entries(style);
    if (styleEntries.length > 0) {
      const styleStr = styleEntries.map(([prop, value]) => `${prop}: ${value}`).join('; ');
      attrs.push(`style="${styleStr}"`);
    }

    const attrStr = attrs.length > 0 ? ' ' + attrs.join(' ') : '';

    // Handle self-closing tags
    const selfClosingTags = ['br', 'hr', 'img', 'input', 'meta', 'link'];
    if (selfClosingTags.includes(tag)) {
      return `<${tag}${attrStr} />`;
    }

    // Handle content
    const content = innerHTML || textContent || children.map(renderElement).join('');

    return `<${tag}${attrStr}>${content}</${tag}>`;
  }

  return elements.map(renderElement).join('\n');
}

/**
 * Common mock page objects for testing
 */
export const mockPageObjects = {
  /**
   * Create a form page for testing form interactions
   */
  async createFormPage(page: Page, options: {
    fields?: Array<{ name: string; type: string; label: string; required?: boolean }>;
    submitUrl?: string;
  } = {}): Promise<void> {
    const { fields = [], submitUrl = '/submit' } = options;

    const fieldHTML = fields.map(field => `
      <div class="form-field">
        <label for="${field.name}">${field.label}${field.required ? ' *' : ''}</label>
        <input
          type="${field.type}"
          id="${field.name}"
          name="${field.name}"
          ${field.required ? 'required' : ''}
          data-testid="${field.name}-input"
        />
      </div>
    `).join('');

    await createMockPage(page, {
      url: 'http://localhost:3000/form',
      title: 'Test Form Page',
      content: `
        <h1>Test Form</h1>
        <form id="test-form" action="${submitUrl}" method="post">
          ${fieldHTML}
          <div class="form-actions">
            <button type="submit" data-testid="submit-button">Submit</button>
            <button type="reset" data-testid="reset-button">Reset</button>
          </div>
        </form>
        <div id="form-result" data-testid="form-result"></div>
      `,
      styles: `
        .form-field { margin-bottom: 1rem; }
        label { display: block; margin-bottom: 0.25rem; font-weight: bold; }
        input { width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px; }
        .form-actions { margin-top: 1rem; }
        button { margin-right: 0.5rem; padding: 0.75rem 1.5rem; }
      `,
      scripts: `
        document.getElementById('test-form').addEventListener('submit', function(e) {
          e.preventDefault();
          const formData = new FormData(this);
          const result = Object.fromEntries(formData.entries());
          document.getElementById('form-result').textContent = JSON.stringify(result, null, 2);
        });
      `
    });
  },

  /**
   * Create a navigation page for testing menu interactions
   */
  async createNavigationPage(page: Page, options: {
    menuItems?: Array<{ label: string; href: string; submenu?: Array<{ label: string; href: string }> }>;
  } = {}): Promise<void> {
    const { menuItems = [] } = options;

    const menuHTML = menuItems.map(item => {
      const submenuHTML = item.submenu ? `
        <ul class="submenu">
          ${item.submenu.map(sub => `<li><a href="${sub.href}">${sub.label}</a></li>`).join('')}
        </ul>
      ` : '';

      return `
        <li class="menu-item${item.submenu ? ' has-submenu' : ''}">
          <a href="${item.href}" data-testid="menu-${item.label.toLowerCase().replace(/\s+/g, '-')}">${item.label}</a>
          ${submenuHTML}
        </li>
      `;
    }).join('');

    await createMockPage(page, {
      url: 'http://localhost:3000/navigation',
      title: 'Test Navigation Page',
      content: `
        <nav class="main-nav">
          <div class="nav-brand">
            <a href="/" data-testid="brand-link">Test Site</a>
          </div>
          <ul class="nav-menu">
            ${menuHTML}
          </ul>
          <div class="nav-toggle" data-testid="nav-toggle">☰</div>
        </nav>
        <main class="content">
          <h1>Navigation Test Page</h1>
          <div id="current-page" data-testid="current-page">Home</div>
        </main>
      `,
      styles: `
        .main-nav { display: flex; justify-content: space-between; align-items: center; padding: 1rem; background: #f8f9fa; }
        .nav-menu { list-style: none; margin: 0; padding: 0; display: flex; }
        .menu-item { position: relative; margin-right: 1rem; }
        .menu-item a { text-decoration: none; padding: 0.5rem 1rem; display: block; }
        .submenu { position: absolute; top: 100%; left: 0; display: none; background: white; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .has-submenu:hover .submenu { display: block; }
        .nav-toggle { display: none; cursor: pointer; }
        @media (max-width: 768px) {
          .nav-menu { display: none; }
          .nav-toggle { display: block; }
        }
      `,
      scripts: `
        document.addEventListener('click', function(e) {
          if (e.target.tagName === 'A' && e.target.href) {
            e.preventDefault();
            document.getElementById('current-page').textContent = e.target.textContent;
          }
        });
      `
    });
  },

  /**
   * Create a data table page for testing table interactions
   */
  async createDataTablePage(page: Page, options: {
    columns?: string[];
    data?: Array<Record<string, string>>;
    sortable?: boolean;
    filterable?: boolean;
  } = {}): Promise<void> {
    const {
      columns = ['Name', 'Email', 'Role'],
      data = [],
      sortable = true,
      filterable = true
    } = options;

    const headerHTML = columns.map(col =>
      `<th ${sortable ? `class="sortable" data-column="${col.toLowerCase()}"` : ''}>${col}</th>`
    ).join('');

    const rowsHTML = data.map((row, index) => `
      <tr data-testid="table-row-${index}">
        ${columns.map(col => `<td data-testid="${col.toLowerCase()}-${index}">${row[col.toLowerCase()] || ''}</td>`).join('')}
      </tr>
    `).join('');

    const filterHTML = filterable ? `
      <div class="table-filters">
        <input
          type="text"
          id="table-filter"
          placeholder="Filter table..."
          data-testid="table-filter"
        />
      </div>
    ` : '';

    await createMockPage(page, {
      url: 'http://localhost:3000/table',
      title: 'Test Data Table',
      content: `
        <h1>Data Table Test</h1>
        ${filterHTML}
        <table id="data-table" data-testid="data-table">
          <thead>
            <tr>${headerHTML}</tr>
          </thead>
          <tbody>
            ${rowsHTML}
          </tbody>
        </table>
      `,
      styles: `
        table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
        th, td { padding: 0.75rem; border: 1px solid #ddd; text-align: left; }
        th { background-color: #f8f9fa; font-weight: bold; }
        .sortable { cursor: pointer; user-select: none; }
        .sortable:hover { background-color: #e9ecef; }
        .table-filters { margin-bottom: 1rem; }
        #table-filter { width: 100%; max-width: 300px; padding: 0.5rem; }
        tr:nth-child(even) { background-color: #f8f9fa; }
        .hidden { display: none; }
      `,
      scripts: `
        let sortDirection = {};

        if (${sortable}) {
          document.querySelectorAll('.sortable').forEach(header => {
            header.addEventListener('click', function() {
              const column = this.dataset.column;
              const table = document.getElementById('data-table');
              const tbody = table.querySelector('tbody');
              const rows = Array.from(tbody.querySelectorAll('tr'));

              sortDirection[column] = sortDirection[column] === 'asc' ? 'desc' : 'asc';

              rows.sort((a, b) => {
                const aValue = a.querySelector(\`[data-testid="\${column}-\${a.dataset.testid?.split('-').pop() || '0'}"]\`)?.textContent || '';
                const bValue = b.querySelector(\`[data-testid="\${column}-\${b.dataset.testid?.split('-').pop() || '0'}"]\`)?.textContent || '';

                if (sortDirection[column] === 'asc') {
                  return aValue.localeCompare(bValue);
                } else {
                  return bValue.localeCompare(aValue);
                }
              });

              rows.forEach(row => tbody.appendChild(row));
            });
          });
        }

        if (${filterable}) {
          document.getElementById('table-filter').addEventListener('input', function() {
            const filter = this.value.toLowerCase();
            const rows = document.querySelectorAll('#data-table tbody tr');

            rows.forEach(row => {
              const text = row.textContent.toLowerCase();
              if (text.includes(filter)) {
                row.classList.remove('hidden');
              } else {
                row.classList.add('hidden');
              }
            });
          });
        }
      `
    });
  }
};

// ============================================================================
// Test URL Generation
// ============================================================================

/**
 * Generate test URLs for different scenarios
 */
export const testUrls = {
  /**
   * Generate a basic test URL
   */
  basic(config: TestUrlConfig = {}): string {
    const {
      scheme = 'http',
      host = 'localhost',
      port = 3000,
      path = '/',
      query = {},
      fragment
    } = config;

    let url = `${scheme}://${host}`;
    if (port && port !== (scheme === 'https' ? 443 : 80)) {
      url += `:${port}`;
    }

    url += path;

    const queryString = Object.entries(query)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&');

    if (queryString) {
      url += `?${queryString}`;
    }

    if (fragment) {
      url += `#${fragment}`;
    }

    return url;
  },

  /**
   * Generate URLs for common test scenarios
   */
  scenarios: {
    // Local development URLs
    local: (path = '/') => testUrls.basic({ path }),
    localSecure: (path = '/') => testUrls.basic({ scheme: 'https', port: 3443, path }),

    // API endpoints
    api: (endpoint = '') => testUrls.basic({ path: `/api${endpoint}` }),
    apiV1: (endpoint = '') => testUrls.basic({ path: `/api/v1${endpoint}` }),

    // Static assets
    assets: (filename = '') => testUrls.basic({ path: `/assets${filename}` }),
    images: (filename = '') => testUrls.basic({ path: `/images${filename}` }),

    // Auth URLs
    login: () => testUrls.basic({ path: '/login' }),
    logout: () => testUrls.basic({ path: '/logout' }),
    register: () => testUrls.basic({ path: '/register' }),

    // Admin URLs
    admin: (path = '') => testUrls.basic({ path: `/admin${path}` }),

    // Search and pagination
    search: (query: string, page = 1) => testUrls.basic({
      path: '/search',
      query: { q: query, page: page.toString() }
    }),

    // Error pages
    notFound: () => testUrls.basic({ path: '/404' }),
    serverError: () => testUrls.basic({ path: '/500' }),

    // Data URLs for testing
    dataUrl: (mimeType: string, data: string, base64 = false) =>
      `data:${mimeType}${base64 ? ';base64' : ''},${base64 ? btoa(data) : encodeURIComponent(data)}`,

    // Blob URLs for testing file uploads
    createBlobUrl: (data: string, mimeType = 'text/plain') => {
      const blob = new Blob([data], { type: mimeType });
      return URL.createObjectURL(blob);
    }
  }
};

// ============================================================================
// Browser State Assertions
// ============================================================================

/**
 * Assert various browser states and conditions
 */
export async function assertBrowserState(page: Page, config: BrowserStateConfig): Promise<void> {
  const errors: string[] = [];

  // Check page title
  if (config.title !== undefined) {
    const actualTitle = await page.title();
    if (actualTitle !== config.title) {
      errors.push(`Expected title "${config.title}", got "${actualTitle}"`);
    }
  }

  // Check URL
  if (config.url !== undefined) {
    const actualUrl = page.url();
    const urlMatches = typeof config.url === 'string'
      ? actualUrl === config.url
      : config.url.test(actualUrl);

    if (!urlMatches) {
      errors.push(`URL does not match expected pattern. Actual: "${actualUrl}", Expected: "${config.url}"`);
    }
  }

  // Check elements present
  if (config.elementsPresent) {
    for (const selector of config.elementsPresent) {
      const element = page.locator(selector);
      const isVisible = await element.isVisible().catch(() => false);
      if (!isVisible) {
        errors.push(`Expected element "${selector}" to be present and visible`);
      }
    }
  }

  // Check elements absent
  if (config.elementsAbsent) {
    for (const selector of config.elementsAbsent) {
      const element = page.locator(selector);
      const isVisible = await element.isVisible().catch(() => false);
      if (isVisible) {
        errors.push(`Expected element "${selector}" to be absent or hidden`);
      }
    }
  }

  // Check text content
  if (config.textContent) {
    for (const { selector, text } of config.textContent) {
      const element = page.locator(selector);
      const actualText = await element.textContent().catch(() => '');
      const textMatches = typeof text === 'string'
        ? actualText?.includes(text)
        : text.test(actualText || '');

      if (!textMatches) {
        errors.push(`Element "${selector}" text does not match. Actual: "${actualText}", Expected: "${text}"`);
      }
    }
  }

  // Check attributes
  if (config.attributes) {
    for (const { selector, attribute, value } of config.attributes) {
      const element = page.locator(selector);
      const actualValue = await element.getAttribute(attribute).catch(() => null);
      const valueMatches = typeof value === 'string'
        ? actualValue === value
        : value.test(actualValue || '');

      if (!valueMatches) {
        errors.push(`Element "${selector}" attribute "${attribute}" does not match. Actual: "${actualValue}", Expected: "${value}"`);
      }
    }
  }

  // Check styles
  if (config.styles) {
    for (const { selector, property, value } of config.styles) {
      const element = page.locator(selector);
      const computedStyle = await element.evaluate((el, prop) => {
        return window.getComputedStyle(el).getPropertyValue(prop);
      }, property).catch(() => '');

      const styleMatches = typeof value === 'string'
        ? computedStyle === value
        : value.test(computedStyle);

      if (!styleMatches) {
        errors.push(`Element "${selector}" style "${property}" does not match. Actual: "${computedStyle}", Expected: "${value}"`);
      }
    }
  }

  // Check network state
  if (config.network) {
    const { idle, pendingRequests, failedRequests } = config.network;

    if (idle) {
      // Wait for network idle and check if there are still pending requests
      await page.waitForLoadState('networkidle').catch(() => {
        errors.push('Expected network to be idle but there are still pending requests');
      });
    }

    // Note: pendingRequests and failedRequests would require more complex tracking
    // This is a simplified implementation
  }

  if (errors.length > 0) {
    throw new Error(`Browser state assertion failed:\n${errors.join('\n')}`);
  }
}

/**
 * Common browser state assertion helpers
 */
export const browserAssertions = {
  /**
   * Assert that a page has loaded completely
   */
  async pageLoaded(page: Page, title?: string): Promise<void> {
    await page.waitForLoadState('domcontentloaded');
    await page.waitForLoadState('networkidle');

    if (title) {
      await assertBrowserState(page, { title });
    }
  },

  /**
   * Assert that an element is visible and interactable
   */
  async elementInteractable(page: Page, selector: string): Promise<void> {
    const element = page.locator(selector);
    await element.waitFor({ state: 'visible' });
    await element.waitFor({ state: 'attached' });

    const isEnabled = await element.isEnabled();
    if (!isEnabled) {
      throw new Error(`Element "${selector}" is not enabled/interactable`);
    }
  },

  /**
   * Assert that a form can be submitted
   */
  async formSubmittable(page: Page, formSelector: string): Promise<void> {
    const form = page.locator(formSelector);
    await form.waitFor({ state: 'visible' });

    // Check if form has a valid action
    const action = await form.getAttribute('action');
    const method = await form.getAttribute('method') || 'GET';

    // Check for submit button
    const submitButton = form.locator('button[type="submit"], input[type="submit"]');
    const hasSubmitButton = await submitButton.count() > 0;

    if (!hasSubmitButton) {
      throw new Error(`Form "${formSelector}" does not have a submit button`);
    }

    await this.elementInteractable(page, submitButton.first().toString());
  },

  /**
   * Assert that navigation works correctly
   */
  async navigationWorks(page: Page, links: Array<{ selector: string; expectedUrl: string }>): Promise<void> {
    for (const { selector, expectedUrl } of links) {
      // Click the link
      await page.click(selector);

      // Wait for navigation
      await page.waitForURL(expectedUrl);

      // Verify we're on the expected page
      const currentUrl = page.url();
      if (!currentUrl.includes(expectedUrl)) {
        throw new Error(`Expected to navigate to "${expectedUrl}", but current URL is "${currentUrl}"`);
      }

      // Go back for next test
      await page.goBack();
    }
  }
};

// ============================================================================
// Screenshot and Visual Testing
// ============================================================================

/**
 * Advanced screenshot utilities with comparison capabilities
 */
export async function takeScreenshotWithComparison(
  page: Page,
  name: string,
  outputDir: string,
  config: ScreenshotCompareConfig = {}
): Promise<{
  screenshotPath: string;
  baselinePath?: string;
  diffPath?: string;
  similarity?: number;
}> {
  const { threshold = 0.1, clip, mask = [], disableAnimations = true, waitFor } = config;

  // Disable animations if requested
  if (disableAnimations) {
    await page.addStyleTag({
      content: `
        *, *::before, *::after {
          animation-duration: 0s !important;
          animation-delay: 0s !important;
          transition-duration: 0s !important;
          transition-delay: 0s !important;
        }
      `
    });
  }

  // Wait for specific conditions
  if (waitFor) {
    if (typeof waitFor === 'string') {
      await page.waitForSelector(waitFor, { state: 'visible' });
    } else {
      await page.waitForFunction(waitFor);
    }
  }

  // Mask elements if specified
  const maskSelectors = mask.length > 0 ? mask : undefined;

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const screenshotPath = path.join(outputDir, `${name}-${timestamp}.png`);

  await page.screenshot({
    path: screenshotPath,
    fullPage: !clip,
    clip,
    mask: maskSelectors ? mask.map(selector => page.locator(selector)) : undefined,
    animations: 'disabled'
  });

  // Try to find baseline for comparison
  const baselinePath = path.join(outputDir, 'baselines', `${name}-baseline.png`);
  let diffPath: string | undefined;
  let similarity: number | undefined;

  try {
    const baselineExists = await fs.access(baselinePath).then(() => true).catch(() => false);
    if (baselineExists) {
      // This is a simplified comparison - in a real implementation you'd use pixelmatch or similar
      diffPath = path.join(outputDir, `${name}-diff-${timestamp}.png`);
      similarity = await compareImages(screenshotPath, baselinePath, diffPath, threshold);
    }
  } catch (error) {
    console.warn(`Could not compare screenshots: ${error}`);
  }

  return { screenshotPath, baselinePath, diffPath, similarity };
}

/**
 * Simplified image comparison (in real implementation, use pixelmatch)
 */
async function compareImages(
  imagePath1: string,
  imagePath2: string,
  diffPath: string,
  threshold: number
): Promise<number> {
  try {
    // This is a very basic implementation
    // In practice, you would use a library like pixelmatch
    const [buffer1, buffer2] = await Promise.all([
      fs.readFile(imagePath1),
      fs.readFile(imagePath2)
    ]);

    const sizeDiff = Math.abs(buffer1.length - buffer2.length);
    const maxSize = Math.max(buffer1.length, buffer2.length);
    const similarity = 1 - (sizeDiff / maxSize);

    return similarity;
  } catch (error) {
    console.error('Image comparison failed:', error);
    return 0;
  }
}

// ============================================================================
// Network Mocking and Performance
// ============================================================================

/**
 * Set up mock network requests
 */
export async function setupMockRequests(page: Page, mocks: MockRequestConfig[]): Promise<void> {
  for (const mock of mocks) {
    const { pattern, method = 'GET', status = 200, headers = {}, body, delay = 0, fail = false } = mock;

    await page.route(pattern, async (route) => {
      // Check method if specified
      if (route.request().method() !== method) {
        return route.continue();
      }

      // Add delay if specified
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      // Fail the request if specified
      if (fail) {
        return route.abort();
      }

      // Mock the response
      await route.fulfill({
        status,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
        body: typeof body === 'object' ? JSON.stringify(body) : body
      });
    });
  }
}

/**
 * Measure page performance during an action
 */
export async function measurePerformance(
  page: Page,
  action: () => Promise<void>
): Promise<PerformanceMeasurement> {
  const startTime = Date.now();

  // Start performance monitoring
  await page.evaluate(() => {
    window.__performanceStart = performance.now();
  });

  // Execute the action
  await action();

  const endTime = Date.now();
  const duration = endTime - startTime;

  // Collect performance metrics
  const timing = await page.evaluate(() => {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    if (!navigation) return undefined;

    return {
      domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
      loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
      firstPaint: navigation.domContentLoadedEventStart - navigation.fetchStart,
      firstContentfulPaint: 0, // Would need paint timing API
      largestContentfulPaint: 0, // Would need paint timing API
    };
  });

  const resources = await page.evaluate(() => {
    return performance.getEntriesByType('resource').map(entry => ({
      name: entry.name,
      type: (entry as PerformanceResourceTiming).initiatorType,
      size: (entry as PerformanceResourceTiming).transferSize || 0,
      duration: entry.duration
    }));
  });

  const memory = await page.evaluate(() => {
    if ('memory' in performance) {
      const mem = (performance as any).memory;
      return {
        usedJSHeapSize: mem.usedJSHeapSize,
        totalJSHeapSize: mem.totalJSHeapSize,
        jsHeapSizeLimit: mem.jsHeapSizeLimit
      };
    }
    return undefined;
  });

  return {
    startTime,
    endTime,
    duration,
    timing,
    resources,
    memory
  };
}

// ============================================================================
// Exports
// ============================================================================

export {
  MockPageConfig,
  MockElementConfig,
  TestUrlConfig,
  BrowserStateConfig,
  ScreenshotCompareConfig,
  MockRequestConfig,
  PerformanceMeasurement
};

export default {
  createMockPage,
  createMockDOMStructure,
  mockPageObjects,
  testUrls,
  assertBrowserState,
  browserAssertions,
  takeScreenshotWithComparison,
  setupMockRequests,
  measurePerformance
};