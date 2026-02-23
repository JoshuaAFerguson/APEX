/**
 * Design Mockup Types for MultimodalInputHandler
 *
 * This module defines the types and interfaces for processing design mockups
 * from tools like Figma, Sketch, Adobe XD, etc.
 *
 * @module design-mockup-types
 */

import type { ImageBlockParam } from './multimodal-input-handler';

/**
 * Supported design tools for mockup processing
 * Aligned with DesignTool type from @apexcli/core
 */
export type DesignTool =
  | 'figma'
  | 'sketch'
  | 'adobe_xd'
  | 'invision'
  | 'zeplin'
  | 'framer'
  | 'canva'
  | 'photoshop'
  | 'illustrator'
  | 'other';

/**
 * Supported export formats for design mockups
 */
export type DesignExportFormat = 'png' | 'jpeg' | 'svg' | 'pdf' | 'webp';

/**
 * Unit types for design dimensions
 */
export type DesignDimensionUnit = 'px' | 'pt' | 'dp' | 'sp' | 'em' | 'rem' | '%';

/**
 * Design dimensions with optional unit specification
 */
export interface DesignDimensions {
  /** Width value */
  width: number;
  /** Height value */
  height: number;
  /** Unit of measurement (default: 'px') */
  unit?: DesignDimensionUnit;
}

/**
 * Typography definition for design tokens
 * Can be either a simple font family string or a detailed specification
 */
export type TypographyValue =
  | string
  | {
      fontFamily?: string;
      fontSize?: number;
      fontWeight?: string | number;
      lineHeight?: number;
      letterSpacing?: number;
    };

/**
 * Design tokens extracted from a mockup
 * Contains color palette, typography, spacing, and other design system values
 */
export interface DesignTokens {
  /** Color palette as key-value pairs (e.g., { primary: '#007AFF' }) */
  colors?: Record<string, string>;
  /** Typography definitions */
  typography?: Record<string, TypographyValue>;
  /** Spacing values in pixels */
  spacing?: Record<string, number>;
  /** Border radius values in pixels */
  borderRadius?: Record<string, number>;
  /** Shadow definitions as CSS-like strings */
  shadows?: Record<string, string>;
}

/**
 * Component/element bounds within a design
 */
export interface ComponentBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Component information extracted from a design mockup
 */
export interface DesignComponent {
  /** Component name */
  name: string;
  /** Component ID in the design tool */
  id?: string;
  /** Component type (e.g., 'button', 'input', 'frame') */
  type?: string;
  /** Bounding box of the component */
  bounds?: ComponentBounds;
}

/**
 * Annotation/comment on a design mockup
 */
export interface DesignAnnotation {
  /** Annotation ID */
  id?: string;
  /** Annotation text content */
  text: string;
  /** Author of the annotation */
  author?: string;
  /** Position of the annotation on the design */
  position?: {
    x: number;
    y: number;
  };
  /** When the annotation was created */
  createdAt?: Date;
}

/**
 * Parsed information from a Figma URL
 *
 * Figma URLs follow these patterns:
 * - File: https://www.figma.com/file/{fileKey}/{fileName}
 * - Design: https://www.figma.com/design/{fileKey}/{fileName}
 * - Prototype: https://www.figma.com/proto/{fileKey}/{fileName}
 * - With node: https://www.figma.com/file/{fileKey}/{fileName}?node-id={nodeId}
 *
 * @example
 * ```typescript
 * const figmaInfo: FigmaUrlInfo = {
 *   fileKey: 'abc123xyz',
 *   fileName: 'Login-Screens',
 *   nodeId: '123:456',
 *   urlType: 'file',
 *   originalUrl: 'https://www.figma.com/file/abc123xyz/Login-Screens?node-id=123:456',
 * };
 * ```
 */
export interface FigmaUrlInfo {
  /** The unique file key from the URL */
  fileKey: string;
  /** The file name (URL-encoded, may contain hyphens for spaces) */
  fileName?: string;
  /** Node ID if specified in the URL (format: "123:456") */
  nodeId?: string;
  /** Type of Figma URL */
  urlType: 'file' | 'design' | 'proto' | 'board' | 'embed';
  /** The original URL that was parsed */
  originalUrl: string;
  /** Whether the URL includes version-specific parameters */
  hasVersionParams?: boolean;
  /** Branch name if the URL points to a branch */
  branchName?: string;
}

/**
 * Options for processing a design mockup
 *
 * @example
 * ```typescript
 * const options: DesignMockupOptions = {
 *   designTool: 'figma',
 *   exportFormat: 'png',
 *   exportScale: 2,
 *   extractTokens: true,
 *   extractComponents: true,
 *   includeAnnotations: true,
 *   timeout: 30000,
 * };
 * ```
 */
export interface DesignMockupOptions {
  /** The design tool being used */
  designTool: DesignTool;

  /** Desired export format (default: 'png') */
  exportFormat?: DesignExportFormat;

  /** Export scale factor, 1-10 (default: 1) */
  exportScale?: number;

  /** Whether to extract design tokens from the mockup */
  extractTokens?: boolean;

  /** Whether to extract component information */
  extractComponents?: boolean;

  /** Whether to include annotations/comments */
  includeAnnotations?: boolean;

  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;

  /** Custom HTTP headers for API requests */
  headers?: Record<string, string>;

  /** API token for authenticated requests (e.g., Figma Personal Access Token) */
  apiToken?: string;

