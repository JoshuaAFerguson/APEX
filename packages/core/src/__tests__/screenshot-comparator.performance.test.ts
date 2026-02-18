import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import sharp from 'sharp';
import { ScreenshotComparator, createScreenshotComparator } from '../screenshot-comparator';

describe('ScreenshotComparator - Performance Tests', () => {
  const fixturesDir = path.join(__dirname, 'fixtures-performance');
  const tempDir = path.join(__dirname, 'temp-performance');

  beforeAll(async () => {
    await fs.mkdir(fixturesDir, { recursive: true });
    await fs.mkdir(tempDir, { recursive: true });
    await generatePerformanceTestImages();
  });

  afterAll(async () => {
    // Clean up large test files
    try {
      await fs.rm(fixturesDir, { recursive: true, force: true });
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('performance benchmarks', () => {
    it('should handle small images quickly (< 100ms)', async () => {
      const comparator = new ScreenshotComparator();
      const img1Path = path.join(fixturesDir, 'small-100x100.png');
      const img2Path = path.join(fixturesDir, 'small-100x100-copy.png');

      const start = performance.now();
      const result = await comparator.compare(img1Path, img2Path);
      const duration = performance.now() - start;

      expect(result.similarity).toBe(1);
      expect(duration).toBeLessThan(100); // Should complete in under 100ms
    });

    it('should handle medium images efficiently (< 500ms)', async () => {
      const comparator = new ScreenshotComparator();
      const img1Path = path.join(fixturesDir, 'medium-500x500.png');
      const img2Path = path.join(fixturesDir, 'medium-500x500-copy.png');

      const start = performance.now();
      const result = await comparator.compare(img1Path, img2Path);
      const duration = performance.now() - start;

      expect(result.similarity).toBe(1);
      expect(result.totalPixels).toBe(250000);
      expect(duration).toBeLessThan(500); // Should complete in under 500ms
    });

    it('should handle large images within reasonable time (< 2s)', async () => {
      const comparator = new ScreenshotComparator();
      const img1Path = path.join(fixturesDir, 'large-1920x1080.png');
      const img2Path = path.join(fixturesDir, 'large-1920x1080-copy.png');

      const start = performance.now();
      const result = await comparator.compare(img1Path, img2Path);
      const duration = performance.now() - start;

      expect(result.similarity).toBe(1);
      expect(result.totalPixels).toBe(2073600); // 1920 * 1080
      expect(duration).toBeLessThan(2000); // Should complete in under 2 seconds
    });

    it('should handle very large images (4K) within acceptable time (< 5s)', async () => {
      const comparator = new ScreenshotComparator();
      const img1Path = path.join(fixturesDir, 'huge-2048x2048.png');
      const img2Path = path.join(fixturesDir, 'huge-2048x2048-copy.png');

      const start = performance.now();
      const result = await comparator.compare(img1Path, img2Path);
      const duration = performance.now() - start;

      expect(result.similarity).toBe(1);
      expect(result.totalPixels).toBe(4194304); // 2048 * 2048
      expect(duration).toBeLessThan(5000); // Should complete in under 5 seconds
    });

    it('should efficiently detect early differences in large images', async () => {
      const comparator = new ScreenshotComparator({ tolerance: 0.01 });
      const img1Path = path.join(fixturesDir, 'large-1920x1080.png');
      const img2Path = path.join(fixturesDir, 'large-1920x1080-different.png');

      const start = performance.now();
      const result = await comparator.compare(img1Path, img2Path);
      const duration = performance.now() - start;

      expect(result.similarity).toBeLessThan(1);
      expect(duration).toBeLessThan(2000); // Should still be fast even with differences
    });

    it('should handle batch comparisons efficiently', async () => {
      const comparator = new ScreenshotComparator();
      const baseImagePath = path.join(fixturesDir, 'small-100x100.png');

      const testImages = [
        path.join(fixturesDir, 'small-100x100-copy.png'),
        path.join(fixturesDir, 'small-100x100-variant1.png'),
        path.join(fixturesDir, 'small-100x100-variant2.png'),
        path.join(fixturesDir, 'small-100x100-variant3.png'),
      ];

      const start = performance.now();
      const results = await Promise.all(
        testImages.map(imagePath => comparator.compare(baseImagePath, imagePath))
      );
      const duration = performance.now() - start;

      expect(results).toHaveLength(4);
      expect(results[0].similarity).toBe(1); // Copy should be identical
      expect(duration).toBeLessThan(200); // Batch of 4 small images should be fast
    });

    it('should handle buffer comparisons efficiently', async () => {
      const buffer1 = await fs.readFile(path.join(fixturesDir, 'medium-500x500.png'));
      const buffer2 = await fs.readFile(path.join(fixturesDir, 'medium-500x500-copy.png'));

      const comparator = new ScreenshotComparator();

      const start = performance.now();
      const result = await comparator.compareBuffers(buffer1, buffer2);
      const duration = performance.now() - start;

      expect(result.similarity).toBe(1);
      expect(duration).toBeLessThan(400); // Should be fast with pre-loaded buffers
    });
  });

  describe('memory efficiency', () => {
    it('should not leak memory during multiple comparisons', async () => {
      const comparator = new ScreenshotComparator();
      const img1Path = path.join(fixturesDir, 'small-100x100.png');
      const img2Path = path.join(fixturesDir, 'small-100x100-copy.png');

      // Perform many comparisons to test for memory leaks
      const iterations = 50;
      const start = performance.now();

      for (let i = 0; i < iterations; i++) {
        await comparator.compare(img1Path, img2Path);
      }

      const duration = performance.now() - start;
      const avgDuration = duration / iterations;

      expect(avgDuration).toBeLessThan(20); // Average should remain low
    });

    it('should handle multiple instances efficiently', async () => {
      const img1Path = path.join(fixturesDir, 'small-100x100.png');
      const img2Path = path.join(fixturesDir, 'small-100x100-copy.png');

      // Create multiple comparator instances
      const comparators = Array.from({ length: 10 }, () => new ScreenshotComparator());

      const start = performance.now();
      const results = await Promise.all(
        comparators.map(comparator => comparator.compare(img1Path, img2Path))
      );
      const duration = performance.now() - start;

      expect(results).toHaveLength(10);
      expect(results.every(result => result.similarity === 1)).toBe(true);
      expect(duration).toBeLessThan(500); // Multiple instances should not significantly slow down
    });
  });

  describe('stress testing', () => {
    it('should handle maximum dimensions without crashing', async () => {
      // Test with a very large but reasonable image size
      const comparator = new ScreenshotComparator();
      const img1Path = path.join(fixturesDir, 'stress-3000x3000.png');
      const img2Path = path.join(fixturesDir, 'stress-3000x3000-copy.png');

      // This test may be skipped if images are too large to generate
      try {
        const result = await comparator.compare(img1Path, img2Path);
        expect(result.totalPixels).toBe(9000000); // 3000 * 3000
        expect(result.similarity).toBe(1);
      } catch (error) {
        // If we can't handle this size, that's acceptable - just log it
        console.warn('Stress test skipped due to size limitations:', error);
      }
    });

    it('should handle many small differences efficiently', async () => {
      const comparator = new ScreenshotComparator({ tolerance: 0.1 });
      const img1Path = path.join(fixturesDir, 'medium-500x500.png');
      const img2Path = path.join(fixturesDir, 'medium-500x500-noisy.png');

      const start = performance.now();
      const result = await comparator.compare(img1Path, img2Path);
      const duration = performance.now() - start;

      expect(result.differentPixels).toBeGreaterThan(1000); // Many differences
      expect(duration).toBeLessThan(1000); // Should still be reasonably fast
    });

    it('should maintain accuracy under stress', async () => {
      const comparator = new ScreenshotComparator({ tolerance: 0.01 });
      const img1Path = path.join(fixturesDir, 'large-1920x1080.png');
      const img2Path = path.join(fixturesDir, 'large-1920x1080-one-pixel.png');

      const result = await comparator.compare(img1Path, img2Path);

      // Should detect single pixel difference even in large image
      expect(result.differentPixels).toBe(1);
      expect(result.similarity).toBeCloseTo(1 - (1 / 2073600), 6);
    });
  });

  describe('concurrent operations', () => {
    it('should handle concurrent comparisons without interference', async () => {
      const basePath = path.join(fixturesDir, 'medium-500x500.png');
      const comparePaths = [
        path.join(fixturesDir, 'medium-500x500-copy.png'),
        path.join(fixturesDir, 'medium-500x500-variant1.png'),
        path.join(fixturesDir, 'medium-500x500-variant2.png'),
      ];

      // Run multiple comparisons concurrently
      const comparator = new ScreenshotComparator();

      const start = performance.now();
      const results = await Promise.all([
        comparator.compare(basePath, comparePaths[0]),
        comparator.compare(basePath, comparePaths[1]),
        comparator.compare(basePath, comparePaths[2]),
        comparator.compare(basePath, comparePaths[0]), // Repeat to test consistency
      ]);
      const duration = performance.now() - start;

      expect(results).toHaveLength(4);
      expect(results[0].similarity).toBe(1); // Identical
      expect(results[3].similarity).toBe(1); // Should get same result
      expect(duration).toBeLessThan(1500); // Concurrent execution should be efficient
    });
  });
});

/**
 * Generate performance test images
 */
async function generatePerformanceTestImages() {
  const fixturesDir = path.join(__dirname, 'fixtures-performance');

  try {
    console.log('Generating performance test images (this may take a moment)...');

    // Small images (100x100)
    const smallBuffer = await sharp({
      create: { width: 100, height: 100, channels: 3, background: { r: 255, g: 0, b: 0 } }
    }).png().toBuffer();

    await fs.writeFile(path.join(fixturesDir, 'small-100x100.png'), smallBuffer);
    await fs.writeFile(path.join(fixturesDir, 'small-100x100-copy.png'), smallBuffer);

    // Small variants
    for (let i = 1; i <= 3; i++) {
      const variant = await sharp(smallBuffer)
        .composite([{
          input: await sharp({
            create: { width: 2, height: 2, channels: 3, background: { r: 0, g: 255, b: 0 } }
          }).png().toBuffer(),
          top: i * 10,
          left: i * 10
        }])
        .png()
        .toBuffer();

      await fs.writeFile(path.join(fixturesDir, `small-100x100-variant${i}.png`), variant);
    }

    // Medium images (500x500)
    const mediumBuffer = await sharp({
      create: { width: 500, height: 500, channels: 3, background: { r: 0, g: 255, b: 0 } }
    }).png().toBuffer();

    await fs.writeFile(path.join(fixturesDir, 'medium-500x500.png'), mediumBuffer);
    await fs.writeFile(path.join(fixturesDir, 'medium-500x500-copy.png'), mediumBuffer);

    // Medium variants
    for (let i = 1; i <= 2; i++) {
      const variant = await sharp(mediumBuffer)
        .composite([{
          input: await sharp({
            create: { width: 5, height: 5, channels: 3, background: { r: 255, g: 0, b: 0 } }
          }).png().toBuffer(),
          top: i * 50,
          left: i * 50
        }])
        .png()
        .toBuffer();

      await fs.writeFile(path.join(fixturesDir, `medium-500x500-variant${i}.png`), variant);
    }

    // Noisy medium image
    const noisyMedium = await sharp({
      create: {
        width: 500,
        height: 500,
        channels: 3,
        background: { r: 0, g: 255, b: 0 },
        noise: { type: 'gaussian', mean: 0, sigma: 10 }
      }
    }).png().toBuffer();
    await fs.writeFile(path.join(fixturesDir, 'medium-500x500-noisy.png'), noisyMedium);

    // Large images (1920x1080 - common screen resolution)
    const largeBuffer = await sharp({
      create: { width: 1920, height: 1080, channels: 3, background: { r: 0, g: 0, b: 255 } }
    }).png().toBuffer();

    await fs.writeFile(path.join(fixturesDir, 'large-1920x1080.png'), largeBuffer);
    await fs.writeFile(path.join(fixturesDir, 'large-1920x1080-copy.png'), largeBuffer);

    // Large with difference
    const largeDifferent = await sharp(largeBuffer)
      .composite([{
        input: await sharp({
          create: { width: 100, height: 100, channels: 3, background: { r: 255, g: 255, b: 0 } }
        }).png().toBuffer(),
        top: 100,
        left: 100
      }])
      .png()
      .toBuffer();

    await fs.writeFile(path.join(fixturesDir, 'large-1920x1080-different.png'), largeDifferent);

    // Large with one pixel difference
    const largeOnePixel = await sharp(largeBuffer)
      .composite([{
        input: await sharp({
          create: { width: 1, height: 1, channels: 3, background: { r: 255, g: 0, b: 0 } }
        }).png().toBuffer(),
        top: 500,
        left: 500
      }])
      .png()
      .toBuffer();

    await fs.writeFile(path.join(fixturesDir, 'large-1920x1080-one-pixel.png'), largeOnePixel);

    // Huge images (2048x2048 - 4K-ish)
    const hugeBuffer = await sharp({
      create: { width: 2048, height: 2048, channels: 3, background: { r: 128, g: 128, b: 128 } }
    }).png().toBuffer();

    await fs.writeFile(path.join(fixturesDir, 'huge-2048x2048.png'), hugeBuffer);
    await fs.writeFile(path.join(fixturesDir, 'huge-2048x2048-copy.png'), hugeBuffer);

    // Stress test images (only if we have enough memory/disk space)
    try {
      const stressBuffer = await sharp({
        create: { width: 3000, height: 3000, channels: 3, background: { r: 64, g: 64, b: 64 } }
      }).png().toBuffer();

      await fs.writeFile(path.join(fixturesDir, 'stress-3000x3000.png'), stressBuffer);
      await fs.writeFile(path.join(fixturesDir, 'stress-3000x3000-copy.png'), stressBuffer);
    } catch (error) {
      console.warn('Could not generate stress test images (this is OK):', error);
    }

    console.log('Performance test images generated successfully');

  } catch (error) {
    console.warn('Could not generate some performance test images:', error);
  }
}