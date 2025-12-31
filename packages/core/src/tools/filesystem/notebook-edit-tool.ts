/**
 * @fileoverview NotebookEditTool - Jupyter notebook cell editing tool
 *
 * This module implements the NotebookEditTool that allows APEX agents to
 * edit Jupyter notebook (.ipynb) files with support for cell replacement,
 * insertion, deletion, and cell type management. It extends BaseTool to
 * provide standardized parameter validation, error handling, and result formatting.
 *
 * ## Features
 * - Cell replacement with content and type updates
 * - Cell insertion at specific positions or beginning
 * - Cell deletion by cell ID
 * - Cell type support (code, markdown, raw)
 * - Format preservation (metadata, outputs, structure)
 * - Atomic file operations for data safety
 * - Path validation for security
 *
 * ## Security
 * - Path traversal prevention
 * - JSON parsing safety
 * - File size limits (50MB default)
 * - Metadata preservation
 * - Backup and restore on failure
 *
 * @module @apex/core/tools/filesystem/notebook-edit-tool
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { BaseTool, type ToolExecutionContext, type ValidationResult } from '../base-tool.js';
import type { ToolParametersSchema } from '../../types.js';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Edit modes for notebook cell operations
 */
export type NotebookEditMode = 'replace' | 'insert' | 'delete';

/**
 * Cell types supported in Jupyter notebooks
 */
export type NotebookCellType = 'code' | 'markdown' | 'raw';

/**
 * Input parameters for the NotebookEditTool
 */
export interface NotebookEditParams {
  /** Absolute path to the .ipynb file to modify */
  notebook_path: string;

  /** New source content for the cell (ignored for delete mode) */
  new_source: string;

  /**
   * Optional cell ID to identify which cell to edit.
   * When inserting, the new cell is inserted AFTER the cell with this ID.
   * If not specified during insert, the cell is added at the beginning.
   */
  cell_id?: string;

  /**
   * Cell type for the operation (required for insert mode).
   * For replace mode, if not specified, keeps the existing cell type.
   */
  cell_type?: NotebookCellType;

  /**
   * Edit mode: replace (default), insert, or delete
   * - replace: Replace the content of an existing cell
   * - insert: Add a new cell (after cell_id if specified, or at beginning)
   * - delete: Remove the cell (new_source is ignored)
   */
  edit_mode?: NotebookEditMode;
}

/**
 * Output from NotebookEditTool execution
 */
export interface NotebookEditOutput {
  /** Path to the modified notebook */
  notebookPath: string;

  /** ID of the affected cell (new ID for insert, existing ID for replace/delete) */
  cellId: string;

  /** Index of the affected cell (0-based) */
  cellIndex: number;

  /** Type of the affected cell */
  cellType: NotebookCellType;

  /** The edit mode that was performed */
  editMode: NotebookEditMode;

  /** Total number of cells in the notebook after the operation */
  totalCells: number;

  /** Size of notebook file before and after */
  sizeChange: {
    before: number;
    after: number;
  };

  /** Preview of the cell content (first N lines) */
  contentPreview: string;
}

// ============================================================================
// Error Classes
// ============================================================================

/**
 * Error thrown when cell ID is not found in the notebook
 */
export class CellNotFoundError extends Error {
  constructor(cellId: string, notebookPath: string) {
    super(`Cell with ID "${cellId}" not found in notebook: ${notebookPath}`);
    this.name = 'CellNotFoundError';
  }
}

/**
 * Error thrown when notebook JSON is malformed
 */
export class InvalidNotebookError extends Error {
  constructor(notebookPath: string, reason: string) {
    super(`Invalid notebook format in ${notebookPath}: ${reason}`);
    this.name = 'InvalidNotebookError';
  }
}

/**
 * Error thrown when cell index is out of bounds
 */
export class CellIndexOutOfBoundsError extends Error {
  constructor(index: number, totalCells: number, notebookPath: string) {
    super(`Cell index ${index} out of bounds (0-${totalCells - 1}) in notebook: ${notebookPath}`);
    this.name = 'CellIndexOutOfBoundsError';
  }
}

/**
 * Error thrown when required cell_type is missing for insert mode
 */
export class MissingCellTypeError extends Error {
  constructor() {
    super('cell_type is required when edit_mode is "insert"');
    this.name = 'MissingCellTypeError';
  }
}

/**
 * Error thrown when notebook file cannot be accessed
 */
