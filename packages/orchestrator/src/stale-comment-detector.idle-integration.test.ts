/**
 * Tests for StaleCommentDetector integration with IdleTaskProcessor
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';

// Mock fs and child_process before importing modules that use them
vi.mock('fs', () => ({
  promises: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
    access: vi.fn(),
    readdir: vi.fn(),
  },
}));

vi.mock('child_process', () => ({
  exec: vi.fn(),
}));

// Mock better-sqlite3
vi.mock('better-sqlite3', () => {
  const mockDb = {
    prepare: vi.fn(() => ({
      run: vi.fn(),
      get: vi.fn(),
      all: vi.fn(() => []),
    })),
    close: vi.fn(),
    pragma: vi.fn(),
  };
  return {
    default: vi.fn(() => mockDb),
  };
});

// Now import the modules
import { IdleProcessor } from './idle-processor';
import type { DaemonConfig } from '@apexcli/core';

describe('StaleCommentDetector Integration with IdleProcessor', () => {
  let processor: IdleProcessor;
  let mockReadFile: any;
  let mockExecAsync: any;

  const mockConfig: DaemonConfig = {
    enabled: true,
    maxConcurrentTasks: 2,
    intervalMinutes: 60,
    analysisDepth: 'medium' as const,
    autoCreateTasks: true,
    taskLimits: {
      maxTasksPerType: 5,
      maxPendingTasks: 10,
    },
    documentation: {
      outdatedDocs: {
        todoAgeThresholdDays: 30,
        versionCheckPatterns: [],
        deprecationRequiresMigration: true,
        crossReferenceEnabled: true,
      },
    },
  };

  const mockProjectPath = '/mock/project';

  beforeEach(() => {
    // Mock TaskStore
    const mockStore = {
      getLastActivityTime: vi.fn().mockResolvedValue(new Date(Date.now() - 1000000)),
    } as any;

    processor = new IdleProcessor(mockProjectPath, mockConfig, mockStore);
    mockReadFile = vi.mocked(fs.readFile);

    // Mock the execAsync method on the processor
    mockExecAsync = vi.fn();
    // @ts-expect-error - accessing private method for testing
    processor.execAsync = mockExecAsync;
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('findStaleComments integration', () => {
    it('should create StaleCommentDetector with correct configuration', async () => {
      // Test that the processor can create the detector with the right config
      const mockFindOutput = './src/component.tsx';
      const mockFileContent = '// TODO: Implement proper error handling';

      const fortyDaysAgo = Math.floor((Date.now() - 40 * 24 * 60 * 60 * 1000) / 1000);

      mockExecAsync
        // Mock find command for stale comments
        .mockResolvedValueOnce({ stdout: mockFindOutput, stderr: '' })
        // Mock git blame for the TODO comment
        .mockResolvedValueOnce({
          stdout: `abc123 1 1 1
author John Developer
author-time ${fortyDaysAgo}
filename src/component.tsx
	// TODO: Implement proper error handling`,
          stderr: ''
        });

      mockReadFile.mockResolvedValue(mockFileContent);

      // Access the private method to test the integration
      // @ts-expect-error - accessing private method for testing
      const staleComments = await processor.findStaleComments();

      // Verify that stale comments were detected
      expect(staleComments).toBeDefined();
      expect(staleComments.length).toBeGreaterThan(0);

      const staleComment = staleComments.find(
        doc => doc.type === 'stale-reference'
      );

      expect(staleComment).toBeDefined();
      expect(staleComment).toEqual({
        file: 'src/component.tsx',
        type: 'stale-reference',
        description: expect.stringContaining('TODO comment added 40 days ago by John Developer'),
        line: 1,
        suggestion: expect.stringContaining('Review and resolve this todo comment'),
        severity: 'medium',
      });
    });

    it('should handle configuration override in processor', async () => {
      // Create processor with custom configuration
      const customConfig = {
        ...mockConfig,
        documentation: {
          outdatedDocs: {
            todoAgeThresholdDays: 14, // More aggressive threshold
            versionCheckPatterns: [],
            deprecationRequiresMigration: true,
            crossReferenceEnabled: true,
          },
        },
      };

      const mockStore = {
        getLastActivityTime: vi.fn().mockResolvedValue(new Date(Date.now() - 1000000)),
      } as any;

      const customProcessor = new IdleProcessor(mockProjectPath, customConfig, mockStore);
      // @ts-expect-error - accessing private method for testing
      customProcessor.execAsync = mockExecAsync;

      const mockFindOutput = './src/test.ts';
      const mockFileContent = '// FIXME: Handle this edge case';

      // Comment that's 20 days old (stale with 14-day threshold)
      const twentyDaysAgo = Math.floor((Date.now() - 20 * 24 * 60 * 60 * 1000) / 1000);

      mockExecAsync
        .mockResolvedValueOnce({ stdout: mockFindOutput, stderr: '' })
        .mockResolvedValueOnce({
          stdout: `def456 1 1 1
author Jane Tester
author-time ${twentyDaysAgo}
filename src/test.ts
	// FIXME: Handle this edge case`,
          stderr: ''
        })
        .mockResolvedValue({ stdout: '', stderr: '' });

      mockReadFile.mockResolvedValue(mockFileContent);

      // @ts-expect-error - accessing private method for testing
      const staleComments = await customProcessor.findStaleComments();

      const staleComment = staleComments.find(
        doc => doc.type === 'stale-reference'
      );

      expect(staleComment).toBeDefined();
      expect(staleComment?.description).toContain('20 days ago');
      expect(staleComment?.severity).toBe('medium'); // 20 > 14 * 1.5
    });

    it('should handle stale comments gracefully when git is not available', async () => {
      // Mock git not available scenario
      mockExecAsync.mockRejectedValue(new Error('git: command not found'));

      // @ts-expect-error - accessing private method for testing
      const staleComments = await processor.findStaleComments();

      // Should not fail, just return empty stale comments
      expect(staleComments).toBeDefined();
      expect(staleComments).toHaveLength(0);
    });

    it('should combine stale comments with other documentation issues', async () => {
      // Mock both stale comments and other documentation issues
      const mockFindOutput = './src/api.ts';
      const mockFileContent = `
/**
 * @deprecated Use newApi() instead
 */
