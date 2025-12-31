/**
 * @fileoverview Acceptance tests for NotebookEditTool
 *
 * These tests validate that the NotebookEditTool meets all acceptance criteria
 * specified in the requirements. They verify that the tool implements cell
 * replacement, insertion, deletion, and cell type support while preserving
 * notebook structure and format.
 *
 * @module @apex/core/tools/filesystem/__tests__/notebook-edit-tool.acceptance
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  NotebookEditTool,
  type NotebookEditParams,
  type NotebookEditOutput,
  type NotebookEditMode,
  type NotebookCellType
} from '../notebook-edit-tool.js';

// ============================================================================
// Test Setup
// ============================================================================

describe('NotebookEditTool - Acceptance Tests', () => {
  let tool: NotebookEditTool;
  let testDir: string;

  beforeEach(async () => {
    tool = new NotebookEditTool();
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'notebook-acceptance-test-'));
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  // Helper to create comprehensive test notebooks
  const createAcceptanceTestNotebook = async (filename: string = 'acceptance-test.ipynb') => {
    const notebook = {
      cells: [
        {
          cell_type: 'markdown',
          id: 'header-cell',
          source: ['# Acceptance Test Notebook\n', '\n', 'This notebook is used for acceptance testing.'],
          metadata: { tags: ['header'], test_id: 'ac-001' }
        },
        {
          cell_type: 'code',
          id: 'import-cell',
          source: ['import pandas as pd\n', 'import numpy as np'],
          metadata: { tags: ['imports'], test_id: 'ac-002' },
          execution_count: null,
          outputs: []
        },
        {
          cell_type: 'markdown',
          id: 'section-header',
          source: ['## Data Analysis Section'],
          metadata: { tags: ['section'], test_id: 'ac-003' }
        },
        {
          cell_type: 'code',
          id: 'data-processing',
          source: ['# Process data\n', 'df = pd.DataFrame({"x": [1, 2, 3]})\n', 'print(df.head())'],
          metadata: { tags: ['processing'], test_id: 'ac-004' },
          execution_count: 1,
          outputs: [
            {
              output_type: 'stream',
              name: 'stdout',
              text: ['   x\n', '0  1\n', '1  2\n', '2  3\n']
            }
          ]
        },
        {
          cell_type: 'raw',
          id: 'raw-cell',
          source: ['Raw text content\n', 'This is unformatted text.'],
          metadata: { tags: ['raw'], test_id: 'ac-005' }
        }
      ],
      metadata: {
        kernelspec: {
          display_name: 'Python 3',
          language: 'python',
          name: 'python3'
        },
        language_info: {
          name: 'python',
          version: '3.11.0',
          mimetype: 'text/x-python'
        },
        acceptance_test: {
          version: '1.0',
          created_at: new Date().toISOString(),
          test_suite: 'notebook-edit-tool'
        }
      },
      nbformat: 4,
      nbformat_minor: 5
    };

    const notebookPath = path.join(testDir, filename);
    await fs.writeFile(notebookPath, JSON.stringify(notebook, null, 2));
    return notebookPath;
  };

  // Helper to validate notebook format preservation
  const validateNotebookFormat = async (notebookPath: string, expectedCellCount: number) => {
    const content = await fs.readFile(notebookPath, 'utf-8');
    const notebook = JSON.parse(content);

    // Validate top-level structure
    expect(notebook.nbformat).toBe(4);
    expect(typeof notebook.nbformat_minor).toBe('number');
    expect(Array.isArray(notebook.cells)).toBe(true);
    expect(typeof notebook.metadata).toBe('object');
    expect(notebook.cells).toHaveLength(expectedCellCount);

    // Validate cell structure
    notebook.cells.forEach((cell: any, index: number) => {
      expect(cell.cell_type).toMatch(/^(code|markdown|raw)$/);
      expect(typeof cell.id).toBe('string');
      expect(cell.id.length).toBeGreaterThan(0);
      expect(Array.isArray(cell.source)).toBe(true);
      expect(typeof cell.metadata).toBe('object');

      // Validate type-specific properties
      if (cell.cell_type === 'code') {
        expect(cell.execution_count === null || typeof cell.execution_count === 'number').toBe(true);
        expect(Array.isArray(cell.outputs)).toBe(true);
      }
    });

    // Validate unique cell IDs
    const cellIds = notebook.cells.map((c: any) => c.id);
    const uniqueIds = new Set(cellIds);
    expect(uniqueIds.size).toBe(cellIds.length);

    return notebook;
  };

  // ============================================================================
  // Acceptance Criteria: Cell Replacement
  // ============================================================================

  describe('Acceptance Criteria: Cell Replacement', () => {
    it('AC-001: Should replace cell content by cell ID', async () => {
      const notebookPath = await createAcceptanceTestNotebook();

      const result = await tool.execute({
        notebook_path: notebookPath,
        cell_id: 'import-cell',
        new_source: 'import matplotlib.pyplot as plt\nimport seaborn as sns',
        edit_mode: 'replace'
      });

      expect(result.success).toBe(true);
      const output = result.output as NotebookEditOutput;
      expect(output.cellId).toBe('import-cell');
      expect(output.editMode).toBe('replace');
      expect(output.cellType).toBe('code');

      // Verify replacement in notebook
      const notebook = await validateNotebookFormat(notebookPath, 5);
      const replacedCell = notebook.cells.find((c: any) => c.id === 'import-cell');
      expect(replacedCell.source.join('')).toContain('matplotlib.pyplot');
      expect(replacedCell.source.join('')).toContain('seaborn');
    });

    it('AC-002: Should replace cell content and change cell type', async () => {
      const notebookPath = await createAcceptanceTestNotebook();

      const result = await tool.execute({
        notebook_path: notebookPath,
        cell_id: 'data-processing',
        new_source: '## Data Processing Results\n\nThe analysis shows interesting patterns.',
        cell_type: 'markdown',
        edit_mode: 'replace'
      });

      expect(result.success).toBe(true);
      const output = result.output as NotebookEditOutput;
      expect(output.cellType).toBe('markdown');

      // Verify type change and property cleanup
      const notebook = await validateNotebookFormat(notebookPath, 5);
      const convertedCell = notebook.cells.find((c: any) => c.id === 'data-processing');
      expect(convertedCell.cell_type).toBe('markdown');
      expect(convertedCell.execution_count).toBeUndefined();
      expect(convertedCell.outputs).toBeUndefined();
      expect(convertedCell.source.join('')).toContain('Data Processing Results');
    });

    it('AC-003: Should preserve cell metadata during replacement', async () => {
      const notebookPath = await createAcceptanceTestNotebook();

      const result = await tool.execute({
        notebook_path: notebookPath,
        cell_id: 'section-header',
        new_source: '## Updated Section Header\n\nThis section has been updated.',
        edit_mode: 'replace'
      });

      expect(result.success).toBe(true);

      // Verify metadata preservation
      const notebook = await validateNotebookFormat(notebookPath, 5);
      const updatedCell = notebook.cells.find((c: any) => c.id === 'section-header');
      expect(updatedCell.metadata.tags).toEqual(['section']);
      expect(updatedCell.metadata.test_id).toBe('ac-003');
    });

    it('AC-004: Should handle code cell to raw cell conversion', async () => {
      const notebookPath = await createAcceptanceTestNotebook();

      const result = await tool.execute({
        notebook_path: notebookPath,
        cell_id: 'import-cell',
        new_source: 'This is now raw text\nNo code highlighting',
        cell_type: 'raw',
        edit_mode: 'replace'
      });

      expect(result.success).toBe(true);

      const notebook = await validateNotebookFormat(notebookPath, 5);
      const convertedCell = notebook.cells.find((c: any) => c.id === 'import-cell');
      expect(convertedCell.cell_type).toBe('raw');
      expect(convertedCell.execution_count).toBeUndefined();
      expect(convertedCell.outputs).toBeUndefined();
    });
  });

  // ============================================================================
  // Acceptance Criteria: Cell Insertion
  // ============================================================================

  describe('Acceptance Criteria: Cell Insertion', () => {
    it('AC-005: Should insert cell at beginning when no cell_id specified', async () => {
      const notebookPath = await createAcceptanceTestNotebook();

      const result = await tool.execute({
        notebook_path: notebookPath,
        new_source: '# New First Cell\n\nThis cell was inserted at the beginning.',
        cell_type: 'markdown',
        edit_mode: 'insert'
      });

      expect(result.success).toBe(true);
      const output = result.output as NotebookEditOutput;
      expect(output.cellIndex).toBe(0);
      expect(output.cellType).toBe('markdown');
      expect(output.editMode).toBe('insert');
      expect(output.totalCells).toBe(6);

      // Verify insertion at beginning
      const notebook = await validateNotebookFormat(notebookPath, 6);
      expect(notebook.cells[0].source.join('')).toContain('New First Cell');
      expect(notebook.cells[1].id).toBe('header-cell'); // Original first cell shifted
    });

    it('AC-006: Should insert cell after specified cell_id', async () => {
      const notebookPath = await createAcceptanceTestNotebook();

      const result = await tool.execute({
        notebook_path: notebookPath,
        cell_id: 'import-cell',
        new_source: '# Configuration\nplt.rcParams["figure.figsize"] = (10, 6)',
        cell_type: 'code',
        edit_mode: 'insert'
      });

      expect(result.success).toBe(true);
      const output = result.output as NotebookEditOutput;
      expect(output.cellIndex).toBe(2); // After import-cell (index 1)
      expect(output.cellType).toBe('code');

      // Verify insertion position
      const notebook = await validateNotebookFormat(notebookPath, 6);
      const insertedCell = notebook.cells[2];
      expect(insertedCell.source.join('')).toContain('Configuration');
      expect(insertedCell.cell_type).toBe('code');
      expect(insertedCell.execution_count).toBe(null);
      expect(Array.isArray(insertedCell.outputs)).toBe(true);
    });

    it('AC-007: Should support all cell types during insertion', async () => {
      const notebookPath = await createAcceptanceTestNotebook();
      const cellTypes: NotebookCellType[] = ['code', 'markdown', 'raw'];
      const insertResults: NotebookEditOutput[] = [];

      for (const cellType of cellTypes) {
        const result = await tool.execute({
          notebook_path: notebookPath,
          cell_id: 'header-cell',
          new_source: `Test ${cellType} cell content`,
          cell_type: cellType,
          edit_mode: 'insert'
        });

        expect(result.success).toBe(true);
        insertResults.push(result.output as NotebookEditOutput);
      }

      // Verify all cell types were inserted correctly
      const notebook = await validateNotebookFormat(notebookPath, 8); // 5 original + 3 inserted
      const insertedCells = notebook.cells.slice(1, 4); // Inserted after header-cell

      insertedCells.forEach((cell: any, index: number) => {
        expect(cell.cell_type).toBe(cellTypes[index]);
        if (cell.cell_type === 'code') {
          expect(cell.execution_count).toBe(null);
          expect(Array.isArray(cell.outputs)).toBe(true);
        } else {
          expect(cell.execution_count).toBeUndefined();
          expect(cell.outputs).toBeUndefined();
        }
      });
    });

    it('AC-008: Should generate unique IDs for inserted cells', async () => {
      const notebookPath = await createAcceptanceTestNotebook();

      // Insert multiple cells
      const insertPromises = Array.from({ length: 5 }, (_, i) =>
        tool.execute({
          notebook_path: notebookPath,
          new_source: `# Inserted cell ${i}`,
          cell_type: 'markdown',
          edit_mode: 'insert'
        })
      );

      const results = await Promise.all(insertPromises);
      results.forEach(result => expect(result.success).toBe(true));

      // Verify unique IDs
      const notebook = await validateNotebookFormat(notebookPath, 10);
      const allIds = notebook.cells.map((c: any) => c.id);
      const uniqueIds = new Set(allIds);
      expect(uniqueIds.size).toBe(allIds.length);
    });
  });

  // ============================================================================
  // Acceptance Criteria: Cell Deletion
  // ============================================================================

  describe('Acceptance Criteria: Cell Deletion', () => {
    it('AC-009: Should delete cell by cell_id', async () => {
      const notebookPath = await createAcceptanceTestNotebook();

      const result = await tool.execute({
        notebook_path: notebookPath,
        cell_id: 'raw-cell',
        new_source: '', // Ignored for delete
        edit_mode: 'delete'
      });

      expect(result.success).toBe(true);
      const output = result.output as NotebookEditOutput;
      expect(output.cellId).toBe('raw-cell');
      expect(output.editMode).toBe('delete');
      expect(output.cellType).toBe('raw');
      expect(output.totalCells).toBe(4);

      // Verify deletion
      const notebook = await validateNotebookFormat(notebookPath, 4);
      const deletedCell = notebook.cells.find((c: any) => c.id === 'raw-cell');
      expect(deletedCell).toBeUndefined();
    });

    it('AC-010: Should return content preview of deleted cell', async () => {
      const notebookPath = await createAcceptanceTestNotebook();

      const result = await tool.execute({
        notebook_path: notebookPath,
        cell_id: 'data-processing',
        new_source: '',
        edit_mode: 'delete'
      });

      expect(result.success).toBe(true);
      const output = result.output as NotebookEditOutput;
      expect(output.contentPreview).toContain('Process data');
    });

    it('AC-011: Should maintain cell order after deletion', async () => {
      const notebookPath = await createAcceptanceTestNotebook();

      // Record original order (excluding the cell to be deleted)
      const originalNotebook = JSON.parse(await fs.readFile(notebookPath, 'utf-8'));
      const expectedOrder = originalNotebook.cells
        .filter((c: any) => c.id !== 'section-header')
        .map((c: any) => c.id);

      const result = await tool.execute({
        notebook_path: notebookPath,
        cell_id: 'section-header',
        new_source: '',
        edit_mode: 'delete'
      });

      expect(result.success).toBe(true);

      // Verify order preservation
      const notebook = await validateNotebookFormat(notebookPath, 4);
      const finalOrder = notebook.cells.map((c: any) => c.id);
      expect(finalOrder).toEqual(expectedOrder);
    });

    it('AC-012: Should handle deletion of cells with outputs', async () => {
      const notebookPath = await createAcceptanceTestNotebook();

      const result = await tool.execute({
        notebook_path: notebookPath,
        cell_id: 'data-processing', // Has outputs
        new_source: '',
        edit_mode: 'delete'
      });

      expect(result.success).toBe(true);
      const output = result.output as NotebookEditOutput;
      expect(output.cellType).toBe('code');

      // Verify complete removal including outputs
      const notebook = await validateNotebookFormat(notebookPath, 4);
      const deletedCell = notebook.cells.find((c: any) => c.id === 'data-processing');
      expect(deletedCell).toBeUndefined();
    });
  });

  // ============================================================================
  // Acceptance Criteria: Format Preservation
  // ============================================================================

  describe('Acceptance Criteria: Format Preservation', () => {
    it('AC-013: Should preserve notebook metadata', async () => {
      const notebookPath = await createAcceptanceTestNotebook();

      // Perform various operations
      await tool.execute({
        notebook_path: notebookPath,
        cell_id: 'import-cell',
        new_source: 'import updated_package',
        edit_mode: 'replace'
      });

      await tool.execute({
        notebook_path: notebookPath,
        new_source: '# New cell',
        cell_type: 'markdown',
        edit_mode: 'insert'
      });

      await tool.execute({
        notebook_path: notebookPath,
        cell_id: 'raw-cell',
        new_source: '',
        edit_mode: 'delete'
      });

      // Verify metadata preservation
      const notebook = await validateNotebookFormat(notebookPath, 5);
      expect(notebook.metadata.kernelspec.name).toBe('python3');
      expect(notebook.metadata.language_info.name).toBe('python');
      expect(notebook.metadata.acceptance_test.test_suite).toBe('notebook-edit-tool');
    });

    it('AC-014: Should preserve cell metadata during operations', async () => {
      const notebookPath = await createAcceptanceTestNotebook();

      const result = await tool.execute({
        notebook_path: notebookPath,
        cell_id: 'header-cell',
        new_source: '# Updated Header\n\nThis header has been updated.',
        edit_mode: 'replace'
      });

      expect(result.success).toBe(true);

      // Verify metadata preservation
      const notebook = await validateNotebookFormat(notebookPath, 5);
      const headerCell = notebook.cells.find((c: any) => c.id === 'header-cell');
      expect(headerCell.metadata.tags).toEqual(['header']);
      expect(headerCell.metadata.test_id).toBe('ac-001');
    });

    it('AC-015: Should preserve execution outputs when appropriate', async () => {
      const notebookPath = await createAcceptanceTestNotebook();

      // Replace code cell content but keep same type
      const result = await tool.execute({
        notebook_path: notebookPath,
        cell_id: 'data-processing',
        new_source: '# Updated data processing\ndf = pd.DataFrame({"y": [4, 5, 6]})\nprint("Updated output")',
        edit_mode: 'replace'
      });

      expect(result.success).toBe(true);

      // Verify outputs are preserved when cell type doesn't change
      const notebook = await validateNotebookFormat(notebookPath, 5);
      const processedCell = notebook.cells.find((c: any) => c.id === 'data-processing');
      expect(processedCell.execution_count).toBe(1);
      expect(Array.isArray(processedCell.outputs)).toBe(true);
      expect(processedCell.outputs.length).toBeGreaterThan(0);
    });

    it('AC-016: Should properly format source content', async () => {
      const notebookPath = await createAcceptanceTestNotebook();

      const multilineContent = 'line 1\nline 2\nline 3\nfinal line';

      const result = await tool.execute({
        notebook_path: notebookPath,
        cell_id: 'header-cell',
        new_source: multilineContent,
        edit_mode: 'replace'
      });

      expect(result.success).toBe(true);

      // Verify source formatting
      const notebook = await validateNotebookFormat(notebookPath, 5);
      const headerCell = notebook.cells.find((c: any) => c.id === 'header-cell');
      expect(Array.isArray(headerCell.source)).toBe(true);
      expect(headerCell.source).toHaveLength(4);
      expect(headerCell.source[0]).toBe('line 1\n');
      expect(headerCell.source[1]).toBe('line 2\n');
      expect(headerCell.source[2]).toBe('line 3\n');
      expect(headerCell.source[3]).toBe('final line');
    });
  });

  // ============================================================================
  // Acceptance Criteria: Error Handling
  // ============================================================================

  describe('Acceptance Criteria: Error Handling', () => {
    it('AC-017: Should handle non-existent cell IDs gracefully', async () => {
      const notebookPath = await createAcceptanceTestNotebook();

      const result = await tool.execute({
        notebook_path: notebookPath,
        cell_id: 'non-existent-cell',
        new_source: 'This should fail',
        edit_mode: 'replace'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Cell with ID "non-existent-cell" not found');

      // Verify notebook remains unchanged
      await validateNotebookFormat(notebookPath, 5);
    });

    it('AC-018: Should validate required parameters', async () => {
      const notebookPath = await createAcceptanceTestNotebook();

      // Test missing cell_type for insert
      const result1 = await tool.execute({
        notebook_path: notebookPath,
        new_source: 'This should fail',
        edit_mode: 'insert'
        // Missing cell_type
      });

      expect(result1.success).toBe(false);
      expect(result1.error).toContain('cell_type is required');

      // Test missing cell_id for delete
      const result2 = await tool.execute({
        notebook_path: notebookPath,
        new_source: '',
        edit_mode: 'delete'
        // Missing cell_id
      });

      expect(result2.success).toBe(false);
      expect(result2.error).toContain('cell_id is required');
    });

    it('AC-019: Should handle invalid notebook files gracefully', async () => {
      const invalidPath = path.join(testDir, 'invalid.ipynb');
      await fs.writeFile(invalidPath, 'invalid json content');

      const result = await tool.execute({
        notebook_path: invalidPath,
        new_source: 'test',
        edit_mode: 'replace'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid notebook format');
    });

    it('AC-020: Should provide meaningful error messages', async () => {
      const notebookPath = await createAcceptanceTestNotebook();

      // Test various error scenarios
      const errorTests = [
        {
          params: {
            notebook_path: '/non/existent/path.ipynb',
            new_source: 'test',
            edit_mode: 'replace' as NotebookEditMode
          },
          expectedError: 'Cannot read notebook'
        },
        {
          params: {
            notebook_path: notebookPath,
            cell_id: 'missing-cell',
            new_source: 'test',
            edit_mode: 'replace' as NotebookEditMode
          },
          expectedError: 'Cell with ID "missing-cell" not found'
        }
      ];

      for (const test of errorTests) {
        const result = await tool.execute(test.params);
        expect(result.success).toBe(false);
        expect(result.error).toContain(test.expectedError);
      }
    });
  });

  // ============================================================================
  // Acceptance Criteria: Comprehensive Integration
  // ============================================================================

  describe('Acceptance Criteria: Comprehensive Integration', () => {
    it('AC-021: Should handle complex multi-operation workflow', async () => {
      const notebookPath = await createAcceptanceTestNotebook();

      // Step 1: Add configuration cell at beginning
      const step1 = await tool.execute({
        notebook_path: notebookPath,
        new_source: '# Configuration\nimport warnings\nwarnings.filterwarnings("ignore")',
        cell_type: 'code',
        edit_mode: 'insert'
      });
      expect(step1.success).toBe(true);

      // Step 2: Update import cell with additional imports
      const step2 = await tool.execute({
        notebook_path: notebookPath,
        cell_id: 'import-cell',
        new_source: 'import pandas as pd\nimport numpy as np\nimport matplotlib.pyplot as plt\nimport seaborn as sns',
        edit_mode: 'replace'
      });
      expect(step2.success).toBe(true);

      // Step 3: Convert raw cell to markdown
      const step3 = await tool.execute({
        notebook_path: notebookPath,
        cell_id: 'raw-cell',
        new_source: '## Additional Notes\n\nThese are formatted notes.',
        cell_type: 'markdown',
        edit_mode: 'replace'
      });
      expect(step3.success).toBe(true);

      // Step 4: Add conclusion cell after data processing
      const step4 = await tool.execute({
        notebook_path: notebookPath,
        cell_id: 'data-processing',
        new_source: '# Conclusion\nprint("Analysis complete!")',
        cell_type: 'code',
        edit_mode: 'insert'
      });
      expect(step4.success).toBe(true);

      // Step 5: Delete section header (no longer needed)
      const step5 = await tool.execute({
        notebook_path: notebookPath,
        cell_id: 'section-header',
        new_source: '',
        edit_mode: 'delete'
      });
      expect(step5.success).toBe(true);

      // Verify final state
      const notebook = await validateNotebookFormat(notebookPath, 6); // 5 original - 1 deleted + 2 inserted

      // Verify structure
      expect(notebook.cells[0].source.join('')).toContain('Configuration');
      expect(notebook.cells[1].source.join('')).toContain('Acceptance Test Notebook');
      expect(notebook.cells[2].source.join('')).toContain('seaborn');
      expect(notebook.cells[3].source.join('')).toContain('Process data');
      expect(notebook.cells[4].source.join('')).toContain('Analysis complete');
      expect(notebook.cells[5].source.join('')).toContain('Additional Notes');

      // Verify metadata preservation
      expect(notebook.metadata.acceptance_test).toBeDefined();
    });

    it('AC-022: Should maintain performance with realistic notebook sizes', async () => {
      // Create larger notebook for performance testing
      const largeCells = Array.from({ length: 100 }, (_, i) => ({
        cell_type: i % 2 === 0 ? 'code' : 'markdown',
        id: `perf-cell-${i}`,
        source: [`# Cell ${i}\nprint("Performance test cell ${i}")`],
        metadata: { index: i },
        ...(i % 2 === 0 ? { execution_count: null, outputs: [] } : {})
      }));

      const largeNotebook = {
        cells: largeCells,
        metadata: { kernelspec: { name: 'python3' } },
        nbformat: 4,
        nbformat_minor: 4
      };

      const largePath = path.join(testDir, 'large-performance.ipynb');
      await fs.writeFile(largePath, JSON.stringify(largeNotebook, null, 2));

      const startTime = performance.now();

      // Perform multiple operations
      const operations = [
        tool.execute({
          notebook_path: largePath,
          cell_id: 'perf-cell-25',
          new_source: 'print("Updated performance test")',
          edit_mode: 'replace'
        }),
        tool.execute({
          notebook_path: largePath,
          cell_id: 'perf-cell-50',
          new_source: '# New section\nAdded via performance test',
          cell_type: 'markdown',
          edit_mode: 'insert'
        }),
        tool.execute({
          notebook_path: largePath,
          cell_id: 'perf-cell-75',
          new_source: '',
          edit_mode: 'delete'
        })
      ];

      const results = await Promise.all(operations);
      const duration = performance.now() - startTime;

      // All operations should succeed
      results.forEach(result => expect(result.success).toBe(true));

      // Should complete in reasonable time
      expect(duration).toBeLessThan(2000); // Less than 2 seconds

      console.log(`Performance test with 100-cell notebook: ${duration.toFixed(2)}ms`);
    });

    it('AC-023: Should provide comprehensive output information', async () => {
      const notebookPath = await createAcceptanceTestNotebook();

      const result = await tool.execute({
        notebook_path: notebookPath,
        cell_id: 'import-cell',
        new_source: 'import pandas as pd\nimport numpy as np\nimport matplotlib.pyplot as plt',
        edit_mode: 'replace'
      });

      expect(result.success).toBe(true);
      const output = result.output as NotebookEditOutput;

      // Verify all required output fields
      expect(output.notebookPath).toBe(notebookPath);
      expect(output.cellId).toBe('import-cell');
      expect(typeof output.cellIndex).toBe('number');
      expect(output.cellType).toBe('code');
      expect(output.editMode).toBe('replace');
      expect(typeof output.totalCells).toBe('number');
      expect(typeof output.sizeChange).toBe('object');
      expect(typeof output.sizeChange.before).toBe('number');
      expect(typeof output.sizeChange.after).toBe('number');
      expect(typeof output.contentPreview).toBe('string');

      // Verify content preview is meaningful
      expect(output.contentPreview).toContain('import pandas');
      expect(output.contentPreview.length).toBeLessThanOrEqual(210);
    });
  });
});