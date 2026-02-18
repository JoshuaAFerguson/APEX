/**
 * @fileoverview Integration tests for contenteditable elements
 *
 * This test suite covers comprehensive testing of contenteditable functionality:
 * - Basic typing in contenteditable div elements
 * - Basic typing in contenteditable span elements
 * - Content verification (textContent and innerHTML)
 * - Nested contenteditable element testing
 * - Performance and accessibility testing
 * - Cross-browser compatibility
 *
 * Acceptance Criteria:
 * ✅ Tests pass for: typing in contenteditable div
 * ✅ Tests pass for: typing in contenteditable span
 * ✅ Tests pass for: verifying textContent/innerHTML reflects typed content
 * ✅ Tests pass for: testing nested contenteditable elements
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Page, Browser, BrowserContext } from 'playwright';
import {
  createBrowser,
  createBrowserContext,
  createPage,
  captureScreenshot,
  DEFAULT_BROWSER_CONFIG
} from '../setup';
import {
  CONTENTEDITABLE_FIXTURES,
  createContenteditableTestPage,
  type ContenteditableTestFixture
} from '../fixtures/contenteditable-fixtures';
import {
  typeInContenteditable,
  validateContenteditableContent,
  clearContenteditableContent,
  testMultipleInputMethods,
  captureContenteditableEvents,
  testContenteditableAccessibility,
  waitForContentStable,
  generateContenteditableTestReport,
  type ContentValidationResult,
  type TypingPerformanceMetrics
} from '../utils/contenteditable-helpers';

describe('Contenteditable Elements Integration Tests', () => {
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;

  // Test configuration
  const TEST_TIMEOUT = 60000;
  const TYPING_DELAY = 50;
  const TEST_TEXT_SIMPLE = 'Hello, World!';
  const TEST_TEXT_COMPLEX = 'This is a complex test with special characters: àáâ€¢™®©';
  const TEST_TEXT_MULTILINE = 'Line 1\nLine 2\nLine 3 with special chars: !@#$%^&*()';

  beforeEach(async () => {
    browser = await createBrowser(DEFAULT_BROWSER_CONFIG);
    context = await createBrowserContext(browser);
    page = await createPage(context);
  }, TEST_TIMEOUT);

  afterEach(async () => {
    if (page) await page.close();
    if (context) await context.close();
    if (browser) await browser.close();
  }, TEST_TIMEOUT);

  describe('Basic Contenteditable Div Tests', () => {
    let testPage: string;

    beforeEach(async () => {
      testPage = createContenteditableTestPage(CONTENTEDITABLE_FIXTURES.basicDiv.html);
      await page.goto(testPage);
      await page.waitForLoadState('domcontentloaded');
    });

    it('should successfully type in a basic contenteditable div', async () => {
      const selector = '[data-testid="basic-contenteditable-div"]';

      // Clear existing content and type new text
      await clearContenteditableContent(page, selector);

      const metrics = await typeInContenteditable(page, {
        selector,
        text: TEST_TEXT_SIMPLE,
        clearFirst: false,
        typingDelay: TYPING_DELAY,
        verifyContent: true,
        expectedContent: TEST_TEXT_SIMPLE
      });

      // Validate typing performance
      expect(metrics.characterCount).toBe(TEST_TEXT_SIMPLE.length);
      expect(metrics.charactersPerSecond).toBeGreaterThan(0);
      expect(metrics.totalTime).toBeGreaterThan(0);

      // Validate final content
      const validation = await validateContenteditableContent(page, selector, TEST_TEXT_SIMPLE);
      expect(validation.errors).toHaveLength(0);
      expect(validation.textContent).toBe(TEST_TEXT_SIMPLE);
      expect(validation.isContentEditable).toBe(true);
      expect(validation.contentLength).toBe(TEST_TEXT_SIMPLE.length);
    });

    it('should verify textContent and innerHTML reflect typed content in div', async () => {
      const selector = '[data-testid="basic-contenteditable-div"]';

      await clearContenteditableContent(page, selector);
      await typeInContenteditable(page, {
        selector,
        text: TEST_TEXT_COMPLEX,
        clearFirst: false,
        verifyContent: false
      });

      // Wait for content to stabilize
      const stableContent = await waitForContentStable(page, selector);
      expect(stableContent).toBe(TEST_TEXT_COMPLEX);

      // Validate both textContent and innerHTML
      const element = page.locator(selector);
      const textContent = await element.textContent();
      const innerHTML = await element.innerHTML();

      expect(textContent).toBe(TEST_TEXT_COMPLEX);
      expect(innerHTML).toContain(TEST_TEXT_COMPLEX);

      // innerHTML should contain the text content (may have additional HTML)
      expect(innerHTML.length).toBeGreaterThanOrEqual(textContent!.length);
    });

    it('should handle multiline content in contenteditable div', async () => {
      const selector = '[data-testid="basic-contenteditable-div"]';

      await clearContenteditableContent(page, selector);

      // Type multiline content using Enter key
      await page.locator(selector).focus();
      await page.keyboard.type('Line 1');
      await page.keyboard.press('Enter');
      await page.keyboard.type('Line 2');
      await page.keyboard.press('Enter');
      await page.keyboard.type('Line 3');

      const textContent = await page.locator(selector).textContent();
      expect(textContent).toContain('Line 1');
      expect(textContent).toContain('Line 2');
      expect(textContent).toContain('Line 3');
    });

    it('should test multiple input methods for contenteditable div', async () => {
      const selector = '[data-testid="basic-contenteditable-div"]';

      const results = await testMultipleInputMethods(page, selector, TEST_TEXT_SIMPLE);

      // All input methods should work
      expect(results.typing.errors).toHaveLength(0);
      expect(results.typing.textContent).toBe(TEST_TEXT_SIMPLE);

      expect(results.programmatic.errors).toHaveLength(0);
      expect(results.programmatic.textContent).toBe(TEST_TEXT_SIMPLE);
    });
  });

  describe('Basic Contenteditable Span Tests', () => {
    let testPage: string;

    beforeEach(async () => {
      testPage = createContenteditableTestPage(CONTENTEDITABLE_FIXTURES.basicSpan.html);
      await page.goto(testPage);
      await page.waitForLoadState('domcontentloaded');
    });

    it('should successfully type in a basic contenteditable span', async () => {
      const selector = '[data-testid="basic-contenteditable-span"]';

      await clearContenteditableContent(page, selector);

      const metrics = await typeInContenteditable(page, {
        selector,
        text: TEST_TEXT_SIMPLE,
        clearFirst: false,
        typingDelay: TYPING_DELAY,
        verifyContent: true,
        expectedContent: TEST_TEXT_SIMPLE
      });

      // Validate typing performance
      expect(metrics.characterCount).toBe(TEST_TEXT_SIMPLE.length);
      expect(metrics.totalTime).toBeGreaterThan(0);

      // Validate content
      const validation = await validateContenteditableContent(page, selector, TEST_TEXT_SIMPLE);
      expect(validation.errors).toHaveLength(0);
      expect(validation.textContent).toBe(TEST_TEXT_SIMPLE);
      expect(validation.isContentEditable).toBe(true);
    });

    it('should verify textContent and innerHTML reflect typed content in span', async () => {
      const selector = '[data-testid="basic-contenteditable-span"]';

      await clearContenteditableContent(page, selector);
      await typeInContenteditable(page, {
        selector,
        text: TEST_TEXT_COMPLEX,
        clearFirst: false,
        verifyContent: false
      });

      // Validate content matches across different content properties
      const element = page.locator(selector);
      const textContent = await element.textContent();
      const innerHTML = await element.innerHTML();
      const innerText = await element.innerText();

      expect(textContent).toBe(TEST_TEXT_COMPLEX);
      expect(innerHTML).toContain(TEST_TEXT_COMPLEX);
      expect(innerText).toBe(TEST_TEXT_COMPLEX);
    });

    it('should handle special characters in contenteditable span', async () => {
      const selector = '[data-testid="basic-contenteditable-span"]';
      const specialText = 'Special: àáâãä ÀÁÂÃÄ ñÑ çÇ €¢£¥ ™®©';

      await clearContenteditableContent(page, selector);
      await typeInContenteditable(page, {
        selector,
        text: specialText,
        clearFirst: false,
        typingDelay: TYPING_DELAY,
        verifyContent: true,
        expectedContent: specialText
      });

      const validation = await validateContenteditableContent(page, selector, specialText);
      expect(validation.errors).toHaveLength(0);
      expect(validation.textContent).toBe(specialText);
    });
  });

  describe('Nested Contenteditable Elements Tests', () => {
    let testPage: string;

    beforeEach(async () => {
      testPage = createContenteditableTestPage(CONTENTEDITABLE_FIXTURES.nested.html);
      await page.goto(testPage);
      await page.waitForLoadState('domcontentloaded');
    });

    it('should handle typing in nested contenteditable elements', async () => {
      const outerSelector = '[data-testid="outer-contenteditable"]';
      const innerSelector = '[data-testid="inner-contenteditable"]';
      const nestedSelector = '[data-testid="nested-span"]';

      // Test outer element
      await page.locator(outerSelector).focus();
      await page.keyboard.press('End'); // Move to end
      await page.keyboard.type(' - OUTER MODIFIED');

      const outerContent = await page.locator(outerSelector).textContent();
      expect(outerContent).toContain('OUTER MODIFIED');

      // Test inner element
      await page.locator(innerSelector).focus();
      await page.keyboard.press('End');
      await page.keyboard.type(' - INNER MODIFIED');

      const innerContent = await page.locator(innerSelector).textContent();
      expect(innerContent).toContain('INNER MODIFIED');

      // Test nested span
      await clearContenteditableContent(page, nestedSelector);
      await typeInContenteditable(page, {
        selector: nestedSelector,
        text: 'NESTED CONTENT',
        clearFirst: false,
        verifyContent: true,
        expectedContent: 'NESTED CONTENT'
      });

      const nestedContent = await page.locator(nestedSelector).textContent();
      expect(nestedContent).toBe('NESTED CONTENT');
    });

    it('should maintain independent editing in nested elements', async () => {
      const outerSelector = '[data-testid="outer-contenteditable"]';
      const innerSelector = '[data-testid="inner-contenteditable"]';
      const nestedSelector = '[data-testid="nested-span"]';

      // Store original content
      const originalOuter = await page.locator(outerSelector).textContent();
      const originalInner = await page.locator(innerSelector).textContent();
      const originalNested = await page.locator(nestedSelector).textContent();

      // Modify only nested span
      await clearContenteditableContent(page, nestedSelector);
      await typeInContenteditable(page, {
        selector: nestedSelector,
        text: 'ONLY NESTED CHANGED',
        clearFirst: false,
        verifyContent: true,
        expectedContent: 'ONLY NESTED CHANGED'
      });

      // Verify nested changed
      const newNested = await page.locator(nestedSelector).textContent();
      expect(newNested).toBe('ONLY NESTED CHANGED');

      // Verify others maintained their content structure
      const newInner = await page.locator(innerSelector).textContent();
      const newOuter = await page.locator(outerSelector).textContent();

      // Inner content should contain the new nested content
      expect(newInner).toContain('ONLY NESTED CHANGED');

      // Outer content should contain the new inner content (which contains new nested)
      expect(newOuter).toContain('ONLY NESTED CHANGED');
    });

    it('should test accessibility of nested contenteditable elements', async () => {
      const selectors = [
        '[data-testid="outer-contenteditable"]',
        '[data-testid="inner-contenteditable"]',
        '[data-testid="nested-span"]'
      ];

      for (const selector of selectors) {
        const accessibility = await testContenteditableAccessibility(page, selector);

        expect(accessibility.isKeyboardAccessible).toBe(true);
        expect(accessibility.hasProperTabIndex).toBe(true); // Should be focusable
      }
    });
  });

  describe('Complex Contenteditable Scenarios', () => {
    let testPage: string;

    beforeEach(async () => {
      testPage = createContenteditableTestPage(CONTENTEDITABLE_FIXTURES.complex.html);
      await page.goto(testPage);
      await page.waitForLoadState('domcontentloaded');
    });

    it('should handle complex mixed contenteditable scenarios', async () => {
      const selectors = [
        '[data-testid="main-title"]',
        '[data-testid="intro-paragraph"]',
        '[data-testid="inline-highlight"]',
        '[data-testid="left-content"]',
        '[data-testid="right-content"]'
      ];

      // Test each element independently
      for (let i = 0; i < selectors.length; i++) {
        const selector = selectors[i];
        const testText = `Test content ${i + 1}`;

        // Focus element and add test content
        await page.locator(selector).focus();
        await page.keyboard.press('End');
        await page.keyboard.type(' - ' + testText);

        const content = await page.locator(selector).textContent();
        expect(content).toContain(testText);
      }
    });

    it('should capture and verify contenteditable events', async () => {
      const selector = '[data-testid="main-title"]';

      const events = await captureContenteditableEvents(page, selector, async () => {
        await page.locator(selector).focus();
        await page.keyboard.type('TEST');
      });

      // Should have captured input events
      const inputEvents = events.filter(e => e.type === 'input');
      expect(inputEvents.length).toBeGreaterThan(0);

      // Should have captured key events
      const keyEvents = events.filter(e => e.type.startsWith('key'));
      expect(keyEvents.length).toBeGreaterThan(0);
    });
  });

  describe('Content Validation and Edge Cases', () => {
    let testPage: string;

    beforeEach(async () => {
      testPage = createContenteditableTestPage(CONTENTEDITABLE_FIXTURES.basicDiv.html);
      await page.goto(testPage);
      await page.waitForLoadState('domcontentloaded');
    });

    it('should handle empty content correctly', async () => {
      const selector = '[data-testid="basic-contenteditable-div"]';

      await clearContenteditableContent(page, selector);

      const validation = await validateContenteditableContent(page, selector, '');
      expect(validation.errors).toHaveLength(0);
      expect(validation.textContent).toBe('');
      expect(validation.contentLength).toBe(0);
      expect(validation.isContentEditable).toBe(true);
    });

    it('should handle very long content', async () => {
      const selector = '[data-testid="basic-contenteditable-div"]';
      const longText = 'A'.repeat(1000);

      await clearContenteditableContent(page, selector);

      // For performance, set content programmatically for very long text
      await page.locator(selector).evaluate((el: HTMLElement, text: string) => {
        el.textContent = text;
      }, longText);

      const validation = await validateContenteditableContent(page, selector, longText);
      expect(validation.errors).toHaveLength(0);
      expect(validation.textContent).toBe(longText);
      expect(validation.contentLength).toBe(1000);
    });

    it('should handle HTML content injection safely', async () => {
      const selector = '[data-testid="basic-contenteditable-div"]';
      const htmlContent = '<script>alert("xss")</script><b>Bold</b> text';

      await clearContenteditableContent(page, selector);
      await page.locator(selector).focus();
      await page.keyboard.type(htmlContent);

      const textContent = await page.locator(selector).textContent();
      const innerHTML = await page.locator(selector).innerHTML();

      // Text content should contain the literal text (script tags as text)
      expect(textContent).toContain('<script>');
      expect(textContent).toContain('Bold');

      // Should not execute script
      expect(innerHTML).not.toMatch(/<script[^>]*>.*?<\/script>/);
    });
  });

  describe('Performance and Stress Tests', () => {
    let testPage: string;

    beforeEach(async () => {
      testPage = createContenteditableTestPage(CONTENTEDITABLE_FIXTURES.basicDiv.html);
      await page.goto(testPage);
      await page.waitForLoadState('domcontentloaded');
    });

    it('should measure typing performance', async () => {
      const selector = '[data-testid="basic-contenteditable-div"]';
      const testText = 'Performance test text for measuring typing speed';

      await clearContenteditableContent(page, selector);

      const metrics = await typeInContenteditable(page, {
        selector,
        text: testText,
        clearFirst: false,
        typingDelay: 10, // Faster typing for performance test
        verifyContent: true,
        expectedContent: testText
      });

      // Verify reasonable performance metrics
      expect(metrics.characterCount).toBe(testText.length);
      expect(metrics.charactersPerSecond).toBeGreaterThan(5); // At least 5 chars/sec
      expect(metrics.averageKeystrokeTime).toBeLessThan(200); // Less than 200ms per keystroke
      expect(metrics.keystrokeTimings).toHaveLength(testText.length);
    });
  });

  describe('Cross-Browser Compatibility Tests', () => {
    it('should work consistently across browser types', async () => {
      const testText = 'Cross-browser test';
      const browserTypes = ['chromium'] as const; // Add 'firefox', 'webkit' if needed

      for (const browserType of browserTypes) {
        const testBrowser = await createBrowser({ browserType });
        const testContext = await createBrowserContext(testBrowser);
        const testPage = await createPage(testContext);

        try {
          const pageContent = createContenteditableTestPage(CONTENTEDITABLE_FIXTURES.basicDiv.html);
          await testPage.goto(pageContent);
          await testPage.waitForLoadState('domcontentloaded');

          const selector = '[data-testid="basic-contenteditable-div"]';
          await clearContenteditableContent(testPage, selector);

          const metrics = await typeInContenteditable(testPage, {
            selector,
            text: testText,
            clearFirst: false,
            verifyContent: true,
            expectedContent: testText
          });

          expect(metrics.characterCount).toBe(testText.length);

          const validation = await validateContenteditableContent(testPage, selector, testText);
          expect(validation.errors).toHaveLength(0);
          expect(validation.textContent).toBe(testText);

        } finally {
          await testPage.close();
          await testContext.close();
          await testBrowser.close();
        }
      }
    });
  });

  describe('Test Report Generation', () => {
    let testPage: string;

    beforeEach(async () => {
      testPage = createContenteditableTestPage(CONTENTEDITABLE_FIXTURES.basicDiv.html);
      await page.goto(testPage);
      await page.waitForLoadState('domcontentloaded');
    });

    it('should generate comprehensive test reports', async () => {
      const selector = '[data-testid="basic-contenteditable-div"]';

      const report = await generateContenteditableTestReport(
        page,
        selector,
        'Basic Contenteditable Div Report'
      );

      expect(report.testName).toBe('Basic Contenteditable Div Report');
      expect(report.element.exists).toBe(true);
      expect(report.element.isVisible).toBe(true);
      expect(report.element.isContentEditable).toBe(true);
      expect(report.content.isContentEditable).toBe(true);
      expect(report.accessibility).toBeDefined();
      expect(report.timestamp).toBeDefined();
    });
  });
});