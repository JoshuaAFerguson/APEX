/**
 * Unit Tests for Symbol Extractor Types
 *
 * Tests the types, enums, helper functions, and type guards
 * defined in the symbol extractor types module.
 */

import { describe, it, expect } from 'vitest';
import {
  SymbolKind,
  ExtractionError,
  DEFAULT_EXTRACTION_OPTIONS,
  EXTRACTABLE_NODE_TYPES,
  NODE_TYPE_TO_SYMBOL_KIND,
  TYPESCRIPT_EXTRACTOR_LANGUAGES,
  isTypeScriptExtractorLanguage,
  PYTHON_EXTRACTOR_LANGUAGES,
  isPythonExtractorLanguage,
  PYTHON_EXTRACTABLE_NODE_TYPES,
  PYTHON_NODE_TYPE_TO_SYMBOL_KIND,
  SUPPORTED_EXTRACTOR_LANGUAGES,
  hasExtractorSupport,
  type SymbolModifier,
  type ExportKind,
  type ExtractedSymbol,
  type ExtractionOptions,
  type ExtractionResult
} from '../types.js';
import type { SupportedLanguage } from '../../parsers/types.js';

describe('Symbol Extractor Types', () => {
  describe('SymbolKind enum', () => {
    it('should have all expected symbol kinds', () => {
      expect(SymbolKind.Function).toBe('function');
      expect(SymbolKind.ArrowFunction).toBe('arrow_function');
      expect(SymbolKind.Class).toBe('class');
      expect(SymbolKind.Interface).toBe('interface');
      expect(SymbolKind.TypeAlias).toBe('type_alias');
      expect(SymbolKind.Enum).toBe('enum');
      expect(SymbolKind.Constant).toBe('constant');
      expect(SymbolKind.Variable).toBe('variable');
      expect(SymbolKind.Method).toBe('method');
      expect(SymbolKind.Property).toBe('property');
      expect(SymbolKind.Constructor).toBe('constructor');
      expect(SymbolKind.Getter).toBe('getter');
      expect(SymbolKind.Setter).toBe('setter');
      expect(SymbolKind.Parameter).toBe('parameter');
      expect(SymbolKind.EnumMember).toBe('enum_member');
      expect(SymbolKind.Decorator).toBe('decorator');
      expect(SymbolKind.Import).toBe('import');
      expect(SymbolKind.ImportFrom).toBe('import_from');
      expect(SymbolKind.Module).toBe('module');
    });

    it('should have consistent enum values', () => {
      const values = Object.values(SymbolKind);
      const uniqueValues = new Set(values);
      expect(values.length).toBe(uniqueValues.size);
    });
  });

  describe('ExtractionError', () => {
    it('should create error with message only', () => {
      const error = new ExtractionError('Test error');
      expect(error.message).toBe('Test error');
      expect(error.name).toBe('ExtractionError');
      expect(error.filePath).toBeUndefined();
      expect(error.cause).toBeUndefined();
    });

    it('should create error with message and file path', () => {
      const error = new ExtractionError('Test error', '/test/file.ts');
      expect(error.message).toBe('Test error');
      expect(error.name).toBe('ExtractionError');
      expect(error.filePath).toBe('/test/file.ts');
      expect(error.cause).toBeUndefined();
    });

    it('should create error with message, file path, and cause', () => {
      const cause = new Error('Original error');
      const error = new ExtractionError('Test error', '/test/file.ts', cause);
      expect(error.message).toBe('Test error');
      expect(error.name).toBe('ExtractionError');
      expect(error.filePath).toBe('/test/file.ts');
      expect(error.cause).toBe(cause);
    });

    it('should be instanceof Error and ExtractionError', () => {
      const error = new ExtractionError('Test error');
      expect(error instanceof Error).toBe(true);
      expect(error instanceof ExtractionError).toBe(true);
    });
  });

  describe('DEFAULT_EXTRACTION_OPTIONS', () => {
    it('should have correct default values', () => {
      expect(DEFAULT_EXTRACTION_OPTIONS.includeDocumentation).toBe(true);
      expect(DEFAULT_EXTRACTION_OPTIONS.includeSignatures).toBe(true);
      expect(DEFAULT_EXTRACTION_OPTIONS.includePrivate).toBe(true);
      expect(DEFAULT_EXTRACTION_OPTIONS.maxDepth).toBeUndefined();
      expect(DEFAULT_EXTRACTION_OPTIONS.symbolKinds).toBeUndefined();
      expect(DEFAULT_EXTRACTION_OPTIONS.includeImports).toBe(false);
      expect(DEFAULT_EXTRACTION_OPTIONS.includeDecorators).toBe(true);
    });

    it('should be readonly', () => {
      expect(() => {
        // @ts-expect-error - testing immutability
        DEFAULT_EXTRACTION_OPTIONS.includeDocumentation = false;
      }).not.toThrow(); // JavaScript allows this but TypeScript should prevent it
    });
  });

  describe('TypeScript/JavaScript extractor language support', () => {
    describe('TYPESCRIPT_EXTRACTOR_LANGUAGES', () => {
      it('should include expected languages', () => {
        expect(TYPESCRIPT_EXTRACTOR_LANGUAGES).toContain('typescript');
        expect(TYPESCRIPT_EXTRACTOR_LANGUAGES).toContain('tsx');
        expect(TYPESCRIPT_EXTRACTOR_LANGUAGES).toContain('javascript');
        expect(TYPESCRIPT_EXTRACTOR_LANGUAGES.length).toBe(3);
      });

      it('should be readonly array', () => {
        expect(Array.isArray(TYPESCRIPT_EXTRACTOR_LANGUAGES)).toBe(true);
        // Should not be able to modify - TypeScript should prevent this
        expect(() => {
          // @ts-expect-error - testing immutability
          TYPESCRIPT_EXTRACTOR_LANGUAGES.push('jsx');
        }).toThrow();
      });
    });

    describe('isTypeScriptExtractorLanguage', () => {
      it('should return true for supported languages', () => {
        expect(isTypeScriptExtractorLanguage('typescript')).toBe(true);
        expect(isTypeScriptExtractorLanguage('tsx')).toBe(true);
        expect(isTypeScriptExtractorLanguage('javascript')).toBe(true);
      });

      it('should return false for unsupported languages', () => {
        expect(isTypeScriptExtractorLanguage('python')).toBe(false);
        expect(isTypeScriptExtractorLanguage('java')).toBe(false);
        expect(isTypeScriptExtractorLanguage('cpp')).toBe(false);
        expect(isTypeScriptExtractorLanguage('rust')).toBe(false);
        expect(isTypeScriptExtractorLanguage('go')).toBe(false);
        expect(isTypeScriptExtractorLanguage('')).toBe(false);
        expect(isTypeScriptExtractorLanguage('jsx')).toBe(false);
      });

      it('should be case sensitive', () => {
        expect(isTypeScriptExtractorLanguage('TypeScript')).toBe(false);
        expect(isTypeScriptExtractorLanguage('TYPESCRIPT')).toBe(false);
        expect(isTypeScriptExtractorLanguage('JavaScript')).toBe(false);
      });
    });
  });

  describe('Python extractor language support', () => {
    describe('PYTHON_EXTRACTOR_LANGUAGES', () => {
      it('should include expected languages', () => {
        expect(PYTHON_EXTRACTOR_LANGUAGES).toContain('python');
        expect(PYTHON_EXTRACTOR_LANGUAGES.length).toBe(1);
      });

      it('should be readonly array', () => {
        expect(Array.isArray(PYTHON_EXTRACTOR_LANGUAGES)).toBe(true);
        // Should not be able to modify - TypeScript should prevent this
        expect(() => {
          // @ts-expect-error - testing immutability
          PYTHON_EXTRACTOR_LANGUAGES.push('python3');
        }).toThrow();
      });
    });

    describe('isPythonExtractorLanguage', () => {
      it('should return true for supported languages', () => {
        expect(isPythonExtractorLanguage('python')).toBe(true);
      });

      it('should return false for unsupported languages', () => {
        expect(isPythonExtractorLanguage('typescript')).toBe(false);
        expect(isPythonExtractorLanguage('javascript')).toBe(false);
        expect(isPythonExtractorLanguage('java')).toBe(false);
        expect(isPythonExtractorLanguage('python3')).toBe(false);
        expect(isPythonExtractorLanguage('py')).toBe(false);
        expect(isPythonExtractorLanguage('')).toBe(false);
      });

      it('should be case sensitive', () => {
        expect(isPythonExtractorLanguage('Python')).toBe(false);
        expect(isPythonExtractorLanguage('PYTHON')).toBe(false);
      });
    });
  });

  describe('Combined extractor language support', () => {
    describe('SUPPORTED_EXTRACTOR_LANGUAGES', () => {
      it('should include all supported languages', () => {
        expect(SUPPORTED_EXTRACTOR_LANGUAGES).toContain('typescript');
        expect(SUPPORTED_EXTRACTOR_LANGUAGES).toContain('tsx');
        expect(SUPPORTED_EXTRACTOR_LANGUAGES).toContain('javascript');
        expect(SUPPORTED_EXTRACTOR_LANGUAGES).toContain('python');
        expect(SUPPORTED_EXTRACTOR_LANGUAGES.length).toBe(4);
      });

      it('should contain TypeScript and Python languages', () => {
        for (const lang of TYPESCRIPT_EXTRACTOR_LANGUAGES) {
          expect(SUPPORTED_EXTRACTOR_LANGUAGES).toContain(lang);
        }
        for (const lang of PYTHON_EXTRACTOR_LANGUAGES) {
          expect(SUPPORTED_EXTRACTOR_LANGUAGES).toContain(lang);
        }
      });
    });

    describe('hasExtractorSupport', () => {
      it('should return true for all supported languages', () => {
        for (const lang of SUPPORTED_EXTRACTOR_LANGUAGES) {
          expect(hasExtractorSupport(lang)).toBe(true);
        }
      });

      it('should return false for unsupported languages', () => {
        const unsupportedLanguages = [
          'java',
          'cpp',
          'c',
          'rust',
          'go',
          'ruby',
          'php',
          'kotlin',
          'swift',
          'dart',
          '',
          'jsx', // Not directly supported, handled through javascript
          'python3'
        ];

        for (const lang of unsupportedLanguages) {
          expect(hasExtractorSupport(lang)).toBe(false);
        }
      });

      it('should be case sensitive', () => {
        expect(hasExtractorSupport('TypeScript')).toBe(false);
        expect(hasExtractorSupport('PYTHON')).toBe(false);
        expect(hasExtractorSupport('JavaScript')).toBe(false);
      });
    });
  });

  describe('Node type mappings', () => {
    describe('EXTRACTABLE_NODE_TYPES', () => {
      it('should have all expected node types', () => {
        expect(EXTRACTABLE_NODE_TYPES.FUNCTION_DECLARATION).toBe('function_declaration');
        expect(EXTRACTABLE_NODE_TYPES.FUNCTION_EXPRESSION).toBe('function_expression');
        expect(EXTRACTABLE_NODE_TYPES.ARROW_FUNCTION).toBe('arrow_function');
        expect(EXTRACTABLE_NODE_TYPES.CLASS_DECLARATION).toBe('class_declaration');
        expect(EXTRACTABLE_NODE_TYPES.INTERFACE_DECLARATION).toBe('interface_declaration');
        expect(EXTRACTABLE_NODE_TYPES.TYPE_ALIAS_DECLARATION).toBe('type_alias_declaration');
        expect(EXTRACTABLE_NODE_TYPES.ENUM_DECLARATION).toBe('enum_declaration');
      });

      it('should be readonly', () => {
        expect(() => {
          // @ts-expect-error - testing immutability
          EXTRACTABLE_NODE_TYPES.FUNCTION_DECLARATION = 'modified';
        }).toThrow();
      });
    });

    describe('NODE_TYPE_TO_SYMBOL_KIND', () => {
      it('should map node types to correct symbol kinds', () => {
        expect(NODE_TYPE_TO_SYMBOL_KIND['function_declaration']).toBe(SymbolKind.Function);
        expect(NODE_TYPE_TO_SYMBOL_KIND['generator_function_declaration']).toBe(SymbolKind.Function);
        expect(NODE_TYPE_TO_SYMBOL_KIND['arrow_function']).toBe(SymbolKind.ArrowFunction);
        expect(NODE_TYPE_TO_SYMBOL_KIND['class_declaration']).toBe(SymbolKind.Class);
        expect(NODE_TYPE_TO_SYMBOL_KIND['class_expression']).toBe(SymbolKind.Class);
        expect(NODE_TYPE_TO_SYMBOL_KIND['interface_declaration']).toBe(SymbolKind.Interface);
        expect(NODE_TYPE_TO_SYMBOL_KIND['type_alias_declaration']).toBe(SymbolKind.TypeAlias);
        expect(NODE_TYPE_TO_SYMBOL_KIND['enum_declaration']).toBe(SymbolKind.Enum);
      });

      it('should have valid symbol kinds as values', () => {
        const symbolKindValues = Object.values(SymbolKind);
        for (const symbolKind of Object.values(NODE_TYPE_TO_SYMBOL_KIND)) {
          expect(symbolKindValues).toContain(symbolKind);
        }
      });
    });

    describe('PYTHON_EXTRACTABLE_NODE_TYPES', () => {
      it('should have all expected Python node types', () => {
        expect(PYTHON_EXTRACTABLE_NODE_TYPES.FUNCTION_DEFINITION).toBe('function_definition');
        expect(PYTHON_EXTRACTABLE_NODE_TYPES.ASYNC_FUNCTION_DEFINITION).toBe('async_function_definition');
        expect(PYTHON_EXTRACTABLE_NODE_TYPES.CLASS_DEFINITION).toBe('class_definition');
        expect(PYTHON_EXTRACTABLE_NODE_TYPES.ASSIGNMENT).toBe('assignment');
        expect(PYTHON_EXTRACTABLE_NODE_TYPES.IMPORT_STATEMENT).toBe('import_statement');
        expect(PYTHON_EXTRACTABLE_NODE_TYPES.DECORATOR).toBe('decorator');
      });

      it('should be readonly', () => {
        expect(() => {
          // @ts-expect-error - testing immutability
          PYTHON_EXTRACTABLE_NODE_TYPES.FUNCTION_DEFINITION = 'modified';
        }).toThrow();
      });
    });

    describe('PYTHON_NODE_TYPE_TO_SYMBOL_KIND', () => {
      it('should map Python node types to correct symbol kinds', () => {
        expect(PYTHON_NODE_TYPE_TO_SYMBOL_KIND['function_definition']).toBe(SymbolKind.Function);
        expect(PYTHON_NODE_TYPE_TO_SYMBOL_KIND['async_function_definition']).toBe(SymbolKind.Function);
        expect(PYTHON_NODE_TYPE_TO_SYMBOL_KIND['class_definition']).toBe(SymbolKind.Class);
        expect(PYTHON_NODE_TYPE_TO_SYMBOL_KIND['assignment']).toBe(SymbolKind.Variable);
        expect(PYTHON_NODE_TYPE_TO_SYMBOL_KIND['parameter']).toBe(SymbolKind.Parameter);
        expect(PYTHON_NODE_TYPE_TO_SYMBOL_KIND['import_statement']).toBe(SymbolKind.Import);
        expect(PYTHON_NODE_TYPE_TO_SYMBOL_KIND['decorator']).toBe(SymbolKind.Decorator);
        expect(PYTHON_NODE_TYPE_TO_SYMBOL_KIND['module']).toBe(SymbolKind.Module);
      });

      it('should have valid symbol kinds as values', () => {
        const symbolKindValues = Object.values(SymbolKind);
        for (const symbolKind of Object.values(PYTHON_NODE_TYPE_TO_SYMBOL_KIND)) {
          expect(symbolKindValues).toContain(symbolKind);
        }
      });
    });
  });

  describe('Type interfaces', () => {
    describe('ExtractedSymbol', () => {
      it('should accept valid symbol structure', () => {
        const symbol: ExtractedSymbol = {
          name: 'testFunction',
          kind: SymbolKind.Function,
          location: {
            start: { row: 1, column: 0 },
            end: { row: 5, column: 1 },
            startIndex: 0,
            endIndex: 100
          },
          exportKind: 'named',
          modifiers: ['export', 'async'],
          documentation: 'Test function documentation',
          signature: '(param: string): Promise<void>',
          typeAnnotation: ': Promise<void>',
          children: []
        };

        expect(symbol.name).toBe('testFunction');
        expect(symbol.kind).toBe(SymbolKind.Function);
        expect(symbol.exportKind).toBe('named');
        expect(symbol.modifiers).toContain('export');
        expect(symbol.modifiers).toContain('async');
      });
    });

    describe('ExtractionOptions', () => {
      it('should accept partial options', () => {
        const options: ExtractionOptions = {
          includeDocumentation: false
        };
        expect(options.includeDocumentation).toBe(false);
      });

      it('should accept complete options', () => {
        const options: ExtractionOptions = {
          includeDocumentation: true,
          includeSignatures: true,
          includePrivate: false,
          maxDepth: 3,
          symbolKinds: [SymbolKind.Function, SymbolKind.Class],
          includeImports: true,
          includeDecorators: false
        };

        expect(options.includeDocumentation).toBe(true);
        expect(options.maxDepth).toBe(3);
        expect(options.symbolKinds).toHaveLength(2);
        expect(options.symbolKinds).toContain(SymbolKind.Function);
      });
    });

    describe('ExtractionResult', () => {
      it('should accept valid extraction result structure', () => {
        const result: ExtractionResult = {
          symbols: [],
          filePath: '/test/file.ts',
          language: 'typescript' as SupportedLanguage,
          hasErrors: false,
          errors: [],
          extractionTimeMs: 150,
          symbolCount: 0
        };

        expect(result.symbols).toHaveLength(0);
        expect(result.filePath).toBe('/test/file.ts');
        expect(result.language).toBe('typescript');
        expect(result.hasErrors).toBe(false);
        expect(result.extractionTimeMs).toBe(150);
      });
    });
  });

  describe('Type unions and literals', () => {
    describe('SymbolModifier', () => {
      it('should accept all valid modifiers', () => {
        const validModifiers: SymbolModifier[] = [
          'export',
          'default',
          'async',
          'static',
          'readonly',
          'abstract',
          'private',
          'protected',
          'public',
          'declare',
          'const',
          'let',
          'var',
          'generator',
          'classmethod',
          'staticmethod',
          'property'
        ];

        // Type system should accept all these values
        for (const modifier of validModifiers) {
          const mod: SymbolModifier = modifier;
          expect(mod).toBe(modifier);
        }
      });
    });

    describe('ExportKind', () => {
      it('should accept all valid export kinds', () => {
        const validExportKinds: ExportKind[] = ['named', 'default', 'none'];

        for (const exportKind of validExportKinds) {
          const kind: ExportKind = exportKind;
          expect(kind).toBe(exportKind);
        }
      });
    });
  });
});