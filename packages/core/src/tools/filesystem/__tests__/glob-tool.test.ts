/**
 * @fileoverview Tests for GlobTool
 *
 * These tests verify the functionality of the GlobTool including:
 * - Basic glob pattern matching
 * - Different glob pattern types (*, **, ?, [], {})
 * - Path filtering and directory specification
 * - Result sorting by modification time
 * - Performance limits and safety features
 * - Error handling and validation
 * - Security validation
 *
 * @module @apex/core/tools/filesystem/__tests__/glob-tool
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { GlobTool, type GlobToolInput, type GlobToolOutput } from '../glob-tool.js';
import type { ToolExecutionContext } from '../../base-tool.js';

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Creates a temporary directory for tests
 */
async function createTempDir(): Promise<string> {
  return await fs.mkdtemp(path.join(os.tmpdir(), 'apex-glob-tool-test-'));
}

/**
 * Creates a test file with specified content
 */
async function createTestFile(dir: string, filePath: string, content: string = 'test content'): Promise<string> {
  const fullPath = path.join(dir, filePath);
  const fileDir = path.dirname(fullPath);

  // Ensure directory exists
  await fs.mkdir(fileDir, { recursive: true });
  await fs.writeFile(fullPath, content, 'utf8');
  return fullPath;
}

/**
 * Creates a directory structure for testing
 */
