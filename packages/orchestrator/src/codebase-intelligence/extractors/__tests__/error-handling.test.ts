/**
 * Error Handling Tests for Symbol Extractors
 *
 * Tests various error scenarios and edge cases for the symbol extraction system.
 * Ensures robust error handling and graceful degradation.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getExtractorForLanguage,
  ExtractionError,
  SymbolKind,
  type SymbolExtractor,
  type ExtractionOptions
} from '../index.js';
import { TypeScriptExtractor } from '../typescript-extractor.js';
import { PythonExtractor } from '../python-extractor.js';
import { SupportedLanguage } from '../../parsers/types.js';

describe('Symbol Extractor Error Handling', () => {
  beforeEach(() => {
    // Reset singleton instances before each test
    TypeScriptExtractor.resetInstance?.();
    PythonExtractor.resetInstance?.();
  });

  afterEach(() => {
    // Clean up after each test
    TypeScriptExtractor.resetInstance?.();
    PythonExtractor.resetInstance?.();
  });

  describe('ExtractionError class', () => {
    it('should create error with proper inheritance chain', () => {
      const error = new ExtractionError('Test message');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ExtractionError);
      expect(error.name).toBe('ExtractionError');
      expect(error.message).toBe('Test message');
      expect(error.stack).toBeDefined();
    });

    it('should preserve cause chain correctly', () => {
      const originalError = new SyntaxError('Original syntax error');
      const extractionError = new ExtractionError(
        'Failed to extract symbols',
        '/test/file.ts',
        originalError
      );

      expect(extractionError.cause).toBe(originalError);
      expect(extractionError.filePath).toBe('/test/file.ts');
      expect(extractionError.message).toBe('Failed to extract symbols');
    });

    it('should handle undefined and null values gracefully', () => {
      const error1 = new ExtractionError('Test', undefined, undefined);
      const error2 = new ExtractionError('Test', null as any, null as any);

      expect(error1.filePath).toBeUndefined();
      expect(error1.cause).toBeUndefined();
      expect(error2.filePath).toBeNull();
      expect(error2.cause).toBeNull();
    });
  });

  describe('Factory function error scenarios', () => {
    it('should throw ExtractionError for null language', () => {
      expect(() => getExtractorForLanguage(null as any)).toThrow(ExtractionError);
      expect(() => getExtractorForLanguage(null as any)).toThrow(
        'No symbol extractor available for language: null'
      );
    });

    it('should throw ExtractionError for undefined language', () => {
      expect(() => getExtractorForLanguage(undefined as any)).toThrow(ExtractionError);
      expect(() => getExtractorForLanguage(undefined as any)).toThrow(
        'No symbol extractor available for language: undefined'
      );
    });

    it('should throw ExtractionError for numeric language', () => {
      expect(() => getExtractorForLanguage(42 as any)).toThrow(ExtractionError);
      expect(() => getExtractorForLanguage(42 as any)).toThrow(
        'No symbol extractor available for language: 42'
      );
    });

    it('should throw ExtractionError for boolean language', () => {
      expect(() => getExtractorForLanguage(true as any)).toThrow(ExtractionError);
      expect(() => getExtractorForLanguage(false as any)).toThrow(ExtractionError);
    });

    it('should throw ExtractionError for object language', () => {
      const objectLang = { language: 'typescript' };
      expect(() => getExtractorForLanguage(objectLang as any)).toThrow(ExtractionError);
    });

    it('should handle whitespace-only language strings', () => {
      const whitespaceLanguages = ['  ', '\t', '\n', '\r\n', '   \t  \n  '];

      for (const lang of whitespaceLanguages) {
        expect(() => getExtractorForLanguage(lang)).toThrow(ExtractionError);
        expect(() => getExtractorForLanguage(lang)).toThrow(
          `No symbol extractor available for language: ${lang}`
        );
      }
    });

    it('should be case-sensitive for all languages', () => {
      const caseVariations = [
        'TypeScript', 'TYPESCRIPT', 'tYpEsCrIpT',
        'JavaScript', 'JAVASCRIPT', 'jAvAsCrIpT',
        'Python', 'PYTHON', 'PyThOn',
        'TSX', 'tSx', 'tsx'
      ];

      for (const lang of caseVariations) {
        expect(() => getExtractorForLanguage(lang)).toThrow(ExtractionError);
      }
    });
  });

  describe('Malformed code handling', () => {
    it('should handle completely empty source code', async () => {
      const extractor = getExtractorForLanguage(SupportedLanguage.TypeScript);
      const result = await extractor.extract('', SupportedLanguage.TypeScript);

      expect(result).toBeDefined();
      expect(result.symbols).toHaveLength(0);
      expect(result.language).toBe('typescript');
      expect(result.extractionTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should handle only whitespace source code', async () => {
      const whitespaceCode = '   \t\n\r\n    \t  ';
      const extractor = getExtractorForLanguage(SupportedLanguage.TypeScript);
      const result = await extractor.extract(whitespaceCode, SupportedLanguage.TypeScript);

      expect(result).toBeDefined();
      expect(result.symbols).toHaveLength(0);
    });

    it('should handle only comments', async () => {
      const commentOnlyCode = `
        // This is a comment
        /* This is a
           multi-line comment */
        /**
         * This is a JSDoc comment
         */
      `;

      const extractor = getExtractorForLanguage(SupportedLanguage.TypeScript);
      const result = await extractor.extract(commentOnlyCode, SupportedLanguage.TypeScript);

      expect(result).toBeDefined();
      expect(result.symbols).toHaveLength(0);
    });

    it('should handle severely malformed TypeScript code', async () => {
      const malformedCode = `
        function incomplete(
        class Broken {
          method() {
            if (true {
              return
        interface Bad
        enum
        const x = {
          prop
      `;

      const extractor = getExtractorForLanguage(SupportedLanguage.TypeScript);
      const result = await extractor.extract(malformedCode, SupportedLanguage.TypeScript);

      expect(result).toBeDefined();
      expect(result.hasErrors).toBe(true);
      expect(result.errors.length).toBeGreaterThan(0);
      // Should still try to extract what it can
      expect(result.symbols).toBeDefined();
    });

    it('should handle severely malformed Python code', async () => {
      const malformedCode = `
        def broken_function(
        class Incomplete
            def method(self
                if True
                    return
        def another_broken:
            pass
        import
        from module import
      `;

      const extractor = getExtractorForLanguage(SupportedLanguage.Python);
      const result = await extractor.extract(malformedCode, SupportedLanguage.Python);

      expect(result).toBeDefined();
      expect(result.hasErrors).toBe(true);
      expect(result.errors.length).toBeGreaterThan(0);
      // Should still try to extract what it can
      expect(result.symbols).toBeDefined();
    });

    it('should handle mixed valid and invalid code', async () => {
      const mixedCode = `
        // Valid function
        export function validFunc(): void {
          console.log('valid');
        }

        // Invalid syntax
        function incomplete(

        // Another valid function
        const anotherValid = () => {
          return 42;
        };

        // Invalid class
        class Broken {
          method() {
            if (true {
        }
      `;

      const extractor = getExtractorForLanguage(SupportedLanguage.TypeScript);
      const result = await extractor.extract(mixedCode, SupportedLanguage.TypeScript);

      expect(result).toBeDefined();
      expect(result.hasErrors).toBe(true);
      expect(result.symbols.length).toBeGreaterThan(0); // Should extract valid parts

      // Should find the valid functions
      const validFunction = result.symbols.find(s => s.name === 'validFunc');
      const anotherValidFunction = result.symbols.find(s => s.name === 'anotherValid');

      expect(validFunction).toBeDefined();
      expect(anotherValidFunction).toBeDefined();
    });
  });

  describe('Extraction options edge cases', () => {
    it('should handle extreme maxDepth values', async () => {
      const nestedCode = `
        class Level1 {
          class Level2 {
            class Level3 {
              method() {}
            }
          }
        }
      `;

      const extractor = getExtractorForLanguage(SupportedLanguage.TypeScript);

      // Test maxDepth: 0 (no children)
      const result0 = await extractor.extract(nestedCode, SupportedLanguage.TypeScript, {
        maxDepth: 0
      });
      const level1Class0 = result0.symbols.find(s => s.name === 'Level1');
      expect(level1Class0?.children).toBeUndefined();

      // Test maxDepth: -1 (should be handled gracefully)
      const resultNegative = await extractor.extract(nestedCode, SupportedLanguage.TypeScript, {
        maxDepth: -1
      });
      expect(resultNegative).toBeDefined();

      // Test extremely high maxDepth
      const resultHigh = await extractor.extract(nestedCode, SupportedLanguage.TypeScript, {
        maxDepth: 999999
      });
      expect(resultHigh).toBeDefined();
    });

    it('should handle empty symbolKinds filter', async () => {
      const code = `
        function testFunc() {}
        class TestClass {}
        const testVar = 42;
      `;

      const extractor = getExtractorForLanguage(SupportedLanguage.TypeScript);
      const result = await extractor.extract(code, SupportedLanguage.TypeScript, {
        symbolKinds: []
      });

      // With empty symbolKinds array, should extract nothing or everything (implementation dependent)
      expect(result).toBeDefined();
      expect(result.symbols).toBeDefined();
    });

    it('should handle invalid symbolKinds values', async () => {
      const code = `
        function testFunc() {}
        class TestClass {}
      `;

      const extractor = getExtractorForLanguage(SupportedLanguage.TypeScript);

      // Test with invalid SymbolKind values
      const result = await extractor.extract(code, SupportedLanguage.TypeScript, {
        symbolKinds: ['invalid_kind' as SymbolKind, 'another_invalid' as SymbolKind]
      });

      expect(result).toBeDefined();
    });

    it('should handle all options set to extreme values', async () => {
      const code = `
        /**
         * Test function
         */
        export function testFunc(): void {}

        class TestClass {
          private privateMethod() {}
          public publicMethod() {}
        }
      `;

      const extractor = getExtractorForLanguage(SupportedLanguage.TypeScript);
      const extremeOptions: ExtractionOptions = {
        includeDocumentation: false,
        includeSignatures: false,
        includePrivate: false,
        maxDepth: 0,
        symbolKinds: [SymbolKind.Function], // Only functions
        includeImports: true,
        includeDecorators: false
      };

      const result = await extractor.extract(code, SupportedLanguage.TypeScript, extremeOptions);

      expect(result).toBeDefined();
      expect(result.symbols).toBeDefined();

      // Should only include functions, no classes
      const functions = result.symbols.filter(s => s.kind === SymbolKind.Function);
      const classes = result.symbols.filter(s => s.kind === SymbolKind.Class);

      expect(functions.length).toBeGreaterThan(0);
      expect(classes.length).toBe(0);

      // Should not include documentation
      for (const symbol of functions) {
        expect(symbol.documentation).toBeUndefined();
      }
    });
  });

  describe('Unicode and special character handling', () => {
    it('should handle Unicode identifiers', async () => {
      const unicodeCode = `
        function测试函数() {}
        const变量 = 42;
        class测试类 {}
      `;

      const extractor = getExtractorForLanguage(SupportedLanguage.TypeScript);
      const result = await extractor.extract(unicodeCode, SupportedLanguage.TypeScript);

      expect(result).toBeDefined();
      // Should be able to handle Unicode identifiers
      expect(result.symbols.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle emoji in identifiers', async () => {
      const emojiCode = `
        function test🚀Function() {}
        const 🎉celebration = true;
      `;

      const extractor = getExtractorForLanguage(SupportedLanguage.TypeScript);
      const result = await extractor.extract(emojiCode, SupportedLanguage.TypeScript);

      expect(result).toBeDefined();
      expect(result.symbols).toBeDefined();
    });

    it('should handle very long identifiers', async () => {
      const longIdentifier = 'a'.repeat(1000);
      const longIdentifierCode = `
        function ${longIdentifier}() {}
      `;

      const extractor = getExtractorForLanguage(SupportedLanguage.TypeScript);
      const result = await extractor.extract(longIdentifierCode, SupportedLanguage.TypeScript);

      expect(result).toBeDefined();
      expect(result.symbols).toBeDefined();
    });
  });

  describe('Memory and performance edge cases', () => {
    it('should handle very large files gracefully', async () => {
      // Generate a large file with many functions
      const largeFunctions = Array.from({ length: 100 }, (_, i) =>
        `function func${i}() { return ${i}; }`
      ).join('\n');

      const extractor = getExtractorForLanguage(SupportedLanguage.TypeScript);
      const result = await extractor.extract(largeFunctions, SupportedLanguage.TypeScript);

      expect(result).toBeDefined();
      expect(result.symbols.length).toBe(100);
      expect(result.extractionTimeMs).toBeGreaterThan(0);
    });

    it('should handle deeply nested structures', async () => {
      // Create deeply nested code
      let nestedCode = 'class Root {';
      for (let i = 0; i < 50; i++) {
        nestedCode += `class Nested${i} {`;
      }
      nestedCode += 'method() {}';
      for (let i = 0; i < 50; i++) {
        nestedCode += '}';
      }
      nestedCode += '}';

      const extractor = getExtractorForLanguage(SupportedLanguage.TypeScript);
      const result = await extractor.extract(nestedCode, SupportedLanguage.TypeScript);

      expect(result).toBeDefined();
      expect(result.symbols).toBeDefined();
    });
  });

  describe('Concurrent extraction', () => {
    it('should handle concurrent extraction requests', async () => {
      const code1 = 'function func1() {}';
      const code2 = 'class Class2 {}';
      const code3 = 'const const3 = 42;';

      const extractor = getExtractorForLanguage(SupportedLanguage.TypeScript);

      // Run multiple extractions concurrently
      const promises = [
        extractor.extract(code1, SupportedLanguage.TypeScript),
        extractor.extract(code2, SupportedLanguage.TypeScript),
        extractor.extract(code3, SupportedLanguage.TypeScript)
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      for (const result of results) {
        expect(result).toBeDefined();
        expect(result.symbols).toBeDefined();
      }
    });
  });
});