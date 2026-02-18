import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import sharp from 'sharp';
import {
  ScreenshotComparator,
  createScreenshotComparator,
  compareImages,
  compareScreenshot,
} from '../screenshot-comparator';
import {
  ScreenshotComparisonOptions,
  ScreenshotComparisonResult,
  ImageMetadata,
} from '../types';

describe('ScreenshotComparator', () => {
  const fixturesDir = path.join(__dirname, 'fixtures');
  const tempDir = path.join(__dirname, 'temp');

  // Test image paths
  const redImagePath = path.join(fixturesDir, 'red-100x100.png');
  const redImageCopyPath = path.join(fixturesDir, 'red-100x100-copy.png');
  const redWithDotPath = path.join(fixturesDir, 'red-with-blue-dot.png');
  const blueImagePath = path.join(fixturesDir, 'blue-100x100.png');
  const redLargerPath = path.join(fixturesDir, 'red-200x200.png');
  const redTransparentPath = path.join(fixturesDir, 'red-transparent.png');

  beforeAll(async () => {
    // Ensure test directories exist
    await fs.mkdir(fixturesDir, { recursive: true });
    await fs.mkdir(tempDir, { recursive: true });

    // Generate test images programmatically to ensure they exist
    await generateTestImages();
  });

  afterEach(async () => {
    // Clean up temp files
    try {
      const files = await fs.readdir(tempDir);
      await Promise.all(
        files.map(file => fs.unlink(path.join(tempDir, file)).catch(() => {}))
      );
    } catch {
      // Ignore errors if temp dir doesn't exist
    }
  });

  describe('constructor and options', () => {
    it('should create instance with default options', () => {
      const comparator = new ScreenshotComparator();
      expect(comparator).toBeInstanceOf(ScreenshotComparator);
    });

    it('should create instance with custom options', () => {
      const options: Partial<ScreenshotComparisonOptions> = {
        tolerance: 0.2,
        includeAlpha: true,
        outputDiff: true,
      };
      const comparator = new ScreenshotComparator(options);
      expect(comparator).toBeInstanceOf(ScreenshotComparator);
    });

    it('should validate options schema', () => {
      expect(() => {
        new ScreenshotComparator({ tolerance: -1 } as any);
      }).toThrow();

      expect(() => {
        new ScreenshotComparator({ tolerance: 2 } as any);
      }).toThrow();
    });
  });

  describe('compare method', () => {
    it('should identify identical images', async () => {
      const comparator = new ScreenshotComparator();
      const result = await comparator.compare(redImagePath, redImageCopyPath);

      expect(result.similarity).toBe(1);
      expect(result.differentPixels).toBe(0);
      expect(result.isMatch).toBe(true);
      expect(result.totalPixels).toBe(10000); // 100x100
    });

    it('should detect small differences', async () => {
      const comparator = new ScreenshotComparator({ tolerance: 0.01 });
      const result = await comparator.compare(redImagePath, redWithDotPath);

      expect(result.similarity).toBeLessThan(1);
      expect(result.similarity).toBeGreaterThan(0.9); // Small difference
      expect(result.differentPixels).toBeGreaterThan(0);
      expect(result.differentPixels).toBeLessThan(100); // Small number of pixels
    });

    it('should detect large differences', async () => {
      const comparator = new ScreenshotComparator();
      const result = await comparator.compare(redImagePath, blueImagePath);

      expect(result.similarity).toBe(0);
      expect(result.differentPixels).toBe(10000); // All pixels different
      expect(result.isMatch).toBe(false);
    });

    it('should respect tolerance threshold', async () => {
      // High tolerance should pass small differences
      const tolerantComparator = new ScreenshotComparator({ tolerance: 0.1 });
      const tolerantResult = await tolerantComparator.compare(redImagePath, redWithDotPath);
      expect(tolerantResult.isMatch).toBe(true);

      // Low tolerance should fail small differences
      const strictComparator = new ScreenshotComparator({ tolerance: 0.001 });
      const strictResult = await strictComparator.compare(redImagePath, redWithDotPath);
      expect(strictResult.isMatch).toBe(false);
    });

    it('should generate diff image when requested', async () => {
      const diffPath = path.join(tempDir, 'diff-output.png');
      const comparator = new ScreenshotComparator({
        outputDiff: true,
        diffOutputPath: diffPath,
      });

      const result = await comparator.compare(redImagePath, redWithDotPath);

      expect(result.diffImagePath).toBe(diffPath);

      // Check that diff file was created
      const diffExists = await fs.access(diffPath).then(() => true).catch(() => false);
      expect(diffExists).toBe(true);

      // Verify diff image metadata
      const diffMetadata = await sharp(diffPath).metadata();
      expect(diffMetadata.width).toBe(100);
      expect(diffMetadata.height).toBe(100);
    });

    it('should generate diff image with default magenta color', async () => {
      const diffPath = path.join(tempDir, 'magenta-diff.png');
      const comparator = new ScreenshotComparator({
        outputDiff: true,
        diffOutputPath: diffPath,
      });

      const result = await comparator.compare(redImagePath, redWithDotPath);
      expect(result.diffImagePath).toBe(diffPath);

      // Check that diff file was created
      const diffExists = await fs.access(diffPath).then(() => true).catch(() => false);
      expect(diffExists).toBe(true);

      // Read the diff image and verify it contains magenta pixels (255, 0, 255)
      const diffImage = sharp(diffPath);
      const { data } = await diffImage.raw().toBuffer({ resolveWithObject: true });

      // Look for magenta pixels in the diff image
      let foundMagentaPixels = false;
      for (let i = 0; i < data.length; i += 3) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        if (r === 255 && g === 0 && b === 255) {
          foundMagentaPixels = true;
          break;
        }
      }

      expect(foundMagentaPixels).toBe(true);
    });

    it('should generate diff image with custom color', async () => {
      const diffPath = path.join(tempDir, 'custom-diff.png');
      const customColor: [number, number, number] = [255, 255, 0]; // Yellow
      const comparator = new ScreenshotComparator({
        outputDiff: true,
        diffOutputPath: diffPath,
        diffColor: customColor,
      });

      const result = await comparator.compare(redImagePath, redWithDotPath);
      expect(result.diffImagePath).toBe(diffPath);

      // Check that diff file was created
      const diffExists = await fs.access(diffPath).then(() => true).catch(() => false);
      expect(diffExists).toBe(true);

      // Read the diff image and verify it contains yellow pixels (255, 255, 0)
      const diffImage = sharp(diffPath);
      const { data } = await diffImage.raw().toBuffer({ resolveWithObject: true });

      // Look for yellow pixels in the diff image
      let foundYellowPixels = false;
      for (let i = 0; i < data.length; i += 3) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        if (r === 255 && g === 255 && b === 0) {
          foundYellowPixels = true;
          break;
        }
      }

      expect(foundYellowPixels).toBe(true);
    });

    it('should throw error for non-existent files', async () => {
      const comparator = new ScreenshotComparator();

      await expect(
        comparator.compare('nonexistent1.png', redImagePath)
      ).rejects.toThrow('Cannot read image file');

      await expect(
        comparator.compare(redImagePath, 'nonexistent2.png')
      ).rejects.toThrow('Cannot read image file');
    });

    it('should throw error for mismatched dimensions', async () => {
      const comparator = new ScreenshotComparator();

      await expect(
        comparator.compare(redImagePath, redLargerPath)
      ).rejects.toThrow("Image dimensions don't match");
    });
  });

  describe('compareBuffers method', () => {
    it('should compare image buffers directly', async () => {
      const buffer1 = await fs.readFile(redImagePath);
      const buffer2 = await fs.readFile(redImageCopyPath);

      const comparator = new ScreenshotComparator();
      const result = await comparator.compareBuffers(buffer1, buffer2);

      expect(result.similarity).toBe(1);
      expect(result.isMatch).toBe(true);
    });

    it('should detect differences in buffers', async () => {
      const buffer1 = await fs.readFile(redImagePath);
      const buffer2 = await fs.readFile(blueImagePath);

      const comparator = new ScreenshotComparator();
      const result = await comparator.compareBuffers(buffer1, buffer2);

      expect(result.similarity).toBe(0);
      expect(result.isMatch).toBe(false);
    });
  });

  describe('getImageMetadata method', () => {
    it('should return correct image metadata', async () => {
      const comparator = new ScreenshotComparator();
      const metadata = await comparator.getImageMetadata(redImagePath);

      expect(metadata.width).toBe(100);
      expect(metadata.height).toBe(100);
      expect(metadata.channels).toBeGreaterThanOrEqual(3);
      expect(metadata.path).toBe(redImagePath);
    });

    it('should throw error for non-existent file', async () => {
      const comparator = new ScreenshotComparator();

      await expect(
        comparator.getImageMetadata('nonexistent.png')
      ).rejects.toThrow('Cannot read image file');
    });
  });

  describe('alpha channel handling', () => {
    it('should handle alpha channel when includeAlpha is true', async () => {
      // This test assumes we have transparent images
      const comparator = new ScreenshotComparator({ includeAlpha: true });

      // Create test images with transparency for this test
      const transparentBuffer = await sharp({
        create: {
          width: 50,
          height: 50,
          channels: 4,
          background: { r: 255, g: 0, b: 0, alpha: 0.5 }
        }
      }).png().toBuffer();

      const opaqueBuffer = await sharp({
        create: {
          width: 50,
          height: 50,
          channels: 4,
          background: { r: 255, g: 0, b: 0, alpha: 1.0 }
        }
      }).png().toBuffer();

      const result = await comparator.compareBuffers(transparentBuffer, opaqueBuffer);

      // Should detect difference due to alpha channel
      expect(result.similarity).toBeLessThan(1);
    });
  });

  describe('factory function and utilities', () => {
    it('should create comparator with factory function', () => {
      const comparator = createScreenshotComparator({ tolerance: 0.2 });
      expect(comparator).toBeInstanceOf(ScreenshotComparator);
    });

    it('should work with utility function', async () => {
      const isMatch = await compareImages(redImagePath, redImageCopyPath, 0.1);
      expect(isMatch).toBe(true);

      const isNotMatch = await compareImages(redImagePath, blueImagePath, 0.1);
      expect(isNotMatch).toBe(false);
    });
  });

  describe('schema validation', () => {
    it('should validate comparison result schema', async () => {
      const comparator = new ScreenshotComparator();
      const result = await comparator.compare(redImagePath, redImageCopyPath);

      // Result should have all required properties
      expect(typeof result.similarity).toBe('number');
      expect(typeof result.differentPixels).toBe('number');
      expect(typeof result.totalPixels).toBe('number');
      expect(typeof result.isMatch).toBe('boolean');

      // Check value ranges
      expect(result.similarity).toBeGreaterThanOrEqual(0);
      expect(result.similarity).toBeLessThanOrEqual(1);
      expect(result.differentPixels).toBeGreaterThanOrEqual(0);
      expect(result.totalPixels).toBeGreaterThan(0);
    });
  });
});

