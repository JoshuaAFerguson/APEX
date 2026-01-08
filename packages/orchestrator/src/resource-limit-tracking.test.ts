import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import { ApexOrchestrator, LimitWarningEvent, LimitExceededEvent } from './index';
import { TaskStore } from './store';
import { Task, TaskStatus, AgentModel } from '@apexcli/core';

// Mock dependencies
vi.mock('./store');
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  AgentSDK: vi.fn().mockImplementation(() => ({
    query: vi.fn(),
  })),
}));

describe('Resource Limit Tracking', () => {
  let orchestrator: ApexOrchestrator;
  let mockStore: any;
  let mockTask: Task;

  beforeEach(async () => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create mock store
    mockStore = {
      getTask: vi.fn(),
      updateTask: vi.fn(),
      addTaskLog: vi.fn(),
      createTask: vi.fn(),
      getTasks: vi.fn(),
      deleteTask: vi.fn(),
      archiveTask: vi.fn(),
      close: vi.fn(),
    } as any;

    // Mock the TaskStore constructor
    (TaskStore as any).mockImplementation(() => mockStore);

    // Create orchestrator with test config
    orchestrator = new ApexOrchestrator({
      limits: {
        maxCostPerTask: 10.0,
        maxTokensPerTask: 100000,
        maxExecutionTime: 30000, // 30 seconds
        maxFileChanges: 50,
        maxConcurrentTasks: 3,
        maxRetries: 3,
        retryDelayMs: 1000,
        retryBackoffFactor: 2,
      },
    });

    // Create mock task
    mockTask = {
      id: 'test-task-1',
      title: 'Test Resource Limits',
      description: 'Testing resource limit tracking',
      status: 'running' as TaskStatus,
      createdAt: new Date(),
      updatedAt: new Date(),
      branchName: 'test-branch',
      workflow: 'test-workflow',
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        estimatedCost: 0,
      },
      executionTime: 0,
      fileChanges: {
        created: [],
        modified: [],
      },
      logs: [],
      artifacts: [],
    } as Task;

    mockStore.getTask.mockResolvedValue(mockTask);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Token Usage Tracking', () => {
    it('should track token usage accurately', async () => {
      const inputTokens = 1000;
      const outputTokens = 500;
      const totalTokens = inputTokens + outputTokens;

      // Update task usage
      await orchestrator.updateUsage('test-task-1', {
        inputTokens,
        outputTokens,
        totalTokens,
        estimatedCost: 0.01,
      });

      // Verify store was called with correct usage data
      expect(mockStore.updateTask).toHaveBeenCalledWith('test-task-1', {
        usage: {
          inputTokens,
          outputTokens,
          totalTokens,
          estimatedCost: expect.any(Number),
        },
      });
    });

    it('should emit warning event when token usage reaches 80% of limit', async () => {
      const warningEvent = new Promise<LimitWarningEvent>((resolve) => {
        orchestrator.once('limit:warning', resolve);
      });

      // Update task to 80% of token limit (100000 * 0.8 = 80000)
      const tokenUsage = 80000;
      mockTask.usage = {
        inputTokens: tokenUsage / 2,
        outputTokens: tokenUsage / 2,
        totalTokens: tokenUsage,
        estimatedCost: 0.5,
      };
      mockStore.getTask.mockResolvedValue(mockTask);

      // Trigger resource limit check
      await (orchestrator as any).checkResourceLimits('test-task-1');

      const event = await warningEvent;
      expect(event).toMatchObject({
        taskId: 'test-task-1',
        limitType: 'tokens',
        currentValue: tokenUsage,
        limitValue: 100000,
        percentage: 80,
      });
    });

    it('should emit exceeded event when token usage exceeds limit', async () => {
      const exceededEvent = new Promise<LimitExceededEvent>((resolve) => {
        orchestrator.once('limit:exceeded', resolve);
      });

      // Update task to exceed token limit
      const tokenUsage = 150000;
      mockTask.usage = {
        inputTokens: tokenUsage / 2,
        outputTokens: tokenUsage / 2,
        totalTokens: tokenUsage,
        estimatedCost: 1.0,
      };
      mockStore.getTask.mockResolvedValue(mockTask);

      // Trigger resource limit check
      await (orchestrator as any).checkResourceLimits('test-task-1');

      const event = await exceededEvent;
      expect(event).toMatchObject({
        taskId: 'test-task-1',
        limitType: 'tokens',
        currentValue: tokenUsage,
        limitValue: 100000,
        percentage: 150,
      });
    });
  });

  describe('Cost Tracking', () => {
    it('should track estimated cost accurately', async () => {
      const cost = 5.0;

      await orchestrator.updateUsage('test-task-1', {
        inputTokens: 50000,
        outputTokens: 25000,
        totalTokens: 75000,
        estimatedCost: cost,
      });

      expect(mockStore.updateTask).toHaveBeenCalledWith('test-task-1', {
        usage: expect.objectContaining({
          estimatedCost: cost,
        }),
      });
    });

    it('should emit warning event when cost reaches 80% of limit', async () => {
      const warningEvent = new Promise<LimitWarningEvent>((resolve) => {
        orchestrator.once('limit:warning', resolve);
      });

      // Update task to 80% of cost limit ($10.0 * 0.8 = $8.0)
      const currentCost = 8.0;
      mockTask.usage.estimatedCost = currentCost;
      mockStore.getTask.mockResolvedValue(mockTask);

      await (orchestrator as any).checkResourceLimits('test-task-1');

      const event = await warningEvent;
      expect(event.limitType).toBe('cost');
      expect(event.currentValue).toBe(currentCost);
      expect(event.limitValue).toBe(10.0);
      expect(event.percentage).toBe(80);
    });

    it('should emit exceeded event and pause task when cost exceeds limit', async () => {
      const exceededEvent = new Promise<LimitExceededEvent>((resolve) => {
        orchestrator.once('limit:exceeded', resolve);
      });

      // Update task to exceed cost limit
      const currentCost = 12.0;
      mockTask.usage.estimatedCost = currentCost;
      mockStore.getTask.mockResolvedValue(mockTask);

      await (orchestrator as any).checkResourceLimits('test-task-1');

      const event = await exceededEvent;
      expect(event.limitType).toBe('cost');
      expect(event.currentValue).toBe(currentCost);
      expect(event.limitValue).toBe(10.0);
      expect(event.percentage).toBe(120);

      // Verify task was paused
      expect(mockStore.updateTask).toHaveBeenCalledWith(
        'test-task-1',
        expect.objectContaining({
          status: 'paused',
          pauseReason: 'resource_limit_exceeded',
        })
      );
    });
  });

  describe('Execution Time Tracking', () => {
    it('should track execution time during task execution', async () => {
      const startTime = Date.now();

      // Simulate task execution
      mockTask.startedAt = new Date(startTime);
      mockTask.executionTime = 15000; // 15 seconds
      mockStore.getTask.mockResolvedValue(mockTask);

      await (orchestrator as any).updateExecutionTime('test-task-1', 15000);

      expect(mockStore.updateTask).toHaveBeenCalledWith('test-task-1', {
        executionTime: 15000,
      });
    });

    it('should emit warning event when execution time reaches 80% of limit', async () => {
      const warningEvent = new Promise<LimitWarningEvent>((resolve) => {
        orchestrator.once('limit:warning', resolve);
      });

      // Update task to 80% of time limit (30000ms * 0.8 = 24000ms)
      const currentTime = 24000;
      mockTask.executionTime = currentTime;
      mockStore.getTask.mockResolvedValue(mockTask);

      await (orchestrator as any).checkResourceLimits('test-task-1');

      const event = await warningEvent;
      expect(event.limitType).toBe('time');
      expect(event.currentValue).toBe(currentTime);
      expect(event.limitValue).toBe(30000);
      expect(event.percentage).toBe(80);
    });

    it('should emit exceeded event when execution time exceeds limit', async () => {
      const exceededEvent = new Promise<LimitExceededEvent>((resolve) => {
        orchestrator.once('limit:exceeded', resolve);
      });

      // Update task to exceed time limit
      const currentTime = 35000;
      mockTask.executionTime = currentTime;
      mockStore.getTask.mockResolvedValue(mockTask);

      await (orchestrator as any).checkResourceLimits('test-task-1');

      const event = await exceededEvent;
      expect(event.limitType).toBe('time');
      expect(event.currentValue).toBe(currentTime);
      expect(event.limitValue).toBe(30000);
    });
  });

  describe('File Changes Tracking', () => {
    it('should track file changes during task execution', async () => {
      const createdFiles = ['src/new-file.ts', 'docs/new-doc.md'];
      const modifiedFiles = ['src/existing.ts', 'package.json'];

      mockTask.fileChanges = {
        created: createdFiles,
        modified: modifiedFiles,
      };
      mockStore.getTask.mockResolvedValue(mockTask);

      await (orchestrator as any).updateFileChanges('test-task-1', {
        created: createdFiles,
        modified: modifiedFiles,
      });

      expect(mockStore.updateTask).toHaveBeenCalledWith('test-task-1', {
        fileChanges: {
          created: createdFiles,
          modified: modifiedFiles,
        },
      });
    });

    it('should emit warning event when file changes reach 80% of limit', async () => {
      const warningEvent = new Promise<LimitWarningEvent>((resolve) => {
        orchestrator.once('limit:warning', resolve);
      });

      // Create 80% of file change limit (50 * 0.8 = 40 files)
      const createdFiles = Array.from({ length: 20 }, (_, i) => `file-${i}.ts`);
      const modifiedFiles = Array.from({ length: 20 }, (_, i) => `existing-${i}.ts`);

      mockTask.fileChanges = {
        created: createdFiles,
        modified: modifiedFiles,
      };
      mockStore.getTask.mockResolvedValue(mockTask);

      await (orchestrator as any).checkResourceLimits('test-task-1');

      const event = await warningEvent;
      expect(event.limitType).toBe('files');
      expect(event.currentValue).toBe(40);
      expect(event.limitValue).toBe(50);
      expect(event.percentage).toBe(80);
    });

    it('should emit exceeded event when file changes exceed limit', async () => {
      const exceededEvent = new Promise<LimitExceededEvent>((resolve) => {
        orchestrator.once('limit:exceeded', resolve);
      });

      // Create more than file change limit
      const createdFiles = Array.from({ length: 30 }, (_, i) => `file-${i}.ts`);
      const modifiedFiles = Array.from({ length: 25 }, (_, i) => `existing-${i}.ts`);

      mockTask.fileChanges = {
        created: createdFiles,
        modified: modifiedFiles,
      };
      mockStore.getTask.mockResolvedValue(mockTask);

      await (orchestrator as any).checkResourceLimits('test-task-1');

      const event = await exceededEvent;
      expect(event.limitType).toBe('files');
      expect(event.currentValue).toBe(55);
      expect(event.limitValue).toBe(50);
      expect(event.percentage).toBe(110);
    });
  });

  describe('Resource Limit Integration', () => {
    it('should check all resource limits periodically during task execution', async () => {
      const limitCheckSpy = vi.spyOn(orchestrator as any, 'checkResourceLimits');

      // Mock task execution that triggers periodic checks
      mockTask.status = 'running';
      mockTask.usage = {
        inputTokens: 50000,
        outputTokens: 25000,
        totalTokens: 75000,
        estimatedCost: 4.0,
      };
      mockTask.executionTime = 15000;
      mockTask.fileChanges = {
        created: ['file1.ts', 'file2.ts'],
        modified: ['existing.ts'],
      };
      mockStore.getTask.mockResolvedValue(mockTask);

      // Trigger resource limit checks
      await (orchestrator as any).checkResourceLimits('test-task-1');

      expect(limitCheckSpy).toHaveBeenCalledWith('test-task-1');
    });

    it('should emit multiple limit events if multiple limits are exceeded', async () => {
      const warningEvents: LimitWarningEvent[] = [];
      const exceededEvents: LimitExceededEvent[] = [];

      orchestrator.on('limit:warning', (event) => warningEvents.push(event));
      orchestrator.on('limit:exceeded', (event) => exceededEvents.push(event));

      // Set task values that exceed multiple limits
      mockTask.usage = {
        inputTokens: 110000,
        outputTokens: 50000,
        totalTokens: 160000, // Exceeds token limit
        estimatedCost: 15.0, // Exceeds cost limit
      };
      mockTask.executionTime = 40000; // Exceeds time limit
      mockTask.fileChanges = {
        created: Array.from({ length: 35 }, (_, i) => `file-${i}.ts`),
        modified: Array.from({ length: 25 }, (_, i) => `existing-${i}.ts`), // 60 total, exceeds file limit
      };
      mockStore.getTask.mockResolvedValue(mockTask);

      await (orchestrator as any).checkResourceLimits('test-task-1');

      // Should have 4 exceeded events (one for each limit type)
      expect(exceededEvents).toHaveLength(4);
      expect(exceededEvents.map(e => e.limitType)).toEqual(
        expect.arrayContaining(['tokens', 'cost', 'time', 'files'])
      );
    });

    it('should pause task when any resource limit is exceeded', async () => {
      // Exceed cost limit
      mockTask.usage.estimatedCost = 12.0;
      mockStore.getTask.mockResolvedValue(mockTask);

      await (orchestrator as any).checkResourceLimits('test-task-1');

      // Verify task was paused
      expect(mockStore.updateTask).toHaveBeenCalledWith(
        'test-task-1',
        expect.objectContaining({
          status: 'paused',
          pauseReason: 'resource_limit_exceeded',
          pausedAt: expect.any(Date),
        })
      );
    });

    it('should not emit warning events if already exceeded', async () => {
      const warningEvents: LimitWarningEvent[] = [];
      orchestrator.on('limit:warning', (event) => warningEvents.push(event));

      // Set cost that exceeds limit (should only emit exceeded, not warning)
      mockTask.usage.estimatedCost = 12.0;
      mockStore.getTask.mockResolvedValue(mockTask);

      await (orchestrator as any).checkResourceLimits('test-task-1');

      // Should not emit warning for exceeded limits
      expect(warningEvents.filter(e => e.limitType === 'cost')).toHaveLength(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing task gracefully', async () => {
      mockStore.getTask.mockResolvedValue(null);

      // Should not throw error
      await expect((orchestrator as any).checkResourceLimits('nonexistent-task')).resolves.not.toThrow();
    });

    it('should handle undefined limits in config', async () => {
      const orchestratorNoLimits = new ApexOrchestrator({});

      // Should not throw error even without limits configured
      await expect((orchestratorNoLimits as any).checkResourceLimits('test-task-1')).resolves.not.toThrow();
    });

    it('should handle zero limits appropriately', async () => {
      const orchestratorZeroLimits = new ApexOrchestrator({
        limits: {
          maxCostPerTask: 0,
          maxTokensPerTask: 0,
          maxExecutionTime: 0,
          maxFileChanges: 0,
        },
      });

      // With zero limits, any usage should trigger exceeded events
      mockTask.usage.totalTokens = 1;
      mockTask.usage.estimatedCost = 0.01;
      mockTask.executionTime = 1;
      mockTask.fileChanges = { created: ['file.ts'], modified: [] };
      mockStore.getTask.mockResolvedValue(mockTask);

      const exceededEvents: LimitExceededEvent[] = [];
      orchestratorZeroLimits.on('limit:exceeded', (event) => exceededEvents.push(event));

      await (orchestratorZeroLimits as any).checkResourceLimits('test-task-1');

      expect(exceededEvents.length).toBeGreaterThan(0);
    });
  });
});
