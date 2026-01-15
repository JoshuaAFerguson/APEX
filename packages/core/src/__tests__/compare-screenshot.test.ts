import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import sharp from 'sharp';
import { compareScreenshot, CompareOptions, ComparisonResult } from '../screenshot-comparator';

describe('compareScreenshot', () => {
  const tempDir = path.join(__dirname, 'temp-screenshots');
  const image1Path = path.join(tempDir, 'image1.png');
  const image2Path = path.join(tempDir, 'image2.png');
  const image3Path = path.join(tempDir, 'image3.png');
  const diffPath = path.join(tempDir, 'diff.png');

  beforeEach(async () => {
    // Create temp directory
    await fs.mkdir(tempDir, { recursive: true });

    // Create identical test images (100x100 red square)
    const redBuffer = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 3,
        background: { r: 255, g: 0, b: 0 }
      }
    }).png().toBuffer();

    await fs.writeFile(image1Path, redBuffer);
    await fs.writeFile(image2Path, redBuffer);

    // Create a different image (100x100 blue square)
    const blueBuffer = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 3,
        background: { r: 0, g: 0, b: 255 }
      }
    }).png().toBuffer();

    await fs.writeFile(image3Path, blueBuffer);
  });

  afterEach(async () => {
    // Clean up temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('file path inputs', () => {
    it('should detect identical images as matching', async () => {
      const result = await compareScreenshot(image1Path, image2Path);

      expect(result).toMatchObject({
        match: true,
        diffPercentage: 0,
        similarity: 1,
        totalPixels: 10000,
        differentPixels: 0,
      });
    });

    it('should detect different images as not matching', async () => {
      const result = await compareScreenshot(image1Path, image3Path);

      expect(result).toMatchObject({
        match: false,
        diffPercentage: 100,
        similarity: 0,
        totalPixels: 10000,
        differentPixels: 10000,
      });
    });

    it('should respect custom threshold', async () => {
      const options: CompareOptions = { threshold: 0.5 }; // Very tolerant
      const result = await compareScreenshot(image1Path, image3Path, options);

      expect(result.match).toBe(true); // Should match with high tolerance
    });

    it('should generate diff image when requested', async () => {
      const options: CompareOptions = {
        outputDiff: true,
        diffOutputPath: diffPath,
        diffColor: [255, 255, 0] // Yellow diff color
      };

      const result = await compareScreenshot(image1Path, image3Path, options);

      expect(result.diffImagePath).toBe(diffPath);
      expect(result.diffImageData).toMatch(/^data:image\/png;base64,/);

      // Verify diff file was created
      const diffFileExists = await fs.access(diffPath).then(() => true).catch(() => false);
      expect(diffFileExists).toBe(true);
    });
  });

  describe('base64 inputs', () => {
    let image1Base64: string;
    let image2Base64: string;
    let image3Base64: string;

    beforeEach(async () => {
      // Convert test images to base64
      const image1Buffer = await fs.readFile(image1Path);
      const image2Buffer = await fs.readFile(image2Path);
      const image3Buffer = await fs.readFile(image3Path);

      image1Base64 = `data:image/png;base64,${image1Buffer.toString('base64')}`;
      image2Base64 = `data:image/png;base64,${image2Buffer.toString('base64')}`;
      image3Base64 = `data:image/png;base64,${image3Buffer.toString('base64')}`;
    });

    it('should handle base64 input for both images', async () => {
      const result = await compareScreenshot(image1Base64, image2Base64);

      expect(result).toMatchObject({
        match: true,
        diffPercentage: 0,
        similarity: 1,
        totalPixels: 10000,
        differentPixels: 0,
      });
    });

    it('should handle mixed file path and base64 input', async () => {
      const result = await compareScreenshot(image1Path, image2Base64);

      expect(result).toMatchObject({
        match: true,
        diffPercentage: 0,
        similarity: 1,
      });
    });

    it('should handle base64 without data URL prefix', async () => {
      const plainBase64 = image1Base64.replace('data:image/png;base64,', '');
      const result = await compareScreenshot(plainBase64, image2Base64);

      expect(result).toMatchObject({
        match: true,
        diffPercentage: 0,
        similarity: 1,
      });
    });

    it('should detect different base64 images as not matching', async () => {
      const result = await compareScreenshot(image1Base64, image3Base64);

      expect(result).toMatchObject({
        match: false,
        diffPercentage: 100,
        similarity: 0,
      });
    });
  });

  describe('edge cases', () => {
    it('should handle non-existent file paths gracefully', async () => {
      await expect(
        compareScreenshot('/non/existent/path.png', image1Path)
      ).rejects.toThrow();
    });

    it('should handle invalid base64 data gracefully', async () => {
      await expect(
        compareScreenshot('invalid-base64-data', image1Path)
      ).rejects.toThrow();
    });

    it('should handle empty options object', async () => {
      const result = await compareScreenshot(image1Path, image2Path, {});

      expect(result).toMatchObject({
        match: true,
        diffPercentage: 0,
        similarity: 1,
      });
    });

    it('should handle includeAlpha option', async () => {
      const options: CompareOptions = { includeAlpha: true };
      const result = await compareScreenshot(image1Path, image2Path, options);

      expect(result).toMatchObject({
        match: true,
        diffPercentage: 0,
        similarity: 1,
      });
    });

    it('should handle very strict threshold (0)', async () => {
      const options: CompareOptions = { threshold: 0 };
      const result = await compareScreenshot(image1Path, image2Path, options);

      expect(result.match).toBe(true); // Identical images should still match
    });

    it('should handle very lenient threshold (1)', async () => {
      const options: CompareOptions = { threshold: 1 };
      const result = await compareScreenshot(image1Path, image3Path, options);

      expect(result.match).toBe(true); // Any difference should be accepted
    });
  });

  describe('diff image generation', () => {
    it('should include base64 diff data when outputDiff is true', async () => {
      const options: CompareOptions = {
        outputDiff: true,
        diffOutputPath: diffPath
      };

      const result = await compareScreenshot(image1Path, image3Path, options);

      expect(result.diffImageData).toBeDefined();
      expect(result.diffImageData).toMatch(/^data:image\/png;base64,/);
      expect(result.diffImagePath).toBe(diffPath);
    });

    it('should not include diff data when outputDiff is false', async () => {
      const options: CompareOptions = { outputDiff: false };
      const result = await compareScreenshot(image1Path, image3Path, options);

      expect(result.diffImageData).toBeUndefined();
      expect(result.diffImagePath).toBeUndefined();
    });

    it('should use custom diff color', async () => {
      const options: CompareOptions = {
        outputDiff: true,
        diffOutputPath: diffPath,
        diffColor: [0, 255, 0] // Green diff color
      };

      const result = await compareScreenshot(image1Path, image3Path, options);

      expect(result.diffImageData).toBeDefined();
      expect(result.diffImagePath).toBe(diffPath);
    });
  });

  describe('result format validation', () => {
    it('should return all required ComparisonResult fields', async () => {
      const result = await compareScreenshot(image1Path, image2Path);

      expect(result).toHaveProperty('match');
      expect(result).toHaveProperty('diffPercentage');
      expect(result).toHaveProperty('similarity');
      expect(result).toHaveProperty('totalPixels');
      expect(result).toHaveProperty('differentPixels');

      expect(typeof result.match).toBe('boolean');
      expect(typeof result.diffPercentage).toBe('number');
      expect(typeof result.similarity).toBe('number');
      expect(typeof result.totalPixels).toBe('number');
      expect(typeof result.differentPixels).toBe('number');
    });

    it('should have valid percentage ranges', async () => {
      const result1 = await compareScreenshot(image1Path, image2Path); // Identical
      const result2 = await compareScreenshot(image1Path, image3Path); // Different

      // Identical images
      expect(result1.diffPercentage).toBe(0);
      expect(result1.similarity).toBe(1);

      // Different images
      expect(result2.diffPercentage).toBe(100);
      expect(result2.similarity).toBe(0);

      // General ranges
      expect(result1.diffPercentage).toBeGreaterThanOrEqual(0);
      expect(result1.diffPercentage).toBeLessThanOrEqual(100);
      expect(result1.similarity).toBeGreaterThanOrEqual(0);
      expect(result1.similarity).toBeLessThanOrEqual(1);
    });
  });
});