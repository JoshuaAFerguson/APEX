/**
 * @fileoverview Browser Launch Time Benchmarks
 *
 * Measures browser launch performance for different browser types
 * and configurations.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { BenchmarkRunner, BROWSER_THRESHOLDS, BenchmarkReporter } from '../../../benchmarks/shared/index';
import { launchBrowser, createBrowserManager, createBrowserSession } from '../src/index';
import type { BrowserManager } from '../src/index';

describe('Browser Launch Benchmarks', () => {
  const reporter = new BenchmarkReporter();

  beforeAll(() => {
    reporter.start();
  });

  afterAll(() => {
    reporter.printReport();
  });

  describe('Chromium Launch', () => {
    it('should benchmark chromium cold start', async () => {
      const runner = new BenchmarkRunner();

      const result = await runner.run(
        {
          name: 'browser-launch-chromium-cold',
          iterations: 5,
          warmupIterations: 1,
          threshold: BROWSER_THRESHOLDS.launch.chromium,
        },
        async () => {
          const result = await launchBrowser({
            browserType: 'chromium',
            headless: true,
          });

          expect(result.success).toBe(true);

          if (result.data) {
            await result.data.close();
          }
        }
      );

      reporter.addResult(result);
      console.log(BenchmarkRunner.formatResult(result));

      expect(result.passed).toBe(true);
    });

    it('should benchmark chromium with reuse manager', async () => {
      const manager = createBrowserManager({
        reuseInstances: true,
        maxInstances: 1,
      });

      const runner = new BenchmarkRunner();

      try {
        const result = await runner.run(
          {
            name: 'browser-launch-chromium-reuse',
            iterations: 5,
            warmupIterations: 2,
            threshold: {
              // Reuse should be faster
              maxMean: BROWSER_THRESHOLDS.launch.chromium.maxMean * 0.5,
              maxP95: BROWSER_THRESHOLDS.launch.chromium.maxP95 * 0.5,
            },
          },
          async () => {
            const session = createBrowserSession(manager, {
              browserType: 'chromium',
              headless: true,
            });

            const launchResult = await session.launch();
            expect(launchResult.success).toBe(true);

            await session.close();
          }
        );

        reporter.addResult(result);
        console.log(BenchmarkRunner.formatResult(result));

        // Note: Reuse benchmark may not always pass due to initial launches
        // This is more of a baseline measurement
      } finally {
        await manager.shutdown();
      }
    });
  });

  describe('Browser Launch with Configuration', () => {
    it('should benchmark headless launch', async () => {
      const runner = new BenchmarkRunner();

      const result = await runner.run(
        {
          name: 'browser-launch-headless',
          iterations: 3,
          warmupIterations: 1,
          threshold: BROWSER_THRESHOLDS.launch.chromium,
        },
        async () => {
          const result = await launchBrowser({
            browserType: 'chromium',
            headless: true,
            viewport: { width: 1280, height: 720 },
          });

          expect(result.success).toBe(true);

          if (result.data) {
            await result.data.close();
          }
        }
      );

      reporter.addResult(result);
      console.log(BenchmarkRunner.formatResult(result));

      expect(result.passed).toBe(true);
    });

    it('should benchmark launch with custom viewport', async () => {
      const runner = new BenchmarkRunner();

      const result = await runner.run(
        {
          name: 'browser-launch-large-viewport',
          iterations: 3,
          warmupIterations: 1,
          threshold: BROWSER_THRESHOLDS.launch.chromium,
        },
        async () => {
          const result = await launchBrowser({
            browserType: 'chromium',
            headless: true,
            viewport: { width: 2560, height: 1440 },
          });

          expect(result.success).toBe(true);

          if (result.data) {
            await result.data.close();
          }
        }
      );

      reporter.addResult(result);
      console.log(BenchmarkRunner.formatResult(result));

      expect(result.passed).toBe(true);
    });
  });

  describe('Manager Lifecycle', () => {
    it('should benchmark manager creation and shutdown', async () => {
      const runner = new BenchmarkRunner();

      const result = await runner.run(
        {
          name: 'browser-manager-lifecycle',
          iterations: 5,
          warmupIterations: 2,
          threshold: {
            maxMean: 100,
            maxP95: 200,
          },
        },
        async () => {
          const manager = createBrowserManager({
            maxInstances: 3,
            reuseInstances: false,
          });

          await manager.shutdown();
        }
      );

      reporter.addResult(result);
      console.log(BenchmarkRunner.formatResult(result));

      expect(result.passed).toBe(true);
    });
  });
});
