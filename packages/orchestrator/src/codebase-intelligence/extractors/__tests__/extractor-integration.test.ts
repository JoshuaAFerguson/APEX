/**
 * Integration Tests for Symbol Extractor Factory and Interfaces
 *
 * Tests the complete workflow of getting extractors from the factory
 * and using them to extract symbols from various code samples.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getExtractorForLanguage,
  hasExtractorSupport,
  SymbolKind,
  ExtractionError,
  type SymbolExtractor,
  type ExtractionResult
} from '../index.js';
import { SupportedLanguage } from '../../parsers/types.js';
import { TypeScriptExtractor } from '../typescript-extractor.js';
import { PythonExtractor } from '../python-extractor.js';

describe('Symbol Extractor Integration', () => {
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

  describe('End-to-end extraction workflow', () => {
    it('should extract TypeScript function symbols', async () => {
      const sourceCode = `
        /**
         * Adds two numbers together
         * @param a First number
         * @param b Second number
         * @returns The sum of a and b
         */
        export function add(a: number, b: number): number {
          return a + b;
        }

        export const multiply = (x: number, y: number): number => {
          return x * y;
        };
      `;

      const extractor = getExtractorForLanguage(SupportedLanguage.TypeScript);
      expect(extractor).toBeInstanceOf(TypeScriptExtractor);

      const result = await extractor.extract(sourceCode, SupportedLanguage.TypeScript);

      expect(result).toBeDefined();
      expect(result.language).toBe('typescript');
      expect(result.symbols).toHaveLength(2);

      // Check the regular function
      const addFunction = result.symbols.find(s => s.name === 'add');
      expect(addFunction).toBeDefined();
      expect(addFunction!.kind).toBe(SymbolKind.Function);
      expect(addFunction!.exportKind).toBe('named');
      expect(addFunction!.modifiers).toContain('export');
      expect(addFunction!.documentation).toContain('Adds two numbers together');
      expect(addFunction!.signature).toContain('a: number, b: number');

      // Check the arrow function
      const multiplyFunction = result.symbols.find(s => s.name === 'multiply');
      expect(multiplyFunction).toBeDefined();
      expect(multiplyFunction!.kind).toBe(SymbolKind.ArrowFunction);
      expect(multiplyFunction!.exportKind).toBe('named');
      expect(multiplyFunction!.modifiers).toContain('export');
    });

    it('should extract TypeScript class symbols', async () => {
      const sourceCode = `
        /**
         * A simple calculator class
         */
        export class Calculator {
          private result: number = 0;

          /**
           * Constructor
           */
          constructor(initialValue: number = 0) {
            this.result = initialValue;
          }

          /**
           * Adds a number to the result
           */
          public add(value: number): this {
            this.result += value;
            return this;
          }

          /**
           * Gets the current result
           */
          public get value(): number {
            return this.result;
          }
        }
      `;

      const extractor = getExtractorForLanguage(SupportedLanguage.TypeScript);
      const result = await extractor.extract(sourceCode, SupportedLanguage.TypeScript);

      expect(result.symbols).toHaveLength(1);

      const calculator = result.symbols[0];
      expect(calculator.name).toBe('Calculator');
      expect(calculator.kind).toBe(SymbolKind.Class);
      expect(calculator.exportKind).toBe('named');
      expect(calculator.modifiers).toContain('export');
      expect(calculator.documentation).toContain('A simple calculator class');

      // Check class members
      expect(calculator.children).toBeDefined();
      expect(calculator.children!.length).toBeGreaterThan(0);

      const constructor = calculator.children!.find(c => c.kind === SymbolKind.Constructor);
      expect(constructor).toBeDefined();

      const addMethod = calculator.children!.find(c => c.name === 'add');
      expect(addMethod).toBeDefined();
      expect(addMethod!.kind).toBe(SymbolKind.Method);
      expect(addMethod!.modifiers).toContain('public');

      const valueGetter = calculator.children!.find(c => c.name === 'value');
      expect(valueGetter).toBeDefined();
      expect(valueGetter!.kind).toBe(SymbolKind.Getter);
    });

    it('should extract Python function symbols', async () => {
      const sourceCode = `
        def calculate_fibonacci(n):
            """
            Calculate the nth Fibonacci number

            Args:
                n: The position in the Fibonacci sequence

            Returns:
                The nth Fibonacci number
            """
            if n <= 1:
                return n
            return calculate_fibonacci(n-1) + calculate_fibonacci(n-2)

        async def fetch_data(url):
            """Asynchronously fetch data from a URL"""
            pass
      `;

      const extractor = getExtractorForLanguage(SupportedLanguage.Python);
      expect(extractor).toBeInstanceOf(PythonExtractor);

      const result = await extractor.extract(sourceCode, SupportedLanguage.Python);

      expect(result).toBeDefined();
      expect(result.language).toBe('python');
      expect(result.symbols).toHaveLength(2);

      // Check the regular function
      const fibFunction = result.symbols.find(s => s.name === 'calculate_fibonacci');
      expect(fibFunction).toBeDefined();
      expect(fibFunction!.kind).toBe(SymbolKind.Function);
      expect(fibFunction!.documentation).toContain('Calculate the nth Fibonacci number');

      // Check the async function
      const fetchFunction = result.symbols.find(s => s.name === 'fetch_data');
      expect(fetchFunction).toBeDefined();
      expect(fetchFunction!.kind).toBe(SymbolKind.Function);
      expect(fetchFunction!.modifiers).toContain('async');
    });

    it('should handle extraction options', async () => {
      const sourceCode = `
        /**
         * Public function
         */
        export function publicFunc(): void {}

        /**
         * Private function
         */
        function privateFunc(): void {}

        export class TestClass {
          /**
           * Public method
           */
          public publicMethod(): void {}

          /**
           * Private method
           */
          private privateMethod(): void {}
        }
      `;

      const extractor = getExtractorForLanguage(SupportedLanguage.TypeScript);

      // Test with default options (includes private)
      const resultWithPrivate = await extractor.extract(
        sourceCode,
        SupportedLanguage.TypeScript
      );

      const classWithPrivate = resultWithPrivate.symbols.find(s => s.name === 'TestClass');
      expect(classWithPrivate?.children?.length).toBeGreaterThanOrEqual(2); // Both public and private methods

      // Test without private members
      const resultWithoutPrivate = await extractor.extract(
        sourceCode,
        SupportedLanguage.TypeScript,
        { includePrivate: false }
      );

      const classWithoutPrivate = resultWithoutPrivate.symbols.find(s => s.name === 'TestClass');
      const privateMethods = classWithoutPrivate?.children?.filter(
        c => c.modifiers.includes('private')
      );
      expect(privateMethods?.length).toBe(0);

      // Test without documentation
      const resultWithoutDocs = await extractor.extract(
        sourceCode,
        SupportedLanguage.TypeScript,
        { includeDocumentation: false }
      );

      const functionsWithoutDocs = resultWithoutDocs.symbols.filter(
        s => s.kind === SymbolKind.Function
      );
      for (const func of functionsWithoutDocs) {
        expect(func.documentation).toBeUndefined();
      }
    });

    it('should handle extraction errors gracefully', async () => {
      const malformedCode = `
        export function incomplete(
          // Missing closing parenthesis and function body
      `;

      const extractor = getExtractorForLanguage(SupportedLanguage.TypeScript);
      const result = await extractor.extract(malformedCode, SupportedLanguage.TypeScript);

      // Should still return a result, but may have errors
      expect(result).toBeDefined();
      expect(result.hasErrors).toBe(true);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should extract from file paths', async () => {
      // This would require actual files, but we can test the interface
      const extractor = getExtractorForLanguage(SupportedLanguage.TypeScript);

      // Test that the method exists and has the right signature
      expect(typeof extractor.extractFromFile).toBe('function');
      expect(extractor.extractFromFile.length).toBe(2); // filePath, options
    });
  });

  describe('Factory function edge cases', () => {
    it('should return same instance for equivalent language formats', () => {
      const extractor1 = getExtractorForLanguage('typescript');
      const extractor2 = getExtractorForLanguage(SupportedLanguage.TypeScript);
      const extractor3 = getExtractorForLanguage('tsx');

      expect(extractor1).toBe(extractor2);
      expect(extractor1).toBe(extractor3); // TSX uses TypeScript extractor
    });

    it('should handle case sensitivity correctly', () => {
      expect(() => getExtractorForLanguage('TypeScript')).toThrow(ExtractionError);
      expect(() => getExtractorForLanguage('PYTHON')).toThrow(ExtractionError);
      expect(() => getExtractorForLanguage('JavaScript')).toThrow(ExtractionError);
    });

    it('should provide helpful error messages for unsupported languages', () => {
      const unsupportedLanguages = ['java', 'cpp', 'rust', 'go'];

      for (const lang of unsupportedLanguages) {
        expect(() => getExtractorForLanguage(lang)).toThrow(
          `No symbol extractor available for language: ${lang}`
        );
        expect(() => getExtractorForLanguage(lang)).toThrow(
          'Supported languages are: typescript, tsx, javascript, python'
        );
      }
    });
  });

  describe('Language support detection', () => {
    it('should correctly identify supported languages', () => {
      const supportedLanguages = ['typescript', 'tsx', 'javascript', 'python'];
      const unsupportedLanguages = ['java', 'cpp', 'rust', 'go', 'ruby', 'php'];

      for (const lang of supportedLanguages) {
        expect(hasExtractorSupport(lang)).toBe(true);
      }

      for (const lang of unsupportedLanguages) {
        expect(hasExtractorSupport(lang)).toBe(false);
      }
    });

    it('should handle edge cases in language detection', () => {
      expect(hasExtractorSupport('')).toBe(false);
      expect(hasExtractorSupport('jsx')).toBe(false); // Not directly supported
      expect(hasExtractorSupport('ts')).toBe(false); // Not the full name
      expect(hasExtractorSupport('py')).toBe(false); // Not the full name
    });
  });

  describe('Interface compliance', () => {
    it('should ensure all extractors implement SymbolExtractor interface', () => {
      const supportedLanguages = ['typescript', 'python'];

      for (const lang of supportedLanguages) {
        const extractor = getExtractorForLanguage(lang);

        // Check that the extractor implements the required interface
        expect(typeof extractor.extract).toBe('function');
        expect(typeof extractor.extractFromFile).toBe('function');

        // Check method signatures
        expect(extractor.extract.length).toBe(3); // sourceCode, language, options?
        expect(extractor.extractFromFile.length).toBe(2); // filePath, options?
      }
    });

    it('should return consistent result structure', async () => {
      const simpleCode = 'function test() {}';

      const extractor = getExtractorForLanguage(SupportedLanguage.TypeScript);
      const result = await extractor.extract(simpleCode, SupportedLanguage.TypeScript);

      // Check that result has all required properties
      expect(result).toHaveProperty('symbols');
      expect(result).toHaveProperty('language');
      expect(result).toHaveProperty('hasErrors');
      expect(result).toHaveProperty('errors');
      expect(result).toHaveProperty('extractionTimeMs');

      expect(Array.isArray(result.symbols)).toBe(true);
      expect(typeof result.language).toBe('string');
      expect(typeof result.hasErrors).toBe('boolean');
      expect(Array.isArray(result.errors)).toBe(true);
      expect(typeof result.extractionTimeMs).toBe('number');
    });
  });
});