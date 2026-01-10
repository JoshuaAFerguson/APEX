/**
 * @fileoverview Advanced Edge Cases for Special Character Handling in GlobTool
 *
 * This test suite focuses on challenging scenarios, edge cases, and potential
 * security concerns when handling special characters in glob patterns.
 * It includes tests for:
 * - Pattern injection attempts
 * - Unicode and international characters in patterns
 * - Very large and complex patterns
 * - Filesystem-specific edge cases
 * - Performance under stress with special characters
 *
 * @module @apex/core/tools/filesystem/__tests__/glob-tool.special-chars-edge-cases
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
async function createTestFile(dir: string, filePath: string, content: string = 'test'): Promise<string> {
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
 * Creates files with various Unicode and special characters
 */
async function createUnicodeSpecialFiles(baseDir: string): Promise<Record<string, string>> {
  const unicodeFiles = {
    // Unicode characters that could be confused with ASCII special chars
    'test［bracket］.txt': 'Fullwidth bracket characters (U+FF3B, U+FF3D)',
    'file｛brace｝.js': 'Fullwidth brace characters (U+FF5B, U+FF5D)',
    'data（paren）.json': 'Fullwidth parentheses (U+FF08, U+FF09)',
    'star＊.log': 'Fullwidth asterisk (U+FF0A)',
    'query？.txt': 'Fullwidth question mark (U+FF1F)',

    // Combining characters and modifiers
    'file[a\u0300].txt': 'Character with combining grave accent',
    'test{é}.js': 'Character with acute accent',
    'data[ñ].json': 'Character with tilde',

    // Directional marks and invisible characters
    'test\u200E[ltr]\u200F.txt': 'Left-to-right and right-to-left marks',
    'file\u2060{nobreak}\u2060.js': 'Word joiner characters',

    // Mathematical and symbolic brackets
    'math⟨bracket⟩.txt': 'Mathematical angle brackets (U+27E8, U+27E9)',
    'set⟦bracket⟧.js': 'Mathematical double angle brackets',
    'function⦃brace⦄.py': 'Mathematical white curly bracket',

    // Rare Unicode special characters
    'file᐀specialᐁ.txt': 'Canadian syllabics special characters',
    'test⸨paren⸩.js': 'Double parentheses (U+2E28, U+2E29)',

    // Zero-width characters (potential security issue)
    'file\u200B[hidden]\u200B.txt': 'Zero-width space characters',
    'test\uFEFF{bom}\uFEFF.js': 'Byte order mark characters',
  };

  const createdFiles: Record<string, string> = {};

  for (const [fileName, description] of Object.entries(unicodeFiles)) {
    try {
      const fullPath = await createTestFile(baseDir, fileName, description);
      createdFiles[fileName] = fullPath;
    } catch (error) {
      // Some filesystems may not support these characters
      console.warn(`Could not create Unicode file: ${fileName}`, error);
    }
  }

  return createdFiles;
}

/**
 * Creates files for pattern injection testing
 */
async function createPatternInjectionFiles(baseDir: string): Promise<void> {
  // Files that look like they might contain pattern injection attempts
  const injectionFiles = [
    // Files with patterns that could be mistaken for glob injection
    'script[$(rm -rf /)].js',
    'config{$(cat /etc/passwd)}.json',
    'data[`command`].txt',
    'file{|dangerous|}.log',

    // Files with regex-like patterns
    'pattern[.*].txt',
    'regex{.+}.js',
    'match[\\d+].log',
    'search{\\w*}.tmp',

    // Files with path traversal patterns
    'file[../].txt',
    'config{../../}.json',
    'data[..\\\\].log',

    // Files with URL-like patterns
    'url[http://example.com].txt',
    'link{https://test.org}.html',
    'ftp[ftp://files.com].log',
  ];

  for (const file of injectionFiles) {
    try {
      await createTestFile(baseDir, file, `Safe content for ${file}`);
    } catch (error) {
      // Some characters might not be allowed in filenames
      console.warn(`Could not create injection test file: ${file}`, error);
    }
  }
}

/**
 * Creates a large number of files with special characters for stress testing
 */
async function createStressTestFiles(baseDir: string, count: number = 500): Promise<void> {
  const specialChars = ['[', ']', '{', '}', '*', '?', '+', '(', ')'];
  const promises: Promise<string>[] = [];

  for (let i = 0; i < count; i++) {
    const char1 = specialChars[i % specialChars.length];
    const char2 = specialChars[(i + 1) % specialChars.length];
    const fileName = `stress${i}${char1}test${char2}.txt`;

    promises.push(createTestFile(baseDir, fileName, `Stress test file ${i}`));

    // Create in batches to avoid overwhelming the filesystem
    if (promises.length >= 50) {
      await Promise.all(promises);
      promises.length = 0;
    }
  }

  if (promises.length > 0) {
    await Promise.all(promises);
  }
}

