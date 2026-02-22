/**
 * Export Verification Tests for CodebaseIndexer
 *
 * Tests specifically verify that CodebaseIndexer is properly exported from:
 * 1. The codebase-intelligence/index.ts module
 * 2. The main orchestrator/index.ts module
 *
 * These tests ensure the acceptance criteria are met:
 * - CodebaseIndexer is exported from packages/orchestrator/src/codebase-intelligence/index.ts
 * - CodebaseIndexer is exported from packages/orchestrator/src/index.ts
 * - Integration tests verify exports work correctly
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('CodebaseIndexer Export Verification', () => {
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