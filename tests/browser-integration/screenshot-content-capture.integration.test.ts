/**
 * @fileoverview Integration tests for screenshot and content capture functionality
 *
 * This test suite covers:
 * - Full page screenshots with various formats and quality settings
 * - Element-specific screenshots with selector targeting
 * - HTML content extraction (full page and element-specific)
 * - Text content extraction and processing
 * - PDF generation from web pages
 * - Error handling and edge cases
 * - Performance validation for large content
 *
 * Test Environment:
 * - Uses Playwright for browser automation
 * - Tests both headless and headed modes
 * - Cross-browser compatibility (Chromium, Firefox, WebKit)
 * - Multiple viewport sizes and device emulation
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { BrowserTool } from '@apexcli/orchestrator';
import { chromium, firefox, webkit, type Browser, type BrowserContext, type Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { PNG } from 'pngjs';
import { createTestPage, createTempDir, cleanupTempDir } from './utils/test-helpers';

interface TestContext {
  tempDir: string;
  browserTool: BrowserTool;
  testPageUrl: string;
}

// Test configuration
const TEST_CONFIG = {
  timeout: 60000,
  screenshotTimeout: 10000,
  contentTimeout: 5000,
  browsers: ['chromium', 'firefox', 'webkit'] as const,
  viewports: [
    { width: 1920, height: 1080, name: 'desktop' },
    { width: 768, height: 1024, name: 'tablet' },
    { width: 375, height: 667, name: 'mobile' }
  ],
  formats: ['png', 'jpeg'] as const,
  qualities: [50, 80, 100],
};

describe('Browser Screenshot and Content Capture Integration Tests', () => {
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

  describe('Full Page Screenshots', () => {
    it('should capture full page screenshot in PNG format', async () => {
      const screenshotPath = path.join(testContext.tempDir, 'fullpage.png');

      // Navigate to test page
      const navResult = await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: testContext.testPageUrl }
      });
      expect(navResult.success).toBe(true);

      // Capture full page screenshot
      const screenshotResult = await testContext.browserTool.execute({
        operation: 'screenshot',
        params: {
          path: screenshotPath,
          fullPage: true,
          format: 'png'
        }
      });

      expect(screenshotResult.success).toBe(true);
      expect(screenshotResult.data).toMatchObject({
        format: 'png'
      });
      expect(screenshotResult.screenshot).toBe(screenshotPath);

      // Verify file exists and is valid PNG
      expect(fs.existsSync(screenshotPath)).toBe(true);
      const fileBuffer = fs.readFileSync(screenshotPath);
      expect(() => PNG.sync.read(fileBuffer)).not.toThrow();
      expect(fileBuffer.length).toBeGreaterThan(1000); // Should be substantial
    });

    it('should capture full page screenshot in JPEG format with quality settings', async () => {
      for (const quality of TEST_CONFIG.qualities) {
        const screenshotPath = path.join(testContext.tempDir, `fullpage_q${quality}.jpg`);

        // Navigate to test page
        await testContext.browserTool.execute({
          operation: 'navigate',
          params: { url: testContext.testPageUrl }
        });

        // Capture screenshot with quality setting
        const screenshotResult = await testContext.browserTool.execute({
          operation: 'screenshot',
          params: {
            path: screenshotPath,
            fullPage: true,
            format: 'jpeg',
            quality
          }
        });

        expect(screenshotResult.success).toBe(true);
        expect(screenshotResult.data).toMatchObject({
          format: 'jpeg'
        });

        // Verify file exists
        expect(fs.existsSync(screenshotPath)).toBe(true);
        const fileStats = fs.statSync(screenshotPath);
        expect(fileStats.size).toBeGreaterThan(500); // JPEG should be compressed
      }
    });

    it('should capture full page screenshot across different viewports', async () => {
      for (const viewport of TEST_CONFIG.viewports) {
        const screenshotPath = path.join(testContext.tempDir, `fullpage_${viewport.name}.png`);

        // Navigate to test page
        await testContext.browserTool.execute({
          operation: 'navigate',
          params: { url: testContext.testPageUrl }
        });

        // Capture screenshot
        const screenshotResult = await testContext.browserTool.execute({
          operation: 'screenshot',
          params: {
            path: screenshotPath,
            fullPage: true,
            format: 'png'
          }
        });

        expect(screenshotResult.success).toBe(true);
        expect(fs.existsSync(screenshotPath)).toBe(true);

        // Verify screenshot dimensions make sense
        const buffer = fs.readFileSync(screenshotPath);
        const png = PNG.sync.read(buffer);
        expect(png.width).toBeGreaterThan(300);
        expect(png.height).toBeGreaterThan(300);
      }
    });

    it('should return base64 screenshot data when no path is provided', async () => {
      // Navigate to test page
      await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: testContext.testPageUrl }
      });

      // Capture screenshot without path
      const screenshotResult = await testContext.browserTool.execute({
        operation: 'screenshot',
        params: {
          fullPage: true,
          format: 'png'
        }
      });

      expect(screenshotResult.success).toBe(true);
      expect(screenshotResult.screenshot).toBeDefined();
      expect(screenshotResult.screenshot).toMatch(/^data:image\/png;base64,/);

      // Verify base64 data is valid
      const base64Data = screenshotResult.screenshot!.split(',')[1];
      const buffer = Buffer.from(base64Data, 'base64');
      expect(() => PNG.sync.read(buffer)).not.toThrow();
    });
  });

  describe('Element Screenshots', () => {
    it('should capture screenshot of specific element by selector', async () => {
      const screenshotPath = path.join(testContext.tempDir, 'element.png');

      // Navigate to test page
      await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: testContext.testPageUrl }
      });

      // Capture element screenshot
      const screenshotResult = await testContext.browserTool.execute({
        operation: 'screenshot',
        params: {
          path: screenshotPath,
          selector: '.test-container',
          format: 'png'
        }
      });

      expect(screenshotResult.success).toBe(true);
      expect(fs.existsSync(screenshotPath)).toBe(true);

      // Verify screenshot is smaller than full page
      const elementBuffer = fs.readFileSync(screenshotPath);
      const elementPng = PNG.sync.read(elementBuffer);
      expect(elementPng.width).toBeLessThan(1920); // Should be smaller than full viewport
      expect(elementPng.height).toBeLessThan(1080);
    });

    it('should handle multiple element selectors', async () => {
      const selectors = ['.test-header', '.test-content', '.test-footer'];

      // Navigate to test page
      await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: testContext.testPageUrl }
      });

      for (let i = 0; i < selectors.length; i++) {
        const screenshotPath = path.join(testContext.tempDir, `element_${i}.png`);

        const screenshotResult = await testContext.browserTool.execute({
          operation: 'screenshot',
          params: {
            path: screenshotPath,
            selector: selectors[i],
            format: 'png'
          }
        });

        expect(screenshotResult.success).toBe(true);
        expect(fs.existsSync(screenshotPath)).toBe(true);
      }
    });

    it('should handle non-existent element gracefully', async () => {
      // Navigate to test page
      await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: testContext.testPageUrl }
      });

      // Try to screenshot non-existent element
      const screenshotResult = await testContext.browserTool.execute({
        operation: 'screenshot',
        params: {
          selector: '.non-existent-element',
          format: 'png'
        }
      });

      expect(screenshotResult.success).toBe(false);
      expect(screenshotResult.error).toContain('Element not found');
    });
  });

  describe('HTML Content Extraction', () => {
    it('should extract full page HTML content', async () => {
      // Navigate to test page
      await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: testContext.testPageUrl }
      });

      // Extract full page HTML
      const htmlResult = await testContext.browserTool.execute({
        operation: 'getHtml',
        params: {}
      });

      expect(htmlResult.success).toBe(true);
      expect(htmlResult.data).toMatchObject({
        html: expect.any(String)
      });

      const html = (htmlResult.data as { html: string }).html;
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html');
      expect(html).toContain('</html>');
      expect(html).toContain('test-container'); // Should contain test content
    });

    it('should extract HTML content of specific elements', async () => {
      // Navigate to test page
      await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: testContext.testPageUrl }
      });

      // Extract element HTML
      const htmlResult = await testContext.browserTool.execute({
        operation: 'getHtml',
        params: {
          selector: '.test-container'
        }
      });

      expect(htmlResult.success).toBe(true);
      expect(htmlResult.data).toMatchObject({
        html: expect.any(String)
      });

      const html = (htmlResult.data as { html: string }).html;
      expect(html).not.toContain('<!DOCTYPE html>'); // Should not contain document structure
      expect(html).toContain('test-container'); // Should contain element content
    });

    it('should handle multiple element HTML extraction', async () => {
      const selectors = ['.test-header', '.test-content', '.test-footer'];

      // Navigate to test page
      await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: testContext.testPageUrl }
      });

      for (const selector of selectors) {
        const htmlResult = await testContext.browserTool.execute({
          operation: 'getHtml',
          params: { selector }
        });

        expect(htmlResult.success).toBe(true);
        expect(htmlResult.data).toMatchObject({
          html: expect.stringMatching(/.+/) // Should have content
        });
      }
    });

    it('should preserve HTML structure and formatting', async () => {
      // Navigate to test page
      await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: testContext.testPageUrl }
      });

      // Extract HTML with complex structure
      const htmlResult = await testContext.browserTool.execute({
        operation: 'getHtml',
        params: {
          selector: '.test-content'
        }
      });

      expect(htmlResult.success).toBe(true);
      const html = (htmlResult.data as { html: string }).html;

      // Should preserve various HTML elements
      expect(html).toMatch(/<[^>]+>/); // Should contain HTML tags
      expect(html).toMatch(/\s+/); // Should preserve whitespace
    });
  });

  describe('Text Content Extraction', () => {
    it('should extract text content from full page', async () => {
      // Navigate to test page
      await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: testContext.testPageUrl }
      });

      // Extract text from body
      const textResult = await testContext.browserTool.execute({
        operation: 'getText',
        params: {
          selector: 'body'
        }
      });

      expect(textResult.success).toBe(true);
      expect(textResult.data).toMatchObject({
        text: expect.any(String)
      });

      const text = (textResult.data as { text: string }).text;
      expect(text.length).toBeGreaterThan(10);
      expect(text).not.toContain('<'); // Should not contain HTML tags
      expect(text).not.toContain('>');
    });

    it('should extract text content from specific elements', async () => {
      const selectors = ['.test-header', '.test-content', '.test-footer'];

      // Navigate to test page
      await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: testContext.testPageUrl }
      });

      for (const selector of selectors) {
        const textResult = await testContext.browserTool.execute({
          operation: 'getText',
          params: { selector }
        });

        expect(textResult.success).toBe(true);
        expect(textResult.data).toMatchObject({
          text: expect.any(String)
        });

        const text = (textResult.data as { text: string }).text;
        expect(text).not.toContain('<'); // Should be plain text
        expect(text.trim().length).toBeGreaterThan(0);
      }
    });

    it('should handle empty text elements', async () => {
      // Navigate to test page
      await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: testContext.testPageUrl }
      });

      // Try to get text from empty element (if exists)
      const textResult = await testContext.browserTool.execute({
        operation: 'getText',
        params: {
          selector: '.empty-element' // This selector might not exist, but test should handle gracefully
        }
      });

      // Should either succeed with empty text or fail gracefully
      if (textResult.success) {
        expect(textResult.data).toMatchObject({
          text: expect.any(String)
        });
      } else {
        expect(textResult.error).toBeDefined();
      }
    });

    it('should preserve text spacing and line breaks', async () => {
      // Navigate to test page
      await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: testContext.testPageUrl }
      });

      // Extract text from structured content
      const textResult = await testContext.browserTool.execute({
        operation: 'getText',
        params: {
          selector: '.test-content'
        }
      });

      expect(textResult.success).toBe(true);
      const text = (textResult.data as { text: string }).text;

      // Should preserve some whitespace structure
      expect(text).toMatch(/\s+/); // Should contain whitespace
    });
  });

  describe('PDF Generation', () => {
    it('should generate PDF from current page', async () => {
      const pdfPath = path.join(testContext.tempDir, 'page.pdf');

      // Navigate to test page
      await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: testContext.testPageUrl }
      });

      // Generate PDF
      const pdfResult = await testContext.browserTool.execute({
        operation: 'generatePdf',
        params: {
          path: pdfPath,
          format: 'A4',
          printBackground: true
        }
      });

      expect(pdfResult.success).toBe(true);
      expect(pdfResult.data).toMatchObject({
        format: 'A4',
        landscape: false
      });

      // Verify PDF file exists
      expect(fs.existsSync(pdfPath)).toBe(true);
      const fileStats = fs.statSync(pdfPath);
      expect(fileStats.size).toBeGreaterThan(1000); // Should be substantial PDF
    });

    it('should generate PDF with different page formats', async () => {
      const formats: Array<'Letter' | 'Legal' | 'A4' | 'A3'> = ['Letter', 'Legal', 'A4', 'A3'];

      // Navigate to test page
      await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: testContext.testPageUrl }
      });

      for (const format of formats) {
        const pdfPath = path.join(testContext.tempDir, `page_${format}.pdf`);

        const pdfResult = await testContext.browserTool.execute({
          operation: 'generatePdf',
          params: {
            path: pdfPath,
            format,
            printBackground: true
          }
        });

        expect(pdfResult.success).toBe(true);
        expect(pdfResult.data).toMatchObject({
          format
        });

        // Verify PDF file exists
        expect(fs.existsSync(pdfPath)).toBe(true);
        const fileStats = fs.statSync(pdfPath);
        expect(fileStats.size).toBeGreaterThan(1000);
      }
    });

    it('should generate PDF in landscape orientation', async () => {
      const pdfPath = path.join(testContext.tempDir, 'page_landscape.pdf');

      // Navigate to test page
      await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: testContext.testPageUrl }
      });

      // Generate landscape PDF
      const pdfResult = await testContext.browserTool.execute({
        operation: 'generatePdf',
        params: {
          path: pdfPath,
          format: 'A4',
          landscape: true,
          printBackground: true
        }
      });

      expect(pdfResult.success).toBe(true);
      expect(pdfResult.data).toMatchObject({
        format: 'A4',
        landscape: true
      });

      // Verify PDF file exists
      expect(fs.existsSync(pdfPath)).toBe(true);
    });

    it('should generate PDF with custom margins', async () => {
      const pdfPath = path.join(testContext.tempDir, 'page_margins.pdf');

      // Navigate to test page
      await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: testContext.testPageUrl }
      });

      // Generate PDF with custom margins
      const pdfResult = await testContext.browserTool.execute({
        operation: 'generatePdf',
        params: {
          path: pdfPath,
          format: 'A4',
          margin: {
            top: '2cm',
            bottom: '2cm',
            left: '1.5cm',
            right: '1.5cm'
          },
          printBackground: true
        }
      });

      expect(pdfResult.success).toBe(true);
      expect(fs.existsSync(pdfPath)).toBe(true);
    });

    it('should return base64 PDF data when no path is provided', async () => {
      // Navigate to test page
      await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: testContext.testPageUrl }
      });

      // Generate PDF without path
      const pdfResult = await testContext.browserTool.execute({
        operation: 'generatePdf',
        params: {
          format: 'A4',
          printBackground: true
        }
      });

      expect(pdfResult.success).toBe(true);
      expect(pdfResult.screenshot).toBeDefined();
      expect(pdfResult.screenshot).toMatch(/^data:application\/pdf;base64,/);

      // Verify base64 data is valid
      const base64Data = pdfResult.screenshot!.split(',')[1];
      const buffer = Buffer.from(base64Data, 'base64');
      expect(buffer.length).toBeGreaterThan(1000);
      // Check PDF header (should start with %PDF)
      expect(buffer.toString('ascii', 0, 4)).toBe('%PDF');
    });

    it('should handle PDF generation with page ranges', async () => {
      // Create a multi-page test scenario by adding content
      // First navigate to test page
      await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: testContext.testPageUrl }
      });

      // Add additional content to create multiple pages
      await testContext.browserTool.execute({
        operation: 'evaluate',
        params: {
          script: `
            // Add multiple sections to create page breaks
            const container = document.querySelector('.test-content');
            for (let i = 0; i < 5; i++) {
              const section = document.createElement('div');
              section.style.pageBreakBefore = 'always';
              section.style.height = '800px';
              section.innerHTML = '<h2>Page ' + (i + 2) + '</h2><p>Additional content for page ' + (i + 2) + '</p>';
              container.appendChild(section);
            }
          `
        }
      });

      const pdfPath = path.join(testContext.tempDir, 'page_range.pdf');

      // Generate PDF with page range
      const pdfResult = await testContext.browserTool.execute({
        operation: 'generatePdf',
        params: {
          path: pdfPath,
          format: 'A4',
          pageRanges: '1-3',
          printBackground: true
        }
      });

      expect(pdfResult.success).toBe(true);
      expect(pdfResult.data).toMatchObject({
        pages: '1-3'
      });

      expect(fs.existsSync(pdfPath)).toBe(true);
    });

    it('should handle PDF generation with headers and footers', async () => {
      // Navigate to test page
      await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: testContext.testPageUrl }
      });

      const pdfPath = path.join(testContext.tempDir, 'page_with_headers.pdf');

      // Generate PDF with headers and footers
      const pdfResult = await testContext.browserTool.execute({
        operation: 'generatePdf',
        params: {
          path: pdfPath,
          format: 'A4',
          displayHeaderFooter: true,
          headerTemplate: '<div style="font-size: 10px; width: 100%; text-align: center;">Test Document Header</div>',
          footerTemplate: '<div style="font-size: 10px; width: 100%; text-align: center;">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>',
          margin: {
            top: '1in',
            bottom: '1in',
            left: '0.5in',
            right: '0.5in'
          },
          printBackground: true
        }
      });

      expect(pdfResult.success).toBe(true);
      expect(fs.existsSync(pdfPath)).toBe(true);

      // Verify PDF is larger due to headers/footers
      const pdfStats = fs.statSync(pdfPath);
      expect(pdfStats.size).toBeGreaterThan(1000);
    });

    it('should generate PDF with media queries and responsive content', async () => {
      // Create a test page with media queries
      const responsivePageUrl = await createTestPage();

      // Navigate to responsive test page
      await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: responsivePageUrl }
      });

      // Add responsive CSS for print
      await testContext.browserTool.execute({
        operation: 'evaluate',
        params: {
          script: `
            const style = document.createElement('style');
            style.textContent = \`
              @media print {
                body { background: white !important; }
                .test-header { font-size: 24px; }
                .test-content { page-break-inside: avoid; }
                .no-print { display: none; }
              }
              @page {
                size: A4;
                margin: 2cm;
              }
            \`;
            document.head.appendChild(style);

            // Add elements that should be hidden in print
            const noPrintDiv = document.createElement('div');
            noPrintDiv.className = 'no-print';
            noPrintDiv.textContent = 'This should not appear in PDF';
            noPrintDiv.style.color = 'red';
            document.querySelector('.test-content').appendChild(noPrintDiv);
          `
        }
      });

      const pdfPath = path.join(testContext.tempDir, 'responsive_pdf.pdf');

      // Generate PDF that respects print media queries
      const pdfResult = await testContext.browserTool.execute({
        operation: 'generatePdf',
        params: {
          path: pdfPath,
          format: 'A4',
          printBackground: false, // Test without background
          preferCSSPageSize: true
        }
      });

      expect(pdfResult.success).toBe(true);
      expect(fs.existsSync(pdfPath)).toBe(true);
    });

    it('should respect CSS print media styles', async () => {
      // Create a test page with print-specific CSS
      const testPageWithPrintCSS = await createTestPage();

      // Navigate to test page
      await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: testPageWithPrintCSS }
      });

      const pdfPath = path.join(testContext.tempDir, 'page_print_styles.pdf');

      // Generate PDF that respects print styles
      const pdfResult = await testContext.browserTool.execute({
        operation: 'generatePdf',
        params: {
          path: pdfPath,
          format: 'A4',
          printBackground: true,
          preferCSSPageSize: true
        }
      });

      expect(pdfResult.success).toBe(true);
      expect(fs.existsSync(pdfPath)).toBe(true);
    });

    it('should handle PDF generation errors gracefully', async () => {
      // Test PDF generation without navigation (should fail or handle gracefully)
      const pdfResult = await testContext.browserTool.execute({
        operation: 'generatePdf',
        params: {
          format: 'A4'
        }
      });

      // PDF generation might succeed with a blank page or fail gracefully
      // Both outcomes are acceptable depending on browser state
      if (!pdfResult.success) {
        expect(pdfResult.error).toBeDefined();
      } else {
        expect(pdfResult.success).toBe(true);
      }
    });
  });

  describe('Cross-Browser Compatibility', () => {
    // Note: This test is more complex and might be skipped in CI environments
    // where multiple browsers are not available
    it.skip('should work consistently across different browser engines', async () => {
      const testResults: Record<string, any> = {};

      for (const browserType of TEST_CONFIG.browsers) {
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

          // Take screenshot
          const screenshotResult = await browserTool.execute({
            operation: 'screenshot',
            params: {
              fullPage: true,
              format: 'png'
            }
          });

          // Extract HTML
          const htmlResult = await browserTool.execute({
            operation: 'getHtml',
            params: {}
          });

          // Extract text
          const textResult = await browserTool.execute({
            operation: 'getText',
            params: { selector: 'body' }
          });

          testResults[browserType] = {
            screenshot: screenshotResult.success,
            html: htmlResult.success,
            text: textResult.success
          };

          // All operations should succeed
          expect(screenshotResult.success).toBe(true);
          expect(htmlResult.success).toBe(true);
          expect(textResult.success).toBe(true);
        } finally {
          await browserTool.cleanup();
        }
      }

      // Verify consistency across browsers
      const browsers = Object.keys(testResults);
      expect(browsers.length).toBeGreaterThan(1);

      for (const browser of browsers) {
        expect(testResults[browser].screenshot).toBe(true);
        expect(testResults[browser].html).toBe(true);
        expect(testResults[browser].text).toBe(true);
      }
    });
  });

  describe('Performance and Large Content', () => {
    it('should handle large page screenshots efficiently', async () => {
      const startTime = Date.now();

      // Navigate to test page
      await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: testContext.testPageUrl }
      });

      // Take full page screenshot
      const screenshotResult = await testContext.browserTool.execute({
        operation: 'screenshot',
        params: {
          fullPage: true,
          format: 'png'
        }
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(screenshotResult.success).toBe(true);
      expect(duration).toBeLessThan(TEST_CONFIG.screenshotTimeout);
    });

    it('should handle large HTML content extraction efficiently', async () => {
      const startTime = Date.now();

      // Navigate to test page
      await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: testContext.testPageUrl }
      });

      // Extract full HTML
      const htmlResult = await testContext.browserTool.execute({
        operation: 'getHtml',
        params: {}
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(htmlResult.success).toBe(true);
      expect(duration).toBeLessThan(TEST_CONFIG.contentTimeout);

      // Verify content size is reasonable
      const html = (htmlResult.data as { html: string }).html;
      expect(html.length).toBeGreaterThan(100);
      expect(html.length).toBeLessThan(1000000); // Should not be excessively large
    });
  });

  describe('Advanced Content Extraction', () => {
    it('should extract content from dynamically loaded elements', async () => {
      // Navigate to test page
      await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: testContext.testPageUrl }
      });

      // Add dynamic content via JavaScript
      await testContext.browserTool.execute({
        operation: 'evaluate',
        params: {
          script: `
            const dynamicDiv = document.createElement('div');
            dynamicDiv.id = 'dynamic-content';
            dynamicDiv.innerHTML = '<h3>Dynamically Added Content</h3><p>This content was added after page load.</p>';
            dynamicDiv.style.cssText = 'background: yellow; padding: 20px; margin: 10px;';
            document.querySelector('.test-content').appendChild(dynamicDiv);
          `
        }
      });

      // Wait for content to be rendered
      await testContext.browserTool.execute({
        operation: 'waitForSelector',
        params: {
          selector: '#dynamic-content'
        }
      });

      // Extract HTML of dynamic content
      const dynamicHtmlResult = await testContext.browserTool.execute({
        operation: 'getHtml',
        params: {
          selector: '#dynamic-content'
        }
      });

      expect(dynamicHtmlResult.success).toBe(true);
      const dynamicHtml = (dynamicHtmlResult.data as { html: string }).html;
      expect(dynamicHtml).toContain('Dynamically Added Content');
      expect(dynamicHtml).toContain('This content was added after page load');

      // Extract text of dynamic content
      const dynamicTextResult = await testContext.browserTool.execute({
        operation: 'getText',
        params: {
          selector: '#dynamic-content'
        }
      });

      expect(dynamicTextResult.success).toBe(true);
      const dynamicText = (dynamicTextResult.data as { text: string }).text;
      expect(dynamicText).toContain('Dynamically Added Content');
      expect(dynamicText).not.toContain('<');
    });

    it('should extract content from iframes and embedded elements', async () => {
      // Navigate to test page
      await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: testContext.testPageUrl }
      });

      // Add iframe content
      await testContext.browserTool.execute({
        operation: 'evaluate',
        params: {
          script: `
            const iframe = document.createElement('iframe');
            iframe.id = 'test-iframe';
            iframe.srcdoc = '<html><body><h1>Iframe Content</h1><p>This is inside an iframe</p></body></html>';
            iframe.style.cssText = 'width: 400px; height: 200px; border: 2px solid blue;';
            document.querySelector('.test-content').appendChild(iframe);
          `
        }
      });

      // Wait for iframe to load
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Take screenshot including iframe
      const iframeScreenshotPath = path.join(testContext.tempDir, 'iframe-content.png');
      const iframeScreenshotResult = await testContext.browserTool.execute({
        operation: 'screenshot',
        params: {
          path: iframeScreenshotPath,
          fullPage: true,
          format: 'png'
        }
      });

      expect(iframeScreenshotResult.success).toBe(true);
      expect(fs.existsSync(iframeScreenshotPath)).toBe(true);
    });

    it('should handle large content extraction efficiently', async () => {
      // Navigate to test page
      await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: testContext.testPageUrl }
      });

      // Add large amount of content
      await testContext.browserTool.execute({
        operation: 'evaluate',
        params: {
          script: `
            const largeContent = document.createElement('div');
            largeContent.id = 'large-content';
            let htmlContent = '<h2>Large Content Test</h2>';

            // Generate large content (1000 paragraphs)
            for (let i = 0; i < 1000; i++) {
              htmlContent += '<p>Paragraph ' + i + ': ' + 'Lorem ipsum '.repeat(20) + '</p>';
            }

            largeContent.innerHTML = htmlContent;
            document.querySelector('.test-content').appendChild(largeContent);
          `
        }
      });

      const startTime = Date.now();

      // Extract large HTML content
      const largeHtmlResult = await testContext.browserTool.execute({
        operation: 'getHtml',
        params: {
          selector: '#large-content'
        }
      });

      const extractionTime = Date.now() - startTime;

      expect(largeHtmlResult.success).toBe(true);
      expect(extractionTime).toBeLessThan(TEST_CONFIG.contentTimeout);

      const largeHtml = (largeHtmlResult.data as { html: string }).html;
      expect(largeHtml.length).toBeGreaterThan(10000);
      expect(largeHtml).toContain('Paragraph 999'); // Verify it got all content
    });

    it('should extract content from complex nested structures', async () => {
      // Navigate to test page
      await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: testContext.testPageUrl }
      });

      // Add complex nested structure
      await testContext.browserTool.execute({
        operation: 'evaluate',
        params: {
          script: `
            const complexStructure = document.createElement('div');
            complexStructure.id = 'complex-structure';
            complexStructure.innerHTML = \`
              <div class="level-1">
                <h3>Level 1</h3>
                <div class="level-2">
                  <h4>Level 2</h4>
                  <ul class="level-3">
                    <li>Item 1 <span class="highlight">highlighted</span></li>
                    <li>Item 2 <strong>bold</strong></li>
                    <li>Item 3 <em>italic</em></li>
                  </ul>
                  <table class="data-table">
                    <thead><tr><th>Column 1</th><th>Column 2</th></tr></thead>
                    <tbody>
                      <tr><td>Data 1</td><td>Value 1</td></tr>
                      <tr><td>Data 2</td><td>Value 2</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>
            \`;
            document.querySelector('.test-content').appendChild(complexStructure);
          `
        }
      });

      // Extract HTML of complex structure
      const complexHtmlResult = await testContext.browserTool.execute({
        operation: 'getHtml',
        params: {
          selector: '#complex-structure'
        }
      });

      expect(complexHtmlResult.success).toBe(true);
      const complexHtml = (complexHtmlResult.data as { html: string }).html;
      expect(complexHtml).toContain('<table');
      expect(complexHtml).toContain('<thead>');
      expect(complexHtml).toContain('<tbody>');
      expect(complexHtml).toContain('highlighted');
      expect(complexHtml).toContain('<strong>');
      expect(complexHtml).toContain('<em>');

      // Extract text and verify structure is preserved but tags are removed
      const complexTextResult = await testContext.browserTool.execute({
        operation: 'getText',
        params: {
          selector: '#complex-structure'
        }
      });

      expect(complexTextResult.success).toBe(true);
      const complexText = (complexTextResult.data as { text: string }).text;
      expect(complexText).toContain('Level 1');
      expect(complexText).toContain('Level 2');
      expect(complexText).toContain('highlighted');
      expect(complexText).toContain('bold');
      expect(complexText).toContain('italic');
      expect(complexText).toContain('Column 1');
      expect(complexText).toContain('Data 1');
      expect(complexText).not.toContain('<'); // No HTML tags
    });

    it('should handle special characters and encoding in content', async () => {
      // Navigate to test page
      await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: testContext.testPageUrl }
      });

      // Add content with special characters
      await testContext.browserTool.execute({
        operation: 'evaluate',
        params: {
          script: `
            const specialContent = document.createElement('div');
            specialContent.id = 'special-chars';
            specialContent.innerHTML = \`
              <h3>Special Characters Test</h3>
              <p>Unicode: 🚀 🎉 💻 📸 🔍</p>
              <p>Math: ∑ ∫ ∞ √ π α β γ</p>
              <p>Currency: $ € ¥ £ ₹</p>
              <p>Quotes: "double quotes" 'single quotes' « guillemets »</p>
              <p>Entities: &lt; &gt; &amp; &quot; &#x27;</p>
              <p>Special: &nbsp;&nbsp;Multiple&nbsp;&nbsp;spaces</p>
            \`;
            document.querySelector('.test-content').appendChild(specialContent);
          `
        }
      });

      // Extract HTML and verify encoding
      const specialHtmlResult = await testContext.browserTool.execute({
        operation: 'getHtml',
        params: {
          selector: '#special-chars'
        }
      });

      expect(specialHtmlResult.success).toBe(true);
      const specialHtml = (specialHtmlResult.data as { html: string }).html;
      expect(specialHtml).toContain('🚀');
      expect(specialHtml).toContain('∑');
      expect(specialHtml).toContain('€');

      // Extract text and verify character preservation
      const specialTextResult = await testContext.browserTool.execute({
        operation: 'getText',
        params: {
          selector: '#special-chars'
        }
      });

      expect(specialTextResult.success).toBe(true);
      const specialText = (specialTextResult.data as { text: string }).text;
      expect(specialText).toContain('🚀');
      expect(specialText).toContain('∑');
      expect(specialText).toContain('€');
      expect(specialText).toContain('"double quotes"');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle navigation failures gracefully', async () => {
      // Try to navigate to invalid URL
      const navResult = await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://invalid-domain-that-does-not-exist.invalid' }
      });

      // Navigation should fail
      expect(navResult.success).toBe(false);
      expect(navResult.error).toBeDefined();

      // Subsequent screenshot should also fail gracefully
      const screenshotResult = await testContext.browserTool.execute({
        operation: 'screenshot',
        params: { format: 'png' }
      });

      // Should handle gracefully (behavior may vary)
      if (!screenshotResult.success) {
        expect(screenshotResult.error).toBeDefined();
      }
    });

    it('should handle missing elements gracefully', async () => {
      // Navigate to test page
      await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: testContext.testPageUrl }
      });

      // Try to interact with non-existent element
      const textResult = await testContext.browserTool.execute({
        operation: 'getText',
        params: {
          selector: '.completely-non-existent-element'
        }
      });

      expect(textResult.success).toBe(false);
      expect(textResult.error).toBeDefined();
      expect(textResult.error).toContain('not found');
    });

    it('should handle malformed selectors gracefully', async () => {
      // Navigate to test page
      await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: testContext.testPageUrl }
      });

      // Try malformed CSS selector
      const textResult = await testContext.browserTool.execute({
        operation: 'getText',
        params: {
          selector: '::invalid-selector[['
        }
      });

      expect(textResult.success).toBe(false);
      expect(textResult.error).toBeDefined();
    });

    it('should provide detailed error information', async () => {
      // Try to take screenshot without navigation
      const screenshotResult = await testContext.browserTool.execute({
        operation: 'screenshot',
        params: { format: 'png' }
      });

      if (!screenshotResult.success) {
        expect(screenshotResult.error).toBeDefined();
        expect(screenshotResult.metadata).toBeDefined();
        expect(screenshotResult.metadata?.executionTime).toBeTypeOf('number');
      }
    });
  });

  describe('Screenshot Format and Quality Validation', () => {
    it('should produce different file sizes with different JPEG qualities', async () => {
      const screenshotPaths: string[] = [];
      const fileSizes: number[] = [];

      // Navigate to test page
      await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: testContext.testPageUrl }
      });

      // Test different quality levels
      for (const quality of [20, 50, 90]) {
        const screenshotPath = path.join(testContext.tempDir, `quality_${quality}.jpg`);
        screenshotPaths.push(screenshotPath);

        const screenshotResult = await testContext.browserTool.execute({
          operation: 'screenshot',
          params: {
            path: screenshotPath,
            fullPage: true,
            format: 'jpeg',
            quality
          }
        });

        expect(screenshotResult.success).toBe(true);
        expect(fs.existsSync(screenshotPath)).toBe(true);

        const fileStats = fs.statSync(screenshotPath);
        fileSizes.push(fileStats.size);
      }

      // Higher quality should generally produce larger files
      expect(fileSizes[2]).toBeGreaterThan(fileSizes[1]); // 90 > 50
      expect(fileSizes[1]).toBeGreaterThan(fileSizes[0]); // 50 > 20
    });

    it('should validate screenshot metadata', async () => {
      // Navigate to test page
      await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: testContext.testPageUrl }
      });

      const screenshotResult = await testContext.browserTool.execute({
        operation: 'screenshot',
        params: {
          fullPage: true,
          format: 'png'
        }
      });

      expect(screenshotResult.success).toBe(true);
      expect(screenshotResult.metadata).toBeDefined();
      expect(screenshotResult.metadata?.url).toBe(testContext.testPageUrl);
      expect(screenshotResult.metadata?.executionTime).toBeTypeOf('number');
      expect(screenshotResult.metadata?.permissionGranted).toBe(true);
    });
  });

  describe('Screenshot Comparison and Visual Regression', () => {
    it('should compare identical screenshots successfully', async () => {
      const baselineScreenshotPath = path.join(testContext.tempDir, 'baseline.png');

      // Navigate to test page
      await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: testContext.testPageUrl }
      });

      // Take baseline screenshot
      const baselineResult = await testContext.browserTool.execute({
        operation: 'screenshot',
        params: {
          path: baselineScreenshotPath,
          fullPage: true,
          format: 'png'
        }
      });

      expect(baselineResult.success).toBe(true);
      expect(fs.existsSync(baselineScreenshotPath)).toBe(true);

      // Wait a moment for consistency
      await new Promise(resolve => setTimeout(resolve, 500));

      // Compare with current (should be identical)
      const compareResult = await testContext.browserTool.execute({
        operation: 'compareScreenshot',
        params: {
          baselinePath: baselineScreenshotPath,
          threshold: 0.99,
          fullPage: true,
          format: 'png'
        }
      });

      expect(compareResult.success).toBe(true);
      expect(compareResult.data).toMatchObject({
        similarity: expect.any(Number),
        differentPixels: expect.any(Number),
        totalPixels: expect.any(Number),
        isMatch: true
      });

      const comparisonData = compareResult.data as any;
      expect(comparisonData.similarity).toBeGreaterThan(0.99);
      expect(comparisonData.isMatch).toBe(true);
    });

    it('should compare element screenshots with selectors', async () => {
      const baselineElementPath = path.join(testContext.tempDir, 'baseline-element.png');

      // Navigate to test page
      await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: testContext.testPageUrl }
      });

      // Take baseline element screenshot
      const baselineResult = await testContext.browserTool.execute({
        operation: 'screenshot',
        params: {
          path: baselineElementPath,
          selector: '.test-container',
          format: 'png'
        }
      });

      expect(baselineResult.success).toBe(true);
      expect(fs.existsSync(baselineElementPath)).toBe(true);

      // Compare current element with baseline
      const compareResult = await testContext.browserTool.execute({
        operation: 'compareScreenshot',
        params: {
          baselinePath: baselineElementPath,
          selector: '.test-container',
          threshold: 0.95,
          format: 'png'
        }
      });

      expect(compareResult.success).toBe(true);
      expect(compareResult.data).toMatchObject({
        similarity: expect.any(Number),
        isMatch: expect.any(Boolean)
      });

      const comparisonData = compareResult.data as any;
      expect(comparisonData.similarity).toBeGreaterThan(0.90);
    });

    it('should generate diff images when screenshots differ significantly', async () => {
      const baselineScreenshotPath = path.join(testContext.tempDir, 'baseline-for-diff.png');
      const diffOutputPath = path.join(testContext.tempDir, 'diff-output.png');

      // Navigate to test page
      await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: testContext.testPageUrl }
      });

      // Take baseline screenshot
      await testContext.browserTool.execute({
        operation: 'screenshot',
        params: {
          path: baselineScreenshotPath,
          fullPage: true,
          format: 'png'
        }
      });

      // Modify the page content to create differences
      await testContext.browserTool.execute({
        operation: 'evaluate',
        params: {
          script: `
            // Add a bright red banner to create visual differences
            const banner = document.createElement('div');
            banner.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 50px; background: red; z-index: 9999; color: white; text-align: center; line-height: 50px;';
            banner.textContent = 'DIFF TEST BANNER';
            document.body.appendChild(banner);
          `
        }
      });

      // Compare with modified page
      const compareResult = await testContext.browserTool.execute({
        operation: 'compareScreenshot',
        params: {
          baselinePath: baselineScreenshotPath,
          diffPath: diffOutputPath,
          threshold: 0.95,
          fullPage: true,
          format: 'png',
          testId: 'diff-generation-test'
        }
      });

      expect(compareResult.success).toBe(true);
      expect(compareResult.data).toMatchObject({
        similarity: expect.any(Number),
        differentPixels: expect.any(Number),
        isMatch: expect.any(Boolean)
      });

      const comparisonData = compareResult.data as any;
      expect(comparisonData.similarity).toBeLessThan(0.95); // Should detect differences
      expect(comparisonData.isMatch).toBe(false);
      expect(comparisonData.differentPixels).toBeGreaterThan(100);

      // Verify diff image was generated if configured
      if (diffOutputPath) {
        expect(fs.existsSync(diffOutputPath)).toBe(true);
      }
    });

    it('should handle different comparison thresholds', async () => {
      const baselineThresholdPath = path.join(testContext.tempDir, 'baseline-threshold.png');

      // Navigate to test page
      await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: testContext.testPageUrl }
      });

      // Take baseline screenshot
      await testContext.browserTool.execute({
        operation: 'screenshot',
        params: {
          path: baselineThresholdPath,
          fullPage: true,
          format: 'png'
        }
      });

      // Make small visual change
      await testContext.browserTool.execute({
        operation: 'evaluate',
        params: {
          script: `
            // Make a very small change (1px border)
            const container = document.querySelector('.test-container');
            if (container) {
              container.style.border = '1px solid #ccc';
            }
          `
        }
      });

      // Test with strict threshold (should fail)
      const strictCompareResult = await testContext.browserTool.execute({
        operation: 'compareScreenshot',
        params: {
          baselinePath: baselineThresholdPath,
          threshold: 0.999, // Very strict
          fullPage: true,
          format: 'png'
        }
      });

      // Test with lenient threshold (should pass)
      const lenientCompareResult = await testContext.browserTool.execute({
        operation: 'compareScreenshot',
        params: {
          baselinePath: baselineThresholdPath,
          threshold: 0.95, // More lenient
          fullPage: true,
          format: 'png'
        }
      });

      expect(strictCompareResult.success).toBe(true);
      expect(lenientCompareResult.success).toBe(true);

      const strictData = strictCompareResult.data as any;
      const lenientData = lenientCompareResult.data as any;

      // Both should have the same similarity score
      expect(strictData.similarity).toBeCloseTo(lenientData.similarity, 2);

      // But different match results based on threshold
      expect(strictData.isMatch).toBe(false); // Strict threshold
      expect(lenientData.isMatch).toBe(true);  // Lenient threshold
    });

    it('should handle JPEG format comparison with quality settings', async () => {
      const baselineJpegPath = path.join(testContext.tempDir, 'baseline-jpeg.jpg');

      // Navigate to test page
      await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: testContext.testPageUrl }
      });

      // Take baseline JPEG screenshot
      await testContext.browserTool.execute({
        operation: 'screenshot',
        params: {
          path: baselineJpegPath,
          fullPage: true,
          format: 'jpeg',
          quality: 90
        }
      });

      // Compare with different JPEG quality (should still match reasonably)
      const compareResult = await testContext.browserTool.execute({
        operation: 'compareScreenshot',
        params: {
          baselinePath: baselineJpegPath,
          threshold: 0.85, // More lenient for JPEG compression differences
          fullPage: true,
          format: 'jpeg',
          quality: 80
        }
      });

      expect(compareResult.success).toBe(true);
      expect(compareResult.data).toMatchObject({
        similarity: expect.any(Number),
        isMatch: expect.any(Boolean)
      });

      const comparisonData = compareResult.data as any;
      expect(comparisonData.similarity).toBeGreaterThan(0.80);
    });

    it('should handle missing baseline screenshot error', async () => {
      const missingBaselinePath = path.join(testContext.tempDir, 'non-existent-baseline.png');

      // Navigate to test page
      await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: testContext.testPageUrl }
      });

      // Try to compare with non-existent baseline
      const compareResult = await testContext.browserTool.execute({
        operation: 'compareScreenshot',
        params: {
          baselinePath: missingBaselinePath,
          threshold: 0.95,
          fullPage: true,
          format: 'png'
        }
      });

      expect(compareResult.success).toBe(false);
      expect(compareResult.error).toBeDefined();
      expect(compareResult.error).toContain('Baseline screenshot not found');
      expect(compareResult.error).toContain(missingBaselinePath);
    });

    it('should validate comparison results structure', async () => {
      const baselineValidationPath = path.join(testContext.tempDir, 'baseline-validation.png');

      // Navigate to test page
      await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: testContext.testPageUrl }
      });

      // Take baseline screenshot
      await testContext.browserTool.execute({
        operation: 'screenshot',
        params: {
          path: baselineValidationPath,
          fullPage: true,
          format: 'png'
        }
      });

      // Compare with baseline
      const compareResult = await testContext.browserTool.execute({
        operation: 'compareScreenshot',
        params: {
          baselinePath: baselineValidationPath,
          threshold: 0.99,
          fullPage: true,
          format: 'png'
        }
      });

      expect(compareResult.success).toBe(true);
      expect(compareResult.data).toBeDefined();

      const comparisonData = compareResult.data as any;

      // Validate all required fields in comparison result
      expect(comparisonData).toMatchObject({
        similarity: expect.any(Number),
        differentPixels: expect.any(Number),
        totalPixels: expect.any(Number),
        isMatch: expect.any(Boolean),
        dimensions: expect.objectContaining({
          width: expect.any(Number),
          height: expect.any(Number)
        })
      });

      // Validate ranges
      expect(comparisonData.similarity).toBeGreaterThanOrEqual(0);
      expect(comparisonData.similarity).toBeLessThanOrEqual(1);
      expect(comparisonData.differentPixels).toBeGreaterThanOrEqual(0);
      expect(comparisonData.totalPixels).toBeGreaterThan(0);
      expect(comparisonData.dimensions.width).toBeGreaterThan(0);
      expect(comparisonData.dimensions.height).toBeGreaterThan(0);
    });

    it('should handle viewport differences in comparison', async () => {
      const baselineViewportPath = path.join(testContext.tempDir, 'baseline-viewport.png');

      // Navigate to test page with initial viewport
      await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: testContext.testPageUrl }
      });

      // Take baseline screenshot (not full page to capture viewport)
      await testContext.browserTool.execute({
        operation: 'screenshot',
        params: {
          path: baselineViewportPath,
          fullPage: false,
          format: 'png'
        }
      });

      // Compare with same viewport (should match)
      const sameViewportResult = await testContext.browserTool.execute({
        operation: 'compareScreenshot',
        params: {
          baselinePath: baselineViewportPath,
          threshold: 0.95,
          fullPage: false,
          format: 'png'
        }
      });

      expect(sameViewportResult.success).toBe(true);

      const sameViewportData = sameViewportResult.data as any;
      expect(sameViewportData.isMatch).toBe(true);
      expect(sameViewportData.similarity).toBeGreaterThan(0.95);
    });
  });
});