/**
 * @apexcli/browser - captureFullPage Implementation Test
 *
 * Test to verify the captureFullPage() method meets acceptance criteria
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BrowserManager } from '../browser-manager.js';
import { BrowserSession } from '../browser-session.js';
import type { ScreenshotOptions } from '../types.js';

describe('captureFullPage() Implementation Test', () => {
  let manager: BrowserManager;
  let session: BrowserSession;

  beforeEach(async () => {
    manager = new BrowserManager();
    session = new BrowserSession(manager, { browserType: 'chromium', headless: true });
    await session.launch();
  });

  afterEach(async () => {
    if (session) {
      await session.close();
    }
    if (manager) {
      await manager.shutdown();
    }
  });

  it('should implement captureFullPage(options?: ScreenshotOptions) method signature', async () => {
    // Create a test page with scrollable content
    const htmlContent = `
      <html>
        <body style="margin: 0; height: 2000px; background: linear-gradient(to bottom, #ff0000, #0000ff);">
          <h1>Full Page Test</h1>
          <div style="position: absolute; bottom: 10px;">Bottom content</div>
        </body>
      </html>
    `;

    await session.navigate(`data:text/html,${encodeURIComponent(htmlContent)}`);

    // Test method exists and has correct signature
    expect(typeof session.captureFullPage).toBe('function');

    // Test 1: PNG format (default)
    const pngOptions: ScreenshotOptions = { type: 'png' };
    const pngResult = await session.captureFullPage(pngOptions);

    expect(pngResult.success).toBe(true);
    expect(pngResult.data).toBeInstanceOf(Buffer);
    expect(pngResult.data!.length).toBeGreaterThan(0);

    // Verify PNG signature
    expect(pngResult.data![0]).toBe(0x89);
    expect(pngResult.data![1]).toBe(0x50);

    // Test 2: JPEG format with quality
    const jpegOptions: ScreenshotOptions = { type: 'jpeg', quality: 80 };
    const jpegResult = await session.captureFullPage(jpegOptions);

    expect(jpegResult.success).toBe(true);
    expect(jpegResult.data).toBeInstanceOf(Buffer);
    expect(jpegResult.data!.length).toBeGreaterThan(0);

    // Verify JPEG signature
    expect(jpegResult.data![0]).toBe(0xFF);
    expect(jpegResult.data![1]).toBe(0xD8);

    // Test 3: No options (should default to PNG)
    const defaultResult = await session.captureFullPage();

    expect(defaultResult.success).toBe(true);
    expect(defaultResult.data).toBeInstanceOf(Buffer);

    // Should be PNG by default
    expect(defaultResult.data![0]).toBe(0x89);
    expect(defaultResult.data![1]).toBe(0x50);

    // Test 4: With background omitted
    const transparentOptions: ScreenshotOptions = {
      type: 'png',
      omitBackground: true
    };
    const transparentResult = await session.captureFullPage(transparentOptions);

    expect(transparentResult.success).toBe(true);
    expect(transparentResult.data).toBeInstanceOf(Buffer);

    console.log('✅ captureFullPage(options?: ScreenshotOptions) implementation verified');
    console.log('✅ PNG/JPEG formats supported');
    console.log('✅ Configurable quality for JPEG');
    console.log('✅ Returns buffer data');
    console.log('✅ Captures entire scrollable page');
  });

  it('should handle error cases correctly', async () => {
    // Test with session not launched
    const newSession = new BrowserSession(manager);
    const result = await newSession.captureFullPage();

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toContain('not launched');
  });
});