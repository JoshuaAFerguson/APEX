/**
 * Integration tests for StaleCommentDetector
 * Tests real-world scenarios with mock git repository state
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { join } from 'path';
import { promises as fs } from 'fs';
import { StaleCommentDetector } from './stale-comment-detector';
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

describe('StaleCommentDetector Integration Tests', () => {
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

  describe('Real-world codebase simulation', () => {
    it('should handle a typical TypeScript project with mixed comment ages', async () => {
      const mockFindOutput = `./src/utils.ts
./src/components/UserProfile.tsx
./src/api/auth.ts
./tests/setup.ts`;

      // Mock file contents with various TODO/FIXME comments
      const mockFileContents = {
        './src/utils.ts': `
// TODO: Refactor this utility function for better performance
export function parseUserData(data: string) {
  // FIXME: This doesn't handle null values properly
  return JSON.parse(data);
}
`,
        './src/components/UserProfile.tsx': `
/**
 * UserProfile component
 * TODO: Add proper TypeScript props interface
 */
export const UserProfile = ({ user }) => {
  // HACK: Temporary fix for rendering issue
  return <div>{user.name}</div>;
};
`,
        './src/api/auth.ts': `
// TODO(alice): Implement JWT token refresh logic
// FIXME: Security vulnerability - validate input
export function authenticate(token: string) {
  return { valid: true };
}
`,
        './tests/setup.ts': `
// TODO: Add more comprehensive test setup
beforeAll(() => {
  // FIXME: Mock external dependencies properly
});
`
      };

      // Mock git blame responses for different ages
      const now = Date.now();
      const oneDayAgo = Math.floor((now - 24 * 60 * 60 * 1000) / 1000);
      const fortyDaysAgo = Math.floor((now - 40 * 24 * 60 * 60 * 1000) / 1000);
      const eightyDaysAgo = Math.floor((now - 80 * 24 * 60 * 60 * 1000) / 1000);

      mockExecAsync
        // Initial find command
        .mockResolvedValueOnce({ stdout: mockFindOutput, stderr: '' })

        // Git blame for utils.ts line 2 (TODO - 40 days old)
        .mockResolvedValueOnce({
          stdout: `abc123 1 1 1
