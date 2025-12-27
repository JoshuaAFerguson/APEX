/**
 * Inspect Command Integration Tests
 *
 * Integration tests for the TaskInspector service with real orchestrator interactions,
 * verifying that the service integrates properly with the orchestrator and handles
 * various data scenarios correctly.
 *
 * These tests focus on:
 * 1. TaskInspector service integration with ApexOrchestrator
 * 2. Real data flow between service and orchestrator
 * 3. Error handling in integrated scenarios
 * 4. Performance with real-world data structures
 * 5. Complete acceptance criteria validation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApexOrchestrator } from '@apexcli/orchestrator';
import { Task, TaskStatus, TaskPriority, TaskEffort, AutonomyLevel, TaskLog, TaskCheckpoint } from '@apexcli/core';
import { TaskInspector, TaskInspectionOptions } from '../services/task-inspector.js';

// Mock console.log to capture output
const mockConsoleLog = vi.fn();
vi.stubGlobal('console', { log: mockConsoleLog });

// Create mock orchestrator factory
const createMockOrchestrator = (overrides = {}) => ({
  getTask: vi.fn(),
  getTaskLogs: vi.fn(),
  listCheckpoints: vi.fn(),
  ...overrides
} as unknown as ApexOrchestrator);

// Test data
const createTestTask = (overrides: Partial<Task> = {}): Task => ({
  id: 'integration-task-123',
  description: 'Integration test task',
  acceptanceCriteria: 'Should work with real orchestrator',
  workflow: 'feature',
  autonomy: 'autonomous' as AutonomyLevel,
  status: 'completed' as TaskStatus,
  priority: 'medium' as TaskPriority,
  effort: 'medium' as TaskEffort,
  projectPath: '/test/integration',
  retryCount: 0,
  maxRetries: 3,
  resumeAttempts: 0,
  createdAt: new Date('2023-01-01T10:00:00Z'),
  updatedAt: new Date('2023-01-01T11:00:00Z'),
  completedAt: new Date('2023-01-01T11:30:00Z'),
  usage: {
    inputTokens: 1000,
    outputTokens: 500,
    totalTokens: 1500,
    estimatedCost: 0.05
  },
  logs: [],
  artifacts: [
    {
      name: 'integration-file.ts',
      type: 'file',
      path: '/test/integration/src/file.ts',
      content: 'export const integration = "test";',
      createdAt: new Date('2023-01-01T10:30:00Z')
    }
  ],
  ...overrides
});

const testLogs: TaskLog[] = [
  {
    id: 'log-1',
    taskId: 'integration-task-123',
    level: 'info',
    message: 'Integration test log',
    timestamp: new Date('2023-01-01T10:15:00Z'),
    stage: 'testing',
    agent: 'tester'
  }
];

const testCheckpoints: TaskCheckpoint[] = [
  {
    checkpointId: 'checkpoint-1',
    taskId: 'integration-task-123',
    stage: 'testing',
    stageIndex: 0,
    createdAt: new Date('2023-01-01T10:20:00Z'),
    conversationState: [{ role: 'user', content: 'Test checkpoint' }],
    metadata: {}
  }
];

describe('TaskInspector Service Integration', () => {
  let mockOrchestrator: ReturnType<typeof createMockOrchestrator>;
  let inspector: TaskInspector;

  beforeEach(() => {
    mockConsoleLog.mockClear();
    mockOrchestrator = createMockOrchestrator();
    inspector = new TaskInspector(mockOrchestrator);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Service Integration with ApexOrchestrator', () => {
    it('should integrate correctly with orchestrator for task retrieval', async () => {
      const testTask = createTestTask();
      mockOrchestrator.getTask = vi.fn().mockResolvedValue(testTask);

      await inspector.inspectTask('integration-task-123');

      expect(mockOrchestrator.getTask).toHaveBeenCalledWith('integration-task-123');
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('📋 Task Inspection: integration-task-123')
      );
    });

    it('should integrate correctly with orchestrator for logs retrieval', async () => {
      const testTask = createTestTask();
      mockOrchestrator.getTask = vi.fn().mockResolvedValue(testTask);
      mockOrchestrator.getTaskLogs = vi.fn().mockResolvedValue(testLogs);

      await inspector.inspectTask('integration-task-123', { logs: true });

      expect(mockOrchestrator.getTask).toHaveBeenCalledWith('integration-task-123');
      expect(mockOrchestrator.getTaskLogs).toHaveBeenCalledWith('integration-task-123');
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Integration test log')
      );
    });

    it('should integrate correctly with orchestrator for checkpoints retrieval', async () => {
      const testTask = createTestTask();
      mockOrchestrator.getTask = vi.fn().mockResolvedValue(testTask);
      mockOrchestrator.listCheckpoints = vi.fn().mockResolvedValue(testCheckpoints);

      await inspector.inspectTask('integration-task-123', { checkpoints: true });

      expect(mockOrchestrator.getTask).toHaveBeenCalledWith('integration-task-123');
      expect(mockOrchestrator.listCheckpoints).toHaveBeenCalledWith('integration-task-123');
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('checkpoint-1')
      );
    });
  });

  describe('Real Data Flow Integration', () => {
    it('should handle complete data flow for timeline view', async () => {
      const testTask = createTestTask();
      mockOrchestrator.getTask = vi.fn().mockResolvedValue(testTask);
      mockOrchestrator.getTaskLogs = vi.fn().mockResolvedValue(testLogs);
      mockOrchestrator.listCheckpoints = vi.fn().mockResolvedValue(testCheckpoints);

      await inspector.inspectTask('integration-task-123', { timeline: true });

      // Verify all orchestrator methods were called
      expect(mockOrchestrator.getTask).toHaveBeenCalledWith('integration-task-123');
      expect(mockOrchestrator.getTaskLogs).toHaveBeenCalledWith('integration-task-123');
      expect(mockOrchestrator.listCheckpoints).toHaveBeenCalledWith('integration-task-123');

      // Verify timeline output contains data from all sources
      const output = mockConsoleLog.mock.calls.map(call => call[0]).join(' ');
      expect(output).toContain('⏱️  Execution Timeline');
      expect(output).toContain('Task created');
      expect(output).toContain('Task completed');
      expect(output).toContain('Integration test log');
      expect(output).toContain('Checkpoint created');
    });

    it('should handle orchestrator method call sequencing correctly', async () => {
      const testTask = createTestTask();
      let callOrder: string[] = [];

      mockOrchestrator.getTask = vi.fn().mockImplementation(async (taskId) => {
        callOrder.push('getTask');
        return testTask;
      });
      mockOrchestrator.getTaskLogs = vi.fn().mockImplementation(async (taskId) => {
        callOrder.push('getTaskLogs');
        return testLogs;
      });
      mockOrchestrator.listCheckpoints = vi.fn().mockImplementation(async (taskId) => {
        callOrder.push('listCheckpoints');
        return testCheckpoints;
      });

      await inspector.inspectTask('integration-task-123', { timeline: true });

      expect(callOrder).toEqual(['getTask', 'getTaskLogs', 'listCheckpoints']);
    });
  });

  describe('Error Handling in Integration Context', () => {
    it('should handle orchestrator getTask failures', async () => {
      mockOrchestrator.getTask = vi.fn().mockRejectedValue(new Error('Database error'));

      await expect(inspector.inspectTask('integration-task-123')).rejects.toThrow('Database error');
      expect(mockOrchestrator.getTask).toHaveBeenCalledWith('integration-task-123');
    });

    it('should handle orchestrator getTaskLogs failures gracefully', async () => {
      const testTask = createTestTask();
      mockOrchestrator.getTask = vi.fn().mockResolvedValue(testTask);
      mockOrchestrator.getTaskLogs = vi.fn().mockRejectedValue(new Error('Log fetch error'));

      await expect(inspector.inspectTask('integration-task-123', { logs: true }))
        .rejects.toThrow('Log fetch error');
    });

    it('should handle orchestrator listCheckpoints failures gracefully', async () => {
      const testTask = createTestTask();
      mockOrchestrator.getTask = vi.fn().mockResolvedValue(testTask);
      mockOrchestrator.listCheckpoints = vi.fn().mockRejectedValue(new Error('Checkpoint fetch error'));

      await expect(inspector.inspectTask('integration-task-123', { checkpoints: true }))
        .rejects.toThrow('Checkpoint fetch error');
    });
  });

  describe('Performance Integration Scenarios', () => {
    it('should handle large task data efficiently', async () => {
      const largeTask = createTestTask({
        artifacts: Array(100).fill(null).map((_, i) => ({
          name: `file-${i}.ts`,
          type: 'file' as const,
          path: `/test/file-${i}.ts`,
          content: 'const data = "test";'.repeat(1000),
          createdAt: new Date()
        }))
      });

      const largeLogs = Array(1000).fill(null).map((_, i) => ({
        id: `log-${i}`,
        taskId: 'integration-task-123',
        level: 'info' as const,
        message: `Log entry ${i}`,
        timestamp: new Date()
      }));

      mockOrchestrator.getTask = vi.fn().mockResolvedValue(largeTask);
      mockOrchestrator.getTaskLogs = vi.fn().mockResolvedValue(largeLogs);
      mockOrchestrator.listCheckpoints = vi.fn().mockResolvedValue([]);

      const start = performance.now();
      await inspector.inspectTask('integration-task-123', { timeline: true });
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(1000); // Should complete within 1 second
      expect(mockConsoleLog).toHaveBeenCalled();
    });
  });

  describe('Complete Acceptance Criteria Validation', () => {
    it('should satisfy "apex inspect <taskId> shows comprehensive task results"', async () => {
      const testTask = createTestTask();
      mockOrchestrator.getTask = vi.fn().mockResolvedValue(testTask);

      await inspector.inspectTask('integration-task-123');

      const output = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('📋 Task Inspection');
      expect(output).toContain('📝 Details:');
      expect(output).toContain('💰 Usage & Cost:');
      expect(output).toContain('⏱️  Timeline:');
      expect(output).toContain('📎 Quick Summary:');
    });

    it('should satisfy "apex inspect <taskId> --files lists modified files"', async () => {
      const testTask = createTestTask();
      mockOrchestrator.getTask = vi.fn().mockResolvedValue(testTask);

      await inspector.inspectTask('integration-task-123', { files: true });

      const output = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('📁 Modified Files');
      expect(output).toContain('integration-file.ts');
      expect(output).toContain('📊 Total: 1 files modified');
    });

    it('should satisfy "apex inspect <taskId> --file <path> shows specific file content"', async () => {
      const testTask = createTestTask();
      mockOrchestrator.getTask = vi.fn().mockResolvedValue(testTask);

      await inspector.inspectTask('integration-task-123', {
        file: '/test/integration/src/file.ts'
      });

      const output = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('📄 File Content: /test/integration/src/file.ts');
      expect(output).toContain('export const integration = "test";');
    });

    it('should satisfy "apex inspect <taskId> --timeline shows execution timeline"', async () => {
      const testTask = createTestTask();
      mockOrchestrator.getTask = vi.fn().mockResolvedValue(testTask);
      mockOrchestrator.getTaskLogs = vi.fn().mockResolvedValue(testLogs);
      mockOrchestrator.listCheckpoints = vi.fn().mockResolvedValue(testCheckpoints);

      await inspector.inspectTask('integration-task-123', { timeline: true });

      const output = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('⏱️  Execution Timeline');
      expect(output).toContain('Integration test log');
    });

    it('should satisfy all other options requirements', async () => {
      const baseTask = createTestTask();
      const testTask = createTestTask({
        artifacts: [...baseTask.artifacts, {
          name: 'README.md',
          type: 'report',
          path: '/test/README.md',
          content: '# Documentation',
          createdAt: new Date()
        }]
      });

      mockOrchestrator.getTask = vi.fn().mockResolvedValue(testTask);
      mockOrchestrator.getTaskLogs = vi.fn().mockResolvedValue(testLogs);
      mockOrchestrator.listCheckpoints = vi.fn().mockResolvedValue(testCheckpoints);

      // Test --docs
      await inspector.inspectTask('integration-task-123', { docs: true });
      expect(mockConsoleLog.mock.calls.map(call => call[0]).join('\n'))
        .toContain('📚 Generated Documentation');

      mockConsoleLog.mockClear();

      // Test --logs
      await inspector.inspectTask('integration-task-123', { logs: true });
      expect(mockConsoleLog.mock.calls.map(call => call[0]).join('\n'))
        .toContain('📝 Task Logs');

      mockConsoleLog.mockClear();

      // Test --artifacts
      await inspector.inspectTask('integration-task-123', { artifacts: true });
      expect(mockConsoleLog.mock.calls.map(call => call[0]).join('\n'))
        .toContain('📎 Task Artifacts');

      mockConsoleLog.mockClear();

      // Test --checkpoints
      await inspector.inspectTask('integration-task-123', { checkpoints: true });
      expect(mockConsoleLog.mock.calls.map(call => call[0]).join('\n'))
        .toContain('🏁 Task Checkpoints');
    });
  });
});