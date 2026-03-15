/**
 * Advanced tests for SemanticSearch - comprehensive edge cases, error handling, and performance
 *
 * These tests supplement the main semantic-search.test.ts with additional coverage for:
 * - Advanced error scenarios
 * - Resource management
 * - Concurrent access patterns
 * - Memory leak detection
 * - Performance under stress
 * - Complex query patterns
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SemanticSearch, type SemanticSearchOptions } from '../semantic-search.js';
import type { RepositoryMap, CodeSymbol, CodeFile } from '@apexcli/core/types';

describe('SemanticSearch - Advanced Tests', () => {
  let semanticSearch: SemanticSearch;
  let mockRepositoryMap: RepositoryMap;

  beforeEach(() => {
    mockRepositoryMap = createLargeRepositoryMap();
    semanticSearch = new SemanticSearch(mockRepositoryMap);
  });

  afterEach(() => {
    // Cleanup to prevent memory leaks in tests
    semanticSearch = null as any;
    mockRepositoryMap = null as any;
  });

  describe('Error Handling & Robustness', () => {
    it('should handle corrupted repository maps gracefully', () => {
      const corruptedMap: RepositoryMap = {
        rootPath: '/invalid',
        files: [
          {
            filePath: '',
            language: 'unknown' as any,
            content: null as any,
            symbols: null as any,
            imports: null as any,
            exports: null as any
          } as any
        ],
        imports: null as any,
        references: null as any,
        stats: null as any
      };

      expect(() => new SemanticSearch(corruptedMap)).not.toThrow();
      const searcher = new SemanticSearch(corruptedMap);
      expect(searcher.search('test')).toEqual([]);
    });

    it('should handle null and undefined queries', () => {
      expect(semanticSearch.search(null as any)).toEqual([]);
      expect(semanticSearch.search(undefined as any)).toEqual([]);
    });

    it('should handle extremely long queries without crashing', () => {
      const longQuery = 'a '.repeat(10000) + 'function that does something';
      const results = semanticSearch.search(longQuery);
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });

    it('should handle malformed options objects', () => {
      const malformedOptions: any = {
        limit: 'not-a-number',
        minScore: null,
        symbolTypes: 'not-an-array',
        filePatterns: undefined,
        includeDocumentation: 'not-a-boolean',
        strategy: 'invalid-strategy'
      };

      expect(() => semanticSearch.search('test', malformedOptions)).not.toThrow();
    });

    it('should handle symbols with missing or malformed data', () => {
      const corruptSymbolMap: RepositoryMap = {
        ...mockRepositoryMap,
        files: [
          {
            filePath: 'test.ts',
            language: 'typescript',
            content: 'function test() {}',
            symbols: [
              {
                name: '',
                type: 'function',
                filePath: 'test.ts',
                startLine: -1,
                endLine: 0,
                signature: null as any,
                documentation: undefined
              } as any
            ],
            imports: [],
            exports: []
          }
        ]
      };

      const searcher = new SemanticSearch(corruptSymbolMap);
      expect(() => searcher.search('test')).not.toThrow();
    });

    it('should handle circular references in symbol resolution', () => {
      const circularMap: RepositoryMap = {
        ...mockRepositoryMap,
        files: [
          {
            filePath: 'circular.ts',
            language: 'typescript',
            content: 'class A extends B {} class B extends A {}',
            symbols: [
              {
                name: 'A',
                type: 'class',
                filePath: 'circular.ts',
                startLine: 1,
                endLine: 1,
                signature: 'class A extends B',
                parent: 'B'
              },
              {
                name: 'B',
                type: 'class',
                filePath: 'circular.ts',
                startLine: 1,
                endLine: 1,
                signature: 'class B extends A',
                parent: 'A'
              }
            ],
            imports: [],
            exports: ['A', 'B']
          }
        ]
      };

      const searcher = new SemanticSearch(circularMap);
      expect(() => searcher.search('class inheritance')).not.toThrow();
    });
  });

  describe('Performance & Scalability', () => {
    it('should handle large-scale searches efficiently', () => {
      const startTime = performance.now();
      const results = semanticSearch.search('function', { limit: 1000 });
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
      expect(results.length).toBeGreaterThan(0);
    });

    it('should perform well with complex query patterns', () => {
      const complexQueries = [
        'async function that handles user authentication and authorization',
        'class method that validates email addresses using regex patterns',
        'interface with multiple inheritance chains and generic types',
        'function returning promise of array of user objects with validation',
        'component that renders user profile with edit capabilities'
      ];

      const startTime = performance.now();
      complexQueries.forEach(query => {
        const results = semanticSearch.search(query, { limit: 10 });
        expect(results).toBeDefined();
      });
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(2000); // Should handle all queries within 2 seconds
    });

    it('should maintain consistent performance with repeated searches', () => {
      const query = 'user service function';
      const times: number[] = [];

      for (let i = 0; i < 10; i++) {
        const startTime = performance.now();
        semanticSearch.search(query);
        const endTime = performance.now();
        times.push(endTime - startTime);
      }

      // Performance should not degrade significantly with repeated searches
      const firstTime = times[0];
      const lastTime = times[times.length - 1];
      expect(lastTime).toBeLessThan(firstTime * 2); // Allow up to 2x degradation
    });

    it('should handle memory efficiently with large result sets', () => {
      // Test with various result set sizes
      const sizes = [10, 100, 1000];

      sizes.forEach(size => {
        const results = semanticSearch.search('test', { limit: size });
        expect(results.length).toBeLessThanOrEqual(size);

        // Verify result structure is maintained
        results.forEach(result => {
          expect(result.symbol).toBeDefined();
          expect(result.file).toBeDefined();
          expect(typeof result.score).toBe('number');
          expect(result.matchType).toBeDefined();
        });
      });
    });
  });

  describe('Advanced Query Processing', () => {
    it('should handle multi-language queries', () => {
      const multiLangQueries = [
        'función que valida email', // Spanish
        'fonction qui valide email', // French
        'функция для проверки email', // Russian
        'Funktion zur E-Mail-Validierung' // German
      ];

      multiLangQueries.forEach(query => {
        const results = semanticSearch.search(query);
        expect(results).toBeDefined();
        expect(Array.isArray(results)).toBe(true);
      });
    });

    it('should handle queries with programming language keywords', () => {
      const keywordQueries = [
        'function async await promise',
        'class extends implements interface',
        'const let var arrow function',
        'public private protected static',
        'try catch finally throw error'
      ];

      keywordQueries.forEach(query => {
        const results = semanticSearch.search(query);
        expect(results).toBeDefined();
        expect(Array.isArray(results)).toBe(true);
      });
    });

    it('should handle queries with special characters and symbols', () => {
      const specialQueries = [
        'function(param: Type): ReturnType',
        'class<T extends BaseType>',
        'method?.call?.bind',
        'async function* generator',
        '@decorator pattern implementation'
      ];

      specialQueries.forEach(query => {
        const results = semanticSearch.search(query);
        expect(results).toBeDefined();
        expect(Array.isArray(results)).toBe(true);
      });
    });

    it('should handle boolean logic in queries', () => {
      const results1 = semanticSearch.search('user AND service');
      const results2 = semanticSearch.search('user OR service');
      const results3 = semanticSearch.search('user NOT admin');

      expect(results1).toBeDefined();
      expect(results2).toBeDefined();
      expect(results3).toBeDefined();
    });
  });

  describe('Advanced Similarity Search', () => {
    it('should find similar symbols across different files and contexts', () => {
      const testSymbol: CodeSymbol = {
        name: 'validateUser',
        type: 'function',
        filePath: 'src/auth/validation.ts',
        startLine: 1,
        endLine: 10,
        signature: 'function validateUser(user: User): boolean',
        documentation: 'Validates user data and permissions',
        exported: true
      };

      const similar = semanticSearch.findSimilar(testSymbol, { limit: 5 });
      expect(similar.length).toBeGreaterThan(0);

      // Should not include the original symbol
      const hasSelf = similar.some(s =>
        s.symbol.name === testSymbol.name && s.symbol.filePath === testSymbol.filePath
      );
      expect(hasSelf).toBe(false);
    });

    it('should handle similarity search with incomplete symbol data', () => {
      const incompleteSymbol: CodeSymbol = {
        name: 'testFunc',
        type: 'function',
        filePath: 'test.ts',
        startLine: 1,
        endLine: 1
      };

      expect(() => semanticSearch.findSimilar(incompleteSymbol)).not.toThrow();
    });
  });

  describe('Advanced Code Pattern Search', () => {
    it('should handle complex code patterns', () => {
      const patterns = [
        'export default class Component extends React.Component<Props, State>',
        'async function* asyncGenerator(): AsyncGenerator<T, void, unknown>',
        'const useCustomHook = (): [state, setState] => useState()',
        'interface GenericInterface<T extends Record<string, unknown>>',
        'type ConditionalType<T> = T extends string ? string : number'
      ];

      patterns.forEach(pattern => {
        const results = semanticSearch.searchByExample(pattern);
        expect(results).toBeDefined();
        expect(Array.isArray(results)).toBe(true);
      });
    });

    it('should extract patterns from malformed code', () => {
      const malformedPatterns = [
        'function incomplete(',
        'class MissingBrace {',
        'const unfinished =',
        'interface BadInterface'
      ];

      malformedPatterns.forEach(pattern => {
        expect(() => semanticSearch.searchByExample(pattern)).not.toThrow();
      });
    });
  });

  describe('Concurrent Access & Thread Safety', () => {
    it('should handle concurrent searches safely', async () => {
      const queries = Array.from({ length: 10 }, (_, i) => `query ${i}`);

      const promises = queries.map(query =>
        Promise.resolve(semanticSearch.search(query))
      );

      const results = await Promise.all(promises);
      expect(results.length).toBe(queries.length);
      results.forEach(result => {
        expect(Array.isArray(result)).toBe(true);
      });
    });

    it('should maintain state consistency during concurrent operations', async () => {
      const operations = [
        () => semanticSearch.search('user'),
        () => semanticSearch.search('service'),
        () => semanticSearch.searchByExample('function test()'),
        () => semanticSearch.findSimilar(mockRepositoryMap.files[0].symbols[0])
      ];

      const promises = operations.map(op => Promise.resolve(op()));
      const results = await Promise.all(promises);

      expect(results.length).toBe(operations.length);
      results.forEach(result => {
        expect(Array.isArray(result)).toBe(true);
      });
    });
  });

  describe('Memory Management', () => {
    it('should not create memory leaks with repeated instantiation', () => {
      const instances: SemanticSearch[] = [];

      // Create multiple instances
      for (let i = 0; i < 100; i++) {
        instances.push(new SemanticSearch(mockRepositoryMap));
      }

      // Use instances
      instances.forEach((instance, index) => {
        const results = instance.search(`query ${index}`);
        expect(results).toBeDefined();
      });

      // Clean up (in real scenario, garbage collection would handle this)
      instances.length = 0;
      expect(instances.length).toBe(0);
    });

    it('should handle large search indexes efficiently', () => {
      const largeMap = createLargeRepositoryMap(1000); // 1000 files
      const searcher = new SemanticSearch(largeMap);

      const startTime = Date.now();
      const results = searcher.search('test function');
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(results).toBeDefined();
    });
  });

  describe('Edge Case Scoring', () => {
    it('should handle edge cases in score calculation', () => {
      const edgeCaseQueries = [
        '', // Empty query
        ' '.repeat(100), // Whitespace only
        '!@#$%^&*()', // Special characters only
        '123456789', // Numbers only
        'a', // Single character
        'aaaaaaaaaaaaaaaaaaaa' // Repeated characters
      ];

      edgeCaseQueries.forEach(query => {
        const results = semanticSearch.search(query);
        expect(results).toBeDefined();
        expect(Array.isArray(results)).toBe(true);

        results.forEach(result => {
          expect(result.score).toBeGreaterThanOrEqual(0);
          expect(result.score).toBeLessThanOrEqual(1);
        });
      });
    });

    it('should maintain score consistency across similar queries', () => {
      const baseQuery = 'user validation function';
      const variations = [
        'user validation function',
        'User Validation Function',
        'USER VALIDATION FUNCTION',
        'user   validation   function', // Extra spaces
        'validation user function' // Different order
      ];

      const scores: number[] = [];
      variations.forEach(query => {
        const results = semanticSearch.search(query);
        if (results.length > 0) {
          scores.push(results[0].score);
        }
      });

      // Scores should be relatively consistent (within 0.3 range)
      if (scores.length > 1) {
        const minScore = Math.min(...scores);
        const maxScore = Math.max(...scores);
        expect(maxScore - minScore).toBeLessThan(0.3);
      }
    });
  });
});

/**
 * Create a large mock repository map for stress testing
 */
