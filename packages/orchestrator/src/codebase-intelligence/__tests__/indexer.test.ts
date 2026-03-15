/**
 * Comprehensive test suite for CodebaseIndexer class
 *
 * Tests cover:
 * - Basic directory indexing functionality
 * - File discovery with include/exclude patterns
 * - Symbol extraction integration
 * - Error handling and recovery
 * - Statistics calculation
 * - Progress reporting
 * - Edge cases and boundary conditions
 */

import { describe, it, expect, vi, beforeEach, afterEach, MockedFunction } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { glob } from 'glob';

import type { RepositoryMap, CodeFile, CodeSymbol, SymbolType } from '@apexcli/core/types';
import { CodebaseIndexer, type IndexingOptions, type IndexingProgress, type IndexingError } from '../indexer.js';
import { TreeSitterWrapper } from '../parsers/tree-sitter-wrapper.js';
import { getExtractorForLanguage } from '../extractors/index.js';
import {
  getLanguageForExtension,
  getSupportedExtensions,
  type SupportedLanguage
} from '../parsers/types.js';
import {
  hasExtractorSupport,
  ExtractionError,
  type ExtractedSymbol,
  type ExtractionResult,
  SymbolKind
} from '../extractors/types.js';

// Mock external dependencies
vi.mock('fs/promises', () => ({
  stat: vi.fn(),
  readFile: vi.fn(),
}));

vi.mock('glob', () => ({
  glob: vi.fn(),
}));

vi.mock('crypto', () => ({
  createHash: vi.fn(() => ({
    update: vi.fn().mockReturnThis(),
    digest: vi.fn(() => 'mockedhash123'),
  })),
}));

vi.mock('../parsers/tree-sitter-wrapper.js', () => ({
  TreeSitterWrapper: {
    getInstance: vi.fn(() => ({
      // Mock TreeSitter wrapper instance
    })),
  },
}));

vi.mock('../extractors/index.js', () => ({
  getExtractorForLanguage: vi.fn(),
}));

vi.mock('../parsers/types.js', () => ({
  getLanguageForExtension: vi.fn(),
  getSupportedExtensions: vi.fn(() => ['.ts', '.js', '.py', '.go', '.java', '.rs']),
  EXTENSION_LANGUAGE_MAP: {},
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
    ArrowFunction: 'arrow_function',
    Class: 'class',
    Interface: 'interface',
    TypeAlias: 'type_alias',
    Enum: 'enum',
    Constant: 'constant',
    Variable: 'variable',
    Method: 'method',
    Property: 'property',
    Constructor: 'constructor',
    Getter: 'getter',
    Setter: 'setter',
    Parameter: 'parameter',
    EnumMember: 'enum_member',
    Decorator: 'decorator',
    Import: 'import',
    ImportFrom: 'import_from',
    Module: 'module',
  },
}));

// Type the mocked functions
const mockedFsStat = fs.stat as MockedFunction<typeof fs.stat>;
const mockedFsReadFile = fs.readFile as MockedFunction<typeof fs.readFile>;
const mockedGlob = glob as MockedFunction<typeof glob>;
const mockedGetExtractorForLanguage = getExtractorForLanguage as MockedFunction<typeof getExtractorForLanguage>;
const mockedGetLanguageForExtension = getLanguageForExtension as MockedFunction<typeof getLanguageForExtension>;
const mockedHasExtractorSupport = hasExtractorSupport as MockedFunction<typeof hasExtractorSupport>;

