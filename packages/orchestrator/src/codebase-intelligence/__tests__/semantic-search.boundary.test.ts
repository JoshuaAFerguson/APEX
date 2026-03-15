/**
 * Boundary condition and input validation tests for SemanticSearch
 *
 * These tests focus specifically on boundary conditions, input validation,
 * and parameter limits to ensure the SemanticSearch class behaves correctly
 * at the edges of its expected input space.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SemanticSearch, type SemanticSearchOptions } from '../semantic-search.js';
import type { RepositoryMap, CodeSymbol, CodeFile } from '@apexcli/core/types';

describe('SemanticSearch - Boundary Conditions', () => {
  let semanticSearch: SemanticSearch;
  let mockRepositoryMap: RepositoryMap;

  beforeEach(() => {
    mockRepositoryMap = createBoundaryTestRepositoryMap();
    semanticSearch = new SemanticSearch(mockRepositoryMap);
  });

  describe('Query String Boundaries', () => {
    it('should handle minimum length queries', () => {
      // Single character queries
      const singleCharResults = semanticSearch.search('a');
      expect(singleCharResults).toBeDefined();
      expect(Array.isArray(singleCharResults)).toBe(true);

      // Two character queries
      const twoCharResults = semanticSearch.search('ab');
      expect(twoCharResults).toBeDefined();
      expect(Array.isArray(twoCharResults)).toBe(true);
    });

    it('should handle maximum practical query lengths', () => {
      // Very long query (1000 characters)
      const longQuery = 'find a function that validates user input and returns a boolean result '.repeat(12);
      expect(longQuery.length).toBeGreaterThan(800);

      const results = semanticSearch.search(longQuery);
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });

    it('should handle queries at Unicode boundaries', () => {
      const unicodeQueries = [
        '函数', // Chinese characters
        'функция', // Cyrillic characters
        '🔍 search', // Emoji
        'café', // Accented characters
        'naïve algorithm', // Diacritics
        'Москва', // Mixed scripts
        '💻 code 🚀 rocket' // Multiple emojis
      ];

      unicodeQueries.forEach(query => {
        const results = semanticSearch.search(query);
        expect(results).toBeDefined();
        expect(Array.isArray(results)).toBe(true);
      });
    });

    it('should handle queries with only whitespace variations', () => {
      const whitespaceQueries = [
        ' ', // Single space
        '  ', // Multiple spaces
        '\t', // Tab character
        '\n', // Newline character
        '\r\n', // Windows newline
        ' \t\n\r ', // Mixed whitespace
        '　', // Non-breaking space
        '\u00A0', // Unicode non-breaking space
        '\u2000\u2001\u2002' // Various Unicode spaces
      ];

      whitespaceQueries.forEach(query => {
        const results = semanticSearch.search(query);
        expect(results).toBeDefined();
        expect(Array.isArray(results)).toBe(true);
        expect(results).toEqual([]); // Should return empty for whitespace-only queries
      });
    });
  });

  describe('Options Parameter Boundaries', () => {
    it('should handle limit boundary values', () => {
      const boundaryLimits = [
        0, // Zero limit
        1, // Minimum meaningful limit
        Number.MAX_SAFE_INTEGER, // Maximum safe integer
        -1, // Negative limit (should be handled gracefully)
        NaN, // Not a number
        Infinity, // Infinite limit
        -Infinity // Negative infinity
      ];

      boundaryLimits.forEach(limit => {
        const options: SemanticSearchOptions = { limit };
        const results = semanticSearch.search('test', options);

        expect(results).toBeDefined();
        expect(Array.isArray(results)).toBe(true);

        // Results should be bounded appropriately
        if (typeof limit === 'number' && limit > 0 && limit < Number.MAX_SAFE_INTEGER) {
          expect(results.length).toBeLessThanOrEqual(Math.floor(limit));
        }
      });
    });

    it('should handle minScore boundary values', () => {
      const boundaryScores = [
        0.0, // Minimum score
        1.0, // Maximum score
        -0.1, // Below minimum
        1.1, // Above maximum
        0.5, // Mid-range
        Number.EPSILON, // Smallest positive number
        Number.MIN_VALUE, // Minimum positive value
        NaN, // Not a number
        Infinity, // Infinite score
        -Infinity // Negative infinite score
      ];

      boundaryScores.forEach(minScore => {
        const options: SemanticSearchOptions = { minScore };
        const results = semanticSearch.search('function', options);

        expect(results).toBeDefined();
        expect(Array.isArray(results)).toBe(true);

        // All returned results should meet the score criteria (if valid)
        if (typeof minScore === 'number' && !isNaN(minScore) && isFinite(minScore)) {
          results.forEach(result => {
            if (minScore >= 0 && minScore <= 1) {
              expect(result.score).toBeGreaterThanOrEqual(minScore);
            }
          });
        }
      });
    });

    it('should handle empty and malformed symbolTypes arrays', () => {
      const symbolTypeTests = [
        [], // Empty array
        ['function'], // Single valid type
        ['function', 'class', 'interface'], // Multiple valid types
        ['invalid-type'] as any, // Invalid type
        ['function', 'invalid', 'class'] as any, // Mixed valid/invalid
        null as any, // Null instead of array
        undefined as any, // Undefined instead of array
        'function' as any, // String instead of array
        123 as any // Number instead of array
      ];

      symbolTypeTests.forEach((symbolTypes, index) => {
        const options: SemanticSearchOptions = { symbolTypes };

        expect(() => {
          const results = semanticSearch.search('test', options);
          expect(results).toBeDefined();
          expect(Array.isArray(results)).toBe(true);
        }).not.toThrow(`Failed on symbolTypes test ${index}`);
      });
    });

    it('should handle filePatterns boundary conditions', () => {
      const patternTests = [
        [], // Empty patterns
        ['*'], // Match all
        ['*.ts'], // Single pattern
        ['*.ts', '*.js', '*.tsx'], // Multiple patterns
        [''], // Empty pattern
        ['   '], // Whitespace pattern
        ['/absolute/path/*'], // Absolute path pattern
        ['../relative/path/*'], // Relative path pattern
        ['**/*.deeply/nested/**'], // Complex nested pattern
        ['[invalid-regex-pattern'], // Invalid regex pattern
        null as any, // Null patterns
        undefined as any, // Undefined patterns
        'single-string' as any // String instead of array
      ];

      patternTests.forEach((filePatterns, index) => {
        const options: SemanticSearchOptions = { filePatterns };

        expect(() => {
          const results = semanticSearch.search('test', options);
          expect(results).toBeDefined();
          expect(Array.isArray(results)).toBe(true);
        }).not.toThrow(`Failed on filePatterns test ${index}`);
      });
    });

    it('should handle strategy boundary values', () => {
      const strategyTests = [
        'keyword',
        'fuzzy',
        'semantic',
        '' as any, // Empty strategy
        'invalid-strategy' as any, // Invalid strategy
        null as any, // Null strategy
        undefined as any, // Undefined strategy (should use default)
        123 as any, // Number instead of string
        ['semantic'] as any // Array instead of string
      ];

      strategyTests.forEach((strategy, index) => {
        const options: SemanticSearchOptions = { strategy };

        expect(() => {
          const results = semanticSearch.search('function', options);
          expect(results).toBeDefined();
          expect(Array.isArray(results)).toBe(true);
        }).not.toThrow(`Failed on strategy test ${index}`);
      });
    });
  });

  describe('Symbol Data Boundaries', () => {
    it('should handle symbols with boundary line numbers', () => {
      const boundaryLineMap: RepositoryMap = {
        ...mockRepositoryMap,
        files: [
          {
            filePath: 'boundary.ts',
            language: 'typescript',
            content: 'test content',
            symbols: [
              {
                name: 'zeroStart',
                type: 'function',
                filePath: 'boundary.ts',
                startLine: 0, // Zero start line
                endLine: 0
              },
              {
                name: 'negativeLines',
                type: 'function',
                filePath: 'boundary.ts',
                startLine: -1, // Negative start line
                endLine: -5
              },
              {
                name: 'hugeLines',
                type: 'function',
                filePath: 'boundary.ts',
                startLine: Number.MAX_SAFE_INTEGER,
                endLine: Number.MAX_SAFE_INTEGER
              },
              {
                name: 'reversedLines',
                type: 'function',
                filePath: 'boundary.ts',
                startLine: 10, // Start line after end line
                endLine: 5
              }
            ],
            imports: [],
            exports: []
          }
        ]
      };

      const searcher = new SemanticSearch(boundaryLineMap);
      const results = searcher.search('function');

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
    });

    it('should handle symbols with extreme name lengths', () => {
      const extremeNameMap: RepositoryMap = {
        ...mockRepositoryMap,
        files: [
          {
            filePath: 'extreme.ts',
            language: 'typescript',
            content: 'test content',
            symbols: [
              {
                name: '', // Empty name
                type: 'function',
                filePath: 'extreme.ts',
                startLine: 1,
                endLine: 1
              },
              {
                name: 'a', // Single character name
                type: 'function',
                filePath: 'extreme.ts',
                startLine: 2,
                endLine: 2
              },
              {
                name: 'veryLongSymbolNameThatExceedsTypicalBoundariesAndTestsHandlingOfExtremelyLongIdentifiers'.repeat(10), // Very long name
                type: 'function',
                filePath: 'extreme.ts',
                startLine: 3,
                endLine: 3
              },
              {
                name: '🚀💻🔍', // Emoji name
                type: 'function',
                filePath: 'extreme.ts',
                startLine: 4,
                endLine: 4
              },
              {
                name: '函数名称', // Non-Latin name
                type: 'function',
                filePath: 'extreme.ts',
                startLine: 5,
                endLine: 5
              }
            ],
            imports: [],
            exports: []
          }
        ]
      };

      const searcher = new SemanticSearch(extremeNameMap);

      // Should handle all extreme names without crashing
      const results = searcher.search('function');
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('Repository Structure Boundaries', () => {
    it('should handle empty repository map', () => {
      const emptyMap: RepositoryMap = {
        rootPath: '',
        files: [],
        imports: [],
        references: [],
        stats: {
          totalFiles: 0,
          totalSymbols: 0,
          indexedAt: new Date(),
          processingTimeMs: 0
        }
      };

      const searcher = new SemanticSearch(emptyMap);
      const results = searcher.search('anything');

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results).toEqual([]);
    });

    it('should handle repository with only empty files', () => {
      const emptyFilesMap: RepositoryMap = {
        rootPath: '/empty/project',
        files: [
          {
            filePath: 'empty1.ts',
            language: 'typescript',
            content: '',
            symbols: [],
            imports: [],
            exports: []
          },
          {
            filePath: 'empty2.js',
            language: 'javascript',
            content: '   \n\t\r  ', // Only whitespace
            symbols: [],
            imports: [],
            exports: []
          }
        ],
        imports: [],
        references: [],
        stats: {
          totalFiles: 2,
          totalSymbols: 0,
          indexedAt: new Date(),
          processingTimeMs: 1
        }
      };

      const searcher = new SemanticSearch(emptyFilesMap);
      const results = searcher.search('test');

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results).toEqual([]);
    });

    it('should handle deeply nested file structures', () => {
      const deepNestingPath = 'a/'.repeat(100) + 'deep.ts'; // 100 levels deep

      const deepMap: RepositoryMap = {
        rootPath: '/deep/project',
        files: [
          {
            filePath: deepNestingPath,
            language: 'typescript',
            content: 'function deepFunction() {}',
            symbols: [
              {
                name: 'deepFunction',
                type: 'function',
                filePath: deepNestingPath,
                startLine: 1,
                endLine: 1,
                signature: 'function deepFunction(): void'
              }
            ],
            imports: [],
            exports: ['deepFunction']
          }
        ],
        imports: [],
        references: [],
        stats: {
          totalFiles: 1,
          totalSymbols: 1,
          indexedAt: new Date(),
          processingTimeMs: 1
        }
      };

      const searcher = new SemanticSearch(deepMap);
      const results = searcher.search('deep');

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases in Search Methods', () => {
    it('should handle findSimilar with edge case symbols', () => {
      const edgeSymbols: CodeSymbol[] = [
        {
          name: '',
          type: 'function',
          filePath: 'test.ts',
          startLine: 1,
          endLine: 1
        },
        {
          name: 'test',
          type: 'unknown' as any,
          filePath: '',
          startLine: -1,
          endLine: -1
        },
        {
          name: 'validFunction',
          type: 'function',
          filePath: 'nonexistent.ts', // File not in repository map
          startLine: 1,
          endLine: 1
        }
      ];

      edgeSymbols.forEach(symbol => {
        expect(() => {
          const similar = semanticSearch.findSimilar(symbol);
          expect(similar).toBeDefined();
          expect(Array.isArray(similar)).toBe(true);
        }).not.toThrow();
      });
    });

    it('should handle searchByExample with edge case code snippets', () => {
      const edgeSnippets = [
        '', // Empty snippet
        ' ', // Whitespace only
        '/', // Single character
        '/* comment */', // Comment only
        '123', // Numbers only
        '!@#$%^&*()', // Special characters
        'incomplete function(', // Incomplete syntax
        'function\nwith\nnewlines\n', // Multi-line
        'function 🚀test() {}', // Emoji in code
        '函数 test() {}' // Non-Latin characters
      ];

      edgeSnippets.forEach(snippet => {
        expect(() => {
          const results = semanticSearch.searchByExample(snippet);
          expect(results).toBeDefined();
          expect(Array.isArray(results)).toBe(true);
        }).not.toThrow();
      });
    });
  });
});