export function oldApi() {
  // TODO: Remove this after migration
  return 'old';
}
      `.trim();

      const thirtyFiveDaysAgo = Math.floor((Date.now() - 35 * 24 * 60 * 60 * 1000) / 1000);

      mockExecAsync
        .mockResolvedValueOnce({ stdout: mockFindOutput, stderr: '' })
        .mockResolvedValueOnce({
          stdout: `ghi789 1 1 1
author Migration Team
author-time ${thirtyFiveDaysAgo}
filename src/api.ts
	  // TODO: Remove this after migration`,
          stderr: ''
        })
        .mockResolvedValue({ stdout: '', stderr: '' });

      mockReadFile.mockResolvedValue(mockFileContent);

      // @ts-expect-error - accessing private method for testing
      const staleComments = await processor.findStaleComments();

      // Should find stale comments
      expect(staleComments.length).toBeGreaterThan(0);

      const staleComment = staleComments.find(
        doc => doc.type === 'stale-reference'
      );

      expect(staleComment).toBeDefined();
      expect(staleComment?.description).toContain('35 days ago');
    });

    it('should respect processor configuration for file exclusions', async () => {
      // Test that the processor correctly excludes test files and node_modules
      const mockFindOutput = `./src/main.ts
./src/main.test.ts
./node_modules/lib/index.ts
./tests/integration.ts`;

      const mockMainContent = '// TODO: Add logging';
      const mockTestContent = '// TODO: Add more test cases';

      mockExecAsync
        .mockResolvedValueOnce({ stdout: mockFindOutput, stderr: '' })
        .mockResolvedValue({ stdout: '', stderr: '' });

      // Mock file reads - should only read non-test, non-node_modules files
      mockReadFile
        .mockResolvedValueOnce(mockMainContent)
        .mockResolvedValueOnce(mockTestContent);

      // @ts-expect-error - accessing private method for testing
      const staleComments = await processor.findStaleComments();

      // Verify that find command excluded test files and node_modules
      expect(mockExecAsync).toHaveBeenCalledWith(
        expect.stringMatching(/grep -v test.*grep -v node_modules/)
      );
    });
  });

  describe('Error handling and fallbacks', () => {
    it('should handle processor errors gracefully without affecting other analysis', async () => {
      // Mock one aspect of analysis failing
      mockExecAsync
        .mockRejectedValueOnce(new Error('Find command failed'))
        .mockResolvedValue({ stdout: '', stderr: '' });

      // Should not throw, just continue with other analysis
      // @ts-expect-error - accessing private method for testing
      const staleComments = await processor.findStaleComments();

      expect(staleComments).toBeDefined();
      expect(staleComments).toHaveLength(0);
    });

    it('should handle mixed success/failure scenarios', async () => {
      const mockFindOutput = `./src/working.ts
./src/broken.ts`;

      const mockWorkingContent = '// TODO: This file works';
      const mockBrokenContent = '// TODO: This file has issues';

      mockReadFile
        .mockResolvedValueOnce(mockWorkingContent)
        .mockRejectedValueOnce(new Error('File read failed'));

      const fortyDaysAgo = Math.floor((Date.now() - 40 * 24 * 60 * 60 * 1000) / 1000);

      mockExecAsync
        .mockResolvedValueOnce({ stdout: mockFindOutput, stderr: '' })
        // Git blame succeeds for first file
        .mockResolvedValueOnce({
          stdout: `abc123 1 1 1
author Success User
author-time ${fortyDaysAgo}
filename src/working.ts
	// TODO: This file works`,
          stderr: ''
        })
        .mockResolvedValue({ stdout: '', stderr: '' });

      // @ts-expect-error - accessing private method for testing
      const staleComments = await processor.findStaleComments();

      // Should find the one that worked
      expect(staleComments).toHaveLength(1);
      expect(staleComments[0].file).toBe('src/working.ts');
    });
  });

  describe('Performance considerations', () => {
    it('should not significantly slow down overall analysis', async () => {
      // Create a scenario with moderate number of files
      const fileList = Array.from({ length: 50 }, (_, i) => `./src/file${i}.ts`);
      const mockFindOutput = fileList.join('\n');

      const mockFileContent = '// TODO: Standard comment';
      const thirtyFiveDaysAgo = Math.floor((Date.now() - 35 * 24 * 60 * 60 * 1000) / 1000);

      // Mock responses for all files
      mockExecAsync.mockResolvedValueOnce({ stdout: mockFindOutput, stderr: '' });

      for (let i = 0; i < 50; i++) {
        mockReadFile.mockResolvedValueOnce(mockFileContent);
        mockExecAsync.mockResolvedValueOnce({
          stdout: `commit${i} 1 1 1
author Developer ${i}
author-time ${thirtyFiveDaysAgo}
filename src/file${i}.ts
	// TODO: Standard comment`,
          stderr: ''
        });
      }

      mockExecAsync.mockResolvedValue({ stdout: '', stderr: '' });

      const start = Date.now();
      // @ts-expect-error - accessing private method for testing
      const staleComments = await processor.findStaleComments();
      const duration = Date.now() - start;

      // Analysis should complete in reasonable time even with many files
      expect(duration).toBeLessThan(10000); // 10 seconds max for mocked operations

      expect(staleComments).toHaveLength(50);
    });
  });
});