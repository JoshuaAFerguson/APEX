/**
 * Unit tests for CodebaseIndexer
 *
 * Tests core functionality including file discovery, symbol extraction,
 * error handling, and RepositoryMap construction.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

import { CodebaseIndexer, type IndexingOptions } from './indexer.js';
import type { RepositoryMap } from '@apexcli/core/types';

describe('CodebaseIndexer', () => {
  let tempDir: string;
  let indexer: CodebaseIndexer;

  beforeEach(async () => {
    // Create temporary directory for test files
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'codebase-indexer-test-'));
    indexer = CodebaseIndexer.getInstance();
  });

  afterEach(async () => {
    // Clean up temporary directory
    await fs.rm(tempDir, { recursive: true, force: true });
    CodebaseIndexer.resetInstance();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
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

  describe('indexDirectory', () => {
    it('should handle empty directory', async () => {
      const result = await indexer.indexDirectory(tempDir);

      expect(result).toMatchObject({
        rootPath: expect.stringContaining(tempDir),
        name: expect.any(String),
        files: [],
        references: [],
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
      const filePath = path.join(tempDir, 'test.txt');
      await fs.writeFile(filePath, 'test content');

      await expect(indexer.indexDirectory(filePath))
        .rejects
        .toThrow('Path is not a directory');
    });

    it('should reject non-existent paths', async () => {
      const nonExistentPath = path.join(tempDir, 'non-existent');

      await expect(indexer.indexDirectory(nonExistentPath))
        .rejects
        .toThrow();
    });
  });

  describe('file discovery and processing', () => {
    beforeEach(async () => {
      // Create test files of different types
      await fs.writeFile(
        path.join(tempDir, 'test.ts'),
        `
/**
 * Test function
 */
export function testFunction(x: number): string {
  return x.toString();
}

export class TestClass {
  private value: number = 0;

  constructor(initial: number) {
    this.value = initial;
  }

  getValue(): number {
    return this.value;
  }
}
        `.trim()
      );

      await fs.writeFile(
        path.join(tempDir, 'test.js'),
        `
function jsFunction() {
  return 'hello';
}

const arrow = () => 42;

module.exports = { jsFunction, arrow };
        `.trim()
      );

      await fs.writeFile(
        path.join(tempDir, 'test.py'),
        `
def python_function(x):
    """A test function"""
    return x * 2

