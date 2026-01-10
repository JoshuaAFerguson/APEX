import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import sharp from 'sharp';
import { ScreenshotComparator, createScreenshotComparator } from '../screenshot-comparator';

describe('ScreenshotComparator - Edge Cases', () => {
  const fixturesDir = path.join(__dirname, 'fixtures-edge-cases');
  const tempDir = path.join(__dirname, 'temp-edge-cases');

  beforeAll(async () => {
    await fs.mkdir(fixturesDir, { recursive: true });
    await fs.mkdir(tempDir, { recursive: true });
    await generateEdgeCaseTestImages();
  });

  afterEach(async () => {
    try {
      const files = await fs.readdir(tempDir);
      await Promise.all(
        files.map(file => fs.unlink(path.join(tempDir, file)).catch(() => {}))
      );
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('edge case scenarios', () => {
    it('should handle 1x1 pixel images', async () => {
      const comparator = new ScreenshotComparator();
      const img1Path = path.join(fixturesDir, 'pixel-white-1x1.png');
      const img2Path = path.join(fixturesDir, 'pixel-black-1x1.png');

      const result = await comparator.compare(img1Path, img2Path);

      expect(result.totalPixels).toBe(1);
      expect(result.differentPixels).toBe(1);
      expect(result.similarity).toBe(0);
      expect(result.isMatch).toBe(false);
    });

    it('should handle very large images efficiently', async () => {
      const comparator = new ScreenshotComparator({ tolerance: 0.01 });
      const img1Path = path.join(fixturesDir, 'large-1000x1000.png');
      const img2Path = path.join(fixturesDir, 'large-1000x1000-copy.png');

      const start = Date.now();
      const result = await comparator.compare(img1Path, img2Path);
      const duration = Date.now() - start;

      expect(result.totalPixels).toBe(1000000); // 1000x1000
      expect(result.similarity).toBe(1);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle grayscale images', async () => {
      const comparator = new ScreenshotComparator();
      const img1Path = path.join(fixturesDir, 'grayscale-100x100.png');
      const img2Path = path.join(fixturesDir, 'grayscale-100x100-copy.png');

      const result = await comparator.compare(img1Path, img2Path);

      expect(result.similarity).toBe(1);
      expect(result.isMatch).toBe(true);
    });

    it('should handle images with extreme aspect ratios', async () => {
      const comparator = new ScreenshotComparator();
      const img1Path = path.join(fixturesDir, 'narrow-1x1000.png');
      const img2Path = path.join(fixturesDir, 'narrow-1x1000-copy.png');

      const result = await comparator.compare(img1Path, img2Path);

      expect(result.totalPixels).toBe(1000);
      expect(result.similarity).toBe(1);
    });

    it('should handle zero tolerance correctly', async () => {
      const comparator = new ScreenshotComparator({ tolerance: 0 });
      const img1Path = path.join(fixturesDir, 'red-100x100.png');
      const img2Path = path.join(fixturesDir, 'red-almost-identical.png');

      const result = await comparator.compare(img1Path, img2Path);

      // With zero tolerance, any pixel difference should fail
      expect(result.isMatch).toBe(false);
    });

    it('should handle maximum tolerance correctly', async () => {
      const comparator = new ScreenshotComparator({ tolerance: 1.0 });
      const img1Path = path.join(fixturesDir, 'red-100x100.png');
      const img2Path = path.join(fixturesDir, 'blue-100x100.png');

      const result = await comparator.compare(img1Path, img2Path);

      // With maximum tolerance, everything should match
      expect(result.isMatch).toBe(true);
    });

    it('should handle corrupted or invalid image files gracefully', async () => {
      const comparator = new ScreenshotComparator();
      const invalidPath = path.join(fixturesDir, 'invalid.png');

      // Create a file with invalid image data
      await fs.writeFile(invalidPath, 'This is not an image');

      await expect(
        comparator.compare(invalidPath, path.join(fixturesDir, 'red-100x100.png'))
      ).rejects.toThrow();
    });

    it('should handle empty files gracefully', async () => {
      const comparator = new ScreenshotComparator();
      const emptyPath = path.join(fixturesDir, 'empty.png');

      await fs.writeFile(emptyPath, '');

      await expect(
        comparator.compare(emptyPath, path.join(fixturesDir, 'red-100x100.png'))
      ).rejects.toThrow();
    });

    it('should handle images with very subtle differences', async () => {
      const comparator = new ScreenshotComparator({ tolerance: 0.001 });
      const img1Path = path.join(fixturesDir, 'red-100x100.png');
      const img2Path = path.join(fixturesDir, 'red-one-pixel-diff.png');

      const result = await comparator.compare(img1Path, img2Path);

      expect(result.differentPixels).toBe(1);
      expect(result.similarity).toBeCloseTo(0.9999, 4); // 9999/10000
    });
  });

  describe('buffer comparison edge cases', () => {
    it('should handle zero-length buffers', async () => {
      const comparator = new ScreenshotComparator();
      const emptyBuffer = Buffer.alloc(0);

      await expect(
        comparator.compareBuffers(emptyBuffer, emptyBuffer)
      ).rejects.toThrow();
    });

    it('should handle very small buffers', async () => {
      const comparator = new ScreenshotComparator();

      // Create minimal valid PNG buffers for 1x1 images
      const whitePixelBuffer = await sharp({
        create: { width: 1, height: 1, channels: 3, background: { r: 255, g: 255, b: 255 } }
      }).png().toBuffer();

      const blackPixelBuffer = await sharp({
        create: { width: 1, height: 1, channels: 3, background: { r: 0, g: 0, b: 0 } }
      }).png().toBuffer();

      const result = await comparator.compareBuffers(whitePixelBuffer, blackPixelBuffer);

      expect(result.totalPixels).toBe(1);
      expect(result.differentPixels).toBe(1);
      expect(result.similarity).toBe(0);
    });
  });

  describe('metadata edge cases', () => {
    it('should handle metadata for unusual image dimensions', async () => {
      const comparator = new ScreenshotComparator();
      const narrowPath = path.join(fixturesDir, 'narrow-1x1000.png');

      const metadata = await comparator.getImageMetadata(narrowPath);

      expect(metadata.width).toBe(1);
      expect(metadata.height).toBe(1000);
      expect(metadata.channels).toBeGreaterThanOrEqual(3);
      expect(metadata.path).toBe(narrowPath);
    });

    it('should handle metadata for grayscale images', async () => {
      const comparator = new ScreenshotComparator();
      const grayPath = path.join(fixturesDir, 'grayscale-100x100.png');

      const metadata = await comparator.getImageMetadata(grayPath);

      expect(metadata.width).toBe(100);
      expect(metadata.height).toBe(100);
      expect(metadata.channels).toBeGreaterThanOrEqual(1);
    });
  });

  describe('error handling', () => {
    it('should provide meaningful error messages for dimension mismatches', async () => {
      const comparator = new ScreenshotComparator();
      const img1Path = path.join(fixturesDir, 'red-100x100.png');
      const img2Path = path.join(fixturesDir, 'narrow-1x1000.png');

      await expect(
        comparator.compare(img1Path, img2Path)
      ).rejects.toThrow(/Image dimensions don't match.*100x100.*vs.*1x1000/);
    });

    it('should handle file permission errors gracefully', async () => {
      // This test is platform-dependent and may not work on all systems
      const comparator = new ScreenshotComparator();

      await expect(
        comparator.compare('/root/nonexistent.png', path.join(fixturesDir, 'red-100x100.png'))
      ).rejects.toThrow('Cannot read image file');
    });

    it('should validate diff output directory creation', async () => {
      const diffPath = path.join(tempDir, 'nested', 'deep', 'diff.png');
      const comparator = new ScreenshotComparator({
        outputDiff: true,
        diffOutputPath: diffPath,
      });

      const img1Path = path.join(fixturesDir, 'red-100x100.png');
      const img2Path = path.join(fixturesDir, 'red-one-pixel-diff.png');

      const result = await comparator.compare(img1Path, img2Path);

      expect(result.diffImagePath).toBe(diffPath);

      // Verify nested directory was created
      const diffExists = await fs.access(diffPath).then(() => true).catch(() => false);
      expect(diffExists).toBe(true);
    });
  });
});

/**
 * Generate edge case test images
 */
async function generateEdgeCaseTestImages() {
  const fixturesDir = path.join(__dirname, 'fixtures-edge-cases');

  try {
    // 1x1 pixel images
    await fs.writeFile(
      path.join(fixturesDir, 'pixel-white-1x1.png'),
      await sharp({
        create: { width: 1, height: 1, channels: 3, background: { r: 255, g: 255, b: 255 } }
      }).png().toBuffer()
    );

    await fs.writeFile(
      path.join(fixturesDir, 'pixel-black-1x1.png'),
      await sharp({
        create: { width: 1, height: 1, channels: 3, background: { r: 0, g: 0, b: 0 } }
      }).png().toBuffer()
    );

    // Large images
    const largeBuffer = await sharp({
      create: { width: 1000, height: 1000, channels: 3, background: { r: 255, g: 0, b: 0 } }
    }).png().toBuffer();

    await fs.writeFile(path.join(fixturesDir, 'large-1000x1000.png'), largeBuffer);
    await fs.writeFile(path.join(fixturesDir, 'large-1000x1000-copy.png'), largeBuffer);

    // Grayscale images
    const grayscaleBuffer = await sharp({
      create: { width: 100, height: 100, channels: 1, background: 128 }
    }).png().toBuffer();

    await fs.writeFile(path.join(fixturesDir, 'grayscale-100x100.png'), grayscaleBuffer);
    await fs.writeFile(path.join(fixturesDir, 'grayscale-100x100-copy.png'), grayscaleBuffer);

    // Narrow images
    const narrowBuffer = await sharp({
      create: { width: 1, height: 1000, channels: 3, background: { r: 255, g: 0, b: 0 } }
    }).png().toBuffer();

    await fs.writeFile(path.join(fixturesDir, 'narrow-1x1000.png'), narrowBuffer);
    await fs.writeFile(path.join(fixturesDir, 'narrow-1x1000-copy.png'), narrowBuffer);

    // Standard red image
    const redBuffer = await sharp({
      create: { width: 100, height: 100, channels: 3, background: { r: 255, g: 0, b: 0 } }
    }).png().toBuffer();
    await fs.writeFile(path.join(fixturesDir, 'red-100x100.png'), redBuffer);

    // Blue image
    const blueBuffer = await sharp({
      create: { width: 100, height: 100, channels: 3, background: { r: 0, g: 0, b: 255 } }
    }).png().toBuffer();
    await fs.writeFile(path.join(fixturesDir, 'blue-100x100.png'), blueBuffer);

    // Almost identical image (one shade off)
    const redAlmostBuffer = await sharp({
      create: { width: 100, height: 100, channels: 3, background: { r: 254, g: 0, b: 0 } }
    }).png().toBuffer();
    await fs.writeFile(path.join(fixturesDir, 'red-almost-identical.png'), redAlmostBuffer);

    // Single pixel difference
    const redOnePixelDiffBuffer = await sharp(redBuffer)
      .composite([{
        input: await sharp({
          create: { width: 1, height: 1, channels: 3, background: { r: 254, g: 0, b: 0 } }
        }).png().toBuffer(),
        top: 50,
        left: 50
      }])
      .png()
      .toBuffer();

    await fs.writeFile(path.join(fixturesDir, 'red-one-pixel-diff.png'), redOnePixelDiffBuffer);

  } catch (error) {
    console.warn('Could not generate edge case test images:', error);
  }
}