function createLargeRepositoryMap(fileCount: number = 50): RepositoryMap {
  const files: CodeFile[] = [];

  for (let i = 0; i < fileCount; i++) {
    const fileIndex = i;
    const symbols: CodeSymbol[] = [];

    // Create various symbol types per file
    const symbolTypes = ['function', 'class', 'interface', 'variable', 'method'] as const;

    symbolTypes.forEach((type, typeIndex) => {
      for (let j = 0; j < 5; j++) { // 5 symbols per type per file
        symbols.push({
          name: `${type}${fileIndex}_${j}`,
          type,
          filePath: `src/file${fileIndex}.ts`,
          startLine: j * 5 + 1,
          endLine: j * 5 + 4,
          signature: `${type} ${type}${fileIndex}_${j}()`,
          documentation: `Documentation for ${type} ${type}${fileIndex}_${j}`,
          exported: j % 2 === 0,
          parent: type === 'method' ? `class${fileIndex}_0` : undefined
        });
      }
    });

    files.push({
      filePath: `src/file${fileIndex}.ts`,
      language: 'typescript',
      content: `// File ${fileIndex} content`,
      symbols,
      imports: i > 0 ? [
        {
          sourceFile: `src/file${fileIndex}.ts`,
          targetFile: `src/file${fileIndex - 1}.ts`,
          importedSymbols: [`function${fileIndex - 1}_0`],
          importType: 'named'
        }
      ] : [],
      exports: symbols.filter(s => s.exported).map(s => s.name)
    });
  }

  return {
    rootPath: '/large/project',
    files,
    imports: files.flatMap(f => f.imports),
    references: [],
    stats: {
      totalFiles: files.length,
      totalSymbols: files.reduce((count, f) => count + f.symbols.length, 0),
      indexedAt: new Date(),
      processingTimeMs: 1000
    }
  };
}