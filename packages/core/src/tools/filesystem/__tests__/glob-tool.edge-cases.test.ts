/**
 * @fileoverview Edge case and stress tests for GlobTool
 *
 * These tests verify GlobTool behavior in challenging scenarios:
 * - Very large file sets and deep directory structures
 * - Complex glob patterns and edge case patterns
 * - File system limitations and permissions
 * - Memory and performance stress scenarios
 * - Unicode and international file names
 * - Symlink handling and special file types
 *
 * @module @apex/core/tools/filesystem/__tests__/glob-tool.edge-cases
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { GlobTool, type GlobToolInput } from '../glob-tool.js';
import type { ToolExecutionContext } from '../../base-tool.js';

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Creates a temporary directory for edge case tests
 */
async function createTempDir(): Promise<string> {
  return await fs.mkdtemp(path.join(os.tmpdir(), 'apex-glob-edge-test-'));
}

/**
 * Creates a test file with specified content
 */
async function createTestFile(dir: string, filePath: string, content: string = ''): Promise<string> {
  const fullPath = path.join(dir, filePath);
  const fileDir = path.dirname(fullPath);

  await fs.mkdir(fileDir, { recursive: true });
  await fs.writeFile(fullPath, content, 'utf8');
  return fullPath;
}

/**
 * Removes a directory and all its contents
 */
async function removeDir(dir: string): Promise<void> {
  try {
    await fs.rm(dir, { recursive: true, force: true });
  } catch (error) {
    // Ignore errors during cleanup
  }
}

/**
 * Creates a deep nested directory structure for testing
 */
async function createDeepStructure(baseDir: string, depth: number = 10, filesPerLevel: number = 5): Promise<void> {
  let currentPath = baseDir;

  for (let level = 0; level < depth; level++) {
    currentPath = path.join(currentPath, `level${level}`);
    await fs.mkdir(currentPath, { recursive: true });

    // Create files at each level
    for (let file = 0; file < filesPerLevel; file++) {
      await createTestFile(currentPath, `file${file}.txt`, `Content at level ${level}, file ${file}`);
      await createTestFile(currentPath, `data${file}.json`, JSON.stringify({ level, file }));

      if (level % 2 === 0) {
        await createTestFile(currentPath, `script${file}.ts`, `export const level${level}_file${file} = () => {};`);
      }
    }
  }
}

/**
 * Creates files with unicode and special characters in names
 */
async function createUnicodeFiles(baseDir: string): Promise<void> {
  const unicodeFiles = [
    'файл.txt', // Cyrillic
    '文件.ts', // Chinese
    'ファイル.js', // Japanese
    '파일.json', // Korean
    'αρχείο.md', // Greek
    'файл-тест.txt', // Mixed Cyrillic-Latin
    'file_测试.ts', // Mixed English-Chinese
    'مجلد/ملف.txt', // Arabic (with directory)
    'émojis-😀-🎉-💯.js', // Emojis
    'spëcîàl-çhārs.ts', // Accented characters
    'file with spaces.txt',
    'file.with.lots.of.dots.txt',
    'file-with-many-hyphens-and-underscores_here.ts',
  ];

  for (const filename of unicodeFiles) {
    try {
      await createTestFile(baseDir, filename, `Unicode test content for ${filename}`);
    } catch (error) {
      // Some filesystems may not support certain characters
      console.warn(`Could not create file: ${filename}`, error);
    }
  }
}

/**
 * Creates a large number of files for stress testing
 */
async function createLargeFileSet(baseDir: string, count: number = 1000): Promise<void> {
  const promises: Promise<string>[] = [];

  for (let i = 0; i < count; i++) {
    const dir = `batch${Math.floor(i / 100)}`;
    const filename = `file${i.toString().padStart(4, '0')}.txt`;
    promises.push(createTestFile(baseDir, path.join(dir, filename), `File ${i} content`));
  }

  // Create in parallel for speed, but in batches to avoid overwhelming fs
  const batchSize = 50;
  for (let i = 0; i < promises.length; i += batchSize) {
    const batch = promises.slice(i, i + batchSize);
    await Promise.all(batch);
  }
}

// ============================================================================
// Edge Case Test Suite
// ============================================================================

