/**
 * Edge case tests for StaleCommentDetector
 * Tests unusual comment formats, malformed git output, and boundary conditions
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import { StaleCommentDetector, type CommentMetadata } from './stale-comment-detector';
import type { OutdatedDocsConfig } from '@apexcli/core';

// Mock fs and child_process
vi.mock('fs', () => ({
  promises: {
    readFile: vi.fn(),
  },
}));

vi.mock('child_process', () => ({
  exec: vi.fn(),
}));

describe('StaleCommentDetector Edge Cases', () => {
  let detector: StaleCommentDetector;
  let mockExecAsync: any;
  let mockReadFile: any;

  const mockProjectPath = '/mock/project';

  beforeEach(() => {
    detector = new StaleCommentDetector(mockProjectPath);
    mockReadFile = vi.mocked(fs.readFile);

    // Mock the execAsync method
    mockExecAsync = vi.fn();
    // @ts-expect-error - accessing private method for testing
    detector.execAsync = mockExecAsync;
  });

  afterEach(() => {
    vi.resetAllMocks();
    vi.useRealTimers();
  });

  describe('Comment parsing edge cases', () => {
    it('should handle multiline comments with various formats', () => {
      const fileContent = `
/*
 * TODO: This is a multiline
 *       TODO comment that spans
 *       multiple lines
 */

/**
 * @description Some function
 * TODO: Add proper documentation
 * @param {string} input
 */

/*
TODO: Single line in block comment
*/

/*TODO:No spaces*/

/* TODO: Comment with trailing text */

<!-- TODO: HTML comment -->
<!-- FIXME: Another HTML comment -->
      `.trim();

      // @ts-expect-error - accessing private method for testing
      const comments = detector.parseCommentsInFile('test.html', fileContent);

      expect(comments).toHaveLength(6);

      // Check specific comment extraction
      expect(comments[0]).toEqual({
        file: 'test.html',
        line: 3,
        text: 'TODO: This is a multiline',
        type: 'TODO',
      });

      expect(comments[1]).toEqual({
        file: 'test.html',
        line: 10,
        text: 'TODO: Add proper documentation',
        type: 'TODO',
      });

      expect(comments[2]).toEqual({
        file: 'test.html',
        line: 15,
        text: 'TODO: Single line in block comment',
        type: 'TODO',
      });

      expect(comments[3]).toEqual({
        file: 'test.html',
        line: 18,
        text: 'TODO: No spaces',
        type: 'TODO',
      });
    });

    it('should handle comments with special characters and Unicode', () => {
      const fileContent = `
// TODO: Handle émojis and spéciál characters 🚀
// FIXME: Unicode support needed → ← ↑ ↓
// HACK: Handle quotes "test" and 'test' properly
// TODO: Handle backticks \`code\` and ${interpolation}
// FIXME: Math symbols: α β γ δ ∑ ∏
/* TODO: Symbols and punctuation: !@#$%^&*()_+-=[]{}|;:,.<>? */
      `.trim();

      // @ts-expect-error - accessing private method for testing
      const comments = detector.parseCommentsInFile('unicode.ts', fileContent);

      expect(comments).toHaveLength(6);
      expect(comments[0].text).toBe('TODO: Handle émojis and spéciál characters 🚀');
      expect(comments[1].text).toBe('FIXME: Unicode support needed → ← ↑ ↓');
      expect(comments[4].text).toBe('FIXME: Math symbols: α β γ δ ∑ ∏');
    });

    it('should handle nested and malformed comment structures', () => {
      const fileContent = `
// TODO: /* This has nested comment syntax */
/* FIXME: // This has nested single-line syntax */
// TODO: This is /* partially nested
/* TODO: This is // also mixed */
// /* TODO: Commented out TODO */
/* // FIXME: Another mixed case */
      `.trim();

      // @ts-expect-error - accessing private method for testing
      const comments = detector.parseCommentsInFile('nested.ts', fileContent);

      expect(comments).toHaveLength(4);
      expect(comments[0].text).toBe('TODO: /* This has nested comment syntax */');
      expect(comments[1].text).toBe('FIXME: // This has nested single-line syntax');
    });

    it('should handle comments at line boundaries and empty lines', () => {
      const fileContent = `// TODO: First line comment

// FIXME: Comment after empty line

      // TODO: Comment with leading spaces

	// HACK: Comment with leading tab
