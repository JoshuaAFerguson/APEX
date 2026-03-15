/**
 * Integration test to verify CodebaseIndexer is correctly exported from the main orchestrator package
 *
 * This test ensures that:
 * 1. CodebaseIndexer can be imported directly from @apexcli/orchestrator
 * 2. CodebaseIndexer can be imported from @apexcli/orchestrator/codebase-intelligence
 * 3. Both imports reference the same class
 * 4. The exported class is functional and can be instantiated
 */

import { describe, it, expect } from 'vitest';

describe('CodebaseIndexer Export Integration', () => {
  it('should export CodebaseIndexer from main orchestrator package', async () => {
    // Test import from main package
    const mainPackageImport = await import('../index.js');
    expect(mainPackageImport.CodebaseIndexer).toBeDefined();
    expect(typeof mainPackageImport.CodebaseIndexer).toBe('function');
  });

  it('should export CodebaseIndexer from codebase-intelligence submodule', async () => {
    // Test import from codebase-intelligence submodule
    const submoduleImport = await import('../codebase-intelligence/index.js');
    expect(submoduleImport.CodebaseIndexer).toBeDefined();
    expect(typeof submoduleImport.CodebaseIndexer).toBe('function');
  });

  it('should export the same CodebaseIndexer class from both locations', async () => {
    // Import from both locations
    const mainPackageImport = await import('../index.js');
    const submoduleImport = await import('../codebase-intelligence/index.js');

    // Verify they reference the same class
    expect(mainPackageImport.CodebaseIndexer).toBe(submoduleImport.CodebaseIndexer);
  });

  it('should be able to instantiate CodebaseIndexer via singleton pattern', async () => {
    // Import CodebaseIndexer
    const { CodebaseIndexer } = await import('../index.js');

    // Test that getInstance() method exists and returns an instance
    expect(CodebaseIndexer.getInstance).toBeDefined();
    expect(typeof CodebaseIndexer.getInstance).toBe('function');

    const instance = CodebaseIndexer.getInstance();
    expect(instance).toBeDefined();
    expect(instance.constructor.name).toBe('CodebaseIndexer');

    // Verify singleton pattern - should return same instance
    const secondInstance = CodebaseIndexer.getInstance();
    expect(instance).toBe(secondInstance);
  });

  it('should export getCodebaseIndexer helper function', async () => {
    // Test getCodebaseIndexer helper export
    const mainPackageImport = await import('../index.js');
    expect(mainPackageImport.getCodebaseIndexer).toBeDefined();
    expect(typeof mainPackageImport.getCodebaseIndexer).toBe('function');

    // Test that helper returns same instance as direct singleton call
    const { CodebaseIndexer, getCodebaseIndexer } = mainPackageImport;
    const directInstance = CodebaseIndexer.getInstance();
    const helperInstance = getCodebaseIndexer();

    expect(directInstance).toBe(helperInstance);
  });

  it('should export IndexingOptions, IndexingProgress, and IndexingError types', async () => {
    // This test verifies the TypeScript types are properly exported
    // Since we can't test types directly at runtime, we test the import doesn't fail
    const moduleImport = await import('../index.js');

    // The types should be available in TypeScript compilation but not at runtime
    // This test mainly ensures the exports don't cause import errors
    expect(moduleImport).toBeDefined();
  });

  it('should maintain functional indexing capabilities through export', async () => {
    // Test that the exported CodebaseIndexer maintains its core functionality
    const { CodebaseIndexer } = await import('../index.js');
    const indexer = CodebaseIndexer.getInstance();

    // Verify essential methods exist
    expect(indexer.indexDirectory).toBeDefined();
    expect(typeof indexer.indexDirectory).toBe('function');

    expect(indexer.indexDirectoryWithProgress).toBeDefined();
    expect(typeof indexer.indexDirectoryWithProgress).toBe('function');

    // Test static methods
    expect(CodebaseIndexer.resetInstance).toBeDefined();
    expect(typeof CodebaseIndexer.resetInstance).toBe('function');
  });
});