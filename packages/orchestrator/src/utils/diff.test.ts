/**
 * Unit Tests for diff.ts utility functions
 *
 * Tests diff generation functionality including:
 * - generateDiff with various content types
 * - generateFileDiff with file system operations
 * - Edge cases and error scenarios
 * - Performance with large files
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { generateDiff, generateFileDiff, type DiffOptions } from './diff';

// Mock fs module
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));

const mockedFs = vi.mocked(fs);

describe('Diff Utility Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('generateDiff', () => {
    it('should return no differences for identical content', () => {
      const options: DiffOptions = {
        filePath: '/test/file.txt',
        originalContent: 'line 1\nline 2\nline 3',
        newContent: 'line 1\nline 2\nline 3',
      };

      const result = generateDiff(options);

      expect(result).toEqual({
        hasDifferences: false,
        diff: '',
        addedLines: 0,
        removedLines: 0,
        modifiedLines: 0,
      });
    });

    it('should generate diff for single line addition', () => {
      const options: DiffOptions = {
        filePath: '/test/file.txt',
        originalContent: 'line 1\nline 2',
        newContent: 'line 1\nline 2\nline 3',
      };

      const result = generateDiff(options);

      expect(result.hasDifferences).toBe(true);
      expect(result.addedLines).toBe(1);
      expect(result.removedLines).toBe(0);
      expect(result.modifiedLines).toBe(1);
      expect(result.diff).toContain('+line 3');
      expect(result.diff).toContain('--- a/test/file.txt');
      expect(result.diff).toContain('+++ b/test/file.txt');
    });

    it('should generate diff for single line removal', () => {
      const options: DiffOptions = {
        filePath: '/test/file.txt',
        originalContent: 'line 1\nline 2\nline 3',
        newContent: 'line 1\nline 2',
      };

      const result = generateDiff(options);

      expect(result.hasDifferences).toBe(true);
      expect(result.addedLines).toBe(0);
      expect(result.removedLines).toBe(1);
      expect(result.modifiedLines).toBe(1);
      expect(result.diff).toContain('-line 3');
    });

    it('should generate diff for line modification', () => {
      const options: DiffOptions = {
        filePath: '/test/file.txt',
        originalContent: 'line 1\noriginal line\nline 3',
        newContent: 'line 1\nmodified line\nline 3',
      };

      const result = generateDiff(options);

      expect(result.hasDifferences).toBe(true);
      expect(result.addedLines).toBe(1);
      expect(result.removedLines).toBe(1);
      expect(result.modifiedLines).toBe(2);
      expect(result.diff).toContain('-original line');
      expect(result.diff).toContain('+modified line');
    });

    it('should normalize Windows-style file paths in diff header', () => {
      const options: DiffOptions = {
        filePath: 'C:\\test\\file.txt',
        originalContent: 'original',
        newContent: 'modified',
      };

      const result = generateDiff(options);

      expect(result.diff).toContain('--- a/C:/test/file.txt');
      expect(result.diff).toContain('+++ b/C:/test/file.txt');
    });

    it('should handle empty files correctly', () => {
      const options: DiffOptions = {
        filePath: '/test/empty.txt',
        originalContent: '',
        newContent: 'first line\nsecond line',
      };

      const result = generateDiff(options);

      expect(result.hasDifferences).toBe(true);
      expect(result.addedLines).toBe(2);
      expect(result.removedLines).toBe(0);
      expect(result.diff).toContain('+first line');
      expect(result.diff).toContain('+second line');
    });

    it('should handle file deletion (new content is empty)', () => {
      const options: DiffOptions = {
        filePath: '/test/deleted.txt',
        originalContent: 'line 1\nline 2',
        newContent: '',
      };

      const result = generateDiff(options);

      expect(result.hasDifferences).toBe(true);
      expect(result.addedLines).toBe(0);
      expect(result.removedLines).toBe(2);
      expect(result.diff).toContain('-line 1');
      expect(result.diff).toContain('-line 2');
    });

    it('should respect custom context lines parameter', () => {
      const options: DiffOptions = {
        filePath: '/test/file.txt',
        originalContent: 'line 1\nline 2\nline 3\nline 4\nline 5\nline 6\nline 7',
        newContent: 'line 1\nline 2\nline 3\nmodified\nline 5\nline 6\nline 7',
        contextLines: 1,
      };

      const result = generateDiff(options);

      expect(result.hasDifferences).toBe(true);
      // With contextLines: 1, we should see less context around the change
      const diffLines = result.diff.split('\n');
      const contextLines = diffLines.filter(line => line.startsWith(' '));
      expect(contextLines.length).toBeLessThanOrEqual(6); // 3 lines before + 3 lines after with contextLines=1
    });

    it('should handle large content efficiently', () => {
      // Generate a large file with 1000 lines
      const originalLines = Array.from({ length: 1000 }, (_, i) => `line ${i + 1}`);
      const newLines = [...originalLines];
      newLines[500] = 'modified line 501'; // Modify one line in the middle

      const options: DiffOptions = {
        filePath: '/test/large.txt',
        originalContent: originalLines.join('\n'),
        newContent: newLines.join('\n'),
      };

      const start = Date.now();
      const result = generateDiff(options);
      const duration = Date.now() - start;

      expect(result.hasDifferences).toBe(true);
      expect(result.addedLines).toBe(1);
      expect(result.removedLines).toBe(1);
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle unicode content correctly', () => {
      const options: DiffOptions = {
        filePath: '/test/unicode.txt',
        originalContent: 'Hello 世界\n🔥 emoji test',
        newContent: 'Hello 世界\n⚡ emoji test',
      };

      const result = generateDiff(options);

      expect(result.hasDifferences).toBe(true);
      expect(result.diff).toContain('-🔥 emoji test');
      expect(result.diff).toContain('+⚡ emoji test');
    });

    it('should handle content with special diff characters', () => {
      const options: DiffOptions = {
        filePath: '/test/special.txt',
        originalContent: '--- header\n+++ another header\n@@@ hunk marker',
        newContent: '--- header\n+++ another header\n### modified marker',
      };

      const result = generateDiff(options);

      expect(result.hasDifferences).toBe(true);
      expect(result.diff).toContain('-@@@ hunk marker');
      expect(result.diff).toContain('+### modified marker');
    });
  });

  describe('generateFileDiff', () => {
    it('should read existing file and generate diff', () => {
      const originalContent = 'line 1\nline 2\nline 3';
      const newContent = 'line 1\nmodified line 2\nline 3';
      const filePath = '/test/existing.txt';

      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(originalContent);

      const result = generateFileDiff(filePath, newContent);

      expect(mockedFs.existsSync).toHaveBeenCalledWith(filePath);
      expect(mockedFs.readFileSync).toHaveBeenCalledWith(filePath, 'utf-8');
      expect(result.hasDifferences).toBe(true);
      expect(result.diff).toContain('-line 2');
      expect(result.diff).toContain('+modified line 2');
    });

    it('should treat non-existent file as empty and generate diff for new file', () => {
      const newContent = 'new file content\nsecond line';
      const filePath = '/test/new.txt';

      mockedFs.existsSync.mockReturnValue(false);

      const result = generateFileDiff(filePath, newContent);

      expect(mockedFs.existsSync).toHaveBeenCalledWith(filePath);
      expect(mockedFs.readFileSync).not.toHaveBeenCalled();
      expect(result.hasDifferences).toBe(true);
      expect(result.addedLines).toBe(2);
      expect(result.removedLines).toBe(0);
      expect(result.diff).toContain('+new file content');
      expect(result.diff).toContain('+second line');
    });

    it('should handle file read errors gracefully', () => {
      const newContent = 'new content';
      const filePath = '/test/unreadable.txt';

      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const result = generateFileDiff(filePath, newContent);

      expect(result.hasDifferences).toBe(true);
      expect(result.addedLines).toBe(1);
      expect(result.removedLines).toBe(0);
      expect(result.diff).toContain('+new content');
    });

    it('should handle file system errors during existsSync', () => {
      const newContent = 'new content';
      const filePath = '/test/error.txt';

      mockedFs.existsSync.mockImplementation(() => {
        throw new Error('File system error');
      });

      // Should not throw and treat as new file
      const result = generateFileDiff(filePath, newContent);

      expect(result.hasDifferences).toBe(true);
      expect(result.addedLines).toBe(1);
      expect(result.diff).toContain('+new content');
    });

    it('should handle identical content with existing file', () => {
      const content = 'identical content\nline 2';
      const filePath = '/test/same.txt';

      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(content);

      const result = generateFileDiff(filePath, content);

      expect(result.hasDifferences).toBe(false);
      expect(result.diff).toBe('');
      expect(result.addedLines).toBe(0);
      expect(result.removedLines).toBe(0);
    });

    it('should handle empty new content (file deletion scenario)', () => {
      const originalContent = 'content to delete\nline 2';
      const filePath = '/test/delete.txt';

      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(originalContent);

      const result = generateFileDiff(filePath, '');

      expect(result.hasDifferences).toBe(true);
      expect(result.addedLines).toBe(0);
      expect(result.removedLines).toBe(2);
      expect(result.diff).toContain('-content to delete');
      expect(result.diff).toContain('-line 2');
    });
  });

  describe('Edge Cases and Performance', () => {
    it('should handle very long lines efficiently', () => {
      const longLine = 'a'.repeat(10000);
      const options: DiffOptions = {
        filePath: '/test/long.txt',
        originalContent: `${longLine}\nshort line`,
        newContent: `${longLine.replace(/a/g, 'b')}\nshort line`,
      };

      const start = Date.now();
      const result = generateDiff(options);
      const duration = Date.now() - start;

      expect(result.hasDifferences).toBe(true);
      expect(duration).toBeLessThan(500); // Should complete within 500ms
    });

    it('should handle files with no newline at end', () => {
      const options: DiffOptions = {
        filePath: '/test/no-newline.txt',
        originalContent: 'line without newline',
        newContent: 'modified line without newline',
      };

      const result = generateDiff(options);

      expect(result.hasDifferences).toBe(true);
      expect(result.diff).toContain('-line without newline');
      expect(result.diff).toContain('+modified line without newline');
    });

    it('should handle mixed line endings (CRLF vs LF)', () => {
      const options: DiffOptions = {
        filePath: '/test/mixed-endings.txt',
        originalContent: 'line 1\r\nline 2\r\n', // CRLF
        newContent: 'line 1\nline 2\n', // LF
      };

      const result = generateDiff(options);

      expect(result.hasDifferences).toBe(true);
      // The diff should detect the line ending differences
    });

    it('should handle files with only whitespace changes', () => {
      const options: DiffOptions = {
        filePath: '/test/whitespace.txt',
        originalContent: 'line 1\n  line 2  \nline 3',
        newContent: 'line 1\n    line 2\nline 3',
      };

      const result = generateDiff(options);

      expect(result.hasDifferences).toBe(true);
      expect(result.diff).toContain('-  line 2  ');
      expect(result.diff).toContain('+    line 2');
    });

    it('should handle completely different content', () => {
      const options: DiffOptions = {
        filePath: '/test/different.txt',
        originalContent: 'original\ncontent\nhere',
        newContent: 'completely\ndifferent\ncontent\nnow',
      };

      const result = generateDiff(options);

      expect(result.hasDifferences).toBe(true);
      expect(result.addedLines).toBeGreaterThan(0);
      expect(result.removedLines).toBeGreaterThan(0);
    });
  });
});