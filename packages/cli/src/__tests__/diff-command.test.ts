/**
 * Diff Command Tests
 * Comprehensive tests for the apex diff command functionality
 * Tests all acceptance criteria: basic diff, --stat, --file, --staged options
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ApexOrchestrator } from '@apexcli/orchestrator';
import { commands } from '../index.js';
import { Task, TaskStatus, IterationDiff } from '@apexcli/core';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';

// Mock child_process.spawn
vi.mock('child_process', () => ({
  spawn: vi.fn(),
}));

const mockSpawn = vi.mocked(spawn);

describe('Diff Command', () => {
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
    description: 'Test task for diff command',
    workflow: 'feature',
    autonomy: 'high' as const,
    status: 'completed' as TaskStatus,
    priority: 'normal' as const,
    effort: 'medium' as const,
    projectPath: tempDir,
    branchName: 'test-branch',
    retryCount: 0,
    maxRetries: 3,
    resumeAttempts: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    usage: {
      inputTokens: 1000,
      outputTokens: 500,
      totalTokens: 1500,
      estimatedCost: 0.075,
    },
    logs: [],
    artifacts: [],
    iterationHistory: {
      taskId: 'test-task-123',
      entries: [
        {
          id: 'iteration-001',
          feedback: 'Initial implementation',
          iteratedAt: new Date(),
          modifiedFiles: ['src/app.js', 'tests/app.test.js'],
          diffSummary: '2 files modified, 50 lines added',
        },
      ],
    },
    ...overrides,
  });

  beforeEach(async () => {
    // Create temporary directory for test project
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-diff-test-'));

    // Set up basic project structure
    await fs.ensureDir(path.join(tempDir, '.apex'));
    await fs.ensureDir(path.join(tempDir, 'src'));

    // Create minimal config
    const configContent = `
project:
  name: diff-command-test
  version: 1.0.0
agents:
  developer:
    model: haiku
    autonomy: high
workflows:
  feature:
    stages:
      - name: implementation
        agent: developer
limits:
  maxTokens: 10000
  maxCost: 1.0
`;

    await fs.writeFile(path.join(tempDir, '.apex', 'config.yaml'), configContent);

    // Mock process.cwd to return our temp directory
    cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(tempDir);

    // Initialize orchestrator
    orchestrator = new ApexOrchestrator({ projectPath: tempDir });

    // Mock console.log to capture output
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(async () => {
    consoleSpy.mockRestore();
    cwdSpy.mockRestore();
    vi.clearAllMocks();

    // Clean up temp directory
    if (tempDir && await fs.pathExists(tempDir)) {
      await fs.remove(tempDir);
    }
  });

  describe('Basic Diff Functionality', () => {
    it('should show usage information when no task ID provided', async () => {
      const diffCommand = commands.find(cmd => cmd.name === 'diff');
      expect(diffCommand).toBeDefined();

      await diffCommand!.handler(createMockContext(), []);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Usage: /diff <task_id>')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Options:')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('--stat')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('--file <path>')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('--staged')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Examples:')
      );
    });

    it('should show error when orchestrator not initialized', async () => {
      const diffCommand = commands.find(cmd => cmd.name === 'diff');
      const context = {
        ...createMockContext(),
        initialized: false,
        orchestrator: null,
      };

      await diffCommand!.handler(context, ['task-123']);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('APEX not initialized. Run /init first.')
      );
    });

    it('should show detailed diff for a task with iteration history', async () => {
      const diffCommand = commands.find(cmd => cmd.name === 'diff');
      const mockTask = createMockTask({
        iterationHistory: {
          taskId: 'test-task-123',
          entries: [
            {
              id: 'iteration-001',
              feedback: 'Add new feature implementation',
              iteratedAt: new Date(),
              modifiedFiles: ['src/feature.js', 'tests/feature.test.js'],
              diffSummary: 'Added 2 files, modified 1 file',
            },
            {
              id: 'iteration-002',
              feedback: 'Fix bug in implementation',
              iteratedAt: new Date(),
              modifiedFiles: ['src/feature.js'],
              diffSummary: 'Fixed bug, 5 lines changed',
            },
          ],
        },
      });

      const getTaskSpy = vi.spyOn(orchestrator, 'getTask').mockResolvedValue(mockTask);

      await diffCommand!.handler(createMockContext(), ['test-task-123']);

      expect(getTaskSpy).toHaveBeenCalledWith('test-task-123');

      // Verify iteration history display
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('📈 Iteration History:')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Iteration 001:')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Add new feature implementation')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Files modified: src/feature.js, tests/feature.test.js')
      );

      getTaskSpy.mockRestore();
    });

    it('should show diff artifacts when available', async () => {
      const diffCommand = commands.find(cmd => cmd.name === 'diff');
      const mockTask = createMockTask({
        artifacts: [
          {
            name: 'Git Diff',
            type: 'diff',
            path: 'src/app.js',
            content: `@@ -1,3 +1,5 @@
 function hello() {
+  console.log('Hello, World!');
   return 'Hello';
 }`,
            createdAt: new Date(),
          },
          {
            name: 'Another Diff',
            type: 'diff',
            content: `@@ -5,2 +5,4 @@
+  // Added comment
   const result = calculate();`,
            createdAt: new Date(),
          },
        ],
      });

      const getTaskSpy = vi.spyOn(orchestrator, 'getTask').mockResolvedValue(mockTask);

      await diffCommand!.handler(createMockContext(), ['test-task-123']);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('📄 Diff artifacts:')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Git Diff:')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('File: src/app.js')
      );

      getTaskSpy.mockRestore();
    });

    it('should fall back to git diff when task has branch but no artifacts', async () => {
      const diffCommand = commands.find(cmd => cmd.name === 'diff');
      const mockTask = createMockTask({
        branchName: 'feature/test-branch',
        artifacts: [],
        iterationHistory: { taskId: 'test-task-123', entries: [] },
      });

      const getTaskSpy = vi.spyOn(orchestrator, 'getTask').mockResolvedValue(mockTask);

      // Mock git process
      const mockGitProcess = {
        stdout: {
          on: vi.fn((event, callback) => {
            if (event === 'data') {
              callback(`diff --git a/src/app.js b/src/app.js
index 1234567..abcdefg 100644
--- a/src/app.js
+++ b/src/app.js
@@ -1,3 +1,4 @@
 function hello() {
+  console.log('Hello, World!');
   return 'Hello';
 }`);
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

      mockSpawn.mockReturnValue(mockGitProcess as any);

      await diffCommand!.handler(createMockContext(), ['test-task-123']);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('🔀 Git changes:')
      );
      expect(mockSpawn).toHaveBeenCalledWith('git', ['diff', 'main...HEAD'], {
        cwd: tempDir,
        stdio: ['inherit', 'pipe', 'pipe'],
      });

      getTaskSpy.mockRestore();
    });

    it('should show file artifacts when available', async () => {
      const diffCommand = commands.find(cmd => cmd.name === 'diff');
      const mockTask = createMockTask({
        artifacts: [
          {
            name: 'Modified File',
            type: 'file',
            path: 'src/utils.js',
            content: 'console.log("new code");',
            createdAt: new Date(),
          },
          {
            name: 'Created File',
            type: 'file',
            path: 'src/newfeature.js',
            content: 'export const newFeature = () => {};',
            createdAt: new Date(),
          },
        ],
        iterationHistory: { taskId: 'test-task-123', entries: [] },
      });

      const getTaskSpy = vi.spyOn(orchestrator, 'getTask').mockResolvedValue(mockTask);

      await diffCommand!.handler(createMockContext(), ['test-task-123']);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('📁 Modified files:')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('src/utils.js')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('src/newfeature.js')
      );

      getTaskSpy.mockRestore();
    });

    it('should show warning when no diff information is available', async () => {
      const diffCommand = commands.find(cmd => cmd.name === 'diff');
      const mockTask = createMockTask({
        artifacts: [],
        iterationHistory: { taskId: 'test-task-123', entries: [] },
        branchName: undefined,
      });

      const getTaskSpy = vi.spyOn(orchestrator, 'getTask').mockResolvedValue(mockTask);

      await diffCommand!.handler(createMockContext(), ['test-task-123']);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('⚠️  No diff information available for this task.')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('The task may not have made any code changes yet.')
      );

      getTaskSpy.mockRestore();
    });

    it('should handle task not found error gracefully', async () => {
      const diffCommand = commands.find(cmd => cmd.name === 'diff');

      const getTaskSpy = vi.spyOn(orchestrator, 'getTask').mockResolvedValue(null);

      await diffCommand!.handler(createMockContext(), ['nonexistent-task']);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌ Failed to show diff: Task not found: nonexistent-task')
      );

      getTaskSpy.mockRestore();
    });

    it('should handle orchestrator errors gracefully', async () => {
      const diffCommand = commands.find(cmd => cmd.name === 'diff');

      const getTaskSpy = vi.spyOn(orchestrator, 'getTask')
        .mockRejectedValue(new Error('Database connection failed'));

      await diffCommand!.handler(createMockContext(), ['test-task-123']);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌ Failed to show diff: Database connection failed')
      );

      getTaskSpy.mockRestore();
    });
  });

  describe('--stat Option', () => {
    it('should show change statistics with --stat flag', async () => {
      const diffCommand = commands.find(cmd => cmd.name === 'diff');
      const mockTask = createMockTask({
        branchName: 'feature/test-stats',
        iterationHistory: {
          taskId: 'test-task-123',
          entries: [
            {
              id: 'iteration-001',
              feedback: 'Add features',
              iteratedAt: new Date(),
              modifiedFiles: ['src/app.js', 'src/utils.js', 'tests/app.test.js'],
              diffSummary: '3 files modified',
            },
          ],
        },
      });

      const getTaskSpy = vi.spyOn(orchestrator, 'getTask').mockResolvedValue(mockTask);

      // Mock git diff --stat process
      const mockGitStatsProcess = {
        stdout: {
          on: vi.fn((event, callback) => {
            if (event === 'data') {
              callback(` src/app.js      | 15 +++++++++++++++
 src/utils.js    |  8 ++++++++
 tests/app.test.js | 12 ++++++++++++
 3 files changed, 35 insertions(+)`);
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

      mockSpawn.mockReturnValue(mockGitStatsProcess as any);

      await diffCommand!.handler(createMockContext(), ['test-task-123', '--stat']);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('📊 Change Statistics:')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Git diff statistics:')
      );
      expect(mockSpawn).toHaveBeenCalledWith('git', ['diff', '--stat', 'main...HEAD'], {
        cwd: tempDir,
        stdio: ['inherit', 'pipe', 'pipe'],
      });

      getTaskSpy.mockRestore();
    });

    it('should show iteration statistics when no git changes', async () => {
      const diffCommand = commands.find(cmd => cmd.name === 'diff');
      const mockTask = createMockTask({
        iterationHistory: {
          taskId: 'test-task-123',
          entries: [
            {
              id: 'iteration-001',
              feedback: 'First iteration',
              iteratedAt: new Date(),
              modifiedFiles: ['file1.js', 'file2.js'],
            },
            {
              id: 'iteration-002',
              feedback: 'Second iteration',
              iteratedAt: new Date(),
              modifiedFiles: ['file3.js'],
            },
          ],
        },
        artifacts: [
          { name: 'diff1', type: 'diff', createdAt: new Date() },
          { name: 'diff2', type: 'diff', createdAt: new Date() },
          { name: 'file1', type: 'file', createdAt: new Date() },
        ],
      });

      const getTaskSpy = vi.spyOn(orchestrator, 'getTask').mockResolvedValue(mockTask);

      await diffCommand!.handler(createMockContext(), ['test-task-123', '--stat']);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Total iterations: 2')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unique files modified: 3')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Task artifacts:')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Diff artifacts: 2')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('File artifacts: 1')
      );

      getTaskSpy.mockRestore();
    });

    it('should show warning when no statistics available', async () => {
      const diffCommand = commands.find(cmd => cmd.name === 'diff');
      const mockTask = createMockTask({
        artifacts: [],
        iterationHistory: { taskId: 'test-task-123', entries: [] },
        branchName: undefined,
      });

      const getTaskSpy = vi.spyOn(orchestrator, 'getTask').mockResolvedValue(mockTask);

      await diffCommand!.handler(createMockContext(), ['test-task-123', '--stat']);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('⚠️  No change statistics available for this task.')
      );

      getTaskSpy.mockRestore();
    });
  });

  describe('--file Option', () => {
    it('should show diff for specific file with --file flag', async () => {
      const diffCommand = commands.find(cmd => cmd.name === 'diff');
      const mockTask = createMockTask({
        artifacts: [
          {
            name: 'Target File Diff',
            type: 'diff',
            path: 'src/target.js',
            content: `@@ -1,2 +1,4 @@
 const target = true;
+// Added comment
+console.log('target file');`,
            createdAt: new Date(),
          },
          {
            name: 'Other File Diff',
            type: 'diff',
            path: 'src/other.js',
            content: '@@ -1,1 +1,1 @@\n-old\n+new',
            createdAt: new Date(),
          },
        ],
      });

      const getTaskSpy = vi.spyOn(orchestrator, 'getTask').mockResolvedValue(mockTask);

      await diffCommand!.handler(createMockContext(), ['test-task-123', '--file', 'src/target.js']);

      // Should only show diff for the specific file
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Target File Diff:')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('File: src/target.js')
      );
      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('Other File Diff:')
      );

      getTaskSpy.mockRestore();
    });

    it('should fall back to git diff for specific file when no matching artifacts', async () => {
      const diffCommand = commands.find(cmd => cmd.name === 'diff');
      const mockTask = createMockTask({
        branchName: 'feature/test-file-diff',
        artifacts: [
          {
            name: 'Other File',
            type: 'diff',
            path: 'src/other.js',
            content: 'some diff content',
            createdAt: new Date(),
          },
        ],
      });

      const getTaskSpy = vi.spyOn(orchestrator, 'getTask').mockResolvedValue(mockTask);

      const mockGitProcess = {
        stdout: {
          on: vi.fn((event, callback) => {
            if (event === 'data') {
              callback(`@@ -1,1 +1,2 @@
 console.log('target file');
+// Added line`);
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

      mockSpawn.mockReturnValue(mockGitProcess as any);

      await diffCommand!.handler(createMockContext(), ['test-task-123', '--file', 'src/target.js']);

      expect(mockSpawn).toHaveBeenCalledWith('git', ['diff', 'main...HEAD', '--', 'src/target.js'], {
        cwd: tempDir,
        stdio: ['inherit', 'pipe', 'pipe'],
      });

      getTaskSpy.mockRestore();
    });

    it('should handle missing --file argument gracefully', async () => {
      const diffCommand = commands.find(cmd => cmd.name === 'diff');

      await diffCommand!.handler(createMockContext(), ['test-task-123', '--file']);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌ Failed to show diff: --file option requires a file path')
      );
    });
  });

  describe('--staged Option', () => {
    it('should show staged changes with --staged flag', async () => {
      const diffCommand = commands.find(cmd => cmd.name === 'diff');
      const mockTask = createMockTask();

      const getTaskSpy = vi.spyOn(orchestrator, 'getTask').mockResolvedValue(mockTask);

      // Mock git status process
      const mockStatusProcess = {
        stdout: {
          on: vi.fn((event, callback) => {
            if (event === 'data') {
              callback(`M  src/app.js
A  src/new.js
D  src/old.js`);
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

      // Mock git diff --staged process
      const mockStagedProcess = {
        stdout: {
          on: vi.fn((event, callback) => {
            if (event === 'data') {
              callback(`diff --git a/src/app.js b/src/app.js
index 1234567..abcdefg 100644
--- a/src/app.js
+++ b/src/app.js
@@ -1,2 +1,3 @@
 const app = true;
+console.log('staged change');`);
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

      mockSpawn
        .mockReturnValueOnce(mockStatusProcess as any) // First call for git status
        .mockReturnValueOnce(mockStagedProcess as any); // Second call for git diff --staged

      await diffCommand!.handler(createMockContext(), ['test-task-123', '--staged']);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('🚀 Staged/Working Directory Changes:')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Staged changes (ready to commit):')
      );
      expect(mockSpawn).toHaveBeenCalledWith('git', ['status', '--porcelain'], {
        cwd: tempDir,
        stdio: ['inherit', 'pipe', 'pipe'],
      });
      expect(mockSpawn).toHaveBeenCalledWith('git', ['diff', '--staged'], {
        cwd: tempDir,
        stdio: ['inherit', 'pipe', 'pipe'],
      });

      getTaskSpy.mockRestore();
    });

    it('should handle no staged changes gracefully', async () => {
      const diffCommand = commands.find(cmd => cmd.name === 'diff');
      const mockTask = createMockTask();

      const getTaskSpy = vi.spyOn(orchestrator, 'getTask').mockResolvedValue(mockTask);

      // Mock empty git status
      const mockEmptyStatusProcess = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn((event, callback) => {
          if (event === 'close') {
            callback(0);
          }
        }),
      };

      // Mock empty git diff --staged
      const mockEmptyStagedProcess = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn((event, callback) => {
          if (event === 'close') {
            callback(0);
          }
        }),
      };

      mockSpawn
        .mockReturnValueOnce(mockEmptyStatusProcess as any)
        .mockReturnValueOnce(mockEmptyStagedProcess as any);

      await diffCommand!.handler(createMockContext(), ['test-task-123', '--staged']);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('🚀 Staged/Working Directory Changes:')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('No changes in working directory.')
      );

      getTaskSpy.mockRestore();
    });
  });

  describe('Option Combinations', () => {
    it('should handle --stat and --file together', async () => {
      const diffCommand = commands.find(cmd => cmd.name === 'diff');
      const mockTask = createMockTask({
        branchName: 'feature/test-combination',
      });

      const getTaskSpy = vi.spyOn(orchestrator, 'getTask').mockResolvedValue(mockTask);

      const mockGitProcess = {
        stdout: {
          on: vi.fn((event, callback) => {
            if (event === 'data') {
              callback(' src/app.js | 10 ++++++++++\n 1 file changed, 10 insertions(+)');
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

      mockSpawn.mockReturnValue(mockGitProcess as any);

      await diffCommand!.handler(createMockContext(), ['test-task-123', '--stat', '--file', 'src/app.js']);

      expect(mockSpawn).toHaveBeenCalledWith('git', ['diff', '--stat', 'main...HEAD', '--', 'src/app.js'], {
        cwd: tempDir,
        stdio: ['inherit', 'pipe', 'pipe'],
      });

      getTaskSpy.mockRestore();
    });

    it('should reject invalid option combinations', async () => {
      const diffCommand = commands.find(cmd => cmd.name === 'diff');

      await diffCommand!.handler(createMockContext(), ['test-task-123', '--staged', '--file', 'src/app.js']);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌ Failed to show diff: Cannot combine --staged with --file option')
      );
    });
  });

  describe('Command Aliases', () => {
    it('should work with "d" alias', async () => {
      const diffCommand = commands.find(cmd => cmd.name === 'diff');
      expect(diffCommand?.aliases).toContain('d');

      const mockTask = createMockTask();
      const getTaskSpy = vi.spyOn(orchestrator, 'getTask').mockResolvedValue(mockTask);

      await diffCommand!.handler(createMockContext(), ['test-task-123']);

      expect(getTaskSpy).toHaveBeenCalledWith('test-task-123');

      getTaskSpy.mockRestore();
    });
  });
});