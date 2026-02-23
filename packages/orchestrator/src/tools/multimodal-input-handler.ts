import { readFile, stat } from 'fs/promises';
import { extname } from 'path';
import { WebFetchTool, type WebFetchParams, type WebFetchResult, type HttpMethod } from './webfetch';

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
 * Options for web page processing
 */
export interface WebPageOptions {
  /** Whether to convert HTML content to markdown (default: true) */
  convertToMarkdown?: boolean;
  /** Request timeout in milliseconds (default: 10000) */
  timeout?: number;
  /** Custom HTTP headers to send with the request */
  headers?: Record<string, string>;
  /** Whether to bypass cache (default: false) */
  bypassCache?: boolean;
  /** Cache TTL in milliseconds (default: 900000 = 15 minutes) */
  cacheTtl?: number;
  /**
   * AI analysis prompt - when provided, content is analyzed by Claude Haiku
   * The prompt should describe what information to extract from the page
   * @example "Extract the main product features and pricing"
   * @example "Summarize the key points of this article"
   */
  prompt?: string;
  /** Maximum content length to analyze (in characters, default: 100000) */
  maxAnalysisContent?: number;
  /** HTTP method to use (default: GET) */
  method?: HttpMethod;
  /** Request body for POST/PUT requests */
  body?: string;
}

/**
 * Result of web page processing
 */
export interface WebPageContent {
  /** The original URL that was processed */
  url: string;
  /** HTTP status code */
  statusCode: number;
  /** Response headers */
  headers: Record<string, string>;
  /** Raw HTML content (if available) */
  html?: string;
  /** Markdown-converted content (if convertToMarkdown was true) */
  markdown?: string;
  /** Page title extracted from HTML */
  title?: string;
  /** Whether this result was served from cache */
  fromCache: boolean;
  /** Request metadata */
  metadata: {
    responseTime: number;
    contentLength?: number;
    contentType?: string;
    redirected?: boolean;
    finalUrl?: string;
    cacheKey?: string;
  };
  /** AI analysis results (present when prompt was provided) */
  analysis?: {
    content: string;
    model: string;
    usage: {
      inputTokens: number;
      outputTokens: number;
    };
    truncated: boolean;
    originalContentLength: number;
    analyzedContentLength: number;
  };
  /** Error message if AI analysis failed (analysis result will be undefined) */
  analysisError?: string;
}

/**
 * Result of GitHub issue image processing
 */
export interface GitHubIssueImageResult {
  /** The original GitHub issue content */
  issueContent: string;
  /** Extracted image URLs from the issue */
  imageUrls: string[];
  /** Processed image blocks ready for Claude SDK */
  imageBlocks: ImageBlockParam[];
  /** Processing metadata for each image */
  imageMetadata: Array<{
    url: string;
    fileSizeBytes: number;
    mediaType: string;
    downloadTime: number;
  }>;
  /** Total processing time in milliseconds */
  totalProcessingTime: number;
  /** Any errors encountered during processing */
  errors?: string[];
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
  private readonly webFetchTool: WebFetchTool;

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

