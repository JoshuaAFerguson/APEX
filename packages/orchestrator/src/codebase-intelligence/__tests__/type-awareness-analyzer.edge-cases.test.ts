import { describe, expect, test, beforeEach, afterEach, vi } from 'vitest';
import { TypeAwarenessAnalyzer } from '../type-awareness-analyzer.js';
import type { TypeAnalysisOptions } from '../type-awareness-analyzer.js';

// Mock dependencies
vi.mock('../parsers/tree-sitter-wrapper.js', () => ({
  TreeSitterWrapper: {
    getInstance: vi.fn(() => ({
      parse: vi.fn()
    }))
  }
}));

describe('TypeAwarenessAnalyzer - Edge Cases and Error Handling', () => {
  let analyzer: TypeAwarenessAnalyzer;

  beforeEach(() => {
    TypeAwarenessAnalyzer.resetInstance();
    analyzer = TypeAwarenessAnalyzer.getInstance();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Malformed TypeScript Handling', () => {
    test('handles incomplete interface declarations', async () => {
      const malformedCode = `
        interface User {
          id: string;
          name:
          email?: string
        }

        interface // missing name

        interface Complete {
          value: number;
        }
      `;

      const mockNode = {
        type: 'program',
        startPosition: { row: 0, column: 0 },
        endPosition: { row: 12, column: 0 },
        startIndex: 0,
        endIndex: malformedCode.length,
        children: [
          // Incomplete User interface
          {
            type: 'interface_declaration',
            startPosition: { row: 1, column: 8 },
            endPosition: { row: 5, column: 9 },
            startIndex: 8,
            endIndex: 100,
            children: [
              {
                type: 'type_identifier',
                startPosition: { row: 1, column: 18 },
                endPosition: { row: 1, column: 22 },
                startIndex: 18,
                endIndex: 22,
                children: [],
                parent: null,
                previousSibling: null,
                nextSibling: null
              },
              // Incomplete properties
              {
                type: 'property_signature',
                startPosition: { row: 2, column: 10 },
                endPosition: { row: 2, column: 20 },
                startIndex: 30,
                endIndex: 40,
                children: [],
                parent: null,
                previousSibling: null,
                nextSibling: null
              }
            ],
            parent: null,
            previousSibling: null,
            nextSibling: null
          },
          // Complete interface
          {
            type: 'interface_declaration',
            startPosition: { row: 9, column: 8 },
            endPosition: { row: 11, column: 9 },
            startIndex: 200,
            endIndex: 250,
            children: [
              {
                type: 'type_identifier',
                startPosition: { row: 9, column: 18 },
                endPosition: { row: 9, column: 26 },
                startIndex: 210,
                endIndex: 218,
                children: [],
                parent: null,
                previousSibling: null,
                nextSibling: null
              }
            ],
            parent: null,
            previousSibling: null,
            nextSibling: null
          }
        ],
        parent: null,
        previousSibling: null,
        nextSibling: null
      };

      const mockTreeWrapper = analyzer['wrapper'];
      mockTreeWrapper.parse = vi.fn().mockResolvedValue({
        success: true,
        tree: { rootNode: mockNode }
      });

      const result = await analyzer.analyzeContent(malformedCode, 'malformed.ts');

      expect(result.errors).toHaveLength(0); // Should not crash
      expect(result.interfaces.length).toBeGreaterThan(0); // Should extract what it can
    });

    test('handles syntax errors in type definitions', async () => {
      const syntaxErrorCode = `
        interface User {
          id: string | | number; // double pipe
          name: string & & string; // double ampersand
          data: Map<string,>; // missing second generic
          callback: (arg: ) => void; // missing parameter type
        }

        type Status = 'pending' | | 'active'; // malformed union
        type Complex = {[K in keyof T]: ; // incomplete mapped type
      `;

      const mockTreeWrapper = analyzer['wrapper'];
      mockTreeWrapper.parse = vi.fn().mockRejectedValue(new Error('Syntax error at line 3'));

      const result = await analyzer.analyzeContent(syntaxErrorCode, 'syntax-error.ts');

      expect(result.errors).toContain('Analysis error: Syntax error at line 3');
      expect(result.interfaces).toEqual([]);
      expect(result.typeAliases).toEqual([]);
    });

    test('handles extremely nested generic types', async () => {
      const deepGenericCode = `
        type Level1<T> = Promise<T>;
        type Level2<T> = Level1<Array<T>>;
        type Level3<T> = Level2<Map<string, T>>;
        type Level4<T> = Level3<Set<T>>;
        type Level5<T> = Level4<WeakMap<object, T>>;
        type Level6<T> = Level5<ReadonlyArray<T>>;
        type DeepNested = Level6<Promise<Array<Map<string, Set<number>>>>>;
      `;

      const mockNode = {
        type: 'program',
        startPosition: { row: 0, column: 0 },
        endPosition: { row: 8, column: 0 },
        startIndex: 0,
        endIndex: deepGenericCode.length,
        children: Array.from({ length: 7 }, (_, i) => ({
          type: 'type_alias_declaration',
          startPosition: { row: i + 1, column: 8 },
          endPosition: { row: i + 1, column: 50 },
          startIndex: i * 60,
          endIndex: i * 60 + 50,
          children: [
            {
              type: 'type_identifier',
              startPosition: { row: i + 1, column: 13 },
              endPosition: { row: i + 1, column: 20 },
              startIndex: i * 60 + 5,
              endIndex: i * 60 + 12,
              children: [],
              parent: null,
              previousSibling: null,
              nextSibling: null
            }
          ],
          parent: null,
          previousSibling: null,
          nextSibling: null
        })),
        parent: null,
        previousSibling: null,
        nextSibling: null
      };

      const mockTreeWrapper = analyzer['wrapper'];
      mockTreeWrapper.parse = vi.fn().mockResolvedValue({
        success: true,
        tree: { rootNode: mockNode }
      });

      const result = await analyzer.analyzeContent(deepGenericCode, 'deep-generics.ts');

      expect(result.typeAliases).toHaveLength(7);
      expect(result.errors).toHaveLength(0); // Should handle deep nesting
    });
  });

  describe('Memory and Performance Edge Cases', () => {
    test('handles very large interface with many properties', async () => {
      const largeInterfaceProperties = Array.from({ length: 1000 }, (_, i) =>
        `prop${i}: string;`
      ).join('\n  ');

      const largeInterfaceCode = `
        interface VeryLargeInterface {
          ${largeInterfaceProperties}
        }
      `;

      const mockNode = {
        type: 'program',
        startPosition: { row: 0, column: 0 },
        endPosition: { row: 1003, column: 0 },
        startIndex: 0,
        endIndex: largeInterfaceCode.length,
        children: [
          {
            type: 'interface_declaration',
            startPosition: { row: 1, column: 8 },
            endPosition: { row: 1002, column: 9 },
            startIndex: 8,
            endIndex: largeInterfaceCode.length - 10,
            children: [
              {
                type: 'type_identifier',
                startPosition: { row: 1, column: 18 },
                endPosition: { row: 1, column: 36 },
                startIndex: 18,
                endIndex: 36,
                children: [],
                parent: null,
                previousSibling: null,
                nextSibling: null
              },
              ...Array.from({ length: 1000 }, (_, i) => ({
                type: 'property_signature',
                startPosition: { row: i + 2, column: 10 },
                endPosition: { row: i + 2, column: 25 },
                startIndex: 50 + i * 20,
                endIndex: 65 + i * 20,
                children: [
                  {
                    type: 'property_identifier',
                    startPosition: { row: i + 2, column: 10 },
                    endPosition: { row: i + 2, column: 10 + `prop${i}`.length },
                    startIndex: 50 + i * 20,
                    endIndex: 50 + i * 20 + `prop${i}`.length,
                    children: [],
                    parent: null,
                    previousSibling: null,
                    nextSibling: null
                  }
                ],
                parent: null,
                previousSibling: null,
                nextSibling: null
              }))
            ],
            parent: null,
            previousSibling: null,
            nextSibling: null
          }
        ],
        parent: null,
        previousSibling: null,
        nextSibling: null
      };

      const mockTreeWrapper = analyzer['wrapper'];
      mockTreeWrapper.parse = vi.fn().mockResolvedValue({
        success: true,
        tree: { rootNode: mockNode }
      });

      const startTime = Date.now();
      const result = await analyzer.analyzeContent(largeInterfaceCode, 'large-interface.ts');
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(2000); // Should complete within 2 seconds
      expect(result.interfaces).toHaveLength(1);
      expect(result.interfaces[0].properties).toHaveLength(1000);
    });

    test('handles analysis timeout gracefully', async () => {
      const complexCode = `
        interface Complex {
          a: A; b: B; c: C; d: D; e: E;
        }
        type A = { nested: { deeply: { very: { much: string } } } };
        type B = A & { extra: number };
        type C = B | { alternative: boolean };
        type D = C extends string ? true : false;
        type E = { [K in keyof D]: D[K] };
      `;

      const mockTreeWrapper = analyzer['wrapper'];
      mockTreeWrapper.parse = vi.fn().mockImplementation(() =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              success: true,
              tree: {
                rootNode: {
                  type: 'program',
                  children: [],
                  startPosition: { row: 0, column: 0 },
                  endPosition: { row: 10, column: 0 },
                  startIndex: 0,
                  endIndex: complexCode.length,
                  parent: null,
                  previousSibling: null,
                  nextSibling: null
                }
              }
            });
          }, 100); // Short delay to simulate processing
        })
      );

      const result = await analyzer.analyzeContent(complexCode, 'complex.ts');

      expect(result.filePath).toBe('complex.ts');
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Unicode and Special Character Handling', () => {
    test('handles Unicode characters in type names and strings', async () => {
      const unicodeCode = `
        interface 用户 {
          名字: string;
          电子邮件: string;
          数据: Map<string, 值>;
        }

        interface Émöjî {
          🔥: string;
          ⚡: number;
          🎯: boolean;
        }

        type 状态 = '待处理' | '已完成' | '已取消';
        type EmojiUnion = '🎉' | '🎊' | '🎈';
      `;

      const mockNode = {
        type: 'program',
        startPosition: { row: 0, column: 0 },
        endPosition: { row: 14, column: 0 },
        startIndex: 0,
        endIndex: unicodeCode.length,
        children: [
          {
            type: 'interface_declaration',
            startPosition: { row: 1, column: 8 },
            endPosition: { row: 5, column: 9 },
            startIndex: 8,
            endIndex: 100,
            children: [
              {
                type: 'type_identifier',
                startPosition: { row: 1, column: 18 },
                endPosition: { row: 1, column: 20 },
                startIndex: 18,
                endIndex: 20,
                children: [],
                parent: null,
                previousSibling: null,
                nextSibling: null
              }
            ],
            parent: null,
            previousSibling: null,
            nextSibling: null
          }
        ],
        parent: null,
        previousSibling: null,
        nextSibling: null
      };

      const mockTreeWrapper = analyzer['wrapper'];
      mockTreeWrapper.parse = vi.fn().mockResolvedValue({
        success: true,
        tree: { rootNode: mockNode }
      });

      const result = await analyzer.analyzeContent(unicodeCode, 'unicode.ts');

      expect(result.errors).toHaveLength(0);
      expect(result.interfaces.length).toBeGreaterThan(0);
    });

    test('handles special characters in file paths', async () => {
      const specialPaths = [
        'my file with spaces.ts',
        'file-with-dashes.ts',
        'file_with_underscores.ts',
        'file.with.dots.ts',
        'file@symbol.ts',
        'file#hash.ts',
        'file$dollar.ts'
      ];

      for (const filePath of specialPaths) {
        const mockTreeWrapper = analyzer['wrapper'];
        mockTreeWrapper.parse = vi.fn().mockResolvedValue({
          success: true,
          tree: {
            rootNode: {
              type: 'program',
              children: [],
              startPosition: { row: 0, column: 0 },
              endPosition: { row: 1, column: 0 },
              startIndex: 0,
              endIndex: 10,
              parent: null,
              previousSibling: null,
              nextSibling: null
            }
          }
        });

        const result = await analyzer.analyzeContent('interface Test {}', filePath);

        expect(result.filePath).toBe(filePath);
        expect(result.errors).toHaveLength(0);
      }
    });
  });

  describe('Circular Reference Detection', () => {
    test('detects and handles direct circular references', async () => {
      const circularCode = `
        interface Node {
          value: string;
          parent: Node | null;
          children: Node[];
        }

        interface A {
          b: B;
        }

        interface B {
          a: A;
        }
      `;

      const mockNode = {
        type: 'program',
        startPosition: { row: 0, column: 0 },
        endPosition: { row: 13, column: 0 },
        startIndex: 0,
        endIndex: circularCode.length,
        children: [
          {
            type: 'interface_declaration',
            startPosition: { row: 1, column: 8 },
            endPosition: { row: 5, column: 9 },
            startIndex: 8,
            endIndex: 100,
            children: [
              {
                type: 'type_identifier',
                startPosition: { row: 1, column: 18 },
                endPosition: { row: 1, column: 22 },
                startIndex: 18,
                endIndex: 22,
                children: [],
                parent: null,
                previousSibling: null,
                nextSibling: null
              }
            ],
            parent: null,
            previousSibling: null,
            nextSibling: null
          }
        ],
        parent: null,
        previousSibling: null,
        nextSibling: null
      };

      const mockTreeWrapper = analyzer['wrapper'];
      mockTreeWrapper.parse = vi.fn().mockResolvedValue({
        success: true,
        tree: { rootNode: mockNode }
      });

      const result = await analyzer.analyzeContent(circularCode, 'circular.ts');

      expect(result.errors).toHaveLength(0); // Should handle circular references
      expect(result.interfaces.length).toBeGreaterThan(0);
      expect(result.typeDependencies.length).toBeGreaterThan(0);
    });

    test('handles indirect circular references', async () => {
      const indirectCircularCode = `
        interface A { b: B; }
        interface B { c: C; }
        interface C { d: D; }
        interface D { a: A; } // Circular back to A

        interface Tree {
          left: Branch;
        }

        interface Branch {
          tree: Tree;
          leaf: Leaf;
        }

        interface Leaf {
          branch: Branch;
        }
      `;

      const mockNode = {
        type: 'program',
        startPosition: { row: 0, column: 0 },
        endPosition: { row: 16, column: 0 },
        startIndex: 0,
        endIndex: indirectCircularCode.length,
        children: Array.from({ length: 7 }, (_, i) => ({
          type: 'interface_declaration',
          startPosition: { row: i + 1, column: 8 },
          endPosition: { row: i + 1, column: 30 },
          startIndex: i * 40,
          endIndex: i * 40 + 30,
          children: [
            {
              type: 'type_identifier',
              startPosition: { row: i + 1, column: 18 },
              endPosition: { row: i + 1, column: 19 },
              startIndex: i * 40 + 10,
              endIndex: i * 40 + 11,
              children: [],
              parent: null,
              previousSibling: null,
              nextSibling: null
            }
          ],
          parent: null,
          previousSibling: null,
          nextSibling: null
        })),
        parent: null,
        previousSibling: null,
        nextSibling: null
      };

      const mockTreeWrapper = analyzer['wrapper'];
      mockTreeWrapper.parse = vi.fn().mockResolvedValue({
        success: true,
        tree: { rootNode: mockNode }
      });

      const result = await analyzer.analyzeContent(indirectCircularCode, 'indirect-circular.ts');

      expect(result.errors).toHaveLength(0);
      expect(result.interfaces).toHaveLength(7);
    });
  });

  describe('Configuration Edge Cases', () => {
    test('handles invalid analysis options gracefully', async () => {
      const invalidOptions: any = {
        includeDependencies: 'invalid', // Should be boolean
        maxTypeDepth: -5, // Invalid negative number
        includeGenerics: null, // Null instead of boolean
        customOption: 'should be ignored' // Unknown option
      };

      const mockTreeWrapper = analyzer['wrapper'];
      mockTreeWrapper.parse = vi.fn().mockResolvedValue({
        success: true,
        tree: {
          rootNode: {
            type: 'program',
            children: [],
            startPosition: { row: 0, column: 0 },
            endPosition: { row: 1, column: 0 },
            startIndex: 0,
            endIndex: 10,
            parent: null,
            previousSibling: null,
            nextSibling: null
          }
        }
      });

      const result = await analyzer.analyzeContent('interface Test {}', 'test.ts', invalidOptions);

      expect(result.filePath).toBe('test.ts');
      expect(result.errors).toHaveLength(0); // Should handle invalid options gracefully
    });

    test('applies extreme analysis options correctly', async () => {
      const extremeOptions: TypeAnalysisOptions = {
        maxTypeDepth: 0, // Minimum depth
        includeDependencies: false,
        includeDetailedAnnotations: false,
        includeGenerics: false,
        includeImportsExports: false,
        resolveTypeAliases: false
      };

      const complexCode = `
        import type { External } from 'external';

        interface Complex<T, K extends keyof T> {
          prop: T[K];
          callback: (x: T) => Promise<K>;
          map: Map<string, Array<T>>;
        }

        export type Result<T> = T | Error;
        export { Complex as PublicComplex };
      `;

      const mockTreeWrapper = analyzer['wrapper'];
      mockTreeWrapper.parse = vi.fn().mockResolvedValue({
        success: true,
        tree: {
          rootNode: {
            type: 'program',
            children: [],
            startPosition: { row: 0, column: 0 },
            endPosition: { row: 10, column: 0 },
            startIndex: 0,
            endIndex: complexCode.length,
            parent: null,
            previousSibling: null,
            nextSibling: null
          }
        }
      });

      const result = await analyzer.analyzeContent(complexCode, 'extreme.ts', extremeOptions);

      // With extreme options, minimal information should be extracted
      expect(result.typeImports).toHaveLength(0);
      expect(result.typeExports).toHaveLength(0);
      expect(result.typeDependencies).toHaveLength(0);
    });
  });

  describe('File System Edge Cases', () => {
    test('handles binary file content gracefully', async () => {
      // Simulate binary content (e.g., accidentally analyzing a .exe or image file as .ts)
      const binaryContent = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]).toString();

      const mockTreeWrapper = analyzer['wrapper'];
      mockTreeWrapper.parse = vi.fn().mockRejectedValue(new Error('Invalid character in input'));

      const result = await analyzer.analyzeContent(binaryContent, 'binary.ts');

      expect(result.errors).toContain('Analysis error: Invalid character in input');
      expect(result.interfaces).toHaveLength(0);
      expect(result.typeAliases).toHaveLength(0);
    });

    test('handles extremely long file paths', async () => {
      const longPath = 'very/'.repeat(100) + 'long/path/to/file.ts';

      const mockTreeWrapper = analyzer['wrapper'];
      mockTreeWrapper.parse = vi.fn().mockResolvedValue({
        success: true,
        tree: {
          rootNode: {
            type: 'program',
            children: [],
            startPosition: { row: 0, column: 0 },
            endPosition: { row: 1, column: 0 },
            startIndex: 0,
            endIndex: 10,
            parent: null,
            previousSibling: null,
            nextSibling: null
          }
        }
      });

      const result = await analyzer.analyzeContent('interface Test {}', longPath);

      expect(result.filePath).toBe(longPath);
      expect(result.errors).toHaveLength(0);
    });

    test('handles empty and whitespace-only files', async () => {
      const testCases = [
        '',
        '   ',
        '\n\n\n',
        '\t\t\t',
        '   \n\t  \n   '
      ];

      for (const content of testCases) {
        const mockTreeWrapper = analyzer['wrapper'];
        mockTreeWrapper.parse = vi.fn().mockResolvedValue({
          success: false,
          tree: null
        });

        const result = await analyzer.analyzeContent(content, 'empty.ts');

        expect(result.interfaces).toHaveLength(0);
        expect(result.typeAliases).toHaveLength(0);
        expect(result.errors).toContain('Failed to parse TypeScript content');
      }
    });
  });

  describe('Concurrent Analysis Edge Cases', () => {
    test('handles concurrent analysis requests correctly', async () => {
      const files = Array.from({ length: 10 }, (_, i) => ({
        content: `interface Test${i} { value: string; }`,
        path: `test${i}.ts`
      }));

      const mockTreeWrapper = analyzer['wrapper'];
      mockTreeWrapper.parse = vi.fn().mockImplementation(() =>
        Promise.resolve({
          success: true,
          tree: {
            rootNode: {
              type: 'program',
              children: [
                {
                  type: 'interface_declaration',
                  children: [],
                  startPosition: { row: 0, column: 0 },
                  endPosition: { row: 2, column: 0 },
                  startIndex: 0,
                  endIndex: 50,
                  parent: null,
                  previousSibling: null,
                  nextSibling: null
                }
              ],
              startPosition: { row: 0, column: 0 },
              endPosition: { row: 2, column: 0 },
              startIndex: 0,
              endIndex: 50,
              parent: null,
              previousSibling: null,
              nextSibling: null
            }
          }
        })
      );

      // Analyze files concurrently
      const promises = files.map(file =>
        analyzer.analyzeContent(file.content, file.path)
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);
      results.forEach((result, i) => {
        expect(result.filePath).toBe(`test${i}.ts`);
        expect(result.interfaces).toHaveLength(1);
        expect(result.errors).toHaveLength(0);
      });
    });
  });
});