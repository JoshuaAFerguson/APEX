/**
 * @fileoverview Edge case and stress tests for NotebookEditTool
 *
 * These tests verify that the NotebookEditTool handles edge cases,
 * boundary conditions, and stress scenarios gracefully. They test
 * the tool's robustness and error handling under extreme conditions.
 *
 * @module @apex/core/tools/filesystem/__tests__/notebook-edit-tool.edge-cases
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
  NotebookAccessError,
  MissingCellTypeError
} from '../notebook-edit-tool.js';

// ============================================================================
// Test Setup
// ============================================================================

describe('NotebookEditTool - Edge Cases and Stress Tests', () => {
  let tool: NotebookEditTool;
  let testDir: string;

  beforeEach(async () => {
    tool = new NotebookEditTool();
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'notebook-edge-test-'));
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  // Helper function to create notebook file
  const createNotebookFile = async (filename: string, content: any): Promise<string> => {
    const notebookPath = path.join(testDir, filename);
    await fs.writeFile(notebookPath, JSON.stringify(content, null, 2));
    return notebookPath;
  };

  // ============================================================================
  // Boundary Value Tests
  // ============================================================================

  describe('Boundary Value Tests', () => {
    it('should handle empty notebook (zero cells)', async () => {
      const emptyNotebook = {
        cells: [],
        metadata: { kernelspec: { name: 'python3' } },
        nbformat: 4,
        nbformat_minor: 4
      };
      const notebookPath = await createNotebookFile('empty.ipynb', emptyNotebook);

      // Insert into empty notebook
      const insertResult = await tool.execute({
        notebook_path: notebookPath,
        new_source: '# First cell ever',
        cell_type: 'markdown',
        edit_mode: 'insert'
      });

      expect(insertResult.success).toBe(true);
      const output = insertResult.output as NotebookEditOutput;
      expect(output.totalCells).toBe(1);
      expect(output.cellIndex).toBe(0);

      // Try to replace without cell_id in empty notebook
      const replaceResult = await tool.execute({
        notebook_path: notebookPath,
        new_source: 'print("Should fail")',
        edit_mode: 'replace'
      });

      expect(replaceResult.success).toBe(false);
      expect(replaceResult.error).toContain('cell_id is required');
    });

    it('should handle single cell notebook operations', async () => {
      const singleCellNotebook = {
        cells: [
          {
            cell_type: 'code',
            id: 'only-cell',
            source: ['print("I am alone")'],
            metadata: {},
            execution_count: null,
            outputs: []
          }
        ],
        metadata: { kernelspec: { name: 'python3' } },
        nbformat: 4,
        nbformat_minor: 4
      };
      const notebookPath = await createNotebookFile('single.ipynb', singleCellNotebook);

      // Replace without cell_id should work for single cell
      const replaceResult = await tool.execute({
        notebook_path: notebookPath,
        new_source: 'print("Not alone anymore")',
        edit_mode: 'replace'
      });

      expect(replaceResult.success).toBe(true);

      // Insert should create second cell
      const insertResult = await tool.execute({
        notebook_path: notebookPath,
        new_source: '# Now we are two',
        cell_type: 'markdown',
        edit_mode: 'insert'
      });

      expect(insertResult.success).toBe(true);
      const output = insertResult.output as NotebookEditOutput;
      expect(output.totalCells).toBe(2);

      // Delete should work
      const deleteResult = await tool.execute({
        notebook_path: notebookPath,
        cell_id: 'only-cell',
        new_source: '',
        edit_mode: 'delete'
      });

      expect(deleteResult.success).toBe(true);
    });

    it('should handle maximum file size edge case', async () => {
      // Create a notebook just under the 50MB limit
      const largeContent = 'x'.repeat(49 * 1024 * 1024); // 49MB of content
      const largePath = path.join(testDir, 'near-limit.ipynb');
      await fs.writeFile(largePath, largeContent);

      const result = await tool.execute({
        notebook_path: largePath,
        new_source: 'print("test")',
        edit_mode: 'replace'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid notebook format');
    });

    it('should handle edge case cell IDs (special characters, unicode)', async () => {
      const specialNotebook = {
        cells: [
          {
            cell_type: 'code',
            id: 'cell-with-üñïčødé',
            source: ['print("Unicode ID cell")'],
            metadata: {},
            execution_count: null,
            outputs: []
          },
          {
            cell_type: 'markdown',
            id: 'cell_with_underscores_and_123',
            source: ['# Cell with complex ID'],
            metadata: {}
          },
          {
            cell_type: 'code',
            id: 'cell-with-hyphens-and-dots.test',
            source: ['# Edge case ID'],
            metadata: {},
            execution_count: null,
            outputs: []
          }
        ],
        metadata: { kernelspec: { name: 'python3' } },
        nbformat: 4,
        nbformat_minor: 4
      };
      const notebookPath = await createNotebookFile('special-ids.ipynb', specialNotebook);

      // Test operations with special character IDs
      const result1 = await tool.execute({
        notebook_path: notebookPath,
        cell_id: 'cell-with-üñïčødé',
        new_source: 'print("Updated unicode cell")',
        edit_mode: 'replace'
      });

      expect(result1.success).toBe(true);

      const result2 = await tool.execute({
        notebook_path: notebookPath,
        cell_id: 'cell-with-hyphens-and-dots.test',
        new_source: '# Updated complex ID cell',
        cell_type: 'markdown',
        edit_mode: 'replace'
      });

      expect(result2.success).toBe(true);
    });

    it('should handle extremely long cell content', async () => {
      const notebook = {
        cells: [
          {
            cell_type: 'code',
            id: 'test-cell',
            source: ['print("short")'],
            metadata: {},
            execution_count: null,
            outputs: []
          }
        ],
        metadata: { kernelspec: { name: 'python3' } },
        nbformat: 4,
        nbformat_minor: 4
      };
      const notebookPath = await createNotebookFile('long-content.ipynb', notebook);

      // Create very long content (1MB)
      const longContent = '# Very long content\n' + 'print("x")\n'.repeat(100000);

      const result = await tool.execute({
        notebook_path: notebookPath,
        cell_id: 'test-cell',
        new_source: longContent,
        edit_mode: 'replace'
      });

      expect(result.success).toBe(true);
      const output = result.output as NotebookEditOutput;

      // Content preview should be properly truncated
      expect(output.contentPreview.length).toBeLessThanOrEqual(210);
      expect(output.contentPreview).toContain('...');

      // Verify content was actually saved
      const finalContent = await fs.readFile(notebookPath, 'utf-8');
      const finalNotebook = JSON.parse(finalContent);
      expect(finalNotebook.cells[0].source.join('').length).toBeGreaterThan(100000);
    });
  });

  // ============================================================================
  // Malformed Input Tests
  // ============================================================================

  describe('Malformed Input Tests', () => {
    it('should handle corrupted JSON gracefully', async () => {
      const corruptedPath = path.join(testDir, 'corrupted.ipynb');
      await fs.writeFile(corruptedPath, '{"cells": [corrupted json content');

      const result = await tool.execute({
        notebook_path: corruptedPath,
        new_source: 'test',
        edit_mode: 'replace'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid notebook format');
    });

    it('should handle notebooks with missing required fields', async () => {
      const incompleteNotebook = {
        cells: [
          {
            cell_type: 'code',
            // missing id, source, metadata
            execution_count: null,
            outputs: []
          }
        ]
        // missing metadata, nbformat
      };
      const incompletePath = await createNotebookFile('incomplete.ipynb', incompleteNotebook);

      const result = await tool.execute({
        notebook_path: incompletePath,
        new_source: 'test',
        edit_mode: 'replace'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid notebook format');
    });

    it('should handle cells with invalid types', async () => {
      const invalidTypeNotebook = {
        cells: [
          {
            cell_type: 'invalid-type',
            id: 'bad-cell',
            source: ['content'],
            metadata: {}
          }
        ],
        metadata: { kernelspec: { name: 'python3' } },
        nbformat: 4,
        nbformat_minor: 4
      };
      const invalidPath = await createNotebookFile('invalid-type.ipynb', invalidTypeNotebook);

      const result = await tool.execute({
        notebook_path: invalidPath,
        cell_id: 'bad-cell',
        new_source: 'test',
        edit_mode: 'replace'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid notebook format');
    });

    it('should handle notebooks with unsupported nbformat versions', async () => {
      const unsupportedNotebook = {
        cells: [
          {
            cell_type: 'code',
            id: 'test-cell',
            source: ['print("test")'],
            metadata: {},
            execution_count: null,
            outputs: []
          }
        ],
        metadata: { kernelspec: { name: 'python3' } },
        nbformat: 1, // Unsupported version
        nbformat_minor: 0
      };
      const unsupportedPath = await createNotebookFile('unsupported.ipynb', unsupportedNotebook);

      const result = await tool.execute({
        notebook_path: unsupportedPath,
        cell_id: 'test-cell',
        new_source: 'test',
        edit_mode: 'replace'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported nbformat version');
    });

    it('should handle cells with mixed source formats', async () => {
      const mixedSourceNotebook = {
        cells: [
          {
            cell_type: 'code',
            id: 'string-source',
            source: 'print("string source")', // String instead of array
            metadata: {},
            execution_count: null,
            outputs: []
          },
          {
            cell_type: 'markdown',
            id: 'array-source',
            source: ['# Array source\n', 'Content'], // Array format
            metadata: {}
          }
        ],
        metadata: { kernelspec: { name: 'python3' } },
        nbformat: 4,
        nbformat_minor: 4
      };
      const mixedPath = await createNotebookFile('mixed-source.ipynb', mixedSourceNotebook);

      const result = await tool.execute({
        notebook_path: mixedPath,
        cell_id: 'string-source',
        new_source: 'print("updated")',
        edit_mode: 'replace'
      });

      expect(result.success).toBe(true);

      // Verify source is normalized to array format
      const finalContent = await fs.readFile(mixedPath, 'utf-8');
      const finalNotebook = JSON.parse(finalContent);
      expect(Array.isArray(finalNotebook.cells[0].source)).toBe(true);
    });
  });

  // ============================================================================
  // Race Condition and Concurrency Tests
  // ============================================================================

  describe('Race Condition and Concurrency Tests', () => {
    it('should handle concurrent modifications from multiple tool instances', async () => {
      const notebook = {
        cells: Array.from({ length: 20 }, (_, i) => ({
          cell_type: 'code',
          id: `cell-${i}`,
          source: [`print("Cell ${i}")`],
          metadata: {},
          execution_count: null,
          outputs: []
        })),
        metadata: { kernelspec: { name: 'python3' } },
        nbformat: 4,
        nbformat_minor: 4
      };
      const notebookPath = await createNotebookFile('concurrent.ipynb', notebook);

      const tools = Array.from({ length: 5 }, () => new NotebookEditTool());
      const operations = tools.map((tool, index) =>
        tool.execute({
          notebook_path: notebookPath,
          cell_id: `cell-${index * 2}`,
          new_source: `print("Updated by tool ${index}")`,
          edit_mode: 'replace'
        })
      );

      const results = await Promise.all(operations);

      // At least some operations should succeed
      const successCount = results.filter(r => r.success).length;
      expect(successCount).toBeGreaterThan(0);

      // Notebook should remain in valid state
      const finalContent = await fs.readFile(notebookPath, 'utf-8');
      expect(() => JSON.parse(finalContent)).not.toThrow();

      const finalNotebook = JSON.parse(finalContent);
      expect(finalNotebook.cells).toHaveLength(20);
    });

    it('should handle rapid-fire operations on same cell', async () => {
      const notebook = {
        cells: [
          {
            cell_type: 'code',
            id: 'target-cell',
            source: ['print("original")'],
            metadata: {},
            execution_count: null,
            outputs: []
          }
        ],
        metadata: { kernelspec: { name: 'python3' } },
        nbformat: 4,
        nbformat_minor: 4
      };
      const notebookPath = await createNotebookFile('rapid-fire.ipynb', notebook);

      // Fire 10 operations at the same cell simultaneously
      const operations = Array.from({ length: 10 }, (_, i) =>
        tool.execute({
          notebook_path: notebookPath,
          cell_id: 'target-cell',
          new_source: `print("Update ${i}")`,
          edit_mode: 'replace'
        })
      );

      const results = await Promise.all(operations);

      // At least one should succeed
      const successCount = results.filter(r => r.success).length;
      expect(successCount).toBeGreaterThan(0);

      // Final state should be valid
      const finalContent = await fs.readFile(notebookPath, 'utf-8');
      const finalNotebook = JSON.parse(finalContent);
      expect(finalNotebook.cells).toHaveLength(1);
      expect(finalNotebook.cells[0].id).toBe('target-cell');
    });

    it('should handle file system race conditions gracefully', async () => {
      const notebook = {
        cells: [
          {
            cell_type: 'code',
            id: 'test-cell',
            source: ['print("test")'],
            metadata: {},
            execution_count: null,
            outputs: []
          }
        ],
        metadata: { kernelspec: { name: 'python3' } },
        nbformat: 4,
        nbformat_minor: 4
      };
      const notebookPath = await createNotebookFile('race-condition.ipynb', notebook);

      // Simulate external file modification during operation
      const operationPromise = tool.execute({
        notebook_path: notebookPath,
        cell_id: 'test-cell',
        new_source: 'print("tool update")',
        edit_mode: 'replace'
      });

      // Modify file externally while operation is in progress
      setTimeout(async () => {
        try {
          const externalUpdate = { ...notebook };
          externalUpdate.cells[0].source = ['print("external update")'];
          await fs.writeFile(notebookPath, JSON.stringify(externalUpdate, null, 2));
        } catch {
          // Ignore if file is locked
        }
      }, 10);

      const result = await operationPromise;

      // Operation should either succeed or fail gracefully
      expect(typeof result.success).toBe('boolean');
      if (!result.success) {
        expect(result.error).toBeTruthy();
      }

      // File should remain valid
      const finalContent = await fs.readFile(notebookPath, 'utf-8');
      expect(() => JSON.parse(finalContent)).not.toThrow();
    });
  });

  // ============================================================================
  // Stress and Resource Exhaustion Tests
  // ============================================================================

  describe('Stress and Resource Exhaustion Tests', () => {
    it('should handle notebook with maximum realistic cell count', async () => {
      const maxCells = 5000; // Realistic maximum for a large notebook
      const cells = Array.from({ length: maxCells }, (_, i) => ({
        cell_type: i % 2 === 0 ? 'code' : 'markdown',
        id: `stress-cell-${i}`,
        source: [`# Cell ${i}\nprint("Stress test ${i}")`],
        metadata: { stress: true },
        ...(i % 2 === 0 ? { execution_count: null, outputs: [] } : {})
      }));

      const stressNotebook = {
        cells,
        metadata: { kernelspec: { name: 'python3' }, stress_test: true },
        nbformat: 4,
        nbformat_minor: 4
      };

      const stressPath = await createNotebookFile('stress-max-cells.ipynb', stressNotebook);

      // Test operations at different positions
      const operations = [
        { cellId: 'stress-cell-0', position: 'beginning' },
        { cellId: 'stress-cell-2500', position: 'middle' },
        { cellId: 'stress-cell-4999', position: 'end' }
      ];

      for (const op of operations) {
        const result = await tool.execute({
          notebook_path: stressPath,
          cell_id: op.cellId,
          new_source: `# Stress test at ${op.position}\nprint("Updated at ${op.position}")`,
          edit_mode: 'replace'
        });

        expect(result.success).toBe(true);
      }
    });

    it('should handle notebook with deeply nested metadata structures', async () => {
      const deepMetadata = {
        level1: {
          level2: {
            level3: {
              level4: {
                level5: {
                  data: Array.from({ length: 1000 }, (_, i) => ({
                    id: i,
                    value: `nested-${i}`,
                    nested: { more: { data: `deep-${i}` } }
                  }))
                }
              }
            }
          }
        }
      };

      const deepNotebook = {
        cells: [
          {
            cell_type: 'code',
            id: 'deep-cell',
            source: ['print("deep metadata test")'],
            metadata: deepMetadata,
            execution_count: null,
            outputs: []
          }
        ],
        metadata: {
          kernelspec: { name: 'python3' },
          deep: deepMetadata
        },
        nbformat: 4,
        nbformat_minor: 4
      };

      const deepPath = await createNotebookFile('deep-metadata.ipynb', deepNotebook);

      const result = await tool.execute({
        notebook_path: deepPath,
        cell_id: 'deep-cell',
        new_source: 'print("Updated with deep metadata")',
        edit_mode: 'replace'
      });

      expect(result.success).toBe(true);

      // Verify deep metadata is preserved
      const finalContent = await fs.readFile(deepPath, 'utf-8');
      const finalNotebook = JSON.parse(finalContent);
      expect(finalNotebook.cells[0].metadata.level1.level2.level3.level4.level5.data).toHaveLength(1000);
    });

    it('should handle notebook with extreme unicode content', async () => {
      const unicodeNotebook = {
        cells: [
          {
            cell_type: 'markdown',
            id: 'unicode-cell',
            source: [
              '# Unicode Stress Test 🚀\n',
              '\n',
              '## Mathematical symbols: ∑∫∂∆∇∞±≤≥≠≈√π∏∪∩∈∀∃\n',
              '## Emoji stress: 😀😃😄😁😆😅😂🤣☺️😊😇🙂🙃😉😌😍🥰😘😗😙😚😋😛😝😜🤪🤨🧐🤓😎🤩🥳😏😒😞😔😟😕🙁☹️😣😖😫😩🥺😢😭😤😠😡🤬🤯😳🥵🥶😱😨😰😥😓🤗🤔🤭🤫🤥😶😐😑😬🙄😯😦😧😮😲🥱😴🤤😪😵🤐🥴🤢🤮🤧😷🤒🤕🤑🤠\n',
              '## Various scripts: العربية 中文 한국어 日本語 русский हिन्दी ไทย ελληνικά עברית\n',
              '## Special characters: ‰‱←→↑↓↔↕↖↗↘↙⇐⇒⇑⇓⇔⇕⇖⇗⇘⇙\n'
            ],
            metadata: { unicode: true }
          }
        ],
        metadata: { kernelspec: { name: 'python3' } },
        nbformat: 4,
        nbformat_minor: 4
      };

      const unicodePath = await createNotebookFile('unicode-stress.ipynb', unicodeNotebook);

      const result = await tool.execute({
        notebook_path: unicodePath,
        cell_id: 'unicode-cell',
        new_source: '# 更新的Unicode测试 🔥\n\nThis is an updated cell with even more unicode: 🌟⭐✨💫⚡🔥💥💯🎉🎊🎈🎁🏆',
        edit_mode: 'replace'
      });

      expect(result.success).toBe(true);

      // Verify unicode is properly preserved
      const finalContent = await fs.readFile(unicodePath, 'utf-8');
      const finalNotebook = JSON.parse(finalContent);
      expect(finalNotebook.cells[0].source.join('')).toContain('🔥');
      expect(finalNotebook.cells[0].source.join('')).toContain('测试');
    });

    it('should handle repeated operations without degrading performance', async () => {
      const notebook = {
        cells: [
          {
            cell_type: 'code',
            id: 'performance-cell',
            source: ['print("performance test")'],
            metadata: {},
            execution_count: null,
            outputs: []
          }
        ],
        metadata: { kernelspec: { name: 'python3' } },
        nbformat: 4,
        nbformat_minor: 4
      };

      const perfPath = await createNotebookFile('performance-degradation.ipynb', notebook);

      const timings: number[] = [];
      const iterations = 50;

      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();

        await tool.execute({
          notebook_path: perfPath,
          cell_id: 'performance-cell',
          new_source: `print("Performance iteration ${i}")`,
          edit_mode: 'replace'
        });

        const endTime = performance.now();
        timings.push(endTime - startTime);
      }

      // Performance shouldn't degrade significantly over time
      const firstQuartileAvg = timings.slice(0, 12).reduce((a, b) => a + b, 0) / 12;
      const lastQuartileAvg = timings.slice(-12).reduce((a, b) => a + b, 0) / 12;

      // Last quartile shouldn't be more than 2x slower than first quartile
      expect(lastQuartileAvg).toBeLessThan(firstQuartileAvg * 2);

      console.log(`Performance degradation test: First quartile avg: ${firstQuartileAvg.toFixed(2)}ms, Last quartile avg: ${lastQuartileAvg.toFixed(2)}ms`);
    });
  });

  // ============================================================================
  // Error Recovery and Resilience Tests
  // ============================================================================

  describe('Error Recovery and Resilience Tests', () => {
    it('should recover gracefully from write failures', async () => {
      const notebook = {
        cells: [
          {
            cell_type: 'code',
            id: 'recovery-cell',
            source: ['print("original")'],
            metadata: {},
            execution_count: null,
            outputs: []
          }
        ],
        metadata: { kernelspec: { name: 'python3' } },
        nbformat: 4,
        nbformat_minor: 4
      };

      const recoveryPath = await createNotebookFile('recovery-test.ipynb', notebook);

      // Make parent directory read-only to cause write failure
      const parentDir = path.dirname(recoveryPath);
      const originalPerms = (await fs.stat(parentDir)).mode;

      try {
        await fs.chmod(parentDir, 0o555); // Read-only

        const result = await tool.execute({
          notebook_path: recoveryPath,
          cell_id: 'recovery-cell',
          new_source: 'print("this should fail")',
          edit_mode: 'replace'
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Cannot write notebook');

        // Restore permissions and verify original file is intact
        await fs.chmod(parentDir, originalPerms);

        const originalContent = await fs.readFile(recoveryPath, 'utf-8');
        const originalNotebook = JSON.parse(originalContent);
        expect(originalNotebook.cells[0].source.join('')).toBe('print("original")');

      } finally {
        // Ensure permissions are restored
        try {
          await fs.chmod(parentDir, originalPerms);
        } catch {
          // Ignore cleanup errors
        }
      }
    });

    it('should handle corrupted backup scenarios', async () => {
      const notebook = {
        cells: [
          {
            cell_type: 'code',
            id: 'backup-test-cell',
            source: ['print("test")'],
            metadata: {},
            execution_count: null,
            outputs: []
          }
        ],
        metadata: { kernelspec: { name: 'python3' } },
        nbformat: 4,
        nbformat_minor: 4
      };

      const backupTestPath = await createNotebookFile('backup-corruption.ipynb', notebook);

      // Pre-create a corrupted backup file
      const corruptedBackupPath = `${backupTestPath}.backup.${Date.now()}`;
      await fs.writeFile(corruptedBackupPath, 'corrupted backup content');

      const result = await tool.execute({
        notebook_path: backupTestPath,
        cell_id: 'backup-test-cell',
        new_source: 'print("updated despite corrupted backup")',
        edit_mode: 'replace'
      });

      expect(result.success).toBe(true);

      // Cleanup the test backup file
      try {
        await fs.unlink(corruptedBackupPath);
      } catch {
        // Ignore if already cleaned up
      }
    });

    it('should handle invalid cell references gracefully', async () => {
      const notebook = {
        cells: [
          {
            cell_type: 'code',
            id: 'valid-cell',
            source: ['print("valid")'],
            metadata: {},
            execution_count: null,
            outputs: []
          }
        ],
        metadata: { kernelspec: { name: 'python3' } },
        nbformat: 4,
        nbformat_minor: 4
      };

      const invalidRefPath = await createNotebookFile('invalid-refs.ipynb', notebook);

      const invalidReferences = [
        'non-existent-cell',
        '',
        null,
        undefined,
        'cell-with-special-chars-!@#$%^&*()',
        'cell\nwith\nnewlines',
        'cell\twith\ttabs'
      ];

      for (const invalidRef of invalidReferences) {
        const result = await tool.execute({
          notebook_path: invalidRefPath,
          cell_id: invalidRef as any,
          new_source: 'print("should not work")',
          edit_mode: 'replace'
        });

        expect(result.success).toBe(false);
        if (invalidRef) {
          expect(result.error).toContain('not found');
        }
      }
    });
  });
});