author John Doe
author-time ${fortyDaysAgo}
filename src/utils.ts
	// TODO: Refactor this utility function for better performance`,
          stderr: ''
        })

        // Git blame for utils.ts line 4 (FIXME - 1 day old)
        .mockResolvedValueOnce({
          stdout: `def456 1 1 1
author Jane Smith
author-time ${oneDayAgo}
filename src/utils.ts
	  // FIXME: This doesn't handle null values properly`,
          stderr: ''
        })

        // Git blame for UserProfile.tsx line 4 (TODO - 80 days old)
        .mockResolvedValueOnce({
          stdout: `ghi789 1 1 1
author Bob Johnson
author-time ${eightyDaysAgo}
filename src/components/UserProfile.tsx
 * TODO: Add proper TypeScript props interface`,
          stderr: ''
        })

        // Git blame for UserProfile.tsx line 7 (HACK - 40 days old)
        .mockResolvedValueOnce({
          stdout: `jkl012 1 1 1
author Alice Brown
author-time ${fortyDaysAgo}
filename src/components/UserProfile.tsx
  // HACK: Temporary fix for rendering issue`,
          stderr: ''
        })

        // Git blame for auth.ts line 2 (TODO - 80 days old)
        .mockResolvedValueOnce({
          stdout: `mno345 1 1 1
author Charlie Wilson
author-time ${eightyDaysAgo}
filename src/api/auth.ts
// TODO(alice): Implement JWT token refresh logic`,
          stderr: ''
        })

        // Git blame for auth.ts line 3 (FIXME - 40 days old)
        .mockResolvedValueOnce({
          stdout: `pqr678 1 1 1
author Diana Garcia
author-time ${fortyDaysAgo}
filename src/api/auth.ts
// FIXME: Security vulnerability - validate input`,
          stderr: ''
        })

        // Git blame for setup.ts line 2 (TODO - 1 day old)
        .mockResolvedValueOnce({
          stdout: `stu901 1 1 1
author Frank Miller
author-time ${oneDayAgo}
filename tests/setup.ts
// TODO: Add more comprehensive test setup`,
          stderr: ''
        })

        // Git blame for setup.ts line 4 (FIXME - 1 day old)
        .mockResolvedValueOnce({
          stdout: `vwx234 1 1 1
author Grace Lee
author-time ${oneDayAgo}
filename tests/setup.ts
  // FIXME: Mock external dependencies properly`,
          stderr: ''
        });

      // Mock file reads
      mockReadFile
        .mockResolvedValueOnce(mockFileContents['./src/utils.ts'])
        .mockResolvedValueOnce(mockFileContents['./src/components/UserProfile.tsx'])
        .mockResolvedValueOnce(mockFileContents['./src/api/auth.ts'])
        .mockResolvedValueOnce(mockFileContents['./tests/setup.ts']);

      const staleComments = await detector.findStaleComments();

      // Should find 4 stale comments (only those older than 30 days threshold)
      expect(staleComments).toHaveLength(4);

      // Check that we get the expected stale comments (40+ days old)
      const staleFiles = staleComments.map(c => c.file);
      expect(staleFiles).toContain('src/utils.ts');
      expect(staleFiles).toContain('src/components/UserProfile.tsx');
      expect(staleFiles).toContain('src/api/auth.ts');

      // Verify severity levels
      const highSeverityComments = staleComments.filter(c => c.severity === 'high');
      const mediumSeverityComments = staleComments.filter(c => c.severity === 'medium');

      expect(highSeverityComments).toHaveLength(2); // 80-day-old comments
      expect(mediumSeverityComments).toHaveLength(2); // 40-day-old comments

      // Verify specific properties of high-severity comments
      const highSeverityComment = highSeverityComments.find(c => c.file === 'src/components/UserProfile.tsx');
      expect(highSeverityComment).toEqual({
        file: 'src/components/UserProfile.tsx',
        type: 'stale-reference',
        description: expect.stringContaining('TODO comment added 80 days ago by Bob Johnson'),
        line: 4,
        suggestion: expect.stringContaining('Review and resolve this todo comment'),
        severity: 'high',
      });
    });

    it('should handle custom configuration thresholds', async () => {
      const customConfig: OutdatedDocsConfig = {
        todoAgeThresholdDays: 14, // More aggressive threshold
        versionCheckPatterns: [],
        deprecationRequiresMigration: true,
        crossReferenceEnabled: true,
      };

      const customDetector = new StaleCommentDetector(mockProjectPath, customConfig);
      // Mock execAsync for custom detector
      // @ts-expect-error - accessing private method for testing
      customDetector.execAsync = mockExecAsync;

      const mockFindOutput = './src/test.ts';
      const mockFileContent = '// TODO: Test task';

      // Comment that's 20 days old (stale with 14-day threshold)
      const twentyDaysAgo = Math.floor((Date.now() - 20 * 24 * 60 * 60 * 1000) / 1000);

      mockExecAsync
        .mockResolvedValueOnce({ stdout: mockFindOutput, stderr: '' })
        .mockResolvedValueOnce({
          stdout: `abc123 1 1 1
author Test User
author-time ${twentyDaysAgo}
filename src/test.ts
	// TODO: Test task`,
          stderr: ''
        });

      mockReadFile.mockResolvedValue(mockFileContent);

      const staleComments = await customDetector.findStaleComments();

      expect(staleComments).toHaveLength(1);
      expect(staleComments[0].description).toContain('20 days ago');
      expect(staleComments[0].severity).toBe('medium'); // 20 days > 14 * 1.5
    });

    it('should handle git repository edge cases', async () => {
      // Test case where git blame fails for some files but succeeds for others
      const mockFindOutput = `./src/working.ts
./src/broken.ts`;

      mockReadFile
        .mockResolvedValueOnce('// TODO: This works')
        .mockResolvedValueOnce('// TODO: This file has git issues');

      const fortyDaysAgo = Math.floor((Date.now() - 40 * 24 * 60 * 60 * 1000) / 1000);

      mockExecAsync
        .mockResolvedValueOnce({ stdout: mockFindOutput, stderr: '' })
        // Git blame succeeds for first file
        .mockResolvedValueOnce({
          stdout: `abc123 1 1 1
author User One
author-time ${fortyDaysAgo}
filename src/working.ts
	// TODO: This works`,
          stderr: ''
        })
        // Git blame fails for second file
        .mockRejectedValueOnce(new Error('Git blame failed'));

      const staleComments = await detector.findStaleComments();

      // Should only return the one comment with successful git blame
      expect(staleComments).toHaveLength(1);
      expect(staleComments[0].file).toBe('src/working.ts');
    });

    it('should gracefully handle non-git repositories', async () => {
      // Mock find command to fail (simulating non-git environment)
      mockExecAsync.mockRejectedValueOnce(new Error('Git not available'));

      const staleComments = await detector.findStaleComments();

      expect(staleComments).toHaveLength(0);
      expect(mockExecAsync).toHaveBeenCalledTimes(1);
    });
  });

  describe('Performance characteristics', () => {
    it('should handle large number of files efficiently', async () => {
      // Generate a large list of files
      const fileList = Array.from({ length: 150 }, (_, i) => `./src/file${i}.ts`);
      const mockFindOutput = fileList.join('\n');

      // Mock file contents - only first 100 should be processed due to limit
      const mockFileContent = '// TODO: Test comment';
      for (let i = 0; i < 100; i++) {
        mockReadFile.mockResolvedValueOnce(mockFileContent);
      }

      // Mock git blame for each processed file
      const thirtyFiveDaysAgo = Math.floor((Date.now() - 35 * 24 * 60 * 60 * 1000) / 1000);
      for (let i = 0; i < 100; i++) {
        mockExecAsync.mockResolvedValueOnce({
          stdout: `commit${i} 1 1 1
author Developer ${i}
author-time ${thirtyFiveDaysAgo}
filename src/file${i}.ts
	// TODO: Test comment`,
          stderr: ''
        });
      }

      // Initial find command
      mockExecAsync.mockResolvedValueOnce({ stdout: mockFindOutput, stderr: '' });

      const start = Date.now();
      const staleComments = await detector.findStaleComments();
      const duration = Date.now() - start;

      // Should process exactly 100 files (the limit)
      expect(staleComments).toHaveLength(100);

      // Should complete in reasonable time (this is a rough check)
      expect(duration).toBeLessThan(5000); // 5 seconds max for mocked operations

      // Verify that find was called to get file list
      expect(mockExecAsync).toHaveBeenCalledWith(
        expect.stringContaining('find . -name "*.ts"')
      );
    });
  });

  describe('Error resilience', () => {
    it('should handle file read errors gracefully', async () => {
      const mockFindOutput = `./src/good.ts
./src/bad.ts
./src/ugly.ts`;

      mockReadFile
        .mockResolvedValueOnce('// TODO: Good file')
        .mockRejectedValueOnce(new Error('Permission denied'))
        .mockResolvedValueOnce('// FIXME: Ugly file');

      const fortyDaysAgo = Math.floor((Date.now() - 40 * 24 * 60 * 60 * 1000) / 1000);

      mockExecAsync
        .mockResolvedValueOnce({ stdout: mockFindOutput, stderr: '' })
        .mockResolvedValueOnce({
          stdout: `abc123 1 1 1
author Good User
author-time ${fortyDaysAgo}
filename src/good.ts
	// TODO: Good file`,
          stderr: ''
        })
        .mockResolvedValueOnce({
          stdout: `def456 1 1 1
author Ugly User
author-time ${fortyDaysAgo}
filename src/ugly.ts
	// FIXME: Ugly file`,
          stderr: ''
        });

      const staleComments = await detector.findStaleComments();

      // Should process the files that can be read
      expect(staleComments).toHaveLength(2);
      expect(staleComments.map(c => c.file)).toEqual(['src/good.ts', 'src/ugly.ts']);
    });

    it('should handle mixed git blame success/failure scenarios', async () => {
      const mockFindOutput = './src/test.ts';
      const mockFileContent = `
// TODO: First comment
// FIXME: Second comment
// HACK: Third comment
      `.trim();

      mockReadFile.mockResolvedValue(mockFileContent);

      const fortyDaysAgo = Math.floor((Date.now() - 40 * 24 * 60 * 60 * 1000) / 1000);

      mockExecAsync
        .mockResolvedValueOnce({ stdout: mockFindOutput, stderr: '' })
        // First git blame succeeds
        .mockResolvedValueOnce({
          stdout: `abc123 1 1 1
author User One
author-time ${fortyDaysAgo}
filename src/test.ts
	// TODO: First comment`,
          stderr: ''
        })
        // Second git blame fails
        .mockRejectedValueOnce(new Error('Git blame failed'))
        // Third git blame succeeds
        .mockResolvedValueOnce({
          stdout: `def456 1 1 1
author User Three
author-time ${fortyDaysAgo}
filename src/test.ts
	// HACK: Third comment`,
          stderr: ''
        });

      const staleComments = await detector.findStaleComments();

      // Should return comments that had successful git blame (first and third)
      expect(staleComments).toHaveLength(2);
      expect(staleComments.map(c => c.suggestion)).toEqual([
        expect.stringContaining('todo comment: "TODO: First comment"'),
        expect.stringContaining('hack comment: "HACK: Third comment"'),
      ]);
    });
  });

  describe('Git availability detection', () => {
    it('should correctly detect when git is available', async () => {
      mockExecAsync.mockResolvedValue({ stdout: 'On branch main', stderr: '' });

      const isAvailable = await detector.isGitAvailable();

      expect(isAvailable).toBe(true);
      expect(mockExecAsync).toHaveBeenCalledWith('git status');
    });

    it('should correctly detect when git is not available', async () => {
      mockExecAsync.mockRejectedValue(new Error('git: command not found'));

      const isAvailable = await detector.isGitAvailable();

      expect(isAvailable).toBe(false);
    });

    it('should handle git status in detached HEAD state', async () => {
      mockExecAsync.mockResolvedValue({
        stdout: 'HEAD detached at abc123',
        stderr: ''
      });

      const isAvailable = await detector.isGitAvailable();

      expect(isAvailable).toBe(true);
    });
  });
});