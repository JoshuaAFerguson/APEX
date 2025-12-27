import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { InteractionManager } from './interaction-manager';
import { TaskStore } from './store';
import {
  Task,
  TaskStatus,
  TaskPriority,
  TaskEffort,
  TaskUsage,
  IterationEntry,
  IterationHistory,
  IterationSnapshot,
  IterationDiff,
  TaskInteraction,
} from '@apexcli/core';

// Mock TaskStore
vi.mock('./store');

describe('InteractionManager', () => {
  let interactionManager: InteractionManager;
  let mockStore: TaskStore;

  const mockTask: Task = {
    id: 'test-task-1',
    title: 'Test Task',
    description: 'Test task description',
    status: 'in-progress' as TaskStatus,
    priority: 'normal' as TaskPriority,
    effort: 'medium' as TaskEffort,
    currentStage: 'implementation',
    workflowName: 'test-workflow',
    createdAt: new Date('2024-01-01T10:00:00Z'),
    updatedAt: new Date('2024-01-01T11:00:00Z'),
    usage: {
      totalTokens: 1000,
      estimatedCost: 0.05,
    } as TaskUsage,
    logs: [],
    artifacts: [],
    dependsOn: [],
    blockedBy: [],
    iterationHistory: {
      entries: [],
      totalIterations: 0,
    },
  };

  const mockSnapshot: IterationSnapshot = {
    timestamp: new Date('2024-01-01T12:00:00Z'),
    stage: 'implementation',
    status: 'in-progress',
    files: {
      created: ['src/test.ts'],
      modified: ['package.json'],
    },
    usage: {
      totalTokens: 1000,
      estimatedCost: 0.05,
    } as TaskUsage,
    artifactCount: 2,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockStore = new TaskStore(':memory:') as TaskStore;
    interactionManager = new InteractionManager(mockStore);

    // Mock store methods
    (mockStore.getTask as Mock).mockResolvedValue(mockTask);
    (mockStore.addIterationEntry as Mock).mockResolvedValue(undefined);
    (mockStore.updateIterationEntry as Mock).mockResolvedValue(undefined);
    (mockStore.getIterationHistory as Mock).mockResolvedValue({
      entries: [],
      totalIterations: 0,
      lastIterationAt: undefined,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('iterateTask', () => {
    it('should create iteration entry with before state snapshot', async () => {
      // Mock captureSnapshot to return consistent data
      const captureSnapshotSpy = vi.spyOn(interactionManager as any, 'captureSnapshot')
        .mockResolvedValue(mockSnapshot);

      const iterationId = await interactionManager.iterateTask(
        'test-task-1',
        'Please improve the error handling',
        { priority: 'high' }
      );

      expect(mockStore.getTask).toHaveBeenCalledWith('test-task-1');
      expect(captureSnapshotSpy).toHaveBeenCalledWith('test-task-1');
      expect(mockStore.addIterationEntry).toHaveBeenCalledWith('test-task-1', expect.objectContaining({
        id: iterationId,
        feedback: 'Please improve the error handling',
        stage: 'implementation',
        beforeState: mockSnapshot,
      }));
      expect(iterationId).toMatch(/^test-task-1-iter-\d+$/);
    });

    it('should emit task:iterate event with correct parameters', async () => {
      const eventSpy = vi.fn();
      interactionManager.on('task:iterate', eventSpy);

      vi.spyOn(interactionManager as any, 'captureSnapshot').mockResolvedValue(mockSnapshot);

      const iterationId = await interactionManager.iterateTask(
        'test-task-1',
        'Add unit tests',
        { coverage: 90 }
      );

      expect(eventSpy).toHaveBeenCalledWith('test-task-1', expect.objectContaining({
        iterationId,
        instructions: 'Add unit tests',
        context: { coverage: 90 },
        timestamp: expect.any(String),
      }));
    });

    it('should throw error when task is not found', async () => {
      (mockStore.getTask as Mock).mockResolvedValue(null);

      await expect(
        interactionManager.iterateTask('nonexistent-task', 'test feedback')
      ).rejects.toThrow('Task nonexistent-task not found');
    });

    it('should throw error when task is not in progress', async () => {
      const completedTask = { ...mockTask, status: 'completed' as TaskStatus };
      (mockStore.getTask as Mock).mockResolvedValue(completedTask);

      await expect(
        interactionManager.iterateTask('test-task-1', 'test feedback')
      ).rejects.toThrow('Task test-task-1 is not in progress (status: completed)');
    });
  });

  describe('completeIteration', () => {
    const iterationEntry: IterationEntry = {
      id: 'test-task-1-iter-123',
      feedback: 'Test feedback',
      timestamp: new Date('2024-01-01T12:00:00Z'),
      stage: 'implementation',
      beforeState: mockSnapshot,
    };

    const afterSnapshot: IterationSnapshot = {
      timestamp: new Date('2024-01-01T12:30:00Z'),
      stage: 'implementation',
      status: 'in-progress',
      files: {
        created: ['src/test.ts', 'src/test2.ts'],
        modified: ['package.json', 'src/index.ts'],
      },
      usage: {
        totalTokens: 1500,
        estimatedCost: 0.08,
      } as TaskUsage,
      artifactCount: 4,
    };

    beforeEach(() => {
      (mockStore.getIterationHistory as Mock).mockResolvedValue({
        entries: [iterationEntry],
        totalIterations: 1,
        lastIterationAt: iterationEntry.timestamp,
      });
    });

    it('should complete iteration with after state and diff summary', async () => {
      vi.spyOn(interactionManager as any, 'captureSnapshot').mockResolvedValue(afterSnapshot);

      await interactionManager.completeIteration('test-task-1', 'test-task-1-iter-123', 'developer');

      expect(mockStore.updateIterationEntry).toHaveBeenCalledWith(
        'test-task-1-iter-123',
        afterSnapshot,
        expect.stringContaining('1 files added'),
        ['src/test2.ts', 'src/index.ts']
      );
    });

    it('should compute comprehensive diff summary', async () => {
      vi.spyOn(interactionManager as any, 'captureSnapshot').mockResolvedValue(afterSnapshot);

      await interactionManager.completeIteration('test-task-1', 'test-task-1-iter-123');

      const expectedSummary = expect.stringContaining('1 files added');
      expect(mockStore.updateIterationEntry).toHaveBeenCalledWith(
        'test-task-1-iter-123',
        afterSnapshot,
        expectedSummary,
        expect.any(Array)
      );
    });

    it('should handle missing iteration entry', async () => {
      (mockStore.getIterationHistory as Mock).mockResolvedValue({
        entries: [],
        totalIterations: 0,
      });

      await expect(
        interactionManager.completeIteration('test-task-1', 'nonexistent-iter')
      ).rejects.toThrow('Iteration nonexistent-iter not found for task test-task-1');
    });

    it('should handle stage and status changes in diff', async () => {
      const stageChangedSnapshot = {
        ...afterSnapshot,
        stage: 'testing',
        status: 'in-progress' as TaskStatus,
      };
      vi.spyOn(interactionManager as any, 'captureSnapshot').mockResolvedValue(stageChangedSnapshot);

      await interactionManager.completeIteration('test-task-1', 'test-task-1-iter-123');

      expect(mockStore.updateIterationEntry).toHaveBeenCalledWith(
        'test-task-1-iter-123',
        stageChangedSnapshot,
        expect.stringContaining("stage changed from 'implementation' to 'testing'"),
        expect.any(Array)
      );
    });
  });

  describe('getIterationDiff', () => {
    const firstIteration: IterationEntry = {
      id: 'iter-1',
      feedback: 'First iteration',
      timestamp: new Date('2024-01-01T12:00:00Z'),
      stage: 'implementation',
      beforeState: mockSnapshot,
      afterState: {
        ...mockSnapshot,
        timestamp: new Date('2024-01-01T12:15:00Z'),
        files: {
          created: ['src/test.ts', 'src/new.ts'],
          modified: ['package.json'],
        },
        usage: {
          totalTokens: 1200,
          estimatedCost: 0.06,
        } as TaskUsage,
        artifactCount: 3,
      },
      diffSummary: '1 files added, 200 tokens used',
      modifiedFiles: ['src/new.ts'],
    };

    const secondIteration: IterationEntry = {
      id: 'iter-2',
      feedback: 'Second iteration',
      timestamp: new Date('2024-01-01T12:30:00Z'),
      stage: 'testing',
      beforeState: firstIteration.afterState,
      afterState: {
        ...firstIteration.afterState!,
        timestamp: new Date('2024-01-01T12:45:00Z'),
        stage: 'testing',
        files: {
          created: ['src/test.ts', 'src/new.ts', 'src/test.test.ts'],
          modified: ['package.json', 'src/new.ts'],
        },
        usage: {
          totalTokens: 1800,
          estimatedCost: 0.09,
        } as TaskUsage,
        artifactCount: 4,
      },
      diffSummary: 'stage changed, 1 files added, 1 files modified, 600 tokens used',
      modifiedFiles: ['src/test.test.ts', 'src/new.ts'],
    };

    beforeEach(() => {
      (mockStore.getIterationHistory as Mock).mockResolvedValue({
        entries: [firstIteration, secondIteration],
        totalIterations: 2,
        lastIterationAt: secondIteration.timestamp,
      });
    });

    it('should compare last two iterations when no iterationId specified', async () => {
      const diff = await interactionManager.getIterationDiff('test-task-1');

      expect(diff).toEqual<IterationDiff>({
        iterationId: 'iter-2',
        previousIterationId: 'iter-1',
        stageChange: { from: 'implementation', to: 'testing' },
        statusChange: undefined,
        filesChanged: {
          added: ['src/test.test.ts'],
          modified: ['src/new.ts'],
          removed: [],
        },
        tokenUsageDelta: 600,
        costDelta: 0.03,
        summary: expect.stringContaining('Stage: implementation → testing'),
      });
    });

    it('should compare specific iteration when iterationId provided', async () => {
      const diff = await interactionManager.getIterationDiff('test-task-1', 'iter-1');

      expect(diff).toEqual<IterationDiff>({
        iterationId: 'iter-1',
        previousIterationId: undefined,
        stageChange: undefined,
        statusChange: undefined,
        filesChanged: {
          added: ['src/new.ts'],
          modified: [],
          removed: [],
        },
        tokenUsageDelta: 200,
        costDelta: 0.01,
        summary: expect.stringContaining('1 files added'),
      });
    });

    it('should throw error when no iterations found', async () => {
      (mockStore.getIterationHistory as Mock).mockResolvedValue({
        entries: [],
        totalIterations: 0,
      });

      await expect(
        interactionManager.getIterationDiff('test-task-1')
      ).rejects.toThrow('No iterations found for task test-task-1');
    });

    it('should throw error when insufficient iterations to compare', async () => {
      (mockStore.getIterationHistory as Mock).mockResolvedValue({
        entries: [firstIteration],
        totalIterations: 1,
      });

      await expect(
        interactionManager.getIterationDiff('test-task-1')
      ).rejects.toThrow('Insufficient iterations to compare for task test-task-1');
    });

    it('should throw error when specific iteration not found', async () => {
      await expect(
        interactionManager.getIterationDiff('test-task-1', 'nonexistent-iter')
      ).rejects.toThrow('Iteration nonexistent-iter not found for task test-task-1');
    });

    it('should handle iterations without complete state data', async () => {
      const incompleteIteration: IterationEntry = {
        id: 'iter-incomplete',
        feedback: 'Incomplete iteration',
        timestamp: new Date(),
        modifiedFiles: ['file1.ts', 'file2.ts'],
        diffSummary: 'Manual diff summary',
      };

      (mockStore.getIterationHistory as Mock).mockResolvedValue({
        entries: [incompleteIteration, { ...incompleteIteration, id: 'iter-incomplete-2' }],
        totalIterations: 2,
      });

      const diff = await interactionManager.getIterationDiff('test-task-1');

      expect(diff).toEqual<IterationDiff>({
        iterationId: 'iter-incomplete-2',
        previousIterationId: 'iter-incomplete',
        filesChanged: {
          added: [],
          modified: ['file1.ts', 'file2.ts'],
          removed: [],
        },
        tokenUsageDelta: 0,
        costDelta: 0,
        summary: 'Manual diff summary',
      });
    });
  });

  describe('submitInteraction', () => {
    it('should process iterate interaction command', async () => {
      vi.spyOn(interactionManager, 'iterateTask').mockResolvedValue('iter-123');

      const result = await interactionManager.submitInteraction(
        'test-task-1',
        'iterate',
        { instructions: 'Improve performance', context: { metric: 'latency' } },
        'user'
      );

      expect(interactionManager.iterateTask).toHaveBeenCalledWith(
        'test-task-1',
        'Improve performance',
        { metric: 'latency' }
      );
      expect(result).toBe('iter-123');
    });

    it('should process iteration-diff interaction command', async () => {
      const mockDiff: IterationDiff = {
        iterationId: 'iter-1',
        previousIterationId: undefined,
        filesChanged: { added: ['test.ts'], modified: [], removed: [] },
        tokenUsageDelta: 100,
        costDelta: 0.005,
        summary: 'Added test file',
      };

      vi.spyOn(interactionManager, 'getIterationDiff').mockResolvedValue(mockDiff);

      const result = await interactionManager.submitInteraction(
        'test-task-1',
        'iteration-diff',
        { iterationId: 'iter-1' }
      );

      expect(interactionManager.getIterationDiff).toHaveBeenCalledWith('test-task-1', 'iter-1');
      expect(result).toBe(JSON.stringify(mockDiff, null, 2));
    });

    it('should emit interaction events', async () => {
      const receivedSpy = vi.fn();
      const processedSpy = vi.fn();
      interactionManager.on('interaction:received', receivedSpy);
      interactionManager.on('interaction:processed', processedSpy);

      vi.spyOn(interactionManager, 'iterateTask').mockResolvedValue('iter-123');

      await interactionManager.submitInteraction('test-task-1', 'iterate', { instructions: 'test' });

      expect(receivedSpy).toHaveBeenCalledWith(expect.objectContaining({
        taskId: 'test-task-1',
        command: 'iterate',
        parameters: { instructions: 'test' },
        requestedBy: 'user',
      }));

      expect(processedSpy).toHaveBeenCalledWith(expect.objectContaining({
        taskId: 'test-task-1',
        command: 'iterate',
        result: 'iter-123',
        processedAt: expect.any(Date),
      }));
    });

    it('should handle interaction processing errors', async () => {
      const processedSpy = vi.fn();
      interactionManager.on('interaction:processed', processedSpy);

      vi.spyOn(interactionManager, 'iterateTask').mockRejectedValue(new Error('Processing failed'));

      await expect(
        interactionManager.submitInteraction('test-task-1', 'iterate', { instructions: 'test' })
      ).rejects.toThrow('Processing failed');

      expect(processedSpy).toHaveBeenCalledWith(expect.objectContaining({
        result: 'Error: Error: Processing failed',
        processedAt: expect.any(Date),
      }));
    });
  });

  describe('private methods', () => {
    describe('captureSnapshot', () => {
      it('should capture complete task state snapshot', async () => {
        const taskWithArtifacts = {
          ...mockTask,
          artifacts: [
            { type: 'file', path: 'src/test.ts', name: 'Test file', content: 'test content' },
            { type: 'diff', name: 'Changes', content: '+++ src/new.ts' },
          ],
        };

        (mockStore.getTask as Mock).mockResolvedValue(taskWithArtifacts);

        const captureSnapshot = (interactionManager as any).captureSnapshot.bind(interactionManager);
        const snapshot = await captureSnapshot('test-task-1');

        expect(snapshot).toEqual<IterationSnapshot>({
          timestamp: expect.any(Date),
          stage: 'implementation',
          status: 'in-progress',
          files: {
            created: [],
            modified: [],
          },
          usage: taskWithArtifacts.usage,
          artifactCount: 2,
        });
      });

      it('should throw error when task not found during snapshot', async () => {
        (mockStore.getTask as Mock).mockResolvedValue(null);

        const captureSnapshot = (interactionManager as any).captureSnapshot.bind(interactionManager);

        await expect(captureSnapshot('nonexistent')).rejects.toThrow('Task nonexistent not found');
      });
    });
  });

  describe('edge cases', () => {
    it('should handle concurrent iteration requests', async () => {
      vi.spyOn(interactionManager as any, 'captureSnapshot').mockResolvedValue(mockSnapshot);

      const promises = [
        interactionManager.iterateTask('test-task-1', 'First iteration'),
        interactionManager.iterateTask('test-task-1', 'Second iteration'),
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(2);
      expect(results[0]).toMatch(/^test-task-1-iter-\d+$/);
      expect(results[1]).toMatch(/^test-task-1-iter-\d+$/);
      expect(results[0]).not.toBe(results[1]);
      expect(mockStore.addIterationEntry).toHaveBeenCalledTimes(2);
    });

    it('should handle iteration diff with no changes', async () => {
      const identicalIteration: IterationEntry = {
        id: 'iter-1',
        feedback: 'No changes',
        timestamp: new Date(),
        beforeState: mockSnapshot,
        afterState: mockSnapshot, // Identical state
        diffSummary: 'No changes detected',
      };

      (mockStore.getIterationHistory as Mock).mockResolvedValue({
        entries: [identicalIteration, identicalIteration],
        totalIterations: 2,
      });

      const diff = await interactionManager.getIterationDiff('test-task-1');

      expect(diff.summary).toContain('No significant changes detected');
      expect(diff.filesChanged.added).toHaveLength(0);
      expect(diff.filesChanged.modified).toHaveLength(0);
      expect(diff.filesChanged.removed).toHaveLength(0);
      expect(diff.tokenUsageDelta).toBe(0);
    });

    it('should handle malformed iteration data gracefully', async () => {
      const malformedIteration: IterationEntry = {
        id: 'iter-malformed',
        feedback: 'Test',
        timestamp: new Date(),
        // Missing required state data
      };

      (mockStore.getIterationHistory as Mock).mockResolvedValue({
        entries: [malformedIteration, malformedIteration],
        totalIterations: 2,
      });

      const diff = await interactionManager.getIterationDiff('test-task-1');

      expect(diff.summary).toBe('No detailed diff available');
      expect(diff.tokenUsageDelta).toBe(0);
      expect(diff.costDelta).toBe(0);
    });
  });
});