  /** GitHub image URL patterns for extraction */
  private static readonly GITHUB_IMAGE_PATTERNS = [
    // user-images.githubusercontent.com URLs (main GitHub image hosting)
    /https?:\/\/user-images\.githubusercontent\.com\/[^)\s]*/g,
    // GitHub-hosted images in markdown format: ![alt](url)
    /!\[.*?\]\((https?:\/\/user-images\.githubusercontent\.com\/[^)]*)\)/g,
    // GitHub-hosted images in HTML format: <img src="url">
    /<img[^>]+src=["'](https?:\/\/user-images\.githubusercontent\.com\/[^"']*)/g,
    // raw.githubusercontent.com URLs (for repository files)
    /https?:\/\/raw\.githubusercontent\.com\/[^)\s]*/g,
  ];

  constructor(config?: MultimodalInputHandlerConfig) {
    this.config = {
      ...MultimodalInputHandler.DEFAULT_CONFIG,
      ...config,
    };
    this.webFetchTool = new WebFetchTool();
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
   * Process GitHub issue content to extract and download images
   *
   * @param issueContent - GitHub issue body or comment content (markdown/HTML)
   * @returns Promise resolving to GitHubIssueImageResult
   * @throws MultimodalInputError for validation failures or download errors
   */
  async processGitHubIssueImages(issueContent: string): Promise<GitHubIssueImageResult> {
    const startTime = Date.now();

    try {
      // Extract all GitHub image URLs from the content
      const imageUrls = this.extractGitHubImageUrls(issueContent);

      if (imageUrls.length === 0) {
        return {
          issueContent,
          imageUrls: [],
          imageBlocks: [],
          imageMetadata: [],
          totalProcessingTime: Date.now() - startTime,
        };
      }

      // Download and process each image
      const imageBlocks: ImageBlockParam[] = [];
      const imageMetadata: GitHubIssueImageResult['imageMetadata'] = [];
      const errors: string[] = [];

      for (const url of imageUrls) {
        try {
          const downloadStart = Date.now();
          const result = await this.downloadImageFromUrl(url);
          const downloadTime = Date.now() - downloadStart;

          imageBlocks.push(result.imageBlock);
          imageMetadata.push({
            url,
            fileSizeBytes: result.fileSizeBytes,
            mediaType: result.mediaType,
            downloadTime,
          });
        } catch (error) {
          const errorMessage = `Failed to download image from ${url}: ${error instanceof Error ? error.message : String(error)}`;
          errors.push(errorMessage);
        }
      }

      return {
        issueContent,
        imageUrls,
        imageBlocks,
        imageMetadata,
        totalProcessingTime: Date.now() - startTime,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      throw new MultimodalInputError(
        `Failed to process GitHub issue images: ${error instanceof Error ? error.message : String(error)}`,
        'GITHUB_ISSUE_PROCESSING_ERROR'
      );
    }
  }

  /**
   * Process a web page URL and return structured content
   *
   * @param url - URL of the web page to process
   * @param options - Optional processing options
   * @returns Promise resolving to WebPageContent
   * @throws MultimodalInputError for validation failures or fetch errors
   */
  async processWebPage(url: string, options?: WebPageOptions): Promise<WebPageContent> {
    try {
      // Validate URL format
      this.validateUrl(url);

      // Prepare WebFetch parameters
      const webFetchParams: WebFetchParams = {
        url,
        method: options?.method || 'GET',
        headers: options?.headers,
        body: options?.body,
        timeout: options?.timeout || 10000,
        convertToMarkdown: options?.convertToMarkdown !== false, // Default true
        bypassCache: options?.bypassCache || false,
        cacheTtl: options?.cacheTtl,
        prompt: options?.prompt,
        maxAnalysisContent: options?.maxAnalysisContent,
      };

      // Execute web fetch
      const webFetchResult = await this.webFetchTool.execute(webFetchParams);

      // Handle fetch errors
      if (!webFetchResult.success) {
        throw new MultimodalInputError(
          `Failed to fetch web page: ${webFetchResult.error || 'Unknown error'}`,
          'FETCH_ERROR'
        );
      }

      // Validate successful HTTP status
      if (webFetchResult.status && (webFetchResult.status < 200 || webFetchResult.status >= 300)) {
        throw new MultimodalInputError(
          `HTTP error ${webFetchResult.status} when fetching URL: ${url}`,
          'HTTP_ERROR'
        );
      }

      // Extract title from HTML if available
      const title = this.extractTitleFromHtml(webFetchResult.data || '');

      // Build WebPageContent result
      const webPageContent: WebPageContent = {
        url,
        statusCode: webFetchResult.status!,
        headers: webFetchResult.headers || {},
        html: options?.convertToMarkdown === false ? webFetchResult.data : undefined,
        markdown: options?.convertToMarkdown !== false ? webFetchResult.data : undefined,
        title,
        fromCache: webFetchResult.fromCache || false,
        metadata: {
          responseTime: webFetchResult.metadata?.responseTime || 0,
          contentLength: webFetchResult.metadata?.contentLength,
          contentType: webFetchResult.metadata?.contentType,
          redirected: webFetchResult.metadata?.redirected,
          finalUrl: webFetchResult.metadata?.finalUrl,
          cacheKey: webFetchResult.metadata?.cacheKey,
        },
      };

      // Add analysis results if present
      if (webFetchResult.analysis) {
        webPageContent.analysis = {
          content: webFetchResult.analysis.content,
          model: webFetchResult.analysis.model,
          usage: {
            inputTokens: webFetchResult.analysis.usage.inputTokens,
            outputTokens: webFetchResult.analysis.usage.outputTokens,
          },
          truncated: webFetchResult.analysis.truncated,
          originalContentLength: webFetchResult.analysis.originalContentLength,
          analyzedContentLength: webFetchResult.analysis.analyzedContentLength,
        };
      }

      // Add analysis error if present
      if (webFetchResult.analysisError) {
        webPageContent.analysisError = webFetchResult.analysisError;
      }

      return webPageContent;
    } catch (error) {
      if (error instanceof MultimodalInputError) {
        throw error;
      }
      throw new MultimodalInputError(
        `Failed to process web page: ${error instanceof Error ? error.message : String(error)}`,
        'WEB_PAGE_PROCESSING_ERROR'
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
   * Validate URL format
   */
  private validateUrl(url: string): void {
    try {
      new URL(url);
    } catch (error) {
      throw new MultimodalInputError(
        `Invalid URL format: ${url}`,
        'INVALID_URL'
      );
    }
  }

  /**
   * Extract title from HTML content
   */
  private extractTitleFromHtml(htmlOrMarkdown: string): string | undefined {
    // Try to extract title from HTML first
    const titleMatch = htmlOrMarkdown.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) {
      return titleMatch[1].trim();
    }

    // If not HTML, try to find markdown heading (# Title)
    const markdownTitleMatch = htmlOrMarkdown.match(/^#\s+(.+)$/m);
    if (markdownTitleMatch) {
      return markdownTitleMatch[1].trim();
    }

    return undefined;
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

/**
 * Convenience function for processing web page URLs
 */
export async function processWebPage(url: string, options?: WebPageOptions, config?: MultimodalInputHandlerConfig): Promise<WebPageContent> {
  const handler = config ? new MultimodalInputHandler(config) : multimodalInputHandler;
  return handler.processWebPage(url, options);
}