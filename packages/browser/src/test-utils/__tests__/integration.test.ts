/**
 * @apexcli/browser - Test Utils Integration Test Suite
 *
 * Tests multiple test utility modules working together in realistic scenarios
 */

import { describe, it, expect, beforeEach } from 'vitest';

// Import all test utility modules
import {
  createMockPage,
  createMockPageWithForm,
  createMockPageWithNavigation,
  addElementToMockPage,
  addConsoleMessage,
  addError,
  setCookie,
  setLocalStorage,
  type MockPageObject,
  type FormConfig,
  type NavLink
} from '../mock-page-objects.js';

import {
  buildFormHtml,
  buildTableHtml,
  buildNavigationHtml,
  buildModalHtml,
  buildCompletePage
} from '../dom-builders.js';

import {
  generateTestUrl,
  generateTestUrls,
  createUrlPattern,
  testUrls,
  urlValidators
} from '../url-generators.js';

import {
  assertNavigationState,
  assertPageContent,
  assertElementExists,
  assertElementVisible,
  assertElementText,
  assertNoErrors,
  assertConsoleContains,
  assertBrowserState,
  assertElementAttributes,
  assertCookie,
  assertLocalStorage
} from '../assertions.js';

import { TestPages, TestDataGenerators } from '../test-pages.js';
import { ScreenshotValidators } from '../validators.js';
import { PerformanceMonitor } from '../performance.js';
import { MockScenarios } from '../mock-scenarios.js';

