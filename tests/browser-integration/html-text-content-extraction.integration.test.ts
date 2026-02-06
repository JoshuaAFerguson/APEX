/**
 * @fileoverview Integration tests for HTML and text content extraction functionality
 *
 * This test suite covers:
 * - Full page HTML content extraction via getHtml operation
 * - Element-specific HTML content extraction with CSS selectors
 * - Text content extraction from full page and specific elements
 * - Content matching verification against expected fixtures
 * - Edge cases: empty elements, Unicode characters, HTML entities
 * - Dynamic content extraction after JavaScript modifications
 * - Error handling for non-existent selectors
 * - Performance validation for large content extraction
 *
 * Test Environment:
 * - Uses BrowserTool from @apexcli/orchestrator for content extraction
 * - Tests with Playwright backend in headless mode
 * - Validates extracted content matches expected HTML/text patterns
 * - Cross-browser compatibility testing (Chromium, Firefox, WebKit)
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { BrowserTool } from '@apexcli/orchestrator';
import { createTestPage, createTempDir, cleanupTempDir } from './utils/test-helpers';

interface TestContext {
  tempDir: string;
  browserTool: BrowserTool;
  testPageUrl: string;
}

// Test configuration
const TEST_CONFIG = {
  timeout: 60000,
  contentTimeout: 5000,
  browsers: ['chromium', 'firefox', 'webkit'] as const,
  selectors: {
    container: '.test-container',
    header: '.test-header',
    content: '.test-content',
    footer: '.test-footer',
    emptyElement: '.empty-element',
    dynamicContent: '.dynamic-content',
    nonExistent: '.non-existent-element',
    codeBlock: '.code-block',
    featureList: '.feature-list',
    contentCard: '.content-card'
  },
};

// Expected content fixtures for validation
const EXPECTED_CONTENT = {
  headerTitle: 'APEX Browser Automation Test Page',
  headerDescription: 'Comprehensive test page for screenshot and content capture functionality',
  footerText: 'APEX Integration Testing',
  footerCopyright: '© 2024 APEX - Autonomous Product Engineering eXecutor',
  testClasses: ['test-container', 'test-header', 'test-content', 'test-footer'],
  contentSections: [
    'Screenshot Testing',
    'Content Extraction',
    'PDF Generation',
    'Cross-Browser Testing'
  ],
  dynamicContentTitle: 'Dynamic Test Content',
  codeBlockContent: 'console.log("APEX Browser Automation Test");',
  featureListItems: [
    'Full page HTML extraction',
    'Element-specific HTML',
    'Plain text extraction',
    'Structured content',
    'Dynamic content'
  ]
};

describe('HTML and Text Content Extraction Integration Tests', () => {
  let testContext: TestContext;

  beforeAll(async () => {
    // Create temporary directory for test artifacts
    const tempDir = await createTempDir();

    // Initialize browser tool
    const browserTool = new BrowserTool({
      backend: 'playwright',
      headless: true
    });

    // Create test page with rich content
    const testPageUrl = await createTestPage();

    testContext = {
      tempDir,
      browserTool,
      testPageUrl
    };
  }, TEST_CONFIG.timeout);

  afterAll(async () => {
    // Cleanup browser tool
    if (testContext?.browserTool) {
      await testContext.browserTool.cleanup();
    }

    // Cleanup temporary directory
    if (testContext?.tempDir) {
      await cleanupTempDir(testContext.tempDir);
    }
  });

  beforeEach(async () => {
    // Reset browser state before each test
    if (testContext.browserTool.isActive()) {
      await testContext.browserTool.cleanup();
    }

    // Navigate to test page for each test
    const navResult = await testContext.browserTool.execute({
      operation: 'navigate',
      params: {
        url: testContext.testPageUrl,
        waitUntil: 'domcontentloaded',
        timeout: TEST_CONFIG.contentTimeout
      }
    });
    expect(navResult.success).toBe(true);
  });

  afterEach(async () => {
    // Ensure cleanup after each test
    try {
      if (testContext.browserTool.isActive()) {
        await testContext.browserTool.cleanup();
      }
    } catch (error) {
      console.warn('Cleanup warning in afterEach:', error);
    }
  });

  describe('Full HTML Content Extraction Tests', () => {
    it('should extract full page HTML via getHtml with no selector', async () => {
      const htmlResult = await testContext.browserTool.execute({
        operation: 'getHtml',
        params: {} // No selector = full page
      });

      expect(htmlResult.success).toBe(true);
      expect(htmlResult.operation).toBe('getHtml');
      expect(htmlResult.data).toBeDefined();
      expect(htmlResult.data.html).toBeDefined();
      expect(typeof htmlResult.data.html).toBe('string');

      const html = htmlResult.data.html!;

      // Verify DOCTYPE, html, head, and body tags are present
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html');
      expect(html).toContain('<head>');
      expect(html).toContain('<body>');
      expect(html).toContain('</html>');

      // Verify test-specific content markers are included
      expect(html).toContain(EXPECTED_CONTENT.headerTitle);
      expect(html).toContain(EXPECTED_CONTENT.headerDescription);
      expect(html).toContain(EXPECTED_CONTENT.footerCopyright);

      // Verify CSS classes exist
      EXPECTED_CONTENT.testClasses.forEach(className => {
        expect(html).toContain(`class="${className}"`);
      });

      // Verify content sections exist
      EXPECTED_CONTENT.contentSections.forEach(section => {
        expect(html).toContain(section);
      });
    });

    it('should verify JavaScript-injected content is captured in full page HTML', async () => {
      // Wait for JavaScript to execute (dynamic content injection)
      await new Promise(resolve => setTimeout(resolve, 200));

      const htmlResult = await testContext.browserTool.execute({
        operation: 'getHtml',
        params: {}
      });

      expect(htmlResult.success).toBe(true);
      const html = htmlResult.data.html!;

      // Verify JavaScript-injected timestamp content is present
      expect(html).toContain('Page loaded at:');
      // Should contain ISO timestamp format pattern
      expect(html).toMatch(/Page loaded at:\s*\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should extract DOCTYPE and document structure correctly', async () => {
      const htmlResult = await testContext.browserTool.execute({
        operation: 'getHtml',
        params: {}
      });

      expect(htmlResult.success).toBe(true);
      const html = htmlResult.data.html!;

      // Verify complete document structure
      expect(html).toMatch(/<!DOCTYPE html>/i);
      expect(html).toMatch(/<html[^>]*lang="en"[^>]*>/);
      expect(html).toContain('<meta charset="UTF-8">');
      expect(html).toContain('<title>APEX Browser Test Page</title>');

      // Verify structured content hierarchy
      expect(html).toContain('<header class="test-header">');
      expect(html).toContain('<main class="test-content">');
      expect(html).toContain('<footer class="test-footer">');
    });
  });

  describe('Element-Specific HTML Extraction Tests', () => {
    it('should extract HTML from specific header element', async () => {
      const headerResult = await testContext.browserTool.execute({
        operation: 'getHtml',
        params: { selector: TEST_CONFIG.selectors.header }
      });

      expect(headerResult.success).toBe(true);
      expect(headerResult.data.html).toBeDefined();
      const headerHtml = headerResult.data.html!;

      // Should return innerHTML (not outerHTML)
      expect(headerHtml).not.toContain('<header class="test-header">');
      expect(headerHtml).toContain('<h1>');
      expect(headerHtml).toContain(EXPECTED_CONTENT.headerTitle);
      expect(headerHtml).toContain(EXPECTED_CONTENT.headerDescription);
    });

    it('should extract HTML from content cards with nested structure', async () => {
      const contentResult = await testContext.browserTool.execute({
        operation: 'getHtml',
        params: { selector: TEST_CONFIG.selectors.content }
      });

      expect(contentResult.success).toBe(true);
      const contentHtml = contentResult.data.html!;

      // Verify nested element structure is preserved
      expect(contentHtml).toContain('<div class="content-grid">');
      expect(contentHtml).toContain('<div class="content-card">');
      expect(contentHtml).toContain('<h3>');
      expect(contentHtml).toContain('<ul class="feature-list">');
      expect(contentHtml).toContain('<li>');

      // Verify all content sections are present
      EXPECTED_CONTENT.contentSections.forEach(section => {
        expect(contentHtml).toContain(section);
      });
    });

    it('should extract HTML from footer with links', async () => {
      const footerResult = await testContext.browserTool.execute({
        operation: 'getHtml',
        params: { selector: TEST_CONFIG.selectors.footer }
      });

      expect(footerResult.success).toBe(true);
      const footerHtml = footerResult.data.html!;

      // Verify footer content and structure
      expect(footerHtml).toContain('<h3>');
      expect(footerHtml).toContain(EXPECTED_CONTENT.footerText);
      expect(footerHtml).toContain('<div class="footer-links">');
      expect(footerHtml).toContain('<a href="#screenshot">Screenshot Tests</a>');
      expect(footerHtml).toContain('<a href="#content">Content Tests</a>');
      expect(footerHtml).toContain(EXPECTED_CONTENT.footerCopyright);
    });

    it('should extract HTML from code block with formatted content', async () => {
      const codeResult = await testContext.browserTool.execute({
        operation: 'getHtml',
        params: { selector: TEST_CONFIG.selectors.codeBlock }
      });

      expect(codeResult.success).toBe(true);
      const codeHtml = codeResult.data.html!;

      // Verify code content preservation
      expect(codeHtml).toContain(EXPECTED_CONTENT.codeBlockContent);
      expect(codeHtml).toContain('const testData = {');
      expect(codeHtml).toContain('timestamp: Date.now(),');
      expect(codeHtml).toContain('userAgent: navigator.userAgent,');
      expect(codeHtml).toContain('viewport: {');

      // Verify whitespace and formatting is preserved
      expect(codeHtml).toContain('    '); // Should preserve indentation
    });
  });

  describe('Visible Text Extraction Tests', () => {
    it('should extract text from full page body', async () => {
      const textResult = await testContext.browserTool.execute({
        operation: 'getText',
        params: { selector: 'body' }
      });

      expect(textResult.success).toBe(true);
      expect(textResult.operation).toBe('getText');
      expect(textResult.data).toBeDefined();
      expect(textResult.data.text).toBeDefined();
      expect(typeof textResult.data.text).toBe('string');

      const bodyText = textResult.data.text!;

      // Verify HTML tags are stripped
      expect(bodyText).not.toContain('<');
      expect(bodyText).not.toContain('>');

      // Verify key content is present as plain text
      expect(bodyText).toContain(EXPECTED_CONTENT.headerTitle);
      expect(bodyText).toContain(EXPECTED_CONTENT.headerDescription);
      expect(bodyText).toContain(EXPECTED_CONTENT.footerText);
      expect(bodyText).toContain(EXPECTED_CONTENT.footerCopyright);

      // Verify all content sections are present
      EXPECTED_CONTENT.contentSections.forEach(section => {
        expect(bodyText).toContain(section);
      });
    });

    it('should extract text from specific header element', async () => {
      const headerTextResult = await testContext.browserTool.execute({
        operation: 'getText',
        params: { selector: TEST_CONFIG.selectors.header }
      });

      expect(headerTextResult.success).toBe(true);
      const headerText = headerTextResult.data.text!;

      // Should contain only header text content
      expect(headerText).toContain(EXPECTED_CONTENT.headerTitle);
      expect(headerText).toContain(EXPECTED_CONTENT.headerDescription);

      // Should not contain other page sections
      expect(headerText).not.toContain('Screenshot Testing');
      expect(headerText).not.toContain(EXPECTED_CONTENT.footerText);

      // Verify no HTML tags
      expect(headerText).not.toContain('<h1>');
      expect(headerText).not.toContain('<p>');
    });

    it('should extract text from feature lists with proper whitespace handling', async () => {
      const featureListResult = await testContext.browserTool.execute({
        operation: 'getText',
        params: { selector: TEST_CONFIG.selectors.featureList }
      });

      expect(featureListResult.success).toBe(true);
      const featureText = featureListResult.data.text!;

      // Verify feature list items are present
      EXPECTED_CONTENT.featureListItems.forEach(item => {
        expect(featureText).toContain(item);
      });

      // Should not contain HTML list markup
      expect(featureText).not.toContain('<ul>');
      expect(featureText).not.toContain('<li>');
      expect(featureText).not.toContain('</ul>');
      expect(featureText).not.toContain('</li>');

      // Should properly handle whitespace normalization
      expect(featureText.trim()).toBeTruthy();
      expect(featureText).not.toMatch(/\s{5,}/); // No excessive whitespace
    });

    it('should extract text from dynamically added content', async () => {
      // Wait for JavaScript to execute and add dynamic content
      await new Promise(resolve => setTimeout(resolve, 200));

      const dynamicTextResult = await testContext.browserTool.execute({
        operation: 'getText',
        params: { selector: TEST_CONFIG.selectors.dynamicContent }
      });

      expect(dynamicTextResult.success).toBe(true);
      const dynamicText = dynamicTextResult.data.text!;

      // Verify dynamic content is present
      expect(dynamicText).toContain(EXPECTED_CONTENT.dynamicContentTitle);
      expect(dynamicText).toContain('This section contains dynamic content');
      expect(dynamicText).toContain('Page loaded at:');

      // Verify JavaScript-injected timestamp is included
      expect(dynamicText).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe('Content Matching Tests (Acceptance Criteria Focus)', () => {
    it('should verify extracted content matches expected HTML fixtures exactly', async () => {
      const headerResult = await testContext.browserTool.execute({
        operation: 'getHtml',
        params: { selector: TEST_CONFIG.selectors.header }
      });

      expect(headerResult.success).toBe(true);
      const headerHtml = headerResult.data.html!;

      // Exact string matching for critical content
      expect(headerHtml).toContain('<h1>APEX Browser Automation Test Page</h1>');
      expect(headerHtml).toContain('<p>Comprehensive test page for screenshot and content capture functionality</p>');
    });

    it('should verify text extraction matches expected patterns', async () => {
      const footerResult = await testContext.browserTool.execute({
        operation: 'getText',
        params: { selector: TEST_CONFIG.selectors.footer }
      });

      expect(footerResult.success).toBe(true);
      const footerText = footerResult.data.text!;

      // Pattern matching for dynamic content
      expect(footerText).toMatch(/APEX Integration Testing/);
      expect(footerText).toMatch(/Screenshot Tests/);
      expect(footerText).toMatch(/Content Tests/);
      expect(footerText).toMatch(/PDF Tests/);
      expect(footerText).toMatch(/Error Tests/);
      expect(footerText).toMatch(/© 2024 APEX/);
    });

    it('should validate all expected test classes are present in HTML', async () => {
      const fullHtmlResult = await testContext.browserTool.execute({
        operation: 'getHtml',
        params: {}
      });

      expect(fullHtmlResult.success).toBe(true);
      const html = fullHtmlResult.data.html!;

      // Verify all expected CSS classes exist
      EXPECTED_CONTENT.testClasses.forEach(className => {
        expect(html).toContain(`class="${className}"`);
      });
    });
  });

  describe('Edge Case Tests', () => {
    it('should handle empty elements gracefully', async () => {
      const emptyResult = await testContext.browserTool.execute({
        operation: 'getText',
        params: { selector: TEST_CONFIG.selectors.emptyElement }
      });

      expect(emptyResult.success).toBe(true);
      expect(emptyResult.data.text).toBe('');

      // Test HTML extraction of empty element
      const emptyHtmlResult = await testContext.browserTool.execute({
        operation: 'getHtml',
        params: { selector: TEST_CONFIG.selectors.emptyElement }
      });

      expect(emptyHtmlResult.success).toBe(true);
      expect(emptyHtmlResult.data.html!.trim()).toBe('');
    });

    it('should handle non-existent selectors with appropriate errors', async () => {
      const nonExistentTextResult = await testContext.browserTool.execute({
        operation: 'getText',
        params: { selector: TEST_CONFIG.selectors.nonExistent }
      });

      expect(nonExistentTextResult.success).toBe(false);
      expect(nonExistentTextResult.error).toBeDefined();
      expect(nonExistentTextResult.error).toContain('not found');

      // Test HTML extraction with non-existent selector
      const nonExistentHtmlResult = await testContext.browserTool.execute({
        operation: 'getHtml',
        params: { selector: TEST_CONFIG.selectors.nonExistent }
      });

      expect(nonExistentHtmlResult.success).toBe(false);
      expect(nonExistentHtmlResult.error).toBeDefined();
      expect(nonExistentHtmlResult.error).toContain('not found');
    });

    it('should handle malformed CSS selectors gracefully', async () => {
      const malformedSelector = '<<<invalid>>>selector';

      const malformedTextResult = await testContext.browserTool.execute({
        operation: 'getText',
        params: { selector: malformedSelector }
      });

      expect(malformedTextResult.success).toBe(false);
      expect(malformedTextResult.error).toBeDefined();

      const malformedHtmlResult = await testContext.browserTool.execute({
        operation: 'getHtml',
        params: { selector: malformedSelector }
      });

      expect(malformedHtmlResult.success).toBe(false);
      expect(malformedHtmlResult.error).toBeDefined();
    });

    it('should preserve Unicode characters and special content', async () => {
      // Add content with Unicode characters using evaluate
      await testContext.browserTool.execute({
        operation: 'evaluate',
        params: {
          script: `
            const testDiv = document.createElement('div');
            testDiv.className = 'unicode-test';
            testDiv.innerHTML = 'Unicode: 🚀 ✨ 🎯 Hello 世界 &lt;test&gt; &amp; &nbsp;';
            document.body.appendChild(testDiv);
          `
        }
      });

      const unicodeTextResult = await testContext.browserTool.execute({
        operation: 'getText',
        params: { selector: '.unicode-test' }
      });

      expect(unicodeTextResult.success).toBe(true);
      const unicodeText = unicodeTextResult.data.text!;

      // Verify Unicode characters are preserved
      expect(unicodeText).toContain('🚀');
      expect(unicodeText).toContain('✨');
      expect(unicodeText).toContain('🎯');
      expect(unicodeText).toContain('世界');

      // Verify HTML entities are handled properly in text
      expect(unicodeText).toContain('&');
      expect(unicodeText).toContain('<test>');

      const unicodeHtmlResult = await testContext.browserTool.execute({
        operation: 'getHtml',
        params: { selector: '.unicode-test' }
      });

      expect(unicodeHtmlResult.success).toBe(true);
      const unicodeHtml = unicodeHtmlResult.data.html!;

      // Verify HTML entities are preserved in HTML
      expect(unicodeHtml).toContain('&lt;test&gt;');
      expect(unicodeHtml).toContain('&amp;');
      expect(unicodeHtml).toContain('&nbsp;');
    });

    it('should handle deeply nested structures', async () => {
      // Create deeply nested content
      await testContext.browserTool.execute({
        operation: 'evaluate',
        params: {
          script: `
            const createNestedDiv = (depth) => {
              if (depth === 0) return 'Deep content level 0';
              return '<div class="level-' + depth + '">Level ' + depth + createNestedDiv(depth - 1) + '</div>';
            };
            const nestedDiv = document.createElement('div');
            nestedDiv.className = 'nested-test';
            nestedDiv.innerHTML = createNestedDiv(10);
            document.body.appendChild(nestedDiv);
          `
        }
      });

      const nestedHtmlResult = await testContext.browserTool.execute({
        operation: 'getHtml',
        params: { selector: '.nested-test' }
      });

      expect(nestedHtmlResult.success).toBe(true);
      const nestedHtml = nestedHtmlResult.data.html!;

      // Verify deeply nested structure is preserved
      expect(nestedHtml).toContain('<div class="level-10">');
      expect(nestedHtml).toContain('<div class="level-5">');
      expect(nestedHtml).toContain('<div class="level-1">');
      expect(nestedHtml).toContain('Deep content level 0');

      const nestedTextResult = await testContext.browserTool.execute({
        operation: 'getText',
        params: { selector: '.nested-test' }
      });

      expect(nestedTextResult.success).toBe(true);
      const nestedText = nestedTextResult.data.text!;

      // Verify text extraction handles nested content
      expect(nestedText).toContain('Level 10');
      expect(nestedText).toContain('Level 5');
      expect(nestedText).toContain('Level 1');
      expect(nestedText).toContain('Deep content level 0');
    });
  });

  describe('Dynamic Content Tests', () => {
    it('should extract content added via JavaScript after page load', async () => {
      // Add dynamic content using evaluate
      await testContext.browserTool.execute({
        operation: 'evaluate',
        params: {
          script: `
            const dynamicDiv = document.createElement('div');
            dynamicDiv.className = 'js-added-content';
            dynamicDiv.innerHTML = '<h3>JavaScript Added Content</h3><p>This was added after page load</p>';
            document.body.appendChild(dynamicDiv);
          `
        }
      });

      const jsContentResult = await testContext.browserTool.execute({
        operation: 'getHtml',
        params: { selector: '.js-added-content' }
      });

      expect(jsContentResult.success).toBe(true);
      const jsHtml = jsContentResult.data.html!;

      expect(jsHtml).toContain('<h3>JavaScript Added Content</h3>');
      expect(jsHtml).toContain('<p>This was added after page load</p>');

      const jsTextResult = await testContext.browserTool.execute({
        operation: 'getText',
        params: { selector: '.js-added-content' }
      });

      expect(jsTextResult.success).toBe(true);
      expect(jsTextResult.data.text!).toContain('JavaScript Added Content');
      expect(jsTextResult.data.text!).toContain('This was added after page load');
    });

    it('should extract content modified via evaluate operation', async () => {
      // Modify existing content
      await testContext.browserTool.execute({
        operation: 'evaluate',
        params: {
          script: `
            const header = document.querySelector('.test-header h1');
            if (header) {
              header.textContent = 'Modified Title via JavaScript';
            }
          `
        }
      });

      const modifiedHeaderResult = await testContext.browserTool.execute({
        operation: 'getText',
        params: { selector: '.test-header h1' }
      });

      expect(modifiedHeaderResult.success).toBe(true);
      expect(modifiedHeaderResult.data.text!).toBe('Modified Title via JavaScript');

      const modifiedHtmlResult = await testContext.browserTool.execute({
        operation: 'getHtml',
        params: { selector: '.test-header' }
      });

      expect(modifiedHtmlResult.success).toBe(true);
      expect(modifiedHtmlResult.data.html!).toContain('Modified Title via JavaScript');
    });

    it('should extract content from dynamically created complex structures', async () => {
      // Create complex dynamic structure
      await testContext.browserTool.execute({
        operation: 'evaluate',
        params: {
          script: `
            const complexDiv = document.createElement('div');
            complexDiv.className = 'complex-dynamic';
            complexDiv.innerHTML = \`
              <div class="dynamic-header">
                <h2>Dynamic Complex Structure</h2>
                <p>Generated at: \${new Date().toISOString()}</p>
              </div>
              <div class="dynamic-list">
                <ul>
                  <li data-id="1">Dynamic Item 1</li>
                  <li data-id="2">Dynamic Item 2</li>
                  <li data-id="3">Dynamic Item 3</li>
                </ul>
              </div>
              <div class="dynamic-table">
                <table>
                  <thead>
                    <tr><th>Column 1</th><th>Column 2</th></tr>
                  </thead>
                  <tbody>
                    <tr><td>Data 1</td><td>Data 2</td></tr>
                  </tbody>
                </table>
              </div>
            \`;
            document.body.appendChild(complexDiv);
          `
        }
      });

      const complexHtmlResult = await testContext.browserTool.execute({
        operation: 'getHtml',
        params: { selector: '.complex-dynamic' }
      });

      expect(complexHtmlResult.success).toBe(true);
      const complexHtml = complexHtmlResult.data.html!;

      // Verify complex structure is captured
      expect(complexHtml).toContain('<div class="dynamic-header">');
      expect(complexHtml).toContain('<h2>Dynamic Complex Structure</h2>');
      expect(complexHtml).toContain('<ul>');
      expect(complexHtml).toContain('<li data-id="1">Dynamic Item 1</li>');
      expect(complexHtml).toContain('<table>');
      expect(complexHtml).toContain('<thead>');
      expect(complexHtml).toContain('<tbody>');

      const complexTextResult = await testContext.browserTool.execute({
        operation: 'getText',
        params: { selector: '.complex-dynamic' }
      });

      expect(complexTextResult.success).toBe(true);
      const complexText = complexTextResult.data.text!;

      expect(complexText).toContain('Dynamic Complex Structure');
      expect(complexText).toContain('Generated at:');
      expect(complexText).toContain('Dynamic Item 1');
      expect(complexText).toContain('Dynamic Item 2');
      expect(complexText).toContain('Column 1');
      expect(complexText).toContain('Data 1');
    });
  });

  describe('Performance and Metadata Validation', () => {
    it('should include proper metadata in content extraction results', async () => {
      const result = await testContext.browserTool.execute({
        operation: 'getHtml',
        params: { selector: TEST_CONFIG.selectors.header }
      });

      expect(result.success).toBe(true);
      expect(result.metadata).toBeDefined();
      expect(result.metadata.url).toBeDefined();
      expect(result.metadata.executionTime).toBeDefined();
      expect(typeof result.metadata.executionTime).toBe('number');
      expect(result.metadata.executionTime).toBeGreaterThan(0);
      expect(result.metadata.permissionGranted).toBeDefined();
      expect(typeof result.metadata.permissionGranted).toBe('boolean');
    });

    it('should handle large content extraction efficiently', async () => {
      // Create large content
      await testContext.browserTool.execute({
        operation: 'evaluate',
        params: {
          script: `
            const largeDiv = document.createElement('div');
            largeDiv.className = 'large-content-test';
            let largeContent = '';
            for (let i = 0; i < 1000; i++) {
              largeContent += '<p>Large content paragraph ' + i + ' with some substantial text content to make it reasonably sized.</p>';
            }
            largeDiv.innerHTML = largeContent;
            document.body.appendChild(largeDiv);
          `
        }
      });

      const startTime = Date.now();
      const largeContentResult = await testContext.browserTool.execute({
        operation: 'getHtml',
        params: { selector: '.large-content-test' }
      });
      const endTime = Date.now();

      expect(largeContentResult.success).toBe(true);
      expect(largeContentResult.data.html).toBeDefined();
      expect(largeContentResult.data.html!.length).toBeGreaterThan(50000); // Should be substantial

      // Performance validation - should complete within reasonable time
      const executionTime = endTime - startTime;
      expect(executionTime).toBeLessThan(5000); // Should complete within 5 seconds

      // Verify content contains expected patterns
      const html = largeContentResult.data.html!;
      expect(html).toContain('<p>Large content paragraph 0');
      expect(html).toContain('<p>Large content paragraph 500');
      expect(html).toContain('<p>Large content paragraph 999');
    });

    it('should maintain consistent performance across multiple extractions', async () => {
      const executionTimes: number[] = [];

      // Perform multiple extractions
      for (let i = 0; i < 5; i++) {
        const startTime = Date.now();
        const result = await testContext.browserTool.execute({
          operation: 'getText',
          params: { selector: 'body' }
        });
        const endTime = Date.now();

        expect(result.success).toBe(true);
        executionTimes.push(endTime - startTime);
      }

      // Verify performance consistency
      const avgTime = executionTimes.reduce((a, b) => a + b) / executionTimes.length;
      expect(avgTime).toBeLessThan(1000); // Average should be under 1 second

      // No extraction should be excessively slow
      executionTimes.forEach(time => {
        expect(time).toBeLessThan(2000); // Each should be under 2 seconds
      });
    });
  });

  describe('Cross-Browser Content Extraction', () => {
    // Test different browser engines if available
    const browserTypes = ['chromium'] as const; // Start with chromium, add others if available

    browserTypes.forEach(browserType => {
      it(`should extract consistent content across ${browserType} browser`, async () => {
        // Create new browser tool with specific browser type
        const browserTool = new BrowserTool({
          backend: 'playwright',
          engine: browserType,
          headless: true
        });

        try {
          // Navigate to test page
          await browserTool.execute({
            operation: 'navigate',
            params: { url: testContext.testPageUrl }
          });

          // Test HTML extraction
          const htmlResult = await browserTool.execute({
            operation: 'getHtml',
            params: { selector: TEST_CONFIG.selectors.header }
          });

          expect(htmlResult.success).toBe(true);
          expect(htmlResult.data.html).toContain(EXPECTED_CONTENT.headerTitle);

          // Test text extraction
          const textResult = await browserTool.execute({
            operation: 'getText',
            params: { selector: TEST_CONFIG.selectors.header }
          });

          expect(textResult.success).toBe(true);
          expect(textResult.data.text).toContain(EXPECTED_CONTENT.headerTitle);

        } finally {
          await browserTool.cleanup();
        }
      });
    });
  });
});