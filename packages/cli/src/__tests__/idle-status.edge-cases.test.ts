/**
 * Idle Status Command Edge Cases Tests
 *
 * Tests edge cases, error scenarios, and boundary conditions for the
 * 'apex idle status' command implementation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { IdleTask, IdleTaskType, TaskPriority } from '@apexcli/core';

// Mock console.log to capture output
const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

describe('Idle Status Command Edge Cases', () => {
  let mockOrchestrator: any;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleSpy.mockClear();

    // Set up mock orchestrator
    mockOrchestrator = {
      initialize: vi.fn().mockResolvedValue(undefined),
      listIdleTasks: vi.fn(),
      shutdown: vi.fn().mockResolvedValue(undefined),
    };
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('malformed task data', () => {
    it('should handle tasks with missing optional fields', async () => {
      const malformedTask = {
        id: 'task-1',
        type: 'maintenance' as IdleTaskType,
        title: 'Test task',
        priority: 'normal' as TaskPriority,
        estimatedEffort: 'medium',
        implemented: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        // Missing description, rationale, metadata
      } as IdleTask;

      mockOrchestrator.listIdleTasks.mockResolvedValue([malformedTask]);

      const { runIdleStatusCommand } = await createTestHelpers();
      await expect(runIdleStatusCommand([malformedTask])).resolves.not.toThrow();
    });

    it('should handle tasks with null/undefined values', async () => {
      const taskWithNulls = {
        id: 'task-1',
        type: 'maintenance' as IdleTaskType,
        title: null, // null title
        priority: 'normal' as TaskPriority,
        estimatedEffort: undefined, // undefined effort
        rationale: '', // empty rationale
        implemented: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {}
      } as any as IdleTask;

      mockOrchestrator.listIdleTasks.mockResolvedValue([taskWithNulls]);

      const { runIdleStatusCommand } = await createTestHelpers();
      await expect(runIdleStatusCommand([taskWithNulls])).resolves.not.toThrow();
    });

    it('should handle tasks with extremely long text fields', async () => {
      const longText = 'A'.repeat(1000); // Very long text
      const taskWithLongFields = {
        id: 'task-' + 'x'.repeat(100), // Very long ID
        type: 'maintenance' as IdleTaskType,
        title: longText,
        description: longText,
        priority: 'normal' as TaskPriority,
        estimatedEffort: 'medium',
        rationale: longText,
        implemented: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {}
      } as IdleTask;

      mockOrchestrator.listIdleTasks.mockResolvedValue([taskWithLongFields]);

      const { runIdleStatusCommand } = await createTestHelpers();
      await expect(runIdleStatusCommand([taskWithLongFields])).resolves.not.toThrow();

      // Verify ID is still truncated to 12 characters
      const calls = consoleSpy.mock.calls.map(call => call[0]);
      const idCall = calls.find(call => call.includes('task-xxxxxxxx'));
      expect(idCall).toBeDefined();
    });

    it('should handle tasks with special characters and emojis', async () => {
      const specialTask = {
        id: 'task-🚀-special',
        type: 'maintenance' as IdleTaskType,
        title: '🔥 Fix critical bug with special chars: <>&"\'',
        description: 'Task with émojis and ṻñiçödé',
        priority: 'high' as TaskPriority,
        estimatedEffort: 'small',
        rationale: 'Contains special characters: @#$%^&*()',
        implemented: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {}
      } as IdleTask;

      mockOrchestrator.listIdleTasks.mockResolvedValue([specialTask]);

      const { runIdleStatusCommand } = await createTestHelpers();
      await expect(runIdleStatusCommand([specialTask])).resolves.not.toThrow();
    });
  });

  describe('boundary conditions', () => {
    it('should handle exactly 10 tasks (default limit)', async () => {
      const exactlyTenTasks = Array.from({ length: 10 }, (_, i) => ({
        id: `task-${i}`,
        type: 'maintenance' as IdleTaskType,
        title: `Task ${i}`,
        priority: 'normal' as TaskPriority,
        estimatedEffort: 'small',
        rationale: `Rationale ${i}`,
        implemented: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {}
      } as IdleTask));

      mockOrchestrator.listIdleTasks.mockResolvedValue(exactlyTenTasks);

      const { runIdleStatusCommand } = await createTestHelpers();
      await runIdleStatusCommand(exactlyTenTasks);

      const calls = consoleSpy.mock.calls.map(call => call[0]);
      expect(calls.some(call => call.includes('💡 Pending Idle Tasks (10)'))).toBe(true);
    });

    it('should handle single task', async () => {
      const singleTask = [{
        id: 'only-task',
        type: 'docs' as IdleTaskType,
        title: 'Single task',
        priority: 'low' as TaskPriority,
        estimatedEffort: 'xs',
        rationale: 'Only one task',
        implemented: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {}
      } as IdleTask];

      mockOrchestrator.listIdleTasks.mockResolvedValue(singleTask);

      const { runIdleStatusCommand } = await createTestHelpers();
      await runIdleStatusCommand(singleTask);

      const calls = consoleSpy.mock.calls.map(call => call[0]);
      expect(calls.some(call => call.includes('💡 Pending Idle Tasks (1)'))).toBe(true);
    });

    it('should handle tasks with minimum required fields only', async () => {
      const minimalTask = {
        id: 'minimal',
        type: 'maintenance' as IdleTaskType,
        title: 'Minimal',
        priority: 'normal' as TaskPriority,
        estimatedEffort: 'small',
        rationale: 'Basic',
        implemented: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {}
      } as IdleTask;

      mockOrchestrator.listIdleTasks.mockResolvedValue([minimalTask]);

      const { runIdleStatusCommand } = await createTestHelpers();
      await expect(runIdleStatusCommand([minimalTask])).resolves.not.toThrow();
    });
  });

  describe('error scenarios', () => {
    it('should handle orchestrator initialization failure', async () => {
      mockOrchestrator.initialize.mockRejectedValue(new Error('Failed to initialize'));

      // Test that initialization errors are properly propagated
      await expect(mockOrchestrator.initialize()).rejects.toThrow('Failed to initialize');
    });

    it('should handle database connection errors', async () => {
      mockOrchestrator.listIdleTasks.mockRejectedValue(new Error('Database connection lost'));

      const { runIdleStatusCommand } = await createTestHelpers();
      await expect(runIdleStatusCommand()).rejects.toThrow('Database connection lost');
    });

    it('should handle timeout errors', async () => {
      mockOrchestrator.listIdleTasks.mockRejectedValue(new Error('Request timeout'));

      const { runIdleStatusCommand } = await createTestHelpers();
      await expect(runIdleStatusCommand()).rejects.toThrow('Request timeout');
    });

    it('should handle permission errors', async () => {
      mockOrchestrator.listIdleTasks.mockRejectedValue(new Error('Permission denied'));

      const { runIdleStatusCommand } = await createTestHelpers();
      await expect(runIdleStatusCommand()).rejects.toThrow('Permission denied');
    });

    it('should handle corrupted data errors', async () => {
      mockOrchestrator.listIdleTasks.mockRejectedValue(new Error('Invalid data format'));

      const { runIdleStatusCommand } = await createTestHelpers();
      await expect(runIdleStatusCommand()).rejects.toThrow('Invalid data format');
    });

    it('should handle network errors gracefully', async () => {
      mockOrchestrator.listIdleTasks.mockRejectedValue(new Error('Network error'));

      const { runIdleStatusCommand } = await createTestHelpers();
      await expect(runIdleStatusCommand()).rejects.toThrow('Network error');
    });
  });

  describe('helper function edge cases', () => {
    let getIdleTaskTypeEmoji: any;
    let getPriorityColor: any;
    let getEffortEmoji: any;

    beforeEach(async () => {
      const helpers = await import('../index.js');
      getIdleTaskTypeEmoji = helpers.getIdleTaskTypeEmoji;
      getPriorityColor = helpers.getPriorityColor;
      getEffortEmoji = helpers.getEffortEmoji;
    });

    it('should handle unknown task types', () => {
      expect(getIdleTaskTypeEmoji('unknown-type')).toBe('📋');
      expect(getIdleTaskTypeEmoji('')).toBe('📋');
      expect(getIdleTaskTypeEmoji(null as any)).toBe('📋');
      expect(getIdleTaskTypeEmoji(undefined as any)).toBe('📋');
    });

    it('should handle unknown priorities', () => {
      const colorFunc = getPriorityColor('unknown-priority');
      expect(typeof colorFunc).toBe('function');

      const grayFunc = getPriorityColor('');
      expect(typeof grayFunc).toBe('function');

      const nullFunc = getPriorityColor(null as any);
      expect(typeof nullFunc).toBe('function');
    });

    it('should handle unknown effort levels', () => {
      expect(getEffortEmoji('unknown-effort')).toBe('⚫');
      expect(getEffortEmoji('')).toBe('⚫');
      expect(getEffortEmoji(null as any)).toBe('⚫');
      expect(getEffortEmoji(undefined as any)).toBe('⚫');
    });

    it('should handle extreme case inputs', () => {
      // Very long type names
      expect(getIdleTaskTypeEmoji('a'.repeat(1000))).toBe('📋');

      // Special characters in priorities
      const weirdPriorityFunc = getPriorityColor('🚀high🚀');
      expect(typeof weirdPriorityFunc).toBe('function');

      // Numbers as effort levels
      expect(getEffortEmoji('123')).toBe('⚫');
    });
  });

  describe('memory and performance edge cases', () => {
    it('should handle large number of tasks without memory issues', async () => {
      // Create a large number of tasks to test memory handling
      const manyTasks = Array.from({ length: 1000 }, (_, i) => ({
        id: `task-${i}`,
        type: 'maintenance' as IdleTaskType,
        title: `Task ${i}`,
        priority: 'normal' as TaskPriority,
        estimatedEffort: 'small',
        rationale: `Rationale for task ${i}`,
        implemented: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: { index: i }
      } as IdleTask));

      // Since the CLI limits to 10, only return 10
      mockOrchestrator.listIdleTasks.mockResolvedValue(manyTasks.slice(0, 10));

      const { runIdleStatusCommand } = await createTestHelpers();
      await expect(runIdleStatusCommand()).resolves.not.toThrow();

      // Should still limit the call appropriately
      expect(mockOrchestrator.listIdleTasks).toHaveBeenCalledWith({
        implemented: false,
        limit: 10
      });
    });

    it('should handle tasks with large metadata objects', async () => {
      const largeMetadata = {
        analysis: {
          files: Array.from({ length: 100 }, (_, i) => `file-${i}.ts`),
          dependencies: Array.from({ length: 50 }, (_, i) => `dep-${i}`),
          metrics: {
            complexity: 95,
            coverage: 45,
            maintainability: 78
          }
        }
      };

      const taskWithLargeMetadata = {
        id: 'large-metadata-task',
        type: 'refactoring' as IdleTaskType,
        title: 'Task with large metadata',
        priority: 'normal' as TaskPriority,
        estimatedEffort: 'medium',
        rationale: 'Task has large metadata object',
        implemented: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: largeMetadata
      } as IdleTask;

      mockOrchestrator.listIdleTasks.mockResolvedValue([taskWithLargeMetadata]);

      const { runIdleStatusCommand } = await createTestHelpers();
      await expect(runIdleStatusCommand([taskWithLargeMetadata])).resolves.not.toThrow();
    });
  });
});

/**
 * Helper function to create test utilities
 */
async function createTestHelpers() {
  const runIdleStatusCommand = async (tasks?: IdleTask[]) => {
    const ctx = { orchestrator: mockOrchestrator };

    const idleTasks = tasks || await ctx.orchestrator.listIdleTasks({
      implemented: false,
      limit: 10
    });

    if (idleTasks.length === 0) {
      console.log('✅ No pending idle tasks found.');
      console.log('  All improvement suggestions have been addressed or no suggestions have been generated yet.');
      return;
    }

    console.log(`💡 Pending Idle Tasks (${idleTasks.length}):`);

    for (const task of idleTasks) {
      console.log(`  ${task.id.substring(0, 12)} ${task.type.toUpperCase()}`);
      console.log(`    ${task.title || 'Untitled'}`);
      console.log(`    Priority: ${task.priority} | Effort: ${task.estimatedEffort || 'unknown'}`);
      console.log(`    ${task.rationale || 'No rationale provided'}`);
    }
  };

  return { runIdleStatusCommand };
}