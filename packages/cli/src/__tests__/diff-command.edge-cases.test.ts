/**
 * Diff Command Edge Cases and Integration Tests
 * Tests edge cases, error scenarios, and git integration functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ApexOrchestrator } from '@apexcli/orchestrator';
import { commands } from '../index.js';
import { Task, TaskStatus } from '@apexcli/core';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';

// Mock child_process.spawn
vi.mock('child_process', () => ({
  spawn: vi.fn(),
}));

const mockSpawn = vi.mocked(spawn);

describe('Diff Command Edge Cases', () => {
  let tempDir: string;
  let orchestrator: ApexOrchestrator;
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let cwdSpy: ReturnType<typeof vi.spyOn>;

  const createMockContext = () => ({
    orchestrator,
    cwd: tempDir,
    initialized: true,
    config: null,
    apiProcess: null,
    webUIProcess: null,
    apiPort: 3000,
    webUIPort: 3001,
  });

  const createMockTask = (overrides: Partial<Task> = {}): Task => ({
    id: 'test-task-123',
    description: 'Test task for diff edge cases',
    workflow: 'feature',
    autonomy: 'high' as const,
    status: 'completed' as TaskStatus,
    priority: 'normal' as const,
    effort: 'medium' as const,
    projectPath: tempDir,
    retryCount: 0,
    maxRetries: 3,
    resumeAttempts: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    usage: {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      estimatedCost: 0,
    },
    logs: [],
    artifacts: [],
    ...overrides,
  });

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-diff-edge-test-'));
    await fs.ensureDir(path.join(tempDir, '.apex'));

    const configContent = `
project:
  name: diff-edge-case-test
agents:
  developer:
    model: haiku
workflows:
  feature:
    stages:
      - name: implementation
        agent: developer
`;
    await fs.writeFile(path.join(tempDir, '.apex', 'config.yaml'), configContent);

    cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(tempDir);
    orchestrator = new ApexOrchestrator({ projectPath: tempDir });
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(async () => {
    consoleSpy.mockRestore();
    cwdSpy.mockRestore();
    vi.clearAllMocks();

    if (tempDir && await fs.pathExists(tempDir)) {
      await fs.remove(tempDir);
    }
  });

  describe('Git Integration Edge Cases', () => {
    it('should handle git command failure gracefully', async () => {
      const diffCommand = commands.find(cmd => cmd.name === 'diff');
      const mockTask = createMockTask({
        branchName: 'feature/test-git-failure',
        artifacts: [],
        iterationHistory: { taskId: 'test-task-123', entries: [] },
      });

      const getTaskSpy = vi.spyOn(orchestrator, 'getTask').mockResolvedValue(mockTask);

      // Mock failing git process
      const mockFailingGitProcess = {
        stdout: { on: vi.fn() },
        stderr: {
          on: vi.fn((event, callback) => {
            if (event === 'data') {
              callback('fatal: not a git repository');
            }
          }),
        },
        on: vi.fn((event, callback) => {
          if (event === 'close') {
            callback(128); // Git error exit code
          }
        }),
      };

      mockSpawn.mockReturnValue(mockFailingGitProcess as any);

      await diffCommand!.handler(createMockContext(), ['test-task-123']);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('⚠️  Could not fetch git diff')
      );

      getTaskSpy.mockRestore();
    });

    it('should handle git diff with no output', async () => {
      const diffCommand = commands.find(cmd => cmd.name === 'diff');
      const mockTask = createMockTask({
        branchName: 'feature/no-changes',
        artifacts: [],
        iterationHistory: { taskId: 'test-task-123', entries: [] },
      });

      const getTaskSpy = vi.spyOn(orchestrator, 'getTask').mockResolvedValue(mockTask);

      const mockEmptyGitProcess = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn((event, callback) => {
          if (event === 'close') {
            callback(0);
          }
        }),
      };

      mockSpawn.mockReturnValue(mockEmptyGitProcess as any);

      await diffCommand!.handler(createMockContext(), ['test-task-123']);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('🔀 Git changes:')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('No git changes found')
      );

      getTaskSpy.mockRestore();
    });

    it('should handle very large git diff output', async () => {
      const diffCommand = commands.find(cmd => cmd.name === 'diff');
      const mockTask = createMockTask({
        branchName: 'feature/large-diff',
        artifacts: [],
        iterationHistory: { taskId: 'test-task-123', entries: [] },
      });

      const getTaskSpy = vi.spyOn(orchestrator, 'getTask').mockResolvedValue(mockTask);

      const largeDiff = Array(1000).fill('+   console.log("large diff line");').join('\n');
      const mockLargeGitProcess = {
        stdout: {
          on: vi.fn((event, callback) => {
            if (event === 'data') {
              callback(largeDiff);
            }
          }),
        },
        stderr: { on: vi.fn() },
        on: vi.fn((event, callback) => {
          if (event === 'close') {
            callback(0);
          }
        }),
      };

      mockSpawn.mockReturnValue(mockLargeGitProcess as any);

      await diffCommand!.handler(createMockContext(), ['test-task-123']);

      // Should handle large output without crashing
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('🔀 Git changes:')
      );

      getTaskSpy.mockRestore();
    });

    it('should handle git diff syntax highlighting edge cases', async () => {
      const diffCommand = commands.find(cmd => cmd.name === 'diff');
      const mockTask = createMockTask({
        branchName: 'feature/syntax-test',
        artifacts: [],
        iterationHistory: { taskId: 'test-task-123', entries: [] },
      });

      const getTaskSpy = vi.spyOn(orchestrator, 'getTask').mockResolvedValue(mockTask);

      const complexDiff = `diff --git a/src/file.js b/src/file.js
index abc123..def456 100644
--- a/src/file.js
+++ b/src/file.js
@@ -1,10 +1,15 @@
 function test() {
+  // Added comment
   const data = {
-    old: 'value'
+    new: 'value',
+    added: 'property'
   };
-  console.log(data.old);
+  console.log(data.new);
 }
+
+// Added function
+function newFunction() {
+  return true;
+}`;

      const mockComplexGitProcess = {
        stdout: {
          on: vi.fn((event, callback) => {
            if (event === 'data') {
              callback(complexDiff);
            }
          }),
        },
        stderr: { on: vi.fn() },
        on: vi.fn((event, callback) => {
          if (event === 'close') {
            callback(0);
          }
        }),
      };

      mockSpawn.mockReturnValue(mockComplexGitProcess as any);

      await diffCommand!.handler(createMockContext(), ['test-task-123']);

      // Verify that different line types are handled
      const logCalls = consoleSpy.mock.calls.flat();
      const hasColoredOutput = logCalls.some(call =>
        typeof call === 'string' &&
        (call.includes('\u001b[') || call.includes('@@') || call.includes('+++') || call.includes('---'))
      );

      expect(hasColoredOutput).toBe(true);

      getTaskSpy.mockRestore();
    });
  });

  describe('Data Format Edge Cases', () => {
    it('should handle malformed iteration history gracefully', async () => {
      const diffCommand = commands.find(cmd => cmd.name === 'diff');
      const mockTask = createMockTask({
        iterationHistory: {
          taskId: 'test-task-123',
          entries: [
            {
              id: 'malformed-entry',
              feedback: '', // Empty feedback
              iteratedAt: new Date(),
              modifiedFiles: undefined as any, // Undefined array
            },
            {
              id: 'null-entry',
              feedback: 'null test',
              iteratedAt: new Date(),
              modifiedFiles: null as any, // Null array
            },
          ],
        },
      });

      const getTaskSpy = vi.spyOn(orchestrator, 'getTask').mockResolvedValue(mockTask);

      await diffCommand!.handler(createMockContext(), ['test-task-123']);

      // Should handle malformed data without crashing
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('📈 Iteration History:')
      );

      getTaskSpy.mockRestore();
    });

    it('should handle artifacts with missing or null content', async () => {
      const diffCommand = commands.find(cmd => cmd.name === 'diff');
      const mockTask = createMockTask({
        artifacts: [
          {
            name: 'Empty Content',
            type: 'diff',
            path: 'src/empty.js',
            content: '',
            createdAt: new Date(),
          },
          {
            name: 'Null Content',
            type: 'diff',
            path: 'src/null.js',
            content: null as any,
            createdAt: new Date(),
          },
          {
            name: 'Undefined Content',
            type: 'diff',
            content: undefined as any,
            createdAt: new Date(),
          },
        ],
      });

      const getTaskSpy = vi.spyOn(orchestrator, 'getTask').mockResolvedValue(mockTask);

      await diffCommand!.handler(createMockContext(), ['test-task-123']);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('📄 Diff artifacts:')
      );

      getTaskSpy.mockRestore();
    });

    it('should handle very long file paths and names', async () => {
      const diffCommand = commands.find(cmd => cmd.name === 'diff');
      const longPath = 'src/' + 'a'.repeat(200) + '/' + 'very-long-filename-'.repeat(10) + '.js';
      const mockTask = createMockTask({
        artifacts: [
          {
            name: 'Very Long Path Diff',
            type: 'diff',
            path: longPath,
            content: '@@ -1,1 +1,2 @@\n console.log("test");\n+console.log("added");',
            createdAt: new Date(),
          },
        ],
      });

      const getTaskSpy = vi.spyOn(orchestrator, 'getTask').mockResolvedValue(mockTask);

      await diffCommand!.handler(createMockContext(), ['test-task-123']);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('File: ' + longPath)
      );

      getTaskSpy.mockRestore();
    });

    it('should handle special characters in file paths', async () => {
      const diffCommand = commands.find(cmd => cmd.name === 'diff');
      const specialPaths = [
        'src/file with spaces.js',
        'src/file-with-dashes.js',
        'src/file_with_underscores.js',
        'src/file.with.dots.js',
        'src/file@with@symbols.js',
        'src/file[with][brackets].js',
      ];

      const mockTask = createMockTask({
        artifacts: specialPaths.map((path, index) => ({
          name: `Special Path ${index}`,
          type: 'diff' as const,
          path,
          content: '@@ -1,1 +1,1 @@\n-old\n+new',
          createdAt: new Date(),
        })),
      });

      const getTaskSpy = vi.spyOn(orchestrator, 'getTask').mockResolvedValue(mockTask);

      await diffCommand!.handler(createMockContext(), ['test-task-123']);

      specialPaths.forEach(path => {
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining(`File: ${path}`)
        );
      });

      getTaskSpy.mockRestore();
    });
  });

  describe('Option Parsing Edge Cases', () => {
    it('should handle multiple --file flags', async () => {
      const diffCommand = commands.find(cmd => cmd.name === 'diff');

      await diffCommand!.handler(createMockContext(), ['test-task-123', '--file', 'file1.js', '--file', 'file2.js']);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌ Failed to show diff: Multiple --file options not supported')
      );
    });

    it('should handle --file flag at the end without value', async () => {
      const diffCommand = commands.find(cmd => cmd.name === 'diff');

      await diffCommand!.handler(createMockContext(), ['test-task-123', '--stat', '--file']);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌ Failed to show diff: --file option requires a file path')
      );
    });

    it('should handle unknown flags gracefully', async () => {
      const diffCommand = commands.find(cmd => cmd.name === 'diff');

      await diffCommand!.handler(createMockContext(), ['test-task-123', '--unknown-flag']);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌ Failed to show diff: Unknown option: --unknown-flag')
      );
    });

    it('should handle empty task ID', async () => {
      const diffCommand = commands.find(cmd => cmd.name === 'diff');

      await diffCommand!.handler(createMockContext(), ['']);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌ Failed to show diff: Task ID cannot be empty')
      );
    });

    it('should handle whitespace-only task ID', async () => {
      const diffCommand = commands.find(cmd => cmd.name === 'diff');

      await diffCommand!.handler(createMockContext(), ['   ']);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌ Failed to show diff: Task ID cannot be empty')
      );
    });
  });

  describe('Performance and Memory Edge Cases', () => {
    it('should handle large number of artifacts', async () => {
      const diffCommand = commands.find(cmd => cmd.name === 'diff');

      // Create many artifacts
      const manyArtifacts = Array.from({ length: 100 }, (_, i) => ({
        name: `Artifact ${i}`,
        type: 'diff' as const,
        path: `src/file${i}.js`,
        content: `@@ -1,1 +1,1 @@\n-old${i}\n+new${i}`,
        createdAt: new Date(),
      }));

      const mockTask = createMockTask({
        artifacts: manyArtifacts,
      });

      const getTaskSpy = vi.spyOn(orchestrator, 'getTask').mockResolvedValue(mockTask);

      const startTime = Date.now();
      await diffCommand!.handler(createMockContext(), ['test-task-123']);
      const endTime = Date.now();

      // Should complete in reasonable time (less than 5 seconds)
      expect(endTime - startTime).toBeLessThan(5000);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('📄 Diff artifacts:')
      );

      getTaskSpy.mockRestore();
    });

    it('should handle very large diff content', async () => {
      const diffCommand = commands.find(cmd => cmd.name === 'diff');

      // Create very large diff content
      const largeDiffContent = Array.from({ length: 10000 }, (_, i) =>
        `+  console.log("line ${i} added");`
      ).join('\n');

      const mockTask = createMockTask({
        artifacts: [
          {
            name: 'Large Diff',
            type: 'diff',
            path: 'src/large.js',
            content: `@@ -1,1 +1,10001 @@\n${largeDiffContent}`,
            createdAt: new Date(),
          },
        ],
      });

      const getTaskSpy = vi.spyOn(orchestrator, 'getTask').mockResolvedValue(mockTask);

      await diffCommand!.handler(createMockContext(), ['test-task-123']);

      // Should handle large content without error
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('📄 Diff artifacts:')
      );

      getTaskSpy.mockRestore();
    });
  });

  describe('Concurrent Access Edge Cases', () => {
    it('should handle concurrent diff requests gracefully', async () => {
      const diffCommand = commands.find(cmd => cmd.name === 'diff');
      const mockTask = createMockTask();

      const getTaskSpy = vi.spyOn(orchestrator, 'getTask')
        .mockResolvedValue(mockTask);

      // Run multiple diff commands concurrently
      const promises = Array.from({ length: 5 }, (_, i) =>
        diffCommand!.handler(createMockContext(), [`test-task-${i}`])
      );

      await Promise.allSettled(promises);

      // All should complete without error
      expect(getTaskSpy).toHaveBeenCalledTimes(5);

      getTaskSpy.mockRestore();
    });
  });

  describe('System Resource Edge Cases', () => {
    it('should handle filesystem access errors gracefully', async () => {
      const diffCommand = commands.find(cmd => cmd.name === 'diff');
      const mockTask = createMockTask({
        branchName: 'feature/fs-error',
        artifacts: [],
        iterationHistory: { taskId: 'test-task-123', entries: [] },
      });

      const getTaskSpy = vi.spyOn(orchestrator, 'getTask').mockResolvedValue(mockTask);

      // Mock spawn to throw an error
      mockSpawn.mockImplementation(() => {
        throw new Error('EACCES: permission denied');
      });

      await diffCommand!.handler(createMockContext(), ['test-task-123']);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('⚠️  Could not fetch git diff')
      );

      getTaskSpy.mockRestore();
    });
  });

  describe('Unicode and Encoding Edge Cases', () => {
    it('should handle unicode content in diffs', async () => {
      const diffCommand = commands.find(cmd => cmd.name === 'diff');
      const unicodeDiff = `@@ -1,2 +1,3 @@
 const message = "Hello";
+const emoji = "🚀 APEX diff test 📊";
+const unicode = "测试 unicode αβγ";`;

      const mockTask = createMockTask({
        artifacts: [
          {
            name: 'Unicode Diff',
            type: 'diff',
            path: 'src/unicode.js',
            content: unicodeDiff,
            createdAt: new Date(),
          },
        ],
      });

      const getTaskSpy = vi.spyOn(orchestrator, 'getTask').mockResolvedValue(mockTask);

      await diffCommand!.handler(createMockContext(), ['test-task-123']);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('📄 Diff artifacts:')
      );

      // Should handle unicode content without errors
      const logCalls = consoleSpy.mock.calls.flat().join(' ');
      expect(logCalls).toContain('🚀');

      getTaskSpy.mockRestore();
    });
  });
});