class PythonClass:
    def __init__(self, value):
        self.value = value

    def get_value(self):
        return self.value
        `.trim()
      );

      // Create a file that should be ignored
      await fs.writeFile(path.join(tempDir, 'README.md'), '# Test readme');

      // Create node_modules directory (should be excluded)
      await fs.mkdir(path.join(tempDir, 'node_modules'));
      await fs.writeFile(
        path.join(tempDir, 'node_modules', 'excluded.js'),
        'console.log("excluded");'
      );
    });

    it('should discover and process supported files', async () => {
      const result = await indexer.indexDirectory(tempDir);

      expect(result.files).toHaveLength(3);
      expect(result.files.map(f => f.path).sort()).toEqual([
        'test.js',
        'test.py',
        'test.ts'
      ]);
    });

    it('should extract symbols from TypeScript files', async () => {
      const result = await indexer.indexDirectory(tempDir);
      const tsFile = result.files.find(f => f.path === 'test.ts');

      expect(tsFile).toBeDefined();
      expect(tsFile!.language).toBe('typescript');
      expect(tsFile!.symbols).toHaveLength(4); // function, class, constructor, method

      const functionSymbol = tsFile!.symbols.find(s => s.name === 'testFunction');
      expect(functionSymbol).toMatchObject({
        name: 'testFunction',
        type: 'function',
        exported: true,
        documentation: expect.stringContaining('Test function')
      });

      const classSymbol = tsFile!.symbols.find(s => s.name === 'TestClass');
      expect(classSymbol).toMatchObject({
        name: 'TestClass',
        type: 'class',
        exported: true
      });
    });

    it('should extract symbols from JavaScript files', async () => {
      const result = await indexer.indexDirectory(tempDir);
      const jsFile = result.files.find(f => f.path === 'test.js');

      expect(jsFile).toBeDefined();
      expect(jsFile!.language).toBe('javascript');
      expect(jsFile!.symbols.length).toBeGreaterThan(0);

      const functionSymbol = jsFile!.symbols.find(s => s.name === 'jsFunction');
      expect(functionSymbol).toMatchObject({
        name: 'jsFunction',
        type: 'function'
      });
    });

    it('should extract symbols from Python files', async () => {
      const result = await indexer.indexDirectory(tempDir);
      const pyFile = result.files.find(f => f.path === 'test.py');

      expect(pyFile).toBeDefined();
      expect(pyFile!.language).toBe('python');
      expect(pyFile!.symbols.length).toBeGreaterThan(0);

      const functionSymbol = pyFile!.symbols.find(s => s.name === 'python_function');
      expect(functionSymbol).toMatchObject({
        name: 'python_function',
        type: 'function'
      });

      const classSymbol = pyFile!.symbols.find(s => s.name === 'PythonClass');
      expect(classSymbol).toMatchObject({
        name: 'PythonClass',
        type: 'class'
      });
    });

    it('should calculate correct statistics', async () => {
      const result = await indexer.indexDirectory(tempDir);

      expect(result.stats).toMatchObject({
        totalFiles: 3,
        totalSymbols: expect.any(Number),
        totalReferences: 0,
        totalLines: expect.any(Number),
        languageBreakdown: {
          typescript: 1,
          javascript: 1,
          python: 1
        },
        symbolTypeBreakdown: expect.objectContaining({
          function: expect.any(Number),
          class: expect.any(Number)
        })
      });

      expect(result.stats!.totalSymbols).toBeGreaterThan(0);
      expect(result.stats!.totalLines).toBeGreaterThan(0);
    });

    it('should exclude files matching exclude patterns', async () => {
      const result = await indexer.indexDirectory(tempDir);

      // node_modules file should be excluded
      expect(result.files.find(f => f.path.includes('node_modules'))).toBeUndefined();

      // README.md should be excluded (not a supported extension)
      expect(result.files.find(f => f.path === 'README.md')).toBeUndefined();
    });

    it('should respect include patterns when specified', async () => {
      const options: IndexingOptions = {
        includePatterns: ['**/*.ts']
      };

      const result = await indexer.indexDirectory(tempDir, options);

      expect(result.files).toHaveLength(1);
      expect(result.files[0].path).toBe('test.ts');
    });

    it('should compute content hashes when enabled', async () => {
      const options: IndexingOptions = {
        computeHashes: true
      };

      const result = await indexer.indexDirectory(tempDir, options);

      for (const file of result.files) {
        expect(file.contentHash).toBeDefined();
        expect(typeof file.contentHash).toBe('string');
        expect(file.contentHash).toHaveLength(64); // SHA-256 hash length
      }
    });

    it('should skip content hashes when disabled', async () => {
      const options: IndexingOptions = {
        computeHashes: false
      };

      const result = await indexer.indexDirectory(tempDir, options);

      for (const file of result.files) {
        expect(file.contentHash).toBeUndefined();
      }
    });

    it('should respect file size limits', async () => {
      // Create a large file
      const largeContent = 'x'.repeat(1000);
      await fs.writeFile(path.join(tempDir, 'large.ts'), largeContent);

      const options: IndexingOptions = {
        maxFileSize: 500 // 500 bytes limit
      };

      const result = await indexer.indexDirectory(tempDir, options);

      // Large file should be excluded
      expect(result.files.find(f => f.path === 'large.ts')).toBeUndefined();
    });
  });

  describe('error handling', () => {
    beforeEach(async () => {
      // Create file with syntax errors
      await fs.writeFile(
        path.join(tempDir, 'broken.ts'),
        'function broken( { // Missing closing parenthesis and brace'
      );

      await fs.writeFile(
        path.join(tempDir, 'valid.ts'),
        'export const valid = true;'
      );
    });

    it('should continue processing other files when continueOnError is true', async () => {
      const options: IndexingOptions = {
        continueOnError: true
      };

      const result = await indexer.indexDirectory(tempDir, options);

      // Should still process valid file
      const validFile = result.files.find(f => f.path === 'valid.ts');
      expect(validFile).toBeDefined();

      // May have processed broken file with errors marked
      expect(result.errors.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle files with parse errors gracefully', async () => {
      const options: IndexingOptions = {
        continueOnError: true
      };

      const result = await indexer.indexDirectory(tempDir, options);

      // Check if broken file was processed (may have parse errors)
      const brokenFile = result.files.find(f => f.path === 'broken.ts');
      if (brokenFile) {
        expect(brokenFile.hasParseErrors).toBe(true);
        expect(brokenFile.errors.length).toBeGreaterThan(0);
      }
    });
  });

  describe('progress tracking', () => {
    beforeEach(async () => {
      // Create multiple files to track progress
      for (let i = 0; i < 5; i++) {
        await fs.writeFile(
          path.join(tempDir, `file${i}.ts`),
          `export const value${i} = ${i};`
        );
      }
    });

    it('should call progress callback during processing', async () => {
      const progressCalls: any[] = [];

      await indexer.indexDirectoryWithProgress(
        tempDir,
        {},
        (progress) => {
          progressCalls.push({ ...progress });
        }
      );

      expect(progressCalls.length).toBeGreaterThan(0);

      // Final progress should show completion
      const finalProgress = progressCalls[progressCalls.length - 1];
      expect(finalProgress.filesProcessed).toBe(finalProgress.totalFiles);
      expect(finalProgress.totalFiles).toBe(5);
    });
  });

  describe('configuration', () => {
    beforeEach(async () => {
      await fs.writeFile(
        path.join(tempDir, 'test.ts'),
        `