async function createTestStructure(baseDir: string): Promise<Record<string, string>> {
  const files = {
    'package.json': '{"name": "test"}',
    'README.md': '# Test Project',
    'src/index.ts': 'export const main = () => {};',
    'src/utils.ts': 'export const helper = () => {};',
    'src/components/Button.tsx': 'export const Button = () => {};',
    'src/components/Input.tsx': 'export const Input = () => {};',
    'tests/unit.test.js': 'test("example", () => {});',
    'tests/integration.test.ts': 'describe("integration", () => {});',
    'dist/index.js': 'function main() {}',
    'docs/api.md': '# API Documentation',
    'node_modules/dep/index.js': 'module.exports = {};',
  };

  const createdFiles: Record<string, string> = {};

  for (const [filePath, content] of Object.entries(files)) {
    const fullPath = await createTestFile(baseDir, filePath, content);
    createdFiles[filePath] = fullPath;
  }

  // Add small delay to ensure different modification times
  await new Promise(resolve => setTimeout(resolve, 10));

  return createdFiles;
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

// ============================================================================
// Test Suite
// ============================================================================

describe('GlobTool', () => {
  let globTool: GlobTool;
  let tempDir: string;
  let testFiles: Record<string, string>;

  beforeEach(async () => {
    globTool = new GlobTool();
    tempDir = await createTempDir();
    testFiles = await createTestStructure(tempDir);
  });

  afterEach(async () => {
    await removeDir(tempDir);
  });

  // ========================================================================
  // Basic Functionality Tests
  // ========================================================================

  describe('basic functionality', () => {
    it('should match all files with **/*', async () => {
      const result = await globTool.execute({
        pattern: '**/*',
        path: tempDir,
      });

      expect(result.totalFiles).toBeGreaterThan(0);
      expect(result.files).toBeInstanceOf(Array);
      expect(result.pattern).toBe('**/*');
      expect(result.searchPath).toBe(tempDir);
      expect(result.searchTime).toBeGreaterThan(0);
    });

    it('should match TypeScript files with **/*.ts', async () => {
      const result = await globTool.execute({
        pattern: '**/*.ts',
        path: tempDir,
      });

      const tsFiles = result.files.filter(file => file.extension === '.ts');
      expect(tsFiles.length).toBeGreaterThan(0);

      // Should include src/index.ts and src/utils.ts
      const filenames = result.files.map(file => file.relativePath);
      expect(filenames).toContain('src/index.ts');
      expect(filenames).toContain('src/utils.ts');
    });

    it('should match JavaScript files with **/*.js', async () => {
      const result = await globTool.execute({
        pattern: '**/*.js',
        path: tempDir,
      });

      const jsFiles = result.files.filter(file => file.extension === '.js');
      expect(jsFiles.length).toBeGreaterThan(0);

      // Should include tests/unit.test.js and dist/index.js
      const filenames = result.files.map(file => file.relativePath);
      expect(filenames).toContain('tests/unit.test.js');
      expect(filenames).toContain('dist/index.js');
    });

    it('should match test files with specific pattern', async () => {
      const result = await globTool.execute({
        pattern: '**/*.test.{js,ts}',
        path: tempDir,
      });

      expect(result.files.length).toBe(2);

      const filenames = result.files.map(file => file.relativePath);
      expect(filenames).toContain('tests/unit.test.js');
      expect(filenames).toContain('tests/integration.test.ts');
    });

    it('should match files in specific directory', async () => {
      const result = await globTool.execute({
        pattern: 'src/**/*.ts',
        path: tempDir,
      });

      const filenames = result.files.map(file => file.relativePath);
      expect(filenames).toContain('src/index.ts');
      expect(filenames).toContain('src/utils.ts');
      expect(filenames).not.toContain('tests/integration.test.ts');
    });
  });

  // ========================================================================
  // File Metadata Tests
  // ========================================================================

  describe('file metadata', () => {
    it('should provide complete file metadata', async () => {
      const result = await globTool.execute({
        pattern: 'package.json',
        path: tempDir,
      });

      expect(result.files.length).toBe(1);

      const file = result.files[0];
      expect(file.path).toBe(testFiles['package.json']);
      expect(file.relativePath).toBe('package.json');
      expect(file.extension).toBe('.json');
      expect(file.basename).toBe('package');
      expect(file.size).toBeGreaterThan(0);
      expect(file.lastModified).toBeDefined();
      expect(new Date(file.lastModified)).toBeInstanceOf(Date);
    });

    it('should sort files by modification time (most recent first)', async () => {
      // Create files with different modification times
      const file1 = await createTestFile(tempDir, 'file1.txt', 'content1');
      await new Promise(resolve => setTimeout(resolve, 100));
      const file2 = await createTestFile(tempDir, 'file2.txt', 'content2');

      const result = await globTool.execute({
        pattern: 'file*.txt',
        path: tempDir,
      });

      expect(result.files.length).toBe(2);

      // Most recently modified should be first
      const modTimes = result.files.map(file => new Date(file.lastModified).getTime());
      expect(modTimes[0]).toBeGreaterThanOrEqual(modTimes[1]);
    });
  });

  // ========================================================================
  // Pattern Matching Tests
  // ========================================================================

  describe('pattern matching', () => {
    it('should handle glob patterns with braces', async () => {
      const result = await globTool.execute({
        pattern: '**/*.{ts,tsx}',
        path: tempDir,
      });

      const extensions = new Set(result.files.map(file => file.extension));
      expect(extensions.has('.ts')).toBe(true);
      expect(extensions.has('.tsx')).toBe(true);
    });

    it('should handle glob patterns with brackets', async () => {
      // Create additional test files
      await createTestFile(tempDir, 'test1.txt', 'test');
      await createTestFile(tempDir, 'test2.txt', 'test');
      await createTestFile(tempDir, 'test3.txt', 'test');

      const result = await globTool.execute({
        pattern: 'test[12].txt',
        path: tempDir,
      });

      expect(result.files.length).toBe(2);
      const basenames = result.files.map(file => file.basename);
      expect(basenames).toContain('test1');
      expect(basenames).toContain('test2');
      expect(basenames).not.toContain('test3');
    });

    it('should handle negation patterns', async () => {
      const result = await globTool.execute({
        pattern: '**/!(node_modules)/**/*.js',
        path: tempDir,
      });

      const filenames = result.files.map(file => file.relativePath);
      expect(filenames).not.toContain('node_modules/dep/index.js');
      expect(filenames).toContain('tests/unit.test.js');
      expect(filenames).toContain('dist/index.js');
    });
  });

  // ========================================================================
  // Path Resolution Tests
  // ========================================================================

  describe('path resolution', () => {
    it('should use current working directory when no path specified', async () => {
      const originalCwd = process.cwd();

      try {
        // Change to temp directory
        process.chdir(tempDir);

        const result = await globTool.execute({
          pattern: '*.json',
        });

        expect(result.searchPath).toBe(tempDir);
        expect(result.files.length).toBeGreaterThan(0);
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should resolve relative paths', async () => {
      const subDir = path.join(tempDir, 'src');

      const result = await globTool.execute({
        pattern: '*.ts',
        path: path.relative(process.cwd(), subDir),
      });

      expect(result.searchPath).toBe(subDir);
      expect(result.files.length).toBeGreaterThan(0);
    });

    it('should handle absolute paths', async () => {
      const result = await globTool.execute({
        pattern: '*.json',
        path: tempDir,
      });

      expect(result.searchPath).toBe(tempDir);
      expect(result.files.length).toBeGreaterThan(0);
    });
  });

  // ========================================================================
  // Error Handling Tests
  // ========================================================================

  describe('error handling', () => {
    it('should throw error for non-existent directory', async () => {
      await expect(globTool.execute({
        pattern: '*',
        path: '/non/existent/directory',
      })).rejects.toThrow('Search directory not found');
    });

    it('should throw error when path is a file not directory', async () => {
      const filePath = testFiles['package.json'];

      await expect(globTool.execute({
        pattern: '*',
        path: filePath,
      })).rejects.toThrow('Search path is not a directory');
    });

    it('should handle invalid glob patterns gracefully', async () => {
      await expect(globTool.execute({
        pattern: '**[invalid',
        path: tempDir,
      })).rejects.toThrow('Glob pattern matching failed');
    });
  });

  // ========================================================================
  // Validation Tests
  // ========================================================================

  describe('validation', () => {
    it('should validate required pattern parameter', () => {
      const result = globTool.validate({} as GlobToolInput);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('pattern cannot be empty');
    });

    it('should validate empty pattern', () => {
      const result = globTool.validate({ pattern: '   ' });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('pattern cannot be empty');
    });

    it('should validate empty path', () => {
      const result = globTool.validate({
        pattern: '*',
        path: '   ',
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('path cannot be empty if specified');
    });

    it('should warn about dangerous patterns', () => {
      const result = globTool.validate({ pattern: '../**/*' });

      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('pattern contains ".." - ensure this is intentional and safe');
    });

    it('should warn about very broad patterns', () => {
      const result = globTool.validate({ pattern: '**/*' });

      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('very broad pattern may return many results and be slow');
    });

    it('should reject patterns with invalid characters', () => {
      const result = globTool.validate({ pattern: 'test|file' });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('pattern contains invalid characters (<>"|:)');
    });

    it('should warn about system directory access', () => {
      const result = globTool.validate({
        pattern: '*',
        path: '/etc/test',
      });

      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('accessing system directories - use caution');
    });
  });

  // ========================================================================
  // Context and Cancellation Tests
  // ========================================================================

  describe('context and cancellation', () => {
    it('should respect execution context working directory', async () => {
      const context: ToolExecutionContext = {
        workingDirectory: tempDir,
      };

      const result = await globTool.execute({
        pattern: '*.json',
        path: '.',
      }, context);

      expect(result.searchPath).toBe(tempDir);
      expect(result.files.length).toBeGreaterThan(0);
    });

    it('should handle cancellation via abort signal', async () => {
      const controller = new AbortController();
      const context: ToolExecutionContext = {
        signal: controller.signal,
      };

      // Cancel immediately
      controller.abort();

      await expect(globTool.execute({
        pattern: '**/*',
        path: tempDir,
      }, context)).rejects.toThrow('Glob operation was cancelled');
    });

    it('should warn when searching outside working directory', () => {
      const context: ToolExecutionContext = {
        workingDirectory: '/home/user/project',
      };

      const result = globTool.validate({
        pattern: '*',
        path: '/tmp',
      }, context);

      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('search path is outside the working directory');
    });
  });

  // ========================================================================
  // Performance and Limits Tests
  // ========================================================================

  describe('performance and limits', () => {
    it('should track search time', async () => {
      const result = await globTool.execute({
        pattern: '**/*',
        path: tempDir,
      });

      expect(result.searchTime).toBeGreaterThan(0);
      expect(typeof result.searchTime).toBe('number');
    });

    it('should indicate if results were truncated', async () => {
      const result = await globTool.execute({
        pattern: '**/*',
        path: tempDir,
      });

      expect(typeof result.truncated).toBe('boolean');
      // For our small test structure, should not be truncated
      expect(result.truncated).toBe(false);
    });
  });

  // ========================================================================
  // Edge Cases Tests
  // ========================================================================

  describe('edge cases', () => {
    it('should handle empty directory', async () => {
      const emptyDir = await createTempDir();

      try {
        const result = await globTool.execute({
          pattern: '*',
          path: emptyDir,
        });

        expect(result.files).toEqual([]);
        expect(result.totalFiles).toBe(0);
      } finally {
        await removeDir(emptyDir);
      }
    });

    it('should handle patterns that match no files', async () => {
      const result = await globTool.execute({
        pattern: '*.nonexistent',
        path: tempDir,
      });

      expect(result.files).toEqual([]);
      expect(result.totalFiles).toBe(0);
    });

    it('should handle very long file paths', async () => {
      // Create nested directory structure
      const longPath = 'a'.repeat(50) + '/' + 'b'.repeat(50) + '/' + 'c'.repeat(50);
      await createTestFile(tempDir, longPath + '/test.txt', 'content');

      const result = await globTool.execute({
        pattern: '**/*.txt',
        path: tempDir,
      });

      expect(result.files.length).toBeGreaterThan(0);
      const longFile = result.files.find(file => file.relativePath.includes('c'.repeat(50)));
      expect(longFile).toBeDefined();
    });

    it('should handle files with special characters in names', async () => {
      const specialFiles = [
        'file with spaces.txt',
        'file-with-dashes.txt',
        'file_with_underscores.txt',
        'file.with.dots.txt',
        'file(with)parens.txt',
      ];

      for (const filename of specialFiles) {
        await createTestFile(tempDir, filename, 'test');
      }

      const result = await globTool.execute({
        pattern: '*.txt',
        path: tempDir,
      });

      const foundFiles = result.files.map(file => file.relativePath);
      for (const filename of specialFiles) {
        expect(foundFiles).toContain(filename);
      }
    });
  });
});