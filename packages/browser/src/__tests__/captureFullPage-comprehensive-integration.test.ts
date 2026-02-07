/**
 * @apexcli/browser - Full Page Screenshot Comprehensive Integration Tests
 *
 * Integration tests specifically targeting the acceptance criteria:
 * - Test capturing entire page as PNG/JPEG
 * - Test viewport sizing
 * - Test scroll handling for long pages
 * - Test image output format and dimensions
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BrowserManager } from '../browser-manager.js';
import { BrowserSession } from '../browser-session.js';
import type { ScreenshotOptions } from '../types.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('Full Page Screenshot - Comprehensive Integration Tests', () => {
  let manager: BrowserManager;
  let session: BrowserSession;
  let tempDir: string;

  beforeEach(async () => {
    manager = new BrowserManager();
    session = new BrowserSession(manager, {
      browserType: 'chromium',
      headless: true,
      viewport: { width: 1200, height: 800 }
    });
    await session.launch();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apex-fullpage-comprehensive-'));
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

  describe('Entire Page Capture as PNG/JPEG', () => {
    it('should capture entire page as PNG with correct format signature', async () => {
      const testPage = `
        <html>
          <head>
            <style>
              body {
                margin: 0;
                height: 2500px;
                background: linear-gradient(to bottom, #ff6b6b, #4ecdc4, #45b7d1, #96ceb4, #feca57);
              }
              .section {
                height: 500px;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-size: 32px;
                font-weight: bold;
                text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
              }
            </style>
          </head>
          <body>
            <div class="section">Section 1 - Top</div>
            <div class="section">Section 2</div>
            <div class="section">Section 3</div>
            <div class="section">Section 4</div>
            <div class="section">Section 5 - Bottom</div>
          </body>
        </html>
      `;

      await session.navigate(`data:text/html,${encodeURIComponent(testPage)}`);

      const result = await session.captureFullPage({ type: 'png' });

      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Buffer);
      expect(result.data!.length).toBeGreaterThan(10000); // Substantial image size

      // Verify PNG signature: 0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A
      const data = result.data!;
      expect(data[0]).toBe(0x89);
      expect(data[1]).toBe(0x50);
      expect(data[2]).toBe(0x4E);
      expect(data[3]).toBe(0x47);
      expect(data[4]).toBe(0x0D);
      expect(data[5]).toBe(0x0A);
      expect(data[6]).toBe(0x1A);
      expect(data[7]).toBe(0x0A);

      console.log(`✅ PNG full page capture: ${result.data!.length} bytes with valid PNG signature`);
    });

    it('should capture entire page as JPEG with correct format signature and quality settings', async () => {
      const testPage = `
        <html>
          <head>
            <style>
              body {
                margin: 0;
                height: 3000px;
                background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="50" height="50" fill="%23ff0000"/><rect x="50" y="50" width="50" height="50" fill="%2300ff00"/></svg>');
                background-size: 100px 100px;
              }
              .marker {
                position: absolute;
                width: 200px;
                height: 100px;
                background: rgba(255, 255, 255, 0.9);
                border: 3px solid #333;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: bold;
                font-size: 18px;
                left: 50px;
              }
            </style>
          </head>
          <body>
            <div class="marker" style="top: 100px;">TOP MARKER</div>
            <div class="marker" style="top: 1500px;">MIDDLE MARKER</div>
            <div class="marker" style="top: 2800px;">BOTTOM MARKER</div>
          </body>
        </html>
      `;

      await session.navigate(`data:text/html,${encodeURIComponent(testPage)}`);

      // Test with high quality JPEG
      const highQualityResult = await session.captureFullPage({
        type: 'jpeg',
        quality: 95
      });

      expect(highQualityResult.success).toBe(true);
      expect(highQualityResult.data).toBeInstanceOf(Buffer);

      // Verify JPEG signature: 0xFF 0xD8
      const highQualityData = highQualityResult.data!;
      expect(highQualityData[0]).toBe(0xFF);
      expect(highQualityData[1]).toBe(0xD8);

      // Test with lower quality JPEG
      const lowQualityResult = await session.captureFullPage({
        type: 'jpeg',
        quality: 30
      });

      expect(lowQualityResult.success).toBe(true);
      expect(lowQualityResult.data).toBeInstanceOf(Buffer);

      // Verify JPEG signature for low quality
      const lowQualityData = lowQualityResult.data!;
      expect(lowQualityData[0]).toBe(0xFF);
      expect(lowQualityData[1]).toBe(0xD8);

      // High quality should produce larger file size
      expect(highQualityData.length).toBeGreaterThan(lowQualityData.length);

      console.log(`✅ JPEG full page capture: high quality ${highQualityData.length} bytes, low quality ${lowQualityData.length} bytes`);
    });

    it('should save entire page captures to files with correct formats', async () => {
      const testPage = `
        <html>
          <body style="height: 2000px; background: linear-gradient(45deg, #667eea, #764ba2);">
            <h1 style="text-align: center; color: white; padding-top: 50px;">File Save Test Page</h1>
            <div style="height: 1800px; display: flex; align-items: center; justify-content: center; color: white; font-size: 24px;">
              Content spans full page height
            </div>
          </body>
        </html>
      `;

      await session.navigate(`data:text/html,${encodeURIComponent(testPage)}`);

      const pngPath = path.join(tempDir, 'fullpage-test.png');
      const jpegPath = path.join(tempDir, 'fullpage-test.jpg');

      // Save as PNG
      const pngResult = await session.captureFullPage({
        type: 'png',
        path: pngPath
      });

      expect(pngResult.success).toBe(true);
      expect(fs.existsSync(pngPath)).toBe(true);

      // Save as JPEG
      const jpegResult = await session.captureFullPage({
        type: 'jpeg',
        quality: 85,
        path: jpegPath
      });

      expect(jpegResult.success).toBe(true);
      expect(fs.existsSync(jpegPath)).toBe(true);

      // Verify file contents match buffer results
      const pngFileData = fs.readFileSync(pngPath);
      const jpegFileData = fs.readFileSync(jpegPath);

      expect(pngFileData.equals(pngResult.data!)).toBe(true);
      expect(jpegFileData.equals(jpegResult.data!)).toBe(true);

      console.log(`✅ File saves: PNG ${pngFileData.length} bytes, JPEG ${jpegFileData.length} bytes`);
    });
  });

  describe('Viewport Sizing Tests', () => {
    const viewportSizes = [
      { width: 320, height: 568, name: 'iPhone SE' },
      { width: 375, height: 812, name: 'iPhone 12' },
      { width: 768, height: 1024, name: 'iPad' },
      { width: 1366, height: 768, name: 'Laptop' },
      { width: 1920, height: 1080, name: 'Desktop HD' },
      { width: 2560, height: 1440, name: 'Desktop 2K' },
    ];

    viewportSizes.forEach(size => {
      it(`should capture full page at ${size.name} viewport (${size.width}x${size.height})`, async () => {
        // Create new session with specific viewport
        await session.close();
        session = new BrowserSession(manager, {
          browserType: 'chromium',
          headless: true,
          viewport: { width: size.width, height: size.height }
        });
        await session.launch();

        const testPage = `
          <html>
            <head>
              <style>
                body {
                  margin: 0;
                  height: 4000px;
                  background: linear-gradient(to bottom,
                    #ff6b6b 0%,
                    #4ecdc4 25%,
                    #45b7d1 50%,
                    #96ceb4 75%,
                    #feca57 100%
                  );
                }
                .viewport-info {
                  position: fixed;
                  top: 20px;
                  left: 20px;
                  background: white;
                  padding: 15px;
                  border: 2px solid #333;
                  border-radius: 8px;
                  font-family: Arial, sans-serif;
                  font-weight: bold;
                  z-index: 1000;
                }
                .content-marker {
                  position: absolute;
                  width: 100%;
                  height: 100px;
                  background: rgba(255, 255, 255, 0.2);
                  border-top: 3px solid white;
                  border-bottom: 3px solid white;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  color: white;
                  font-size: 24px;
                  font-weight: bold;
                  text-shadow: 2px 2px 4px rgba(0,0,0,0.7);
                }
              </style>
            </head>
            <body>
              <div class="viewport-info">
                Viewport: ${size.width} x ${size.height}
              </div>
              <div class="content-marker" style="top: 500px;">500px Mark</div>
              <div class="content-marker" style="top: 1500px;">1500px Mark</div>
              <div class="content-marker" style="top: 2500px;">2500px Mark</div>
              <div class="content-marker" style="top: 3500px;">3500px Mark</div>
            </body>
          </html>
        `;

        await session.navigate(`data:text/html,${encodeURIComponent(testPage)}`);

        const result = await session.captureFullPage({ type: 'png' });

        expect(result.success).toBe(true);
        expect(result.data).toBeInstanceOf(Buffer);
        expect(result.data!.length).toBeGreaterThan(5000);

        // Parse PNG dimensions to verify width matches viewport
        const data = result.data!;
        if (data[0] === 0x89 && data[1] === 0x50) {
          const width = data.readUInt32BE(16);
          const height = data.readUInt32BE(20);

          expect(width).toBe(size.width);
          expect(height).toBeGreaterThan(size.height); // Should capture beyond viewport height
          expect(height).toBeGreaterThan(3500); // Should capture content at 3500px mark

          console.log(`✅ ${size.name} (${size.width}x${size.height}): Captured ${width}x${height}px image (${result.data!.length} bytes)`);
        } else {
          throw new Error('Invalid PNG format detected');
        }
      });
    });

    it('should handle viewport size changes during session', async () => {
      // Initial viewport
      const testPage = `
        <html>
          <body style="height: 2000px; background: #ff6b6b;">
            <h1 style="text-align: center; color: white; padding-top: 50px;">Viewport Change Test</h1>
          </body>
        </html>
      `;

      await session.navigate(`data:text/html,${encodeURIComponent(testPage)}`);

      // Capture at initial size (1200x800 from beforeEach)
      const initialResult = await session.captureFullPage({ type: 'png' });
      expect(initialResult.success).toBe(true);

      // Change viewport size using page API
      await session.page!.setViewportSize({ width: 800, height: 600 });

      // Capture at new size
      const resizedResult = await session.captureFullPage({ type: 'png' });
      expect(resizedResult.success).toBe(true);

      // Parse dimensions from both captures
      const initialData = initialResult.data!;
      const resizedData = resizedResult.data!;

      if (initialData[0] === 0x89 && initialData[1] === 0x50 &&
          resizedData[0] === 0x89 && resizedData[1] === 0x50) {
        const initialWidth = initialData.readUInt32BE(16);
        const resizedWidth = resizedData.readUInt32BE(16);

        expect(initialWidth).toBe(1200);
        expect(resizedWidth).toBe(800);

        console.log(`✅ Viewport resize: 1200px → 800px width successfully captured`);
      }
    });
  });

  describe('Scroll Handling for Long Pages', () => {
    it('should capture all content regardless of initial scroll position', async () => {
      const longPageHTML = `
        <html>
          <head>
            <style>
              body {
                margin: 0;
                height: 6000px;
                background: linear-gradient(to bottom,
                  red 0%, orange 16.66%, yellow 33.33%,
                  green 50%, blue 66.66%, purple 83.33%, red 100%
                );
              }
              .scroll-marker {
                position: absolute;
                left: 50px;
                width: 300px;
                height: 80px;
                background: rgba(255, 255, 255, 0.95);
                border: 3px solid #000;
                border-radius: 10px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: bold;
                font-size: 16px;
                color: #000;
                box-shadow: 0 4px 8px rgba(0,0,0,0.3);
              }
            </style>
          </head>
          <body>
            <div class="scroll-marker" style="top: 50px;">TOP: 50px</div>
            <div class="scroll-marker" style="top: 1000px;">1000px Mark</div>
            <div class="scroll-marker" style="top: 2000px;">2000px Mark</div>
            <div class="scroll-marker" style="top: 3000px;">3000px Mark</div>
            <div class="scroll-marker" style="top: 4000px;">4000px Mark</div>
            <div class="scroll-marker" style="top: 5000px;">5000px Mark</div>
            <div class="scroll-marker" style="top: 5900px;">BOTTOM: 5900px</div>
          </body>
        </html>
      `;

      await session.navigate(`data:text/html,${encodeURIComponent(longPageHTML)}`);

      // Test from different scroll positions
      const scrollPositions = [0, 1500, 3000, 4500];
      const results: Buffer[] = [];

      for (const scrollY of scrollPositions) {
        // Scroll to position
        await session.scroll({ y: scrollY });

        // Verify scroll position
        const currentScroll = await session.page!.evaluate(() => ({
          x: window.scrollX,
          y: window.scrollY
        }));
        expect(currentScroll.y).toBe(scrollY);

        // Capture full page
        const result = await session.captureFullPage({ type: 'png' });
        expect(result.success).toBe(true);

        results.push(result.data!);

        console.log(`✅ Captured from scroll position ${scrollY}px: ${result.data!.length} bytes`);
      }

      // All captures should be identical regardless of scroll position
      for (let i = 1; i < results.length; i++) {
        expect(results[i].equals(results[0])).toBe(true);
      }

      // Parse final image dimensions to verify all content captured
      const finalData = results[results.length - 1];
      if (finalData[0] === 0x89 && finalData[1] === 0x50) {
        const height = finalData.readUInt32BE(20);
        expect(height).toBeGreaterThanOrEqual(6000); // Should capture full 6000px height

        console.log(`✅ Full page height captured: ${height}px (expected ≥6000px)`);
      }
    });

    it('should restore original scroll position after full page capture', async () => {
      const testPage = `
        <html>
          <body style="height: 4000px; background: linear-gradient(to bottom, #667eea, #764ba2);">
            <div style="position: absolute; top: 2000px; left: 50px; background: white; padding: 20px; border: 2px solid #333;">
              <h2>Middle Content at 2000px</h2>
            </div>
          </body>
        </html>
      `;

      await session.navigate(`data:text/html,${encodeURIComponent(testPage)}`);

      // Scroll to specific position
      const targetScrollY = 2000;
      await session.scroll({ y: targetScrollY });

      // Verify initial scroll position
      const beforeScroll = await session.page!.evaluate(() => ({
        x: window.scrollX,
        y: window.scrollY
      }));
      expect(beforeScroll.y).toBe(targetScrollY);

      // Capture full page
      const result = await session.captureFullPage({ type: 'png' });
      expect(result.success).toBe(true);

      // Verify scroll position restored
      const afterScroll = await session.page!.evaluate(() => ({
        x: window.scrollX,
        y: window.scrollY
      }));
      expect(afterScroll.y).toBe(targetScrollY);

      console.log(`✅ Scroll position preserved: ${beforeScroll.y} → capture → ${afterScroll.y}`);
    });

    it('should handle horizontal scroll content in full page capture', async () => {
      const widePageHTML = `
        <html>
          <head>
            <style>
              body {
                margin: 0;
                width: 4000px;
                height: 2000px;
                background: repeating-linear-gradient(
                  45deg,
                  #ff6b6b 0px,
                  #ff6b6b 100px,
                  #4ecdc4 100px,
                  #4ecdc4 200px
                );
              }
              .horizontal-marker {
                position: absolute;
                top: 100px;
                height: 100px;
                width: 150px;
                background: rgba(255, 255, 255, 0.9);
                border: 2px solid #000;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: bold;
                font-size: 12px;
                color: #000;
              }
              .vertical-marker {
                position: absolute;
                left: 100px;
                width: 150px;
                height: 80px;
                background: rgba(255, 255, 255, 0.9);
                border: 2px solid #000;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: bold;
                font-size: 12px;
                color: #000;
              }
            </style>
          </head>
          <body>
            <div class="horizontal-marker" style="left: 100px;">LEFT: 100px</div>
            <div class="horizontal-marker" style="left: 1000px;">1000px</div>
            <div class="horizontal-marker" style="left: 2000px;">2000px</div>
            <div class="horizontal-marker" style="left: 3000px;">3000px</div>
            <div class="horizontal-marker" style="left: 3800px;">RIGHT: 3800px</div>

            <div class="vertical-marker" style="top: 500px;">500px</div>
            <div class="vertical-marker" style="top: 1000px;">1000px</div>
            <div class="vertical-marker" style="top: 1500px;">1500px</div>
            <div class="vertical-marker" style="top: 1900px;">BOTTOM: 1900px</div>
          </body>
        </html>
      `;

      await session.navigate(`data:text/html,${encodeURIComponent(widePageHTML)}`);

      // Scroll horizontally to different positions
      await session.scroll({ x: 1500, y: 0 });

      const result = await session.captureFullPage({ type: 'png' });
      expect(result.success).toBe(true);

      // Parse dimensions to verify full width captured
      const data = result.data!;
      if (data[0] === 0x89 && data[1] === 0x50) {
        const width = data.readUInt32BE(16);
        const height = data.readUInt32BE(20);

        expect(width).toBeGreaterThanOrEqual(4000); // Should capture full 4000px width
        expect(height).toBeGreaterThanOrEqual(2000); // Should capture full 2000px height

        console.log(`✅ Wide page captured: ${width}x${height}px (expected ≥4000x2000px)`);
      }
    });
  });

  describe('Image Output Format and Dimensions Verification', () => {
    it('should produce PNG images with correct dimensions and metadata', async () => {
      const dimensionTestPage = `
        <html>
          <head>
            <style>
              body {
                margin: 0;
                height: 2400px;
                width: 100%;
                background: linear-gradient(45deg, #667eea, #764ba2);
              }
              .dimension-grid {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 20px;
                padding: 20px;
                height: 2000px;
              }
              .grid-item {
                background: rgba(255, 255, 255, 0.2);
                border: 2px solid white;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-weight: bold;
                font-size: 18px;
              }
            </style>
          </head>
          <body>
            <div class="dimension-grid">
              <div class="grid-item">Item 1</div>
              <div class="grid-item">Item 2</div>
              <div class="grid-item">Item 3</div>
              <div class="grid-item">Item 4</div>
            </div>
            <div style="height: 400px; background: rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center; color: white; font-size: 24px;">
              Footer Content
            </div>
          </body>
        </html>
      `;

      await session.navigate(`data:text/html,${encodeURIComponent(dimensionTestPage)}`);

      const result = await session.captureFullPage({ type: 'png' });
      expect(result.success).toBe(true);

      const data = result.data!;

      // Verify PNG signature and structure
      expect(data[0]).toBe(0x89); // PNG signature
      expect(data[1]).toBe(0x50);
      expect(data[2]).toBe(0x4E);
      expect(data[3]).toBe(0x47);

      // Parse IHDR chunk for dimensions
      const width = data.readUInt32BE(16);
      const height = data.readUInt32BE(20);
      const bitDepth = data[24];
      const colorType = data[25];

      // Verify image properties
      expect(width).toBe(1200); // Should match viewport width
      expect(height).toBeGreaterThanOrEqual(2400); // Should capture full height
      expect(bitDepth).toBe(8); // Standard 8-bit depth
      expect(colorType).toBeGreaterThanOrEqual(2); // Color type 2 (RGB) or higher

      console.log(`✅ PNG metadata: ${width}x${height}px, ${bitDepth}-bit, color type ${colorType}`);
    });

    it('should handle different aspect ratios correctly', async () => {
      const aspectRatioTests = [
        { width: 480, height: 800, ratio: '9:16 (portrait)' },
        { width: 1920, height: 1080, ratio: '16:9 (landscape)' },
        { width: 1024, height: 1024, ratio: '1:1 (square)' },
      ];

      for (const test of aspectRatioTests) {
        // Create new session with specific viewport
        await session.close();
        session = new BrowserSession(manager, {
          browserType: 'chromium',
          headless: true,
          viewport: { width: test.width, height: test.height }
        });
        await session.launch();

        const aspectTestPage = `
          <html>
            <body style="height: 3000px; background: linear-gradient(135deg, #667eea, #764ba2);">
              <div style="padding: 50px; color: white; text-align: center;">
                <h1>Aspect Ratio Test: ${test.ratio}</h1>
                <p>Viewport: ${test.width} x ${test.height}</p>
                <div style="height: 2800px; display: flex; align-items: center; justify-content: center; font-size: 24px;">
                  Full height content
                </div>
              </div>
            </body>
          </html>
        `;

        await session.navigate(`data:text/html,${encodeURIComponent(aspectTestPage)}`);

        const result = await session.captureFullPage({ type: 'png' });
        expect(result.success).toBe(true);

        const data = result.data!;
        const width = data.readUInt32BE(16);
        const height = data.readUInt32BE(20);

        expect(width).toBe(test.width);
        expect(height).toBeGreaterThanOrEqual(3000);

        const aspectRatio = width / height;
        console.log(`✅ ${test.ratio}: ${width}x${height}px (ratio: ${aspectRatio.toFixed(3)})`);
      }
    });

    it('should validate JPEG quality affects file size appropriately', async () => {
      const qualityTestPage = `
        <html>
          <head>
            <style>
              body {
                margin: 0;
                height: 2000px;
                background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50"><rect width="25" height="25" fill="%23ff0000"/><rect x="25" y="25" width="25" height="25" fill="%2300ff00"/><rect x="0" y="25" width="25" height="25" fill="%230000ff"/><rect x="25" y="0" width="25" height="25" fill="%23ffff00"/></svg>');
                background-size: 50px 50px;
              }
              .quality-text {
                position: absolute;
                top: 50px;
                left: 50px;
                background: rgba(255, 255, 255, 0.9);
                padding: 20px;
                border-radius: 10px;
                font-family: Arial, sans-serif;
                font-size: 18px;
                font-weight: bold;
              }
            </style>
          </head>
          <body>
            <div class="quality-text">
              JPEG Quality Test Page<br>
              Complex patterns and gradients<br>
              for compression analysis
            </div>
          </body>
        </html>
      `;

      await session.navigate(`data:text/html,${encodeURIComponent(qualityTestPage)}`);

      const qualities = [10, 30, 50, 70, 90, 100];
      const results = [];

      for (const quality of qualities) {
        const result = await session.captureFullPage({
          type: 'jpeg',
          quality
        });

        expect(result.success).toBe(true);
        expect(result.data![0]).toBe(0xFF); // JPEG signature
        expect(result.data![1]).toBe(0xD8);

        results.push({ quality, size: result.data!.length });
      }

      // Verify quality affects file size (higher quality = larger file)
      for (let i = 1; i < results.length; i++) {
        expect(results[i].size).toBeGreaterThanOrEqual(results[i-1].size);
      }

      console.log('✅ JPEG Quality analysis:');
      results.forEach(({ quality, size }) => {
        console.log(`   Quality ${quality}%: ${size} bytes`);
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle extremely long pages gracefully', async () => {
      const extremePageHTML = `
        <html>
          <body style="height: 50000px; background: linear-gradient(to bottom, red, blue);">
            <div style="position: absolute; top: 100px; left: 50px; background: white; padding: 20px;">
              TOP: 100px
            </div>
            <div style="position: absolute; top: 49900px; left: 50px; background: white; padding: 20px;">
              BOTTOM: 49900px
            </div>
          </body>
        </html>
      `;

      await session.navigate(`data:text/html,${encodeURIComponent(extremePageHTML)}`);

      const startTime = Date.now();
      const result = await session.captureFullPage({ type: 'png' });
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Buffer);

      // Should complete in reasonable time (less than 30 seconds)
      expect(duration).toBeLessThan(30000);

      console.log(`✅ Extreme page (50000px) captured in ${duration}ms: ${result.data!.length} bytes`);
    });

    it('should handle pages with complex CSS transforms and animations', async () => {
      const complexPage = `
        <html>
          <head>
            <style>
              body { margin: 0; height: 3000px; background: #f0f0f0; overflow-x: hidden; }
              .transform-container {
                position: absolute;
                top: 500px;
                left: 50%;
                transform: translateX(-50%);
                width: 300px;
                height: 300px;
                background: linear-gradient(45deg, #667eea, #764ba2);
                border-radius: 20px;
                transform-origin: center;
                animation: rotate 4s linear infinite;
              }
              @keyframes rotate {
                from { transform: translateX(-50%) rotate(0deg) scale(1); }
                to { transform: translateX(-50%) rotate(360deg) scale(1.2); }
              }
              .complex-element {
                position: absolute;
                top: 1000px;
                left: 100px;
                width: 400px;
                height: 200px;
                background: conic-gradient(from 0deg, red, yellow, green, cyan, blue, magenta, red);
                clip-path: polygon(50% 0%, 0% 100%, 100% 100%);
                filter: drop-shadow(10px 10px 20px rgba(0,0,0,0.3));
              }
            </style>
          </head>
          <body>
            <div class="transform-container"></div>
            <div class="complex-element"></div>
            <div style="position: absolute; top: 2000px; left: 50px; width: 90%; height: 500px; background: repeating-conic-gradient(#ff0000 0deg, #ff0000 30deg, #00ff00 30deg, #00ff00 60deg, #0000ff 60deg, #0000ff 90deg); border-radius: 50px;"></div>
          </body>
        </html>
      `;

      await session.navigate(`data:text/html,${encodeURIComponent(complexPage)}`);

      // Wait for animations to stabilize
      await new Promise(resolve => setTimeout(resolve, 500));

      const result = await session.captureFullPage({ type: 'jpeg', quality: 85 });

      expect(result.success).toBe(true);
      expect(result.data!.length).toBeGreaterThan(20000); // Complex graphics should produce substantial file

      console.log(`✅ Complex CSS page captured: ${result.data!.length} bytes`);
    });
  });
});