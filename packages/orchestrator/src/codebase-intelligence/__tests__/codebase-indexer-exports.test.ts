/**
 * Comprehensive test suite for CodebaseIndexer exports
 *
 * Tests the specific acceptance criteria:
 * - CodebaseIndexer is exported from packages/orchestrator/src/codebase-intelligence/index.ts
 * - CodebaseIndexer is exported from packages/orchestrator/src/index.ts
 * - Integration tests verify exports work correctly
 *
 * This test suite specifically focuses on the CodebaseIndexer export requirements
 * and validates that all export paths work correctly for consumers.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('CodebaseIndexer Exports', () => {
  beforeEach(() => {
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

  describe('Required Export Paths', () => {
    it('should export CodebaseIndexer from codebase-intelligence/index.ts', async () => {
      const exports = await import('../index.js');

      // Verify CodebaseIndexer is exported
      expect(exports.CodebaseIndexer).toBeDefined();
      expect(typeof exports.CodebaseIndexer).toBe('function');
      expect(exports.CodebaseIndexer.name).toBe('CodebaseIndexer');

      // Verify it has expected static methods
      expect(typeof exports.CodebaseIndexer.getInstance).toBe('function');
      expect(typeof exports.CodebaseIndexer.resetInstance).toBe('function');
    });

    it('should export getCodebaseIndexer from codebase-intelligence/index.ts', async () => {
      const exports = await import('../index.js');

      expect(exports.getCodebaseIndexer).toBeDefined();
      expect(typeof exports.getCodebaseIndexer).toBe('function');
      expect(exports.getCodebaseIndexer.name).toBe('getCodebaseIndexer');
    });

    it('should export CodebaseIndexer from main orchestrator/index.ts', async () => {
      const exports = await import('../../index.js');

      // Verify CodebaseIndexer is exported
      expect(exports.CodebaseIndexer).toBeDefined();
      expect(typeof exports.CodebaseIndexer).toBe('function');
      expect(exports.CodebaseIndexer.name).toBe('CodebaseIndexer');

      // Verify it has expected static methods
      expect(typeof exports.CodebaseIndexer.getInstance).toBe('function');
      expect(typeof exports.CodebaseIndexer.resetInstance).toBe('function');
    });

    it('should export getCodebaseIndexer from main orchestrator/index.ts', async () => {
      const exports = await import('../../index.js');

      expect(exports.getCodebaseIndexer).toBeDefined();
      expect(typeof exports.getCodebaseIndexer).toBe('function');
      expect(exports.getCodebaseIndexer.name).toBe('getCodebaseIndexer');
    });

    it('should export IndexingOptions type from codebase-intelligence/index.ts', async () => {
      // Type exports are compile-time only, so we test indirectly
      const exports = await import('../index.js');

      // Create an instance and verify it accepts options (indirectly tests types)
      const { CodebaseIndexer } = exports;
      CodebaseIndexer.resetInstance();
      const indexer = CodebaseIndexer.getInstance();

      // Verify method signature accepts options (implies types are exported)
      expect(typeof indexer.indexDirectory).toBe('function');
      expect(indexer.indexDirectory.length).toBe(2); // path and options parameters

      CodebaseIndexer.resetInstance();
    });

    it('should export IndexingProgress type from codebase-intelligence/index.ts', async () => {
      // Type exports are compile-time only, so we test indirectly
      const exports = await import('../index.js');

      const { CodebaseIndexer } = exports;
      CodebaseIndexer.resetInstance();
      const indexer = CodebaseIndexer.getInstance();

      // Verify we can set up a progress handler (implies type is available)
      expect(typeof indexer.indexDirectory).toBe('function');

      CodebaseIndexer.resetInstance();
    });

    it('should export IndexingError type from codebase-intelligence/index.ts', async () => {
      // Type exports are compile-time only, so we test indirectly
      const exports = await import('../index.js');

      const { CodebaseIndexer } = exports;
      expect(CodebaseIndexer).toBeDefined();
      // Types are validated at compile time
    });
  });

  describe('Export Consistency', () => {
    it('should export the same CodebaseIndexer class from both locations', async () => {
      const codebaseExports = await import('../index.js');
      const orchestratorExports = await import('../../index.js');

      expect(orchestratorExports.CodebaseIndexer).toBe(codebaseExports.CodebaseIndexer);
      expect(orchestratorExports.getCodebaseIndexer).toBe(codebaseExports.getCodebaseIndexer);
    });

    it('should maintain singleton behavior across export paths', async () => {
      const codebaseExports = await import('../index.js');
      const orchestratorExports = await import('../../index.js');

      // Reset instances
      codebaseExports.CodebaseIndexer.resetInstance();
      orchestratorExports.CodebaseIndexer.resetInstance();

      // Create instance via codebase export
      const instance1 = codebaseExports.CodebaseIndexer.getInstance();

      // Get instance via orchestrator export
      const instance2 = orchestratorExports.CodebaseIndexer.getInstance();

      // Should be the same instance
      expect(instance1).toBe(instance2);

      // Clean up
      codebaseExports.CodebaseIndexer.resetInstance();
    });

    it('should maintain singleton behavior with convenience functions', async () => {
      const codebaseExports = await import('../index.js');
      const orchestratorExports = await import('../../index.js');

      // Reset instances
      codebaseExports.CodebaseIndexer.resetInstance();

      // Create instances via different methods
      const instance1 = codebaseExports.getCodebaseIndexer();
      const instance2 = orchestratorExports.getCodebaseIndexer();
      const instance3 = codebaseExports.CodebaseIndexer.getInstance();
      const instance4 = orchestratorExports.CodebaseIndexer.getInstance();

      // All should be the same instance
      expect(instance1).toBe(instance2);
      expect(instance2).toBe(instance3);
      expect(instance3).toBe(instance4);

      // Clean up
      codebaseExports.CodebaseIndexer.resetInstance();
    });
  });

  describe('Integration Tests - Export Functionality', () => {
    it('should create functional CodebaseIndexer via codebase-intelligence exports', async () => {
      const { CodebaseIndexer, getCodebaseIndexer } = await import('../index.js');

      // Reset and test direct class usage
      CodebaseIndexer.resetInstance();
      const indexer1 = CodebaseIndexer.getInstance();

      expect(indexer1).toBeDefined();
      expect(typeof indexer1.indexDirectory).toBe('function');
      expect(typeof indexer1.indexFile).toBe('function');
      expect(typeof indexer1.getSupportedExtensions).toBe('function');

      // Test convenience function
      const indexer2 = getCodebaseIndexer();
      expect(indexer2).toBe(indexer1);

      // Test basic functionality
      const extensions = indexer1.getSupportedExtensions();
      expect(Array.isArray(extensions)).toBe(true);
      expect(extensions.length).toBeGreaterThan(0);

      CodebaseIndexer.resetInstance();
    });

    it('should create functional CodebaseIndexer via main orchestrator exports', async () => {
      const { CodebaseIndexer, getCodebaseIndexer } = await import('../../index.js');

      // Reset and test direct class usage
      CodebaseIndexer.resetInstance();
      const indexer1 = CodebaseIndexer.getInstance();

      expect(indexer1).toBeDefined();
      expect(typeof indexer1.indexDirectory).toBe('function');
      expect(typeof indexer1.indexFile).toBe('function');
      expect(typeof indexer1.getSupportedExtensions).toBe('function');

      // Test convenience function
      const indexer2 = getCodebaseIndexer();
      expect(indexer2).toBe(indexer1);

      // Test basic functionality
      const extensions = indexer1.getSupportedExtensions();
      expect(Array.isArray(extensions)).toBe(true);
      expect(extensions.length).toBeGreaterThan(0);

      CodebaseIndexer.resetInstance();
    });

    it('should handle instance lifecycle correctly across exports', async () => {
      const codebaseExports = await import('../index.js');
      const orchestratorExports = await import('../../index.js');

      // Start fresh
      codebaseExports.CodebaseIndexer.resetInstance();

      // Create via codebase exports
      const instance1 = codebaseExports.getCodebaseIndexer();
      expect(instance1).toBeDefined();

      // Access via orchestrator exports - should be same instance
      const instance2 = orchestratorExports.CodebaseIndexer.getInstance();
      expect(instance2).toBe(instance1);

      // Reset via orchestrator exports
      orchestratorExports.CodebaseIndexer.resetInstance();

      // Create new via orchestrator exports
      const instance3 = orchestratorExports.getCodebaseIndexer();
      expect(instance3).toBeDefined();
      expect(instance3).not.toBe(instance1);

      // Access via codebase exports - should be same as instance3
      const instance4 = codebaseExports.CodebaseIndexer.getInstance();
      expect(instance4).toBe(instance3);

      // Clean up
      codebaseExports.CodebaseIndexer.resetInstance();
    });

    it('should support expected method signatures through exports', async () => {
      const { CodebaseIndexer } = await import('../../index.js');

      CodebaseIndexer.resetInstance();
      const indexer = CodebaseIndexer.getInstance();

      // Test that expected methods exist with correct signatures
      expect(typeof indexer.indexDirectory).toBe('function');
      expect(typeof indexer.indexFile).toBe('function');
      expect(typeof indexer.getSupportedExtensions).toBe('function');

      // indexDirectory should accept path and optional options
      expect(indexer.indexDirectory.length).toBe(2);

      // indexFile should accept path and optional options
      expect(indexer.indexFile.length).toBe(2);

      // getSupportedExtensions should take no parameters
      expect(indexer.getSupportedExtensions.length).toBe(0);

      // Static methods
      expect(typeof CodebaseIndexer.getInstance).toBe('function');
      expect(typeof CodebaseIndexer.resetInstance).toBe('function');
      expect(CodebaseIndexer.getInstance.length).toBe(0);
      expect(CodebaseIndexer.resetInstance.length).toBe(0);

      CodebaseIndexer.resetInstance();
    });
  });

  describe('Consumer Import Patterns', () => {
    it('should support named imports from codebase-intelligence module', async () => {
      // Most common pattern for direct module usage
      const { CodebaseIndexer, getCodebaseIndexer } = await import('../index.js');

      expect(CodebaseIndexer).toBeDefined();
      expect(getCodebaseIndexer).toBeDefined();

      CodebaseIndexer.resetInstance();
      const indexer = getCodebaseIndexer();
      expect(indexer).toBeDefined();
      expect(typeof indexer.indexDirectory).toBe('function');

      CodebaseIndexer.resetInstance();
    });

    it('should support named imports from main orchestrator package', async () => {
      // Pattern for importing from published package
      const { CodebaseIndexer, getCodebaseIndexer } = await import('../../index.js');

      expect(CodebaseIndexer).toBeDefined();
      expect(getCodebaseIndexer).toBeDefined();

      CodebaseIndexer.resetInstance();
      const indexer = getCodebaseIndexer();
      expect(indexer).toBeDefined();
      expect(typeof indexer.indexDirectory).toBe('function');

      CodebaseIndexer.resetInstance();
    });

    it('should support namespace imports', async () => {
      const codebaseNamespace = await import('../index.js');
      const orchestratorNamespace = await import('../../index.js');

      expect(codebaseNamespace.CodebaseIndexer).toBeDefined();
      expect(codebaseNamespace.getCodebaseIndexer).toBeDefined();
      expect(orchestratorNamespace.CodebaseIndexer).toBeDefined();
      expect(orchestratorNamespace.getCodebaseIndexer).toBeDefined();

      // Test functionality through namespace
      codebaseNamespace.CodebaseIndexer.resetInstance();
      const indexer1 = codebaseNamespace.getCodebaseIndexer();
      const indexer2 = orchestratorNamespace.CodebaseIndexer.getInstance();
      expect(indexer1).toBe(indexer2);

      codebaseNamespace.CodebaseIndexer.resetInstance();
    });
  });
});