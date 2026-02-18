/**
 * @fileoverview Tests for EditTool
 *
 * This test suite covers the EditTool functionality including:
 * - Parameter validation
 * - String replacement scenarios
 * - Error handling
 * - File operations
 * - Security features
 *
 * @module @apex/core/tools/filesystem/__tests__/edit-tool.test
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { EditTool, StringNotFoundError, AmbiguousReplacementError, IdenticalStringsError, FileAccessError } from '../edit-tool.js';
import type { EditFileParams } from '../edit-tool.js';

describe('EditTool', () => {
  let editTool: EditTool;
  let tempDir: string;
  let testFile: string;

  beforeEach(async () => {
    editTool = new EditTool();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-edit-test-'));
    testFile = path.join(tempDir, 'test.txt');
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Tool Definition', () => {
    it('should have correct tool definition', () => {
      const definition = editTool.getDefinition();

      expect(definition.name).toBe('Edit');
      expect(definition.description).toContain('surgical edits');
      expect(definition.category).toBe('filesystem');
      expect(definition.permissions).toContain('read');
      expect(definition.permissions).toContain('write');
      expect(definition.dangerous).toBe(false);
    });

    it('should have proper parameter schema', () => {
      const definition = editTool.getDefinition();
      const params = definition.parameters;

      expect(params.type).toBe('object');
      expect(params.required).toEqual(['file_path', 'old_string', 'new_string']);
      expect(params.properties).toHaveProperty('file_path');
      expect(params.properties).toHaveProperty('old_string');
      expect(params.properties).toHaveProperty('new_string');
      expect(params.properties).toHaveProperty('replace_all');
    });

    it('should have usage examples', () => {
      const definition = editTool.getDefinition();

      expect(definition.examples).toBeDefined();
      expect(definition.examples!.length).toBeGreaterThan(0);
      expect(definition.examples![0]).toHaveProperty('name');
      expect(definition.examples![0]).toHaveProperty('input');
    });
  });

  describe('Parameter Validation', () => {
    it('should validate valid parameters', () => {
      const params: EditFileParams = {
        file_path: '/test/file.txt',
        old_string: 'hello',
        new_string: 'world'
      };

      const result = editTool.validate(params);
      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should reject empty file path', () => {
      const params: EditFileParams = {
        file_path: '',
        old_string: 'hello',
        new_string: 'world'
      };

      const result = editTool.validate(params);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('File path cannot be empty');
    });

    it('should reject empty old_string', () => {
      const params: EditFileParams = {
        file_path: '/test/file.txt',
        old_string: '',
        new_string: 'world'
      };

      const result = editTool.validate(params);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('old_string cannot be empty');
    });

    it('should reject identical old_string and new_string', () => {
      const params: EditFileParams = {
        file_path: '/test/file.txt',
        old_string: 'same',
        new_string: 'same'
      };

      const result = editTool.validate(params);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('old_string and new_string must be different');
    });

    it('should reject file path with null bytes', () => {
      const params: EditFileParams = {
        file_path: '/test\0/file.txt',
        old_string: 'hello',
        new_string: 'world'
      };

      const result = editTool.validate(params);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('File path contains null bytes');
    });

    it('should warn about whitespace-only old_string', () => {
      const params: EditFileParams = {
        file_path: '/test/file.txt',
        old_string: '   ',
        new_string: 'world'
      };

      const result = editTool.validate(params);
      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('old_string contains only whitespace - this may have unintended effects');
    });

    it('should warn about very long old_string', () => {
      const params: EditFileParams = {
        file_path: '/test/file.txt',
        old_string: 'a'.repeat(10001),
        new_string: 'world'
      };

      const result = editTool.validate(params);
      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('old_string is very long (>10KB) - this may impact performance');
    });
  });

  describe('File Operations', () => {
    it('should perform simple string replacement', async () => {
      const content = 'Hello world!\nThis is a test file.\nGoodbye world!';
      await fs.writeFile(testFile, content, 'utf-8');

      const result = await editTool.execute({
        file_path: testFile,
        old_string: 'world',
        new_string: 'universe'
      });

      expect(result.success).toBe(true);
      expect(result.output?.replacements).toBe(1);
      expect(result.output?.modifiedLines).toEqual([1]);

      const newContent = await fs.readFile(testFile, 'utf-8');
      expect(newContent).toBe('Hello universe!\nThis is a test file.\nGoodbye world!');
    });

    it('should replace all occurrences when replace_all is true', async () => {
      const content = 'Hello world!\nThis is a test file.\nGoodbye world!';
      await fs.writeFile(testFile, content, 'utf-8');

      const result = await editTool.execute({
        file_path: testFile,
        old_string: 'world',
        new_string: 'universe',
        replace_all: true
      });

      expect(result.success).toBe(true);
      expect(result.output?.replacements).toBe(2);
      expect(result.output?.modifiedLines).toEqual([1, 3]);

      const newContent = await fs.readFile(testFile, 'utf-8');
      expect(newContent).toBe('Hello universe!\nThis is a test file.\nGoodbye universe!');
    });

    it('should handle multi-line string replacement', async () => {
      const content = 'function test() {\n  console.log("old");\n  return true;\n}';
      await fs.writeFile(testFile, content, 'utf-8');

      const result = await editTool.execute({
        file_path: testFile,
        old_string: 'function test() {\n  console.log("old");',
        new_string: 'function test() {\n  console.log("new");'
      });

      expect(result.success).toBe(true);
      expect(result.output?.replacements).toBe(1);
      expect(result.output?.modifiedLines).toEqual([1, 2]);

      const newContent = await fs.readFile(testFile, 'utf-8');
      expect(newContent).toBe('function test() {\n  console.log("new");\n  return true;\n}');
    });

    it('should preserve indentation and formatting', async () => {
      const content = '    function indent() {\n        return "preserved";\n    }';
      await fs.writeFile(testFile, content, 'utf-8');

      const result = await editTool.execute({
        file_path: testFile,
        old_string: '"preserved"',
        new_string: '"maintained"'
      });

      expect(result.success).toBe(true);

      const newContent = await fs.readFile(testFile, 'utf-8');
      expect(newContent).toBe('    function indent() {\n        return "maintained";\n    }');
    });

    it('should provide change preview', async () => {
      const content = 'line1\nline2\nline3\nline4\nline5';
      await fs.writeFile(testFile, content, 'utf-8');

      const result = await editTool.execute({
        file_path: testFile,
        old_string: 'line3',
        new_string: 'LINE3'
      });

      expect(result.success).toBe(true);
      expect(result.output?.changePreview).toContain('- 3: line3');
      expect(result.output?.changePreview).toContain('+ 3: LINE3');
    });

    it('should track size changes', async () => {
      const content = 'short';
      await fs.writeFile(testFile, content, 'utf-8');

      const result = await editTool.execute({
        file_path: testFile,
        old_string: 'short',
        new_string: 'much longer text'
      });

      expect(result.success).toBe(true);
      expect(result.output?.sizeChange.before).toBe(5);
      expect(result.output?.sizeChange.after).toBe(16);
    });

    it('should handle empty string replacement', async () => {
      const content = 'Remove this text please.';
      await fs.writeFile(testFile, content, 'utf-8');

      const result = await editTool.execute({
        file_path: testFile,
        old_string: ' this text',
        new_string: ''
      });

      expect(result.success).toBe(true);
      expect(result.output?.replacements).toBe(1);

      const newContent = await fs.readFile(testFile, 'utf-8');
      expect(newContent).toBe('Remove please.');
    });

    it('should handle large strings', async () => {
      const smallContent = 'a'.repeat(1000);
      const largeContent = 'b'.repeat(5000);
      await fs.writeFile(testFile, smallContent, 'utf-8');

      const result = await editTool.execute({
        file_path: testFile,
        old_string: smallContent,
        new_string: largeContent
      });

      expect(result.success).toBe(true);
      expect(result.output?.replacements).toBe(1);

      const newContent = await fs.readFile(testFile, 'utf-8');
      expect(newContent).toBe(largeContent);
    });
  });

  describe('Error Handling', () => {
    it('should fail when file does not exist', async () => {
      const nonExistentFile = path.join(tempDir, 'nonexistent.txt');

      const result = await editTool.execute({
        file_path: nonExistentFile,
        old_string: 'test',
        new_string: 'replacement'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot access file');
    });

    it('should fail when string not found', async () => {
      const content = 'Hello world!';
      await fs.writeFile(testFile, content, 'utf-8');

      const result = await editTool.execute({
        file_path: testFile,
        old_string: 'not found',
        new_string: 'replacement'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('String not found');
    });

    it('should fail when multiple occurrences found but replace_all is false', async () => {
      const content = 'test test test';
      await fs.writeFile(testFile, content, 'utf-8');

      const result = await editTool.execute({
        file_path: testFile,
        old_string: 'test',
        new_string: 'replacement',
        replace_all: false
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('appears 3 times');
      expect(result.error).toContain('Use replace_all=true');
    });

    it('should fail when file is too large', async () => {
      // Create a file larger than the limit
      const largeContent = 'a'.repeat(51 * 1024 * 1024); // 51MB
      const largeFile = path.join(tempDir, 'large.txt');
      await fs.writeFile(largeFile, largeContent, 'utf-8');

      const result = await editTool.execute({
        file_path: largeFile,
        old_string: 'a',
        new_string: 'b'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('File too large');
    });

    it('should fail when trying to edit sensitive paths', async () => {
      const result = await editTool.execute({
        file_path: '/etc/passwd',
        old_string: 'root',
        new_string: 'admin'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('sensitive path');
    });

    it('should restore file on write failure', async () => {
      const content = 'original content';
      await fs.writeFile(testFile, content, 'utf-8');

      // Make file read-only to cause write failure
      await fs.chmod(testFile, 0o444);

      const result = await editTool.execute({
        file_path: testFile,
        old_string: 'original',
        new_string: 'modified'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot write file');

      // File should still have original content
      const restoredContent = await fs.readFile(testFile, 'utf-8');
      expect(restoredContent).toBe(content);
    });
  });

  describe('Special Cases', () => {
    it('should handle files with different encodings', async () => {
      // Test with UTF-8 content including special characters
      const content = 'Hello 世界! Здравствуй мир! 🌍';
      await fs.writeFile(testFile, content, 'utf-8');

      const result = await editTool.execute({
        file_path: testFile,
        old_string: '世界',
        new_string: 'World'
      });

      expect(result.success).toBe(true);

      const newContent = await fs.readFile(testFile, 'utf-8');
      expect(newContent).toBe('Hello World! Здравствуй мир! 🌍');
    });

    it('should handle files with mixed line endings', async () => {
      const content = 'Line 1\nLine 2\r\nLine 3\rLine 4';
      await fs.writeFile(testFile, content, 'utf-8');

      const result = await editTool.execute({
        file_path: testFile,
        old_string: 'Line 2',
        new_string: 'Modified Line 2'
      });

      expect(result.success).toBe(true);

      const newContent = await fs.readFile(testFile, 'utf-8');
      expect(newContent).toBe('Line 1\nModified Line 2\r\nLine 3\rLine 4');
    });

    it('should handle empty files', async () => {
      await fs.writeFile(testFile, '', 'utf-8');

      const result = await editTool.execute({
        file_path: testFile,
        old_string: 'anything',
        new_string: 'nothing'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('String not found');
    });

    it('should handle files with only newlines', async () => {
      const content = '\n\n\n';
      await fs.writeFile(testFile, content, 'utf-8');

      const result = await editTool.execute({
        file_path: testFile,
        old_string: '\n',
        new_string: '\r\n',
        replace_all: true
      });

      expect(result.success).toBe(true);
      expect(result.output?.replacements).toBe(3);

      const newContent = await fs.readFile(testFile, 'utf-8');
      expect(newContent).toBe('\r\n\r\n\r\n');
    });

    it('should handle regex special characters in strings', async () => {
      const content = 'Price: $10.99 (special offer!)';
      await fs.writeFile(testFile, content, 'utf-8');

      const result = await editTool.execute({
        file_path: testFile,
        old_string: '$10.99 (special offer!)',
        new_string: '$15.99 (new price!)'
      });

      expect(result.success).toBe(true);

      const newContent = await fs.readFile(testFile, 'utf-8');
      expect(newContent).toBe('Price: $15.99 (new price!)');
    });
  });

  describe('Execution Context', () => {
    it('should handle execution context with working directory', async () => {
      const subDir = path.join(tempDir, 'subdir');
      await fs.mkdir(subDir);

      const relativeFile = path.join(subDir, 'relative.txt');
      const content = 'test content';
      await fs.writeFile(relativeFile, content, 'utf-8');

      const context = { workingDirectory: tempDir };
      const result = await editTool.execute({
        file_path: path.join('subdir', 'relative.txt'),
        old_string: 'test',
        new_string: 'modified'
      }, context);

      expect(result.success).toBe(true);

      const newContent = await fs.readFile(relativeFile, 'utf-8');
      expect(newContent).toBe('modified content');
    });

    it('should handle abort signal', async () => {
      const content = 'test content';
      await fs.writeFile(testFile, content, 'utf-8');

      const controller = new AbortController();
      controller.abort();

      const context = { signal: controller.signal };
      const result = await editTool.execute({
        file_path: testFile,
        old_string: 'test',
        new_string: 'modified'
      }, context);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Execution aborted');
    });
  });

  describe('Edge Cases', () => {
    it('should handle overlapping string matches', async () => {
      const content = 'aaaaa';
      await fs.writeFile(testFile, content, 'utf-8');

      const result = await editTool.execute({
        file_path: testFile,
        old_string: 'aa',
        new_string: 'bb',
        replace_all: true
      });

      expect(result.success).toBe(true);
      // Should replace non-overlapping occurrences
      expect(result.output?.replacements).toBeGreaterThan(0);
    });

    it('should handle very small replacements', async () => {
      const content = 'abcd';
      await fs.writeFile(testFile, content, 'utf-8');

      const result = await editTool.execute({
        file_path: testFile,
        old_string: 'b',
        new_string: 'x'
      });

      expect(result.success).toBe(true);
      expect(result.output?.replacements).toBe(1);

      const newContent = await fs.readFile(testFile, 'utf-8');
      expect(newContent).toBe('axcd');
    });

    it('should handle replacement at file boundaries', async () => {
      const content = 'start middle end';
      await fs.writeFile(testFile, content, 'utf-8');

      // Test replacement at start
      let result = await editTool.execute({
        file_path: testFile,
        old_string: 'start',
        new_string: 'beginning'
      });

      expect(result.success).toBe(true);
      let newContent = await fs.readFile(testFile, 'utf-8');
      expect(newContent).toBe('beginning middle end');

      // Test replacement at end
      result = await editTool.execute({
        file_path: testFile,
        old_string: 'end',
        new_string: 'finish'
      });

      expect(result.success).toBe(true);
      newContent = await fs.readFile(testFile, 'utf-8');
      expect(newContent).toBe('beginning middle finish');
    });
  });
});