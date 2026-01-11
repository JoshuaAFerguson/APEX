import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import sharp from 'sharp';
import { ScreenshotComparator } from '../screenshot-comparator';

/**
 * Acceptance tests for visual diff image generation feature
 *
 * Acceptance Criteria:
 * 1. ScreenshotComparator can generate a diff image highlighting changed pixels in a configurable color (default: magenta)
 * 2. Diff images are saved alongside comparison results
 * 3. Tests verify diff images accurately show differences
 */
describe('ScreenshotComparator - Acceptance Criteria', () => {
  const fixturesDir = path.join(__dirname, 'fixtures-acceptance');
  const tempDir = path.join(__dirname, 'temp-acceptance');

  beforeAll(async () => {
    await fs.mkdir(fixturesDir, { recursive: true });
    await fs.mkdir(tempDir, { recursive: true });
    await generateAcceptanceTestImages();
  });

  afterEach(async () => {
    // Clean up temp files
    try {
      const files = await fs.readdir(tempDir);
      await Promise.all(
        files.map(file => fs.unlink(path.join(tempDir, file)).catch(() => {}))
      );
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('AC1: Generate diff image with configurable color (default: magenta)', () => {
    it('should use default magenta color when no diffColor is specified', async () => {
      const diffPath = path.join(tempDir, 'default-magenta-diff.png');
      const comparator = new ScreenshotComparator({
        outputDiff: true,
        diffOutputPath: diffPath,
        tolerance: 0.01, // Strict tolerance to catch differences
      });

      const result = await comparator.compare(
        path.join(fixturesDir, 'original-ui.png'),
        path.join(fixturesDir, 'modified-ui.png')
      );

      // Verify diff was generated
      expect(result.diffImagePath).toBe(diffPath);

      // Verify file exists
      const stats = await fs.stat(diffPath);
      expect(stats.isFile()).toBe(true);
      expect(stats.size).toBeGreaterThan(0);

      // Verify magenta pixels are present
      const { data } = await sharp(diffPath).raw().toBuffer({ resolveWithObject: true });

      let foundMagenta = false;
      for (let i = 0; i < data.length; i += 3) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        // Default magenta is [255, 0, 255]
        if (r === 255 && g === 0 && b === 255) {
          foundMagenta = true;
          break;
        }
      }

      expect(foundMagenta).toBe(true);
      expect(result.similarity).toBeLessThan(1); // Should detect differences
      expect(result.differentPixels).toBeGreaterThan(0);
    });

    it('should support custom diff colors', async () => {
      const customColors = [
        { color: [255, 0, 0] as [number, number, number], name: 'red' },
        { color: [0, 255, 0] as [number, number, number], name: 'green' },
        { color: [0, 0, 255] as [number, number, number], name: 'blue' },
        { color: [255, 255, 0] as [number, number, number], name: 'yellow' },
        { color: [255, 128, 0] as [number, number, number], name: 'orange' },
        { color: [128, 0, 128] as [number, number, number], name: 'purple' },
      ];

      for (const { color, name } of customColors) {
        const diffPath = path.join(tempDir, `custom-${name}-diff.png`);
        const comparator = new ScreenshotComparator({
          outputDiff: true,
          diffOutputPath: diffPath,
          diffColor: color,
          tolerance: 0.01,
        });

        const result = await comparator.compare(
          path.join(fixturesDir, 'original-ui.png'),
          path.join(fixturesDir, 'modified-ui.png')
        );

        // Verify custom color is used
        const { data } = await sharp(diffPath).raw().toBuffer({ resolveWithObject: true });

        let foundCustomColor = false;
        for (let i = 0; i < data.length; i += 3) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          if (r === color[0] && g === color[1] && b === color[2]) {
            foundCustomColor = true;
            break;
          }
        }

        expect(foundCustomColor).toBe(true, `Failed to find ${name} color in diff image`);
      }
    });

    it('should validate color values are within valid RGB range', () => {
      // Should accept valid colors
      expect(() => {
        new ScreenshotComparator({
          diffColor: [0, 0, 0] // Black
        });
      }).not.toThrow();

      expect(() => {
        new ScreenshotComparator({
          diffColor: [255, 255, 255] // White
        });
      }).not.toThrow();

      // Should reject invalid colors (this would be caught by Zod schema validation)
      expect(() => {
        new ScreenshotComparator({
          diffColor: [-1, 0, 0] as any // Invalid negative
        });
      }).toThrow();

      expect(() => {
        new ScreenshotComparator({
          diffColor: [256, 0, 0] as any // Invalid > 255
        });
      }).toThrow();
    });
  });

  describe('AC2: Diff images are saved alongside comparison results', () => {
    it('should save diff image to specified path and return path in results', async () => {
      const diffPath = path.join(tempDir, 'result-integration.png');
      const comparator = new ScreenshotComparator({
        outputDiff: true,
        diffOutputPath: diffPath,
      });

      const result = await comparator.compare(
        path.join(fixturesDir, 'original-ui.png'),
        path.join(fixturesDir, 'modified-ui.png')
      );

      // Verify path is in results
      expect(result.diffImagePath).toBe(diffPath);

      // Verify file actually exists at that path
      const fileExists = await fs.access(diffPath).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);

      // Verify it's a valid PNG file
      const metadata = await sharp(diffPath).metadata();
      expect(metadata.format).toBe('png');
      expect(metadata.width).toBeGreaterThan(0);
      expect(metadata.height).toBeGreaterThan(0);
    });

    it('should create intermediate directories if they don\'t exist', async () => {
      const deepPath = path.join(tempDir, 'level1', 'level2', 'level3', 'diff.png');
      const comparator = new ScreenshotComparator({
        outputDiff: true,
        diffOutputPath: deepPath,
      });

      const result = await comparator.compare(
        path.join(fixturesDir, 'original-ui.png'),
        path.join(fixturesDir, 'modified-ui.png')
      );

      expect(result.diffImagePath).toBe(deepPath);

      const fileExists = await fs.access(deepPath).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);
    });

    it('should not generate diff when outputDiff is false', async () => {
      const comparator = new ScreenshotComparator({
        outputDiff: false,
      });

      const result = await comparator.compare(
        path.join(fixturesDir, 'original-ui.png'),
        path.join(fixturesDir, 'modified-ui.png')
      );

      expect(result.diffImagePath).toBeUndefined();
    });

    it('should not generate diff when diffOutputPath is not provided', async () => {
      const comparator = new ScreenshotComparator({
        outputDiff: true,
        // diffOutputPath not provided
      });

      const result = await comparator.compare(
        path.join(fixturesDir, 'original-ui.png'),
        path.join(fixturesDir, 'modified-ui.png')
      );

      expect(result.diffImagePath).toBeUndefined();
    });
  });

  describe('AC3: Tests verify diff images accurately show differences', () => {
    it('should highlight all changed pixels and preserve unchanged areas', async () => {
      const diffPath = path.join(tempDir, 'accuracy-test.png');
      const comparator = new ScreenshotComparator({
        outputDiff: true,
        diffOutputPath: diffPath,
        diffColor: [255, 0, 0], // Red for visibility
        tolerance: 0.01, // Very strict
      });

      const result = await comparator.compare(
        path.join(fixturesDir, 'test-pattern-1.png'),
        path.join(fixturesDir, 'test-pattern-2.png')
      );

      // Load diff image and analyze pixel by pixel
      const { data: diffData, info: diffInfo } = await sharp(diffPath)
        .raw()
        .toBuffer({ resolveWithObject: true });

      // Load original images to compare against
      const { data: img1Data } = await sharp(path.join(fixturesDir, 'test-pattern-1.png'))
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

      const { data: img2Data } = await sharp(path.join(fixturesDir, 'test-pattern-2.png'))
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

      const totalPixels = diffInfo.width! * diffInfo.height!;
      let correctRedPixels = 0;
      let correctGrayPixels = 0;
      let incorrectPixels = 0;

      for (let i = 0; i < totalPixels; i++) {
        const pixelIndex = i * 3;
        const diffPixelIndex = i * 3; // Diff is also RGB

        // Get RGB values from original images
        const r1 = img1Data[pixelIndex];
        const g1 = img1Data[pixelIndex + 1];
        const b1 = img1Data[pixelIndex + 2];

        const r2 = img2Data[pixelIndex];
        const g2 = img2Data[pixelIndex + 1];
        const b2 = img2Data[pixelIndex + 2];

        // Calculate if pixels should be different
        const colorDistance = Math.sqrt(
          Math.pow(r2 - r1, 2) + Math.pow(g2 - g1, 2) + Math.pow(b2 - b1, 2)
        ) / 255;

        const shouldBeDifferent = colorDistance > 0.01; // Using same tolerance as comparator

        // Get diff image pixel
        const diffR = diffData[diffPixelIndex];
        const diffG = diffData[diffPixelIndex + 1];
        const diffB = diffData[diffPixelIndex + 2];

        const isRedInDiff = diffR === 255 && diffG === 0 && diffB === 0;
        const isGrayInDiff = diffR === diffG && diffG === diffB && diffR < 128;

        if (shouldBeDifferent && isRedInDiff) {
          correctRedPixels++;
        } else if (!shouldBeDifferent && isGrayInDiff) {
          correctGrayPixels++;
        } else {
          incorrectPixels++;
        }
      }

      // Verify accuracy (allow small margin for edge cases)
      const accuracy = (correctRedPixels + correctGrayPixels) / totalPixels;
      expect(accuracy).toBeGreaterThan(0.95); // 95% accuracy
      expect(incorrectPixels).toBeLessThan(totalPixels * 0.05); // Less than 5% error
    });

    it('should maintain correct image dimensions', async () => {
      const diffPath = path.join(tempDir, 'dimensions-test.png');
      const comparator = new ScreenshotComparator({
        outputDiff: true,
        diffOutputPath: diffPath,
      });

      const originalPath = path.join(fixturesDir, 'original-ui.png');
      const modifiedPath = path.join(fixturesDir, 'modified-ui.png');

      const originalMetadata = await sharp(originalPath).metadata();

      await comparator.compare(originalPath, modifiedPath);

      const diffMetadata = await sharp(diffPath).metadata();

      expect(diffMetadata.width).toBe(originalMetadata.width);
      expect(diffMetadata.height).toBe(originalMetadata.height);
      expect(diffMetadata.channels).toBe(3); // Should always be RGB
      expect(diffMetadata.format).toBe('png'); // Should always be PNG
    });

    it('should handle edge cases correctly', async () => {
      // Test with identical images
      const diffPath1 = path.join(tempDir, 'identical-diff.png');
      const comparator1 = new ScreenshotComparator({
        outputDiff: true,
        diffOutputPath: diffPath1,
        diffColor: [0, 255, 0], // Green
      });

      const result1 = await comparator1.compare(
        path.join(fixturesDir, 'original-ui.png'),
        path.join(fixturesDir, 'original-ui.png') // Same image
      );

      expect(result1.similarity).toBe(1);
      expect(result1.differentPixels).toBe(0);

      // Diff should still be generated (all gray)
      const { data: identicalDiffData } = await sharp(diffPath1)
        .raw()
        .toBuffer({ resolveWithObject: true });

      let hasGreenPixels = false;
      for (let i = 0; i < identicalDiffData.length; i += 3) {
        if (identicalDiffData[i] === 0 && identicalDiffData[i + 1] === 255 && identicalDiffData[i + 2] === 0) {
          hasGreenPixels = true;
          break;
        }
      }

      expect(hasGreenPixels).toBe(false); // Should not have diff color for identical images

      // Test with completely different images
      const diffPath2 = path.join(tempDir, 'completely-different.png');
      const comparator2 = new ScreenshotComparator({
        outputDiff: true,
        diffOutputPath: diffPath2,
        diffColor: [255, 0, 255], // Magenta
        tolerance: 0.01,
      });

      const result2 = await comparator2.compare(
        path.join(fixturesDir, 'all-black.png'),
        path.join(fixturesDir, 'all-white.png')
      );

      expect(result2.similarity).toBe(0);
      expect(result2.differentPixels).toBe(result2.totalPixels); // All pixels different

      // Should have mostly magenta pixels
      const { data: differentDiffData } = await sharp(diffPath2)
        .raw()
        .toBuffer({ resolveWithObject: true });

      let magentaPixelCount = 0;
      for (let i = 0; i < differentDiffData.length; i += 3) {
        if (differentDiffData[i] === 255 && differentDiffData[i + 1] === 0 && differentDiffData[i + 2] === 255) {
          magentaPixelCount++;
        }
      }

      const totalPixels = differentDiffData.length / 3;
      const magentaRatio = magentaPixelCount / totalPixels;
      expect(magentaRatio).toBeGreaterThan(0.95); // Should be mostly magenta
    });
  });
});

