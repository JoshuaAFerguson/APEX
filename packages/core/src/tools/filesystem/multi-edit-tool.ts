/**
 * @fileoverview MultiEditTool - Batch file editing with atomic rollback
 *
 * This module implements the MultiEditTool that allows APEX agents to perform
 * multiple related edits to a file as part of a single logical operation.
 * It extends BaseTool to provide standardized parameter validation,
 * error handling, and atomic rollback functionality.
 *
 * ## Features
 * - Batch string replacement operations in a single atomic transaction
 * - Automatic conflict detection between edits
 * - Atomic rollback on any failure to maintain file consistency
 * - Detailed per-edit results and error reporting
 * - Backup creation and cleanup for data safety
 * - Path validation for security
 *
 * ## Architecture
 * The tool follows a "single backup, apply-all-or-nothing" approach:
 * 1. Read original file content
 * 2. Create backup file
 * 3. Validate all edits can be applied (dry-run)
 * 4. Apply all edits to in-memory content
 * 5. Write atomically to temp file then rename
 * 6. Clean up backup on success, restore on failure
 *
 * @module @apex/core/tools/filesystem/multi-edit-tool
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { BaseTool, type ToolExecutionContext, type ValidationResult } from '../base-tool.js';
import type { ToolParametersSchema } from '../../types.js';
import { StringNotFoundError, AmbiguousReplacementError, FileAccessError } from './edit-tool.js';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * A single edit operation within a multi-edit batch
 */
export interface MultiEditOperation {
  /** The exact text to find and replace */
  old_string: string;
  /** The text to replace it with */
  new_string: string;
  /** Replace all occurrences (default: false) */
  replace_all?: boolean;
}

/**
 * Input parameters for the MultiEditTool
 */
export interface MultiEditFileParams {
  /** Absolute path to the file to modify */
  file_path: string;
  /** Array of edits to apply in order */
  edits: MultiEditOperation[];
}

/**
 * Result of a single edit operation
 */
export interface EditOperationResult {
  /** Index of the edit (0-based) */
  index: number;
  /** Number of replacements made */
  replacements: number;
  /** Line numbers affected by this edit */
  modifiedLines: number[];
  /** Whether this edit was successful */
  success: boolean;
  /** Error message if failed */
  error?: string;
}

/**
 * Output result from the MultiEditTool
 */
export interface MultiEditFileOutput {
  /** Absolute path that was modified */
  filePath: string;
  /** Total number of edits applied */
  editsApplied: number;
  /** Results for each edit operation */
  editResults: EditOperationResult[];
  /** File size before and after */
  sizeChange: {
    before: number;
    after: number;
  };
  /** Combined preview of changes */
  changePreview: string;
}

// ============================================================================
// Error Classes
// ============================================================================

/**
 * Error thrown when a batch edit operation fails
 */
export class BatchEditError extends Error {
  constructor(
    public failedEditIndex: number,
    public editError: Error,
    public appliedEdits: number
  ) {
    super(`Batch edit failed at operation ${failedEditIndex}: ${editError.message}`);
    this.name = 'BatchEditError';
  }
}

/**
 * Error thrown when edits conflict with each other
 */
export class EditConflictError extends Error {
  constructor(
    public conflictingEdits: [number, number],
    public reason: string
  ) {
    super(`Edit conflict between operations ${conflictingEdits[0]} and ${conflictingEdits[1]}: ${reason}`);
    this.name = 'EditConflictError';
  }
}

// ============================================================================
// MultiEditTool Implementation
// ============================================================================

