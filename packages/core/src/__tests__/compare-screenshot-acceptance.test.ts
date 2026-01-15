import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import sharp from 'sharp';
import { compareScreenshot, CompareOptions, ComparisonResult } from '../screenshot-comparator';

/**
 * Acceptance Tests for the compareScreenshot() helper function
 *
 * Tests the exact interface specified in the acceptance criteria:
 * A compareScreenshot(baseline: string, actual: string, options?: CompareOptions) function that:
 * 1) Accepts file paths or base64 images for baseline and actual screenshots
 * 2) Returns a ComparisonResult with match status, diff percentage, and diff image data
 * 3) Uses pixel-level comparison with configurable threshold
 * 4) Has unit tests covering match, mismatch, and edge cases
 */
describe('compareScreenshot() - Acceptance Criteria Tests', () => {
  const tempDir = path.join(__dirname, 'acceptance-test-fixtures');
  let createdFiles: string[] = [];

  beforeAll(async () => {
    await fs.mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up created files
    await Promise.all(
      createdFiles.map(filePath =>
        fs.unlink(filePath).catch(() => {}) // Ignore errors
      )
    );
    createdFiles = [];
  });

  describe('Acceptance Criteria 1: Function accepts file paths or base64 images', () => {
    let testImagePath1: string;
    let testImagePath2: string;
    let testImageBase64_1: string;
    let testImageBase64_2: string;

    beforeAll(async () => {
      // Create test images
      testImagePath1 = await createTestImage(100, 100, { r: 255, g: 0, b: 0 }); // Red
      testImagePath2 = await createTestImage(100, 100, { r: 255, g: 0, b: 0 }); // Red (identical)

      // Convert to base64
      const buffer1 = await fs.readFile(testImagePath1);
      const buffer2 = await fs.readFile(testImagePath2);
      testImageBase64_1 = `data:image/png;base64,${buffer1.toString('base64')}`;
      testImageBase64_2 = `data:image/png;base64,${buffer2.toString('base64')}`;
    });

    it('should accept file paths for both baseline and actual', async () => {
      const result = await compareScreenshot(testImagePath1, testImagePath2);

      expect(result).toBeDefined();
      expect(typeof result.match).toBe('boolean');
      expect(typeof result.diffPercentage).toBe('number');
      expect(typeof result.similarity).toBe('number');
    });

    it('should accept base64 images for both baseline and actual', async () => {
      const result = await compareScreenshot(testImageBase64_1, testImageBase64_2);

      expect(result).toBeDefined();
      expect(typeof result.match).toBe('boolean');
      expect(typeof result.diffPercentage).toBe('number');
      expect(typeof result.similarity).toBe('number');
    });

    it('should accept mixed file path and base64 (baseline=path, actual=base64)', async () => {
      const result = await compareScreenshot(testImagePath1, testImageBase64_2);

      expect(result).toBeDefined();
      expect(result.match).toBe(true); // Should match since they're identical
    });

    it('should accept mixed base64 and file path (baseline=base64, actual=path)', async () => {
      const result = await compareScreenshot(testImageBase64_1, testImagePath2);

      expect(result).toBeDefined();
      expect(result.match).toBe(true); // Should match since they're identical
    });

    it('should handle base64 without data URL prefix', async () => {
      const plainBase64 = testImageBase64_1.replace('data:image/png;base64,', '');

      const result = await compareScreenshot(plainBase64, testImagePath2);

      expect(result).toBeDefined();
      expect(result.match).toBe(true);
    });
  });

  describe('Acceptance Criteria 2: Returns ComparisonResult with required properties', () => {
    let matchingImage1: string;
    let matchingImage2: string;
    let differentImage: string;

    beforeAll(async () => {
      matchingImage1 = await createTestImage(50, 50, { r: 255, g: 0, b: 0 }); // Red
      matchingImage2 = await createTestImage(50, 50, { r: 255, g: 0, b: 0 }); // Red (identical)
      differentImage = await createTestImage(50, 50, { r: 0, g: 0, b: 255 }); // Blue (different)
    });

    it('should return ComparisonResult with match status for identical images', async () => {
      const result: ComparisonResult = await compareScreenshot(matchingImage1, matchingImage2);

      // Required properties from ComparisonResult interface
      expect(result).toHaveProperty('match');
      expect(result).toHaveProperty('diffPercentage');
      expect(result).toHaveProperty('similarity');
      expect(result).toHaveProperty('totalPixels');
      expect(result).toHaveProperty('differentPixels');

      // Values for identical images
      expect(result.match).toBe(true);
      expect(result.diffPercentage).toBe(0);
      expect(result.similarity).toBe(1);
      expect(result.totalPixels).toBe(2500); // 50x50
      expect(result.differentPixels).toBe(0);
    });

    it('should return ComparisonResult with match status for different images', async () => {
      const result: ComparisonResult = await compareScreenshot(matchingImage1, differentImage);

      // Required properties
      expect(result).toHaveProperty('match');
      expect(result).toHaveProperty('diffPercentage');
      expect(result).toHaveProperty('similarity');
      expect(result).toHaveProperty('totalPixels');
      expect(result).toHaveProperty('differentPixels');

      // Values for different images
      expect(result.match).toBe(false);
      expect(result.diffPercentage).toBe(100); // Completely different
      expect(result.similarity).toBe(0);
      expect(result.totalPixels).toBe(2500); // 50x50
      expect(result.differentPixels).toBe(2500); // All pixels different
    });

    it('should include diff image data when requested', async () => {
      const diffPath = path.join(tempDir, 'acceptance-diff.png');

      const result: ComparisonResult = await compareScreenshot(
        matchingImage1,
        differentImage,
        {
          outputDiff: true,
          diffOutputPath: diffPath
        }
      );

      // Should include diff image properties
      expect(result).toHaveProperty('diffImageData');
      expect(result).toHaveProperty('diffImagePath');

      expect(result.diffImageData).toBeDefined();
      expect(result.diffImageData).toMatch(/^data:image\/png;base64,/);
      expect(result.diffImagePath).toBe(diffPath);

      createdFiles.push(diffPath);
    });
  });

  describe('Acceptance Criteria 3: Uses pixel-level comparison with configurable threshold', () => {
    let baseImage: string;
    let slightlyDifferentImage: string;

    beforeAll(async () => {
      baseImage = await createTestImage(100, 100, { r: 255, g: 0, b: 0 }); // Pure red

      // Create image with slight difference (one blue pixel)
      slightlyDifferentImage = await createImageWithSinglePixelDifference(
        100, 100,
        { r: 255, g: 0, b: 0 }, // Base red
        { r: 0, g: 0, b: 255 },  // Blue pixel at (50, 50)
        50, 50
      );
    });

    it('should detect pixel-level differences with strict threshold', async () => {
      const result = await compareScreenshot(baseImage, slightlyDifferentImage, {
        threshold: 0.001 // Very strict - 0.1% tolerance
      });

      expect(result.match).toBe(false);
      expect(result.differentPixels).toBe(1); // Only one pixel different
      expect(result.totalPixels).toBe(10000); // 100x100
      expect(result.diffPercentage).toBe(0.01); // 1 out of 10000 pixels = 0.01%
    });

    it('should accept pixel-level differences with lenient threshold', async () => {
      const result = await compareScreenshot(baseImage, slightlyDifferentImage, {
        threshold: 0.1 // Lenient - 10% tolerance
      });

      expect(result.match).toBe(true); // Should match due to high tolerance
      expect(result.differentPixels).toBe(1); // Still only one pixel different
      expect(result.diffPercentage).toBe(0.01); // Same diff percentage, but marked as match
    });

    it('should handle boundary threshold values correctly', async () => {
      // Test with threshold exactly at the difference level
      const exactThresholdResult = await compareScreenshot(baseImage, slightlyDifferentImage, {
        threshold: 0.0001 // 0.01% tolerance - exactly at the boundary
      });

      expect(exactThresholdResult.match).toBe(true); // Should match when threshold equals difference

      // Test just below the difference level
      const belowThresholdResult = await compareScreenshot(baseImage, slightlyDifferentImage, {
        threshold: 0.00005 // 0.005% tolerance - below the 0.01% difference
      });

      expect(belowThresholdResult.match).toBe(false); // Should not match when threshold is below difference
    });

    it('should allow configurable threshold via CompareOptions', async () => {
      const options: CompareOptions = {
        threshold: 0.05, // 5% tolerance
        includeAlpha: false,
        outputDiff: false
      };

      const result = await compareScreenshot(baseImage, slightlyDifferentImage, options);

      expect(result.match).toBe(true); // Should match with 5% tolerance for 0.01% difference
    });
  });

  describe('Acceptance Criteria 4: Unit tests covering match, mismatch, and edge cases', () => {
    describe('Match scenarios', () => {
      it('should match identical images', async () => {
        const image = await createTestImage(50, 50, { r: 128, g: 128, b: 128 });
        const result = await compareScreenshot(image, image);

        expect(result.match).toBe(true);
        expect(result.similarity).toBe(1);
        expect(result.diffPercentage).toBe(0);
      });

      it('should match very similar images within tolerance', async () => {
        const image1 = await createTestImage(50, 50, { r: 255, g: 0, b: 0 });
        const image2 = await createTestImage(50, 50, { r: 254, g: 1, b: 1 }); // Very slight difference

        const result = await compareScreenshot(image1, image2, { threshold: 0.1 });

        expect(result.match).toBe(true); // Should match with sufficient tolerance
      });
    });

    describe('Mismatch scenarios', () => {
      it('should not match completely different images', async () => {
        const redImage = await createTestImage(50, 50, { r: 255, g: 0, b: 0 });
        const blueImage = await createTestImage(50, 50, { r: 0, g: 0, b: 255 });

        const result = await compareScreenshot(redImage, blueImage);

        expect(result.match).toBe(false);
        expect(result.similarity).toBe(0);
        expect(result.diffPercentage).toBe(100);
      });

      it('should not match images with differences exceeding threshold', async () => {
        const image1 = await createTestImage(50, 50, { r: 255, g: 0, b: 0 });
        const image2 = await createTestImage(50, 50, { r: 200, g: 50, b: 50 }); // Moderate difference

        const result = await compareScreenshot(image1, image2, { threshold: 0.01 }); // Very strict

        expect(result.match).toBe(false);
      });
    });

    describe('Edge cases', () => {
      it('should handle minimum size images (1x1)', async () => {
        const pixel1 = await createTestImage(1, 1, { r: 255, g: 0, b: 0 });
        const pixel2 = await createTestImage(1, 1, { r: 255, g: 0, b: 0 });

        const result = await compareScreenshot(pixel1, pixel2);

        expect(result.match).toBe(true);
        expect(result.totalPixels).toBe(1);
        expect(result.differentPixels).toBe(0);
      });

      it('should handle non-existent files gracefully', async () => {
        const validImage = await createTestImage(50, 50, { r: 255, g: 0, b: 0 });

        await expect(
          compareScreenshot('/path/that/does/not/exist.png', validImage)
        ).rejects.toThrow();
      });

      it('should handle invalid base64 data gracefully', async () => {
        const validImage = await createTestImage(50, 50, { r: 255, g: 0, b: 0 });

        await expect(
          compareScreenshot('invalid-base64-data-!@#$', validImage)
        ).rejects.toThrow();
      });

      it('should handle empty options object', async () => {
        const image1 = await createTestImage(50, 50, { r: 255, g: 0, b: 0 });
        const image2 = await createTestImage(50, 50, { r: 255, g: 0, b: 0 });

        const result = await compareScreenshot(image1, image2, {});

        expect(result).toBeDefined();
        expect(result.match).toBe(true);
      });

      it('should handle undefined options', async () => {
        const image1 = await createTestImage(50, 50, { r: 255, g: 0, b: 0 });
        const image2 = await createTestImage(50, 50, { r: 255, g: 0, b: 0 });

        const result = await compareScreenshot(image1, image2, undefined);

        expect(result).toBeDefined();
        expect(result.match).toBe(true);
      });

      it('should handle extreme threshold values', async () => {
        const image1 = await createTestImage(50, 50, { r: 255, g: 0, b: 0 });
        const image2 = await createTestImage(50, 50, { r: 0, g: 255, b: 0 });

        // Test with 0 threshold (exact match required)
        const strictResult = await compareScreenshot(image1, image2, { threshold: 0 });
        expect(strictResult.match).toBe(false);

        // Test with 1 threshold (any difference accepted)
        const lenientResult = await compareScreenshot(image1, image2, { threshold: 1 });
        expect(lenientResult.match).toBe(true);
      });
    });
  });

  // Helper functions
  async function createTestImage(
    width: number,
    height: number,
    color: { r: number; g: number; b: number }
  ): Promise<string> {
    const fileName = `acceptance-test-${width}x${height}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.png`;
    const filePath = path.join(tempDir, fileName);

    await sharp({
      create: {
        width,
        height,
        channels: 3,
        background: color
      }
    }).png().toFile(filePath);

    createdFiles.push(filePath);
    return filePath;
  }

  async function createImageWithSinglePixelDifference(
    width: number,
    height: number,
    baseColor: { r: number; g: number; b: number },
    diffColor: { r: number; g: number; b: number },
    diffX: number,
    diffY: number
  ): Promise<string> {
    const fileName = `single-pixel-diff-${width}x${height}-${Date.now()}.png`;
    const filePath = path.join(tempDir, fileName);

    // Create base image
    const baseImage = await sharp({
      create: {
        width,
        height,
        channels: 3,
        background: baseColor
      }
    }).png().toBuffer();

    // Create 1x1 overlay with different color
    const diffPixel = await sharp({
      create: {
        width: 1,
        height: 1,
        channels: 3,
        background: diffColor
      }
    }).png().toBuffer();

    // Composite the different pixel onto the base image
    await sharp(baseImage)
      .composite([{
        input: diffPixel,
        left: diffX,
        top: diffY
      }])
      .png()
      .toFile(filePath);

    createdFiles.push(filePath);
    return filePath;
  }
});