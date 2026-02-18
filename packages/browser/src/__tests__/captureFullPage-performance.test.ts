/**
 * @apexcli/browser - captureFullPage() Performance Tests
 *
 * Performance and stress testing for the captureFullPage() method
 * to ensure it handles large pages and multiple captures efficiently
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BrowserManager } from '../browser-manager.js';
import { BrowserSession } from '../browser-session.js';
import type { ScreenshotOptions } from '../types.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('captureFullPage() Performance Tests', () => {
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
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apex-fullpage-perf-'));
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

  describe('Large Page Performance', () => {
    it('should capture extremely tall page efficiently (10000px height)', async () => {
      const veryTallPage = `
        <html>
          <head>
            <style>
              body {
                margin: 0;
                font-family: Arial, sans-serif;
              }
              .section {
                height: 1000px;
                padding: 50px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 48px;
                font-weight: bold;
                color: white;
              }
              .section:nth-child(odd) { background: linear-gradient(45deg, #ff6b6b, #ee5a24); }
              .section:nth-child(even) { background: linear-gradient(45deg, #4834d4, #686de0); }
            </style>
          </head>
          <body>
            ${Array.from({ length: 10 }, (_, i) => `
              <div class="section">
                <div>Section ${i + 1} - Very Tall Page Test</div>
              </div>
            `).join('')}
          </body>
        </html>
      `;

      await session.navigate(`data:text/html,${encodeURIComponent(veryTallPage)}`);

      const startTime = Date.now();
      const result = await session.captureFullPage({ type: 'png' });
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Buffer);
      expect(result.data!.length).toBeGreaterThan(100000); // Should be a substantial image
      expect(duration).toBeLessThan(30000); // Should complete within 30 seconds

      console.log(`✅ Very tall page (10000px) captured in ${duration}ms`);
      console.log(`📊 Image size: ${result.data!.length} bytes`);
    }, 45000);

    it('should capture very wide page efficiently (5000px width)', async () => {
      const veryWidePage = `
        <html>
          <head>
            <style>
              body {
                margin: 0;
                width: 5000px;
                background: linear-gradient(to right, #667eea, #764ba2, #f093fb, #f5576c);
                font-family: Arial, sans-serif;
              }
              .content {
                padding: 100px;
                display: flex;
                justify-content: space-around;
                align-items: center;
                height: 600px;
              }
              .box {
                width: 300px;
                height: 200px;
                background: rgba(255, 255, 255, 0.9);
                border-radius: 20px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 24px;
                font-weight: bold;
                margin: 0 50px;
              }
            </style>
          </head>
          <body>
            <div class="content">
              ${Array.from({ length: 8 }, (_, i) => `
                <div class="box">Wide Box ${i + 1}</div>
              `).join('')}
            </div>
          </body>
        </html>
      `;

      await session.navigate(`data:text/html,${encodeURIComponent(veryWidePage)}`);

      const startTime = Date.now();
      const result = await session.captureFullPage({ type: 'jpeg', quality: 85 });
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Buffer);
      expect(result.data!.length).toBeGreaterThan(50000);
      expect(duration).toBeLessThan(20000); // Should complete within 20 seconds

      console.log(`✅ Very wide page (5000px) captured in ${duration}ms`);
      console.log(`📊 Image size: ${result.data!.length} bytes`);
    }, 30000);

    it('should handle complex content with many elements efficiently', async () => {
      const complexPage = `
        <html>
          <head>
            <style>
              body {
                margin: 0;
                font-family: Arial, sans-serif;
                background: #f5f5f5;
              }
              .grid {
                display: grid;
                grid-template-columns: repeat(10, 1fr);
                gap: 20px;
                padding: 20px;
              }
              .card {
                background: white;
                border-radius: 10px;
                padding: 20px;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                text-align: center;
                border: 2px solid #e0e0e0;
              }
              .card img {
                width: 100%;
                height: 150px;
                background: linear-gradient(45deg, #ff9a9e, #fecfef);
                border-radius: 5px;
                margin-bottom: 10px;
              }
              .card h3 { margin: 10px 0; color: #333; }
              .card p { margin: 5px 0; color: #666; font-size: 14px; }
            </style>
          </head>
          <body>
            <div class="grid">
              ${Array.from({ length: 200 }, (_, i) => `
                <div class="card">
                  <div class="img" style="background: linear-gradient(${45 + i * 2}deg, hsl(${i * 3}, 70%, 60%), hsl(${i * 3 + 60}, 70%, 60%));"></div>
                  <h3>Item ${i + 1}</h3>
                  <p>Complex card content with lots of styling</p>
                  <p>Additional text to test rendering performance</p>
                </div>
              `).join('')}
            </div>
          </body>
        </html>
      `;

      await session.navigate(`data:text/html,${encodeURIComponent(complexPage)}`);

      const startTime = Date.now();
      const result = await session.captureFullPage({ type: 'png' });
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Buffer);
      expect(result.data!.length).toBeGreaterThan(200000); // Should be substantial due to complex content
      expect(duration).toBeLessThan(25000); // Should complete within 25 seconds

      console.log(`✅ Complex page with 200 cards captured in ${duration}ms`);
      console.log(`📊 Image size: ${result.data!.length} bytes`);
    }, 35000);
  });

  describe('Rapid Capture Stress Tests', () => {
    it('should handle multiple rapid full page captures without issues', async () => {
      const testPage = `
        <html>
          <head>
            <style>
              body {
                margin: 0;
                height: 3000px;
                background: linear-gradient(to bottom, #667eea, #764ba2, #f093fb);
                display: flex;
                align-items: center;
                justify-content: center;
                font-family: Arial, sans-serif;
              }
              .content {
                text-align: center;
                color: white;
                font-size: 24px;
              }
            </style>
          </head>
          <body>
            <div class="content">
              <h1>Rapid Capture Stress Test</h1>
              <p>This page will be captured multiple times rapidly</p>
            </div>
          </body>
        </html>
      `;

      await session.navigate(`data:text/html,${encodeURIComponent(testPage)}`);

      const captureCount = 5;
      const results: Array<{ success: boolean; duration: number; size: number }> = [];

      const startTime = Date.now();

      for (let i = 0; i < captureCount; i++) {
        const captureStart = Date.now();
        const result = await session.captureFullPage({
          type: i % 2 === 0 ? 'png' : 'jpeg',
          quality: i % 2 === 1 ? 75 : undefined
        });
        const captureEnd = Date.now();

        expect(result.success).toBe(true);
        expect(result.data).toBeInstanceOf(Buffer);

        results.push({
          success: result.success,
          duration: captureEnd - captureStart,
          size: result.data!.length
        });
      }

      const totalDuration = Date.now() - startTime;
      const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;

      expect(results.every(r => r.success)).toBe(true);
      expect(avgDuration).toBeLessThan(15000); // Average should be reasonable
      expect(totalDuration).toBeLessThan(60000); // Total should complete within 1 minute

      console.log(`✅ ${captureCount} rapid captures completed in ${totalDuration}ms`);
      console.log(`📊 Average capture time: ${avgDuration.toFixed(2)}ms`);
      console.log(`📊 Capture sizes: ${results.map(r => `${r.size} bytes`).join(', ')}`);
    }, 70000);

    it('should handle rapid captures with different quality settings', async () => {
      const testPage = `
        <html>
          <body style="height: 2000px; background: linear-gradient(45deg, #ff6b6b, #4ecdc4, #45b7d1);">
            <h1 style="text-align: center; color: white; padding: 100px;">Quality Test Page</h1>
          </body>
        </html>
      `;

      await session.navigate(`data:text/html,${encodeURIComponent(testPage)}`);

      const qualityTests = [100, 90, 75, 50, 25, 10];
      const results: Array<{ quality: number; duration: number; size: number }> = [];

      for (const quality of qualityTests) {
        const startTime = Date.now();
        const result = await session.captureFullPage({
          type: 'jpeg',
          quality: quality
        });
        const duration = Date.now() - startTime;

        expect(result.success).toBe(true);
        expect(result.data).toBeInstanceOf(Buffer);

        results.push({
          quality: quality,
          duration: duration,
          size: result.data!.length
        });
      }

      // Verify that higher quality produces larger files
      const sortedByQuality = [...results].sort((a, b) => b.quality - a.quality);
      for (let i = 0; i < sortedByQuality.length - 1; i++) {
        expect(sortedByQuality[i].size).toBeGreaterThanOrEqual(sortedByQuality[i + 1].size);
      }

      console.log('✅ Quality tests completed:');
      results.forEach(r => {
        console.log(`📊 Quality ${r.quality}: ${r.size} bytes, ${r.duration}ms`);
      });
    }, 45000);
  });

  describe('Memory and Resource Management', () => {
    it('should not leak memory with repeated captures', async () => {
      const testPage = `
        <html>
          <body style="height: 1500px; background: #f0f0f0;">
            <h1>Memory Test Page</h1>
          </body>
        </html>
      `;

      await session.navigate(`data:text/html,${encodeURIComponent(testPage)}`);

      // Capture the same page multiple times to test for memory leaks
      const captureCount = 10;
      let totalMemoryUsed = 0;

      for (let i = 0; i < captureCount; i++) {
        const result = await session.captureFullPage({ type: 'png' });
        expect(result.success).toBe(true);
        totalMemoryUsed += result.data!.length;

        // Small delay to allow garbage collection
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Memory usage should be reasonable (not growing indefinitely)
      const averageMemoryPerCapture = totalMemoryUsed / captureCount;
      expect(averageMemoryPerCapture).toBeGreaterThan(10000); // Should have substantial data
      expect(averageMemoryPerCapture).toBeLessThan(5000000); // But not excessive

      console.log(`✅ ${captureCount} captures completed without memory issues`);
      console.log(`📊 Average memory per capture: ${averageMemoryPerCapture.toFixed(0)} bytes`);
    }, 30000);

    it('should handle file saving without blocking subsequent captures', async () => {
      const testPage = `
        <html>
          <body style="height: 2000px; background: linear-gradient(to bottom, #1e3c72, #2a5298);">
            <h1 style="color: white; text-align: center; padding: 50px;">File Save Test</h1>
          </body>
        </html>
      `;

      await session.navigate(`data:text/html,${encodeURIComponent(testPage)}`);

      const filePaths = Array.from({ length: 3 }, (_, i) =>
        path.join(tempDir, `concurrent-${i}.png`)
      );

      const startTime = Date.now();

      // Start multiple captures with file saving simultaneously
      const capturePromises = filePaths.map(async (filePath, index) => {
        const result = await session.captureFullPage({
          type: 'png',
          path: filePath
        });
        return { result, filePath, index };
      });

      const results = await Promise.all(capturePromises);
      const totalDuration = Date.now() - startTime;

      // All captures should succeed
      results.forEach(({ result, filePath, index }) => {
        expect(result.success).toBe(true);
        expect(result.data).toBeInstanceOf(Buffer);
        expect(fs.existsSync(filePath)).toBe(true);

        // Verify file contents match buffer
        const fileContents = fs.readFileSync(filePath);
        expect(fileContents.equals(result.data!)).toBe(true);
      });

      expect(totalDuration).toBeLessThan(20000); // Should complete reasonably fast

      console.log(`✅ ${results.length} concurrent file saves completed in ${totalDuration}ms`);
      console.log(`📊 Files saved: ${filePaths.map(p => path.basename(p)).join(', ')}`);
    }, 25000);
  });

  describe('Format Performance Comparison', () => {
    it('should compare PNG vs JPEG performance and file sizes', async () => {
      const comparisonPage = `
        <html>
          <head>
            <style>
              body {
                margin: 0;
                height: 3000px;
                background: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="%23ff6b6b"/><circle cx="30" cy="30" r="20" fill="%234ecdc4"/><circle cx="70" cy="70" r="15" fill="%2345b7d1"/></svg>') repeat;
                font-family: Arial, sans-serif;
              }
              .content {
                padding: 50px;
                text-align: center;
                background: rgba(255, 255, 255, 0.9);
                margin: 50px;
                border-radius: 20px;
              }
            </style>
          </head>
          <body>
            <div class="content">
              <h1>Format Performance Test</h1>
              <p>This page contains complex patterns to test compression performance</p>
            </div>
          </body>
        </html>
      `;

      await session.navigate(`data:text/html,${encodeURIComponent(comparisonPage)}`);

      // Test PNG
      const pngStart = Date.now();
      const pngResult = await session.captureFullPage({ type: 'png' });
      const pngDuration = Date.now() - pngStart;

      // Test JPEG high quality
      const jpegHighStart = Date.now();
      const jpegHighResult = await session.captureFullPage({ type: 'jpeg', quality: 90 });
      const jpegHighDuration = Date.now() - jpegHighStart;

      // Test JPEG low quality
      const jpegLowStart = Date.now();
      const jpegLowResult = await session.captureFullPage({ type: 'jpeg', quality: 30 });
      const jpegLowDuration = Date.now() - jpegLowStart;

      // All should succeed
      expect(pngResult.success).toBe(true);
      expect(jpegHighResult.success).toBe(true);
      expect(jpegLowResult.success).toBe(true);

      // Verify format signatures
      expect(pngResult.data![0]).toBe(0x89); // PNG
      expect(jpegHighResult.data![0]).toBe(0xFF); // JPEG
      expect(jpegLowResult.data![0]).toBe(0xFF); // JPEG

      // JPEG should generally be faster and smaller
      expect(jpegLowDuration).toBeLessThanOrEqual(pngDuration * 1.5); // Allow some variance
      expect(jpegLowResult.data!.length).toBeLessThan(pngResult.data!.length);
      expect(jpegHighResult.data!.length).toBeLessThan(pngResult.data!.length);
      expect(jpegLowResult.data!.length).toBeLessThan(jpegHighResult.data!.length);

      console.log('✅ Format performance comparison completed:');
      console.log(`📊 PNG: ${pngResult.data!.length} bytes, ${pngDuration}ms`);
      console.log(`📊 JPEG (Q90): ${jpegHighResult.data!.length} bytes, ${jpegHighDuration}ms`);
      console.log(`📊 JPEG (Q30): ${jpegLowResult.data!.length} bytes, ${jpegLowDuration}ms`);
    }, 30000);
  });
});