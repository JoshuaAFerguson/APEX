/**
 * @fileoverview Screenshot Capture Benchmarks
 *
 * Measures screenshot capture performance for various formats,
 * sizes, and configurations.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import {
  BenchmarkRunner,
  BROWSER_THRESHOLDS,
  BenchmarkReporter,
} from '../../../benchmarks/shared/index';
import {
  captureScreenshot,
  capturePNG,
  captureJPEG,
  captureFullPageScreenshot,
  captureViewportScreenshot,
} from '../src/screenshot-utility';
import { TestPages } from '../src/test-utils/test-pages';

describe('Screenshot Capture Benchmarks', () => {
  const reporter = new BenchmarkReporter();
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;

  beforeAll(async () => {
    reporter.start();
    browser = await chromium.launch({ headless: true });
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
    reporter.printReport();
  });

  beforeEach(async () => {
    context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
    });
    page = await context.newPage();
  });

  afterEach(async () => {
    if (page && !page.isClosed()) {
      await page.close();
    }
    if (context) {
      await context.close();
    }
  });

  describe('PNG Screenshots', () => {
    it('should benchmark viewport PNG capture', async () => {
      await page.goto(`data:text/html,${encodeURIComponent(TestPages.simple('PNG Benchmark'))}`);

      const runner = new BenchmarkRunner();

      const result = await runner.run(
        {
          name: 'screenshot-png-viewport',
          iterations: 10,
          warmupIterations: 3,
          threshold: BROWSER_THRESHOLDS.screenshot.png.viewport,
        },
        async () => {
          const screenshotResult = await capturePNG(page);
          expect(screenshotResult.success).toBe(true);
          expect(screenshotResult.data).toBeInstanceOf(Buffer);
        }
      );

      reporter.addResult(result);
      console.log(BenchmarkRunner.formatResult(result));

      expect(result.passed).toBe(true);
    });

    it('should benchmark full page PNG capture', async () => {
      await page.goto(`data:text/html,${encodeURIComponent(TestPages.tall(5000))}`);

      const runner = new BenchmarkRunner();

      const result = await runner.run(
        {
          name: 'screenshot-png-fullpage',
          iterations: 5,
          warmupIterations: 2,
          threshold: BROWSER_THRESHOLDS.screenshot.png.fullPage,
        },
        async () => {
          const screenshotResult = await captureFullPageScreenshot(page, { format: 'png' });
          expect(screenshotResult.success).toBe(true);
          expect(screenshotResult.data).toBeInstanceOf(Buffer);
        }
      );

      reporter.addResult(result);
      console.log(BenchmarkRunner.formatResult(result));

      expect(result.passed).toBe(true);
    });

    it('should benchmark large viewport PNG capture', async () => {
      await page.setViewportSize({ width: 2560, height: 1440 });
      await page.goto(`data:text/html,${encodeURIComponent(TestPages.complex())}`);

      const runner = new BenchmarkRunner();

      const result = await runner.run(
        {
          name: 'screenshot-png-large-viewport',
          iterations: 5,
          warmupIterations: 2,
          threshold: BROWSER_THRESHOLDS.screenshot.png.largeViewport,
        },
        async () => {
          const screenshotResult = await capturePNG(page);
          expect(screenshotResult.success).toBe(true);
          expect(screenshotResult.data).toBeInstanceOf(Buffer);
        }
      );

      reporter.addResult(result);
      console.log(BenchmarkRunner.formatResult(result));

      expect(result.passed).toBe(true);
    });
  });

  describe('JPEG Screenshots', () => {
    it('should benchmark viewport JPEG capture', async () => {
      await page.goto(`data:text/html,${encodeURIComponent(TestPages.simple('JPEG Benchmark'))}`);

      const runner = new BenchmarkRunner();

      const result = await runner.run(
        {
          name: 'screenshot-jpeg-viewport',
          iterations: 10,
          warmupIterations: 3,
          threshold: BROWSER_THRESHOLDS.screenshot.jpeg.viewport,
        },
        async () => {
          const screenshotResult = await captureJPEG(page, 80);
          expect(screenshotResult.success).toBe(true);
          expect(screenshotResult.data).toBeInstanceOf(Buffer);
        }
      );

      reporter.addResult(result);
      console.log(BenchmarkRunner.formatResult(result));

      expect(result.passed).toBe(true);
    });

    it('should benchmark full page JPEG capture', async () => {
      await page.goto(`data:text/html,${encodeURIComponent(TestPages.tall(5000))}`);

      const runner = new BenchmarkRunner();

      const result = await runner.run(
        {
          name: 'screenshot-jpeg-fullpage',
          iterations: 5,
          warmupIterations: 2,
          threshold: BROWSER_THRESHOLDS.screenshot.jpeg.fullPage,
        },
        async () => {
          const screenshotResult = await captureFullPageScreenshot(page, {
            format: 'jpeg',
            quality: 80,
          });
          expect(screenshotResult.success).toBe(true);
          expect(screenshotResult.data).toBeInstanceOf(Buffer);
        }
      );

      reporter.addResult(result);
      console.log(BenchmarkRunner.formatResult(result));

      expect(result.passed).toBe(true);
    });

    it('should benchmark JPEG quality impact', async () => {
      await page.goto(`data:text/html,${encodeURIComponent(TestPages.complex())}`);

      const qualityLevels = [30, 60, 90];

      for (const quality of qualityLevels) {
        const runner = new BenchmarkRunner();

        const result = await runner.run(
          {
            name: `screenshot-jpeg-quality-${quality}`,
            iterations: 5,
            warmupIterations: 2,
            threshold: BROWSER_THRESHOLDS.screenshot.jpeg.viewport,
          },
          async () => {
            const screenshotResult = await captureJPEG(page, quality);
            expect(screenshotResult.success).toBe(true);
          }
        );

        reporter.addResult(result);
        console.log(BenchmarkRunner.formatResult(result));
      }
    });
  });

  describe('Viewport Size Impact', () => {
    const viewports = [
      { width: 320, height: 568, name: 'mobile' },
      { width: 768, height: 1024, name: 'tablet' },
      { width: 1920, height: 1080, name: 'desktop' },
    ];

    for (const viewport of viewports) {
      it(`should benchmark ${viewport.name} viewport screenshot`, async () => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto(`data:text/html,${encodeURIComponent(TestPages.complex())}`);

        const runner = new BenchmarkRunner();

        const result = await runner.run(
          {
            name: `screenshot-viewport-${viewport.name}`,
            iterations: 5,
            warmupIterations: 2,
            threshold: BROWSER_THRESHOLDS.screenshot.png.viewport,
          },
          async () => {
            const screenshotResult = await captureScreenshot(page, { format: 'png' });
            expect(screenshotResult.success).toBe(true);
          }
        );

        reporter.addResult(result);
        console.log(BenchmarkRunner.formatResult(result));
      });
    }
  });

  describe('Complex Page Screenshots', () => {
    it('should benchmark complex page with animations', async () => {
      await page.goto(`data:text/html,${encodeURIComponent(TestPages.complex())}`);

      const runner = new BenchmarkRunner();

      const result = await runner.run(
        {
          name: 'screenshot-complex-page',
          iterations: 5,
          warmupIterations: 2,
          threshold: {
            maxMean: 300,
            maxP95: 600,
          },
        },
        async () => {
          const screenshotResult = await captureScreenshot(page, { format: 'png' });
          expect(screenshotResult.success).toBe(true);
        }
      );

      reporter.addResult(result);
      console.log(BenchmarkRunner.formatResult(result));

      expect(result.passed).toBe(true);
    });

    it('should benchmark unicode content page', async () => {
      await page.goto(`data:text/html,${encodeURIComponent(TestPages.unicode())}`);

      const runner = new BenchmarkRunner();

      const result = await runner.run(
        {
          name: 'screenshot-unicode-content',
          iterations: 5,
          warmupIterations: 2,
          threshold: BROWSER_THRESHOLDS.screenshot.png.viewport,
        },
        async () => {
          const screenshotResult = await captureScreenshot(page, { format: 'png' });
          expect(screenshotResult.success).toBe(true);
        }
      );

      reporter.addResult(result);
      console.log(BenchmarkRunner.formatResult(result));

      expect(result.passed).toBe(true);
    });
  });
});
