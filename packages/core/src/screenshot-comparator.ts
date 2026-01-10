import * as fs from 'fs/promises';
import * as path from 'path';
import sharp from 'sharp';
import pixelmatch from 'pixelmatch';
import {
  ScreenshotComparisonOptions,
  ScreenshotComparisonOptionsSchema,
  ScreenshotComparisonResult,
  ScreenshotComparisonResultSchema,
  ImageMetadata,
  ImageMetadataSchema,
} from './types';

/**
 * Core screenshot comparison engine with pixel-diff algorithm
 *
 * Provides functionality to:
 * - Load two images from file paths or buffers
 * - Compute pixel-by-pixel differences using configurable tolerance
 * - Return similarity score (0-1)
 * - Generate diff images
 * - Handle different image formats and sizes
 */
export class ScreenshotComparator {
  private defaultOptions: Required<ScreenshotComparisonOptions>;

  constructor(options: Partial<ScreenshotComparisonOptions> = {}) {
    // Validate and set default options
    this.defaultOptions = {
      tolerance: options.tolerance ?? 0.1,
      includeAlpha: options.includeAlpha ?? false,
      outputDiff: options.outputDiff ?? false,
      diffOutputPath: options.diffOutputPath,
    };

    // Validate options schema
    ScreenshotComparisonOptionsSchema.parse(this.defaultOptions);
  }

  /**
   * Compare two images and return similarity metrics
   *
   * @param imagePath1 - Path to first image
   * @param imagePath2 - Path to second image
   * @param options - Comparison options (overrides defaults)
   * @returns Comparison result with similarity score and metrics
   */
  async compare(
    imagePath1: string,
    imagePath2: string,
    options: Partial<ScreenshotComparisonOptions> = {}
  ): Promise<ScreenshotComparisonResult> {
    // Merge options with defaults
    const finalOptions = { ...this.defaultOptions, ...options };

    // Validate input files exist
    await this.validateImageFile(imagePath1);
    await this.validateImageFile(imagePath2);

    // Load and normalize images
    const [image1Data, image2Data] = await Promise.all([
      this.loadAndNormalizeImage(imagePath1, finalOptions),
      this.loadAndNormalizeImage(imagePath2, finalOptions),
    ]);

    // Ensure images have the same dimensions
    if (
      image1Data.info.width !== image2Data.info.width ||
      image1Data.info.height !== image2Data.info.height
    ) {
      throw new Error(
        `Image dimensions don't match: ${image1Data.info.width}x${image1Data.info.height} vs ${image2Data.info.width}x${image2Data.info.height}`
      );
    }

    // Perform pixel comparison
    const { width, height, channels } = image1Data.info;
    const totalPixels = width * height;

    // Create diff buffer if needed
    const diffBuffer = finalOptions.outputDiff
      ? Buffer.alloc(width * height * channels)
      : null;

    // Compare pixels using pixelmatch
    const differentPixels = pixelmatch(
      image1Data.data,
      image2Data.data,
      diffBuffer,
      width,
      height,
      {
        threshold: finalOptions.tolerance,
        includeAA: finalOptions.includeAlpha,
      }
    );

    // Calculate similarity score
    const similarity = Math.max(0, 1 - differentPixels / totalPixels);

    // Save diff image if requested
    let diffImagePath: string | undefined;
    if (finalOptions.outputDiff && diffBuffer && finalOptions.diffOutputPath) {
      diffImagePath = await this.saveDiffImage(
        diffBuffer,
        width,
        height,
        channels,
        finalOptions.diffOutputPath
      );
    }

    // Build result object
    const result: ScreenshotComparisonResult = {
      similarity,
      differentPixels,
      totalPixels,
      isMatch: similarity >= (1 - finalOptions.tolerance),
      diffImagePath,
    };

    // Validate result schema
    return ScreenshotComparisonResultSchema.parse(result);
  }

