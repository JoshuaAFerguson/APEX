import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ApexOrchestrator } from '../index';
import type { ApexConfig, Task, TaskStatus } from '@apexcli/core';
import { query } from '@anthropic-ai/claude-agent-sdk';

// Mock the claude-agent-sdk
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn(),
}));

describe('ApexOrchestrator - Core Functionality', () => {
  let orchestrator: ApexOrchestrator;
  let mockConfig: ApexConfig;

  beforeEach(() => {
    // Setup minimal config for testing
    mockConfig = {
      autonomyLevel: 'none',
      maxConcurrentTasks: 1,
      limits: {
        maxTokens: 100000,
        maxCost: 10.0,
        maxDuration: 3600000,
      },
      permissions: {
        filesystem: {
          allowedPaths: ['/tmp'],
          deniedPaths: [],
        },
      },
    };

    orchestrator = new ApexOrchestrator(mockConfig, '/tmp/test-workspace');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Task Creation and Lifecycle', () => {
    it('should create a task with proper initialization', async () => {
      const taskDescription = 'Test task for unit testing';
      const workflowName = 'test-workflow';

      const task = await orchestrator.createTask({
        description: taskDescription,
        workflow: workflowName,
      });

      expect(task.id).toBeDefined();
      expect(task.description).toBe(taskDescription);
      expect(task.workflow).toBe(workflowName);
      expect(task.status).toBe('pending');
      expect(task.createdAt).toBeInstanceOf(Date);
      expect(task.usage.totalCost).toBe(0);
      expect(task.usage.inputTokens).toBe(0);
      expect(task.usage.outputTokens).toBe(0);
    });

    it('should properly store task in the database', async () => {
      const task = await orchestrator.createTask({
        description: 'Test storage',
        workflow: 'test-workflow',
      });

      // Retrieve the task from storage
      const storedTask = orchestrator.store.getTask(task.id);
      expect(storedTask).toBeDefined();
      expect(storedTask!.id).toBe(task.id);
      expect(storedTask!.description).toBe('Test storage');
    });

    it('should update task status correctly', async () => {
      const task = await orchestrator.createTask({
        description: 'Status update test',
        workflow: 'test-workflow',
      });

      // Update status to running
      await orchestrator.updateTaskStatus(task.id, 'running');

      const updatedTask = orchestrator.store.getTask(task.id);
      expect(updatedTask!.status).toBe('running');
      expect(updatedTask!.startedAt).toBeInstanceOf(Date);
    });

    it('should handle task completion properly', async () => {
      const task = await orchestrator.createTask({
        description: 'Completion test',
        workflow: 'test-workflow',
      });

      // Complete the task
      await orchestrator.updateTaskStatus(task.id, 'completed');

      const completedTask = orchestrator.store.getTask(task.id);
      expect(completedTask!.status).toBe('completed');
      expect(completedTask!.completedAt).toBeInstanceOf(Date);
    });
  });

  describe('Task Validation', () => {
    it('should validate task description length', async () => {
      const emptyDescription = '';
      await expect(
        orchestrator.createTask({
          description: emptyDescription,
          workflow: 'test-workflow',
        })
      ).rejects.toThrow();
    });

    it('should validate workflow name format', async () => {
      const invalidWorkflow = '';
      await expect(
        orchestrator.createTask({
          description: 'Valid description',
          workflow: invalidWorkflow,
        })
      ).rejects.toThrow();
    });

    it('should handle duplicate task IDs gracefully', async () => {
      const task1 = await orchestrator.createTask({
        description: 'First task',
        workflow: 'test-workflow',
      });

      const task2 = await orchestrator.createTask({
        description: 'Second task',
        workflow: 'test-workflow',
      });

      expect(task1.id).not.toBe(task2.id);
    });
  });

  describe('Usage Tracking', () => {
    it('should track token usage correctly', async () => {
      const task = await orchestrator.createTask({
        description: 'Usage tracking test',
        workflow: 'test-workflow',
      });

      const mockUsage = {
        inputTokens: 1000,
        outputTokens: 500,
        totalCost: 0.025,
      };

      // Simulate adding usage
      orchestrator.store.updateTaskUsage(task.id, mockUsage);

      const updatedTask = orchestrator.store.getTask(task.id);
      expect(updatedTask!.usage.inputTokens).toBe(1000);
      expect(updatedTask!.usage.outputTokens).toBe(500);
      expect(updatedTask!.usage.totalCost).toBe(0.025);
    });

    it('should enforce token limits', async () => {
      const limitedConfig = {
        ...mockConfig,
        limits: {
          ...mockConfig.limits,
          maxTokens: 100, // Very low limit
        },
      };

      const limitedOrchestrator = new ApexOrchestrator(limitedConfig, '/tmp/test-workspace');

      const task = await limitedOrchestrator.createTask({
        description: 'Limit test',
        workflow: 'test-workflow',
      });

      // Simulate exceeding token limit
      const exceedingUsage = {
        inputTokens: 200, // Exceeds limit of 100
        outputTokens: 50,
        totalCost: 0.1,
      };

      // This should be handled appropriately by the orchestrator
      const exceedsLimit = limitedOrchestrator.checkTokenLimits(exceedingUsage);
      expect(exceedsLimit).toBe(true);
    });
  });

  describe('Event Emission', () => {
    it('should emit task created event', async () => {
      const eventSpy = vi.fn();
      orchestrator.on('task:created', eventSpy);

      const task = await orchestrator.createTask({
        description: 'Event test',
        workflow: 'test-workflow',
      });

      expect(eventSpy).toHaveBeenCalledTimes(1);
      expect(eventSpy).toHaveBeenCalledWith({
        type: 'task:created',
        taskId: task.id,
        timestamp: expect.any(Date),
        data: expect.objectContaining({
          description: 'Event test',
          workflow: 'test-workflow',
        }),
      });
    });

    it('should emit task status change events', async () => {
      const statusSpy = vi.fn();
      orchestrator.on('task:status-changed', statusSpy);

      const task = await orchestrator.createTask({
        description: 'Status event test',
        workflow: 'test-workflow',
      });

      await orchestrator.updateTaskStatus(task.id, 'running');

      expect(statusSpy).toHaveBeenCalledTimes(1);
      expect(statusSpy).toHaveBeenCalledWith({
        type: 'task:status-changed',
        taskId: task.id,
        timestamp: expect.any(Date),
        data: expect.objectContaining({
          oldStatus: 'pending',
          newStatus: 'running',
        }),
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid task IDs gracefully', () => {
      const nonExistentTaskId = 'task_invalid_12345';

      expect(() => {
        orchestrator.store.getTask(nonExistentTaskId);
      }).not.toThrow();

      const result = orchestrator.store.getTask(nonExistentTaskId);
      expect(result).toBeNull();
    });

    it('should handle database errors gracefully', async () => {
      // Simulate database error by providing invalid path
      const invalidOrchestrator = new ApexOrchestrator(mockConfig, '/invalid/path/that/does/not/exist');

      // This should handle the error gracefully instead of crashing
      await expect(
        invalidOrchestrator.createTask({
          description: 'Error test',
          workflow: 'test-workflow',
        })
      ).rejects.toThrow();
    });

    it('should validate configuration on initialization', () => {
      const invalidConfig = {
        ...mockConfig,
        autonomyLevel: 'invalid' as any,
      };

      expect(() => {
        new ApexOrchestrator(invalidConfig, '/tmp/test-workspace');
      }).toThrow();
    });
  });

  describe('Cleanup and Resource Management', () => {
    it('should properly cleanup resources on shutdown', async () => {
      const task = await orchestrator.createTask({
        description: 'Cleanup test',
        workflow: 'test-workflow',
      });

      // Start the task
      await orchestrator.updateTaskStatus(task.id, 'running');

      // Shutdown should handle cleanup
      await orchestrator.shutdown();

      // Verify cleanup occurred (specific implementation details would vary)
      expect(orchestrator.isShuttingDown).toBe(true);
    });

    it('should handle concurrent task operations safely', async () => {
      // Create multiple tasks concurrently
      const promises = Array.from({ length: 5 }, (_, i) =>
        orchestrator.createTask({
          description: `Concurrent task ${i}`,
          workflow: 'test-workflow',
        })
      );

      const tasks = await Promise.all(promises);

      // All tasks should be created successfully
      expect(tasks).toHaveLength(5);
      tasks.forEach((task, index) => {
        expect(task.description).toBe(`Concurrent task ${index}`);
        expect(task.status).toBe('pending');
      });
    });
  });

  describe('Integration with Claude Agent SDK', () => {
    it('should properly configure Claude SDK calls', async () => {
      const mockQuery = vi.mocked(query);
      mockQuery.mockResolvedValue({
        content: [{ type: 'text', text: 'Test response' }],
        usage: { input_tokens: 100, output_tokens: 50 },
      });

      const task = await orchestrator.createTask({
        description: 'Claude SDK integration test',
        workflow: 'test-workflow',
      });

      // Execute a task (this would typically involve Claude SDK query)
      await orchestrator.runTask(task.id);

      // Verify Claude SDK was called with proper configuration
      expect(mockQuery).toHaveBeenCalled();
      const callArgs = mockQuery.mock.calls[0];
      expect(callArgs).toBeDefined();
      // Additional assertions about the call parameters would go here
    });
  });
});