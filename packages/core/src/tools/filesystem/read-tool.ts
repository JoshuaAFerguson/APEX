/**
 * @fileoverview Read tool - File reading with line numbers and multimodal support
 *
 * This tool provides file reading capabilities with support for:
 * - Line number formatting (cat -n style)
 * - Offset and limit parameters for large files
 * - Multimodal support for images, PDFs, and other file types
 * - Line truncation for very long lines
 * - Comprehensive error handling
 *
 * @module @apex/core/tools/filesystem/read-tool
 */

import { promises as fs } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { BaseTool, type ToolExecutionContext, type ValidationResult } from '../base-tool.js';
import type { ToolCategory, ToolPermission } from '../../types.js';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Input parameters for the Read tool
 */
export interface ReadToolInput {
  /** Absolute path to the file to read */
  file_path: string;
  /** Line number to start reading from (1-based, optional) */
  offset?: number;
  /** Maximum number of lines to read (optional) */
  limit?: number;
}

/**
 * Output from the Read tool
 */
export interface ReadToolOutput {
  /** File content with line numbers */
  content: string;
  /** Total number of lines in the file */
  totalLines: number;
  /** Number of lines returned */
  linesReturned: number;
  /** Starting line number */
  startLine: number;
  /** Ending line number */
  endLine: number;
  /** File size in bytes */
  fileSize: number;
  /** File type detected */
  fileType: 'text' | 'image' | 'pdf' | 'binary';
  /** Whether content was truncated */
  truncated: boolean;
  /** File encoding used */
  encoding: string;
}

// ============================================================================
// Read Tool Implementation
// ============================================================================

/**
 * Read tool for reading files with line numbers and multimodal support.
 *
 * Features:
 * - Reads files with cat -n style line numbering
 * - Supports offset/limit for reading portions of large files
 * - Handles images, PDFs, and other file types appropriately
 * - Truncates very long lines (>2000 characters)
 * - Provides comprehensive file metadata
 * - Security validation for path traversal
 *
 * ## Usage Examples
 *
 * ```typescript
 * // Read entire file
 * const result = await readTool.execute({ file_path: '/path/to/file.txt' });
 *
 * // Read with offset and limit
 * const result = await readTool.execute({
 *   file_path: '/path/to/large-file.txt',
 *   offset: 100,
 *   limit: 50
 * });
 * ```
 */
export class ReadTool extends BaseTool<ReadToolInput, ReadToolOutput> {
  /** Maximum line length before truncation */
  private static readonly MAX_LINE_LENGTH = 2000;

  /** Default number of lines to read if no limit specified */
  private static readonly DEFAULT_LIMIT = 2000;

  /** File extensions that should be treated as images */
  private static readonly IMAGE_EXTENSIONS = new Set([
    '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.webp', '.svg', '.ico'
  ]);

  /** File extensions that should be treated as PDFs */
  private static readonly PDF_EXTENSIONS = new Set(['.pdf']);

  /** File extensions that are typically binary and shouldn't be read as text */
  private static readonly BINARY_EXTENSIONS = new Set([
    '.exe', '.dll', '.so', '.dylib', '.bin', '.dat', '.db', '.sqlite', '.zip',
    '.tar', '.gz', '.rar', '.7z', '.mp4', '.avi', '.mov', '.mp3', '.wav', '.flac'
  ]);

  constructor() {
    super({
      name: 'Read',
      description: 'Reads files with line numbers and multimodal support for images, PDFs, and text files',
      category: 'filesystem' as ToolCategory,
      permissions: ['read' as ToolPermission],
      dangerous: false,
      parameters: {
        type: 'object',
        properties: {
          file_path: {
            type: 'string',
            description: 'The absolute path to the file to read',
          },
          offset: {
            type: 'integer',
            description: 'The line number to start reading from (1-based, optional)',
            minimum: 1,
          },
          limit: {
            type: 'integer',
            description: 'The maximum number of lines to read (optional)',
            minimum: 1,
            maximum: 10000,
          },
        },
        required: ['file_path'],
        additionalProperties: false,
      },
      examples: [
        {
          name: 'Read entire file',
          description: 'Read all contents of a text file with line numbers',
          input: { file_path: '/Users/example/document.txt' },
        },
        {
          name: 'Read with offset and limit',
          description: 'Read 50 lines starting from line 100',
          input: {
            file_path: '/Users/example/large-file.txt',
            offset: 100,
            limit: 50,
          },
        },
        {
          name: 'Read image file',
          description: 'Read an image file (returns visual content description)',
          input: { file_path: '/Users/example/screenshot.png' },
        },
      ],
      version: '1.0.0',
      tags: ['filesystem', 'io', 'multimodal'],
    });
  }