  /**
   * Compare two image buffers directly
   *
   * @param buffer1 - First image buffer
   * @param buffer2 - Second image buffer
   * @param options - Comparison options
   * @returns Comparison result
   */
  async compareBuffers(
    buffer1: Buffer,
    buffer2: Buffer,
    options: Partial<ScreenshotComparisonOptions> = {}
  ): Promise<ScreenshotComparisonResult> {
    const finalOptions = { ...this.defaultOptions, ...options };

    // Process image buffers
    const [image1Data, image2Data] = await Promise.all([
      this.processImageBuffer(buffer1, finalOptions),
      this.processImageBuffer(buffer2, finalOptions),
    ]);

    // Ensure same dimensions
    if (
      image1Data.info.width !== image2Data.info.width ||
      image1Data.info.height !== image2Data.info.height
    ) {
      throw new Error(
        `Image dimensions don't match: ${image1Data.info.width}x${image1Data.info.height} vs ${image2Data.info.width}x${image2Data.info.height}`
      );
    }

    // Perform comparison logic (similar to compare method)
    const { width, height, channels } = image1Data.info;
    const totalPixels = width * height;

    const diffBuffer = finalOptions.outputDiff
      ? Buffer.alloc(width * height * channels)
      : null;

    const differentPixels = pixelmatch(
      image1Data.data,
      image2Data.data,
      diffBuffer,
      width,
      height,
      {
        threshold: finalOptions.tolerance,
        includeAA: finalOptions.includeAlpha,
      }
    );

    const similarity = Math.max(0, 1 - differentPixels / totalPixels);

    // Save diff if requested
    let diffImagePath: string | undefined;
    if (finalOptions.outputDiff && diffBuffer && finalOptions.diffOutputPath) {
      diffImagePath = await this.saveDiffImage(
        diffBuffer,
        width,
        height,
        channels,
        finalOptions.diffOutputPath
      );
    }

    const result: ScreenshotComparisonResult = {
      similarity,
      differentPixels,
      totalPixels,
      isMatch: similarity >= (1 - finalOptions.tolerance),
      diffImagePath,
    };

    return ScreenshotComparisonResultSchema.parse(result);
  }

  /**
   * Get metadata for an image file
   *
   * @param imagePath - Path to image file
   * @returns Image metadata
   */
  async getImageMetadata(imagePath: string): Promise<ImageMetadata> {
    await this.validateImageFile(imagePath);

    const metadata = await sharp(imagePath).metadata();

    if (!metadata.width || !metadata.height || !metadata.channels) {
      throw new Error(`Unable to read image metadata from ${imagePath}`);
    }

    const result: ImageMetadata = {
      width: metadata.width,
      height: metadata.height,
      channels: metadata.channels,
      path: imagePath,
    };

    return ImageMetadataSchema.parse(result);
  }

  /**
   * Validate that an image file exists and is readable
   */
  private async validateImageFile(imagePath: string): Promise<void> {
    try {
      await fs.access(imagePath, fs.constants.R_OK);
    } catch (error) {
      throw new Error(`Cannot read image file: ${imagePath}`);
    }
  }

  /**
   * Load and normalize an image for comparison
   */
  private async loadAndNormalizeImage(
    imagePath: string,
    options: Required<ScreenshotComparisonOptions>
  ): Promise<{ data: Buffer; info: sharp.OutputInfo }> {
    return this.processImageBuffer(await fs.readFile(imagePath), options);
  }

  /**
   * Process an image buffer and normalize for comparison
   */
  private async processImageBuffer(
    buffer: Buffer,
    options: Required<ScreenshotComparisonOptions>
  ): Promise<{ data: Buffer; info: sharp.OutputInfo }> {
    let processor = sharp(buffer);

    // Convert to RGB or RGBA based on options
    if (options.includeAlpha) {
      processor = processor.ensureAlpha().raw();
    } else {
      processor = processor.removeAlpha().raw();
    }

    // Get processed image data
    const { data, info } = await processor.toBuffer({ resolveWithObject: true });

    return { data, info };
  }

  /**
   * Save a diff image to the specified path
   */
  private async saveDiffImage(
    diffBuffer: Buffer,
    width: number,
    height: number,
    channels: number,
    outputPath: string
  ): Promise<string> {
    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    await fs.mkdir(outputDir, { recursive: true });

    // Create sharp instance from raw buffer
    await sharp(diffBuffer, {
      raw: {
        width,
        height,
        channels,
      },
    })
      .png() // Save as PNG to preserve quality
      .toFile(outputPath);

    return outputPath;
  }
}

/**
 * Factory function to create a ScreenshotComparator with default settings
 */
export function createScreenshotComparator(
  options: Partial<ScreenshotComparisonOptions> = {}
): ScreenshotComparator {
  return new ScreenshotComparator(options);
}

/**
 * Utility function to quickly compare two images
 *
 * @param imagePath1 - Path to first image
 * @param imagePath2 - Path to second image
 * @param tolerance - Similarity tolerance (0-1)
 * @returns True if images are similar within tolerance
 */
export async function compareImages(
  imagePath1: string,
  imagePath2: string,
  tolerance: number = 0.1
): Promise<boolean> {
  const comparator = new ScreenshotComparator({ tolerance });
  const result = await comparator.compare(imagePath1, imagePath2);
  return result.isMatch;
}