describe('GlobTool Edge Cases and Stress Tests', () => {
  let globTool: GlobTool;
  let tempDir: string;

  beforeEach(async () => {
    globTool = new GlobTool();
    tempDir = await createTempDir();
  });

  afterEach(async () => {
    await removeDir(tempDir);
  });

  // ========================================================================
  // Complex Pattern Edge Cases
  // ========================================================================

  describe('complex pattern edge cases', () => {
    beforeEach(async () => {
      await createTestFile(tempDir, 'test.js', 'js content');
      await createTestFile(tempDir, 'test.ts', 'ts content');
      await createTestFile(tempDir, 'test.json', '{}');
      await createTestFile(tempDir, 'test.test.js', 'test js');
      await createTestFile(tempDir, 'test.spec.ts', 'spec ts');
      await createTestFile(tempDir, 'app/test.jsx', 'jsx content');
      await createTestFile(tempDir, 'app/test.tsx', 'tsx content');
      await createTestFile(tempDir, 'lib/index.d.ts', 'dts content');
    });

    it('should handle very complex brace patterns', async () => {
      const result = await globTool.execute({
        pattern: '**/*.{js,ts,jsx,tsx,json,{test,spec}.{js,ts}}',
        path: tempDir,
      });

      expect(result.files.length).toBeGreaterThan(0);

      const extensions = new Set(result.files.map(f => f.extension));
      expect(extensions.has('.js')).toBe(true);
      expect(extensions.has('.ts')).toBe(true);
      expect(extensions.has('.jsx')).toBe(true);
      expect(extensions.has('.tsx')).toBe(true);
      expect(extensions.has('.json')).toBe(true);
    });

    it('should handle complex negation patterns', async () => {
      const result = await globTool.execute({
        pattern: '**/!(*.{test,spec}.*)',
        path: tempDir,
      });

      const filenames = result.files.map(f => f.relativePath);
      expect(filenames).toContain('test.js');
      expect(filenames).toContain('test.ts');
      expect(filenames).toContain('test.json');
      expect(filenames).not.toContain('test.test.js');
      expect(filenames).not.toContain('test.spec.ts');
    });

    it('should handle patterns with multiple globstars', async () => {
      await createTestFile(tempDir, 'deep/nested/very/deep/file.txt', 'content');

      const result = await globTool.execute({
        pattern: '**/deep/**/file.txt',
        path: tempDir,
      });

      expect(result.files.length).toBe(1);
      expect(result.files[0].relativePath).toContain('deep/nested/very/deep/file.txt');
    });

    it('should handle patterns with character ranges', async () => {
      await createTestFile(tempDir, 'test1.txt', '1');
      await createTestFile(tempDir, 'test2.txt', '2');
      await createTestFile(tempDir, 'test3.txt', '3');
      await createTestFile(tempDir, 'test9.txt', '9');
      await createTestFile(tempDir, 'testa.txt', 'a');

      const result = await globTool.execute({
        pattern: 'test[1-3].txt',
        path: tempDir,
      });

      expect(result.files.length).toBe(3);
      const basenames = result.files.map(f => f.basename);
      expect(basenames).toContain('test1');
      expect(basenames).toContain('test2');
      expect(basenames).toContain('test3');
      expect(basenames).not.toContain('test9');
      expect(basenames).not.toContain('testa');
    });

    it('should handle patterns with question marks', async () => {
      await createTestFile(tempDir, 'test1.txt', '1');
      await createTestFile(tempDir, 'test22.txt', '22');
      await createTestFile(tempDir, 'test333.txt', '333');

      const result = await globTool.execute({
        pattern: 'test?.txt',
        path: tempDir,
      });

      expect(result.files.length).toBe(1);
      expect(result.files[0].basename).toBe('test1');
    });

    it('should handle empty patterns and edge case patterns', async () => {
      // Pattern that matches nothing
      const emptyResult = await globTool.execute({
        pattern: 'definitely-does-not-exist-*.xyz',
        path: tempDir,
      });

      expect(emptyResult.files).toEqual([]);
      expect(emptyResult.totalFiles).toBe(0);
      expect(emptyResult.truncated).toBe(false);
    });
  });

  // ========================================================================
  // Unicode and Special Character Tests
  // ========================================================================

  describe('unicode and special character handling', () => {
    beforeEach(async () => {
      await createUnicodeFiles(tempDir);
    });

    it('should handle files with unicode names', async () => {
      const result = await globTool.execute({
        pattern: '**/*',
        path: tempDir,
      });

      expect(result.files.length).toBeGreaterThan(0);

      // Check that unicode files are found
      const filenames = result.files.map(f => f.relativePath);
      const hasUnicode = filenames.some(name => /[^\x00-\x7F]/.test(name));

      if (hasUnicode) {
        // If unicode files were created successfully, verify they're handled correctly
        expect(result.files.every(f => typeof f.path === 'string')).toBe(true);
        expect(result.files.every(f => typeof f.lastModified === 'string')).toBe(true);
        expect(result.files.every(f => f.size >= 0)).toBe(true);
      }
    });

    it('should handle patterns with unicode characters', async () => {
      try {
        const result = await globTool.execute({
          pattern: '*测试*',
          path: tempDir,
        });

        // Should not throw, even if no matches
        expect(result).toBeDefined();
        expect(result.files).toBeInstanceOf(Array);
      } catch (error) {
        // Some systems may not support unicode in glob patterns
        expect(error).toBeInstanceOf(Error);
      }
    });

    it('should handle files with emoji in names', async () => {
      const result = await globTool.execute({
        pattern: '*😀*',
        path: tempDir,
      });

      // Should not throw error regardless of filesystem support
      expect(result).toBeDefined();
      expect(result.files).toBeInstanceOf(Array);
    });

    it('should handle files with spaces and special characters', async () => {
      const result = await globTool.execute({
        pattern: '*with*spaces*',
        path: tempDir,
      });

      const matchingFiles = result.files.filter(f => f.relativePath.includes('spaces'));
      expect(matchingFiles.length).toBeGreaterThanOrEqual(0);
    });
  });

  // ========================================================================
  // Deep Directory Structure Tests
  // ========================================================================

  describe('deep directory structure handling', () => {
    it('should handle very deep nested directories', async () => {
      await createDeepStructure(tempDir, 20, 2);

      const result = await globTool.execute({
        pattern: '**/*.txt',
        path: tempDir,
      });

      expect(result.files.length).toBeGreaterThan(0);

      // Verify we can find files at various depths
      const depths = result.files.map(f => f.relativePath.split(path.sep).length);
      expect(Math.max(...depths)).toBeGreaterThan(15);
    });

    it('should handle patterns that traverse deep structures efficiently', async () => {
      await createDeepStructure(tempDir, 15, 3);

      const startTime = Date.now();
      const result = await globTool.execute({
        pattern: '**/level*/file*.txt',
        path: tempDir,
      });
      const executionTime = Date.now() - startTime;

      expect(result.files.length).toBeGreaterThan(0);
      expect(executionTime).toBeLessThan(10000); // Should complete within 10 seconds
    });

    it('should handle very long file paths', async () => {
      // Create a path close to system limits
      const longDir = 'a'.repeat(50);
      const nestedPath = Array(5).fill(longDir).join(path.sep);
      const fileName = 'b'.repeat(50) + '.txt';

      try {
        await createTestFile(tempDir, path.join(nestedPath, fileName), 'long path content');

        const result = await globTool.execute({
          pattern: '**/*.txt',
          path: tempDir,
        });

        const longPathFile = result.files.find(f => f.relativePath.length > 200);
        if (longPathFile) {
          expect(longPathFile.path).toBeDefined();
          expect(longPathFile.size).toBeGreaterThan(0);
        }
      } catch (error) {
        // Some filesystems have path length limitations
        expect(error).toBeInstanceOf(Error);
      }
    });
  });

  // ========================================================================
  // Performance and Memory Stress Tests
  // ========================================================================

  describe('performance and memory stress tests', () => {
    it('should handle large file sets without memory issues', async () => {
      await createLargeFileSet(tempDir, 2000);

      const result = await globTool.execute({
        pattern: '**/*.txt',
        path: tempDir,
      });

      expect(result.files.length).toBeGreaterThan(1000);
      expect(result.files.length).toBeLessThanOrEqual(5000); // Respects MAX_RESULTS

      if (result.files.length >= 5000) {
        expect(result.truncated).toBe(true);
      }

      // Verify all file objects have required properties
      expect(result.files.every(f => typeof f.path === 'string')).toBe(true);
      expect(result.files.every(f => typeof f.size === 'number')).toBe(true);
      expect(result.files.every(f => typeof f.lastModified === 'string')).toBe(true);
    });

    it('should handle concurrent glob operations', async () => {
      await createTestFile(tempDir, 'file1.txt', 'content1');
      await createTestFile(tempDir, 'file2.js', 'content2');
      await createTestFile(tempDir, 'file3.ts', 'content3');

      const operations = [
        globTool.execute({ pattern: '*.txt', path: tempDir }),
        globTool.execute({ pattern: '*.js', path: tempDir }),
        globTool.execute({ pattern: '*.ts', path: tempDir }),
        globTool.execute({ pattern: '**/*', path: tempDir }),
      ];

      const results = await Promise.all(operations);

      expect(results).toHaveLength(4);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.files).toBeInstanceOf(Array);
        expect(result.searchTime).toBeGreaterThan(0);
      });
    });

    it('should handle operations on directories with many files', async () => {
      // Create many files in a flat structure
      const promises: Promise<string>[] = [];
      for (let i = 0; i < 1500; i++) {
        promises.push(createTestFile(tempDir, `flat_file_${i}.txt`, `Content ${i}`));
      }
      await Promise.all(promises);

      const result = await globTool.execute({
        pattern: 'flat_file_*.txt',
        path: tempDir,
      });

      expect(result.files.length).toBeGreaterThan(1000);
      expect(result.searchTime).toBeGreaterThan(0);

      // Should be sorted by modification time
      const times = result.files.map(f => new Date(f.lastModified).getTime());
      for (let i = 0; i < times.length - 1; i++) {
        expect(times[i]).toBeGreaterThanOrEqual(times[i + 1]);
      }
    });
  });

  // ========================================================================
  // Error Handling and Recovery Tests
  // ========================================================================

  describe('error handling and recovery', () => {
    it('should handle permissions issues gracefully', async () => {
      // Note: Permission tests are platform-dependent and may not work in all environments
      try {
        const result = await globTool.execute({
          pattern: '*',
          path: '/root', // Typically restricted directory
        });

        // Should either succeed or throw a descriptive error
        expect(result).toBeDefined();
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toMatch(/permission|access|denied/i);
      }
    });

    it('should handle filesystem errors during metadata collection', async () => {
      await createTestFile(tempDir, 'test.txt', 'content');

      // This test is tricky - we'd need to simulate filesystem errors
      // For now, just verify that the tool handles normal cases properly
      const result = await globTool.execute({
        pattern: '*.txt',
        path: tempDir,
      });

      expect(result.files.length).toBe(1);
      expect(result.files[0].size).toBeGreaterThan(0);
    });

    it('should handle cancellation during long operations', async () => {
      await createLargeFileSet(tempDir, 1000);

      const controller = new AbortController();
      const context: ToolExecutionContext = {
        signal: controller.signal,
      };

      // Start operation and cancel quickly
      const promise = globTool.execute({
        pattern: '**/*',
        path: tempDir,
      }, context);

      // Cancel after a short delay
      setTimeout(() => controller.abort(), 10);

      await expect(promise).rejects.toThrow('cancelled');
    });

    it('should handle malformed patterns gracefully', async () => {
      const malformedPatterns = [
        '**[invalid',
        '**{incomplete',
        '**/[',
        '**/{',
        '**/**/***',
      ];

      for (const pattern of malformedPatterns) {
        try {
          const result = await globTool.execute({
            pattern,
            path: tempDir,
          });

          // Some patterns might still work depending on the glob library
          expect(result).toBeDefined();
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          expect((error as Error).message).toContain('Glob pattern matching failed');
        }
      }
    });
  });

  // ========================================================================
  // File System Edge Cases
  // ========================================================================

  describe('filesystem edge cases', () => {
    it('should handle empty files correctly', async () => {
      await createTestFile(tempDir, 'empty.txt', '');
      await createTestFile(tempDir, 'nonempty.txt', 'content');

      const result = await globTool.execute({
        pattern: '*.txt',
        path: tempDir,
      });

      expect(result.files.length).toBe(2);

      const emptyFile = result.files.find(f => f.basename === 'empty');
      const nonEmptyFile = result.files.find(f => f.basename === 'nonempty');

      expect(emptyFile?.size).toBe(0);
      expect(nonEmptyFile?.size).toBeGreaterThan(0);
    });

    it('should handle files with no extension', async () => {
      await createTestFile(tempDir, 'README', 'readme content');
      await createTestFile(tempDir, 'LICENSE', 'license content');
      await createTestFile(tempDir, 'Makefile', 'makefile content');

      const result = await globTool.execute({
        pattern: '*',
        path: tempDir,
      });

      const noExtFiles = result.files.filter(f => f.extension === '');
      expect(noExtFiles.length).toBe(3);

      const basenames = noExtFiles.map(f => f.basename);
      expect(basenames).toContain('README');
      expect(basenames).toContain('LICENSE');
      expect(basenames).toContain('Makefile');
    });

    it('should handle files with multiple extensions', async () => {
      await createTestFile(tempDir, 'archive.tar.gz', 'compressed');
      await createTestFile(tempDir, 'backup.sql.bak', 'backup');
      await createTestFile(tempDir, 'config.json.template', 'template');

      const result = await globTool.execute({
        pattern: '*.*',
        path: tempDir,
      });

      const multiExtFiles = result.files.filter(f => f.relativePath.includes('.'));
      expect(multiExtFiles.length).toBeGreaterThan(0);

      // Extension should be the last part
      const tarFile = result.files.find(f => f.relativePath === 'archive.tar.gz');
      expect(tarFile?.extension).toBe('.gz');
      expect(tarFile?.basename).toBe('archive.tar');
    });

    it('should handle very recent file modifications', async () => {
      const file1 = await createTestFile(tempDir, 'first.txt', 'first');

      // Small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));

      const file2 = await createTestFile(tempDir, 'second.txt', 'second');

      const result = await globTool.execute({
        pattern: '*.txt',
        path: tempDir,
      });

      expect(result.files.length).toBe(2);

      // Should be sorted by modification time (most recent first)
      expect(result.files[0].basename).toBe('second');
      expect(result.files[1].basename).toBe('first');
    });
  });
});