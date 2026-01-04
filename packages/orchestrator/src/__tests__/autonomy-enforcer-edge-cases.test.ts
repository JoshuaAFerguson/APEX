/**
 * Edge case tests for AutonomyEnforcer integration with ApexOrchestrator
 * Tests error handling, memory management, extreme configurations, and failure scenarios
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ApexOrchestrator } from '../index.js';
import { AutonomyEnforcer, type AutonomyEnforcerConfig } from '../autonomy-enforcer.js';
import { Task, TaskStatus, AutonomyLevel, AutonomyLimits } from '@apexcli/core';

// Mock dependencies
vi.mock('../store.js', () => {
  const mockTaskStore = {
    getTask: vi.fn(),
    ensureInitialized: vi.fn().mockResolvedValue(undefined),
    initialize: vi.fn().mockResolvedValue(undefined),
  };

  const mockToolActionStore = {
    recordAction: vi.fn(),
  };

  return {
    TaskStore: vi.fn(() => mockTaskStore),
    ToolActionStore: vi.fn(() => mockToolActionStore),
  };
});

vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  AgentSDK: vi.fn(() => ({ query: vi.fn() })),
}));

vi.mock('@apexcli/core', async () => {
  const actual = await vi.importActual<typeof import('@apexcli/core')>('@apexcli/core');
  return {
    ...actual,
    loadConfig: vi.fn().mockResolvedValue({
      autonomy: {
        level: 'review-before-commit' as AutonomyLevel,
        gates: [],
        limits: {
          maxTokensPerTask: 10000,
          maxCostPerTask: 1.00,
          maxTimePerTaskMs: 300000,
        } as AutonomyLimits,
        warningThresholds: {
          costWarningPercent: 80,
          tokenWarningPercent: 80,
          timeWarningPercent: 80,
          fileWarningPercent: 80,
        },
      },
      policy: {},
      scanner: undefined,
      linter: { global: { enabled: false } },
      hooks: [],
      toolHooks: { pre: [], post: [], enabled: false, defaultTimeoutMs: 30000 },
      toolActionRetention: { maxAge: 7 * 24 * 60 * 60 * 1000, maxCount: 1000 },
    }),
    loadAgents: vi.fn().mockResolvedValue({}),
    loadWorkflows: vi.fn().mockResolvedValue({}),
    getEffectiveConfig: vi.fn().mockReturnValue({}),
    generateTaskId: vi.fn().mockReturnValue('test-task-12345678'),
  };
});

vi.mock('fs/promises', () => ({
  access: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
}));

// Mock other required services
['../policy.js', '../workspace-manager.js', '../worktree-manager.js', '../thought-capture.js',
 '../interaction-manager.js', '../permission-store.js', '../permission-manager.js',
 '../permission-preset-manager.js', '../linter.js', '../hook-manager.js', '../idle-processor.js'].forEach(module => {
  vi.mock(module, () => ({
    [module.includes('policy') ? 'createPolicyEnforcer' :
     module.includes('workspace') ? 'WorkspaceManager' :
     module.includes('worktree') ? 'WorktreeManager' :
     module.includes('thought') ? 'ThoughtCaptureManager' :
     module.includes('interaction') ? 'InteractionManager' :
     module.includes('permission-store') ? 'PermissionStore' :
     module.includes('permission-manager') ? 'PermissionManager' :
     module.includes('permission-preset') ? 'PermissionPresetManager' :
     module.includes('linter') ? 'LinterService' :
     module.includes('hook-manager') ? 'HookManager' :
     'IdleProcessor']: vi.fn(() => ({
      initialize: vi.fn().mockResolvedValue(undefined),
      checkPath: vi.fn().mockReturnValue({ allowed: true }),
      checkOperation: vi.fn().mockReturnValue({ allowed: true }),
    })),
  }));
});

const createMockTask = (overrides: Partial<Task> = {}): Task => ({
  id: 'test-task-12345678',
  description: 'Test task',
  status: 'pending' as TaskStatus,
  workflow: 'test-workflow',
  agent: 'test-agent',
  priority: 'medium',
  createdAt: new Date('2023-01-01'),
  updatedAt: new Date('2023-01-01'),
  completedAt: null,
  trashedAt: null,
  archivedAt: null,
  usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150, estimatedCost: 0.01 },
  context: {},
  result: null,
  error: null,
  metadata: {},
  logs: [],
  artifacts: [],
  ...overrides,
});

describe('AutonomyEnforcer Edge Cases', () => {
  let orchestrator: ApexOrchestrator;

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initialization errors', () => {
    it('should handle AutonomyEnforcer constructor throwing error', async () => {
      vi.mocked(AutonomyEnforcer).mockImplementationOnce(() => {
        throw new Error('AutonomyEnforcer initialization failed');
      });

      orchestrator = new ApexOrchestrator({
        projectPath: '/test/path',
        apiKey: 'test-key',
      });

      await expect(orchestrator.initialize()).rejects.toThrow('AutonomyEnforcer initialization failed');
    });

    it('should handle malformed autonomy config', async () => {
      const { loadConfig } = await import('@apexcli/core');
      vi.mocked(loadConfig).mockResolvedValueOnce({
        autonomy: {
          level: 'invalid-level' as any,
          gates: null,
          limits: 'invalid-limits',
          warningThresholds: undefined,
        } as any,
        policy: {},
        scanner: undefined,
        linter: { global: { enabled: false } },
        hooks: [],
        toolHooks: { pre: [], post: [], enabled: false, defaultTimeoutMs: 30000 },
        toolActionRetention: { maxAge: 7 * 24 * 60 * 60 * 1000, maxCount: 1000 },
      });

      orchestrator = new ApexOrchestrator({
        projectPath: '/test/path',
        apiKey: 'test-key',
      });

      // Should handle malformed config gracefully or throw appropriate error
      await expect(orchestrator.initialize()).resolves.not.toThrow();
    });
  });

  describe('extreme configurations', () => {
    beforeEach(async () => {
      orchestrator = new ApexOrchestrator({
        projectPath: '/test/path',
        apiKey: 'test-key',
      });
      await orchestrator.initialize();
    });

    it('should handle extremely large token limits', () => {
      const autonomyEnforcer = (orchestrator as any).autonomyEnforcer;

      autonomyEnforcer.updateConfig({
        limits: {
          maxTokensPerTask: Number.MAX_SAFE_INTEGER,
          maxCostPerTask: Number.MAX_VALUE,
          maxTimePerTaskMs: Number.MAX_SAFE_INTEGER,
        } as any
      });

      const taskId = 'large-limit-test';
      autonomyEnforcer.startTracking(taskId);

      // Test with very large usage values
      autonomyEnforcer.recordUsage(taskId, {
        inputTokens: 1000000,
        outputTokens: 500000,
        totalTokens: 1500000,
        estimatedCost: 1000.0,
      });

      const result = autonomyEnforcer.checkLimits(taskId);
      expect(result.exceeded).toBe(false);
    });

    it('should handle negative values in limits', () => {
      const autonomyEnforcer = (orchestrator as any).autonomyEnforcer;

      autonomyEnforcer.updateConfig({
        limits: {
          maxTokensPerTask: -100,
          maxCostPerTask: -1.0,
          maxTimePerTaskMs: -5000,
        } as any
      });

      const taskId = 'negative-limit-test';
      autonomyEnforcer.startTracking(taskId);
      autonomyEnforcer.recordUsage(taskId, {
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
        estimatedCost: 0.01,
      });

      // Should handle negative limits gracefully
      const result = autonomyEnforcer.checkLimits(taskId);
      expect(result).toBeDefined();
    });

    it('should handle extreme warning threshold values', () => {
      const autonomyEnforcer = (orchestrator as any).autonomyEnforcer;

      autonomyEnforcer.updateConfig({
        warningThresholds: {
          costWarningPercent: 999,
          tokenWarningPercent: -50,
          timeWarningPercent: 0,
          fileWarningPercent: 100.001,
        },
      });

      const taskId = 'threshold-test';
      autonomyEnforcer.startTracking(taskId);

      const usage = {
        inputTokens: 5000,
        outputTokens: 2500,
        totalTokens: 7500,
        estimatedCost: 0.75,
      };

      // Should handle extreme threshold values without crashing
      expect(() => {
        autonomyEnforcer.checkWarningThresholds(taskId, usage);
      }).not.toThrow();
    });
  });

  describe('memory and resource management', () => {
    beforeEach(async () => {
      orchestrator = new ApexOrchestrator({
        projectPath: '/test/path',
        apiKey: 'test-key',
      });
      await orchestrator.initialize();
    });

    it('should handle tracking many concurrent tasks', () => {
      const autonomyEnforcer = (orchestrator as any).autonomyEnforcer;
      const numTasks = 1000;
      const taskIds: string[] = [];

      // Start tracking many tasks
      for (let i = 0; i < numTasks; i++) {
        const taskId = `task-${i}`;
        taskIds.push(taskId);
        autonomyEnforcer.startTracking(taskId);
      }

      // Verify all tasks are tracked
      taskIds.forEach(taskId => {
        expect(autonomyEnforcer.getTaskUsage(taskId)).toBeDefined();
      });

      // Stop tracking all tasks
      taskIds.forEach(taskId => {
        autonomyEnforcer.stopTracking(taskId);
      });

      // Verify all tasks are cleaned up
      taskIds.forEach(taskId => {
        expect(autonomyEnforcer.getTaskUsage(taskId)).toBeUndefined();
      });
    });

    it('should handle repeated start/stop tracking for same task', () => {
      const autonomyEnforcer = (orchestrator as any).autonomyEnforcer;
      const taskId = 'repeat-test';

      // Multiple start/stop cycles
      for (let i = 0; i < 10; i++) {
        autonomyEnforcer.startTracking(taskId);
        expect(autonomyEnforcer.getTaskUsage(taskId)).toBeDefined();

        autonomyEnforcer.stopTracking(taskId);
        expect(autonomyEnforcer.getTaskUsage(taskId)).toBeUndefined();
      }
    });

    it('should handle stopping tracking for non-existent task', () => {
      const autonomyEnforcer = (orchestrator as any).autonomyEnforcer;

      // Should not throw when stopping tracking for non-existent task
      expect(() => {
        autonomyEnforcer.stopTracking('nonexistent-task');
      }).not.toThrow();
    });
  });

  describe('event handling edge cases', () => {
    beforeEach(async () => {
      orchestrator = new ApexOrchestrator({
        projectPath: '/test/path',
        apiKey: 'test-key',
      });
      await orchestrator.initialize();
    });

    it('should handle rapid event emissions', () => {
      const autonomyEnforcer = (orchestrator as any).autonomyEnforcer;
      const task = createMockTask();
      const eventCount = 1000;

      // Rapid task start/stop events
      for (let i = 0; i < eventCount; i++) {
        orchestrator.emit('task:started', { ...task, id: `task-${i}` });
        orchestrator.emit('task:completed', { ...task, id: `task-${i}` });
      }

      // Should handle all events without issues
      expect(true).toBe(true); // Test that no errors were thrown
    });

    it('should handle malformed event data', () => {
      const autonomyEnforcer = (orchestrator as any).autonomyEnforcer;

      // Test with null/undefined task
      expect(() => {
        orchestrator.emit('task:started', null);
        orchestrator.emit('task:completed', undefined);
        orchestrator.emit('task:failed', { id: 'malformed' } as any, new Error('test'));
      }).not.toThrow();

      // Test with malformed usage data
      expect(() => {
        orchestrator.emit('usage:updated', 'test-task', null);
        orchestrator.emit('usage:updated', 'test-task', { invalid: 'data' } as any);
      }).not.toThrow();
    });

    it('should handle event listener errors', () => {
      const autonomyEnforcer = (orchestrator as any).autonomyEnforcer;
      const originalRecordUsage = autonomyEnforcer.recordUsage;

      // Mock recordUsage to throw error
      autonomyEnforcer.recordUsage = vi.fn(() => {
        throw new Error('Usage recording failed');
      });

      const task = createMockTask();
      const usage = { inputTokens: 100, outputTokens: 50, totalTokens: 150, estimatedCost: 0.01 };

      // Should handle errors in event listeners gracefully
      expect(() => {
        orchestrator.emit('usage:updated', task.id, usage);
      }).not.toThrow();

      // Restore original method
      autonomyEnforcer.recordUsage = originalRecordUsage;
    });
  });

  describe('limit checking edge cases', () => {
    beforeEach(async () => {
      orchestrator = new ApexOrchestrator({
        projectPath: '/test/path',
        apiKey: 'test-key',
      });
      await orchestrator.initialize();
    });

    it('should handle concurrent limit checks', () => {
      const autonomyEnforcer = (orchestrator as any).autonomyEnforcer;
      const taskId = 'concurrent-test';

      autonomyEnforcer.startTracking(taskId);

      // Run multiple limit checks concurrently
      const promises = Array.from({ length: 100 }, () =>
        Promise.resolve(autonomyEnforcer.checkLimits(taskId))
      );

      return Promise.all(promises).then(results => {
        // All checks should complete successfully
        expect(results).toHaveLength(100);
        results.forEach(result => {
          expect(result).toHaveProperty('exceeded');
        });
      });
    });

    it('should handle NaN and Infinity in usage values', () => {
      const autonomyEnforcer = (orchestrator as any).autonomyEnforcer;
      const taskId = 'nan-test';

      autonomyEnforcer.startTracking(taskId);
      autonomyEnforcer.recordUsage(taskId, {
        inputTokens: NaN,
        outputTokens: Infinity,
        totalTokens: -Infinity,
        estimatedCost: Number.NaN,
      });

      // Should handle invalid numbers gracefully
      const result = autonomyEnforcer.checkLimits(taskId);
      expect(result).toBeDefined();
    });

    it('should handle floating point precision issues', () => {
      const autonomyEnforcer = (orchestrator as any).autonomyEnforcer;
      const taskId = 'precision-test';

      autonomyEnforcer.updateConfig({
        limits: {
          maxCostPerTask: 1.0,
        } as any
      });

      autonomyEnforcer.startTracking(taskId);

      // Add costs that sum to slightly more than 1.0 due to floating point precision
      autonomyEnforcer.recordUsage(taskId, { estimatedCost: 0.1 });
      autonomyEnforcer.recordUsage(taskId, { estimatedCost: 0.1 });
      autonomyEnforcer.recordUsage(taskId, { estimatedCost: 0.1 });
      autonomyEnforcer.recordUsage(taskId, { estimatedCost: 0.1 });
      autonomyEnforcer.recordUsage(taskId, { estimatedCost: 0.1 });
      autonomyEnforcer.recordUsage(taskId, { estimatedCost: 0.1 });
      autonomyEnforcer.recordUsage(taskId, { estimatedCost: 0.1 });
      autonomyEnforcer.recordUsage(taskId, { estimatedCost: 0.1 });
      autonomyEnforcer.recordUsage(taskId, { estimatedCost: 0.1 });
      autonomyEnforcer.recordUsage(taskId, { estimatedCost: 0.1 });
      autonomyEnforcer.recordUsage(taskId, { estimatedCost: 0.1 });

      const result = autonomyEnforcer.checkLimits(taskId);
      expect(result).toBeDefined();
    });
  });

  describe('approval gate edge cases', () => {
    beforeEach(async () => {
      orchestrator = new ApexOrchestrator({
        projectPath: '/test/path',
        apiKey: 'test-key',
      });
      await orchestrator.initialize();
    });

    it('should handle circular gate dependencies', async () => {
      const autonomyEnforcer = (orchestrator as any).autonomyEnforcer;

      autonomyEnforcer.updateConfig({
        gates: [
          { type: 'before-destructive', description: 'Gate 1', enabled: true },
          { type: 'before-network', description: 'Gate 2', enabled: true },
          { type: 'before-file-write', description: 'Gate 3', enabled: true },
        ],
      });

      const context = {
        task: createMockTask(),
        operationType: 'write' as const,
      };

      // Should handle complex gate configurations without infinite loops
      const result = await autonomyEnforcer.checkApprovalRequired('complex-action', context);
      expect(typeof result).toBe('boolean');
    });

    it('should handle empty action strings', async () => {
      const autonomyEnforcer = (orchestrator as any).autonomyEnforcer;
      const context = { task: createMockTask() };

      const result = await autonomyEnforcer.checkApprovalRequired('', context);
      expect(typeof result).toBe('boolean');
    });

    it('should handle very long action strings', async () => {
      const autonomyEnforcer = (orchestrator as any).autonomyEnforcer;
      const longAction = 'a'.repeat(10000);
      const context = { task: createMockTask() };

      const result = await autonomyEnforcer.checkApprovalRequired(longAction, context);
      expect(typeof result).toBe('boolean');
    });

    it('should handle special characters in action strings', async () => {
      const autonomyEnforcer = (orchestrator as any).autonomyEnforcer;
      const specialAction = '🚀💥🔥git-commit\n\t\\/"\'';
      const context = { task: createMockTask() };

      const result = await autonomyEnforcer.checkApprovalRequired(specialAction, context);
      expect(typeof result).toBe('boolean');
    });
  });

  describe('configuration validation edge cases', () => {
    beforeEach(async () => {
      orchestrator = new ApexOrchestrator({
        projectPath: '/test/path',
        apiKey: 'test-key',
      });
      await orchestrator.initialize();
    });

    it('should handle partial config updates with null values', () => {
      const autonomyEnforcer = (orchestrator as any).autonomyEnforcer;

      expect(() => {
        autonomyEnforcer.updateConfig({
          level: null as any,
          gates: null as any,
          limits: null as any,
          warningThresholds: null as any,
        });
      }).not.toThrow();
    });

    it('should handle config updates with undefined nested properties', () => {
      const autonomyEnforcer = (orchestrator as any).autonomyEnforcer;

      expect(() => {
        autonomyEnforcer.updateConfig({
          limits: {
            maxTokensPerTask: undefined,
            maxCostPerTask: undefined,
          } as any,
        });
      }).not.toThrow();
    });

    it('should handle deeply nested config corruption', () => {
      const autonomyEnforcer = (orchestrator as any).autonomyEnforcer;

      // Corrupt the config object directly
      const corruptedConfig = {
        level: 'review-all' as AutonomyLevel,
        gates: [{ type: 'invalid-gate-type' as any, enabled: 'not-a-boolean' as any }],
        limits: { maxTokensPerTask: 'not-a-number' as any },
        warningThresholds: { tokenWarningPercent: {} as any },
      };

      expect(() => {
        autonomyEnforcer.updateConfig(corruptedConfig);
      }).not.toThrow();
    });
  });

  describe('memory leak prevention', () => {
    beforeEach(async () => {
      orchestrator = new ApexOrchestrator({
        projectPath: '/test/path',
        apiKey: 'test-key',
      });
      await orchestrator.initialize();
    });

    it('should not accumulate event listeners over multiple reconfigurations', () => {
      const autonomyEnforcer = (orchestrator as any).autonomyEnforcer;
      const initialListenerCount = autonomyEnforcer.listenerCount('limit:warning');

      // Multiple config updates should not add listeners
      for (let i = 0; i < 100; i++) {
        autonomyEnforcer.updateConfig({
          warningThresholds: {
            costWarningPercent: 80 + i,
            tokenWarningPercent: 80 + i,
            timeWarningPercent: 80 + i,
            fileWarningPercent: 80 + i,
          },
        });
      }

      const finalListenerCount = autonomyEnforcer.listenerCount('limit:warning');
      expect(finalListenerCount).toBe(initialListenerCount);
    });

    it('should clean up all tracking data on orchestrator shutdown', () => {
      const autonomyEnforcer = (orchestrator as any).autonomyEnforcer;
      const taskIds = ['task1', 'task2', 'task3'];

      // Start tracking multiple tasks
      taskIds.forEach(taskId => {
        autonomyEnforcer.startTracking(taskId);
        autonomyEnforcer.recordUsage(taskId, {
          inputTokens: 100,
          outputTokens: 50,
          totalTokens: 150,
          estimatedCost: 0.01,
        });
      });

      // Simulate orchestrator shutdown by stopping all tracking
      taskIds.forEach(taskId => {
        autonomyEnforcer.stopTracking(taskId);
      });

      // Verify cleanup
      taskIds.forEach(taskId => {
        expect(autonomyEnforcer.getTaskUsage(taskId)).toBeUndefined();
        expect(autonomyEnforcer.getElapsedTime(taskId)).toBeUndefined();
      });
    });
  });
});