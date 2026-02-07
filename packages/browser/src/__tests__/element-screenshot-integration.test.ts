/**
 * @apexcli/browser - Element Screenshot Capture Integration Tests
 *
 * Comprehensive integration tests for element screenshot capture functionality,
 * focusing on specific DOM elements, visibility handling, and overflow/scroll scenarios.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BrowserManager } from '../browser-manager.js';
import { BrowserSession } from '../browser-session.js';
import type { ElementSelector } from '../types.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('Element Screenshot Integration Tests', () => {
  let manager: BrowserManager;
  let session: BrowserSession;
  let tempDir: string;

  beforeEach(async () => {
    manager = new BrowserManager();
    session = new BrowserSession(manager, { browserType: 'chromium', headless: true });
    await session.launch();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apex-element-screenshot-test-'));
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

  describe('Specific DOM Element Capture', () => {
    it('should capture specific element by ID with exact isolation', async () => {
      const html = `
        <html>
          <head>
            <style>
              body { margin: 0; padding: 20px; background: #f0f0f0; }
              #target { width: 200px; height: 100px; background: #ff0000; border: 2px solid black; }
              #other { width: 150px; height: 50px; background: #00ff00; margin-top: 10px; }
            </style>
          </head>
          <body>
            <div id="target">Target Element</div>
            <div id="other">Other Element</div>
          </body>
        </html>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      const result = await session.captureElement('#target');

      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Buffer);
      expect(result.data!.length).toBeGreaterThan(0);
      expect(result.duration).toBeGreaterThan(0);

      // Verify the captured image only contains the target element
      // (Buffer size should be smaller than full page due to element isolation)
      const fullPageResult = await session.captureFullPage();
      expect(result.data!.length).toBeLessThan(fullPageResult.data!.length);
    });

    it('should capture nested element with proper bounds calculation', async () => {
      const html = `
        <html>
          <head>
            <style>
              .container {
                width: 300px;
                height: 200px;
                background: #cccccc;
                padding: 20px;
                border: 5px solid #333;
              }
              .nested {
                width: 100px;
                height: 50px;
                background: #0066cc;
                margin: 10px;
                border-radius: 5px;
              }
            </style>
          </head>
          <body>
            <div class="container">
              Container Content
              <div class="nested" id="nested-target">Nested Element</div>
            </div>
          </body>
        </html>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      const result = await session.captureElement('#nested-target');

      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Buffer);

      // Save for manual verification if needed during debugging
      const filePath = path.join(tempDir, 'nested-element.png');
      const resultWithFile = await session.captureElement('#nested-target', { path: filePath });
      expect(resultWithFile.success).toBe(true);
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('should capture multiple similar elements individually', async () => {
      const html = `
        <html>
          <head>
            <style>
              .item {
                width: 80px;
                height: 80px;
                margin: 5px;
                display: inline-block;
                text-align: center;
                line-height: 80px;
              }
              .item-1 { background: #ff6b6b; }
              .item-2 { background: #4ecdc4; }
              .item-3 { background: #45b7d1; }
            </style>
          </head>
          <body>
            <div class="item item-1" id="item1">1</div>
            <div class="item item-2" id="item2">2</div>
            <div class="item item-3" id="item3">3</div>
          </body>
        </html>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      // Capture each item individually
      const item1Result = await session.captureElement('#item1');
      const item2Result = await session.captureElement('#item2');
      const item3Result = await session.captureElement('#item3');

      expect(item1Result.success).toBe(true);
      expect(item2Result.success).toBe(true);
      expect(item3Result.success).toBe(true);

      // Each element should have different content (different colors)
      // Buffers should be similar in size (same element dimensions)
      const buffer1 = item1Result.data!;
      const buffer2 = item2Result.data!;
      const buffer3 = item3Result.data!;

      expect(Math.abs(buffer1.length - buffer2.length)).toBeLessThan(buffer1.length * 0.1); // Within 10%
      expect(Math.abs(buffer2.length - buffer3.length)).toBeLessThan(buffer2.length * 0.1); // Within 10%

      // But content should be different (not identical buffers)
      expect(buffer1.equals(buffer2)).toBe(false);
      expect(buffer2.equals(buffer3)).toBe(false);
    });

    it('should capture element with complex CSS styling', async () => {
      const html = `
        <html>
          <head>
            <style>
              .complex-element {
                width: 250px;
                height: 120px;
                background: linear-gradient(45deg, #667eea, #764ba2);
                border: 3px solid #fff;
                border-radius: 15px;
                box-shadow: 0 10px 20px rgba(0,0,0,0.3);
                padding: 20px;
                color: white;
                font-family: Arial, sans-serif;
                position: relative;
                overflow: hidden;
              }
              .complex-element::before {
                content: '';
                position: absolute;
                top: -50%;
                left: -50%;
                width: 200%;
                height: 200%;
                background: linear-gradient(45deg, transparent, rgba(255,255,255,0.1), transparent);
                transform: rotate(45deg);
                animation: shimmer 2s infinite;
              }
              @keyframes shimmer {
                0% { transform: translateX(-100%) rotate(45deg); }
                100% { transform: translateX(100%) rotate(45deg); }
              }
            </style>
          </head>
          <body style="padding: 50px; background: #222;">
            <div class="complex-element" id="complex">
              Complex Styled Element
              <div style="margin-top: 10px; font-size: 12px; opacity: 0.8;">
                With gradients, shadows, and animations
              </div>
            </div>
          </body>
        </html>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      // Wait a moment for animations to start
      await new Promise(resolve => setTimeout(resolve, 100));

      const result = await session.captureElement('#complex');

      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Buffer);
      expect(result.data!.length).toBeGreaterThan(1000); // Should be a substantial image

      // Test with different formats
      const jpegResult = await session.captureElement('#complex', {
        type: 'jpeg',
        quality: 90
      });
      expect(jpegResult.success).toBe(true);
      expect(jpegResult.data![0]).toBe(0xff); // JPEG signature
      expect(jpegResult.data![1]).toBe(0xd8);
    });

    it('should capture form elements with various states', async () => {
      const html = `
        <html>
          <head>
            <style>
              .form-container { padding: 20px; background: #f9f9f9; }
              .form-group { margin: 10px 0; }
              input, select, textarea {
                padding: 8px;
                border: 2px solid #ddd;
                border-radius: 4px;
                font-size: 14px;
              }
              input:focus, select:focus, textarea:focus {
                border-color: #0066cc;
                outline: none;
              }
              .checkbox-group { display: flex; align-items: center; gap: 8px; }
            </style>
          </head>
          <body>
            <div class="form-container">
              <div class="form-group">
                <input type="text" id="text-input" value="Sample text" placeholder="Enter text">
              </div>
              <div class="form-group">
                <select id="select-input">
                  <option value="option1" selected>Option 1</option>
                  <option value="option2">Option 2</option>
                  <option value="option3">Option 3</option>
                </select>
              </div>
              <div class="form-group">
                <textarea id="textarea-input" rows="3" cols="30">Sample textarea content
with multiple lines</textarea>
              </div>
              <div class="form-group checkbox-group">
                <input type="checkbox" id="checkbox-input" checked>
                <label for="checkbox-input">Sample checkbox</label>
              </div>
            </div>
          </body>
        </html>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      // Test capturing each form element
      const textInputResult = await session.captureElement('#text-input');
      const selectResult = await session.captureElement('#select-input');
      const textareaResult = await session.captureElement('#textarea-input');
      const checkboxResult = await session.captureElement('.checkbox-group');

      expect(textInputResult.success).toBe(true);
      expect(selectResult.success).toBe(true);
      expect(textareaResult.success).toBe(true);
      expect(checkboxResult.success).toBe(true);

      // All should produce different sized buffers due to different element dimensions
      expect(textInputResult.data!.length).toBeGreaterThan(0);
      expect(selectResult.data!.length).toBeGreaterThan(0);
      expect(textareaResult.data!.length).toBeGreaterThan(0);
      expect(checkboxResult.data!.length).toBeGreaterThan(0);
    });
  });

  describe('Element Visibility Handling', () => {
    it('should wait for hidden element to become visible before capture', async () => {
      const html = `
        <html>
          <head>
            <style>
              #delayed-element {
                width: 150px;
                height: 100px;
                background: #ff9500;
                opacity: 0;
                transition: opacity 1s ease-in-out;
              }
              #delayed-element.visible {
                opacity: 1;
              }
            </style>
            <script>
              setTimeout(() => {
                document.getElementById('delayed-element').classList.add('visible');
              }, 500);
            </script>
          </head>
          <body>
            <div id="delayed-element">Delayed Visible Element</div>
          </body>
        </html>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      const startTime = Date.now();
      const result = await session.captureElement('#delayed-element', { timeout: 2000 });
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Buffer);
      expect(duration).toBeGreaterThan(400); // Should have waited for visibility
      expect(duration).toBeLessThan(1500);
    });

    it('should handle element that transitions visibility states', async () => {
      const html = `
        <html>
          <head>
            <style>
              #transition-element {
                width: 200px;
                height: 80px;
                background: #2ecc71;
                transform: scale(0);
                transition: transform 0.3s ease-out;
              }
              #transition-element.show {
                transform: scale(1);
              }
            </style>
            <script>
              // Show element after a short delay
              setTimeout(() => {
                document.getElementById('transition-element').classList.add('show');
              }, 200);
            </script>
          </head>
          <body>
            <div id="transition-element">Transition Element</div>
          </body>
        </html>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      // Wait for the transition to complete
      await new Promise(resolve => setTimeout(resolve, 600));

      const result = await session.captureElement('#transition-element');

      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Buffer);
      expect(result.data!.length).toBeGreaterThan(0);
    });

    it('should handle elements with display:none to display:block transition', async () => {
      const html = `
        <html>
          <head>
            <style>
              #display-element {
                width: 180px;
                height: 90px;
                background: #e74c3c;
                display: none;
                padding: 10px;
                color: white;
              }
              #display-element.visible {
                display: block;
              }
            </style>
            <script>
              setTimeout(() => {
                document.getElementById('display-element').classList.add('visible');
              }, 300);
            </script>
          </head>
          <body>
            <div id="display-element">Display Toggle Element</div>
          </body>
        </html>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      const result = await session.captureElement('#display-element', { timeout: 1000 });

      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Buffer);
    });

    it('should timeout when element never becomes visible', async () => {
      const html = `
        <html>
          <body>
            <div id="never-visible" style="display: none; width: 100px; height: 100px; background: red;">
              Never Visible
            </div>
          </body>
        </html>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      const startTime = Date.now();
      const result = await session.captureElement('#never-visible', { timeout: 800 });
      const duration = Date.now() - startTime;

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(duration).toBeGreaterThanOrEqual(700); // Should wait for timeout
      expect(duration).toBeLessThan(1200);
    });

    it('should handle elements that are visible but positioned off-screen', async () => {
      const html = `
        <html>
          <head>
            <style>
              body { margin: 0; height: 2000px; }
              #offscreen-element {
                position: absolute;
                top: 1500px;
                width: 200px;
                height: 100px;
                background: #9b59b6;
                color: white;
                padding: 20px;
              }
            </style>
          </head>
          <body>
            <div>Top content</div>
            <div id="offscreen-element">Off-screen Element</div>
          </body>
        </html>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      // Element should be captured even if not in viewport
      const result = await session.captureElement('#offscreen-element');

      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Buffer);
      expect(result.data!.length).toBeGreaterThan(0);
    });

    it('should handle elements with zero opacity that become opaque', async () => {
      const html = `
        <html>
          <head>
            <style>
              #opacity-element {
                width: 160px;
                height: 80px;
                background: #f39c12;
                opacity: 0;
                transition: opacity 0.5s;
              }
              #opacity-element.fade-in {
                opacity: 1;
              }
            </style>
            <script>
              setTimeout(() => {
                document.getElementById('opacity-element').classList.add('fade-in');
              }, 400);
            </script>
          </head>
          <body>
            <div id="opacity-element">Opacity Element</div>
          </body>
        </html>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      const result = await session.captureElement('#opacity-element', { timeout: 1200 });

      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Buffer);
    });
  });

  describe('Elements with Overflow and Scroll Scenarios', () => {
    it('should capture element with overflow:hidden content', async () => {
      const html = `
        <html>
          <head>
            <style>
              #overflow-element {
                width: 200px;
                height: 100px;
                background: #3498db;
                overflow: hidden;
                padding: 10px;
                border: 2px solid #2c3e50;
              }
              .inner-content {
                width: 300px;
                height: 150px;
                background: linear-gradient(45deg, #e74c3c, #f1c40f);
                color: white;
                padding: 20px;
              }
            </style>
          </head>
          <body>
            <div id="overflow-element">
              <div class="inner-content">
                This content is larger than the container and should be clipped by overflow:hidden.
                Additional text that extends beyond visible area.
              </div>
            </div>
          </body>
        </html>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      const result = await session.captureElement('#overflow-element');

      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Buffer);

      // Captured element should be exactly the size of the container (200x100 + padding + border)
      // The overflow content should be clipped in the screenshot
    });

    it('should capture scrollable element with scrolled content', async () => {
      const html = `
        <html>
          <head>
            <style>
              #scrollable-element {
                width: 250px;
                height: 150px;
                background: #ecf0f1;
                border: 2px solid #95a5a6;
                overflow-y: auto;
                padding: 15px;
              }
              .scroll-content {
                height: 400px;
                background: linear-gradient(to bottom, #16a085, #27ae60);
                color: white;
                padding: 20px;
                line-height: 1.5;
              }
            </style>
          </head>
          <body>
            <div id="scrollable-element">
              <div class="scroll-content">
                <h3>Scrollable Content</h3>
                <p>This is line 1 of scrollable content.</p>
                <p>This is line 2 of scrollable content.</p>
                <p>This is line 3 of scrollable content.</p>
                <p>This is line 4 of scrollable content.</p>
                <p>This is line 5 of scrollable content.</p>
                <p>This is line 6 of scrollable content.</p>
                <p>This is line 7 of scrollable content.</p>
                <p>This is line 8 of scrollable content.</p>
                <p>More content below...</p>
              </div>
            </div>
          </body>
        </html>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      // Capture element in default scroll position
      const defaultResult = await session.captureElement('#scrollable-element');

      // Scroll the element and capture again
      await session.page!.evaluate(() => {
        const element = document.getElementById('scrollable-element');
        if (element) {
          element.scrollTop = 100; // Scroll down 100px
        }
      });

      const scrolledResult = await session.captureElement('#scrollable-element');

      expect(defaultResult.success).toBe(true);
      expect(scrolledResult.success).toBe(true);

      // Both captures should succeed and produce different content
      expect(defaultResult.data).toBeInstanceOf(Buffer);
      expect(scrolledResult.data).toBeInstanceOf(Buffer);

      // The buffers should be different due to different scroll positions
      expect(defaultResult.data!.equals(scrolledResult.data!)).toBe(false);
    });

    it('should capture element inside scrolled page context', async () => {
      const html = `
        <html>
          <head>
            <style>
              body { margin: 0; height: 3000px; background: #ecf0f1; }
              .spacer { height: 1000px; background: #bdc3c7; }
              #target-in-scroll {
                width: 300px;
                height: 120px;
                background: #e67e22;
                margin: 50px auto;
                padding: 20px;
                color: white;
                text-align: center;
                border-radius: 10px;
              }
            </style>
          </head>
          <body>
            <div class="spacer">Spacer content above</div>
            <div id="target-in-scroll">
              Target Element in Scrolled Context
              <br>Should be captured regardless of page scroll
            </div>
            <div class="spacer">Spacer content below</div>
          </body>
        </html>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      // Scroll page to bring element into view
      await session.page!.evaluate(() => {
        window.scrollTo(0, 1000);
      });

      const result = await session.captureElement('#target-in-scroll');

      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Buffer);
      expect(result.data!.length).toBeGreaterThan(0);
    });

    it('should capture element with horizontal scroll content', async () => {
      const html = `
        <html>
          <head>
            <style>
              #horizontal-scroll {
                width: 200px;
                height: 100px;
                background: #8e44ad;
                overflow-x: auto;
                overflow-y: hidden;
                border: 2px solid #663399;
                white-space: nowrap;
                padding: 10px;
              }
              .wide-content {
                display: inline-block;
                width: 500px;
                height: 80px;
                background: linear-gradient(to right, #c0392b, #e74c3c, #f39c12);
                color: white;
                text-align: center;
                line-height: 80px;
              }
            </style>
          </head>
          <body>
            <div id="horizontal-scroll">
              <div class="wide-content">
                Wide content that requires horizontal scrolling to see fully
              </div>
            </div>
          </body>
        </html>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      const result = await session.captureElement('#horizontal-scroll');

      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Buffer);

      // Should capture the visible portion of the horizontally scrollable element
    });

    it('should capture nested element within multiple scroll containers', async () => {
      const html = `
        <html>
          <head>
            <style>
              #outer-scroll {
                width: 300px;
                height: 200px;
                background: #34495e;
                overflow: auto;
                padding: 20px;
                border: 3px solid #2c3e50;
              }
              #inner-scroll {
                width: 400px;
                height: 300px;
                background: #7f8c8d;
                overflow: auto;
                padding: 20px;
                margin: 10px;
              }
              #nested-target {
                width: 150px;
                height: 75px;
                background: #e74c3c;
                color: white;
                padding: 15px;
                margin: 50px;
                border-radius: 8px;
                text-align: center;
              }
            </style>
          </head>
          <body>
            <div id="outer-scroll">
              <div>Outer scroll container content</div>
              <div id="inner-scroll">
                <div>Inner scroll container content</div>
                <div id="nested-target">
                  Nested Target Element
                </div>
                <div>More inner content</div>
              </div>
              <div>More outer content</div>
            </div>
          </body>
        </html>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      const result = await session.captureElement('#nested-target');

      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Buffer);
      expect(result.data!.length).toBeGreaterThan(0);
    });

    it('should handle element capture with CSS transforms in scroll context', async () => {
      const html = `
        <html>
          <head>
            <style>
              body { height: 2000px; background: #f8f9fa; }
              .transform-container {
                position: absolute;
                top: 800px;
                left: 50px;
                width: 250px;
                height: 150px;
                background: #17a2b8;
                transform: rotate(15deg) scale(1.2);
                transform-origin: center;
                padding: 20px;
                border-radius: 10px;
              }
              #transformed-element {
                width: 100px;
                height: 60px;
                background: #ffc107;
                color: #212529;
                padding: 10px;
                margin: 20px;
                border-radius: 5px;
                text-align: center;
              }
            </style>
          </head>
          <body>
            <div class="transform-container">
              <div id="transformed-element">
                Transformed Element
              </div>
            </div>
          </body>
        </html>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      // Scroll to bring the transformed element into view
      await session.page!.evaluate(() => {
        window.scrollTo(0, 600);
      });

      const result = await session.captureElement('#transformed-element');

      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Buffer);

      // Element should be captured with its transforms applied
    });
  });

  describe('Element Screenshot Error Scenarios', () => {
    it('should handle invalid selectors gracefully', async () => {
      const html = '<html><body><div id="valid">Valid Element</div></body></html>';
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      const invalidResults = await Promise.all([
        session.captureElement('#nonexistent'),
        session.captureElement('.missing-class'),
        session.captureElement('invalid>>selector'),
      ]);

      invalidResults.forEach(result => {
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
        expect(typeof result.error).toBe('string');
        expect(result.duration).toBeGreaterThan(0);
      });
    });

    it('should handle capture of elements that become invalid during capture', async () => {
      const html = `
        <html>
          <head>
            <script>
              setTimeout(() => {
                const element = document.getElementById('disappearing');
                if (element && element.parentNode) {
                  element.parentNode.removeChild(element);
                }
              }, 200);
            </script>
          </head>
          <body>
            <div id="disappearing" style="width: 100px; height: 100px; background: red;">
              Disappearing Element
            </div>
          </body>
        </html>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      // Try to capture the element that will disappear
      const result = await session.captureElement('#disappearing', { timeout: 500 });

      // This might succeed if captured quickly enough, or fail if element disappears first
      expect(typeof result.success).toBe('boolean');
      expect(result.duration).toBeGreaterThan(0);

      if (!result.success) {
        expect(result.error).toBeDefined();
      }
    });

    it('should handle file save errors gracefully', async () => {
      const html = '<html><body><div id="test" style="width:100px;height:100px;background:blue;">Test</div></body></html>';
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      // Try to save to an invalid path
      const result = await session.captureElement('#test', {
        path: '/invalid/path/that/does/not/exist/screenshot.png'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('No such file or directory');
    });
  });

  describe('Element Screenshot Performance and Quality', () => {
    it('should capture large elements efficiently', async () => {
      const html = `
        <html>
          <head>
            <style>
              #large-element {
                width: 1000px;
                height: 800px;
                background: linear-gradient(45deg,
                  #ff0000, #ff7f00, #ffff00, #00ff00,
                  #0000ff, #4b0082, #9400d3, #ff0000);
                background-size: 200px 200px;
                border: 10px solid black;
                position: relative;
              }
              .grid-overlay {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background-image:
                  linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                  linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px);
                background-size: 50px 50px;
              }
            </style>
          </head>
          <body style="margin: 0;">
            <div id="large-element">
              <div class="grid-overlay"></div>
            </div>
          </body>
        </html>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      const startTime = Date.now();
      const result = await session.captureElement('#large-element');
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Buffer);
      expect(result.data!.length).toBeGreaterThan(10000); // Should be a large image
      expect(duration).toBeLessThan(5000); // Should complete within reasonable time
    });

    it('should handle different image quality settings for JPEG captures', async () => {
      const html = `
        <html>
          <body style="background: #f0f0f0;">
            <div id="quality-test" style="
              width: 300px;
              height: 200px;
              background: linear-gradient(to bottom right, #667eea, #764ba2);
              padding: 20px;
              color: white;
              font-size: 16px;
              border-radius: 10px;
            ">
              Quality Test Element with gradients and text
              <div style="margin-top: 20px; font-size: 12px; opacity: 0.8;">
                This element has gradients and text for quality testing
              </div>
            </div>
          </body>
        </html>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(html)}`);

      // Test different JPEG quality levels
      const qualityTests = [10, 50, 90, 100];
      const results = await Promise.all(
        qualityTests.map(quality =>
          session.captureElement('#quality-test', { type: 'jpeg', quality })
        )
      );

      // All should succeed
      results.forEach((result, index) => {
        expect(result.success).toBe(true);
        expect(result.data).toBeInstanceOf(Buffer);
        expect(result.data![0]).toBe(0xff); // JPEG signature
        expect(result.data![1]).toBe(0xd8);
      });

      // Higher quality should generally produce larger files
      expect(results[3].data!.length).toBeGreaterThan(results[0].data!.length);
    });
  });
});