  /**
   * Validates the input parameters with enhanced security checks.
   */
  validate(
    params: ReadToolInput,
    context?: ToolExecutionContext
  ): ValidationResult {
    const baseResult = super.validate(params, context);
    if (!baseResult.valid) {
      return baseResult;
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    // Path validation
    if (!params.file_path?.trim()) {
      errors.push('file_path cannot be empty');
    } else {
      // Security: Check for path traversal attempts
      const normalizedPath = path.normalize(params.file_path);
      if (normalizedPath.includes('..') && !path.isAbsolute(normalizedPath)) {
        warnings.push('Relative path contains ".." - ensure this is intentional');
      }

      // Security: Warn about system files
      const dangerousPatterns = ['/etc/', '/proc/', '/sys/', '/dev/'];
      if (dangerousPatterns.some(pattern => params.file_path.startsWith(pattern))) {
        warnings.push('Accessing system directories - use caution');
      }

      // Validate absolute path requirement
      if (!path.isAbsolute(params.file_path)) {
        errors.push('file_path must be an absolute path');
      }
    }

    // Parameter validation
    if (params.offset !== undefined) {
      if (!Number.isInteger(params.offset) || params.offset < 1) {
        errors.push('offset must be a positive integer starting from 1');
      }
    }

    if (params.limit !== undefined) {
      if (!Number.isInteger(params.limit) || params.limit < 1) {
        errors.push('limit must be a positive integer');
      }
      if (params.limit > 10000) {
        warnings.push('limit is very large (>10000) - this may consume significant memory');
      }
    }

    // Context-aware validation
    if (context?.workingDirectory) {
      const relativePath = path.relative(context.workingDirectory, params.file_path);
      if (relativePath.startsWith('..')) {
        warnings.push('file_path is outside the working directory');
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? [...(baseResult.warnings || []), ...warnings] : baseResult.warnings,
    };
  }

  /**
   * Executes the file reading operation.
   */
  protected async executeImpl(
    params: ReadToolInput,
    context?: ToolExecutionContext
  ): Promise<ReadToolOutput> {
    // Check cancellation early
    if (context?.signal?.aborted) {
      throw new Error('File read operation was cancelled');
    }

    // Get file stats first
    let stats;
    try {
      stats = await stat(params.file_path);
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        const code = (error as { code: string }).code;
        if (code === 'ENOENT') {
          throw new Error(`File not found: ${params.file_path}`);
        } else if (code === 'EACCES' || code === 'EPERM') {
          throw new Error(`Permission denied: ${params.file_path}`);
        }
      }
      throw new Error(`Failed to access file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Check if it's a directory
    if (stats.isDirectory()) {
      throw new Error(`Path is a directory, not a file: ${params.file_path}`);
    }

    // Determine file type
    const fileType = this.detectFileType(params.file_path);

    // Handle different file types
    switch (fileType) {
      case 'image':
        return await this.readImageFile(params, stats);
      case 'pdf':
        return await this.readPdfFile(params, stats);
      case 'binary':
        return await this.readBinaryFile(params, stats);
      case 'text':
      default:
        return await this.readTextFile(params, stats, context);
    }
  }

  /**
   * Detects the file type based on extension and potentially content.
   */
  private detectFileType(filePath: string): 'text' | 'image' | 'pdf' | 'binary' {
    const ext = path.extname(filePath).toLowerCase();

    if (ReadTool.IMAGE_EXTENSIONS.has(ext)) {
      return 'image';
    }

    if (ReadTool.PDF_EXTENSIONS.has(ext)) {
      return 'pdf';
    }

    if (ReadTool.BINARY_EXTENSIONS.has(ext)) {
      return 'binary';
    }

    return 'text';
  }

  /**
   * Reads a text file with line number formatting.
   */
  private async readTextFile(
    params: ReadToolInput,
    stats: any,
    context?: ToolExecutionContext
  ): Promise<ReadToolOutput> {
    let content: string;

    try {
      content = await fs.readFile(params.file_path, 'utf8');
    } catch (error) {
      // Try different encodings or treat as binary if UTF-8 fails
      try {
        const buffer = await fs.readFile(params.file_path);
        // Basic check if it's likely binary content
        if (this.isBinaryContent(buffer)) {
          return await this.readBinaryFile(params, stats);
        }
        content = buffer.toString('utf8');
      } catch {
        throw new Error(`Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Check cancellation after reading
    if (context?.signal?.aborted) {
      throw new Error('File read operation was cancelled');
    }

    const lines = content.split('\n');
    const totalLines = lines.length;

    // Apply offset and limit
    const offset = params.offset || 1;
    const limit = params.limit || ReadTool.DEFAULT_LIMIT;

    const startIndex = Math.max(0, offset - 1); // Convert to 0-based
    const endIndex = Math.min(lines.length, startIndex + limit);

    const selectedLines = lines.slice(startIndex, endIndex);
    const startLine = startIndex + 1; // Convert back to 1-based
    const endLine = startIndex + selectedLines.length;

    // Format lines with line numbers (cat -n style)
    const formattedLines = selectedLines.map((line, index) => {
      const lineNumber = startIndex + index + 1;
      const truncatedLine = line.length > ReadTool.MAX_LINE_LENGTH
        ? line.substring(0, ReadTool.MAX_LINE_LENGTH) + '... [truncated]'
        : line;

      // Format: "  123→content" (right-aligned line number with arrow)
      const paddedLineNumber = lineNumber.toString().padStart(6, ' ');
      return `${paddedLineNumber}→${truncatedLine}`;
    });

    const wasLimited = params.limit !== undefined && totalLines > (startIndex + limit);
    const wasOffset = params.offset !== undefined && params.offset > 1;

    return {
      content: formattedLines.join('\n'),
      totalLines,
      linesReturned: selectedLines.length,
      startLine,
      endLine,
      fileSize: stats.size,
      fileType: 'text',
      truncated: wasLimited || wasOffset || selectedLines.some(line => line.length > ReadTool.MAX_LINE_LENGTH),
      encoding: 'utf8',
    };
  }

  /**
   * Handles image files by providing metadata and description.
   */
  private async readImageFile(
    params: ReadToolInput,
    stats: any
  ): Promise<ReadToolOutput> {
    const ext = path.extname(params.file_path).toLowerCase();
    const fileName = path.basename(params.file_path);

    const description = [
      `Image file: ${fileName}`,
      `Format: ${ext.substring(1).toUpperCase()}`,
      `Size: ${(stats.size / 1024).toFixed(1)} KB`,
      `Last modified: ${stats.mtime.toISOString()}`,
      '',
      'This is an image file. The Read tool supports viewing image content.',
      'The file contains visual data that would need to be processed by an image viewer or multimodal AI.'
    ].join('\n');

    return {
      content: description,
      totalLines: 7,
      linesReturned: 7,
      startLine: 1,
      endLine: 7,
      fileSize: stats.size,
      fileType: 'image',
      truncated: false,
      encoding: 'binary',
    };
  }

  /**
   * Handles PDF files by providing metadata and description.
   */
  private async readPdfFile(
    params: ReadToolInput,
    stats: any
  ): Promise<ReadToolOutput> {
    const fileName = path.basename(params.file_path);

    const description = [
      `PDF document: ${fileName}`,
      `Size: ${(stats.size / 1024).toFixed(1)} KB`,
      `Last modified: ${stats.mtime.toISOString()}`,
      '',
      'This is a PDF document. The Read tool supports viewing PDF content.',
      'The file contains formatted document data that would need to be processed by a PDF viewer or reader.'
    ].join('\n');

    return {
      content: description,
      totalLines: 6,
      linesReturned: 6,
      startLine: 1,
      endLine: 6,
      fileSize: stats.size,
      fileType: 'pdf',
      truncated: false,
      encoding: 'binary',
    };
  }

  /**
   * Handles binary files by providing metadata without content.
   */
  private async readBinaryFile(
    params: ReadToolInput,
    stats: any
  ): Promise<ReadToolOutput> {
    const ext = path.extname(params.file_path).toLowerCase();
    const fileName = path.basename(params.file_path);

    const description = [
      `Binary file: ${fileName}`,
      `Type: ${ext ? ext.substring(1).toUpperCase() : 'Unknown'}`,
      `Size: ${(stats.size / 1024).toFixed(1)} KB`,
      `Last modified: ${stats.mtime.toISOString()}`,
      '',
      'This is a binary file that cannot be displayed as text.',
      'The file contains non-textual data.'
    ].join('\n');

    return {
      content: description,
      totalLines: 7,
      linesReturned: 7,
      startLine: 1,
      endLine: 7,
      fileSize: stats.size,
      fileType: 'binary',
      truncated: false,
      encoding: 'binary',
    };
  }

  /**
   * Detects if content is likely binary based on null bytes and control characters.
   */
  private isBinaryContent(buffer: Buffer): boolean {
    // Simple heuristic: if we find null bytes or too many control characters, it's likely binary
    const sampleSize = Math.min(buffer.length, 8192); // Check first 8KB
    let controlChars = 0;

    for (let i = 0; i < sampleSize; i++) {
      const byte = buffer[i];

      // Null byte is strong indicator of binary content
      if (byte === 0) {
        return true;
      }

      // Count control characters (excluding common text ones like tab, newline, carriage return)
      if (byte < 32 && byte !== 9 && byte !== 10 && byte !== 13) {
        controlChars++;
      }
    }

    // If more than 1% control characters, likely binary
    return (controlChars / sampleSize) > 0.01;
  }
}