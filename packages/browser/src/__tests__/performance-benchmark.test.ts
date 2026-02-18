/**
 * @apexcli/browser - Performance Benchmark Tests
 *
 * Specific benchmarks for measuring and tracking screenshot utility performance
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import {
  captureScreenshot,
  capturePNG,
  captureJPEG,
  captureFullPageScreenshot,
} from '../screenshot-utility.js';
import { TestPages, PerformanceMonitor } from './test-utils.js';

describe('Screenshot Utility - Performance Benchmarks', () => {
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;

  beforeEach(async () => {
    browser = await chromium.launch({ headless: true });
    context = await browser.newContext({
      viewport: { width: 1280, height: 720 }
    });
    page = await context.newPage();
  });

  afterEach(async () => {
    if (page && !page.isClosed()) await page.close();
    if (context) await context.close();
    if (browser) await browser.close();
  });

  describe('Baseline Performance Measurements', () => {
    it('should measure PNG capture performance baseline', async () => {
      await page.goto(`data:text/html,${encodeURIComponent(TestPages.simple('PNG Baseline'))}`);

      const monitor = new PerformanceMonitor();
      const iterations = 10;

      for (let i = 0; i < iterations; i++) {
        monitor.start();
        const result = await capturePNG(page);
        monitor.stop();

        expect(result.success).toBe(true);
        expect(result.data).toBeInstanceOf(Buffer);
      }

      const stats = monitor.getStats();
      console.log('\n📊 PNG Capture Baseline Performance:');
      console.log(`   Iterations: ${stats.count}`);
      console.log(`   Average: ${stats.average.toFixed(2)}ms`);
      console.log(`   Median: ${stats.median.toFixed(2)}ms`);
      console.log(`   Min: ${stats.min}ms`);
      console.log(`   Max: ${stats.max}ms`);

      // Performance assertions
      expect(stats.average).toBeLessThan(3000); // Should average under 3s
      expect(stats.max).toBeLessThan(5000); // No single capture over 5s
    });

    it('should measure JPEG capture performance baseline', async () => {
      await page.goto(`data:text/html,${encodeURIComponent(TestPages.simple('JPEG Baseline'))}`);

      const monitor = new PerformanceMonitor();
      const iterations = 10;

      for (let i = 0; i < iterations; i++) {
        monitor.start();
        const result = await captureJPEG(page, 80);
        monitor.stop();

        expect(result.success).toBe(true);
        expect(result.data).toBeInstanceOf(Buffer);
      }

      const stats = monitor.getStats();
      console.log('\n📊 JPEG Capture Baseline Performance:');
      console.log(`   Iterations: ${stats.count}`);
      console.log(`   Average: ${stats.average.toFixed(2)}ms`);
      console.log(`   Median: ${stats.median.toFixed(2)}ms`);
      console.log(`   Min: ${stats.min}ms`);
      console.log(`   Max: ${stats.max}ms`);

      // Performance assertions
      expect(stats.average).toBeLessThan(3000); // Should average under 3s
      expect(stats.max).toBeLessThan(5000); // No single capture over 5s
    });

    it('should measure full page capture performance', async () => {
      await page.goto(`data:text/html,${encodeURIComponent(TestPages.tall(5000))}`);

      const monitor = new PerformanceMonitor();
      const iterations = 5; // Fewer iterations for heavy operation

      for (let i = 0; i < iterations; i++) {
        monitor.start();
        const result = await captureFullPageScreenshot(page, { format: 'jpeg', quality: 70 });
        monitor.stop();

        expect(result.success).toBe(true);
        expect(result.data).toBeInstanceOf(Buffer);
      }

      const stats = monitor.getStats();
      console.log('\n📊 Full Page Capture Performance:');
      console.log(`   Iterations: ${stats.count}`);
      console.log(`   Average: ${stats.average.toFixed(2)}ms`);
      console.log(`   Median: ${stats.median.toFixed(2)}ms`);
      console.log(`   Min: ${stats.min}ms`);
      console.log(`   Max: ${stats.max}ms`);

      // Performance assertions for full page
      expect(stats.average).toBeLessThan(10000); // Should average under 10s
      expect(stats.max).toBeLessThan(15000); // No single capture over 15s
    });
  });

  describe('Quality vs Performance Trade-offs', () => {
    it('should benchmark JPEG quality performance impact', async () => {
      await page.goto(`data:text/html,${encodeURIComponent(TestPages.complex())}`);

      const qualityLevels = [10, 30, 50, 70, 90];
      const results = [];

      for (const quality of qualityLevels) {
        const monitor = new PerformanceMonitor();
        const iterations = 5;
        const sizes = [];

        for (let i = 0; i < iterations; i++) {
          monitor.start();
          const result = await captureJPEG(page, quality);
          monitor.stop();

          expect(result.success).toBe(true);
          sizes.push(result.data!.length);
        }

        const stats = monitor.getStats();
        const avgSize = sizes.reduce((sum, size) => sum + size, 0) / sizes.length;

        results.push({
          quality,
          avgDuration: stats.average,
          avgSize: Math.round(avgSize),
          minDuration: stats.min,
          maxDuration: stats.max
        });
      }

      console.log('\n📊 JPEG Quality vs Performance:');
      console.log('Quality | Avg Time | Avg Size | Min Time | Max Time');
      console.log('--------|----------|----------|----------|----------');
      results.forEach(r => {
        console.log(`   ${r.quality.toString().padStart(2)}   | ${r.avgDuration.toFixed(0).padStart(6)}ms | ${(r.avgSize/1024).toFixed(1).padStart(6)}KB | ${r.minDuration.toString().padStart(6)}ms | ${r.maxDuration.toString().padStart(6)}ms`);
      });

      // Verify that higher quality generally produces larger files
      expect(results[results.length - 1].avgSize).toBeGreaterThan(results[0].avgSize);

      // All quality levels should complete reasonably quickly
      results.forEach(r => {
        expect(r.avgDuration).toBeLessThan(5000);
      });
    });
  });

  describe('Viewport Size Performance Impact', () => {
    it('should benchmark performance across different viewport sizes', async () => {
      const viewports = [
        { width: 320, height: 568, name: 'Mobile' },
        { width: 768, height: 1024, name: 'Tablet' },
        { width: 1920, height: 1080, name: 'Desktop' },
        { width: 2560, height: 1440, name: 'Large' }
      ];

      const results = [];

      for (const viewport of viewports) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto(`data:text/html,${encodeURIComponent(TestPages.complex())}`);

        const monitor = new PerformanceMonitor();
        const iterations = 5;
        const sizes = [];

        for (let i = 0; i < iterations; i++) {
          monitor.start();
          const result = await captureScreenshot(page, { format: 'png' });
          monitor.stop();

          expect(result.success).toBe(true);
          sizes.push(result.data!.length);
        }

        const stats = monitor.getStats();
        const avgSize = sizes.reduce((sum, size) => sum + size, 0) / sizes.length;

        results.push({
          viewport: `${viewport.width}x${viewport.height}`,
          name: viewport.name,
          avgDuration: stats.average,
          avgSize: Math.round(avgSize),
          minDuration: stats.min,
          maxDuration: stats.max
        });
      }

      console.log('\n📊 Viewport Size vs Performance:');
      console.log('Viewport      | Name    | Avg Time | Avg Size | Min Time | Max Time');
      console.log('--------------|---------|----------|----------|----------|----------');
      results.forEach(r => {
        console.log(`${r.viewport.padEnd(13)} | ${r.name.padEnd(7)} | ${r.avgDuration.toFixed(0).padStart(6)}ms | ${(r.avgSize/1024).toFixed(1).padStart(6)}KB | ${r.minDuration.toString().padStart(6)}ms | ${r.maxDuration.toString().padStart(6)}ms`);
      });

      // All viewport sizes should complete reasonably quickly
      results.forEach(r => {
        expect(r.avgDuration).toBeLessThan(5000);
      });

      // Larger viewports should generally produce larger files
      const mobileResult = results.find(r => r.name === 'Mobile');
      const largeResult = results.find(r => r.name === 'Large');
      expect(largeResult!.avgSize).toBeGreaterThan(mobileResult!.avgSize);
    });
  });

  describe('Concurrent Performance Analysis', () => {
    it('should benchmark concurrent vs sequential performance', async () => {
      await page.goto(`data:text/html,${encodeURIComponent(TestPages.simple('Concurrency Test'))}`);

      const numOperations = 8;

      // Measure sequential performance
      const sequentialMonitor = new PerformanceMonitor();
      sequentialMonitor.start();
      for (let i = 0; i < numOperations; i++) {
        const result = await captureScreenshot(page, { format: 'jpeg', quality: 60 });
        expect(result.success).toBe(true);
      }
      const sequentialTime = sequentialMonitor.stop();

      // Measure concurrent performance
      const concurrentMonitor = new PerformanceMonitor();
      concurrentMonitor.start();
      const promises = Array.from({ length: numOperations }, () =>
        captureScreenshot(page, { format: 'jpeg', quality: 60 })
      );
      const concurrentResults = await Promise.all(promises);
      const concurrentTime = concurrentMonitor.stop();

      // Verify all concurrent operations succeeded
      concurrentResults.forEach(result => {
        expect(result.success).toBe(true);
      });

      console.log('\n📊 Sequential vs Concurrent Performance:');
      console.log(`Sequential (${numOperations} ops): ${sequentialTime}ms (${(sequentialTime/numOperations).toFixed(1)}ms avg)`);
      console.log(`Concurrent (${numOperations} ops): ${concurrentTime}ms (${(concurrentTime/numOperations).toFixed(1)}ms avg)`);
      console.log(`Speedup: ${(sequentialTime/concurrentTime).toFixed(2)}x`);

      // Concurrent should be significantly faster
      expect(concurrentTime).toBeLessThan(sequentialTime * 0.8); // At least 20% improvement
    });
  });

  describe('Memory Usage Patterns', () => {
    it('should analyze memory patterns for different operations', async () => {
      const scenarios = [
        { name: 'Small PNG', setup: () => TestPages.simple('Small'), options: { format: 'png' as const } },
        { name: 'Large PNG', setup: () => TestPages.tall(8000), options: { format: 'png' as const, fullPage: true } },
        { name: 'Small JPEG', setup: () => TestPages.simple('Small'), options: { format: 'jpeg' as const, quality: 80 } },
        { name: 'Large JPEG', setup: () => TestPages.tall(8000), options: { format: 'jpeg' as const, quality: 80, fullPage: true } },
      ];

      const results = [];

      for (const scenario of scenarios) {
        await page.goto(`data:text/html,${encodeURIComponent(scenario.setup())}`);

        // Measure memory usage indirectly through performance and file size
        const monitor = new PerformanceMonitor();
        const iterations = 3;
        const sizes = [];

        for (let i = 0; i < iterations; i++) {
          monitor.start();
          const result = await captureScreenshot(page, scenario.options);
          monitor.stop();

          expect(result.success).toBe(true);
          sizes.push(result.data!.length);
        }

        const stats = monitor.getStats();
        const avgSize = sizes.reduce((sum, size) => sum + size, 0) / sizes.length;

        results.push({
          name: scenario.name,
          avgDuration: stats.average,
          avgSize: Math.round(avgSize),
          sizeRange: `${Math.min(...sizes)} - ${Math.max(...sizes)}`
        });
      }

      console.log('\n📊 Memory Usage Patterns:');
      console.log('Scenario    | Avg Time | Avg Size | Size Range');
      console.log('------------|----------|----------|------------------');
      results.forEach(r => {
        console.log(`${r.name.padEnd(11)} | ${r.avgDuration.toFixed(0).padStart(6)}ms | ${(r.avgSize/1024).toFixed(1).padStart(6)}KB | ${r.sizeRange}`);
      });

      // Verify that full page captures take more time and produce larger files
      const smallPNG = results.find(r => r.name === 'Small PNG');
      const largePNG = results.find(r => r.name === 'Large PNG');
      expect(largePNG!.avgSize).toBeGreaterThan(smallPNG!.avgSize);
      expect(largePNG!.avgDuration).toBeGreaterThan(smallPNG!.avgDuration);
    });
  });
});