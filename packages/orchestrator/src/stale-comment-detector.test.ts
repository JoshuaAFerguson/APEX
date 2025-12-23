/**
 * Unit tests for StaleCommentDetector
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { join } from 'path';
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

describe('StaleCommentDetector', () => {
  let detector: StaleCommentDetector;
  let mockExecAsync: any;
  let mockReadFile: any;

  const mockProjectPath = '/mock/project';
  const mockConfig: OutdatedDocsConfig = {
    todoAgeThresholdDays: 30,
    versionCheckPatterns: [],
    deprecationRequiresMigration: true,
    crossReferenceEnabled: true,
  };

  beforeEach(() => {
    detector = new StaleCommentDetector(mockProjectPath, mockConfig);
    mockReadFile = vi.mocked(fs.readFile);

    // Mock the execAsync method
    mockExecAsync = vi.fn();
    // @ts-expect-error - accessing private method for testing
    detector.execAsync = mockExecAsync;
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('parseCommentsInFile', () => {
    it('should parse TODO comments from various comment styles', () => {
      const fileContent = `
// TODO: Fix this bug
/* TODO: Refactor this function */
// FIXME: Handle edge case
# TODO: Update documentation
-- TODO: Optimize query
/** TODO: Add unit tests */
 * TODO: Implement feature
<!-- TODO: Update HTML -->
      `.trim();

      // @ts-expect-error - accessing private method for testing
      const comments = detector.parseCommentsInFile('test.ts', fileContent);

      expect(comments).toHaveLength(7); // Excluding the HTML comment and short ones
      expect(comments[0]).toEqual({
        file: 'test.ts',
        line: 2,
        text: 'TODO: Fix this bug',
        type: 'TODO',
      });
      expect(comments[1]).toEqual({
        file: 'test.ts',
        line: 3,
        text: 'TODO: Refactor this function',
        type: 'TODO',
      });
    });

    it('should parse FIXME and HACK comments', () => {
      const fileContent = `
// FIXME: Memory leak here
// HACK: Temporary workaround
      `.trim();

      // @ts-expect-error - accessing private method for testing
      const comments = detector.parseCommentsInFile('test.js', fileContent);

      expect(comments).toHaveLength(2);
      expect(comments[0].type).toBe('FIXME');
      expect(comments[1].type).toBe('HACK');
    });

    it('should handle comments with author annotations', () => {
      const fileContent = `
// TODO(john): Implement this feature
// FIXME[alice]: Fix performance issue
      `.trim();

      // @ts-expect-error - accessing private method for testing
      const comments = detector.parseCommentsInFile('test.ts', fileContent);

      expect(comments).toHaveLength(2);
      expect(comments[0].text).toBe('TODO: Implement this feature');
      expect(comments[1].text).toBe('FIXME: Fix performance issue');
    });

    it('should skip very short or empty comments', () => {
      const fileContent = `
// TODO:
// TODO: Fix
// TODO: This is a proper comment
      `.trim();

      // @ts-expect-error - accessing private method for testing
      const comments = detector.parseCommentsInFile('test.ts', fileContent);

      expect(comments).toHaveLength(1);
      expect(comments[0].text).toBe('TODO: This is a proper comment');
    });
  });

  describe('getGitBlame', () => {
    it('should parse git blame output correctly', async () => {
      const mockBlameOutput = `
