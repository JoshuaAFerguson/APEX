/**
 * @fileoverview Tests for ReadTool
 *
 * These tests verify the functionality of the ReadTool including:
 * - Basic file reading with line numbers
 * - Offset and limit parameters
 * - File type detection and handling
 * - Error handling for various scenarios
 * - Security validation
 *
 * @module @apex/core/tools/filesystem/__tests__/read-tool
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { ReadTool, type ReadToolInput, type ReadToolOutput } from '../read-tool.js';
import type { ToolExecutionContext } from '../../base-tool.js';

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Creates a temporary directory for tests
 */
async function createTempDir(): Promise<string> {
  return await fs.mkdtemp(path.join(os.tmpdir(), 'apex-read-tool-test-'));
}

/**
 * Creates a test file with specified content
 */
async function createTestFile(dir: string, filename: string, content: string): Promise<string> {
  const filePath = path.join(dir, filename);
  await fs.writeFile(filePath, content, 'utf8');
  return filePath;
}

/**
 * Creates a binary test file
 */
async function createBinaryFile(dir: string, filename: string): Promise<string> {
  const filePath = path.join(dir, filename);
  const buffer = Buffer.from([0x00, 0x01, 0x02, 0x03, 0xFF, 0xFE, 0xFD]);
  await fs.writeFile(filePath, buffer);
  return filePath;
}

/**
 * Cleanup function to remove temporary files and directories
 */
