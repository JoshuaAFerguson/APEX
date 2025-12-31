/**
 * @fileoverview Coverage-focused tests for WriteTool
 *
 * This test suite focuses on achieving comprehensive code coverage for WriteTool,
 * ensuring all code paths, error conditions, and edge cases are tested.
 * These tests complement the main test suite by targeting specific coverage gaps.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { WriteTool, type WriteFileParams, PathTraversalError, SensitivePathError } from '../write-tool.js';
import type { ToolExecutionContext } from '../../base-tool.js';

// ============================================================================
// Test Setup
// ============================================================================

describe('WriteTool Coverage Tests', () => {
  let writeTool: WriteTool;
  let tempDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    writeTool = new WriteTool();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'write-tool-coverage-'));
    originalCwd = process.cwd();
    process.chdir(tempDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to clean up temp directory:', error);
    }
  });

  // ============================================================================
  // Constructor and Static Properties Coverage
  // ============================================================================

  describe('Constructor and Static Properties', () => {
    it('should initialize with correct tool definition properties', () => {
      const definition = writeTool.getDefinition();

      expect(definition.name).toBe('Write');
      expect(definition.description).toBe('Write content to a file with optional overwrite protection and backup');
      expect(definition.category).toBe('filesystem');
      expect(definition.permissions).toContain('write');
      expect(definition.dangerous).toBe(false);
      expect(definition.version).toBe('1.0.0');
      expect(definition.tags).toEqual(['file', 'write', 'create', 'filesystem']);
    });

    it('should have correct parameter schema structure', () => {
      const definition = writeTool.getDefinition();
      const schema = definition.parameters;

      expect(schema.type).toBe('object');
      expect(schema.required).toEqual(['filePath', 'content']);
      expect(schema.additionalProperties).toBe(false);

      // Check all properties exist
      expect(schema.properties).toHaveProperty('filePath');
      expect(schema.properties).toHaveProperty('content');
      expect(schema.properties).toHaveProperty('encoding');
      expect(schema.properties).toHaveProperty('overwrite');
      expect(schema.properties).toHaveProperty('createDirectories');
      expect(schema.properties).toHaveProperty('backup');

      // Check encoding enum values
      expect(schema.properties!.encoding!.enum).toEqual([
        'utf-8', 'ascii', 'utf16le', 'latin1', 'base64', 'hex'
      ]);
    });

    it('should have correct usage examples', () => {
      const definition = writeTool.getDefinition();
      const examples = definition.examples;

      expect(examples).toHaveLength(2);
      expect(examples![0].name).toBe('Create new file');
      expect(examples![1].name).toBe('Overwrite with backup');
      expect(examples![1].input).toHaveProperty('backup', true);
    });
  });

  // ============================================================================
  // Validation Coverage
  // ============================================================================

  describe('Validation Coverage', () => {
    it('should validate with minimal valid parameters', () => {
      const params: WriteFileParams = {
        filePath: 'test.txt',
        content: 'content'
      };

      const result = writeTool.validate(params);
      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
      expect(result.warnings).toBeUndefined();
    });

    it('should validate with all optional parameters', () => {
      const params: WriteFileParams = {
        filePath: 'test.txt',
        content: 'content',
        encoding: 'utf-8',
        overwrite: true,
        createDirectories: true,
        backup: true
      };

      const result = writeTool.validate(params);
      expect(result.valid).toBe(true);
      expect(result.warnings).toBeUndefined();
    });

    it('should validate all supported encodings', () => {
      const supportedEncodings: Array<BufferEncoding> = [
        'utf-8', 'ascii', 'utf16le', 'latin1', 'base64', 'hex'
      ];

      for (const encoding of supportedEncodings) {
        const params: WriteFileParams = {
          filePath: 'test.txt',
          content: 'content',
          encoding
        };

        const result = writeTool.validate(params);
        expect(result.valid).toBe(true);
      }
    });

    it('should handle whitespace-only file paths', () => {
      const params: WriteFileParams = {
        filePath: '   \t\n   ',
        content: 'content'
      };

      const result = writeTool.validate(params);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('File path cannot be empty');
    });

    it('should detect various null byte positions', () => {
      const nullBytePositions = [
        '\0start',
        'mid\0dle',
        'end\0',
        'multiple\0null\0bytes'
      ];

      for (const filePath of nullBytePositions) {
        const params: WriteFileParams = {
          filePath,
          content: 'content'
        };

        const result = writeTool.validate(params);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('File path contains null bytes');
      }
    });

    it('should warn about backup without overwrite in all combinations', () => {
      const combinations = [
        { backup: true, overwrite: false },
        { backup: true, overwrite: undefined }
      ];

      for (const combo of combinations) {
        const params: WriteFileParams = {
          filePath: 'test.txt',
          content: 'content',
          ...combo
        };

        const result = writeTool.validate(params);
        expect(result.valid).toBe(true);
        expect(result.warnings).toContain('Backup flag is ignored when overwrite is false');
      }
    });
  });

  // ============================================================================
  // Path Validation Coverage
  // ============================================================================

  describe('Path Validation Coverage', () => {
    it('should test all sensitive path patterns', async () => {
      const sensitivePaths = [
        '/etc/passwd',
        '/usr/bin/test',
        '/bin/bash',
        '/sbin/init',
        '/boot/grub',
        '/dev/null',
        '/proc/version',
        '/sys/kernel',
        'C:\\Windows\\System32',
        'C:\\Program Files\\test',
        'C:\\Program Files (x86)\\test'
      ];

      for (const sensitivePath of sensitivePaths) {
        const params: WriteFileParams = {
          filePath: sensitivePath,
          content: 'malicious content'
        };

        const context: ToolExecutionContext = {
          workingDirectory: process.platform === 'win32' ? 'C:\\' : '/'
        };

        const result = await writeTool.execute(params, context);
        expect(result.success).toBe(false);
        expect(result.error).toContain('Writing to sensitive path');
      }
    });

    it('should handle complex path traversal patterns', async () => {
      const traversalPatterns = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\config\\sam',
        './../../etc/shadow',
        'subdir/../../../etc/hosts',
        'normal/../../../../../../etc/passwd',
        path.join('..', '..', '..', 'etc', 'passwd')
      ];

      for (const pattern of traversalPatterns) {
        const params: WriteFileParams = {
          filePath: pattern,
          content: 'malicious content'
        };

        const result = await writeTool.execute(params);
        expect(result.success).toBe(false);
        expect(result.error).toContain('escapes working directory');
      }
    });

    it('should handle edge case paths within working directory', async () => {
      const safePaths = [
        './test.txt',
        '.\\test.txt',
        'subdir/../test.txt',
        'subdir/./test.txt',
        path.join('.', 'test.txt'),
        path.normalize('./test.txt')
      ];

      for (const safePath of safePaths) {
        const params: WriteFileParams = {
          filePath: safePath,
          content: 'safe content',
          createDirectories: true
        };

        const result = await writeTool.execute(params);
        expect(result.success).toBe(true);
      }
    });
  });

  // ============================================================================
  // Error Enhancement Coverage
  // ============================================================================

  describe('Error Enhancement Coverage', () => {
    it('should enhance all supported error codes', async () => {
      const errorCodes = ['ENOENT', 'EACCES', 'ENOSPC', 'ENAMETOOLONG', 'EISDIR', 'EMFILE', 'ENFILE'];

      for (const code of errorCodes) {
        // Mock fs operations to throw specific errors
        const mockError = Object.assign(new Error('Mock error'), { code });
        const originalWriteFile = fs.writeFile;

        // @ts-ignore - Mocking for testing
        fs.writeFile = vi.fn().mockRejectedValue(mockError);

        try {
          const params: WriteFileParams = {
            filePath: 'error-test.txt',
            content: 'test content'
          };

          const result = await writeTool.execute(params);
          expect(result.success).toBe(false);

          // Verify specific error message enhancement
          switch (code) {
            case 'ENOENT':
              expect(result.error).toContain('Parent directory does not exist');
              break;
            case 'EACCES':
              expect(result.error).toContain('Permission denied');
              break;
            case 'ENOSPC':
              expect(result.error).toContain('No space left on device');
              break;
            case 'ENAMETOOLONG':
              expect(result.error).toContain('Path exceeds maximum length');
              break;
            case 'EISDIR':
              expect(result.error).toContain('Cannot write to directory');
              break;
            case 'EMFILE':
            case 'ENFILE':
              expect(result.error).toContain('Too many open files');
              break;
          }

        } finally {
          // Restore original function
          Object.assign(fs, { writeFile: originalWriteFile });
        }
      }
    });

    it('should handle unknown error types', async () => {
      const unknownErrors = [
        'Simple string error',
        42,
        null,
        undefined,
        { weird: 'object' }
      ];

      for (const unknownError of unknownErrors) {
        const originalWriteFile = fs.writeFile;

        // @ts-ignore - Mocking for testing
        fs.writeFile = vi.fn().mockRejectedValue(unknownError);

        try {
          const params: WriteFileParams = {
            filePath: 'error-test.txt',
            content: 'test content'
          };

          const result = await writeTool.execute(params);
          expect(result.success).toBe(false);
          expect(result.error).toContain('Unknown error writing to');

        } finally {
          Object.assign(fs, { writeFile: originalWriteFile });
        }
      }
    });

    it('should handle Error objects without code property', async () => {
      const plainError = new Error('Plain error without code');
      const originalWriteFile = fs.writeFile;

      // @ts-ignore - Mocking for testing
      fs.writeFile = vi.fn().mockRejectedValue(plainError);

      try {
        const params: WriteFileParams = {
          filePath: 'error-test.txt',
          content: 'test content'
        };

        const result = await writeTool.execute(params);
        expect(result.success).toBe(false);
        expect(result.error).toContain('Error writing to');
        expect(result.error).toContain('Plain error without code');

      } finally {
        Object.assign(fs, { writeFile: originalWriteFile });
      }
    });
  });

  // ============================================================================
  // Execution Context Coverage
  // ============================================================================

  describe('Execution Context Coverage', () => {
    it('should use process.cwd() when no context provided', async () => {
      const params: WriteFileParams = {
        filePath: 'no-context-test.txt',
        content: 'test content'
      };

      const result = await writeTool.execute(params);
      expect(result.success).toBe(true);
      expect(result.output?.filePath).toBe(path.resolve(process.cwd(), 'no-context-test.txt'));
    });

    it('should use context working directory when provided', async () => {
      const contextDir = path.join(tempDir, 'context-dir');
      await fs.mkdir(contextDir, { recursive: true });

      const context: ToolExecutionContext = {
        workingDirectory: contextDir
      };

      const params: WriteFileParams = {
        filePath: 'context-test.txt',
        content: 'test content'
      };

      const result = await writeTool.execute(params, context);
      expect(result.success).toBe(true);
      expect(result.output?.filePath).toBe(path.join(contextDir, 'context-test.txt'));

      // Verify file was created in correct directory
      const content = await fs.readFile(path.join(contextDir, 'context-test.txt'), 'utf-8');
      expect(content).toBe('test content');
    });
  });

  // ============================================================================
  // Default Parameter Coverage
  // ============================================================================

  describe('Default Parameter Coverage', () => {
    it('should use default encoding when not specified', async () => {
      const params: WriteFileParams = {
        filePath: 'default-encoding-test.txt',
        content: 'Test with default encoding: äöü'
      };

      const result = await writeTool.execute(params);
      expect(result.success).toBe(true);

      // Verify content is written with UTF-8 encoding
      const buffer = await fs.readFile('default-encoding-test.txt');
      const content = buffer.toString('utf-8');
      expect(content).toBe('Test with default encoding: äöü');
    });

    it('should use default overwrite=false when not specified', async () => {
      // Create initial file
      await fs.writeFile('default-overwrite-test.txt', 'original content');

      const params: WriteFileParams = {
        filePath: 'default-overwrite-test.txt',
        content: 'new content'
      };

      const result = await writeTool.execute(params);
      expect(result.success).toBe(false);
      expect(result.error).toContain('File already exists');

      // Verify original content is preserved
      const content = await fs.readFile('default-overwrite-test.txt', 'utf-8');
      expect(content).toBe('original content');
    });

    it('should use default createDirectories=true when not specified', async () => {
      const params: WriteFileParams = {
        filePath: 'deep/nested/default-create-dirs.txt',
        content: 'content with auto-created directories'
      };

      const result = await writeTool.execute(params);
      expect(result.success).toBe(true);
      expect(result.output?.directoriesCreated).toBeDefined();

      // Verify file exists
      const content = await fs.readFile('deep/nested/default-create-dirs.txt', 'utf-8');
      expect(content).toBe('content with auto-created directories');
    });

    it('should use default backup=false when not specified', async () => {
      // Create initial file
      await fs.writeFile('default-backup-test.txt', 'original content');

      const params: WriteFileParams = {
        filePath: 'default-backup-test.txt',
        content: 'new content',
        overwrite: true
      };

      const result = await writeTool.execute(params);
      expect(result.success).toBe(true);
      expect(result.output?.backupPath).toBeUndefined();

      // Verify no backup file was created
      try {
        await fs.access('default-backup-test.txt.bak');
        expect(false).toBe(true); // Should not reach here
      } catch (error) {
        // Expected - backup file should not exist
        expect(error).toBeDefined();
      }
    });
  });

  // ============================================================================
  // Atomic Operation Coverage
  // ============================================================================

  describe('Atomic Operation Coverage', () => {
    it('should create unique temporary file names', async () => {
      // Mock Date.now to return predictable values
      const originalDateNow = Date.now;
      let callCount = 0;
      Date.now = vi.fn().mockImplementation(() => {
        return originalDateNow() + callCount++;
      });

      try {
        const promises: Promise<any>[] = [];

        // Create multiple concurrent writes to trigger unique temp file names
        for (let i = 0; i < 5; i++) {
          const params: WriteFileParams = {
            filePath: `atomic-test-${i}.txt`,
            content: `content ${i}`
          };
          promises.push(writeTool.execute(params));
        }

        const results = await Promise.all(promises);
        expect(results.every(result => result.success)).toBe(true);

        // Verify all files were created correctly
        for (let i = 0; i < 5; i++) {
          const content = await fs.readFile(`atomic-test-${i}.txt`, 'utf-8');
          expect(content).toBe(`content ${i}`);
        }

      } finally {
        Date.now = originalDateNow;
      }
    });

    it('should clean up temporary file on rename failure', async () => {
      const originalRename = fs.rename;

      // Mock fs.rename to fail
      // @ts-ignore - Mocking for testing
      fs.rename = vi.fn().mockRejectedValue(new Error('Rename failed'));

      try {
        const params: WriteFileParams = {
          filePath: 'cleanup-test.txt',
          content: 'test content'
        };

        const result = await writeTool.execute(params);
        expect(result.success).toBe(false);

        // Verify no temporary files are left
        const files = await fs.readdir(tempDir);
        const tempFiles = files.filter(file => file.includes('.tmp.'));
        expect(tempFiles).toHaveLength(0);

      } finally {
        Object.assign(fs, { rename: originalRename });
      }
    });

    it('should ignore cleanup errors for temporary files', async () => {
      const originalRename = fs.rename;
      const originalUnlink = fs.unlink;

      // Mock both operations to fail
      // @ts-ignore - Mocking for testing
      fs.rename = vi.fn().mockRejectedValue(new Error('Rename failed'));
      // @ts-ignore - Mocking for testing
      fs.unlink = vi.fn().mockRejectedValue(new Error('Unlink failed'));

      try {
        const params: WriteFileParams = {
          filePath: 'ignore-cleanup-errors-test.txt',
          content: 'test content'
        };

        const result = await writeTool.execute(params);
        expect(result.success).toBe(false);
        expect(result.error).toContain('Rename failed'); // Original error, not cleanup error

      } finally {
        Object.assign(fs, { rename: originalRename, unlink: originalUnlink });
      }
    });
  });

  // ============================================================================
  // Directory Creation Coverage
  // ============================================================================

  describe('Directory Creation Coverage', () => {
    it('should not create directories when createDirectories=false', async () => {
      const params: WriteFileParams = {
        filePath: 'nonexistent/directory/test.txt',
        content: 'test content',
        createDirectories: false
      };

      const result = await writeTool.execute(params);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Parent directory does not exist');
    });

    it('should handle directory creation when parent already exists', async () => {
      // Create parent directory first
      await fs.mkdir('existing-dir', { recursive: true });

      const params: WriteFileParams = {
        filePath: 'existing-dir/test.txt',
        content: 'test content',
        createDirectories: true
      };

      const result = await writeTool.execute(params);
      expect(result.success).toBe(true);
      expect(result.output?.directoriesCreated).toBeUndefined(); // No new directories created

      const content = await fs.readFile('existing-dir/test.txt', 'utf-8');
      expect(content).toBe('test content');
    });
  });
});