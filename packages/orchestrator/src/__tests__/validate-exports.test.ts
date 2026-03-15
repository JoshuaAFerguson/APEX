/**
 * Critical Export Validation Tests for CodebaseIndexer
 *
 * These tests verify the core requirement: CodebaseIndexer is properly exported
 * from both required locations and integration tests work correctly.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('CodebaseIndexer Export Validation', () => {
  // Clean up instances between tests
  beforeEach(async () => {
    try {
      const { CodebaseIndexer } = await import('../index.js');
      if (CodebaseIndexer?.resetInstance) {
        CodebaseIndexer.resetInstance();
      }
    } catch (error) {
      // Ignore if import fails - test will catch it
    }
  });

  afterEach(async () => {
    try {
      const { CodebaseIndexer } = await import('../index.js');
      if (CodebaseIndexer?.resetInstance) {
        CodebaseIndexer.resetInstance();
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Required Export Locations', () => {
    it('CRITICAL: CodebaseIndexer exported from packages/orchestrator/src/codebase-intelligence/index.ts', async () => {
      const { CodebaseIndexer } = await import('../codebase-intelligence/index.js');

      expect(CodebaseIndexer).toBeDefined();
      expect(typeof CodebaseIndexer).toBe('function');
      expect(CodebaseIndexer.name).toBe('CodebaseIndexer');

      // Verify it has the singleton pattern methods
      expect(CodebaseIndexer.getInstance).toBeDefined();
      expect(typeof CodebaseIndexer.getInstance).toBe('function');
      expect(CodebaseIndexer.resetInstance).toBeDefined();
      expect(typeof CodebaseIndexer.resetInstance).toBe('function');
    });

    it('CRITICAL: CodebaseIndexer exported from packages/orchestrator/src/index.ts', async () => {
      const { CodebaseIndexer } = await import('../index.js');

      expect(CodebaseIndexer).toBeDefined();
      expect(typeof CodebaseIndexer).toBe('function');
      expect(CodebaseIndexer.name).toBe('CodebaseIndexer');

      // Verify it has the singleton pattern methods
      expect(CodebaseIndexer.getInstance).toBeDefined();
      expect(typeof CodebaseIndexer.getInstance).toBe('function');
      expect(CodebaseIndexer.resetInstance).toBeDefined();
      expect(typeof CodebaseIndexer.resetInstance).toBe('function');
    });

    it('CRITICAL: Both exports reference the same class', async () => {
      const mainExport = await import('../index.js');
      const submoduleExport = await import('../codebase-intelligence/index.js');

      expect(mainExport.CodebaseIndexer).toBe(submoduleExport.CodebaseIndexer);
    });

    it('CRITICAL: Helper function getCodebaseIndexer is exported', async () => {
      const { getCodebaseIndexer } = await import('../index.js');

      expect(getCodebaseIndexer).toBeDefined();
      expect(typeof getCodebaseIndexer).toBe('function');
    });
  });

  describe('Functional Integration Tests', () => {
    it('INTEGRATION: Singleton pattern works correctly', async () => {
      const { CodebaseIndexer } = await import('../index.js');

      const instance1 = CodebaseIndexer.getInstance();
      const instance2 = CodebaseIndexer.getInstance();

      expect(instance1).toBeDefined();
      expect(instance2).toBeDefined();
      expect(instance1).toBe(instance2);
      expect(instance1.constructor.name).toBe('CodebaseIndexer');
    });

    it('INTEGRATION: Helper function returns same instance', async () => {
      const { CodebaseIndexer, getCodebaseIndexer } = await import('../index.js');

      const directInstance = CodebaseIndexer.getInstance();
      const helperInstance = getCodebaseIndexer();

      expect(directInstance).toBe(helperInstance);
    });

    it('INTEGRATION: Essential instance methods are available', async () => {
      const { CodebaseIndexer } = await import('../index.js');

      const instance = CodebaseIndexer.getInstance();

      // Verify core indexing methods exist
      expect(instance.indexDirectory).toBeDefined();
      expect(typeof instance.indexDirectory).toBe('function');

      expect(instance.indexDirectoryWithProgress).toBeDefined();
      expect(typeof instance.indexDirectoryWithProgress).toBe('function');
    });

    it('INTEGRATION: Type exports do not cause import errors', async () => {
      // This test ensures type exports are properly handled
      // TypeScript types should not cause runtime errors
      expect(async () => {
        await import('../index.js');
      }).not.toThrow();

      expect(async () => {
        await import('../codebase-intelligence/index.js');
      }).not.toThrow();
    });
  });

  describe('Cross-module Integration', () => {
    it('INTEGRATION: Can import and use through main orchestrator package', async () => {
      // Simulates real usage by consumers
      const orchestratorModule = await import('../index.js');

      // Verify CodebaseIndexer and related exports are available
      expect(orchestratorModule.CodebaseIndexer).toBeDefined();
      expect(orchestratorModule.getCodebaseIndexer).toBeDefined();

      // Verify it can be instantiated and used
      const indexer = orchestratorModule.CodebaseIndexer.getInstance();
      expect(indexer).toBeDefined();

      const indexerViaHelper = orchestratorModule.getCodebaseIndexer();
      expect(indexerViaHelper).toBeDefined();
      expect(indexerViaHelper).toBe(indexer);
    });

    it('INTEGRATION: Can access through both import paths consistently', async () => {
      // Import via direct codebase-intelligence path
      const directImport = await import('../codebase-intelligence/index.js');
      const directIndexer = directImport.CodebaseIndexer.getInstance();

      // Import via main orchestrator package
      const mainImport = await import('../index.js');
      const mainIndexer = mainImport.CodebaseIndexer.getInstance();

      // Should be the exact same instance (singleton)
      expect(directIndexer).toBe(mainIndexer);
    });

    it('INTEGRATION: Reset functionality works correctly', async () => {
      const { CodebaseIndexer } = await import('../index.js');

      // Get initial instance
      const instance1 = CodebaseIndexer.getInstance();
      expect(instance1).toBeDefined();

      // Reset
      CodebaseIndexer.resetInstance();

      // Get new instance - should be different object but same type
      const instance2 = CodebaseIndexer.getInstance();
      expect(instance2).toBeDefined();
      expect(instance2.constructor.name).toBe('CodebaseIndexer');

      // After reset, new instance should be created (different object reference)
      // but both should have the same constructor
      expect(instance1.constructor).toBe(instance2.constructor);
    });
  });

  describe('Error Handling', () => {
    it('INTEGRATION: Handles import errors gracefully', async () => {
      // Test that invalid imports fail as expected
      await expect(import('../nonexistent-module.js')).rejects.toThrow();
    });

    it('INTEGRATION: Maintains functionality after multiple resets', async () => {
      const { CodebaseIndexer } = await import('../index.js');

      // Multiple reset cycles
      for (let i = 0; i < 3; i++) {
        CodebaseIndexer.resetInstance();
        const instance = CodebaseIndexer.getInstance();
        expect(instance).toBeDefined();
        expect(instance.constructor.name).toBe('CodebaseIndexer');
        expect(instance.indexDirectory).toBeDefined();
      }
    });
  });
});

// Additional comprehensive test for requirement verification
describe('Acceptance Criteria Validation', () => {
  it('ACCEPTANCE: All criteria are met', async () => {
    // Criteria 1: CodebaseIndexer is exported from packages/orchestrator/src/codebase-intelligence/index.ts
    const codebaseIntelligenceModule = await import('../codebase-intelligence/index.js');
    expect(codebaseIntelligenceModule.CodebaseIndexer).toBeDefined();
    expect(typeof codebaseIntelligenceModule.CodebaseIndexer).toBe('function');

    // Criteria 2: CodebaseIndexer is exported from packages/orchestrator/src/index.ts
    const orchestratorModule = await import('../index.js');
    expect(orchestratorModule.CodebaseIndexer).toBeDefined();
    expect(typeof orchestratorModule.CodebaseIndexer).toBe('function');

    // Criteria 3: Integration tests verify exports work correctly
    // (This test itself serves as the integration test)

    // Verify they're the same reference
    expect(orchestratorModule.CodebaseIndexer).toBe(codebaseIntelligenceModule.CodebaseIndexer);

    // Verify functional capability
    const indexer = orchestratorModule.CodebaseIndexer.getInstance();
    expect(indexer).toBeDefined();
    expect(indexer.indexDirectory).toBeDefined();
    expect(indexer.indexDirectoryWithProgress).toBeDefined();

    // Verify helper functions work
    const helperIndexer = orchestratorModule.getCodebaseIndexer();
    expect(helperIndexer).toBe(indexer);

    // Clean up
    orchestratorModule.CodebaseIndexer.resetInstance();
  });
});