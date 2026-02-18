/**
 * @fileoverview Tests for NotebookEditTool
 *
 * Comprehensive test suite covering all aspects of the NotebookEditTool:
 * - Tool definition and metadata
 * - Parameter validation
 * - Cell operations (replace, insert, delete)
 * - Format preservation
 * - Error handling
 * - Edge cases
 *
 * @module @apex/core/tools/filesystem/__tests__/notebook-edit-tool
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  NotebookEditTool,
  type NotebookEditParams,
  type NotebookEditOutput,
  CellNotFoundError,
  InvalidNotebookError,
  MissingCellTypeError,
  NotebookAccessError,
} from '../notebook-edit-tool.js';

// ============================================================================
// Test Setup
// ============================================================================

describe('NotebookEditTool', () => {
  let tool: NotebookEditTool;
  let tempDir: string;

  // Sample notebook content for testing
  const createSampleNotebook = (cells?: any[]) => ({
    cells: cells || [
      {
        cell_type: 'code',
        id: 'cell-1',
        source: ['print("Hello, World!")\\n'],
        metadata: {},
        execution_count: null,
        outputs: []
      },
      {
        cell_type: 'markdown',
        id: 'cell-2',
        source: ['# Title\\n', '\\n', 'Some markdown content.'],
        metadata: {}
      }
    ],
    metadata: {
      kernelspec: {
        display_name: 'Python 3',
        language: 'python',
        name: 'python3'
      }
    },
    nbformat: 4,
    nbformat_minor: 4
  });

  beforeEach(async () => {
    tool = new NotebookEditTool();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'notebook-edit-test-'));
  });

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  // Helper function to create a test notebook file
  const createNotebookFile = async (filename: string, content?: any): Promise<string> => {
    const notebookPath = path.join(tempDir, filename);
    const notebookContent = content || createSampleNotebook();
    await fs.writeFile(notebookPath, JSON.stringify(notebookContent, null, 2));
    return notebookPath;
  };

  // ============================================================================
  // Tool Definition Tests
  // ============================================================================

  describe('Tool Definition', () => {
    it('should have correct tool metadata', () => {
      const definition = tool.getDefinition();

      expect(definition.name).toBe('NotebookEdit');
      expect(definition.description).toContain('Jupyter notebook');
      expect(definition.category).toBe('filesystem');
      expect(definition.permissions).toEqual(['read', 'write']);
      expect(definition.dangerous).toBe(false);
      expect(definition.version).toBe('1.0.0');
      expect(definition.enabled).toBe(true);
      expect(definition.tags).toContain('notebook');
      expect(definition.tags).toContain('jupyter');
    });

    it('should have valid parameter schema', () => {
      const definition = tool.getDefinition();
      const schema = definition.parameters;

      expect(schema.type).toBe('object');
      expect(schema.required).toEqual(['notebook_path', 'new_source']);
      expect(schema.additionalProperties).toBe(false);

      // Check individual properties
      expect(schema.properties?.notebook_path).toMatchObject({
        type: 'string',
        minLength: 1
      });

      expect(schema.properties?.new_source).toMatchObject({
        type: 'string'
      });

      expect(schema.properties?.cell_id).toMatchObject({
        type: 'string'
      });

      expect(schema.properties?.cell_type).toMatchObject({
        type: 'string',
        enum: ['code', 'markdown', 'raw']
      });

      expect(schema.properties?.edit_mode).toMatchObject({
        type: 'string',
        enum: ['replace', 'insert', 'delete'],
        default: 'replace'
      });
    });

    it('should have usage examples', () => {
      const definition = tool.getDefinition();

      expect(definition.examples).toBeDefined();
      expect(definition.examples!.length).toBeGreaterThan(0);

      // Check that examples cover main use cases
      const exampleModes = definition.examples!.map(ex =>
        (ex.input as any).edit_mode || 'replace'
      );
      expect(exampleModes).toContain('replace');
      expect(exampleModes).toContain('insert');
      expect(exampleModes).toContain('delete');
    });
  });

  // ============================================================================
  // Parameter Validation Tests
  // ============================================================================

  describe('Parameter Validation', () => {
    describe('Valid Parameters', () => {
      it('should accept valid replace parameters', () => {
        const params: NotebookEditParams = {
          notebook_path: '/test/notebook.ipynb',
          new_source: 'print("test")',
          cell_id: 'cell-123',
          edit_mode: 'replace'
        };

        const result = tool.validate(params);
        expect(result.valid).toBe(true);
        expect(result.errors).toBeUndefined();
      });

      it('should accept valid insert parameters', () => {
        const params: NotebookEditParams = {
          notebook_path: '/test/notebook.ipynb',
          new_source: '# New section',
          cell_type: 'markdown',
          edit_mode: 'insert'
        };

        const result = tool.validate(params);
        expect(result.valid).toBe(true);
        expect(result.errors).toBeUndefined();
      });

      it('should accept valid delete parameters', () => {
        const params: NotebookEditParams = {
          notebook_path: '/test/notebook.ipynb',
          new_source: '', // ignored for delete
          cell_id: 'cell-123',
          edit_mode: 'delete'
        };

        const result = tool.validate(params);
        expect(result.valid).toBe(true);
        expect(result.errors).toBeUndefined();
      });

      it('should default edit_mode to replace', () => {
        const params: NotebookEditParams = {
          notebook_path: '/test/notebook.ipynb',
          new_source: 'print("test")',
          cell_id: 'cell-123'
          // edit_mode not specified
        };

        const result = tool.validate(params);
        expect(result.valid).toBe(true);
      });
    });

    describe('Invalid Parameters', () => {
      it('should reject empty notebook_path', () => {
        const params: NotebookEditParams = {
          notebook_path: '',
          new_source: 'print("test")',
          edit_mode: 'replace'
        };

        const result = tool.validate(params);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('notebook_path cannot be empty');
      });

      it('should reject path traversal attempts', () => {
        const params: NotebookEditParams = {
          notebook_path: '/test/../../../etc/passwd',
          new_source: 'malicious content',
          edit_mode: 'replace'
        };

        const result = tool.validate(params);
        expect(result.valid).toBe(false);
        expect(result.errors?.[0]).toContain('path traversal');
      });

      it('should reject sensitive system paths', () => {
        const params: NotebookEditParams = {
          notebook_path: '/etc/notebook.ipynb',
          new_source: 'print("test")',
          edit_mode: 'replace'
        };

        const result = tool.validate(params);
        expect(result.valid).toBe(false);
        expect(result.errors?.[0]).toContain('sensitive system path');
      });

      it('should require cell_type for insert mode', () => {
        const params: NotebookEditParams = {
          notebook_path: '/test/notebook.ipynb',
          new_source: 'print("test")',
          edit_mode: 'insert'
          // cell_type missing
        };

        const result = tool.validate(params);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('cell_type is required when edit_mode is "insert"');
      });

      it('should reject invalid edit_mode', () => {
        const params: NotebookEditParams = {
          notebook_path: '/test/notebook.ipynb',
          new_source: 'print("test")',
          edit_mode: 'invalid' as any
        };

        const result = tool.validate(params);
        expect(result.valid).toBe(false);
        expect(result.errors?.[0]).toContain('Invalid edit_mode');
      });

      it('should warn about non-.ipynb extension', () => {
        const params: NotebookEditParams = {
          notebook_path: '/test/notebook.json',
          new_source: 'print("test")',
          edit_mode: 'replace'
        };

        const result = tool.validate(params);
        expect(result.valid).toBe(true);
        expect(result.warnings).toContain('File does not have .ipynb extension');
      });
    });
  });

  // ============================================================================
  // Cell Operations Tests
  // ============================================================================

  describe('Replace Operations', () => {
    it('should replace cell content by ID', async () => {
      const notebookPath = await createNotebookFile('test.ipynb');
      const params: NotebookEditParams = {
        notebook_path: notebookPath,
        cell_id: 'cell-1',
        new_source: 'print("Updated content")',
        edit_mode: 'replace'
      };

      const result = await tool.execute(params);

      expect(result.success).toBe(true);
      const output = result.output as NotebookEditOutput;
      expect(output.cellId).toBe('cell-1');
      expect(output.cellIndex).toBe(0);
      expect(output.cellType).toBe('code');
      expect(output.editMode).toBe('replace');
      expect(output.totalCells).toBe(2);
      expect(output.contentPreview).toContain('Updated content');

      // Verify file was actually updated
      const updatedContent = await fs.readFile(notebookPath, 'utf-8');
      const updatedNotebook = JSON.parse(updatedContent);
      expect(updatedNotebook.cells[0].source).toEqual(['print("Updated content")']);
    });

    it('should replace cell content and change type', async () => {
      const notebookPath = await createNotebookFile('test.ipynb');
      const params: NotebookEditParams = {
        notebook_path: notebookPath,
        cell_id: 'cell-1',
        new_source: '# Now a markdown cell',
        cell_type: 'markdown',
        edit_mode: 'replace'
      };

      const result = await tool.execute(params);

      expect(result.success).toBe(true);
      const output = result.output as NotebookEditOutput;
      expect(output.cellType).toBe('markdown');

      // Verify type change and property removal
      const updatedContent = await fs.readFile(notebookPath, 'utf-8');
      const updatedNotebook = JSON.parse(updatedContent);
      const cell = updatedNotebook.cells[0];
      expect(cell.cell_type).toBe('markdown');
      expect(cell.execution_count).toBeUndefined();
      expect(cell.outputs).toBeUndefined();
    });

    it('should replace in single-cell notebook without cell_id', async () => {
      const singleCellNotebook = createSampleNotebook([
        {
          cell_type: 'code',
          id: 'only-cell',
          source: ['print("original")\\n'],
          metadata: {},
          execution_count: null,
          outputs: []
        }
      ]);
      const notebookPath = await createNotebookFile('single.ipynb', singleCellNotebook);

      const params: NotebookEditParams = {
        notebook_path: notebookPath,
        new_source: 'print("updated")',
        edit_mode: 'replace'
      };

      const result = await tool.execute(params);

      expect(result.success).toBe(true);
      const output = result.output as NotebookEditOutput;
      expect(output.cellId).toBe('only-cell');
      expect(output.cellIndex).toBe(0);
    });

    it('should fail to replace without cell_id in multi-cell notebook', async () => {
      const notebookPath = await createNotebookFile('test.ipynb');
      const params: NotebookEditParams = {
        notebook_path: notebookPath,
        new_source: 'print("updated")',
        edit_mode: 'replace'
        // cell_id missing
      };

      const result = await tool.execute(params);

      expect(result.success).toBe(false);
      expect(result.error).toContain('cell_id is required for replace operation in multi-cell notebook');
    });

    it('should fail when cell_id not found', async () => {
      const notebookPath = await createNotebookFile('test.ipynb');
      const params: NotebookEditParams = {
        notebook_path: notebookPath,
        cell_id: 'nonexistent-cell',
        new_source: 'print("test")',
        edit_mode: 'replace'
      };

      const result = await tool.execute(params);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Cell with ID "nonexistent-cell" not found');
    });
  });

  describe('Insert Operations', () => {
    it('should insert cell at beginning when no cell_id provided', async () => {
      const notebookPath = await createNotebookFile('test.ipynb');
      const params: NotebookEditParams = {
        notebook_path: notebookPath,
        new_source: 'import numpy as np',
        cell_type: 'code',
        edit_mode: 'insert'
      };

      const result = await tool.execute(params);

      expect(result.success).toBe(true);
      const output = result.output as NotebookEditOutput;
      expect(output.cellIndex).toBe(0);
      expect(output.cellType).toBe('code');
      expect(output.editMode).toBe('insert');
      expect(output.totalCells).toBe(3);

      // Verify cell was inserted at beginning
      const updatedContent = await fs.readFile(notebookPath, 'utf-8');
      const updatedNotebook = JSON.parse(updatedContent);
      expect(updatedNotebook.cells[0].source).toEqual(['import numpy as np']);
      expect(updatedNotebook.cells[0].cell_type).toBe('code');
      expect(updatedNotebook.cells[0].execution_count).toBe(null);
      expect(updatedNotebook.cells[0].outputs).toEqual([]);
    });

    it('should insert cell after specified cell_id', async () => {
      const notebookPath = await createNotebookFile('test.ipynb');
      const params: NotebookEditParams = {
        notebook_path: notebookPath,
        cell_id: 'cell-1',
        new_source: '## New Section\\n\\nThis is a new markdown cell.',
        cell_type: 'markdown',
        edit_mode: 'insert'
      };

      const result = await tool.execute(params);

      expect(result.success).toBe(true);
      const output = result.output as NotebookEditOutput;
      expect(output.cellIndex).toBe(1); // After cell-1 (index 0)
      expect(output.cellType).toBe('markdown');
      expect(output.totalCells).toBe(3);

      // Verify cell was inserted at correct position
      const updatedContent = await fs.readFile(notebookPath, 'utf-8');
      const updatedNotebook = JSON.parse(updatedContent);
      expect(updatedNotebook.cells[1].source).toEqual(['## New Section\\n', '\\n', 'This is a new markdown cell.']);
      expect(updatedNotebook.cells[1].cell_type).toBe('markdown');
      expect(updatedNotebook.cells[1].execution_count).toBeUndefined();
      expect(updatedNotebook.cells[1].outputs).toBeUndefined();
    });

    it('should insert raw cell', async () => {
      const notebookPath = await createNotebookFile('test.ipynb');
      const params: NotebookEditParams = {
        notebook_path: notebookPath,
        new_source: 'This is raw text content',
        cell_type: 'raw',
        edit_mode: 'insert'
      };

      const result = await tool.execute(params);

      expect(result.success).toBe(true);
      const output = result.output as NotebookEditOutput;
      expect(output.cellType).toBe('raw');

      // Verify raw cell properties
      const updatedContent = await fs.readFile(notebookPath, 'utf-8');
      const updatedNotebook = JSON.parse(updatedContent);
      const newCell = updatedNotebook.cells[0];
      expect(newCell.cell_type).toBe('raw');
      expect(newCell.execution_count).toBeUndefined();
      expect(newCell.outputs).toBeUndefined();
    });

    it('should fail insert without cell_type', async () => {
      const notebookPath = await createNotebookFile('test.ipynb');
      const params: NotebookEditParams = {
        notebook_path: notebookPath,
        new_source: 'print("test")',
        edit_mode: 'insert'
        // cell_type missing
      };

      const result = await tool.execute(params);

      expect(result.success).toBe(false);
      expect(result.error).toContain('cell_type is required when edit_mode is "insert"');
    });

    it('should fail insert when reference cell_id not found', async () => {
      const notebookPath = await createNotebookFile('test.ipynb');
      const params: NotebookEditParams = {
        notebook_path: notebookPath,
        cell_id: 'nonexistent-cell',
        new_source: 'print("test")',
        cell_type: 'code',
        edit_mode: 'insert'
      };

      const result = await tool.execute(params);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Cell with ID "nonexistent-cell" not found');
    });
  });

  describe('Delete Operations', () => {
    it('should delete cell by ID', async () => {
      const notebookPath = await createNotebookFile('test.ipynb');
      const params: NotebookEditParams = {
        notebook_path: notebookPath,
        cell_id: 'cell-2',
        new_source: '', // ignored for delete
        edit_mode: 'delete'
      };

      const result = await tool.execute(params);

      expect(result.success).toBe(true);
      const output = result.output as NotebookEditOutput;
      expect(output.cellId).toBe('cell-2');
      expect(output.cellIndex).toBe(1); // Original index of deleted cell
      expect(output.cellType).toBe('markdown');
      expect(output.editMode).toBe('delete');
      expect(output.totalCells).toBe(1); // One cell remaining

      // Verify cell was actually deleted
      const updatedContent = await fs.readFile(notebookPath, 'utf-8');
      const updatedNotebook = JSON.parse(updatedContent);
      expect(updatedNotebook.cells).toHaveLength(1);
      expect(updatedNotebook.cells[0].id).toBe('cell-1');
    });

    it('should fail delete without cell_id', async () => {
      const notebookPath = await createNotebookFile('test.ipynb');
      const params: NotebookEditParams = {
        notebook_path: notebookPath,
        new_source: '',
        edit_mode: 'delete'
        // cell_id missing
      };

      const result = await tool.execute(params);

      expect(result.success).toBe(false);
      expect(result.error).toContain('cell_id is required for delete operation');
    });

    it('should fail delete when cell_id not found', async () => {
      const notebookPath = await createNotebookFile('test.ipynb');
      const params: NotebookEditParams = {
        notebook_path: notebookPath,
        cell_id: 'nonexistent-cell',
        new_source: '',
        edit_mode: 'delete'
      };

      const result = await tool.execute(params);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Cell with ID "nonexistent-cell" not found');
    });
  });

  // ============================================================================
  // Format Preservation Tests
  // ============================================================================

  describe('Format Preservation', () => {
    it('should preserve notebook metadata', async () => {
      const originalNotebook = createSampleNotebook();
      originalNotebook.metadata.custom_field = 'test_value';
      const notebookPath = await createNotebookFile('test.ipynb', originalNotebook);

      const params: NotebookEditParams = {
        notebook_path: notebookPath,
        cell_id: 'cell-1',
        new_source: 'print("updated")',
        edit_mode: 'replace'
      };

      const result = await tool.execute(params);

      expect(result.success).toBe(true);

      // Verify metadata preservation
      const updatedContent = await fs.readFile(notebookPath, 'utf-8');
      const updatedNotebook = JSON.parse(updatedContent);
      expect(updatedNotebook.metadata.custom_field).toBe('test_value');
      expect(updatedNotebook.metadata.kernelspec).toEqual(originalNotebook.metadata.kernelspec);
    });

    it('should preserve cell metadata', async () => {
      const originalNotebook = createSampleNotebook();
      originalNotebook.cells[0].metadata = { custom: 'value', tags: ['test'] };
      const notebookPath = await createNotebookFile('test.ipynb', originalNotebook);

      const params: NotebookEditParams = {
        notebook_path: notebookPath,
        cell_id: 'cell-1',
        new_source: 'print("updated")',
        edit_mode: 'replace'
      };

      const result = await tool.execute(params);

      expect(result.success).toBe(true);

      // Verify cell metadata preservation
      const updatedContent = await fs.readFile(notebookPath, 'utf-8');
      const updatedNotebook = JSON.parse(updatedContent);
      expect(updatedNotebook.cells[0].metadata).toEqual({ custom: 'value', tags: ['test'] });
    });

    it('should preserve code cell outputs on replace', async () => {
      const originalNotebook = createSampleNotebook();
      originalNotebook.cells[0].outputs = [
        {
          output_type: 'stream',
          name: 'stdout',
          text: ['Hello, World!\\n']
        }
      ];
      originalNotebook.cells[0].execution_count = 1;
      const notebookPath = await createNotebookFile('test.ipynb', originalNotebook);

      const params: NotebookEditParams = {
        notebook_path: notebookPath,
        cell_id: 'cell-1',
        new_source: 'print("updated")',
        edit_mode: 'replace'
      };

      const result = await tool.execute(params);

      expect(result.success).toBe(true);

      // Verify outputs preservation on same cell type
      const updatedContent = await fs.readFile(notebookPath, 'utf-8');
      const updatedNotebook = JSON.parse(updatedContent);
      expect(updatedNotebook.cells[0].outputs).toEqual(originalNotebook.cells[0].outputs);
      expect(updatedNotebook.cells[0].execution_count).toBe(1);
    });

    it('should remove code cell properties when changing to markdown', async () => {
      const originalNotebook = createSampleNotebook();
      originalNotebook.cells[0].outputs = [{ output_type: 'stream' }];
      originalNotebook.cells[0].execution_count = 5;
      const notebookPath = await createNotebookFile('test.ipynb', originalNotebook);

      const params: NotebookEditParams = {
        notebook_path: notebookPath,
        cell_id: 'cell-1',
        new_source: '# Now markdown',
        cell_type: 'markdown',
        edit_mode: 'replace'
      };

      const result = await tool.execute(params);

      expect(result.success).toBe(true);

      // Verify code properties removed
      const updatedContent = await fs.readFile(notebookPath, 'utf-8');
      const updatedNotebook = JSON.parse(updatedContent);
      const cell = updatedNotebook.cells[0];
      expect(cell.cell_type).toBe('markdown');
      expect(cell.outputs).toBeUndefined();
      expect(cell.execution_count).toBeUndefined();
    });

    it('should add code cell properties when changing from markdown', async () => {
      const notebookPath = await createNotebookFile('test.ipynb');

      const params: NotebookEditParams = {
        notebook_path: notebookPath,
        cell_id: 'cell-2', // markdown cell
        new_source: 'print("now code")',
        cell_type: 'code',
        edit_mode: 'replace'
      };

      const result = await tool.execute(params);

      expect(result.success).toBe(true);

      // Verify code properties added
      const updatedContent = await fs.readFile(notebookPath, 'utf-8');
      const updatedNotebook = JSON.parse(updatedContent);
      const cell = updatedNotebook.cells[1];
      expect(cell.cell_type).toBe('code');
      expect(cell.outputs).toEqual([]);
      expect(cell.execution_count).toBe(null);
    });

    it('should generate cell IDs for cells missing them', async () => {
      const notebookWithoutIds = createSampleNotebook([
        {
          cell_type: 'code',
          // id missing
          source: ['print("no id")\\n'],
          metadata: {},
          execution_count: null,
          outputs: []
        }
      ]);
      const notebookPath = await createNotebookFile('test.ipynb', notebookWithoutIds);

      const params: NotebookEditParams = {
        notebook_path: notebookPath,
        new_source: 'import numpy',
        cell_type: 'code',
        edit_mode: 'insert'
      };

      const result = await tool.execute(params);

      expect(result.success).toBe(true);

      // Verify IDs were generated
      const updatedContent = await fs.readFile(notebookPath, 'utf-8');
      const updatedNotebook = JSON.parse(updatedContent);
      expect(updatedNotebook.cells).toHaveLength(2);
      updatedNotebook.cells.forEach((cell: any) => {
        expect(cell.id).toBeDefined();
        expect(typeof cell.id).toBe('string');
        expect(cell.id.length).toBeGreaterThan(0);
      });
    });

    it('should normalize source to array format', async () => {
      const notebookPath = await createNotebookFile('test.ipynb');

      const params: NotebookEditParams = {
        notebook_path: notebookPath,
        cell_id: 'cell-1',
        new_source: 'line 1\\nline 2\\nline 3',
        edit_mode: 'replace'
      };

      const result = await tool.execute(params);

      expect(result.success).toBe(true);

      // Verify source normalization
      const updatedContent = await fs.readFile(notebookPath, 'utf-8');
      const updatedNotebook = JSON.parse(updatedContent);
      expect(updatedNotebook.cells[0].source).toEqual([
        'line 1\\n',
        'line 2\\n',
        'line 3'
      ]);
    });
  });

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  describe('Error Handling', () => {
    it('should handle file not found', async () => {
      const params: NotebookEditParams = {
        notebook_path: path.join(tempDir, 'nonexistent.ipynb'),
        new_source: 'print("test")',
        edit_mode: 'replace'
      };

      const result = await tool.execute(params);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot read notebook');
    });

    it('should handle invalid JSON', async () => {
      const invalidPath = path.join(tempDir, 'invalid.ipynb');
      await fs.writeFile(invalidPath, 'invalid json content');

      const params: NotebookEditParams = {
        notebook_path: invalidPath,
        new_source: 'print("test")',
        edit_mode: 'replace'
      };

      const result = await tool.execute(params);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid notebook format');
    });

    it('should handle malformed notebook structure', async () => {
      const malformedNotebook = {
        // missing required fields
        cells: 'not an array',
        metadata: null
      };
      const malformedPath = await createNotebookFile('malformed.ipynb', malformedNotebook);

      const params: NotebookEditParams = {
        notebook_path: malformedPath,
        new_source: 'print("test")',
        edit_mode: 'replace'
      };

      const result = await tool.execute(params);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid notebook format');
    });

    it('should handle unsupported nbformat', async () => {
      const unsupportedNotebook = createSampleNotebook();
      unsupportedNotebook.nbformat = 2; // Unsupported version
      const unsupportedPath = await createNotebookFile('unsupported.ipynb', unsupportedNotebook);

      const params: NotebookEditParams = {
        notebook_path: unsupportedPath,
        new_source: 'print("test")',
        edit_mode: 'replace'
      };

      const result = await tool.execute(params);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported nbformat version');
    });

    it('should handle file size limit', async () => {
      // Create a very large notebook content (this test might be slow)
      const largeContent = 'x'.repeat(60 * 1024 * 1024); // 60MB
      const largePath = path.join(tempDir, 'large.ipynb');
      await fs.writeFile(largePath, largeContent);

      const params: NotebookEditParams = {
        notebook_path: largePath,
        new_source: 'print("test")',
        edit_mode: 'replace'
      };

      const result = await tool.execute(params);

      expect(result.success).toBe(false);
      expect(result.error).toContain('exceeds maximum');
    });

    it('should handle empty notebook', async () => {
      const emptyNotebook = createSampleNotebook([]);
      const emptyPath = await createNotebookFile('empty.ipynb', emptyNotebook);

      const params: NotebookEditParams = {
        notebook_path: emptyPath,
        new_source: 'print("test")',
        edit_mode: 'replace'
      };

      const result = await tool.execute(params);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot replace cell in empty notebook without cell_id');
    });

    it('should handle write permission errors', async () => {
      const notebookPath = await createNotebookFile('readonly.ipynb');

      // Make file read-only
      await fs.chmod(notebookPath, 0o444);

      const params: NotebookEditParams = {
        notebook_path: notebookPath,
        cell_id: 'cell-1',
        new_source: 'print("test")',
        edit_mode: 'replace'
      };

      const result = await tool.execute(params);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot write notebook');

      // Restore write permission for cleanup
      await fs.chmod(notebookPath, 0o644);
    });
  });

  // ============================================================================
  // Edge Cases Tests
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle single cell notebook operations', async () => {
      const singleCellNotebook = createSampleNotebook([
        {
          cell_type: 'markdown',
          id: 'only-cell',
          source: ['# Only cell'],
          metadata: {}
        }
      ]);
      const notebookPath = await createNotebookFile('single.ipynb', singleCellNotebook);

      // Test replace
      const replaceResult = await tool.execute({
        notebook_path: notebookPath,
        new_source: '# Updated cell',
        edit_mode: 'replace'
      });

      expect(replaceResult.success).toBe(true);

      // Test insert (should add to beginning)
      const insertResult = await tool.execute({
        notebook_path: notebookPath,
        new_source: 'print("new first cell")',
        cell_type: 'code',
        edit_mode: 'insert'
      });

      expect(insertResult.success).toBe(true);

      // Verify we now have 2 cells
      const updatedContent = await fs.readFile(notebookPath, 'utf-8');
      const updatedNotebook = JSON.parse(updatedContent);
      expect(updatedNotebook.cells).toHaveLength(2);
    });

    it('should handle very large cell content', async () => {
      const notebookPath = await createNotebookFile('test.ipynb');
      const largeContent = 'print("x")\\n'.repeat(10000);

      const params: NotebookEditParams = {
        notebook_path: notebookPath,
        cell_id: 'cell-1',
        new_source: largeContent,
        edit_mode: 'replace'
      };

      const result = await tool.execute(params);

      expect(result.success).toBe(true);
      const output = result.output as NotebookEditOutput;
      expect(output.contentPreview).toContain('...');
      expect(output.contentPreview.length).toBeLessThanOrEqual(210);
    });

    it('should handle unicode content', async () => {
      const notebookPath = await createNotebookFile('test.ipynb');
      const unicodeContent = '# 测试 🚀\\nprint("Hello 世界! 🎉")';

      const params: NotebookEditParams = {
        notebook_path: notebookPath,
        cell_id: 'cell-1',
        new_source: unicodeContent,
        edit_mode: 'replace'
      };

      const result = await tool.execute(params);

      expect(result.success).toBe(true);

      // Verify unicode preservation
      const updatedContent = await fs.readFile(notebookPath, 'utf-8');
      const updatedNotebook = JSON.parse(updatedContent);
      expect(updatedNotebook.cells[0].source.join('')).toBe(unicodeContent);
    });

    it('should handle empty source content', async () => {
      const notebookPath = await createNotebookFile('test.ipynb');

      const params: NotebookEditParams = {
        notebook_path: notebookPath,
        cell_id: 'cell-1',
        new_source: '',
        edit_mode: 'replace'
      };

      const result = await tool.execute(params);

      expect(result.success).toBe(true);

      // Verify empty content
      const updatedContent = await fs.readFile(notebookPath, 'utf-8');
      const updatedNotebook = JSON.parse(updatedContent);
      expect(updatedNotebook.cells[0].source).toEqual(['']);
    });

    it('should preserve execution timing and provide size change info', async () => {
      const notebookPath = await createNotebookFile('test.ipynb');

      const params: NotebookEditParams = {
        notebook_path: notebookPath,
        cell_id: 'cell-1',
        new_source: 'print("longer content than before")',
        edit_mode: 'replace'
      };

      const result = await tool.execute(params);

      expect(result.success).toBe(true);
      expect(result.duration).toBeTypeOf('number');
      expect(result.invokedAt).toBeInstanceOf(Date);
      expect(result.completedAt).toBeInstanceOf(Date);

      const output = result.output as NotebookEditOutput;
      expect(output.sizeChange).toBeDefined();
      expect(output.sizeChange.before).toBeTypeOf('number');
      expect(output.sizeChange.after).toBeTypeOf('number');
      expect(output.sizeChange.after).toBeGreaterThan(output.sizeChange.before);
    });
  });
});