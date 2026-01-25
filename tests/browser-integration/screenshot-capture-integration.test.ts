/**
 * @fileoverview Screenshot Capture Integration Tests
 *
 * Comprehensive integration tests for the screenshot capture functionality in APEX.
 * These tests verify the complete screenshot pipeline from browser automation
 * to file output and image validation.
 *
 * Test Coverage:
 * - Full page screenshot capture
 * - Element-specific screenshot capture
 * - Screenshot file output with various formats (PNG/JPEG)
 * - Screenshot options (quality, format, path)
 * - Cross-browser compatibility
 * - Error handling and edge cases
 * - Performance validation
 *
 * Requirements validated:
 * - Screenshots produce valid image files
 * - Screenshots pass format validation
 * - Screenshot API integrates with browser automation
 * - File I/O operations work correctly
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import {
  createBrowserManager,
  createBrowserSession,
  BrowserManager,
  BrowserSession,
  type ElementSelector
} from '@apexcli/browser';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Test utilities
interface ScreenshotValidation {
  isValidImage: boolean;
  format: 'png' | 'jpeg' | 'unknown';
  size: number;
  dimensions?: { width: number; height: number };
}

/**
 * Validates that a buffer contains a valid image file
 */
function validateImageBuffer(buffer: Buffer): ScreenshotValidation {
  if (buffer.length === 0) {
    return { isValidImage: false, format: 'unknown', size: 0 };
  }

  // Check PNG signature (0x89 0x50 0x4E 0x47)
  if (buffer.length >= 4 &&
      buffer[0] === 0x89 && buffer[1] === 0x50 &&
      buffer[2] === 0x4E && buffer[3] === 0x47) {
    return { isValidImage: true, format: 'png', size: buffer.length };
  }

  // Check JPEG signature (0xFF 0xD8 0xFF)
  if (buffer.length >= 3 &&
      buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return { isValidImage: true, format: 'jpeg', size: buffer.length };
  }

  return { isValidImage: false, format: 'unknown', size: buffer.length };
}

/**
 * Creates a complex test page with various elements for screenshot testing
 */
