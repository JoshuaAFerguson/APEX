/**
 * Edge case tests for CodebaseIndexer
 *
 * Tests boundary conditions, unusual inputs, and error scenarios
 */

import { describe, it, expect, vi, beforeEach, afterEach, MockedFunction } from 'vitest';
import { promises as fs } from 'fs';
import * as path from 'path';
import { glob } from 'glob';

import { CodebaseIndexer, type IndexingOptions } from '../indexer.js';
import { TreeSitterWrapper } from '../parsers/tree-sitter-wrapper.js';
import { getExtractorForLanguage } from '../extractors/index.js';
import { getLanguageForExtension, getSupportedExtensions } from '../parsers/types.js';
import { hasExtractorSupport, ExtractionError, SymbolKind } from '../extractors/types.js';

// Mock all dependencies
vi.mock('fs', () => ({
  promises: {
    stat: vi.fn(),
    readFile: vi.fn(),
  },
}));

vi.mock('glob', () => ({
  glob: vi.fn(),
}));

vi.mock('../parsers/tree-sitter-wrapper.js', () => ({
  TreeSitterWrapper: {
    getInstance: vi.fn(() => ({})),
  },
}));

vi.mock('../extractors/index.js', () => ({
  getExtractorForLanguage: vi.fn(),
}));

vi.mock('../parsers/types.js', () => ({
  getLanguageForExtension: vi.fn(),
  getSupportedExtensions: vi.fn(() => ['.ts', '.js', '.py']),
}));

vi.mock('../extractors/types.js', () => ({
  hasExtractorSupport: vi.fn(() => true),
  ExtractionError: class ExtractionError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'ExtractionError';
    }
  },
  SymbolKind: {
    Function: 'function',
    Class: 'class',
    Variable: 'variable',
  },
}));

const mockedFsStat = fs.stat as MockedFunction<typeof fs.stat>;
const mockedFsReadFile = fs.readFile as MockedFunction<typeof fs.readFile>;
const mockedGlob = glob as MockedFunction<typeof glob>;
const mockedGetExtractorForLanguage = getExtractorForLanguage as MockedFunction<typeof getExtractorForLanguage>;
const mockedGetLanguageForExtension = getLanguageForExtension as MockedFunction<typeof getLanguageForExtension>;
const mockedHasExtractorSupport = hasExtractorSupport as MockedFunction<typeof hasExtractorSupport>;