/**
 * Create a repository map specifically designed for boundary testing
 */
function createBoundaryTestRepositoryMap(): RepositoryMap {
  const files: CodeFile[] = [
    {
      filePath: 'src/boundary.ts',
      language: 'typescript',
      content: 'export function boundaryTest() { return true; }',
      symbols: [
        {
          name: 'boundaryTest',
          type: 'function',
          filePath: 'src/boundary.ts',
          startLine: 1,
          endLine: 1,
          signature: 'function boundaryTest(): boolean',
          documentation: 'A test function for boundary conditions',
          exported: true
        },
        {
          name: 'shortFunc',
          type: 'function',
          filePath: 'src/boundary.ts',
          startLine: 2,
          endLine: 2,
          signature: 'function shortFunc(): void',
          exported: true
        },
        {
          name: 'veryLongFunctionNameThatTestsHandlingOfExtremelyLongIdentifiers',
          type: 'function',
          filePath: 'src/boundary.ts',
          startLine: 3,
          endLine: 3,
          signature: 'function veryLongFunctionNameThatTestsHandlingOfExtremelyLongIdentifiers(): void',
          exported: true
        }
      ],
      imports: [],
      exports: ['boundaryTest', 'shortFunc', 'veryLongFunctionNameThatTestsHandlingOfExtremelyLongIdentifiers']
    }
  ];

  return {
    rootPath: '/boundary/test',
    files,
    imports: [],
    references: [],
    stats: {
      totalFiles: files.length,
      totalSymbols: files.reduce((count, f) => count + f.symbols.length, 0),
      indexedAt: new Date(),
      processingTimeMs: 10
    }
  };
}