describe('CodebaseIndexer', () => {
  let indexer: CodebaseIndexer;

  beforeEach(() => {
    // Reset the singleton instance for each test
    CodebaseIndexer.resetInstance();
    indexer = CodebaseIndexer.getInstance();

    // Clear all mocks
    vi.clearAllMocks();

    // Setup default mock returns
    mockedGetLanguageForExtension.mockImplementation((ext: string) => {
      const map: Record<string, SupportedLanguage> = {
        '.ts': 'typescript' as SupportedLanguage,
        '.js': 'javascript' as SupportedLanguage,
        '.py': 'python' as SupportedLanguage,
        '.go': 'go' as SupportedLanguage,
        '.java': 'java' as SupportedLanguage,
        '.rs': 'rust' as SupportedLanguage,
      };
      return map[ext] || null;
    });

    mockedHasExtractorSupport.mockReturnValue(true);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance on multiple calls', () => {
      const instance1 = CodebaseIndexer.getInstance();
      const instance2 = CodebaseIndexer.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should create new instance after reset', () => {
      const instance1 = CodebaseIndexer.getInstance();
      CodebaseIndexer.resetInstance();
      const instance2 = CodebaseIndexer.getInstance();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('indexDirectory - Basic Functionality', () => {
    it('should index a directory with supported files', async () => {
      // Setup mocks for a simple directory with one TypeScript file
      const rootPath = '/test/project';
      const testFilePath = path.resolve(rootPath, 'src/index.ts');

      mockedFsStat
        .mockResolvedValueOnce({ isDirectory: () => true } as any) // Root directory stat
        .mockResolvedValue({ size: 1024, mtime: new Date('2024-01-15') } as any); // File stats (for any subsequent calls)

      // Mock glob to return files for any pattern that contains .ts
      mockedGlob.mockImplementation(async (pattern: string) => {
        if (typeof pattern === 'string' && pattern.includes('.ts')) {
          return ['src/index.ts'];
        }
        return [];
      });
      mockedFsReadFile.mockResolvedValue('export function hello() { return "world"; }');

      // Mock extractor
      const mockExtractor = {
        extractFromFile: vi.fn().mockResolvedValue({
          symbols: [
            {
              name: 'hello',
              kind: SymbolKind.Function,
              location: {
                start: { row: 0, column: 15 },
                end: { row: 0, column: 50 }
              },
              signature: 'function hello(): string',
              exportKind: 'named',
              documentation: undefined,
              modifiers: ['export']
            } as ExtractedSymbol
          ],
          hasErrors: false,
          errors: []
        } as ExtractionResult)
      };
      mockedGetExtractorForLanguage.mockReturnValue(mockExtractor as any);

      const result = await indexer.indexDirectory(rootPath);

      expect(result).toMatchObject({
        rootPath: path.resolve(rootPath),
        name: 'project',
        files: expect.arrayContaining([
          expect.objectContaining({
            path: 'src/index.ts',
            language: 'typescript',
            lineCount: 1,
            size: 1024,
            symbols: expect.arrayContaining([
              expect.objectContaining({
                name: 'hello',
                type: 'function',
                signature: 'function hello(): string',
                exported: true
              })
            ])
          })
        ]),
        stats: expect.objectContaining({
          totalFiles: 1,
          totalSymbols: 1,
          totalLines: 1,
          languageBreakdown: { typescript: 1 },
          symbolTypeBreakdown: { function: 1 }
        }),
        version: '1.0.0'
      });
    });

    it('should handle empty directories', async () => {
      const rootPath = '/test/empty';

      mockedFsStat.mockResolvedValueOnce({ isDirectory: () => true } as any);
      mockedGlob.mockResolvedValue([]);

      const result = await indexer.indexDirectory(rootPath);

      expect(result).toMatchObject({
        rootPath: path.resolve(rootPath),
        name: 'empty',
        files: [],
        stats: {
          totalFiles: 0,
          totalSymbols: 0,
          totalReferences: 0,
          totalLines: 0,
          languageBreakdown: {},
          symbolTypeBreakdown: {}
        }
      });
    });

    it('should reject non-directory paths', async () => {
      const filePath = '/test/file.txt';
      mockedFsStat.mockResolvedValueOnce({ isDirectory: () => false } as any);

      await expect(indexer.indexDirectory(filePath)).rejects.toThrow('Path is not a directory');
    });

    it('should reject non-existent paths', async () => {
      const invalidPath = '/test/nonexistent';
      mockedFsStat.mockRejectedValueOnce(new Error('ENOENT: no such file or directory'));

      await expect(indexer.indexDirectory(invalidPath)).rejects.toThrow('Failed to index directory');
    });
  });

  describe('File Discovery and Filtering', () => {
    beforeEach(() => {
      mockedFsStat.mockResolvedValue({ isDirectory: () => true, size: 1024, mtime: new Date() } as any);
      mockedFsReadFile.mockResolvedValue('// test content');
    });

    it('should discover files with supported extensions', async () => {
      const rootPath = '/test/project';
      mockedGlob
        .mockResolvedValueOnce(['src/app.ts'])
        .mockResolvedValueOnce(['src/utils.js'])
        .mockResolvedValueOnce(['src/main.py']);

      const mockExtractor = {
        extractFromFile: vi.fn().mockResolvedValue({
          symbols: [],
          hasErrors: false,
          errors: []
        })
      };
      mockedGetExtractorForLanguage.mockReturnValue(mockExtractor as any);

      const result = await indexer.indexDirectory(rootPath);

      expect(result.files).toHaveLength(3);
      expect(result.files.map(f => f.path)).toEqual(
        expect.arrayContaining(['src/app.ts', 'src/utils.js', 'src/main.py'])
      );
    });

    it('should respect include patterns', async () => {
      const rootPath = '/test/project';
      const options: IndexingOptions = {
        includePatterns: ['src/**/*.ts']
      };

      mockedGlob.mockResolvedValue(['src/main.ts', 'src/utils.ts']);

      const mockExtractor = {
        extractFromFile: vi.fn().mockResolvedValue({
          symbols: [],
          hasErrors: false,
          errors: []
        })
      };
      mockedGetExtractorForLanguage.mockReturnValue(mockExtractor as any);

      const result = await indexer.indexDirectory(rootPath, options);

      expect(result.files).toHaveLength(2);
      expect(mockedGlob).toHaveBeenCalledWith(
        expect.stringContaining('src/**/*.ts'),
        expect.objectContaining({
          cwd: rootPath,
          ignore: expect.any(Array)
        })
      );
    });

    it('should respect exclude patterns', async () => {
      const rootPath = '/test/project';
      const options: IndexingOptions = {
        excludePatterns: ['**/node_modules/**', '**/dist/**']
      };

      mockedGlob.mockResolvedValue(['src/app.ts']);

      const mockExtractor = {
        extractFromFile: vi.fn().mockResolvedValue({
          symbols: [],
          hasErrors: false,
          errors: []
        })
      };
      mockedGetExtractorForLanguage.mockReturnValue(mockExtractor as any);

      await indexer.indexDirectory(rootPath, options);

      expect(mockedGlob).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          ignore: expect.arrayContaining(['**/node_modules/**', '**/dist/**'])
        })
      );
    });

    it('should filter files by maximum size', async () => {
      const rootPath = '/test/project';
      const options: IndexingOptions = {
        maxFileSize: 500 // 500 bytes
      };

      mockedFsStat
        .mockResolvedValueOnce({ isDirectory: () => true } as any) // Root directory
        .mockResolvedValueOnce({ size: 1000 } as any) // Large file - should be excluded
        .mockResolvedValueOnce({ size: 300, mtime: new Date() } as any); // Small file - should be included

      mockedGlob.mockResolvedValue(['large.ts', 'small.ts']);

      const mockExtractor = {
        extractFromFile: vi.fn().mockResolvedValue({
          symbols: [],
          hasErrors: false,
          errors: []
        })
      };
      mockedGetExtractorForLanguage.mockReturnValue(mockExtractor as any);

      const result = await indexer.indexDirectory(rootPath, options);

      expect(result.files).toHaveLength(1);
      expect(result.files[0].path).toBe('small.ts');
    });
  });

  describe('Symbol Extraction', () => {
    beforeEach(() => {
      mockedFsStat
        .mockResolvedValueOnce({ isDirectory: () => true } as any)
        .mockResolvedValue({ size: 1024, mtime: new Date() } as any);
      mockedGlob.mockResolvedValue(['src/example.ts']);
      mockedFsReadFile.mockResolvedValue('class Example { method() {} }');
    });

    it('should extract symbols using appropriate extractor', async () => {
      const rootPath = '/test/project';

      const mockExtractor = {
        extractFromFile: vi.fn().mockResolvedValue({
          symbols: [
            {
              name: 'Example',
              kind: SymbolKind.Class,
              location: {
                start: { row: 0, column: 0 },
                end: { row: 0, column: 30 }
              },
              signature: 'class Example',
              exportKind: 'none',
              children: [
                {
                  name: 'method',
                  kind: SymbolKind.Method,
                  location: {
                    start: { row: 0, column: 15 },
                    end: { row: 0, column: 28 }
                  },
                  signature: 'method(): void',
                  exportKind: 'none'
                }
              ]
            }
          ],
          hasErrors: false,
          errors: []
        })
      };
      mockedGetExtractorForLanguage.mockReturnValue(mockExtractor as any);

      const result = await indexer.indexDirectory(rootPath);

      expect(result.files[0].symbols).toHaveLength(2); // Class + Method (flattened)
      expect(result.files[0].symbols).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'Example',
            type: 'class',
            signature: 'class Example'
          }),
          expect.objectContaining({
            name: 'method',
            type: 'method',
            signature: 'method(): void'
          })
        ])
      );
    });

    it('should handle files without extractor support', async () => {
      const rootPath = '/test/project';
      mockedHasExtractorSupport.mockReturnValue(false);

      const result = await indexer.indexDirectory(rootPath);

      expect(result.files[0].symbols).toHaveLength(0);
      expect(mockedGetExtractorForLanguage).not.toHaveBeenCalled();
    });

    it('should convert symbol kinds to types correctly', async () => {
      const rootPath = '/test/project';

      const mockExtractor = {
        extractFromFile: vi.fn().mockResolvedValue({
          symbols: [
            { name: 'func', kind: SymbolKind.Function, location: { start: { row: 0, column: 0 }, end: { row: 0, column: 10 } }, exportKind: 'none' },
            { name: 'MyClass', kind: SymbolKind.Class, location: { start: { row: 1, column: 0 }, end: { row: 1, column: 10 } }, exportKind: 'none' },
            { name: 'IFace', kind: SymbolKind.Interface, location: { start: { row: 2, column: 0 }, end: { row: 2, column: 10 } }, exportKind: 'none' },
            { name: 'MyEnum', kind: SymbolKind.Enum, location: { start: { row: 3, column: 0 }, end: { row: 3, column: 10 } }, exportKind: 'none' },
          ],
          hasErrors: false,
          errors: []
        })
      };
      mockedGetExtractorForLanguage.mockReturnValue(mockExtractor as any);

      const result = await indexer.indexDirectory(rootPath);

      const symbolTypes = result.files[0].symbols.map(s => s.type);
      expect(symbolTypes).toEqual(['function', 'class', 'interface', 'enum']);
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      mockedFsStat
        .mockResolvedValueOnce({ isDirectory: () => true } as any)
        .mockResolvedValue({ size: 1024, mtime: new Date() } as any);
      mockedGlob.mockResolvedValue(['src/error.ts']);
      mockedFsReadFile.mockResolvedValue('invalid syntax');
    });

    it('should handle extraction errors with continueOnError=true', async () => {
      const rootPath = '/test/project';
      const options: IndexingOptions = {
        continueOnError: true
      };

      const mockExtractor = {
        extractFromFile: vi.fn().mockRejectedValue(new ExtractionError('Parse error'))
      };
      mockedGetExtractorForLanguage.mockReturnValue(mockExtractor as any);

      const result = await indexer.indexDirectory(rootPath, options);

      expect(result.files[0].hasErrors).toBe(true);
      expect(result.files[0].errors).toHaveLength(1);
      expect(result.files[0].errors[0].message).toBe('Parse error');
    });

    it('should throw on extraction errors with continueOnError=false', async () => {
      const rootPath = '/test/project';
      const options: IndexingOptions = {
        continueOnError: false
      };

      const mockExtractor = {
        extractFromFile: vi.fn().mockRejectedValue(new ExtractionError('Parse error'))
      };
      mockedGetExtractorForLanguage.mockReturnValue(mockExtractor as any);

      await expect(indexer.indexDirectory(rootPath, options)).rejects.toThrow('Parse error');
    });

    it('should handle glob pattern errors gracefully', async () => {
      const rootPath = '/test/project';

      // First call succeeds, second fails
      mockedGlob
        .mockResolvedValueOnce(['file1.ts'])
        .mockRejectedValueOnce(new Error('Invalid pattern'));

      const mockExtractor = {
        extractFromFile: vi.fn().mockResolvedValue({
          symbols: [],
          hasErrors: false,
          errors: []
        })
      };
      mockedGetExtractorForLanguage.mockReturnValue(mockExtractor as any);

      // Should not throw, should continue with valid patterns
      const result = await indexer.indexDirectory(rootPath);
      expect(result.files).toHaveLength(1);
    });

    it('should collect and report parsing errors', async () => {
      const rootPath = '/test/project';

      const mockExtractor = {
        extractFromFile: vi.fn().mockResolvedValue({
          symbols: [],
          hasErrors: true,
          errors: [
            {
              message: 'Unexpected token',
              startPosition: { row: 5, column: 10 }
            }
          ]
        })
      };
      mockedGetExtractorForLanguage.mockReturnValue(mockExtractor as any);

      const result = await indexer.indexDirectory(rootPath);

      expect(result.files[0].hasErrors).toBe(true);
      expect(result.files[0].errors).toEqual([
        {
          message: 'Unexpected token',
          line: 6, // 1-based
          column: 10
        }
      ]);
    });
  });

  describe('Statistics Calculation', () => {
    it('should calculate correct statistics for mixed codebase', async () => {
      const rootPath = '/test/project';

      mockedFsStat
        .mockResolvedValueOnce({ isDirectory: () => true } as any) // Root directory
        .mockResolvedValueOnce({ size: 1500, mtime: new Date() } as any) // TypeScript file
        .mockResolvedValueOnce({ size: 800, mtime: new Date() } as any) // Python file
        .mockResolvedValueOnce({ size: 1200, mtime: new Date() } as any); // JavaScript file

      mockedGlob.mockResolvedValue(['app.ts', 'script.py', 'utils.js']);

      // Mock different file contents with different line counts
      mockedFsReadFile
        .mockResolvedValueOnce('// TypeScript\nclass App {}\nexport default App;') // 3 lines
        .mockResolvedValueOnce('# Python\ndef main():\n    pass') // 3 lines
        .mockResolvedValueOnce('// JavaScript\nfunction utils() {}\nmodule.exports = utils;'); // 3 lines

      // Mock language detection
      mockedGetLanguageForExtension
        .mockReturnValueOnce('typescript' as SupportedLanguage)
        .mockReturnValueOnce('python' as SupportedLanguage)
        .mockReturnValueOnce('javascript' as SupportedLanguage);

      const mockExtractor = {
        extractFromFile: vi.fn()
          .mockResolvedValueOnce({
            symbols: [
              { name: 'App', kind: SymbolKind.Class, location: { start: { row: 0, column: 0 }, end: { row: 0, column: 10 } }, exportKind: 'default' }
            ],
            hasErrors: false,
            errors: []
          })
          .mockResolvedValueOnce({
            symbols: [
              { name: 'main', kind: SymbolKind.Function, location: { start: { row: 0, column: 0 }, end: { row: 0, column: 10 } }, exportKind: 'none' }
            ],
            hasErrors: false,
            errors: []
          })
          .mockResolvedValueOnce({
            symbols: [
              { name: 'utils', kind: SymbolKind.Function, location: { start: { row: 0, column: 0 }, end: { row: 0, column: 10 } }, exportKind: 'none' }
            ],
            hasErrors: false,
            errors: []
          })
      };
      mockedGetExtractorForLanguage.mockReturnValue(mockExtractor as any);

      const result = await indexer.indexDirectory(rootPath);

      expect(result.stats).toEqual({
        totalFiles: 3,
        totalSymbols: 3,
        totalReferences: 0,
        totalLines: 9, // 3 + 3 + 3
        languageBreakdown: {
          typescript: 1,
          python: 1,
          javascript: 1
        },
        symbolTypeBreakdown: {
          class: 1,
          function: 2
        }
      });
    });
  });

  describe('Progress Reporting', () => {
    it('should report progress during indexing', async () => {
      const rootPath = '/test/project';
      const progressUpdates: IndexingProgress[] = [];
      const onProgress = (progress: IndexingProgress) => {
        progressUpdates.push({ ...progress });
      };

      mockedFsStat
        .mockResolvedValueOnce({ isDirectory: () => true } as any)
        .mockResolvedValue({ size: 1024, mtime: new Date() } as any);

      mockedGlob.mockResolvedValue(['file1.ts', 'file2.ts']);
      mockedFsReadFile.mockResolvedValue('// test');

      const mockExtractor = {
        extractFromFile: vi.fn().mockResolvedValue({
          symbols: [],
          hasErrors: false,
          errors: []
        })
      };
      mockedGetExtractorForLanguage.mockReturnValue(mockExtractor as any);

      await indexer.indexDirectoryWithProgress(rootPath, {}, onProgress);

      expect(progressUpdates).toHaveLength(3); // 2 files + final update
      expect(progressUpdates[0]).toMatchObject({
        currentFile: expect.stringContaining('file1.ts'),
        filesProcessed: 0,
        totalFiles: 2,
        errors: []
      });
      expect(progressUpdates[1]).toMatchObject({
        currentFile: expect.stringContaining('file2.ts'),
        filesProcessed: 1,
        totalFiles: 2
      });
      expect(progressUpdates[2]).toMatchObject({
        currentFile: '',
        filesProcessed: 2,
        totalFiles: 2
      });
    });
  });

  describe('Concurrency Control', () => {
    it('should respect concurrency limits', async () => {
      const rootPath = '/test/project';
      const options: IndexingOptions = {
        concurrency: 2
      };

      mockedFsStat
        .mockResolvedValueOnce({ isDirectory: () => true } as any)
        .mockResolvedValue({ size: 1024, mtime: new Date() } as any);

      // Create 5 files to test batching
      mockedGlob.mockResolvedValue(['file1.ts', 'file2.ts', 'file3.ts', 'file4.ts', 'file5.ts']);
      mockedFsReadFile.mockResolvedValue('// test');

      let activeExtractions = 0;
      let maxConcurrentExtractions = 0;

      const mockExtractor = {
        extractFromFile: vi.fn().mockImplementation(() => {
          activeExtractions++;
          maxConcurrentExtractions = Math.max(maxConcurrentExtractions, activeExtractions);

          return new Promise(resolve => {
            setTimeout(() => {
              activeExtractions--;
              resolve({
                symbols: [],
                hasErrors: false,
                errors: []
              });
            }, 10);
          });
        })
      };
      mockedGetExtractorForLanguage.mockReturnValue(mockExtractor as any);

      await indexer.indexDirectory(rootPath, options);

      // Should never exceed concurrency limit of 2
      expect(maxConcurrentExtractions).toBeLessThanOrEqual(2);
      expect(mockExtractor.extractFromFile).toHaveBeenCalledTimes(5);
    });
  });

  describe('Configuration Options', () => {
    beforeEach(() => {
      mockedFsStat
        .mockResolvedValueOnce({ isDirectory: () => true } as any)
        .mockResolvedValue({ size: 1024, mtime: new Date() } as any);
      mockedGlob.mockResolvedValue(['test.ts']);
      mockedFsReadFile.mockResolvedValue('// test');
    });

    it('should pass extraction options to extractors', async () => {
      const rootPath = '/test/project';
      const options: IndexingOptions = {
        includeDocumentation: false,
        includeSignatures: false,
        maxSymbolDepth: 5
      };

      const mockExtractor = {
        extractFromFile: vi.fn().mockResolvedValue({
          symbols: [],
          hasErrors: false,
          errors: []
        })
      };
      mockedGetExtractorForLanguage.mockReturnValue(mockExtractor as any);

      await indexer.indexDirectory(rootPath, options);

      expect(mockExtractor.extractFromFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          includeDocumentation: false,
          includeSignatures: false,
          maxDepth: 5,
          includeImports: true
        })
      );
    });

    it('should include content hashes when requested', async () => {
      const rootPath = '/test/project';
      const options: IndexingOptions = {
        computeHashes: true
      };

      const mockExtractor = {
        extractFromFile: vi.fn().mockResolvedValue({
          symbols: [],
          hasErrors: false,
          errors: []
        })
      };
      mockedGetExtractorForLanguage.mockReturnValue(mockExtractor as any);

      const result = await indexer.indexDirectory(rootPath, options);

      expect(result.files[0].contentHash).toBe('mockedhash123');
      expect(crypto.createHash).toHaveBeenCalledWith('sha256');
    });

    it('should skip content hashes when not requested', async () => {
      const rootPath = '/test/project';
      const options: IndexingOptions = {
        computeHashes: false
      };

      const mockExtractor = {
        extractFromFile: vi.fn().mockResolvedValue({
          symbols: [],
          hasErrors: false,
          errors: []
        })
      };
      mockedGetExtractorForLanguage.mockReturnValue(mockExtractor as any);

      const result = await indexer.indexDirectory(rootPath, options);

      expect(result.files[0].contentHash).toBeUndefined();
      expect(crypto.createHash).not.toHaveBeenCalled();
    });
  });

  describe('Repository Map Structure', () => {
    it('should generate complete RepositoryMap with correct structure', async () => {
      const rootPath = '/test/myproject';

      mockedFsStat
        .mockResolvedValueOnce({ isDirectory: () => true } as any)
        .mockResolvedValue({ size: 1024, mtime: new Date('2024-01-15') } as any);

      mockedGlob.mockResolvedValue(['src/index.ts']);
      mockedFsReadFile.mockResolvedValue('export const version = "1.0.0";');

      const mockExtractor = {
        extractFromFile: vi.fn().mockResolvedValue({
          symbols: [
            {
              name: 'version',
              kind: SymbolKind.Constant,
              location: { start: { row: 0, column: 13 }, end: { row: 0, column: 30 } },
              exportKind: 'named'
            }
          ],
          hasErrors: false,
          errors: []
        })
      };
      mockedGetExtractorForLanguage.mockReturnValue(mockExtractor as any);

      const result = await indexer.indexDirectory(rootPath);

      // Validate complete structure
      expect(result).toMatchObject({
        rootPath: path.resolve(rootPath),
        name: 'myproject',
        files: expect.any(Array),
        references: [],
        stats: expect.objectContaining({
          totalFiles: expect.any(Number),
          totalSymbols: expect.any(Number),
          totalReferences: 0,
          totalLines: expect.any(Number),
          languageBreakdown: expect.any(Object),
          symbolTypeBreakdown: expect.any(Object)
        }),
        createdAt: expect.any(Date),
        version: '1.0.0',
        config: expect.objectContaining({
          includePatterns: expect.any(Array),
          excludePatterns: expect.any(Array),
          languages: expect.any(Array),
          maxFileSize: expect.any(Number)
        }),
        errors: expect.any(Array)
      });

      // Validate schema compliance
      expect(typeof result.rootPath).toBe('string');
      expect(result.rootPath.length).toBeGreaterThan(0);
      expect(Array.isArray(result.files)).toBe(true);
      expect(Array.isArray(result.references)).toBe(true);
      expect(result.createdAt instanceof Date).toBe(true);
    });
  });
});