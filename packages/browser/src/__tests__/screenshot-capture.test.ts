/**
 * @apexcli/browser - Screenshot Capture Tests
 *
 * Tests for captureViewport(), captureFullPage(), and captureElement() methods
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BrowserManager } from '../browser-manager.js';
import { BrowserSession } from '../browser-session.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('Screenshot Capture API', () => {
  let manager: BrowserManager;
  let session: BrowserSession;
  let tempDir: string;

  beforeEach(async () => {
    manager = new BrowserManager();
    session = new BrowserSession(manager, { browserType: 'chromium', headless: true });
    await session.launch();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apex-screenshot-test-'));
  });

  afterEach(async () => {
    if (session) {
      await session.close();
    }
    if (manager) {
      await manager.shutdown();
    }
    // Clean up temp files
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('captureViewport()', () => {
    it('should capture viewport screenshot with default options', async () => {
      await session.navigate('data:text/html,<html><body style="background:blue;"><h1>Viewport Test</h1></body></html>');

      const result = await session.captureViewport();

      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Buffer);
      expect(result.data!.length).toBeGreaterThan(0);
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should capture viewport as PNG format', async () => {
      await session.navigate('data:text/html,<html><body><h1>PNG Test</h1></body></html>');

      const result = await session.captureViewport({ type: 'png' });

      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Buffer);
      // PNG files start with signature: 0x89 0x50 0x4E 0x47
      expect(result.data![0]).toBe(0x89);
      expect(result.data![1]).toBe(0x50);
      expect(result.data![2]).toBe(0x4e);
      expect(result.data![3]).toBe(0x47);
    });

    it('should capture viewport as JPEG format with quality', async () => {
      await session.navigate('data:text/html,<html><body><h1>JPEG Test</h1></body></html>');

      const result = await session.captureViewport({ type: 'jpeg', quality: 80 });

      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Buffer);
      // JPEG files start with signature: 0xFF 0xD8 0xFF
      expect(result.data![0]).toBe(0xff);
      expect(result.data![1]).toBe(0xd8);
      expect(result.data![2]).toBe(0xff);
    });

    it('should save viewport screenshot to file', async () => {
      await session.navigate('data:text/html,<html><body><h1>File Save Test</h1></body></html>');
      const filePath = path.join(tempDir, 'viewport.png');

      const result = await session.captureViewport({ path: filePath });

      expect(result.success).toBe(true);
      expect(fs.existsSync(filePath)).toBe(true);
      const savedFile = fs.readFileSync(filePath);
      expect(savedFile.length).toBeGreaterThan(0);
      expect(savedFile.equals(result.data!)).toBe(true);
    });

    it('should capture viewport with transparent background', async () => {
      await session.navigate('data:text/html,<html><body style="background:transparent;"><h1>Transparent</h1></body></html>');

      const result = await session.captureViewport({ omitBackground: true });

      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Buffer);
    });

    it('should return error when browser not launched', async () => {
      const newSession = new BrowserSession(manager, { browserType: 'chromium' });
      // Don't launch the session

      const result = await newSession.captureViewport();

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('captureFullPage()', () => {
    it('should capture full page screenshot', async () => {
      // Create a page with scrollable content
      const tallPageHtml = `
        <html>
          <body style="margin:0;">
            <div style="height:3000px;background:linear-gradient(to bottom, red, blue);">
              <h1>Full Page Test</h1>
              <p>This page is very tall</p>
            </div>
          </body>
        </html>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(tallPageHtml)}`);

      const result = await session.captureFullPage();

      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Buffer);
      expect(result.data!.length).toBeGreaterThan(0);
    });

    it('should capture full page larger than viewport', async () => {
      const tallPageHtml = `
        <html>
          <body style="margin:0;">
            <div style="height:5000px;background:green;">
              <h1>Very Tall Page</h1>
            </div>
          </body>
        </html>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(tallPageHtml)}`);

      const viewportResult = await session.captureViewport();
      const fullPageResult = await session.captureFullPage();

      expect(viewportResult.success).toBe(true);
      expect(fullPageResult.success).toBe(true);
      // Full page screenshot should be larger than viewport screenshot
      expect(fullPageResult.data!.length).toBeGreaterThan(viewportResult.data!.length);
    });

    it('should capture full page as JPEG with quality', async () => {
      await session.navigate('data:text/html,<html><body><h1>JPEG Full Page</h1></body></html>');

      const result = await session.captureFullPage({ type: 'jpeg', quality: 50 });

      expect(result.success).toBe(true);
      // JPEG signature
      expect(result.data![0]).toBe(0xff);
      expect(result.data![1]).toBe(0xd8);
    });

    it('should save full page screenshot to file', async () => {
      await session.navigate('data:text/html,<html><body><h1>Save Full Page</h1></body></html>');
      const filePath = path.join(tempDir, 'fullpage.png');

      const result = await session.captureFullPage({ path: filePath });

      expect(result.success).toBe(true);
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('should return error when browser not launched', async () => {
      const newSession = new BrowserSession(manager, { browserType: 'chromium' });

      const result = await newSession.captureFullPage();

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('captureElement()', () => {
    it('should capture screenshot of specific element by CSS selector', async () => {
      const html = `
        <html>
          <body style="background:white;">
            <div id="target" style="width:200px;height:100px;background:red;">
              Target Element
            </div>
          </body>
        </html>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      const result = await session.captureElement('#target');

      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Buffer);
      expect(result.data!.length).toBeGreaterThan(0);
    });

    it('should capture element with ElementSelector object', async () => {
      const html = `
        <html>
          <body>
            <button data-testid="my-button" style="width:100px;height:50px;background:blue;">Click Me</button>
          </body>
        </html>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      const result = await session.captureElement({
        type: 'testId',
        value: 'my-button',
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Buffer);
    });

    it('should capture element as JPEG with quality', async () => {
      const html = `
        <html>
          <body>
            <div class="box" style="width:100px;height:100px;background:green;">Box</div>
          </body>
        </html>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      const result = await session.captureElement('.box', { type: 'jpeg', quality: 75 });

      expect(result.success).toBe(true);
      // JPEG signature
      expect(result.data![0]).toBe(0xff);
      expect(result.data![1]).toBe(0xd8);
    });

    it('should save element screenshot to file', async () => {
      const html = `
        <html>
          <body>
            <span id="element" style="display:inline-block;padding:20px;background:yellow;">Save Me</span>
          </body>
        </html>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);
      const filePath = path.join(tempDir, 'element.png');

      const result = await session.captureElement('#element', { path: filePath });

      expect(result.success).toBe(true);
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('should return error for non-existent element', async () => {
      await session.navigate('data:text/html,<html><body><h1>No Target</h1></body></html>');

      const result = await session.captureElement('#non-existent', { timeout: 1000 });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should capture element with XPath selector', async () => {
      const html = `
        <html>
          <body>
            <div>
              <p>First paragraph</p>
              <p id="second" style="background:purple;padding:10px;">Second paragraph</p>
            </div>
          </body>
        </html>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      const result = await session.captureElement({
        type: 'xpath',
        value: '//p[@id="second"]',
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Buffer);
    });

    it('should capture element with text selector', async () => {
      const html = `
        <html>
          <body>
            <button style="padding:15px;background:orange;">Submit Form</button>
          </body>
        </html>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      const result = await session.captureElement({
        type: 'text',
        value: 'Submit Form',
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Buffer);
    });

    it('should return error when browser not launched', async () => {
      const newSession = new BrowserSession(manager, { browserType: 'chromium' });

      const result = await newSession.captureElement('#any');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should respect timeout option', async () => {
      await session.navigate('data:text/html,<html><body></body></html>');

      const startTime = Date.now();
      const result = await session.captureElement('#delayed-element', { timeout: 500 });
      const elapsed = Date.now() - startTime;

      expect(result.success).toBe(false);
      expect(elapsed).toBeGreaterThanOrEqual(400); // Should wait close to timeout
      expect(elapsed).toBeLessThan(2000); // But not too long
    });
  });

  describe('Screenshot Format and Quality', () => {
    beforeEach(async () => {
      await session.navigate('data:text/html,<html><body style="background:#333;"><h1 style="color:white;">Format Test</h1></body></html>');
    });

    it('should produce different file sizes for different JPEG qualities', async () => {
      const highQuality = await session.captureViewport({ type: 'jpeg', quality: 100 });
      const lowQuality = await session.captureViewport({ type: 'jpeg', quality: 10 });

      expect(highQuality.success).toBe(true);
      expect(lowQuality.success).toBe(true);
      expect(highQuality.data!.length).toBeGreaterThan(lowQuality.data!.length);
    });

    it('should default to PNG format', async () => {
      const result = await session.captureViewport();

      expect(result.success).toBe(true);
      // PNG signature
      expect(result.data![0]).toBe(0x89);
      expect(result.data![1]).toBe(0x50);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid file path gracefully', async () => {
      await session.navigate('data:text/html,<html><body><h1>Test</h1></body></html>');

      // Try to save to an invalid path (directory doesn't exist)
      const result = await session.captureViewport({ path: '/non/existent/path/screenshot.png' });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Buffer and File Output', () => {
    it('should return buffer even when saving to file', async () => {
      await session.navigate('data:text/html,<html><body><h1>Dual Output</h1></body></html>');
      const filePath = path.join(tempDir, 'dual.png');

      const result = await session.captureViewport({ path: filePath });

      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Buffer);
      expect(fs.existsSync(filePath)).toBe(true);

      // Buffer should match file contents
      const fileContents = fs.readFileSync(filePath);
      expect(result.data!.equals(fileContents)).toBe(true);
    });

    it('should save JPEG file with correct extension handling', async () => {
      await session.navigate('data:text/html,<html><body><h1>JPEG Save</h1></body></html>');
      const filePath = path.join(tempDir, 'image.jpg');

      const result = await session.captureViewport({ type: 'jpeg', quality: 80, path: filePath });

      expect(result.success).toBe(true);
      expect(fs.existsSync(filePath)).toBe(true);

      const fileContents = fs.readFileSync(filePath);
      // Verify JPEG signature in saved file
      expect(fileContents[0]).toBe(0xff);
      expect(fileContents[1]).toBe(0xd8);
    });
  });
});
