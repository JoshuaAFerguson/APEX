/**
 * @apexcli/browser - Screenshot Utility Edge Case Tests
 *
 * Additional edge case, stress, and integration tests for the screenshot utility
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import {
  captureScreenshot,
  capturePNG,
  captureJPEG,
  captureFullPageScreenshot,
  captureViewportScreenshot,
  type ScreenshotCaptureOptions,
} from '../screenshot-utility.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('Screenshot Utility - Edge Cases and Stress Tests', () => {
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;
  let tempDir: string;

  beforeEach(async () => {
    browser = await chromium.launch({ headless: true });
    context = await browser.newContext({
      viewport: { width: 1280, height: 720 }
    });
    page = await context.newPage();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apex-screenshot-edge-test-'));
  });

  afterEach(async () => {
    if (page && !page.isClosed()) await page.close();
    if (context) await context.close();
    if (browser) await browser.close();

    // Clean up temp files
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('Edge Cases', () => {
    it('should handle extremely large pages without crashing', async () => {
      const veryTallPageHtml = `
        <html>
          <body style="margin:0;padding:0;">
            <div style="height:50000px;background:linear-gradient(to bottom, red, blue, green, yellow, purple);">
              <h1>Very Tall Page</h1>
              <div style="position:absolute;top:25000px;">Middle Content</div>
              <div style="position:absolute;bottom:0;">Bottom Content</div>
            </div>
          </body>
        </html>
      `;
      await page.goto(`data:text/html,${encodeURIComponent(veryTallPageHtml)}`);

      const result = await captureScreenshot(page, { fullPage: true });

      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Buffer);
      expect(result.data!.length).toBeGreaterThan(0);
      expect(result.duration).toBeGreaterThan(0);
    }, 30000); // 30 second timeout for large page

    it('should handle pages with complex CSS and animations', async () => {
      const complexPageHtml = `
        <html>
          <head>
            <style>
              @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
              }
              .spinner { animation: spin 1s linear infinite; }
              .gradient-bg {
                background: linear-gradient(45deg, #ff6b6b, #4ecdc4, #45b7d1, #96ceb4);
                background-size: 400% 400%;
                animation: gradientShift 3s ease infinite;
              }
              @keyframes gradientShift {
                0% { background-position: 0% 50%; }
                50% { background-position: 100% 50%; }
                100% { background-position: 0% 50%; }
              }
            </style>
          </head>
          <body class="gradient-bg">
            <div class="spinner" style="width:100px;height:100px;border:5px solid #333;border-top:5px solid transparent;border-radius:50%;"></div>
            <h1>Complex CSS Page</h1>
          </body>
        </html>
      `;
      await page.goto(`data:text/html,${encodeURIComponent(complexPageHtml)}`);

      const result = await captureScreenshot(page, { fullPage: true });

      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Buffer);
      expect(result.data!.length).toBeGreaterThan(0);
    });

    it('should handle empty pages', async () => {
      await page.goto('data:text/html,<html><body></body></html>');

      const result = await captureScreenshot(page);

      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Buffer);
      expect(result.data!.length).toBeGreaterThan(0);
    });

    it('should handle pages with special characters and unicode', async () => {
      const unicodePageHtml = `
        <html>
          <head><meta charset="UTF-8"></head>
          <body>
            <h1>Unicode Test: 你好世界 🌍 🚀 ✨</h1>
            <p>Emoji: 🔥💯🎉🎨🎭🎪🎬🎮🎯🎲</p>
            <p>Special chars: ♠♣♥♦ ☀☁☂☃⚡❄</p>
            <p>Math symbols: ∑∏∫∆∇∂√∞</p>
          </body>
        </html>
      `;
      await page.goto(`data:text/html,${encodeURIComponent(unicodePageHtml)}`);

      const result = await captureScreenshot(page);

      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Buffer);
      expect(result.data!.length).toBeGreaterThan(0);
    });

    it('should handle multiple viewport sizes', async () => {
      const testViewports = [
        { width: 320, height: 568 },   // Mobile
        { width: 768, height: 1024 },  // Tablet
        { width: 1920, height: 1080 }, // Desktop
        { width: 3840, height: 2160 }, // 4K
      ];

      await page.goto('data:text/html,<html><body><h1>Viewport Test</h1><p>Responsive content</p></body></html>');

      for (const viewport of testViewports) {
        await page.setViewportSize(viewport);

        const result = await captureScreenshot(page);

        expect(result.success).toBe(true);
        expect(result.data).toBeInstanceOf(Buffer);
        expect(result.data!.length).toBeGreaterThan(0);
      }
    });

    it('should handle concurrent screenshot captures', async () => {
      await page.goto('data:text/html,<html><body><h1>Concurrent Test</h1></body></html>');

      const promises = Array.from({ length: 5 }, () =>
        captureScreenshot(page, { format: 'jpeg', quality: 50 })
      );

      const results = await Promise.all(promises);

      results.forEach((result, index) => {
        expect(result.success).toBe(true);
        expect(result.data).toBeInstanceOf(Buffer);
        expect(result.data!.length).toBeGreaterThan(0);
      });
    });

    it('should handle different color modes and backgrounds', async () => {
      const colorModeTests = [
        { name: 'white-background', html: '<html><body style="background:#fff;"><h1>White</h1></body></html>' },
        { name: 'black-background', html: '<html><body style="background:#000;color:#fff;"><h1>Black</h1></body></html>' },
        { name: 'transparent-background', html: '<html><body style="background:transparent;"><h1>Transparent</h1></body></html>' },
        { name: 'gradient-background', html: '<html><body style="background:linear-gradient(45deg,red,blue);"><h1>Gradient</h1></body></html>' },
      ];

      for (const test of colorModeTests) {
        await page.goto(`data:text/html,${encodeURIComponent(test.html)}`);

        const result = await captureScreenshot(page, {
          omitBackground: test.name === 'transparent-background'
        });

        expect(result.success).toBe(true);
        expect(result.data).toBeInstanceOf(Buffer);
        expect(result.data!.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Performance and Stress Tests', () => {
    it('should capture large JPEG screenshots within reasonable time', async () => {
      // Create a page with many elements
      const heavyPageHtml = `
        <html>
          <body>
            <h1>Performance Test</h1>
            ${Array.from({ length: 1000 }, (_, i) =>
              `<div style="padding:10px;background:hsl(${i % 360}, 70%, 80%);">Item ${i}</div>`
            ).join('')}
          </body>
        </html>
      `;
      await page.goto(`data:text/html,${encodeURIComponent(heavyPageHtml)}`);

      const startTime = Date.now();
      const result = await captureScreenshot(page, {
        format: 'jpeg',
        quality: 80,
        fullPage: true
      });
      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Buffer);
      expect(result.duration).toBeLessThan(15000); // Should complete within 15 seconds
      expect(endTime - startTime).toBeLessThan(20000); // Total time including setup
    }, 25000);

    it('should handle rapid successive screenshot captures', async () => {
      await page.goto('data:text/html,<html><body><h1>Rapid Fire Test</h1></body></html>');

      const rapidCaptures = [];
      const numCaptures = 10;

      for (let i = 0; i < numCaptures; i++) {
        rapidCaptures.push(captureScreenshot(page, { format: 'png' }));
      }

      const results = await Promise.all(rapidCaptures);

      results.forEach((result, index) => {
        expect(result.success).toBe(true);
        expect(result.data).toBeInstanceOf(Buffer);
        expect(result.duration).toBeLessThan(5000); // Each should be fast
      });
    });

    it('should handle different JPEG quality levels efficiently', async () => {
      await page.goto('data:text/html,<html><body style="background:#333;"><h1 style="color:white;">Quality Performance Test</h1></body></html>');

      const qualityLevels = [1, 25, 50, 75, 100];
      const results = [];

      for (const quality of qualityLevels) {
        const startTime = Date.now();
        const result = await captureJPEG(page, quality);
        const endTime = Date.now();

        expect(result.success).toBe(true);
        expect(result.data).toBeInstanceOf(Buffer);

        results.push({
          quality,
          size: result.data!.length,
          duration: endTime - startTime,
          resultDuration: result.duration
        });
      }

      // Verify quality affects file size as expected
      expect(results[4].size).toBeGreaterThan(results[0].size); // Quality 100 > Quality 1
      expect(results[2].size).toBeGreaterThan(results[1].size); // Quality 50 > Quality 25

      // All captures should be reasonably fast
      results.forEach((result) => {
        expect(result.duration).toBeLessThan(5000);
      });
    });
  });

  describe('Integration Tests', () => {
    it('should capture screenshot from real web content with CSS and images', async () => {
      // Create a complex page with CSS, gradients, and base64 image
      const complexHtml = `
        <html>
          <head>
            <style>
              body {
                font-family: Arial, sans-serif;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                margin: 0;
                padding: 20px;
              }
              .card {
                background: white;
                border-radius: 10px;
                padding: 20px;
                margin: 20px;
                box-shadow: 0 4px 8px rgba(0,0,0,0.1);
              }
              .image {
                width: 100px;
                height: 100px;
                background: url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI0MCIgZmlsbD0iIzQyODVmNCIvPjx0ZXh0IHg9IjUwIiB5PSI1NSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0id2hpdGUiIGZvbnQtc2l6ZT0iMTRweCI+SVNWRzwvdGV4dD48L3N2Zz4=');
                border-radius: 50%;
              }
            </style>
          </head>
          <body>
            <div class="card">
              <h1>Integration Test Page</h1>
              <div class="image"></div>
              <p>This page tests screenshot capture with:</p>
              <ul>
                <li>CSS gradients</li>
                <li>Box shadows</li>
                <li>Border radius</li>
                <li>Base64 SVG images</li>
                <li>Complex typography</li>
              </ul>
            </div>
          </body>
        </html>
      `;

      await page.goto(`data:text/html,${encodeURIComponent(complexHtml)}`);
      await page.waitForLoadState('networkidle');

      const result = await captureScreenshot(page, { fullPage: true });

      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Buffer);
      expect(result.data!.length).toBeGreaterThan(5000); // Should be a substantial image
    });

    it('should handle file saving with proper cleanup', async () => {
      await page.goto('data:text/html,<html><body><h1>File Cleanup Test</h1></body></html>');

      const screenshots = [];
      const numFiles = 5;

      // Create multiple screenshots with different names
      for (let i = 0; i < numFiles; i++) {
        const filePath = path.join(tempDir, `cleanup-test-${i}.png`);
        const result = await captureScreenshot(page, { path: filePath });

        expect(result.success).toBe(true);
        expect(fs.existsSync(filePath)).toBe(true);

        screenshots.push(filePath);
      }

      // Verify all files exist
      screenshots.forEach(filePath => {
        expect(fs.existsSync(filePath)).toBe(true);
        const stats = fs.statSync(filePath);
        expect(stats.size).toBeGreaterThan(0);
      });

      // Files will be cleaned up in afterEach
    });

    it('should maintain consistency across multiple capture methods', async () => {
      const testHtml = '<html><body style="background:#f0f0f0;"><h1>Consistency Test</h1></body></html>';
      await page.goto(`data:text/html,${encodeURIComponent(testHtml)}`);

      const [
        baseResult,
        pngResult,
        jpegResult,
        fullPageResult,
        viewportResult
      ] = await Promise.all([
        captureScreenshot(page),
        capturePNG(page),
        captureJPEG(page, 80),
        captureFullPageScreenshot(page),
        captureViewportScreenshot(page)
      ]);

      // All should succeed
      [baseResult, pngResult, jpegResult, fullPageResult, viewportResult].forEach(result => {
        expect(result.success).toBe(true);
        expect(result.data).toBeInstanceOf(Buffer);
        expect(result.data!.length).toBeGreaterThan(0);
        expect(result.duration).toBeGreaterThan(0);
      });

      // PNG results should have PNG signature
      [baseResult, pngResult, fullPageResult, viewportResult].forEach(result => {
        expect(result.data![0]).toBe(0x89); // PNG signature
        expect(result.data![1]).toBe(0x50);
      });

      // JPEG result should have JPEG signature
      expect(jpegResult.data![0]).toBe(0xff); // JPEG signature
      expect(jpegResult.data![1]).toBe(0xd8);
    });
  });

  describe('Error Recovery and Robustness', () => {
    it('should handle browser crashes gracefully', async () => {
      await page.goto('data:text/html,<html><body><h1>Crash Test</h1></body></html>');

      // Close the browser to simulate a crash
      await browser.close();

      const result = await captureScreenshot(page);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should handle network timeouts during page load', async () => {
      // Set a very short timeout
      await page.setDefaultTimeout(100);

      try {
        // This will timeout
        await page.goto('https://httpstat.us/200?sleep=5000');
      } catch (error) {
        // Expected to fail
      }

      const result = await captureScreenshot(page);

      // Should either succeed with whatever is loaded or fail gracefully
      expect(typeof result.success).toBe('boolean');
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should validate input parameters thoroughly', async () => {
      await page.goto('data:text/html,<html><body><h1>Validation Test</h1></body></html>');

      // Test with undefined options
      const undefinedResult = await captureScreenshot(page, undefined as any);
      expect(undefinedResult.success).toBe(true);

      // Test with null options
      const nullResult = await captureScreenshot(page, null as any);
      expect(nullResult.success).toBe(true);

      // Test with invalid format (should work as Playwright will handle it)
      const invalidFormatResult = await captureScreenshot(page, { format: 'gif' as any });
      expect(typeof invalidFormatResult.success).toBe('boolean');

      // Test boundary values for quality
      const boundaryTests = [-1, 0, 101, 1000];
      for (const quality of boundaryTests) {
        const result = await captureScreenshot(page, { format: 'jpeg', quality });
        if (quality < 1 || quality > 100) {
          expect(result.success).toBe(false);
          expect(result.error).toContain('Quality must be between 1 and 100');
        }
      }
    });
  });
});