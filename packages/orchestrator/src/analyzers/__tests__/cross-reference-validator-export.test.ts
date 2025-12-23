/**
 * CrossReferenceValidator Export Tests
 *
 * Tests verifying that CrossReferenceValidator and its types can be properly
 * imported from different paths within the orchestrator package, ensuring
 * the export configuration is working correctly.
 */

import { describe, it, expect } from 'vitest';

describe('CrossReferenceValidator Export Tests', () => {
  describe('analyzer index exports', () => {
    it('should export CrossReferenceValidator from analyzers index', async () => {
      const { CrossReferenceValidator } = await import('../index');

      expect(CrossReferenceValidator).toBeDefined();
      expect(typeof CrossReferenceValidator).toBe('function');
      expect(CrossReferenceValidator.name).toBe('CrossReferenceValidator');
    });

    it('should export CrossReferenceValidator types from analyzers index', async () => {
      const exports = await import('../index');

      // Verify the exports exist
      expect(exports.CrossReferenceValidator).toBeDefined();
      expect(typeof exports.CrossReferenceValidator).toBe('function');

      // Verify we can instantiate the class
      const validator = new exports.CrossReferenceValidator();
      expect(validator).toBeInstanceOf(exports.CrossReferenceValidator);
    });

    it('should allow direct import from cross-reference-validator module', async () => {
      const {
        CrossReferenceValidator,
        type DocumentationReference,
        type SymbolInfo,
        type SymbolIndex,
        type SymbolExtractionOptions
      } = await import('../cross-reference-validator');

      expect(CrossReferenceValidator).toBeDefined();
      expect(typeof CrossReferenceValidator).toBe('function');

      // Verify we can instantiate the class
      const validator = new CrossReferenceValidator();
      expect(validator).toBeInstanceOf(CrossReferenceValidator);
      expect(typeof validator.buildIndex).toBe('function');
      expect(typeof validator.extractSymbols).toBe('function');
      expect(typeof validator.validateReference).toBe('function');
      expect(typeof validator.validateDocumentationReferences).toBe('function');
    });
  });

  describe('functionality verification', () => {
    it('should have all required methods and properties', async () => {
      const { CrossReferenceValidator } = await import('../index');
      const validator = new CrossReferenceValidator();

      // Check all public methods exist
      expect(typeof validator.buildIndex).toBe('function');
      expect(typeof validator.extractSymbols).toBe('function');
      expect(typeof validator.lookupSymbol).toBe('function');
      expect(typeof validator.getFileSymbols).toBe('function');
      expect(typeof validator.validateReference).toBe('function');
      expect(typeof validator.validateDocumentationReferences).toBe('function');
      expect(typeof validator.extractDocumentationReferences).toBe('function');
      expect(typeof validator.extractInlineCodeReferences).toBe('function');
      expect(typeof validator.extractCodeBlockReferences).toBe('function');
      expect(typeof validator.extractSeeTagReferences).toBe('function');
    });

    it('should be able to perform basic operations', async () => {
      const { CrossReferenceValidator } = await import('../index');
      const validator = new CrossReferenceValidator();

      // Test basic symbol extraction
      const testContent = `
export function testFunction(): void {
  console.log('test');
}

export class TestClass {
  public testMethod(): string {
    return 'test';
  }
}

export interface TestInterface {
  prop: string;
}
`;

      const symbols = validator.extractSymbols('/test/file.ts', testContent);
      expect(symbols.length).toBeGreaterThan(0);

      const functions = symbols.filter(s => s.type === 'function');
      const classes = symbols.filter(s => s.type === 'class');
      const interfaces = symbols.filter(s => s.type === 'interface');
      const methods = symbols.filter(s => s.type === 'method');

      expect(functions.length).toBe(1);
      expect(classes.length).toBe(1);
      expect(interfaces.length).toBe(1);
      expect(methods.length).toBeGreaterThan(0);

      expect(functions[0].name).toBe('testFunction');
      expect(functions[0].isExported).toBe(true);
      expect(classes[0].name).toBe('TestClass');
      expect(classes[0].isExported).toBe(true);
      expect(interfaces[0].name).toBe('TestInterface');
      expect(interfaces[0].isExported).toBe(true);
    });

    it('should be able to extract documentation references', async () => {
      const { CrossReferenceValidator } = await import('../index');
      const validator = new CrossReferenceValidator();

      const docContent = `
# API Documentation

Use the \`TestFunction()\` to process data.
The \`TestClass\` provides core functionality.

## Example

\`\`\`typescript
const instance = new TestClass();
const result = TestFunction(data);
\`\`\`

/**
 * @see TestInterface for configuration
 * @see {TestUtils.helper} for utilities
 */
`;

      const references = validator.extractDocumentationReferences('/docs/api.md', docContent);
      expect(references.length).toBeGreaterThan(0);

      const inlineRefs = references.filter(r => r.referenceType === 'inline-code');
      const codeBlockRefs = references.filter(r => r.referenceType === 'code-block');
      const seeTagRefs = references.filter(r => r.referenceType === 'see-tag');

      expect(inlineRefs.length).toBeGreaterThan(0);
      expect(codeBlockRefs.length).toBeGreaterThan(0);
      expect(seeTagRefs.length).toBeGreaterThan(0);

      // Check specific references
      const testFunctionRef = references.find(r => r.symbolName === 'TestFunction');
      const testClassRef = references.find(r => r.symbolName === 'TestClass');

      expect(testFunctionRef).toBeDefined();
      expect(testClassRef).toBeDefined();
    });

    it('should be able to validate references against symbol index', async () => {
      const { CrossReferenceValidator } = await import('../index');
      const validator = new CrossReferenceValidator();

      // Create a mock symbol index
      const mockIndex = {
        byName: new Map([
          ['ExistingFunction', [{
            name: 'ExistingFunction',
            type: 'function' as const,
            file: '/src/test.ts',
            line: 5,
            column: 1,
            isExported: true,
          }]],
          ['ExistingClass', [{
            name: 'ExistingClass',
            type: 'class' as const,
            file: '/src/test.ts',
            line: 10,
            column: 1,
            isExported: true,
          }]]
        ]),
        byFile: new Map(),
        stats: {
          totalSymbols: 2,
          totalFiles: 1,
          byType: { function: 1, class: 1 },
        },
      };

      // Test valid references
      expect(validator.validateReference(mockIndex, 'ExistingFunction')).toBe(true);
      expect(validator.validateReference(mockIndex, 'ExistingClass')).toBe(true);

      // Test invalid references
      expect(validator.validateReference(mockIndex, 'NonExistentFunction')).toBe(false);
      expect(validator.validateReference(mockIndex, 'MissingClass')).toBe(false);

      // Test documentation validation
      const testReferences = [
        {
          symbolName: 'ExistingFunction',
          referenceType: 'inline-code' as const,
          sourceFile: '/docs/test.md',
          line: 5,
          column: 10,
          context: 'Use `ExistingFunction()` for processing',
        },
        {
          symbolName: 'NonExistentFunction',
          referenceType: 'see-tag' as const,
          sourceFile: '/docs/test.md',
          line: 15,
          column: 5,
          context: '@see NonExistentFunction for details',
        },
      ];

      const brokenLinks = validator.validateDocumentationReferences(mockIndex, testReferences);
      expect(brokenLinks).toHaveLength(1);
      expect(brokenLinks[0].description).toContain('NonExistentFunction');
      expect(brokenLinks[0].type).toBe('broken-link');
      expect(brokenLinks[0].severity).toBe('high'); // @see tags have high severity
    });
  });

  describe('type safety verification', () => {
    it('should provide proper TypeScript types', async () => {
      const exports = await import('../index');
      const { CrossReferenceValidator } = exports;

      // Verify constructor
      const validator = new CrossReferenceValidator();

      // Create test data with proper types
      const testSymbol = {
        name: 'TestSymbol',
        type: 'function' as const,
        file: '/test.ts',
        line: 1,
        column: 1,
        isExported: true,
      };

      const testReference = {
        symbolName: 'TestSymbol',
        referenceType: 'inline-code' as const,
        sourceFile: '/docs/test.md',
        line: 5,
        column: 10,
        context: 'Test reference context',
      };

      const testIndex = {
        byName: new Map([['TestSymbol', [testSymbol]]]),
        byFile: new Map([['/test.ts', [testSymbol]]]),
        stats: {
          totalSymbols: 1,
          totalFiles: 1,
          byType: { function: 1 },
        },
      };

      // Verify method calls work with proper types
      const lookupResult = validator.lookupSymbol(testIndex, 'TestSymbol');
      expect(lookupResult).toHaveLength(1);
      expect(lookupResult[0].name).toBe('TestSymbol');

      const fileSymbols = validator.getFileSymbols(testIndex, '/test.ts');
      expect(fileSymbols).toHaveLength(1);

      const isValid = validator.validateReference(testIndex, 'TestSymbol');
      expect(isValid).toBe(true);

      const brokenLinks = validator.validateDocumentationReferences(testIndex, [testReference]);
      expect(brokenLinks).toHaveLength(0);
    });

    it('should handle optional parameters correctly', async () => {
      const { CrossReferenceValidator } = await import('../index');
      const validator = new CrossReferenceValidator();

      // Test extractSymbols with different parameter combinations
      const content = 'export function test(): void {}';

      // Default parameters
      const symbols1 = validator.extractSymbols('/test.ts', content);
      expect(Array.isArray(symbols1)).toBe(true);

      // With includePrivate parameter
      const symbols2 = validator.extractSymbols('/test.ts', content, true);
      expect(Array.isArray(symbols2)).toBe(true);

      // With both parameters
      const symbols3 = validator.extractSymbols('/test.ts', content, true, false);
      expect(Array.isArray(symbols3)).toBe(true);

      // All should work without throwing
      [symbols1, symbols2, symbols3].forEach(symbols => {
        expect(symbols.length).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('edge case handling', () => {
    it('should handle empty symbol index gracefully', async () => {
      const { CrossReferenceValidator } = await import('../index');
      const validator = new CrossReferenceValidator();

      const emptyIndex = {
        byName: new Map(),
        byFile: new Map(),
        stats: {
          totalSymbols: 0,
          totalFiles: 0,
          byType: {},
        },
      };

      expect(validator.validateReference(emptyIndex, 'AnySymbol')).toBe(false);
      expect(validator.lookupSymbol(emptyIndex, 'AnySymbol')).toHaveLength(0);
      expect(validator.getFileSymbols(emptyIndex, '/any/file.ts')).toHaveLength(0);

      const brokenLinks = validator.validateDocumentationReferences(emptyIndex, []);
      expect(brokenLinks).toHaveLength(0);
    });

    it('should handle malformed input gracefully', async () => {
      const { CrossReferenceValidator } = await import('../index');
      const validator = new CrossReferenceValidator();

      // Empty content
      const symbols1 = validator.extractSymbols('/test.ts', '');
      expect(symbols1).toHaveLength(0);

      // Whitespace only
      const symbols2 = validator.extractSymbols('/test.ts', '   \n\n  \t  ');
      expect(symbols2).toHaveLength(0);

      // Comments only
      const symbols3 = validator.extractSymbols('/test.ts', '// Just a comment\n/* Block comment */');
      expect(symbols3).toHaveLength(0);

      // Malformed TypeScript (should not throw)
      expect(() => {
        validator.extractSymbols('/test.ts', 'export function incomplete(');
      }).not.toThrow();
    });
  });
});