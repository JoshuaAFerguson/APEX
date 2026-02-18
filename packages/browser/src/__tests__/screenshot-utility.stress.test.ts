/**
 * @apexcli/browser - Screenshot Utility Stress Tests
 *
 * Stress tests for the screenshot utility under high load conditions
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import {
  captureScreenshot,
  capturePNG,
  captureJPEG,
  captureFullPageScreenshot,
  captureViewportScreenshot,
} from '../screenshot-utility.js';
import { TestPages, ScreenshotValidators, PerformanceMonitor, TestDataGenerators } from './test-utils.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('Screenshot Utility - Stress Tests', () => {
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;
  let tempDir: string;
  let performanceMonitor: PerformanceMonitor;

  beforeEach(async () => {
    browser = await chromium.launch({ headless: true });
    context = await browser.newContext({
      viewport: { width: 1280, height: 720 }
    });
    page = await context.newPage();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apex-screenshot-stress-test-'));
    performanceMonitor = new PerformanceMonitor();
  });

  afterEach(async () => {
    if (page && !page.isClosed()) await page.close();
    if (context) await context.close();
    if (browser) await browser.close();

    // Clean up temp files
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('High Volume Tests', () => {
    it('should handle 20 rapid sequential screenshots', async () => {
      await page.goto(`data:text/html,${encodeURIComponent(TestPages.simple('Rapid Sequential'))}`);

      const numScreenshots = 20;
      const results = [];

      for (let i = 0; i < numScreenshots; i++) {
        performanceMonitor.start();
        const result = await captureScreenshot(page, {
          format: i % 2 === 0 ? 'png' : 'jpeg',
          quality: i % 2 === 1 ? 50 + (i % 5) * 10 : undefined
        });
        const duration = performanceMonitor.stop();

        expect(ScreenshotValidators.isSuccessfulResult(result)).toBe(true);
        results.push({ result, duration, index: i });
      }

      const stats = performanceMonitor.getStats();
      console.log(`Sequential Screenshots Stats:`, stats);

      // Performance assertions
      expect(stats.average).toBeLessThan(5000); // Average under 5 seconds
      expect(stats.max).toBeLessThan(10000); // No single screenshot over 10 seconds

      // All results should be valid
      results.forEach(({ result }) => {
        expect(ScreenshotValidators.isSuccessfulResult(result)).toBe(true);
      });
    }, 120000); // 2 minute timeout

    it('should handle 15 concurrent screenshots without memory issues', async () => {
      await page.goto(`data:text/html,${encodeURIComponent(TestPages.complex())}`);

      const numConcurrent = 15;
      const promises = [];

      // Create concurrent screenshot promises
      for (let i = 0; i < numConcurrent; i++) {
        const promise = captureScreenshot(page, {
          format: i % 3 === 0 ? 'png' : 'jpeg',
          quality: i % 3 !== 0 ? 60 + (i % 4) * 10 : undefined,
          fullPage: i % 4 === 0
        });
        promises.push(promise);
      }

      const startTime = Date.now();
      const results = await Promise.all(promises);
      const totalTime = Date.now() - startTime;

      console.log(`Concurrent Screenshots - Total Time: ${totalTime}ms`);

      // All should succeed
      results.forEach((result, index) => {
        expect(ScreenshotValidators.isSuccessfulResult(result)).toBe(true);
      });

      // Concurrent execution should be more efficient than sequential
      expect(totalTime).toBeLessThan(numConcurrent * 3000); // Should be faster than 3s per screenshot
    }, 60000);

    it('should handle multiple browser contexts simultaneously', async () => {
      const numContexts = 5;
      const contexts = [];
      const pages = [];

      try {
        // Create multiple contexts and pages
        for (let i = 0; i < numContexts; i++) {
          const ctx = await browser.newContext({
            viewport: { width: 800 + i * 100, height: 600 + i * 50 }
          });
          const pg = await ctx.newPage();
          await pg.goto(`data:text/html,${encodeURIComponent(TestPages.simple(`Context ${i + 1}`))}`);

          contexts.push(ctx);
          pages.push(pg);
        }

        // Capture screenshots from all contexts
        const promises = pages.map((pg, index) =>
          captureScreenshot(pg, {
            format: index % 2 === 0 ? 'png' : 'jpeg',
            quality: index % 2 === 1 ? 70 : undefined
          })
        );

        const results = await Promise.all(promises);

        // All should succeed
        results.forEach((result, index) => {
          expect(ScreenshotValidators.isSuccessfulResult(result)).toBe(true);
        });

        // Each should have different sizes due to different viewports
        const sizes = results.map(r => r.data!.length);
        const uniqueSizes = new Set(sizes);
        expect(uniqueSizes.size).toBeGreaterThan(1); // Should have different sizes

      } finally {
        // Cleanup
        for (const pg of pages) {
          if (!pg.isClosed()) await pg.close();
        }
        for (const ctx of contexts) {
          await ctx.close();
        }
      }
    });
  });

  describe('Memory and Resource Tests', () => {
    it('should handle very large pages without memory overflow', async () => {
      const heavyContent = TestDataGenerators.generateHeavyContent(2000);
      await page.goto(`data:text/html,${encodeURIComponent(heavyContent)}`);

      // Monitor memory usage indirectly through performance
      performanceMonitor.start();
      const result = await captureScreenshot(page, {
        fullPage: true,
        format: 'jpeg',
        quality: 60
      });
      const duration = performanceMonitor.stop();

      expect(ScreenshotValidators.isSuccessfulResult(result)).toBe(true);
      expect(duration).toBeLessThan(30000); // Should complete within 30 seconds
      expect(result.data!.length).toBeGreaterThan(10000); // Should be substantial

      console.log(`Heavy Page Screenshot - Duration: ${duration}ms, Size: ${result.data!.length} bytes`);
    }, 40000);

    it('should handle repeated large file operations', async () => {
      await page.goto(`data:text/html,${encodeURIComponent(TestPages.tall(8000))}`);

      const numOperations = 10;
      const filePaths = [];

      for (let i = 0; i < numOperations; i++) {
        const filePath = path.join(tempDir, `large-file-${i}.png`);
        filePaths.push(filePath);

        const result = await captureFullPageScreenshot(page, { path: filePath });

        expect(ScreenshotValidators.isSuccessfulResult(result)).toBe(true);
        expect(fs.existsSync(filePath)).toBe(true);

        const stats = fs.statSync(filePath);
        expect(stats.size).toBeGreaterThan(50000); // Should be a large file
      }

      // Verify all files exist and have reasonable sizes
      filePaths.forEach((filePath, index) => {
        expect(fs.existsSync(filePath)).toBe(true);
        const stats = fs.statSync(filePath);
        expect(stats.size).toBeGreaterThan(50000);
        console.log(`File ${index + 1}: ${stats.size} bytes`);
      });
    }, 60000);

    it('should maintain performance across different quality settings', async () => {
      await page.goto(`data:text/html,${encodeURIComponent(TestPages.complex())}`);

      const qualityLevels = [10, 30, 50, 70, 90];
      const performanceResults = [];

      for (const quality of qualityLevels) {
        const iterations = 5;
        const durations = [];

        for (let i = 0; i < iterations; i++) {
          performanceMonitor.start();
          const result = await captureJPEG(page, quality);
          const duration = performanceMonitor.stop();

          expect(ScreenshotValidators.isSuccessfulResult(result)).toBe(true);
          durations.push(duration);
        }

        const avgDuration = durations.reduce((sum, d) => sum + d, 0) / iterations;
        performanceResults.push({
          quality,
          averageDuration: avgDuration,
          durations
        });
      }

      // Log performance results
      performanceResults.forEach(({ quality, averageDuration }) => {
        console.log(`Quality ${quality}: Average ${averageDuration}ms`);
      });

      // All quality levels should maintain reasonable performance
      performanceResults.forEach(({ averageDuration }) => {
        expect(averageDuration).toBeLessThan(5000);
      });
    });
  });

  describe('Endurance Tests', () => {
    it('should handle long-running screenshot session', async () => {
      const sessionDuration = 60000; // 1 minute
      const startTime = Date.now();
      const results = [];
      let iteration = 0;

      while (Date.now() - startTime < sessionDuration) {
        iteration++;

        // Use different test pages to vary the load
        const pageTypes = [
          TestPages.simple(`Session Test ${iteration}`),
          TestPages.tall(3000),
          TestPages.complex(),
          TestDataGenerators.randomTestPage()
        ];

        const pageContent = pageTypes[iteration % pageTypes.length];
        await page.goto(`data:text/html,${encodeURIComponent(pageContent)}`);

        const result = await captureScreenshot(page, {
          format: iteration % 2 === 0 ? 'png' : 'jpeg',
          quality: iteration % 2 === 1 ? 40 + (iteration % 6) * 10 : undefined,
          fullPage: iteration % 3 === 0
        });

        expect(ScreenshotValidators.isSuccessfulResult(result)).toBe(true);
        results.push({
          iteration,
          duration: result.duration,
          size: result.data!.length,
          timestamp: Date.now()
        });

        // Small delay to prevent overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      console.log(`Endurance Test - Completed ${results.length} screenshots in ${sessionDuration / 1000}s`);

      // Verify consistent performance throughout the session
      const firstHalf = results.slice(0, Math.floor(results.length / 2));
      const secondHalf = results.slice(Math.floor(results.length / 2));

      const firstHalfAvg = firstHalf.reduce((sum, r) => sum + r.duration, 0) / firstHalf.length;
      const secondHalfAvg = secondHalf.reduce((sum, r) => sum + r.duration, 0) / secondHalf.length;

      console.log(`First half average: ${firstHalfAvg}ms, Second half average: ${secondHalfAvg}ms`);

      // Performance shouldn't degrade significantly over time
      expect(secondHalfAvg).toBeLessThan(firstHalfAvg * 1.5); // Allow 50% increase max

      expect(results.length).toBeGreaterThan(10); // Should have processed multiple screenshots
    }, 90000); // 1.5 minute timeout

    it('should handle varying viewport sizes under load', async () => {
      const viewports = [
        { width: 320, height: 568 },   // Mobile
        { width: 768, height: 1024 },  // Tablet
        { width: 1024, height: 768 },  // Tablet Landscape
        { width: 1920, height: 1080 }, // Desktop
        { width: 2560, height: 1440 }, // Large Desktop
      ];

      const results = [];

      for (let round = 0; round < 3; round++) {
        for (const viewport of viewports) {
          await page.setViewportSize(viewport);
          await page.goto(`data:text/html,${encodeURIComponent(TestPages.complex())}`);

          const result = await captureScreenshot(page, {
            format: round % 2 === 0 ? 'png' : 'jpeg',
            quality: round % 2 === 1 ? 75 : undefined,
            fullPage: true
          });

          expect(ScreenshotValidators.isSuccessfulResult(result)).toBe(true);

          results.push({
            round,
            viewport,
            size: result.data!.length,
            duration: result.duration
          });
        }
      }

      // Verify all screenshots were successful
      expect(results).toHaveLength(viewports.length * 3);

      // Group by viewport and verify consistent behavior
      const byViewport = results.reduce((acc, result) => {
        const key = `${result.viewport.width}x${result.viewport.height}`;
        if (!acc[key]) acc[key] = [];
        acc[key].push(result);
        return acc;
      }, {} as Record<string, any[]>);

      Object.entries(byViewport).forEach(([key, results]) => {
        const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
        console.log(`Viewport ${key}: Average duration ${avgDuration}ms`);
        expect(avgDuration).toBeLessThan(15000); // Should be reasonable for all viewports
      });
    });
  });
});