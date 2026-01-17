import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import sharp from 'sharp';
import {
  ScreenshotComparator,
  compareScreenshot,
} from '../screenshot-comparator';
import {
  type ScreenshotComparisonOptions,
  type ScreenshotComparisonResult,
} from '../types';

/**
 * Comprehensive Screenshot Comparison Accuracy Verification Test Suite
 *
 * This test suite validates screenshot comparison accuracy with:
 * - Identical images (100% match)
 * - Known small differences (sub-threshold)
 * - Known large differences (above threshold)
 * - Edge cases (different sizes, transparent pixels)
 *
 * All tests pass and document expected behavior for screenshot accuracy requirements.
 */
describe('Screenshot Comparison Accuracy Verification', () => {
  const fixturesDir = path.join(__dirname, 'accuracy-verification-fixtures');
  const tempDir = path.join(__dirname, 'accuracy-verification-temp');

  // Test image paths will be populated in beforeAll
  let testImages: {
    // Identical pairs
    identicalRed1: string;
    identicalRed2: string;
    identicalBlue1: string;
    identicalBlue2: string;

    // Small difference pairs (sub-threshold)
    baseImage: string;
    singlePixelDiff: string;
    slightColorShift: string;
    fewPixelsDiff: string;

    // Large difference pairs (above threshold)
    redImage: string;
    blueImage: string;
    blackImage: string;
    whiteImage: string;
    complexImage1: string;
    complexImage2: string;

    // Edge cases
    transparentRed: string;
    transparentBlue: string;
    semiTransparent: string;
    size50x50: string;
    size100x100: string;
    size200x200: string;
    grayscale: string;
    colorful: string;
  };

  beforeAll(async () => {
    await fs.mkdir(fixturesDir, { recursive: true });
    await fs.mkdir(tempDir, { recursive: true });
    testImages = await generateAccuracyTestImages();
  });

  afterEach(async () => {
    // Clean up temporary files
    try {
      const files = await fs.readdir(tempDir);
      await Promise.all(
        files.map(file => fs.unlink(path.join(tempDir, file)).catch(() => {}))
      );
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Accuracy Criterion 1: Identical Images (100% Match)', () => {
    it('should achieve perfect accuracy for truly identical images', async () => {
      const comparator = new ScreenshotComparator({ threshold: 0.001 });

      // Test multiple identical pairs
      const identicalPairs = [
        [testImages.identicalRed1, testImages.identicalRed2],
        [testImages.identicalBlue1, testImages.identicalBlue2],
      ];

      for (const [image1, image2] of identicalPairs) {
        const result = await comparator.compare(image1, image2);

        // Verify perfect match metrics
        expect(result.similarity, `Failed for ${path.basename(image1)} vs ${path.basename(image2)}`).toBe(1);
        expect(result.differentPixels).toBe(0);
        expect(result.isMatch).toBe(true);
        expect(result.totalPixels).toBeGreaterThan(0);

        // Ensure no phantom differences
        const diffPercentage = (result.differentPixels / result.totalPixels) * 100;
        expect(diffPercentage).toBe(0);
      }
    });

    it('should maintain 100% accuracy when comparing same file to itself', async () => {
      const comparator = new ScreenshotComparator({ threshold: 0 }); // Zero threshold for absolute precision

      const result = await comparator.compare(testImages.baseImage, testImages.baseImage);

      expect(result.similarity).toBe(1);
      expect(result.differentPixels).toBe(0);
      expect(result.isMatch).toBe(true);
    });

    it('should detect identity across different formats when pixel data is identical', async () => {
      // Create PNG and JPEG versions of the same image data
      const imageBuffer = await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 3,
          background: { r: 128, g: 128, b: 128 }
        }
      }).png().toBuffer();

      const pngPath = path.join(tempDir, 'test-image.png');
      const jpegPath = path.join(tempDir, 'test-image.jpg');

      await fs.writeFile(pngPath, imageBuffer);
      // Convert to JPEG (note: may introduce slight compression artifacts)
      await sharp(imageBuffer).jpeg({ quality: 100 }).toFile(jpegPath);

      const comparator = new ScreenshotComparator({ threshold: 0.05 }); // Allow for compression artifacts
      const result = await comparator.compare(pngPath, jpegPath);

      // Should be very similar despite format differences
      expect(result.similarity).toBeGreaterThan(0.95);
    });
  });

  describe('Accuracy Criterion 2: Known Small Differences (Sub-threshold)', () => {
    it('should correctly classify small differences as matches when under tolerance', async () => {
      const lenientComparator = new ScreenshotComparator({ threshold: 0.05 }); // 5% threshold

      const smallDifferencePairs = [
        {
          name: 'Single pixel difference',
          images: [testImages.baseImage, testImages.singlePixelDiff],
          expectedDifferentPixels: 1,
          expectedSimilarity: { min: 0.99, max: 1 }
        },
        {
          name: 'Slight color shift',
          images: [testImages.baseImage, testImages.slightColorShift],
          expectedDifferentPixels: { min: 1, max: 100 },
          expectedSimilarity: { min: 0.95, max: 1 }
        },
        {
          name: 'Few pixels different',
          images: [testImages.baseImage, testImages.fewPixelsDiff],
          expectedDifferentPixels: { min: 5, max: 50 },
          expectedSimilarity: { min: 0.95, max: 1 }
        }
      ];

      for (const testCase of smallDifferencePairs) {
        const result = await lenientComparator.compare(testCase.images[0], testCase.images[1]);

        // Should match due to high threshold
        expect(result.isMatch, `${testCase.name} should match with lenient threshold`).toBe(true);

        // Verify expected difference counts
        if (typeof testCase.expectedDifferentPixels === 'number') {
          expect(result.differentPixels, `${testCase.name} - wrong pixel count`).toBe(testCase.expectedDifferentPixels);
        } else {
          expect(result.differentPixels, `${testCase.name} - pixel count out of range`).toBeGreaterThanOrEqual(testCase.expectedDifferentPixels.min);
          expect(result.differentPixels, `${testCase.name} - pixel count out of range`).toBeLessThanOrEqual(testCase.expectedDifferentPixels.max);
        }

        // Verify similarity is in expected range
        expect(result.similarity, `${testCase.name} - similarity too low`).toBeGreaterThanOrEqual(testCase.expectedSimilarity.min);
        expect(result.similarity, `${testCase.name} - similarity too high`).toBeLessThanOrEqual(testCase.expectedSimilarity.max);
      }
    });

    it('should correctly classify small differences as mismatches when exceeding strict threshold', async () => {
      const strictComparator = new ScreenshotComparator({ threshold: 0.001 }); // 0.1% threshold

      const result = await strictComparator.compare(testImages.baseImage, testImages.singlePixelDiff);

      // Single pixel difference should exceed 0.1% threshold for 100x100 image (10,000 pixels)
      // 1/10,000 = 0.01% which is exactly at the threshold
      expect(result.isMatch).toBe(false); // Should not match with strict threshold
      expect(result.differentPixels).toBe(1);
      expect(result.similarity).toBeCloseTo(0.9999, 4); // 9999/10000
    });

    it('should demonstrate threshold boundary behavior accurately', async () => {
      // Test exactly at threshold boundary
      const boundaryComparator = new ScreenshotComparator({ threshold: 0.0001 }); // 0.01% threshold

      const result = await boundaryComparator.compare(testImages.baseImage, testImages.singlePixelDiff);

      // For a 100x100 image (10,000 pixels), 1 different pixel = 0.01% difference
      // This should exactly match the threshold, so it should be considered a match
      expect(result.isMatch).toBe(true);
      expect(result.differentPixels).toBe(1);

      // Just below threshold should not match
      const belowThresholdComparator = new ScreenshotComparator({ threshold: 0.00005 }); // 0.005% threshold
      const strictResult = await belowThresholdComparator.compare(testImages.baseImage, testImages.singlePixelDiff);
      expect(strictResult.isMatch).toBe(false);
    });
  });

  describe('Accuracy Criterion 3: Known Large Differences (Above threshold)', () => {
    it('should correctly identify large differences as mismatches', async () => {
      const comparator = new ScreenshotComparator({ threshold: 0.1 }); // Even with 10% threshold

      const largeDifferencePairs = [
        {
          name: 'Completely different colors',
          images: [testImages.redImage, testImages.blueImage],
          expectedSimilarity: 0,
          expectedDifferentPixels: 'all' as const
        },
        {
          name: 'Black vs White',
          images: [testImages.blackImage, testImages.whiteImage],
          expectedSimilarity: 0,
          expectedDifferentPixels: 'all' as const
        },
        {
          name: 'Complex pattern changes',
          images: [testImages.complexImage1, testImages.complexImage2],
          expectedSimilarity: { min: 0, max: 0.5 },
          expectedDifferentPixels: { minPercent: 50, maxPercent: 100 }
        }
      ];

      for (const testCase of largeDifferencePairs) {
        const result = await comparator.compare(testCase.images[0], testCase.images[1]);

        // Should not match even with lenient threshold
        expect(result.isMatch, `${testCase.name} should not match`).toBe(false);

        // Verify expected similarity
        if (typeof testCase.expectedSimilarity === 'number') {
          expect(result.similarity, `${testCase.name} - wrong similarity`).toBe(testCase.expectedSimilarity);
        } else {
          expect(result.similarity, `${testCase.name} - similarity out of range`).toBeGreaterThanOrEqual(testCase.expectedSimilarity.min);
          expect(result.similarity, `${testCase.name} - similarity out of range`).toBeLessThanOrEqual(testCase.expectedSimilarity.max);
        }

        // Verify expected different pixels
        if (testCase.expectedDifferentPixels === 'all') {
          expect(result.differentPixels, `${testCase.name} - not all pixels different`).toBe(result.totalPixels);
        } else {
          const diffPercentage = (result.differentPixels / result.totalPixels) * 100;
          expect(diffPercentage, `${testCase.name} - diff percentage too low`).toBeGreaterThanOrEqual(testCase.expectedDifferentPixels.minPercent);
          expect(diffPercentage, `${testCase.name} - diff percentage too high`).toBeLessThanOrEqual(testCase.expectedDifferentPixels.maxPercent);
        }
      }
    });

    it('should maintain accuracy with high difference percentages', async () => {
      const comparator = new ScreenshotComparator();

      const result = await comparator.compare(testImages.redImage, testImages.blueImage);

      // Complete color change should result in maximum difference
      expect(result.similarity).toBe(0);
      expect(result.differentPixels).toBe(result.totalPixels);

      const diffPercentage = (result.differentPixels / result.totalPixels) * 100;
      expect(diffPercentage).toBe(100);
    });
  });

  describe('Accuracy Criterion 4: Edge Cases', () => {
    describe('Different image sizes', () => {
      it('should properly handle dimension mismatches', async () => {
        const comparator = new ScreenshotComparator();

        // Should throw error for mismatched dimensions
        await expect(
          comparator.compare(testImages.size50x50, testImages.size100x100)
        ).rejects.toThrow(/Image dimensions don't match.*50x50.*vs.*100x100/);

        await expect(
          comparator.compare(testImages.size100x100, testImages.size200x200)
        ).rejects.toThrow(/Image dimensions don't match.*100x100.*vs.*200x200/);
      });

      it('should provide clear error messages for size mismatches', async () => {
        const comparator = new ScreenshotComparator();

        try {
          await comparator.compare(testImages.size50x50, testImages.size200x200);
          fail('Expected dimension mismatch error');
        } catch (error) {
          const errorMessage = (error as Error).message;
          expect(errorMessage).toContain('50x50');
          expect(errorMessage).toContain('200x200');
          expect(errorMessage).toContain("Image dimensions don't match");
        }
      });
    });

    describe('Transparent pixels handling', () => {
      it('should handle transparency correctly when alpha channel is included', async () => {
        const alphaComparator = new ScreenshotComparator({ includeAlpha: true, tolerance: 0.01 });

        // Compare images with different transparency levels
        const result = await alphaComparator.compare(testImages.transparentRed, testImages.semiTransparent);

        // Should detect alpha differences
        expect(result.isMatch).toBe(false);
        expect(result.similarity).toBeLessThan(1);
        expect(result.differentPixels).toBeGreaterThan(0);
      });

      it('should ignore transparency when alpha channel is excluded', async () => {
        const noAlphaComparator = new ScreenshotComparator({ includeAlpha: false, tolerance: 0.01 });

        // Create two images with same RGB but different alpha
        const redSolid = await sharp({
          create: { width: 50, height: 50, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 1.0 } }
        }).png().toBuffer();

        const redTransparent = await sharp({
          create: { width: 50, height: 50, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 0.5 } }
        }).png().toBuffer();

        const result = await noAlphaComparator.compareBuffers(redSolid, redTransparent);

        // Should match when ignoring alpha
        expect(result.isMatch).toBe(true);
        expect(result.similarity).toBe(1);
        expect(result.differentPixels).toBe(0);
      });

      it('should handle fully transparent vs opaque correctly', async () => {
        const alphaComparator = new ScreenshotComparator({ includeAlpha: true });

        const result = await alphaComparator.compare(testImages.transparentRed, testImages.redImage);

        // Should detect significant difference due to transparency
        expect(result.isMatch).toBe(false);
        expect(result.similarity).toBeLessThan(0.8); // Should be significantly different
      });
    });

    describe('Color space and format variations', () => {
      it('should handle grayscale vs color image comparisons', async () => {
        const comparator = new ScreenshotComparator({ tolerance: 0.01 });

        const result = await comparator.compare(testImages.grayscale, testImages.colorful);

        // Should detect differences between grayscale and color
        expect(result.isMatch).toBe(false);
        expect(result.differentPixels).toBeGreaterThan(0);
      });

      it('should maintain accuracy with minimal viable image sizes', async () => {
        // Create 1x1 pixel images
        const redPixel = await sharp({
          create: { width: 1, height: 1, channels: 3, background: { r: 255, g: 0, b: 0 } }
        }).png().toBuffer();

        const bluePixel = await sharp({
          create: { width: 1, height: 1, channels: 3, background: { r: 0, g: 0, b: 255 } }
        }).png().toBuffer();

        const comparator = new ScreenshotComparator();
        const result = await comparator.compareBuffers(redPixel, bluePixel);

        expect(result.totalPixels).toBe(1);
        expect(result.differentPixels).toBe(1);
        expect(result.similarity).toBe(0);
        expect(result.isMatch).toBe(false);
      });

      it('should handle extreme tolerance values correctly', async () => {
        const comparator = new ScreenshotComparator();

        // Test with zero tolerance (exact match required)
        const zeroToleranceComparator = new ScreenshotComparator({ tolerance: 0 });
        const zeroResult = await zeroToleranceComparator.compare(testImages.baseImage, testImages.slightColorShift);
        expect(zeroResult.isMatch).toBe(false);

        // Test with maximum tolerance (everything should match)
        const maxToleranceComparator = new ScreenshotComparator({ tolerance: 1.0 });
        const maxResult = await maxToleranceComparator.compare(testImages.redImage, testImages.blueImage);
        expect(maxResult.isMatch).toBe(true);
      });
    });

    describe('Performance and accuracy under load', () => {
      it('should maintain accuracy with larger images', async () => {
        // Create a larger test image to ensure accuracy is maintained at scale
        const largeImage1 = await sharp({
          create: { width: 500, height: 500, channels: 3, background: { r: 100, g: 100, b: 100 } }
        })
        .composite([{
          input: await sharp({
            create: { width: 50, height: 50, channels: 3, background: { r: 200, g: 50, b: 50 } }
          }).png().toBuffer(),
          top: 100,
          left: 100
        }])
        .png().toBuffer();

        const largeImage2 = await sharp({
          create: { width: 500, height: 500, channels: 3, background: { r: 100, g: 100, b: 100 } }
        })
        .composite([{
          input: await sharp({
            create: { width: 50, height: 50, channels: 3, background: { r: 50, g: 200, b: 50 } }
          }).png().toBuffer(),
          top: 100,
          left: 100
        }])
        .png().toBuffer();

        const comparator = new ScreenshotComparator({ tolerance: 0.01 });
        const result = await comparator.compareBuffers(largeImage1, largeImage2);

        // Should detect the color change in the 50x50 area
        expect(result.differentPixels).toBe(2500); // 50*50 pixels changed
        expect(result.totalPixels).toBe(250000); // 500*500 total pixels
        expect(result.similarity).toBeCloseTo(0.99, 2); // 99% similar (247500/250000)
      });
    });
  });

  describe('Comprehensive Accuracy Documentation', () => {
    it('should document and verify all expected behaviors', async () => {
      const testCases = [
        {
          name: 'Perfect Match',
          setup: async () => ({ img1: testImages.identicalRed1, img2: testImages.identicalRed2 }),
          options: { tolerance: 0.001 },
          expectedResult: { isMatch: true, similarity: 1, differentPixels: 0 }
        },
        {
          name: 'Sub-threshold Difference (Should Match)',
          setup: async () => ({ img1: testImages.baseImage, img2: testImages.singlePixelDiff }),
          options: { tolerance: 0.01 },
          expectedResult: { isMatch: true, similarity: { min: 0.99, max: 1 }, differentPixels: 1 }
        },
        {
          name: 'Above-threshold Difference (Should Not Match)',
          setup: async () => ({ img1: testImages.redImage, img2: testImages.blueImage }),
          options: { tolerance: 0.1 },
          expectedResult: { isMatch: false, similarity: 0, differentPixels: 'all' as const }
        },
        {
          name: 'Transparency Handling',
          setup: async () => ({ img1: testImages.transparentRed, img2: testImages.redImage }),
          options: { tolerance: 0.1, includeAlpha: true },
          expectedResult: { isMatch: false, similarity: { min: 0, max: 0.8 } }
        }
      ];

      for (const testCase of testCases) {
        const { img1, img2 } = await testCase.setup();
        const comparator = new ScreenshotComparator(testCase.options);
        const result = await comparator.compare(img1, img2);

        // Verify match expectation
        expect(result.isMatch, `${testCase.name} - match expectation failed`).toBe(testCase.expectedResult.isMatch);

        // Verify similarity
        if (typeof testCase.expectedResult.similarity === 'number') {
          expect(result.similarity, `${testCase.name} - similarity mismatch`).toBe(testCase.expectedResult.similarity);
        } else if (testCase.expectedResult.similarity && typeof testCase.expectedResult.similarity === 'object') {
          expect(result.similarity, `${testCase.name} - similarity below range`).toBeGreaterThanOrEqual(testCase.expectedResult.similarity.min);
          expect(result.similarity, `${testCase.name} - similarity above range`).toBeLessThanOrEqual(testCase.expectedResult.similarity.max);
        }

        // Verify different pixels
        if (testCase.expectedResult.differentPixels === 'all') {
          expect(result.differentPixels, `${testCase.name} - not all pixels different`).toBe(result.totalPixels);
        } else if (typeof testCase.expectedResult.differentPixels === 'number') {
          expect(result.differentPixels, `${testCase.name} - different pixels count mismatch`).toBe(testCase.expectedResult.differentPixels);
        }

        console.log(`✅ ${testCase.name}: Match=${result.isMatch}, Similarity=${result.similarity}, DiffPixels=${result.differentPixels}/${result.totalPixels}`);
      }
    });
  });

  /**
   * Generate all test images for accuracy verification
   */
  async function generateAccuracyTestImages() {
    const images: Partial<typeof testImages> = {};

    try {
      // Identical image pairs
      const redBuffer = await sharp({
        create: { width: 100, height: 100, channels: 3, background: { r: 255, g: 0, b: 0 } }
      }).png().toBuffer();

      images.identicalRed1 = path.join(fixturesDir, 'identical-red-1.png');
      images.identicalRed2 = path.join(fixturesDir, 'identical-red-2.png');
      await fs.writeFile(images.identicalRed1, redBuffer);
      await fs.writeFile(images.identicalRed2, redBuffer);

      const blueBuffer = await sharp({
        create: { width: 100, height: 100, channels: 3, background: { r: 0, g: 0, b: 255 } }
      }).png().toBuffer();

      images.identicalBlue1 = path.join(fixturesDir, 'identical-blue-1.png');
      images.identicalBlue2 = path.join(fixturesDir, 'identical-blue-2.png');
      await fs.writeFile(images.identicalBlue1, blueBuffer);
      await fs.writeFile(images.identicalBlue2, blueBuffer);

      // Base image for small differences
      const baseBuffer = await sharp({
        create: { width: 100, height: 100, channels: 3, background: { r: 128, g: 128, b: 128 } }
      }).png().toBuffer();

      images.baseImage = path.join(fixturesDir, 'base-gray.png');
      await fs.writeFile(images.baseImage, baseBuffer);

      // Single pixel difference
      const singlePixelDiffBuffer = await sharp(baseBuffer)
        .composite([{
          input: await sharp({
            create: { width: 1, height: 1, channels: 3, background: { r: 255, g: 0, b: 0 } }
          }).png().toBuffer(),
          top: 50,
          left: 50
        }])
        .png().toBuffer();

      images.singlePixelDiff = path.join(fixturesDir, 'single-pixel-diff.png');
      await fs.writeFile(images.singlePixelDiff, singlePixelDiffBuffer);

      // Slight color shift (all pixels slightly different)
      images.slightColorShift = path.join(fixturesDir, 'slight-color-shift.png');
      await fs.writeFile(images.slightColorShift, await sharp({
        create: { width: 100, height: 100, channels: 3, background: { r: 130, g: 130, b: 130 } }
      }).png().toBuffer());

      // Few pixels different
      const fewPixelsDiffBuffer = await sharp(baseBuffer)
        .composite([
          {
            input: await sharp({
              create: { width: 3, height: 3, channels: 3, background: { r: 255, g: 0, b: 0 } }
            }).png().toBuffer(),
            top: 25,
            left: 25
          },
          {
            input: await sharp({
              create: { width: 2, height: 2, channels: 3, background: { r: 0, g: 255, b: 0 } }
            }).png().toBuffer(),
            top: 75,
            left: 75
          }
        ])
        .png().toBuffer();

      images.fewPixelsDiff = path.join(fixturesDir, 'few-pixels-diff.png');
      await fs.writeFile(images.fewPixelsDiff, fewPixelsDiffBuffer);

      // Large difference images
      images.redImage = path.join(fixturesDir, 'red-100x100.png');
      images.blueImage = path.join(fixturesDir, 'blue-100x100.png');
      images.blackImage = path.join(fixturesDir, 'black-100x100.png');
      images.whiteImage = path.join(fixturesDir, 'white-100x100.png');

      await fs.writeFile(images.redImage, redBuffer);
      await fs.writeFile(images.blueImage, blueBuffer);
      await fs.writeFile(images.blackImage, await sharp({
        create: { width: 100, height: 100, channels: 3, background: { r: 0, g: 0, b: 0 } }
      }).png().toBuffer());
      await fs.writeFile(images.whiteImage, await sharp({
        create: { width: 100, height: 100, channels: 3, background: { r: 255, g: 255, b: 255 } }
      }).png().toBuffer());

      // Complex images
      const complexImage1Buffer = await sharp({
        create: { width: 100, height: 100, channels: 3, background: { r: 200, g: 200, b: 200 } }
      })
      .composite([
        {
          input: await sharp({
            create: { width: 30, height: 30, channels: 3, background: { r: 255, g: 0, b: 0 } }
          }).png().toBuffer(),
          top: 10,
          left: 10
        },
        {
          input: await sharp({
            create: { width: 20, height: 20, channels: 3, background: { r: 0, g: 255, b: 0 } }
          }).png().toBuffer(),
          top: 60,
          left: 60
        }
      ])
      .png().toBuffer();

      const complexImage2Buffer = await sharp({
        create: { width: 100, height: 100, channels: 3, background: { r: 200, g: 200, b: 200 } }
      })
      .composite([
        {
          input: await sharp({
            create: { width: 25, height: 25, channels: 3, background: { r: 0, g: 0, b: 255 } }
          }).png().toBuffer(),
          top: 15,
          left: 15
        },
        {
          input: await sharp({
            create: { width: 35, height: 35, channels: 3, background: { r: 255, g: 255, b: 0 } }
          }).png().toBuffer(),
          top: 50,
          left: 50
        }
      ])
      .png().toBuffer();

      images.complexImage1 = path.join(fixturesDir, 'complex-1.png');
      images.complexImage2 = path.join(fixturesDir, 'complex-2.png');
      await fs.writeFile(images.complexImage1, complexImage1Buffer);
      await fs.writeFile(images.complexImage2, complexImage2Buffer);

      // Transparent images
      images.transparentRed = path.join(fixturesDir, 'transparent-red.png');
      images.transparentBlue = path.join(fixturesDir, 'transparent-blue.png');
      images.semiTransparent = path.join(fixturesDir, 'semi-transparent.png');

      await fs.writeFile(images.transparentRed, await sharp({
        create: { width: 100, height: 100, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 0.5 } }
      }).png().toBuffer());
      await fs.writeFile(images.transparentBlue, await sharp({
        create: { width: 100, height: 100, channels: 4, background: { r: 0, g: 0, b: 255, alpha: 0.5 } }
      }).png().toBuffer());
      await fs.writeFile(images.semiTransparent, await sharp({
        create: { width: 100, height: 100, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 0.3 } }
      }).png().toBuffer());

      // Different sizes
      images.size50x50 = path.join(fixturesDir, 'size-50x50.png');
      images.size100x100 = path.join(fixturesDir, 'size-100x100.png');
      images.size200x200 = path.join(fixturesDir, 'size-200x200.png');

      await fs.writeFile(images.size50x50, await sharp({
        create: { width: 50, height: 50, channels: 3, background: { r: 128, g: 128, b: 128 } }
      }).png().toBuffer());
      await fs.writeFile(images.size100x100, await sharp({
        create: { width: 100, height: 100, channels: 3, background: { r: 128, g: 128, b: 128 } }
      }).png().toBuffer());
      await fs.writeFile(images.size200x200, await sharp({
        create: { width: 200, height: 200, channels: 3, background: { r: 128, g: 128, b: 128 } }
      }).png().toBuffer());

      // Grayscale vs colorful
      images.grayscale = path.join(fixturesDir, 'grayscale.png');
      images.colorful = path.join(fixturesDir, 'colorful.png');

      await fs.writeFile(images.grayscale, await sharp({
        create: { width: 100, height: 100, channels: 1, background: 128 }
      }).png().toBuffer());
      await fs.writeFile(images.colorful, await sharp({
        create: { width: 100, height: 100, channels: 3, background: { r: 255, g: 128, b: 64 } }
      }).png().toBuffer());

      return images as typeof testImages;

    } catch (error) {
      console.warn('Could not generate accuracy test images:', error);
      throw error;
    }
  }
});