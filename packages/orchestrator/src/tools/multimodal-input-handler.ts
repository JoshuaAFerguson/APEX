import { readFile, stat } from 'fs/promises';
import { extname } from 'path';

/**
 * Claude SDK compatible ImageBlockParam structure
 * Based on @anthropic-ai/sdk types
 */
export interface ImageBlockParam {
  type: 'image';
  source: {
    type: 'base64';
    media_type: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
    data: string;
  };
}

/**
 * Configuration options for MultimodalInputHandler
 */
export interface MultimodalInputHandlerConfig {
  /** Maximum file size in bytes (default: 20MB) */
  maxFileSizeBytes?: number;
  /** Supported image formats (default: ['png', 'jpg', 'jpeg', 'gif', 'webp']) */
  supportedFormats?: string[];
}

/**
 * Result of image processing
 */
export interface ImageProcessResult {
  /** Claude SDK compatible ImageBlockParam */
  imageBlock: ImageBlockParam;
  /** Original file size in bytes */
  fileSizeBytes: number;
  /** Detected media type */
  mediaType: string;
}

/**
 * Error types for multimodal input handling
 */
export class MultimodalInputError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'MultimodalInputError';
  }
}

/**
 * MultimodalInputHandler class for processing image files into Claude SDK compatible format
 *
 * Features:
 * - Load image files from local paths
 * - Validate supported formats (PNG, JPEG, GIF, WebP)
 * - Convert to base64 encoding
 * - Return Claude SDK compatible ImageBlockParam structures
 * - File size limits and format validation
 *
 * @example
 * ```typescript
 * const handler = new MultimodalInputHandler();
 * const result = await handler.processImageFile('/path/to/image.png');
 * console.log(result.imageBlock); // Ready to use with Claude SDK
 * ```
 */
export class MultimodalInputHandler {
  private readonly config: Required<MultimodalInputHandlerConfig>;

  /** Default configuration */
  private static readonly DEFAULT_CONFIG: Required<MultimodalInputHandlerConfig> = {
    maxFileSizeBytes: 20 * 1024 * 1024, // 20MB
    supportedFormats: ['png', 'jpg', 'jpeg', 'gif', 'webp'],
  };

  /** Mapping of file extensions to Claude SDK media types */
  private static readonly MEDIA_TYPE_MAP: Record<string, ImageBlockParam['source']['media_type']> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
  };

  constructor(config?: MultimodalInputHandlerConfig) {
    this.config = {
      ...MultimodalInputHandler.DEFAULT_CONFIG,
      ...config,
    };
  }

  /**
   * Process an image file and return Claude SDK compatible ImageBlockParam
   *
   * @param imagePath - Path to the image file
   * @returns Promise resolving to ImageProcessResult
   * @throws MultimodalInputError for validation failures
   */
  async processImageFile(imagePath: string): Promise<ImageProcessResult> {
    try {
      // Validate file exists and get stats
      const fileStats = await this.validateFileExists(imagePath);

      // Validate file size
      this.validateFileSize(fileStats.size);

      // Validate and get media type
      const mediaType = this.validateAndGetMediaType(imagePath);

      // Read and convert file to base64
      const base64Data = await this.convertToBase64(imagePath);

      // Create Claude SDK compatible structure
      const imageBlock: ImageBlockParam = {
        type: 'image',
        source: {
          type: 'base64',
          media_type: mediaType,
          data: base64Data,
        },
      };

      return {
        imageBlock,
        fileSizeBytes: fileStats.size,
        mediaType,
      };
    } catch (error) {
      if (error instanceof MultimodalInputError) {
        throw error;
      }
      throw new MultimodalInputError(
        `Failed to process image file: ${error instanceof Error ? error.message : String(error)}`,
        'PROCESSING_ERROR'
      );
    }
  }

  /**
   * Validate that the file exists and return its stats
   */
  private async validateFileExists(imagePath: string) {
    try {
      const fileStats = await stat(imagePath);

      if (!fileStats.isFile()) {
        throw new MultimodalInputError(`Path is not a file: ${imagePath}`, 'NOT_A_FILE');
      }

      return fileStats;
    } catch (error) {
      if (error instanceof MultimodalInputError) {
        throw error;
      }
      throw new MultimodalInputError(`File does not exist: ${imagePath}`, 'FILE_NOT_FOUND');
    }
  }

  /**
   * Validate file size against configured limits
   */
  private validateFileSize(fileSizeBytes: number): void {
    if (fileSizeBytes > this.config.maxFileSizeBytes) {
      throw new MultimodalInputError(
        `File size ${fileSizeBytes} bytes exceeds maximum allowed size of ${this.config.maxFileSizeBytes} bytes`,
        'FILE_TOO_LARGE'
      );
    }

    if (fileSizeBytes === 0) {
      throw new MultimodalInputError('File is empty', 'EMPTY_FILE');
    }
  }

  /**
   * Validate file format and return Claude SDK media type
   */
  private validateAndGetMediaType(imagePath: string): ImageBlockParam['source']['media_type'] {
    const extension = extname(imagePath).toLowerCase();

    // Check if extension is supported
    if (!MultimodalInputHandler.MEDIA_TYPE_MAP[extension]) {
      throw new MultimodalInputError(
        `Unsupported file format: ${extension}. Supported formats: ${this.config.supportedFormats.join(', ')}`,
        'UNSUPPORTED_FORMAT'
      );
    }

    // Double-check against configured supported formats
    const extensionWithoutDot = extension.slice(1);
    if (!this.config.supportedFormats.includes(extensionWithoutDot)) {
      throw new MultimodalInputError(
        `File format ${extensionWithoutDot} not in configured supported formats: ${this.config.supportedFormats.join(', ')}`,
        'FORMAT_NOT_CONFIGURED'
      );
    }

    return MultimodalInputHandler.MEDIA_TYPE_MAP[extension];
  }

  /**
   * Convert image file to base64 encoding
   */
  private async convertToBase64(imagePath: string): Promise<string> {
    try {
      const buffer = await readFile(imagePath);
      return buffer.toString('base64');
    } catch (error) {
      throw new MultimodalInputError(
        `Failed to read file for base64 conversion: ${error instanceof Error ? error.message : String(error)}`,
        'BASE64_CONVERSION_ERROR'
      );
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): Required<MultimodalInputHandlerConfig> {
    return { ...this.config };
  }

  /**
   * Check if a file extension is supported
   */
  isSupportedFormat(filePath: string): boolean {
    const extension = extname(filePath).toLowerCase().slice(1);
    return this.config.supportedFormats.includes(extension);
  }

  /**
   * Get supported media types
   */
  getSupportedMediaTypes(): ImageBlockParam['source']['media_type'][] {
    return this.config.supportedFormats.map(format => {
      const extension = format === 'jpg' ? '.jpeg' : `.${format}`;
      return MultimodalInputHandler.MEDIA_TYPE_MAP[extension];
    }).filter(Boolean) as ImageBlockParam['source']['media_type'][];
  }
}

/**
 * Default instance for convenience
 */
export const multimodalInputHandler = new MultimodalInputHandler();

/**
 * Convenience function for processing image files
 */
export async function processImageFile(imagePath: string, config?: MultimodalInputHandlerConfig): Promise<ImageProcessResult> {
  const handler = config ? new MultimodalInputHandler(config) : multimodalInputHandler;
  return handler.processImageFile(imagePath);
}