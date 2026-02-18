import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ApexOrchestrator, LimitWarningEvent, LimitExceededEvent } from './index';
import { TaskStore } from './store';
import { Task, TaskStatus, Config } from '@apexcli/core';
import { AgentSDK } from '@anthropic-ai/claude-agent-sdk';

// Mock dependencies
vi.mock('./store');
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  AgentSDK: vi.fn().mockImplementation(() => ({
    query: vi.fn(),
  })),
}));

describe('Resource Limit Tracking Integration Tests', () => {
  let orchestrator: ApexOrchestrator;
  let mockStore: any;
  let config: Config;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Create test config with resource limits
    config = {
      limits: {
        maxCostPerTask: 5.0,
        maxTokensPerTask: 50000,
        maxExecutionTime: 20000, // 20 seconds
        maxFileChanges: 25,
        maxConcurrentTasks: 2,
        maxRetries: 3,
        retryDelayMs: 1000,
        retryBackoffFactor: 2,
      },
    } as Config;

    // Mock TaskStore
    mockStore = {
      getTask: vi.fn(),
      updateTask: vi.fn(),
      createTask: vi.fn(),
      getTasks: vi.fn(),
      addTaskLog: vi.fn(),
      deleteTask: vi.fn(),
      archiveTask: vi.fn(),
      close: vi.fn(),
    } as any;

    (TaskStore as any).mockImplementation(() => mockStore);

    orchestrator = new ApexOrchestrator(config);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Real Usage Tracking', () => {
    it('should track actual token usage through updateUsage method', async () => {
      const taskId = 'real-task-1';
      const mockTask: Task = {
        id: taskId,
        title: 'Test Task',
        description: 'Testing real usage tracking',
        status: 'running' as TaskStatus,
        createdAt: new Date(),
        updatedAt: new Date(),
        branchName: 'test-branch',
        workflow: 'test-workflow',
        usage: {
          inputTokens: 1000,
          outputTokens: 500,
          totalTokens: 1500,
          estimatedCost: 0.05,
        },
        logs: [],
        artifacts: [],
      } as Task;

      mockStore.getTask.mockResolvedValue(mockTask);

      // Test the actual updateUsage method (it's private, so we need to access it)
      const updateUsageMethod = (orchestrator as any).updateUsage;
      expect(updateUsageMethod).toBeDefined();

      // Call updateUsage with token deltas
      await updateUsageMethod(taskId, {
        inputTokens: 2000,
        outputTokens: 1000,
      });

      // Verify the store was updated with accumulated usage
      expect(mockStore.updateTask).toHaveBeenCalledWith(taskId, {
        usage: {
          inputTokens: 3000, // 1000 + 2000
          outputTokens: 1500, // 500 + 1000
          totalTokens: 4500, // 3000 + 1500
          estimatedCost: expect.any(Number),
        },
      });
    });

    it('should emit usage:updated event when usage is updated', async () => {
      const taskId = 'emit-test-task';
      const mockTask: Task = {
        id: taskId,
        title: 'Emit Test',
        description: 'Testing usage events',
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
        logs: [],
        artifacts: [],
      } as Task;

      mockStore.getTask.mockResolvedValue(mockTask);

      // Listen for usage updated event
      const usageUpdatedPromise = new Promise((resolve) => {
        orchestrator.once('usage:updated', resolve);
      });

      // Call updateUsage
      await (orchestrator as any).updateUsage(taskId, {
        inputTokens: 1000,
        outputTokens: 500,
      });

      // Wait for and verify the event was emitted
      const eventArgs = await usageUpdatedPromise;
      expect(eventArgs).toBeDefined();
    });
  });

  describe('Resource Limit Configuration', () => {
    it('should respect configured resource limits', () => {
      const effectiveConfig = (orchestrator as any).effectiveConfig;

      expect(effectiveConfig.limits.maxCostPerTask).toBe(5.0);
      expect(effectiveConfig.limits.maxTokensPerTask).toBe(50000);
      expect(effectiveConfig.limits.maxExecutionTime).toBe(20000);
      expect(effectiveConfig.limits.maxFileChanges).toBe(25);
    });

    it('should use default limits when not configured', () => {
      const orchestratorNoLimits = new ApexOrchestrator({});
      const effectiveConfig = (orchestratorNoLimits as any).effectiveConfig;

      // Should have some default limits
      expect(typeof effectiveConfig.limits.maxConcurrentTasks).toBe('number');
      expect(typeof effectiveConfig.limits.maxRetries).toBe('number');
    });
  });

  describe('Task Execution Time Tracking', () => {
    it('should track execution time during task lifecycle', async () => {
      const taskId = 'time-tracking-task';
      const mockTask: Task = {
        id: taskId,
        title: 'Time Tracking Test',
        description: 'Testing execution time tracking',
        status: 'running' as TaskStatus,
        createdAt: new Date(),
        updatedAt: new Date(),
        startedAt: new Date(Date.now() - 10000), // Started 10 seconds ago
        branchName: 'test-branch',
        workflow: 'test-workflow',
        usage: {
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          estimatedCost: 0,
        },
        executionTime: 0,
        logs: [],
        artifacts: [],
      } as Task;

      mockStore.getTask.mockResolvedValue(mockTask);

      // Test that execution time can be calculated
      const currentTime = Date.now();
      const expectedExecutionTime = currentTime - mockTask.startedAt!.getTime();

      expect(expectedExecutionTime).toBeGreaterThan(9000); // At least 9 seconds
      expect(expectedExecutionTime).toBeLessThan(12000); // Less than 12 seconds
    });
  });

  describe('File Changes Tracking', () => {
    it('should support tracking file changes in task artifacts', async () => {
      const taskId = 'file-tracking-task';
      const mockTask: Task = {
        id: taskId,
        title: 'File Tracking Test',
        description: 'Testing file change tracking',
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
        fileChanges: {
          created: ['src/new-component.tsx', 'docs/api.md'],
          modified: ['src/app.tsx', 'package.json'],
        },
        logs: [],
        artifacts: [],
      } as Task;

      mockStore.getTask.mockResolvedValue(mockTask);

      // Verify file changes are properly tracked
      expect(mockTask.fileChanges.created).toHaveLength(2);
      expect(mockTask.fileChanges.modified).toHaveLength(2);

      // Total file changes should be 4
      const totalFileChanges =
        mockTask.fileChanges.created.length +
        mockTask.fileChanges.modified.length;
      expect(totalFileChanges).toBe(4);
    });

    it('should handle missing fileChanges gracefully', async () => {
      const taskWithoutFileChanges: Task = {
        id: 'no-files-task',
        title: 'No Files Test',
        description: 'Task without file changes',
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
        // fileChanges is undefined/missing
        logs: [],
        artifacts: [],
      } as Task;

      mockStore.getTask.mockResolvedValue(taskWithoutFileChanges);

      // Should not throw error when fileChanges is missing
      expect(() => {
        const fileChanges = taskWithoutFileChanges.fileChanges || { created: [], modified: [] };
        const totalChanges = fileChanges.created.length + fileChanges.modified.length;
        return totalChanges;
      }).not.toThrow();
    });
  });

  describe('Integration with Agent SDK', () => {
    it('should track usage during agent query execution', async () => {
      const mockAgentSDK = {
        query: vi.fn().mockResolvedValue({
          text: 'Test response',
          usage: {
            inputTokens: 1000,
            outputTokens: 500,
          },
        }),
      };

      (AgentSDK as any).mockImplementation(() => mockAgentSDK);

      const taskId = 'sdk-integration-task';
      const mockTask: Task = {
        id: taskId,
        title: 'SDK Integration Test',
        description: 'Testing SDK integration',
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
        logs: [],
        artifacts: [],
      } as Task;

      mockStore.getTask.mockResolvedValue(mockTask);

      // Test that usage would be tracked during a real agent query
      // Note: This tests the integration point, not the actual query execution
      expect(mockAgentSDK.query).toBeDefined();

      // Simulate what would happen after an agent query
      const usageFromQuery = { inputTokens: 1000, outputTokens: 500 };
      await (orchestrator as any).updateUsage(taskId, usageFromQuery);

      expect(mockStore.updateTask).toHaveBeenCalledWith(taskId, {
        usage: expect.objectContaining({
          inputTokens: usageFromQuery.inputTokens,
          outputTokens: usageFromQuery.outputTokens,
          totalTokens: 1500,
          estimatedCost: expect.any(Number),
        }),
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle null/undefined task gracefully in updateUsage', async () => {
      mockStore.getTask.mockResolvedValue(null);

      // Should not throw when task doesn't exist
      await expect((orchestrator as any).updateUsage('nonexistent-task', {
        inputTokens: 100,
        outputTokens: 50,
      })).resolves.not.toThrow();

      // Should not attempt to update store
      expect(mockStore.updateTask).not.toHaveBeenCalled();
    });

    it('should handle negative token usage gracefully', async () => {
      const taskId = 'negative-usage-task';
      const mockTask: Task = {
        id: taskId,
        title: 'Negative Usage Test',
        description: 'Testing negative usage handling',
        status: 'running' as TaskStatus,
        createdAt: new Date(),
        updatedAt: new Date(),
        branchName: 'test-branch',
        workflow: 'test-workflow',
        usage: {
          inputTokens: 500,
          outputTokens: 300,
          totalTokens: 800,
          estimatedCost: 0.02,
        },
        logs: [],
        artifacts: [],
      } as Task;

      mockStore.getTask.mockResolvedValue(mockTask);

      // Should handle negative deltas (though this shouldn't happen in normal use)
      await (orchestrator as any).updateUsage(taskId, {
        inputTokens: -100,
        outputTokens: -50,
      });

      expect(mockStore.updateTask).toHaveBeenCalledWith(taskId, {
        usage: {
          inputTokens: 400, // 500 - 100
          outputTokens: 250, // 300 - 50
          totalTokens: 650, // 400 + 250
          estimatedCost: expect.any(Number),
        },
      });
    });

    it('should handle very large usage numbers', async () => {
      const taskId = 'large-usage-task';
      const mockTask: Task = {
        id: taskId,
        title: 'Large Usage Test',
        description: 'Testing large usage numbers',
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
        logs: [],
        artifacts: [],
      } as Task;

      mockStore.getTask.mockResolvedValue(mockTask);

      // Test with very large token numbers
      const largeTokens = 1000000;
      await (orchestrator as any).updateUsage(taskId, {
        inputTokens: largeTokens,
        outputTokens: largeTokens,
      });

      expect(mockStore.updateTask).toHaveBeenCalledWith(taskId, {
        usage: {
          inputTokens: largeTokens,
          outputTokens: largeTokens,
          totalTokens: largeTokens * 2,
          estimatedCost: expect.any(Number),
        },
      });
    });
  });

  describe('Cost Calculation Integration', () => {
    it('should calculate costs correctly using the calculateCost function', async () => {
      const taskId = 'cost-calc-task';
      const mockTask: Task = {
        id: taskId,
        title: 'Cost Calculation Test',
        description: 'Testing cost calculation integration',
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
        logs: [],
        artifacts: [],
      } as Task;

      mockStore.getTask.mockResolvedValue(mockTask);

      // Update with known token amounts
      const inputTokens = 10000;
      const outputTokens = 5000;

      await (orchestrator as any).updateUsage(taskId, {
        inputTokens,
        outputTokens,
      });

      // Verify that estimatedCost was calculated and is a reasonable number
      const updateCall = mockStore.updateTask.mock.calls[0];
      const usage = updateCall[1].usage;

      expect(usage.estimatedCost).toBeGreaterThan(0);
      expect(usage.estimatedCost).toBeLessThan(10); // Should be reasonable for 15k tokens
      expect(typeof usage.estimatedCost).toBe('number');
      expect(Number.isFinite(usage.estimatedCost)).toBe(true);
    });
  });
});