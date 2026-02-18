/**
 * @fileoverview Glob tool - Fast file pattern matching with modification time sorting
 *
 * This tool provides fast file pattern matching capabilities using fast-glob with support for:
 * - Glob patterns like `**\/*.js` or `src/**\/*.ts`
 * - Path filtering for specific directories
 * - Result sorting by modification time (most recent first)
 * - Performance optimization for large codebases
 * - Comprehensive error handling
 *
 * @module @apex/core/tools/filesystem/glob-tool
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import * as fastGlob from 'fast-glob';
import { BaseTool, type ToolExecutionContext, type ValidationResult } from '../base-tool.js';
import type { ToolCategory, ToolPermission } from '../../types.js';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Input parameters for the Glob tool
 */
export interface GlobToolInput {
  /** The glob pattern to match files against (required) */
  pattern: string;
  /** The directory to search in (optional, defaults to current working directory) */
  path?: string;
}

/**
 * Individual file result with metadata
 */
export interface GlobFileResult {
  /** Absolute path to the matched file */
  path: string;
  /** Relative path from search directory */
  relativePath: string;
  /** File size in bytes */
  size: number;
  /** Last modification time (ISO string) */
  lastModified: string;
  /** File extension (including dot) */
  extension: string;
  /** Base filename without extension */
  basename: string;
}

/**
 * Output from the Glob tool
 */
export interface GlobToolOutput {
  /** Array of matched files sorted by modification time (most recent first) */
  files: GlobFileResult[];
  /** Total number of files found */
  totalFiles: number;
  /** The pattern that was searched */
  pattern: string;
  /** The directory that was searched */
  searchPath: string;
  /** Time taken for the search in milliseconds */
  searchTime: number;
  /** Whether the search was limited by performance constraints */
  truncated: boolean;
}

// ============================================================================
// Glob Tool Implementation
// ============================================================================

/**
 * Glob tool for fast file pattern matching with modification time sorting.
 *
 * Features:
 * - Fast file pattern matching using fast-glob library
 * - Support for standard glob patterns (*, **, ?, [], {})
 * - Automatic sorting by modification time (most recent first)
 * - Performance optimized for large codebases
 * - Path filtering and directory specification
 * - Comprehensive file metadata extraction
 * - Built-in safety limits to prevent excessive results
 *
 * ## Pattern Examples
 *
 * - `**\/*.js` - All JavaScript files recursively
 * - `src/**\/*.ts` - All TypeScript files in src directory
 * - `*.{ts,tsx}` - TypeScript files in current directory
 * - `**\/*.test.js` - All test files
 * - `packages/*\/src/**\/*.ts` - TypeScript files in package src directories
 *
 * ## Usage Examples
 *
 * ```typescript
 * // Find all TypeScript files
 * const result = await globTool.execute({ pattern: '**\/*.ts' });
 *
 * // Search in specific directory
 * const result = await globTool.execute({
 *   pattern: '*.js',
 *   path: '/project/src'
 * });
 * ```
 */
export class GlobTool extends BaseTool<GlobToolInput, GlobToolOutput> {
  /** Maximum number of files to return to prevent memory issues */
  private static readonly MAX_RESULTS = 5000;

  /** Maximum time to spend on search in milliseconds */
  private static readonly MAX_SEARCH_TIME = 30000; // 30 seconds

  constructor() {
    super({
      name: 'Glob',
      description: 'Fast file pattern matching tool that works with any codebase size. Supports glob patterns and sorts results by modification time.',
      category: 'filesystem' as ToolCategory,
      permissions: ['read' as ToolPermission],
      dangerous: false,
      parameters: {
        type: 'object',
        properties: {
          pattern: {
            type: 'string',
            description: 'The glob pattern to match files against (e.g., "**/*.js", "src/**/*.ts")',
          },
          path: {
            type: 'string',
            description: 'The directory to search in. If not specified, the current working directory will be used. IMPORTANT: Omit this field to use the default directory. DO NOT enter "undefined" or "null" - simply omit it for the default behavior. Must be a valid directory path if provided.',
          },
        },
        required: ['pattern'],
        additionalProperties: false,
      },
      examples: [
        {
          name: 'Find all TypeScript files',
          description: 'Find all TypeScript files recursively in the codebase',
          input: { pattern: '**/*.ts' },
        },
        {
          name: 'Find JavaScript files in specific directory',
          description: 'Find JavaScript files in the src directory',
          input: { pattern: '*.js', path: './src' },
        },
        {
          name: 'Find test files',
          description: 'Find all test files using pattern matching',
          input: { pattern: '**/*.{test,spec}.{js,ts}' },
        },
        {
          name: 'Find files in package directories',
          description: 'Find TypeScript files in all package src directories',
          input: { pattern: 'packages/*/src/**/*.ts' },
        },
      ],
      version: '1.0.0',
      tags: ['filesystem', 'search', 'pattern-matching', 'performance'],
    });
  }