// TODO: Last line comment`;

      // @ts-expect-error - accessing private method for testing
      const comments = detector.parseCommentsInFile('boundaries.ts', fileContent);

      expect(comments).toHaveLength(5);
      expect(comments.map(c => c.line)).toEqual([1, 3, 5, 7, 8]);
      expect(comments[2].text).toBe('TODO: Comment with leading spaces');
      expect(comments[3].text).toBe('HACK: Comment with leading tab');
    });

    it('should ignore TODO/FIXME in strings and non-comment contexts', () => {
      const fileContent = `
const message = "TODO: This is not a comment";
const regex = /TODO:.*$/;
console.log('FIXME: Also not a comment');
// This is a real TODO: Real comment
function todoFunction() { return "TODO"; }
\`TODO: Template literal\`
      `.trim();

      // @ts-expect-error - accessing private method for testing
      const comments = detector.parseCommentsInFile('strings.ts', fileContent);

      expect(comments).toHaveLength(1);
      expect(comments[0]).toEqual({
        file: 'strings.ts',
        line: 5,
        text: 'TODO: Real comment',
        type: 'TODO',
      });
    });

    it('should handle various language comment styles', () => {
      const rustContent = `
// TODO: Rust single line comment
/* TODO: Rust block comment */
/// TODO: Rust doc comment
      `.trim();

      const pythonContent = `
# TODO: Python comment
# FIXME: Another Python comment
# TODO: Multi-line Python
#       comment continuation
      `.trim();

      const sqlContent = `
-- TODO: SQL comment
-- FIXME: Another SQL comment
/* TODO: SQL block comment */
      `.trim();

      // Test Rust
      // @ts-expect-error - accessing private method for testing
      const rustComments = detector.parseCommentsInFile('test.rs', rustContent);
      expect(rustComments).toHaveLength(3);

      // Test Python
      // @ts-expect-error - accessing private method for testing
      const pythonComments = detector.parseCommentsInFile('test.py', pythonContent);
      expect(pythonComments).toHaveLength(3);

      // Test SQL
      // @ts-expect-error - accessing private method for testing
      const sqlComments = detector.parseCommentsInFile('test.sql', sqlContent);
      expect(sqlComments).toHaveLength(3);
    });
  });

  describe('Git blame parsing edge cases', () => {
    it('should handle malformed git blame output', async () => {
      // Test with missing fields
      const malformedBlameOutput1 = `
abc123 1 1 1
author-time 1609459200
filename test.ts
	// TODO: Test
      `.trim(); // Missing author

      const malformedBlameOutput2 = `
abc123 1 1 1
author John Doe
filename test.ts
	// TODO: Test
      `.trim(); // Missing author-time

      const malformedBlameOutput3 = `
author John Doe
author-time 1609459200
filename test.ts
	// TODO: Test
      `.trim(); // Missing commit hash

      // Test each malformed output
      mockExecAsync.mockResolvedValueOnce({ stdout: malformedBlameOutput1, stderr: '' });

      // @ts-expect-error - accessing private method for testing
      let blameInfo = await detector.getGitBlame('test.ts', 1);
      expect(blameInfo.author).toBeUndefined();
      expect(blameInfo.date).toBeDefined();
      expect(blameInfo.commitHash).toBe('abc123');

      mockExecAsync.mockResolvedValueOnce({ stdout: malformedBlameOutput2, stderr: '' });

      // @ts-expect-error - accessing private method for testing
      blameInfo = await detector.getGitBlame('test.ts', 1);
      expect(blameInfo.author).toBe('John Doe');
      expect(blameInfo.date).toBeUndefined();
      expect(blameInfo.commitHash).toBe('abc123');

      mockExecAsync.mockResolvedValueOnce({ stdout: malformedBlameOutput3, stderr: '' });

      // @ts-expect-error - accessing private method for testing
      blameInfo = await detector.getGitBlame('test.ts', 1);
      expect(blameInfo.author).toBe('John Doe');
      expect(blameInfo.date).toBeDefined();
      expect(blameInfo.commitHash).toBeUndefined();
    });

    it('should handle git blame with empty or whitespace output', async () => {
      mockExecAsync.mockResolvedValueOnce({ stdout: '', stderr: '' });

      // @ts-expect-error - accessing private method for testing
      const blameInfo = await detector.getGitBlame('test.ts', 1);

      expect(blameInfo).toEqual({
        author: undefined,
        date: undefined,
        commitHash: undefined,
      });
    });

    it('should handle git blame with non-numeric timestamps', async () => {
      const invalidTimestampOutput = `
abc123 1 1 1
author John Doe
author-time not-a-number
filename test.ts
	// TODO: Test
      `.trim();

      mockExecAsync.mockResolvedValueOnce({ stdout: invalidTimestampOutput, stderr: '' });

      // @ts-expect-error - accessing private method for testing
      const blameInfo = await detector.getGitBlame('test.ts', 1);

      expect(blameInfo.author).toBe('John Doe');
      expect(blameInfo.date).toBeUndefined(); // Should be undefined for invalid timestamp
      expect(blameInfo.commitHash).toBe('abc123');
    });

    it('should handle git blame with extremely old/future dates', async () => {
      const extremeTimestamps = [
        0, // Unix epoch
        -1, // Before epoch
        2147483647, // Max 32-bit timestamp (2038)
        4102444800, // Year 2100
      ];

      for (const timestamp of extremeTimestamps) {
        const blameOutput = `
abc123 1 1 1
author Time Traveler
author-time ${timestamp}
filename test.ts
	// TODO: Test
        `.trim();

        mockExecAsync.mockResolvedValueOnce({ stdout: blameOutput, stderr: '' });

        // @ts-expect-error - accessing private method for testing
        const blameInfo = await detector.getGitBlame('test.ts', 1);

        if (timestamp >= 0) {
          expect(blameInfo.date).toBeInstanceOf(Date);
          expect(blameInfo.date?.getTime()).toBe(timestamp * 1000);
        } else {
          // Negative timestamps should still work in JavaScript
          expect(blameInfo.date?.getTime()).toBe(timestamp * 1000);
        }
      }
    });
  });

  describe('Configuration edge cases', () => {
    it('should handle zero and negative threshold configurations', () => {
      const zeroConfig: OutdatedDocsConfig = {
        todoAgeThresholdDays: 0,
        versionCheckPatterns: [],
        deprecationRequiresMigration: true,
        crossReferenceEnabled: true,
      };

      const negativeConfig: OutdatedDocsConfig = {
        todoAgeThresholdDays: -10,
        versionCheckPatterns: [],
        deprecationRequiresMigration: true,
        crossReferenceEnabled: true,
      };

      const zeroDetector = new StaleCommentDetector(mockProjectPath, zeroConfig);
      const negativeDetector = new StaleCommentDetector(mockProjectPath, negativeConfig);

      const now = new Date();
      const oneSecondAgo = new Date(now.getTime() - 1000);

      const comments: CommentMetadata[] = [{
        file: 'test.ts',
        line: 1,
        text: 'TODO: Test',
        type: 'TODO',
        date: oneSecondAgo,
      }];

      // @ts-expect-error - accessing private method for testing
      const zeroResult = zeroDetector.filterStaleComments(comments);
      // @ts-expect-error - accessing private method for testing
      const negativeResult = negativeDetector.filterStaleComments(comments);

      // Zero threshold: even 1-second-old comments should be stale
      expect(zeroResult).toHaveLength(1);

      // Negative threshold: all comments should be stale
      expect(negativeResult).toHaveLength(1);
    });

    it('should handle extremely large threshold configurations', () => {
      const largeConfig: OutdatedDocsConfig = {
        todoAgeThresholdDays: 365 * 100, // 100 years
        versionCheckPatterns: [],
        deprecationRequiresMigration: true,
        crossReferenceEnabled: true,
      };

      const largeDetector = new StaleCommentDetector(mockProjectPath, largeConfig);

      const now = new Date();
      const tenYearsAgo = new Date(now.getTime() - 10 * 365 * 24 * 60 * 60 * 1000);

      const comments: CommentMetadata[] = [{
        file: 'test.ts',
        line: 1,
        text: 'TODO: Old task',
        type: 'TODO',
        date: tenYearsAgo,
      }];

      // @ts-expect-error - accessing private method for testing
      const result = largeDetector.filterStaleComments(comments);

      // Even 10-year-old comment should not be stale with 100-year threshold
      expect(result).toHaveLength(0);
    });

    it('should handle missing configuration properties gracefully', () => {
      const partialConfig: Partial<OutdatedDocsConfig> = {
        versionCheckPatterns: [],
        // Missing todoAgeThresholdDays - should use default
      };

      const partialDetector = new StaleCommentDetector(mockProjectPath, partialConfig);

      // @ts-expect-error - accessing private property
      expect(partialDetector.config.todoAgeThresholdDays).toBe(30); // Default value
    });
  });

  describe('File system edge cases', () => {
    it('should handle files with unusual extensions', async () => {
      const mockFindOutput = `./config.json5
./script.sh
./data.yaml
./Dockerfile
./Makefile
./README.md`;

      const fileContents = {
        './config.json5': '// TODO: Convert to regular JSON',
        './script.sh': '# TODO: Add error handling',
        './data.yaml': '# FIXME: Validate schema',
        './Dockerfile': '# TODO: Multi-stage build',
        './Makefile': '# HACK: Temporary target',
        './README.md': '<!-- TODO: Add examples -->',
      };

      mockExecAsync.mockResolvedValueOnce({ stdout: mockFindOutput, stderr: '' });

      Object.values(fileContents).forEach(content => {
        mockReadFile.mockResolvedValueOnce(content);
      });

      const fortyDaysAgo = Math.floor((Date.now() - 40 * 24 * 60 * 60 * 1000) / 1000);

      // Mock git blame for each comment
      Object.keys(fileContents).forEach((_, index) => {
        mockExecAsync.mockResolvedValueOnce({
          stdout: `commit${index} 1 1 1
author Developer ${index}
author-time ${fortyDaysAgo}
filename file${index}
	comment line`,
          stderr: ''
        });
      });

      const staleComments = await detector.findStaleComments();

      expect(staleComments).toHaveLength(6);

      // Verify we processed all file types
      const processedFiles = staleComments.map(c => c.file);
      expect(processedFiles).toContain('config.json5');
      expect(processedFiles).toContain('script.sh');
      expect(processedFiles).toContain('data.yaml');
    });

    it('should handle very large file contents', async () => {
      const mockFindOutput = './large.ts';

      // Create a large file with TODO comments scattered throughout
      const largeFileLines = Array.from({ length: 10000 }, (_, i) => {
        if (i % 1000 === 0 && i > 0) {
          return `// TODO: Comment at line ${i + 1}`;
        }
        return `const line${i} = ${i};`;
      });
      const largeFileContent = largeFileLines.join('\n');

      mockExecAsync.mockResolvedValueOnce({ stdout: mockFindOutput, stderr: '' });
      mockReadFile.mockResolvedValue(largeFileContent);

      const fortyDaysAgo = Math.floor((Date.now() - 40 * 24 * 60 * 60 * 1000) / 1000);

      // Mock git blame for each TODO comment found
      for (let i = 0; i < 9; i++) { // 9 TODO comments in a 10k line file
        mockExecAsync.mockResolvedValueOnce({
          stdout: `commit${i} 1 1 1
author Developer
author-time ${fortyDaysAgo}
filename large.ts
	// TODO: Comment at line ${(i + 1) * 1000 + 1}`,
          stderr: ''
        });
      }

      const staleComments = await detector.findStaleComments();

      expect(staleComments).toHaveLength(9);
    });

    it('should handle binary files and files with unusual encoding', async () => {
      const mockFindOutput = `./binary.exe
./utf16.txt`;

      mockExecAsync.mockResolvedValueOnce({ stdout: mockFindOutput, stderr: '' });

      // Simulate binary file read error
      mockReadFile
        .mockRejectedValueOnce(new Error('File appears to be binary'))
        .mockRejectedValueOnce(new Error('Invalid encoding'));

      // Should handle gracefully without throwing
      const staleComments = await detector.findStaleComments();

      expect(staleComments).toHaveLength(0);
      expect(mockReadFile).toHaveBeenCalledTimes(2);
    });
  });

  describe('Comment text truncation and formatting', () => {
    it('should handle very long comment text', () => {
      const longText = 'A'.repeat(200);
      const fileContent = `// TODO: ${longText}`;

      // @ts-expect-error - accessing private method for testing
      const comments = detector.parseCommentsInFile('test.ts', fileContent);

      expect(comments).toHaveLength(1);
      expect(comments[0].text.length).toBeGreaterThan(100); // Should include full text in metadata

      const now = new Date();
      const oldDate = new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000);

      const commentsWithDate: CommentMetadata[] = [{
        ...comments[0],
        date: oldDate,
        author: 'Test User',
      }];

      // @ts-expect-error - accessing private method for testing
      const staleComments = detector.filterStaleComments(commentsWithDate);

      expect(staleComments).toHaveLength(1);

      // Suggestion should be truncated to 100 chars + "..."
      const suggestion = staleComments[0].suggestion!;
      expect(suggestion).toContain('...');
      expect(suggestion.length).toBeLessThan(200);
    });

    it('should preserve exact comment text for shorter comments', () => {
      const shortText = 'Fix this bug';
      const fileContent = `// TODO: ${shortText}`;

      // @ts-expect-error - accessing private method for testing
      const comments = detector.parseCommentsInFile('test.ts', fileContent);

      const now = new Date();
      const oldDate = new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000);

      const commentsWithDate: CommentMetadata[] = [{
        ...comments[0],
        date: oldDate,
        author: 'Test User',
      }];

      // @ts-expect-error - accessing private method for testing
      const staleComments = detector.filterStaleComments(commentsWithDate);

      expect(staleComments[0].suggestion).toContain(`"TODO: ${shortText}"`);
      expect(staleComments[0].suggestion).not.toContain('...');
    });
  });
});