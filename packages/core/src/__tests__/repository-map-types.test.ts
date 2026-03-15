import { describe, it, expect } from 'vitest';
import {
  RepositoryMap,
  RepositoryMapSchema,
  CodeSymbol,
  CodeSymbolSchema,
  SymbolReference,
  SymbolReferenceSchema,
  ImportEdge,
  ImportEdgeSchema,
  CodeFile,
  CodeFileSchema,
  SymbolType,
  SymbolTypeSchema,
} from '../types';

describe('RepositoryMap Types and Schemas', () => {
  describe('SymbolType enum', () => {
    it('should export SymbolType enum and schema correctly', () => {
      const validTypes: SymbolType[] = [
        'function',
        'class',
        'interface',
        'type',
        'enum',
        'variable',
        'constant',
        'property',
        'method',
        'module',
        'import',
        'export',
        'parameter',
        'generic',
        'decorator',
        'unknown',
      ];

      for (const symbolType of validTypes) {
        expect(SymbolTypeSchema.parse(symbolType)).toBe(symbolType);
      }

      // Test invalid type
      expect(() => SymbolTypeSchema.parse('invalid')).toThrow();
    });
  });

  describe('CodeSymbol type and schema', () => {
    it('should export CodeSymbol type correctly with required fields', () => {
      const symbol: CodeSymbol = {
        name: 'calculateTotal',
        type: 'function',
        filePath: 'src/utils/math.ts',
        startLine: 15,
        endLine: 25,
      };

      expect(symbol.name).toBe('calculateTotal');
      expect(symbol.type).toBe('function');
      expect(symbol.filePath).toBe('src/utils/math.ts');
      expect(symbol.startLine).toBe(15);
      expect(symbol.endLine).toBe(25);
    });

    it('should export CodeSymbol with all optional fields', () => {
      const fullSymbol: CodeSymbol = {
        name: 'UserService',
        type: 'class',
        filePath: 'src/services/UserService.ts',
        startLine: 10,
        endLine: 100,
        startColumn: 0,
        endColumn: 1,
        signature: 'class UserService',
        exported: true,
        isDefault: false,
        documentation: '/** User management service */',
        parent: 'ServiceModule',
        children: ['getUser', 'createUser'],
        typeAnnotation: 'UserService',
        modifiers: ['export', 'default'],
        metadata: { complexity: 'medium' },
      };

      expect(fullSymbol.name).toBe('UserService');
      expect(fullSymbol.exported).toBe(true);
      expect(fullSymbol.children).toEqual(['getUser', 'createUser']);
      expect(fullSymbol.metadata?.complexity).toBe('medium');
    });

    it('should validate CodeSymbol via schema', () => {
      const validSymbol = {
        name: 'testFunc',
        type: 'function',
        filePath: 'test.ts',
        startLine: 1,
        endLine: 5,
      };

      const result = CodeSymbolSchema.parse(validSymbol);
      expect(result.name).toBe('testFunc');
      expect(result.type).toBe('function');

      // Should reject invalid data
      expect(() => CodeSymbolSchema.parse({ name: '', type: 'function' })).toThrow();
      expect(() => CodeSymbolSchema.parse({ name: 'test', type: 'invalid' })).toThrow();
    });
  });

  describe('SymbolReference type and schema', () => {
    it('should export SymbolReference type correctly', () => {
      const reference: SymbolReference = {
        symbolName: 'calculateTotal',
        sourceFile: 'src/components/Cart.tsx',
        targetFile: 'src/utils/math.ts',
        sourceLine: 25,
        sourceColumn: 10,
      };

      expect(reference.symbolName).toBe('calculateTotal');
      expect(reference.sourceFile).toBe('src/components/Cart.tsx');
      expect(reference.targetFile).toBe('src/utils/math.ts');
      expect(reference.sourceLine).toBe(25);
      expect(reference.sourceColumn).toBe(10);
    });

    it('should export SymbolReference with optional fields', () => {
      const fullReference: SymbolReference = {
        symbolName: 'UserService',
        sourceFile: 'src/controllers/UserController.ts',
        targetFile: 'src/services/UserService.ts',
        sourceLine: 15,
        sourceColumn: 20,
        symbolType: 'class',
        targetLine: 10,
        referenceType: 'instantiation',
        isTypeOnly: false,
        confidence: 0.9,
        metadata: { usage: 'constructor' },
      };

      expect(fullReference.referenceType).toBe('instantiation');
      expect(fullReference.isTypeOnly).toBe(false);
      expect(fullReference.confidence).toBe(0.9);
      expect(fullReference.metadata?.usage).toBe('constructor');
    });

    it('should validate SymbolReference via schema', () => {
      const validReference = {
        symbolName: 'MyClass',
        sourceFile: 'src/a.ts',
        targetFile: 'src/b.ts',
        sourceLine: 1,
        sourceColumn: 1,
      };

      const result = SymbolReferenceSchema.parse(validReference);
      expect(result.symbolName).toBe('MyClass');

      // Should reject invalid data
      expect(() => SymbolReferenceSchema.parse({ symbolName: '', sourceFile: 'a.ts' })).toThrow();
      expect(() => SymbolReferenceSchema.parse({ symbolName: 'test', sourceLine: 0 })).toThrow();
    });
  });

  describe('ImportEdge type and schema', () => {
    it('should export ImportEdge type correctly', () => {
      const importEdge: ImportEdge = {
        sourceFile: 'src/components/Cart.tsx',
        targetFile: 'src/utils/math.ts',
      };

      expect(importEdge.sourceFile).toBe('src/components/Cart.tsx');
      expect(importEdge.targetFile).toBe('src/utils/math.ts');
    });

    it('should export ImportEdge with all optional fields', () => {
      const fullImportEdge: ImportEdge = {
        sourceFile: 'src/components/App.tsx',
        targetFile: 'src/components/Header.tsx',
        importSpecifier: './Header',
        importedSymbols: ['Header', 'Navigation'],
        isTypeOnly: false,
        isDynamic: false,
        importType: 'named',
        line: 5,
        isUsed: true,
        resolvedPath: '/absolute/path/to/Header.tsx',
      };

      expect(fullImportEdge.importedSymbols).toEqual(['Header', 'Navigation']);
      expect(fullImportEdge.importType).toBe('named');
      expect(fullImportEdge.isUsed).toBe(true);
    });

    it('should validate ImportEdge via schema', () => {
      const validImport = {
        sourceFile: 'a.ts',
        targetFile: 'b.ts',
        importType: 'default',
      };

      const result = ImportEdgeSchema.parse(validImport);
      expect(result.importType).toBe('default');

      // Should reject invalid data
      expect(() => ImportEdgeSchema.parse({ sourceFile: '', targetFile: 'b.ts' })).toThrow();
      expect(() => ImportEdgeSchema.parse({ sourceFile: 'a.ts', targetFile: '', importType: 'invalid' })).toThrow();
    });
  });

  describe('CodeFile type and schema', () => {
    it('should export CodeFile type correctly', () => {
      const codeFile: CodeFile = {
        path: 'src/utils/math.ts',
      };

      expect(codeFile.path).toBe('src/utils/math.ts');
    });

    it('should export CodeFile with all optional fields', () => {
      const fullCodeFile: CodeFile = {
        path: 'src/services/UserService.ts',
        language: 'typescript',
        symbols: [
          {
            name: 'UserService',
            type: 'class',
            filePath: 'src/services/UserService.ts',
            startLine: 1,
            endLine: 50,
          }
        ],
        imports: [
          {
            sourceFile: 'src/services/UserService.ts',
            targetFile: 'src/types/User.ts',
          }
        ],
        exports: [
          {
            name: 'UserService',
            isDefault: true,
          }
        ],
        lineCount: 50,
        size: 2048,
        lastModified: new Date('2024-01-15'),
        contentHash: 'abc123',
        hasErrors: false,
        errors: [],
        metadata: { version: '1.0' },
      };

      expect(fullCodeFile.language).toBe('typescript');
      expect(fullCodeFile.symbols).toHaveLength(1);
      expect(fullCodeFile.imports).toHaveLength(1);
      expect(fullCodeFile.lineCount).toBe(50);
      expect(fullCodeFile.lastModified).toBeInstanceOf(Date);
    });

    it('should validate CodeFile via schema', () => {
      const validFile = {
        path: 'test.ts',
        language: 'typescript',
      };

      const result = CodeFileSchema.parse(validFile);
      expect(result.path).toBe('test.ts');

      // Should reject invalid data
      expect(() => CodeFileSchema.parse({ path: '' })).toThrow();
      expect(() => CodeFileSchema.parse({ path: 'test.ts', lineCount: -1 })).toThrow();
    });
  });

  describe('RepositoryMap type and schema', () => {
    it('should export RepositoryMap type correctly', () => {
      const repoMap: RepositoryMap = {
        rootPath: '/path/to/repo',
      };

      expect(repoMap.rootPath).toBe('/path/to/repo');
    });

    it('should export RepositoryMap with all optional fields', () => {
      const fullRepoMap: RepositoryMap = {
        rootPath: '/Users/dev/myproject',
        name: 'MyProject',
        files: [
          {
            path: 'src/index.ts',
            language: 'typescript',
          }
        ],
        references: [
          {
            symbolName: 'main',
            sourceFile: 'src/app.ts',
            targetFile: 'src/index.ts',
            sourceLine: 1,
            sourceColumn: 1,
          }
        ],
        stats: {
          totalFiles: 10,
          totalSymbols: 50,
          totalReferences: 100,
          totalLines: 1000,
          languageBreakdown: { typescript: 8, javascript: 2 },
          symbolTypeBreakdown: { function: 25, class: 15, variable: 10 },
        },
        createdAt: new Date('2024-01-15'),
        version: '1.0.0',
        commitHash: 'abc123def456',
        branch: 'main',
        config: {
          includePatterns: ['src/**/*.ts'],
          excludePatterns: ['node_modules/**'],
          languages: ['typescript'],
          maxFileSize: 1024000,
        },
        errors: [],
        metadata: { generator: 'apex-cli' },
      };

      expect(fullRepoMap.name).toBe('MyProject');
      expect(fullRepoMap.files).toHaveLength(1);
      expect(fullRepoMap.references).toHaveLength(1);
      expect(fullRepoMap.stats?.totalFiles).toBe(10);
      expect(fullRepoMap.createdAt).toBeInstanceOf(Date);
      expect(fullRepoMap.version).toBe('1.0.0');
    });

    it('should validate RepositoryMap via schema', () => {
      const validRepoMap = {
        rootPath: '/test/repo',
        name: 'TestRepo',
      };

      const result = RepositoryMapSchema.parse(validRepoMap);
      expect(result.rootPath).toBe('/test/repo');
      expect(result.name).toBe('TestRepo');

      // Should reject invalid data
      expect(() => RepositoryMapSchema.parse({ rootPath: '' })).toThrow();
      expect(() => RepositoryMapSchema.parse({})).toThrow();
    });

    it('should apply default values correctly', () => {
      const minimalRepoMap = {
        rootPath: '/test/repo',
      };

      const result = RepositoryMapSchema.parse(minimalRepoMap);
      expect(result.files).toEqual([]);
      expect(result.references).toEqual([]);
      expect(result.errors).toEqual([]);
      expect(result.version).toBe('1.0.0');
    });
  });

  describe('Type integration and relationships', () => {
    it('should support creating complex repository structures', () => {
      // Create a realistic repository map with all types working together
      const complexRepoMap: RepositoryMap = {
        rootPath: '/projects/ecommerce',
        name: 'E-commerce App',
        files: [
          {
            path: 'src/utils/math.ts',
            language: 'typescript',
            symbols: [
              {
                name: 'calculateTotal',
                type: 'function',
                filePath: 'src/utils/math.ts',
                startLine: 5,
                endLine: 15,
                exported: true,
                signature: 'function calculateTotal(items: Item[]): number',
              }
            ],
            imports: [],
            exports: [
              { name: 'calculateTotal', isDefault: false }
            ],
          },
          {
            path: 'src/components/Cart.tsx',
            language: 'typescript',
            symbols: [
              {
                name: 'Cart',
                type: 'function',
                filePath: 'src/components/Cart.tsx',
                startLine: 8,
                endLine: 25,
                exported: true,
                isDefault: true,
              }
            ],
            imports: [
              {
                sourceFile: 'src/components/Cart.tsx',
                targetFile: 'src/utils/math.ts',
                importedSymbols: ['calculateTotal'],
                importType: 'named',
              }
            ],
          }
        ],
        references: [
          {
            symbolName: 'calculateTotal',
            sourceFile: 'src/components/Cart.tsx',
            targetFile: 'src/utils/math.ts',
            sourceLine: 15,
            sourceColumn: 20,
            symbolType: 'function',
            referenceType: 'call',
          }
        ],
        stats: {
          totalFiles: 2,
          totalSymbols: 2,
          totalReferences: 1,
          languageBreakdown: { typescript: 2 },
          symbolTypeBreakdown: { function: 2 },
        },
      };

      expect(complexRepoMap.files).toHaveLength(2);
      expect(complexRepoMap.references).toHaveLength(1);
      expect(complexRepoMap.files[0].symbols[0].name).toBe('calculateTotal');
      expect(complexRepoMap.files[1].imports[0].importedSymbols).toContain('calculateTotal');
      expect(complexRepoMap.references[0].symbolName).toBe('calculateTotal');

      // Validate the entire structure via schema
      const result = RepositoryMapSchema.parse(complexRepoMap);
      expect(result.files).toHaveLength(2);
    });
  });

  describe('Schema validation edge cases', () => {
    describe('CodeSymbol validation edge cases', () => {
      it('should reject invalid line numbers', () => {
        expect(() => CodeSymbolSchema.parse({
          name: 'test',
          type: 'function',
          filePath: 'test.ts',
          startLine: 0, // Invalid: must be >= 1
          endLine: 5,
        })).toThrow();

        expect(() => CodeSymbolSchema.parse({
          name: 'test',
          type: 'function',
          filePath: 'test.ts',
          startLine: 5,
          endLine: -1, // Invalid: must be >= 1
        })).toThrow();

        expect(() => CodeSymbolSchema.parse({
          name: 'test',
          type: 'function',
          filePath: 'test.ts',
          startLine: 10,
          endLine: 5, // Valid: schema doesn't enforce start <= end
        })).not.toThrow();
      });

      it('should reject invalid column numbers', () => {
        expect(() => CodeSymbolSchema.parse({
          name: 'test',
          type: 'function',
          filePath: 'test.ts',
          startLine: 1,
          endLine: 5,
          startColumn: -1, // Invalid: must be >= 0
        })).toThrow();

        expect(() => CodeSymbolSchema.parse({
          name: 'test',
          type: 'function',
          filePath: 'test.ts',
          startLine: 1,
          endLine: 5,
          endColumn: -1, // Invalid: must be >= 0
        })).toThrow();
      });

      it('should handle empty optional arrays correctly', () => {
        const symbol = CodeSymbolSchema.parse({
          name: 'test',
          type: 'function',
          filePath: 'test.ts',
          startLine: 1,
          endLine: 5,
          children: [],
          modifiers: [],
        });

        expect(symbol.children).toEqual([]);
        expect(symbol.modifiers).toEqual([]);
      });

      it('should validate metadata as any object', () => {
        const symbol = CodeSymbolSchema.parse({
          name: 'test',
          type: 'function',
          filePath: 'test.ts',
          startLine: 1,
          endLine: 5,
          metadata: {
            nested: { deeply: { complex: true } },
            array: [1, 2, 'three'],
            null: null,
            number: 42,
          },
        });

        expect(symbol.metadata?.nested.deeply.complex).toBe(true);
        expect(symbol.metadata?.array).toEqual([1, 2, 'three']);
        expect(symbol.metadata?.null).toBe(null);
      });
    });

    describe('SymbolReference validation edge cases', () => {
      it('should reject invalid confidence values', () => {
        expect(() => SymbolReferenceSchema.parse({
          symbolName: 'test',
          sourceFile: 'a.ts',
          targetFile: 'b.ts',
          sourceLine: 1,
          confidence: -0.1, // Invalid: must be >= 0
        })).toThrow();

        expect(() => SymbolReferenceSchema.parse({
          symbolName: 'test',
          sourceFile: 'a.ts',
          targetFile: 'b.ts',
          sourceLine: 1,
          confidence: 1.1, // Invalid: must be <= 1
        })).toThrow();

        // Valid values
        const ref1 = SymbolReferenceSchema.parse({
          symbolName: 'test',
          sourceFile: 'a.ts',
          targetFile: 'b.ts',
          sourceLine: 1,
          confidence: 0,
        });
        expect(ref1.confidence).toBe(0);

        const ref2 = SymbolReferenceSchema.parse({
          symbolName: 'test',
          sourceFile: 'a.ts',
          targetFile: 'b.ts',
          sourceLine: 1,
          confidence: 1,
        });
        expect(ref2.confidence).toBe(1);
      });

      it('should apply default confidence value', () => {
        const ref = SymbolReferenceSchema.parse({
          symbolName: 'test',
          sourceFile: 'a.ts',
          targetFile: 'b.ts',
          sourceLine: 1,
        });
        expect(ref.confidence).toBe(1); // Default value
      });

      it('should validate referenceType enum correctly', () => {
        const validTypes = ['call', 'instantiation', 'assignment', 'declaration', 'type', 'extends', 'implements', 'import', 'export'];

        for (const refType of validTypes) {
          const ref = SymbolReferenceSchema.parse({
            symbolName: 'test',
            sourceFile: 'a.ts',
            targetFile: 'b.ts',
            sourceLine: 1,
            referenceType: refType,
          });
          expect(ref.referenceType).toBe(refType);
        }

        expect(() => SymbolReferenceSchema.parse({
          symbolName: 'test',
          sourceFile: 'a.ts',
          targetFile: 'b.ts',
          sourceLine: 1,
          referenceType: 'invalid',
        })).toThrow();
      });
    });

    describe('ImportEdge validation edge cases', () => {
      it('should validate importType enum correctly', () => {
        const validImportTypes = ['named', 'default', 'namespace', 'dynamic', 'side-effect'];

        for (const importType of validImportTypes) {
          const edge = ImportEdgeSchema.parse({
            sourceFile: 'a.ts',
            targetFile: 'b.ts',
            importType,
          });
          expect(edge.importType).toBe(importType);
        }

        expect(() => ImportEdgeSchema.parse({
          sourceFile: 'a.ts',
          targetFile: 'b.ts',
          importType: 'invalid',
        })).toThrow();
      });

      it('should handle empty importedSymbols array as default', () => {
        const edge = ImportEdgeSchema.parse({
          sourceFile: 'a.ts',
          targetFile: 'b.ts',
        });
        expect(edge.importedSymbols).toEqual([]);
      });

      it('should validate line numbers if provided', () => {
        expect(() => ImportEdgeSchema.parse({
          sourceFile: 'a.ts',
          targetFile: 'b.ts',
          line: 0, // Invalid: must be >= 1
        })).toThrow();

        const edge = ImportEdgeSchema.parse({
          sourceFile: 'a.ts',
          targetFile: 'b.ts',
          line: 1,
        });
        expect(edge.line).toBe(1);
      });
    });

    describe('CodeFile validation edge cases', () => {
      it('should reject negative numeric fields', () => {
        expect(() => CodeFileSchema.parse({
          path: 'test.ts',
          lineCount: -1, // Invalid: must be >= 0
        })).toThrow();

        expect(() => CodeFileSchema.parse({
          path: 'test.ts',
          size: -1, // Invalid: must be >= 0
        })).toThrow();
      });

      it('should apply default empty arrays', () => {
        const file = CodeFileSchema.parse({
          path: 'test.ts',
        });
        expect(file.symbols).toEqual([]);
        expect(file.imports).toEqual([]);
        expect(file.exports).toEqual([]);
        expect(file.errors).toEqual([]);
      });

      it('should validate nested symbol and import structures', () => {
        const file = CodeFileSchema.parse({
          path: 'complex.ts',
          symbols: [
            {
              name: 'TestClass',
              type: 'class',
              filePath: 'complex.ts',
              startLine: 1,
              endLine: 50,
            }
          ],
          imports: [
            {
              sourceFile: 'complex.ts',
              targetFile: 'utils.ts',
              importedSymbols: ['helper'],
            }
          ],
        });

        expect(file.symbols).toHaveLength(1);
        expect(file.imports).toHaveLength(1);
        expect(file.symbols[0].name).toBe('TestClass');
        expect(file.imports[0].importedSymbols).toEqual(['helper']);
      });
    });

    describe('RepositoryMap validation edge cases', () => {
      it('should apply correct default values', () => {
        const repoMap = RepositoryMapSchema.parse({
          rootPath: '/test',
        });

        expect(repoMap.files).toEqual([]);
        expect(repoMap.references).toEqual([]);
        expect(repoMap.errors).toEqual([]);
        expect(repoMap.version).toBe('1.0.0');
      });

      it('should validate stats object structure', () => {
        const repoMap = RepositoryMapSchema.parse({
          rootPath: '/test',
          stats: {
            totalFiles: 5,
            totalSymbols: 25,
            totalReferences: 50,
            totalLines: 1000,
            languageBreakdown: {
              typescript: 3,
              javascript: 2,
            },
            symbolTypeBreakdown: {
              function: 15,
              class: 10,
            },
          },
        });

        expect(repoMap.stats?.totalFiles).toBe(5);
        expect(repoMap.stats?.languageBreakdown?.typescript).toBe(3);
        expect(repoMap.stats?.symbolTypeBreakdown?.function).toBe(15);
      });

      it('should reject negative values in stats', () => {
        expect(() => RepositoryMapSchema.parse({
          rootPath: '/test',
          stats: {
            totalFiles: -1, // Invalid
            totalSymbols: 0,
            totalReferences: 0,
          },
        })).toThrow();

        expect(() => RepositoryMapSchema.parse({
          rootPath: '/test',
          stats: {
            totalFiles: 0,
            totalSymbols: 0,
            totalReferences: 0,
            languageBreakdown: {
              typescript: -1, // Invalid
            },
          },
        })).toThrow();
      });

      it('should validate complex nested structures', () => {
        const complexRepo = RepositoryMapSchema.parse({
          rootPath: '/complex-project',
          name: 'Complex Project',
          files: [
            {
              path: 'src/main.ts',
              language: 'typescript',
              symbols: [
                {
                  name: 'main',
                  type: 'function',
                  filePath: 'src/main.ts',
                  startLine: 1,
                  endLine: 10,
                  exported: true,
                  signature: 'function main(): void',
                  metadata: { entry: true },
                }
              ],
              imports: [
                {
                  sourceFile: 'src/main.ts',
                  targetFile: 'src/utils.ts',
                  importedSymbols: ['helper'],
                  importType: 'named',
                }
              ],
              exports: [
                { name: 'main', isDefault: true }
              ],
              lineCount: 10,
              lastModified: new Date('2024-01-01'),
            }
          ],
          references: [
            {
              symbolName: 'helper',
              sourceFile: 'src/main.ts',
              targetFile: 'src/utils.ts',
              sourceLine: 5,
              symbolType: 'function',
              referenceType: 'call',
            }
          ],
          stats: {
            totalFiles: 1,
            totalSymbols: 1,
            totalReferences: 1,
            totalLines: 10,
          },
          createdAt: new Date('2024-01-01'),
          version: '2.0.0',
        });

        expect(complexRepo.files).toHaveLength(1);
        expect(complexRepo.references).toHaveLength(1);
        expect(complexRepo.files[0].symbols[0].metadata?.entry).toBe(true);
        expect(complexRepo.references[0].referenceType).toBe('call');
      });
    });
  });

  describe('Type exports and imports', () => {
    it('should export all types from the module', () => {
      // Test that all types are properly exported and can be imported
      expect(RepositoryMap).toBeDefined();
      expect(CodeSymbol).toBeDefined();
      expect(SymbolReference).toBeDefined();
      expect(ImportEdge).toBeDefined();
      expect(CodeFile).toBeDefined();
      expect(SymbolType).toBeDefined();
    });

    it('should export all schemas from the module', () => {
      // Test that all schemas are properly exported and can be imported
      expect(RepositoryMapSchema).toBeDefined();
      expect(CodeSymbolSchema).toBeDefined();
      expect(SymbolReferenceSchema).toBeDefined();
      expect(ImportEdgeSchema).toBeDefined();
      expect(CodeFileSchema).toBeDefined();
      expect(SymbolTypeSchema).toBeDefined();
    });

    it('should have schemas that match their corresponding types', () => {
      // Test type inference consistency
      const symbol: CodeSymbol = {
        name: 'test',
        type: 'function',
        filePath: 'test.ts',
        startLine: 1,
        endLine: 5,
      };

      const parsedSymbol = CodeSymbolSchema.parse(symbol);
      expect(parsedSymbol).toEqual(symbol);

      // Type should be inferred correctly
      const typeCheck: CodeSymbol = parsedSymbol;
      expect(typeCheck.name).toBe('test');
    });
  });

  describe('Real-world usage scenarios', () => {
    it('should handle TypeScript project structure', () => {
      const typescriptProject: RepositoryMap = {
        rootPath: '/projects/typescript-app',
        name: 'TypeScript Application',
        files: [
          {
            path: 'src/types/User.ts',
            language: 'typescript',
            symbols: [
              {
                name: 'User',
                type: 'interface',
                filePath: 'src/types/User.ts',
                startLine: 1,
                endLine: 10,
                exported: true,
                signature: 'interface User { id: string; name: string; }',
              }
            ],
            exports: [{ name: 'User', isDefault: false, isTypeOnly: true }],
          },
          {
            path: 'src/services/UserService.ts',
            language: 'typescript',
            symbols: [
              {
                name: 'UserService',
                type: 'class',
                filePath: 'src/services/UserService.ts',
                startLine: 5,
                endLine: 25,
                exported: true,
                signature: 'class UserService { ... }',
              }
            ],
            imports: [
              {
                sourceFile: 'src/services/UserService.ts',
                targetFile: 'src/types/User.ts',
                importedSymbols: ['User'],
                importType: 'named',
                isTypeOnly: true,
              }
            ],
          }
        ],
        references: [
          {
            symbolName: 'User',
            sourceFile: 'src/services/UserService.ts',
            targetFile: 'src/types/User.ts',
            sourceLine: 1,
            symbolType: 'interface',
            referenceType: 'type',
            isTypeOnly: true,
          }
        ],
        stats: {
          totalFiles: 2,
          totalSymbols: 2,
          totalReferences: 1,
          languageBreakdown: { typescript: 2 },
          symbolTypeBreakdown: { interface: 1, class: 1 },
        },
      };

      const result = RepositoryMapSchema.parse(typescriptProject);
      expect(result.files).toHaveLength(2);
      expect(result.references[0].isTypeOnly).toBe(true);
      expect(result.files[0].exports[0].isTypeOnly).toBe(true);
    });

    it('should handle JavaScript project with dynamic imports', () => {
      const jsProject: RepositoryMap = {
        rootPath: '/projects/js-app',
        files: [
          {
            path: 'src/utils.js',
            language: 'javascript',
            symbols: [
              {
                name: 'helper',
                type: 'function',
                filePath: 'src/utils.js',
                startLine: 1,
                endLine: 10,
                exported: true,
              }
            ],
          },
          {
            path: 'src/main.js',
            language: 'javascript',
            imports: [
              {
                sourceFile: 'src/main.js',
                targetFile: 'src/utils.js',
                importType: 'dynamic',
                isDynamic: true,
                importSpecifier: './utils.js',
                line: 5,
              }
            ],
          }
        ],
        stats: {
          totalFiles: 2,
          totalSymbols: 1,
          totalReferences: 0,
          languageBreakdown: { javascript: 2 },
        },
      };

      const result = RepositoryMapSchema.parse(jsProject);
      expect(result.files[1].imports[0].isDynamic).toBe(true);
      expect(result.files[1].imports[0].importType).toBe('dynamic');
    });
  });
});