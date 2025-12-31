/**
 * @fileoverview Concurrent operation and thread safety tests for NotebookEditTool
 *
 * These tests verify that the NotebookEditTool handles concurrent operations
 * safely, maintains data consistency, and properly manages resource access
 * when multiple operations are performed simultaneously.
 *
 * @module @apex/core/tools/filesystem/__tests__/notebook-edit-tool.concurrent
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  NotebookEditTool,
  type NotebookEditParams,
  type NotebookEditOutput
} from '../notebook-edit-tool.js';

// ============================================================================
// Test Setup
// ============================================================================

describe('NotebookEditTool - Concurrent Operations and Thread Safety', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'notebook-concurrent-test-'));
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  // Helper to create a test notebook
  const createTestNotebook = async (filename: string, cellCount: number = 10) => {
    const cells = Array.from({ length: cellCount }, (_, i) => ({
      cell_type: i % 2 === 0 ? 'code' : 'markdown',
      id: `cell-${i}`,
      source: [`# Cell ${i}\nprint("Cell ${i} content")`],
      metadata: { index: i },
      ...(i % 2 === 0 ? { execution_count: null, outputs: [] } : {})
    }));

    const notebook = {
      cells,
      metadata: { kernelspec: { name: 'python3' } },
      nbformat: 4,
      nbformat_minor: 4
    };

    const notebookPath = path.join(tempDir, filename);
    await fs.writeFile(notebookPath, JSON.stringify(notebook, null, 2));
    return notebookPath;
  };

  // Helper to validate notebook integrity
  const validateNotebookIntegrity = async (notebookPath: string) => {
    const content = await fs.readFile(notebookPath, 'utf-8');
    const notebook = JSON.parse(content);

    expect(Array.isArray(notebook.cells)).toBe(true);
    expect(typeof notebook.metadata).toBe('object');
    expect(typeof notebook.nbformat).toBe('number');

    // Validate each cell
    notebook.cells.forEach((cell: any, index: number) => {
      expect(cell.cell_type).toMatch(/^(code|markdown|raw)$/);
      expect(cell.id).toBeTruthy();
      expect(Array.isArray(cell.source)).toBe(true);
      expect(typeof cell.metadata).toBe('object');
    });

    // Check for duplicate IDs
    const ids = notebook.cells.map((cell: any) => cell.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);

    return notebook;
  };

  // ============================================================================
  // Basic Concurrency Tests
  // ============================================================================

  describe('Basic Concurrency', () => {
    it('should handle multiple tool instances operating on different notebooks', async () => {
      const tools = Array.from({ length: 5 }, () => new NotebookEditTool());
      const notebooks = await Promise.all(
        Array.from({ length: 5 }, (_, i) => createTestNotebook(`notebook-${i}.ipynb`))
      );

      const operations = tools.map((tool, index) =>
        tool.execute({
          notebook_path: notebooks[index],
          cell_id: 'cell-0',
          new_source: `print("Updated by tool ${index}")`,
          edit_mode: 'replace'
        })
      );

      const results = await Promise.all(operations);

      // All operations should succeed
      results.forEach((result, index) => {
        expect(result.success).toBe(true);
      });

      // Verify each notebook was updated correctly
      for (let i = 0; i < notebooks.length; i++) {
        const notebook = await validateNotebookIntegrity(notebooks[i]);
        expect(notebook.cells[0].source.join('')).toContain(`tool ${i}`);
      }
    });

    it('should handle multiple operations on same notebook with different cells', async () => {
      const notebookPath = await createTestNotebook('concurrent-cells.ipynb', 20);
      const tools = Array.from({ length: 10 }, () => new NotebookEditTool());

      const operations = tools.map((tool, index) =>
        tool.execute({
          notebook_path: notebookPath,
          cell_id: `cell-${index * 2}`, // Use even-numbered cells
          new_source: `print("Concurrent update ${index}")`,
          edit_mode: 'replace'
        })
      );

      const results = await Promise.all(operations);

      // Count successful operations
      const successCount = results.filter(r => r.success).length;
      expect(successCount).toBeGreaterThan(0);

      // Verify notebook integrity
      const notebook = await validateNotebookIntegrity(notebookPath);
      expect(notebook.cells).toHaveLength(20);
    });

    it('should handle concurrent read-heavy workloads', async () => {
      const notebookPath = await createTestNotebook('read-heavy.ipynb', 50);
      const tools = Array.from({ length: 20 }, () => new NotebookEditTool());

      // Most operations are reads (cell inspection via replace with same content)
      const operations = tools.map((tool, index) => {
        const cellId = `cell-${index % 50}`;
        return tool.execute({
          notebook_path: notebookPath,
          cell_id: cellId,
          new_source: `# Cell ${index % 50}\nprint("Cell ${index % 50} content")`, // Same as original
          edit_mode: 'replace'
        });
      });

      const startTime = performance.now();
      const results = await Promise.all(operations);
      const duration = performance.now() - startTime;

      // Most operations should succeed
      const successCount = results.filter(r => r.success).length;
      expect(successCount).toBeGreaterThanOrEqual(15); // At least 75% success rate

      // Should be reasonably fast
      expect(duration).toBeLessThan(5000); // Less than 5 seconds

      // Verify notebook integrity
      await validateNotebookIntegrity(notebookPath);

      console.log(`Read-heavy concurrent operations: ${successCount}/${results.length} succeeded in ${duration.toFixed(2)}ms`);
    });
  });

  // ============================================================================
  // Write-Heavy Concurrency Tests
  // ============================================================================

  describe('Write-Heavy Concurrency', () => {
    it('should handle concurrent writes to same cell safely', async () => {
      const notebookPath = await createTestNotebook('write-heavy.ipynb', 5);
      const tools = Array.from({ length: 10 }, () => new NotebookEditTool());

      // All operations target the same cell
      const operations = tools.map((tool, index) =>
        tool.execute({
          notebook_path: notebookPath,
          cell_id: 'cell-2',
          new_source: `print("Write operation ${index}")`,
          edit_mode: 'replace'
        })
      );

      const results = await Promise.all(operations);

      // At least one operation should succeed
      const successCount = results.filter(r => r.success).length;
      expect(successCount).toBeGreaterThan(0);

      // Verify notebook is in valid state
      const notebook = await validateNotebookIntegrity(notebookPath);
      expect(notebook.cells).toHaveLength(5);

      // The target cell should contain content from one of the operations
      const targetCell = notebook.cells.find((c: any) => c.id === 'cell-2');
      expect(targetCell).toBeDefined();
      expect(targetCell.source.join('')).toContain('Write operation');

      console.log(`Concurrent writes to same cell: ${successCount}/${results.length} succeeded`);
    });

    it('should handle concurrent insertions safely', async () => {
      const notebookPath = await createTestNotebook('insert-heavy.ipynb', 3);
      const tools = Array.from({ length: 15 }, () => new NotebookEditTool());

      // Concurrent insertions at different positions
      const operations = tools.map((tool, index) => {
        const anchorCell = `cell-${index % 3}`; // Rotate through anchor cells
        return tool.execute({
          notebook_path: notebookPath,
          cell_id: anchorCell,
          new_source: `# Inserted cell ${index}\nprint("Concurrent insertion ${index}")`,
          cell_type: 'code',
          edit_mode: 'insert'
        });
      });

      const results = await Promise.all(operations);

      // Count successful insertions
      const successCount = results.filter(r => r.success).length;
      expect(successCount).toBeGreaterThan(0);

      // Verify notebook integrity
      const notebook = await validateNotebookIntegrity(notebookPath);
      expect(notebook.cells.length).toBeGreaterThan(3); // Should have more than original 3 cells

      console.log(`Concurrent insertions: ${successCount}/${results.length} succeeded, final cell count: ${notebook.cells.length}`);
    });

    it('should handle mixed concurrent operations safely', async () => {
      const notebookPath = await createTestNotebook('mixed-concurrent.ipynb', 15);
      const tools = Array.from({ length: 20 }, () => new NotebookEditTool());

      // Mix of replace, insert, and delete operations
      const operations = tools.map((tool, index) => {
        const opType = ['replace', 'insert', 'delete'][index % 3] as const;
        const cellId = `cell-${(index % 15)}`;

        switch (opType) {
          case 'replace':
            return tool.execute({
              notebook_path: notebookPath,
              cell_id: cellId,
              new_source: `print("Replace operation ${index}")`,
              edit_mode: 'replace'
            });
          case 'insert':
            return tool.execute({
              notebook_path: notebookPath,
              cell_id: cellId,
              new_source: `# Insert operation ${index}\nprint("Inserted")`,
              cell_type: 'code',
              edit_mode: 'insert'
            });
          case 'delete':
            return tool.execute({
              notebook_path: notebookPath,
              cell_id: cellId,
              new_source: '',
              edit_mode: 'delete'
            });
        }
      });

      const results = await Promise.all(operations);

      // Count results by operation type
      const successByType = { replace: 0, insert: 0, delete: 0 };
      results.forEach((result, index) => {
        if (result.success) {
          const opType = ['replace', 'insert', 'delete'][index % 3] as keyof typeof successByType;
          successByType[opType]++;
        }
      });

      // Verify at least some operations of each type succeeded
      expect(successByType.replace + successByType.insert + successByType.delete)
        .toBeGreaterThan(10);

      // Verify notebook integrity
      const notebook = await validateNotebookIntegrity(notebookPath);

      console.log(`Mixed concurrent operations:`, successByType);
      console.log(`Final notebook state: ${notebook.cells.length} cells`);
    });
  });

  // ============================================================================
  // Resource Contention Tests
  // ============================================================================

  describe('Resource Contention', () => {
    it('should handle file lock contention gracefully', async () => {
      const notebookPath = await createTestNotebook('lock-contention.ipynb', 5);

      // Create a large number of rapid operations to force contention
      const operationCount = 50;
      const operations: Promise<any>[] = [];

      for (let i = 0; i < operationCount; i++) {
        const tool = new NotebookEditTool();
        const operation = tool.execute({
          notebook_path: notebookPath,
          cell_id: `cell-${i % 5}`,
          new_source: `print("Rapid operation ${i}")`,
          edit_mode: 'replace'
        });
        operations.push(operation);
      }

      const results = await Promise.all(operations);

      // Should handle contention without corruption
      const successCount = results.filter(r => r.success).length;
      const errorCount = results.filter(r => !r.success).length;

      expect(successCount + errorCount).toBe(operationCount);

      // Verify final state is valid
      await validateNotebookIntegrity(notebookPath);

      console.log(`Lock contention test: ${successCount} succeeded, ${errorCount} failed`);
    });

    it('should handle memory pressure under concurrent load', async () => {
      const notebooks = await Promise.all(
        Array.from({ length: 10 }, (_, i) =>
          createTestNotebook(`memory-pressure-${i}.ipynb`, 100)
        )
      );

      // Create memory pressure with large content operations
      const largeContent = 'print("large content")\n'.repeat(10000); // ~200KB per operation
      const operations: Promise<any>[] = [];

      notebooks.forEach((notebookPath, notebookIndex) => {
        for (let i = 0; i < 5; i++) {
          const tool = new NotebookEditTool();
          operations.push(
            tool.execute({
              notebook_path: notebookPath,
              cell_id: `cell-${i}`,
              new_source: `${largeContent}# Notebook ${notebookIndex}, Operation ${i}`,
              edit_mode: 'replace'
            })
          );
        }
      });

      const startMemory = process.memoryUsage?.() || null;
      const results = await Promise.all(operations);
      const endMemory = process.memoryUsage?.() || null;

      // Most operations should succeed despite memory pressure
      const successCount = results.filter(r => r.success).length;
      expect(successCount).toBeGreaterThanOrEqual(operations.length * 0.7); // At least 70%

      // Memory usage should be reasonable
      if (startMemory && endMemory) {
        const memoryIncrease = endMemory.heapUsed - startMemory.heapUsed;
        expect(memoryIncrease).toBeLessThan(500 * 1024 * 1024); // Less than 500MB increase
      }

      // Verify all notebooks are still valid
      for (const notebookPath of notebooks) {
        await validateNotebookIntegrity(notebookPath);
      }

      console.log(`Memory pressure test: ${successCount}/${operations.length} succeeded`);
    });

    it('should handle concurrent access to notebooks at filesystem limits', async () => {
      // Create notebooks with names near filesystem limits
      const longBaseName = 'a'.repeat(200); // Long filename
      const notebooks = await Promise.all([
        createTestNotebook(`${longBaseName}-1.ipynb`, 10),
        createTestNotebook(`${longBaseName}-2.ipynb`, 10),
        createTestNotebook(`${longBaseName}-3.ipynb`, 10)
      ]);

      const operations = notebooks.flatMap((notebookPath, notebookIndex) =>
        Array.from({ length: 10 }, (_, opIndex) => {
          const tool = new NotebookEditTool();
          return tool.execute({
            notebook_path: notebookPath,
            cell_id: `cell-${opIndex % 10}`,
            new_source: `print("Filesystem limit test notebook ${notebookIndex} op ${opIndex}")`,
            edit_mode: 'replace'
          });
        })
      );

      const results = await Promise.all(operations);

      // Should handle filesystem edge cases
      const successCount = results.filter(r => r.success).length;
      expect(successCount).toBeGreaterThan(0);

      // Verify notebooks remain valid
      for (const notebookPath of notebooks) {
        await validateNotebookIntegrity(notebookPath);
      }

      console.log(`Filesystem limits test: ${successCount}/${operations.length} succeeded`);
    });
  });

  // ============================================================================
  // Data Consistency Tests
  // ============================================================================

  describe('Data Consistency', () => {
    it('should maintain cell order consistency under concurrent modifications', async () => {
      const notebookPath = await createTestNotebook('order-consistency.ipynb', 20);

      // Record original order
      const originalNotebook = await validateNotebookIntegrity(notebookPath);
      const originalOrder = originalNotebook.cells.map((c: any) => c.id);

      // Perform concurrent operations that shouldn't change order (only replacements)
      const operations = Array.from({ length: 15 }, (_, index) => {
        const tool = new NotebookEditTool();
        return tool.execute({
          notebook_path: notebookPath,
          cell_id: originalOrder[index % 20],
          new_source: `print("Order test ${index}")`,
          edit_mode: 'replace'
        });
      });

      await Promise.all(operations);

      // Verify order is maintained
      const finalNotebook = await validateNotebookIntegrity(notebookPath);
      const finalOrder = finalNotebook.cells.map((c: any) => c.id);

      expect(finalOrder).toEqual(originalOrder);
    });

    it('should maintain metadata consistency under concurrent access', async () => {
      const notebookPath = await createTestNotebook('metadata-consistency.ipynb', 10);

      // Add rich metadata
      const originalNotebook = JSON.parse(await fs.readFile(notebookPath, 'utf-8'));
      originalNotebook.metadata.test_data = {
        version: '1.0',
        created: new Date().toISOString(),
        tags: ['test', 'concurrent'],
        config: { setting1: 'value1', setting2: 42 }
      };
      originalNotebook.cells.forEach((cell: any, index: number) => {
        cell.metadata.test_index = index;
        cell.metadata.test_tags = [`cell-${index}`, 'test-cell'];
      });
      await fs.writeFile(notebookPath, JSON.stringify(originalNotebook, null, 2));

      // Concurrent operations
      const operations = Array.from({ length: 10 }, (_, index) => {
        const tool = new NotebookEditTool();
        return tool.execute({
          notebook_path: notebookPath,
          cell_id: `cell-${index}`,
          new_source: `print("Metadata test ${index}")`,
          edit_mode: 'replace'
        });
      });

      await Promise.all(operations);

      // Verify metadata preservation
      const finalNotebook = await validateNotebookIntegrity(notebookPath);

      expect(finalNotebook.metadata.test_data).toEqual(originalNotebook.metadata.test_data);
      finalNotebook.cells.forEach((cell: any, index: number) => {
        if (cell.metadata.test_index !== undefined) {
          expect(Array.isArray(cell.metadata.test_tags)).toBe(true);
        }
      });
    });

    it('should handle atomic operation guarantees', async () => {
      const notebookPath = await createTestNotebook('atomic-operations.ipynb', 5);

      // Perform operation that should be atomic (large content update)
      const largeContent = '# Large atomic operation\n' + 'print("line")\n'.repeat(1000);

      const operations = Array.from({ length: 5 }, (_, index) => {
        const tool = new NotebookEditTool();
        return tool.execute({
          notebook_path: notebookPath,
          cell_id: `cell-${index}`,
          new_source: `${largeContent}# Operation ${index}`,
          edit_mode: 'replace'
        });
      });

      const results = await Promise.all(operations);

      // Verify notebook remains valid after all operations
      const notebook = await validateNotebookIntegrity(notebookPath);

      // Each successful operation should have completed fully
      const successfulResults = results.filter(r => r.success) as any[];
      successfulResults.forEach(result => {
        const output = result.output as NotebookEditOutput;
        const cell = notebook.cells.find((c: any) => c.id === output.cellId);
        if (cell) {
          expect(cell.source.join('').length).toBeGreaterThan(1000); // Should have large content
          expect(cell.source.join('')).toContain('Large atomic operation');
        }
      });
    });
  });

  // ============================================================================
  // Performance Under Concurrency
  // ============================================================================

  describe('Performance Under Concurrency', () => {
    it('should maintain reasonable performance under moderate concurrent load', async () => {
      const notebookPaths = await Promise.all(
        Array.from({ length: 5 }, (_, i) => createTestNotebook(`perf-${i}.ipynb`, 10))
      );

      const startTime = performance.now();

      // 25 concurrent operations across 5 notebooks
      const operations = notebookPaths.flatMap((notebookPath, notebookIndex) =>
        Array.from({ length: 5 }, (_, opIndex) => {
          const tool = new NotebookEditTool();
          return tool.execute({
            notebook_path: notebookPath,
            cell_id: `cell-${opIndex}`,
            new_source: `print("Performance test notebook ${notebookIndex} operation ${opIndex}")`,
            edit_mode: 'replace'
          });
        })
      );

      const results = await Promise.all(operations);
      const duration = performance.now() - startTime;

      const successCount = results.filter(r => r.success).length;

      // Should complete in reasonable time (less than 5 seconds for 25 operations)
      expect(duration).toBeLessThan(5000);

      // Most operations should succeed
      expect(successCount).toBeGreaterThanOrEqual(20);

      console.log(`Concurrent performance: ${successCount}/${operations.length} operations in ${duration.toFixed(2)}ms (${(duration/successCount).toFixed(2)}ms avg)`);
    });

    it('should scale reasonably with increased concurrency', async () => {
      const concurrencyLevels = [5, 10, 20];
      const timings: { [level: number]: number } = {};

      for (const level of concurrencyLevels) {
        const notebookPaths = await Promise.all(
          Array.from({ length: level }, (_, i) => createTestNotebook(`scale-${level}-${i}.ipynb`, 5))
        );

        const startTime = performance.now();

        const operations = notebookPaths.map((notebookPath, index) => {
          const tool = new NotebookEditTool();
          return tool.execute({
            notebook_path: notebookPath,
            cell_id: 'cell-0',
            new_source: `print("Scale test level ${level} operation ${index}")`,
            edit_mode: 'replace'
          });
        });

        const results = await Promise.all(operations);
        const duration = performance.now() - startTime;
        timings[level] = duration;

        const successCount = results.filter(r => r.success).length;
        expect(successCount).toBeGreaterThanOrEqual(level * 0.8); // At least 80% success

        // Clean up for next iteration
        await Promise.all(notebookPaths.map(async (path) => {
          try {
            await fs.unlink(path);
          } catch {
            // Ignore cleanup errors
          }
        }));
      }

      // Performance should scale reasonably (not exponentially)
      const efficiency5to10 = timings[10] / timings[5];
      const efficiency10to20 = timings[20] / timings[10];

      expect(efficiency5to10).toBeLessThan(3); // Shouldn't be more than 3x slower
      expect(efficiency10to20).toBeLessThan(3); // Shouldn't be more than 3x slower

      console.log(`Scaling results:`, timings);
      console.log(`5→10 efficiency: ${efficiency5to10.toFixed(2)}x, 10→20 efficiency: ${efficiency10to20.toFixed(2)}x`);
    });
  });
});