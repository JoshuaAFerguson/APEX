/**
 * Visual Regression Helper Function Tests
 *
 * Unit tests for the compareScreenshot() helper function specifically
 * focusing on the test workflow integration requirements:
 * - Test can invoke visual comparisons via compareScreenshot() helper
 * - Helper provides intuitive interface for test writers
 * - Proper error handling and edge cases
 * - Configuration options and defaults
 * - Base64 and file path support
 */

import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { compareScreenshot, CompareOptions, ComparisonResult } from '../screenshot-comparator.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import sharp from 'sharp';

describe('Visual Regression Helper Function', () => {
  const tempDir = path.join(__dirname, 'helper-test-fixtures');
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

  describe('Basic Helper Usage', () => {
    it('should provide simple interface for identical images', async () => {
      // Create two identical test images
      const image1 = await createTestImage(100, 100, { r: 255, g: 0, b: 0 });
      const image2 = await createTestImage(100, 100, { r: 255, g: 0, b: 0 });

      // Simple usage - should be easy to use in tests
      const result = await compareScreenshot(image1, image2);

      // Verify result structure is intuitive for test writers
      expect(result.match).toBe(true);
      expect(result.diffPercentage).toBe(0);
      expect(result.similarity).toBe(1);
      expect(result.totalPixels).toBe(10000);
      expect(result.differentPixels).toBe(0);
    });

    it('should provide clear interface for different images', async () => {
      const redImage = await createTestImage(50, 50, { r: 255, g: 0, b: 0 });
      const blueImage = await createTestImage(50, 50, { r: 0, g: 0, b: 255 });

      const result = await compareScreenshot(redImage, blueImage);

      // Clear indication of mismatch
      expect(result.match).toBe(false);
      expect(result.diffPercentage).toBe(100); // Completely different
      expect(result.similarity).toBe(0);
      expect(result.totalPixels).toBe(2500); // 50x50
      expect(result.differentPixels).toBe(2500); // All pixels different
    });

    it('should work with default options for test simplicity', async () => {
      const image1 = await createTestImage(75, 75, { r: 128, g: 128, b: 128 });
      const image2 = await createTestImage(75, 75, { r: 130, g: 130, b: 130 }); // Very slight difference

      // No options provided - should use sensible defaults
      const result = await compareScreenshot(image1, image2);

      // Should pass with default threshold (10%)
      expect(result.match).toBe(true);
      expect(result.diffPercentage).toBeGreaterThan(0);
      expect(result.diffPercentage).toBeLessThan(10);
    });
  });

  describe('Configuration Options for Test Flexibility', () => {
    it('should support custom threshold for strict testing', async () => {
      const baseImage = await createTestImage(60, 60, { r: 100, g: 100, b: 100 });
      const slightlyDifferentImage = await createTestImage(60, 60, { r: 102, g: 102, b: 102 });

      const options: CompareOptions = {
        threshold: 0.01 // Very strict - 1% tolerance
      };

      const result = await compareScreenshot(baseImage, slightlyDifferentImage, options);

      // Should fail with strict threshold
      expect(result.match).toBe(false);
      expect(result.diffPercentage).toBeGreaterThan(0);
    });

    it('should support lenient threshold for flexible testing', async () => {
      const baseImage = await createTestImage(60, 60, { r: 100, g: 100, b: 100 });
      const moderatelyDifferentImage = await createTestImage(60, 60, { r: 120, g: 120, b: 120 });

      const options: CompareOptions = {
        threshold: 0.3 // Lenient - 30% tolerance
      };

      const result = await compareScreenshot(baseImage, moderatelyDifferentImage, options);

      // Should pass with lenient threshold
      expect(result.match).toBe(true);
      expect(result.diffPercentage).toBeGreaterThan(0);
    });

    it('should support diff image generation for debugging', async () => {
      const image1 = await createTestImage(80, 80, { r: 200, g: 100, b: 50 });
      const image2 = await createTestImage(80, 80, { r: 50, g: 100, b: 200 });
      const diffPath = path.join(tempDir, 'debug-diff.png');

      const options: CompareOptions = {
        threshold: 0.1,
        outputDiff: true,
        diffOutputPath: diffPath
      };

      const result = await compareScreenshot(image1, image2, options);

      // Should provide diff image for debugging
      expect(result.match).toBe(false);
      expect(result.diffImageData).toBeDefined();
      expect(result.diffImageData).toMatch(/^data:image\/png;base64,/);
      expect(result.diffImagePath).toBe(diffPath);

      // Verify diff file was created
      const diffExists = await fs.access(diffPath).then(() => true).catch(() => false);
      expect(diffExists).toBe(true);

      createdFiles.push(diffPath);
    });
  });

  describe('Test Writer Convenience Features', () => {
    it('should work with base64 images from browser screenshots', async () => {
      // Create test images and convert to base64 (simulating browser screenshots)
      const imagePath = await createTestImage(90, 90, { r: 150, g: 150, b: 150 });
      const imageBuffer = await fs.readFile(imagePath);
      const base64Image = `data:image/png;base64,${imageBuffer.toString('base64')}`;

      // Should work with base64 from browser
      const result = await compareScreenshot(imagePath, base64Image);

      expect(result.match).toBe(true);
      expect(result.diffPercentage).toBe(0);
    });

    it('should handle mixed file path and base64 inputs', async () => {
      const filePath = await createTestImage(70, 70, { r: 180, g: 90, b: 45 });
      const fileBuffer = await fs.readFile(filePath);
      const base64Data = fileBuffer.toString('base64'); // Without data URL prefix

      // Mixed inputs should work seamlessly
      const result = await compareScreenshot(filePath, base64Data);

      expect(result.match).toBe(true);
      expect(result.similarity).toBe(1);
    });

    it('should provide meaningful error messages for test debugging', async () => {
      const validImage = await createTestImage(50, 50, { r: 255, g: 255, b: 255 });

      // Non-existent file
      await expect(
        compareScreenshot('/does/not/exist.png', validImage)
      ).rejects.toThrow(/Cannot read image file/);

      // Invalid base64
      await expect(
        compareScreenshot('invalid-base64-!@#$', validImage)
      ).rejects.toThrow(/Failed to decode base64 image data/);

      // Empty string
      await expect(
        compareScreenshot('', validImage)
      ).rejects.toThrow();
    });
  });

  describe('Test Framework Integration', () => {
    it('should work naturally with assertion libraries', async () => {
      const baseline = await createTestImage(40, 40, { r: 100, g: 200, b: 150 });
      const actual = await createTestImage(40, 40, { r: 100, g: 200, b: 150 });

      const result = await compareScreenshot(baseline, actual);

      // Natural assertions for test writers
      expect(result.match).toBe(true);
      expect(result.similarity).toBeCloseTo(1);
      expect(result.diffPercentage).toBeCloseTo(0);

      // Can be used in conditional logic
      if (!result.match) {
        expect.fail(`Visual comparison failed: ${result.diffPercentage}% difference`);
      }
    });

    it('should support async test patterns', async () => {
      // Test multiple comparisons in async context
      const baselines = await Promise.all([
        createTestImage(30, 30, { r: 255, g: 0, b: 0 }),    // Red
        createTestImage(30, 30, { r: 0, g: 255, b: 0 }),    // Green
        createTestImage(30, 30, { r: 0, g: 0, b: 255 })     // Blue
      ]);

      const actuals = await Promise.all([
        createTestImage(30, 30, { r: 255, g: 0, b: 0 }),    // Red (match)
        createTestImage(30, 30, { r: 0, g: 255, b: 0 }),    // Green (match)
        createTestImage(30, 30, { r: 255, g: 255, b: 255 }) // White (no match)
      ]);

      // Parallel comparisons
      const results = await Promise.all(
        baselines.map((baseline, i) =>
          compareScreenshot(baseline, actuals[i], { threshold: 0.05 })
        )
      );

      expect(results[0].match).toBe(true);  // Red matches
      expect(results[1].match).toBe(true);  // Green matches
      expect(results[2].match).toBe(false); // Blue vs White doesn't match
    });

    it('should support test data setup and teardown patterns', async () => {
      // Setup: Create baseline during test setup
      const testData = {
        baseline: await createTestImage(85, 85, { r: 200, g: 200, b: 200 })
      };

      // Test execution: Multiple tests can reuse the baseline
      const test1Result = await compareScreenshot(
        testData.baseline,
        await createTestImage(85, 85, { r: 200, g: 200, b: 200 }) // Same
      );

      const test2Result = await compareScreenshot(
        testData.baseline,
        await createTestImage(85, 85, { r: 190, g: 190, b: 190 }), // Slightly different
        { threshold: 0.1 }
      );

      expect(test1Result.match).toBe(true);
      expect(test2Result.match).toBe(true); // Within threshold

      // Teardown happens in afterEach
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle minimum and maximum image sizes', async () => {
      // Minimum size (1x1 pixel)
      const tiny1 = await createTestImage(1, 1, { r: 255, g: 0, b: 0 });
      const tiny2 = await createTestImage(1, 1, { r: 255, g: 0, b: 0 });

      const tinyResult = await compareScreenshot(tiny1, tiny2);
      expect(tinyResult.match).toBe(true);
      expect(tinyResult.totalPixels).toBe(1);

      // Large size (within reasonable limits)
      const large1 = await createTestImage(500, 500, { r: 128, g: 128, b: 128 });
      const large2 = await createTestImage(500, 500, { r: 128, g: 128, b: 128 });

      const largeResult = await compareScreenshot(large1, large2);
      expect(largeResult.match).toBe(true);
      expect(largeResult.totalPixels).toBe(250000); // 500x500
    });

    it('should handle size mismatches gracefully', async () => {
      const small = await createTestImage(50, 50, { r: 100, g: 100, b: 100 });
      const large = await createTestImage(100, 100, { r: 100, g: 100, b: 100 });

      // Should throw clear error for size mismatch
      await expect(
        compareScreenshot(small, large)
      ).rejects.toThrow(/dimensions don't match/);
    });

    it('should handle extreme threshold values', async () => {
      const image1 = await createTestImage(60, 60, { r: 128, g: 128, b: 128 });
      const image2 = await createTestImage(60, 60, { r: 129, g: 129, b: 129 }); // Very slight difference

      // Zero threshold (exact match required)
      const strictResult = await compareScreenshot(image1, image2, { threshold: 0 });
      expect(strictResult.match).toBe(false);

      // Maximum threshold (any difference accepted)
      const lenientResult = await compareScreenshot(image1, image2, { threshold: 1 });
      expect(lenientResult.match).toBe(true);
    });

    it('should handle corrupted or invalid image data', async () => {
      const validImage = await createTestImage(50, 50, { r: 200, g: 200, b: 200 });

      // Invalid base64 (but looks like it might be valid)
      await expect(
        compareScreenshot('dGVzdCBkYXRh', validImage) // "test data" in base64, not an image
      ).rejects.toThrow();

      // Corrupted file path that exists but isn't an image
      const textFile = path.join(tempDir, 'not-an-image.txt');
      await fs.writeFile(textFile, 'This is not an image');
      createdFiles.push(textFile);

      await expect(
        compareScreenshot(textFile, validImage)
      ).rejects.toThrow();
    });
  });

  describe('Performance and Memory Management', () => {
    it('should handle multiple comparisons without memory leaks', async () => {
      // Create multiple test images
      const baselines = [];
      for (let i = 0; i < 20; i++) {
        baselines.push(await createTestImage(50, 50, { r: i * 10, g: i * 10, b: i * 10 }));
      }

      // Perform many comparisons
      const startTime = Date.now();
      const results = [];

      for (const baseline of baselines) {
        const actual = await createTestImage(50, 50, { r: 128, g: 128, b: 128 });
        const result = await compareScreenshot(baseline, actual);
        results.push(result);
      }

      const executionTime = Date.now() - startTime;

      // Verify all comparisons completed
      expect(results).toHaveLength(20);
      results.forEach(result => {
        expect(result).toHaveProperty('match');
        expect(result).toHaveProperty('similarity');
      });

      // Should complete in reasonable time
      expect(executionTime).toBeLessThan(30000); // 30 seconds for 20 comparisons
    });
  });

  // Helper function
  async function createTestImage(
    width: number,
    height: number,
    color: { r: number; g: number; b: number }
  ): Promise<string> {
    const fileName = `helper-test-${width}x${height}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.png`;
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
});