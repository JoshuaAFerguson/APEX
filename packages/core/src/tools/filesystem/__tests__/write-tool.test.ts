/**
 * @fileoverview Tests for WriteTool
 *
 * This test suite provides comprehensive coverage for the WriteTool, ensuring
 * correct behavior across various scenarios including:
 * - File creation and writing
 * - Overwrite protection and explicit overwrite
 * - Directory creation
 * - Backup functionality
 * - Path validation and security
 * - Error handling for various file system errors
 * - Platform-specific path handling
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

describe('WriteTool', () => {
  let writeTool: WriteTool;
  let tempDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    writeTool = new WriteTool();

    // Create a temporary directory for tests
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'write-tool-test-'));

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
  // Tool Definition Tests
  // ============================================================================

  describe('Tool Definition', () => {
    it('should have correct tool definition', () => {
      const definition = writeTool.getDefinition();

      expect(definition.name).toBe('Write');
      expect(definition.description).toBe('Write content to a file with optional overwrite protection and backup');
      expect(definition.category).toBe('filesystem');
      expect(definition.permissions).toContain('write');
      expect(definition.dangerous).toBe(false);
      expect(definition.version).toBe('1.0.0');
      expect(definition.tags).toEqual(['file', 'write', 'create', 'filesystem']);
    });

    it('should have correct parameter schema', () => {
      const definition = writeTool.getDefinition();
      const { properties, required } = definition.parameters;

      expect(required).toEqual(['filePath', 'content']);
      expect(properties?.filePath).toMatchObject({
        type: 'string',
        description: 'Path to the file (absolute or relative to working directory)',
        minLength: 1
      });
      expect(properties?.content).toMatchObject({
        type: 'string',
        description: 'Content to write to the file'
      });
      expect(properties?.encoding?.enum).toEqual([
        'utf-8', 'ascii', 'utf16le', 'latin1', 'base64', 'hex'
      ]);
    });

    it('should have usage examples', () => {
      const definition = writeTool.getDefinition();

      expect(definition.examples).toHaveLength(2);
      expect(definition.examples?.[0].name).toBe('Create new file');
      expect(definition.examples?.[1].name).toBe('Overwrite with backup');
    });
  });

  // ============================================================================
  // Validation Tests
  // ============================================================================

  describe('Parameter Validation', () => {
    it('should validate required parameters', () => {
      const params = {} as WriteFileParams;
      const result = writeTool.validate(params);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required parameter: filePath');
      expect(result.errors).toContain('Missing required parameter: content');
    });

    it('should validate empty file path', () => {
      const params: WriteFileParams = {
        filePath: '',
        content: 'test content'
      };
      const result = writeTool.validate(params);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('File path cannot be empty');
    });

    it('should validate file path with null bytes', () => {
      const params: WriteFileParams = {
        filePath: 'test\0file.txt',
        content: 'test content'
      };
      const result = writeTool.validate(params);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('File path contains null bytes');
    });

    it('should validate encoding parameter', () => {
      const params: WriteFileParams = {
        filePath: 'test.txt',
        content: 'test content',
        encoding: 'invalid' as BufferEncoding
      };
      const result = writeTool.validate(params);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'Invalid encoding \'invalid\'. Must be one of: utf-8, ascii, utf16le, latin1, base64, hex'
      );
    });

    it('should warn about backup without overwrite', () => {
      const params: WriteFileParams = {
        filePath: 'test.txt',
        content: 'test content',
        backup: true,
        overwrite: false
      };
      const result = writeTool.validate(params);

      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('Backup flag is ignored when overwrite is false');
    });

    it('should validate correct parameters', () => {
      const params: WriteFileParams = {
        filePath: 'test.txt',
        content: 'test content',
        encoding: 'utf-8',
        overwrite: false,
        createDirectories: true
      };
      const result = writeTool.validate(params);

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });
  });

  // ============================================================================
  // File Creation Tests
  // ============================================================================

  describe('File Creation', () => {
    it('should create a new file with content', async () => {
      const params: WriteFileParams = {
        filePath: 'test.txt',
        content: 'Hello, World!'
      };

      const result = await writeTool.execute(params);

      expect(result.success).toBe(true);
      expect(result.output?.created).toBe(true);
      expect(result.output?.filePath).toBe(path.resolve(tempDir, 'test.txt'));
      expect(result.output?.bytesWritten).toBeGreaterThan(0);

      // Verify file was actually created
      const fileContent = await fs.readFile('test.txt', 'utf-8');
      expect(fileContent).toBe('Hello, World!');
    });

    it('should create file with specific encoding', async () => {
      const params: WriteFileParams = {
        filePath: 'test-binary.txt',
        content: 'Hello, World!',
        encoding: 'base64'
      };

      const result = await writeTool.execute(params);

      expect(result.success).toBe(true);
      expect(result.output?.created).toBe(true);

      // Verify content is base64 encoded
      const fileContent = await fs.readFile('test-binary.txt', 'utf-8');
      expect(fileContent).toBe(Buffer.from('Hello, World!', 'utf-8').toString('base64'));
    });

    it('should create nested directories when createDirectories is true', async () => {
      const params: WriteFileParams = {
        filePath: 'nested/deep/directory/test.txt',
        content: 'nested content',
        createDirectories: true
      };

      const result = await writeTool.execute(params);

      expect(result.success).toBe(true);
      expect(result.output?.created).toBe(true);
      expect(result.output?.directoriesCreated).toBeDefined();
      expect(result.output?.directoriesCreated?.[0]).toBe(path.resolve(tempDir, 'nested/deep/directory'));

      // Verify file exists
      const fileContent = await fs.readFile('nested/deep/directory/test.txt', 'utf-8');
      expect(fileContent).toBe('nested content');
    });

    it('should use working directory from context', async () => {
      const nestedDir = path.join(tempDir, 'context-test');
      await fs.mkdir(nestedDir, { recursive: true });

      const context: ToolExecutionContext = {
        workingDirectory: nestedDir
      };

      const params: WriteFileParams = {
        filePath: 'context-file.txt',
        content: 'context content'
      };

      const result = await writeTool.execute(params, context);

      expect(result.success).toBe(true);
      expect(result.output?.filePath).toBe(path.resolve(nestedDir, 'context-file.txt'));

      // Verify file exists in context directory
      const fileContent = await fs.readFile(path.join(nestedDir, 'context-file.txt'), 'utf-8');
      expect(fileContent).toBe('context content');
    });
  });

  // ============================================================================
  // Overwrite Protection Tests
  // ============================================================================

  describe('Overwrite Protection', () => {
    beforeEach(async () => {
      // Create an existing file
      await fs.writeFile('existing.txt', 'original content');
    });

    it('should prevent overwriting existing file by default', async () => {
      const params: WriteFileParams = {
        filePath: 'existing.txt',
        content: 'new content'
      };

      const result = await writeTool.execute(params);

      expect(result.success).toBe(false);
      expect(result.error).toContain('File already exists');
      expect(result.error).toContain('Set overwrite=true to replace');

      // Verify original content is preserved
      const fileContent = await fs.readFile('existing.txt', 'utf-8');
      expect(fileContent).toBe('original content');
    });

    it('should allow overwriting when overwrite=true', async () => {
      const params: WriteFileParams = {
        filePath: 'existing.txt',
        content: 'new content',
        overwrite: true
      };

      const result = await writeTool.execute(params);

      expect(result.success).toBe(true);
      expect(result.output?.created).toBe(false);
      expect(result.output?.bytesWritten).toBeGreaterThan(0);

      // Verify content was updated
      const fileContent = await fs.readFile('existing.txt', 'utf-8');
      expect(fileContent).toBe('new content');
    });

    it('should create backup when requested', async () => {
      const params: WriteFileParams = {
        filePath: 'existing.txt',
        content: 'new content',
        overwrite: true,
        backup: true
      };

      const result = await writeTool.execute(params);

      expect(result.success).toBe(true);
      expect(result.output?.backupPath).toBe(path.resolve(tempDir, 'existing.txt.bak'));

      // Verify backup contains original content
      const backupContent = await fs.readFile('existing.txt.bak', 'utf-8');
      expect(backupContent).toBe('original content');

      // Verify main file has new content
      const fileContent = await fs.readFile('existing.txt', 'utf-8');
      expect(fileContent).toBe('new content');
    });
  });

  // ============================================================================
  // Path Security Tests
  // ============================================================================

  describe('Path Security', () => {
    it('should prevent path traversal attacks', async () => {
      const params: WriteFileParams = {
        filePath: '../../../etc/passwd',
        content: 'malicious content'
      };

      const result = await writeTool.execute(params);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Path');
      expect(result.error).toContain('escapes working directory');
    });

    it('should block writing to sensitive system paths', async () => {
      const params: WriteFileParams = {
        filePath: '/etc/hosts',
        content: 'malicious content'
      };

      const context: ToolExecutionContext = {
        workingDirectory: '/'
      };

      const result = await writeTool.execute(params, context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Writing to sensitive path');
    });

    it('should allow relative paths within working directory', async () => {
      const params: WriteFileParams = {
        filePath: './subdir/safe-file.txt',
        content: 'safe content',
        createDirectories: true
      };

      const result = await writeTool.execute(params);

      expect(result.success).toBe(true);
      expect(result.output?.filePath).toBe(path.resolve(tempDir, 'subdir/safe-file.txt'));
    });

    it('should handle absolute paths within working directory', async () => {
      const safePath = path.join(tempDir, 'absolute-safe.txt');
      const params: WriteFileParams = {
        filePath: safePath,
        content: 'absolute safe content'
      };

      const result = await writeTool.execute(params);

      expect(result.success).toBe(true);
      expect(result.output?.filePath).toBe(safePath);
    });
  });

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  describe('Error Handling', () => {
    it('should handle permission denied errors', async () => {
      // Create a read-only directory
      const readOnlyDir = path.join(tempDir, 'readonly');
      await fs.mkdir(readOnlyDir);
      await fs.chmod(readOnlyDir, 0o444); // Read-only

      const params: WriteFileParams = {
        filePath: path.join(readOnlyDir, 'test.txt'),
        content: 'test content'
      };

      try {
        const result = await writeTool.execute(params);
        expect(result.success).toBe(false);
        expect(result.error).toContain('Permission denied');
      } finally {
        // Restore permissions for cleanup
        await fs.chmod(readOnlyDir, 0o755);
      }
    });

    it('should handle missing parent directory when createDirectories=false', async () => {
      const params: WriteFileParams = {
        filePath: 'nonexistent/directory/test.txt',
        content: 'test content',
        createDirectories: false
      };

      const result = await writeTool.execute(params);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Parent directory does not exist');
    });

    it('should handle writing to a directory path', async () => {
      await fs.mkdir('test-dir');

      const params: WriteFileParams = {
        filePath: 'test-dir',
        content: 'test content'
      };

      const result = await writeTool.execute(params);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot write to directory');
    });

    it('should clean up temporary files on error', async () => {
      // Mock fs.rename to throw an error
      const originalRename = fs.rename;
      vi.mocked(fs).rename = vi.fn().mockRejectedValue(new Error('Rename failed'));

      const params: WriteFileParams = {
        filePath: 'test-cleanup.txt',
        content: 'test content'
      };

      try {
        const result = await writeTool.execute(params);
        expect(result.success).toBe(false);
      } finally {
        // Restore original function
        vi.mocked(fs).rename = originalRename;
      }

      // Verify no temporary files are left
      const files = await fs.readdir(tempDir);
      const tempFiles = files.filter(file => file.includes('.tmp.'));
      expect(tempFiles).toHaveLength(0);
    });
  });

  // ============================================================================
  // Integration Tests
  // ============================================================================

  describe('Integration Tests', () => {
    it('should handle abort signal during execution', async () => {
      const controller = new AbortController();
      const context: ToolExecutionContext = {
        signal: controller.signal
      };

      // Abort immediately
      controller.abort();

      const params: WriteFileParams = {
        filePath: 'aborted-test.txt',
        content: 'test content'
      };

      const result = await writeTool.execute(params, context);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Execution aborted');
      expect(result.duration).toBeDefined();
      expect(result.toolName).toBe('Write');
    });

    it('should track execution timing', async () => {
      const params: WriteFileParams = {
        filePath: 'timing-test.txt',
        content: 'test content'
      };

      const result = await writeTool.execute(params);

      expect(result.success).toBe(true);
      expect(result.duration).toBeGreaterThan(0);
      expect(result.invokedAt).toBeInstanceOf(Date);
      expect(result.completedAt).toBeInstanceOf(Date);
      expect(result.toolName).toBe('Write');
    });

    it('should handle complex file operations', async () => {
      // Create a complex scenario: nested directories, existing file, backup
      await fs.mkdir('complex/existing', { recursive: true });
      await fs.writeFile('complex/existing/config.json', '{"old": true}');

      const params: WriteFileParams = {
        filePath: 'complex/existing/config.json',
        content: '{"new": true, "updated": "2024"}',
        overwrite: true,
        backup: true,
        encoding: 'utf-8'
      };

      const result = await writeTool.execute(params);

      expect(result.success).toBe(true);
      expect(result.output?.created).toBe(false);
      expect(result.output?.backupPath).toBeDefined();
      expect(result.output?.bytesWritten).toBeGreaterThan(0);

      // Verify all files exist and have correct content
      const newContent = await fs.readFile('complex/existing/config.json', 'utf-8');
      expect(JSON.parse(newContent)).toEqual({ new: true, updated: '2024' });

      const backupContent = await fs.readFile('complex/existing/config.json.bak', 'utf-8');
      expect(JSON.parse(backupContent)).toEqual({ old: true });
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle empty content', async () => {
      const params: WriteFileParams = {
        filePath: 'empty.txt',
        content: ''
      };

      const result = await writeTool.execute(params);

      expect(result.success).toBe(true);
      expect(result.output?.bytesWritten).toBe(0);

      const fileContent = await fs.readFile('empty.txt', 'utf-8');
      expect(fileContent).toBe('');
    });

    it('should handle very long file paths', async () => {
      const longPath = 'a'.repeat(255) + '.txt'; // Near filesystem limit
      const params: WriteFileParams = {
        filePath: longPath,
        content: 'long path content'
      };

      const result = await writeTool.execute(params);

      // Result depends on filesystem - might succeed or fail with ENAMETOOLONG
      if (result.success) {
        expect(result.output?.filePath).toContain(longPath);
      } else {
        expect(result.error).toContain('Path exceeds maximum length');
      }
    });

    it('should handle special characters in file names', async () => {
      const specialName = 'test-file-with-special-chars-äöü-日本語.txt';
      const params: WriteFileParams = {
        filePath: specialName,
        content: 'Special characters content: äöü 日本語'
      };

      const result = await writeTool.execute(params);

      expect(result.success).toBe(true);

      const fileContent = await fs.readFile(specialName, 'utf-8');
      expect(fileContent).toBe('Special characters content: äöü 日本語');
    });
  });
});