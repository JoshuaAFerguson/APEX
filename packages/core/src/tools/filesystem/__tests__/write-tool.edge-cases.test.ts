/**
 * @fileoverview Edge case tests for WriteTool
 *
 * This test suite covers edge cases and stress testing scenarios for WriteTool
 * that complement the main test suite, including:
 * - Performance testing with large files
 * - Concurrent access scenarios
 * - Platform-specific edge cases
 * - Resource exhaustion scenarios
 * - Unicode and encoding edge cases
 * - File system limitation testing
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { WriteTool, type WriteFileParams, type WriteFileOutput, PathTraversalError, SensitivePathError } from '../write-tool.js';
import type { ToolExecutionContext } from '../../base-tool.js';

// ============================================================================
// Test Setup
// ============================================================================

describe('WriteTool Edge Cases', () => {
  let writeTool: WriteTool;
  let tempDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    writeTool = new WriteTool();

    // Create a temporary directory for tests
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'write-tool-edge-test-'));

    // Store original working directory
    originalCwd = process.cwd();

    // Change to temp directory for tests
    process.chdir(tempDir);
  });

  afterEach(async () => {
    // Restore original working directory
    process.chdir(originalCwd);

    // Clean up temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
      console.warn('Failed to clean up temp directory:', error);
    }
  });

  // ============================================================================
  // Performance and Large File Tests
  // ============================================================================

  describe('Performance and Large Files', () => {
    it('should handle large file content efficiently', async () => {
      // Create a 10MB string
      const largeContent = 'A'.repeat(10 * 1024 * 1024);
      const params: WriteFileParams = {
        filePath: 'large-file.txt',
        content: largeContent
      };

      const startTime = Date.now();
      const result = await writeTool.execute(params);
      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(result.output?.bytesWritten).toBe(largeContent.length);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds

      // Verify file size
      const stats = await fs.stat('large-file.txt');
      expect(stats.size).toBe(largeContent.length);
    });

    it('should handle many small files creation', async () => {
      const fileCount = 100;
      const promises: Promise<any>[] = [];

      for (let i = 0; i < fileCount; i++) {
        const params: WriteFileParams = {
          filePath: `small-file-${i}.txt`,
          content: `Content for file ${i}`
        };
        promises.push(writeTool.execute(params));
      }

      const results = await Promise.all(promises);

      // All should succeed
      expect(results.every(result => result.success)).toBe(true);

      // Verify all files exist
      const files = await fs.readdir(tempDir);
      const createdFiles = files.filter(file => file.startsWith('small-file-'));
      expect(createdFiles).toHaveLength(fileCount);
    });

    it('should handle concurrent writes to different files', async () => {
      const concurrentWrites = 10;
      const promises: Promise<any>[] = [];

      for (let i = 0; i < concurrentWrites; i++) {
        const params: WriteFileParams = {
          filePath: `concurrent-${i}.txt`,
          content: `Concurrent content ${i} - ${new Date().toISOString()}`
        };
        promises.push(writeTool.execute(params));
      }

      const results = await Promise.all(promises);

      // All should succeed
      expect(results.every(result => result.success)).toBe(true);
      expect(results.every(result => result.output?.created)).toBe(true);

      // Verify all files have unique content
      const contentMap = new Set();
      for (let i = 0; i < concurrentWrites; i++) {
        const content = await fs.readFile(`concurrent-${i}.txt`, 'utf-8');
        expect(contentMap.has(content)).toBe(false);
        contentMap.add(content);
      }
    });
  });

  // ============================================================================
  // Unicode and Encoding Edge Cases
  // ============================================================================

  describe('Unicode and Encoding Edge Cases', () => {
    it('should handle complex Unicode content correctly', async () => {
      const unicodeContent = [
        '🚀 Emoji test',
        '中文测试 Chinese characters',
        'العربية Arabic text',
        'हिन्दी Hindi text',
        '日本語 Japanese text',
        'Русский Russian text',
        'Mathematical symbols: ∑∀∃∈∅∞',
        'Special chars: \u0000\u001F\u007F\u009F',
        'Zero-width characters: \u200B\u200C\u200D\uFEFF'
      ].join('\n');

      const params: WriteFileParams = {
        filePath: 'unicode-test.txt',
        content: unicodeContent,
        encoding: 'utf-8'
      };

      const result = await writeTool.execute(params);

      expect(result.success).toBe(true);

      // Verify content is preserved exactly
      const readContent = await fs.readFile('unicode-test.txt', 'utf-8');
      expect(readContent).toBe(unicodeContent);
    });

    it('should handle different encoding types correctly', async () => {
      const testCases = [
        { encoding: 'ascii' as BufferEncoding, content: 'ASCII only content 123' },
        { encoding: 'latin1' as BufferEncoding, content: 'Latin1 content with çhàracters' },
        { encoding: 'base64' as BufferEncoding, content: 'Hello World!' },
        { encoding: 'hex' as BufferEncoding, content: 'Hello World!' }
      ];

      for (const testCase of testCases) {
        const params: WriteFileParams = {
          filePath: `encoding-test-${testCase.encoding}.txt`,
          content: testCase.content,
          encoding: testCase.encoding
        };

        const result = await writeTool.execute(params);
        expect(result.success).toBe(true);

        // Read back and verify encoding was applied correctly
        const buffer = await fs.readFile(`encoding-test-${testCase.encoding}.txt`);
        const expectedBuffer = Buffer.from(testCase.content, testCase.encoding);

        if (testCase.encoding === 'ascii' || testCase.encoding === 'latin1') {
          // For text encodings, compare as string
          expect(buffer.toString('utf-8')).toBe(expectedBuffer.toString('utf-8'));
        } else {
          // For binary encodings, compare buffers
          expect(buffer.equals(expectedBuffer)).toBe(true);
        }
      }
    });

    it('should handle extremely long file names correctly', async () => {
      // Create a filename near the typical filesystem limit (255 characters for filename)
      const baseName = 'a'.repeat(240);
      const fileName = `${baseName}.txt`;

      const params: WriteFileParams = {
        filePath: fileName,
        content: 'Long filename test content'
      };

      const result = await writeTool.execute(params);

      // Result depends on filesystem - might succeed or fail gracefully
      if (result.success) {
        expect(result.output?.filePath).toContain(fileName);

        // Verify file exists
        const content = await fs.readFile(fileName, 'utf-8');
        expect(content).toBe('Long filename test content');
      } else {
        expect(result.error).toContain('Path exceeds maximum length');
      }
    });
  });

  // ============================================================================
  // File System Limitation Tests
  // ============================================================================

  describe('File System Limitations', () => {
    it('should handle path with maximum depth correctly', async () => {
      // Create a deeply nested path
      const depth = 20;
      const pathParts = Array(depth).fill(0).map((_, i) => `level${i}`);
      const deepPath = path.join(...pathParts, 'deep-file.txt');

      const params: WriteFileParams = {
        filePath: deepPath,
        content: 'Deep nested content',
        createDirectories: true
      };

      const result = await writeTool.execute(params);

      expect(result.success).toBe(true);
      expect(result.output?.directoriesCreated).toBeDefined();

      // Verify file was created
      const content = await fs.readFile(deepPath, 'utf-8');
      expect(content).toBe('Deep nested content');
    });

    it('should handle special characters in path correctly', async () => {
      // Test various special characters that might be problematic
      const specialPaths = [
        'file with spaces.txt',
        'file-with-dashes.txt',
        'file_with_underscores.txt',
        'file.with.dots.txt',
        'file(with)parentheses.txt',
        'file[with]brackets.txt'
      ];

      for (const specialPath of specialPaths) {
        const params: WriteFileParams = {
          filePath: specialPath,
          content: `Content for ${specialPath}`
        };

        const result = await writeTool.execute(params);
        expect(result.success).toBe(true);

        // Verify file exists with correct content
        const content = await fs.readFile(specialPath, 'utf-8');
        expect(content).toBe(`Content for ${specialPath}`);
      }
    });

    it('should handle empty and whitespace-only content', async () => {
      const testCases = [
        { name: 'empty', content: '' },
        { name: 'spaces', content: '   ' },
        { name: 'tabs', content: '\t\t\t' },
        { name: 'newlines', content: '\n\n\n' },
        { name: 'mixed-whitespace', content: ' \t\n \r\n\t ' }
      ];

      for (const testCase of testCases) {
        const params: WriteFileParams = {
          filePath: `whitespace-test-${testCase.name}.txt`,
          content: testCase.content
        };

        const result = await writeTool.execute(params);
        expect(result.success).toBe(true);
        expect(result.output?.bytesWritten).toBe(Buffer.byteLength(testCase.content, 'utf-8'));

        // Verify exact content preservation
        const readContent = await fs.readFile(`whitespace-test-${testCase.name}.txt`, 'utf-8');
        expect(readContent).toBe(testCase.content);
      }
    });
  });

  // ============================================================================
  // Error Recovery and Resilience Tests
  // ============================================================================

  describe('Error Recovery and Resilience', () => {
    it('should handle interrupted write operations gracefully', async () => {
      // Mock fs.rename to fail temporarily
      const originalRename = fs.rename;
      let callCount = 0;

      // @ts-ignore - Mocking for testing
      fs.rename = vi.fn().mockImplementation(async (oldPath, newPath) => {
        callCount++;
        if (callCount === 1) {
          throw new Error('Simulated file system error');
        }
        return originalRename(oldPath, newPath);
      });

      try {
        const params: WriteFileParams = {
          filePath: 'interrupted-test.txt',
          content: 'Test content for interruption'
        };

        // First attempt should fail
        const result1 = await writeTool.execute(params);
        expect(result1.success).toBe(false);

        // Verify no temporary files are left behind
        const files = await fs.readdir(tempDir);
        const tempFiles = files.filter(file => file.includes('.tmp.'));
        expect(tempFiles).toHaveLength(0);

        // Reset mock to allow success
        callCount = 0;
        // @ts-ignore
        fs.rename.mockRestore();
        Object.assign(fs, { rename: originalRename });

        // Second attempt should succeed
        const result2 = await writeTool.execute(params);
        expect(result2.success).toBe(true);

        // Verify file was created correctly
        const content = await fs.readFile('interrupted-test.txt', 'utf-8');
        expect(content).toBe('Test content for interruption');

      } finally {
        // Ensure mock is restored
        Object.assign(fs, { rename: originalRename });
      }
    });

    it('should handle disk space exhaustion gracefully', async () => {
      // Mock writeFile to simulate ENOSPC error
      const originalWriteFile = fs.writeFile;

      // @ts-ignore - Mocking for testing
      fs.writeFile = vi.fn().mockRejectedValue(
        Object.assign(new Error('No space left on device'), { code: 'ENOSPC' })
      );

      try {
        const params: WriteFileParams = {
          filePath: 'disk-space-test.txt',
          content: 'This should fail due to no disk space'
        };

        const result = await writeTool.execute(params);

        expect(result.success).toBe(false);
        expect(result.error).toContain('No space left on device');

      } finally {
        // Restore original function
        Object.assign(fs, { writeFile: originalWriteFile });
      }
    });

    it('should handle permission changes during operation', async () => {
      // Create a file that we'll change permissions on
      await fs.writeFile('permission-test.txt', 'original content');

      // Mock copyFile to simulate permission error during backup
      const originalCopyFile = fs.copyFile;

      // @ts-ignore - Mocking for testing
      fs.copyFile = vi.fn().mockRejectedValue(
        Object.assign(new Error('Permission denied'), { code: 'EACCES' })
      );

      try {
        const params: WriteFileParams = {
          filePath: 'permission-test.txt',
          content: 'new content',
          overwrite: true,
          backup: true
        };

        const result = await writeTool.execute(params);

        expect(result.success).toBe(false);
        expect(result.error).toContain('Permission denied');

        // Verify original file is unchanged
        const content = await fs.readFile('permission-test.txt', 'utf-8');
        expect(content).toBe('original content');

      } finally {
        // Restore original function
        Object.assign(fs, { copyFile: originalCopyFile });
      }
    });
  });

  // ============================================================================
  // Security Edge Cases
  // ============================================================================

  describe('Security Edge Cases', () => {
    it('should handle various path traversal attempts', async () => {
      const maliciousPaths = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\config\\sam',
        './../../etc/shadow',
        'normal/../../../etc/hosts',
        'subdir/../../../../../../etc/passwd',
        path.join('..', '..', '..', 'etc', 'passwd')
      ];

      for (const maliciousPath of maliciousPaths) {
        const params: WriteFileParams = {
          filePath: maliciousPath,
          content: 'malicious content'
        };

        const result = await writeTool.execute(params);

        expect(result.success).toBe(false);
        expect(result.error).toContain('escapes working directory');
      }
    });

    it('should handle null byte injection attempts', async () => {
      const nullByteAttacks = [
        'file.txt\x00.exe',
        'normal\x00../../../etc/passwd',
        '\x00malicious',
        'file\x00name.txt'
      ];

      for (const attackPath of nullByteAttacks) {
        const params: WriteFileParams = {
          filePath: attackPath,
          content: 'content'
        };

        const result = writeTool.validate(params);

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('File path contains null bytes');
      }
    });

    it('should handle symbolic link manipulation attempts', async () => {
      // Create a symbolic link to a sensitive location
      const sensitiveTarget = path.join(tempDir, 'sensitive-data.txt');
      await fs.writeFile(sensitiveTarget, 'sensitive information');

      const linkPath = path.join(tempDir, 'innocent-link.txt');

      try {
        await fs.symlink(sensitiveTarget, linkPath);

        const params: WriteFileParams = {
          filePath: 'innocent-link.txt',
          content: 'overwritten content',
          overwrite: true
        };

        const result = await writeTool.execute(params);

        // Tool should follow the symlink and write to the target
        // This is expected behavior, but verifies it works correctly
        expect(result.success).toBe(true);

        // Verify the target file was actually modified
        const targetContent = await fs.readFile(sensitiveTarget, 'utf-8');
        expect(targetContent).toBe('overwritten content');

      } catch (error) {
        // Skip test if symlinks aren't supported (e.g., Windows without admin)
        console.log('Symlink test skipped:', error);
      }
    });
  });

  // ============================================================================
  // Platform-Specific Edge Cases
  // ============================================================================

  describe('Platform-Specific Edge Cases', () => {
    it('should handle platform-specific path separators', async () => {
      const testPaths = [
        'unix/style/path.txt',
        'unix\\mixed\\separators.txt',
        path.join('native', 'path', 'style.txt')
      ];

      for (const testPath of testPaths) {
        const params: WriteFileParams = {
          filePath: testPath,
          content: `Content for ${testPath}`,
          createDirectories: true
        };

        const result = await writeTool.execute(params);
        expect(result.success).toBe(true);

        // Verify file exists with normalized path
        const normalizedPath = path.normalize(testPath);
        const content = await fs.readFile(normalizedPath, 'utf-8');
        expect(content).toBe(`Content for ${testPath}`);
      }
    });

    it('should handle case sensitivity correctly', async () => {
      const params1: WriteFileParams = {
        filePath: 'CaseSensitive.txt',
        content: 'uppercase content'
      };

      const params2: WriteFileParams = {
        filePath: 'casesensitive.txt',
        content: 'lowercase content'
      };

      const result1 = await writeTool.execute(params1);
      const result2 = await writeTool.execute(params2);

      expect(result1.success).toBe(true);

      // On case-sensitive filesystems, both should succeed
      // On case-insensitive filesystems, second should fail or overwrite
      if (result2.success) {
        // Both files exist (case-sensitive filesystem)
        expect(await fs.readFile('CaseSensitive.txt', 'utf-8')).toBe('uppercase content');
        expect(await fs.readFile('casesensitive.txt', 'utf-8')).toBe('lowercase content');
      } else {
        // Case-insensitive filesystem - second write should fail
        expect(result2.error).toContain('File already exists');
      }
    });
  });
});