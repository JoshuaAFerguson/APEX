/**
 * @fileoverview WriteTool - File creation and writing tool
 *
 * This module implements the WriteTool that allows APEX agents to create
 * and modify files during task execution. It extends BaseTool to provide
 * standardized parameter validation, error handling, and result formatting.
 *
 * ## Architecture Decision Record (ADR-016)
 *
 * ### Features
 * - Create new files with specified content
 * - Overwrite existing files when explicitly allowed
 * - Automatically create parent directories when needed
 * - Path validation for security and correctness
 * - Optional backup creation before overwriting
 * - Atomic write operations for data safety
 *
 * ### Security
 * - Path traversal prevention (blocks .. escaping working directory)
 * - Overwrite protection (default deny, explicit allow)
 * - Sensitive path blocking (configurable)
 * - Platform-aware path handling
 *
 * @module @apex/core/tools/filesystem/write-tool
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { BaseTool, type ToolExecutionContext, type ValidationResult } from '../base-tool.js';
import type { ToolDefinition, ToolParametersSchema } from '../../types.js';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Input parameters for the WriteTool
 */
export interface WriteFileParams {
  /** Path to the file (absolute or relative to working directory) */
  filePath: string;
  /** Content to write to the file */
  content: string;
  /** File encoding (default: 'utf-8') */
  encoding?: BufferEncoding;
  /** Allow overwriting existing files (default: false) */
  overwrite?: boolean;
  /** Create parent directories if they do not exist (default: true) */
  createDirectories?: boolean;
  /** Create backup (.bak) before overwriting (default: false) */
  backup?: boolean;
}

/**
 * Output result from the WriteTool
 */
export interface WriteFileOutput {
  /** Absolute path that was written */
  filePath: string;
  /** Number of bytes written */
  bytesWritten: number;
  /** true if new file, false if overwritten */
  created: boolean;
  /** Path to backup file if created */
  backupPath?: string;
  /** Directories that were created */
  directoriesCreated?: string[];
}

// ============================================================================
// Error Classes
// ============================================================================

/**
 * Error thrown when attempting to escape working directory
 */
export class PathTraversalError extends Error {
  constructor(filePath: string, workingDirectory: string) {
    super(`Path '${filePath}' escapes working directory '${workingDirectory}'`);
    this.name = 'PathTraversalError';
  }
}

/**
 * Error thrown when attempting to write to sensitive paths
 */
export class SensitivePathError extends Error {
  constructor(filePath: string) {
    super(`Writing to sensitive path '${filePath}' is not allowed`);
    this.name = 'SensitivePathError';
  }
}

// ============================================================================
// WriteTool Implementation
// ============================================================================

/**
 * Tool for writing content to files with safety features.
 *
 * The WriteTool provides agents with the ability to create and modify files
 * while maintaining security through path validation and overwrite protection.
 *
 * @example
 * ```typescript
 * const writeTool = new WriteTool();
 *
 * // Create a new file
 * const result = await writeTool.execute({
 *   filePath: 'src/utils.ts',
 *   content: 'export const add = (a, b) => a + b;'
 * });
 *
 * // Overwrite with backup
 * const result2 = await writeTool.execute({
 *   filePath: 'config.json',
 *   content: '{}',
 *   overwrite: true,
 *   backup: true
 * });
 * ```
 */
export class WriteTool extends BaseTool<WriteFileParams, WriteFileOutput> {
  /** Default encoding for files */
  private static readonly DEFAULT_ENCODING: BufferEncoding = 'utf-8';

  /** Sensitive paths that should not be written to */
  private static readonly SENSITIVE_PATHS = [
    '/etc',
    '/usr',
    '/bin',
    '/sbin',
    '/boot',
    '/dev',
    '/proc',
    '/sys',
    'C:\\Windows',
    'C:\\Program Files',
    'C:\\Program Files (x86)',
  ];

  constructor() {
    super({
      name: 'Write',
      description: 'Write content to a file with optional overwrite protection and backup',
      category: 'filesystem',
      permissions: ['write'],
      dangerous: false, // Protected by overwrite flag
      version: '1.0.0',
      tags: ['file', 'write', 'create', 'filesystem'],
      parameters: WriteTool.getParameterSchema(),
      examples: [
        {
          name: 'Create new file',
          description: 'Write a new file with default settings',
          input: {
            filePath: 'src/utils.ts',
            content: 'export const add = (a, b) => a + b;'
          }
        },
        {
          name: 'Overwrite with backup',
          description: 'Replace existing file with backup',
          input: {
            filePath: 'config.json',
            content: '{}',
            overwrite: true,
            backup: true
          }
        }
      ]
    });
  }

