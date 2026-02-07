/**
 * @fileoverview Full Page Screenshot Capture Integration Tests
 *
 * Comprehensive integration tests for the captureFullPage() method in APEX browser automation.
 * These tests verify full page screenshot capture with entire page content, output formats,
 * viewport sizing effects, scroll handling, and image dimension validation.
 *
 * Acceptance Criteria Covered:
 * - AC1: Full page screenshot tests exist and pass
 * - AC2: Tests verify image output format (PNG/JPEG)
 * - AC3: Tests verify viewport sizing effects
 * - AC4: Tests verify scroll handling for long pages
 * - AC5: Tests verify output image dimensions
 *
 * @see ADR-060-full-page-screenshot-integration-tests.md
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import {
  createBrowserManager,
  createBrowserSession,
  BrowserManager,
  BrowserSession,
} from '@apexcli/browser';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// ============================================================================
// Image Validation Utilities
// ============================================================================

interface ImageValidation {
  isValid: boolean;
  format: 'png' | 'jpeg' | 'unknown';
  size: number;
  dimensions?: { width: number; height: number };
}

/**
 * Validates image buffer and extracts metadata including format and dimensions
 */
function validateImageBuffer(buffer: Buffer): ImageValidation {
  if (buffer.length === 0) {
    return { isValid: false, format: 'unknown', size: 0 };
  }

  // PNG signature: 0x89 0x50 0x4E 0x47 ('PNG')
  if (buffer.length >= 24 &&
      buffer[0] === 0x89 && buffer[1] === 0x50 &&
      buffer[2] === 0x4E && buffer[3] === 0x47) {
    const dimensions = extractPngDimensions(buffer);
    return { isValid: true, format: 'png', size: buffer.length, dimensions };
  }

  // JPEG signature: 0xFF 0xD8 0xFF
  if (buffer.length >= 3 &&
      buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    const dimensions = extractJpegDimensions(buffer);
    return { isValid: true, format: 'jpeg', size: buffer.length, dimensions };
  }

  return { isValid: false, format: 'unknown', size: buffer.length };
}

/**
 * Extracts dimensions from PNG IHDR chunk
 * IHDR chunk contains width at offset 16 and height at offset 20 (4-byte big-endian)
 */
function extractPngDimensions(buffer: Buffer): { width: number; height: number } | undefined {
  if (buffer.length >= 24) {
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    return { width, height };
  }
  return undefined;
}

/**
 * Extracts dimensions from JPEG SOF0/SOF2 marker
 * Scans for 0xFF 0xC0 or 0xFF 0xC2 markers which contain image dimensions
 */
function extractJpegDimensions(buffer: Buffer): { width: number; height: number } | undefined {
  for (let i = 0; i < buffer.length - 10; i++) {
    if (buffer[i] === 0xFF && (buffer[i + 1] === 0xC0 || buffer[i + 1] === 0xC2)) {
      const height = buffer.readUInt16BE(i + 5);
      const width = buffer.readUInt16BE(i + 7);
      return { width, height };
    }
  }
  return undefined;
}

// ============================================================================
// Test Page Generators
// ============================================================================

/**
 * Creates a tall test page for scroll handling tests
 * Includes markers at top, middle, and bottom to verify complete capture
 */
function createTallTestPage(heightPixels: number = 3000): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Full Page Screenshot Test - Height ${heightPixels}px</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            height: ${heightPixels}px;
            background: linear-gradient(to bottom, #667eea 0%, #764ba2 50%, #ff6b6b 100%);
            font-family: Arial, sans-serif;
          }
          .marker {
            position: absolute;
            left: 50%;
            transform: translateX(-50%);
            background: white;
            padding: 20px 40px;
            border-radius: 10px;
            font-size: 18px;
            font-weight: bold;
            box-shadow: 0 4px 20px rgba(0,0,0,0.2);
            text-align: center;
          }
          .top-marker { top: 50px; }
          .middle-marker { top: ${Math.floor(heightPixels / 2) - 30}px; }
          .bottom-marker { bottom: 50px; }
        </style>
      </head>
      <body>
        <div class="marker top-marker">
          <div>TOP OF PAGE</div>
          <div style="font-size: 12px; color: #666;">Position: 50px from top</div>
        </div>
        <div class="marker middle-marker">
          <div>MIDDLE OF PAGE</div>
          <div style="font-size: 12px; color: #666;">Position: ${Math.floor(heightPixels / 2)}px</div>
        </div>
        <div class="marker bottom-marker">
          <div>BOTTOM OF PAGE</div>
          <div style="font-size: 12px; color: #666;">Position: 50px from bottom</div>
        </div>
      </body>
    </html>
  `;
}

/**
 * Creates a wide test page for horizontal scroll testing
 */
function createWideTestPage(widthPixels: number = 3000): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Wide Page Test - Width ${widthPixels}px</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            width: ${widthPixels}px;
            height: 600px;
            background: linear-gradient(to right, #11998e, #38ef7d, #f093fb, #f5576c);
            display: flex;
            align-items: center;
            font-family: Arial, sans-serif;
          }
          .marker {
            position: absolute;
            top: 50%;
            transform: translateY(-50%);
            background: white;
            padding: 20px 40px;
            border-radius: 10px;
            font-weight: bold;
            box-shadow: 0 4px 20px rgba(0,0,0,0.2);
          }
          .left-marker { left: 50px; }
          .center-marker { left: ${Math.floor(widthPixels / 2) - 100}px; }
          .right-marker { right: 50px; }
        </style>
      </head>
      <body>
        <div class="marker left-marker">LEFT</div>
        <div class="marker center-marker">CENTER</div>
        <div class="marker right-marker">RIGHT</div>
      </body>
    </html>
  `;
}

