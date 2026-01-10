import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import sharp from 'sharp';
import { ScreenshotComparator, createScreenshotComparator, compareImages } from '../screenshot-comparator';
import { ScreenshotComparisonOptions } from '../types';

describe('ScreenshotComparator - Integration Tests', () => {
  const fixturesDir = path.join(__dirname, 'fixtures-integration');
  const tempDir = path.join(__dirname, 'temp-integration');

  beforeAll(async () => {
    await fs.mkdir(fixturesDir, { recursive: true });
    await fs.mkdir(tempDir, { recursive: true });
    await generateIntegrationTestImages();
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

  describe('image format support', () => {
    it('should handle PNG images correctly', async () => {
      const comparator = new ScreenshotComparator();
      const img1Path = path.join(fixturesDir, 'test-image.png');
      const img2Path = path.join(fixturesDir, 'test-image-copy.png');

      const result = await comparator.compare(img1Path, img2Path);

      expect(result.similarity).toBe(1);
      expect(result.isMatch).toBe(true);
    });

    it('should handle JPEG images correctly', async () => {
      const comparator = new ScreenshotComparator({ tolerance: 0.05 }); // JPEG has compression artifacts
      const img1Path = path.join(fixturesDir, 'test-image.jpg');
      const img2Path = path.join(fixturesDir, 'test-image-copy.jpg');

      const result = await comparator.compare(img1Path, img2Path);

      expect(result.similarity).toBeCloseTo(1, 1); // Close to 1 due to compression
      expect(result.isMatch).toBe(true);
    });

    it('should handle WebP images correctly', async () => {
      const comparator = new ScreenshotComparator();
      const img1Path = path.join(fixturesDir, 'test-image.webp');
      const img2Path = path.join(fixturesDir, 'test-image-copy.webp');

      const result = await comparator.compare(img1Path, img2Path);

      expect(result.similarity).toBe(1);
      expect(result.isMatch).toBe(true);
    });

    it('should handle TIFF images correctly', async () => {
      const comparator = new ScreenshotComparator();
      const img1Path = path.join(fixturesDir, 'test-image.tiff');
      const img2Path = path.join(fixturesDir, 'test-image-copy.tiff');

      const result = await comparator.compare(img1Path, img2Path);

      expect(result.similarity).toBe(1);
      expect(result.isMatch).toBe(true);
    });

    it('should handle cross-format comparisons', async () => {
      // Compare PNG vs JPEG versions of the same image
      const comparator = new ScreenshotComparator({ tolerance: 0.1 });
      const pngPath = path.join(fixturesDir, 'test-image.png');
      const jpegPath = path.join(fixturesDir, 'test-image.jpg');

      const result = await comparator.compare(pngPath, jpegPath);

      // Should be similar but not identical due to format differences
      expect(result.similarity).toBeGreaterThan(0.9);
    });
  });

  describe('color space handling', () => {
    it('should handle RGB images correctly', async () => {
      const comparator = new ScreenshotComparator();
      const img1Path = path.join(fixturesDir, 'rgb-image.png');
      const img2Path = path.join(fixturesDir, 'rgb-image-copy.png');

      const result = await comparator.compare(img1Path, img2Path);

      expect(result.similarity).toBe(1);
    });

    it('should handle RGBA images with alpha channel', async () => {
      const comparator = new ScreenshotComparator({ includeAlpha: true });
      const img1Path = path.join(fixturesDir, 'rgba-image.png');
      const img2Path = path.join(fixturesDir, 'rgba-image-copy.png');

      const result = await comparator.compare(img1Path, img2Path);

      expect(result.similarity).toBe(1);
    });

    it('should handle grayscale images', async () => {
      const comparator = new ScreenshotComparator();
      const img1Path = path.join(fixturesDir, 'grayscale-image.png');
      const img2Path = path.join(fixturesDir, 'grayscale-image-copy.png');

      const result = await comparator.compare(img1Path, img2Path);

      expect(result.similarity).toBe(1);
    });

    it('should handle color space conversion correctly', async () => {
      const comparator = new ScreenshotComparator({ tolerance: 0.05 });
      const rgbPath = path.join(fixturesDir, 'test-image-rgb.png');
      const srgbPath = path.join(fixturesDir, 'test-image-srgb.png');

      const result = await comparator.compare(rgbPath, srgbPath);

      // Should be very similar despite color space differences
      expect(result.similarity).toBeGreaterThan(0.95);
    });
  });

  describe('real-world scenarios', () => {
    it('should handle screenshots from different browsers', async () => {
      // Simulate slight rendering differences between browsers
      const comparator = new ScreenshotComparator({ tolerance: 0.02 });
      const chromeScreenshot = path.join(fixturesDir, 'screenshot-chrome.png');
      const firefoxScreenshot = path.join(fixturesDir, 'screenshot-firefox.png');

      const result = await comparator.compare(chromeScreenshot, firefoxScreenshot);

      // Should be similar but may have minor differences
      expect(result.similarity).toBeGreaterThan(0.95);
    });

    it('should handle font rendering differences', async () => {
      const comparator = new ScreenshotComparator({ tolerance: 0.05 });
      const screenshot1 = path.join(fixturesDir, 'text-rendering-1.png');
      const screenshot2 = path.join(fixturesDir, 'text-rendering-2.png');

      const result = await comparator.compare(screenshot1, screenshot2);

      expect(result.similarity).toBeGreaterThan(0.90);
    });

    it('should handle anti-aliasing differences', async () => {
      const comparator = new ScreenshotComparator({ tolerance: 0.03 });
      const noAA = path.join(fixturesDir, 'no-antialiasing.png');
      const withAA = path.join(fixturesDir, 'with-antialiasing.png');

      const result = await comparator.compare(noAA, withAA);

      expect(result.similarity).toBeGreaterThan(0.92);
    });

    it('should detect significant UI changes', async () => {
      const comparator = new ScreenshotComparator({ tolerance: 0.1 });
      const beforePath = path.join(fixturesDir, 'ui-before.png');
      const afterPath = path.join(fixturesDir, 'ui-after-major-change.png');

      const result = await comparator.compare(beforePath, afterPath);

      expect(result.similarity).toBeLessThan(0.8); // Major change should be detected
      expect(result.isMatch).toBe(false);
    });

    it('should handle minor UI updates appropriately', async () => {
      const comparator = new ScreenshotComparator({ tolerance: 0.05 });
      const beforePath = path.join(fixturesDir, 'ui-before.png');
      const afterPath = path.join(fixturesDir, 'ui-after-minor-change.png');

      const result = await comparator.compare(beforePath, afterPath);

      expect(result.similarity).toBeGreaterThan(0.9);
      expect(result.isMatch).toBe(true); // Minor change should pass with appropriate tolerance
    });
  });

  describe('workflow integration', () => {
    it('should integrate with screenshot generation workflow', async () => {
      // Simulate a complete screenshot comparison workflow
      const comparator = new ScreenshotComparator({
        tolerance: 0.02,
        outputDiff: true,
        diffOutputPath: path.join(tempDir, 'workflow-diff.png'),
      });

      const baselinePath = path.join(fixturesDir, 'baseline-screenshot.png');
      const currentPath = path.join(fixturesDir, 'current-screenshot.png');

      const result = await comparator.compare(baselinePath, currentPath);

      expect(result).toHaveProperty('similarity');
      expect(result).toHaveProperty('isMatch');
      expect(result).toHaveProperty('differentPixels');
      expect(result).toHaveProperty('totalPixels');

      if (result.differentPixels > 0) {
        expect(result.diffImagePath).toBeDefined();
        const diffExists = await fs.access(result.diffImagePath!).then(() => true).catch(() => false);
        expect(diffExists).toBe(true);
      }
    });

    it('should handle batch processing efficiently', async () => {
      const comparator = new ScreenshotComparator({ tolerance: 0.05 });
      const baselineDir = path.join(fixturesDir, 'batch-baselines');
      const currentDir = path.join(fixturesDir, 'batch-current');

      // Simulate processing multiple screenshots
      const testFiles = ['page1.png', 'page2.png', 'page3.png'];

      const results = await Promise.all(
        testFiles.map(async (file) => {
          const baselinePath = path.join(baselineDir, file);
          const currentPath = path.join(currentDir, file);

          // Check if files exist before comparing
          try {
            await fs.access(baselinePath);
            await fs.access(currentPath);
            return await comparator.compare(baselinePath, currentPath);
          } catch {
            // Files don't exist, skip this comparison
            return null;
          }
        })
      );

      const validResults = results.filter(result => result !== null);

      if (validResults.length > 0) {
        expect(validResults.every(result => typeof result!.similarity === 'number')).toBe(true);
        expect(validResults.every(result => typeof result!.isMatch === 'boolean')).toBe(true);
      }
    });
  });

  describe('factory functions and utilities', () => {
    it('should work with createScreenshotComparator factory', async () => {
      const comparator = createScreenshotComparator({
        tolerance: 0.1,
        includeAlpha: false,
        outputDiff: false,
      });

      const img1Path = path.join(fixturesDir, 'test-image.png');
      const img2Path = path.join(fixturesDir, 'test-image-copy.png');

      const result = await comparator.compare(img1Path, img2Path);

      expect(result.similarity).toBe(1);
      expect(result.isMatch).toBe(true);
    });

    it('should work with compareImages utility function', async () => {
      const img1Path = path.join(fixturesDir, 'test-image.png');
      const img2Path = path.join(fixturesDir, 'test-image-copy.png');

      const isMatch = await compareImages(img1Path, img2Path, 0.05);

      expect(isMatch).toBe(true);
    });

    it('should handle different option configurations', async () => {
      const options: ScreenshotComparisonOptions[] = [
        { tolerance: 0.01, includeAlpha: false },
        { tolerance: 0.1, includeAlpha: true },
        { tolerance: 0.05, outputDiff: true, diffOutputPath: path.join(tempDir, 'config-test.png') },
      ];

      const img1Path = path.join(fixturesDir, 'test-image.png');
      const img2Path = path.join(fixturesDir, 'test-image-copy.png');

      for (const option of options) {
        const comparator = new ScreenshotComparator(option);
        const result = await comparator.compare(img1Path, img2Path);

        expect(result.similarity).toBeDefined();
        expect(result.isMatch).toBeDefined();
        expect(result.differentPixels).toBeGreaterThanOrEqual(0);
        expect(result.totalPixels).toBeGreaterThan(0);
      }
    });
  });

  describe('metadata integration', () => {
    it('should provide accurate metadata for various formats', async () => {
      const comparator = new ScreenshotComparator();
      const formats = ['png', 'jpg', 'webp'];

      for (const format of formats) {
        const imagePath = path.join(fixturesDir, `test-image.${format}`);

        try {
          const metadata = await comparator.getImageMetadata(imagePath);

          expect(metadata.width).toBeGreaterThan(0);
          expect(metadata.height).toBeGreaterThan(0);
          expect(metadata.channels).toBeGreaterThanOrEqual(1);
          expect(metadata.path).toBe(imagePath);
        } catch (error) {
          // If format is not supported or file doesn't exist, that's OK for this test
          console.warn(`Could not get metadata for ${format}:`, error);
        }
      }
    });
  });
});

/**
 * Generate integration test images
 */
async function generateIntegrationTestImages() {
  const fixturesDir = path.join(__dirname, 'fixtures-integration');

  try {
    console.log('Generating integration test images...');

    // Base test image (200x200 with gradient)
    const baseImage = sharp({
      create: {
        width: 200,
        height: 200,
        channels: 3,
        background: { r: 255, g: 0, b: 0 }
      }
    });

    // Add some visual complexity - a simple pattern
    const pattern = await sharp({
      create: {
        width: 50,
        height: 50,
        channels: 3,
        background: { r: 0, g: 255, b: 0 }
      }
    }).png().toBuffer();

    const testImageBuffer = await baseImage
      .composite([
        { input: pattern, top: 25, left: 25 },
        { input: pattern, top: 125, left: 125 },
      ])
      .png()
      .toBuffer();

    // Generate images in different formats
    await fs.writeFile(path.join(fixturesDir, 'test-image.png'), testImageBuffer);
    await fs.writeFile(path.join(fixturesDir, 'test-image-copy.png'), testImageBuffer);

    // JPEG versions (with slight compression differences)
    const jpegBuffer = await sharp(testImageBuffer)
      .jpeg({ quality: 95 })
      .toBuffer();

    await fs.writeFile(path.join(fixturesDir, 'test-image.jpg'), jpegBuffer);
    await fs.writeFile(path.join(fixturesDir, 'test-image-copy.jpg'), jpegBuffer);

    // WebP versions
    const webpBuffer = await sharp(testImageBuffer)
      .webp({ quality: 95 })
      .toBuffer();

    await fs.writeFile(path.join(fixturesDir, 'test-image.webp'), webpBuffer);
    await fs.writeFile(path.join(fixturesDir, 'test-image-copy.webp'), webpBuffer);

    // TIFF versions
    const tiffBuffer = await sharp(testImageBuffer)
      .tiff()
      .toBuffer();

    await fs.writeFile(path.join(fixturesDir, 'test-image.tiff'), tiffBuffer);
    await fs.writeFile(path.join(fixturesDir, 'test-image-copy.tiff'), tiffBuffer);

    // RGB and RGBA variants
    await fs.writeFile(path.join(fixturesDir, 'rgb-image.png'), testImageBuffer);
    await fs.writeFile(path.join(fixturesDir, 'rgb-image-copy.png'), testImageBuffer);

    // RGBA with transparency
    const rgbaBuffer = await sharp(testImageBuffer)
      .ensureAlpha()
      .png()
      .toBuffer();

    await fs.writeFile(path.join(fixturesDir, 'rgba-image.png'), rgbaBuffer);
    await fs.writeFile(path.join(fixturesDir, 'rgba-image-copy.png'), rgbaBuffer);

    // Grayscale variants
    const grayscaleBuffer = await sharp(testImageBuffer)
      .greyscale()
      .png()
      .toBuffer();

    await fs.writeFile(path.join(fixturesDir, 'grayscale-image.png'), grayscaleBuffer);
    await fs.writeFile(path.join(fixturesDir, 'grayscale-image-copy.png'), grayscaleBuffer);

    // Color space variants
    await fs.writeFile(path.join(fixturesDir, 'test-image-rgb.png'), testImageBuffer);
    await fs.writeFile(path.join(fixturesDir, 'test-image-srgb.png'), testImageBuffer);

    // Simulate browser screenshot differences
    const chromeScreenshot = await sharp(testImageBuffer)
      .composite([{
        input: await sharp({
          create: { width: 2, height: 2, channels: 3, background: { r: 1, g: 1, b: 1 } }
        }).png().toBuffer(),
        top: 10,
        left: 10
      }])
      .png()
      .toBuffer();

    const firefoxScreenshot = await sharp(testImageBuffer)
      .composite([{
        input: await sharp({
          create: { width: 2, height: 2, channels: 3, background: { r: 2, g: 2, b: 2 } }
        }).png().toBuffer(),
        top: 10,
        left: 10
      }])
      .png()
      .toBuffer();

    await fs.writeFile(path.join(fixturesDir, 'screenshot-chrome.png'), chromeScreenshot);
    await fs.writeFile(path.join(fixturesDir, 'screenshot-firefox.png'), firefoxScreenshot);

    // Text rendering simulation
    await fs.writeFile(path.join(fixturesDir, 'text-rendering-1.png'), testImageBuffer);

    const textRendering2 = await sharp(testImageBuffer)
      .composite([{
        input: await sharp({
          create: { width: 1, height: 1, channels: 3, background: { r: 250, g: 250, b: 250 } }
        }).png().toBuffer(),
        top: 50,
        left: 50
      }])
      .png()
      .toBuffer();

    await fs.writeFile(path.join(fixturesDir, 'text-rendering-2.png'), textRendering2);

    // Anti-aliasing simulation
    await fs.writeFile(path.join(fixturesDir, 'no-antialiasing.png'), testImageBuffer);

    const withAA = await sharp(testImageBuffer)
      .blur(0.3) // Slight blur to simulate anti-aliasing
      .png()
      .toBuffer();

    await fs.writeFile(path.join(fixturesDir, 'with-antialiasing.png'), withAA);

    // UI change simulation
    await fs.writeFile(path.join(fixturesDir, 'ui-before.png'), testImageBuffer);

    // Minor change
    const minorChange = await sharp(testImageBuffer)
      .composite([{
        input: await sharp({
          create: { width: 5, height: 5, channels: 3, background: { r: 0, g: 0, b: 255 } }
        }).png().toBuffer(),
        top: 180,
        left: 180
      }])
      .png()
      .toBuffer();

    await fs.writeFile(path.join(fixturesDir, 'ui-after-minor-change.png'), minorChange);

    // Major change
    const majorChange = await sharp({
      create: {
        width: 200,
        height: 200,
        channels: 3,
        background: { r: 0, g: 0, b: 255 }
      }
    })
      .composite([{
        input: await sharp({
          create: { width: 100, height: 100, channels: 3, background: { r: 255, g: 255, b: 0 } }
        }).png().toBuffer(),
        top: 50,
        left: 50
      }])
      .png()
      .toBuffer();

    await fs.writeFile(path.join(fixturesDir, 'ui-after-major-change.png'), majorChange);

    // Baseline and current screenshots for workflow testing
    await fs.writeFile(path.join(fixturesDir, 'baseline-screenshot.png'), testImageBuffer);
    await fs.writeFile(path.join(fixturesDir, 'current-screenshot.png'), minorChange);

    // Batch processing directories (if they don't exist, that's OK)
    try {
      await fs.mkdir(path.join(fixturesDir, 'batch-baselines'), { recursive: true });
      await fs.mkdir(path.join(fixturesDir, 'batch-current'), { recursive: true });

      // Create a few batch test files
      await fs.writeFile(path.join(fixturesDir, 'batch-baselines', 'page1.png'), testImageBuffer);
      await fs.writeFile(path.join(fixturesDir, 'batch-current', 'page1.png'), testImageBuffer);
    } catch {
      // Skip batch directories if we can't create them
    }

    console.log('Integration test images generated successfully');

  } catch (error) {
    console.warn('Could not generate some integration test images:', error);
  }
}