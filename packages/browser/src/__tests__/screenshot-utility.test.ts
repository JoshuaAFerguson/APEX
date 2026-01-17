/**
 * @apexcli/browser - Screenshot Utility Tests
 *
 * Tests for the base screenshot capture utility functions
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

describe('Screenshot Utility Functions', () => {
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
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apex-screenshot-util-test-'));
  });

  afterEach(async () => {
    if (page) await page.close();
    if (context) await context.close();
    if (browser) await browser.close();

    // Clean up temp files
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('captureScreenshot()', () => {
    it('should capture screenshot from Page with default options', async () => {
      await page.goto('data:text/html,<html><body style="background:blue;"><h1>Test Page</h1></body></html>');

      const result = await captureScreenshot(page);

      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Buffer);
      expect(result.data!.length).toBeGreaterThan(0);
      expect(result.duration).toBeGreaterThan(0);
      expect(result.error).toBeUndefined();

      // PNG signature check
      expect(result.data![0]).toBe(0x89);
      expect(result.data![1]).toBe(0x50);
      expect(result.data![2]).toBe(0x4e);
      expect(result.data![3]).toBe(0x47);
    });

    it('should capture screenshot from BrowserContext (creating new page)', async () => {
      // Create a context without any pages
      const emptyContext = await browser.newContext();

      const result = await captureScreenshot(emptyContext);

      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Buffer);
      expect(result.data!.length).toBeGreaterThan(0);

      await emptyContext.close();
    });

    it('should capture screenshot from BrowserContext (using existing page)', async () => {
      await page.goto('data:text/html,<html><body style="background:green;"><h1>Context Test</h1></body></html>');

      const result = await captureScreenshot(context);

      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Buffer);
      expect(result.data!.length).toBeGreaterThan(0);
    });

    it('should capture PNG format screenshot', async () => {
      await page.goto('data:text/html,<html><body><h1>PNG Test</h1></body></html>');

      const result = await captureScreenshot(page, { format: 'png' });

      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Buffer);

      // PNG file signature: 0x89 0x50 0x4E 0x47
      expect(result.data![0]).toBe(0x89);
      expect(result.data![1]).toBe(0x50);
      expect(result.data![2]).toBe(0x4e);
      expect(result.data![3]).toBe(0x47);
    });

    it('should capture JPEG format screenshot with quality', async () => {
      await page.goto('data:text/html,<html><body><h1>JPEG Test</h1></body></html>');

      const result = await captureScreenshot(page, {
        format: 'jpeg',
        quality: 80
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Buffer);

      // JPEG file signature: 0xFF 0xD8 0xFF
      expect(result.data![0]).toBe(0xff);
      expect(result.data![1]).toBe(0xd8);
      expect(result.data![2]).toBe(0xff);
    });

    it('should capture full page screenshot', async () => {
      const tallPageHtml = `
        <html>
          <body style="margin:0;padding:0;">
            <div style="height:3000px;background:linear-gradient(to bottom, red, blue);">
              <h1>Full Page Test</h1>
              <div style="position:absolute;bottom:20px;">Bottom Content</div>
            </div>
          </body>
        </html>
      `;
      await page.goto(`data:text/html,${encodeURIComponent(tallPageHtml)}`);

      const viewportResult = await captureScreenshot(page, { fullPage: false });
      const fullPageResult = await captureScreenshot(page, { fullPage: true });

      expect(viewportResult.success).toBe(true);
      expect(fullPageResult.success).toBe(true);

      // Full page should be larger than viewport
      expect(fullPageResult.data!.length).toBeGreaterThan(viewportResult.data!.length);
    });

    it('should save screenshot to file', async () => {
      await page.goto('data:text/html,<html><body><h1>File Save Test</h1></body></html>');
      const filePath = path.join(tempDir, 'test-screenshot.png');

      const result = await captureScreenshot(page, { path: filePath });

      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Buffer);
      expect(fs.existsSync(filePath)).toBe(true);

      const savedFile = fs.readFileSync(filePath);
      expect(savedFile.length).toBeGreaterThan(0);
      expect(savedFile.equals(result.data!)).toBe(true);
    });

    it('should capture screenshot with transparent background', async () => {
      await page.goto('data:text/html,<html><body style="background:transparent;"><h1>Transparent</h1></body></html>');

      const result = await captureScreenshot(page, { omitBackground: true });

      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Buffer);
      expect(result.data!.length).toBeGreaterThan(0);
    });

    it('should validate quality parameter range', async () => {
      await page.goto('data:text/html,<html><body><h1>Quality Test</h1></body></html>');

      // Test invalid quality values
      const lowQualityResult = await captureScreenshot(page, {
        format: 'jpeg',
        quality: 0
      });
      expect(lowQualityResult.success).toBe(false);
      expect(lowQualityResult.error).toContain('Quality must be between 1 and 100');

      const highQualityResult = await captureScreenshot(page, {
        format: 'jpeg',
        quality: 101
      });
      expect(highQualityResult.success).toBe(false);
      expect(highQualityResult.error).toContain('Quality must be between 1 and 100');

      // Test valid quality values
      const validQualityResult = await captureScreenshot(page, {
        format: 'jpeg',
        quality: 50
      });
      expect(validQualityResult.success).toBe(true);
    });

    it('should produce different file sizes for different JPEG qualities', async () => {
      await page.goto('data:text/html,<html><body style="background:#333;"><h1 style="color:white;">Quality Test</h1></body></html>');

      const highQuality = await captureScreenshot(page, {
        format: 'jpeg',
        quality: 100
      });
      const lowQuality = await captureScreenshot(page, {
        format: 'jpeg',
        quality: 10
      });

      expect(highQuality.success).toBe(true);
      expect(lowQuality.success).toBe(true);
      expect(highQuality.data!.length).toBeGreaterThan(lowQuality.data!.length);
    });

    it('should handle errors gracefully', async () => {
      // Close the page to simulate an error condition
      await page.close();

      const result = await captureScreenshot(page);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.duration).toBeGreaterThan(0);
    });
  });

  describe('capturePNG()', () => {
    it('should capture PNG screenshot with convenience function', async () => {
      await page.goto('data:text/html,<html><body><h1>PNG Convenience Test</h1></body></html>');

      const result = await capturePNG(page, { fullPage: true });

      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Buffer);

      // PNG signature
      expect(result.data![0]).toBe(0x89);
      expect(result.data![1]).toBe(0x50);
    });

    it('should save PNG to file', async () => {
      await page.goto('data:text/html,<html><body><h1>PNG File Save</h1></body></html>');
      const filePath = path.join(tempDir, 'convenience.png');

      const result = await capturePNG(page, { path: filePath });

      expect(result.success).toBe(true);
      expect(fs.existsSync(filePath)).toBe(true);
    });
  });

  describe('captureJPEG()', () => {
    it('should capture JPEG screenshot with default quality', async () => {
      await page.goto('data:text/html,<html><body><h1>JPEG Convenience Test</h1></body></html>');

      const result = await captureJPEG(page);

      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Buffer);

      // JPEG signature
      expect(result.data![0]).toBe(0xff);
      expect(result.data![1]).toBe(0xd8);
    });

    it('should capture JPEG screenshot with custom quality', async () => {
      await page.goto('data:text/html,<html><body><h1>JPEG Quality Test</h1></body></html>');

      const highQuality = await captureJPEG(page, 100);
      const lowQuality = await captureJPEG(page, 10);

      expect(highQuality.success).toBe(true);
      expect(lowQuality.success).toBe(true);
      expect(highQuality.data!.length).toBeGreaterThan(lowQuality.data!.length);
    });

    it('should save JPEG to file', async () => {
      await page.goto('data:text/html,<html><body><h1>JPEG File Save</h1></body></html>');
      const filePath = path.join(tempDir, 'convenience.jpg');

      const result = await captureJPEG(page, 75, { path: filePath });

      expect(result.success).toBe(true);
      expect(fs.existsSync(filePath)).toBe(true);
    });
  });

  describe('captureFullPageScreenshot()', () => {
    it('should capture full scrollable page', async () => {
      const tallPageHtml = `
        <html>
          <body style="margin:0;">
            <div style="height:4000px;background:linear-gradient(to bottom, green, purple);">
              <h1>Full Page Convenience Test</h1>
              <div style="position:absolute;bottom:0;">Bottom of page</div>
            </div>
          </body>
        </html>
      `;
      await page.goto(`data:text/html,${encodeURIComponent(tallPageHtml)}`);

      const viewportResult = await captureViewportScreenshot(page);
      const fullPageResult = await captureFullPageScreenshot(page);

      expect(viewportResult.success).toBe(true);
      expect(fullPageResult.success).toBe(true);
      expect(fullPageResult.data!.length).toBeGreaterThan(viewportResult.data!.length);
    });

    it('should capture full page as JPEG', async () => {
      await page.goto('data:text/html,<html><body style="height:2000px;"><h1>Full Page JPEG</h1></body></html>');

      const result = await captureFullPageScreenshot(page, {
        format: 'jpeg',
        quality: 90
      });

      expect(result.success).toBe(true);
      // JPEG signature
      expect(result.data![0]).toBe(0xff);
      expect(result.data![1]).toBe(0xd8);
    });
  });

  describe('captureViewportScreenshot()', () => {
    it('should capture only viewport area', async () => {
      const tallPageHtml = `
        <html>
          <body style="margin:0;">
            <div style="height:3000px;background:orange;">
              <h1>Viewport Only Test</h1>
            </div>
          </body>
        </html>
      `;
      await page.goto(`data:text/html,${encodeURIComponent(tallPageHtml)}`);

      const result = await captureViewportScreenshot(page);

      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Buffer);
      expect(result.data!.length).toBeGreaterThan(0);
    });

    it('should capture viewport with transparent background', async () => {
      await page.goto('data:text/html,<html><body style="background:transparent;"><h1>Viewport Transparent</h1></body></html>');

      const result = await captureViewportScreenshot(page, { omitBackground: true });

      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Buffer);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid file path gracefully', async () => {
      await page.goto('data:text/html,<html><body><h1>Error Test</h1></body></html>');

      const result = await captureScreenshot(page, {
        path: '/non/existent/directory/screenshot.png'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle quality validation for PNG (quality ignored)', async () => {
      await page.goto('data:text/html,<html><body><h1>PNG Quality Test</h1></body></html>');

      // Quality should be ignored for PNG format
      const result = await captureScreenshot(page, {
        format: 'png',
        quality: 50
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Buffer);
    });

    it('should handle BrowserContext with no pages gracefully', async () => {
      const emptyContext = await browser.newContext();

      const result = await captureScreenshot(emptyContext);

      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Buffer);

      await emptyContext.close();
    });
  });
});