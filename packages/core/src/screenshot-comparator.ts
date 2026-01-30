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

/** Internal options type with required fields that have defaults */
type ResolvedComparisonOptions = {
  threshold: number;
  includeAlpha: boolean;
  outputDiff: boolean;
  diffOutputPath?: string;
  diffColor: [number, number, number];
};

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
  private defaultOptions: ResolvedComparisonOptions;

  constructor(options: Partial<ScreenshotComparisonOptions> = {}) {
    // Validate and set default options
    this.defaultOptions = {
      threshold: options.threshold ?? 0.1,
      includeAlpha: options.includeAlpha ?? false,
      outputDiff: options.outputDiff ?? false,
      diffOutputPath: options.diffOutputPath,
      diffColor: (options.diffColor as [number, number, number] | undefined) ?? [255, 0, 255],
    } as ResolvedComparisonOptions;

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
    const finalOptions = {
      ...this.defaultOptions,
      ...options,
      diffColor: (options.diffColor as [number, number, number] | undefined) ?? this.defaultOptions.diffColor,
    } as ResolvedComparisonOptions;

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

    // Compare pixels using pixelmatch for similarity calculation
    const differentPixels = pixelmatch(
      image1Data.data,
      image2Data.data,
      null, // No diff buffer needed for pixelmatch, we'll create our own
      width,
      height,
      {
        threshold: finalOptions.threshold,
        includeAA: finalOptions.includeAlpha,
      }
    );

    // Calculate similarity score
    const similarity = Math.max(0, 1 - differentPixels / totalPixels);

    // Generate custom diff image if requested
    let diffImagePath: string | undefined;
    if (finalOptions.outputDiff && finalOptions.diffOutputPath) {
      const customDiffBuffer = this.generateCustomDiffImage(
        image1Data.data,
        image2Data.data,
        width,
        height,
        channels,
        finalOptions.threshold,
        finalOptions.diffColor
      );

      diffImagePath = await this.saveDiffImage(
        customDiffBuffer,
        width,
        height,
        3, // Always RGB output for diff images
        finalOptions.diffOutputPath
      );
    }

    // Build result object
    const result: ScreenshotComparisonResult = {
      similarity,
      differentPixels,
      totalPixels,
      isMatch: similarity >= (1 - finalOptions.threshold),
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
    const finalOptions = {
      ...this.defaultOptions,
      ...options,
      diffColor: (options.diffColor as [number, number, number] | undefined) ?? this.defaultOptions.diffColor,
    } as ResolvedComparisonOptions;

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

    const differentPixels = pixelmatch(
      image1Data.data,
      image2Data.data,
      null, // No diff buffer needed for pixelmatch, we'll create our own
      width,
      height,
      {
        threshold: finalOptions.threshold,
        includeAA: finalOptions.includeAlpha,
      }
    );

    const similarity = Math.max(0, 1 - differentPixels / totalPixels);

    // Generate custom diff image if requested
    let diffImagePath: string | undefined;
    if (finalOptions.outputDiff && finalOptions.diffOutputPath) {
      const customDiffBuffer = this.generateCustomDiffImage(
        image1Data.data,
        image2Data.data,
        width,
        height,
        channels,
        finalOptions.threshold,
        finalOptions.diffColor
      );

      diffImagePath = await this.saveDiffImage(
        customDiffBuffer,
        width,
        height,
        3, // Always RGB output for diff images
        finalOptions.diffOutputPath
      );
    }

    const result: ScreenshotComparisonResult = {
      similarity,
      differentPixels,
      totalPixels,
      isMatch: similarity >= (1 - finalOptions.threshold),
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
    options: ResolvedComparisonOptions
  ): Promise<{ data: Buffer; info: sharp.OutputInfo }> {
    return this.processImageBuffer(await fs.readFile(imagePath), options);
  }

  /**
   * Process an image buffer and normalize for comparison
   */
  private async processImageBuffer(
    buffer: Buffer,
    options: ResolvedComparisonOptions
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
   * Generate a custom diff image with specified color for different pixels
   */
  private generateCustomDiffImage(
    image1Data: Buffer,
    image2Data: Buffer,
    width: number,
    height: number,
    channels: number,
    threshold: number,
    diffColor: [number, number, number]
  ): Buffer {
    const pixelCount = width * height;
    const outputChannels = 3; // Always RGB output for diff images
    const diffBuffer = Buffer.alloc(pixelCount * outputChannels);

    const [diffR, diffG, diffB] = diffColor;

    for (let i = 0; i < pixelCount; i++) {
      const pixelOffset = i * channels;
      const outputOffset = i * outputChannels;

      // Extract RGB values from both images
      const r1 = image1Data[pixelOffset];
      const g1 = image1Data[pixelOffset + 1];
      const b1 = image1Data[pixelOffset + 2];

      const r2 = image2Data[pixelOffset];
      const g2 = image2Data[pixelOffset + 1];
      const b2 = image2Data[pixelOffset + 2];

      // Calculate pixel difference using euclidean distance in RGB space
      const delta = Math.sqrt(
        Math.pow(r2 - r1, 2) +
        Math.pow(g2 - g1, 2) +
        Math.pow(b2 - b1, 2)
      ) / 255;

      // If difference exceeds threshold, mark as different with specified color
      if (delta > threshold) {
        diffBuffer[outputOffset] = diffR;     // R
        diffBuffer[outputOffset + 1] = diffG; // G
        diffBuffer[outputOffset + 2] = diffB; // B
      } else {
        // Keep original pixel from first image (grayscale for context)
        const gray = Math.round((r1 + g1 + b1) / 3 * 0.5); // Dim the background
        diffBuffer[outputOffset] = gray;     // R
        diffBuffer[outputOffset + 1] = gray; // G
        diffBuffer[outputOffset + 2] = gray; // B
      }
    }

    return diffBuffer;
  }

  /**
   * Save a diff image to the specified path
   */
  private async saveDiffImage(
    diffBuffer: Buffer,
    width: number,
    height: number,
    channels: 1 | 2 | 3 | 4,
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
  threshold: number = 0.1
): Promise<boolean> {
  const comparator = new ScreenshotComparator({ threshold });
  const result = await comparator.compare(imagePath1, imagePath2);
  return result.isMatch;
}

/**
 * Options for compareScreenshot function
 */
export interface CompareOptions {
  /** Similarity threshold (0-1, where 0 is exact match, 1 accepts any difference) */
  threshold?: number;
  /** Whether to include alpha channel in comparison */
  includeAlpha?: boolean;
  /** Whether to output diff image */
  outputDiff?: boolean;
  /** Path to save diff image (required if outputDiff is true) */
  diffOutputPath?: string;
  /** Color for highlighting different pixels in diff image [r, g, b] */
  diffColor?: [number, number, number];
}

/**
 * Result of a screenshot comparison
 */
export interface ComparisonResult {
  /** Whether the images match within the threshold */
  match: boolean;
  /** Percentage of different pixels (0-100) */
  diffPercentage: number;
  /** Similarity score between 0 (completely different) and 1 (identical) */
  similarity: number;
  /** Total number of pixels compared */
  totalPixels: number;
  /** Number of different pixels */
  differentPixels: number;
  /** Base64 encoded diff image data (if outputDiff is true) */
  diffImageData?: string;
  /** Path to saved diff image file (if diffOutputPath provided) */
  diffImagePath?: string;
}

/**
 * Compare two screenshots with comprehensive result including diff image data
 *
 * Accepts file paths or base64 images for baseline and actual screenshots.
 * Returns a ComparisonResult with match status, diff percentage, and diff image data.
 * Uses pixel-level comparison with configurable threshold.
 *
 * @param baseline - File path or base64 image data for baseline screenshot
 * @param actual - File path or base64 image data for actual screenshot
 * @param options - Comparison options with configurable threshold
 * @returns Promise<ComparisonResult> with match status, diff percentage, and diff image data
 */
export async function compareScreenshot(
  baseline: string,
  actual: string,
  options: CompareOptions = {}
): Promise<ComparisonResult> {
  const {
    threshold = 0.1,
    includeAlpha = false,
    outputDiff = false,
    diffOutputPath,
    diffColor = [255, 0, 255]
  } = options;

  // Create comparator with provided options
  const comparator = new ScreenshotComparator({
    threshold: threshold,
    includeAlpha,
    outputDiff,
    diffOutputPath,
    diffColor,
  });

  let result: ScreenshotComparisonResult;

  // Check if inputs are file paths or base64 data
  const isBaselinePath = !baseline.startsWith('data:image/') && !isBase64(baseline);
  const isActualPath = !actual.startsWith('data:image/') && !isBase64(actual);

  if (isBaselinePath && isActualPath) {
    // Both are file paths
    result = await comparator.compare(baseline, actual);
  } else {
    // At least one is base64 data, convert to buffers
    const baselineBuffer = isBaselinePath
      ? await fs.readFile(baseline)
      : decodeBase64Image(baseline);

    const actualBuffer = isActualPath
      ? await fs.readFile(actual)
      : decodeBase64Image(actual);

    result = await comparator.compareBuffers(baselineBuffer, actualBuffer, {
      threshold: threshold,
      includeAlpha,
      outputDiff,
      diffOutputPath,
      diffColor,
    });
  }

  // Convert to the expected ComparisonResult format
  const diffPercentage = (result.differentPixels / result.totalPixels) * 100;

  let diffImageData: string | undefined;
  if (outputDiff && result.diffImagePath) {
    // Read the diff image file and encode as base64
    try {
      const diffImageBuffer = await fs.readFile(result.diffImagePath);
      diffImageData = `data:image/png;base64,${diffImageBuffer.toString('base64')}`;
    } catch (error) {
      // If we can't read the diff image, continue without it
      console.warn('Failed to read diff image for base64 encoding:', error);
    }
  }

  return {
    match: result.isMatch,
    diffPercentage,
    similarity: result.similarity,
    totalPixels: result.totalPixels,
    differentPixels: result.differentPixels,
    diffImageData,
    diffImagePath: result.diffImagePath,
  };
}

/**
 * Check if a string is base64 encoded data (simple heuristic)
 */
function isBase64(str: string): boolean {
  if (typeof str !== 'string' || str.length === 0) return false;

  // Check if it has data URL prefix
  if (str.startsWith('data:image/')) {
    return true;
  }

  // Remove data URL prefix if present
  const base64Part = str.replace(/^data:image\/[a-zA-Z+]+;base64,/, '');

  // Check if it looks like base64
  const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
  return base64Part.length > 0 &&
         base64Part.length % 4 === 0 &&
         base64Regex.test(base64Part);
}

/**
 * Decode base64 image data to buffer
 */
function decodeBase64Image(data: string): Buffer {
  if (!data || typeof data !== 'string') {
    throw new Error('Invalid base64 image data provided');
  }

  try {
    // Remove data URL prefix if present
    const base64Data = data.replace(/^data:image\/[a-zA-Z+]+;base64,/, '');

    if (base64Data.length === 0) {
      throw new Error('Empty base64 data after removing data URL prefix');
    }

    return Buffer.from(base64Data, 'base64');
  } catch (error) {
    throw new Error(`Failed to decode base64 image data: ${error instanceof Error ? error.message : String(error)}`);
  }
}