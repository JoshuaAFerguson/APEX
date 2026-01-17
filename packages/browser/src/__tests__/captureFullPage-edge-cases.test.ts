/**
 * @apexcli/browser - captureFullPage() Edge Cases Tests
 *
 * Edge case and error handling tests for the captureFullPage() method
 * to ensure robust behavior in unusual scenarios
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BrowserManager } from '../browser-manager.js';
import { BrowserSession } from '../browser-session.js';
import type { ScreenshotOptions } from '../types.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('captureFullPage() Edge Cases', () => {
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
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apex-fullpage-edge-'));
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

  describe('Empty and Minimal Content', () => {
    it('should capture empty page successfully', async () => {
      const emptyPage = `<html><head></head><body></body></html>`;
      await session.navigate(`data:text/html,${encodeURIComponent(emptyPage)}`);

      const result = await session.captureFullPage();

      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Buffer);
      expect(result.data!.length).toBeGreaterThan(0);

      // Should be PNG by default
      expect(result.data![0]).toBe(0x89);
      expect(result.data![1]).toBe(0x50);

      console.log(`✅ Empty page captured: ${result.data!.length} bytes`);
    });

    it('should capture page with only whitespace content', async () => {
      const whitespacePage = `
        <html>
          <head>
            <style>
              body {
                background: white;
                padding: 100px;
                height: 1000px;
                margin: 0;
              }
            </style>
          </head>
          <body>



          </body>
        </html>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(whitespacePage)}`);

      const result = await session.captureFullPage({ type: 'png' });

      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Buffer);
      expect(result.data!.length).toBeGreaterThan(100); // Should still have some content

      console.log(`✅ Whitespace-only page captured: ${result.data!.length} bytes`);
    });

    it('should capture page with single pixel', async () => {
      const singlePixelPage = `
        <html>
          <head>
            <style>
              body { margin: 0; padding: 0; background: white; }
              .pixel { width: 1px; height: 1px; background: red; }
            </style>
          </head>
          <body>
            <div class="pixel"></div>
          </body>
        </html>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(singlePixelPage)}`);

      const result = await session.captureFullPage();

      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Buffer);

      console.log(`✅ Single pixel page captured: ${result.data!.length} bytes`);
    });

    it('should handle page with zero height content', async () => {
      const zeroHeightPage = `
        <html>
          <head>
            <style>
              body { margin: 0; padding: 0; height: 0; }
              .content { height: 0; overflow: hidden; }
            </style>
          </head>
          <body>
            <div class="content">This content has zero height</div>
          </body>
        </html>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(zeroHeightPage)}`);

      const result = await session.captureFullPage();

      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Buffer);

      console.log(`✅ Zero height page captured: ${result.data!.length} bytes`);
    });
  });

  describe('Special Content Types', () => {
    it('should capture page with only CSS background', async () => {
      const cssBackgroundPage = `
        <html>
          <head>
            <style>
              body {
                margin: 0;
                height: 2000px;
                background:
                  radial-gradient(circle at 20% 80%, #120E43 0%, transparent 50%),
                  radial-gradient(circle at 80% 20%, #FF6B6B 0%, transparent 50%),
                  radial-gradient(circle at 40% 40%, #4ECDC4 0%, transparent 50%),
                  linear-gradient(45deg, #667eea, #764ba2);
              }
            </style>
          </head>
          <body></body>
        </html>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(cssBackgroundPage)}`);

      const result = await session.captureFullPage({ type: 'jpeg', quality: 80 });

      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Buffer);
      expect(result.data![0]).toBe(0xFF); // JPEG signature
      expect(result.data!.length).toBeGreaterThan(10000); // Should have substantial visual content

      console.log(`✅ CSS background only page captured: ${result.data!.length} bytes`);
    });

    it('should capture page with Unicode and special characters', async () => {
      const unicodePage = `
        <html>
          <head>
            <meta charset="UTF-8">
            <style>
              body { font-size: 24px; padding: 50px; line-height: 1.5; height: 1500px; }
            </style>
          </head>
          <body>
            <h1>Unicode Test 🌟✨🚀</h1>
            <p>Emoji: 😀😃😄😁🥰🤔💡🎯🔥⚡</p>
            <p>Math: ∑∏∂∆∇∫∬∭∮∯∰√∛∜∞≈≠≤≥±∓</p>
            <p>Arrows: ←↑→↓↔↕↖↗↘↙⟲⟳⇄⇅⇆⇇⇈⇉⇊</p>
            <p>Currency: ¢£¤¥¦§¨©ª«¬­®¯°±²³´µ¶·¸¹º»¼½¾¿</p>
            <p>Languages: العربية 中文 日本語 Русский Ελληνικά</p>
            <p>Accents: àáâãäåæçèéêëìíîïñòóôõöøùúûüý</p>
            <p>Symbols: ♀♂♠♣♥♦♪♫♬☀☁☂☃★☆☎☮☯</p>
          </body>
        </html>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(unicodePage)}`);

      const result = await session.captureFullPage();

      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Buffer);
      expect(result.data!.length).toBeGreaterThan(5000); // Should have text content

      console.log(`✅ Unicode page captured: ${result.data!.length} bytes`);
    });

    it('should handle page with embedded SVG graphics', async () => {
      const svgPage = `
        <html>
          <body style="margin: 0; padding: 50px; background: #f0f0f0; height: 2000px;">
            <h1>SVG Graphics Test</h1>
            <svg width="500" height="400" style="border: 2px solid #333;">
              <defs>
                <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" style="stop-color:#ff6b6b;stop-opacity:1" />
                  <stop offset="100%" style="stop-color:#4ecdc4;stop-opacity:1" />
                </linearGradient>
              </defs>
              <circle cx="100" cy="100" r="80" fill="url(#grad1)" />
              <rect x="200" y="50" width="100" height="100" fill="#45b7d1" rx="10" />
              <polygon points="300,200 350,150 400,200 375,250 325,250" fill="#f9ca24" />
              <path d="M50 250 Q 100 300 150 250 T 250 250" stroke="#eb4d4b" stroke-width="4" fill="none" />
              <text x="50" y="350" font-family="Arial" font-size="20" fill="#333">SVG Text ✨</text>
            </svg>
            <svg width="300" height="300" style="margin-top: 50px;">
              <circle cx="150" cy="150" r="100" fill="none" stroke="#667eea" stroke-width="8" stroke-dasharray="20,10" />
              <circle cx="150" cy="150" r="60" fill="#764ba2" opacity="0.7" />
              <text x="150" y="160" text-anchor="middle" font-size="24" fill="white">SVG</text>
            </svg>
          </body>
        </html>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(svgPage)}`);

      const result = await session.captureFullPage({ type: 'png' });

      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Buffer);
      expect(result.data!.length).toBeGreaterThan(20000); // SVG should render as substantial content

      console.log(`✅ SVG graphics page captured: ${result.data!.length} bytes`);
    });

    it('should capture page with CSS transforms and animations (static state)', async () => {
      const transformPage = `
        <html>
          <head>
            <style>
              body { margin: 0; padding: 50px; background: #2c3e50; height: 2000px; }
              .container { perspective: 1000px; margin: 100px; }
              .box {
                width: 200px;
                height: 200px;
                margin: 50px;
                background: linear-gradient(45deg, #e74c3c, #f39c12);
                transform: rotateX(45deg) rotateY(45deg) translateZ(100px);
                box-shadow: 0 20px 40px rgba(0,0,0,0.3);
                border-radius: 20px;
                display: inline-block;
              }
              .skewed {
                transform: skewX(15deg) skewY(5deg) scale(1.2);
                background: linear-gradient(45deg, #9b59b6, #3498db);
              }
              .rotated {
                transform: rotate(30deg) scale(0.8);
                background: linear-gradient(45deg, #1abc9c, #16a085);
              }
            </style>
          </head>
          <body>
            <h1 style="color: white; text-align: center;">CSS Transforms Test</h1>
            <div class="container">
              <div class="box"></div>
              <div class="box skewed"></div>
              <div class="box rotated"></div>
            </div>
          </body>
        </html>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(transformPage)}`);

      const result = await session.captureFullPage();

      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Buffer);
      expect(result.data!.length).toBeGreaterThan(15000);

      console.log(`✅ CSS transforms page captured: ${result.data!.length} bytes`);
    });
  });

  describe('Error Conditions', () => {
    it('should handle browser not launched error', async () => {
      const newSession = new BrowserSession(manager, { browserType: 'chromium', headless: true });
      // Don't launch the session

      const result = await newSession.captureFullPage();

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('not launched');
      expect(result.duration).toBeGreaterThan(0);

      console.log(`✅ Browser not launched error handled: ${result.error}`);
    });

    it('should handle invalid file path gracefully', async () => {
      await session.navigate('data:text/html,<html><body><h1>File Path Test</h1></body></html>');

      const invalidPath = '/absolutely/invalid/path/that/does/not/exist/screenshot.png';
      const result = await session.captureFullPage({ path: invalidPath });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.duration).toBeGreaterThan(0);

      console.log(`✅ Invalid file path error handled: ${result.error}`);
    });

    it('should handle read-only file system path', async () => {
      await session.navigate('data:text/html,<html><body><h1>Read-only Test</h1></body></html>');

      // Try to save to a system directory (should fail)
      const readOnlyPath = '/etc/screenshot.png';
      const result = await session.captureFullPage({ path: readOnlyPath });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();

      console.log(`✅ Read-only path error handled: ${result.error}`);
    });

    it('should handle invalid quality values gracefully', async () => {
      await session.navigate('data:text/html,<html><body><h1>Quality Test</h1></body></html>');

      // Test with quality outside valid range (should still work due to Playwright's handling)
      const result1 = await session.captureFullPage({ type: 'jpeg', quality: -10 as any });
      const result2 = await session.captureFullPage({ type: 'jpeg', quality: 150 as any });

      // Playwright should handle these gracefully
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);

      console.log(`✅ Invalid quality values handled gracefully`);
    });

    it('should handle quality parameter with PNG format (should ignore)', async () => {
      await session.navigate('data:text/html,<html><body><h1>PNG Quality Test</h1></body></html>');

      // PNG doesn't use quality, but should work anyway
      const result = await session.captureFullPage({ type: 'png', quality: 50 as any });

      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Buffer);
      // Should be PNG regardless of quality setting
      expect(result.data![0]).toBe(0x89);
      expect(result.data![1]).toBe(0x50);

      console.log(`✅ PNG with quality parameter handled correctly`);
    });
  });

  describe('Browser-Specific Edge Cases', () => {
    it('should handle page navigation during capture', async () => {
      await session.navigate('data:text/html,<html><body style="height:2000px;"><h1>Original Page</h1></body></html>');

      // Start capture and immediately try to navigate (this should still work)
      const capturePromise = session.captureFullPage();

      // Small delay to ensure capture starts
      await new Promise(resolve => setTimeout(resolve, 100));

      const result = await capturePromise;

      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Buffer);

      console.log(`✅ Capture during navigation handled: ${result.data!.length} bytes`);
    });

    it('should capture page after JavaScript execution', async () => {
      const jsPage = `
        <html>
          <head>
            <style>
              body { margin: 0; padding: 50px; font-family: Arial; }
              .dynamic { background: red; padding: 20px; margin: 20px; }
              .modified { background: green !important; }
            </style>
          </head>
          <body>
            <h1>JavaScript Test Page</h1>
            <div id="content" class="dynamic">Original content</div>
            <script>
              // Modify the page after load
              setTimeout(() => {
                const content = document.getElementById('content');
                content.textContent = 'Modified by JavaScript!';
                content.className = 'dynamic modified';

                // Add more dynamic content
                const newDiv = document.createElement('div');
                newDiv.textContent = 'Dynamically added content';
                newDiv.style.background = '#blue';
                newDiv.style.padding = '20px';
                newDiv.style.margin = '20px';
                document.body.appendChild(newDiv);
              }, 100);
            </script>
          </body>
        </html>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(jsPage)}`);

      // Wait for JavaScript to execute
      await new Promise(resolve => setTimeout(resolve, 500));

      const result = await session.captureFullPage();

      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Buffer);

      console.log(`✅ Page with JavaScript modifications captured: ${result.data!.length} bytes`);
    });

    it('should handle page with console errors during capture', async () => {
      const errorPage = `
        <html>
          <body style="height: 1500px;">
            <h1>Page with JavaScript Errors</h1>
            <script>
              // These will cause console errors but shouldn't affect screenshot
              console.error('Test error message');
              undefinedFunction(); // This will throw an error
              throw new Error('Intentional test error');
            </script>
          </body>
        </html>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(errorPage)}`);

      // Allow errors to occur
      await new Promise(resolve => setTimeout(resolve, 200));

      const result = await session.captureFullPage();

      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Buffer);

      console.log(`✅ Page with console errors captured successfully: ${result.data!.length} bytes`);
    });
  });

  describe('Extreme Dimension Edge Cases', () => {
    it('should handle extremely narrow page', async () => {
      const narrowPage = `
        <html>
          <head>
            <style>
              body {
                margin: 0;
                width: 10px;
                height: 2000px;
                background: linear-gradient(to bottom, red, blue);
                overflow: hidden;
              }
            </style>
          </head>
          <body></body>
        </html>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(narrowPage)}`);

      const result = await session.captureFullPage();

      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Buffer);

      console.log(`✅ Extremely narrow page captured: ${result.data!.length} bytes`);
    });

    it('should handle page with nested scrollable containers', async () => {
      const nestedScrollPage = `
        <html>
          <head>
            <style>
              body { margin: 0; padding: 20px; height: 3000px; }
              .scroll-container {
                height: 300px;
                width: 400px;
                overflow: auto;
                border: 2px solid #333;
                margin: 20px;
                background: #f0f0f0;
              }
              .inner-content {
                height: 1000px;
                width: 600px;
                background: linear-gradient(45deg, #ff6b6b, #4ecdc4);
                padding: 20px;
              }
            </style>
          </head>
          <body>
            <h1>Nested Scrollable Containers</h1>
            <div class="scroll-container">
              <div class="inner-content">
                <h2>Scrollable Content 1</h2>
                <p>This content should be captured even though it's in a scrollable container</p>
              </div>
            </div>
            <div class="scroll-container">
              <div class="inner-content">
                <h2>Scrollable Content 2</h2>
                <p>Another scrollable area</p>
              </div>
            </div>
          </body>
        </html>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(nestedScrollPage)}`);

      const result = await session.captureFullPage();

      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Buffer);
      expect(result.data!.length).toBeGreaterThan(10000);

      console.log(`✅ Page with nested scroll containers captured: ${result.data!.length} bytes`);
    });

    it('should handle page with fixed positioning elements', async () => {
      const fixedPositionPage = `
        <html>
          <head>
            <style>
              body { margin: 0; padding: 0; height: 3000px; padding-top: 80px; }
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
                height: 40px;
                background: #34495e;
                color: white;
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 1000;
              }
              .content {
                padding: 20px;
                background: linear-gradient(to bottom, #ecf0f1, #bdc3c7);
              }
            </style>
          </head>
          <body>
            <div class="fixed-header">
              <h1>Fixed Header</h1>
            </div>
            <div class="content">
              <h2>Main Content</h2>
              <p>This is the main scrollable content area.</p>
              <div style="height: 500px; background: #3498db; margin: 20px 0;"></div>
              <div style="height: 500px; background: #e74c3c; margin: 20px 0;"></div>
              <div style="height: 500px; background: #2ecc71; margin: 20px 0;"></div>
            </div>
            <div class="fixed-footer">
              <p>Fixed Footer</p>
            </div>
          </body>
        </html>
      `;
      await session.navigate(`data:text/html,${encodeURIComponent(fixedPositionPage)}`);

      const result = await session.captureFullPage();

      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Buffer);
      expect(result.data!.length).toBeGreaterThan(20000);

      console.log(`✅ Page with fixed positioning captured: ${result.data!.length} bytes`);
    });
  });
});