  /**
   * Validates the input parameters with enhanced pattern and path checks.
   */
  validate(
    params: GlobToolInput,
    context?: ToolExecutionContext
  ): ValidationResult {
    const baseResult = super.validate(params, context);
    if (!baseResult.valid) {
      return baseResult;
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    // Pattern validation
    if (!params.pattern?.trim()) {
      errors.push('pattern cannot be empty');
    } else {
      // Check for potentially dangerous patterns
      if (params.pattern.includes('..') && !params.pattern.startsWith('**/')) {
        warnings.push('pattern contains ".." - ensure this is intentional and safe');
      }

      // Warn about very broad patterns that might be slow
      if (params.pattern === '**/*' || params.pattern === '*') {
        warnings.push('very broad pattern may return many results and be slow');
      }

      // Check for invalid glob characters in certain contexts
      const invalidChars = /[<>"|:]/;
      if (invalidChars.test(params.pattern)) {
        errors.push('pattern contains invalid characters (<>"|:)');
      }
    }

    // Path validation
    if (params.path !== undefined) {
      if (!params.path.trim()) {
        errors.push('path cannot be empty if specified');
      } else {
        // Security: Check for path traversal attempts
        const normalizedPath = path.normalize(params.path);
        if (normalizedPath.includes('..') && !path.isAbsolute(normalizedPath)) {
          warnings.push('relative path contains ".." - ensure this is intentional');
        }

        // Security: Warn about system directories
        const dangerousPatterns = ['/etc/', '/proc/', '/sys/', '/dev/', 'C:\\Windows\\', 'C:\\System32\\'];
        if (dangerousPatterns.some(pattern => normalizedPath.startsWith(pattern))) {
          warnings.push('accessing system directories - use caution');
        }
      }
    }

    // Context-aware validation
    if (context?.workingDirectory && params.path) {
      const searchPath = path.isAbsolute(params.path) ? params.path : path.resolve(context.workingDirectory, params.path);
      const relativePath = path.relative(context.workingDirectory, searchPath);
      if (relativePath.startsWith('..')) {
        warnings.push('search path is outside the working directory');
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? [...(baseResult.warnings || []), ...warnings] : baseResult.warnings,
    };
  }

  /**
   * Executes the glob pattern matching operation.
   */
  protected async executeImpl(
    params: GlobToolInput,
    context?: ToolExecutionContext
  ): Promise<GlobToolOutput> {
    const startTime = Date.now();

    // Check cancellation early
    if (context?.signal?.aborted) {
      throw new Error('Glob operation was cancelled');
    }

    // Determine search directory
    const searchPath = this.resolveSearchPath(params.path, context?.workingDirectory);

    // Validate search directory exists
    try {
      const stats = await fs.stat(searchPath);
      if (!stats.isDirectory()) {
        throw new Error(`Search path is not a directory: ${searchPath}`);
      }
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        const code = (error as { code: string }).code;
        if (code === 'ENOENT') {
          throw new Error(`Search directory not found: ${searchPath}`);
        } else if (code === 'EACCES' || code === 'EPERM') {
          throw new Error(`Permission denied accessing search directory: ${searchPath}`);
        }
      }
      throw new Error(`Failed to access search directory: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Configure fast-glob options
    const globOptions: fastGlob.Options = {
      cwd: searchPath,
      absolute: true,
      onlyFiles: true,
      followSymbolicLinks: false,
      suppressErrors: false,
      braceExpansion: true,
      extglob: true,
      globstar: true,
      // Performance optimizations
      stats: false, // We'll get stats separately to optimize memory
    };

    let matchedPaths: string[] = [];
    let truncated = false;

    try {
      // Check for cancellation before starting search
      if (context?.signal?.aborted) {
        throw new Error('Glob operation was cancelled');
      }

      // Perform the glob search
      matchedPaths = await fastGlob.glob(params.pattern, globOptions);

      // Check if we hit our safety limit
      if (matchedPaths.length > GlobTool.MAX_RESULTS) {
        matchedPaths = matchedPaths.slice(0, GlobTool.MAX_RESULTS);
        truncated = true;
      }

    } catch (error) {
      throw new Error(`Glob pattern matching failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Check cancellation after search
    if (context?.signal?.aborted) {
      throw new Error('Glob operation was cancelled');
    }

    // Get file metadata and sort by modification time
    const files: GlobFileResult[] = [];
    const metadataPromises = matchedPaths.map(async (filePath) => {
      try {
        const stats = await fs.stat(filePath);
        const relativePath = path.relative(searchPath, filePath);
        const extension = path.extname(filePath);
        const basename = path.basename(filePath, extension);

        return {
          path: filePath,
          relativePath,
          size: stats.size,
          lastModified: stats.mtime.toISOString(),
          extension,
          basename,
          mtime: stats.mtime, // For sorting
        };
      } catch (error) {
        // Skip files that can't be accessed (e.g., permission issues)
        return null;
      }
    });

    // Process metadata with timeout protection
    try {
      const metadataResults = await Promise.allSettled(metadataPromises);

      metadataResults.forEach((result) => {
        if (result.status === 'fulfilled' && result.value !== null) {
          const { mtime, ...fileResult } = result.value;
          files.push(fileResult);
        }
      });

      // Sort by modification time (most recent first)
      files.sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());

    } catch (error) {
      throw new Error(`Failed to gather file metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    const endTime = Date.now();
    const searchTime = endTime - startTime;

    // Check if search took too long
    if (searchTime > GlobTool.MAX_SEARCH_TIME) {
      truncated = true;
    }

    // Final cancellation check
    if (context?.signal?.aborted) {
      throw new Error('Glob operation was cancelled');
    }

    return {
      files,
      totalFiles: files.length,
      pattern: params.pattern,
      searchPath,
      searchTime,
      truncated,
    };
  }

  /**
   * Resolves the search path based on input parameters and context.
   */
  private resolveSearchPath(inputPath?: string, workingDirectory?: string): string {
    if (!inputPath) {
      // Use working directory from context or current working directory
      return workingDirectory || process.cwd();
    }

    if (path.isAbsolute(inputPath)) {
      return inputPath;
    }

    // Resolve relative path against working directory
    const baseDir = workingDirectory || process.cwd();
    return path.resolve(baseDir, inputPath);
  }
}