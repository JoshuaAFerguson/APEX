import { describe, expect, test, beforeEach, afterEach, vi } from 'vitest';
import { TypeAwarenessAnalyzer, getTypeAwarenessAnalyzer } from '../type-awareness-analyzer.js';
import type {
  TypeInformation,
  TypeAnalysisOptions,
  TypeScriptInterface,
  TypeAlias,
  TypeAnnotation
} from '../type-awareness-analyzer.js';

// Mock the TreeSitterWrapper to avoid dependencies on tree-sitter
vi.mock('../parsers/tree-sitter-wrapper.js', () => ({
  TreeSitterWrapper: {
    getInstance: vi.fn(() => ({
      parse: vi.fn()
    }))
  }
}));

describe('TypeAwarenessAnalyzer', () => {
  let analyzer: TypeAwarenessAnalyzer;

  beforeEach(() => {
    // Reset singleton instance for each test
    TypeAwarenessAnalyzer.resetInstance();
    analyzer = TypeAwarenessAnalyzer.getInstance();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getInstance', () => {
    test('returns singleton instance', () => {
      const instance1 = TypeAwarenessAnalyzer.getInstance();
      const instance2 = TypeAwarenessAnalyzer.getInstance();
      expect(instance1).toBe(instance2);
    });

    test('convenience function returns same instance', () => {
      const instance1 = TypeAwarenessAnalyzer.getInstance();
      const instance2 = getTypeAwarenessAnalyzer();
      expect(instance1).toBe(instance2);
    });
  });

  describe('analyzeContent', () => {
    test('returns empty result for empty content', async () => {
      const mockTreeWrapper = analyzer['wrapper'];
      mockTreeWrapper.parse = vi.fn().mockResolvedValue({
        success: false,
        tree: null
      });

      const result = await analyzer.analyzeContent('', 'test.ts');

      expect(result).toEqual({
        filePath: 'test.ts',
        interfaces: [],
        typeAliases: [],
        generics: [],
        typeAnnotations: new Map(),
        typeImports: [],
        typeExports: [],
        typeDependencies: [],
        errors: ['Failed to parse TypeScript content']
      });
    });

    test('handles parse errors gracefully', async () => {
      const mockTreeWrapper = analyzer['wrapper'];
      mockTreeWrapper.parse = vi.fn().mockRejectedValue(new Error('Parse error'));

      const result = await analyzer.analyzeContent('const x = 5;', 'test.ts');

      expect(result.errors).toContain('Analysis error: Parse error');
      expect(result.interfaces).toEqual([]);
    });

    test('extracts basic type information when parsing succeeds', async () => {
      const mockNode = {
        type: 'program',
        startPosition: { row: 0, column: 0 },
        endPosition: { row: 1, column: 0 },
        startIndex: 0,
        endIndex: 10,
        children: [],
        parent: null,
        previousSibling: null,
        nextSibling: null
      };

      const mockTreeWrapper = analyzer['wrapper'];
      mockTreeWrapper.parse = vi.fn().mockResolvedValue({
        success: true,
        tree: { rootNode: mockNode }
      });

      const result = await analyzer.analyzeContent('const x: number = 5;', 'test.ts');

      expect(result.filePath).toBe('test.ts');
      expect(result.errors).toEqual([]);
    });
  });

  describe('enrichRepositoryMap', () => {
    test('enriches repository map with type information for TypeScript files', async () => {
      const mockRepoMap = {
        rootPath: '/test',
        name: 'test-repo',
        files: [
          {
            path: 'src/test.ts',
            language: 'typescript',
            symbols: [],
            imports: [],
            exports: [],
            lineCount: 10,
            size: 100,
            lastModified: new Date(),
            hasErrors: false,
            errors: []
          },
          {
            path: 'src/test.js',
            language: 'javascript',
            symbols: [],
            imports: [],
            exports: [],
            lineCount: 5,
            size: 50,
            lastModified: new Date(),
            hasErrors: false,
            errors: []
          }
        ],
        references: [],
        stats: {
          totalFiles: 2,
          totalSymbols: 0,
          totalReferences: 0,
          totalLines: 15
        }
      };

      // Mock file system read
      const fs = require('fs/promises');
      fs.readFile = vi.fn()
        .mockResolvedValueOnce('interface User { name: string; }')
        .mockResolvedValueOnce('const x = 5;');

      // Mock successful parsing
      const mockNode = {
        type: 'program',
        startPosition: { row: 0, column: 0 },
        endPosition: { row: 1, column: 0 },
        startIndex: 0,
        endIndex: 30,
        children: [],
        parent: null,
        previousSibling: null,
        nextSibling: null
      };

      const mockTreeWrapper = analyzer['wrapper'];
      mockTreeWrapper.parse = vi.fn().mockResolvedValue({
        success: true,
        tree: { rootNode: mockNode }
      });

      const enrichedMap = await analyzer.enrichRepositoryMap(mockRepoMap);

      expect(enrichedMap.files).toHaveLength(2);
      expect(enrichedMap.files[0].path).toBe('src/test.ts');
    });

    test('preserves non-TypeScript files unchanged', async () => {
      const mockRepoMap = {
        rootPath: '/test',
        name: 'test-repo',
        files: [
          {
            path: 'README.md',
            language: 'markdown',
            symbols: [],
            imports: [],
            exports: [],
            lineCount: 10,
            size: 100,
            lastModified: new Date(),
            hasErrors: false,
            errors: []
          }
        ],
        references: [],
        stats: {
          totalFiles: 1,
          totalSymbols: 0,
          totalReferences: 0,
          totalLines: 10
        }
      };

      const enrichedMap = await analyzer.enrichRepositoryMap(mockRepoMap);

      expect(enrichedMap.files).toHaveLength(1);
      expect(enrichedMap.files[0].path).toBe('README.md');
      expect(enrichedMap.files[0]).toEqual(mockRepoMap.files[0]);
    });

    test('handles file read errors gracefully', async () => {
      const mockRepoMap = {
        rootPath: '/test',
        name: 'test-repo',
        files: [
          {
            path: 'src/test.ts',
            language: 'typescript',
            symbols: [],
            imports: [],
            exports: [],
            lineCount: 10,
            size: 100,
            lastModified: new Date(),
            hasErrors: false,
            errors: []
          }
        ],
        references: [],
        stats: {
          totalFiles: 1,
          totalSymbols: 0,
          totalReferences: 0,
          totalLines: 10
        }
      };

      // Mock file system error
      const fs = require('fs/promises');
      fs.readFile = vi.fn().mockRejectedValue(new Error('File not found'));

      const enrichedMap = await analyzer.enrichRepositoryMap(mockRepoMap);

      expect(enrichedMap.files).toHaveLength(1);
      // Should preserve original file when enrichment fails
      expect(enrichedMap.files[0]).toEqual(mockRepoMap.files[0]);
    });
  });

  describe('type extraction methods', () => {
    test('isTypeScriptFile identifies TypeScript files correctly', () => {
      const testCases = [
        { path: 'test.ts', expected: true },
        { path: 'test.tsx', expected: true },
        { path: 'test.d.ts', expected: true },
        { path: 'test.js', expected: false },
        { path: 'test.py', expected: false },
        { path: 'README.md', expected: false }
      ];

      testCases.forEach(({ path, expected }) => {
        const result = analyzer['isTypeScriptFile'](path);
        expect(result).toBe(expected);
      });
    });

    test('normalizeTypeString cleans up type strings', () => {
      const testCases = [
        { input: 'string   |   number', expected: 'string | number' },
        { input: '  Array<string>  ', expected: 'Array<string>' },
        { input: 'Map<\n  string,\n  number\n>', expected: 'Map< string, number >' }
      ];

      testCases.forEach(({ input, expected }) => {
        const result = analyzer['normalizeTypeString'](input);
        expect(result).toBe(expected);
      });
    });

    test('getNodeText extracts text from AST node', () => {
      const mockNode = {
        startIndex: 5,
        endIndex: 15,
        type: 'identifier',
        startPosition: { row: 0, column: 5 },
        endPosition: { row: 0, column: 15 },
        children: [],
        parent: null,
        previousSibling: null,
        nextSibling: null
      };

      const content = 'const myVariable = 5;';
      const result = analyzer['getNodeText'](mockNode, content);
      expect(result).toBe('myVariable');
    });

    test('findChildByType finds child node by type', () => {
      const childNode = {
        type: 'identifier',
        startPosition: { row: 0, column: 0 },
        endPosition: { row: 0, column: 10 },
        startIndex: 0,
        endIndex: 10,
        children: [],
        parent: null,
        previousSibling: null,
        nextSibling: null
      };

      const parentNode = {
        type: 'variable_declaration',
        startPosition: { row: 0, column: 0 },
        endPosition: { row: 0, column: 20 },
        startIndex: 0,
        endIndex: 20,
        children: [childNode],
        parent: null,
        previousSibling: null,
        nextSibling: null
      };

      const result = analyzer['findChildByType'](parentNode, 'identifier');
      expect(result).toBe(childNode);

      const notFound = analyzer['findChildByType'](parentNode, 'nonexistent');
      expect(notFound).toBeNull();
    });

    test('determineTypeKind classifies AST node types correctly', () => {
      const testCases = [
        { nodeType: 'predefined_type', expected: 'primitive' },
        { nodeType: 'literal_type', expected: 'literal' },
        { nodeType: 'array_type', expected: 'array' },
        { nodeType: 'union_type', expected: 'union' },
        { nodeType: 'function_type', expected: 'function' },
        { nodeType: 'type_identifier', expected: 'reference' },
        { nodeType: 'unknown_type', expected: 'unknown' }
      ];

      testCases.forEach(({ nodeType, expected }) => {
        const mockNode = {
          type: nodeType,
          startPosition: { row: 0, column: 0 },
          endPosition: { row: 0, column: 10 },
          startIndex: 0,
          endIndex: 10,
          children: [],
          parent: null,
          previousSibling: null,
          nextSibling: null
        };

        const result = analyzer['determineTypeKind'](mockNode);
        expect(result).toBe(expected);
      });
    });
  });

  describe('configuration and options', () => {
    test('uses default options when none provided', async () => {
      const mockTreeWrapper = analyzer['wrapper'];
      mockTreeWrapper.parse = vi.fn().mockResolvedValue({
        success: true,
        tree: {
          rootNode: {
            type: 'program',
            startPosition: { row: 0, column: 0 },
            endPosition: { row: 1, column: 0 },
            startIndex: 0,
            endIndex: 10,
            children: [],
            parent: null,
            previousSibling: null,
            nextSibling: null
          }
        }
      });

      const result = await analyzer.analyzeContent('const x = 5;', 'test.ts');

      expect(result.filePath).toBe('test.ts');
      // Default options should include all analysis features
      expect(result.typeImports).toBeDefined();
      expect(result.typeExports).toBeDefined();
      expect(result.typeDependencies).toBeDefined();
    });

    test('respects custom analysis options', async () => {
      const customOptions: TypeAnalysisOptions = {
        includeDependencies: false,
        includeDetailedAnnotations: false,
        includeGenerics: false,
        includeImportsExports: false,
        maxTypeDepth: 3,
        resolveTypeAliases: false
      };

      const mockTreeWrapper = analyzer['wrapper'];
      mockTreeWrapper.parse = vi.fn().mockResolvedValue({
        success: true,
        tree: {
          rootNode: {
            type: 'program',
            startPosition: { row: 0, column: 0 },
            endPosition: { row: 1, column: 0 },
            startIndex: 0,
            endIndex: 10,
            children: [],
            parent: null,
            previousSibling: null,
            nextSibling: null
          }
        }
      });

      const result = await analyzer.analyzeContent('const x = 5;', 'test.ts', customOptions);

      expect(result.filePath).toBe('test.ts');
      expect(result.errors).toEqual([]);
    });
  });

  describe('caching', () => {
    test('caches analysis results for files', async () => {
      const filePath = '/test/sample.ts';
      const content = 'interface User { name: string; }';

      // Mock file system
      const fs = require('fs/promises');
      fs.readFile = vi.fn().mockResolvedValue(content);

      // Mock successful parsing
      const mockTreeWrapper = analyzer['wrapper'];
      mockTreeWrapper.parse = vi.fn().mockResolvedValue({
        success: true,
        tree: {
          rootNode: {
            type: 'program',
            startPosition: { row: 0, column: 0 },
            endPosition: { row: 1, column: 0 },
            startIndex: 0,
            endIndex: content.length,
            children: [],
            parent: null,
            previousSibling: null,
            nextSibling: null
          }
        }
      });

      // First call
      const result1 = await analyzer.analyzeFile(filePath);

      // Second call should use cache
      const result2 = await analyzer.analyzeFile(filePath);

      expect(result1).toBe(result2); // Same object reference (cached)
      expect(fs.readFile).toHaveBeenCalledTimes(1); // File only read once
    });

    test('resetInstance clears cache', async () => {
      const filePath = '/test/sample.ts';
      const content = 'interface User { name: string; }';

      // Mock file system
      const fs = require('fs/promises');
      fs.readFile = vi.fn().mockResolvedValue(content);

      // Mock successful parsing
      const mockTreeWrapper = analyzer['wrapper'];
      mockTreeWrapper.parse = vi.fn().mockResolvedValue({
        success: true,
        tree: {
          rootNode: {
            type: 'program',
            startPosition: { row: 0, column: 0 },
            endPosition: { row: 1, column: 0 },
            startIndex: 0,
            endIndex: content.length,
            children: [],
            parent: null,
            previousSibling: null,
            nextSibling: null
          }
        }
      });

      // First analysis
      await analyzer.analyzeFile(filePath);
      expect(fs.readFile).toHaveBeenCalledTimes(1);

      // Reset instance
      TypeAwarenessAnalyzer.resetInstance();
      const newAnalyzer = TypeAwarenessAnalyzer.getInstance();

      // Second analysis with new instance should read file again
      await newAnalyzer.analyzeFile(filePath);
      expect(fs.readFile).toHaveBeenCalledTimes(2);
    });
  });

  describe('error handling', () => {
    test('handles missing files gracefully', async () => {
      const fs = require('fs/promises');
      fs.readFile = vi.fn().mockRejectedValue(new Error('ENOENT: no such file or directory'));

      await expect(analyzer.analyzeFile('/nonexistent/file.ts')).rejects.toThrow(
        'Failed to analyze file /nonexistent/file.ts: ENOENT: no such file or directory'
      );
    });

    test('handles parsing errors without crashing', async () => {
      const mockTreeWrapper = analyzer['wrapper'];
      mockTreeWrapper.parse = vi.fn().mockRejectedValue(new Error('Syntax error'));

      const result = await analyzer.analyzeContent('invalid typescript code', 'test.ts');

      expect(result.errors).toContain('Analysis error: Syntax error');
      expect(result.interfaces).toEqual([]);
      expect(result.typeAliases).toEqual([]);
    });

    test('continues analysis even with partial errors', async () => {
      const mockTreeWrapper = analyzer['wrapper'];
      mockTreeWrapper.parse = vi.fn().mockResolvedValue({
        success: true,
        tree: {
          rootNode: {
            type: 'program',
            startPosition: { row: 0, column: 0 },
            endPosition: { row: 1, column: 0 },
            startIndex: 0,
            endIndex: 10,
            children: [
              // Mock a problematic child node
              {
                type: 'interface_declaration',
                startPosition: { row: 0, column: 0 },
                endPosition: { row: 1, column: 0 },
                startIndex: 0,
                endIndex: 10,
                children: [], // Missing required children
                parent: null,
                previousSibling: null,
                nextSibling: null
              }
            ],
            parent: null,
            previousSibling: null,
            nextSibling: null
          }
        }
      });

      const result = await analyzer.analyzeContent('interface User {', 'test.ts');

      expect(result.filePath).toBe('test.ts');
      expect(result.errors).toEqual([]); // No errors since extraction doesn't fail completely
    });
  });
});