/**
 * Generate test images for acceptance testing
 */
async function generateAcceptanceTestImages() {
  const fixturesDir = path.join(__dirname, 'fixtures-acceptance');

  try {
    // Create original UI mockup (150x100)
    const originalUI = await sharp({
      create: {
        width: 150,
        height: 100,
        channels: 3,
        background: { r: 240, g: 240, b: 240 } // Light gray background
      }
    })
    .composite([
      // Header bar
      {
        input: await sharp({
          create: {
            width: 150,
            height: 20,
            channels: 3,
            background: { r: 50, g: 50, b: 150 } // Blue header
          }
        }).png().toBuffer(),
        top: 0,
        left: 0
      },
      // Button
      {
        input: await sharp({
          create: {
            width: 40,
            height: 15,
            channels: 3,
            background: { r: 100, g: 200, b: 100 } // Green button
          }
        }).png().toBuffer(),
        top: 30,
        left: 20
      },
      // Content area
      {
        input: await sharp({
          create: {
            width: 100,
            height: 40,
            channels: 3,
            background: { r: 255, g: 255, b: 255 } // White content
          }
        }).png().toBuffer(),
        top: 50,
        left: 25
      }
    ])
    .png()
    .toBuffer();

    await fs.writeFile(path.join(fixturesDir, 'original-ui.png'), originalUI);

    // Create modified UI (button moved, color changed)
    const modifiedUI = await sharp({
      create: {
        width: 150,
        height: 100,
        channels: 3,
        background: { r: 240, g: 240, b: 240 } // Same background
      }
    })
    .composite([
      // Same header
      {
        input: await sharp({
          create: {
            width: 150,
            height: 20,
            channels: 3,
            background: { r: 50, g: 50, b: 150 }
          }
        }).png().toBuffer(),
        top: 0,
        left: 0
      },
      // Button moved and color changed
      {
        input: await sharp({
          create: {
            width: 40,
            height: 15,
            channels: 3,
            background: { r: 200, g: 100, b: 100 } // Red button (changed)
          }
        }).png().toBuffer(),
        top: 35, // Moved down 5 pixels
        left: 30 // Moved right 10 pixels
      },
      // Same content area
      {
        input: await sharp({
          create: {
            width: 100,
            height: 40,
            channels: 3,
            background: { r: 255, g: 255, b: 255 }
          }
        }).png().toBuffer(),
        top: 50,
        left: 25
      }
    ])
    .png()
    .toBuffer();

    await fs.writeFile(path.join(fixturesDir, 'modified-ui.png'), modifiedUI);

    // Create test patterns for accuracy testing
    const testPattern1 = await sharp({
      create: {
        width: 60,
        height: 60,
        channels: 3,
        background: { r: 200, g: 200, b: 200 }
      }
    })
    .composite([
      // Checkerboard pattern
      {
        input: await sharp({
          create: { width: 20, height: 20, channels: 3, background: { r: 0, g: 0, b: 0 } }
        }).png().toBuffer(),
        top: 0, left: 0
      },
      {
        input: await sharp({
          create: { width: 20, height: 20, channels: 3, background: { r: 0, g: 0, b: 0 } }
        }).png().toBuffer(),
        top: 0, left: 40
      },
      {
        input: await sharp({
          create: { width: 20, height: 20, channels: 3, background: { r: 0, g: 0, b: 0 } }
        }).png().toBuffer(),
        top: 20, left: 20
      },
      {
        input: await sharp({
          create: { width: 20, height: 20, channels: 3, background: { r: 0, g: 0, b: 0 } }
        }).png().toBuffer(),
        top: 40, left: 0
      },
      {
        input: await sharp({
          create: { width: 20, height: 20, channels: 3, background: { r: 0, g: 0, b: 0 } }
        }).png().toBuffer(),
        top: 40, left: 40
      }
    ])
    .png()
    .toBuffer();

    await fs.writeFile(path.join(fixturesDir, 'test-pattern-1.png'), testPattern1);

    // Modified checkerboard (some squares changed to white)
    const testPattern2 = await sharp({
      create: {
        width: 60,
        height: 60,
        channels: 3,
        background: { r: 200, g: 200, b: 200 }
      }
    })
    .composite([
      // Only some black squares, others changed to white
      {
        input: await sharp({
          create: { width: 20, height: 20, channels: 3, background: { r: 0, g: 0, b: 0 } }
        }).png().toBuffer(),
        top: 0, left: 0
      },
      {
        input: await sharp({
          create: { width: 20, height: 20, channels: 3, background: { r: 255, g: 255, b: 255 } } // Changed to white
        }).png().toBuffer(),
        top: 0, left: 40
      },
      {
        input: await sharp({
          create: { width: 20, height: 20, channels: 3, background: { r: 0, g: 0, b: 0 } }
        }).png().toBuffer(),
        top: 20, left: 20
      },
      {
        input: await sharp({
          create: { width: 20, height: 20, channels: 3, background: { r: 255, g: 255, b: 255 } } // Changed to white
        }).png().toBuffer(),
        top: 40, left: 0
      },
      {
        input: await sharp({
          create: { width: 20, height: 20, channels: 3, background: { r: 0, g: 0, b: 0 } }
        }).png().toBuffer(),
        top: 40, left: 40
      }
    ])
    .png()
    .toBuffer();

    await fs.writeFile(path.join(fixturesDir, 'test-pattern-2.png'), testPattern2);

    // Create all-black and all-white images for complete difference test
    const allBlack = await sharp({
      create: {
        width: 50,
        height: 50,
        channels: 3,
        background: { r: 0, g: 0, b: 0 }
      }
    }).png().toBuffer();

    const allWhite = await sharp({
      create: {
        width: 50,
        height: 50,
        channels: 3,
        background: { r: 255, g: 255, b: 255 }
      }
    }).png().toBuffer();

    await fs.writeFile(path.join(fixturesDir, 'all-black.png'), allBlack);
    await fs.writeFile(path.join(fixturesDir, 'all-white.png'), allWhite);

  } catch (error) {
    console.warn('Could not generate acceptance test images:', error);
  }
}