export class NotebookAccessError extends Error {
  constructor(notebookPath: string, operation: string, originalError: Error) {
    super(`Cannot ${operation} notebook ${notebookPath}: ${originalError.message}`);
    this.name = 'NotebookAccessError';
  }
}

// ============================================================================
// Jupyter Notebook JSON Structure
// ============================================================================

interface JupyterNotebook {
  cells: JupyterCell[];
  metadata: Record<string, unknown>;
  nbformat: number;
  nbformat_minor: number;
}

interface JupyterCell {
  cell_type: 'code' | 'markdown' | 'raw';
  id?: string;  // Cell ID (nbformat 4.5+)
  source: string | string[];  // Content (may be string or array of lines)
  metadata: Record<string, unknown>;
  execution_count?: number | null;  // Only for code cells
  outputs?: unknown[];  // Only for code cells
}

// ============================================================================
// NotebookEditTool Implementation
// ============================================================================

/**
 * Tool for editing Jupyter notebook cells with support for replacement,
 * insertion, deletion, and cell type management.
 *
 * The NotebookEditTool provides agents with the ability to modify notebook
 * cells while maintaining the notebook structure, metadata, and outputs.
 *
 * @example
 * ```typescript
 * const notebookTool = new NotebookEditTool();
 *
 * // Replace cell content
 * const result = await notebookTool.execute({
 *   notebook_path: '/path/to/notebook.ipynb',
 *   cell_id: 'cell-123',
 *   new_source: 'print("Hello, World!")',
 *   edit_mode: 'replace'
 * });
 *
 * // Insert new cell
 * const result2 = await notebookTool.execute({
 *   notebook_path: '/path/to/notebook.ipynb',
 *   new_source: '# New markdown cell',
 *   cell_type: 'markdown',
 *   edit_mode: 'insert'
 * });
 *
 * // Delete cell
 * const result3 = await notebookTool.execute({
 *   notebook_path: '/path/to/notebook.ipynb',
 *   cell_id: 'cell-456',
 *   new_source: '', // ignored for delete
 *   edit_mode: 'delete'
 * });
 * ```
 */
export class NotebookEditTool extends BaseTool<NotebookEditParams, NotebookEditOutput> {
  /** Maximum file size to edit (50MB) */
  private static readonly MAX_FILE_SIZE = 50 * 1024 * 1024;

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
      name: 'NotebookEdit',
      description: 'Edit Jupyter notebook cells with support for replacement, insertion, deletion, and cell type management',
      category: 'filesystem',
      permissions: ['read', 'write'],
      dangerous: false, // Protected by cell ID targeting and validation
      version: '1.0.0',
      tags: ['notebook', 'jupyter', 'edit', 'cell', 'ipynb', 'filesystem'],
      parameters: NotebookEditTool.getParameterSchema(),
      examples: [
        {
          name: 'Replace cell content',
          description: 'Replace the content of an existing cell',
          input: {
            notebook_path: '/notebooks/analysis.ipynb',
            cell_id: 'cell-123',
            new_source: 'print("Updated analysis code")',
            edit_mode: 'replace'
          }
        },
        {
          name: 'Insert new code cell',
          description: 'Insert a new code cell at the beginning',
          input: {
            notebook_path: '/notebooks/analysis.ipynb',
            new_source: 'import pandas as pd\nimport numpy as np',
            cell_type: 'code',
            edit_mode: 'insert'
          }
        },
        {
          name: 'Insert markdown cell after specific cell',
          description: 'Insert a markdown cell after an existing cell',
          input: {
            notebook_path: '/notebooks/analysis.ipynb',
            cell_id: 'cell-456',
            new_source: '## Data Processing\n\nThis section handles data preprocessing.',
            cell_type: 'markdown',
            edit_mode: 'insert'
          }
        },
        {
          name: 'Delete cell',
          description: 'Delete an existing cell by ID',
          input: {
            notebook_path: '/notebooks/analysis.ipynb',
            cell_id: 'cell-789',
            new_source: '',
            edit_mode: 'delete'
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
        notebook_path: {
          type: 'string',
          description: 'The absolute path to the Jupyter notebook file to edit (must be absolute, not relative)',
          minLength: 1
        },
        new_source: {
          type: 'string',
          description: 'The new source content for the cell'
        },
        cell_id: {
          type: 'string',
          description: 'The ID of the cell to edit. When inserting a new cell, the new cell will be inserted after the cell with this ID, or at the beginning if not specified.'
        },
        cell_type: {
          type: 'string',
          enum: ['code', 'markdown', 'raw'],
          description: 'The type of the cell (code, markdown, or raw). Required when inserting a new cell. If not specified for replace, keeps existing cell type.'
        },
        edit_mode: {
          type: 'string',
          enum: ['replace', 'insert', 'delete'],
          description: 'The type of edit to make: replace (default), insert a new cell, or delete an existing cell',
          default: 'replace'
        }
      },
      required: ['notebook_path', 'new_source'],
      additionalProperties: false
    };
  }