abc123456 1 1 1
author John Doe
author-mail <john@example.com>
author-time 1609459200
author-tz +0000
committer John Doe
committer-mail <john@example.com>
committer-time 1609459200
committer-tz +0000
summary Initial commit
filename test.ts
	// TODO: Fix this
      `.trim();

      mockExecAsync.mockResolvedValue({ stdout: mockBlameOutput, stderr: '' });

      // @ts-expect-error - accessing private method for testing
      const blameInfo = await detector.getGitBlame('test.ts', 1);

      expect(blameInfo).toEqual({
        author: 'John Doe',
        date: new Date(1609459200 * 1000), // Unix timestamp conversion
        commitHash: 'abc123456',
      });
    });

    it('should handle git blame errors gracefully', async () => {
      mockExecAsync.mockRejectedValue(new Error('Git blame failed'));

      // @ts-expect-error - accessing private method for testing
      await expect(detector.getGitBlame('test.ts', 1)).rejects.toThrow('Git blame failed');
    });
  });

  describe('filterStaleComments', () => {
    it('should identify stale comments based on threshold', () => {
      const now = new Date();
      const oldDate = new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000); // 45 days ago
      const recentDate = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000); // 15 days ago

      const comments: CommentMetadata[] = [
        {
          file: 'test1.ts',
          line: 1,
          text: 'TODO: Old task',
          type: 'TODO',
          author: 'John',
          date: oldDate,
          commitHash: 'abc123',
        },
        {
          file: 'test2.ts',
          line: 2,
          text: 'TODO: Recent task',
          type: 'TODO',
          author: 'Jane',
          date: recentDate,
          commitHash: 'def456',
        },
        {
          file: 'test3.ts',
          line: 3,
          text: 'TODO: No date info',
          type: 'TODO',
        },
      ];

      // @ts-expect-error - accessing private method for testing
      const staleComments = detector.filterStaleComments(comments);

      expect(staleComments).toHaveLength(1);
      expect(staleComments[0]).toEqual({
        file: 'test1.ts',
        type: 'stale-reference',
        description: 'TODO comment added 45 days ago by John',
        line: 1,
        suggestion: 'Review and resolve this todo comment: "TODO: Old task"',
        severity: 'medium',
      });
    });

    it('should assign severity based on age', () => {
      const now = new Date();
      const veryOldDate = new Date(now.getTime() - 100 * 24 * 60 * 60 * 1000); // 100 days ago (high)
      const oldDate = new Date(now.getTime() - 70 * 24 * 60 * 60 * 1000); // 70 days ago (medium)
      const staleDate = new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000); // 35 days ago (low)

      const comments: CommentMetadata[] = [
        {
          file: 'test1.ts',
          line: 1,
          text: 'TODO: Very old',
          type: 'TODO',
          date: veryOldDate,
        },
        {
          file: 'test2.ts',
          line: 2,
          text: 'TODO: Old',
          type: 'TODO',
          date: oldDate,
        },
        {
          file: 'test3.ts',
          line: 3,
          text: 'TODO: Stale',
          type: 'TODO',
          date: staleDate,
        },
      ];

      // @ts-expect-error - accessing private method for testing
      const staleComments = detector.filterStaleComments(comments);

      expect(staleComments).toHaveLength(3);
      expect(staleComments[0].severity).toBe('high');
      expect(staleComments[1].severity).toBe('medium');
      expect(staleComments[2].severity).toBe('low');
    });

    it('should skip comments without date information', () => {
      const comments: CommentMetadata[] = [
        {
          file: 'test.ts',
          line: 1,
          text: 'TODO: No date',
          type: 'TODO',
        },
      ];

      // @ts-expect-error - accessing private method for testing
      const staleComments = detector.filterStaleComments(comments);

      expect(staleComments).toHaveLength(0);
    });
  });

  describe('findAllComments', () => {
    it('should find comments in source files', async () => {
      const mockFindOutput = `./src/file1.ts
