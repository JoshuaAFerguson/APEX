/**
 * @fileoverview Performance tests for NotebookEditTool - Testing scalability and efficiency
 *
 * These tests verify that the NotebookEditTool performs efficiently with
 * large notebooks, complex operations, and high-volume usage scenarios.
 * They test memory usage, execution time, and throughput characteristics.
 *
 * @module @apex/core/tools/filesystem/__tests__/notebook-edit-tool.performance
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
// Test Setup and Utilities
// ============================================================================

describe('NotebookEditTool - Performance Tests', () => {
  let tool: NotebookEditTool;
  let testDir: string;

  beforeEach(async () => {
    tool = new NotebookEditTool();
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'notebook-perf-test-'));
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  // Utility to create large notebook content
  const createLargeNotebook = (cellCount: number, avgContentSize: number = 1000) => {
    const cells = [];

    for (let i = 0; i < cellCount; i++) {
      const cellType = i % 3 === 0 ? 'markdown' : 'code';
      const contentSize = avgContentSize + (Math.random() * 500 - 250); // ±250 chars variance

      let content: string;
      if (cellType === 'markdown') {
        content = `# Section ${i}\n\n${'This is markdown content. '.repeat(Math.floor(contentSize / 25))}`;
      } else {
        content = `# Cell ${i} - Processing data\n${'print(f"Processing step {i}: {data}")  # '.repeat(Math.floor(contentSize / 50))}\n# End of cell ${i}`;
      }

      const cell: any = {
        cell_type: cellType,
        id: `cell-${i}`,
        source: content.split('\n').map(line => line + (line === content.split('\n').slice(-1)[0] ? '' : '\n')),
        metadata: {
          tags: [`section-${Math.floor(i / 10)}`, `type-${cellType}`],
          cellIndex: i
        }
      };

      if (cellType === 'code') {
        cell.execution_count = Math.random() > 0.5 ? Math.floor(Math.random() * 100) : null;
        cell.outputs = Math.random() > 0.7 ? [
          {
            output_type: 'stream',
            name: 'stdout',
            text: [`Output from cell ${i}\n`]
          }
        ] : [];
      }

      cells.push(cell);
    }

    return {
      cells,
      metadata: {
        kernelspec: {
          display_name: 'Python 3',
          language: 'python',
          name: 'python3'
        },
        language_info: {
          name: 'python',
          version: '3.11.0'
        },
        performance_test: {
          cellCount,
          avgContentSize,
          createdAt: new Date().toISOString()
        }
      },
      nbformat: 4,
      nbformat_minor: 5
    };
  };

  // Utility to measure memory usage
  const getMemoryUsage = () => {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage();
    }
    return null;
  };

  // Utility to create test notebook file
  const createNotebookFile = async (filename: string, content: any): Promise<string> => {
    const notebookPath = path.join(testDir, filename);
    await fs.writeFile(notebookPath, JSON.stringify(content, null, 2));
    return notebookPath;
  };

  // ============================================================================
  // Small to Medium Notebook Performance Tests
  // ============================================================================

  describe('Small to Medium Notebook Performance', () => {
    it('should handle 10-cell notebooks efficiently (baseline)', async () => {
      const notebook = createLargeNotebook(10, 500);
      const notebookPath = await createNotebookFile('small.ipynb', notebook);

      const startTime = performance.now();
      const startMemory = getMemoryUsage();

      const result = await tool.execute({
        notebook_path: notebookPath,
        cell_id: 'cell-5',
        new_source: 'print("Updated cell 5 content")',
        edit_mode: 'replace'
      });

      const endTime = performance.now();
      const endMemory = getMemoryUsage();
      const duration = endTime - startTime;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(100); // Should complete in under 100ms

      if (startMemory && endMemory) {
        const memoryIncrease = endMemory.heapUsed - startMemory.heapUsed;
        expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024); // Less than 10MB increase
      }

      console.log(`Small notebook (10 cells): ${duration.toFixed(2)}ms`);
    });

    it('should handle 50-cell notebooks efficiently', async () => {
      const notebook = createLargeNotebook(50, 800);
      const notebookPath = await createNotebookFile('medium.ipynb', notebook);

      const startTime = performance.now();

      // Perform multiple operations
      const operations = [
        tool.execute({
          notebook_path: notebookPath,
          cell_id: 'cell-10',
          new_source: '# Updated analysis section\nimport seaborn as sns\nsns.set_style("whitegrid")',
          edit_mode: 'replace'
        }),
        tool.execute({
          notebook_path: notebookPath,
          cell_id: 'cell-25',
          new_source: '## Mid-section Addition\n\nThis is a new markdown section.',
          cell_type: 'markdown',
          edit_mode: 'insert'
        }),
        tool.execute({
          notebook_path: notebookPath,
          cell_id: 'cell-40',
          new_source: '',
          edit_mode: 'delete'
        })
      ];

      const results = await Promise.all(operations);
      const endTime = performance.now();
      const duration = endTime - startTime;

      // All operations should succeed
      results.forEach(result => expect(result.success).toBe(true));
      expect(duration).toBeLessThan(500); // Should complete in under 500ms

      console.log(`Medium notebook (50 cells, 3 operations): ${duration.toFixed(2)}ms`);
    });

    it('should handle 100-cell notebooks with acceptable performance', async () => {
      const notebook = createLargeNotebook(100, 1200);
      const notebookPath = await createNotebookFile('large-medium.ipynb', notebook);

      const startTime = performance.now();
      const startMemory = getMemoryUsage();

      const result = await tool.execute({
        notebook_path: notebookPath,
        new_source: '# Performance Test Header\n\nThis notebook contains 100 cells for performance testing.',
        cell_type: 'markdown',
        edit_mode: 'insert'
      });

      const endTime = performance.now();
      const endMemory = getMemoryUsage();
      const duration = endTime - startTime;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(1000); // Should complete in under 1 second

      if (startMemory && endMemory) {
        const memoryIncrease = endMemory.heapUsed - startMemory.heapUsed;
        expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // Less than 50MB increase
      }

      // Verify the notebook is still valid and correctly sized
      const output = result.output as NotebookEditOutput;
      expect(output.totalCells).toBe(101); // 100 + 1 inserted

      console.log(`Large-medium notebook (100 cells): ${duration.toFixed(2)}ms`);
    });
  });

  // ============================================================================
  // Large Notebook Performance Tests
  // ============================================================================

  describe('Large Notebook Performance', () => {
    it('should handle 500-cell notebooks with reasonable performance', async () => {
      const notebook = createLargeNotebook(500, 1000);
      const notebookPath = await createNotebookFile('large.ipynb', notebook);

      const startTime = performance.now();

      const result = await tool.execute({
        notebook_path: notebookPath,
        cell_id: 'cell-250', // Middle of notebook
        new_source: '# Performance test - middle insertion\nprint("Inserted in middle of large notebook")',
        cell_type: 'code',
        edit_mode: 'insert'
      });

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(3000); // Should complete in under 3 seconds

      const output = result.output as NotebookEditOutput;
      expect(output.totalCells).toBe(501);

      console.log(`Large notebook (500 cells): ${duration.toFixed(2)}ms`);
    });

    it('should handle 1000-cell notebooks with acceptable performance degradation', async () => {
      const notebook = createLargeNotebook(1000, 800);
      const notebookPath = await createNotebookFile('very-large.ipynb', notebook);

      const startTime = performance.now();

      // Test operations at different positions to check for O(n) vs O(1) behavior
      const operations = [
        { position: 'cell-10', label: 'beginning' },
        { position: 'cell-500', label: 'middle' },
        { position: 'cell-900', label: 'end' }
      ];

      const timings: { [key: string]: number } = {};

      for (const op of operations) {
        const opStart = performance.now();

        const result = await tool.execute({
          notebook_path: notebookPath,
          cell_id: op.position,
          new_source: `# Performance test at ${op.label}\nprint(f"Operation at ${op.label} position")`,
          edit_mode: 'replace'
        });

        const opEnd = performance.now();
        timings[op.label] = opEnd - opStart;

        expect(result.success).toBe(true);
      }

      const endTime = performance.now();
      const totalDuration = endTime - startTime;

      expect(totalDuration).toBeLessThan(10000); // Should complete in under 10 seconds

      // Performance should not degrade significantly based on position
      const beginningTime = timings['beginning'];
      const middleTime = timings['middle'];
      const endTime2 = timings['end'];

      // Middle operation shouldn't be more than 3x slower than beginning
      expect(middleTime).toBeLessThan(beginningTime * 3);
      expect(endTime2).toBeLessThan(beginningTime * 3);

      console.log(`Very large notebook (1000 cells): ${totalDuration.toFixed(2)}ms`);
      console.log(`  - Beginning: ${beginningTime.toFixed(2)}ms`);
      console.log(`  - Middle: ${middleTime.toFixed(2)}ms`);
      console.log(`  - End: ${endTime2.toFixed(2)}ms`);
    });

    it('should handle notebooks approaching file size limit efficiently', async () => {
      // Create a notebook that's close to the 50MB limit
      const notebook = createLargeNotebook(200, 200000); // ~40MB notebook
      const notebookPath = await createNotebookFile('size-limit.ipynb', notebook);

      // Verify file size
      const stats = await fs.stat(notebookPath);
      expect(stats.size).toBeGreaterThan(30 * 1024 * 1024); // At least 30MB
      expect(stats.size).toBeLessThan(50 * 1024 * 1024); // Under 50MB limit

      const startTime = performance.now();
      const startMemory = getMemoryUsage();

      const result = await tool.execute({
        notebook_path: notebookPath,
        cell_id: 'cell-100',
        new_source: 'print("Large notebook test")',
        edit_mode: 'replace'
      });

      const endTime = performance.now();
      const endMemory = getMemoryUsage();
      const duration = endTime - startTime;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(5000); // Should complete in under 5 seconds

      if (startMemory && endMemory) {
        const memoryIncrease = endMemory.heapUsed - startMemory.heapUsed;
        // Memory increase should be reasonable (less than 2x file size)
        expect(memoryIncrease).toBeLessThan(stats.size * 2);
      }

      console.log(`Size-limit notebook (~${(stats.size / 1024 / 1024).toFixed(1)}MB): ${duration.toFixed(2)}ms`);
    });
  });

  // ============================================================================
  // High-Volume Operation Tests
  // ============================================================================

  describe('High-Volume Operation Performance', () => {
    it('should handle rapid sequential operations efficiently', async () => {
      const notebook = createLargeNotebook(50, 1000);
      const notebookPath = await createNotebookFile('rapid-ops.ipynb', notebook);

      const operationCount = 20;
      const operations: Promise<any>[] = [];
      const startTime = performance.now();

      // Create sequential operations
      for (let i = 0; i < operationCount; i++) {
        const operation = tool.execute({
          notebook_path: notebookPath,
          cell_id: `cell-${i % 20}`, // Cycle through first 20 cells
          new_source: `# Rapid operation ${i}\nprint(f"Operation number {i}")`,
          edit_mode: 'replace'
        });
        operations.push(operation);
      }

      const results = await Promise.all(operations);
      const endTime = performance.now();
      const duration = endTime - startTime;

      // All operations should succeed
      results.forEach((result, index) => {
        expect(result.success).toBe(true);
      });

      // Average time per operation should be reasonable
      const avgTimePerOp = duration / operationCount;
      expect(avgTimePerOp).toBeLessThan(500); // Less than 500ms per operation on average

      console.log(`${operationCount} rapid operations: ${duration.toFixed(2)}ms (${avgTimePerOp.toFixed(2)}ms avg)`);
    });

    it('should handle batch cell insertions efficiently', async () => {
      const notebook = createLargeNotebook(10, 500); // Start small
      const notebookPath = await createNotebookFile('batch-insert.ipynb', notebook);

      const insertCount = 50;
      const startTime = performance.now();

      // Insert multiple cells sequentially
      let currentCellId = 'cell-5'; // Insert after cell 5
      for (let i = 0; i < insertCount; i++) {
        const result = await tool.execute({
          notebook_path: notebookPath,
          cell_id: currentCellId,
          new_source: `# Batch inserted cell ${i}\nprint(f"This is batch insert {i}")`,
          cell_type: 'code',
          edit_mode: 'insert'
        });

        expect(result.success).toBe(true);
        const output = result.output as NotebookEditOutput;
        currentCellId = output.cellId; // Use the new cell ID for next insertion
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Final verification
      const finalContent = await fs.readFile(notebookPath, 'utf-8');
      const finalNotebook = JSON.parse(finalContent);
      expect(finalNotebook.cells).toHaveLength(10 + insertCount); // Original + inserted

      // Should complete in reasonable time
      expect(duration).toBeLessThan(10000); // Less than 10 seconds

      console.log(`${insertCount} batch insertions: ${duration.toFixed(2)}ms`);
    });

    it('should handle mixed operation types efficiently', async () => {
      const notebook = createLargeNotebook(100, 1000);
      const notebookPath = await createNotebookFile('mixed-ops.ipynb', notebook);

      const operationTypes = ['replace', 'insert', 'delete'] as const;
      const operationCount = 30;
      const operations: Promise<any>[] = [];
      const startTime = performance.now();

      // Create mixed operations
      for (let i = 0; i < operationCount; i++) {
        const opType = operationTypes[i % 3];
        let params: NotebookEditParams;

        switch (opType) {
          case 'replace':
            params = {
              notebook_path: notebookPath,
              cell_id: `cell-${i + 10}`, // Use cells 10-40
              new_source: `# Mixed operation ${i} (replace)\nprint(f"Replaced operation {i}")`,
              edit_mode: 'replace'
            };
            break;
          case 'insert':
            params = {
              notebook_path: notebookPath,
              cell_id: `cell-${i + 50}`, // Use cells 50-80 as anchors
              new_source: `# Mixed operation ${i} (insert)\nprint(f"Inserted operation {i}")`,
              cell_type: 'code',
              edit_mode: 'insert'
            };
            break;
          case 'delete':
            params = {
              notebook_path: notebookPath,
              cell_id: `cell-${i + 80}`, // Use cells 80+
              new_source: '',
              edit_mode: 'delete'
            };
            break;
        }

        operations.push(tool.execute(params));
      }

      const results = await Promise.all(operations);
      const endTime = performance.now();
      const duration = endTime - startTime;

      // Count successful operations by type
      const successCounts = { replace: 0, insert: 0, delete: 0 };
      results.forEach((result, index) => {
        if (result.success) {
          const opType = operationTypes[index % 3];
          successCounts[opType]++;
        }
      });

      // Most operations should succeed (some deletes might fail if cells don't exist)
      expect(successCounts.replace + successCounts.insert + successCounts.delete)
        .toBeGreaterThanOrEqual(operationCount * 0.8); // At least 80% success rate

      console.log(`${operationCount} mixed operations: ${duration.toFixed(2)}ms`);
      console.log(`  - Replace: ${successCounts.replace} successes`);
      console.log(`  - Insert: ${successCounts.insert} successes`);
      console.log(`  - Delete: ${successCounts.delete} successes`);
    });
  });

  // ============================================================================
  // Memory and Resource Usage Tests
  // ============================================================================

  describe('Memory and Resource Usage', () => {
    it('should not leak memory during repeated operations', async () => {
      const notebook = createLargeNotebook(50, 1000);
      const notebookPath = await createNotebookFile('memory-test.ipynb', notebook);

      const initialMemory = getMemoryUsage();
      const iterations = 100;

      // Perform many operations
      for (let i = 0; i < iterations; i++) {
        await tool.execute({
          notebook_path: notebookPath,
          cell_id: `cell-${i % 50}`,
          new_source: `# Memory test iteration ${i}\nprint(f"Iteration {i}")`,
          edit_mode: 'replace'
        });

        // Trigger garbage collection periodically if available
        if (global.gc && i % 20 === 0) {
          global.gc();
        }
      }

      const finalMemory = getMemoryUsage();

      if (initialMemory && finalMemory) {
        const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
        const memoryIncreasePerOp = memoryIncrease / iterations;

        // Memory increase per operation should be minimal (less than 1MB)
        expect(memoryIncreasePerOp).toBeLessThan(1024 * 1024);

        console.log(`Memory usage after ${iterations} operations:`);
        console.log(`  - Total increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
        console.log(`  - Per operation: ${(memoryIncreasePerOp / 1024).toFixed(2)}KB`);
      }
    });

    it('should handle content with extreme sizes efficiently', async () => {
      const notebook = createLargeNotebook(10, 500);
      const notebookPath = await createNotebookFile('extreme-content.ipynb', notebook);

      // Create very large cell content (1MB)
      const largeContent = '# Large content test\n' + 'x'.repeat(1024 * 1024);

      const startTime = performance.now();
      const startMemory = getMemoryUsage();

      const result = await tool.execute({
        notebook_path: notebookPath,
        cell_id: 'cell-5',
        new_source: largeContent,
        edit_mode: 'replace'
      });

      const endTime = performance.now();
      const endMemory = getMemoryUsage();
      const duration = endTime - startTime;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(3000); // Should complete in under 3 seconds

      // Content preview should be truncated appropriately
      const output = result.output as NotebookEditOutput;
      expect(output.contentPreview.length).toBeLessThanOrEqual(210); // Max preview size

      if (startMemory && endMemory) {
        const memoryIncrease = endMemory.heapUsed - startMemory.heapUsed;
        // Memory increase should be reasonable (not more than 3x content size)
        expect(memoryIncrease).toBeLessThan(largeContent.length * 3);
      }

      console.log(`Extreme content (1MB): ${duration.toFixed(2)}ms`);
    });

    it('should maintain performance consistency across multiple tool instances', async () => {
      const notebook = createLargeNotebook(30, 1000);
      const notebookPaths = await Promise.all([
        createNotebookFile('instance1.ipynb', notebook),
        createNotebookFile('instance2.ipynb', notebook),
        createNotebookFile('instance3.ipynb', notebook)
      ]);

      const tools = [new NotebookEditTool(), new NotebookEditTool(), new NotebookEditTool()];
      const timings: number[] = [];

      // Test each tool instance
      for (let i = 0; i < tools.length; i++) {
        const startTime = performance.now();

        await tools[i].execute({
          notebook_path: notebookPaths[i],
          cell_id: 'cell-15',
          new_source: `# Tool instance ${i + 1} test\nprint(f"Instance {i + 1}")`,
          edit_mode: 'replace'
        });

        const endTime = performance.now();
        timings.push(endTime - startTime);
      }

      // All timings should be similar (within 50% of each other)
      const avgTiming = timings.reduce((a, b) => a + b, 0) / timings.length;
      timings.forEach(timing => {
        expect(Math.abs(timing - avgTiming) / avgTiming).toBeLessThan(0.5);
      });

      console.log(`Multi-instance performance: ${timings.map(t => t.toFixed(2)).join('ms, ')}ms`);
    });
  });
});