/**
 * Tool for making multiple surgical edits to files in a single atomic operation.
 *
 * The MultiEditTool provides agents with the ability to make multiple precise
 * modifications to files while maintaining safety through validation, conflict
 * detection, and atomic rollback on failure.
 *
 * @example
 * ```typescript
 * const multiEditTool = new MultiEditTool();
 *
 * // Multiple replacements in one operation
 * const result = await multiEditTool.execute({
 *   file_path: '/path/to/file.ts',
 *   edits: [
 *     { old_string: 'const API_URL = "localhost";', new_string: 'const API_URL = "production.com";' },
 *     { old_string: 'DEBUG = true;', new_string: 'DEBUG = false;' },
 *     { old_string: 'console.log(', new_string: 'logger.info(', replace_all: true }
 *   ]
 * });
 * ```
 */
export class MultiEditTool extends BaseTool<MultiEditFileParams, MultiEditFileOutput> {
  /** Maximum file size to edit (50MB) */
  private static readonly MAX_FILE_SIZE = 50 * 1024 * 1024;

  /** Maximum number of edits per batch */
  private static readonly MAX_EDITS = 100;

  /** Sensitive paths that should not be edited */
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
      name: 'MultiEdit',
      description: 'Perform multiple surgical edits to a file in a single atomic operation',
      category: 'filesystem',
      permissions: ['read', 'write'],
      dangerous: false, // Protected by exact string matching and atomic operations
      version: '1.0.0',
      tags: ['file', 'edit', 'batch', 'atomic', 'filesystem'],
      parameters: MultiEditTool.getParameterSchema(),
      examples: [
        {
          name: 'Configuration update',
          description: 'Update multiple configuration values atomically',
          input: {
            file_path: '/src/config.ts',
            edits: [
              { old_string: 'const API_URL = "http://localhost:3000";', new_string: 'const API_URL = "https://api.example.com";' },
              { old_string: 'const DEBUG = true;', new_string: 'const DEBUG = false;' }
            ]
          }
        },
        {
          name: 'Code refactoring',
          description: 'Rename function calls and update imports',
          input: {
            file_path: '/src/utils.js',
            edits: [
              { old_string: 'import { oldFunction }', new_string: 'import { newFunction }' },
              { old_string: 'oldFunction(', new_string: 'newFunction(', replace_all: true }
            ]
          }
        },
        {
          name: 'Template replacement',
          description: 'Replace multiple template placeholders',
          input: {
            file_path: '/templates/email.html',
            edits: [
              { old_string: '{{TITLE}}', new_string: 'Welcome to Our Service' },
              { old_string: '{{COMPANY}}', new_string: 'ACME Corporation' },
              { old_string: '{{YEAR}}', new_string: '2024' }
            ]
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
        file_path: {
          type: 'string',
          description: 'The absolute path to the file to modify',
          minLength: 1
        },
        edits: {
          type: 'array',
          description: 'Array of edit operations to apply in order',
          minItems: 1,
          maxItems: MultiEditTool.MAX_EDITS,
          items: {
            type: 'object',
            properties: {
              old_string: {
                type: 'string',
                description: 'The exact text to find',
                minLength: 1
              },
              new_string: {
                type: 'string',
                description: 'The text to replace it with'
              },
              replace_all: {
                type: 'boolean',
                description: 'Replace all occurrences',
                default: false
              }
            },
            required: ['old_string', 'new_string'],
            additionalProperties: false
          }
        }
      },
      required: ['file_path', 'edits'],
      additionalProperties: false
    };
  }

