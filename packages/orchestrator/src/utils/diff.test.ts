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

    it('should handle zero context lines', () => {
      const options: DiffOptions = {
        filePath: '/test/zero-context.txt',
        originalContent: 'line 1\nline 2\nline 3\nline 4\nline 5',
        newContent: 'line 1\nmodified line 2\nline 3\nline 4\nline 5',
        contextLines: 0,
      };

      const result = generateDiff(options);

      expect(result.hasDifferences).toBe(true);
      expect(result.diff).toContain('-line 2');
      expect(result.diff).toContain('+modified line 2');
      // With 0 context, should only show the changed lines
      expect(result.diff.split('\n').filter(line => line.startsWith(' ')).length).toBe(0);
    });

    it('should handle very large context lines parameter', () => {
      const options: DiffOptions = {
        filePath: '/test/large-context.txt',
        originalContent: 'line 1\nline 2\nline 3\nline 4\nline 5',
        newContent: 'line 1\nmodified line 2\nline 3\nline 4\nline 5',
        contextLines: 100, // Much larger than file length
      };

      const result = generateDiff(options);

      expect(result.hasDifferences).toBe(true);
      // Should include all available context lines
      expect(result.diff).toContain(' line 1');
      expect(result.diff).toContain(' line 3');
      expect(result.diff).toContain(' line 4');
      expect(result.diff).toContain(' line 5');
    });

    it('should handle binary-like content with null bytes', () => {
      const options: DiffOptions = {
        filePath: '/test/binary.bin',
        originalContent: 'text\x00binary\x00content',
        newContent: 'text\x00modified\x00content',
      };

      const result = generateDiff(options);

      expect(result.hasDifferences).toBe(true);
      expect(result.diff).toContain('-text\x00binary\x00content');
      expect(result.diff).toContain('+text\x00modified\x00content');
    });

    it('should handle multiple non-contiguous changes', () => {
      const options: DiffOptions = {
        filePath: '/test/multiple-changes.txt',
        originalContent: 'line 1\nline 2\nline 3\nline 4\nline 5\nline 6\nline 7\nline 8\nline 9\nline 10',
        newContent: 'modified 1\nline 2\nline 3\nmodified 4\nline 5\nline 6\nline 7\nmodified 8\nline 9\nline 10',
        contextLines: 1,
      };

      const result = generateDiff(options);

      expect(result.hasDifferences).toBe(true);
      expect(result.addedLines).toBe(3);
      expect(result.removedLines).toBe(3);
      // Should generate multiple hunks for non-contiguous changes
      expect(result.diff.split('@@').length).toBeGreaterThan(3); // Multiple hunk markers
    });

    it('should handle insertions at beginning and end of file', () => {
      const options: DiffOptions = {
        filePath: '/test/begin-end.txt',
        originalContent: 'middle line 1\nmiddle line 2',
        newContent: 'start line\nmiddle line 1\nmiddle line 2\nend line',
      };

      const result = generateDiff(options);

      expect(result.hasDifferences).toBe(true);
      expect(result.addedLines).toBe(2);
      expect(result.removedLines).toBe(0);
      expect(result.diff).toContain('+start line');
      expect(result.diff).toContain('+end line');
    });

    it('should handle alternating line changes', () => {
      const options: DiffOptions = {
        filePath: '/test/alternating.txt',
        originalContent: 'keep 1\nchange 1\nkeep 2\nchange 2\nkeep 3',
        newContent: 'keep 1\nmodified 1\nkeep 2\nmodified 2\nkeep 3',
      };

      const result = generateDiff(options);

      expect(result.hasDifferences).toBe(true);
      expect(result.addedLines).toBe(2);
      expect(result.removedLines).toBe(2);
      expect(result.diff).toContain('-change 1');
      expect(result.diff).toContain('+modified 1');
      expect(result.diff).toContain('-change 2');
      expect(result.diff).toContain('+modified 2');
    });

    it('should handle content with special regex characters', () => {
      const options: DiffOptions = {
        filePath: '/test/regex-chars.txt',
        originalContent: 'function test() { return /.*[a-z]+$/; }',
        newContent: 'function test() { return /.*[A-Z]+$/; }',
      };

      const result = generateDiff(options);

      expect(result.hasDifferences).toBe(true);
      expect(result.diff).toContain('-function test() { return /.*[a-z]+$/; }');
      expect(result.diff).toContain('+function test() { return /.*[A-Z]+$/; }');
    });

    it('should handle very short files with changes', () => {
      const options: DiffOptions = {
        filePath: '/test/short.txt',
        originalContent: 'a',
        newContent: 'b',
      };

      const result = generateDiff(options);

      expect(result.hasDifferences).toBe(true);
      expect(result.addedLines).toBe(1);
      expect(result.removedLines).toBe(1);
      expect(result.diff).toContain('-a');
      expect(result.diff).toContain('+b');
    });
  });

  describe('Advanced Diff Algorithm Edge Cases', () => {
    it('should handle interleaved additions and deletions', () => {
      const options: DiffOptions = {
        filePath: '/test/interleaved.txt',
        originalContent: 'A\nB\nC\nD\nE',
        newContent: 'A\nX\nB\nY\nC\nZ\nD\nE',
      };

      const result = generateDiff(options);

      expect(result.hasDifferences).toBe(true);
      expect(result.addedLines).toBe(3);
      expect(result.removedLines).toBe(0);
      expect(result.diff).toContain('+X');
      expect(result.diff).toContain('+Y');
      expect(result.diff).toContain('+Z');
    });

    it('should handle block moves (lines moving position)', () => {
      const options: DiffOptions = {
        filePath: '/test/moves.txt',
        originalContent: 'line 1\nline 2\nline 3\nline 4',
        newContent: 'line 3\nline 4\nline 1\nline 2',
      };

      const result = generateDiff(options);

      expect(result.hasDifferences).toBe(true);
      // The algorithm should detect this as additions and deletions
      expect(result.addedLines).toBeGreaterThan(0);
      expect(result.removedLines).toBeGreaterThan(0);
    });

    it('should handle duplicate lines with changes', () => {
      const options: DiffOptions = {
        filePath: '/test/duplicates.txt',
        originalContent: 'line A\nline A\nline B\nline A',
        newContent: 'line A\nline A\nmodified B\nline A',
      };

      const result = generateDiff(options);

      expect(result.hasDifferences).toBe(true);
      expect(result.addedLines).toBe(1);
      expect(result.removedLines).toBe(1);
      expect(result.diff).toContain('-line B');
      expect(result.diff).toContain('+modified B');
    });

    it('should handle complex hunking scenarios', () => {
      const options: DiffOptions = {
        filePath: '/test/complex-hunks.txt',
        originalContent: Array.from({length: 20}, (_, i) => `line ${i + 1}`).join('\n'),
        newContent: Array.from({length: 20}, (_, i) => {
          if (i === 2) return `modified line ${i + 1}`;
          if (i === 15) return `modified line ${i + 1}`;
          return `line ${i + 1}`;
        }).join('\n'),
        contextLines: 2,
      };

      const result = generateDiff(options);

      expect(result.hasDifferences).toBe(true);
      expect(result.addedLines).toBe(2);
      expect(result.removedLines).toBe(2);
      // Should create separate hunks for distant changes
      const hunkCount = (result.diff.match(/@@/g) || []).length;
      expect(hunkCount).toBe(4); // 2 hunk starts + 2 hunk ends
    });
  });

  describe('Internal Algorithm Stress Tests', () => {
    it('should handle pathological diff scenarios efficiently', () => {
      // Test case that stresses the lookahead algorithm
      const originalLines = Array.from({length: 50}, (_, i) => `line ${i % 5}`);
      const newLines = Array.from({length: 50}, (_, i) => `modified ${i % 5}`);

      const options: DiffOptions = {
        filePath: '/test/pathological.txt',
        originalContent: originalLines.join('\n'),
        newContent: newLines.join('\n'),
        contextLines: 3,
      };

      const start = Date.now();
      const result = generateDiff(options);
      const duration = Date.now() - start;

      expect(result.hasDifferences).toBe(true);
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
      expect(result.addedLines).toBe(50);
      expect(result.removedLines).toBe(50);
    });

    it('should handle edge case in hunk grouping with exact context boundary', () => {
      // Create content where changes are exactly at context boundary distances
      const originalLines = Array.from({length: 15}, (_, i) => `line ${i + 1}`);
      const newLines = [...originalLines];
      newLines[2] = 'modified 3'; // Change at line 3
      newLines[8] = 'modified 9'; // Change at line 9 (5 lines apart)

      const options: DiffOptions = {
        filePath: '/test/hunk-boundary.txt',
        originalContent: originalLines.join('\n'),
        newContent: newLines.join('\n'),
        contextLines: 2, // 2 context lines means 4 lines between changes creates separate hunks
      };

      const result = generateDiff(options);

      expect(result.hasDifferences).toBe(true);
      expect(result.addedLines).toBe(2);
      expect(result.removedLines).toBe(2);

      // Should create separate hunks since changes are 5 lines apart with contextLines=2
      const hunkHeaders = result.diff.match(/@@ .* @@/g);
      expect(hunkHeaders).toBeTruthy();
      expect(hunkHeaders!.length).toBe(2); // Two separate hunks
    });

    it('should handle uniform diff header path normalization edge cases', () => {
      const testCases = [
        { path: '/unix/path/file.txt', expected: '/unix/path/file.txt' },
        { path: 'C:\\Windows\\Path\\file.txt', expected: 'C:/Windows/Path/file.txt' },
        { path: '\\\\network\\share\\file.txt', expected: '//network/share/file.txt' },
        { path: 'relative/path/file.txt', expected: 'relative/path/file.txt' },
        { path: './relative/file.txt', expected: './relative/file.txt' },
        { path: '../parent/file.txt', expected: '../parent/file.txt' },
      ];

      testCases.forEach(({ path, expected }) => {
        const options: DiffOptions = {
          filePath: path,
          originalContent: 'old content',
          newContent: 'new content',
        };

        const result = generateDiff(options);

        expect(result.diff).toContain(`--- a/${expected}`);
        expect(result.diff).toContain(`+++ b/${expected}`);
      });
    });

    it('should handle diff statistics edge cases', () => {
      const testCases = [
        {
          name: 'only additions',
          original: '',
          new: 'line 1\nline 2',
          expectedStats: { added: 2, removed: 0, modified: 2 }
        },
        {
          name: 'only deletions',
          original: 'line 1\nline 2',
          new: '',
          expectedStats: { added: 0, removed: 2, modified: 2 }
        },
        {
          name: 'equal additions and deletions',
          original: 'old 1\nold 2',
          new: 'new 1\nnew 2',
          expectedStats: { added: 2, removed: 2, modified: 4 }
        },
        {
          name: 'mixed operations',
          original: 'keep\nreplace\ndelete',
          new: 'keep\nreplaced\nadd',
          expectedStats: { added: 2, removed: 2, modified: 4 }
        },
      ];

      testCases.forEach(({ name, original, new: newContent, expectedStats }) => {
        const options: DiffOptions = {
          filePath: `/test/${name.replace(/\s+/g, '-')}.txt`,
          originalContent: original,
          newContent: newContent,
        };

        const result = generateDiff(options);

        expect(result.addedLines).toBe(expectedStats.added);
        expect(result.removedLines).toBe(expectedStats.removed);
        expect(result.modifiedLines).toBe(expectedStats.modified);
      });
    });

    it('should handle lookahead algorithm limits', () => {
      // Test the 10-line lookahead limit in computeDiff
      const originalLines = ['A', 'B', ...Array.from({length: 12}, (_, i) => `diff${i}`), 'C'];
      const newLines = ['A', 'B', ...Array.from({length: 12}, (_, i) => `modified${i}`), 'C'];

      const options: DiffOptions = {
        filePath: '/test/lookahead-limit.txt',
        originalContent: originalLines.join('\n'),
        newContent: newLines.join('\n'),
      };

      const result = generateDiff(options);

      expect(result.hasDifferences).toBe(true);
      expect(result.addedLines).toBe(12);
      expect(result.removedLines).toBe(12);
      // Should still produce valid diff despite lookahead limits
      expect(result.diff).toContain('-diff0');
      expect(result.diff).toContain('+modified0');
    });

    it('should validate unified diff format compliance', () => {
      const options: DiffOptions = {
        filePath: '/test/format-validation.txt',
        originalContent: 'line 1\nline 2\nline 3',
        newContent: 'line 1\nmodified line 2\nline 3',
      };

      const result = generateDiff(options);
      const diffLines = result.diff.split('\n');

      // Validate diff format structure
      expect(diffLines[0]).toMatch(/^--- a\//);
      expect(diffLines[1]).toMatch(/^\+\+\+ b\//);
      expect(diffLines[2]).toMatch(/^@@ -\d+,\d+ \+\d+,\d+ @@$/);

      // Validate that all content lines start with proper prefixes
      const contentLines = diffLines.slice(3);
      contentLines.forEach(line => {
        if (line.length > 0) {
          expect(line).toMatch(/^[- +]/);
        }
      });

      // Validate specific content markers
      expect(result.diff).toContain(' line 1');
      expect(result.diff).toContain('-line 2');
      expect(result.diff).toContain('+modified line 2');
      expect(result.diff).toContain(' line 3');
    });

    it('should handle empty line edge cases in diff generation', () => {
      const testCases = [
        {
          name: 'empty lines in middle',
          original: 'line 1\n\nline 3',
          new: 'line 1\n\nmodified line 3',
        },
        {
          name: 'multiple consecutive empty lines',
          original: 'line 1\n\n\n\nline 5',
          new: 'line 1\n\n\nline 5',
        },
        {
          name: 'trailing empty lines',
          original: 'content\n\n',
          new: 'content\n',
        },
        {
          name: 'leading empty lines',
          original: '\n\ncontent',
          new: '\ncontent',
        },
      ];

      testCases.forEach(({ name, original, new: newContent }) => {
        const options: DiffOptions = {
          filePath: `/test/${name.replace(/\s+/g, '-')}.txt`,
          originalContent: original,
          newContent: newContent,
        };

        const result = generateDiff(options);

        expect(result.hasDifferences).toBe(true);
        // Verify that empty lines are properly handled in the diff
        expect(result.diff).toBeTruthy();
        expect(result.diff.length).toBeGreaterThan(0);
      });
    });
  });
});