  /**
   * Validates the input parameters with notebook-specific logic
   */
  validate(
    params: NotebookEditParams,
    context?: ToolExecutionContext
  ): ValidationResult {
    // First run base validation
    const baseValidation = super.validate(params, context);
    if (!baseValidation.valid) {
      return baseValidation;
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    // Path validation
    if (!params.notebook_path || params.notebook_path.trim() === '') {
      errors.push('notebook_path cannot be empty');
    } else {
      // Check for path traversal
      if (params.notebook_path.includes('..') || params.notebook_path.includes('\0')) {
        errors.push('Invalid path: contains path traversal or null bytes');
      }

      // Check for sensitive paths
      const normalizedPath = path.resolve(params.notebook_path);
      const isSensitive = NotebookEditTool.SENSITIVE_PATHS.some(sensitivePath =>
        normalizedPath.toLowerCase().startsWith(sensitivePath.toLowerCase())
      );
      if (isSensitive) {
        errors.push(`Cannot edit files in sensitive system path: ${normalizedPath}`);
      }

      // Check extension
      if (!params.notebook_path.toLowerCase().endsWith('.ipynb')) {
        warnings.push('File does not have .ipynb extension');
      }
    }

    // Mode-specific validation
    const mode = params.edit_mode || 'replace';

    switch (mode) {
      case 'insert':
        if (!params.cell_type) {
          errors.push('cell_type is required when edit_mode is "insert"');
        }
        break;
      case 'replace':
      case 'delete':
        // For these modes, we need either a cell_id or it should be a single-cell notebook
        // We'll check cell_id existence during execution
        break;
      default:
        errors.push(`Invalid edit_mode: ${mode}`);
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Execute the notebook edit operation
   */
  protected async executeImpl(
    params: NotebookEditParams,
    _context?: ToolExecutionContext
  ): Promise<NotebookEditOutput> {
    const normalizedPath = path.resolve(params.notebook_path);
    const mode = params.edit_mode || 'replace';

    try {
      // Check file exists and get size
      const stats = await fs.stat(normalizedPath);
      if (stats.size > NotebookEditTool.MAX_FILE_SIZE) {
        throw new NotebookAccessError(
          normalizedPath,
          'read',
          new Error(`File size ${stats.size} exceeds maximum ${NotebookEditTool.MAX_FILE_SIZE} bytes`)
        );
      }

      const originalSize = stats.size;

      // Read and parse notebook
      let notebookContent: string;
      try {
        notebookContent = await fs.readFile(normalizedPath, 'utf-8');
      } catch (error) {
        throw new NotebookAccessError(
          normalizedPath,
          'read',
          error instanceof Error ? error : new Error(String(error))
        );
      }

      let notebook: JupyterNotebook;
      try {
        notebook = JSON.parse(notebookContent);
      } catch (error) {
        throw new InvalidNotebookError(
          normalizedPath,
          'Invalid JSON format'
        );
      }

      // Validate notebook structure
      this.validateNotebookStructure(notebook, normalizedPath);

      // Ensure all cells have IDs
      this.ensureCellIds(notebook);

      // Perform the edit operation
      const result = this.performEdit(notebook, params, normalizedPath);

      // Create backup
      const backupPath = `${normalizedPath}.backup.${Date.now()}`;
      try {
        await fs.copyFile(normalizedPath, backupPath);
      } catch (error) {
        throw new NotebookAccessError(
          normalizedPath,
          'create backup',
          error instanceof Error ? error : new Error(String(error))
        );
      }

      // Write updated notebook
      const updatedContent = JSON.stringify(notebook, null, 2);
      const tempPath = `${normalizedPath}.tmp.${Date.now()}`;

      try {
        await fs.writeFile(tempPath, updatedContent, 'utf-8');
        await fs.rename(tempPath, normalizedPath);

        // Clean up backup on success
        await fs.unlink(backupPath);

        const newSize = Buffer.byteLength(updatedContent, 'utf-8');

        return {
          ...result,
          sizeChange: {
            before: originalSize,
            after: newSize,
          },
        };
      } catch (error) {
        // Restore backup on failure
        try {
          await fs.copyFile(backupPath, normalizedPath);
          await fs.unlink(backupPath);
        } catch {
          // Backup restore failed, but don't mask the original error
        }

        throw new NotebookAccessError(
          normalizedPath,
          'write',
          error instanceof Error ? error : new Error(String(error))
        );
      }

    } catch (error) {
      if (error instanceof Error &&
          (error.name === 'CellNotFoundError' ||
           error.name === 'InvalidNotebookError' ||
           error.name === 'CellIndexOutOfBoundsError' ||
           error.name === 'MissingCellTypeError' ||
           error.name === 'NotebookAccessError')) {
        throw error;
      }

      throw new NotebookAccessError(
        normalizedPath,
        'process',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Validate the basic structure of a Jupyter notebook
   */
  private validateNotebookStructure(notebook: JupyterNotebook, notebookPath: string): void {
    if (!notebook || typeof notebook !== 'object') {
      throw new InvalidNotebookError(notebookPath, 'Notebook must be an object');
    }

    if (!notebook.nbformat || typeof notebook.nbformat !== 'number') {
      throw new InvalidNotebookError(notebookPath, 'Missing or invalid nbformat field');
    }

    if (notebook.nbformat < 3 || notebook.nbformat > 4) {
      throw new InvalidNotebookError(notebookPath, `Unsupported nbformat version: ${notebook.nbformat}`);
    }

    if (!Array.isArray(notebook.cells)) {
      throw new InvalidNotebookError(notebookPath, 'cells field must be an array');
    }

    if (!notebook.metadata || typeof notebook.metadata !== 'object') {
      throw new InvalidNotebookError(notebookPath, 'Missing or invalid metadata field');
    }

    // Validate each cell
    for (let i = 0; i < notebook.cells.length; i++) {
      const cell = notebook.cells[i];
      if (!cell || typeof cell !== 'object') {
        throw new InvalidNotebookError(notebookPath, `Cell ${i} is not an object`);
      }

      if (!cell.cell_type || !['code', 'markdown', 'raw'].includes(cell.cell_type)) {
        throw new InvalidNotebookError(notebookPath, `Cell ${i} has invalid cell_type: ${cell.cell_type}`);
      }

      if (cell.source === undefined) {
        throw new InvalidNotebookError(notebookPath, `Cell ${i} is missing source field`);
      }

      if (!cell.metadata || typeof cell.metadata !== 'object') {
        throw new InvalidNotebookError(notebookPath, `Cell ${i} is missing or has invalid metadata field`);
      }
    }
  }

  /**
   * Ensure all cells have unique IDs, generating them if needed
   */
  private ensureCellIds(notebook: JupyterNotebook): void {
    const usedIds = new Set<string>();

    for (const cell of notebook.cells) {
      if (!cell.id || usedIds.has(cell.id)) {
        // Generate new unique ID
        let newId: string;
        do {
          newId = crypto.randomUUID();
        } while (usedIds.has(newId));

        cell.id = newId;
      }
      usedIds.add(cell.id);
    }
  }

  /**
   * Perform the actual edit operation
   */
  private performEdit(
    notebook: JupyterNotebook,
    params: NotebookEditParams,
    notebookPath: string
  ): Omit<NotebookEditOutput, 'sizeChange'> {
    const mode = params.edit_mode || 'replace';

    switch (mode) {
      case 'replace':
        return this.replaceCell(notebook, params, notebookPath);
      case 'insert':
        return this.insertCell(notebook, params, notebookPath);
      case 'delete':
        return this.deleteCell(notebook, params, notebookPath);
      default:
        throw new Error(`Unsupported edit mode: ${mode}`);
    }
  }

  /**
   * Replace cell content and optionally cell type
   */
  private replaceCell(
    notebook: JupyterNotebook,
    params: NotebookEditParams,
    notebookPath: string
  ): Omit<NotebookEditOutput, 'sizeChange'> {
    let targetIndex = -1;

    if (params.cell_id) {
      targetIndex = notebook.cells.findIndex(cell => cell.id === params.cell_id);
      if (targetIndex === -1) {
        throw new CellNotFoundError(params.cell_id, notebookPath);
      }
    } else {
      // If no cell_id provided, operate on the first cell if there's only one
      if (notebook.cells.length === 1) {
        targetIndex = 0;
      } else if (notebook.cells.length === 0) {
        throw new InvalidNotebookError(notebookPath, 'Cannot replace cell in empty notebook without cell_id');
      } else {
        throw new InvalidNotebookError(notebookPath, 'cell_id is required for replace operation in multi-cell notebook');
      }
    }

    const cell = notebook.cells[targetIndex];

    // Update source (normalize to array format for consistency)
    cell.source = this.normalizeSource(params.new_source);

    // Update cell type if specified
    if (params.cell_type && params.cell_type !== cell.cell_type) {
      const oldType = cell.cell_type;
      cell.cell_type = params.cell_type;

      // Handle type-specific changes
      if (oldType === 'code' && params.cell_type !== 'code') {
        // Removing code cell properties
        delete cell.execution_count;
        delete cell.outputs;
      } else if (oldType !== 'code' && params.cell_type === 'code') {
        // Adding code cell properties
        cell.execution_count = null;
        cell.outputs = [];
      }
    }

    return {
      notebookPath,
      cellId: cell.id!,
      cellIndex: targetIndex,
      cellType: cell.cell_type as NotebookCellType,
      editMode: 'replace',
      totalCells: notebook.cells.length,
      contentPreview: this.createContentPreview(params.new_source),
    };
  }

  /**
   * Insert a new cell
   */
  private insertCell(
    notebook: JupyterNotebook,
    params: NotebookEditParams,
    notebookPath: string
  ): Omit<NotebookEditOutput, 'sizeChange'> {
    if (!params.cell_type) {
      throw new MissingCellTypeError();
    }

    let insertIndex = 0; // Default to beginning

    if (params.cell_id) {
      const referenceIndex = notebook.cells.findIndex(cell => cell.id === params.cell_id);
      if (referenceIndex === -1) {
        throw new CellNotFoundError(params.cell_id, notebookPath);
      }
      insertIndex = referenceIndex + 1; // Insert after the reference cell
    }

    // Create new cell
    const newCell: JupyterCell = {
      cell_type: params.cell_type,
      id: crypto.randomUUID(),
      source: this.normalizeSource(params.new_source),
      metadata: {},
    };

    // Add type-specific properties
    if (params.cell_type === 'code') {
      newCell.execution_count = null;
      newCell.outputs = [];
    }

    // Insert the cell
    notebook.cells.splice(insertIndex, 0, newCell);

    return {
      notebookPath,
      cellId: newCell.id!,
      cellIndex: insertIndex,
      cellType: params.cell_type,
      editMode: 'insert',
      totalCells: notebook.cells.length,
      contentPreview: this.createContentPreview(params.new_source),
    };
  }

  /**
   * Delete a cell
   */
  private deleteCell(
    notebook: JupyterNotebook,
    params: NotebookEditParams,
    notebookPath: string
  ): Omit<NotebookEditOutput, 'sizeChange'> {
    if (!params.cell_id) {
      throw new Error('cell_id is required for delete operation');
    }

    const targetIndex = notebook.cells.findIndex(cell => cell.id === params.cell_id);
    if (targetIndex === -1) {
      throw new CellNotFoundError(params.cell_id, notebookPath);
    }

    const cell = notebook.cells[targetIndex];
    const cellType = cell.cell_type as NotebookCellType;
    const sourcePreview = this.createContentPreview(
      Array.isArray(cell.source) ? cell.source.join('') : cell.source
    );

    // Remove the cell
    notebook.cells.splice(targetIndex, 1);

    return {
      notebookPath,
      cellId: params.cell_id,
      cellIndex: targetIndex,
      cellType,
      editMode: 'delete',
      totalCells: notebook.cells.length,
      contentPreview: sourcePreview,
    };
  }

  /**
   * Normalize source content to array format for consistency
   */
  private normalizeSource(source: string): string[] {
    // Split by lines but preserve line endings
    const lines = source.split('\n');

    // Add line endings to all but the last line
    for (let i = 0; i < lines.length - 1; i++) {
      lines[i] += '\n';
    }

    return lines;
  }

  /**
   * Create a content preview (first 3 lines, max 200 chars)
   */
  private createContentPreview(source: string): string {
    const lines = source.split('\n').slice(0, 3);
    const preview = lines.join('\n');

    if (preview.length > 200) {
      return preview.substring(0, 197) + '...';
    }

    if (source.split('\n').length > 3) {
      return preview + '\n...';
    }

    return preview;
  }
}