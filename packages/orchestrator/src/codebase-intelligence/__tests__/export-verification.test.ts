/**
 * Export Verification Tests for CodebaseIndexer and SymbolResolver
 *
 * Tests specifically verify that both classes are properly exported from:
 * 1. The codebase-intelligence/index.ts module
 * 2. The main orchestrator/index.ts module
 *
 * These tests ensure the acceptance criteria are met:
 * - CodebaseIndexer and SymbolResolver are exported from packages/orchestrator/src/codebase-intelligence/index.ts
 * - CodebaseIndexer and SymbolResolver are exported from packages/orchestrator/src/index.ts
 * - Integration tests verify exports work correctly
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('CodebaseIndexer and SymbolResolver Export Verification', () => {
  beforeEach(() => {
    // Clear any module cache to ensure fresh imports
    vi.resetModules();
  });

  afterEach(() => {
    // Clean up any singleton instances
    try {
      const { CodebaseIndexer } = require('../indexer.js');
      CodebaseIndexer.resetInstance?.();
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Codebase Intelligence Module Exports', () => {
    it('should export CodebaseIndexer class from codebase-intelligence index', async () => {
      const exports = await import('../index.js');

      expect(exports.CodebaseIndexer).toBeDefined();
      expect(typeof exports.CodebaseIndexer).toBe('function');
      expect(exports.CodebaseIndexer.name).toBe('CodebaseIndexer');
    });

    it('should export getCodebaseIndexer convenience function from codebase-intelligence index', async () => {
      const exports = await import('../index.js');

      expect(exports.getCodebaseIndexer).toBeDefined();
      expect(typeof exports.getCodebaseIndexer).toBe('function');
      expect(exports.getCodebaseIndexer.name).toBe('getCodebaseIndexer');
    });

    it('should export indexer types from codebase-intelligence index', async () => {
      const exports = await import('../index.js');

      // These are type-only exports, so we can't directly test them at runtime
      // But we can verify the module loads without errors and has the expected shape
      expect(exports).toHaveProperty('CodebaseIndexer');
      expect(exports).toHaveProperty('getCodebaseIndexer');

      // We can indirectly verify types by creating instances
      const indexer = exports.CodebaseIndexer.getInstance();
      expect(indexer).toBeDefined();
      expect(typeof indexer.indexDirectory).toBe('function');
      expect(typeof indexer.indexFile).toBe('function');

      // Clean up
      exports.CodebaseIndexer.resetInstance();
    });

    it('should export SymbolResolver class from codebase-intelligence index', async () => {
      const exports = await import('../index.js');

      expect(exports.SymbolResolver).toBeDefined();
      expect(typeof exports.SymbolResolver).toBe('function');
      expect(exports.SymbolResolver.name).toBe('SymbolResolver');
    });

    it('should export SymbolResolver types from codebase-intelligence index', async () => {
      const exports = await import('../index.js');

      // These are type-only exports, so we can't directly test them at runtime
      // But we can verify the module loads without errors and has the expected shape
      expect(exports).toHaveProperty('SymbolResolver');

      // We can indirectly verify by creating instances (need a mock RepositoryMap)
      const mockRepoMap = {
        rootPath: '/test',
        files: [],
        references: [],
        stats: { totalFiles: 0, totalSymbols: 0, totalReferences: 0 }
      };

      const resolver = new exports.SymbolResolver(mockRepoMap);
      expect(resolver).toBeDefined();
      expect(typeof resolver.findDefinition).toBe('function');
      expect(typeof resolver.findReferences).toBe('function');
      expect(typeof resolver.hasSymbol).toBe('function');
      expect(typeof resolver.getStats).toBe('function');
    });
  });

  describe('Main Orchestrator Module Exports', () => {
    it('should export CodebaseIndexer class from main orchestrator index', async () => {
      const exports = await import('../../index.js');

      expect(exports.CodebaseIndexer).toBeDefined();
      expect(typeof exports.CodebaseIndexer).toBe('function');
      expect(exports.CodebaseIndexer.name).toBe('CodebaseIndexer');
    });

    it('should export getCodebaseIndexer convenience function from main orchestrator index', async () => {
      const exports = await import('../../index.js');

      expect(exports.getCodebaseIndexer).toBeDefined();
      expect(typeof exports.getCodebaseIndexer).toBe('function');
      expect(exports.getCodebaseIndexer.name).toBe('getCodebaseIndexer');
    });

    it('should maintain consistency between codebase-intelligence and main exports', async () => {
      const codebaseExports = await import('../index.js');
      const mainExports = await import('../../index.js');

      // Both should export the same CodebaseIndexer class
      expect(mainExports.CodebaseIndexer).toBe(codebaseExports.CodebaseIndexer);
      expect(mainExports.getCodebaseIndexer).toBe(codebaseExports.getCodebaseIndexer);
    });

    it('should export SymbolResolver class from main orchestrator index', async () => {
      const exports = await import('../../index.js');

      expect(exports.SymbolResolver).toBeDefined();
      expect(typeof exports.SymbolResolver).toBe('function');
      expect(exports.SymbolResolver.name).toBe('SymbolResolver');
    });

    it('should maintain consistency between codebase-intelligence and main SymbolResolver exports', async () => {
      const codebaseExports = await import('../index.js');
      const mainExports = await import('../../index.js');

      // Both should export the same SymbolResolver class
      expect(mainExports.SymbolResolver).toBe(codebaseExports.SymbolResolver);
    });
  });

  describe('Export Functionality Verification', () => {
    it('should create working CodebaseIndexer instance from codebase-intelligence exports', async () => {
      const { CodebaseIndexer } = await import('../index.js');

      // Reset and create instance
      CodebaseIndexer.resetInstance();
      const indexer = CodebaseIndexer.getInstance();

      expect(indexer).toBeDefined();
      expect(typeof indexer.indexDirectory).toBe('function');
      expect(typeof indexer.indexFile).toBe('function');
      expect(typeof indexer.getSupportedExtensions).toBe('function');

      // Test that methods are callable (even if they don't do much without real files)
      const extensions = indexer.getSupportedExtensions();
      expect(Array.isArray(extensions)).toBe(true);
      expect(extensions.length).toBeGreaterThan(0);

      // Clean up
      CodebaseIndexer.resetInstance();
    });

    it('should create working CodebaseIndexer instance from main orchestrator exports', async () => {
      const { CodebaseIndexer } = await import('../../index.js');

      // Reset and create instance
      CodebaseIndexer.resetInstance();
      const indexer = CodebaseIndexer.getInstance();

      expect(indexer).toBeDefined();
      expect(typeof indexer.indexDirectory).toBe('function');
      expect(typeof indexer.indexFile).toBe('function');
      expect(typeof indexer.getSupportedExtensions).toBe('function');

      // Test that methods are callable
      const extensions = indexer.getSupportedExtensions();
      expect(Array.isArray(extensions)).toBe(true);
      expect(extensions.length).toBeGreaterThan(0);

      // Clean up
      CodebaseIndexer.resetInstance();
    });

    it('should create working instance using getCodebaseIndexer convenience function from codebase-intelligence exports', async () => {
      const { getCodebaseIndexer, CodebaseIndexer } = await import('../index.js');

      // Reset singleton
      CodebaseIndexer.resetInstance();

      const indexer = getCodebaseIndexer();
      expect(indexer).toBeDefined();
      expect(typeof indexer.indexDirectory).toBe('function');

      // Should be same instance as CodebaseIndexer.getInstance()
      const indexer2 = CodebaseIndexer.getInstance();
      expect(indexer).toBe(indexer2);

      // Clean up
      CodebaseIndexer.resetInstance();
    });

    it('should create working instance using getCodebaseIndexer convenience function from main orchestrator exports', async () => {
      const { getCodebaseIndexer, CodebaseIndexer } = await import('../../index.js');

      // Reset singleton
      CodebaseIndexer.resetInstance();

      const indexer = getCodebaseIndexer();
      expect(indexer).toBeDefined();
      expect(typeof indexer.indexDirectory).toBe('function');

      // Should be same instance as CodebaseIndexer.getInstance()
      const indexer2 = CodebaseIndexer.getInstance();
      expect(indexer).toBe(indexer2);

      // Clean up
      CodebaseIndexer.resetInstance();
    });

    it('should create working SymbolResolver instance from codebase-intelligence exports', async () => {
      const { SymbolResolver } = await import('../index.js');

      // Create a mock repository map
      const mockRepoMap = {
        rootPath: '/test',
        name: 'test-project',
        files: [{
          path: 'test.ts',
          language: 'typescript',
          symbols: [{
            name: 'testFunction',
            type: 'function' as const,
            filePath: 'test.ts',
            startLine: 1,
            endLine: 5,
            startColumn: 0,
            endColumn: 10,
            exported: true
          }],
          imports: [],
          exports: [],
          lineCount: 10,
          lastModified: new Date()
        }],
        references: [],
        stats: { totalFiles: 1, totalSymbols: 1, totalReferences: 0 }
      };

      const resolver = new SymbolResolver(mockRepoMap);
      expect(resolver).toBeDefined();
      expect(typeof resolver.findDefinition).toBe('function');
      expect(typeof resolver.findReferences).toBe('function');
      expect(typeof resolver.hasSymbol).toBe('function');

      // Test that methods are callable
      const definitions = resolver.findDefinition('testFunction');
      expect(Array.isArray(definitions)).toBe(true);
      expect(definitions.length).toBe(1);
      expect(definitions[0].symbol.name).toBe('testFunction');

      const hasSymbol = resolver.hasSymbol('testFunction');
      expect(hasSymbol).toBe(true);

      const stats = resolver.getStats();
      expect(stats).toBeDefined();
      expect(stats.totalSymbols).toBe(1);
    });

    it('should create working SymbolResolver instance from main orchestrator exports', async () => {
      const { SymbolResolver } = await import('../../index.js');

      // Create a mock repository map
      const mockRepoMap = {
        rootPath: '/test',
        name: 'test-project',
        files: [{
          path: 'test.ts',
          language: 'typescript',
          symbols: [{
            name: 'testClass',
            type: 'class' as const,
            filePath: 'test.ts',
            startLine: 1,
            endLine: 10,
            startColumn: 0,
            endColumn: 20,
            exported: true
          }],
          imports: [],
          exports: [],
          lineCount: 15,
          lastModified: new Date()
        }],
        references: [],
        stats: { totalFiles: 1, totalSymbols: 1, totalReferences: 0 }
      };

      const resolver = new SymbolResolver(mockRepoMap);
      expect(resolver).toBeDefined();
      expect(typeof resolver.findDefinition).toBe('function');

      // Test functionality
      const definitions = resolver.findDefinition('testClass');
      expect(Array.isArray(definitions)).toBe(true);
      expect(definitions.length).toBe(1);
      expect(definitions[0].symbol.name).toBe('testClass');
    });
  });

  describe('Consumer Usage Patterns', () => {
    it('should support named imports from codebase-intelligence module', async () => {
      // This tests the most common usage pattern
      const { CodebaseIndexer, getCodebaseIndexer } = await import('../index.js');

      expect(CodebaseIndexer).toBeDefined();
      expect(getCodebaseIndexer).toBeDefined();

      // Test they work as expected
      CodebaseIndexer.resetInstance();
      const indexer1 = CodebaseIndexer.getInstance();
      const indexer2 = getCodebaseIndexer();
      expect(indexer1).toBe(indexer2);

      CodebaseIndexer.resetInstance();
    });

    it('should support named imports from main orchestrator module', async () => {
      // This tests usage when importing from the main package
      const { CodebaseIndexer, getCodebaseIndexer } = await import('../../index.js');

      expect(CodebaseIndexer).toBeDefined();
      expect(getCodebaseIndexer).toBeDefined();

      // Test they work as expected
      CodebaseIndexer.resetInstance();
      const indexer1 = CodebaseIndexer.getInstance();
      const indexer2 = getCodebaseIndexer();
      expect(indexer1).toBe(indexer2);

      CodebaseIndexer.resetInstance();
    });

    it('should support wildcard imports from codebase-intelligence module', async () => {
      // This tests importing all exports
      const exports = await import('../index.js');

      expect(exports).toHaveProperty('CodebaseIndexer');
      expect(exports).toHaveProperty('getCodebaseIndexer');

      // Test they work
      exports.CodebaseIndexer.resetInstance();
      const indexer = exports.getCodebaseIndexer();
      expect(indexer).toBeDefined();

      exports.CodebaseIndexer.resetInstance();
    });

    it('should support wildcard imports from main orchestrator module', async () => {
      // This tests importing all exports from main package
      const exports = await import('../../index.js');

      expect(exports).toHaveProperty('CodebaseIndexer');
      expect(exports).toHaveProperty('getCodebaseIndexer');

      // Test they work
      exports.CodebaseIndexer.resetInstance();
      const indexer = exports.getCodebaseIndexer();
      expect(indexer).toBeDefined();

      exports.CodebaseIndexer.resetInstance();
    });
  });

  describe('TypeScript Compatibility', () => {
    it('should have proper TypeScript types available through exports', async () => {
      // Import and verify the module exports work with TypeScript
      const codebaseExports = await import('../index.js');
      const mainExports = await import('../../index.js');

      // This test will fail at TypeScript compile time if types aren't properly exported
      // At runtime, we can verify the exports exist and are functional

      // Test codebase-intelligence exports
      expect(typeof codebaseExports.CodebaseIndexer).toBe('function');
      expect(typeof codebaseExports.getCodebaseIndexer).toBe('function');

      // Test main orchestrator exports
      expect(typeof mainExports.CodebaseIndexer).toBe('function');
      expect(typeof mainExports.getCodebaseIndexer).toBe('function');

      // Create instances to verify type compatibility
      codebaseExports.CodebaseIndexer.resetInstance();
      mainExports.CodebaseIndexer.resetInstance();

      const cbIndexer = codebaseExports.CodebaseIndexer.getInstance();
      const mainIndexer = mainExports.CodebaseIndexer.getInstance();

      // They should have the same interface
      expect(typeof cbIndexer.indexDirectory).toBe('function');
      expect(typeof mainIndexer.indexDirectory).toBe('function');

      codebaseExports.CodebaseIndexer.resetInstance();
      mainExports.CodebaseIndexer.resetInstance();
    });
  });
});