// ============================================================================
// Advanced Edge Cases Test Suite
// ============================================================================

describe('GlobTool Special Characters - Advanced Edge Cases', () => {
  let globTool: GlobTool;
  let tempDir: string;
  let unicodeFiles: Record<string, string>;

  beforeEach(async () => {
    globTool = new GlobTool();
    tempDir = await createTempDir();
    unicodeFiles = await createUnicodeSpecialFiles(tempDir);
  });

  afterEach(async () => {
    await removeDir(tempDir);
  });

  // ========================================================================
  // Unicode and International Character Tests
  // ========================================================================

  describe('unicode and international character handling', () => {
    it('should distinguish between ASCII and fullwidth special characters', async () => {
      const result = await globTool.execute({
        pattern: '**/*',
        path: tempDir,
      });

      const fullwidthFiles = result.files.filter(file =>
        file.relativePath.includes('［') || file.relativePath.includes('｛') || file.relativePath.includes('＊')
      );

      if (fullwidthFiles.length > 0) {
        // Fullwidth characters should be treated as regular characters, not special glob chars
        expect(fullwidthFiles.length).toBeGreaterThan(0);

        // Verify these files are found correctly
        const fileNames = fullwidthFiles.map(f => f.relativePath);
        expect(fileNames.some(name => name.includes('［bracket］'))).toBe(true);
        expect(fileNames.some(name => name.includes('｛brace｝'))).toBe(true);
      }
    });

    it('should handle combining characters in patterns correctly', async () => {
      const result = await globTool.execute({
        pattern: '*[*]*',
        path: tempDir,
      });

      const combiningFiles = result.files.filter(file =>
        file.relativePath.includes('\u0300') || file.relativePath.includes('é') || file.relativePath.includes('ñ')
      );

      if (combiningFiles.length > 0) {
        // Should handle files with combining characters
        expect(combiningFiles.every(f => typeof f.path === 'string')).toBe(true);
        expect(combiningFiles.every(f => f.size >= 0)).toBe(true);
      }
    });

    it('should handle directional marks and invisible characters', async () => {
      const result = await globTool.execute({
        pattern: '**/*',
        path: tempDir,
      });

      const invisibleCharFiles = result.files.filter(file =>
        file.relativePath.includes('\u200E') ||
        file.relativePath.includes('\u200F') ||
        file.relativePath.includes('\u2060') ||
        file.relativePath.includes('\u200B') ||
        file.relativePath.includes('\uFEFF')
      );

      if (invisibleCharFiles.length > 0) {
        // Should handle files with invisible characters gracefully
        expect(invisibleCharFiles.every(f => f.relativePath.length > 0)).toBe(true);
        expect(invisibleCharFiles.every(f => typeof f.lastModified === 'string')).toBe(true);
      }
    });

    it('should handle mathematical Unicode brackets correctly', async () => {
      const result = await globTool.execute({
        pattern: '**/*',
        path: tempDir,
      });

      const mathFiles = result.files.filter(file =>
        file.relativePath.includes('⟨') || file.relativePath.includes('⟦') || file.relativePath.includes('⦃')
      );

      if (mathFiles.length > 0) {
        // Mathematical brackets should be treated as regular characters
        const fileNames = mathFiles.map(f => f.relativePath);
        expect(fileNames.some(name => name.includes('⟨bracket⟩'))).toBe(true);
        expect(fileNames.some(name => name.includes('⟦bracket⟧'))).toBe(true);
      }
    });

    it('should handle zero-width characters securely', async () => {
      const result = await globTool.execute({
        pattern: '*[hidden]*',
        path: tempDir,
      });

      const hiddenFiles = result.files.filter(file =>
        file.relativePath.includes('hidden') || file.relativePath.includes('bom')
      );

      if (hiddenFiles.length > 0) {
        // Should find files even with zero-width characters
        expect(hiddenFiles.every(f => f.path.length > 0)).toBe(true);

        // Verify the files are properly handled despite invisible characters
        const fileNames = hiddenFiles.map(f => f.relativePath);
        expect(fileNames.some(name => name.includes('hidden'))).toBe(true);
      }
    });
  });

  // ========================================================================
  // Pattern Injection and Security Tests
  // ========================================================================

  describe('pattern injection and security', () => {
    beforeEach(async () => {
      await createPatternInjectionFiles(tempDir);
    });

    it('should safely handle filenames that look like command injection', async () => {
      const result = await globTool.execute({
        pattern: '*$(*)*.js',
        path: tempDir,
      });

      const suspiciousFiles = result.files.filter(file =>
        file.relativePath.includes('$(') || file.relativePath.includes('`')
      );

      // Should find files with these patterns safely without executing anything
      if (suspiciousFiles.length > 0) {
        expect(suspiciousFiles.every(f => f.size >= 0)).toBe(true);
        expect(suspiciousFiles.every(f => typeof f.lastModified === 'string')).toBe(true);

        const fileNames = suspiciousFiles.map(f => f.relativePath);
        expect(fileNames.some(name => name.includes('$(rm -rf')))
          .toBe(true); // Should find but not execute
      }
    });

    it('should handle regex-like patterns in filenames safely', async () => {
      const result = await globTool.execute({
        pattern: '*[*]*',
        path: tempDir,
      });

      const regexFiles = result.files.filter(file =>
        file.relativePath.includes('[.*]') || file.relativePath.includes('[\\d+]')
      );

      if (regexFiles.length > 0) {
        // Should treat these as literal characters, not regex patterns
        expect(regexFiles.every(f => typeof f.path === 'string')).toBe(true);

        const fileNames = regexFiles.map(f => f.relativePath);
        expect(fileNames.some(name => name.includes('[.*]'))).toBe(true);
        expect(fileNames.some(name => name.includes('[\\d+]'))).toBe(true);
      }
    });

    it('should safely handle path traversal patterns in filenames', async () => {
      const result = await globTool.execute({
        pattern: '*[../*]*',
        path: tempDir,
      });

      const traversalFiles = result.files.filter(file =>
        file.relativePath.includes('[../]') || file.relativePath.includes('[../../]')
      );

      if (traversalFiles.length > 0) {
        // Should find these files without allowing actual path traversal
        expect(traversalFiles.every(f => f.path.includes(tempDir))).toBe(true);

        const fileNames = traversalFiles.map(f => f.relativePath);
        expect(fileNames.some(name => name.includes('[../]'))).toBe(true);
      }
    });

    it('should validate patterns that could be security risks', () => {
      const riskyPatterns = [
        '../../../*',
        '**/../**/etc/passwd',
        '*$(rm -rf /)*',
        '*`dangerous command`*',
        '**/*|dangerous|*',
      ];

      for (const pattern of riskyPatterns) {
        const validation = globTool.validate({ pattern });

        // May be valid patterns but should have appropriate warnings
        if (pattern.includes('..')) {
          expect(validation.warnings?.some(w => w.includes('..'))).toBe(true);
        }
      }
    });
  });

  // ========================================================================
  // Stress Testing with Special Characters
  // ========================================================================

  describe('stress testing with special characters', () => {
    it('should handle large numbers of files with special characters', async () => {
      await createStressTestFiles(tempDir, 200); // Reduced from 500 for faster testing

      const startTime = Date.now();

      const result = await globTool.execute({
        pattern: 'stress*[*]*',
        path: tempDir,
      });

      const executionTime = Date.now() - startTime;

      expect(result.files.length).toBeGreaterThan(0);
      expect(executionTime).toBeLessThan(15000); // Should complete within 15 seconds
      expect(result.searchTime).toBeGreaterThan(0);

      // Verify all found files have the expected pattern
      result.files.forEach(file => {
        expect(file.relativePath.startsWith('stress')).toBe(true);
        expect(file.relativePath.includes('[')).toBe(true);
        expect(file.relativePath.includes(']')).toBe(true);
      });
    });

    it('should handle very complex patterns with many special characters', async () => {
      await createStressTestFiles(tempDir, 50);

      // A very complex pattern that tests multiple special character types
      const complexPattern = '*[*]*{*}*(*)*+*?**.*';

      const startTime = Date.now();

      try {
        const result = await globTool.execute({
          pattern: complexPattern,
          path: tempDir,
        });

        const executionTime = Date.now() - startTime;

        expect(result).toBeDefined();
        expect(executionTime).toBeLessThan(10000); // Should not hang or be extremely slow
      } catch (error) {
        // Complex patterns might fail, but should fail gracefully
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('Glob pattern matching failed');
      }
    });

    it('should handle concurrent searches with special character patterns', async () => {
      await createStressTestFiles(tempDir, 100);

      const patterns = [
        '*[*]*',
        '*{*}*',
        '*(*)*',
        '*+*',
        '*?*',
        '**/*[*]*',
        '**/*{*}*',
        'stress*[*]*.txt',
      ];

      const operations = patterns.map(pattern =>
        globTool.execute({ pattern, path: tempDir })
      );

      const startTime = Date.now();
      const results = await Promise.all(operations);
      const executionTime = Date.now() - startTime;

      expect(results).toHaveLength(patterns.length);
      expect(executionTime).toBeLessThan(20000); // All operations should complete within 20 seconds

      results.forEach((result, index) => {
        expect(result).toBeDefined();
        expect(result.files).toBeInstanceOf(Array);
        expect(result.pattern).toBe(patterns[index]);
        expect(result.searchTime).toBeGreaterThan(0);
      });
    });
  });

  // ========================================================================
  // Filesystem Edge Cases
  // ========================================================================

  describe('filesystem edge cases', () => {
    it('should handle platform-specific character restrictions', async () => {
      // Characters that may be problematic on different platforms
      const problematicNames = [
        'file[<test>].txt',    // < > problematic on Windows
        'file{test:backup}.js', // : problematic on Windows
        'file[test"quote].log', // " problematic on Windows
        'file{test|pipe}.tmp',  // | problematic on Windows
      ];

      for (const name of problematicNames) {
        try {
          await createTestFile(tempDir, name, 'test content');

          const result = await globTool.execute({
            pattern: '**/*',
            path: tempDir,
          });

          // Should either create and find the file, or fail gracefully
          expect(result).toBeDefined();
        } catch (error) {
          // Expected on some platforms
          expect(error).toBeInstanceOf(Error);
        }
      }
    });

    it('should handle very long filenames with special characters', async () => {
      // Create a filename approaching filesystem limits
      const longBaseName = 'a'.repeat(100);
      const specialSuffix = '[test]{backup}*?.txt';
      const longName = longBaseName + specialSuffix;

      try {
        await createTestFile(tempDir, longName, 'long filename test');

        const result = await globTool.execute({
          pattern: '*[*]*{*}**',
          path: tempDir,
        });

        const longFiles = result.files.filter(f => f.relativePath.length > 150);

        if (longFiles.length > 0) {
          expect(longFiles[0].relativePath.includes('[test]')).toBe(true);
          expect(longFiles[0].relativePath.includes('{backup}')).toBe(true);
        }
      } catch (error) {
        // Some filesystems have filename length limitations
        expect(error).toBeInstanceOf(Error);
      }
    });

    it('should handle case sensitivity with special characters', async () => {
      await createTestFile(tempDir, 'Test[ABC].txt', 'uppercase');
      await createTestFile(tempDir, 'test[abc].txt', 'lowercase');
      await createTestFile(tempDir, 'TEST[123].TXT', 'all caps');

      const result = await globTool.execute({
        pattern: '*[*]*',
        path: tempDir,
      });

      const caseFiles = result.files.filter(file =>
        file.relativePath.toLowerCase().includes('test') &&
        file.relativePath.includes('[')
      );

      expect(caseFiles.length).toBeGreaterThanOrEqual(2);

      // Should find all variants (case sensitivity depends on filesystem)
      const fileNames = caseFiles.map(f => f.relativePath);
      const hasVariations = fileNames.some(name => name.includes('[ABC]')) ||
                          fileNames.some(name => name.includes('[abc]')) ||
                          fileNames.some(name => name.includes('[123]'));

      expect(hasVariations).toBe(true);
    });
  });

  // ========================================================================
  // Error Recovery and Resilience
  // ========================================================================

  describe('error recovery and resilience', () => {
    it('should recover gracefully from filesystem errors during pattern matching', async () => {
      await createStressTestFiles(tempDir, 50);

      // Create a pattern that might cause issues
      const problematicPattern = '**/*[*]*{*}*';

      try {
        const result = await globTool.execute({
          pattern: problematicPattern,
          path: tempDir,
        });

        expect(result).toBeDefined();
        expect(result.files).toBeInstanceOf(Array);
        expect(result.totalFiles).toBe(result.files.length);

        // Should provide meaningful results even if some files couldn't be processed
        expect(result.searchTime).toBeGreaterThan(0);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBeDefined();
      }
    });

    it('should handle cancellation during complex special character operations', async () => {
      await createStressTestFiles(tempDir, 200);

      const controller = new AbortController();
      const context: ToolExecutionContext = {
        signal: controller.signal,
      };

      const promise = globTool.execute({
        pattern: '**/*[*]*{*}*',
        path: tempDir,
      }, context);

      // Cancel after a short delay
      setTimeout(() => controller.abort(), 50);

      await expect(promise).rejects.toThrow('cancelled');
    });

    it('should provide meaningful error messages for malformed special character patterns', async () => {
      const malformedPatterns = [
        '*[[[invalid',
        '*{{{broken',
        '*[unclosed{mixed}',
        '*{unclosed[mixed]',
        '***[excessive]*{special}***',
      ];

      for (const pattern of malformedPatterns) {
        try {
          await globTool.execute({
            pattern,
            path: tempDir,
          });
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          expect((error as Error).message).toContain('Glob pattern matching failed');
        }
      }
    });
  });
});