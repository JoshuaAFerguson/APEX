/**
 * Compilation Check Test
 *
 * This test verifies that all exports compile correctly and can be imported
 * without TypeScript errors. It serves as a build verification test.
 */

import { describe, it, expect } from 'vitest';

describe('Compilation Check', () => {
  it('should compile and import all exports without TypeScript errors', async () => {
    // Test that all modules can be imported successfully

    // Import from main orchestrator index
    const orchestratorExports = await import('../../index.js');
    expect(orchestratorExports).toBeDefined();

    // Import from codebase-intelligence index
    const codebaseIntelligenceExports = await import('../index.js');
    expect(codebaseIntelligenceExports).toBeDefined();

    // Import from parsers index
    const parsersExports = await import('../parsers/index.js');
    expect(parsersExports).toBeDefined();

    // Import from tree-sitter-wrapper
    const wrapperExports = await import('../parsers/tree-sitter-wrapper.js');
    expect(wrapperExports).toBeDefined();

    // Import from types
    const typesExports = await import('../parsers/types.js');
    expect(typesExports).toBeDefined();

    // Verify key exports are available
    expect(orchestratorExports.TreeSitterWrapper).toBeDefined();
    expect(orchestratorExports.SupportedLanguage).toBeDefined();
    expect(codebaseIntelligenceExports.TreeSitterWrapper).toBeDefined();
    expect(parsersExports.TreeSitterWrapper).toBeDefined();
    expect(wrapperExports.TreeSitterWrapper).toBeDefined();

    // All imports completed successfully
    expect(true).toBe(true);
  });

  it('should verify type definitions are accessible', () => {
    // This is a compile-time test that verifies TypeScript types are exported properly
    // If this compiles, it means the type definitions are correct

    type CheckCompilation = {
      // These types should be available at compile time
      wrapper: typeof import('../parsers/tree-sitter-wrapper.js').TreeSitterWrapper;
      language: typeof import('../parsers/types.js').SupportedLanguage;
      error: typeof import('../parsers/types.js').ParserError;
      unsupportedError: typeof import('../parsers/types.js').UnsupportedLanguageError;

      // Interface types should also be available
      parseResult: import('../parsers/types.js').ParseResult;
      parseError: import('../parsers/types.js').ParseError;
      parseOptions: import('../parsers/types.js').ParseOptions;
      position: import('../parsers/types.js').Position;
      range: import('../parsers/types.js').Range;
      parserState: import('../parsers/types.js').ParserState;
    };

    // Type checking successful if this compiles
    expect(true).toBe(true);
  });
});