async function cleanup(tempDir: string): Promise<void> {
  try {
    await fs.rm(tempDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
}

// ============================================================================
// Test Suite
// ============================================================================

describe('ReadTool', () => {
  let tool: ReadTool;
  let tempDir: string;

  beforeEach(async () => {
    tool = new ReadTool();
    tempDir = await createTempDir();
  });

  afterEach(async () => {
    await cleanup(tempDir);
  });

  // ==========================================================================
  // Tool Definition Tests
  // ==========================================================================

  describe('Tool Definition', () => {
    it('should have correct tool definition', () => {
      const definition = tool.getDefinition();

      expect(definition.name).toBe('Read');
      expect(definition.description).toContain('line numbers');
      expect(definition.description).toContain('multimodal');
      expect(definition.category).toBe('filesystem');
      expect(definition.permissions).toContain('read');
      expect(definition.dangerous).toBe(false);
    });

    it('should have proper parameter schema', () => {
      const definition = tool.getDefinition();
      const params = definition.parameters;

      expect(params.type).toBe('object');
      expect(params.required).toContain('file_path');

      // Check file_path parameter
      expect(params.properties.file_path).toEqual({
        type: 'string',
        description: 'The absolute path to the file to read',
      });

      // Check offset parameter
      expect(params.properties.offset).toEqual({
        type: 'integer',
        description: 'The line number to start reading from (1-based, optional)',
        minimum: 1,
      });

      // Check limit parameter
      expect(params.properties.limit).toEqual({
        type: 'integer',
        description: 'The maximum number of lines to read (optional)',
        minimum: 1,
        maximum: 10000,
      });
    });

    it('should have usage examples', () => {
      const definition = tool.getDefinition();
      expect(definition.examples).toBeDefined();
      expect(definition.examples!.length).toBeGreaterThan(0);

      const examples = definition.examples!;
      expect(examples[0].name).toBe('Read entire file');
      expect(examples[1].name).toBe('Read with offset and limit');
      expect(examples[2].name).toBe('Read image file');
    });
  });

  // ==========================================================================
  // Validation Tests
  // ==========================================================================

  describe('Parameter Validation', () => {
    it('should validate required file_path parameter', () => {
      const result = tool.validate({} as ReadToolInput);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required parameter: file_path');
    });

    it('should reject empty file_path', () => {
      const result = tool.validate({ file_path: '' });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('file_path cannot be empty');
    });

    it('should reject relative paths', () => {
      const result = tool.validate({ file_path: 'relative/path.txt' });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('file_path must be an absolute path');
    });

    it('should validate offset parameter', () => {
      const result = tool.validate({
        file_path: '/test/file.txt',
        offset: 0,
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('offset must be a positive integer starting from 1');
    });

    it('should validate limit parameter', () => {
      const result = tool.validate({
        file_path: '/test/file.txt',
        limit: -1,
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('limit must be a positive integer');
    });

    it('should warn about large limits', () => {
      const result = tool.validate({
        file_path: '/test/file.txt',
        limit: 15000,
      });
      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('limit is very large (>10000) - this may consume significant memory');
    });

    it('should warn about system directories', () => {
      const result = tool.validate({ file_path: '/etc/passwd' });
      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('Accessing system directories - use caution');
    });

    it('should validate with context working directory', () => {
      const context: ToolExecutionContext = {
        workingDirectory: '/home/user/project',
      };

      const result = tool.validate({ file_path: '/tmp/external-file.txt' }, context);
      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('file_path is outside the working directory');
    });
  });

  // ==========================================================================
  // Text File Reading Tests
  // ==========================================================================

  describe('Text File Reading', () => {
    it('should read a simple text file with line numbers', async () => {
      const content = 'Line 1\\nLine 2\\nLine 3\\n';
      const filePath = await createTestFile(tempDir, 'test.txt', content);

      const result = await tool.execute({ file_path: filePath });

      expect(result.success).toBe(true);
      expect(result.output).toBeDefined();

      const output = result.output as ReadToolOutput;
      expect(output.totalLines).toBe(4); // 3 lines + empty line after last \\n
      expect(output.fileType).toBe('text');
      expect(output.encoding).toBe('utf8');
      expect(output.startLine).toBe(1);
      expect(output.truncated).toBe(false);

      // Check line number formatting
      const lines = output.content.split('\\n');
      expect(lines[0]).toMatch(/^\\s+1→Line 1$/);
      expect(lines[1]).toMatch(/^\\s+2→Line 2$/);
      expect(lines[2]).toMatch(/^\\s+3→Line 3$/);
    });

    it('should handle empty files', async () => {
      const filePath = await createTestFile(tempDir, 'empty.txt', '');

      const result = await tool.execute({ file_path: filePath });

      expect(result.success).toBe(true);
      const output = result.output as ReadToolOutput;
      expect(output.totalLines).toBe(1); // Empty file has one empty line
      expect(output.linesReturned).toBe(1);
      expect(output.content).toMatch(/^\\s+1→$/);
    });

    it('should apply offset parameter correctly', async () => {
      const content = Array.from({ length: 10 }, (_, i) => `Line ${i + 1}`).join('\\n');
      const filePath = await createTestFile(tempDir, 'offset-test.txt', content);

      const result = await tool.execute({ file_path: filePath, offset: 5 });

      expect(result.success).toBe(true);
      const output = result.output as ReadToolOutput;
      expect(output.startLine).toBe(5);
      expect(output.totalLines).toBe(10);
      expect(output.linesReturned).toBe(6); // Lines 5-10

      const lines = output.content.split('\\n');
      expect(lines[0]).toMatch(/^\\s+5→Line 5$/);
    });

    it('should apply limit parameter correctly', async () => {
      const content = Array.from({ length: 10 }, (_, i) => `Line ${i + 1}`).join('\\n');
      const filePath = await createTestFile(tempDir, 'limit-test.txt', content);

      const result = await tool.execute({ file_path: filePath, limit: 3 });

      expect(result.success).toBe(true);
      const output = result.output as ReadToolOutput;
      expect(output.linesReturned).toBe(3);
      expect(output.endLine).toBe(3);
      expect(output.truncated).toBe(true);

      const lines = output.content.split('\\n');
      expect(lines).toHaveLength(3);
      expect(lines[2]).toMatch(/^\\s+3→Line 3$/);
    });

    it('should combine offset and limit parameters', async () => {
      const content = Array.from({ length: 10 }, (_, i) => `Line ${i + 1}`).join('\\n');
      const filePath = await createTestFile(tempDir, 'offset-limit-test.txt', content);

      const result = await tool.execute({ file_path: filePath, offset: 3, limit: 4 });

      expect(result.success).toBe(true);
      const output = result.output as ReadToolOutput;
      expect(output.startLine).toBe(3);
      expect(output.endLine).toBe(6);
      expect(output.linesReturned).toBe(4);

      const lines = output.content.split('\\n');
      expect(lines[0]).toMatch(/^\\s+3→Line 3$/);
      expect(lines[3]).toMatch(/^\\s+6→Line 6$/);
    });

    it('should truncate very long lines', async () => {
      const longLine = 'x'.repeat(3000); // Longer than MAX_LINE_LENGTH (2000)
      const filePath = await createTestFile(tempDir, 'long-line.txt', longLine);

      const result = await tool.execute({ file_path: filePath });

      expect(result.success).toBe(true);
      const output = result.output as ReadToolOutput;
      expect(output.truncated).toBe(true);
      expect(output.content).toContain('... [truncated]');
    });

    it('should handle files with different line endings', async () => {
      const content = 'Line 1\\r\\nLine 2\\rLine 3\\n';
      const filePath = await createTestFile(tempDir, 'mixed-endings.txt', content);

      const result = await tool.execute({ file_path: filePath });

      expect(result.success).toBe(true);
      const output = result.output as ReadToolOutput;
      expect(output.totalLines).toBe(3);
    });
  });

  // ==========================================================================
  // Image File Handling Tests
  // ==========================================================================

  describe('Image File Handling', () => {
    it('should handle PNG image files', async () => {
      const filePath = path.join(tempDir, 'test.png');
      await fs.writeFile(filePath, Buffer.from('fake png content'));

      const result = await tool.execute({ file_path: filePath });

      expect(result.success).toBe(true);
      const output = result.output as ReadToolOutput;
      expect(output.fileType).toBe('image');
      expect(output.encoding).toBe('binary');
      expect(output.content).toContain('Image file: test.png');
      expect(output.content).toContain('Format: PNG');
    });

    it('should handle JPEG image files', async () => {
      const filePath = path.join(tempDir, 'photo.jpg');
      await fs.writeFile(filePath, Buffer.from('fake jpeg content'));

      const result = await tool.execute({ file_path: filePath });

      expect(result.success).toBe(true);
      const output = result.output as ReadToolOutput;
      expect(output.fileType).toBe('image');
      expect(output.content).toContain('Format: JPG');
    });

    it('should detect various image extensions', async () => {
      const extensions = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'svg', 'webp'];

      for (const ext of extensions) {
        const filePath = path.join(tempDir, `image.${ext}`);
        await fs.writeFile(filePath, Buffer.from('fake image content'));

        const result = await tool.execute({ file_path: filePath });

        expect(result.success).toBe(true);
        const output = result.output as ReadToolOutput;
        expect(output.fileType).toBe('image');
      }
    });
  });

  // ==========================================================================
  // PDF File Handling Tests
  // ==========================================================================

  describe('PDF File Handling', () => {
    it('should handle PDF files', async () => {
      const filePath = path.join(tempDir, 'document.pdf');
      await fs.writeFile(filePath, Buffer.from('%PDF-1.4 fake pdf content'));

      const result = await tool.execute({ file_path: filePath });

      expect(result.success).toBe(true);
      const output = result.output as ReadToolOutput;
      expect(output.fileType).toBe('pdf');
      expect(output.encoding).toBe('binary');
      expect(output.content).toContain('PDF document: document.pdf');
      expect(output.content).toContain('This is a PDF document');
    });
  });

  // ==========================================================================
  // Binary File Handling Tests
  // ==========================================================================

  describe('Binary File Handling', () => {
    it('should handle binary files by extension', async () => {
      const filePath = path.join(tempDir, 'program.exe');
      await createBinaryFile(tempDir, 'program.exe');

      const result = await tool.execute({ file_path: filePath });

      expect(result.success).toBe(true);
      const output = result.output as ReadToolOutput;
      expect(output.fileType).toBe('binary');
      expect(output.encoding).toBe('binary');
      expect(output.content).toContain('Binary file: program.exe');
      expect(output.content).toContain('Type: EXE');
    });

    it('should detect binary content in files without binary extension', async () => {
      const filePath = path.join(tempDir, 'binary-data.txt');
      await createBinaryFile(tempDir, 'binary-data.txt');

      const result = await tool.execute({ file_path: filePath });

      expect(result.success).toBe(true);
      const output = result.output as ReadToolOutput;
      expect(output.fileType).toBe('binary');
    });
  });

  // ==========================================================================
  // Error Handling Tests
  // ==========================================================================

  describe('Error Handling', () => {
    it('should handle non-existent files', async () => {
      const filePath = path.join(tempDir, 'does-not-exist.txt');

      const result = await tool.execute({ file_path: filePath });

      expect(result.success).toBe(false);
      expect(result.error).toContain('File not found');
    });

    it('should handle directories', async () => {
      const result = await tool.execute({ file_path: tempDir });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Path is a directory, not a file');
    });

    it('should handle permission errors', async () => {
      const filePath = await createTestFile(tempDir, 'test.txt', 'content');

      // Make file unreadable (if possible on this system)
      try {
        await fs.chmod(filePath, 0o000);

        const result = await tool.execute({ file_path: filePath });

        if (result.success === false) {
          expect(result.error).toContain('Permission denied');
        }
      } catch {
        // Skip this test if chmod fails (e.g., on Windows)
      } finally {
        // Restore permissions for cleanup
        try {
          await fs.chmod(filePath, 0o644);
        } catch {
          // Ignore
        }
      }
    });

    it('should respect cancellation signal', async () => {
      const content = 'Test content';
      const filePath = await createTestFile(tempDir, 'test.txt', content);

      const controller = new AbortController();
      const context: ToolExecutionContext = {
        signal: controller.signal,
      };

      // Cancel immediately
      controller.abort();

      const result = await tool.execute({ file_path: filePath }, context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('cancelled');
    });
  });

  // ==========================================================================
  // Edge Cases and Performance Tests
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle very large offset beyond file length', async () => {
      const content = 'Line 1\\nLine 2\\nLine 3';
      const filePath = await createTestFile(tempDir, 'test.txt', content);

      const result = await tool.execute({ file_path: filePath, offset: 100 });

      expect(result.success).toBe(true);
      const output = result.output as ReadToolOutput;
      expect(output.linesReturned).toBe(0);
      expect(output.content).toBe('');
    });

    it('should handle zero-byte files', async () => {
      const filePath = path.join(tempDir, 'zero-byte.txt');
      await fs.writeFile(filePath, '');

      const result = await tool.execute({ file_path: filePath });

      expect(result.success).toBe(true);
      const output = result.output as ReadToolOutput;
      expect(output.fileSize).toBe(0);
    });

    it('should handle files with unicode content', async () => {
      const content = 'Unicode: 🚀 中文 العربية Ελληνικά';
      const filePath = await createTestFile(tempDir, 'unicode.txt', content);

      const result = await tool.execute({ file_path: filePath });

      expect(result.success).toBe(true);
      const output = result.output as ReadToolOutput;
      expect(output.content).toContain('🚀 中文 العربية Ελληνικά');
    });

    it('should provide consistent line number padding', async () => {
      const content = Array.from({ length: 1000 }, (_, i) => `Line ${i + 1}`).join('\\n');
      const filePath = await createTestFile(tempDir, 'many-lines.txt', content);

      const result = await tool.execute({ file_path: filePath, offset: 999, limit: 2 });

      expect(result.success).toBe(true);
      const output = result.output as ReadToolOutput;
      const lines = output.content.split('\\n');

      // Both line numbers should have same width (right-aligned)
      expect(lines[0]).toMatch(/^\\s+999→/);
      expect(lines[1]).toMatch(/^\\s+1000→/);

      // Check that the padding is consistent
      const line999 = lines[0].split('→')[0];
      const line1000 = lines[1].split('→')[0];
      expect(line999.length).toBe(line1000.length);
    });
  });
});