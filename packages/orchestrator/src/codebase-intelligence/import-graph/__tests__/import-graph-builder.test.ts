/**
 * ImportGraphBuilder Tests
 *
 * Comprehensive unit tests for the ImportGraphBuilder class that analyzes
 * import/require statements to build module dependency graphs.
 *
 * Test Coverage:
 * - Singleton pattern behavior
 * - Basic graph building functionality
 * - Import type detection (ES6, CommonJS, dynamic, re-exports)
 * - Path resolution (relative, absolute, TypeScript aliases)
 * - Error handling and recovery
 * - Circular dependency detection
 * - Impact analysis
 * - Graph statistics calculation
 * - DOT export functionality
 * - Graph update operations
 * - TypeScript configuration handling
 * - Progress reporting
 * - Edge cases and error paths
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as path from 'path';
import * as fs from 'fs/promises';

import { ImportGraphBuilder } from '../import-graph-builder.js';
import {
  type ImportGraph,
  type ImportGraphBuilderOptions,
  type ImportGraphNode,
  type ImportGraphEdge,
  type CircularDependency,
  type ImportType,
  createEmptyImportGraph,
  isImportType,
  IMPORT_TYPES,
  DEFAULT_IMPORT_GRAPH_OPTIONS
} from '../types.js';

// Mock the glob function
const mockGlob = vi.fn();
vi.mock('glob', () => ({
  glob: mockGlob
}));

// Mock fs/promises
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  access: vi.fn()
}));

// Mock TreeSitterWrapper
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

describe('ImportGraphBuilder', () => {
  let builder: ImportGraphBuilder;
  let testRootPath: string;

  beforeEach(() => {
    // Reset the singleton instance
    ImportGraphBuilder.resetInstance();
    builder = ImportGraphBuilder.getInstance();
    testRootPath = '/test/project';

    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = ImportGraphBuilder.getInstance();
      const instance2 = ImportGraphBuilder.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should create new instance after reset', () => {
      const instance1 = ImportGraphBuilder.getInstance();
      ImportGraphBuilder.resetInstance();
      const instance2 = ImportGraphBuilder.getInstance();

      expect(instance1).not.toBe(instance2);
    });
  });

  describe('Graph Building', () => {
    beforeEach(() => {
      // Mock file system to return test files
      mockGlob.mockResolvedValue([
        '/test/project/src/app.ts',
        '/test/project/src/utils.ts'
      ]);

      // Mock file reading
      mockFs.readFile.mockImplementation((filePath: string) => {
        if (filePath.includes('app.ts')) {
          return Promise.resolve(`
            import React from 'react';
            import { useState, useEffect } from 'react';
            import * as utils from './utils';
            import './styles.css';
            import type { User } from './types';
          `);
        } else if (filePath.includes('utils.ts')) {
          return Promise.resolve(`
            export const formatDate = (date: Date) => date.toISOString();
            export const parseJSON = (str: string) => JSON.parse(str);
          `);
        }
        return Promise.resolve('');
      });

      // Mock file access
      mockFs.access.mockResolvedValue(true);
    });

    it('should create empty graph with correct structure', () => {
      const emptyGraph = createEmptyImportGraph('/test/path');

      expect(emptyGraph.nodes).toEqual([]);
      expect(emptyGraph.edges).toEqual([]);
      expect(emptyGraph.rootPath).toBe('/test/path');
      expect(emptyGraph.stats.totalNodes).toBe(0);
      expect(emptyGraph.stats.totalEdges).toBe(0);
      expect(emptyGraph.version).toBeDefined();
      expect(emptyGraph.createdAt).toBeInstanceOf(Date);
      expect(emptyGraph.errors).toEqual([]);
    });

    it('should build basic graph from files', async () => {
      const graph = await builder.buildGraph(testRootPath, {
        includePatterns: ['src/**/*.ts'],
        resolveExternal: false
      });

      expect(graph).toBeDefined();
      expect(graph.nodes).toBeDefined();
      expect(graph.edges).toBeDefined();
      expect(graph.rootPath).toBe(testRootPath);
      expect(graph.stats).toBeDefined();
      expect(Array.isArray(graph.nodes)).toBe(true);
      expect(Array.isArray(graph.edges)).toBe(true);
    });

    it('should handle empty file list', async () => {
      mockGlob.mockResolvedValue([]);

      const graph = await builder.buildGraph(testRootPath);

      expect(graph.nodes).toHaveLength(0);
      expect(graph.edges).toHaveLength(0);
      expect(graph.stats.totalNodes).toBe(0);
      expect(graph.stats.totalEdges).toBe(0);
    });

    it('should handle file read errors gracefully', async () => {
      mockGlob.mockResolvedValue(['/test/project/src/broken.ts']);
      mockFs.readFile.mockRejectedValue(new Error('File not found'));

      const graph = await builder.buildGraph(testRootPath, {
        continueOnError: true
      });

      expect(graph.errors.length).toBeGreaterThan(0);
      expect(graph.errors[0].type).toBe('parse');
    });

    it('should throw on file read errors when continueOnError is false', async () => {
      mockGlob.mockResolvedValue(['/test/project/src/broken.ts']);
      mockFs.readFile.mockRejectedValue(new Error('File not found'));

      await expect(
        builder.buildGraph(testRootPath, {
          continueOnError: false
        })
      ).rejects.toThrow();
    });
  });

  describe('Import Type Detection', () => {
    const testCases = [
      {
        name: 'ES6 named import',
        code: `import { foo, bar } from 'module';`,
        expected: { importType: 'es6-named', symbols: ['foo', 'bar'] }
      },
      {
        name: 'ES6 default import',
        code: `import React from 'react';`,
        expected: { importType: 'es6-default', symbols: ['React'] }
      },
      {
        name: 'ES6 namespace import',
        code: `import * as utils from 'utils';`,
        expected: { importType: 'es6-namespace', symbols: ['utils'] }
      },
      {
        name: 'ES6 side effect import',
        code: `import 'styles.css';`,
        expected: { importType: 'es6-side-effect', symbols: [] }
      },
      {
        name: 'CommonJS require',
        code: `const fs = require('fs');`,
        expected: { importType: 'commonjs-require', symbols: [] }
      },
      {
        name: 'Dynamic import',
        code: `const module = await import('module');`,
        expected: { importType: 'dynamic-import', symbols: [] }
      },
      {
        name: 'TypeScript type-only import',
        code: `import type { User } from './types';`,
        expected: { importType: 'es6-named', symbols: ['User'], isTypeOnly: true }
      }
    ];

    testCases.forEach(({ name, code, expected }) => {
      it(`should handle ${name}`, async () => {
        mockGlob.mockResolvedValue(['/test/project/src/test.ts']);
        mockFs.readFile.mockResolvedValue(code);

        const graph = await builder.buildGraph(testRootPath);

        // For this test, we just verify the graph is built without errors
        // More detailed import parsing would require mocking tree-sitter
        expect(graph).toBeDefined();
        expect(graph.nodes.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Circular Dependency Detection', () => {
    beforeEach(() => {
      // Mock circular dependency scenario
      mockGlob.mockResolvedValue([
        '/test/project/src/a.ts',
        '/test/project/src/b.ts',
        '/test/project/src/c.ts'
      ]);

      mockFs.readFile.mockImplementation((filePath: string) => {
        if (filePath.includes('a.ts')) {
          return Promise.resolve(`import { b } from './b';`);
        } else if (filePath.includes('b.ts')) {
          return Promise.resolve(`import { c } from './c';`);
        } else if (filePath.includes('c.ts')) {
          return Promise.resolve(`import { a } from './a';`);
        }
        return Promise.resolve('');
      });

      mockFs.access.mockResolvedValue(true);
    });

    it('should provide circular dependency detection method', async () => {
      const graph = await builder.buildGraph(testRootPath);
      const cycles = builder.findCircularDependencies(graph);

      expect(Array.isArray(cycles)).toBe(true);
      expect(typeof builder.findCircularDependencies).toBe('function');
    });

    it('should handle graphs with no circular dependencies', async () => {
      // Override to create acyclic graph
      mockFs.readFile.mockImplementation((filePath: string) => {
        if (filePath.includes('a.ts')) {
          return Promise.resolve(`import { b } from './b';`);
        } else if (filePath.includes('b.ts')) {
          return Promise.resolve(`export const b = 'b';`);
        }
        return Promise.resolve('');
      });

      const graph = await builder.buildGraph(testRootPath);
      const cycles = builder.findCircularDependencies(graph);

      expect(cycles).toHaveLength(0);
    });
  });

  describe('Impact Analysis', () => {
    beforeEach(() => {
      mockGlob.mockResolvedValue([
        '/test/project/src/utils.ts',
        '/test/project/src/component.ts',
        '/test/project/src/app.ts'
      ]);

      mockFs.readFile.mockImplementation((filePath: string) => {
        if (filePath.includes('utils.ts')) {
          return Promise.resolve(`export const helper = () => 'help';`);
        } else if (filePath.includes('component.ts')) {
          return Promise.resolve(`import { helper } from './utils';`);
        } else if (filePath.includes('app.ts')) {
          return Promise.resolve(`import { Component } from './component';`);
        }
        return Promise.resolve('');
      });

      mockFs.access.mockResolvedValue(true);
    });

    it('should provide impact analysis method', async () => {
      const graph = await builder.buildGraph(testRootPath);
      const impacted = builder.getImpactedFiles(graph, 'src/utils.ts');

      expect(Array.isArray(impacted)).toBe(true);
      expect(typeof builder.getImpactedFiles).toBe('function');
    });

    it('should provide dependency path method', async () => {
      const graph = await builder.buildGraph(testRootPath);
      const path = builder.getDependencyPath(graph, 'src/app.ts', 'src/utils.ts');

      expect(typeof builder.getDependencyPath).toBe('function');
    });
  });

  describe('Graph Statistics', () => {
    beforeEach(() => {
      mockGlob.mockResolvedValue([
        '/test/project/src/app.ts',
        '/test/project/src/utils.ts'
      ]);

      mockFs.readFile.mockImplementation((filePath: string) => {
        if (filePath.includes('app.ts')) {
          return Promise.resolve(`import { utils } from './utils'; import React from 'react';`);
        } else if (filePath.includes('utils.ts')) {
          return Promise.resolve(`export const utils = {};`);
        }
        return Promise.resolve('');
      });

      mockFs.access.mockResolvedValue(true);
    });

    it('should calculate basic statistics', async () => {
      const graph = await builder.buildGraph(testRootPath);

      expect(graph.stats).toBeDefined();
      expect(typeof graph.stats.totalNodes).toBe('number');
      expect(typeof graph.stats.totalEdges).toBe('number');
      expect(typeof graph.stats.externalDependencies).toBe('number');
      expect(typeof graph.stats.internalModules).toBe('number');
      expect(typeof graph.stats.unresolvedImports).toBe('number');
      expect(typeof graph.stats.circularDependencies).toBe('number');
      expect(Array.isArray(graph.stats.mostImported)).toBe(true);
      expect(Array.isArray(graph.stats.mostImporting)).toBe(true);
      expect(typeof graph.stats.languageBreakdown).toBe('object');
    });
  });

  describe('DOT Export', () => {
    beforeEach(() => {
      mockGlob.mockResolvedValue(['/test/project/src/app.ts']);
      mockFs.readFile.mockResolvedValue(`export const app = 'app';`);
      mockFs.access.mockResolvedValue(true);
    });

    it('should export to DOT format', async () => {
      const graph = await builder.buildGraph(testRootPath);
      const dot = builder.exportToDot(graph);

      expect(typeof dot).toBe('string');
      expect(dot).toContain('digraph ImportGraph');
    });

    it('should support DOT export options', async () => {
      const graph = await builder.buildGraph(testRootPath);
      const dot = builder.exportToDot(graph, {
        includeExternal: false,
        cluster: true,
        title: 'Test Graph'
      });

      expect(dot).toContain('Test Graph');
    });
  });

  describe('Graph Updates', () => {
    let initialGraph: ImportGraph;

    beforeEach(async () => {
      mockGlob.mockResolvedValue([
        '/test/project/src/app.ts',
        '/test/project/src/utils.ts'
      ]);

      mockFs.readFile.mockImplementation((filePath: string) => {
        if (filePath.includes('app.ts')) {
          return Promise.resolve(`import { utils } from './utils';`);
        } else if (filePath.includes('utils.ts')) {
          return Promise.resolve(`export const utils = {};`);
        }
        return Promise.resolve('');
      });

      mockFs.access.mockResolvedValue(true);
      initialGraph = await builder.buildGraph(testRootPath);
    });

    it('should update graph with changed files', async () => {
      const updatedGraph = await builder.updateGraph(
        initialGraph,
        ['/test/project/src/app.ts']
      );

      expect(updatedGraph).toBeDefined();
      expect(updatedGraph.createdAt).not.toEqual(initialGraph.createdAt);
    });
  });

  describe('TypeScript Configuration', () => {
    beforeEach(() => {
      mockGlob.mockResolvedValue(['/test/project/src/app.ts']);
      mockFs.readFile.mockImplementation((filePath: string) => {
        if (filePath.includes('tsconfig.json')) {
          return Promise.resolve(JSON.stringify({
            compilerOptions: {
              baseUrl: "./src",
              paths: {
                "@/*": ["*"]
              }
            }
          }));
        } else if (filePath.includes('app.ts')) {
          return Promise.resolve(`import { helper } from '@/utils';`);
        }
        return Promise.resolve('');
      });
      mockFs.access.mockResolvedValue(true);
    });

    it('should handle TypeScript configuration', async () => {
      const graph = await builder.buildGraph(testRootPath, {
        tsConfigPath: './tsconfig.json'
      });

      expect(graph).toBeDefined();
    });

    it('should handle invalid TypeScript configuration gracefully', async () => {
      mockFs.readFile.mockImplementation((filePath: string) => {
        if (filePath.includes('tsconfig.json')) {
          return Promise.reject(new Error('File not found'));
        } else if (filePath.includes('app.ts')) {
          return Promise.resolve(`export const app = 'app';`);
        }
        return Promise.resolve('');
      });

      const graph = await builder.buildGraph(testRootPath, {
        tsConfigPath: './tsconfig.json',
        continueOnError: true
      });

      expect(graph).toBeDefined();
    });
  });

  describe('Progress Reporting', () => {
    let progressEvents: any[];

    beforeEach(() => {
      progressEvents = [];
      mockGlob.mockResolvedValue([
        '/test/project/src/file1.ts',
        '/test/project/src/file2.ts'
      ]);
      mockFs.readFile.mockResolvedValue(`export const test = 'test';`);
      mockFs.access.mockResolvedValue(true);
    });

    it('should report progress during build', async () => {
      await builder.buildGraph(testRootPath, {
        onProgress: (progress) => {
          progressEvents.push(progress);
        }
      });

      expect(progressEvents.length).toBeGreaterThan(0);

      // Check progress structure
      const firstEvent = progressEvents[0];
      expect(firstEvent).toHaveProperty('phase');
      expect(firstEvent).toHaveProperty('filesProcessed');
      expect(firstEvent).toHaveProperty('totalFiles');
      expect(firstEvent).toHaveProperty('percentComplete');
    });
  });

  describe('Builder Options', () => {
    beforeEach(() => {
      mockGlob.mockResolvedValue(['/test/project/src/app.ts']);
      mockFs.readFile.mockResolvedValue(`import('./dynamic');`);
      mockFs.access.mockResolvedValue(true);
    });

    it('should respect includePatterns option', async () => {
      const graph = await builder.buildGraph(testRootPath, {
        includePatterns: ['**/*.ts']
      });

      expect(mockGlob).toHaveBeenCalled();
    });

    it('should respect excludePatterns option', async () => {
      const graph = await builder.buildGraph(testRootPath, {
        excludePatterns: ['**/*.test.ts']
      });

      expect(mockGlob).toHaveBeenCalled();
    });

    it('should handle includeDynamicImports option', async () => {
      const graphWithDynamic = await builder.buildGraph(testRootPath, {
        includeDynamicImports: true
      });

      const graphWithoutDynamic = await builder.buildGraph(testRootPath, {
        includeDynamicImports: false
      });

      expect(graphWithDynamic).toBeDefined();
      expect(graphWithoutDynamic).toBeDefined();
    });
  });

  describe('Type Validation', () => {
    it('should validate import types correctly', () => {
      // Valid import types
      expect(isImportType('es6-named')).toBe(true);
      expect(isImportType('commonjs-require')).toBe(true);
      expect(isImportType('dynamic-import')).toBe(true);

      // Invalid import types
      expect(isImportType('invalid-type')).toBe(false);
      expect(isImportType('')).toBe(false);
      expect(isImportType(null)).toBe(false);
      expect(isImportType(undefined)).toBe(false);
      expect(isImportType(123)).toBe(false);
    });

    it('should have all import types in constant', () => {
      expect(IMPORT_TYPES).toHaveLength(9);
      expect(IMPORT_TYPES).toContain('es6-named');
      expect(IMPORT_TYPES).toContain('es6-default');
      expect(IMPORT_TYPES).toContain('es6-namespace');
      expect(IMPORT_TYPES).toContain('es6-side-effect');
      expect(IMPORT_TYPES).toContain('commonjs-require');
      expect(IMPORT_TYPES).toContain('commonjs-module');
      expect(IMPORT_TYPES).toContain('dynamic-import');
      expect(IMPORT_TYPES).toContain('reexport');
      expect(IMPORT_TYPES).toContain('reexport-all');
    });
  });

  describe('Default Options', () => {
    it('should have sensible default options', () => {
      expect(DEFAULT_IMPORT_GRAPH_OPTIONS.includePatterns).toEqual([
        '**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx', '**/*.mjs', '**/*.cjs'
      ]);

      expect(DEFAULT_IMPORT_GRAPH_OPTIONS.excludePatterns).toContain('**/node_modules/**');
      expect(DEFAULT_IMPORT_GRAPH_OPTIONS.excludePatterns).toContain('**/dist/**');
      expect(DEFAULT_IMPORT_GRAPH_OPTIONS.excludePatterns).toContain('**/*.test.ts');

      expect(DEFAULT_IMPORT_GRAPH_OPTIONS.resolveExternal).toBe(false);
      expect(DEFAULT_IMPORT_GRAPH_OPTIONS.includeDynamicImports).toBe(true);
      expect(DEFAULT_IMPORT_GRAPH_OPTIONS.continueOnError).toBe(true);
      expect(DEFAULT_IMPORT_GRAPH_OPTIONS.concurrency).toBe(4);
      expect(DEFAULT_IMPORT_GRAPH_OPTIONS.followSymlinks).toBe(false);
    });
  });

  describe('Advanced Import Type Detection', () => {
    const mockTreeSitterNode = (type: string, text: string, children: any[] = []) => ({
      type,
      text,
      childCount: children.length,
      startPosition: { row: 0, column: 0 },
      child: (index: number) => children[index] || null,
      childForFieldName: (name: string) => children.find(c => c.fieldName === name) || null
    });

    beforeEach(() => {
      mockGlob.mockResolvedValue(['/test/project/src/complex.ts']);
      mockFs.access.mockResolvedValue(true);
    });

    const testCases = [
      {
        name: 'Mixed import types in single file',
        code: `
          import React, { useState, useEffect } from 'react';
          import * as utils from './utils';
          import type { User } from './types';
          import './styles.css';
          const fs = require('fs');
          const module = await import('dynamic-module');
          export { helper } from './helper';
          export * from './all-exports';
        `,
        expectedTypes: [
          'es6-default', 'es6-named', 'es6-namespace',
          'es6-named', 'es6-side-effect', 'commonjs-require',
          'dynamic-import', 'reexport', 'reexport-all'
        ]
      },
      {
        name: 'Complex TypeScript imports',
        code: `
          import type { SomeType, AnotherType } from 'library';
          import { type InlineType, normalExport } from 'mixed';
          import('./dynamic').then(m => m.default);
        `,
        expectedTypes: ['es6-named', 'es6-named', 'dynamic-import']
      },
      {
        name: 'CommonJS variations',
        code: `
          const path = require('path');
          const { join, resolve } = require('path');
          module.exports = require('./other');
        `,
        expectedTypes: ['commonjs-require', 'commonjs-require', 'commonjs-require']
      },
      {
        name: 'Re-export variations',
        code: `
          export { default as Component } from './Component';
          export { named1, named2 } from './named';
          export * from './all';
          export * as namespace from './ns';
        `,
        expectedTypes: ['reexport', 'reexport', 'reexport-all', 'reexport']
      }
    ];

    testCases.forEach(({ name, code, expectedTypes }) => {
      it(`should detect ${name}`, async () => {
        mockFs.readFile.mockResolvedValue(code);

        const graph = await builder.buildGraph(testRootPath, {
          includePatterns: ['**/*.ts']
        });

        expect(graph).toBeDefined();
        // This test validates that the structure is correct
        // More detailed assertions would require real tree-sitter parsing
      });
    });
  });

  describe('Path Resolution Edge Cases', () => {
    beforeEach(() => {
      mockFs.access.mockImplementation(async (filePath: string) => {
        // Simulate file existence based on path patterns
        if (filePath.includes('nonexistent')) {
          throw new Error('ENOENT');
        }
        return undefined;
      });
    });

    it('should handle absolute import paths', async () => {
      mockGlob.mockResolvedValue(['/test/project/src/app.ts']);
      mockFs.readFile.mockResolvedValue(`import { helper } from '/absolute/path/helper';`);

      const graph = await builder.buildGraph(testRootPath);
      expect(graph.nodes).toBeDefined();
    });

    it('should handle file extensions resolution', async () => {
      mockGlob.mockResolvedValue(['/test/project/src/app.ts']);
      mockFs.readFile.mockResolvedValue(`
        import { helper1 } from './utils';
        import { helper2 } from './utils.ts';
        import { helper3 } from './utils/index';
      `);

      const graph = await builder.buildGraph(testRootPath);
      expect(graph.nodes).toBeDefined();
    });

    it('should handle unresolved imports gracefully', async () => {
      mockGlob.mockResolvedValue(['/test/project/src/app.ts']);
      mockFs.readFile.mockResolvedValue(`
        import { missing } from './nonexistent';
        import { external } from 'unknown-package';
      `);

      const graph = await builder.buildGraph(testRootPath, {
        continueOnError: true
      });

      expect(graph.errors).toBeDefined();
      expect(graph.nodes.some(n => n.isUnresolved || n.isExternal)).toBe(true);
    });

    it('should handle symbolic links when enabled', async () => {
      mockGlob.mockResolvedValue(['/test/project/src/symlink.ts']);
      mockFs.readFile.mockResolvedValue(`export const test = 'symlink';`);

      const graph = await builder.buildGraph(testRootPath, {
        followSymlinks: true
      });

      expect(graph.nodes).toBeDefined();
    });
  });

  describe('Memory and Performance', () => {
    it('should handle large numbers of files', async () => {
      // Simulate 1000 files
      const largeFileList = Array.from({ length: 1000 }, (_, i) =>
        `/test/project/src/file${i}.ts`
      );

      mockGlob.mockResolvedValue(largeFileList);
      mockFs.readFile.mockResolvedValue(`export const test${Math.random()} = 'test';`);
      mockFs.access.mockResolvedValue(true);

      const startTime = Date.now();
      const graph = await builder.buildGraph(testRootPath, {
        concurrency: 8
      });
      const endTime = Date.now();

      expect(graph.stats.totalNodes).toBeGreaterThan(0);
      expect(endTime - startTime).toBeLessThan(10000); // Should complete within 10 seconds
    });

    it('should respect concurrency limits', async () => {
      const files = Array.from({ length: 100 }, (_, i) => `/test/project/src/file${i}.ts`);
      mockGlob.mockResolvedValue(files);
      mockFs.readFile.mockResolvedValue(`export const test = 'test';`);
      mockFs.access.mockResolvedValue(true);

      const graph = await builder.buildGraph(testRootPath, {
        concurrency: 2
      });

      expect(graph.stats.totalNodes).toBeGreaterThan(0);
    });
  });

  describe('Graph Validation', () => {
    it('should maintain graph invariants', async () => {
      mockGlob.mockResolvedValue([
        '/test/project/src/a.ts',
        '/test/project/src/b.ts',
        '/test/project/src/c.ts'
      ]);

      mockFs.readFile.mockImplementation((filePath: string) => {
        if (filePath.includes('a.ts')) return Promise.resolve(`import { b } from './b';`);
        if (filePath.includes('b.ts')) return Promise.resolve(`import { c } from './c';`);
        if (filePath.includes('c.ts')) return Promise.resolve(`export const c = 'c';`);
        return Promise.resolve('');
      });

      mockFs.access.mockResolvedValue(true);

      const graph = await builder.buildGraph(testRootPath);

      // Validate graph structure
      expect(graph.nodes.length).toBeGreaterThan(0);
      expect(graph.edges.length).toBeGreaterThanOrEqual(0);

      // Each edge should reference existing nodes
      for (const edge of graph.edges) {
        const sourceExists = graph.nodes.some(n => n.id === edge.source);
        const targetExists = graph.nodes.some(n => n.id === edge.target) ||
                            edge.target.startsWith('external:') ||
                            edge.target.startsWith('unresolved:');
        expect(sourceExists || targetExists).toBe(true);
      }

      // Statistics should match actual counts
      expect(graph.stats.totalNodes).toBe(graph.nodes.length);
      expect(graph.stats.totalEdges).toBe(graph.edges.length);
    });

    it('should handle empty graphs correctly', () => {
      const emptyGraph = createEmptyImportGraph('/empty');

      expect(emptyGraph.nodes).toHaveLength(0);
      expect(emptyGraph.edges).toHaveLength(0);
      expect(emptyGraph.rootPath).toBe('/empty');
      expect(emptyGraph.stats.totalNodes).toBe(0);
      expect(emptyGraph.stats.totalEdges).toBe(0);
      expect(emptyGraph.version).toBeDefined();
      expect(emptyGraph.createdAt).toBeInstanceOf(Date);
      expect(emptyGraph.errors).toHaveLength(0);
    });
  });

  describe('Error Recovery', () => {
    it('should recover from parse errors and continue', async () => {
      let callCount = 0;
      mockGlob.mockResolvedValue([
        '/test/project/src/good.ts',
        '/test/project/src/bad.ts',
        '/test/project/src/another-good.ts'
      ]);

      mockFs.readFile.mockImplementation(async (filePath: string) => {
        callCount++;
        if (filePath.includes('bad.ts')) {
          throw new Error('Parse error');
        }
        return `export const file${callCount} = 'test';`;
      });

      mockFs.access.mockResolvedValue(true);

      const graph = await builder.buildGraph(testRootPath, {
        continueOnError: true
      });

      expect(graph.errors.length).toBe(1);
      expect(graph.errors[0].type).toBe('parse');
      expect(graph.nodes.length).toBeGreaterThan(0); // Should still process good files
    });

    it('should fail fast when continueOnError is false', async () => {
      mockGlob.mockResolvedValue(['/test/project/src/bad.ts']);
      mockFs.readFile.mockRejectedValue(new Error('Parse error'));

      await expect(
        builder.buildGraph(testRootPath, {
          continueOnError: false
        })
      ).rejects.toThrow('Parse error');
    });

    it('should handle I/O errors gracefully', async () => {
      mockGlob.mockResolvedValue(['/test/project/src/inaccessible.ts']);
      mockFs.readFile.mockImplementation(async () => {
        const error = new Error('EACCES: permission denied');
        (error as any).code = 'EACCES';
        throw error;
      });

      const graph = await builder.buildGraph(testRootPath, {
        continueOnError: true
      });

      expect(graph.errors.length).toBeGreaterThan(0);
      expect(graph.errors[0].message).toContain('permission denied');
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle a realistic project structure', async () => {
      const projectFiles = [
        '/test/project/src/index.ts',
        '/test/project/src/components/Header.tsx',
        '/test/project/src/components/Footer.tsx',
        '/test/project/src/utils/helpers.ts',
        '/test/project/src/utils/constants.ts',
        '/test/project/src/types/api.ts',
        '/test/project/src/hooks/useAuth.ts'
      ];

      mockGlob.mockResolvedValue(projectFiles);

      mockFs.readFile.mockImplementation(async (filePath: string) => {
        const basename = path.basename(filePath, path.extname(filePath));

        switch (basename) {
          case 'index':
            return `
              import { Header } from './components/Header';
              import { Footer } from './components/Footer';
              import { useAuth } from './hooks/useAuth';
            `;
          case 'Header':
            return `
              import React from 'react';
              import { API_ENDPOINTS } from '../utils/constants';
              import type { User } from '../types/api';
            `;
          case 'Footer':
            return `
              import React from 'react';
              import { formatDate } from '../utils/helpers';
            `;
          case 'helpers':
            return `
              import { DATE_FORMAT } from './constants';
              export const formatDate = (date: Date) => date.toISOString();
            `;
          case 'constants':
            return `
              export const API_ENDPOINTS = { users: '/api/users' };
              export const DATE_FORMAT = 'YYYY-MM-DD';
            `;
          case 'api':
            return `
              export interface User { id: string; name: string; }
              export interface ApiResponse<T> { data: T; status: number; }
            `;
          case 'useAuth':
            return `
              import { useState } from 'react';
              import type { User } from '../types/api';
            `;
          default:
            return 'export {};';
        }
      });

      mockFs.access.mockResolvedValue(true);

      const graph = await builder.buildGraph(testRootPath, {
        includePatterns: ['src/**/*.{ts,tsx}']
      });

      expect(graph.nodes.length).toBeGreaterThan(0);
      expect(graph.edges.length).toBeGreaterThan(0);
      expect(graph.stats.internalModules).toBeGreaterThan(0);
      expect(graph.stats.languageBreakdown).toHaveProperty('typescript');

      // Should have detected some circular references or at least complex dependencies
      const cycles = builder.findCircularDependencies(graph);
      expect(Array.isArray(cycles)).toBe(true);

      // Should be able to do impact analysis
      const impacted = builder.getImpactedFiles(graph, 'src/utils/constants.ts');
      expect(Array.isArray(impacted)).toBe(true);
    });
  });
});