  /**
   * Returns the JSON Schema for tool parameters
   */
  private static getParameterSchema(): ToolParametersSchema {
    return {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: 'Path to the file (absolute or relative to working directory)',
          minLength: 1
        },
        content: {
          type: 'string',
          description: 'Content to write to the file'
        },
        encoding: {
          type: 'string',
          description: 'File encoding (default: utf-8)',
          enum: ['utf-8', 'ascii', 'utf16le', 'latin1', 'base64', 'hex'],
          default: 'utf-8'
        },
        overwrite: {
          type: 'boolean',
          description: 'Allow overwriting existing files (default: false)',
          default: false
        },
        createDirectories: {
          type: 'boolean',
          description: 'Create parent directories if they do not exist (default: true)',
          default: true
        },
        backup: {
          type: 'boolean',
          description: 'Create backup (.bak) before overwriting (default: false)',
          default: false
        }
      },
      required: ['filePath', 'content'],
      additionalProperties: false
    };
  }

  /**
   * Validates the input parameters with additional business logic checks
   */
  validate(params: WriteFileParams, context?: ToolExecutionContext): ValidationResult {
    // First run base validation
    const baseValidation = super.validate(params, context);
    if (!baseValidation.valid) {
      return baseValidation;
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate file path is not empty
    if (!params.filePath.trim()) {
      errors.push('File path cannot be empty');
    }

    // Check for null bytes in path (security)
    if (params.filePath.includes('\0')) {
      errors.push('File path contains null bytes');
    }

    // Validate encoding if provided
    const validEncodings: BufferEncoding[] = ['utf-8', 'ascii', 'utf16le', 'latin1', 'base64', 'hex'];
    if (params.encoding && !validEncodings.includes(params.encoding)) {
      errors.push(`Invalid encoding '${params.encoding}'. Must be one of: ${validEncodings.join(', ')}`);
    }

    // Check if backup is requested without overwrite
    if (params.backup && !params.overwrite) {
      warnings.push('Backup flag is ignored when overwrite is false');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  /**
   * Implements the file writing logic
   */
  protected async executeImpl(
    params: WriteFileParams,
    context?: ToolExecutionContext
  ): Promise<WriteFileOutput> {
    const {
      filePath,
      content,
      encoding = WriteTool.DEFAULT_ENCODING,
      overwrite = false,
      createDirectories = true,
      backup = false
    } = params;

    // Resolve the absolute path
    const workingDirectory = context?.workingDirectory || process.cwd();
    const resolvedPath = path.resolve(workingDirectory, filePath);

    // Security checks
    this.validatePath(resolvedPath, workingDirectory);

    // Check if file exists
    let fileExists = false;
    try {
      await fs.access(resolvedPath);
      fileExists = true;
    } catch {
      // File doesn't exist, which is fine
    }

    // Handle overwrite protection
    if (fileExists && !overwrite) {
      throw new Error(`File already exists: ${resolvedPath}. Set overwrite=true to replace.`);
    }

    // Create parent directories if needed
    const directoriesCreated: string[] = [];
    if (createDirectories) {
      const parentDir = path.dirname(resolvedPath);
      try {
        await fs.access(parentDir);
      } catch {
        // Directory doesn't exist, create it
        await fs.mkdir(parentDir, { recursive: true });
        directoriesCreated.push(parentDir);
      }
    }

    // Create backup if requested and file exists
    let backupPath: string | undefined;
    if (backup && fileExists && overwrite) {
      backupPath = `${resolvedPath}.bak`;
      await fs.copyFile(resolvedPath, backupPath);
    }

    // Write the file atomically using a temporary file
    const tempPath = `${resolvedPath}.tmp.${Date.now()}`;
    try {
      await fs.writeFile(tempPath, content, encoding);

      // Atomic rename
      await fs.rename(tempPath, resolvedPath);

      // Get file stats to determine bytes written
      const stats = await fs.stat(resolvedPath);

      return {
        filePath: resolvedPath,
        bytesWritten: stats.size,
        created: !fileExists,
        backupPath,
        directoriesCreated: directoriesCreated.length > 0 ? directoriesCreated : undefined
      };
    } catch (error) {
      // Clean up temporary file if it exists
      try {
        await fs.unlink(tempPath);
      } catch {
        // Ignore cleanup errors
      }

      // Re-throw the original error with context
      throw this.enhanceError(error, resolvedPath);
    }
  }

  /**
   * Validates path for security and correctness
   */
  private validatePath(resolvedPath: string, workingDirectory: string): void {
    // Check for path traversal
    if (!resolvedPath.startsWith(path.resolve(workingDirectory))) {
      throw new PathTraversalError(resolvedPath, workingDirectory);
    }

    // Check sensitive paths
    const normalizedPath = path.normalize(resolvedPath).toLowerCase();
    for (const sensitivePath of WriteTool.SENSITIVE_PATHS) {
      if (normalizedPath.startsWith(path.normalize(sensitivePath).toLowerCase())) {
        throw new SensitivePathError(resolvedPath);
      }
    }
  }

  /**
   * Enhances errors with more descriptive messages
   */
  private enhanceError(error: unknown, filePath: string): Error {
    if (!(error instanceof Error)) {
      return new Error(`Unknown error writing to ${filePath}: ${String(error)}`);
    }

    const { code } = error as NodeJS.ErrnoException;

    switch (code) {
      case 'ENOENT':
        return new Error(`Parent directory does not exist: ${path.dirname(filePath)}`);
      case 'EACCES':
        return new Error(`Permission denied writing to: ${filePath}`);
      case 'ENOSPC':
        return new Error(`No space left on device for: ${filePath}`);
      case 'ENAMETOOLONG':
        return new Error(`Path exceeds maximum length: ${filePath}`);
      case 'EISDIR':
        return new Error(`Cannot write to directory: ${filePath}`);
      case 'EMFILE':
      case 'ENFILE':
        return new Error(`Too many open files when writing: ${filePath}`);
      default:
        return new Error(`Error writing to ${filePath}: ${error.message}`);
    }
  }
}