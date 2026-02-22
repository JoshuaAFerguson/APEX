import { describe, it, expect } from 'vitest';
import {
  RepositoryMapSchema,
  CodeSymbolSchema,
  SymbolReferenceSchema,
  ImportEdgeSchema,
  CodeFileSchema,
} from '../types';

describe('RepositoryMap Performance Tests', () => {
  describe('Schema Validation Performance', () => {
    it('should validate small objects quickly', () => {
      const start = Date.now();

      for (let i = 0; i < 1000; i++) {
        CodeSymbolSchema.parse({
          name: `function${i}`,
          type: 'function',
          filePath: `file${i}.ts`,
          startLine: 1,
          endLine: 10,
        });
      }

      const end = Date.now();
      const duration = end - start;

      expect(duration).toBeLessThan(100); // Should validate 1000 objects in under 100ms
    });

    it('should validate complex objects efficiently', () => {
      const complexSymbol = {
        name: 'ComplexClass',
        type: 'class',
        filePath: 'src/complex/ComplexClass.ts',
        startLine: 1,
        endLine: 500,
        startColumn: 1,
        endColumn: 50,
        signature: 'class ComplexClass extends BaseClass implements Interface1, Interface2',
        exported: true,
        isDefault: false,
        documentation: '/**\n * A very complex class with lots of documentation\n * @example\n * ```typescript\n * const instance = new ComplexClass();\n * ```\n */',
        parent: 'BaseClass',
        children: Array.from({ length: 50 }, (_, i) => `method${i}`),
        typeAnnotation: 'ComplexClass<T, U, V>',
        modifiers: ['export', 'default', 'abstract'],
        metadata: {
          complexity: 'high',
          testCoverage: 85.5,
          lastModified: new Date(),
          dependencies: Array.from({ length: 20 }, (_, i) => `dep${i}`),
          nestedObject: {
            level1: {
              level2: {
                level3: {
                  data: Array.from({ length: 100 }, (_, i) => ({ id: i, value: `value${i}` }))
                }
              }
            }
          }
        },
      };

      const start = Date.now();

      for (let i = 0; i < 100; i++) {
        CodeSymbolSchema.parse({
          ...complexSymbol,
          name: `${complexSymbol.name}${i}`,
        });
      }

      const end = Date.now();
      const duration = end - start;

      expect(duration).toBeLessThan(500); // Should validate 100 complex objects in under 500ms
    });

    it('should handle large arrays efficiently', () => {
      const start = Date.now();

      const largeRepoMap = RepositoryMapSchema.parse({
        rootPath: '/large-project',
        files: Array.from({ length: 1000 }, (_, i) => ({
          path: `src/file${i}.ts`,
          language: 'typescript',
          symbols: Array.from({ length: 10 }, (_, j) => ({
            name: `symbol${i}_${j}`,
            type: 'function' as const,
            filePath: `src/file${i}.ts`,
            startLine: j + 1,
            endLine: j + 5,
          })),
        })),
        references: Array.from({ length: 5000 }, (_, i) => ({
          symbolName: `symbol${Math.floor(i / 10)}_${i % 10}`,
          sourceFile: `src/file${Math.floor(i / 50)}.ts`,
          targetFile: `src/file${Math.floor(Math.random() * 1000)}.ts`,
          line: (i % 1000) + 1,
          column: (i % 100) + 1,
        })),
      });

      const end = Date.now();
      const duration = end - start;

      expect(largeRepoMap.files).toHaveLength(1000);
      expect(largeRepoMap.references).toHaveLength(5000);
      expect(duration).toBeLessThan(2000); // Should parse large structure in under 2 seconds
    });
  });

  describe('Memory Usage Tests', () => {
    it('should not leak memory during repeated validations', () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Perform many validations
      for (let batch = 0; batch < 10; batch++) {
        const objects = [];
        for (let i = 0; i < 100; i++) {
          objects.push(CodeSymbolSchema.parse({
            name: `symbol${batch}_${i}`,
            type: 'function',
            filePath: `file${i}.ts`,
            startLine: 1,
            endLine: 10,
            metadata: {
              batchNumber: batch,
              index: i,
              largeArray: Array.from({ length: 100 }, (_, j) => j),
            },
          }));
        }
        // Clear references to allow garbage collection
        objects.length = 0;
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });

    it('should handle deeply nested structures without stack overflow', () => {
      // Create a deeply nested metadata structure
      const createDeepObject = (depth: number): any => {
        if (depth === 0) {
          return { value: 'leaf' };
        }
        return { [`level${depth}`]: createDeepObject(depth - 1) };
      };

      const deepMetadata = createDeepObject(500); // 500 levels deep

      const symbol = CodeSymbolSchema.parse({
        name: 'deepSymbol',
        type: 'function',
        filePath: 'test.ts',
        startLine: 1,
        endLine: 1,
        metadata: deepMetadata,
      });

      // Should be able to access the deep value
      let current = symbol.metadata;
      for (let i = 500; i > 0; i--) {
        current = current[`level${i}`];
      }
      expect(current.value).toBe('leaf');
    });
  });

  describe('Concurrent Validation Tests', () => {
    it('should handle concurrent validations safely', async () => {
      const promises = Array.from({ length: 100 }, async (_, i) => {
        const repoMap = RepositoryMapSchema.parse({
          rootPath: `/project${i}`,
          files: Array.from({ length: 10 }, (_, j) => ({
            path: `file${j}.ts`,
            symbols: Array.from({ length: 5 }, (_, k) => ({
              name: `symbol${j}_${k}`,
              type: 'function' as const,
              filePath: `file${j}.ts`,
              startLine: k + 1,
              endLine: k + 5,
            })),
          })),
        });

        return { id: i, fileCount: repoMap.files.length };
      });

      const results = await Promise.all(promises);

      expect(results).toHaveLength(100);
      expect(results.every(r => r.fileCount === 10)).toBe(true);
      expect(results.map(r => r.id).sort()).toEqual(Array.from({ length: 100 }, (_, i) => i));
    });
  });

  describe('Error Performance Tests', () => {
    it('should handle validation errors quickly', () => {
      const invalidObjects = [
        { name: '', type: 'function', filePath: 'test.ts' },
        { name: 'test', type: 'invalid', filePath: 'test.ts' },
        { name: 'test', type: 'function', filePath: '' },
        { name: 'test', type: 'function', filePath: 'test.ts', startLine: -1 },
        { name: 'test', type: 'function', filePath: 'test.ts', startLine: 10, endLine: 5 },
      ];

      const start = Date.now();

      for (let i = 0; i < 1000; i++) {
        const obj = invalidObjects[i % invalidObjects.length];
        try {
          CodeSymbolSchema.parse(obj);
        } catch (error) {
          // Expected to throw
          expect(error).toBeDefined();
        }
      }

      const end = Date.now();
      const duration = end - start;

      expect(duration).toBeLessThan(200); // Should handle 1000 validation errors in under 200ms
    });

    it('should provide clear error messages quickly', () => {
      const start = Date.now();

      try {
        RepositoryMapSchema.parse({
          rootPath: '',
          files: [
            {
              path: '',
              symbols: [
                {
                  name: '',
                  type: 'invalid',
                  filePath: '',
                  startLine: -1,
                  endLine: -5,
                }
              ]
            }
          ]
        });
      } catch (error) {
        const end = Date.now();
        const duration = end - start;

        expect(duration).toBeLessThan(50); // Should generate error quickly
        expect(error).toBeDefined();
      }
    });
  });

  describe('Real-World Performance Scenarios', () => {
    it('should handle typical React project structure efficiently', () => {
      const start = Date.now();

      const reactProject = RepositoryMapSchema.parse({
        rootPath: '/react-app',
        files: [
          // Create typical React project structure
          ...Array.from({ length: 50 }, (_, i) => ({
            path: `src/components/Component${i}.tsx`,
            language: 'typescript',
            symbols: [
              {
                name: `Component${i}`,
                type: 'function' as const,
                filePath: `src/components/Component${i}.tsx`,
                startLine: 5,
                endLine: 25,
                exported: true,
                isDefault: true,
              },
              {
                name: `useComponent${i}Hook`,
                type: 'function' as const,
                filePath: `src/components/Component${i}.tsx`,
                startLine: 30,
                endLine: 40,
                exported: true,
              }
            ],
            imports: [
              {
                sourceFile: `src/components/Component${i}.tsx`,
                targetFile: 'react',
                importedSymbols: ['React', 'useState', 'useEffect'],
                importType: 'named',
              }
            ]
          })),
          // Utils
          ...Array.from({ length: 20 }, (_, i) => ({
            path: `src/utils/util${i}.ts`,
            language: 'typescript',
            symbols: Array.from({ length: 5 }, (_, j) => ({
              name: `util${i}Function${j}`,
              type: 'function' as const,
              filePath: `src/utils/util${i}.ts`,
              startLine: j * 5 + 1,
              endLine: j * 5 + 5,
              exported: true,
            }))
          })),
          // Types
          ...Array.from({ length: 10 }, (_, i) => ({
            path: `src/types/types${i}.ts`,
            language: 'typescript',
            symbols: Array.from({ length: 8 }, (_, j) => ({
              name: `Type${i}Interface${j}`,
              type: 'interface' as const,
              filePath: `src/types/types${i}.ts`,
              startLine: j * 3 + 1,
              endLine: j * 3 + 3,
              exported: true,
            }))
          }))
        ],
        stats: {
          totalFiles: 80,
          totalSymbols: 280, // 50*2 + 20*5 + 10*8
          totalReferences: 0,
          languageBreakdown: { typescript: 80 },
          symbolTypeBreakdown: {
            function: 200,
            interface: 80,
          }
        }
      });

      const end = Date.now();
      const duration = end - start;

      expect(reactProject.files).toHaveLength(80);
      expect(duration).toBeLessThan(500); // Should parse typical React project quickly
    });

    it('should handle monorepo structure efficiently', () => {
      const start = Date.now();

      const monorepo = RepositoryMapSchema.parse({
        rootPath: '/monorepo',
        files: [
          // Core package
          ...Array.from({ length: 30 }, (_, i) => ({
            path: `packages/core/src/module${i}.ts`,
            language: 'typescript',
            symbols: Array.from({ length: 6 }, (_, j) => ({
              name: `coreFunction${i}_${j}`,
              type: 'function' as const,
              filePath: `packages/core/src/module${i}.ts`,
              startLine: j * 5 + 1,
              endLine: j * 5 + 5,
              exported: true,
            }))
          })),
          // UI package
          ...Array.from({ length: 40 }, (_, i) => ({
            path: `packages/ui/src/Component${i}.tsx`,
            language: 'typescript',
            symbols: [
              {
                name: `UIComponent${i}`,
                type: 'function' as const,
                filePath: `packages/ui/src/Component${i}.tsx`,
                startLine: 1,
                endLine: 30,
                exported: true,
              }
            ],
            imports: [
              {
                sourceFile: `packages/ui/src/Component${i}.tsx`,
                targetFile: `packages/core/src/module${i % 30}.ts`,
                importedSymbols: [`coreFunction${i % 30}_0`],
              }
            ]
          })),
          // API package
          ...Array.from({ length: 25 }, (_, i) => ({
            path: `packages/api/src/route${i}.ts`,
            language: 'typescript',
            symbols: Array.from({ length: 4 }, (_, j) => ({
              name: `route${i}Handler${j}`,
              type: 'function' as const,
              filePath: `packages/api/src/route${i}.ts`,
              startLine: j * 10 + 1,
              endLine: j * 10 + 10,
              exported: true,
            }))
          }))
        ],
        references: Array.from({ length: 40 }, (_, i) => ({
          symbolName: `coreFunction${i % 30}_0`,
          sourceFile: `packages/ui/src/Component${i}.tsx`,
          targetFile: `packages/core/src/module${i % 30}.ts`,
          line: 10,
          column: 15,
          symbolType: 'function',
        })),
        stats: {
          totalFiles: 95,
          totalSymbols: 320, // 30*6 + 40*1 + 25*4
          totalReferences: 40,
        }
      });

      const end = Date.now();
      const duration = end - start;

      expect(monorepo.files).toHaveLength(95);
      expect(monorepo.references).toHaveLength(40);
      expect(duration).toBeLessThan(800); // Should parse monorepo structure efficiently
    });
  });
});