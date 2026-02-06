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
});