describe('Test Utils Integration', () => {
  let mockPage: MockPageObject;

  beforeEach(() => {
    mockPage = createMockPage();
  });

  describe('Complete Test Workflow Simulation', () => {
    it('should simulate a complete e-commerce checkout flow test', () => {
      // 1. Set up test environment with URL validation
      const checkoutUrl = generateTestUrl({
        protocol: 'https',
        host: 'shop.example.com',
        path: '/checkout'
      });

      expect(urlValidators.isValidUrl(checkoutUrl)).toBe(true);
      expect(urlValidators.isHttps(checkoutUrl)).toBe(true);

      // 2. Create a mock page for the checkout flow
      const formConfig: FormConfig = {
        action: '/process-checkout',
        method: 'POST',
        submitLabel: 'Complete Purchase',
        fields: [
          { name: 'email', type: 'email', label: 'Email Address', required: true },
          { name: 'card_number', type: 'text', label: 'Card Number', required: true },
          { name: 'expiry', type: 'text', label: 'Expiry Date', required: true },
          { name: 'cvv', type: 'text', label: 'CVV', required: true }
        ]
      };

      const checkoutPage = createMockPageWithForm(formConfig);
      checkoutPage.url = checkoutUrl;
      checkoutPage.title = 'Checkout - Complete Your Order';

      // 3. Add additional checkout elements
      addElementToMockPage(checkoutPage, '#order-summary', {
        text: 'Total: $99.99',
        tagName: 'DIV'
      });

      addElementToMockPage(checkoutPage, '#security-badge', {
        text: 'SSL Secured',
        tagName: 'IMG',
        attributes: { src: '/security-badge.png', alt: 'SSL Secured' }
      });

      // 4. Set cookies for session management
      setCookie(checkoutPage, 'session_id', 'checkout_123456');
      setCookie(checkoutPage, 'cart_items', 'item1,item2');

      // 5. Set localStorage for user preferences
      setLocalStorage(checkoutPage, 'preferred_payment', 'credit_card');
      setLocalStorage(checkoutPage, 'billing_address_saved', 'true');

      // 6. Add console messages for tracking
      addConsoleMessage(checkoutPage, 'info', 'Checkout page initialized');
      addConsoleMessage(checkoutPage, 'debug', 'Payment form validation enabled');

      // 7. Perform comprehensive assertions
      expect(assertNavigationState(checkoutPage, {
        url: checkoutUrl,
        title: 'Checkout - Complete Your Order'
      }).pass).toBe(true);

      expect(assertElementExists(checkoutPage, '#email').pass).toBe(true);
      expect(assertElementExists(checkoutPage, '#card_number').pass).toBe(true);
      expect(assertElementExists(checkoutPage, '#order-summary').pass).toBe(true);

      expect(assertElementText(checkoutPage, '#order-summary', 'Total: $99.99').pass).toBe(true);

      expect(assertElementAttributes(checkoutPage, '#security-badge', {
        src: '/security-badge.png',
        alt: 'SSL Secured'
      }).pass).toBe(true);

      expect(assertCookie(checkoutPage, 'session_id', 'checkout_123456').pass).toBe(true);
      expect(assertLocalStorage(checkoutPage, 'preferred_payment', 'credit_card').pass).toBe(true);

      expect(assertConsoleContains(checkoutPage, 'info', 'Checkout page initialized').pass).toBe(true);
      expect(assertNoErrors(checkoutPage).pass).toBe(true);

      // 8. Comprehensive browser state assertion
      expect(assertBrowserState(checkoutPage, {
        url: /checkout/,
        title: /Checkout/,
        hasErrors: false,
        elementExists: ['#email', '#card_number', '#order-summary'],
        elementVisible: ['#email', '#card_number'],
        consoleMessages: [
          { level: 'info', text: /initialized/ },
          { level: 'debug', text: /validation/ }
        ]
      }).pass).toBe(true);
    });

    it('should simulate performance testing of a data-heavy dashboard', () => {
      // 1. Generate test URLs for API endpoints
      const apiUrls = generateTestUrls(5, {
        protocol: 'https',
        host: 'api.dashboard.com',
        path: '/data'
      });

      expect(apiUrls).toHaveLength(5);
      apiUrls.forEach(url => {
        expect(urlValidators.isValidUrl(url)).toBe(true);
      });

      // 2. Create performance monitor for tracking
      const perfMonitor = new PerformanceMonitor();

      // 3. Generate heavy content page
      const heavyContent = TestDataGenerators.generateHeavyContent(100);
      expect(heavyContent).toContain('Heavy Content Test (100 elements)');

      // 4. Create dashboard page with data
      const dashboardPage = createMockPage({
        url: generateTestUrl({ host: 'dashboard.com', path: '/analytics' }),
        title: 'Analytics Dashboard',
        content: heavyContent
      });

      // 5. Simulate data loading performance
      perfMonitor.start();

      // Add data visualization elements
      for (let i = 0; i < 50; i++) {
        addElementToMockPage(dashboardPage, `#chart-${i}`, {
          text: `Chart ${i + 1}`,
          tagName: 'DIV',
          attributes: { class: 'chart-widget' }
        });
      }

      const loadTime = perfMonitor.stop();

      // 6. Add performance tracking cookies
      setCookie(dashboardPage, 'load_time', loadTime.toString());
      setCookie(dashboardPage, 'chart_count', '50');

      // 7. Log performance data
      addConsoleMessage(dashboardPage, 'info', `Dashboard loaded in ${loadTime}ms`);
      addConsoleMessage(dashboardPage, 'debug', 'All 50 charts rendered successfully');

      // 8. Validate dashboard state
      expect(assertNavigationState(dashboardPage, {
        url: /dashboard\.com\/analytics/,
        title: 'Analytics Dashboard'
      }).pass).toBe(true);

      expect(assertPageContent(dashboardPage, /Heavy Content Test/).pass).toBe(true);
      expect(assertElementExists(dashboardPage, '#chart-0').pass).toBe(true);
      expect(assertElementExists(dashboardPage, '#chart-49').pass).toBe(true);

      expect(assertCookie(dashboardPage, 'chart_count', '50').pass).toBe(true);
      expect(assertConsoleContains(dashboardPage, 'info', /loaded in/).pass).toBe(true);

      // 9. Performance validation
      const stats = perfMonitor.getStats();
      expect(stats.count).toBe(1);
      expect(stats.average).toBe(loadTime);
      expect(typeof loadTime).toBe('number');
    });

    it('should simulate error handling and recovery testing', () => {
      // 1. Create error-prone page with JS errors
      const errorPageHtml = MockScenarios.jsError();
      expect(errorPageHtml).toContain('Test JavaScript error');

      // 2. Set up page with errors
      const errorPage = createMockPage({
        url: generateTestUrl({ host: 'error.test.com', path: '/broken' }),
        title: 'Error Test Page',
        content: errorPageHtml
      });

      // 3. Add various types of errors
      addError(errorPage, 'JavaScript Runtime Error: Uncaught TypeError');
      addError(errorPage, 'Network Error: Failed to load resource');
      addError(errorPage, 'Validation Error: Invalid form data');

      // 4. Add error-related console messages
      addConsoleMessage(errorPage, 'error', 'Uncaught Error: Test JavaScript error');
      addConsoleMessage(errorPage, 'warn', 'Resource loading failed, using fallback');
      addConsoleMessage(errorPage, 'info', 'Error recovery mechanism activated');

      // 5. Set error tracking cookies
      setCookie(errorPage, 'error_count', '3');
      setCookie(errorPage, 'recovery_attempted', 'true');

      // 6. Validate error state
      expect(assertNoErrors(errorPage).pass).toBe(false);
      expect(assertBrowserState(errorPage, {
        hasErrors: true,
        consoleMessages: [
          { level: 'error', text: /JavaScript error/ },
          { level: 'warn', text: /loading failed/ },
          { level: 'info', text: /recovery/ }
        ]
      }).pass).toBe(true);

      expect(assertCookie(errorPage, 'error_count', '3').pass).toBe(true);
      expect(assertConsoleContains(errorPage, 'error', 'Test JavaScript error').pass).toBe(true);

      // 7. Test error recovery
      const recoveryPage = createMockPage({
        url: generateTestUrl({ host: 'error.test.com', path: '/recovered' }),
        title: 'Recovered Page'
      });

      addConsoleMessage(recoveryPage, 'info', 'Page successfully recovered');
      expect(assertNoErrors(recoveryPage).pass).toBe(true);
      expect(assertConsoleContains(recoveryPage, 'info', 'successfully recovered').pass).toBe(true);
    });
  });

  describe('Complex Page Structure Testing', () => {
    it('should test a complete multi-section webpage', () => {
      // 1. Create navigation structure
      const navLinks: NavLink[] = [
        { href: '/', text: 'Home' },
        { href: '/products', text: 'Products' },
        { href: '/about', text: 'About' },
        { href: '/contact', text: 'Contact' }
      ];

      const pageWithNav = createMockPageWithNavigation(navLinks);

      // 2. Build complex page sections using DOM builders
      const tableHtml = buildTableHtml({
        headers: ['Product', 'Price', 'Availability'],
        rows: [
          ['Laptop', '$999', 'In Stock'],
          ['Phone', '$599', 'Limited'],
          ['Tablet', '$399', 'Out of Stock']
        ]
      });

      const modalHtml = buildModalHtml({
        title: 'Product Details',
        content: 'Detailed product information goes here.'
      });

      const formHtml = buildFormHtml({
        action: '/contact',
        method: 'POST',
        fields: [
          { name: 'name', type: 'text', label: 'Name', required: true },
          { name: 'email', type: 'email', label: 'Email', required: true },
          { name: 'message', type: 'textarea', label: 'Message' }
        ]
      });

      // 3. Combine all sections into complete page
      const completePageHtml = buildCompletePage({
        title: 'Complete Product Page',
        body: `
          ${pageWithNav.content}
          <section id="products">${tableHtml}</section>
          <section id="contact">${formHtml}</section>
          <div id="modal-container">${modalHtml}</div>
        `
      });

      // 4. Create final page object
      const completePage = createMockPage({
        url: generateTestUrl({ host: 'products.com', path: '/' }),
        title: 'Complete Product Page',
        content: completePageHtml
      });

      // 5. Add all navigation elements to the page
      navLinks.forEach((link, index) => {
        addElementToMockPage(completePage, `#nav-link-${index}`, {
          text: link.text,
          tagName: 'A',
          attributes: { href: link.href }
        });
      });

      // 6. Add table elements
      addElementToMockPage(completePage, '#products-table', {
        text: 'Product table',
        tagName: 'TABLE'
      });

      // 7. Add form elements
      ['name', 'email', 'message'].forEach(fieldName => {
        addElementToMockPage(completePage, `#${fieldName}`, {
          text: '',
          tagName: fieldName === 'message' ? 'TEXTAREA' : 'INPUT',
          attributes: { name: fieldName }
        });
      });

      // 8. Add modal elements
      addElementToMockPage(completePage, '.modal', {
        text: 'Product Details',
        tagName: 'DIV',
        attributes: { class: 'modal' }
      });

      // 9. Set up tracking and analytics
      setLocalStorage(completePage, 'page_view_count', '1');
      setLocalStorage(completePage, 'last_visit', new Date().toISOString());
      setCookie(completePage, 'user_session', 'session_abc123');

      // 10. Comprehensive validation
      expect(assertPageContent(completePage, /Product/).pass).toBe(true);
      expect(assertPageContent(completePage, /Contact/).pass).toBe(true);

      // Validate navigation exists
      expect(assertElementExists(completePage, '#nav-link-0').pass).toBe(true);
      expect(assertElementText(completePage, '#nav-link-0', 'Home').pass).toBe(true);

      // Validate table exists
      expect(assertElementExists(completePage, '#products-table').pass).toBe(true);

      // Validate form exists
      expect(assertElementExists(completePage, '#name').pass).toBe(true);
      expect(assertElementExists(completePage, '#email').pass).toBe(true);

      // Validate modal exists
      expect(assertElementExists(completePage, '.modal').pass).toBe(true);

      // Validate storage
      expect(assertLocalStorage(completePage, 'page_view_count', '1').pass).toBe(true);
      expect(assertCookie(completePage, 'user_session').pass).toBe(true);
    });
  });

  describe('Multi-page Navigation Testing', () => {
    it('should simulate navigation between multiple pages', () => {
      // 1. Create URL patterns for a typical website
      const homeUrl = createUrlPattern('/home', {});
      const productUrl = createUrlPattern('/products/:id', { id: '123' });
      const cartUrl = createUrlPattern('/cart', {});

      expect(homeUrl).toBe('/home');
      expect(productUrl).toBe('/products/123');
      expect(cartUrl).toBe('/cart');

      // 2. Create multiple page states
      const pages = {
        home: createMockPage({
          url: generateTestUrl({ host: 'shop.com', path: homeUrl }),
          title: 'Home - Online Shop',
          content: TestPages.simple('Welcome to Our Shop')
        }),
        product: createMockPage({
          url: generateTestUrl({ host: 'shop.com', path: productUrl }),
          title: 'Product 123 - Online Shop',
          content: TestPages.simple('Product Details')
        }),
        cart: createMockPage({
          url: generateTestUrl({ host: 'shop.com', path: cartUrl }),
          title: 'Shopping Cart - Online Shop',
          content: TestPages.simple('Your Cart')
        })
      };

      // 3. Add page-specific elements and state
      // Home page
      addElementToMockPage(pages.home, '#hero-banner', { text: 'Welcome Banner' });
      addElementToMockPage(pages.home, '#featured-products', { text: 'Featured Items' });
      setLocalStorage(pages.home, 'visited_pages', JSON.stringify(['home']));

      // Product page
      addElementToMockPage(pages.product, '#product-image', { tagName: 'IMG' });
      addElementToMockPage(pages.product, '#add-to-cart', { text: 'Add to Cart', tagName: 'BUTTON' });
      addElementToMockPage(pages.product, '#price', { text: '$29.99' });
      setLocalStorage(pages.product, 'visited_pages', JSON.stringify(['home', 'product']));
      setCookie(pages.product, 'recently_viewed', 'product_123');

      // Cart page
      addElementToMockPage(pages.cart, '#cart-items', { text: '1 item in cart' });
      addElementToMockPage(pages.cart, '#checkout-button', { text: 'Checkout', tagName: 'BUTTON' });
      setLocalStorage(pages.cart, 'visited_pages', JSON.stringify(['home', 'product', 'cart']));
      setCookie(pages.cart, 'cart_total', '29.99');

      // 4. Validate navigation flow
      Object.entries(pages).forEach(([pageName, page]) => {
        expect(assertNavigationState(page, {
          url: new RegExp('shop\\.com'),
          title: new RegExp('Online Shop')
        }).pass).toBe(true);

        expect(assertPageContent(page, new RegExp(pageName === 'home' ? 'Welcome' :
          pageName === 'product' ? 'Product' : 'Cart')).pass).toBe(true);
      });

      // 5. Validate cross-page state persistence
      const homeVisitedPages = JSON.parse(pages.home.localStorage.get('visited_pages')!);
      const productVisitedPages = JSON.parse(pages.product.localStorage.get('visited_pages')!);
      const cartVisitedPages = JSON.parse(pages.cart.localStorage.get('visited_pages')!);

      expect(homeVisitedPages).toEqual(['home']);
      expect(productVisitedPages).toEqual(['home', 'product']);
      expect(cartVisitedPages).toEqual(['home', 'product', 'cart']);

      // 6. Validate page-specific functionality
      expect(assertElementExists(pages.product, '#add-to-cart').pass).toBe(true);
      expect(assertElementExists(pages.cart, '#checkout-button').pass).toBe(true);
      expect(assertCookie(pages.cart, 'cart_total', '29.99').pass).toBe(true);
    });
  });

  describe('Screenshot Validation Integration', () => {
    it('should simulate screenshot capture and validation workflow', () => {
      // 1. Create test pages for screenshot comparison
      const simplePage = TestPages.simple('Screenshot Test', '#ffffff');
      const complexPage = TestPages.complex();
      const unicodePage = TestPages.unicode();

      // 2. Simulate screenshot data
      const pngData = Buffer.from([0x89, 0x50, 0x4E, 0x47, ...Array(1000).fill(0)]);
      const jpegData = Buffer.from([0xFF, 0xD8, 0xFF, ...Array(800).fill(1)]);
      const invalidData = Buffer.from([0x00, 0x01, 0x02, 0x03]);

      // 3. Validate image formats
      expect(ScreenshotValidators.isPNG(pngData)).toBe(true);
      expect(ScreenshotValidators.isJPEG(jpegData)).toBe(true);
      expect(ScreenshotValidators.isPNG(invalidData)).toBe(false);
      expect(ScreenshotValidators.isJPEG(invalidData)).toBe(false);

      // 4. Simulate screenshot results
      const successfulResult = {
        success: true,
        duration: 150,
        data: pngData,
        error: undefined
      };

      const failedResult = {
        success: false,
        duration: 75,
        error: 'Page timeout'
      };

      // 5. Validate screenshot results
      expect(ScreenshotValidators.isSuccessfulResult(successfulResult)).toBe(true);
      expect(ScreenshotValidators.isFailedResult(failedResult)).toBe(true);
      expect(ScreenshotValidators.isSuccessfulResult(failedResult)).toBe(false);
      expect(ScreenshotValidators.isFailedResult(successfulResult)).toBe(false);

      // 6. Create page objects for screenshot scenarios
      const screenshotPage = createMockPage({
        url: generateTestUrl({ host: 'screenshot.test.com', path: '/capture' }),
        title: 'Screenshot Test Page',
        content: simplePage
      });

      // 7. Add screenshot metadata
      setLocalStorage(screenshotPage, 'screenshot_count', '3');
      setLocalStorage(screenshotPage, 'last_screenshot', new Date().toISOString());
      setCookie(screenshotPage, 'screenshot_session', 'capture_session_123');

      // 8. Log screenshot activity
      addConsoleMessage(screenshotPage, 'info', 'Screenshot capture initiated');
      addConsoleMessage(screenshotPage, 'debug', 'Page rendered successfully');

      // 9. Validate complete screenshot workflow
      expect(assertBrowserState(screenshotPage, {
        url: /screenshot\.test\.com/,
        title: /Screenshot/,
        hasErrors: false,
        consoleMessages: [
          { level: 'info', text: /capture/ },
          { level: 'debug', text: /rendered/ }
        ]
      }).pass).toBe(true);

      expect(assertLocalStorage(screenshotPage, 'screenshot_count', '3').pass).toBe(true);
      expect(assertCookie(screenshotPage, 'screenshot_session').pass).toBe(true);
    });
  });

  describe('Performance Testing Integration', () => {
    it('should measure performance across multiple operations', () => {
      const monitor = new PerformanceMonitor();

      // 1. Simulate page load performance
      monitor.start();
      const loadPage = createMockPage({
        url: generateTestUrl({ host: 'perf.test.com' }),
        title: 'Performance Test'
      });
      const loadTime = monitor.stop();

      // 2. Simulate DOM manipulation performance
      monitor.start();
      for (let i = 0; i < 100; i++) {
        addElementToMockPage(loadPage, `#element-${i}`, {
          text: `Element ${i}`,
          tagName: 'DIV'
        });
      }
      const domTime = monitor.stop();

      // 3. Simulate assertion performance
      monitor.start();
      const assertionResults = [];
      for (let i = 0; i < 100; i++) {
        assertionResults.push(assertElementExists(loadPage, `#element-${i}`));
      }
      const assertionTime = monitor.stop();

      // 4. Validate all operations succeeded
      expect(assertionResults.every(result => result.success)).toBe(true);

      // 5. Analyze performance statistics
      const stats = monitor.getStats();
      expect(stats.count).toBe(3);
      expect(stats.min).toBeLessThanOrEqual(stats.max);
      expect(stats.average).toBeGreaterThan(0);

      // 6. Log performance data
      addConsoleMessage(loadPage, 'info', `Page load: ${loadTime}ms`);
      addConsoleMessage(loadPage, 'info', `DOM manipulation: ${domTime}ms`);
      addConsoleMessage(loadPage, 'info', `Assertions: ${assertionTime}ms`);

      // 7. Store performance metrics
      setLocalStorage(loadPage, 'perf_load_time', loadTime.toString());
      setLocalStorage(loadPage, 'perf_dom_time', domTime.toString());
      setLocalStorage(loadPage, 'perf_assertion_time', assertionTime.toString());

      // 8. Validate performance tracking
      expect(assertLocalStorage(loadPage, 'perf_load_time').pass).toBe(true);
      expect(assertConsoleContains(loadPage, 'info', /Page load/).pass).toBe(true);
      expect(assertConsoleContains(loadPage, 'info', /DOM manipulation/).pass).toBe(true);
      expect(assertConsoleContains(loadPage, 'info', /Assertions/).pass).toBe(true);
    });
  });

  describe('Cross-utility Error Handling', () => {
    it('should handle errors gracefully across all utility modules', () => {
      // 1. Test URL validation with invalid inputs
      expect(urlValidators.isValidUrl('')).toBe(false);
      expect(urlValidators.isValidUrl('not-a-url')).toBe(false);

      // 2. Test assertions with missing elements
      const emptyPage = createMockPage();

      expect(assertElementExists(emptyPage, '#nonexistent').pass).toBe(false);
      expect(assertElementVisible(emptyPage, '#nonexistent').pass).toBe(false);
      expect(assertElementText(emptyPage, '#nonexistent', 'any text').pass).toBe(false);

      // 3. Test screenshot validators with invalid data
      expect(ScreenshotValidators.isPNG(Buffer.from([]))).toBe(false);
      expect(ScreenshotValidators.isJPEG(Buffer.from([]))).toBe(false);
      expect(ScreenshotValidators.isSuccessfulResult(null)).toBe(false);
      expect(ScreenshotValidators.isFailedResult(null)).toBe(false);

      // 4. Test performance monitor edge cases
      const perfMonitor = new PerformanceMonitor();
      expect(perfMonitor.getAverage()).toBe(0);
      expect(perfMonitor.getMedian()).toBe(0);
      expect(perfMonitor.getMin()).toBe(0);
      expect(perfMonitor.getMax()).toBe(0);

      // 5. Validate error reporting
      const errorPage = createMockPage();
      addError(errorPage, 'Test error');
      expect(assertNoErrors(errorPage).pass).toBe(false);

      // 6. Test with malformed data
      expect(() => {
        assertNavigationState(emptyPage, { url: /.*/ });
      }).not.toThrow();

      expect(() => {
        assertBrowserState(emptyPage, {
          elementExists: ['#nonexistent']
        });
      }).not.toThrow();

      // All error cases should fail gracefully, not throw exceptions
    });
  });
});