/**
 * Creates a complex test page with various visual elements
 */
function createComplexTestPage(): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Complex Full Page Screenshot Test</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f5f5f5;
          }
          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 60px 20px;
            text-align: center;
          }
          .header h1 { font-size: 36px; margin-bottom: 10px; }
          .section {
            padding: 60px 40px;
            max-width: 1200px;
            margin: 0 auto;
          }
          .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 30px;
            margin: 40px 0;
          }
          .card {
            background: white;
            border-radius: 12px;
            padding: 30px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
          }
          .card h3 { color: #333; margin-bottom: 15px; }
          .card p { color: #666; line-height: 1.6; }
          .gradient-bar {
            height: 200px;
            margin: 40px 0;
            border-radius: 12px;
            background: linear-gradient(90deg, #ff6b6b, #feca57, #48dbfb, #ff9ff3, #54a0ff);
          }
          .tall-section {
            height: 800px;
            background: linear-gradient(180deg, #dfe6e9, #b2bec3);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            color: #2d3436;
          }
          .footer {
            background: #2d3436;
            color: white;
            padding: 60px 20px;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Full Page Screenshot Test</h1>
          <p>Comprehensive visual test page for screenshot validation</p>
        </div>
        <div class="section">
          <h2>Visual Elements</h2>
          <div class="grid">
            <div class="card">
              <h3>Card One</h3>
              <p>This is a sample card with text content to verify text rendering in screenshots.</p>
            </div>
            <div class="card">
              <h3>Card Two</h3>
              <p>Multiple cards help verify grid layout capture and spacing accuracy.</p>
            </div>
            <div class="card">
              <h3>Card Three</h3>
              <p>CSS shadows and rounded corners should be captured correctly.</p>
            </div>
          </div>
          <div class="gradient-bar"></div>
        </div>
        <div class="tall-section">
          Extended Content Section - Verifies Scroll Capture
        </div>
        <div class="section">
          <h2>Additional Content</h2>
          <p style="font-size: 18px; line-height: 1.8; color: #555;">
            This section contains additional content to ensure the full page capture
            includes all visible and scrollable content. The gradient backgrounds,
            shadows, and various visual elements help verify accurate rendering.
          </p>
        </div>
        <div class="footer">
          <h2>Footer Section</h2>
          <p>End of page content - validates complete capture</p>
        </div>
      </body>
    </html>
  `;
}

/**
 * Creates a page with fixed/sticky elements
 */
function createFixedElementsPage(): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Fixed Elements Test</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { height: 3000px; padding-top: 80px; background: #ecf0f1; }
          .fixed-header {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            height: 60px;
            background: #2c3e50;
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
          }
          .fixed-footer {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            height: 50px;
            background: #34495e;
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
          }
          .content {
            padding: 40px;
            margin-bottom: 60px;
          }
          .section {
            height: 600px;
            margin: 20px 0;
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            color: white;
          }
          .section-1 { background: #3498db; }
          .section-2 { background: #e74c3c; }
          .section-3 { background: #2ecc71; }
          .section-4 { background: #9b59b6; }
        </style>
      </head>
      <body>
        <div class="fixed-header">
          <h1>Fixed Header</h1>
        </div>
        <div class="content">
          <div class="section section-1">Section 1</div>
          <div class="section section-2">Section 2</div>
          <div class="section section-3">Section 3</div>
          <div class="section section-4">Section 4</div>
        </div>
        <div class="fixed-footer">
          <p>Fixed Footer</p>
        </div>
      </body>
    </html>
  `;
}

/**
 * Creates a page with nested scrollable containers
 */
function createNestedScrollPage(): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Nested Scroll Test</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            height: 2500px;
            padding: 40px;
            background: linear-gradient(180deg, #dfe6e9, #b2bec3);
          }
          h1 { margin-bottom: 30px; color: #2d3436; }
          .scroll-container {
            height: 400px;
            width: 100%;
            max-width: 600px;
            overflow: auto;
            border: 3px solid #333;
            border-radius: 12px;
            margin: 30px 0;
            background: white;
          }
          .inner-content {
            height: 1000px;
            width: 800px;
            padding: 20px;
            background: linear-gradient(135deg, #a8edea, #fed6e3);
          }
          .marker {
            background: rgba(0,0,0,0.8);
            color: white;
            padding: 15px 25px;
            border-radius: 8px;
            display: inline-block;
            margin: 20px;
          }
        </style>
      </head>
      <body>
        <h1>Nested Scrollable Containers Test</h1>
        <div class="scroll-container">
          <div class="inner-content">
            <div class="marker">Top-Left of Scrollable Content</div>
            <div class="marker" style="position: absolute; bottom: 20px; right: 20px;">
              Bottom-Right of Scrollable Content
            </div>
          </div>
        </div>
        <div class="scroll-container">
          <div class="inner-content" style="background: linear-gradient(135deg, #ffecd2, #fcb69f);">
            <div class="marker">Second Container Content</div>
          </div>
        </div>
        <div style="height: 800px; background: #6c5ce7; border-radius: 12px; display: flex; align-items: center; justify-content: center;">
          <span style="color: white; font-size: 24px;">Extended Page Content Below Scroll Containers</span>
        </div>
      </body>
    </html>
  `;
}

// ============================================================================
// Integration Tests
// ============================================================================

describe('Full Page Screenshot Capture Integration Tests', () => {
  let manager: BrowserManager;
  let session: BrowserSession;
  let tempDir: string;

  beforeAll(async () => {
    console.log('\n==========================================');
    console.log('Full Page Screenshot Integration Tests');
    console.log('==========================================\n');
  });

  beforeEach(async () => {
    manager = createBrowserManager();
    session = createBrowserSession(manager, {
      browserType: 'chromium',
      headless: true,
      viewport: { width: 1280, height: 720 }
    });

    await session.launch();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apex-fullpage-integration-'));
  });

  afterEach(async () => {
    if (session) {
      await session.close();
    }
    if (manager) {
      await manager.shutdown();
    }
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  afterAll(async () => {
    console.log('\n==========================================');
    console.log('Full Page Screenshot Tests Completed');
    console.log('==========================================\n');
  });

  // ==========================================================================
  // Section 1: Basic Full Page Capture Tests (AC1)
  // ==========================================================================

  describe('Basic Full Page Capture', () => {
    it('should capture entire page as PNG by default', async () => {
      const testPage = createTallTestPage(2000);
      await session.navigate(`data:text/html,${encodeURIComponent(testPage)}`);

      const result = await session.captureFullPage();

      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Buffer);
      expect(result.data!.length).toBeGreaterThan(5000);
      expect(result.duration).toBeGreaterThan(0);

      const validation = validateImageBuffer(result.data!);
      expect(validation.isValid).toBe(true);
      expect(validation.format).toBe('png');

      console.log(`  PNG capture: ${validation.size} bytes, ${result.duration}ms`);
    });

    it('should capture entire page as JPEG with quality setting', async () => {
      const testPage = createTallTestPage(2000);
      await session.navigate(`data:text/html,${encodeURIComponent(testPage)}`);

      const result = await session.captureFullPage({
        type: 'jpeg',
        quality: 85
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Buffer);

      const validation = validateImageBuffer(result.data!);
      expect(validation.isValid).toBe(true);
      expect(validation.format).toBe('jpeg');

      console.log(`  JPEG capture (quality 85): ${validation.size} bytes`);
    });

    it('should save full page screenshot to file and return buffer', async () => {
      const testPage = createComplexTestPage();
      await session.navigate(`data:text/html,${encodeURIComponent(testPage)}`);

      const filePath = path.join(tempDir, 'fullpage-test.png');
      const result = await session.captureFullPage({ path: filePath });

      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Buffer);
      expect(fs.existsSync(filePath)).toBe(true);

      const savedFile = fs.readFileSync(filePath);
      expect(savedFile.equals(result.data!)).toBe(true);

      const validation = validateImageBuffer(savedFile);
      expect(validation.isValid).toBe(true);
      expect(validation.format).toBe('png');

      console.log(`  File saved: ${path.basename(filePath)} (${validation.size} bytes)`);
    });

    it('should return error when browser is not launched', async () => {
      const unlaunched = createBrowserSession(manager, {
        browserType: 'chromium',
        headless: true
      });
      // Deliberately not launching

      const result = await unlaunched.captureFullPage();

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.duration).toBeGreaterThan(0);

      console.log(`  Unlaunched browser error: ${result.error}`);
    });

    it('should capture empty page successfully', async () => {
      const emptyPage = `<html><head></head><body style="height: 1500px;"></body></html>`;
      await session.navigate(`data:text/html,${encodeURIComponent(emptyPage)}`);

      const result = await session.captureFullPage();

      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Buffer);
      expect(result.data!.length).toBeGreaterThan(0);

      const validation = validateImageBuffer(result.data!);
      expect(validation.isValid).toBe(true);

      console.log(`  Empty page capture: ${validation.size} bytes`);
    });

    it('should capture page with transparent background when omitBackground is true', async () => {
      const transparentPage = `
        <html>
          <body style="height: 1500px; background: transparent;">
            <div style="width: 200px; height: 200px; background: red; margin: 50px;"></div>
          </body>
        </html>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(transparentPage)}`);

      const result = await session.captureFullPage({
        type: 'png',
        omitBackground: true
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Buffer);

      const validation = validateImageBuffer(result.data!);
      expect(validation.isValid).toBe(true);
      expect(validation.format).toBe('png');

      console.log(`  Transparent background capture: ${validation.size} bytes`);
    });
  });

  // ==========================================================================
  // Section 2: Image Format Verification Tests (AC2)
  // ==========================================================================

  describe('Image Format Verification', () => {
    it('should produce valid PNG with correct file signature', async () => {
      const testPage = createTallTestPage(1500);
      await session.navigate(`data:text/html,${encodeURIComponent(testPage)}`);

      const result = await session.captureFullPage({ type: 'png' });

      expect(result.success).toBe(true);

      // Verify PNG signature: 0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A
      expect(result.data![0]).toBe(0x89);
      expect(result.data![1]).toBe(0x50); // 'P'
      expect(result.data![2]).toBe(0x4E); // 'N'
      expect(result.data![3]).toBe(0x47); // 'G'
      expect(result.data![4]).toBe(0x0D);
      expect(result.data![5]).toBe(0x0A);
      expect(result.data![6]).toBe(0x1A);
      expect(result.data![7]).toBe(0x0A);

      console.log('  PNG signature verified: 89 50 4E 47 0D 0A 1A 0A');
    });

    it('should produce valid JPEG with correct file signature', async () => {
      const testPage = createTallTestPage(1500);
      await session.navigate(`data:text/html,${encodeURIComponent(testPage)}`);

      const result = await session.captureFullPage({
        type: 'jpeg',
        quality: 80
      });

      expect(result.success).toBe(true);

      // Verify JPEG signature: 0xFF 0xD8 0xFF
      expect(result.data![0]).toBe(0xFF);
      expect(result.data![1]).toBe(0xD8);
      expect(result.data![2]).toBe(0xFF);

      // Verify JPEG end marker: 0xFF 0xD9
      const endIndex = result.data!.length - 2;
      expect(result.data![endIndex]).toBe(0xFF);
      expect(result.data![endIndex + 1]).toBe(0xD9);

      console.log('  JPEG signature verified: FF D8 FF ... FF D9');
    });

    it('should produce different file sizes for different JPEG quality levels', async () => {
      const testPage = createComplexTestPage();
      await session.navigate(`data:text/html,${encodeURIComponent(testPage)}`);

      const highQuality = await session.captureFullPage({ type: 'jpeg', quality: 100 });
      const mediumQuality = await session.captureFullPage({ type: 'jpeg', quality: 50 });
      const lowQuality = await session.captureFullPage({ type: 'jpeg', quality: 10 });

      expect(highQuality.success).toBe(true);
      expect(mediumQuality.success).toBe(true);
      expect(lowQuality.success).toBe(true);

      // Higher quality should generally produce larger files
      expect(highQuality.data!.length).toBeGreaterThan(mediumQuality.data!.length);
      expect(mediumQuality.data!.length).toBeGreaterThan(lowQuality.data!.length);

      console.log(`  Quality comparison: 100=${highQuality.data!.length}b, 50=${mediumQuality.data!.length}b, 10=${lowQuality.data!.length}b`);
    });

    it('should handle edge case quality values (1 and 100)', async () => {
      const testPage = createTallTestPage(1000);
      await session.navigate(`data:text/html,${encodeURIComponent(testPage)}`);

      const minQuality = await session.captureFullPage({ type: 'jpeg', quality: 1 });
      const maxQuality = await session.captureFullPage({ type: 'jpeg', quality: 100 });

      expect(minQuality.success).toBe(true);
      expect(maxQuality.success).toBe(true);

      const minValidation = validateImageBuffer(minQuality.data!);
      const maxValidation = validateImageBuffer(maxQuality.data!);

      expect(minValidation.isValid).toBe(true);
      expect(minValidation.format).toBe('jpeg');
      expect(maxValidation.isValid).toBe(true);
      expect(maxValidation.format).toBe('jpeg');

      console.log(`  Edge quality: min(1)=${minValidation.size}b, max(100)=${maxValidation.size}b`);
    });

    it('should default to PNG when type is not specified', async () => {
      const testPage = createTallTestPage(1000);
      await session.navigate(`data:text/html,${encodeURIComponent(testPage)}`);

      const result = await session.captureFullPage();

      expect(result.success).toBe(true);

      const validation = validateImageBuffer(result.data!);
      expect(validation.format).toBe('png');

      console.log('  Default format confirmed as PNG');
    });
  });

  // ==========================================================================
  // Section 3: Viewport Sizing Tests (AC3)
  // ==========================================================================

  describe('Viewport Sizing', () => {
    it('should capture with standard 1280x720 viewport', async () => {
      const standardSession = createBrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
        viewport: { width: 1280, height: 720 }
      });
      await standardSession.launch();

      try {
        const testPage = createTallTestPage(2000);
        await standardSession.navigate(`data:text/html,${encodeURIComponent(testPage)}`);

        const result = await standardSession.captureFullPage();

        expect(result.success).toBe(true);

        const validation = validateImageBuffer(result.data!);
        expect(validation.isValid).toBe(true);
        expect(validation.dimensions).toBeDefined();
        expect(validation.dimensions!.width).toBe(1280);
        expect(validation.dimensions!.height).toBeGreaterThanOrEqual(2000);

        console.log(`  1280x720 viewport: ${validation.dimensions!.width}x${validation.dimensions!.height}`);
      } finally {
        await standardSession.close();
      }
    });

    it('should capture with wide 1920x1080 viewport', async () => {
      const wideSession = createBrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
        viewport: { width: 1920, height: 1080 }
      });
      await wideSession.launch();

      try {
        const testPage = createTallTestPage(2500);
        await wideSession.navigate(`data:text/html,${encodeURIComponent(testPage)}`);

        const result = await wideSession.captureFullPage();

        expect(result.success).toBe(true);

        const validation = validateImageBuffer(result.data!);
        expect(validation.dimensions).toBeDefined();
        expect(validation.dimensions!.width).toBe(1920);
        expect(validation.dimensions!.height).toBeGreaterThanOrEqual(2500);

        console.log(`  1920x1080 viewport: ${validation.dimensions!.width}x${validation.dimensions!.height}`);
      } finally {
        await wideSession.close();
      }
    });

    it('should capture with narrow 800x600 viewport', async () => {
      const narrowSession = createBrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
        viewport: { width: 800, height: 600 }
      });
      await narrowSession.launch();

      try {
        const testPage = createTallTestPage(1800);
        await narrowSession.navigate(`data:text/html,${encodeURIComponent(testPage)}`);

        const result = await narrowSession.captureFullPage();

        expect(result.success).toBe(true);

        const validation = validateImageBuffer(result.data!);
        expect(validation.dimensions).toBeDefined();
        expect(validation.dimensions!.width).toBe(800);
        expect(validation.dimensions!.height).toBeGreaterThanOrEqual(1800);

        console.log(`  800x600 viewport: ${validation.dimensions!.width}x${validation.dimensions!.height}`);
      } finally {
        await narrowSession.close();
      }
    });

    it('should capture with mobile 375x812 viewport', async () => {
      const mobileSession = createBrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
        viewport: { width: 375, height: 812 }
      });
      await mobileSession.launch();

      try {
        const testPage = createTallTestPage(2000);
        await mobileSession.navigate(`data:text/html,${encodeURIComponent(testPage)}`);

        const result = await mobileSession.captureFullPage();

        expect(result.success).toBe(true);

        const validation = validateImageBuffer(result.data!);
        expect(validation.dimensions).toBeDefined();
        expect(validation.dimensions!.width).toBe(375);
        expect(validation.dimensions!.height).toBeGreaterThanOrEqual(2000);

        console.log(`  375x812 mobile viewport: ${validation.dimensions!.width}x${validation.dimensions!.height}`);
      } finally {
        await mobileSession.close();
      }
    });

    it('should produce different image widths for different viewport widths', async () => {
      const viewports = [
        { width: 800, height: 600 },
        { width: 1200, height: 800 },
        { width: 1600, height: 900 }
      ];

      const results: Array<{ viewport: number; imageWidth: number }> = [];

      for (const viewport of viewports) {
        const testSession = createBrowserSession(manager, {
          browserType: 'chromium',
          headless: true,
          viewport
        });
        await testSession.launch();

        try {
          const testPage = createTallTestPage(1500);
          await testSession.navigate(`data:text/html,${encodeURIComponent(testPage)}`);

          const result = await testSession.captureFullPage();
          expect(result.success).toBe(true);

          const validation = validateImageBuffer(result.data!);
          expect(validation.dimensions).toBeDefined();

          results.push({
            viewport: viewport.width,
            imageWidth: validation.dimensions!.width
          });
        } finally {
          await testSession.close();
        }
      }

      // Verify each viewport produces corresponding image width
      for (let i = 0; i < viewports.length; i++) {
        expect(results[i].imageWidth).toBe(viewports[i].width);
      }

      console.log(`  Viewport to image width mapping verified: ${results.map(r => `${r.viewport}px`).join(', ')}`);
    });

    it('should handle ultra-wide viewport', async () => {
      const ultraWideSession = createBrowserSession(manager, {
        browserType: 'chromium',
        headless: true,
        viewport: { width: 2560, height: 1080 }
      });
      await ultraWideSession.launch();

      try {
        const testPage = createComplexTestPage();
        await ultraWideSession.navigate(`data:text/html,${encodeURIComponent(testPage)}`);

        const result = await ultraWideSession.captureFullPage();

        expect(result.success).toBe(true);

        const validation = validateImageBuffer(result.data!);
        expect(validation.dimensions).toBeDefined();
        expect(validation.dimensions!.width).toBe(2560);

        console.log(`  Ultra-wide 2560x1080: ${validation.dimensions!.width}x${validation.dimensions!.height}`);
      } finally {
        await ultraWideSession.close();
      }
    });
  });

  // ==========================================================================
  // Section 4: Scroll Handling Tests (AC4)
  // ==========================================================================

  describe('Scroll Handling for Long Pages', () => {
    it('should capture entire height of 3000px tall page', async () => {
      const pageHeight = 3000;
      const testPage = createTallTestPage(pageHeight);
      await session.navigate(`data:text/html,${encodeURIComponent(testPage)}`);

      const result = await session.captureFullPage();

      expect(result.success).toBe(true);

      const validation = validateImageBuffer(result.data!);
      expect(validation.dimensions).toBeDefined();
      expect(validation.dimensions!.height).toBeGreaterThanOrEqual(pageHeight);

      console.log(`  3000px page captured: height=${validation.dimensions!.height}px`);
    });

    it('should capture entire height of 5000px tall page', async () => {
      const pageHeight = 5000;
      const testPage = createTallTestPage(pageHeight);
      await session.navigate(`data:text/html,${encodeURIComponent(testPage)}`);

      const result = await session.captureFullPage();

      expect(result.success).toBe(true);

      const validation = validateImageBuffer(result.data!);
      expect(validation.dimensions).toBeDefined();
      expect(validation.dimensions!.height).toBeGreaterThanOrEqual(pageHeight);

      console.log(`  5000px page captured: height=${validation.dimensions!.height}px`);
    });

    it('should capture entire height of 10000px very tall page', async () => {
      const pageHeight = 10000;
      const testPage = createTallTestPage(pageHeight);
      await session.navigate(`data:text/html,${encodeURIComponent(testPage)}`);

      const result = await session.captureFullPage();

      expect(result.success).toBe(true);

      const validation = validateImageBuffer(result.data!);
      expect(validation.dimensions).toBeDefined();
      expect(validation.dimensions!.height).toBeGreaterThanOrEqual(pageHeight);

      console.log(`  10000px page captured: height=${validation.dimensions!.height}px`);
    }, 30000); // Extended timeout for very tall page

    it('should capture wide scrollable page', async () => {
      const pageWidth = 3000;
      const testPage = createWideTestPage(pageWidth);
      await session.navigate(`data:text/html,${encodeURIComponent(testPage)}`);

      const result = await session.captureFullPage();

      expect(result.success).toBe(true);

      const validation = validateImageBuffer(result.data!);
      expect(validation.dimensions).toBeDefined();
      expect(validation.dimensions!.width).toBeGreaterThanOrEqual(pageWidth);

      console.log(`  3000px wide page captured: width=${validation.dimensions!.width}px`);
    });

    it('should capture page with fixed position elements', async () => {
      const testPage = createFixedElementsPage();
      await session.navigate(`data:text/html,${encodeURIComponent(testPage)}`);

      const result = await session.captureFullPage();

      expect(result.success).toBe(true);
      expect(result.data!.length).toBeGreaterThan(20000);

      const validation = validateImageBuffer(result.data!);
      expect(validation.isValid).toBe(true);
      expect(validation.dimensions!.height).toBeGreaterThan(2000);

      console.log(`  Fixed elements page: ${validation.dimensions!.width}x${validation.dimensions!.height}`);
    });

    it('should capture page with nested scrollable containers', async () => {
      const testPage = createNestedScrollPage();
      await session.navigate(`data:text/html,${encodeURIComponent(testPage)}`);

      const result = await session.captureFullPage();

      expect(result.success).toBe(true);

      const validation = validateImageBuffer(result.data!);
      expect(validation.isValid).toBe(true);
      expect(validation.dimensions!.height).toBeGreaterThan(2000);

      console.log(`  Nested scroll page: ${validation.dimensions!.width}x${validation.dimensions!.height}`);
    });

    it('should capture page after JavaScript content modification', async () => {
      const dynamicPage = `
        <html>
          <body style="margin: 0;">
            <div id="content">Initial Content</div>
            <script>
              setTimeout(() => {
                for (let i = 0; i < 50; i++) {
                  const div = document.createElement('div');
                  div.style.height = '100px';
                  div.style.background = 'hsl(' + (i * 7) + ', 70%, 60%)';
                  div.style.display = 'flex';
                  div.style.alignItems = 'center';
                  div.style.justifyContent = 'center';
                  div.style.color = 'white';
                  div.style.fontSize = '20px';
                  div.textContent = 'Dynamic Section ' + (i + 1);
                  document.body.appendChild(div);
                }
              }, 100);
            </script>
          </body>
        </html>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(dynamicPage)}`);

      // Wait for dynamic content to load
      await new Promise(resolve => setTimeout(resolve, 500));

      const result = await session.captureFullPage();

      expect(result.success).toBe(true);

      const validation = validateImageBuffer(result.data!);
      expect(validation.dimensions).toBeDefined();
      // Should have captured all 50 sections (50 * 100px = 5000px minimum)
      expect(validation.dimensions!.height).toBeGreaterThan(4500);

      console.log(`  Dynamic content page: height=${validation.dimensions!.height}px`);
    });

    it('should produce larger image than viewport capture for tall pages', async () => {
      const testPage = createTallTestPage(4000);
      await session.navigate(`data:text/html,${encodeURIComponent(testPage)}`);

      const fullPageResult = await session.captureFullPage();
      const viewportResult = await session.captureViewport();

      expect(fullPageResult.success).toBe(true);
      expect(viewportResult.success).toBe(true);

      const fullPageValidation = validateImageBuffer(fullPageResult.data!);
      const viewportValidation = validateImageBuffer(viewportResult.data!);

      // Full page should have greater height
      expect(fullPageValidation.dimensions!.height).toBeGreaterThan(
        viewportValidation.dimensions!.height
      );

      // Full page data should be larger
      expect(fullPageResult.data!.length).toBeGreaterThan(viewportResult.data!.length);

      console.log(`  Full page (${fullPageValidation.dimensions!.height}px) vs Viewport (${viewportValidation.dimensions!.height}px)`);
    });
  });

  // ==========================================================================
  // Section 5: Dimension Validation Tests (AC5)
  // ==========================================================================

  describe('Output Dimension Validation', () => {
    it('should match viewport width in output image', async () => {
      const viewportWidth = 1280;
      const testPage = createTallTestPage(2000);
      await session.navigate(`data:text/html,${encodeURIComponent(testPage)}`);

      const result = await session.captureFullPage();

      expect(result.success).toBe(true);

      const validation = validateImageBuffer(result.data!);
      expect(validation.dimensions).toBeDefined();
      expect(validation.dimensions!.width).toBe(viewportWidth);

      console.log(`  Viewport width match: expected=${viewportWidth}, actual=${validation.dimensions!.width}`);
    });

    it('should capture full height matching page content height', async () => {
      const pageHeight = 3500;
      const testPage = createTallTestPage(pageHeight);
      await session.navigate(`data:text/html,${encodeURIComponent(testPage)}`);

      const result = await session.captureFullPage();

      expect(result.success).toBe(true);

      const validation = validateImageBuffer(result.data!);
      expect(validation.dimensions).toBeDefined();
      expect(validation.dimensions!.height).toBeGreaterThanOrEqual(pageHeight);

      console.log(`  Height match: expected>=${pageHeight}, actual=${validation.dimensions!.height}`);
    });

    it('should have consistent dimensions across multiple captures', async () => {
      const testPage = createComplexTestPage();
      await session.navigate(`data:text/html,${encodeURIComponent(testPage)}`);

      const dimensions: Array<{ width: number; height: number }> = [];

      for (let i = 0; i < 3; i++) {
        const result = await session.captureFullPage();
        expect(result.success).toBe(true);

        const validation = validateImageBuffer(result.data!);
        expect(validation.dimensions).toBeDefined();
        dimensions.push(validation.dimensions!);
      }

      // All captures should have identical dimensions
      for (let i = 1; i < dimensions.length; i++) {
        expect(dimensions[i].width).toBe(dimensions[0].width);
        expect(dimensions[i].height).toBe(dimensions[0].height);
      }

      console.log(`  Consistent dimensions: ${dimensions[0].width}x${dimensions[0].height} (3 captures)`);
    });

    it('should extract valid PNG dimensions from IHDR chunk', async () => {
      const testPage = createTallTestPage(1500);
      await session.navigate(`data:text/html,${encodeURIComponent(testPage)}`);

      const result = await session.captureFullPage({ type: 'png' });

      expect(result.success).toBe(true);

      const validation = validateImageBuffer(result.data!);
      expect(validation.format).toBe('png');
      expect(validation.dimensions).toBeDefined();
      expect(validation.dimensions!.width).toBeGreaterThan(0);
      expect(validation.dimensions!.height).toBeGreaterThan(0);

      console.log(`  PNG IHDR dimensions: ${validation.dimensions!.width}x${validation.dimensions!.height}`);
    });

    it('should extract valid JPEG dimensions from SOF marker', async () => {
      const testPage = createTallTestPage(1500);
      await session.navigate(`data:text/html,${encodeURIComponent(testPage)}`);

      const result = await session.captureFullPage({ type: 'jpeg', quality: 80 });

      expect(result.success).toBe(true);

      const validation = validateImageBuffer(result.data!);
      expect(validation.format).toBe('jpeg');
      expect(validation.dimensions).toBeDefined();
      expect(validation.dimensions!.width).toBeGreaterThan(0);
      expect(validation.dimensions!.height).toBeGreaterThan(0);

      console.log(`  JPEG SOF dimensions: ${validation.dimensions!.width}x${validation.dimensions!.height}`);
    });
  });

  // ==========================================================================
  // Section 6: Performance and Stress Tests
  // ==========================================================================

  describe('Performance Validation', () => {
    it('should complete standard page capture within reasonable time', async () => {
      const testPage = createTallTestPage(2000);
      await session.navigate(`data:text/html,${encodeURIComponent(testPage)}`);

      const startTime = Date.now();
      const result = await session.captureFullPage();
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(10000); // 10 second max

      console.log(`  Standard capture performance: ${duration}ms`);
    });

    it('should handle rapid consecutive captures', async () => {
      const testPage = createTallTestPage(1500);
      await session.navigate(`data:text/html,${encodeURIComponent(testPage)}`);

      const captures = 5;
      const results: Array<{ success: boolean; duration: number; size: number }> = [];

      const totalStart = Date.now();
      for (let i = 0; i < captures; i++) {
        const result = await session.captureFullPage();
        expect(result.success).toBe(true);

        results.push({
          success: result.success,
          duration: result.duration,
          size: result.data!.length
        });
      }
      const totalDuration = Date.now() - totalStart;

      const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;

      console.log(`  ${captures} rapid captures: total=${totalDuration}ms, avg=${avgDuration.toFixed(0)}ms`);

      expect(totalDuration).toBeLessThan(30000); // 30 seconds max for 5 captures
    });

    it('should maintain performance for complex visual content', async () => {
      const testPage = createComplexTestPage();
      await session.navigate(`data:text/html,${encodeURIComponent(testPage)}`);

      const result = await session.captureFullPage({ type: 'png' });

      expect(result.success).toBe(true);
      expect(result.duration).toBeLessThan(15000);

      const validation = validateImageBuffer(result.data!);
      expect(validation.isValid).toBe(true);
      expect(validation.size).toBeGreaterThan(50000); // Complex page should produce substantial image

      console.log(`  Complex page: ${validation.size} bytes in ${result.duration}ms`);
    });
  });

  // ==========================================================================
  // Section 7: Acceptance Criteria Validation Summary
  // ==========================================================================

  describe('Acceptance Criteria Validation Summary', () => {
    it('should validate all acceptance criteria in comprehensive test', async () => {
      console.log('\n========================================');
      console.log('ACCEPTANCE CRITERIA VALIDATION');
      console.log('========================================\n');

      // Navigate to complex test page
      const testPage = createTallTestPage(4000);
      await session.navigate(`data:text/html,${encodeURIComponent(testPage)}`);

      // AC1: Full page screenshot tests exist and pass
      console.log('AC1: Full page screenshot capture...');
      const pngResult = await session.captureFullPage({ type: 'png' });
      expect(pngResult.success).toBe(true);
      expect(pngResult.data).toBeInstanceOf(Buffer);
      console.log('  PASSED');

      // AC2: Tests verify image output format
      console.log('AC2: Image format verification...');
      const pngValidation = validateImageBuffer(pngResult.data!);
      expect(pngValidation.isValid).toBe(true);
      expect(pngValidation.format).toBe('png');

      const jpegResult = await session.captureFullPage({ type: 'jpeg', quality: 85 });
      expect(jpegResult.success).toBe(true);
      const jpegValidation = validateImageBuffer(jpegResult.data!);
      expect(jpegValidation.isValid).toBe(true);
      expect(jpegValidation.format).toBe('jpeg');
      console.log('  PNG and JPEG formats: PASSED');

      // AC3: Tests verify viewport sizing
      console.log('AC3: Viewport sizing verification...');
      expect(pngValidation.dimensions).toBeDefined();
      expect(pngValidation.dimensions!.width).toBe(1280); // Default viewport
      console.log('  PASSED');

      // AC4: Tests verify scroll handling
      console.log('AC4: Scroll handling verification...');
      expect(pngValidation.dimensions!.height).toBeGreaterThanOrEqual(4000);
      console.log('  PASSED');

      // AC5: Tests verify output dimensions
      console.log('AC5: Dimension validation...');
      expect(pngValidation.dimensions!.width).toBeGreaterThan(0);
      expect(pngValidation.dimensions!.height).toBeGreaterThan(0);
      console.log('  PASSED');

      console.log('\n========================================');
      console.log('ALL ACCEPTANCE CRITERIA: PASSED');
      console.log('========================================\n');

      expect(true).toBe(true);
    });
  });
});
