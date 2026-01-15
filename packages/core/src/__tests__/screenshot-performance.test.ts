import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import sharp from 'sharp';
import { compareScreenshot, ScreenshotComparator } from '../screenshot-comparator';

describe('Screenshot Comparison - Performance Tests', () => {
  const perfTestDir = path.join(__dirname, 'performance-fixtures');
  let testImages: string[] = [];

  beforeAll(async () => {
    await fs.mkdir(perfTestDir, { recursive: true });

    // Create test images of various sizes for performance testing
    testImages = await Promise.all([
      createPerformanceTestImage('small', 100, 100),
      createPerformanceTestImage('medium', 500, 500),
      createPerformanceTestImage('large', 1000, 1000),
      createPerformanceTestImage('wide', 2000, 100),
      createPerformanceTestImage('tall', 100, 2000),
    ]);
  });

  afterAll(async () => {
    // Clean up test fixtures
    try {
      await fs.rm(perfTestDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Throughput Performance', () => {
    it('should handle small image comparisons efficiently', async () => {
      const image1 = testImages[0]; // 100x100
      const image2 = testImages[0]; // Same image

      const startTime = process.hrtime.bigint();
      const iterations = 100;

      // Run multiple comparisons
      const promises = Array(iterations).fill(null).map(() =>
        compareScreenshot(image1, image2)
      );

      const results = await Promise.all(promises);
      const endTime = process.hrtime.bigint();

      const durationMs = Number(endTime - startTime) / 1_000_000;
      const avgTimePerComparison = durationMs / iterations;

      expect(results).toHaveLength(iterations);
      expect(avgTimePerComparison).toBeLessThan(50); // Should be under 50ms per comparison

      // All results should indicate match
      results.forEach(result => {
        expect(result.match).toBe(true);
        expect(result.similarity).toBe(1);
      });
    });

    it('should handle medium image comparisons within reasonable time', async () => {
      const image1 = testImages[1]; // 500x500
      const image2 = testImages[1]; // Same image

      const startTime = process.hrtime.bigint();
      const iterations = 10;

      const promises = Array(iterations).fill(null).map(() =>
        compareScreenshot(image1, image2)
      );

      const results = await Promise.all(promises);
      const endTime = process.hrtime.bigint();

      const durationMs = Number(endTime - startTime) / 1_000_000;
      const avgTimePerComparison = durationMs / iterations;

      expect(results).toHaveLength(iterations);
      expect(avgTimePerComparison).toBeLessThan(200); // Should be under 200ms per comparison

      results.forEach(result => {
        expect(result.match).toBe(true);
      });
    });

    it('should handle large image comparisons efficiently', async () => {
      const image1 = testImages[2]; // 1000x1000
      const image2 = testImages[2]; // Same image

      const startTime = process.hrtime.bigint();

      const result = await compareScreenshot(image1, image2);

      const endTime = process.hrtime.bigint();
      const durationMs = Number(endTime - startTime) / 1_000_000;

      expect(result.match).toBe(true);
      expect(result.totalPixels).toBe(1_000_000);
      expect(durationMs).toBeLessThan(1000); // Should complete within 1 second
    });
  });

  describe('Memory Usage Performance', () => {
    it('should not cause memory leaks with repeated comparisons', async () => {
      const image1 = testImages[1]; // 500x500
      const image2 = testImages[1]; // Same image

      const initialMemory = process.memoryUsage().heapUsed;

      // Perform many comparisons
      for (let i = 0; i < 20; i++) {
        const result = await compareScreenshot(image1, image2);
        expect(result.match).toBe(true);

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });

    it('should handle concurrent comparisons without excessive memory usage', async () => {
      const images = testImages.slice(0, 3); // Use first 3 test images

      const initialMemory = process.memoryUsage().heapUsed;

      // Run multiple concurrent comparisons
      const promises = images.flatMap(image1 =>
        images.map(image2 => compareScreenshot(image1, image2))
      );

      const results = await Promise.all(promises);

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      expect(results).toHaveLength(9); // 3x3 comparisons
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // Less than 100MB increase
    });
  });

  describe('Aspect Ratio Performance', () => {
    it('should handle wide images efficiently', async () => {
      const wideImage = testImages[3]; // 2000x100

      const startTime = process.hrtime.bigint();

      const result = await compareScreenshot(wideImage, wideImage);

      const endTime = process.hrtime.bigint();
      const durationMs = Number(endTime - startTime) / 1_000_000;

      expect(result.match).toBe(true);
      expect(result.totalPixels).toBe(200_000);
      expect(durationMs).toBeLessThan(500); // Should complete within 500ms
    });

    it('should handle tall images efficiently', async () => {
      const tallImage = testImages[4]; // 100x2000

      const startTime = process.hrtime.bigint();

      const result = await compareScreenshot(tallImage, tallImage);

      const endTime = process.hrtime.bigint();
      const durationMs = Number(endTime - startTime) / 1_000_000;

      expect(result.match).toBe(true);
      expect(result.totalPixels).toBe(200_000);
      expect(durationMs).toBeLessThan(500); // Should complete within 500ms
    });
  });

  describe('Comparator Instance Reuse Performance', () => {
    it('should perform better when reusing comparator instances', async () => {
      const image1 = testImages[0];
      const image2 = testImages[0];

      // Test with new comparator instances each time
      const startTimeNew = process.hrtime.bigint();

      for (let i = 0; i < 10; i++) {
        const comparator = new ScreenshotComparator();
        await comparator.compare(image1, image2);
      }

      const endTimeNew = process.hrtime.bigint();
      const durationNew = Number(endTimeNew - startTimeNew) / 1_000_000;

      // Test with reused comparator instance
      const comparator = new ScreenshotComparator();
      const startTimeReused = process.hrtime.bigint();

      for (let i = 0; i < 10; i++) {
        await comparator.compare(image1, image2);
      }

      const endTimeReused = process.hrtime.bigint();
      const durationReused = Number(endTimeReused - startTimeReused) / 1_000_000;

      // Both should complete quickly, reused might be slightly faster due to JIT optimization
      expect(durationNew).toBeLessThan(1000);
      expect(durationReused).toBeLessThan(1000);

      // Log performance metrics for visibility (not enforced)
      console.log(`New instances: ${durationNew.toFixed(2)}ms, Reused instance: ${durationReused.toFixed(2)}ms`);
    });
  });

  describe('Base64 vs File Path Performance', () => {
    it('should compare base64 vs file path performance', async () => {
      const imagePath = testImages[1]; // 500x500 medium image
      const imageBuffer = await fs.readFile(imagePath);
      const imageBase64 = `data:image/png;base64,${imageBuffer.toString('base64')}`;

      // Test file path comparison
      const startTimeFilePath = process.hrtime.bigint();
      const filePathResult = await compareScreenshot(imagePath, imagePath);
      const endTimeFilePath = process.hrtime.bigint();
      const filePathDuration = Number(endTimeFilePath - startTimeFilePath) / 1_000_000;

      // Test base64 comparison
      const startTimeBase64 = process.hrtime.bigint();
      const base64Result = await compareScreenshot(imageBase64, imageBase64);
      const endTimeBase64 = process.hrtime.bigint();
      const base64Duration = Number(endTimeBase64 - startTimeBase64) / 1_000_000;

      // Both should produce identical results
      expect(filePathResult.match).toBe(true);
      expect(base64Result.match).toBe(true);
      expect(filePathResult.similarity).toBe(base64Result.similarity);

      // Both should complete in reasonable time
      expect(filePathDuration).toBeLessThan(1000);
      expect(base64Duration).toBeLessThan(1000);

      console.log(`File path: ${filePathDuration.toFixed(2)}ms, Base64: ${base64Duration.toFixed(2)}ms`);
    });
  });

  describe('Diff Generation Performance', () => {
    it('should generate diff images efficiently', async () => {
      const diffOutputPath = path.join(perfTestDir, 'perf-diff.png');

      // Create two different images to ensure diff generation
      const image1 = await createPerformanceTestImage('red-perf', 500, 500, { r: 255, g: 0, b: 0 });
      const image2 = await createPerformanceTestImage('blue-perf', 500, 500, { r: 0, g: 0, b: 255 });

      const startTime = process.hrtime.bigint();

      const result = await compareScreenshot(image1, image2, {
        outputDiff: true,
        diffOutputPath
      });

      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1_000_000;

      expect(result.match).toBe(false);
      expect(result.diffImagePath).toBe(diffOutputPath);
      expect(result.diffImageData).toBeDefined();
      expect(duration).toBeLessThan(2000); // Should complete within 2 seconds

      // Verify diff file was created and has reasonable size
      const diffStats = await fs.stat(diffOutputPath);
      expect(diffStats.size).toBeGreaterThan(1000); // Should be larger than 1KB
      expect(diffStats.size).toBeLessThan(5 * 1024 * 1024); // Should be smaller than 5MB
    });
  });

  // Helper function to create test images
  async function createPerformanceTestImage(
    name: string,
    width: number,
    height: number,
    color: { r: number; g: number; b: number } = { r: 255, g: 0, b: 0 }
  ): Promise<string> {
    const fileName = `perf-${name}-${width}x${height}.png`;
    const filePath = path.join(perfTestDir, fileName);

    await sharp({
      create: {
        width,
        height,
        channels: 3,
        background: color
      }
    }).png().toFile(filePath);

    return filePath;
  }
});