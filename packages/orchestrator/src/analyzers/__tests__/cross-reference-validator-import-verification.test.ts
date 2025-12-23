/**
 * CrossReferenceValidator Import Verification Tests
 *
 * Focused tests to verify that CrossReferenceValidator can be imported
 * from the analyzers index as required by the acceptance criteria.
 */

import { describe, it, expect } from 'vitest';

describe('CrossReferenceValidator Import Verification', () => {
  it('should be able to import CrossReferenceValidator from analyzers index', async () => {
    // This is the core requirement: ensure CrossReferenceValidator can be imported
    const analyzerIndex = await import('../index');

    // Verify the export exists
    expect(analyzerIndex.CrossReferenceValidator).toBeDefined();
    expect(typeof analyzerIndex.CrossReferenceValidator).toBe('function');

    // Verify it's a constructor function
    expect(analyzerIndex.CrossReferenceValidator.name).toBe('CrossReferenceValidator');
  });

  it('should be able to import types from analyzers index', async () => {
    // Verify type exports are available (these are type imports, so they won't exist at runtime)
    // But we can verify the module exports work by importing and using them

    const analyzerIndex = await import('../index');

    // The types should be available for import (though not at runtime)
    // We can test this by ensuring the main export works
    expect(analyzerIndex.CrossReferenceValidator).toBeDefined();

    // And that we can create an instance
    const validator = new analyzerIndex.CrossReferenceValidator();
    expect(validator).toBeInstanceOf(analyzerIndex.CrossReferenceValidator);
  });

  it('should be able to instantiate and use CrossReferenceValidator from analyzers index', async () => {
    const { CrossReferenceValidator } = await import('../index');

    // Create an instance
    const validator = new CrossReferenceValidator();

    // Verify it has the expected methods
    expect(typeof validator.buildIndex).toBe('function');
    expect(typeof validator.extractSymbols).toBe('function');
    expect(typeof validator.validateReference).toBe('function');
    expect(typeof validator.validateDocumentationReferences).toBe('function');

    // Test basic functionality to ensure the export is working correctly
    const testCode = 'export function testFunc(): void {}';
    const symbols = validator.extractSymbols('/test.ts', testCode);

    expect(Array.isArray(symbols)).toBe(true);
    expect(symbols.length).toBeGreaterThan(0);
    expect(symbols[0].name).toBe('testFunc');
    expect(symbols[0].type).toBe('function');
    expect(symbols[0].isExported).toBe(true);
  });

  it('should maintain compatibility with direct import', async () => {
    // Verify that direct imports still work
    const { CrossReferenceValidator: DirectImport } = await import('../cross-reference-validator');
    const { CrossReferenceValidator: IndexImport } = await import('../index');

    // Both should be the same class
    expect(DirectImport).toBe(IndexImport);

    // Both should work identically
    const directValidator = new DirectImport();
    const indexValidator = new IndexImport();

    expect(directValidator.constructor).toBe(indexValidator.constructor);
  });

  it('should export all required types', async () => {
    // Test that we can use the exported module properly
    const exports = await import('../index');

    // Verify CrossReferenceValidator is exported
    expect(exports.CrossReferenceValidator).toBeDefined();

    // We can't check types at runtime, but we can verify the main export is working
    // and that TypeScript compilation will catch type export issues
    const validator = new exports.CrossReferenceValidator();

    // Test that the validator works with the expected interface
    const mockIndex = {
      byName: new Map(),
      byFile: new Map(),
      stats: {
        totalSymbols: 0,
        totalFiles: 0,
        byType: {}
      }
    };

    // These calls verify that the types are compatible
    const result = validator.validateReference(mockIndex, 'test');
    expect(typeof result).toBe('boolean');

    const symbols = validator.lookupSymbol(mockIndex, 'test');
    expect(Array.isArray(symbols)).toBe(true);
  });
});