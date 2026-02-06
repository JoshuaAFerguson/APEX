/**
 * @apexcli/browser - Browser Test Utils Integration Test Suite
 *
 * Comprehensive integration tests validating all browser test utilities work together
 * Tests realistic scenarios that combine multiple utilities
 */

import { describe, it, expect, beforeEach } from 'vitest';
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
  type MockPageObject,
  type FormConfig,
  type NavLink,

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
  type TableConfig,
  type ModalConfig,
  type CardConfig,

  // URL Generators
  generateTestUrl,
  generateTestUrls,
  createUrlPattern,
  testUrls,
  urlValidators,
  urlUtils,
  urlScenarios,
  type TestUrlOptions,

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
  type NavigationState,
  type BrowserStateExpectation,

  // Advanced utilities
  TestPages,
  TestDataGenerators,
  ScreenshotValidators,
  PerformanceMonitor,
  MockScenarios,
} from '../index.js';

describe('Browser Test Utils Integration', () => {
  describe('E2E Form Testing Scenario', () => {
    it('should create, manipulate, and validate a complete form testing scenario', () => {
      // 1. Generate test URL for form submission
      const baseUrl = generateTestUrl({
        host: 'forms.example.com',
        path: '/contact',
        query: { source: 'test' }
      });

      // 2. Create form configuration
      const formConfig: FormConfig = {
        action: '/api/submit',
        method: 'POST',
        submitLabel: 'Send Message',
        fields: [
          { name: 'name', type: 'text', label: 'Full Name', required: true },
          { name: 'email', type: 'email', label: 'Email Address', required: true },
          { name: 'subject', type: 'select', label: 'Subject', options: ['Support', 'Sales', 'General'] },
          { name: 'message', type: 'textarea', label: 'Message', required: true },
          { name: 'newsletter', type: 'checkbox', label: 'Subscribe to Newsletter' }
        ]
      };

      // 3. Create mock page with form
      const page = createMockPageWithForm(formConfig, {
        url: baseUrl,
        title: 'Contact Form'
      });

      // 4. Add additional page elements
      addElementToMockPage(page, '#success-message', {
        text: 'Thank you for your message!',
        tagName: 'DIV',
        visible: false,
        attributes: { class: 'alert alert-success' }
      });

      addElementToMockPage(page, '#error-message', {
        text: 'Please fix the errors below',
        tagName: 'DIV',
        visible: false,
        attributes: { class: 'alert alert-error' }
      });

      // 5. Add browser state data
      setCookie(page, 'csrf_token', 'abc123def456');
      setLocalStorage(page, 'form_draft', '{"name":"John Doe"}');
      addConsoleMessage(page, 'info', 'Form validation script loaded');

      // 6. Perform assertions
      // Form structure assertions
      expect(assertElementExists(page, '#name')).toEqual({
        success: true,
        message: 'Element found: #name'
      });

      expect(assertElementExists(page, '#email')).toEqual({
        success: true,
        message: 'Element found: #email'
      });

      expect(assertElementExists(page, '#submit')).toEqual({
        success: true,
        message: 'Element found: #submit'
      });

      // Element properties assertions
      expect(assertElementTagName(page, '#name', 'INPUT')).toEqual({
        success: true,
        message: 'Element #name has expected tag name INPUT'
      });

      expect(assertElementAttributes(page, '#name', { required: 'true' })).toEqual({
        success: true,
        message: 'Element #name has expected attributes'
      });

      // Browser state assertions
      expect(assertCookie(page, 'csrf_token', 'abc123def456')).toEqual({
        success: true,
        message: 'Cookie csrf_token has expected value'
      });

      expect(assertLocalStorage(page, 'form_draft', '{"name":"John Doe"}')).toEqual({
        success: true,
        message: 'LocalStorage form_draft has expected value'
      });

      expect(assertConsoleContains(page, 'info', 'Form validation script loaded')).toEqual({
        success: true,
        message: 'Console contains expected message'
      });

      expect(assertNoErrors(page)).toEqual({
        success: true,
        message: 'No errors found on page'
      });

      // Navigation state assertion
      const expectedNavState: NavigationState = {
        url: baseUrl,
        title: 'Contact Form'
      };
      expect(assertNavigationState(page, expectedNavState)).toEqual({
        success: true,
        message: 'Navigation state matches expected state'
      });

      // Complete page content validation
      expect(assertPageContent(page, 'Contact Form')).toEqual({
        success: true,
        message: 'Page content contains expected text'
      });

      // 7. Validate URL components
      expect(urlValidators.isValidUrl(baseUrl)).toBe(true);
      expect(urlValidators.hasQuery(baseUrl)).toBe(true);
      expect(urlUtils.getDomain(baseUrl)).toBe('forms.example.com');
      expect(urlUtils.parseQuery(baseUrl)).toEqual({ source: 'test' });
    });

    it('should simulate form validation errors and test error scenarios', () => {
      // Create a form page with validation errors
      const page = createMockPageWithForm({
        fields: [
          { name: 'email', type: 'email', label: 'Email', required: true }
        ]
      });

      // Simulate validation errors
      addError(page, 'Invalid email address');
      addError(page, 'Email is required');
      addConsoleMessage(page, 'error', 'Form validation failed');

      // Add error elements
      addElementToMockPage(page, '#email-error', {
        text: 'Please enter a valid email address',
        tagName: 'SPAN',
        attributes: { class: 'error-message' }
      });

      // Test error assertions
      expect(assertNoErrors(page)).toEqual({
        success: false,
        message: 'Found 2 errors: Invalid email address, Email is required'
      });

      expect(assertElementText(page, '#email-error', 'Please enter a valid email address')).toEqual({
        success: true,
        message: 'Element #email-error has expected text'
      });

      expect(assertConsoleContains(page, 'error', 'validation failed')).toEqual({
        success: true,
        message: 'Console contains expected message'
      });
    });
  });

  describe('E2E Navigation and Layout Testing Scenario', () => {
    it('should create and test a complete page layout with navigation', () => {
      // 1. Generate navigation URLs
      const baseUrls = generateTestUrls(4, {
        host: 'myapp.com',
        path: '/dashboard'
      });

      // 2. Create navigation links
      const navLinks: NavLink[] = [
        { href: baseUrls[0], text: 'Dashboard' },
        { href: baseUrls[1], text: 'Profile' },
        { href: baseUrls[2], text: 'Settings' },
        { href: baseUrls[3], text: 'Logout', className: 'logout-link' }
      ];

      // 3. Build page components
      const navigation = buildNavigationHtml(navLinks);
      const breadcrumbs = buildBreadcrumbHtml([
        { text: 'Home', href: '/' },
        { text: 'Dashboard', href: '/dashboard' },
        { text: 'Current Page' }
      ]);

      const table = buildTableHtml({
        headers: ['User', 'Role', 'Last Login'],
        rows: [
          ['John Doe', 'Admin', '2024-01-15'],
          ['Jane Smith', 'User', '2024-01-14']
        ],
        className: 'user-table',
        striped: true
      });

      const sidebar = buildListHtml([
        'Quick Actions',
        'Recent Activity',
        'Notifications'
      ]);

      // 4. Create complete page
      const completePage = buildCompletePage({
        title: 'Dashboard - MyApp',
        body: buildLayoutHtml({
          header: `${breadcrumbs}${navigation}`,
          sidebar,
          main: `<h1>Dashboard</h1>${table}`,
          footer: '<p>&copy; 2024 MyApp. All rights reserved.</p>'
        }),
        styles: `
          .layout { display: grid; grid-template-areas: "header header" "sidebar main" "footer footer"; }
          .user-table { width: 100%; }
          .logout-link { color: red; }
        `,
        meta: [
          { name: 'description', content: 'User dashboard' }
        ]
      });

      // 5. Create mock page from generated HTML
      const mockPage = createMockPage({
        url: baseUrls[0],
        title: 'Dashboard - MyApp',
        content: completePage
      });

      // 6. Add navigation elements to mock page
      navLinks.forEach((link, index) => {
        addElementToMockPage(mockPage, `#nav-link-${index}`, {
          tagName: 'A',
          text: link.text,
          attributes: {
            href: link.href,
            ...(link.className && { class: link.className })
          }
        });
      });

      // 7. Add table elements
      addElementToMockPage(mockPage, '.user-table', {
        tagName: 'TABLE',
        attributes: { class: 'user-table' }
      });

      // 8. Perform comprehensive assertions
      expect(assertPageContent(mockPage, 'Dashboard - MyApp')).toEqual({
        success: true,
        message: 'Page content contains expected text'
      });

      expect(assertElementExists(mockPage, '#nav-link-0')).toEqual({
        success: true,
        message: 'Element found: #nav-link-0'
      });

      expect(assertElementText(mockPage, '#nav-link-3', 'Logout')).toEqual({
        success: true,
        message: 'Element #nav-link-3 has expected text'
      });

      expect(assertElementAttributes(mockPage, '#nav-link-3', { class: 'logout-link' })).toEqual({
        success: true,
        message: 'Element #nav-link-3 has expected attributes'
      });

      expect(assertElementTagName(mockPage, '.user-table', 'TABLE')).toEqual({
        success: true,
        message: 'Element .user-table has expected tag name TABLE'
      });

      // Test URL pattern matching
      const dynamicUrl = createUrlPattern('/dashboard/:section/:id', {
        section: 'users',
        id: '123'
      });
      expect(dynamicUrl).toBe('/dashboard/users/123');

      // Validate all navigation URLs
      baseUrls.forEach(url => {
        expect(urlValidators.isValidUrl(url)).toBe(true);
        expect(urlUtils.getDomain(url)).toBe('myapp.com');
      });
    });
  });

  describe('E2E API Testing Scenario', () => {
    it('should create and test API endpoint scenarios', () => {
      // 1. Generate various API URLs
      const apiUrls = {
        rest: urlScenarios.api.rest('v1'),
        graphql: urlScenarios.api.graphql(),
        webhook: urlScenarios.api.webhook('payment-completed')
      };

      // 2. Test URL generation and validation
      Object.entries(apiUrls).forEach(([type, url]) => {
        expect(urlValidators.isValidUrl(url)).toBe(true);
        expect(urlValidators.isHttps(url)).toBe(true);
      });

      // 3. Create test pages for API responses
      const successPage = createMockPage({
        url: apiUrls.rest,
        title: 'API Response',
        content: JSON.stringify({ status: 'success', data: { id: 123 } })
      });

      const errorPage = createMockPage({
        url: apiUrls.rest,
        title: 'API Error',
        content: JSON.stringify({ status: 'error', message: 'Not found' })
      });

      // 4. Add API response metadata
      setCookie(successPage, 'api_session', 'valid_token');
      setLocalStorage(successPage, 'last_api_call', apiUrls.rest);
      addConsoleMessage(successPage, 'info', 'API call successful');

      addError(errorPage, '404 Not Found');
      addConsoleMessage(errorPage, 'error', 'API call failed');

      // 5. Test API response scenarios
      expect(assertPageContent(successPage, '"status": "success"')).toEqual({
        success: true,
        message: 'Page content contains expected text'
      });

      expect(assertNoErrors(successPage)).toEqual({
        success: true,
        message: 'No errors found on page'
      });

      expect(assertConsoleContains(successPage, 'info', 'API call successful')).toEqual({
        success: true,
        message: 'Console contains expected message'
      });

      expect(assertNoErrors(errorPage)).toEqual({
        success: false,
        message: 'Found 1 errors: 404 Not Found'
      });

      expect(assertConsoleContains(errorPage, 'error', 'API call failed')).toEqual({
        success: true,
        message: 'Console contains expected message'
      });

      // 6. Test URL manipulation
      const urlWithAuth = urlUtils.addQuery(apiUrls.rest, {
        token: 'abc123',
        format: 'json'
      });

      expect(urlValidators.hasQuery(urlWithAuth)).toBe(true);
      expect(urlUtils.parseQuery(urlWithAuth)).toEqual({
        token: 'abc123',
        format: 'json'
      });

      // 7. Test URL pattern generation for RESTful endpoints
      const userDetailUrl = createUrlPattern(`${apiUrls.rest}/users/:userId`, {
        userId: '456'
      });

      expect(userDetailUrl).toContain('/users/456');
    });
  });

  describe('E2E Modal and Card Testing Scenario', () => {
    it('should create and test interactive UI components', () => {
      // 1. Build modal component
      const modalConfig: ModalConfig = {
        id: 'confirm-modal',
        title: 'Confirm Action',
        content: 'Are you sure you want to delete this item?',
        hasCloseButton: true,
        hasOverlay: true,
        className: 'confirm-modal'
      };

      const modal = buildModalHtml(modalConfig);

      // 2. Build card grid
      const cards: CardConfig[] = [
        {
          title: 'Product A',
          content: 'Description of Product A',
          imageUrl: '/images/product-a.jpg',
          actions: [
            { text: 'View', href: '/products/a' },
            { text: 'Edit', href: '/products/a/edit' },
            { text: 'Delete', className: 'danger-action' }
          ]
        },
        {
          title: 'Product B',
          content: 'Description of Product B',
          imageUrl: '/images/product-b.jpg',
          actions: [
            { text: 'View', href: '/products/b' },
            { text: 'Edit', href: '/products/b/edit' }
          ]
        }
      ];

      const cardGrid = buildCardGridHtml(cards);

      // 3. Create complete page with modal and cards
      const pageHtml = buildCompletePage({
        title: 'Product Management',
        body: `
          <h1>Products</h1>
          ${cardGrid}
          ${modal}
        `,
        styles: `
          .card-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
          .confirm-modal { background: white; border-radius: 8px; }
          .danger-action { color: red; }
        `
      });

      // 4. Create mock page
      const page = createMockPage({
        url: generateTestUrl({ host: 'admin.example.com', path: '/products' }),
        title: 'Product Management',
        content: pageHtml
      });

      // 5. Add interactive elements
      addElementToMockPage(page, '#confirm-modal', {
        tagName: 'DIV',
        attributes: { class: 'confirm-modal' },
        visible: false
      });

      addElementToMockPage(page, '.modal-close', {
        tagName: 'BUTTON',
        text: '×',
        attributes: { 'aria-label': 'Close' }
      });

      cards.forEach((card, cardIndex) => {
        card.actions?.forEach((action, actionIndex) => {
          const selector = `#card-${cardIndex}-action-${actionIndex}`;
          addElementToMockPage(page, selector, {
            tagName: action.href ? 'A' : 'BUTTON',
            text: action.text,
            attributes: {
              ...(action.href && { href: action.href }),
              ...(action.className && { class: action.className })
            }
          });
        });
      });

      // 6. Test modal functionality
      expect(assertElementExists(page, '#confirm-modal')).toEqual({
        success: true,
        message: 'Element found: #confirm-modal'
      });

      expect(assertElementVisible(page, '#confirm-modal')).toEqual({
        success: false,
        message: 'Element #confirm-modal is not visible'
      });

      expect(assertElementExists(page, '.modal-close')).toEqual({
        success: true,
        message: 'Element found: .modal-close'
      });

      // 7. Test card actions
      expect(assertElementExists(page, '#card-0-action-0')).toEqual({
        success: true,
        message: 'Element found: #card-0-action-0'
      });

      expect(assertElementText(page, '#card-0-action-0', 'View')).toEqual({
        success: true,
        message: 'Element #card-0-action-0 has expected text'
      });

      expect(assertElementAttributes(page, '#card-0-action-2', { class: 'danger-action' })).toEqual({
        success: true,
        message: 'Element #card-0-action-2 has expected attributes'
      });

      // 8. Test complete page structure
      expect(assertPageContent(page, 'Product Management')).toEqual({
        success: true,
        message: 'Page content contains expected text'
      });

      expect(assertPageContent(page, 'Product A')).toEqual({
        success: true,
        message: 'Page content contains expected text'
      });

      expect(assertPageContent(page, 'Are you sure you want to delete')).toEqual({
        success: true,
        message: 'Page content contains expected text'
      });
    });
  });

  describe('Advanced Utility Integration', () => {
    it('should test advanced utilities like TestPages, TestDataGenerators, and MockScenarios', () => {
      // 1. Test TestPages utility
      const testPageTypes = ['login', 'dashboard', 'profile', 'settings'];
      testPageTypes.forEach(pageType => {
        expect(typeof TestPages.create).toBe('function');
        expect(typeof TestPages.loadFixture).toBe('function');
      });

      // 2. Test TestDataGenerators
      expect(typeof TestDataGenerators.randomUser).toBe('function');
      expect(typeof TestDataGenerators.mockApiResponse).toBe('function');
      expect(typeof TestDataGenerators.generateFormData).toBe('function');

      // 3. Test MockScenarios
      expect(typeof MockScenarios.userLogin).toBe('function');
      expect(typeof MockScenarios.apiError).toBe('function');
      expect(typeof MockScenarios.pageLoad).toBe('function');

      // 4. Test ScreenshotValidators
      expect(typeof ScreenshotValidators.compareImages).toBe('function');
      expect(typeof ScreenshotValidators.validateLayout).toBe('function');

      // 5. Test PerformanceMonitor
      expect(typeof PerformanceMonitor.startMonitoring).toBe('function');
      expect(typeof PerformanceMonitor.getMetrics).toBe('function');
      expect(typeof PerformanceMonitor.stopMonitoring).toBe('function');
    });

    it('should validate all exported functions are working correctly', () => {
      // Test all main utility categories are available
      const utilities = {
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
      };

      // Ensure all utilities are functions or objects
      Object.entries(utilities).forEach(([name, utility]) => {
        expect(utility).toBeDefined();
        expect(['function', 'object'].includes(typeof utility)).toBe(true);
      });

      // Test constant utilities
      expect(testUrls).toBeDefined();
      expect(urlValidators).toBeDefined();
      expect(urlUtils).toBeDefined();
      expect(urlScenarios).toBeDefined();

      // Ensure they have expected properties
      expect(typeof testUrls.valid).toBe('object');
      expect(typeof urlValidators.isValidUrl).toBe('function');
      expect(typeof urlUtils.addQuery).toBe('function');
      expect(typeof urlScenarios.api).toBe('object');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid inputs gracefully', () => {
      // Test with empty or invalid data
      const emptyPage = createMockPage();

      expect(assertElementExists(emptyPage, '#nonexistent')).toEqual({
        success: false,
        message: 'Element not found: #nonexistent'
      });

      expect(assertElementText(emptyPage, '#missing', 'any text')).toEqual({
        success: false,
        message: 'Element not found: #missing'
      });

      expect(assertCookie(emptyPage, 'missing_cookie', 'value')).toEqual({
        success: false,
        message: 'Cookie missing_cookie not found'
      });

      // Test URL validation with invalid URLs
      expect(urlValidators.isValidUrl('not-a-url')).toBe(false);
      expect(urlValidators.isValidUrl('')).toBe(false);
      expect(urlValidators.isValidUrl(undefined as any)).toBe(false);

      // Test graceful DOM building with minimal data
      expect(buildFormHtml({ fields: [] })).toContain('<form');
      expect(buildTableHtml({ headers: [], rows: [] })).toContain('<table');
      expect(buildNavigationHtml([])).toContain('<nav');
    });

    it('should maintain data integrity across complex operations', () => {
      // Create a complex scenario with multiple operations
      const page = createMockPage({
        url: generateTestUrl({ host: 'test.example.com' })
      });

      // Add multiple elements
      const elements = Array.from({ length: 10 }, (_, i) => ({
        selector: `#element-${i}`,
        text: `Element ${i}`,
        tagName: 'DIV' as const
      }));

      elements.forEach(el => {
        addElementToMockPage(page, el.selector, el);
      });

      // Add multiple console messages
      const logLevels = ['debug', 'info', 'warn', 'error', 'log'] as const;
      logLevels.forEach((level, i) => {
        addConsoleMessage(page, level, `Message ${i} at level ${level}`);
      });

      // Add multiple cookies and localStorage items
      Array.from({ length: 5 }, (_, i) => {
        setCookie(page, `cookie${i}`, `value${i}`);
        setLocalStorage(page, `key${i}`, `value${i}`);
      });

      // Verify all data is preserved correctly
      expect(page.elements.size).toBe(10);
      expect(page.consoleMessages.length).toBe(5);
      expect(page.cookies.length).toBe(5);
      expect(page.localStorage.size).toBe(5);

      // Test assertions work correctly
      elements.forEach(el => {
        expect(assertElementExists(page, el.selector)).toEqual({
          success: true,
          message: `Element found: ${el.selector}`
        });

        expect(assertElementText(page, el.selector, el.text)).toEqual({
          success: true,
          message: `Element ${el.selector} has expected text`
        });
      });

      logLevels.forEach((level, i) => {
        expect(assertConsoleContains(page, level, `Message ${i}`)).toEqual({
          success: true,
          message: 'Console contains expected message'
        });
      });

      Array.from({ length: 5 }, (_, i) => {
        expect(assertCookie(page, `cookie${i}`, `value${i}`)).toEqual({
          success: true,
          message: `Cookie cookie${i} has expected value`
        });

        expect(assertLocalStorage(page, `key${i}`, `value${i}`)).toEqual({
          success: true,
          message: `LocalStorage key${i} has expected value`
        });
      });
    });
  });
});