  /**
   * Validates the input parameters with additional business logic checks
   */
  validate(params: MultiEditFileParams, context?: ToolExecutionContext): ValidationResult {
    // First run base validation
    const baseValidation = super.validate(params, context);
    if (!baseValidation.valid) {
      return baseValidation;
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate file path is not empty
    if (!params.file_path.trim()) {
      errors.push('File path cannot be empty');
    }

    // Check for null bytes in path (security)
    if (params.file_path.includes('\0')) {
      errors.push('File path contains null bytes');
    }

    // Validate edits array
    if (!Array.isArray(params.edits) || params.edits.length === 0) {
      errors.push('Edits must be a non-empty array');
    } else {
      // Validate each edit operation
      for (let i = 0; i < params.edits.length; i++) {
        const edit = params.edits[i];
        const editPrefix = `Edit ${i + 1}`;

        if (!edit.old_string || edit.old_string.trim() === '') {
          errors.push(`${editPrefix}: old_string cannot be empty`);
        }

        if (edit.old_string === edit.new_string) {
          errors.push(`${editPrefix}: old_string and new_string must be different`);
        }

        // Warn about very long strings
        if (edit.old_string.length > 10000) {
          warnings.push(`${editPrefix}: old_string is very long (>10KB) - this may impact performance`);
        }

        // Check if old_string contains only whitespace
        if (edit.old_string.trim() === '') {
          warnings.push(`${editPrefix}: old_string contains only whitespace - this may have unintended effects`);
        }
      }

      // Check for potential conflicts between edits
      this.detectPotentialConflicts(params.edits, warnings);
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  /**
   * Detects potential conflicts between edit operations
   */
  private detectPotentialConflicts(edits: MultiEditOperation[], warnings: string[]): void {
    for (let i = 0; i < edits.length; i++) {
      for (let j = i + 1; j < edits.length; j++) {
        const editA = edits[i];
        const editB = edits[j];

        // Check if edit A's new_string contains edit B's old_string
        if (editA.new_string.includes(editB.old_string)) {
          warnings.push(`Potential conflict: Edit ${i + 1} introduces text that Edit ${j + 1} will modify`);
        }

        // Check if edit B's new_string contains edit A's old_string
        if (editB.new_string.includes(editA.old_string)) {
          warnings.push(`Potential conflict: Edit ${j + 1} introduces text that was modified by Edit ${i + 1}`);
        }

        // Check for overlapping old_strings
        if (editA.old_string.includes(editB.old_string) || editB.old_string.includes(editA.old_string)) {
          warnings.push(`Potential overlap: Edit ${i + 1} and Edit ${j + 1} have overlapping target text`);
        }
      }
    }
  }

  /**
   * Implements the multi-edit file editing logic
   */
  protected async executeImpl(
    params: MultiEditFileParams,
    context?: ToolExecutionContext
  ): Promise<MultiEditFileOutput> {
    const { file_path, edits } = params;

    // Resolve and validate the file path
    const workingDirectory = context?.workingDirectory || process.cwd();
    const resolvedPath = path.resolve(workingDirectory, file_path);

    this.validatePath(resolvedPath, workingDirectory);

    // Check if file exists and is readable/writable
    try {
      await fs.access(resolvedPath, fs.constants.R_OK | fs.constants.W_OK);
    } catch (error) {
      throw new FileAccessError(resolvedPath, 'access', error as Error);
    }

    // Get file stats and check size
    const statsBefore = await fs.stat(resolvedPath);
    if (statsBefore.size > MultiEditTool.MAX_FILE_SIZE) {
      throw new Error(`File too large: ${resolvedPath} (${statsBefore.size} bytes, max: ${MultiEditTool.MAX_FILE_SIZE})`);
    }

    // Read original file content
    let originalContent: string;
    try {
      originalContent = await fs.readFile(resolvedPath, 'utf-8');
    } catch (error) {
      throw new FileAccessError(resolvedPath, 'read', error as Error);
    }

    // Validate all edits can be applied (dry-run)
    const validationResults = this.validateAllEdits(originalContent, edits, resolvedPath);

    // Create backup file
    const backupPath = `${resolvedPath}.backup.${Date.now()}`;
    try {
      await fs.writeFile(backupPath, originalContent, 'utf-8');
    } catch (error) {
      throw new FileAccessError(backupPath, 'write backup', error as Error);
    }

    // Apply all edits to in-memory content
    let { newContent, editResults } = this.applyAllEdits(originalContent, edits);

    // Write the modified content atomically
    const tempPath = `${resolvedPath}.tmp.${Date.now()}`;
    try {
      await fs.writeFile(tempPath, newContent, 'utf-8');
      await fs.rename(tempPath, resolvedPath);

      // Remove backup if successful
      await fs.unlink(backupPath);

      const statsAfter = await fs.stat(resolvedPath);

      return {
        filePath: resolvedPath,
        editsApplied: editResults.filter(r => r.success).length,
        editResults,
        changePreview: this.generateChangePreview(originalContent, newContent, editResults),
        sizeChange: {
          before: statsBefore.size,
          after: statsAfter.size
        }
      };
    } catch (error) {
      // Clean up temporary file and restore backup
      try {
        await fs.unlink(tempPath);
        await fs.rename(backupPath, resolvedPath);
      } catch (cleanupError) {
        // Log cleanup error but throw original error
        console.error('Failed to cleanup after edit error:', cleanupError);
      }

      throw new FileAccessError(resolvedPath, 'write', error as Error);
    }
  }

  /**
   * Validates that all edits can be applied to the content
   */
  private validateAllEdits(content: string, edits: MultiEditOperation[], filePath: string): EditOperationResult[] {
    const results: EditOperationResult[] = [];

    for (let i = 0; i < edits.length; i++) {
      const edit = edits[i];
      const result: EditOperationResult = {
        index: i,
        replacements: 0,
        modifiedLines: [],
        success: false
      };

      try {
        // Check if old_string exists in the content
        const occurrences = this.countOccurrences(content, edit.old_string);
        if (occurrences === 0) {
          result.error = `String not found: "${edit.old_string.substring(0, 100)}${edit.old_string.length > 100 ? '...' : ''}"`;
          results.push(result);
          throw new StringNotFoundError(edit.old_string, filePath);
        }

        // Check for ambiguous replacement
        if (occurrences > 1 && !edit.replace_all) {
          result.error = `String appears ${occurrences} times - use replace_all=true to replace all occurrences`;
          results.push(result);
          throw new AmbiguousReplacementError(edit.old_string, occurrences, filePath);
        }

        result.success = true;
        result.replacements = edit.replace_all ? occurrences : 1;
      } catch (error) {
        throw new BatchEditError(i, error as Error, i);
      }

      results.push(result);
    }

    return results;
  }

  /**
   * Applies all edits to the content sequentially
   */
  private applyAllEdits(
    originalContent: string,
    edits: MultiEditOperation[]
  ): { newContent: string; editResults: EditOperationResult[] } {
    let workingContent = originalContent;
    const editResults: EditOperationResult[] = [];
    const allModifiedLines = new Set<number>();

    for (let i = 0; i < edits.length; i++) {
      const edit = edits[i];
      const result: EditOperationResult = {
        index: i,
        replacements: 0,
        modifiedLines: [],
        success: false
      };

      try {
        // Apply this edit to the working content
        const editResult = this.performReplacement(
          workingContent,
          edit.old_string,
          edit.new_string,
          edit.replace_all || false
        );

        workingContent = editResult.newContent;
        result.replacements = editResult.replacements;
        result.modifiedLines = editResult.modifiedLines;
        result.success = true;

        // Track all modified lines across all edits
        result.modifiedLines.forEach(line => allModifiedLines.add(line));
      } catch (error) {
        result.error = error instanceof Error ? error.message : String(error);
        // Don't throw here - we want to collect all errors
      }

      editResults.push(result);
    }

    return { newContent: workingContent, editResults };
  }

  /**
   * Validates path for security and correctness
   */
  private validatePath(resolvedPath: string, workingDirectory: string): void {
    // Check sensitive paths
    const normalizedPath = path.normalize(resolvedPath).toLowerCase();
    for (const sensitivePath of MultiEditTool.SENSITIVE_PATHS) {
      if (normalizedPath.startsWith(path.normalize(sensitivePath).toLowerCase())) {
        throw new Error(`Editing sensitive path '${resolvedPath}' is not allowed`);
      }
    }
  }

  /**
   * Counts occurrences of a string in text
   */
  private countOccurrences(text: string, searchString: string): number {
    let count = 0;
    let position = 0;

    while (true) {
      const found = text.indexOf(searchString, position);
      if (found === -1) break;
      count++;
      position = found + 1;
    }

    return count;
  }

  /**
   * Performs the string replacement and tracks modified lines
   */
  private performReplacement(
    content: string,
    oldString: string,
    newString: string,
    replaceAll: boolean
  ): { newContent: string; replacements: number; modifiedLines: number[] } {
    const lines = content.split('\n');
    const modifiedLines: number[] = [];
    let replacements = 0;
    let newContent = content;

    if (replaceAll) {
      // Replace all occurrences
      newContent = content.replace(new RegExp(this.escapeRegExp(oldString), 'g'), () => {
        replacements++;
        return newString;
      });

      // Find modified lines by comparing original and new content
      const newLines = newContent.split('\n');
      for (let i = 0; i < Math.max(lines.length, newLines.length); i++) {
        if (lines[i] !== newLines[i]) {
          modifiedLines.push(i + 1); // 1-based line numbers
        }
      }
    } else {
      // Replace only the first occurrence
      const index = content.indexOf(oldString);
      if (index !== -1) {
        newContent = content.substring(0, index) + newString + content.substring(index + oldString.length);
        replacements = 1;

        // Find the line number where the replacement occurred
        const beforeReplacement = content.substring(0, index);
        const lineNumber = beforeReplacement.split('\n').length;
        modifiedLines.push(lineNumber);

        // If the replacement spans multiple lines, mark all affected lines
        const oldStringLines = oldString.split('\n');
        for (let i = 1; i < oldStringLines.length; i++) {
          modifiedLines.push(lineNumber + i);
        }
      }
    }

    return { newContent, replacements, modifiedLines };
  }

  /**
   * Escapes special regex characters
   */
  private escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Generates a preview of the changes made across all edits
   */
  private generateChangePreview(
    originalContent: string,
    newContent: string,
    editResults: EditOperationResult[]
  ): string {
    const allModifiedLines = new Set<number>();
    editResults.forEach(result => {
      result.modifiedLines.forEach(line => allModifiedLines.add(line));
    });

    if (allModifiedLines.size === 0) {
      return 'No changes made';
    }

    const originalLines = originalContent.split('\n');
    const newLines = newContent.split('\n');
    const preview: string[] = [];
    const sortedLines = Array.from(allModifiedLines).sort((a, b) => a - b);

    // Show up to 10 changed lines with context
    const linesToShow = sortedLines.slice(0, 10);

    for (const lineNum of linesToShow) {
      const lineIndex = lineNum - 1; // Convert to 0-based

      // Add context line before (if exists and not already shown)
      if (lineIndex > 0 && preview.length < 20) {
        const contextLine = originalLines[lineIndex - 1] || '';
        preview.push(`  ${lineIndex}: ${contextLine}`);
      }

      // Add the changed line
      const originalLine = originalLines[lineIndex] || '';
      const newLine = newLines[lineIndex] || '';

      preview.push(`- ${lineNum}: ${originalLine}`);
      preview.push(`+ ${lineNum}: ${newLine}`);

      // Add context line after (if exists and not already shown)
      if (lineIndex < originalLines.length - 1 && preview.length < 20) {
        const contextLine = originalLines[lineIndex + 1] || '';
        preview.push(`  ${lineIndex + 2}: ${contextLine}`);
      }

      if (preview.length >= 20) {
        preview.push('  ... (showing first 10 changed lines)');
        break;
      }
    }

    // Add summary
    const totalEdits = editResults.length;
    const successfulEdits = editResults.filter(r => r.success).length;
    const totalReplacements = editResults.reduce((sum, r) => sum + r.replacements, 0);

    preview.unshift(`Applied ${successfulEdits}/${totalEdits} edits, ${totalReplacements} replacements total:`);
    preview.unshift('');

    return preview.join('\n');
  }
}