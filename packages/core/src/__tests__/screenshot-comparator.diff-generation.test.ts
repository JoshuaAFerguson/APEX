import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import sharp from 'sharp';
import { ScreenshotComparator } from '../screenshot-comparator';

/**
 * Comprehensive tests for diff image generation functionality
 *
 * Tests verify that:
 * - Diff images are generated correctly with configurable colors
 * - Different pixels are highlighted in the specified color
 * - Unchanged pixels are shown as dimmed grayscale
 * - Diff images are saved alongside comparison results
 * - Various color configurations work correctly
 */
describe('ScreenshotComparator - Diff Image Generation', () => {
  const fixturesDir = path.join(__dirname, 'fixtures-diff-generation');
  const tempDir = path.join(__dirname, 'temp-diff-generation');

  beforeAll(async () => {
    await fs.mkdir(fixturesDir, { recursive: true });
    await fs.mkdir(tempDir, { recursive: true });
    await generateDiffTestImages();
  });

  afterEach(async () => {
    // Clean up temp files after each test
    try {
      const files = await fs.readdir(tempDir);
      await Promise.all(
        files.map(file => fs.unlink(path.join(tempDir, file)).catch(() => {}))
      );
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('default magenta diff color', () => {
    it('should generate diff image with default magenta color for changed pixels', async () => {
      const diffPath = path.join(tempDir, 'diff-magenta.png');
      const comparator = new ScreenshotComparator({
        outputDiff: true,
        diffOutputPath: diffPath,
        tolerance: 0.01, // Very strict to ensure differences are detected
      });

      const img1Path = path.join(fixturesDir, 'base-pattern.png');
      const img2Path = path.join(fixturesDir, 'modified-pattern.png');

      const result = await comparator.compare(img1Path, img2Path);

      // Verify diff image was created
      expect(result.diffImagePath).toBe(diffPath);

      const diffExists = await fs.access(diffPath).then(() => true).catch(() => false);
      expect(diffExists).toBe(true);

      // Analyze diff image content
      const diffBuffer = await fs.readFile(diffPath);
      const diffImage = sharp(diffBuffer);
      const { data, info } = await diffImage.raw().toBuffer({ resolveWithObject: true });

      expect(info.channels).toBe(3); // RGB output

      // Check for magenta pixels (255, 0, 255) in diff areas
      let magentaPixelCount = 0;
      let grayscalePixelCount = 0;

      for (let i = 0; i < data.length; i += 3) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        if (r === 255 && g === 0 && b === 255) {
          magentaPixelCount++;
        } else if (r === g && g === b && r < 128) { // Grayscale background pixels
          grayscalePixelCount++;
        }
      }

      expect(magentaPixelCount).toBeGreaterThan(0); // Should have diff pixels
      expect(grayscalePixelCount).toBeGreaterThan(0); // Should have unchanged pixels
    });

    it('should create diff image with proper metadata', async () => {
      const diffPath = path.join(tempDir, 'diff-metadata.png');
      const comparator = new ScreenshotComparator({
        outputDiff: true,
        diffOutputPath: diffPath,
      });

      const img1Path = path.join(fixturesDir, 'base-pattern.png');
      const img2Path = path.join(fixturesDir, 'modified-pattern.png');

      const result = await comparator.compare(img1Path, img2Path);

      // Check diff image metadata
      const diffMetadata = await sharp(diffPath).metadata();
      const originalMetadata = await sharp(img1Path).metadata();

      expect(diffMetadata.width).toBe(originalMetadata.width);
      expect(diffMetadata.height).toBe(originalMetadata.height);
      expect(diffMetadata.channels).toBe(3); // Always RGB for diff images
      expect(diffMetadata.format).toBe('png'); // Always PNG for quality
    });
  });

  describe('custom diff colors', () => {
    it('should generate diff image with custom red color', async () => {
      const diffPath = path.join(tempDir, 'diff-red.png');
      const redColor: [number, number, number] = [255, 0, 0];
      const comparator = new ScreenshotComparator({
        outputDiff: true,
        diffOutputPath: diffPath,
        diffColor: redColor,
        tolerance: 0.01,
      });

      const result = await comparator.compare(
        path.join(fixturesDir, 'base-pattern.png'),
        path.join(fixturesDir, 'modified-pattern.png')
      );

      expect(result.diffImagePath).toBe(diffPath);

      // Verify red pixels in diff image
      const { data } = await sharp(diffPath).raw().toBuffer({ resolveWithObject: true });

      let redPixelsFound = false;
      for (let i = 0; i < data.length; i += 3) {
        if (data[i] === 255 && data[i + 1] === 0 && data[i + 2] === 0) {
          redPixelsFound = true;
          break;
        }
      }

      expect(redPixelsFound).toBe(true);
    });

    it('should generate diff image with custom cyan color', async () => {
      const diffPath = path.join(tempDir, 'diff-cyan.png');
      const cyanColor: [number, number, number] = [0, 255, 255];
      const comparator = new ScreenshotComparator({
        outputDiff: true,
        diffOutputPath: diffPath,
        diffColor: cyanColor,
        tolerance: 0.01,
      });

      const result = await comparator.compare(
        path.join(fixturesDir, 'base-pattern.png'),
        path.join(fixturesDir, 'modified-pattern.png')
      );

      expect(result.diffImagePath).toBe(diffPath);

      // Verify cyan pixels in diff image
      const { data } = await sharp(diffPath).raw().toBuffer({ resolveWithObject: true });

      let cyanPixelsFound = false;
      for (let i = 0; i < data.length; i += 3) {
        if (data[i] === 0 && data[i + 1] === 255 && data[i + 2] === 255) {
          cyanPixelsFound = true;
          break;
        }
      }

      expect(cyanPixelsFound).toBe(true);
    });

    it('should handle bright yellow diff color correctly', async () => {
      const diffPath = path.join(tempDir, 'diff-yellow.png');
      const yellowColor: [number, number, number] = [255, 255, 0];
      const comparator = new ScreenshotComparator({
        outputDiff: true,
        diffOutputPath: diffPath,
        diffColor: yellowColor,
        tolerance: 0.01,
      });

      const result = await comparator.compare(
        path.join(fixturesDir, 'base-pattern.png'),
        path.join(fixturesDir, 'modified-pattern.png')
      );

      expect(result.diffImagePath).toBe(diffPath);

      // Verify yellow pixels and ensure visibility
      const { data } = await sharp(diffPath).raw().toBuffer({ resolveWithObject: true });

      let yellowPixelsFound = false;
      let totalDiffPixels = 0;

      for (let i = 0; i < data.length; i += 3) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        if (r === 255 && g === 255 && b === 0) {
          yellowPixelsFound = true;
          totalDiffPixels++;
        }
      }

      expect(yellowPixelsFound).toBe(true);
      expect(totalDiffPixels).toBeGreaterThan(0);
    });
  });

  describe('diff image content accuracy', () => {
    it('should accurately highlight only changed regions', async () => {
      const diffPath = path.join(tempDir, 'diff-accuracy.png');
      const comparator = new ScreenshotComparator({
        outputDiff: true,
        diffOutputPath: diffPath,
        diffColor: [0, 255, 0], // Green for visibility
        tolerance: 0.01,
      });

      const result = await comparator.compare(
        path.join(fixturesDir, 'base-with-square.png'),
        path.join(fixturesDir, 'modified-square-moved.png')
      );

      // Verify that diff image contains green pixels only where changes occurred
      const { data, info } = await sharp(diffPath).raw().toBuffer({ resolveWithObject: true });

      const totalPixels = info.width! * info.height!;
      let greenPixels = 0;
      let backgroundPixels = 0;

      for (let i = 0; i < data.length; i += 3) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        if (r === 0 && g === 255 && b === 0) {
          greenPixels++;
        } else if (r === g && g === b) { // Grayscale background
          backgroundPixels++;
        }
      }

      // Should have both diff pixels and background pixels
      expect(greenPixels).toBeGreaterThan(0);
      expect(backgroundPixels).toBeGreaterThan(0);
      expect(greenPixels + backgroundPixels).toBe(totalPixels);
    });

    it('should maintain original image dimensions in diff output', async () => {
      const diffPath = path.join(tempDir, 'diff-dimensions.png');
      const comparator = new ScreenshotComparator({
        outputDiff: true,
        diffOutputPath: diffPath,
      });

      const img1Path = path.join(fixturesDir, 'base-pattern.png');

      const originalMetadata = await sharp(img1Path).metadata();

      await comparator.compare(img1Path, path.join(fixturesDir, 'modified-pattern.png'));

      const diffMetadata = await sharp(diffPath).metadata();

      expect(diffMetadata.width).toBe(originalMetadata.width);
      expect(diffMetadata.height).toBe(originalMetadata.height);
    });
  });

  describe('diff image file operations', () => {
    it('should create output directory if it does not exist', async () => {
      const nestedDir = path.join(tempDir, 'nested', 'subdirectory');
      const diffPath = path.join(nestedDir, 'diff-nested.png');

      const comparator = new ScreenshotComparator({
        outputDiff: true,
        diffOutputPath: diffPath,
      });

      const result = await comparator.compare(
        path.join(fixturesDir, 'base-pattern.png'),
        path.join(fixturesDir, 'modified-pattern.png')
      );

      expect(result.diffImagePath).toBe(diffPath);

      const diffExists = await fs.access(diffPath).then(() => true).catch(() => false);
      expect(diffExists).toBe(true);
    });

    it('should not create diff image when outputDiff is false', async () => {
      const diffPath = path.join(tempDir, 'should-not-exist.png');
      const comparator = new ScreenshotComparator({
        outputDiff: false, // Explicitly disabled
        diffOutputPath: diffPath,
      });

      const result = await comparator.compare(
        path.join(fixturesDir, 'base-pattern.png'),
        path.join(fixturesDir, 'modified-pattern.png')
      );

      expect(result.diffImagePath).toBeUndefined();

      const diffExists = await fs.access(diffPath).then(() => true).catch(() => false);
      expect(diffExists).toBe(false);
    });

    it('should not create diff image when diffOutputPath is not provided', async () => {
      const comparator = new ScreenshotComparator({
        outputDiff: true,
        // diffOutputPath not provided
      });

      const result = await comparator.compare(
        path.join(fixturesDir, 'base-pattern.png'),
        path.join(fixturesDir, 'modified-pattern.png')
      );

      expect(result.diffImagePath).toBeUndefined();
    });
  });

  describe('edge cases for diff generation', () => {
    it('should handle identical images (no diff needed)', async () => {
      const diffPath = path.join(tempDir, 'diff-identical.png');
      const comparator = new ScreenshotComparator({
        outputDiff: true,
        diffOutputPath: diffPath,
      });

      const result = await comparator.compare(
        path.join(fixturesDir, 'base-pattern.png'),
        path.join(fixturesDir, 'base-pattern-copy.png') // Identical
      );

      expect(result.similarity).toBe(1);
      expect(result.differentPixels).toBe(0);

      // Diff should still be generated (showing grayscale only)
      expect(result.diffImagePath).toBe(diffPath);

      const diffExists = await fs.access(diffPath).then(() => true).catch(() => false);
      expect(diffExists).toBe(true);
    });

    it('should handle very small differences with high tolerance', async () => {
      const diffPath = path.join(tempDir, 'diff-high-tolerance.png');
      const comparator = new ScreenshotComparator({
        outputDiff: true,
        diffOutputPath: diffPath,
        tolerance: 0.5, // High tolerance
        diffColor: [255, 128, 0], // Orange
      });

      const result = await comparator.compare(
        path.join(fixturesDir, 'base-pattern.png'),
        path.join(fixturesDir, 'modified-pattern.png')
      );

      // Even with high tolerance, diff image should be generated
      expect(result.diffImagePath).toBe(diffPath);

      const diffExists = await fs.access(diffPath).then(() => true).catch(() => false);
      expect(diffExists).toBe(true);
    });
  });
});

