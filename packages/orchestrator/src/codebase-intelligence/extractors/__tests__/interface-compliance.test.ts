/**
 * Interface Compliance Tests for Symbol Extractors
 *
 * Tests that all extractors properly implement the SymbolExtractor interface
 * and return consistent, well-formed results according to the contract.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getExtractorForLanguage,
  TypeScriptExtractor,
  PythonExtractor,
  SymbolKind,
  ExtractionError,
  DEFAULT_EXTRACTION_OPTIONS,
  hasExtractorSupport,
  type SymbolExtractor,
  type ExtractedSymbol,
  type ExtractionResult,
  type ExtractionOptions,
  type SymbolModifier,
  type ExportKind
} from '../index.js';
import { SupportedLanguage } from '../../parsers/types.js';

describe('Symbol Extractor Interface Compliance', () => {
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

  describe('SymbolExtractor interface contract', () => {
    const getAllExtractors = (): SymbolExtractor[] => [
      getExtractorForLanguage(SupportedLanguage.TypeScript),
      getExtractorForLanguage(SupportedLanguage.Python)
    ];

    it('should implement all required methods', () => {
      for (const extractor of getAllExtractors()) {
        expect(typeof extractor.extract).toBe('function');
        expect(typeof extractor.extractFromFile).toBe('function');
      }
    });

    it('should have correct method signatures', () => {
      for (const extractor of getAllExtractors()) {
        // extract(sourceCode, language, options?)
        expect(extractor.extract.length).toBe(3);

        // extractFromFile(filePath, options?)
        expect(extractor.extractFromFile.length).toBe(2);
      }
    });

    it('should return promises from async methods', async () => {
      const simpleCode = 'function test() {}';

      for (const extractor of getAllExtractors()) {
        const extractPromise = extractor.extract(simpleCode, SupportedLanguage.TypeScript);
        expect(extractPromise).toBeInstanceOf(Promise);

        const result = await extractPromise;
        expect(result).toBeDefined();
      }
    });

    it('should throw ExtractionError for unsupported languages', async () => {
      for (const extractor of getAllExtractors()) {
        await expect(
          extractor.extract('function test() {}', 'unsupported' as SupportedLanguage)
        ).rejects.toThrow(ExtractionError);
      }
    });
  });

  describe('ExtractionResult contract compliance', () => {
    const testCodes = {
      typescript: `
        export function testFunction(param: string): void {
          console.log(param);
        }

        export class TestClass {
          method(): void {}
        }
      `,
      python: `
        def test_function(param):
            """Test function"""
            print(param)

        class TestClass:
            def method(self):
                pass
      `
    };

    it('should return well-formed ExtractionResult objects', async () => {
      const tsExtractor = getExtractorForLanguage(SupportedLanguage.TypeScript);
      const pyExtractor = getExtractorForLanguage(SupportedLanguage.Python);

      const tsResult = await tsExtractor.extract(testCodes.typescript, SupportedLanguage.TypeScript);
      const pyResult = await pyExtractor.extract(testCodes.python, SupportedLanguage.Python);

      for (const result of [tsResult, pyResult]) {
        // Required properties
        expect(result).toHaveProperty('symbols');
        expect(result).toHaveProperty('language');
        expect(result).toHaveProperty('hasErrors');
        expect(result).toHaveProperty('errors');
        expect(result).toHaveProperty('extractionTimeMs');

        // Type checks
        expect(Array.isArray(result.symbols)).toBe(true);
        expect(typeof result.language).toBe('string');
        expect(typeof result.hasErrors).toBe('boolean');
        expect(Array.isArray(result.errors)).toBe(true);
        expect(typeof result.extractionTimeMs).toBe('number');

        // Value constraints
        expect(result.extractionTimeMs).toBeGreaterThanOrEqual(0);
        expect(['typescript', 'python', 'javascript', 'tsx']).toContain(result.language);
      }
    });

    it('should include optional properties when present', async () => {
      const extractor = getExtractorForLanguage(SupportedLanguage.TypeScript);
      const result = await extractor.extract(testCodes.typescript, SupportedLanguage.TypeScript);

      // filePath should be undefined for string extraction
      expect(result.filePath).toBeUndefined();

      // symbolCount should be present and reasonable
      if (result.symbolCount !== undefined) {
        expect(typeof result.symbolCount).toBe('number');
        expect(result.symbolCount).toBeGreaterThanOrEqual(0);
        expect(result.symbolCount).toBeGreaterThanOrEqual(result.symbols.length);
      }
    });

    it('should handle empty code gracefully', async () => {
      const extractors = [
        { extractor: getExtractorForLanguage(SupportedLanguage.TypeScript), lang: SupportedLanguage.TypeScript },
        { extractor: getExtractorForLanguage(SupportedLanguage.Python), lang: SupportedLanguage.Python }
      ];

      for (const { extractor, lang } of extractors) {
        const result = await extractor.extract('', lang);

        expect(result.symbols).toHaveLength(0);
        expect(result.hasErrors).toBe(false);
        expect(result.errors).toHaveLength(0);
        expect(result.extractionTimeMs).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('ExtractedSymbol contract compliance', () => {
    it('should return well-formed ExtractedSymbol objects', async () => {
      const code = `
        /**
         * Test function with documentation
         * @param value The input value
         * @returns The processed result
         */
        export async function testFunction(value: string): Promise<string> {
          return value.toUpperCase();
        }

        export class TestClass {
          private field: number = 42;

          constructor(initialValue: number = 0) {
            this.field = initialValue;
          }

          public async method(param: string): Promise<void> {
            console.log(param);
          }

          get value(): number {
            return this.field;
          }
        }
      `;

      const extractor = getExtractorForLanguage(SupportedLanguage.TypeScript);
      const result = await extractor.extract(code, SupportedLanguage.TypeScript);

      expect(result.symbols.length).toBeGreaterThan(0);

      for (const symbol of result.symbols) {
        // Required properties
        expect(symbol).toHaveProperty('name');
        expect(symbol).toHaveProperty('kind');
        expect(symbol).toHaveProperty('location');
        expect(symbol).toHaveProperty('exportKind');
        expect(symbol).toHaveProperty('modifiers');

        // Type checks
        expect(typeof symbol.name).toBe('string');
        expect(Object.values(SymbolKind)).toContain(symbol.kind);
        expect(['named', 'default', 'none']).toContain(symbol.exportKind);
        expect(Array.isArray(symbol.modifiers)).toBe(true);

        // Location structure
        expect(symbol.location).toHaveProperty('start');
        expect(symbol.location).toHaveProperty('end');
        expect(symbol.location.start).toHaveProperty('row');
        expect(symbol.location.start).toHaveProperty('column');
        expect(symbol.location.end).toHaveProperty('row');
        expect(symbol.location.end).toHaveProperty('column');

        expect(typeof symbol.location.start.row).toBe('number');
        expect(typeof symbol.location.start.column).toBe('number');
        expect(typeof symbol.location.end.row).toBe('number');
        expect(typeof symbol.location.end.column).toBe('number');

        // Position constraints
        expect(symbol.location.start.row).toBeGreaterThanOrEqual(0);
        expect(symbol.location.start.column).toBeGreaterThanOrEqual(0);
        expect(symbol.location.end.row).toBeGreaterThanOrEqual(symbol.location.start.row);

        // Optional properties type checks
        if (symbol.documentation !== undefined) {
          expect(typeof symbol.documentation).toBe('string');
        }

        if (symbol.signature !== undefined) {
          expect(typeof symbol.signature).toBe('string');
        }

        if (symbol.typeAnnotation !== undefined) {
          expect(typeof symbol.typeAnnotation).toBe('string');
        }

        if (symbol.children !== undefined) {
          expect(Array.isArray(symbol.children)).toBe(true);

          // Recursively check children
          for (const child of symbol.children) {
            expect(child).toHaveProperty('name');
            expect(child).toHaveProperty('kind');
            expect(child).toHaveProperty('location');
            expect(child).toHaveProperty('exportKind');
            expect(child).toHaveProperty('modifiers');
          }
        }
      }
    });

    it('should use valid SymbolModifier values', async () => {
      const codeWithVariousModifiers = `
        export default async function defaultFunc() {}
        export const exportedConst = 42;
        let localVar = 'local';
        var oldVar = 'old';

        export abstract class AbstractClass {
          private privateField: string = '';
          protected protectedField: number = 0;
          public publicField: boolean = true;
          static staticField: symbol = Symbol();
          readonly readonlyField: Date = new Date();

          abstract abstractMethod(): void;
          private privateMethod(): void {}
          protected protectedMethod(): void {}
          public publicMethod(): void {}
          static staticMethod(): void {}

          get getter(): string { return this.privateField; }
          set setter(value: string) { this.privateField = value; }
        }
      `;

      const extractor = getExtractorForLanguage(SupportedLanguage.TypeScript);
      const result = await extractor.extract(codeWithVariousModifiers, SupportedLanguage.TypeScript);

      const validModifiers: SymbolModifier[] = [
        'export', 'default', 'async', 'static', 'readonly', 'abstract',
        'private', 'protected', 'public', 'declare', 'const', 'let', 'var',
        'generator', 'classmethod', 'staticmethod', 'property'
      ];

      // Check all symbols and their children
      const allSymbols: ExtractedSymbol[] = [];
      const collectSymbols = (symbols: ExtractedSymbol[]) => {
        for (const symbol of symbols) {
          allSymbols.push(symbol);
          if (symbol.children) {
            collectSymbols(symbol.children);
          }
        }
      };

      collectSymbols(result.symbols);

      for (const symbol of allSymbols) {
        for (const modifier of symbol.modifiers) {
          expect(validModifiers).toContain(modifier);
        }
      }
    });

    it('should use valid ExportKind values', async () => {
      const codeWithExports = `
        export function namedExport() {}
        export default function defaultExport() {}
        function noExport() {}
        const localVar = 42;
        export const namedConst = 'named';
      `;

      const extractor = getExtractorForLanguage(SupportedLanguage.TypeScript);
      const result = await extractor.extract(codeWithExports, SupportedLanguage.TypeScript);

      const validExportKinds: ExportKind[] = ['named', 'default', 'none'];

      for (const symbol of result.symbols) {
        expect(validExportKinds).toContain(symbol.exportKind);

        // Verify export kind matches actual exports
        if (symbol.modifiers.includes('export')) {
          expect(['named', 'default']).toContain(symbol.exportKind);
        }

        if (symbol.modifiers.includes('default')) {
          expect(symbol.exportKind).toBe('default');
        }
      }
    });
  });

  describe('ExtractionOptions contract compliance', () => {
    it('should respect all extraction options', async () => {
      const complexCode = `
        /**
         * Public function with JSDoc
         */
        export function publicFunction(param: string): string {
          return param;
        }

        function privateFunction() {}

        export class TestClass {
          /**
           * Public method documentation
           */
          public publicMethod(x: number, y: string): boolean {
            return x > 0;
          }

          /**
           * Private method documentation
           */
          private privateMethod(): void {}

          public get publicGetter(): string {
            return 'value';
          }

          private get privateGetter(): number {
            return 42;
          }
        }

        import { something } from 'module';
        export interface TestInterface {
          prop: string;
        }
      `;

      const extractor = getExtractorForLanguage(SupportedLanguage.TypeScript);

      // Test includeDocumentation: false
      const withoutDocs = await extractor.extract(complexCode, SupportedLanguage.TypeScript, {
        includeDocumentation: false
      });

      for (const symbol of withoutDocs.symbols) {
        expect(symbol.documentation).toBeUndefined();
        if (symbol.children) {
          for (const child of symbol.children) {
            expect(child.documentation).toBeUndefined();
          }
        }
      }

      // Test includeSignatures: false
      const withoutSignatures = await extractor.extract(complexCode, SupportedLanguage.TypeScript, {
        includeSignatures: false
      });

      for (const symbol of withoutSignatures.symbols) {
        expect(symbol.signature).toBeUndefined();
        if (symbol.children) {
          for (const child of symbol.children) {
            expect(child.signature).toBeUndefined();
          }
        }
      }

      // Test includePrivate: false
      const withoutPrivate = await extractor.extract(complexCode, SupportedLanguage.TypeScript, {
        includePrivate: false
      });

      const allSymbols: ExtractedSymbol[] = [];
      const collectSymbols = (symbols: ExtractedSymbol[]) => {
        for (const symbol of symbols) {
          allSymbols.push(symbol);
          if (symbol.children) {
            collectSymbols(symbol.children);
          }
        }
      };
      collectSymbols(withoutPrivate.symbols);

      for (const symbol of allSymbols) {
        expect(symbol.modifiers).not.toContain('private');
      }

      // Test maxDepth: 0
      const withoutChildren = await extractor.extract(complexCode, SupportedLanguage.TypeScript, {
        maxDepth: 0
      });

      for (const symbol of withoutChildren.symbols) {
        expect(symbol.children).toBeUndefined();
      }

      // Test symbolKinds filter
      const onlyFunctions = await extractor.extract(complexCode, SupportedLanguage.TypeScript, {
        symbolKinds: [SymbolKind.Function]
      });

      for (const symbol of onlyFunctions.symbols) {
        expect(symbol.kind).toBe(SymbolKind.Function);
      }

      // Test includeImports: true
      const withImports = await extractor.extract(complexCode, SupportedLanguage.TypeScript, {
        includeImports: true
      });

      const hasImportSymbol = withImports.symbols.some(s => s.kind === SymbolKind.Import);
      expect(hasImportSymbol).toBe(true);
    });

    it('should handle default options correctly', async () => {
      const code = `
        /**
         * Test function
         */
        export function testFunc(): void {}

        class TestClass {
          private privateMethod(): void {}
        }
      `;

      const extractor = getExtractorForLanguage(SupportedLanguage.TypeScript);

      // Test with no options (should use defaults)
      const defaultResult = await extractor.extract(code, SupportedLanguage.TypeScript);

      // Test with explicit default options
      const explicitDefaultResult = await extractor.extract(code, SupportedLanguage.TypeScript, {
        ...DEFAULT_EXTRACTION_OPTIONS
      });

      // Results should be equivalent
      expect(defaultResult.symbols).toHaveLength(explicitDefaultResult.symbols.length);

      for (let i = 0; i < defaultResult.symbols.length; i++) {
        const defaultSymbol = defaultResult.symbols[i];
        const explicitSymbol = explicitDefaultResult.symbols[i];

        expect(defaultSymbol.name).toBe(explicitSymbol.name);
        expect(defaultSymbol.kind).toBe(explicitSymbol.kind);
        expect(defaultSymbol.exportKind).toBe(explicitSymbol.exportKind);
      }
    });
  });

  describe('Cross-language consistency', () => {
    it('should return consistent result structure across languages', async () => {
      const tsCode = 'function test() {}';
      const pyCode = 'def test():\n    pass';

      const tsExtractor = getExtractorForLanguage(SupportedLanguage.TypeScript);
      const pyExtractor = getExtractorForLanguage(SupportedLanguage.Python);

      const tsResult = await tsExtractor.extract(tsCode, SupportedLanguage.TypeScript);
      const pyResult = await pyExtractor.extract(pyCode, SupportedLanguage.Python);

      // Both should have the same result structure
      const resultKeys = ['symbols', 'language', 'hasErrors', 'errors', 'extractionTimeMs'];

      for (const key of resultKeys) {
        expect(tsResult).toHaveProperty(key);
        expect(pyResult).toHaveProperty(key);
      }

      // Both should extract one function
      expect(tsResult.symbols).toHaveLength(1);
      expect(pyResult.symbols).toHaveLength(1);

      expect(tsResult.symbols[0].kind).toBe(SymbolKind.Function);
      expect(pyResult.symbols[0].kind).toBe(SymbolKind.Function);

      expect(tsResult.symbols[0].name).toBe('test');
      expect(pyResult.symbols[0].name).toBe('test');
    });

    it('should handle language detection correctly', async () => {
      const supportedLanguages = ['typescript', 'tsx', 'javascript', 'python'];

      for (const lang of supportedLanguages) {
        expect(hasExtractorSupport(lang)).toBe(true);

        const extractor = getExtractorForLanguage(lang as SupportedLanguage);
        expect(extractor).toBeDefined();
      }

      const unsupportedLanguages = ['java', 'cpp', 'rust', 'go'];

      for (const lang of unsupportedLanguages) {
        expect(hasExtractorSupport(lang)).toBe(false);

        expect(() => getExtractorForLanguage(lang as SupportedLanguage))
          .toThrow(ExtractionError);
      }
    });
  });
});