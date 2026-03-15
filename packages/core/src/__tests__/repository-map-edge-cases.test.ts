import { describe, it, expect } from 'vitest';
import {
  RepositoryMapSchema,
  CodeSymbolSchema,
  SymbolReferenceSchema,
  ImportEdgeSchema,
  CodeFileSchema,
  SymbolTypeSchema,
} from '../types';

describe('RepositoryMap Edge Cases and Validation', () => {
  describe('Schema Boundary Testing', () => {
    describe('String Length Validations', () => {
      it('should reject empty strings for required fields', () => {
        // CodeSymbol empty name
        expect(() => CodeSymbolSchema.parse({
          name: '',
          type: 'function',
          filePath: 'test.ts',
          startLine: 1,
          endLine: 1,
        })).toThrow('Symbol name is required');

        // CodeSymbol empty filePath
        expect(() => CodeSymbolSchema.parse({
          name: 'test',
          type: 'function',
          filePath: '',
          startLine: 1,
          endLine: 1,
        })).toThrow('File path is required');

        // RepositoryMap empty rootPath
        expect(() => RepositoryMapSchema.parse({
          rootPath: '',
        })).toThrow('Root path is required');

        // ImportEdge empty sourceFile
        expect(() => ImportEdgeSchema.parse({
          sourceFile: '',
          targetFile: 'target.ts',
        })).toThrow('Source file is required');

        // ImportEdge empty targetFile
        expect(() => ImportEdgeSchema.parse({
          sourceFile: 'source.ts',
          targetFile: '',
        })).toThrow('Target file is required');
      });

      it('should handle very long strings', () => {
        const longString = 'a'.repeat(10000);

        const symbol = CodeSymbolSchema.parse({
          name: longString,
          type: 'function',
          filePath: longString,
          startLine: 1,
          endLine: 1,
          documentation: longString,
          signature: longString,
        });

        expect(symbol.name).toBe(longString);
        expect(symbol.documentation).toBe(longString);
      });
    });

    describe('Numeric Validations', () => {
      it('should validate line and column numbers', () => {
        // Negative line numbers should be rejected
        expect(() => CodeSymbolSchema.parse({
          name: 'test',
          type: 'function',
          filePath: 'test.ts',
          startLine: -1,
          endLine: 1,
        })).toThrow();

        expect(() => CodeSymbolSchema.parse({
          name: 'test',
          type: 'function',
          filePath: 'test.ts',
          startLine: 1,
          endLine: -1,
        })).toThrow();

        // Zero line numbers should be rejected
        expect(() => CodeSymbolSchema.parse({
          name: 'test',
          type: 'function',
          filePath: 'test.ts',
          startLine: 0,
          endLine: 1,
        })).toThrow();

        // Valid line numbers
        const validSymbol = CodeSymbolSchema.parse({
          name: 'test',
          type: 'function',
          filePath: 'test.ts',
          startLine: 1,
          endLine: 1000000,
        });

        expect(validSymbol.startLine).toBe(1);
        expect(validSymbol.endLine).toBe(1000000);
      });

      it('should validate logical line number relationships', () => {
        // endLine should not be less than startLine
        expect(() => CodeSymbolSchema.parse({
          name: 'test',
          type: 'function',
          filePath: 'test.ts',
          startLine: 10,
          endLine: 5,
        })).toThrow();

        // Equal start and end lines should be allowed
        const symbol = CodeSymbolSchema.parse({
          name: 'test',
          type: 'function',
          filePath: 'test.ts',
          startLine: 10,
          endLine: 10,
        });

        expect(symbol.startLine).toBe(symbol.endLine);
      });

      it('should validate column numbers in SymbolReference', () => {
        // Negative column should be rejected
        expect(() => SymbolReferenceSchema.parse({
          symbolName: 'test',
          sourceFile: 'a.ts',
          targetFile: 'b.ts',
          line: 1,
          column: -1,
        })).toThrow();

        // Zero column should be rejected
        expect(() => SymbolReferenceSchema.parse({
          symbolName: 'test',
          sourceFile: 'a.ts',
          targetFile: 'b.ts',
          line: 1,
          column: 0,
        })).toThrow();

        // Valid column
        const ref = SymbolReferenceSchema.parse({
          symbolName: 'test',
          sourceFile: 'a.ts',
          targetFile: 'b.ts',
          line: 1,
          column: 1,
        });

        expect(ref.column).toBe(1);
      });

      it('should validate file size limits in CodeFile', () => {
        // Negative size should be rejected
        expect(() => CodeFileSchema.parse({
          path: 'test.ts',
          size: -1,
        })).toThrow();

        // Zero size should be allowed
        const emptyFile = CodeFileSchema.parse({
          path: 'test.ts',
          size: 0,
        });

        expect(emptyFile.size).toBe(0);

        // Large file size should be allowed
        const largeFile = CodeFileSchema.parse({
          path: 'test.ts',
          size: 1024 * 1024 * 1024, // 1GB
        });

        expect(largeFile.size).toBe(1024 * 1024 * 1024);
      });
    });

    describe('Array Validations', () => {
      it('should handle empty arrays correctly', () => {
        const repoMap = RepositoryMapSchema.parse({
          rootPath: '/test',
          files: [],
          references: [],
          errors: [],
        });

        expect(repoMap.files).toEqual([]);
        expect(repoMap.references).toEqual([]);
        expect(repoMap.errors).toEqual([]);
      });

      it('should handle large arrays', () => {
        const manyFiles = Array.from({ length: 1000 }, (_, i) => ({
          path: `file${i}.ts`,
          language: 'typescript',
        }));

        const repoMap = RepositoryMapSchema.parse({
          rootPath: '/test',
          files: manyFiles,
        });

        expect(repoMap.files).toHaveLength(1000);
        expect(repoMap.files[999].path).toBe('file999.ts');
      });
    });
  });

  describe('Complex Object Validations', () => {
    it('should validate deeply nested metadata objects', () => {
      const complexMetadata = {
        nested: {
          deeply: {
            very: {
              much: {
                so: {
                  deep: 'value',
                  numbers: [1, 2, 3],
                  boolean: true,
                  null_value: null,
                }
              }
            }
          }
        }
      };

      const symbol = CodeSymbolSchema.parse({
        name: 'test',
        type: 'function',
        filePath: 'test.ts',
        startLine: 1,
        endLine: 1,
        metadata: complexMetadata,
      });

      expect(symbol.metadata.nested.deeply.very.much.so.deep).toBe('value');
      expect(symbol.metadata.nested.deeply.very.much.so.numbers).toEqual([1, 2, 3]);
    });

    it('should validate language breakdown objects in stats', () => {
      const repoMap = RepositoryMapSchema.parse({
        rootPath: '/test',
        stats: {
          totalFiles: 100,
          totalSymbols: 500,
          totalReferences: 1000,
          languageBreakdown: {
            typescript: 50,
            javascript: 30,
            python: 15,
            'c++': 3, // Test language with special characters
            'objective-c': 2,
          },
          symbolTypeBreakdown: {
            function: 200,
            class: 100,
            interface: 50,
            type: 75,
            variable: 75,
          },
        },
      });

      expect(repoMap.stats!.languageBreakdown['c++']).toBe(3);
      expect(repoMap.stats!.languageBreakdown['objective-c']).toBe(2);
      expect(repoMap.stats!.symbolTypeBreakdown.function).toBe(200);
    });
  });

  describe('Date and Special Type Validations', () => {
    it('should handle various date formats', () => {
      const dates = [
        new Date(),
        new Date('2024-01-15'),
        new Date('2024-12-31T23:59:59.999Z'),
        new Date(0), // Unix epoch
      ];

      for (const date of dates) {
        const repoMap = RepositoryMapSchema.parse({
          rootPath: '/test',
          createdAt: date,
        });

        expect(repoMap.createdAt).toBeInstanceOf(Date);
        expect(repoMap.createdAt?.getTime()).toBe(date.getTime());
      }
    });

    it('should reject invalid date objects', () => {
      expect(() => RepositoryMapSchema.parse({
        rootPath: '/test',
        createdAt: 'invalid-date',
      })).toThrow();

      expect(() => RepositoryMapSchema.parse({
        rootPath: '/test',
        createdAt: 123456,
      })).toThrow();
    });
  });

  describe('Enum Validations', () => {
    it('should handle all valid SymbolType enum values', () => {
      const validTypes = [
        'function', 'class', 'interface', 'type', 'enum',
        'variable', 'constant', 'property', 'method', 'module',
        'import', 'export', 'parameter', 'generic', 'decorator', 'unknown'
      ];

      for (const symbolType of validTypes) {
        const parsed = SymbolTypeSchema.parse(symbolType);
        expect(parsed).toBe(symbolType);

        // Test in CodeSymbol context
        const symbol = CodeSymbolSchema.parse({
          name: 'test',
          type: symbolType,
          filePath: 'test.ts',
          startLine: 1,
          endLine: 1,
        });

        expect(symbol.type).toBe(symbolType);
      }
    });

    it('should reject invalid SymbolType values', () => {
      const invalidTypes = [
        'invalid', 'FUNCTION', 'Class', 'struct', 'namespace',
        '', null, undefined, 123, [], {}
      ];

      for (const invalidType of invalidTypes) {
        expect(() => SymbolTypeSchema.parse(invalidType)).toThrow();
      }
    });

    it('should validate ImportEdge importType enum', () => {
      const validImportTypes = ['named', 'default', 'namespace', 'side-effect'];

      for (const importType of validImportTypes) {
        const importEdge = ImportEdgeSchema.parse({
          sourceFile: 'a.ts',
          targetFile: 'b.ts',
          importType,
        });

        expect(importEdge.importType).toBe(importType);
      }

      // Invalid import types
      expect(() => ImportEdgeSchema.parse({
        sourceFile: 'a.ts',
        targetFile: 'b.ts',
        importType: 'invalid',
      })).toThrow();
    });
  });

  describe('Cross-Field Validations', () => {
    it('should validate endLine >= startLine in CodeSymbol', () => {
      // Valid: endLine > startLine
      const symbol1 = CodeSymbolSchema.parse({
        name: 'test',
        type: 'function',
        filePath: 'test.ts',
        startLine: 5,
        endLine: 10,
      });
      expect(symbol1.endLine).toBeGreaterThan(symbol1.startLine);

      // Valid: endLine = startLine
      const symbol2 = CodeSymbolSchema.parse({
        name: 'test',
        type: 'variable',
        filePath: 'test.ts',
        startLine: 5,
        endLine: 5,
      });
      expect(symbol2.endLine).toBe(symbol2.startLine);

      // Invalid: endLine < startLine
      expect(() => CodeSymbolSchema.parse({
        name: 'test',
        type: 'function',
        filePath: 'test.ts',
        startLine: 10,
        endLine: 5,
      })).toThrow();
    });

    it('should validate endColumn >= startColumn in CodeSymbol when both present', () => {
      // Valid: endColumn > startColumn
      const symbol1 = CodeSymbolSchema.parse({
        name: 'test',
        type: 'function',
        filePath: 'test.ts',
        startLine: 5,
        endLine: 5,
        startColumn: 10,
        endColumn: 20,
      });
      expect(symbol1.endColumn).toBeGreaterThan(symbol1.startColumn!);

      // Valid: endColumn = startColumn
      const symbol2 = CodeSymbolSchema.parse({
        name: 'test',
        type: 'variable',
        filePath: 'test.ts',
        startLine: 5,
        endLine: 5,
        startColumn: 10,
        endColumn: 10,
      });
      expect(symbol2.endColumn).toBe(symbol2.startColumn);

      // Invalid: endColumn < startColumn
      expect(() => CodeSymbolSchema.parse({
        name: 'test',
        type: 'function',
        filePath: 'test.ts',
        startLine: 5,
        endLine: 5,
        startColumn: 20,
        endColumn: 10,
      })).toThrow();
    });
  });

  describe('Performance and Memory Tests', () => {
    it('should handle large repository maps efficiently', () => {
      const startTime = Date.now();

      // Create a large repository map
      const largeRepoMap = RepositoryMapSchema.parse({
        rootPath: '/large/project',
        files: Array.from({ length: 5000 }, (_, i) => ({
          path: `src/components/Component${i}.tsx`,
          language: 'typescript',
          symbols: Array.from({ length: 10 }, (_, j) => ({
            name: `symbol${j}`,
            type: 'function' as const,
            filePath: `src/components/Component${i}.tsx`,
            startLine: j + 1,
            endLine: j + 5,
          })),
          imports: Array.from({ length: 5 }, (_, k) => ({
            sourceFile: `src/components/Component${i}.tsx`,
            targetFile: `src/utils/util${k}.ts`,
            importedSymbols: [`util${k}`],
          })),
        })),
        references: Array.from({ length: 10000 }, (_, i) => ({
          symbolName: `symbol${i % 10}`,
          sourceFile: `src/components/Component${Math.floor(i / 10)}.tsx`,
          targetFile: `src/utils/util${i % 5}.ts`,
          line: (i % 100) + 1,
          column: (i % 50) + 1,
        })),
      });

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      expect(largeRepoMap.files).toHaveLength(5000);
      expect(largeRepoMap.references).toHaveLength(10000);
      expect(processingTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle deeply nested structures without stack overflow', () => {
      const deepMetadata: any = {};
      let current = deepMetadata;

      // Create 100 levels of nesting
      for (let i = 0; i < 100; i++) {
        current[`level${i}`] = {};
        current = current[`level${i}`];
      }
      current.value = 'deep';

      const symbol = CodeSymbolSchema.parse({
        name: 'test',
        type: 'function',
        filePath: 'test.ts',
        startLine: 1,
        endLine: 1,
        metadata: deepMetadata,
      });

      // Should be able to access deeply nested value
      let accessor: any = symbol.metadata;
      for (let i = 0; i < 100; i++) {
        accessor = accessor[`level${i}`];
      }
      expect(accessor.value).toBe('deep');
    });
  });

  describe('Real-World Scenario Testing', () => {
    it('should handle common file path formats', () => {
      const commonPaths = [
        'src/index.ts',
        './relative/path.js',
        '../parent/file.tsx',
        '/absolute/path/file.py',
        'packages/core/src/types.ts',
        'node_modules/@types/node/index.d.ts',
        'dist/build/output.js',
        'src/components/ui/Button/index.tsx',
        'tests/__mocks__/fs.ts',
        'docs/README.md',
        'src/utils/string-helpers.spec.ts',
      ];

      for (const path of commonPaths) {
        const file = CodeFileSchema.parse({ path });
        expect(file.path).toBe(path);

        const symbol = CodeSymbolSchema.parse({
          name: 'test',
          type: 'function',
          filePath: path,
          startLine: 1,
          endLine: 1,
        });
        expect(symbol.filePath).toBe(path);
      }
    });

    it('should handle common language identifiers', () => {
      const languages = [
        'typescript', 'javascript', 'python', 'java', 'c#', 'c++',
        'go', 'rust', 'php', 'ruby', 'swift', 'kotlin', 'scala',
        'r', 'matlab', 'shell', 'dockerfile', 'yaml', 'json',
        'markdown', 'html', 'css', 'scss', 'less', 'vue', 'svelte'
      ];

      for (const language of languages) {
        const file = CodeFileSchema.parse({
          path: `test.${language}`,
          language,
        });
        expect(file.language).toBe(language);
      }
    });

    it('should handle various symbol naming patterns', () => {
      const symbolNames = [
        // Basic names
        'myFunction', 'MyClass', 'CONSTANT_VALUE',
        // Special characters
        '_private', '__dunder__', '$jquery', '@decorator',
        // Numbers
        'function1', 'v2Update', 'init3d',
        // Namespaced
        'MyNamespace.MyClass', 'module::function', 'pkg.subpkg.Class',
        // Generic
        'Map<K,V>', 'Promise<T>', 'Array<string>',
        // Operators
        'operator+', 'operator[]', 'operator==',
      ];

      for (const name of symbolNames) {
        const symbol = CodeSymbolSchema.parse({
          name,
          type: 'function',
          filePath: 'test.ts',
          startLine: 1,
          endLine: 1,
        });
        expect(symbol.name).toBe(name);
      }
    });
  });
});