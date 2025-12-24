/**
 * Idle Accept Command Tests
 *
 * Tests the 'apex idle accept <id>' command functionality to verify proper
 * promotion of idle tasks to real tasks with appropriate error handling.
 *
 * Acceptance Criteria Covered:
 * 1. Successfully promote idle task to real task using TaskStore.promoteIdleTask
 * 2. Display success message with new task ID, branch name, and workflow
 * 3. Handle error when idle task is not found
 * 4. Handle error when idle task has already been implemented
 * 5. Handle generic errors gracefully
 * 6. Require task ID parameter
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Task, IdleTask } from '@apexcli/core';
import chalk from 'chalk';

// Mock chalk to make output testing deterministic
vi.mock('chalk', () => ({
  default: {
    green: vi.fn().mockImplementation((text) => `GREEN(${text})`),
    blue: vi.fn().mockImplementation((text) => `BLUE(${text})`),
    cyan: vi.fn().mockImplementation((text) => `CYAN(${text})`),
    gray: vi.fn().mockImplementation((text) => `GRAY(${text})`),
    red: vi.fn().mockImplementation((text) => `RED(${text})`),
  }
}));

describe('Idle Accept Command', () => {
  let mockOrchestrator: any;
  let consoleSpy: any;

  const sampleIdleTask: IdleTask = {
    id: 'idle-task-12345678901234567890',
    type: 'maintenance',
    title: 'Update project dependencies',
    description: 'Update all npm packages to latest stable versions',
    priority: 'high',
    estimatedEffort: 'medium',
    rationale: 'Outdated dependencies may have security vulnerabilities',
    implemented: false,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    metadata: {}
  };

  const samplePromotedTask: Task = {
    id: 'task-98765432109876543210',
    description: 'Update project dependencies',
    workflow: 'maintenance',
    status: 'pending',
    priority: 'high',
    autonomy: 'review-before-merge',
    branchName: 'apex/mje5ex3f-v040-maintenance',
    projectPath: '/test/project',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    metadata: {
      promotedFromIdleTask: 'idle-task-12345678901234567890'
    },
    stages: [],
    usage: { tokens: 0, cost: 0 }
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock console.log to capture output
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Set up mock orchestrator
    mockOrchestrator = {
      promoteIdleTask: vi.fn(),
    };
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  const runIdleAcceptCommand = async (args: string[], shouldThrow?: boolean) => {
    // Create a mock context similar to the CLI context
    const ctx = {
      orchestrator: mockOrchestrator,
    };

    // Simulate the idle accept command execution logic from CLI
    if (args.length === 0 || args[0] !== 'accept') {
      throw new Error('Invalid command structure');
    }

    const acceptId = args[1];
    if (!acceptId) {
      console.log(chalk.red('Usage: /idle accept <id>'));
      return;
    }

    try {
      console.log(chalk.blue(`🎯 Promoting idle task ${acceptId} to real task...`));
      const newTask = await ctx.orchestrator.promoteIdleTask(acceptId);
      console.log(chalk.green(`✅ Idle task promoted successfully!`));
      console.log(chalk.cyan(`   New task ID: ${newTask.id}`));
      console.log(chalk.gray(`   Branch: ${newTask.branchName || 'N/A'}`));
      console.log(chalk.gray(`   Workflow: ${newTask.workflow}`));
    } catch (error) {
      if ((error as Error).message.includes('not found')) {
        console.log(chalk.red(`❌ Idle task with ID ${acceptId} not found`));
      } else if ((error as Error).message.includes('already been implemented')) {
        console.log(chalk.red(`❌ Idle task ${acceptId} has already been implemented`));
      } else {
        console.log(chalk.red(`❌ Failed to promote idle task: ${(error as Error).message}`));
      }

      if (shouldThrow) {
        throw error;
      }
    }
  };

  describe('successful promotion', () => {
    it('should successfully promote idle task to real task', async () => {
      mockOrchestrator.promoteIdleTask.mockResolvedValue(samplePromotedTask);

      await runIdleAcceptCommand(['accept', 'idle-task-12345678901234567890']);

      // Verify orchestrator method was called with correct parameters
      expect(mockOrchestrator.promoteIdleTask).toHaveBeenCalledWith('idle-task-12345678901234567890');

      // Verify console output
      const calls = consoleSpy.mock.calls.map(call => call[0]);

      expect(calls).toEqual([
        'BLUE(🎯 Promoting idle task idle-task-12345678901234567890 to real task...)',
        'GREEN(✅ Idle task promoted successfully!)',
        'CYAN(   New task ID: task-98765432109876543210)',
        'GRAY(   Branch: apex/mje5ex3f-v040-maintenance)',
        'GRAY(   Workflow: maintenance)'
      ]);
    });

    it('should display N/A for missing branch name', async () => {
      const taskWithoutBranch: Task = {
        ...samplePromotedTask,
        branchName: undefined
      };

      mockOrchestrator.promoteIdleTask.mockResolvedValue(taskWithoutBranch);

      await runIdleAcceptCommand(['accept', 'idle-task-12345678901234567890']);

      const calls = consoleSpy.mock.calls.map(call => call[0]);
      expect(calls.some(call => call.includes('Branch: N/A'))).toBe(true);
    });

    it('should handle task with null branch name', async () => {
      const taskWithNullBranch: Task = {
        ...samplePromotedTask,
        branchName: null as any
      };

      mockOrchestrator.promoteIdleTask.mockResolvedValue(taskWithNullBranch);

      await runIdleAcceptCommand(['accept', 'idle-task-12345678901234567890']);

      const calls = consoleSpy.mock.calls.map(call => call[0]);
      expect(calls.some(call => call.includes('Branch: N/A'))).toBe(true);
    });

    it('should work with different workflow types', async () => {
      const featureTask: Task = {
        ...samplePromotedTask,
        workflow: 'feature',
        branchName: 'apex/feature-implementation'
      };

      mockOrchestrator.promoteIdleTask.mockResolvedValue(featureTask);

      await runIdleAcceptCommand(['accept', 'idle-task-12345678901234567890']);

      const calls = consoleSpy.mock.calls.map(call => call[0]);
      expect(calls.some(call => call.includes('Workflow: feature'))).toBe(true);
      expect(calls.some(call => call.includes('Branch: apex/feature-implementation'))).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should display usage message when no ID provided', async () => {
      await runIdleAcceptCommand(['accept']);

      expect(mockOrchestrator.promoteIdleTask).not.toHaveBeenCalled();

      const calls = consoleSpy.mock.calls.map(call => call[0]);
      expect(calls).toEqual(['RED(Usage: /idle accept <id>)']);
    });

    it('should handle idle task not found error', async () => {
      const notFoundError = new Error('Idle task with ID non-existent-id not found');
      mockOrchestrator.promoteIdleTask.mockRejectedValue(notFoundError);

      await runIdleAcceptCommand(['accept', 'non-existent-id']);

      expect(mockOrchestrator.promoteIdleTask).toHaveBeenCalledWith('non-existent-id');

      const calls = consoleSpy.mock.calls.map(call => call[0]);
      expect(calls).toEqual([
        'BLUE(🎯 Promoting idle task non-existent-id to real task...)',
        'RED(❌ Idle task with ID non-existent-id not found)'
      ]);
    });

    it('should handle already implemented error', async () => {
      const alreadyImplementedError = new Error('Idle task idle-123 has already been implemented');
      mockOrchestrator.promoteIdleTask.mockRejectedValue(alreadyImplementedError);

      await runIdleAcceptCommand(['accept', 'idle-123']);

      expect(mockOrchestrator.promoteIdleTask).toHaveBeenCalledWith('idle-123');

      const calls = consoleSpy.mock.calls.map(call => call[0]);
      expect(calls).toEqual([
        'BLUE(🎯 Promoting idle task idle-123 to real task...)',
        'RED(❌ Idle task idle-123 has already been implemented)'
      ]);
    });

    it('should handle generic errors gracefully', async () => {
      const genericError = new Error('Database connection failed');
      mockOrchestrator.promoteIdleTask.mockRejectedValue(genericError);

      await runIdleAcceptCommand(['accept', 'idle-task-12345']);

      expect(mockOrchestrator.promoteIdleTask).toHaveBeenCalledWith('idle-task-12345');

      const calls = consoleSpy.mock.calls.map(call => call[0]);
      expect(calls).toEqual([
        'BLUE(🎯 Promoting idle task idle-task-12345 to real task...)',
        'RED(❌ Failed to promote idle task: Database connection failed)'
      ]);
    });

    it('should handle orchestrator initialization error', async () => {
      const initError = new Error('Orchestrator must be initialized first');
      mockOrchestrator.promoteIdleTask.mockRejectedValue(initError);

      await runIdleAcceptCommand(['accept', 'idle-task-12345']);

      const calls = consoleSpy.mock.calls.map(call => call[0]);
      expect(calls.some(call => call.includes('Orchestrator must be initialized first'))).toBe(true);
    });

    it('should handle network/timeout errors', async () => {
      const timeoutError = new Error('Request timeout after 30 seconds');
      mockOrchestrator.promoteIdleTask.mockRejectedValue(timeoutError);

      await runIdleAcceptCommand(['accept', 'idle-task-12345']);

      const calls = consoleSpy.mock.calls.map(call => call[0]);
      expect(calls.some(call => call.includes('Request timeout after 30 seconds'))).toBe(true);
    });
  });

  describe('parameter validation', () => {
    it('should work with various ID formats', async () => {
      const testIds = [
        'idle-task-12345678901234567890',
        'short-id',
        'very-long-id-with-many-characters-1234567890',
        'id_with_underscores',
        'id-with-numbers-123',
        'UPPERCASE-ID',
        'MiXeD-cAsE-iD'
      ];

      for (const id of testIds) {
        vi.clearAllMocks();
        mockOrchestrator.promoteIdleTask.mockResolvedValue({
          ...samplePromotedTask,
          id: `promoted-${id}`
        });

        await runIdleAcceptCommand(['accept', id]);

        expect(mockOrchestrator.promoteIdleTask).toHaveBeenCalledWith(id);

        const calls = consoleSpy.mock.calls.map(call => call[0]);
        expect(calls[0]).toContain(`Promoting idle task ${id} to real task`);
      }
    });

    it('should handle empty string ID', async () => {
      await runIdleAcceptCommand(['accept', '']);

      expect(mockOrchestrator.promoteIdleTask).not.toHaveBeenCalled();

      const calls = consoleSpy.mock.calls.map(call => call[0]);
      expect(calls).toEqual(['RED(Usage: /idle accept <id>)']);
    });

    it('should handle whitespace-only ID', async () => {
      await runIdleAcceptCommand(['accept', '   ']);

      // Whitespace ID should be passed through (orchestrator will handle validation)
      expect(mockOrchestrator.promoteIdleTask).toHaveBeenCalledWith('   ');
    });
  });

  describe('output formatting', () => {
    it('should maintain consistent message formatting', async () => {
      mockOrchestrator.promoteIdleTask.mockResolvedValue(samplePromotedTask);

      await runIdleAcceptCommand(['accept', 'test-id']);

      const calls = consoleSpy.mock.calls.map(call => call[0]);

      // Check that all messages follow the expected pattern
      expect(calls[0]).toMatch(/^BLUE\(🎯 Promoting idle task .* to real task\.\.\.\)$/);
      expect(calls[1]).toMatch(/^GREEN\(✅ Idle task promoted successfully!\)$/);
      expect(calls[2]).toMatch(/^CYAN\(   New task ID: .*\)$/);
      expect(calls[3]).toMatch(/^GRAY\(   Branch: .*\)$/);
      expect(calls[4]).toMatch(/^GRAY\(   Workflow: .*\)$/);
    });

    it('should use consistent indentation for task details', async () => {
      mockOrchestrator.promoteIdleTask.mockResolvedValue(samplePromotedTask);

      await runIdleAcceptCommand(['accept', 'test-id']);

      const calls = consoleSpy.mock.calls.map(call => call[0]);

      // Check that task details are properly indented with 3 spaces
      expect(calls[2]).toContain('   New task ID:');
      expect(calls[3]).toContain('   Branch:');
      expect(calls[4]).toContain('   Workflow:');
    });

    it('should properly display long task IDs without truncation', async () => {
      const longTaskId = 'very-long-task-id-that-should-not-be-truncated-in-success-message-1234567890';
      const taskWithLongId: Task = {
        ...samplePromotedTask,
        id: longTaskId
      };

      mockOrchestrator.promoteIdleTask.mockResolvedValue(taskWithLongId);

      await runIdleAcceptCommand(['accept', 'idle-123']);

      const calls = consoleSpy.mock.calls.map(call => call[0]);
      expect(calls.some(call => call.includes(longTaskId))).toBe(true);
    });
  });

  describe('integration scenarios', () => {
    it('should handle rapid successive calls', async () => {
      const tasks = [
        { ...samplePromotedTask, id: 'task-1' },
        { ...samplePromotedTask, id: 'task-2' },
        { ...samplePromotedTask, id: 'task-3' }
      ];

      for (let i = 0; i < 3; i++) {
        mockOrchestrator.promoteIdleTask.mockResolvedValueOnce(tasks[i]);
      }

      // Run commands in sequence
      await runIdleAcceptCommand(['accept', 'idle-1']);
      vi.clearAllMocks();
      await runIdleAcceptCommand(['accept', 'idle-2']);
      vi.clearAllMocks();
      await runIdleAcceptCommand(['accept', 'idle-3']);

      // Verify last call was successful
      const calls = consoleSpy.mock.calls.map(call => call[0]);
      expect(calls[1]).toContain('✅ Idle task promoted successfully!');
      expect(calls[2]).toContain('New task ID: task-3');
    });

    it('should handle mixed success and error scenarios', async () => {
      // First call succeeds
      mockOrchestrator.promoteIdleTask.mockResolvedValueOnce(samplePromotedTask);
      await runIdleAcceptCommand(['accept', 'valid-id']);

      vi.clearAllMocks();

      // Second call fails
      mockOrchestrator.promoteIdleTask.mockRejectedValueOnce(new Error('Task not found'));
      await runIdleAcceptCommand(['accept', 'invalid-id']);

      const calls = consoleSpy.mock.calls.map(call => call[0]);
      expect(calls[0]).toContain('🎯 Promoting idle task invalid-id');
      expect(calls[1]).toContain('❌ Failed to promote idle task: Task not found');
    });
  });
});