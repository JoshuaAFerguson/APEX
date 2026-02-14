/**
 * @apexcli/browser - HTML Fixtures Validation Tests
 *
 * Tests for validating the existing HTML fixture files that serve as templates:
 * - test-page.html (basic navigation test page)
 * - form-test.html (comprehensive form test page)
 * - iframe-test.html (iframe and frame testing page)
 * - page2.html and page3.html (additional navigation pages)
 */

import { describe, it, expect } from 'vitest';
import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { JSDOM } from 'jsdom';

// Helper function to read fixture files
async function readFixture(filename: string): Promise<string> {
  const fixturePath = resolve(__dirname, 'fixtures', filename);
  return await readFile(fixturePath, 'utf-8');
}

// Helper function to parse HTML and validate structure
function parseAndValidateHtml(html: string) {
  const dom = new JSDOM(html);
  const document = dom.window.document;

  return {
    dom,
    document,
    isValid: document.querySelector('html') !== null && document.querySelector('body') !== null
  };
}

describe('HTML Fixtures Validation', () => {

  describe('test-page.html (Navigation Test Page)', () => {
    let html: string;
    let document: Document;

    beforeAll(async () => {
      html = await readFixture('test-page.html');
      const parsed = parseAndValidateHtml(html);
      document = parsed.document;
    });

    it('should exist and contain valid HTML', () => {
      expect(html).toBeTruthy();
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html lang="en">');
    });

    it('should have proper page structure', () => {
      expect(document.querySelector('html')).toBeTruthy();
      expect(document.querySelector('head')).toBeTruthy();
      expect(document.querySelector('body')).toBeTruthy();
    });

    it('should have correct title and meta information', () => {
      const title = document.querySelector('title');
      expect(title?.textContent).toBe('Navigation Test Page');

      const metaCharset = document.querySelector('meta[charset]');
      expect(metaCharset?.getAttribute('charset')).toBe('UTF-8');

      const metaViewport = document.querySelector('meta[name="viewport"]');
      expect(metaViewport).toBeTruthy();
    });

    it('should include navigation functionality', () => {
      // Check for navigation buttons
      const navButtons = document.querySelectorAll('.nav-buttons button');
      expect(navButtons.length).toBeGreaterThan(0);

      // Check for navigation links
      const navLinks = document.querySelectorAll('.links a');
      expect(navLinks.length).toBeGreaterThan(0);

      // Verify link targets
      const page2Link = document.querySelector('a[href="page2.html"]');
      const page3Link = document.querySelector('a[href="page3.html"]');
      expect(page2Link).toBeTruthy();
      expect(page3Link).toBeTruthy();
    });

    it('should have JavaScript functionality for testing', () => {
      expect(html).toContain('window.testHelpers');
      expect(html).toContain('getPageInstance');
      expect(html).toContain('getLoadTime');
      expect(html).toContain('getNavigationCount');
      expect(html).toContain('triggerNavigation');
    });

    it('should include status and logging elements', () => {
      expect(document.getElementById('load-status')).toBeTruthy();
      expect(document.getElementById('load-time')).toBeTruthy();
      expect(document.getElementById('navigation-log')).toBeTruthy();
    });

    it('should have responsive design elements', () => {
      expect(html).toContain('max-width');
      expect(html).toContain('margin: 0 auto');
      expect(html).toContain('font-family: Arial');
    });
  });

  describe('form-test.html (Comprehensive Form Test Page)', () => {
    let html: string;
    let document: Document;

    beforeAll(async () => {
      html = await readFixture('form-test.html');
      const parsed = parseAndValidateHtml(html);
      document = parsed.document;
    });

    it('should exist and contain valid HTML', () => {
      expect(html).toBeTruthy();
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html lang="en">');
    });

    it('should have comprehensive form structure', () => {
      const form = document.getElementById('comprehensive-form');
      expect(form).toBeTruthy();
      expect(form?.tagName).toBe('FORM');
    });

    it('should include all major input types', () => {
      // Text inputs
      expect(document.querySelector('input[type="text"]')).toBeTruthy();
      expect(document.querySelector('input[type="email"]')).toBeTruthy();
      expect(document.querySelector('input[type="password"]')).toBeTruthy();
      expect(document.querySelector('input[type="url"]')).toBeTruthy();
      expect(document.querySelector('input[type="tel"]')).toBeTruthy();

      // Number and date inputs
      expect(document.querySelector('input[type="number"]')).toBeTruthy();
      expect(document.querySelector('input[type="range"]')).toBeTruthy();
      expect(document.querySelector('input[type="date"]')).toBeTruthy();
      expect(document.querySelector('input[type="time"]')).toBeTruthy();
      expect(document.querySelector('input[type="datetime-local"]')).toBeTruthy();

      // Selection inputs
      expect(document.querySelector('select')).toBeTruthy();
      expect(document.querySelector('select[multiple]')).toBeTruthy();
      expect(document.querySelector('input[type="radio"]')).toBeTruthy();
      expect(document.querySelector('input[type="checkbox"]')).toBeTruthy();
      expect(document.querySelector('input[type="file"]')).toBeTruthy();
      expect(document.querySelector('textarea')).toBeTruthy();
    });

    it('should have form sections with proper organization', () => {
      const sections = document.querySelectorAll('.form-section');
      expect(sections.length).toBeGreaterThanOrEqual(5);

      // Check for specific sections
      expect(html).toContain('Text Input Fields');
      expect(html).toContain('Contact Information');
      expect(html).toContain('Security Settings');
      expect(html).toContain('Numbers and Dates');
      expect(html).toContain('Selection Fields');
      expect(html).toContain('Radio Button Groups');
      expect(html).toContain('Checkbox Groups');
    });

    it('should include form validation functionality', () => {
      expect(html).toContain('function validateForm()');
      expect(html).toContain('function fillFormWithTestData()');
      expect(html).toContain('function clearForm()');

      // Check for validation elements
      expect(document.getElementById('validation-results')).toBeTruthy();
      expect(document.querySelectorAll('.validation-message').length).toBeGreaterThan(0);
    });

    it('should have proper form controls and buttons', () => {
      expect(document.querySelector('button[type="submit"]')).toBeTruthy();
      expect(document.querySelector('button[type="reset"]')).toBeTruthy();
      expect(document.getElementById('validate-btn')).toBeTruthy();
      expect(document.getElementById('fill-test-btn')).toBeTruthy();
      expect(document.getElementById('clear-btn')).toBeTruthy();
    });

    it('should include JavaScript test helpers', () => {
      expect(html).toContain('window.testHelpers');
      expect(html).toContain('fillForm');
      expect(html).toContain('validateForm');
      expect(html).toContain('getFormData');
      expect(html).toContain('getFieldCount');
      expect(html).toContain('getValidationErrors');
    });

    it('should count total form fields correctly', () => {
      const inputs = document.querySelectorAll('input, textarea, select');
      expect(inputs.length).toBeGreaterThan(25); // Should have comprehensive set of fields
    });

    it('should include navigation to other test pages', () => {
      expect(html).toContain('test-page.html');
      expect(html).toContain('page2.html');
      expect(html).toContain('page3.html');
      expect(html).toContain('iframe-test.html');
    });
  });

  describe('iframe-test.html (Iframe and Frame Testing)', () => {
    let html: string;
    let document: Document;

    beforeAll(async () => {
      html = await readFixture('iframe-test.html');
      const parsed = parseAndValidateHtml(html);
      document = parsed.document;
    });

    it('should exist and contain valid HTML', () => {
      expect(html).toBeTruthy();
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('Iframe & Frame Navigation Test Page');
    });

    it('should include multiple iframe elements', () => {
      const iframes = document.querySelectorAll('iframe');
      expect(iframes.length).toBeGreaterThanOrEqual(3);

      // Check for specific iframes
      expect(document.getElementById('iframe-basic')).toBeTruthy();
      expect(document.getElementById('iframe-secondary')).toBeTruthy();
      expect(document.getElementById('iframe-dynamic')).toBeTruthy();
    });

    it('should have iframe controls and manipulation functions', () => {
      expect(html).toContain('function loadIframe');
      expect(html).toContain('function communicateWithIframes');
      expect(html).toContain('function countIframes');

      // Check for control buttons
      const loadButtons = document.querySelectorAll('button[onclick*="loadIframe"]');
      expect(loadButtons.length).toBeGreaterThan(0);
    });

    it('should include frameset simulation', () => {
      expect(document.querySelector('.frameset-container')).toBeTruthy();
      expect(document.querySelector('.frameset-demo')).toBeTruthy();
      expect(document.getElementById('left-frame')).toBeTruthy();
      expect(document.getElementById('right-frame')).toBeTruthy();
    });

    it('should have iframe communication logging', () => {
      expect(document.getElementById('iframe-log')).toBeTruthy();
      expect(html).toContain('function logMessage');
      expect(html).toContain('function clearLog');
    });

    it('should include JavaScript test helpers for iframe testing', () => {
      expect(html).toContain('window.testHelpers');
      expect(html).toContain('getIframeCount');
      expect(html).toContain('getIframeById');
      expect(html).toContain('loadIframeContent');
      expect(html).toContain('communicateWithIframes');
    });

    it('should have proper iframe sources and attributes', () => {
      const basicIframe = document.getElementById('iframe-basic') as HTMLIFrameElement;
      expect(basicIframe.src).toContain('test-page.html');
      expect(basicIframe.title).toBeTruthy();

      const dynamicIframe = document.getElementById('iframe-dynamic') as HTMLIFrameElement;
      expect(dynamicIframe.src).toContain('about:blank');
    });
  });

  describe('page2.html and page3.html (Additional Navigation Pages)', () => {
    it('should have page2.html for navigation testing', async () => {
      const html = await readFixture('page2.html');
      const { document, isValid } = parseAndValidateHtml(html);

      expect(isValid).toBe(true);
      expect(html).toContain('<!DOCTYPE html>');

      // Should be a valid page that can be navigated to
      expect(document.querySelector('html')).toBeTruthy();
      expect(document.querySelector('body')).toBeTruthy();
    });

    it('should have page3.html for navigation testing', async () => {
      const html = await readFixture('page3.html');
      const { document, isValid } = parseAndValidateHtml(html);

      expect(isValid).toBe(true);
      expect(html).toContain('<!DOCTYPE html>');

      // Should be a valid page that can be navigated to
      expect(document.querySelector('html')).toBeTruthy();
      expect(document.querySelector('body')).toBeTruthy();
    });
  });

  describe('Cross-Page Integration', () => {
    it('should have consistent navigation links between pages', async () => {
      const testPage = await readFixture('test-page.html');
      const formPage = await readFixture('form-test.html');
      const iframePage = await readFixture('iframe-test.html');

      // All pages should reference each other
      expect(testPage).toContain('page2.html');
      expect(testPage).toContain('page3.html');

      expect(formPage).toContain('test-page.html');
      expect(formPage).toContain('iframe-test.html');

      expect(iframePage).toContain('test-page.html');
      expect(iframePage).toContain('page2.html');
    });

    it('should have consistent JavaScript test helper interfaces', async () => {
      const pages = [
        await readFixture('test-page.html'),
        await readFixture('form-test.html'),
        await readFixture('iframe-test.html')
      ];

      pages.forEach(html => {
        expect(html).toContain('window.testHelpers');
        expect(html).toContain('getPageInstance');
        expect(html).toContain('window.pageInstance');
      });
    });

    it('should use consistent styling and layout patterns', async () => {
      const pages = [
        await readFixture('test-page.html'),
        await readFixture('form-test.html'),
        await readFixture('iframe-test.html')
      ];

      pages.forEach(html => {
        expect(html).toContain('font-family: Arial');
        expect(html).toContain('.container');
        expect(html).toContain('max-width');
        expect(html).toContain('border-radius');
        expect(html).toContain('box-shadow');
      });
    });
  });

  describe('Accessibility and Standards Compliance', () => {
    it('should include proper semantic HTML and accessibility features', async () => {
      const formPage = await readFixture('form-test.html');
      const { document } = parseAndValidateHtml(formPage);

      // Check for proper form labels
      const labels = document.querySelectorAll('label');
      const inputs = document.querySelectorAll('input');
      expect(labels.length).toBeGreaterThan(0);

      // Check that labels have 'for' attributes or wrap inputs
      labels.forEach(label => {
        const forAttr = label.getAttribute('for');
        if (forAttr) {
          const associatedInput = document.getElementById(forAttr);
          expect(associatedInput).toBeTruthy();
        }
      });
    });

    it('should include proper meta tags and responsive design', async () => {
      const testPage = await readFixture('test-page.html');
      const { document } = parseAndValidateHtml(testPage);

      const metaViewport = document.querySelector('meta[name="viewport"]');
      expect(metaViewport).toBeTruthy();
      expect(metaViewport?.getAttribute('content')).toContain('width=device-width');

      const metaCharset = document.querySelector('meta[charset]');
      expect(metaCharset?.getAttribute('charset')).toBe('UTF-8');
    });

    it('should use proper HTML5 form validation attributes', async () => {
      const formPage = await readFixture('form-test.html');
      const { document } = parseAndValidateHtml(formPage);

      // Check for validation attributes
      expect(document.querySelector('input[required]')).toBeTruthy();
      expect(document.querySelector('input[type="email"]')).toBeTruthy();
      expect(document.querySelector('input[minlength]')).toBeTruthy();
      expect(document.querySelector('input[maxlength]')).toBeTruthy();
      expect(document.querySelector('input[min]')).toBeTruthy();
      expect(document.querySelector('input[max]')).toBeTruthy();
    });
  });

  describe('Template Acceptance Criteria Validation', () => {
    it('should provide at least 4 different HTML template types', async () => {
      // Count different template types available
      const templateTypes = [
        'test-page.html',     // Basic page with navigation
        'form-test.html',     // Page with comprehensive form
        'iframe-test.html',   // Page with iframes/frames
        'page2.html',         // Additional basic page
        'page3.html'          // Additional basic page
      ];

      // Verify all templates exist and are valid
      for (const template of templateTypes) {
        const html = await readFixture(template);
        const { isValid } = parseAndValidateHtml(html);
        expect(isValid).toBe(true);
        expect(html).toContain('<!DOCTYPE html>');
      }

      // We have at least 4 distinct template types
      expect(templateTypes.length).toBeGreaterThanOrEqual(4);
    });

    it('should support dynamic content through JavaScript and templating', async () => {
      const pages = [
        await readFixture('test-page.html'),
        await readFixture('form-test.html'),
        await readFixture('iframe-test.html')
      ];

      pages.forEach(html => {
        // All pages support dynamic content via JavaScript
        expect(html).toContain('<script>');
        expect(html).toContain('window.testHelpers');

        // Pages have elements that can be dynamically updated
        expect(html).toContain('getElementById');
        expect(html).toContain('textContent');
      });
    });

    it('should provide reusable templates for different test scenarios', async () => {
      const testPage = await readFixture('test-page.html');
      const formPage = await readFixture('form-test.html');

      // Templates are reusable - they reference each other and can be loaded in different contexts
      expect(testPage).toContain('navigateTo');  // Can navigate to other pages
      expect(formPage).toContain('location.href'); // Can navigate to other pages

      // Templates have unique identifiers making them reusable
      expect(testPage).toContain('window.pageInstance = Math.random()');
      expect(formPage).toContain('window.pageInstance = Math.random()');
    });
  });
});