/**
 * Generate test images programmatically
 */
async function generateTestImages() {
  const fixturesDir = path.join(__dirname, 'fixtures');

  try {
    // Create identical images (100x100, red background)
    const redImageBuffer = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 3,
        background: { r: 255, g: 0, b: 0 }
      }
    }).png().toBuffer();

    await fs.writeFile(path.join(fixturesDir, 'red-100x100.png'), redImageBuffer);
    await fs.writeFile(path.join(fixturesDir, 'red-100x100-copy.png'), redImageBuffer);

    // Create slightly different image (red with small blue dot)
    const redWithDotBuffer = await sharp(redImageBuffer)
      .composite([{
        input: await sharp({
          create: {
            width: 5,
            height: 5,
            channels: 3,
            background: { r: 0, g: 0, b: 255 }
          }
        }).png().toBuffer(),
        top: 10,
        left: 10
      }])
      .png()
      .toBuffer();

    await fs.writeFile(path.join(fixturesDir, 'red-with-blue-dot.png'), redWithDotBuffer);

    // Create completely different image (blue background)
    const blueImageBuffer = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 3,
        background: { r: 0, g: 0, b: 255 }
      }
    }).png().toBuffer();

    await fs.writeFile(path.join(fixturesDir, 'blue-100x100.png'), blueImageBuffer);

    // Create different size image
    const redLargerBuffer = await sharp({
      create: {
        width: 200,
        height: 200,
        channels: 3,
        background: { r: 255, g: 0, b: 0 }
      }
    }).png().toBuffer();

    await fs.writeFile(path.join(fixturesDir, 'red-200x200.png'), redLargerBuffer);

    // Create RGBA image with transparency
    const redTransparentBuffer = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 4,
        background: { r: 255, g: 0, b: 0, alpha: 0.5 }
      }
    }).png().toBuffer();

    await fs.writeFile(path.join(fixturesDir, 'red-transparent.png'), redTransparentBuffer);

  } catch (error) {
    // If we can't generate images (e.g., Sharp not installed), skip silently
    console.warn('Could not generate test images:', error);
  }
}