  /** Whether to bypass cache (default: false) */
  bypassCache?: boolean;

  /** Cache TTL in milliseconds (default: 900000 = 15 minutes) */
  cacheTtl?: number;

  /**
   * AI analysis prompt for the design mockup
   * When provided, the mockup image will be analyzed using Claude
   * @example "Describe the UI components and layout of this login screen"
   */
  analysisPrompt?: string;

  /** Maximum content length for AI analysis (in characters) */
  maxAnalysisContent?: number;
}

/**
 * Metadata about the design file
 */
export interface DesignFileMetadata {
  /** File ID in the design tool */
  fileId?: string;
  /** Node/frame/artboard ID */
  nodeId?: string;
  /** Direct URL to the design file or frame */
  fileUrl?: string;
  /** Frame/artboard name */
  frameName?: string;
  /** Page name containing the frame */
  pageName?: string;
  /** Version/revision of the design file */
  fileVersion?: string;
  /** Last modified timestamp */
  lastModified?: Date;
  /** List of collaborators/editors */
  collaborators?: string[];
}

/**
 * Result of processing a design mockup
 *
 * Contains the exported image, design metadata, extracted tokens,
 * components, and optional AI analysis results.
 *
 * @example
 * ```typescript
 * const result: DesignMockupProcessResult = {
 *   imageBlock: {
 *     type: 'image',
 *     source: { type: 'base64', media_type: 'image/png', data: '...' }
 *   },
 *   designTool: 'figma',
 *   metadata: {
 *     fileId: 'abc123',
 *     nodeId: '123:456',
 *     frameName: 'Login Screen - Mobile',
 *   },
 *   dimensions: { width: 375, height: 812, unit: 'px' },
 *   exportFormat: 'png',
 *   exportScale: 2,
 *   fileSizeBytes: 245678,
 *   designTokens: {
 *     colors: { primary: '#007AFF', secondary: '#5856D6' },
 *     typography: { heading: 'SF Pro Display', body: 'SF Pro Text' },
 *   },
 *   processingTime: 1234,
 *   fromCache: false,
 * };
 * ```
 */
export interface DesignMockupProcessResult {
  /** Claude SDK compatible image block of the exported design */
  imageBlock: ImageBlockParam;

  /** The design tool used */
  designTool: DesignTool;

  /** Design file metadata */
  metadata: DesignFileMetadata;

  /** Dimensions of the exported design */
  dimensions?: DesignDimensions;

  /** Format used for export */
  exportFormat: DesignExportFormat;

  /** Scale factor used for export */
  exportScale: number;

  /** Size of the exported image in bytes */
  fileSizeBytes: number;

  /** Detected media type of the exported image */
  mediaType: string;

  /** Extracted design tokens (if extractTokens was true) */
  designTokens?: DesignTokens;

  /** Extracted components (if extractComponents was true) */
  components?: DesignComponent[];

  /** Annotations/comments (if includeAnnotations was true) */
  annotations?: DesignAnnotation[];

  /** Total processing time in milliseconds */
  processingTime: number;

  /** Whether the result was served from cache */
  fromCache: boolean;

  /** Cache key used (if cached) */
  cacheKey?: string;

  /** AI analysis results (if analysisPrompt was provided) */
  analysis?: {
    /** AI-generated analysis content */
    content: string;
    /** Model used for analysis */
    model: string;
    /** Token usage statistics */
    usage: {
      inputTokens: number;
      outputTokens: number;
    };
    /** Whether the content was truncated before analysis */
    truncated: boolean;
  };

  /** Error message if AI analysis failed */
  analysisError?: string;

  /** Any warnings encountered during processing */
  warnings?: string[];

  /** Any errors encountered during processing (for partial results) */
  errors?: string[];
}

/**
 * Result of parsing a Figma URL
 */
export interface FigmaUrlParseResult {
  /** Whether the URL was successfully parsed */
  success: boolean;
  /** Parsed URL information (if successful) */
  info?: FigmaUrlInfo;
  /** Error message (if unsuccessful) */
  error?: string;
}

/**
 * Configuration for the design mockup handler
 */
export interface DesignMockupHandlerConfig {
  /** Maximum file size in bytes (default: 20MB) */
  maxFileSizeBytes?: number;
  /** Default export format (default: 'png') */
  defaultExportFormat?: DesignExportFormat;
  /** Default export scale (default: 1) */
  defaultExportScale?: number;
  /** Default timeout in milliseconds (default: 30000) */
  defaultTimeout?: number;
  /** Whether to cache results by default (default: true) */
  enableCaching?: boolean;
  /** Default cache TTL in milliseconds (default: 900000 = 15 minutes) */
  defaultCacheTtl?: number;
}

/**
 * Error codes for design mockup processing
 */
export type DesignMockupErrorCode =
  | 'INVALID_URL'
  | 'UNSUPPORTED_TOOL'
  | 'API_ERROR'
  | 'AUTHENTICATION_REQUIRED'
  | 'FILE_NOT_FOUND'
  | 'NODE_NOT_FOUND'
  | 'EXPORT_FAILED'
  | 'FILE_TOO_LARGE'
  | 'TIMEOUT'
  | 'RATE_LIMITED'
  | 'NETWORK_ERROR'
  | 'PROCESSING_ERROR';

/**
 * Error class for design mockup processing failures
 */
export class DesignMockupError extends Error {
  constructor(
    message: string,
    public code: DesignMockupErrorCode,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'DesignMockupError';
  }
}