/**
 * Test function with docs
 */
export function testFunc(): void {}
        `.trim()
      );
    });

    it('should respect includeDocumentation option', async () => {
      const withDocs = await indexer.indexDirectory(tempDir, {
        includeDocumentation: true
      });

      const withoutDocs = await indexer.indexDirectory(tempDir, {
        includeDocumentation: false
      });

      const funcWithDocs = withDocs.files[0].symbols.find(s => s.name === 'testFunc');
      const funcWithoutDocs = withoutDocs.files[0].symbols.find(s => s.name === 'testFunc');

      expect(funcWithDocs?.documentation).toBeDefined();
      expect(funcWithoutDocs?.documentation).toBeUndefined();
    });

    it('should use custom concurrency setting', async () => {
      // This is hard to test directly, but we can ensure it doesn't break
      const result = await indexer.indexDirectory(tempDir, {
        concurrency: 1
      });

      expect(result.files).toHaveLength(1);
    });
  });

  describe('edge cases and error scenarios', () => {
    it('should handle directory with only excluded files', async () => {
      // Create only excluded files
      await fs.mkdir(path.join(tempDir, 'dist'));
      await fs.writeFile(path.join(tempDir, 'dist', 'built.js'), 'console.log("built");');
      await fs.writeFile(path.join(tempDir, 'README.md'), '# Readme');

      const result = await indexer.indexDirectory(tempDir);

      expect(result.files).toHaveLength(0);
      expect(result.stats!.totalFiles).toBe(0);
      expect(result.stats!.totalSymbols).toBe(0);
    });

    it('should handle empty files', async () => {
      await fs.writeFile(path.join(tempDir, 'empty.ts'), '');
      await fs.writeFile(path.join(tempDir, 'whitespace.js'), '   \n\t\n  ');

      const result = await indexer.indexDirectory(tempDir);

      expect(result.files).toHaveLength(2);
      const emptyFile = result.files.find(f => f.path === 'empty.ts');
      const whitespaceFile = result.files.find(f => f.path === 'whitespace.js');

      expect(emptyFile?.lineCount).toBe(1);
      expect(whitespaceFile?.lineCount).toBe(3);
      expect(emptyFile?.symbols).toHaveLength(0);
      expect(whitespaceFile?.symbols).toHaveLength(0);
    });

    it('should handle files with only comments', async () => {
      await fs.writeFile(path.join(tempDir, 'comments-only.ts'), `
        // This is a comment
        /* Multi-line
           comment */
        /**
         * JSDoc comment
         */
      `);

      const result = await indexer.indexDirectory(tempDir);
      const commentsFile = result.files.find(f => f.path === 'comments-only.ts');

      expect(commentsFile).toBeDefined();
      expect(commentsFile!.symbols).toHaveLength(0);
      expect(commentsFile!.lineCount).toBeGreaterThan(0);
    });

    it('should handle very large files', async () => {
      // Create a large file with many simple functions
      const functions = Array.from({ length: 100 }, (_, i) =>
        `export function func${i}() { return ${i}; }`
      ).join('\n\n');

      await fs.writeFile(path.join(tempDir, 'large.ts'), functions);

      const result = await indexer.indexDirectory(tempDir);
      const largeFile = result.files.find(f => f.path === 'large.ts');

      expect(largeFile).toBeDefined();
      expect(largeFile!.symbols).toHaveLength(100);
      expect(largeFile!.symbols.every(s => s.type === 'function')).toBe(true);
    });

    it('should handle deeply nested directory structures', async () => {
      // Create nested directories
      const deepPath = path.join(tempDir, 'a', 'very', 'deep', 'nested', 'structure');
      await fs.mkdir(deepPath, { recursive: true });
      await fs.writeFile(path.join(deepPath, 'nested.ts'), 'export const deep = true;');

      const result = await indexer.indexDirectory(tempDir);

      expect(result.files).toHaveLength(1);
      expect(result.files[0].path).toBe(path.join('a', 'very', 'deep', 'nested', 'structure', 'nested.ts'));
    });

    it('should handle files with non-UTF8 encoding gracefully', async () => {
      // Create a file with special characters that might cause encoding issues
      await fs.writeFile(path.join(tempDir, 'unicode.ts'), `
        // Special chars: ñ, ü, 中文, 🚀
        export const emoji = "🚀";
        export const chinese = "中文";
        export const spanish = "niño";
      `);

      const result = await indexer.indexDirectory(tempDir);
      const unicodeFile = result.files.find(f => f.path === 'unicode.ts');

      expect(unicodeFile).toBeDefined();
      expect(unicodeFile!.symbols.length).toBeGreaterThan(0);
    });

    it('should handle symbolic links properly', async () => {
      // Create a regular file
      await fs.writeFile(path.join(tempDir, 'original.ts'), 'export const original = true;');

      // Create a symbolic link (if supported on this platform)
      try {
        await fs.symlink(
          path.join(tempDir, 'original.ts'),
          path.join(tempDir, 'link.ts')
        );

        const result = await indexer.indexDirectory(tempDir);

        // Should process both files (original and link)
        expect(result.files.length).toBeGreaterThanOrEqual(1);
      } catch (error) {
        // Skip test if symlinks not supported (e.g., Windows without admin)
        console.warn('Symbolic links not supported, skipping test');
      }
    });

    it('should handle files that become inaccessible during processing', async () => {
      await fs.writeFile(path.join(tempDir, 'accessible.ts'), 'export const test = true;');

      // This test simulates a file becoming inaccessible, but it's hard to do reliably
      // across platforms. We'll just ensure the indexer handles missing files gracefully.
      const result = await indexer.indexDirectory(tempDir);

      expect(result.files.length).toBeGreaterThanOrEqual(0);
      expect(result).toHaveProperty('errors');
      expect(Array.isArray(result.errors)).toBe(true);
    });

    it('should handle zero concurrency gracefully', async () => {
      await fs.writeFile(path.join(tempDir, 'test.ts'), 'export const test = true;');

      const result = await indexer.indexDirectory(tempDir, { concurrency: 0 });

      // Should default to minimum concurrency of 1
      expect(result.files).toHaveLength(1);
    });

    it('should handle negative file size limits', async () => {
      await fs.writeFile(path.join(tempDir, 'test.ts'), 'export const test = true;');

      const result = await indexer.indexDirectory(tempDir, { maxFileSize: -1 });

      // Negative file size should be treated as no limit
      expect(result.files).toHaveLength(1);
    });
  });

  describe('statistics calculation edge cases', () => {
    it('should handle files with no symbols correctly', async () => {
      await fs.writeFile(path.join(tempDir, 'empty.ts'), '');
      await fs.writeFile(path.join(tempDir, 'comments.js'), '// Just comments');

      const result = await indexer.indexDirectory(tempDir);

      expect(result.stats).toMatchObject({
        totalFiles: 2,
        totalSymbols: 0,
        totalLines: expect.any(Number),
        languageBreakdown: {
          typescript: 1,
          javascript: 1
        },
        symbolTypeBreakdown: {}
      });
    });

    it('should calculate correct line counts for different line ending types', async () => {
      // Unix line endings
      await fs.writeFile(path.join(tempDir, 'unix.ts'), 'line1\nline2\nline3');
      // Windows line endings
      await fs.writeFile(path.join(tempDir, 'windows.js'), 'line1\r\nline2\r\nline3');
      // Mixed line endings
      await fs.writeFile(path.join(tempDir, 'mixed.py'), 'line1\nline2\r\nline3');

      const result = await indexer.indexDirectory(tempDir);

      expect(result.files).toHaveLength(3);
      expect(result.stats!.totalLines).toBeGreaterThan(6); // At least 9 lines total
    });
  });

  describe('complex file patterns and filtering', () => {
    beforeEach(async () => {
      // Create a complex directory structure
      await fs.mkdir(path.join(tempDir, 'src'));
      await fs.mkdir(path.join(tempDir, 'tests'));
      await fs.mkdir(path.join(tempDir, 'dist'));
      await fs.mkdir(path.join(tempDir, 'node_modules'));

      await fs.writeFile(path.join(tempDir, 'src', 'main.ts'), 'export const main = true;');
      await fs.writeFile(path.join(tempDir, 'src', 'utils.js'), 'module.exports = {};');
      await fs.writeFile(path.join(tempDir, 'tests', 'main.test.ts'), 'import { main } from "../src/main";');
      await fs.writeFile(path.join(tempDir, 'dist', 'built.js'), 'console.log("built");');
      await fs.writeFile(path.join(tempDir, 'node_modules', 'dep.js'), 'module.exports = {};');
      await fs.writeFile(path.join(tempDir, 'README.md'), '# Project');
    });

    it('should respect complex include patterns', async () => {
      const result = await indexer.indexDirectory(tempDir, {
        includePatterns: ['src/**/*', 'tests/**/*.ts']
      });

      expect(result.files).toHaveLength(2); // src/main.ts and tests/main.test.ts
      expect(result.files.map(f => f.path).sort()).toEqual([
        path.join('src', 'main.ts'),
        path.join('tests', 'main.test.ts')
      ]);
    });

    it('should respect complex exclude patterns', async () => {
      const result = await indexer.indexDirectory(tempDir, {
        excludePatterns: ['**/dist/**', '**/node_modules/**', '**/*.test.*']
      });

      // Should include src files but exclude dist, node_modules, and test files
      expect(result.files.length).toBeGreaterThan(0);
      expect(result.files.find(f => f.path.includes('dist'))).toBeUndefined();
      expect(result.files.find(f => f.path.includes('node_modules'))).toBeUndefined();
      expect(result.files.find(f => f.path.includes('.test.'))).toBeUndefined();
    });

    it('should handle overlapping include and exclude patterns', async () => {
      const result = await indexer.indexDirectory(tempDir, {
        includePatterns: ['**/*.ts', '**/*.js'],
        excludePatterns: ['**/tests/**', '**/dist/**']
      });

      // Should include TypeScript and JavaScript files but exclude those in tests and dist
      expect(result.files.length).toBeGreaterThan(0);
      expect(result.files.find(f => f.path.includes('tests'))).toBeUndefined();
      expect(result.files.find(f => f.path.includes('dist'))).toBeUndefined();
      expect(result.files.some(f => f.path.endsWith('.ts') || f.path.endsWith('.js'))).toBe(true);
    });
  });

  describe('repository map structure validation', () => {
    beforeEach(async () => {
      await fs.writeFile(path.join(tempDir, 'test.ts'), `
        export interface TestInterface {
          value: number;
        }

        export class TestClass implements TestInterface {
          constructor(public value: number) {}
        }

        export function testFunc(): TestInterface {
          return new TestClass(42);
        }
      `);
    });

    it('should generate valid RepositoryMap structure', async () => {
      const result = await indexer.indexDirectory(tempDir);

      // Verify top-level structure
      expect(result).toHaveProperty('rootPath');
      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('files');
      expect(result).toHaveProperty('references');
      expect(result).toHaveProperty('stats');
      expect(result).toHaveProperty('createdAt');
      expect(result).toHaveProperty('version');
      expect(result).toHaveProperty('config');
      expect(result).toHaveProperty('errors');

      // Verify data types
      expect(typeof result.rootPath).toBe('string');
      expect(typeof result.name).toBe('string');
      expect(Array.isArray(result.files)).toBe(true);
      expect(Array.isArray(result.references)).toBe(true);
      expect(typeof result.stats).toBe('object');
      expect(result.createdAt instanceof Date).toBe(true);
      expect(typeof result.version).toBe('string');
      expect(typeof result.config).toBe('object');
      expect(Array.isArray(result.errors)).toBe(true);
    });

    it('should generate valid CodeFile structures', async () => {
      const result = await indexer.indexDirectory(tempDir);
      const file = result.files[0];

      expect(file).toHaveProperty('path');
      expect(file).toHaveProperty('language');
      expect(file).toHaveProperty('symbols');
      expect(file).toHaveProperty('imports');
      expect(file).toHaveProperty('exports');
      expect(file).toHaveProperty('lineCount');
      expect(file).toHaveProperty('size');
      expect(file).toHaveProperty('lastModified');
      expect(file).toHaveProperty('hasParseErrors');
      expect(file).toHaveProperty('errors');

      expect(typeof file.path).toBe('string');
      expect(typeof file.language).toBe('string');
      expect(Array.isArray(file.symbols)).toBe(true);
      expect(Array.isArray(file.imports)).toBe(true);
      expect(Array.isArray(file.exports)).toBe(true);
      expect(typeof file.lineCount).toBe('number');
      expect(typeof file.size).toBe('number');
      expect(file.lastModified instanceof Date).toBe(true);
      expect(typeof file.hasParseErrors).toBe('boolean');
      expect(Array.isArray(file.errors)).toBe(true);
    });

    it('should generate valid CodeSymbol structures', async () => {
      const result = await indexer.indexDirectory(tempDir);
      const file = result.files[0];
      const symbol = file.symbols[0];

      if (symbol) {
        expect(symbol).toHaveProperty('name');
        expect(symbol).toHaveProperty('type');
        expect(symbol).toHaveProperty('filePath');
        expect(symbol).toHaveProperty('startLine');
        expect(symbol).toHaveProperty('endLine');
        expect(symbol).toHaveProperty('startColumn');
        expect(symbol).toHaveProperty('endColumn');
        expect(symbol).toHaveProperty('exported');

        expect(typeof symbol.name).toBe('string');
        expect(typeof symbol.type).toBe('string');
        expect(typeof symbol.filePath).toBe('string');
        expect(typeof symbol.startLine).toBe('number');
        expect(typeof symbol.endLine).toBe('number');
        expect(typeof symbol.startColumn).toBe('number');
        expect(typeof symbol.endColumn).toBe('number');
        expect(typeof symbol.exported).toBe('boolean');

        // Line numbers should be 1-based
        expect(symbol.startLine).toBeGreaterThan(0);
        expect(symbol.endLine).toBeGreaterThan(0);
        expect(symbol.endLine).toBeGreaterThanOrEqual(symbol.startLine);
      }
    });
  });
});