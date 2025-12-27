/**
 * Diff Command Integration Tests
 * Tests integration with orchestrator, git, and real task scenarios
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ApexOrchestrator } from '@apexcli/orchestrator';
import { commands } from '../index.js';
import { Task, TaskStatus, IterationDiff } from '@apexcli/core';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

describe('Diff Command Integration Tests', () => {
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

  const createRealTaskScenario = (taskId: string, scenario: 'feature-complete' | 'in-progress' | 'failed'): Task => {
    const baseTask: Task = {
      id: taskId,
      description: 'Real-world feature implementation task',
      workflow: 'feature',
      autonomy: 'high' as const,
      status: 'completed' as TaskStatus,
      priority: 'high' as const,
      effort: 'large' as const,
      projectPath: tempDir,
      branchName: `feature/${taskId}`,
      retryCount: 0,
      maxRetries: 3,
      resumeAttempts: 0,
      createdAt: new Date('2024-01-01T10:00:00Z'),
      updatedAt: new Date('2024-01-01T12:00:00Z'),
      usage: {
        inputTokens: 5000,
        outputTokens: 2500,
        totalTokens: 7500,
        estimatedCost: 0.375,
      },
      logs: [
        {
          timestamp: new Date('2024-01-01T10:00:00Z'),
          level: 'info',
          message: 'Task started',
        },
        {
          timestamp: new Date('2024-01-01T11:00:00Z'),
          level: 'info',
          message: 'Implementation phase completed',
          stage: 'implementation',
        },
      ],
      artifacts: [],
    };

    switch (scenario) {
      case 'feature-complete':
        return {
          ...baseTask,
          status: 'completed',
          completedAt: new Date('2024-01-01T12:00:00Z'),
          prUrl: 'https://github.com/example/repo/pull/123',
          iterationHistory: {
            taskId,
            entries: [
              {
                id: `${taskId}-iter-001`,
                feedback: 'Implement initial feature structure',
                iteratedAt: new Date('2024-01-01T10:30:00Z'),
                modifiedFiles: [
                  'src/features/newFeature.js',
                  'src/features/newFeature.test.js',
                  'src/index.js',
                ],
                diffSummary: '3 files added, 15 lines added',
              },
              {
                id: `${taskId}-iter-002`,
                feedback: 'Add error handling and validation',
                iteratedAt: new Date('2024-01-01T11:00:00Z'),
                modifiedFiles: [
                  'src/features/newFeature.js',
                  'src/utils/validation.js',
                ],
                diffSummary: '2 files modified, 25 lines added',
              },
              {
                id: `${taskId}-iter-003`,
                feedback: 'Improve test coverage',
                iteratedAt: new Date('2024-01-01T11:30:00Z'),
                modifiedFiles: [
                  'src/features/newFeature.test.js',
                  'tests/integration/feature.test.js',
                ],
                diffSummary: '2 files modified, 45 lines added',
              },
            ],
          },
          artifacts: [
            {
              name: 'Feature Implementation Diff',
              type: 'diff',
              path: 'src/features/newFeature.js',
              content: `diff --git a/src/features/newFeature.js b/src/features/newFeature.js
new file mode 100644
index 0000000..abc1234
--- /dev/null
+++ b/src/features/newFeature.js
@@ -0,0 +1,25 @@
+export class NewFeature {
+  constructor(config) {
+    this.config = config;
+    this.validate();
+  }
+
+  validate() {
+    if (!this.config) {
+      throw new Error('Configuration is required');
+    }
+  }
+
+  async execute() {
+    try {
+      return await this.processData();
+    } catch (error) {
+      console.error('Feature execution failed:', error);
+      throw error;
+    }
+  }
+
+  async processData() {
+    // Implementation logic here
+    return { success: true, data: this.config };
+  }
+}`,
              createdAt: new Date('2024-01-01T10:30:00Z'),
            },
            {
              name: 'Test Implementation Diff',
              type: 'diff',
              path: 'src/features/newFeature.test.js',
              content: `diff --git a/src/features/newFeature.test.js b/src/features/newFeature.test.js
new file mode 100644
index 0000000..def5678
--- /dev/null
+++ b/src/features/newFeature.test.js
@@ -0,0 +1,35 @@
+import { NewFeature } from './newFeature.js';
+
+describe('NewFeature', () => {
+  it('should create instance with valid config', () => {
+    const feature = new NewFeature({ key: 'value' });
+    expect(feature).toBeInstanceOf(NewFeature);
+  });
+
+  it('should throw error with invalid config', () => {
+    expect(() => new NewFeature(null)).toThrow('Configuration is required');
+  });
+
+  it('should execute successfully', async () => {
+    const feature = new NewFeature({ key: 'value' });
+    const result = await feature.execute();
+    expect(result.success).toBe(true);
+  });
+
+  it('should handle execution errors', async () => {
+    const feature = new NewFeature({ key: 'value' });
+    // Mock processData to throw error
+    vi.spyOn(feature, 'processData').mockRejectedValue(new Error('Test error'));
+
+    await expect(feature.execute()).rejects.toThrow('Test error');
+  });
+});`,
              createdAt: new Date('2024-01-01T11:30:00Z'),
            },
            {
              name: 'Modified Files Summary',
              type: 'file',
              content: JSON.stringify({
                modified: [
                  'src/features/newFeature.js',
                  'src/features/newFeature.test.js',
                  'src/index.js',
                  'src/utils/validation.js',
                  'tests/integration/feature.test.js',
                ],
                linesAdded: 85,
                linesRemoved: 2,
              }),
              createdAt: new Date('2024-01-01T12:00:00Z'),
            },
          ],
        };

      case 'in-progress':
        return {
          ...baseTask,
          status: 'in-progress',
          currentStage: 'testing',
          iterationHistory: {
            taskId,
            entries: [
              {
                id: `${taskId}-iter-001`,
                feedback: 'Start implementation',
                iteratedAt: new Date('2024-01-01T10:30:00Z'),
                modifiedFiles: ['src/features/partial.js'],
                diffSummary: '1 file added, partial implementation',
              },
            ],
          },
          artifacts: [
            {
              name: 'Partial Implementation',
              type: 'diff',
              path: 'src/features/partial.js',
              content: `diff --git a/src/features/partial.js b/src/features/partial.js
new file mode 100644
index 0000000..abc1234
--- /dev/null
+++ b/src/features/partial.js
@@ -0,0 +1,10 @@
+// TODO: Implement feature
+export class PartialFeature {
+  constructor() {
+    // Implementation in progress
+  }
+
+  // TODO: Add methods
+}`,
              createdAt: new Date('2024-01-01T10:30:00Z'),
            },
          ],
        };

      case 'failed':
        return {
          ...baseTask,
          status: 'failed',
          iterationHistory: {
            taskId,
            entries: [
              {
                id: `${taskId}-iter-001`,
                feedback: 'Attempted implementation',
                iteratedAt: new Date('2024-01-01T10:30:00Z'),
                modifiedFiles: ['src/features/failed.js'],
                diffSummary: 'Implementation failed, 1 file modified',
              },
            ],
          },
          artifacts: [],
          logs: [
            ...baseTask.logs,
            {
              timestamp: new Date('2024-01-01T11:30:00Z'),
              level: 'error',
              message: 'Task failed due to compilation errors',
            },
          ],
        };

      default:
        return baseTask;
    }
  };

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-diff-integration-test-'));
    await fs.ensureDir(path.join(tempDir, '.apex'));

    const configContent = `
project:
  name: diff-integration-test
  version: 1.0.0
agents:
  developer:
    model: sonnet
    autonomy: high
  tester:
    model: haiku
    autonomy: medium
workflows:
  feature:
    stages:
      - name: planning
        agent: developer
      - name: implementation
        agent: developer
      - name: testing
        agent: tester
      - name: review
        agent: developer
limits:
  maxTokens: 50000
  maxCost: 5.0
git:
  branchPrefix: feature/
  autoWorktree: true
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

  describe('Real-world Task Scenarios', () => {
    it('should show comprehensive diff for completed feature task', async () => {
      const diffCommand = commands.find(cmd => cmd.name === 'diff');
      const taskId = 'feature-complete-task';
      const mockTask = createRealTaskScenario(taskId, 'feature-complete');

      const getTaskSpy = vi.spyOn(orchestrator, 'getTask').mockResolvedValue(mockTask);

      await diffCommand!.handler(createMockContext(), [taskId]);

      // Verify comprehensive output
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('📈 Iteration History:')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Iteration 001:')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Implement initial feature structure')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Files modified: src/features/newFeature.js, src/features/newFeature.test.js, src/index.js')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('📄 Diff artifacts:')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Feature Implementation Diff:')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('export class NewFeature')
      );

      getTaskSpy.mockRestore();
    });

    it('should show appropriate diff for in-progress task', async () => {
      const diffCommand = commands.find(cmd => cmd.name === 'diff');
      const taskId = 'in-progress-task';
      const mockTask = createRealTaskScenario(taskId, 'in-progress');

      const getTaskSpy = vi.spyOn(orchestrator, 'getTask').mockResolvedValue(mockTask);

      await diffCommand!.handler(createMockContext(), [taskId]);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('📈 Iteration History:')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Start implementation')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('📄 Diff artifacts:')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('TODO: Implement feature')
      );

      getTaskSpy.mockRestore();
    });

    it('should show minimal diff for failed task', async () => {
      const diffCommand = commands.find(cmd => cmd.name === 'diff');
      const taskId = 'failed-task';
      const mockTask = createRealTaskScenario(taskId, 'failed');

      const getTaskSpy = vi.spyOn(orchestrator, 'getTask').mockResolvedValue(mockTask);

      await diffCommand!.handler(createMockContext(), [taskId]);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('📈 Iteration History:')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Attempted implementation')
      );

      getTaskSpy.mockRestore();
    });
  });

  describe('Orchestrator Integration', () => {
    it('should work with getIterationDiff method when available', async () => {
      const diffCommand = commands.find(cmd => cmd.name === 'diff');
      const taskId = 'iteration-diff-task';

      const mockIterationDiff: IterationDiff = {
        iterationId: `${taskId}-iter-002`,
        previousIterationId: `${taskId}-iter-001`,
        stageChange: { from: 'implementation', to: 'testing' },
        statusChange: { from: 'in-progress', to: 'completed' },
        filesChanged: {
          added: ['tests/new.test.js'],
          modified: ['src/feature.js', 'package.json'],
          removed: ['src/deprecated.js'],
        },
        tokenUsageDelta: 250,
        costDelta: 0.0125,
        summary: 'Added tests, updated implementation, removed deprecated code',
      };

      // Mock both getTask and getIterationDiff
      const getTaskSpy = vi.spyOn(orchestrator, 'getTask').mockResolvedValue(
        createRealTaskScenario(taskId, 'feature-complete')
      );
      const getIterationDiffSpy = vi.spyOn(orchestrator, 'getIterationDiff').mockResolvedValue(mockIterationDiff);

      await diffCommand!.handler(createMockContext(), [taskId]);

      expect(getTaskSpy).toHaveBeenCalledWith(taskId);
      // The diff command should show artifacts and iteration history from getTask
      // getIterationDiff is used by the iterate command's --diff flag

      getTaskSpy.mockRestore();
      getIterationDiffSpy.mockRestore();
    });

    it('should handle orchestrator initialization properly', async () => {
      const diffCommand = commands.find(cmd => cmd.name === 'diff');

      // Test with uninitialized orchestrator
      await diffCommand!.handler({
        orchestrator: null,
        cwd: tempDir,
        initialized: false,
        config: null,
        apiProcess: null,
        webUIProcess: null,
        apiPort: 3000,
        webUIPort: 3001,
      }, ['test-task']);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('APEX not initialized')
      );
    });
  });

  describe('Command Usage Patterns', () => {
    it('should demonstrate proper usage examples in help text', async () => {
      const diffCommand = commands.find(cmd => cmd.name === 'diff');

      await diffCommand!.handler(createMockContext(), []);

      // Verify all usage examples are shown
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('/diff abc123')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('/diff abc123 --stat')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('/diff abc123 --file src/app.js')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('/diff abc123 --staged')
      );
    });

    it('should validate acceptance criteria through real usage', async () => {
      const diffCommand = commands.find(cmd => cmd.name === 'diff');
      const taskId = 'acceptance-test-task';
      const mockTask = createRealTaskScenario(taskId, 'feature-complete');

      const getTaskSpy = vi.spyOn(orchestrator, 'getTask').mockResolvedValue(mockTask);

      // Test all acceptance criteria:

      // 1. apex diff <taskId> shows all code changes made by task
      consoleSpy.mockClear();
      await diffCommand!.handler(createMockContext(), [taskId]);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('📈 Iteration History:')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('📄 Diff artifacts:')
      );

      // 2. apex diff <taskId> --stat shows summary (files, lines)
      consoleSpy.mockClear();
      await diffCommand!.handler(createMockContext(), [taskId, '--stat']);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('📊 Change Statistics:')
      );

      // 3. apex diff <taskId> --file <path> shows diff for specific file
      consoleSpy.mockClear();
      await diffCommand!.handler(createMockContext(), [taskId, '--file', 'src/features/newFeature.js']);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Feature Implementation Diff:')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('File: src/features/newFeature.js')
      );

      // 4. apex diff <taskId> --staged shows what will be committed
      consoleSpy.mockClear();
      await diffCommand!.handler(createMockContext(), [taskId, '--staged']);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('🚀 Staged/Working Directory Changes:')
      );

      getTaskSpy.mockRestore();
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should handle partial orchestrator functionality gracefully', async () => {
      const diffCommand = commands.find(cmd => cmd.name === 'diff');

      // Create orchestrator but don't initialize it
      const uninitializedOrchestrator = new ApexOrchestrator({ projectPath: tempDir });

      const context = {
        orchestrator: uninitializedOrchestrator,
        cwd: tempDir,
        initialized: true,
        config: null,
        apiProcess: null,
        webUIProcess: null,
        apiPort: 3000,
        webUIPort: 3001,
      };

      // This should trigger orchestrator internal error handling
      await diffCommand!.handler(context, ['test-task']);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌ Failed to show diff:')
      );
    });

    it('should handle network/IO related errors', async () => {
      const diffCommand = commands.find(cmd => cmd.name === 'diff');

      const getTaskSpy = vi.spyOn(orchestrator, 'getTask')
        .mockRejectedValue(new Error('ENOTFOUND: database connection failed'));

      await diffCommand!.handler(createMockContext(), ['network-error-task']);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌ Failed to show diff: ENOTFOUND: database connection failed')
      );

      getTaskSpy.mockRestore();
    });
  });

  describe('Command Lifecycle Integration', () => {
    it('should work correctly as part of larger workflow', async () => {
      const diffCommand = commands.find(cmd => cmd.name === 'diff');
      const taskId = 'workflow-task';

      // Simulate a task that went through multiple workflow stages
      const workflowTask = createRealTaskScenario(taskId, 'feature-complete');
      workflowTask.logs = [
        {
          timestamp: new Date('2024-01-01T09:00:00Z'),
          level: 'info',
          message: 'Task created',
        },
        {
          timestamp: new Date('2024-01-01T09:15:00Z'),
          level: 'info',
          message: 'Planning stage started',
          stage: 'planning',
          agent: 'developer',
        },
        {
          timestamp: new Date('2024-01-01T09:45:00Z'),
          level: 'info',
          message: 'Implementation stage started',
          stage: 'implementation',
          agent: 'developer',
        },
        {
          timestamp: new Date('2024-01-01T11:00:00Z'),
          level: 'info',
          message: 'Testing stage started',
          stage: 'testing',
          agent: 'tester',
        },
        {
          timestamp: new Date('2024-01-01T11:45:00Z'),
          level: 'info',
          message: 'Review stage started',
          stage: 'review',
          agent: 'developer',
        },
        {
          timestamp: new Date('2024-01-01T12:00:00Z'),
          level: 'info',
          message: 'Task completed successfully',
        },
      ];

      const getTaskSpy = vi.spyOn(orchestrator, 'getTask').mockResolvedValue(workflowTask);

      await diffCommand!.handler(createMockContext(), [taskId]);

      // Should show comprehensive information about the full workflow
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('📈 Iteration History:')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('📄 Diff artifacts:')
      );

      getTaskSpy.mockRestore();
    });
  });
});