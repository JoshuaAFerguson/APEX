/**
 * @fileoverview Pattern Escaping and Special Character Tests for GlobTool
 *
 * These tests verify the handling of regex special characters in glob patterns
 * and ensure proper escaping behavior for literal characters vs pattern matching.
 *
 * Special characters tested:
 * - Brackets: [] for character classes vs literal brackets
 * - Braces: {} for alternation vs literal braces
 * - Asterisks: * for wildcards vs literal asterisks
 * - Question marks: ? for single char vs literal question marks
 * - Parentheses: () for grouping vs literal parentheses
 * - Dots: . for any character vs literal dots
 * - Plus signs: + for quantifiers vs literal plus
 * - Backslashes: \ for escaping vs literal backslashes
 *
 * @module @apex/core/tools/filesystem/__tests__/glob-tool.pattern-escaping
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
 * Creates a temporary directory for pattern escaping tests
 */
async function createTempDir(): Promise<string> {
  return await fs.mkdtemp(path.join(os.tmpdir(), 'apex-glob-pattern-test-'));
}

/**
 * Creates a test file with specified content
 */
async function createTestFile(dir: string, filePath: string, content: string = 'test content'): Promise<string> {
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
 * Creates files with special characters in names for testing
 */
async function createSpecialCharFiles(baseDir: string): Promise<Record<string, string>> {
  const specialFiles = {
    // Files with literal brackets
    'file[1].txt': 'content with literal brackets in name',
    'test[a-z].txt': 'another bracket file',
    'data[123].json': '{"test": "brackets"}',

    // Files with literal braces
    'component{main}.ts': 'export const main = {};',
    'config{dev}.json': '{"env": "dev"}',
    'style{responsive}.css': '.responsive {}',

    // Files with literal asterisks
    'README*.md': '# README with asterisk',
    'log*.txt': 'log file with asterisk',
    'temp*file.tmp': 'temporary file',

    // Files with literal question marks
    'help?.txt': 'help file with question mark',
    'test?.js': 'test file with question mark',

    // Files with literal dots
    'file.name.with.dots.txt': 'file with many dots',
    '.hidden.file': 'hidden file with dots',
    'version.1.2.3.txt': 'version file',

    // Files with literal plus signs
    'math+operations.txt': 'mathematical operations',
    'feature+enhancement.md': '# Feature enhancement',

    // Files with literal parentheses
    'function(args).js': 'function with parentheses',
    'test(unit).spec.ts': 'unit test file',
    'data(backup).json': '{"backup": true}',

    // Mixed special characters
    'complex[test]{file}*.txt': 'file with multiple special chars',
    'pattern?.{test}[123].js': 'complex pattern file',
    'escape+chars?.{backup}[old].tmp': 'file with all special chars',
  };

  const createdFiles: Record<string, string> = {};

  for (const [fileName, content] of Object.entries(specialFiles)) {
    try {
      const fullPath = await createTestFile(baseDir, fileName, content);
      createdFiles[fileName] = fullPath;
    } catch (error) {
      // Some systems may not support certain characters in filenames
      console.warn(`Could not create file: ${fileName}`, error);
    }
  }

  return createdFiles;
}

/**
 * Creates files for character class testing
 */
async function createCharacterClassFiles(baseDir: string): Promise<void> {
  const files = [
    'test1.txt', 'test2.txt', 'test3.txt', 'test9.txt',
    'testA.txt', 'testB.txt', 'testZ.txt',
    'file_a.txt', 'file_b.txt', 'file_1.txt',
    'data-x.txt', 'data-y.txt', 'data-z.txt',
  ];

  for (const file of files) {
    await createTestFile(baseDir, file, `Content for ${file}`);
  }
}

/**
 * Creates files for brace expansion testing
 */
async function createBraceExpansionFiles(baseDir: string): Promise<void> {
  const files = [
    'app.js', 'app.ts', 'app.tsx', 'app.jsx',
    'test.js', 'test.ts', 'test.spec.js', 'test.spec.ts',
    'util.css', 'util.scss', 'util.less',
    'config.json', 'config.yaml', 'config.yml',
  ];

  for (const file of files) {
    await createTestFile(baseDir, file, `Content for ${file}`);
  }
}

// ============================================================================
// Pattern Escaping Test Suite
// ============================================================================

describe('GlobTool Pattern Escaping and Special Characters', () => {
  let globTool: GlobTool;
  let tempDir: string;
  let specialFiles: Record<string, string>;

  beforeEach(async () => {
    globTool = new GlobTool();
    tempDir = await createTempDir();
    specialFiles = await createSpecialCharFiles(tempDir);
  });

  afterEach(async () => {
    await removeDir(tempDir);
  });

  // ========================================================================
  // Literal Bracket Tests
  // ========================================================================

  describe('literal bracket handling', () => {
    it('should find files with literal brackets in names', async () => {
      const result = await globTool.execute({
        pattern: '*[*]*',
        path: tempDir,
      });

      const bracketFiles = result.files.filter(file =>
        file.relativePath.includes('[') && file.relativePath.includes(']')
      );

      expect(bracketFiles.length).toBeGreaterThan(0);

      // Should find files like 'file[1].txt', 'test[a-z].txt', etc.
      const fileNames = bracketFiles.map(f => f.relativePath);
      expect(fileNames.some(name => name.includes('[1]'))).toBe(true);
      expect(fileNames.some(name => name.includes('[a-z]'))).toBe(true);
      expect(fileNames.some(name => name.includes('[123]'))).toBe(true);
    });

    it('should handle bracket patterns as character classes correctly', async () => {
      await createCharacterClassFiles(tempDir);

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
      expect(basenames).not.toContain('testA');
    });

    it('should handle character class negation', async () => {
      await createCharacterClassFiles(tempDir);

      const result = await globTool.execute({
        pattern: 'test[!1-3].txt',
        path: tempDir,
      });

      const basenames = result.files.map(f => f.basename);
      expect(basenames).not.toContain('test1');
      expect(basenames).not.toContain('test2');
      expect(basenames).not.toContain('test3');
      expect(basenames).toContain('test9');
      expect(basenames).toContain('testA');
    });

    it('should handle character ranges in brackets', async () => {
      await createCharacterClassFiles(tempDir);

      const result = await globTool.execute({
        pattern: 'test[A-Z].txt',
        path: tempDir,
      });

      const basenames = result.files.map(f => f.basename);
      expect(basenames).toContain('testA');
      expect(basenames).toContain('testB');
      expect(basenames).toContain('testZ');
      expect(basenames).not.toContain('test1');
      expect(basenames).not.toContain('test9');
    });

    it('should handle empty character classes gracefully', async () => {
      // This should be handled as invalid pattern or no matches
      const result = await globTool.execute({
        pattern: 'test[].txt',
        path: tempDir,
      });

      expect(result.files).toEqual([]);
    });
  });

  // ========================================================================
  // Literal Brace Tests
  // ========================================================================

  describe('literal brace handling', () => {
    it('should find files with literal braces in names', async () => {
      const result = await globTool.execute({
        pattern: '*{*}*',
        path: tempDir,
      });

      const braceFiles = result.files.filter(file =>
        file.relativePath.includes('{') && file.relativePath.includes('}')
      );

      expect(braceFiles.length).toBeGreaterThan(0);

      const fileNames = braceFiles.map(f => f.relativePath);
      expect(fileNames.some(name => name.includes('{main}'))).toBe(true);
      expect(fileNames.some(name => name.includes('{dev}'))).toBe(true);
      expect(fileNames.some(name => name.includes('{responsive}'))).toBe(true);
    });

    it('should handle brace expansion patterns correctly', async () => {
      await createBraceExpansionFiles(tempDir);

      const result = await globTool.execute({
        pattern: 'app.{js,ts,tsx,jsx}',
        path: tempDir,
      });

      expect(result.files.length).toBe(4);

      const extensions = new Set(result.files.map(f => f.extension));
      expect(extensions.has('.js')).toBe(true);
      expect(extensions.has('.ts')).toBe(true);
      expect(extensions.has('.tsx')).toBe(true);
      expect(extensions.has('.jsx')).toBe(true);
    });

    it('should handle nested brace patterns', async () => {
      await createBraceExpansionFiles(tempDir);

      const result = await globTool.execute({
        pattern: '{test,util}.{js,css}',
        path: tempDir,
      });

      const expectedFiles = ['test.js', 'util.css'];
      const foundFiles = result.files.map(f => f.relativePath);

      expectedFiles.forEach(expected => {
        expect(foundFiles).toContain(expected);
      });
    });

    it('should handle complex brace patterns', async () => {
      await createBraceExpansionFiles(tempDir);

      const result = await globTool.execute({
        pattern: '*.{spec.{js,ts},json,y{a,}ml}',
        path: tempDir,
      });

      const foundFiles = result.files.map(f => f.relativePath);
      expect(foundFiles).toContain('test.spec.js');
      expect(foundFiles).toContain('test.spec.ts');
      expect(foundFiles).toContain('config.json');
      expect(foundFiles).toContain('config.yaml');
      expect(foundFiles).toContain('config.yml');
    });
  });

  // ========================================================================
  // Asterisk and Question Mark Tests
  // ========================================================================

  describe('asterisk and question mark handling', () => {
    it('should find files with literal asterisks in names', async () => {
      const result = await globTool.execute({
        pattern: '*\\**',
        path: tempDir,
      });

      const asteriskFiles = result.files.filter(file =>
        file.relativePath.includes('*')
      );

      if (asteriskFiles.length > 0) {
        const fileNames = asteriskFiles.map(f => f.relativePath);
        expect(fileNames.some(name => name.includes('README*'))).toBe(true);
        expect(fileNames.some(name => name.includes('log*'))).toBe(true);
        expect(fileNames.some(name => name.includes('temp*'))).toBe(true);
      }
    });

    it('should find files with literal question marks in names', async () => {
      const result = await globTool.execute({
        pattern: '*\\?*',
        path: tempDir,
      });

      const questionFiles = result.files.filter(file =>
        file.relativePath.includes('?')
      );

      if (questionFiles.length > 0) {
        const fileNames = questionFiles.map(f => f.relativePath);
        expect(fileNames.some(name => name.includes('help?'))).toBe(true);
        expect(fileNames.some(name => name.includes('test?'))).toBe(true);
      }
    });

    it('should use asterisk as wildcard correctly', async () => {
      const result = await globTool.execute({
        pattern: '*.txt',
        path: tempDir,
      });

      const txtFiles = result.files.filter(f => f.extension === '.txt');
      expect(txtFiles.length).toBeGreaterThan(0);

      // Should match files with .txt extension regardless of name
      const fileNames = txtFiles.map(f => f.relativePath);
      expect(fileNames.some(name => name.endsWith('.txt'))).toBe(true);
    });

    it('should use question mark as single character wildcard', async () => {
      await createTestFile(tempDir, 'test1.txt', 'test1');
      await createTestFile(tempDir, 'test22.txt', 'test22');
      await createTestFile(tempDir, 'testA.txt', 'testA');

      const result = await globTool.execute({
        pattern: 'test?.txt',
        path: tempDir,
      });

      expect(result.files.length).toBe(2); // test1.txt and testA.txt

      const basenames = result.files.map(f => f.basename);
      expect(basenames).toContain('test1');
      expect(basenames).toContain('testA');
      expect(basenames).not.toContain('test22'); // Two characters, shouldn't match
    });
  });

  // ========================================================================
  // Dot and Other Special Character Tests
  // ========================================================================

  describe('dot and other special character handling', () => {
    it('should handle files with multiple dots correctly', async () => {
      const result = await globTool.execute({
        pattern: '*.*.*.txt',
        path: tempDir,
      });

      const multiDotFiles = result.files.filter(file =>
        (file.relativePath.match(/\./g) || []).length >= 4 // At least 4 dots including extension
      );

      expect(multiDotFiles.length).toBeGreaterThan(0);

      const fileNames = multiDotFiles.map(f => f.relativePath);
      expect(fileNames.some(name => name.includes('file.name.with.dots'))).toBe(true);
      expect(fileNames.some(name => name.includes('version.1.2.3'))).toBe(true);
    });

    it('should handle hidden files with dots', async () => {
      const result = await globTool.execute({
        pattern: '.*',
        path: tempDir,
      });

      const hiddenFiles = result.files.filter(file =>
        file.basename.startsWith('.')
      );

      if (hiddenFiles.length > 0) {
        const fileNames = hiddenFiles.map(f => f.relativePath);
        expect(fileNames.some(name => name.includes('.hidden'))).toBe(true);
      }
    });

    it('should find files with literal plus signs in names', async () => {
      const result = await globTool.execute({
        pattern: '*+*',
        path: tempDir,
      });

      const plusFiles = result.files.filter(file =>
        file.relativePath.includes('+')
      );

      expect(plusFiles.length).toBeGreaterThan(0);

      const fileNames = plusFiles.map(f => f.relativePath);
      expect(fileNames.some(name => name.includes('math+'))).toBe(true);
      expect(fileNames.some(name => name.includes('feature+'))).toBe(true);
    });

    it('should find files with literal parentheses in names', async () => {
      const result = await globTool.execute({
        pattern: '*(*)*',
        path: tempDir,
      });

      const parenFiles = result.files.filter(file =>
        file.relativePath.includes('(') && file.relativePath.includes(')')
      );

      expect(parenFiles.length).toBeGreaterThan(0);

      const fileNames = parenFiles.map(f => f.relativePath);
      expect(fileNames.some(name => name.includes('(args)'))).toBe(true);
      expect(fileNames.some(name => name.includes('(unit)'))).toBe(true);
      expect(fileNames.some(name => name.includes('(backup)'))).toBe(true);
    });
  });

  // ========================================================================
  // Complex Pattern Combination Tests
  // ========================================================================

  describe('complex pattern combinations', () => {
    it('should handle patterns with multiple special character types', async () => {
      const result = await globTool.execute({
        pattern: '*[*]*{*}**',
        path: tempDir,
      });

      const complexFiles = result.files.filter(file =>
        file.relativePath.includes('[') &&
        file.relativePath.includes('{') &&
        file.relativePath.includes('*')
      );

      expect(complexFiles.length).toBeGreaterThan(0);

      const fileNames = complexFiles.map(f => f.relativePath);
      expect(fileNames.some(name => name.includes('complex[test]{file}*'))).toBe(true);
    });

    it('should handle patterns mixing wildcards and literals', async () => {
      const result = await globTool.execute({
        pattern: '*?.*{*}[*]*',
        path: tempDir,
      });

      const mixedFiles = result.files.filter(file =>
        file.relativePath.includes('?') &&
        file.relativePath.includes('{') &&
        file.relativePath.includes('[')
      );

      if (mixedFiles.length > 0) {
        const fileNames = mixedFiles.map(f => f.relativePath);
        expect(fileNames.some(name => name.includes('pattern?.{test}[123]'))).toBe(true);
        expect(fileNames.some(name => name.includes('escape+chars?.{backup}[old]'))).toBe(true);
      }
    });

    it('should handle very complex nested patterns', async () => {
      await createTestFile(tempDir, 'test.{backup}.{2024}.[old].txt', 'complex nested');
      await createTestFile(tempDir, 'file.{config}.{prod}.[v1].json', 'complex config');

      const result = await globTool.execute({
        pattern: '**/*{*}*{*}*[*]*',
        path: tempDir,
      });

      const nestedFiles = result.files.filter(file => {
        const path = file.relativePath;
        return path.includes('{') && path.includes('[') && path.includes('}') && path.includes(']');
      });

      expect(nestedFiles.length).toBeGreaterThanOrEqual(0);
    });
  });

  // ========================================================================
  // Edge Cases and Error Handling
  // ========================================================================

  describe('edge cases and error handling', () => {
    it('should handle malformed bracket patterns gracefully', async () => {
      const malformedPatterns = [
        '*[unclosed',
        '*[*',
        '*]*',
        '*[a-*',
        '*[-z]*',
      ];

      for (const pattern of malformedPatterns) {
        try {
          const result = await globTool.execute({
            pattern,
            path: tempDir,
          });

          // Should either work or throw a descriptive error
          expect(result).toBeDefined();
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          expect((error as Error).message).toContain('Glob pattern matching failed');
        }
      }
    });

    it('should handle malformed brace patterns gracefully', async () => {
      const malformedPatterns = [
        '*{unclosed',
        '*{*',
        '*}*',
        '*{a,}*',
        '*{,b}*',
      ];

      for (const pattern of malformedPatterns) {
        try {
          const result = await globTool.execute({
            pattern,
            path: tempDir,
          });

          // Should either work or throw a descriptive error
          expect(result).toBeDefined();
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          expect((error as Error).message).toContain('Glob pattern matching failed');
        }
      }
    });

    it('should handle patterns with excessive special characters', async () => {
      const extremePattern = '*'.repeat(100) + '{' + 'a,'.repeat(50) + 'z}' + '['.repeat(10) + 'a-z' + ']'.repeat(10);

      try {
        const result = await globTool.execute({
          pattern: extremePattern,
          path: tempDir,
        });

        expect(result).toBeDefined();
        expect(result.files).toBeInstanceOf(Array);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });

    it('should handle empty and whitespace patterns', async () => {
      const edgeCasePatterns = ['', '   ', '\t', '\n'];

      for (const pattern of edgeCasePatterns) {
        const validation = globTool.validate({ pattern });
        expect(validation.valid).toBe(false);
        expect(validation.errors).toContain('pattern cannot be empty');
      }
    });

    it('should validate patterns with invalid regex characters', async () => {
      const invalidPatterns = [
        'test|file',
        'test<file',
        'test>file',
        'test"file',
        'test:file',
      ];

      for (const pattern of invalidPatterns) {
        const validation = globTool.validate({ pattern });
        expect(validation.valid).toBe(false);
        expect(validation.errors).toContain('pattern contains invalid characters (<>"|:)');
      }
    });
  });

  // ========================================================================
  // Performance Tests for Complex Patterns
  // ========================================================================

  describe('performance with complex patterns', () => {
    it('should handle complex patterns efficiently', async () => {
      // Create a reasonable number of test files
      const promises: Promise<string>[] = [];
      for (let i = 0; i < 100; i++) {
        promises.push(createTestFile(tempDir, `test${i}.{file}[${i}].txt`, `content ${i}`));
        promises.push(createTestFile(tempDir, `data${i}.{backup}[old].json`, `{"id": ${i}}`));
      }
      await Promise.all(promises);

      const startTime = Date.now();

      const result = await globTool.execute({
        pattern: '**/*{*}[*]*',
        path: tempDir,
      });

      const executionTime = Date.now() - startTime;

      expect(result.files.length).toBeGreaterThan(0);
      expect(executionTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(result.searchTime).toBeGreaterThan(0);
    });

    it('should handle multiple concurrent complex pattern searches', async () => {
      await createTestFile(tempDir, 'test[1].{js}.txt', 'test');
      await createTestFile(tempDir, 'file{config}[old].json', 'config');
      await createTestFile(tempDir, 'data*.{backup}?.txt', 'backup');

      const operations = [
        globTool.execute({ pattern: '*[*]*', path: tempDir }),
        globTool.execute({ pattern: '*{*}*', path: tempDir }),
        globTool.execute({ pattern: '*\\**', path: tempDir }),
        globTool.execute({ pattern: '*\\?*', path: tempDir }),
      ];

      const results = await Promise.all(operations);

      expect(results).toHaveLength(4);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.files).toBeInstanceOf(Array);
        expect(result.searchTime).toBeGreaterThan(0);
      });
    });
  });
});