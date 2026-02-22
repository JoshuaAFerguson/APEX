/**
 * Comprehensive Factory Function Tests
 *
 * Exhaustive tests for the getExtractorForLanguage factory function,
 * covering all edge cases, error conditions, and usage patterns.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getExtractorForLanguage,
  hasExtractorSupport,
  TypeScriptExtractor,
  PythonExtractor,
  ExtractionError,
  SUPPORTED_EXTRACTOR_LANGUAGES,
  TYPESCRIPT_EXTRACTOR_LANGUAGES,
  PYTHON_EXTRACTOR_LANGUAGES,
  type SymbolExtractor
} from '../index.js';
import { SupportedLanguage } from '../../parsers/types.js';

describe('Factory Function Comprehensive Tests', () => {
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

  describe('getExtractorForLanguage - Basic Functionality', () => {
    it('should return TypeScript extractor for all TypeScript family languages', () => {
      const tsLanguages = ['typescript', 'tsx', 'javascript'];

      for (const lang of tsLanguages) {
        const extractor = getExtractorForLanguage(lang);
        expect(extractor).toBeInstanceOf(TypeScriptExtractor);
        expect(extractor).toBe(TypeScriptExtractor.getInstance());
      }
    });

    it('should return Python extractor for Python language', () => {
      const extractor = getExtractorForLanguage('python');
      expect(extractor).toBeInstanceOf(PythonExtractor);
      expect(extractor).toBe(PythonExtractor.getInstance());
    });

    it('should return the same instance for multiple calls', () => {
      const extractor1 = getExtractorForLanguage('typescript');
      const extractor2 = getExtractorForLanguage('typescript');
      const extractor3 = getExtractorForLanguage(SupportedLanguage.TypeScript);

      expect(extractor1).toBe(extractor2);
      expect(extractor2).toBe(extractor3);
    });

    it('should work with SupportedLanguage enum values', () => {
      const extractors = [
        { lang: SupportedLanguage.TypeScript, expected: TypeScriptExtractor },
        { lang: SupportedLanguage.TSX, expected: TypeScriptExtractor },
        { lang: SupportedLanguage.JavaScript, expected: TypeScriptExtractor },
        { lang: SupportedLanguage.Python, expected: PythonExtractor }
      ];

      for (const { lang, expected } of extractors) {
        const extractor = getExtractorForLanguage(lang);
        expect(extractor).toBeInstanceOf(expected);
      }
    });
  });

  describe('getExtractorForLanguage - Error Conditions', () => {
    it('should throw ExtractionError for unsupported languages', () => {
      const unsupportedLanguages = [
        'java', 'cpp', 'c', 'rust', 'go', 'ruby', 'php', 'kotlin',
        'swift', 'dart', 'scala', 'haskell', 'erlang', 'clojure'
      ];

      for (const lang of unsupportedLanguages) {
        expect(() => getExtractorForLanguage(lang)).toThrow(ExtractionError);
        expect(() => getExtractorForLanguage(lang)).toThrow(
          `No symbol extractor available for language: ${lang}`
        );
        expect(() => getExtractorForLanguage(lang)).toThrow(
          'Supported languages are: typescript, tsx, javascript, python'
        );
      }
    });

    it('should throw ExtractionError for empty string', () => {
      expect(() => getExtractorForLanguage('')).toThrow(ExtractionError);
      expect(() => getExtractorForLanguage('')).toThrow(
        'No symbol extractor available for language: '
      );
    });

    it('should throw ExtractionError for null and undefined', () => {
      expect(() => getExtractorForLanguage(null as any)).toThrow(ExtractionError);
      expect(() => getExtractorForLanguage(undefined as any)).toThrow(ExtractionError);
    });

    it('should throw ExtractionError for non-string types', () => {
      const invalidInputs = [
        123,
        true,
        false,
        {},
        [],
        Symbol('test'),
        new Date(),
        /regex/
      ];

      for (const input of invalidInputs) {
        expect(() => getExtractorForLanguage(input as any)).toThrow(ExtractionError);
      }
    });

    it('should be case-sensitive', () => {
      const caseVariations = [
        'TypeScript', 'TYPESCRIPT', 'Typescript', 'typeScript',
        'JavaScript', 'JAVASCRIPT', 'Javascript', 'javaScript',
        'Python', 'PYTHON', 'python3', 'Python3',
        'TSX', 'tSx', 'Tsx'
      ];

      for (const variation of caseVariations) {
        if (variation.toLowerCase() !== variation) { // Skip valid lowercase versions
          expect(() => getExtractorForLanguage(variation)).toThrow(ExtractionError);
        }
      }
    });

    it('should not accept similar but incorrect language names', () => {
      const similarLanguages = [
        'ts', 'js', 'py',          // Abbreviations
        'jsx', 'mjs', 'cjs',       // Similar extensions
        'typescript-react',         // Modified names
        'es6', 'es2015', 'es2020', // JavaScript versions
        'python2', 'python3',      // Python versions
        'node', 'nodejs',          // Runtime names
        'ecmascript'               // Official name variations
      ];

      for (const lang of similarLanguages) {
        expect(() => getExtractorForLanguage(lang)).toThrow(ExtractionError);
      }
    });
  });

  describe('getExtractorForLanguage - Whitespace Handling', () => {
    it('should not trim whitespace from language strings', () => {
      const whitespaceVariations = [
        ' typescript',
        'typescript ',
        ' typescript ',
        '\ttypescript',
        'typescript\t',
        '\ntypescript',
        'typescript\n',
        '  python  ',
        '\t\tjavascript\t\t'
      ];

      for (const lang of whitespaceVariations) {
        expect(() => getExtractorForLanguage(lang)).toThrow(ExtractionError);
      }
    });

    it('should treat whitespace-only strings as invalid', () => {
      const whitespaceStrings = [
        ' ',
        '  ',
        '\t',
        '\n',
        '\r',
        '\r\n',
        '   \t  \n  '
      ];

      for (const lang of whitespaceStrings) {
        expect(() => getExtractorForLanguage(lang)).toThrow(ExtractionError);
      }
    });
  });

  describe('hasExtractorSupport - Functionality', () => {
    it('should return true for all supported languages', () => {
      for (const lang of SUPPORTED_EXTRACTOR_LANGUAGES) {
        expect(hasExtractorSupport(lang)).toBe(true);
      }
    });

    it('should return false for unsupported languages', () => {
      const unsupportedLanguages = [
        'java', 'cpp', 'rust', 'go', 'ruby', 'php', 'kotlin', 'swift'
      ];

      for (const lang of unsupportedLanguages) {
        expect(hasExtractorSupport(lang)).toBe(false);
      }
    });

    it('should be consistent with getExtractorForLanguage', () => {
      // All languages that hasExtractorSupport returns true for should work with getExtractorForLanguage
      for (const lang of SUPPORTED_EXTRACTOR_LANGUAGES) {
        expect(hasExtractorSupport(lang)).toBe(true);
        expect(() => getExtractorForLanguage(lang)).not.toThrow();
      }

      // Some languages that hasExtractorSupport returns false for should fail with getExtractorForLanguage
      const unsupportedLanguages = ['java', 'cpp', 'rust'];
      for (const lang of unsupportedLanguages) {
        expect(hasExtractorSupport(lang)).toBe(false);
        expect(() => getExtractorForLanguage(lang)).toThrow(ExtractionError);
      }
    });

    it('should handle edge cases correctly', () => {
      expect(hasExtractorSupport('')).toBe(false);
      expect(hasExtractorSupport(' typescript ')).toBe(false);
      expect(hasExtractorSupport('TypeScript')).toBe(false);
      expect(hasExtractorSupport(null as any)).toBe(false);
      expect(hasExtractorSupport(undefined as any)).toBe(false);
    });
  });

  describe('Language Support Constants', () => {
    it('should have correct TypeScript extractor languages', () => {
      expect(TYPESCRIPT_EXTRACTOR_LANGUAGES).toEqual(['typescript', 'tsx', 'javascript']);
      expect(TYPESCRIPT_EXTRACTOR_LANGUAGES).toHaveLength(3);
    });

    it('should have correct Python extractor languages', () => {
      expect(PYTHON_EXTRACTOR_LANGUAGES).toEqual(['python']);
      expect(PYTHON_EXTRACTOR_LANGUAGES).toHaveLength(1);
    });

    it('should have correct combined supported languages', () => {
      expect(SUPPORTED_EXTRACTOR_LANGUAGES).toEqual(['typescript', 'tsx', 'javascript', 'python']);
      expect(SUPPORTED_EXTRACTOR_LANGUAGES).toHaveLength(4);
    });

    it('should maintain consistency between constants', () => {
      const combinedLanguages = [
        ...TYPESCRIPT_EXTRACTOR_LANGUAGES,
        ...PYTHON_EXTRACTOR_LANGUAGES
      ];

      expect(SUPPORTED_EXTRACTOR_LANGUAGES).toEqual(combinedLanguages);
    });
  });

  describe('Singleton Pattern Verification', () => {
    it('should maintain singleton pattern for TypeScript extractor', () => {
      const instances = [
        getExtractorForLanguage('typescript'),
        getExtractorForLanguage('tsx'),
        getExtractorForLanguage('javascript'),
        getExtractorForLanguage(SupportedLanguage.TypeScript),
        getExtractorForLanguage(SupportedLanguage.TSX),
        getExtractorForLanguage(SupportedLanguage.JavaScript),
        TypeScriptExtractor.getInstance()
      ];

      const first = instances[0];
      for (const instance of instances) {
        expect(instance).toBe(first);
      }
    });

    it('should maintain singleton pattern for Python extractor', () => {
      const instances = [
        getExtractorForLanguage('python'),
        getExtractorForLanguage(SupportedLanguage.Python),
        PythonExtractor.getInstance()
      ];

      const first = instances[0];
      for (const instance of instances) {
        expect(instance).toBe(first);
      }
    });

    it('should return different instances for different language families', () => {
      const tsExtractor = getExtractorForLanguage('typescript');
      const pyExtractor = getExtractorForLanguage('python');

      expect(tsExtractor).not.toBe(pyExtractor);
      expect(tsExtractor).toBeInstanceOf(TypeScriptExtractor);
      expect(pyExtractor).toBeInstanceOf(PythonExtractor);
    });
  });

  describe('Factory Function Error Messages', () => {
    it('should provide helpful error messages', () => {
      const testCases = [
        {
          input: 'java',
          expectedMessage: 'No symbol extractor available for language: java. Supported languages are: typescript, tsx, javascript, python'
        },
        {
          input: 'rust',
          expectedMessage: 'No symbol extractor available for language: rust. Supported languages are: typescript, tsx, javascript, python'
        },
        {
          input: '',
          expectedMessage: 'No symbol extractor available for language: . Supported languages are: typescript, tsx, javascript, python'
        }
      ];

      for (const { input, expectedMessage } of testCases) {
        try {
          getExtractorForLanguage(input);
          fail(`Expected ExtractionError for input: ${input}`);
        } catch (error) {
          expect(error).toBeInstanceOf(ExtractionError);
          expect(error.message).toBe(expectedMessage);
        }
      }
    });

    it('should include all supported languages in error message', () => {
      try {
        getExtractorForLanguage('unsupported');
      } catch (error) {
        expect(error.message).toContain('typescript');
        expect(error.message).toContain('tsx');
        expect(error.message).toContain('javascript');
        expect(error.message).toContain('python');
      }
    });
  });

  describe('Extractor Interface Compliance', () => {
    it('should return objects implementing SymbolExtractor interface', () => {
      const extractors = [
        getExtractorForLanguage('typescript'),
        getExtractorForLanguage('python')
      ];

      for (const extractor of extractors) {
        // Check that it has the required methods
        expect(typeof extractor.extract).toBe('function');
        expect(typeof extractor.extractFromFile).toBe('function');

        // Check method signatures
        expect(extractor.extract.length).toBe(3); // sourceCode, language, options
        expect(extractor.extractFromFile.length).toBe(2); // filePath, options
      }
    });

    it('should return extractors that can be used immediately', async () => {
      const simpleCode = 'function test() {}';

      for (const lang of SUPPORTED_EXTRACTOR_LANGUAGES) {
        const extractor = getExtractorForLanguage(lang);

        // Should be able to call extract method immediately
        const result = await extractor.extract(simpleCode, lang as SupportedLanguage);

        expect(result).toBeDefined();
        expect(result.symbols).toBeDefined();
        expect(result.language).toBe(lang);
      }
    });
  });

  describe('Performance and Stress Testing', () => {
    it('should handle rapid repeated calls efficiently', () => {
      const iterations = 1000;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        const extractor = getExtractorForLanguage('typescript');
        expect(extractor).toBeInstanceOf(TypeScriptExtractor);
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Should complete quickly (less than 1 second for 1000 calls)
      expect(totalTime).toBeLessThan(1000);
    });

    it('should handle concurrent access to factory', async () => {
      const promises = Array.from({ length: 100 }, (_, i) =>
        Promise.resolve().then(() => getExtractorForLanguage('typescript'))
      );

      const extractors = await Promise.all(promises);

      // All should be the same instance
      const first = extractors[0];
      for (const extractor of extractors) {
        expect(extractor).toBe(first);
      }
    });
  });
});