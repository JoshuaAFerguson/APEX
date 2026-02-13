/**
 * Test Utils Implementation Validation
 *
 * Validates that all test utilities and helper functions for browser test scenarios
 * are properly implemented and exported from the central test-utils module.
 */

import { describe, it, expect } from 'vitest';

// Import all test utilities from the central module
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

  // Test Pages
  TestPages,
  TestDataGenerators,

  // Validators
  ScreenshotValidators,

  // Performance
  PerformanceMonitor,

  // Mock Scenarios
  MockScenarios,

  // Navigation Helpers
  goto,
  waitForNavigation,
  assertURL,
  assertPageContent as assertPageContentNav
} from '../test-utils.js';

describe('Test Utilities Implementation Validation', () => {
  describe('Mock Page Objects', () => {
    it('should create mock page objects', () => {
      const mockPage = createMockPage();
      expect(mockPage).toBeDefined();
      expect(mockPage.url).toBe('about:blank');
      expect(mockPage.title).toBe('Test Page');
      expect(mockPage.elements).toBeInstanceOf(Map);
    });

    it('should create mock elements', () => {
      const mockElement = createMockElement('#test');
      expect(mockElement).toBeDefined();
      expect(mockElement.selector).toBe('#test');
      expect(mockElement.visible).toBe(true);
      expect(mockElement.enabled).toBe(true);
    });

    it('should create mock pages with forms', () => {
      const formConfig = {
        action: '/submit',
        method: 'POST' as const,
        fields: [
          {
            name: 'username',
            type: 'text' as const,
            label: 'Username',
            required: true
          }
        ]
      };

      const mockPage = createMockPageWithForm(formConfig);
      expect(mockPage).toBeDefined();
      expect(mockPage.title).toBe('Form Test Page');
      expect(mockPage.elements.has('#username')).toBe(true);
    });

    it('should create mock pages with navigation', () => {
      const links = [
        { href: '/home', text: 'Home' },
        { href: '/about', text: 'About' }
      ];

      const mockPage = createMockPageWithNavigation(links);
      expect(mockPage).toBeDefined();
      expect(mockPage.title).toBe('Navigation Test Page');
    });
  });

  describe('DOM Structure Builders', () => {
    it('should build form HTML', () => {
      const formConfig = {
        fields: [
          {
            name: 'email',
            type: 'email' as const,
            label: 'Email Address',
            required: true
          }
        ]
      };

      const html = buildFormHtml(formConfig);
      expect(html).toContain('<form');
      expect(html).toContain('type="email"');
      expect(html).toContain('name="email"');
    });

    it('should build table HTML', () => {
      const tableConfig = {
        headers: ['Name', 'Age'],
        rows: [['John', '25'], ['Jane', '30']]
      };

      const html = buildTableHtml(tableConfig);
      expect(html).toContain('<table');
      expect(html).toContain('<th>Name</th>');
      expect(html).toContain('<td>John</td>');
    });

    it('should build navigation HTML', () => {
      const links = [
        { href: '/home', text: 'Home' },
        { href: '/about', text: 'About' }
      ];

      const html = buildNavigationHtml(links);
      expect(html).toContain('<nav>');
      expect(html).toContain('href="/home"');
      expect(html).toContain('>Home<');
    });

    it('should build modal HTML', () => {
      const modalConfig = {
        title: 'Test Modal',
        content: 'Modal content here'
      };

      const html = buildModalHtml(modalConfig);
      expect(html).toContain('class="modal"');
      expect(html).toContain('Test Modal');
      expect(html).toContain('Modal content here');
    });
  });

  describe('URL Generators', () => {
    it('should generate test URLs', () => {
      const url = generateTestUrl({
        protocol: 'https',
        host: 'test.example.com',
        path: '/test'
      });

      expect(url).toBe('https://test.example.com/test');
    });

    it('should generate multiple test URLs', () => {
      const urls = generateTestUrls(3, { host: 'test.com' });
      expect(urls).toHaveLength(3);
      expect(urls[0]).toContain('/page-0');
      expect(urls[1]).toContain('/page-1');
      expect(urls[2]).toContain('/page-2');
    });

    it('should create URL patterns', () => {
      const url = createUrlPattern('/users/:id/posts/:postId', {
        id: '123',
        postId: '456'
      });

      expect(url).toBe('/users/123/posts/456');
    });

    it('should provide predefined test URLs', () => {
      expect(testUrls.valid).toBeInstanceOf(Array);
      expect(testUrls.invalid).toBeInstanceOf(Array);
      expect(testUrls.protocols).toBeInstanceOf(Array);
    });

    it('should provide URL validators', () => {
      expect(urlValidators.isValidUrl('https://example.com')).toBe(true);
      expect(urlValidators.isValidUrl('not-a-url')).toBe(false);
      expect(urlValidators.isHttps('https://example.com')).toBe(true);
      expect(urlValidators.isLocalhost('http://localhost:3000')).toBe(true);
    });
  });

  describe('Browser State Assertions', () => {
    it('should validate assertion functions exist', () => {
      expect(typeof assertNavigationState).toBe('function');
      expect(typeof assertPageContent).toBe('function');
      expect(typeof assertElementExists).toBe('function');
      expect(typeof assertElementVisible).toBe('function');
      expect(typeof assertElementText).toBe('function');
      expect(typeof assertNoErrors).toBe('function');
      expect(typeof assertConsoleContains).toBe('function');
      expect(typeof assertBrowserState).toBe('function');
    });

    it('should assert navigation state', () => {
      const mockPage = createMockPage({
        url: 'https://example.com/test',
        title: 'Test Page'
      });

      const result = assertNavigationState(mockPage, {
        url: 'https://example.com/test',
        title: 'Test Page'
      });

      expect(result.success).toBe(true);
    });

    it('should assert element existence', () => {
      const mockPage = createMockPage();
      addElementToMockPage(mockPage, '#test-element', {
        tagName: 'DIV',
        text: 'Test Element'
      });

      const result = assertElementExists(mockPage, '#test-element');
      expect(result.success).toBe(true);
    });
  });

  describe('Test Page Generators', () => {
    it('should generate simple test pages', () => {
      const page = TestPages.simple('My Test Page');
      expect(page).toContain('<title>My Test Page</title>');
      expect(page).toContain('<h1>My Test Page</h1>');
    });

    it('should generate tall pages', () => {
      const page = TestPages.tall(3000);
      expect(page).toContain('height:3000px');
      expect(page).toContain('Tall Page Test');
    });

    it('should generate complex pages', () => {
      const page = TestPages.complex();
      expect(page).toContain('@keyframes pulse');
      expect(page).toContain('Complex Test Page');
    });

    it('should generate unicode test pages', () => {
      const page = TestPages.unicode();
      expect(page).toContain('🌟');
      expect(page).toContain('你好');
    });
  });

  describe('Test Data Generators', () => {
    it('should generate heavy content', () => {
      const content = TestDataGenerators.generateHeavyContent(10);
      expect(content).toContain('Heavy Content Test (10 elements)');
      expect(content).toContain('Element 1');
      expect(content).toContain('Element 10');
    });

    it('should generate random colors', () => {
      const color = TestDataGenerators.randomColor();
      expect(color).toMatch(/^hsl\(\d+, \d+%, \d+%\)$/);
    });

    it('should generate random test pages', () => {
      const page = TestDataGenerators.randomTestPage();
      expect(page).toContain('Random Test Page');
      expect(page).toContain('Random content');
    });
  });

  describe('Validators', () => {
    it('should validate PNG buffers', () => {
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47]);
      expect(ScreenshotValidators.isPNG(pngBuffer)).toBe(true);

      const notPngBuffer = Buffer.from([0x00, 0x00, 0x00, 0x00]);
      expect(ScreenshotValidators.isPNG(notPngBuffer)).toBe(false);
    });

    it('should validate JPEG buffers', () => {
      const jpegBuffer = Buffer.from([0xFF, 0xD8, 0xFF]);
      expect(ScreenshotValidators.isJPEG(jpegBuffer)).toBe(true);

      const notJpegBuffer = Buffer.from([0x00, 0x00, 0x00]);
      expect(ScreenshotValidators.isJPEG(notJpegBuffer)).toBe(false);
    });
  });

  describe('Performance Monitor', () => {
    it('should track performance measurements', () => {
      const monitor = new PerformanceMonitor();

      monitor.start();
      const duration = monitor.stop();

      expect(typeof duration).toBe('number');
      expect(duration).toBeGreaterThanOrEqual(0);

      const stats = monitor.getStats();
      expect(stats.count).toBe(1);
      expect(stats.average).toBe(duration);
    });
  });

  describe('Navigation Helpers', () => {
    it('should export navigation helper functions', () => {
      expect(typeof goto).toBe('function');
      expect(typeof waitForNavigation).toBe('function');
      expect(typeof assertURL).toBe('function');
      expect(typeof assertPageContentNav).toBe('function');
    });
  });
});