./src/file2.js`;

      const mockFileContent1 = '// TODO: Implement feature';
      const mockFileContent2 = '// FIXME: Handle error case';

      mockExecAsync.mockResolvedValue({ stdout: mockFindOutput, stderr: '' });
      mockReadFile
        .mockResolvedValueOnce(mockFileContent1)
        .mockResolvedValueOnce(mockFileContent2);

      // @ts-expect-error - accessing private method for testing
      const comments = await detector.findAllComments();

      expect(comments).toHaveLength(2);
      expect(comments[0].file).toBe('src/file1.ts');
      expect(comments[0].text).toBe('TODO: Implement feature');
      expect(comments[1].file).toBe('src/file2.js');
      expect(comments[1].text).toBe('FIXME: Handle error case');
    });

    it('should handle file read errors gracefully', async () => {
      const mockFindOutput = './src/file1.ts';
      mockExecAsync.mockResolvedValue({ stdout: mockFindOutput, stderr: '' });
      mockReadFile.mockRejectedValue(new Error('Permission denied'));

      // @ts-expect-error - accessing private method for testing
      const comments = await detector.findAllComments();

      expect(comments).toHaveLength(0);
    });

    it('should handle find command errors gracefully', async () => {
      mockExecAsync.mockRejectedValue(new Error('Find command failed'));

      // @ts-expect-error - accessing private method for testing
      const comments = await detector.findAllComments();

      expect(comments).toHaveLength(0);
    });
  });

  describe('isGitAvailable', () => {
    it('should return true when git status succeeds', async () => {
      mockExecAsync.mockResolvedValue({ stdout: 'On branch main', stderr: '' });

      const isAvailable = await detector.isGitAvailable();

      expect(isAvailable).toBe(true);
      expect(mockExecAsync).toHaveBeenCalledWith('git status');
    });

    it('should return false when git status fails', async () => {
      mockExecAsync.mockRejectedValue(new Error('Not a git repository'));

      const isAvailable = await detector.isGitAvailable();

      expect(isAvailable).toBe(false);
    });
  });

  describe('findStaleComments integration', () => {
    it('should find and filter stale comments end-to-end', async () => {
      const mockFindOutput = './src/test.ts';
      const mockFileContent = '// TODO: Implement this feature';
      const mockBlameOutput = `
abc123 1 1 1
author John Doe
author-time 1609459200
filename src/test.ts
	// TODO: Implement this feature
      `.trim();

      // Configure threshold to make the comment stale (45 days old vs 30 day threshold)
      const oldDate = new Date('2021-01-01'); // Mock date from blame
      vi.setSystemTime(new Date('2021-02-15')); // 45 days later

      mockExecAsync
        .mockResolvedValueOnce({ stdout: mockFindOutput, stderr: '' })
        .mockResolvedValueOnce({ stdout: mockBlameOutput, stderr: '' });

      mockReadFile.mockResolvedValue(mockFileContent);

      const staleComments = await detector.findStaleComments();

      expect(staleComments).toHaveLength(1);
      expect(staleComments[0]).toEqual({
        file: 'src/test.ts',
        type: 'stale-reference',
        description: 'TODO comment added 45 days ago by John Doe',
        line: 1,
        suggestion: 'Review and resolve this todo comment: "TODO: Implement this feature"',
        severity: 'medium',
      });

      vi.useRealTimers();
    });

    it('should handle git not available gracefully', async () => {
      mockExecAsync.mockRejectedValue(new Error('Git not found'));

      const staleComments = await detector.findStaleComments();

      expect(staleComments).toHaveLength(0);
    });
  });

  describe('configuration', () => {
    it('should use custom threshold from config', () => {
      const customConfig: OutdatedDocsConfig = {
        todoAgeThresholdDays: 60,
        versionCheckPatterns: [],
        deprecationRequiresMigration: true,
        crossReferenceEnabled: true,
      };

      const customDetector = new StaleCommentDetector(mockProjectPath, customConfig);

      // @ts-expect-error - accessing private property
      expect(customDetector.config.todoAgeThresholdDays).toBe(60);
    });

    it('should use default config when none provided', () => {
      const defaultDetector = new StaleCommentDetector(mockProjectPath);

      // @ts-expect-error - accessing private property
      expect(defaultDetector.config.todoAgeThresholdDays).toBe(30);
    });
  });
});