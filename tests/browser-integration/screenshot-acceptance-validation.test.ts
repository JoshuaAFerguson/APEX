/**
 * @fileoverview Screenshot Capture Acceptance Criteria Validation
 *
 * This test file validates the specific acceptance criteria for the screenshot
 * capture functionality integration:
 *
 * ACCEPTANCE CRITERIA:
 * ✅ Integration tests verify:
 *    - full page screenshots
 *    - element screenshots
 *    - screenshot file output
 *    - screenshot options (format, quality)
 * ✅ Tests produce valid image files and pass
 *
 * This is a focused test suite that specifically addresses each acceptance
 * criterion with clear validation steps.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
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

describe('Screenshot Capture Acceptance Criteria Validation', () => {
  let manager: BrowserManager;
  let session: BrowserSession;
  let tempDir: string;

  beforeEach(async () => {
    // Initialize browser automation
    manager = createBrowserManager();
    session = createBrowserSession(manager, {
      browserType: 'chromium',
      headless: true,
      viewport: { width: 1280, height: 720 }
    });

    await session.launch();

    // Create temporary directory for test files
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apex-screenshot-ac-'));

    // Set up test page with various elements
    const testPage = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 20px;
              background: linear-gradient(45deg, #ff6b6b, #4ecdc4);
              height: 150vh; /* Make page scrollable */
            }
            .header {
              background: white;
              padding: 30px;
              border-radius: 10px;
              margin-bottom: 30px;
              box-shadow: 0 4px 20px rgba(0,0,0,0.1);
            }
            .test-element {
              background: #3498db;
              color: white;
              padding: 20px;
              border-radius: 8px;
              margin: 20px 0;
              text-align: center;
            }
            .small-element {
              background: #e74c3c;
              color: white;
              padding: 10px;
              border-radius: 5px;
              display: inline-block;
              margin: 10px;
            }
            .large-content {
              height: 80vh;
              background: rgba(255,255,255,0.9);
              margin: 20px 0;
              padding: 40px;
              border-radius: 15px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Acceptance Criteria Test Page</h1>
            <p>Testing screenshot capture functionality</p>
          </div>

          <div id="primary-target" class="test-element">
            <h2>Primary Test Element</h2>
            <p>This element will be captured for element screenshots</p>
          </div>

          <div class="small-element" data-testid="small-target">Small Element</div>
          <div class="small-element">Another Small Element</div>

          <div class="large-content">
            <h2>Large Content Area</h2>
            <p>This area contains substantial content for full page testing.</p>
            <p>It includes multiple paragraphs and spans the full viewport height.</p>
            <div style="margin-top: 50px;">
              <h3>Additional Content Section</h3>
              <p>More content to ensure full page capture includes everything.</p>
            </div>
          </div>

          <footer style="background: rgba(0,0,0,0.8); color: white; padding: 20px; text-align: center; margin-top: 50px;">
            <p>Footer content - validates full page capture reaches the bottom</p>
          </footer>
        </body>
      </html>
    `;

    await session.navigate(`data:text/html,${encodeURIComponent(testPage)}`);
  });

  afterEach(async () => {
    // Clean up browser resources
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

  describe('AC1: Full Page Screenshots', () => {
    it('should capture full page screenshots successfully', async () => {
      console.log('🔍 Testing AC1: Full Page Screenshots');

      const result = await session.captureFullPage({ type: 'png' });

      // Verify screenshot was captured successfully
      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Buffer);
      expect(result.data!.length).toBeGreaterThan(5000); // Substantial image

      console.log(`✅ AC1 PASSED: Full page screenshot captured (${result.data!.length} bytes)`);
    });

    it('should capture full page screenshots in multiple formats', async () => {
      // Test PNG format
      const pngResult = await session.captureFullPage({ type: 'png' });
      expect(pngResult.success).toBe(true);

      // Verify PNG signature
      expect(pngResult.data![0]).toBe(0x89);
      expect(pngResult.data![1]).toBe(0x50);
      expect(pngResult.data![2]).toBe(0x4E);
      expect(pngResult.data![3]).toBe(0x47);

      // Test JPEG format
      const jpegResult = await session.captureFullPage({ type: 'jpeg', quality: 80 });
      expect(jpegResult.success).toBe(true);

      // Verify JPEG signature
      expect(jpegResult.data![0]).toBe(0xFF);
      expect(jpegResult.data![1]).toBe(0xD8);
      expect(jpegResult.data![2]).toBe(0xFF);

      console.log(`✅ AC1 PASSED: Full page formats - PNG: ${pngResult.data!.length}b, JPEG: ${jpegResult.data!.length}b`);
    });

    it('should capture full scrollable page content', async () => {
      // Capture full page (should include footer at bottom)
      const fullResult = await session.captureFullPage({ type: 'png' });

      // Capture just viewport (should be smaller)
      const viewportResult = await session.captureViewport({ type: 'png' });

      expect(fullResult.success).toBe(true);
      expect(viewportResult.success).toBe(true);

      // Full page should capture more content than viewport
      expect(fullResult.data!.length).toBeGreaterThan(viewportResult.data!.length);

      console.log(`✅ AC1 PASSED: Full page captures more content (${fullResult.data!.length}b vs ${viewportResult.data!.length}b)`);
    });
  });

  describe('AC2: Element Screenshots', () => {
    it('should capture element screenshots using CSS selectors', async () => {
      console.log('🔍 Testing AC2: Element Screenshots');

      const result = await session.captureElement('#primary-target');

      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Buffer);
      expect(result.data!.length).toBeGreaterThan(1000); // Should have content

      console.log(`✅ AC2 PASSED: Element screenshot via CSS selector (${result.data!.length} bytes)`);
    });

    it('should capture element screenshots using test ID selectors', async () => {
      const selector: ElementSelector = { type: 'testId', value: 'small-target' };
      const result = await session.captureElement(selector);

      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Buffer);
      expect(result.data!.length).toBeGreaterThan(0);

      console.log(`✅ AC2 PASSED: Element screenshot via test ID (${result.data!.length} bytes)`);
    });

    it('should capture element screenshots in different formats', async () => {
      // PNG element capture
      const pngResult = await session.captureElement('.test-element', { type: 'png' });
      expect(pngResult.success).toBe(true);

      // JPEG element capture
      const jpegResult = await session.captureElement('.test-element', { type: 'jpeg', quality: 75 });
      expect(jpegResult.success).toBe(true);

      // Verify format signatures
      expect(pngResult.data![0]).toBe(0x89); // PNG
      expect(jpegResult.data![0]).toBe(0xFF); // JPEG

      console.log(`✅ AC2 PASSED: Element formats - PNG: ${pngResult.data!.length}b, JPEG: ${jpegResult.data!.length}b`);
    });

    it('should handle multiple element captures', async () => {
      const elements = [
        '#primary-target',
        '.small-element',
        '.header'
      ];

      for (const element of elements) {
        const result = await session.captureElement(element);
        expect(result.success).toBe(true);
        expect(result.data!.length).toBeGreaterThan(0);
      }

      console.log(`✅ AC2 PASSED: Multiple element captures successful`);
    });
  });

  describe('AC3: Screenshot File Output', () => {
    it('should produce valid image files', async () => {
      console.log('🔍 Testing AC3: Screenshot File Output');

      const pngPath = path.join(tempDir, 'test-output.png');
      const jpegPath = path.join(tempDir, 'test-output.jpg');

      // Capture and save PNG
      const pngResult = await session.captureViewport({
        type: 'png',
        path: pngPath
      });

      // Capture and save JPEG
      const jpegResult = await session.captureViewport({
        type: 'jpeg',
        quality: 85,
        path: jpegPath
      });

      // Verify operations succeeded
      expect(pngResult.success).toBe(true);
      expect(jpegResult.success).toBe(true);

      // Verify files exist
      expect(fs.existsSync(pngPath)).toBe(true);
      expect(fs.existsSync(jpegPath)).toBe(true);

      // Verify file contents match buffer returns
      const pngFileBuffer = fs.readFileSync(pngPath);
      const jpegFileBuffer = fs.readFileSync(jpegPath);

      expect(pngFileBuffer.equals(pngResult.data!)).toBe(true);
      expect(jpegFileBuffer.equals(jpegResult.data!)).toBe(true);

      console.log(`✅ AC3 PASSED: Valid image files created - PNG: ${pngFileBuffer.length}b, JPEG: ${jpegFileBuffer.length}b`);
    });

    it('should validate image file headers', async () => {
      const pngPath = path.join(tempDir, 'header-test.png');
      const jpegPath = path.join(tempDir, 'header-test.jpg');

      await session.captureViewport({ type: 'png', path: pngPath });
      await session.captureViewport({ type: 'jpeg', path: jpegPath });

      // Read and validate PNG header
      const pngBuffer = fs.readFileSync(pngPath);
      expect(pngBuffer[0]).toBe(0x89);
      expect(pngBuffer[1]).toBe(0x50);
      expect(pngBuffer[2]).toBe(0x4E);
      expect(pngBuffer[3]).toBe(0x47);

      // Read and validate JPEG header
      const jpegBuffer = fs.readFileSync(jpegPath);
      expect(jpegBuffer[0]).toBe(0xFF);
      expect(jpegBuffer[1]).toBe(0xD8);
      expect(jpegBuffer[2]).toBe(0xFF);

      console.log(`✅ AC3 PASSED: Image file headers validated`);
    });

    it('should handle file output for element screenshots', async () => {
      const elementPath = path.join(tempDir, 'element-output.png');

      const result = await session.captureElement('#primary-target', {
        type: 'png',
        path: elementPath
      });

      expect(result.success).toBe(true);
      expect(fs.existsSync(elementPath)).toBe(true);

      const fileBuffer = fs.readFileSync(elementPath);
      expect(fileBuffer.equals(result.data!)).toBe(true);
      expect(fileBuffer.length).toBeGreaterThan(1000);

      console.log(`✅ AC3 PASSED: Element screenshot file output (${fileBuffer.length} bytes)`);
    });

    it('should handle file output for full page screenshots', async () => {
      const fullPagePath = path.join(tempDir, 'fullpage-output.jpg');

      const result = await session.captureFullPage({
        type: 'jpeg',
        quality: 80,
        path: fullPagePath
      });

      expect(result.success).toBe(true);
      expect(fs.existsSync(fullPagePath)).toBe(true);

      const fileBuffer = fs.readFileSync(fullPagePath);
      expect(fileBuffer.equals(result.data!)).toBe(true);
      expect(fileBuffer.length).toBeGreaterThan(5000);

      console.log(`✅ AC3 PASSED: Full page screenshot file output (${fileBuffer.length} bytes)`);
    });
  });

  describe('AC4: Screenshot Options (Format, Quality)', () => {
    it('should support PNG format option', async () => {
      console.log('🔍 Testing AC4: Screenshot Options - PNG Format');

      const result = await session.captureViewport({ type: 'png' });

      expect(result.success).toBe(true);

      // Verify PNG format
      expect(result.data![0]).toBe(0x89);
      expect(result.data![1]).toBe(0x50);
      expect(result.data![2]).toBe(0x4E);
      expect(result.data![3]).toBe(0x47);

      console.log(`✅ AC4 PASSED: PNG format option works (${result.data!.length} bytes)`);
    });

    it('should support JPEG format option', async () => {
      const result = await session.captureViewport({ type: 'jpeg' });

      expect(result.success).toBe(true);

      // Verify JPEG format
      expect(result.data![0]).toBe(0xFF);
      expect(result.data![1]).toBe(0xD8);
      expect(result.data![2]).toBe(0xFF);

      console.log(`✅ AC4 PASSED: JPEG format option works (${result.data!.length} bytes)`);
    });

    it('should support JPEG quality options', async () => {
      const highQuality = await session.captureViewport({ type: 'jpeg', quality: 95 });
      const medQuality = await session.captureViewport({ type: 'jpeg', quality: 75 });
      const lowQuality = await session.captureViewport({ type: 'jpeg', quality: 25 });

      expect(highQuality.success).toBe(true);
      expect(medQuality.success).toBe(true);
      expect(lowQuality.success).toBe(true);

      // Higher quality should generally produce larger files
      expect(highQuality.data!.length).toBeGreaterThan(lowQuality.data!.length);
      expect(medQuality.data!.length).toBeGreaterThan(lowQuality.data!.length);

      console.log(`✅ AC4 PASSED: JPEG quality options - High: ${highQuality.data!.length}b, Med: ${medQuality.data!.length}b, Low: ${lowQuality.data!.length}b`);
    });

    it('should support format and quality options for all capture methods', async () => {
      const methods = [
        { name: 'captureViewport', fn: () => session.captureViewport({ type: 'jpeg', quality: 80 }) },
        { name: 'captureFullPage', fn: () => session.captureFullPage({ type: 'jpeg', quality: 80 }) },
        { name: 'captureElement', fn: () => session.captureElement('#primary-target', { type: 'jpeg', quality: 80 }) }
      ];

      for (const method of methods) {
        const result = await method.fn();
        expect(result.success).toBe(true);

        // Verify JPEG format
        expect(result.data![0]).toBe(0xFF);
        expect(result.data![1]).toBe(0xD8);

        console.log(`✅ AC4: ${method.name} supports options (${result.data!.length} bytes)`);
      }

      console.log(`✅ AC4 PASSED: All capture methods support format and quality options`);
    });

    it('should validate quality range handling', async () => {
      const qualityTests = [
        { quality: 1, name: 'minimum' },
        { quality: 50, name: 'medium' },
        { quality: 100, name: 'maximum' }
      ];

      for (const test of qualityTests) {
        const result = await session.captureViewport({
          type: 'jpeg',
          quality: test.quality
        });

        expect(result.success).toBe(true);
        expect(result.data!.length).toBeGreaterThan(0);

        console.log(`✅ AC4: Quality ${test.quality} (${test.name}) works (${result.data!.length} bytes)`);
      }

      console.log(`✅ AC4 PASSED: Quality range validation successful`);
    });
  });

  describe('AC5: Integration Test Validation - Tests Pass', () => {
    it('should validate that all tests produce valid image files and pass', async () => {
      console.log('🔍 Testing AC5: Integration Test Validation');
      console.log('===========================================');

      // Comprehensive test of all functionality
      const testSuite = [
        {
          name: 'Full Page PNG',
          test: () => session.captureFullPage({ type: 'png' }),
          expectedFormat: 'png'
        },
        {
          name: 'Full Page JPEG',
          test: () => session.captureFullPage({ type: 'jpeg', quality: 85 }),
          expectedFormat: 'jpeg'
        },
        {
          name: 'Element PNG',
          test: () => session.captureElement('#primary-target', { type: 'png' }),
          expectedFormat: 'png'
        },
        {
          name: 'Element JPEG',
          test: () => session.captureElement('.test-element', { type: 'jpeg', quality: 75 }),
          expectedFormat: 'jpeg'
        },
        {
          name: 'Viewport PNG with File',
          test: () => session.captureViewport({ type: 'png', path: path.join(tempDir, 'viewport-test.png') }),
          expectedFormat: 'png',
          fileOutput: true
        },
        {
          name: 'Viewport JPEG with File',
          test: () => session.captureViewport({ type: 'jpeg', quality: 90, path: path.join(tempDir, 'viewport-test.jpg') }),
          expectedFormat: 'jpeg',
          fileOutput: true
        }
      ];

      let passedTests = 0;
      let totalSize = 0;

      for (const testCase of testSuite) {
        try {
          const result = await testCase.test();

          // Validate basic success
          expect(result.success).toBe(true);
          expect(result.data).toBeInstanceOf(Buffer);
          expect(result.data!.length).toBeGreaterThan(0);

          // Validate format
          const expectedSig = testCase.expectedFormat === 'png' ? [0x89, 0x50, 0x4E, 0x47] : [0xFF, 0xD8, 0xFF];
          for (let i = 0; i < expectedSig.length; i++) {
            expect(result.data![i]).toBe(expectedSig[i]);
          }

          passedTests++;
          totalSize += result.data!.length;

          console.log(`✅ ${testCase.name}: PASSED (${result.data!.length} bytes)`);

        } catch (error) {
          console.log(`❌ ${testCase.name}: FAILED - ${error}`);
          throw error; // Re-throw to fail the test
        }
      }

      // Final validation
      expect(passedTests).toBe(testSuite.length);
      expect(totalSize).toBeGreaterThan(10000); // Substantial total image data

      console.log('\n🎉 ACCEPTANCE CRITERIA VALIDATION COMPLETE');
      console.log('==========================================');
      console.log(`✅ All ${passedTests} tests PASSED`);
      console.log(`📊 Total image data: ${totalSize} bytes`);
      console.log(`📸 Screenshot functionality meets ALL acceptance criteria`);

      console.log('\n📋 ACCEPTANCE CRITERIA SUMMARY:');
      console.log('✅ Full page screenshots - IMPLEMENTED AND TESTED');
      console.log('✅ Element screenshots - IMPLEMENTED AND TESTED');
      console.log('✅ Screenshot file output - IMPLEMENTED AND TESTED');
      console.log('✅ Screenshot options (format, quality) - IMPLEMENTED AND TESTED');
      console.log('✅ Tests produce valid image files and pass - VERIFIED');

      // This test should always pass if we reach here
      expect(true).toBe(true);
    }, 30000); // Extended timeout for comprehensive test
  });
});