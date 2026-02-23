/**
 * ImportGraphBuilder Performance Tests
 *
 * Performance, benchmarking, and stress tests for the ImportGraphBuilder
 * to ensure it can handle large codebases efficiently.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as path from 'path';
import * as fs from 'fs/promises';

import { ImportGraphBuilder } from '../import-graph-builder.js';
import {
  type ImportGraph,
  type ImportGraphBuilderOptions,
} from '../types.js';

// Mock dependencies
const mockGlob = vi.fn();
vi.mock('glob', () => ({
  glob: mockGlob
}));

vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  access: vi.fn()
}));

vi.mock('../parsers/tree-sitter-wrapper.js', () => ({
  TreeSitterWrapper: {
    getInstance: vi.fn(() => ({
      parse: vi.fn().mockResolvedValue({
        rootNode: {
          childCount: 0,
          child: vi.fn().mockReturnValue(null)
        }
      })
    }))
  }
}));

const mockFs = fs as any;

describe('ImportGraphBuilder Performance', () => {
  let builder: ImportGraphBuilder;
  let testRootPath: string;

  beforeEach(() => {
    ImportGraphBuilder.resetInstance();
    builder = ImportGraphBuilder.getInstance();
    testRootPath = '/test/project';
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Scalability Tests', () => {
    it('should handle 1000 files efficiently', async () => {
      const fileCount = 1000;
      const files = Array.from({ length: fileCount }, (_, i) =>
        `/test/project/src/file-${String(i).padStart(4, '0')}.ts`
      );

      mockGlob.mockResolvedValue(files);

      // Generate varied import patterns to create a realistic graph
      mockFs.readFile.mockImplementation(async (filePath: string) => {
        const fileIndex = parseInt(path.basename(filePath, '.ts').split('-')[1]);

        // Create imports to other files to build a connected graph
        const imports: string[] = [];

        // Each file imports from 1-5 other files
        const importCount = 1 + (fileIndex % 5);
        for (let i = 0; i < importCount; i++) {
          const targetIndex = (fileIndex + i + 1) % fileCount;
          imports.push(`import { func${targetIndex} } from './file-${String(targetIndex).padStart(4, '0')}';`);
        }

        // Add some external imports
        if (fileIndex % 10 === 0) {
          imports.push("import React from 'react';");
          imports.push("import _ from 'lodash';");
        }

        // Add some re-exports
        if (fileIndex % 20 === 0) {
          const reexportIndex = (fileIndex + 10) % fileCount;
          imports.push(`export * from './file-${String(reexportIndex).padStart(4, '0')}';`);
        }

        return `${imports.join('\n')}\n\nexport const func${fileIndex} = () => ${fileIndex};`;
      });

      mockFs.access.mockResolvedValue(true);

      const startTime = performance.now();
      const startMemory = process.memoryUsage().heapUsed;

      const graph = await builder.buildGraph(testRootPath, {
        concurrency: 8,
        continueOnError: true
      });

      const endTime = performance.now();
      const endMemory = process.memoryUsage().heapUsed;

      // Performance assertions
      const duration = endTime - startTime;
      const memoryIncrease = endMemory - startMemory;

      expect(graph.stats.totalNodes).toBe(fileCount);
      expect(graph.stats.totalEdges).toBeGreaterThan(fileCount); // Should have many edges

      // Performance requirements
      expect(duration).toBeLessThan(30000); // Should complete within 30 seconds
      expect(memoryIncrease).toBeLessThan(200 * 1024 * 1024); // Memory increase < 200MB

      console.log(`Performance metrics for ${fileCount} files:`);
      console.log(`  Duration: ${duration.toFixed(2)}ms`);
      console.log(`  Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
      console.log(`  Nodes: ${graph.stats.totalNodes}`);
      console.log(`  Edges: ${graph.stats.totalEdges}`);
    });

    it('should handle files with many imports efficiently', async () => {
      const filesWithManyImports = [
        '/test/project/src/heavy-importer.ts',
        '/test/project/src/another-heavy.ts'
      ];

      mockGlob.mockResolvedValue(filesWithManyImports);

      mockFs.readFile.mockImplementation(async (filePath: string) => {
        // Each file imports from 500 different modules
        const imports = Array.from({ length: 500 }, (_, i) => {
          if (i % 3 === 0) {
            return `import { symbol${i} } from 'external-lib-${i}';`;
          } else if (i % 3 === 1) {
            return `import symbol${i} from './module-${i}';`;
          } else {
            return `import * as ns${i} from './namespace-${i}';`;
          }
        });

        return imports.join('\n') + '\n\nexport const heavy = true;';
      });

      mockFs.access.mockResolvedValue(true);

      const startTime = performance.now();

      const graph = await builder.buildGraph(testRootPath, {
        resolveExternal: false // Don't try to resolve 500 external packages
      });

      const endTime = performance.now();

      expect(graph.stats.totalEdges).toBeGreaterThan(900); // Should have ~1000 edges
      expect(endTime - startTime).toBeLessThan(15000); // Should complete within 15 seconds
    });

    it('should handle deeply nested import chains', async () => {
      const chainLength = 100;
      const files = Array.from({ length: chainLength }, (_, i) =>
        `/test/project/src/chain-${i}.ts`
      );

      mockGlob.mockResolvedValue(files);

      mockFs.readFile.mockImplementation(async (filePath: string) => {
        const fileIndex = parseInt(path.basename(filePath, '.ts').split('-')[1]);

        if (fileIndex === chainLength - 1) {
          // Last file in chain
          return `export const chainEnd = true;`;
        } else {
          // Import from next file in chain
          return `
            import { chain${fileIndex + 1} } from './chain-${fileIndex + 1}';
            export const chain${fileIndex} = chain${fileIndex + 1};
          `;
        }
      });

      mockFs.access.mockResolvedValue(true);

      const graph = await builder.buildGraph(testRootPath);

      // Should create a long dependency chain
      expect(graph.stats.totalNodes).toBe(chainLength);
      expect(graph.stats.totalEdges).toBe(chainLength - 1);

      // Test impact analysis on deep chains
      const startFile = files[0];
      const impacted = builder.getImpactedFiles(graph, files[chainLength - 1]);

      expect(impacted.length).toBe(chainLength - 1); // All files except the last one
    });
  });

  describe('Concurrent Processing Tests', () => {
    it('should maintain correctness with high concurrency', async () => {
      const fileCount = 100;
      const files = Array.from({ length: fileCount }, (_, i) =>
        `/test/project/src/concurrent-${i}.ts`
      );

      mockGlob.mockResolvedValue(files);

      let readOrder: number[] = [];

      mockFs.readFile.mockImplementation(async (filePath: string) => {
        const fileIndex = parseInt(path.basename(filePath, '.ts').split('-')[1]);

        // Simulate varying processing times to test race conditions
        const delay = Math.random() * 50;
        await new Promise(resolve => setTimeout(resolve, delay));

        readOrder.push(fileIndex);

        // Each file imports from file with index + 1 (mod fileCount)
        const nextIndex = (fileIndex + 1) % fileCount;
        return `
          import { func${nextIndex} } from './concurrent-${nextIndex}';
          export const func${fileIndex} = () => ${fileIndex};
        `;
      });

      mockFs.access.mockResolvedValue(true);

      const graph = await builder.buildGraph(testRootPath, {
        concurrency: 20 // High concurrency
      });

      // Should have processed all files
      expect(readOrder.length).toBe(fileCount);

      // Should have correct graph structure
      expect(graph.stats.totalNodes).toBe(fileCount);
      expect(graph.stats.totalEdges).toBe(fileCount); // Each file imports one other file
    });

    it('should handle concurrency with error scenarios', async () => {
      const files = Array.from({ length: 50 }, (_, i) =>
        `/test/project/src/error-test-${i}.ts`
      );

      mockGlob.mockResolvedValue(files);

      mockFs.readFile.mockImplementation(async (filePath: string) => {
        const fileIndex = parseInt(path.basename(filePath, '.ts').split('-')[2]);

        // Simulate random delays
        await new Promise(resolve => setTimeout(resolve, Math.random() * 20));

        // Make every 5th file fail
        if (fileIndex % 5 === 0) {
          throw new Error(`Simulated error for file ${fileIndex}`);
        }

        return `export const file${fileIndex} = true;`;
      });

      mockFs.access.mockResolvedValue(true);

      const graph = await builder.buildGraph(testRootPath, {
        concurrency: 10,
        continueOnError: true
      });

      // Should have processed 40 successful files and 10 errors
      expect(graph.nodes.length).toBe(40);
      expect(graph.errors.length).toBe(10);
    });
  });

  describe('Memory Management Tests', () => {
    it('should not leak memory during large graph operations', async () => {
      const fileCount = 500;
      const files = Array.from({ length: fileCount }, (_, i) =>
        `/test/project/src/memory-test-${i}.ts`
      );

      mockGlob.mockResolvedValue(files);

      mockFs.readFile.mockImplementation(async (filePath: string) => {
        const fileIndex = parseInt(path.basename(filePath, '.ts').split('-')[2]);

        // Create complex import patterns
        const imports = [];
        for (let i = 0; i < 5; i++) {
          const targetIndex = (fileIndex + i + 1) % fileCount;
          imports.push(`import { symbol${i} } from './memory-test-${targetIndex}';`);
        }

        return imports.join('\n') + `\nexport const file${fileIndex} = {};`;
      });

      mockFs.access.mockResolvedValue(true);

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const initialMemory = process.memoryUsage().heapUsed;

      const graph = await builder.buildGraph(testRootPath);

      // Perform multiple operations that should not accumulate memory
      for (let i = 0; i < 10; i++) {
        builder.findCircularDependencies(graph);
        builder.getImpactedFiles(graph, files[i]);
        builder.exportToDot(graph, { includeExternal: false });
      }

      // Force garbage collection again
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory should not grow too much after operations
      expect(memoryIncrease).toBeLessThan(150 * 1024 * 1024); // < 150MB increase

      console.log(`Memory test results:`);
      console.log(`  Initial memory: ${(initialMemory / 1024 / 1024).toFixed(2)}MB`);
      console.log(`  Final memory: ${(finalMemory / 1024 / 1024).toFixed(2)}MB`);
      console.log(`  Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
    });

    it('should handle memory pressure gracefully', async () => {
      // Create a scenario that would use significant memory
      const largeFiles = Array.from({ length: 200 }, (_, i) =>
        `/test/project/src/large-${i}.ts`
      );

      mockGlob.mockResolvedValue(largeFiles);

      mockFs.readFile.mockImplementation(async (filePath: string) => {
        // Create very large files with many imports and exports
        const content = [];

        // Many imports
        for (let i = 0; i < 100; i++) {
          content.push(`import { symbol${i} } from 'external-${i}';`);
        }

        // Large amount of code (to simulate real large files)
        for (let i = 0; i < 1000; i++) {
          content.push(`export const generated${i} = 'value${i}';`);
        }

        return content.join('\n');
      });

      mockFs.access.mockResolvedValue(true);

      // This should not crash or run out of memory
      const graph = await builder.buildGraph(testRootPath, {
        concurrency: 4 // Lower concurrency to manage memory
      });

      expect(graph.stats.totalNodes).toBe(200);
      expect(graph.stats.totalEdges).toBeGreaterThan(19800); // ~100 imports per file * 200 files
    });
  });

  describe('Algorithm Efficiency Tests', () => {
    it('should efficiently detect circular dependencies in large graphs', async () => {
      // Create a graph with known circular dependencies
      const nodeCount = 1000;
      const files = Array.from({ length: nodeCount }, (_, i) =>
        `/test/project/src/circular-${i}.ts`
      );

      mockGlob.mockResolvedValue(files);

      mockFs.readFile.mockImplementation(async (filePath: string) => {
        const fileIndex = parseInt(path.basename(filePath, '.ts').split('-')[1]);

        // Create multiple circular dependency patterns
        const imports = [];

        // Create cycles of different sizes
        if (fileIndex < 100) {
          // Small cycles (3 nodes each)
          const cycleBase = Math.floor(fileIndex / 3) * 3;
          const nextInCycle = cycleBase + ((fileIndex - cycleBase + 1) % 3);
          imports.push(`import { func${nextInCycle} } from './circular-${nextInCycle}';`);
        } else if (fileIndex < 200) {
          // Medium cycles (10 nodes each)
          const cycleBase = 100 + Math.floor((fileIndex - 100) / 10) * 10;
          const nextInCycle = cycleBase + ((fileIndex - cycleBase + 1) % 10);
          imports.push(`import { func${nextInCycle} } from './circular-${nextInCycle}';`);
        } else {
          // Linear dependencies (no cycles)
          if (fileIndex < nodeCount - 1) {
            imports.push(`import { func${fileIndex + 1} } from './circular-${fileIndex + 1}';`);
          }
        }

        return imports.join('\n') + `\nexport const func${fileIndex} = () => ${fileIndex};`;
      });

      mockFs.access.mockResolvedValue(true);

      const graph = await builder.buildGraph(testRootPath);

      const startTime = performance.now();
      const cycles = builder.findCircularDependencies(graph);
      const endTime = performance.now();

      expect(cycles.length).toBeGreaterThan(0); // Should find the cycles we created
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds

      console.log(`Circular dependency detection for ${nodeCount} nodes:`);
      console.log(`  Found ${cycles.length} cycles in ${(endTime - startTime).toFixed(2)}ms`);
    });

    it('should efficiently perform impact analysis on large graphs', async () => {
      const nodeCount = 2000;
      const files = Array.from({ length: nodeCount }, (_, i) =>
        `/test/project/src/impact-${i}.ts`
      );

      mockGlob.mockResolvedValue(files);

      mockFs.readFile.mockImplementation(async (filePath: string) => {
        const fileIndex = parseInt(path.basename(filePath, '.ts').split('-')[1]);

        // Create a tree-like structure where impact analysis will traverse many nodes
        const imports = [];

        // Each node imports from 2-3 "parent" nodes
        const parent1 = Math.floor(fileIndex / 2);
        const parent2 = Math.floor(fileIndex / 3);

        if (parent1 !== fileIndex && parent1 >= 0) {
          imports.push(`import { func${parent1} } from './impact-${parent1}';`);
        }
        if (parent2 !== fileIndex && parent2 !== parent1 && parent2 >= 0) {
          imports.push(`import { func${parent2} } from './impact-${parent2}';`);
        }

        return imports.join('\n') + `\nexport const func${fileIndex} = () => ${fileIndex};`;
      });

      mockFs.access.mockResolvedValue(true);

      const graph = await builder.buildGraph(testRootPath);

      // Test impact analysis on a root node
      const rootFile = 'src/impact-0.ts';

      const startTime = performance.now();
      const impacted = builder.getImpactedFiles(graph, rootFile);
      const endTime = performance.now();

      expect(impacted.length).toBeGreaterThan(100); // Should impact many files
      expect(endTime - startTime).toBeLessThan(1000); // Should be fast (< 1 second)

      console.log(`Impact analysis for ${nodeCount} nodes:`);
      console.log(`  Found ${impacted.length} impacted files in ${(endTime - startTime).toFixed(2)}ms`);
    });
  });

  describe('Stress Tests', () => {
    it('should handle extreme import patterns', async () => {
      const files = [
        '/test/project/src/extreme-importer.ts',
        '/test/project/src/extreme-exporter.ts'
      ];

      mockGlob.mockResolvedValue(files);

      mockFs.readFile.mockImplementation(async (filePath: string) => {
        if (filePath.includes('extreme-importer.ts')) {
          // File with every possible import pattern
          return `
            // ES6 imports
            import defaultImport from 'default-module';
            import { named1, named2, named3 } from 'named-module';
            import * as namespace from 'namespace-module';
            import 'side-effect-module';
            import type { TypeA, TypeB } from 'type-module';

            // Dynamic imports
            const dynamic1 = import('dynamic-1');
            const dynamic2 = await import('dynamic-2');

            // CommonJS
            const required = require('required-module');
            const { destructured } = require('destructured-module');

            // Mixed imports from same modules
            import React, { useState, useEffect } from 'react';
            import type { ReactNode } from 'react';

            // Re-exports
            export { reexported1, reexported2 } from './other-module';
            export * from './all-exports';
            export type { ExportedType } from './type-exports';

            // Conditional imports (should not be detected as static)
            if (condition) {
              const conditional = require('conditional-module');
            }
          `;
        } else {
          // File with many exports
          const exports = Array.from({ length: 1000 }, (_, i) =>
            `export const export${i} = ${i};`
          );

          return exports.join('\n');
        }
      });

      mockFs.access.mockResolvedValue(true);

      const graph = await builder.buildGraph(testRootPath, {
        includeDynamicImports: true,
        resolveExternal: false
      });

      expect(graph.stats.totalEdges).toBeGreaterThan(10); // Should capture many imports
      expect(graph.nodes.some(n => n.isExternal)).toBe(true); // Should have external nodes
    });

    it('should maintain performance under error conditions', async () => {
      const fileCount = 500;
      const files = Array.from({ length: fileCount }, (_, i) =>
        `/test/project/src/error-stress-${i}.ts`
      );

      mockGlob.mockResolvedValue(files);

      let errorCount = 0;
      mockFs.readFile.mockImplementation(async (filePath: string) => {
        const fileIndex = parseInt(path.basename(filePath, '.ts').split('-')[2]);

        // Random delay to simulate real I/O
        await new Promise(resolve => setTimeout(resolve, Math.random() * 10));

        // 20% of files will error
        if (Math.random() < 0.2) {
          errorCount++;
          throw new Error(`Random error ${errorCount}`);
        }

        return `
          import { func${(fileIndex + 1) % fileCount} } from './error-stress-${(fileIndex + 1) % fileCount}';
          export const func${fileIndex} = () => ${fileIndex};
        `;
      });

      mockFs.access.mockResolvedValue(true);

      const startTime = performance.now();

      const graph = await builder.buildGraph(testRootPath, {
        continueOnError: true,
        concurrency: 10
      });

      const endTime = performance.now();

      expect(graph.errors.length).toBeGreaterThan(0);
      expect(graph.nodes.length).toBeLessThan(fileCount); // Some files failed
      expect(endTime - startTime).toBeLessThan(20000); // Should still complete reasonably fast

      console.log(`Stress test with errors:`);
      console.log(`  Processed ${graph.nodes.length} files successfully`);
      console.log(`  Encountered ${graph.errors.length} errors`);
      console.log(`  Completed in ${(endTime - startTime).toFixed(2)}ms`);
    });
  });
});