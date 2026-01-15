import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import sharp from 'sharp';
import {
  compareScreenshot,
  ScreenshotComparator,
  CompareOptions,
  ComparisonResult,
} from '../screenshot-comparator';

describe('Screenshot Comparison - Comprehensive Test Suite', () => {
  const tempDir = path.join(__dirname, 'comprehensive-test-fixtures');
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

  describe('Error Handling Edge Cases', () => {
    it('should handle corrupted image files gracefully', async () => {
      const corruptedPath = path.join(tempDir, 'corrupted.png');
      await fs.writeFile(corruptedPath, Buffer.from('not-an-image'));
      createdFiles.push(corruptedPath);

      const validImagePath = await createTestImage('red', 50, 50);

      await expect(
        compareScreenshot(corruptedPath, validImagePath)
      ).rejects.toThrow();
    });

    it('should handle empty file gracefully', async () => {
      const emptyPath = path.join(tempDir, 'empty.png');
      await fs.writeFile(emptyPath, Buffer.alloc(0));
      createdFiles.push(emptyPath);

      const validImagePath = await createTestImage('blue', 50, 50);

      await expect(
        compareScreenshot(emptyPath, validImagePath)
      ).rejects.toThrow();
    });

    it('should handle very large base64 strings gracefully', async () => {
      // Create a very large image to test memory handling
      const largeImagePath = await createTestImage('green', 1000, 1000);
      const largeImageBuffer = await fs.readFile(largeImagePath);
      const largeBase64 = `data:image/png;base64,${largeImageBuffer.toString('base64')}`;

      const smallImagePath = await createTestImage('green', 1000, 1000);

      const result = await compareScreenshot(largeBase64, smallImagePath);
      expect(result.match).toBe(true);
    });

    it('should handle malformed base64 data URL', async () => {
      const validImagePath = await createTestImage('red', 50, 50);
      const malformedBase64 = 'data:image/png;base64,invalid-base64-!@#$%^&*()';

      await expect(
        compareScreenshot(malformedBase64, validImagePath)
      ).rejects.toThrow();
    });

    it('should handle base64 with incorrect mime type', async () => {
      const validImagePath = await createTestImage('red', 50, 50);
      const imageBuffer = await fs.readFile(validImagePath);
      const incorrectMimeBase64 = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;

      // Should still work because Sharp can handle the actual image format
      const result = await compareScreenshot(incorrectMimeBase64, validImagePath);
      expect(result.match).toBe(true);
    });
  });

  describe('Complex Image Scenarios', () => {
    it('should handle gradient images with subtle differences', async () => {
      const gradient1 = await createGradientImage(200, 200, '#ff0000', '#0000ff');
      const gradient2 = await createGradientImage(200, 200, '#ff0000', '#0000fe'); // Very slight difference

      const strictResult = await compareScreenshot(gradient1, gradient2, { threshold: 0.001 });
      expect(strictResult.match).toBe(false);

      const tolerantResult = await compareScreenshot(gradient1, gradient2, { threshold: 0.1 });
      expect(tolerantResult.match).toBe(true);
    });

    it('should handle images with noise patterns', async () => {
      const noiseImage1 = await createNoisyImage(100, 100, 0.1); // 10% noise
      const noiseImage2 = await createNoisyImage(100, 100, 0.1); // Different 10% noise

      const result = await compareScreenshot(noiseImage1, noiseImage2, { threshold: 0.2 });
      expect(result.similarity).toBeGreaterThan(0.7); // Should be mostly similar despite noise
    });

    it('should handle images with transparent backgrounds', async () => {
      const transparentImage1 = await createTransparentImage(100, 100, { r: 255, g: 0, b: 0, alpha: 0.5 });
      const transparentImage2 = await createTransparentImage(100, 100, { r: 255, g: 0, b: 0, alpha: 0.6 });

      // Without alpha comparison
      const withoutAlphaResult = await compareScreenshot(transparentImage1, transparentImage2, {
        includeAlpha: false
      });
      expect(withoutAlphaResult.match).toBe(true);

      // With alpha comparison
      const withAlphaResult = await compareScreenshot(transparentImage1, transparentImage2, {
        includeAlpha: true,
        threshold: 0.05
      });
      expect(withAlphaResult.match).toBe(false);
    });

    it('should handle images with identical content but different metadata', async () => {
      const image1 = await createTestImage('red', 100, 100, { quality: 90 });
      const image2 = await createTestImage('red', 100, 100, { quality: 70 });

      const result = await compareScreenshot(image1, image2);
      expect(result.similarity).toBeGreaterThan(0.95); // Should be very similar despite quality difference
    });
  });

  describe('Performance and Scale Tests', () => {
    it('should handle multiple comparisons efficiently', async () => {
      const baseImage = await createTestImage('blue', 100, 100);
      const images = await Promise.all([
        createTestImage('red', 100, 100),
        createTestImage('green', 100, 100),
        createTestImage('yellow', 100, 100),
        createTestImage('purple', 100, 100),
      ]);

      const startTime = Date.now();

      const results = await Promise.all(
        images.map(image => compareScreenshot(baseImage, image))
      );

      const endTime = Date.now();
      const duration = endTime - startTime;

      // All comparisons should complete in reasonable time (less than 5 seconds)
      expect(duration).toBeLessThan(5000);
      expect(results).toHaveLength(4);
      results.forEach(result => {
        expect(result.match).toBe(false); // All different colors
      });
    });

    it('should handle memory efficiently with large images', async () => {
      const largeImage1 = await createTestImage('red', 500, 500);
      const largeImage2 = await createTestImage('red', 500, 500);

      const initialMemory = process.memoryUsage().heapUsed;

      const result = await compareScreenshot(largeImage1, largeImage2);

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      expect(result.match).toBe(true);
      // Memory increase should be reasonable (less than 100MB for this test)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
    });
  });

  describe('Diff Image Generation Edge Cases', () => {
    it('should create diff image directory if it doesn\'t exist', async () => {
      const nestedDiffDir = path.join(tempDir, 'nested', 'diff', 'output');
      const diffPath = path.join(nestedDiffDir, 'nested-diff.png');

      const image1 = await createTestImage('red', 50, 50);
      const image2 = await createTestImage('blue', 50, 50);

      const result = await compareScreenshot(image1, image2, {
        outputDiff: true,
        diffOutputPath: diffPath
      });

      expect(result.diffImagePath).toBe(diffPath);

      const diffExists = await fs.access(diffPath).then(() => true).catch(() => false);
      expect(diffExists).toBe(true);

      // Clean up created directory
      await fs.rm(nestedDiffDir, { recursive: true, force: true });
    });

    it('should handle diff generation with extreme color values', async () => {
      const image1 = await createTestImage('black', 50, 50); // RGB(0,0,0)
      const image2 = await createTestImage('white', 50, 50); // RGB(255,255,255)

      const diffPath = path.join(tempDir, 'extreme-diff.png');
      createdFiles.push(diffPath);

      const result = await compareScreenshot(image1, image2, {
        outputDiff: true,
        diffOutputPath: diffPath,
        diffColor: [255, 255, 255] // White diff color on black/white images
      });

      expect(result.diffImagePath).toBe(diffPath);
      expect(result.match).toBe(false);
      expect(result.diffPercentage).toBe(100);
    });

    it('should generate diff with multiple custom colors through separate calls', async () => {
      const image1 = await createTestImage('red', 100, 100);
      const image2 = await createTestImage('blue', 100, 100);

      const colors: [number, number, number][] = [
        [255, 0, 0],   // Red
        [0, 255, 0],   // Green
        [0, 0, 255],   // Blue
        [255, 255, 0], // Yellow
      ];

      const results = await Promise.all(
        colors.map(async (color, index) => {
          const diffPath = path.join(tempDir, `multi-color-diff-${index}.png`);
          createdFiles.push(diffPath);

          return compareScreenshot(image1, image2, {
            outputDiff: true,
            diffOutputPath: diffPath,
            diffColor: color
          });
        })
      );

      results.forEach((result, index) => {
        expect(result.diffImagePath).toBe(path.join(tempDir, `multi-color-diff-${index}.png`));
        expect(result.match).toBe(false);
      });
    });
  });

  describe('Real-World Integration Scenarios', () => {
    it('should work in a typical UI testing workflow', async () => {
      // Simulate a UI testing scenario with baseline and current screenshots
      const baselineScreenshot = await createMockUIScreenshot('login-form');
      const currentScreenshot = await createMockUIScreenshot('login-form-with-error');

      // First comparison - should detect changes
      const result = await compareScreenshot(baselineScreenshot, currentScreenshot, {
        threshold: 0.05, // 5% tolerance for UI changes
        outputDiff: true,
        diffOutputPath: path.join(tempDir, 'ui-diff.png')
      });

      expect(result.match).toBe(false);
      expect(result.diffImagePath).toBeDefined();
      expect(result.diffImageData).toMatch(/^data:image\/png;base64,/);

      createdFiles.push(result.diffImagePath!);
    });

    it('should handle screenshot comparison pipeline', async () => {
      // Create a series of screenshots simulating a user journey
      const screenshots = await Promise.all([
        createMockUIScreenshot('homepage'),
        createMockUIScreenshot('search-results'),
        createMockUIScreenshot('product-detail'),
        createMockUIScreenshot('cart'),
        createMockUIScreenshot('checkout'),
      ]);

      // Compare consecutive screenshots (should all be different)
      const comparisons: ComparisonResult[] = [];

      for (let i = 0; i < screenshots.length - 1; i++) {
        const result = await compareScreenshot(screenshots[i], screenshots[i + 1], {
          threshold: 0.1
        });
        comparisons.push(result);
      }

      // All consecutive screenshots should be different (different pages)
      comparisons.forEach(result => {
        expect(result.match).toBe(false);
        expect(result.similarity).toBeLessThan(0.9);
      });
    });

    it('should handle cross-platform path scenarios', async () => {
      // Test with paths that might occur on different operating systems
      const image1 = await createTestImage('red', 50, 50);
      const image2 = await createTestImage('red', 50, 50);

      // Test with absolute paths
      const result1 = await compareScreenshot(path.resolve(image1), path.resolve(image2));
      expect(result1.match).toBe(true);

      // Test with relative paths
      const rel1 = path.relative(process.cwd(), image1);
      const rel2 = path.relative(process.cwd(), image2);
      const result2 = await compareScreenshot(rel1, rel2);
      expect(result2.match).toBe(true);
    });
  });

  describe('Boundary Value Testing', () => {
    it('should handle minimum image size (1x1 pixel)', async () => {
      const tiny1 = await createTestImage('red', 1, 1);
      const tiny2 = await createTestImage('red', 1, 1);
      const tinyDifferent = await createTestImage('blue', 1, 1);

      const matchResult = await compareScreenshot(tiny1, tiny2);
      expect(matchResult.match).toBe(true);
      expect(matchResult.totalPixels).toBe(1);

      const diffResult = await compareScreenshot(tiny1, tinyDifferent);
      expect(diffResult.match).toBe(false);
      expect(diffResult.differentPixels).toBe(1);
      expect(diffResult.diffPercentage).toBe(100);
    });

    it('should handle threshold boundary values correctly', async () => {
      const image1 = await createTestImage('red', 100, 100);
      const slightlyDifferent = await createNoisyImage(100, 100, 0.01); // 1% difference

      // Test exact threshold boundary
      const exactThresholdResult = await compareScreenshot(image1, slightlyDifferent, {
        threshold: 0.02 // Exactly at expected difference level
      });
      expect(typeof exactThresholdResult.match).toBe('boolean');

      // Test just below threshold
      const belowThresholdResult = await compareScreenshot(image1, slightlyDifferent, {
        threshold: 0.005
      });
      expect(belowThresholdResult.match).toBe(false);

      // Test just above threshold
      const aboveThresholdResult = await compareScreenshot(image1, slightlyDifferent, {
        threshold: 0.05
      });
      expect(aboveThresholdResult.match).toBe(true);
    });
  });

  // Helper functions
  async function createTestImage(
    color: string,
    width: number,
    height: number,
    options: { quality?: number } = {}
  ): Promise<string> {
    const colorMap: Record<string, { r: number; g: number; b: number }> = {
      red: { r: 255, g: 0, b: 0 },
      green: { r: 0, g: 255, b: 0 },
      blue: { r: 0, g: 0, b: 255 },
      yellow: { r: 255, g: 255, b: 0 },
      purple: { r: 255, g: 0, b: 255 },
      black: { r: 0, g: 0, b: 0 },
      white: { r: 255, g: 255, b: 255 },
    };

    const rgb = colorMap[color] || colorMap.red;
    const fileName = `test-${color}-${width}x${height}-${Date.now()}.png`;
    const filePath = path.join(tempDir, fileName);

    let imageProcessor = sharp({
      create: {
        width,
        height,
        channels: 3,
        background: rgb
      }
    }).png();

    if (options.quality) {
      imageProcessor = imageProcessor.png({ quality: options.quality });
    }

    await imageProcessor.toFile(filePath);
    createdFiles.push(filePath);

    return filePath;
  }

  async function createGradientImage(
    width: number,
    height: number,
    startColor: string,
    endColor: string
  ): Promise<string> {
    // Create a simple gradient by interpolating colors
    const fileName = `gradient-${width}x${height}-${Date.now()}.png`;
    const filePath = path.join(tempDir, fileName);

    // Create gradient using SVG and convert to PNG
    const svg = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" style="stop-color:${startColor};stop-opacity:1" />
            <stop offset="100%" style="stop-color:${endColor};stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#grad)" />
      </svg>
    `;

    await sharp(Buffer.from(svg))
      .png()
      .toFile(filePath);

    createdFiles.push(filePath);
    return filePath;
  }

  async function createNoisyImage(width: number, height: number, noiseLevel: number): Promise<string> {
    const fileName = `noisy-${width}x${height}-${noiseLevel}-${Date.now()}.png`;
    const filePath = path.join(tempDir, fileName);

    // Create base red image
    const baseImage = await sharp({
      create: {
        width,
        height,
        channels: 3,
        background: { r: 255, g: 0, b: 0 }
      }
    }).raw().toBuffer();

    // Add random noise
    const noisyBuffer = Buffer.from(baseImage);
    const pixelCount = width * height;

    for (let i = 0; i < pixelCount * 3; i += 3) {
      if (Math.random() < noiseLevel) {
        noisyBuffer[i] = Math.floor(Math.random() * 256);     // R
        noisyBuffer[i + 1] = Math.floor(Math.random() * 256); // G
        noisyBuffer[i + 2] = Math.floor(Math.random() * 256); // B
      }
    }

    await sharp(noisyBuffer, {
      raw: { width, height, channels: 3 }
    }).png().toFile(filePath);

    createdFiles.push(filePath);
    return filePath;
  }

  async function createTransparentImage(
    width: number,
    height: number,
    color: { r: number; g: number; b: number; alpha: number }
  ): Promise<string> {
    const fileName = `transparent-${width}x${height}-${Date.now()}.png`;
    const filePath = path.join(tempDir, fileName);

    await sharp({
      create: {
        width,
        height,
        channels: 4,
        background: color
      }
    }).png().toFile(filePath);

    createdFiles.push(filePath);
    return filePath;
  }

  async function createMockUIScreenshot(pageName: string): Promise<string> {
    const fileName = `ui-${pageName}-${Date.now()}.png`;
    const filePath = path.join(tempDir, fileName);

    // Create different mock UI layouts
    const layouts: Record<string, any> = {
      'login-form': { r: 240, g: 240, b: 240 },
      'login-form-with-error': { r: 255, g: 220, b: 220 },
      'homepage': { r: 255, g: 255, b: 255 },
      'search-results': { r: 250, g: 250, b: 255 },
      'product-detail': { r: 255, g: 250, b: 250 },
      'cart': { r: 250, g: 255, b: 250 },
      'checkout': { r: 255, g: 255, b: 240 },
    };

    const layout = layouts[pageName] || layouts['homepage'];

    await sharp({
      create: {
        width: 800,
        height: 600,
        channels: 3,
        background: layout
      }
    }).png().toFile(filePath);

    createdFiles.push(filePath);
    return filePath;
  }
});