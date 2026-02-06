/**
 * @apex/test-utils - Browser Utils End-to-End Test
 *
 * Tests that browser test utilities are properly exported from the central test-utils module
 * and can be used together for comprehensive browser testing scenarios.
 */

import { describe, it, expect } from 'vitest';

// Import browser utilities from the central test-utils module
import {
  // Mock Page Objects
  createMockPage,
  createMockElement,
  createMockPageWithForm,
  createMockPageWithNavigation,
  addElementToMockPage,
  addConsoleMessage,
  addError,
  setCookie,
  setLocalStorage,

  // DOM Builders
  buildFormHtml,
  buildTableHtml,
  buildNavigationHtml,
  buildListHtml,
  buildModalHtml,
  buildCardGridHtml,
  buildCardHtml,
  buildCompletePage,
  buildLayoutHtml,
  buildBreadcrumbHtml,
  buildPaginationHtml,

  // URL Generators
  generateTestUrl,
  generateTestUrls,
  createUrlPattern,
  testUrls,
  urlValidators,
  urlUtils,
  urlScenarios,

  // Assertions
  assertNavigationState,
  assertPageContent,
  assertElementExists,
  assertElementVisible,
  assertElementText,
  assertNoErrors,
  assertConsoleContains,
  assertBrowserState,
  assertElementAttributes,
  assertElementTagName,
  assertElementEnabled,
  assertCookie,
  assertLocalStorage,

  // Advanced utilities
  TestPages,
  TestDataGenerators,
  ScreenshotValidators,
  PerformanceMonitor,
  MockScenarios,

  // Types
  type MockPageObject,
  type FormConfig,
  type NavLink,
  type TableConfig,
  type ModalConfig,
  type CardConfig,
  type TestUrlOptions,
  type NavigationState,
  type BrowserStateExpectation,
} from './index.js';