/**
 * Generate test images for diff generation testing
 */
async function generateDiffTestImages() {
  const fixturesDir = path.join(__dirname, 'fixtures-diff-generation');

  try {
    // Create base pattern (100x100 with geometric pattern)
    const basePattern = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 3,
        background: { r: 200, g: 200, b: 200 }
      }
    })
    .composite([
      // Add some geometric shapes
      {
        input: await sharp({
          create: {
            width: 30,
            height: 30,
            channels: 3,
            background: { r: 100, g: 100, b: 255 }
          }
        }).png().toBuffer(),
        top: 10,
        left: 10
      },
      {
        input: await sharp({
          create: {
            width: 20,
            height: 40,
            channels: 3,
            background: { r: 255, g: 100, b: 100 }
          }
        }).png().toBuffer(),
        top: 50,
        left: 70
      }
    ])
    .png()
    .toBuffer();

    await fs.writeFile(path.join(fixturesDir, 'base-pattern.png'), basePattern);
    await fs.writeFile(path.join(fixturesDir, 'base-pattern-copy.png'), basePattern); // Identical copy

    // Create modified pattern (slightly different)
    const modifiedPattern = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 3,
        background: { r: 200, g: 200, b: 200 }
      }
    })
    .composite([
      // Same blue square
      {
        input: await sharp({
          create: {
            width: 30,
            height: 30,
            channels: 3,
            background: { r: 100, g: 100, b: 255 }
          }
        }).png().toBuffer(),
        top: 10,
        left: 10
      },
      // Modified red rectangle (different position and color)
      {
        input: await sharp({
          create: {
            width: 20,
            height: 40,
            channels: 3,
            background: { r: 100, g: 255, b: 100 } // Green instead of red
          }
        }).png().toBuffer(),
        top: 45, // Moved up 5 pixels
        left: 75 // Moved right 5 pixels
      }
    ])
    .png()
    .toBuffer();

    await fs.writeFile(path.join(fixturesDir, 'modified-pattern.png'), modifiedPattern);

    // Create base image with square
    const baseWithSquare = await sharp({
      create: {
        width: 80,
        height: 80,
        channels: 3,
        background: { r: 255, g: 255, b: 255 } // White background
      }
    })
    .composite([
      {
        input: await sharp({
          create: {
            width: 20,
            height: 20,
            channels: 3,
            background: { r: 0, g: 0, b: 0 } // Black square
          }
        }).png().toBuffer(),
        top: 20,
        left: 20
      }
    ])
    .png()
    .toBuffer();

    await fs.writeFile(path.join(fixturesDir, 'base-with-square.png'), baseWithSquare);

    // Create image with moved square
    const modifiedSquareMoved = await sharp({
      create: {
        width: 80,
        height: 80,
        channels: 3,
        background: { r: 255, g: 255, b: 255 } // White background
      }
    })
    .composite([
      {
        input: await sharp({
          create: {
            width: 20,
            height: 20,
            channels: 3,
            background: { r: 0, g: 0, b: 0 } // Black square
          }
        }).png().toBuffer(),
        top: 30, // Moved down 10 pixels
        left: 30 // Moved right 10 pixels
      }
    ])
    .png()
    .toBuffer();

    await fs.writeFile(path.join(fixturesDir, 'modified-square-moved.png'), modifiedSquareMoved);

  } catch (error) {
    console.warn('Could not generate diff test images:', error);
  }
}