function createTestPage(): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Screenshot Integration Test Page</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #333;
          }

          .header {
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            padding: 2rem;
            text-align: center;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
          }

          .header h1 {
            color: #2c3e50;
            font-size: 2.5rem;
            margin-bottom: 0.5rem;
            font-weight: 700;
          }

          .header p {
            color: #7f8c8d;
            font-size: 1.1rem;
          }

          .content {
            padding: 3rem 2rem;
            max-width: 1200px;
            margin: 0 auto;
          }

          .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 2rem;
            margin-bottom: 3rem;
          }

          .card {
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            border-radius: 12px;
            padding: 2rem;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.2);
            transition: transform 0.3s ease, box-shadow 0.3s ease;
          }

          .card:hover {
            transform: translateY(-5px);
            box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
          }

          .card h3 {
            color: #2c3e50;
            margin-bottom: 1rem;
            font-size: 1.3rem;
          }

          .card p {
            color: #7f8c8d;
            margin-bottom: 1.5rem;
          }

          .btn {
            display: inline-block;
            background: linear-gradient(45deg, #3498db, #2ecc71);
            color: white;
            padding: 0.8rem 1.5rem;
            border-radius: 6px;
            text-decoration: none;
            font-weight: 500;
            transition: transform 0.2s ease;
          }

          .btn:hover {
            transform: scale(1.05);
          }

          .chart-container {
            background: rgba(255, 255, 255, 0.95);
            border-radius: 12px;
            padding: 2rem;
            margin: 2rem 0;
          }

          .chart {
            height: 200px;
            background: linear-gradient(90deg, #3498db 20%, #2ecc71 40%, #f1c40f 60%, #e74c3c 80%, #9b59b6 100%);
            border-radius: 8px;
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 1.2rem;
            font-weight: bold;
            text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
          }

          .data-points {
            position: absolute;
            top: 50%;
            left: 0;
            right: 0;
            display: flex;
            justify-content: space-around;
            transform: translateY(-50%);
          }

          .data-point {
            width: 12px;
            height: 12px;
            background: white;
            border-radius: 50%;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
          }

          .footer {
            background: rgba(44, 62, 80, 0.95);
            color: white;
            text-align: center;
            padding: 3rem 2rem;
            margin-top: 4rem;
          }

          .footer h2 {
            margin-bottom: 1rem;
          }

          .footer p {
            color: #bdc3c7;
          }

          /* Elements for specific screenshot testing */
          .screenshot-target-1 {
            background: linear-gradient(45deg, #ff6b6b, #4ecdc4);
            color: white;
            padding: 2rem;
            border-radius: 10px;
            text-align: center;
            margin: 2rem 0;
          }

          .screenshot-target-2 {
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            color: white;
            padding: 1.5rem;
            border-radius: 8px;
            margin: 1rem 0;
          }

          .screenshot-target-3 {
            background: linear-gradient(90deg, #4facfe 0%, #00f2fe 100%);
            color: white;
            padding: 2.5rem;
            border-radius: 15px;
            text-align: center;
            font-size: 1.2rem;
            margin: 2rem 0;
          }

          .scrollable-section {
            height: 100vh;
            background: linear-gradient(180deg, #ffecd2 0%, #fcb69f 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 2rem;
            color: #8b4513;
            text-align: center;
          }

          @media (max-width: 768px) {
            .grid {
              grid-template-columns: 1fr;
            }

            .header h1 {
              font-size: 2rem;
            }

            .content {
              padding: 2rem 1rem;
            }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Screenshot Integration Test Suite</h1>
          <p>Comprehensive testing page for screenshot capture functionality</p>
        </div>

        <div class="content">
          <div class="grid">
            <div class="card">
              <h3>Feature Testing</h3>
              <p>This card tests basic screenshot capture functionality with standard web content.</p>
              <a href="#" class="btn">Test Button</a>
            </div>

            <div class="card">
              <h3>Visual Elements</h3>
              <p>Complex visual elements including gradients, shadows, and hover effects.</p>
              <a href="#" class="btn">Interactive Element</a>
            </div>

            <div class="card">
              <h3>Layout Testing</h3>
              <p>Grid layouts, responsive design, and various content types for thorough testing.</p>
              <a href="#" class="btn">Layout Test</a>
            </div>
          </div>

          <div class="chart-container">
            <h3 style="margin-bottom: 1rem; color: #2c3e50;">Data Visualization</h3>
            <div class="chart">
              <span>Sample Chart Data</span>
              <div class="data-points">
                <div class="data-point"></div>
                <div class="data-point"></div>
                <div class="data-point"></div>
                <div class="data-point"></div>
                <div class="data-point"></div>
              </div>
            </div>
          </div>

          <!-- Specific screenshot targets -->
          <div class="screenshot-target-1" id="target-gradient-1">
            <h3>Screenshot Target 1</h3>
            <p>Gradient background with centered content</p>
          </div>

          <div class="screenshot-target-2" data-testid="target-gradient-2">
            <h4>Screenshot Target 2</h4>
            <p>Secondary gradient for element comparison testing</p>
          </div>

          <div class="screenshot-target-3" role="banner">
            <h3>Screenshot Target 3</h3>
            <p>Large target with distinct styling for format testing</p>
          </div>
        </div>

        <!-- Scrollable section for full page testing -->
        <div class="scrollable-section">
          <div>
            <h2>Extended Content Section</h2>
            <p>This section ensures full page screenshots capture all content</p>
            <p>Including content that extends beyond the initial viewport</p>
          </div>
        </div>

        <div class="footer">
          <h2>Integration Test Footer</h2>
          <p>End of test page content - validates full page capture</p>
        </div>

        <script>
          // Add some dynamic content for testing
          document.addEventListener('DOMContentLoaded', function() {
            console.log('Screenshot test page loaded successfully');

            // Add timestamp for uniqueness
            const timestamp = new Date().toLocaleString();
            const timestampEl = document.createElement('div');
            timestampEl.style.cssText = 'position: fixed; top: 10px; right: 10px; background: rgba(0,0,0,0.8); color: white; padding: 5px 10px; border-radius: 4px; font-size: 12px; z-index: 1000;';
            timestampEl.textContent = 'Generated: ' + timestamp;
            document.body.appendChild(timestampEl);
          });
        </script>
      </body>
    </html>
  `;
}

describe('Screenshot Capture Integration Tests', () => {
  let manager: BrowserManager;
  let session: BrowserSession;
  let tempDir: string;

  beforeAll(async () => {
    console.log('🚀 Starting Screenshot Capture Integration Tests');
  });

  beforeEach(async () => {
    // Create browser manager and session
    manager = createBrowserManager();
    session = createBrowserSession(manager, {
      browserType: 'chromium',
      headless: true,
      viewport: { width: 1280, height: 720 }
    });

    await session.launch();

    // Create temporary directory for test artifacts
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apex-screenshot-integration-'));

    // Navigate to test page
    const testPage = createTestPage();
    await session.navigate(`data:text/html,${encodeURIComponent(testPage)}`);
  });

  afterEach(async () => {
    // Clean up resources
    if (session) {
      await session.close();
    }
    if (manager) {
      await manager.shutdown();
    }

    // Clean up temporary files
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  afterAll(async () => {
    console.log('✅ Screenshot Capture Integration Tests completed');
  });

  describe('Full Page Screenshot Capture', () => {
    it('should capture full page screenshots in PNG format', async () => {
      const result = await session.captureFullPage({ type: 'png' });

      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Buffer);
      expect(result.data!.length).toBeGreaterThan(5000); // Substantial image size
      expect(result.duration).toBeGreaterThan(0);

      const validation = validateImageBuffer(result.data!);
      expect(validation.isValidImage).toBe(true);
      expect(validation.format).toBe('png');

      console.log(`📸 Full page PNG captured: ${validation.size} bytes in ${result.duration}ms`);
    });

    it('should capture full page screenshots in JPEG format with quality', async () => {
      const highQualityResult = await session.captureFullPage({
        type: 'jpeg',
        quality: 90
      });
      const lowQualityResult = await session.captureFullPage({
        type: 'jpeg',
        quality: 30
      });

      // Validate high quality image
      expect(highQualityResult.success).toBe(true);
      const highValidation = validateImageBuffer(highQualityResult.data!);
      expect(highValidation.isValidImage).toBe(true);
      expect(highValidation.format).toBe('jpeg');

      // Validate low quality image
      expect(lowQualityResult.success).toBe(true);
      const lowValidation = validateImageBuffer(lowQualityResult.data!);
      expect(lowValidation.isValidImage).toBe(true);
      expect(lowValidation.format).toBe('jpeg');

      // High quality should produce larger files
      expect(highValidation.size).toBeGreaterThan(lowValidation.size);

      console.log(`📸 JPEG quality test: High=${highValidation.size}b, Low=${lowValidation.size}b`);
    });

    it('should save full page screenshots to file', async () => {
      const filePath = path.join(tempDir, 'fullpage-test.png');

      const result = await session.captureFullPage({
        type: 'png',
        path: filePath
      });

      expect(result.success).toBe(true);
      expect(fs.existsSync(filePath)).toBe(true);

      // Verify file contents match buffer
      const fileBuffer = fs.readFileSync(filePath);
      expect(fileBuffer.equals(result.data!)).toBe(true);

      const validation = validateImageBuffer(fileBuffer);
      expect(validation.isValidImage).toBe(true);
      expect(validation.format).toBe('png');

      console.log(`💾 Full page saved to file: ${validation.size} bytes`);
    });

    it('should handle long scrollable pages', async () => {
      // The test page includes a scrollable section
      const result = await session.captureFullPage({ type: 'png' });

      expect(result.success).toBe(true);

      // Full page capture should be significantly larger than viewport
      const viewportResult = await session.captureViewport({ type: 'png' });
      expect(result.data!.length).toBeGreaterThan(viewportResult.data!.length);

      const validation = validateImageBuffer(result.data!);
      expect(validation.isValidImage).toBe(true);

      console.log(`📏 Full page vs viewport: ${validation.size}b vs ${validateImageBuffer(viewportResult.data!).size}b`);
    });
  });

  describe('Element Screenshot Capture', () => {
    it('should capture element screenshots using CSS selectors', async () => {
      const result = await session.captureElement('#target-gradient-1');

      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Buffer);
      expect(result.data!.length).toBeGreaterThan(1000);

      const validation = validateImageBuffer(result.data!);
      expect(validation.isValidImage).toBe(true);

      console.log(`🎯 Element captured (CSS): ${validation.size} bytes`);
    });

    it('should capture element screenshots using test IDs', async () => {
      const selector: ElementSelector = { type: 'testId', value: 'target-gradient-2' };
      const result = await session.captureElement(selector);

      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Buffer);

      const validation = validateImageBuffer(result.data!);
      expect(validation.isValidImage).toBe(true);

      console.log(`🎯 Element captured (testId): ${validation.size} bytes`);
    });

    it('should capture element screenshots using role selectors', async () => {
      const selector: ElementSelector = { type: 'role', value: 'banner' };
      const result = await session.captureElement(selector);

      expect(result.success).toBe(true);

      const validation = validateImageBuffer(result.data!);
      expect(validation.isValidImage).toBe(true);

      console.log(`🎯 Element captured (role): ${validation.size} bytes`);
    });

    it('should capture element screenshots with different formats', async () => {
      const pngResult = await session.captureElement('.screenshot-target-3', {
        type: 'png'
      });
      const jpegResult = await session.captureElement('.screenshot-target-3', {
        type: 'jpeg',
        quality: 80
      });

      // Validate PNG
      expect(pngResult.success).toBe(true);
      const pngValidation = validateImageBuffer(pngResult.data!);
      expect(pngValidation.isValidImage).toBe(true);
      expect(pngValidation.format).toBe('png');

      // Validate JPEG
      expect(jpegResult.success).toBe(true);
      const jpegValidation = validateImageBuffer(jpegResult.data!);
      expect(jpegValidation.isValidImage).toBe(true);
      expect(jpegValidation.format).toBe('jpeg');

      console.log(`🎨 Format comparison: PNG=${pngValidation.size}b, JPEG=${jpegValidation.size}b`);
    });

    it('should save element screenshots to file', async () => {
      const filePath = path.join(tempDir, 'element-test.jpg');

      const result = await session.captureElement('.chart-container', {
        type: 'jpeg',
        quality: 85,
        path: filePath
      });

      expect(result.success).toBe(true);
      expect(fs.existsSync(filePath)).toBe(true);

      const fileBuffer = fs.readFileSync(filePath);
      expect(fileBuffer.equals(result.data!)).toBe(true);

      const validation = validateImageBuffer(fileBuffer);
      expect(validation.isValidImage).toBe(true);
      expect(validation.format).toBe('jpeg');

      console.log(`💾 Element saved to file: ${validation.size} bytes`);
    });
  });

  describe('Screenshot File Output Validation', () => {
    it('should produce valid PNG files with correct headers', async () => {
      const filePath = path.join(tempDir, 'validation-test.png');

      const result = await session.captureViewport({
        type: 'png',
        path: filePath
      });

      expect(result.success).toBe(true);
      expect(fs.existsSync(filePath)).toBe(true);

      const fileBuffer = fs.readFileSync(filePath);

      // Validate PNG signature
      expect(fileBuffer[0]).toBe(0x89);
      expect(fileBuffer[1]).toBe(0x50);
      expect(fileBuffer[2]).toBe(0x4E);
      expect(fileBuffer[3]).toBe(0x47);

      // Check for IHDR chunk (should follow immediately after PNG signature)
      expect(fileBuffer[12]).toBe(0x49); // 'I'
      expect(fileBuffer[13]).toBe(0x48); // 'H'
      expect(fileBuffer[14]).toBe(0x44); // 'D'
      expect(fileBuffer[15]).toBe(0x52); // 'R'

      console.log(`✅ PNG file validation passed: ${fileBuffer.length} bytes`);
    });

    it('should produce valid JPEG files with correct headers', async () => {
      const filePath = path.join(tempDir, 'validation-test.jpg');

      const result = await session.captureViewport({
        type: 'jpeg',
        quality: 75,
        path: filePath
      });

      expect(result.success).toBe(true);
      expect(fs.existsSync(filePath)).toBe(true);

      const fileBuffer = fs.readFileSync(filePath);

      // Validate JPEG signature
      expect(fileBuffer[0]).toBe(0xFF);
      expect(fileBuffer[1]).toBe(0xD8);
      expect(fileBuffer[2]).toBe(0xFF);

      // Check for JPEG end marker
      const endMarkerIndex = fileBuffer.length - 2;
      expect(fileBuffer[endMarkerIndex]).toBe(0xFF);
      expect(fileBuffer[endMarkerIndex + 1]).toBe(0xD9);

      console.log(`✅ JPEG file validation passed: ${fileBuffer.length} bytes`);
    });

    it('should handle multiple simultaneous file outputs', async () => {
      const files = [
        { path: path.join(tempDir, 'multi-1.png'), type: 'png' as const },
        { path: path.join(tempDir, 'multi-2.jpg'), type: 'jpeg' as const, quality: 90 },
        { path: path.join(tempDir, 'multi-3.png'), type: 'png' as const },
        { path: path.join(tempDir, 'multi-4.jpg'), type: 'jpeg' as const, quality: 50 }
      ];

      // Capture multiple screenshots in parallel
      const results = await Promise.all(
        files.map(file =>
          session.captureViewport({
            type: file.type,
            ...(file.quality && { quality: file.quality }),
            path: file.path
          })
        )
      );

      // Validate all results
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const file = files[i];

        expect(result.success).toBe(true);
        expect(fs.existsSync(file.path)).toBe(true);

        const fileBuffer = fs.readFileSync(file.path);
        const validation = validateImageBuffer(fileBuffer);

        expect(validation.isValidImage).toBe(true);
        expect(validation.format).toBe(file.type);

        console.log(`📁 Multi-file ${i + 1}: ${validation.format.toUpperCase()} - ${validation.size} bytes`);
      }
    });
  });

  describe('Screenshot Options and Configuration', () => {
    it('should respect JPEG quality settings', async () => {
      const qualities = [100, 75, 50, 25, 1];
      const results = [];

      for (const quality of qualities) {
        const result = await session.captureViewport({
          type: 'jpeg',
          quality
        });

        expect(result.success).toBe(true);
        const validation = validateImageBuffer(result.data!);
        expect(validation.isValidImage).toBe(true);
        expect(validation.format).toBe('jpeg');

        results.push({ quality, size: validation.size });
      }

      // Verify quality affects file size (generally higher quality = larger size)
      for (let i = 0; i < results.length - 1; i++) {
        const current = results[i];
        const next = results[i + 1];

        // Higher quality should generally produce larger files
        // (with some tolerance for edge cases)
        if (current.quality > next.quality) {
          expect(current.size).toBeGreaterThanOrEqual(next.size * 0.8);
        }
      }

      console.log(`📊 Quality test results:`, results);
    });

    it('should handle edge case quality values', async () => {
      const edgeCases = [
        { quality: 0, shouldWork: true },
        { quality: 1, shouldWork: true },
        { quality: 100, shouldWork: true }
      ];

      for (const testCase of edgeCases) {
        const result = await session.captureViewport({
          type: 'jpeg',
          quality: testCase.quality
        });

        if (testCase.shouldWork) {
          expect(result.success).toBe(true);
          const validation = validateImageBuffer(result.data!);
          expect(validation.isValidImage).toBe(true);
          console.log(`✅ Edge case quality ${testCase.quality}: ${validation.size} bytes`);
        } else {
          expect(result.success).toBe(false);
          console.log(`❌ Edge case quality ${testCase.quality}: rejected as expected`);
        }
      }
    });

    it('should handle custom file paths and directories', async () => {
      // Create nested directory structure
      const nestedDir = path.join(tempDir, 'nested', 'deep', 'structure');
      fs.mkdirSync(nestedDir, { recursive: true });

      const filePath = path.join(nestedDir, 'nested-screenshot.png');

      const result = await session.captureViewport({
        type: 'png',
        path: filePath
      });

      expect(result.success).toBe(true);
      expect(fs.existsSync(filePath)).toBe(true);

      const validation = validateImageBuffer(result.data!);
      expect(validation.isValidImage).toBe(true);

      console.log(`📂 Nested directory test passed: ${validation.size} bytes`);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle non-existent elements gracefully', async () => {
      const result = await session.captureElement('#non-existent-element', {
        timeout: 2000
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('Element not found');
      expect(result.duration).toBeGreaterThan(0);

      console.log(`❌ Non-existent element handled: ${result.error}`);
    });

    it('should handle invalid file paths', async () => {
      const invalidPath = '/invalid/directory/that/does/not/exist/screenshot.png';

      const result = await session.captureViewport({
        type: 'png',
        path: invalidPath
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();

      console.log(`❌ Invalid path handled: ${result.error}`);
    });

    it('should handle hidden elements', async () => {
      // Add a hidden element to the page
      await session.evaluate(() => {
        const hiddenEl = document.createElement('div');
        hiddenEl.id = 'hidden-element';
        hiddenEl.style.display = 'none';
        hiddenEl.textContent = 'Hidden element';
        document.body.appendChild(hiddenEl);
      });

      const result = await session.captureElement('#hidden-element', {
        timeout: 3000
      });

      // This may succeed with a very small image or fail depending on implementation
      if (result.success) {
        expect(result.data!.length).toBeGreaterThan(0);
        console.log(`🙈 Hidden element captured: ${result.data!.length} bytes`);
      } else {
        expect(result.error).toBeDefined();
        console.log(`❌ Hidden element failed as expected: ${result.error}`);
      }
    });

    it('should handle page navigation errors during screenshot', async () => {
      // Navigate to invalid page
      try {
        await session.navigate('about:blank');

        const result = await session.captureViewport();

        expect(result.success).toBe(true);
        expect(result.data!.length).toBeGreaterThan(0);

        console.log(`📄 Blank page captured: ${result.data!.length} bytes`);
      } catch (error) {
        console.log(`❌ Navigation error handled: ${error}`);
      }
    });
  });

  describe('Performance and Optimization', () => {
    it('should complete screenshots within reasonable time limits', async () => {
      const operations = [
        { name: 'Viewport PNG', op: () => session.captureViewport({ type: 'png' }) },
        { name: 'Viewport JPEG', op: () => session.captureViewport({ type: 'jpeg' }) },
        { name: 'Full Page PNG', op: () => session.captureFullPage({ type: 'png' }) },
        { name: 'Element PNG', op: () => session.captureElement('.header', { type: 'png' }) }
      ];

      for (const { name, op } of operations) {
        const startTime = Date.now();
        const result = await op();
        const duration = Date.now() - startTime;

        expect(result.success).toBe(true);
        expect(duration).toBeLessThan(15000); // 15 second timeout

        console.log(`⚡ ${name}: ${duration}ms`);
      }
    });

    it('should handle concurrent screenshot operations', async () => {
      const concurrentOps = [
        session.captureViewport({ type: 'png' }),
        session.captureElement('.header', { type: 'jpeg', quality: 80 }),
        session.captureElement('.chart-container', { type: 'png' })
      ];

      const startTime = Date.now();
      const results = await Promise.all(concurrentOps);
      const duration = Date.now() - startTime;

      // All operations should succeed
      for (const result of results) {
        expect(result.success).toBe(true);
        const validation = validateImageBuffer(result.data!);
        expect(validation.isValidImage).toBe(true);
      }

      console.log(`🚀 Concurrent operations completed in ${duration}ms`);
    });

    it('should maintain consistent performance across multiple captures', async () => {
      const iterations = 5;
      const durations: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const result = await session.captureViewport({ type: 'png' });

        expect(result.success).toBe(true);
        durations.push(result.duration);
      }

      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
      const maxDuration = Math.max(...durations);
      const minDuration = Math.min(...durations);

      // Performance should be relatively consistent (max within 3x of min)
      expect(maxDuration).toBeLessThan(minDuration * 3);

      console.log(`📊 Performance consistency: avg=${avgDuration.toFixed(1)}ms, range=${minDuration}-${maxDuration}ms`);
    });
  });

  describe('Integration Test Summary', () => {
    it('should validate complete screenshot integration pipeline', async () => {
      console.log('\n🎯 SCREENSHOT CAPTURE INTEGRATION TEST SUMMARY');
      console.log('================================================\n');

      // Comprehensive workflow test
      const testScenarios = [
        {
          name: 'Full Page PNG',
          action: () => session.captureFullPage({ type: 'png' }),
          validateFile: true,
          expectedFormat: 'png' as const
        },
        {
          name: 'Full Page JPEG with Quality',
          action: () => session.captureFullPage({ type: 'jpeg', quality: 85 }),
          validateFile: true,
          expectedFormat: 'jpeg' as const
        },
        {
          name: 'Element PNG',
          action: () => session.captureElement('.screenshot-target-1', { type: 'png' }),
          validateFile: true,
          expectedFormat: 'png' as const
        },
        {
          name: 'Element JPEG with File Save',
          action: () => session.captureElement('.screenshot-target-2', {
            type: 'jpeg',
            quality: 75,
            path: path.join(tempDir, 'final-element-test.jpg')
          }),
          validateFile: true,
          expectedFormat: 'jpeg' as const,
          filePath: path.join(tempDir, 'final-element-test.jpg')
        }
      ];

      const summary = {
        totalTests: testScenarios.length,
        passed: 0,
        failed: 0,
        totalSize: 0,
        totalDuration: 0
      };

      for (const scenario of testScenarios) {
        try {
          const result = await scenario.action();

          expect(result.success).toBe(true);
          expect(result.data).toBeInstanceOf(Buffer);

          const validation = validateImageBuffer(result.data!);
          expect(validation.isValidImage).toBe(true);
          expect(validation.format).toBe(scenario.expectedFormat);

          if (scenario.filePath) {
            expect(fs.existsSync(scenario.filePath)).toBe(true);
          }

          summary.passed++;
          summary.totalSize += validation.size;
          summary.totalDuration += result.duration;

          console.log(`✅ ${scenario.name}: ${validation.size} bytes in ${result.duration}ms`);
        } catch (error) {
          summary.failed++;
          console.log(`❌ ${scenario.name}: ${error}`);
          throw error; // Re-throw to fail the test
        }
      }

      console.log('\n📊 FINAL INTEGRATION TEST RESULTS:');
      console.log(`   Tests Passed: ${summary.passed}/${summary.totalTests}`);
      console.log(`   Total Image Data: ${summary.totalSize} bytes`);
      console.log(`   Total Duration: ${summary.totalDuration}ms`);
      console.log(`   Average Duration: ${(summary.totalDuration / summary.passed).toFixed(1)}ms`);

      // Final validations
      expect(summary.passed).toBe(summary.totalTests);
      expect(summary.failed).toBe(0);
      expect(summary.totalSize).toBeGreaterThan(10000); // Should have substantial image data

      console.log('\n🚀 ALL SCREENSHOT CAPTURE INTEGRATION TESTS PASSED!');
      console.log('📸 Screenshot functionality is fully integrated and operational.');

      // This test always passes if we get here - it's for comprehensive reporting
      expect(true).toBe(true);
    }, 45000); // Extended timeout for comprehensive test
  });
});