describe('Browser Test Utils E2E Integration', () => {
  it('should export all browser utilities from central test-utils module', () => {
    // Test Mock Page Objects
    expect(typeof createMockPage).toBe('function');
    expect(typeof createMockElement).toBe('function');
    expect(typeof createMockPageWithForm).toBe('function');
    expect(typeof createMockPageWithNavigation).toBe('function');
    expect(typeof addElementToMockPage).toBe('function');
    expect(typeof addConsoleMessage).toBe('function');
    expect(typeof addError).toBe('function');
    expect(typeof setCookie).toBe('function');
    expect(typeof setLocalStorage).toBe('function');

    // Test DOM Builders
    expect(typeof buildFormHtml).toBe('function');
    expect(typeof buildTableHtml).toBe('function');
    expect(typeof buildNavigationHtml).toBe('function');
    expect(typeof buildListHtml).toBe('function');
    expect(typeof buildModalHtml).toBe('function');
    expect(typeof buildCardGridHtml).toBe('function');
    expect(typeof buildCardHtml).toBe('function');
    expect(typeof buildCompletePage).toBe('function');
    expect(typeof buildLayoutHtml).toBe('function');
    expect(typeof buildBreadcrumbHtml).toBe('function');
    expect(typeof buildPaginationHtml).toBe('function');

    // Test URL Generators
    expect(typeof generateTestUrl).toBe('function');
    expect(typeof generateTestUrls).toBe('function');
    expect(typeof createUrlPattern).toBe('function');
    expect(typeof testUrls).toBe('object');
    expect(typeof urlValidators).toBe('object');
    expect(typeof urlUtils).toBe('object');
    expect(typeof urlScenarios).toBe('object');

    // Test Assertions
    expect(typeof assertNavigationState).toBe('function');
    expect(typeof assertPageContent).toBe('function');
    expect(typeof assertElementExists).toBe('function');
    expect(typeof assertElementVisible).toBe('function');
    expect(typeof assertElementText).toBe('function');
    expect(typeof assertNoErrors).toBe('function');
    expect(typeof assertConsoleContains).toBe('function');
    expect(typeof assertBrowserState).toBe('function');
    expect(typeof assertElementAttributes).toBe('function');
    expect(typeof assertElementTagName).toBe('function');
    expect(typeof assertElementEnabled).toBe('function');
    expect(typeof assertCookie).toBe('function');
    expect(typeof assertLocalStorage).toBe('function');

    // Test Advanced utilities
    expect(TestPages).toBeDefined();
    expect(TestDataGenerators).toBeDefined();
    expect(ScreenshotValidators).toBeDefined();
    expect(PerformanceMonitor).toBeDefined();
    expect(MockScenarios).toBeDefined();
  });

  it('should create a complete test scenario using central imports', () => {
    // Create a realistic e-commerce product page testing scenario
    const baseUrl = generateTestUrl({
      host: 'shop.example.com',
      path: '/products/widgets',
      query: { category: 'electronics', sort: 'price' }
    });

    // Build product listing page
    const productCards: CardConfig[] = [
      {
        title: 'Premium Widget',
        content: 'High-quality widget with advanced features',
        imageUrl: '/images/premium-widget.jpg',
        actions: [
          { text: 'Add to Cart', className: 'btn-primary' },
          { text: 'View Details', href: '/products/premium-widget' }
        ]
      },
      {
        title: 'Basic Widget',
        content: 'Essential widget for everyday use',
        imageUrl: '/images/basic-widget.jpg',
        actions: [
          { text: 'Add to Cart', className: 'btn-primary' },
          { text: 'View Details', href: '/products/basic-widget' }
        ]
      }
    ];

    const navigation: NavLink[] = [
      { href: '/', text: 'Home' },
      { href: '/products', text: 'Products' },
      { href: '/cart', text: 'Cart' },
      { href: '/account', text: 'Account' }
    ];

    const filterForm: FormConfig = {
      action: '/products/search',
      method: 'GET',
      fields: [
        { name: 'category', type: 'select', label: 'Category', options: ['All', 'Electronics', 'Home', 'Garden'] },
        { name: 'price_min', type: 'number', label: 'Min Price', placeholder: '0' },
        { name: 'price_max', type: 'number', label: 'Max Price', placeholder: '1000' }
      ],
      submitLabel: 'Apply Filters'
    };

    // Build complete page
    const pageParts = {
      navigation: buildNavigationHtml(navigation),
      breadcrumbs: buildBreadcrumbHtml([
        { text: 'Home', href: '/' },
        { text: 'Products', href: '/products' },
        { text: 'Widgets' }
      ]),
      filters: buildFormHtml(filterForm),
      products: buildCardGridHtml(productCards),
      pagination: buildPaginationHtml({
        currentPage: 2,
        totalPages: 10,
        baseUrl: '/products/widgets'
      })
    };

    const completePage = buildCompletePage({
      title: 'Widgets - Shop Example',
      body: buildLayoutHtml({
        header: `${pageParts.navigation}${pageParts.breadcrumbs}`,
        sidebar: pageParts.filters,
        main: `<h1>Widgets</h1>${pageParts.products}${pageParts.pagination}`,
        footer: '<p>&copy; 2024 Shop Example. All rights reserved.</p>'
      }),
      styles: `
        .layout { display: grid; grid-template-areas: "header header" "sidebar main" "footer footer"; }
        .card-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; }
        .btn-primary { background: #007bff; color: white; }
      `,
      meta: [
        { name: 'description', content: 'Shop the best widgets online' },
        { property: 'og:title', content: 'Widgets - Shop Example' }
      ]
    });

    // Create mock page
    const mockPage = createMockPage({
      url: baseUrl,
      title: 'Widgets - Shop Example',
      content: completePage
    });

    // Add interactive elements
    addElementToMockPage(mockPage, '#cart-counter', {
      text: '3',
      tagName: 'SPAN',
      attributes: { class: 'cart-count' }
    });

    productCards.forEach((card, index) => {
      addElementToMockPage(mockPage, `#product-${index}-add-cart`, {
        text: 'Add to Cart',
        tagName: 'BUTTON',
        attributes: { class: 'btn-primary', 'data-product-id': `product-${index}` }
      });
    });

    // Add browser state
    setCookie(mockPage, 'cart_items', '3');
    setCookie(mockPage, 'user_session', 'logged_in_user_123');
    setLocalStorage(mockPage, 'recently_viewed', '["premium-widget", "basic-widget"]');
    setLocalStorage(mockPage, 'filters', '{"category": "electronics"}');

    // Add console messages
    addConsoleMessage(mockPage, 'info', 'Product page loaded successfully');
    addConsoleMessage(mockPage, 'debug', 'Applied filters: category=electronics');

    // Comprehensive testing using all assertion types
    const tests = [
      // Navigation tests
      () => assertNavigationState(mockPage, {
        url: baseUrl,
        title: 'Widgets - Shop Example'
      }),
      () => assertPageContent(mockPage, 'Widgets - Shop Example'),
      () => assertPageContent(mockPage, 'Premium Widget'),

      // Element existence tests
      () => assertElementExists(mockPage, '#cart-counter'),
      () => assertElementExists(mockPage, '#product-0-add-cart'),
      () => assertElementExists(mockPage, '#product-1-add-cart'),

      // Element properties tests
      () => assertElementText(mockPage, '#cart-counter', '3'),
      () => assertElementTagName(mockPage, '#cart-counter', 'SPAN'),
      () => assertElementAttributes(mockPage, '#cart-counter', { class: 'cart-count' }),
      () => assertElementAttributes(mockPage, '#product-0-add-cart', {
        class: 'btn-primary',
        'data-product-id': 'product-0'
      }),

      // Browser state tests
      () => assertCookie(mockPage, 'cart_items', '3'),
      () => assertCookie(mockPage, 'user_session', 'logged_in_user_123'),
      () => assertLocalStorage(mockPage, 'recently_viewed', '["premium-widget", "basic-widget"]'),
      () => assertLocalStorage(mockPage, 'filters', '{"category": "electronics"}'),

      // Console and error tests
      () => assertConsoleContains(mockPage, 'info', 'Product page loaded'),
      () => assertConsoleContains(mockPage, 'debug', 'Applied filters'),
      () => assertNoErrors(mockPage),

      // Element visibility tests
      () => assertElementVisible(mockPage, '#cart-counter'),
      () => assertElementEnabled(mockPage, '#product-0-add-cart'),
    ];

    // Run all tests and verify they pass
    tests.forEach((test, index) => {
      const result = test();
      expect(result.success).toBe(true);
    });

    // Test URL manipulation
    const urlWithAdditionalParams = urlUtils.addQuery(baseUrl, {
      page: 2,
      per_page: 20
    });

    expect(urlValidators.isValidUrl(urlWithAdditionalParams)).toBe(true);
    expect(urlValidators.hasQuery(urlWithAdditionalParams)).toBe(true);
    expect(urlUtils.parseQuery(urlWithAdditionalParams)).toEqual({
      category: 'electronics',
      sort: 'price',
      page: '2',
      per_page: '20'
    });

    // Test URL pattern generation
    const productDetailUrl = createUrlPattern('/products/:productId/reviews', {
      productId: 'premium-widget'
    });
    expect(productDetailUrl).toBe('/products/premium-widget/reviews');

    // Validate DOM structure
    expect(completePage).toContain('<!DOCTYPE html>');
    expect(completePage).toContain('Widgets - Shop Example');
    expect(completePage).toContain('Premium Widget');
    expect(completePage).toContain('Add to Cart');
    expect(completePage).toContain('grid-template-areas');
  });

  it('should handle complex browser state scenarios', () => {
    // Create API testing page
    const apiPage = createMockPage({
      url: urlScenarios.api.rest('v2'),
      title: 'API Dashboard',
      content: buildCompletePage({
        title: 'API Dashboard',
        body: `
          <h1>API Dashboard</h1>
          <div id="api-status">Connected</div>
          <div id="requests-count">1,234</div>
        `
      })
    });

    // Add complex browser state
    const apiKeys = ['key1', 'key2', 'key3'];
    apiKeys.forEach((key, index) => {
      setCookie(apiPage, `api_key_${index}`, key);
      setLocalStorage(apiPage, `last_request_${index}`, new Date().toISOString());
    });

    // Add console logs for different scenarios
    const logScenarios = [
      { level: 'info' as const, message: 'API connected successfully' },
      { level: 'warn' as const, message: 'Rate limit approaching' },
      { level: 'debug' as const, message: 'Request cached: /users/123' },
      { level: 'error' as const, message: 'Failed to refresh token' }
    ];

    logScenarios.forEach(({ level, message }) => {
      addConsoleMessage(apiPage, level, message);
    });

    // Add some errors
    addError(apiPage, 'Token expired');
    addError(apiPage, '429 Too Many Requests');

    // Test complex browser state
    const browserExpectation: BrowserStateExpectation = {
      cookies: { api_key_0: 'key1', api_key_1: 'key2' },
      localStorage: { last_request_0: expect.any(String) },
      errors: ['Token expired'],
      consoleMessages: [
        { level: 'info', text: 'API connected successfully' }
      ]
    };

    expect(assertBrowserState(apiPage, browserExpectation)).toEqual({
      success: true,
      message: 'Browser state matches expected state'
    });

    // Test that assertions work for complex state
    expect(assertCookie(apiPage, 'api_key_2', 'key3')).toEqual({
      success: true,
      message: 'Cookie api_key_2 has expected value'
    });

    expect(assertConsoleContains(apiPage, 'warn', 'Rate limit')).toEqual({
      success: true,
      message: 'Console contains expected message'
    });

    expect(assertNoErrors(apiPage)).toEqual({
      success: false,
      message: 'Found 2 errors: Token expired, 429 Too Many Requests'
    });
  });

  it('should demonstrate advanced utility usage', () => {
    // Test that advanced utilities are properly imported and functional
    expect(typeof TestPages.create).toBe('function');
    expect(typeof TestPages.loadFixture).toBe('function');

    expect(typeof TestDataGenerators.randomUser).toBe('function');
    expect(typeof TestDataGenerators.mockApiResponse).toBe('function');
    expect(typeof TestDataGenerators.generateFormData).toBe('function');

    expect(typeof MockScenarios.userLogin).toBe('function');
    expect(typeof MockScenarios.apiError).toBe('function');
    expect(typeof MockScenarios.pageLoad).toBe('function');

    expect(typeof ScreenshotValidators.compareImages).toBe('function');
    expect(typeof ScreenshotValidators.validateLayout).toBe('function');

    expect(typeof PerformanceMonitor.startMonitoring).toBe('function');
    expect(typeof PerformanceMonitor.getMetrics).toBe('function');
    expect(typeof PerformanceMonitor.stopMonitoring).toBe('function');
  });

  it('should validate all URL utilities work correctly', () => {
    // Test URL collections
    expect(Array.isArray(testUrls.valid)).toBe(true);
    expect(Array.isArray(testUrls.invalid)).toBe(true);
    expect(Array.isArray(testUrls.protocols)).toBe(true);
    expect(Array.isArray(testUrls.special)).toBe(true);

    // Test URL validators
    expect(urlValidators.isValidUrl('https://example.com')).toBe(true);
    expect(urlValidators.isHttps('https://example.com')).toBe(true);
    expect(urlValidators.isLocalhost('http://localhost:3000')).toBe(true);
    expect(urlValidators.hasQuery('https://example.com?q=test')).toBe(true);
    expect(urlValidators.hasFragment('https://example.com#section')).toBe(true);

    // Test URL utilities
    const testUrl = 'https://example.com';
    const urlWithQuery = urlUtils.addQuery(testUrl, { test: 'value' });
    expect(urlWithQuery).toContain('test=value');
    expect(urlUtils.getDomain(testUrl)).toBe('example.com');
    expect(urlUtils.getPath('https://example.com/path')).toBe('/path');

    // Test URL scenarios
    expect(urlScenarios.api.rest()).toContain('api');
    expect(urlScenarios.api.graphql()).toContain('graphql');
    expect(urlScenarios.files.download('test.pdf')).toContain('test.pdf');
  });
});