describe('CodebaseIndexer Edge Cases', () => {
  let indexer: CodebaseIndexer;

  beforeEach(() => {
    CodebaseIndexer.resetInstance();
    indexer = CodebaseIndexer.getInstance();
    vi.clearAllMocks();

    // Default mock setup
    mockedGetLanguageForExtension.mockImplementation((ext: string) => {
      const map: Record<string, any> = {
        '.ts': 'typescript',
        '.js': 'javascript',
        '.py': 'python',
      };
      return map[ext] || null;
    });

    mockedHasExtractorSupport.mockReturnValue(true);
  });

  describe('Boundary Conditions', () => {
    it('should handle empty file paths', async () => {
      const rootPath = '';
      mockedFsStat.mockRejectedValue(new Error('Invalid path'));

      await expect(indexer.indexDirectory(rootPath)).rejects.toThrow('Failed to index directory');
    });

    it('should handle extremely long file paths', async () => {
      const rootPath = '/test/project';
      const veryLongFileName = 'a'.repeat(1000) + '.ts';

      mockedFsStat
        .mockResolvedValueOnce({ isDirectory: () => true } as any)
        .mockResolvedValue({ size: 100, mtime: new Date() } as any);

      mockedGlob.mockResolvedValue([veryLongFileName]);
      mockedFsReadFile.mockResolvedValue('const x = 1;');

      const mockExtractor = {
        extractFromFile: vi.fn().mockResolvedValue({
          symbols: [],
          hasErrors: false,
          errors: []
        })
      };
      mockedGetExtractorForLanguage.mockReturnValue(mockExtractor as any);

      const result = await indexer.indexDirectory(rootPath);

      expect(result.files).toHaveLength(1);
      expect(result.files[0].path).toBe(veryLongFileName);
    });

    it('should handle zero-byte files', async () => {
      const rootPath = '/test/project';

      mockedFsStat
        .mockResolvedValueOnce({ isDirectory: () => true } as any)
        .mockResolvedValue({ size: 0, mtime: new Date() } as any);

      mockedGlob.mockResolvedValue(['empty.ts']);
      mockedFsReadFile.mockResolvedValue('');

      const mockExtractor = {
        extractFromFile: vi.fn().mockResolvedValue({
          symbols: [],
          hasErrors: false,
          errors: []
        })
      };
      mockedGetExtractorForLanguage.mockReturnValue(mockExtractor as any);

      const result = await indexer.indexDirectory(rootPath);

      expect(result.files).toHaveLength(1);
      expect(result.files[0].lineCount).toBe(1); // Empty string still counts as 1 line
      expect(result.files[0].size).toBe(0);
    });

    it('should handle files with only whitespace', async () => {
      const rootPath = '/test/project';

      mockedFsStat
        .mockResolvedValueOnce({ isDirectory: () => true } as any)
        .mockResolvedValue({ size: 50, mtime: new Date() } as any);

      mockedGlob.mockResolvedValue(['whitespace.ts']);
      mockedFsReadFile.mockResolvedValue('   \n\n\t\t\n   ');

      const mockExtractor = {
        extractFromFile: vi.fn().mockResolvedValue({
          symbols: [],
          hasErrors: false,
          errors: []
        })
      };
      mockedGetExtractorForLanguage.mockReturnValue(mockExtractor as any);

      const result = await indexer.indexDirectory(rootPath);

      expect(result.files).toHaveLength(1);
      expect(result.files[0].lineCount).toBe(5);
      expect(result.files[0].symbols).toHaveLength(0);
    });

    it('should handle maximum file size boundary', async () => {
      const rootPath = '/test/project';
      const maxSize = 1024;

      mockedFsStat
        .mockResolvedValueOnce({ isDirectory: () => true } as any)
        .mockResolvedValueOnce({ size: maxSize } as any) // Exactly at limit
        .mockResolvedValueOnce({ size: maxSize + 1 } as any) // Over limit
        .mockResolvedValueOnce({ size: maxSize, mtime: new Date() } as any);

      mockedGlob.mockResolvedValue(['exact.ts', 'over.ts']);
      mockedFsReadFile.mockResolvedValue('// content');

      const mockExtractor = {
        extractFromFile: vi.fn().mockResolvedValue({
          symbols: [],
          hasErrors: false,
          errors: []
        })
      };
      mockedGetExtractorForLanguage.mockReturnValue(mockExtractor as any);

      const result = await indexer.indexDirectory(rootPath, { maxFileSize: maxSize });

      // Only the file at exactly the limit should be included
      expect(result.files).toHaveLength(1);
      expect(result.files[0].path).toBe('exact.ts');
    });

    it('should handle concurrency of 1', async () => {
      const rootPath = '/test/project';

      mockedFsStat
        .mockResolvedValueOnce({ isDirectory: () => true } as any)
        .mockResolvedValue({ size: 100, mtime: new Date() } as any);

      mockedGlob.mockResolvedValue(['file1.ts', 'file2.ts']);
      mockedFsReadFile.mockResolvedValue('const x = 1;');

      let processedCount = 0;
      const mockExtractor = {
        extractFromFile: vi.fn().mockImplementation(() => {
          processedCount++;
          return Promise.resolve({
            symbols: [],
            hasErrors: false,
            errors: []
          });
        })
      };
      mockedGetExtractorForLanguage.mockReturnValue(mockExtractor as any);

      await indexer.indexDirectory(rootPath, { concurrency: 1 });

      expect(mockExtractor.extractFromFile).toHaveBeenCalledTimes(2);
      expect(processedCount).toBe(2);
    });
  });

  describe('Unusual File Content', () => {
    beforeEach(() => {
      mockedFsStat
        .mockResolvedValueOnce({ isDirectory: () => true } as any)
        .mockResolvedValue({ size: 1000, mtime: new Date() } as any);

      mockedGlob.mockResolvedValue(['test.ts']);
    });

    it('should handle files with unusual characters', async () => {
      const rootPath = '/test/project';
      const weirdContent = '// Émojis: 🚀 Unicode: 中文 Special: \u0000\u0001\u0002';

      mockedFsReadFile.mockResolvedValue(weirdContent);

      const mockExtractor = {
        extractFromFile: vi.fn().mockResolvedValue({
          symbols: [],
          hasErrors: false,
          errors: []
        })
      };
      mockedGetExtractorForLanguage.mockReturnValue(mockExtractor as any);

      const result = await indexer.indexDirectory(rootPath);

      expect(result.files).toHaveLength(1);
      expect(result.files[0].lineCount).toBe(1);
      expect(mockExtractor.extractFromFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object)
      );
    });

    it('should handle files with very long lines', async () => {
      const rootPath = '/test/project';
      const longLine = '// ' + 'x'.repeat(100000);

      mockedFsReadFile.mockResolvedValue(longLine);

      const mockExtractor = {
        extractFromFile: vi.fn().mockResolvedValue({
          symbols: [],
          hasErrors: false,
          errors: []
        })
      };
      mockedGetExtractorForLanguage.mockReturnValue(mockExtractor as any);

      const result = await indexer.indexDirectory(rootPath);

      expect(result.files).toHaveLength(1);
      expect(result.files[0].lineCount).toBe(1);
    });

    it('should handle files with many newlines', async () => {
      const rootPath = '/test/project';
      const manyNewlines = '\n'.repeat(10000);

      mockedFsReadFile.mockResolvedValue(manyNewlines);

      const mockExtractor = {
        extractFromFile: vi.fn().mockResolvedValue({
          symbols: [],
          hasErrors: false,
          errors: []
        })
      };
      mockedGetExtractorForLanguage.mockReturnValue(mockExtractor as any);

      const result = await indexer.indexDirectory(rootPath);

      expect(result.files).toHaveLength(1);
      expect(result.files[0].lineCount).toBe(10001); // 10000 newlines + 1
    });

    it('should handle binary file content (non-UTF-8)', async () => {
      const rootPath = '/test/project';

      // Simulate binary content that causes readFile to return non-string data
      mockedFsReadFile.mockRejectedValue(new Error('File is binary'));

      const result = await indexer.indexDirectory(rootPath, { continueOnError: true });

      expect(result.files).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('File is binary');
    });
  });

  describe('Extreme Configuration Values', () => {
    it('should handle maxSymbolDepth of 0', async () => {
      const rootPath = '/test/project';

      mockedFsStat
        .mockResolvedValueOnce({ isDirectory: () => true } as any)
        .mockResolvedValue({ size: 100, mtime: new Date() } as any);

      mockedGlob.mockResolvedValue(['test.ts']);
      mockedFsReadFile.mockResolvedValue('class Test { method() {} }');

      const mockExtractor = {
        extractFromFile: vi.fn().mockResolvedValue({
          symbols: [],
          hasErrors: false,
          errors: []
        })
      };
      mockedGetExtractorForLanguage.mockReturnValue(mockExtractor as any);

      await indexer.indexDirectory(rootPath, { maxSymbolDepth: 0 });

      expect(mockExtractor.extractFromFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          maxDepth: 0
        })
      );
    });

    it('should handle very high concurrency values', async () => {
      const rootPath = '/test/project';

      mockedFsStat
        .mockResolvedValueOnce({ isDirectory: () => true } as any)
        .mockResolvedValue({ size: 100, mtime: new Date() } as any);

      mockedGlob.mockResolvedValue(['file1.ts']);
      mockedFsReadFile.mockResolvedValue('const x = 1;');

      const mockExtractor = {
        extractFromFile: vi.fn().mockResolvedValue({
          symbols: [],
          hasErrors: false,
          errors: []
        })
      };
      mockedGetExtractorForLanguage.mockReturnValue(mockExtractor as any);

      // Should clamp to minimum of 1
      await indexer.indexDirectory(rootPath, { concurrency: 10000 });

      expect(mockExtractor.extractFromFile).toHaveBeenCalledTimes(1);
    });

    it('should handle zero concurrency', async () => {
      const rootPath = '/test/project';

      mockedFsStat
        .mockResolvedValueOnce({ isDirectory: () => true } as any)
        .mockResolvedValue({ size: 100, mtime: new Date() } as any);

      mockedGlob.mockResolvedValue(['file1.ts']);
      mockedFsReadFile.mockResolvedValue('const x = 1;');

      const mockExtractor = {
        extractFromFile: vi.fn().mockResolvedValue({
          symbols: [],
          hasErrors: false,
          errors: []
        })
      };
      mockedGetExtractorForLanguage.mockReturnValue(mockExtractor as any);

      // Should default to 1
      await indexer.indexDirectory(rootPath, { concurrency: 0 });

      expect(mockExtractor.extractFromFile).toHaveBeenCalledTimes(1);
    });

    it('should handle maxFileSize of 0 (unlimited)', async () => {
      const rootPath = '/test/project';

      mockedFsStat
        .mockResolvedValueOnce({ isDirectory: () => true } as any)
        .mockResolvedValue({ size: 999999, mtime: new Date() } as any); // Very large file

      mockedGlob.mockResolvedValue(['huge.ts']);
      mockedFsReadFile.mockResolvedValue('// huge file content');

      const mockExtractor = {
        extractFromFile: vi.fn().mockResolvedValue({
          symbols: [],
          hasErrors: false,
          errors: []
        })
      };
      mockedGetExtractorForLanguage.mockReturnValue(mockExtractor as any);

      const result = await indexer.indexDirectory(rootPath, { maxFileSize: 0 });

      // Should include the large file when maxFileSize is 0 (unlimited)
      expect(result.files).toHaveLength(1);
      expect(result.files[0].path).toBe('huge.ts');
    });
  });

  describe('Glob Pattern Edge Cases', () => {
    beforeEach(() => {
      mockedFsStat
        .mockResolvedValueOnce({ isDirectory: () => true } as any)
        .mockResolvedValue({ size: 100, mtime: new Date() } as any);

      mockedFsReadFile.mockResolvedValue('const x = 1;');

      const mockExtractor = {
        extractFromFile: vi.fn().mockResolvedValue({
          symbols: [],
          hasErrors: false,
          errors: []
        })
      };
      mockedGetExtractorForLanguage.mockReturnValue(mockExtractor as any);
    });

    it('should handle empty include patterns', async () => {
      const rootPath = '/test/project';

      mockedGlob.mockResolvedValue(['default.ts']);

      const result = await indexer.indexDirectory(rootPath, { includePatterns: [] });

      expect(result.files).toHaveLength(1);
      // Should fall back to default extension patterns
      expect(mockedGlob).toHaveBeenCalled();
    });

    it('should handle invalid glob patterns', async () => {
      const rootPath = '/test/project';

      // First pattern fails, second succeeds
      mockedGlob
        .mockRejectedValueOnce(new Error('Invalid pattern'))
        .mockResolvedValue(['valid.ts']);

      const result = await indexer.indexDirectory(rootPath, {
        includePatterns: ['[invalid', '**/*.ts']
      });

      // Should continue with valid patterns despite invalid ones
      expect(result.files).toHaveLength(1);
    });

    it('should handle patterns that return duplicate files', async () => {
      const rootPath = '/test/project';

      // Multiple patterns return the same file
      mockedGlob
        .mockResolvedValueOnce(['duplicate.ts'])
        .mockResolvedValueOnce(['duplicate.ts']);

      const result = await indexer.indexDirectory(rootPath, {
        includePatterns: ['**/*.ts', 'src/*.ts']
      });

      // Should deduplicate
      expect(result.files).toHaveLength(1);
      expect(result.files[0].path).toBe('duplicate.ts');
    });
  });

  describe('Symbol Extraction Edge Cases', () => {
    beforeEach(() => {
      mockedFsStat
        .mockResolvedValueOnce({ isDirectory: () => true } as any)
        .mockResolvedValue({ size: 100, mtime: new Date() } as any);

      mockedGlob.mockResolvedValue(['test.ts']);
      mockedFsReadFile.mockResolvedValue('class Test {}');
    });

    it('should handle symbols without location information', async () => {
      const rootPath = '/test/project';

      const mockExtractor = {
        extractFromFile: vi.fn().mockResolvedValue({
          symbols: [
            {
              name: 'NoLocation',
              kind: SymbolKind.Variable,
              location: undefined, // Missing location
              exportKind: 'none'
            }
          ],
          hasErrors: false,
          errors: []
        })
      };
      mockedGetExtractorForLanguage.mockReturnValue(mockExtractor as any);

      // Should not crash, but may produce invalid symbols
      await expect(indexer.indexDirectory(rootPath)).rejects.toThrow();
    });

    it('should handle symbols with invalid line numbers', async () => {
      const rootPath = '/test/project';

      const mockExtractor = {
        extractFromFile: vi.fn().mockResolvedValue({
          symbols: [
            {
              name: 'InvalidLine',
              kind: SymbolKind.Function,
              location: {
                start: { row: -1, column: 0 }, // Invalid negative line
                end: { row: 0, column: 10 }
              },
              exportKind: 'none'
            }
          ],
          hasErrors: false,
          errors: []
        })
      };
      mockedGetExtractorForLanguage.mockReturnValue(mockExtractor as any);

      const result = await indexer.indexDirectory(rootPath);

      expect(result.files[0].symbols).toHaveLength(1);
      expect(result.files[0].symbols[0].startLine).toBe(0); // -1 + 1 = 0 (converted to 1-based)
    });

    it('should handle deeply nested symbol hierarchies', async () => {
      const rootPath = '/test/project';

      // Create a deeply nested structure
      const createNestedSymbol = (depth: number): any => {
        if (depth === 0) {
          return {
            name: `Symbol${depth}`,
            kind: SymbolKind.Variable,
            location: { start: { row: depth, column: 0 }, end: { row: depth, column: 10 } },
            exportKind: 'none'
          };
        }
        return {
          name: `Symbol${depth}`,
          kind: SymbolKind.Class,
          location: { start: { row: depth, column: 0 }, end: { row: depth, column: 10 } },
          exportKind: 'none',
          children: [createNestedSymbol(depth - 1)]
        };
      };

      const mockExtractor = {
        extractFromFile: vi.fn().mockResolvedValue({
          symbols: [createNestedSymbol(100)], // 100 levels deep
          hasErrors: false,
          errors: []
        })
      };
      mockedGetExtractorForLanguage.mockReturnValue(mockExtractor as any);

      const result = await indexer.indexDirectory(rootPath);

      // Should flatten all nested symbols
      expect(result.files[0].symbols.length).toBeGreaterThan(50); // Should have many flattened symbols
    });

    it('should handle unknown symbol kinds', async () => {
      const rootPath = '/test/project';

      const mockExtractor = {
        extractFromFile: vi.fn().mockResolvedValue({
          symbols: [
            {
              name: 'UnknownSymbol',
              kind: 'unknown_kind' as any, // Not in SymbolKind enum
              location: { start: { row: 0, column: 0 }, end: { row: 0, column: 10 } },
              exportKind: 'none'
            }
          ],
          hasErrors: false,
          errors: []
        })
      };
      mockedGetExtractorForLanguage.mockReturnValue(mockExtractor as any);

      const result = await indexer.indexDirectory(rootPath);

      expect(result.files[0].symbols).toHaveLength(1);
      expect(result.files[0].symbols[0].type).toBe('unknown');
    });
  });

  describe('Resource Exhaustion Scenarios', () => {
    it('should handle memory pressure with many files', async () => {
      const rootPath = '/test/project';

      mockedFsStat
        .mockResolvedValueOnce({ isDirectory: () => true } as any)
        .mockResolvedValue({ size: 100, mtime: new Date() } as any);

      // Generate many file names
      const manyFiles = Array.from({ length: 10000 }, (_, i) => `file${i}.ts`);
      mockedGlob.mockResolvedValue(manyFiles);
      mockedFsReadFile.mockResolvedValue('const x = 1;');

      const mockExtractor = {
        extractFromFile: vi.fn().mockResolvedValue({
          symbols: [],
          hasErrors: false,
          errors: []
        })
      };
      mockedGetExtractorForLanguage.mockReturnValue(mockExtractor as any);

      // Should handle many files without crashing
      const result = await indexer.indexDirectory(rootPath, {
        concurrency: 2 // Keep concurrency low to avoid overwhelming the system
      });

      expect(result.files).toHaveLength(10000);
      expect(result.stats?.totalFiles).toBe(10000);
    }, 30000); // Increase timeout for this intensive test

    it('should handle extractor that throws on every call', async () => {
      const rootPath = '/test/project';

      mockedFsStat
        .mockResolvedValueOnce({ isDirectory: () => true } as any)
        .mockResolvedValue({ size: 100, mtime: new Date() } as any);

      mockedGlob.mockResolvedValue(['file1.ts', 'file2.ts']);
      mockedFsReadFile.mockResolvedValue('const x = 1;');

      const mockExtractor = {
        extractFromFile: vi.fn().mockRejectedValue(new Error('Extractor always fails'))
      };
      mockedGetExtractorForLanguage.mockReturnValue(mockExtractor as any);

      const result = await indexer.indexDirectory(rootPath, { continueOnError: true });

      expect(result.files).toHaveLength(2);
      expect(result.files.every(f => f.hasParseErrors)).toBe(true);
      expect(result.errors).toHaveLength(0); // File-level errors, not global errors
    });
  });
});