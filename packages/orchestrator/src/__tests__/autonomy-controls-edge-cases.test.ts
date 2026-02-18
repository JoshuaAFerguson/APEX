/**
 * Edge case tests for autonomy controls
 *
 * Tests edge cases and recovery scenarios for:
 * - Resource limit tracking and threshold detection
 * - Approval timeout handling and recovery
 * - Limit recovery after violations
 * - Concurrent resource tracking
 * - Memory management and cleanup
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import {
  AutonomyEnforcer,
  type AutonomyEnforcerConfig,
  type LimitCheckResult,
  type WarningResult,
  type TaskContext,
  type ActionMetadata
} from '../autonomy-enforcer.js';
import { ApprovalGateController, type ApprovalGateOptions } from '../approval-gate-controller.js';
import { TaskStore } from '../store.js';
import {
  Task,
  TaskStatus,
  AutonomyLevel,
  TaskUsage,
  ApprovalGate,
  TaskResourceLimits,
} from '@apexcli/core';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

// Mock orchestrator with event emitter capabilities
const createMockOrchestrator = () => {
  const emitter = new EventEmitter();
  return {
    ...emitter,
    on: emitter.on.bind(emitter),
    emit: emitter.emit.bind(emitter),
    store: {
      getTask: vi.fn(),
      addAuditLog: vi.fn().mockResolvedValue(undefined),
      getApprovalStateById: vi.fn(),
      saveApprovalState: vi.fn(),
    },
  };
};

// Helper to create test task
const createTestTask = (overrides: Partial<Task> = {}): Task => ({
  id: `test-task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  description: 'Edge case test task',
  status: 'pending' as TaskStatus,
  workflow: 'edge-case-workflow',
  agent: 'test-agent',
  priority: 'medium',
  createdAt: new Date(),
  updatedAt: new Date(),
  completedAt: null,
  trashedAt: null,
  archivedAt: null,
  usage: {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    estimatedCost: 0,
  },
  context: {},
  result: null,
  error: null,
  metadata: {},
  logs: [],
  artifacts: [],
  ...overrides,
});

describe('Autonomy Controls Edge Cases', () => {
  let testDir: string;
  let store: TaskStore;
  let autonomyEnforcer: AutonomyEnforcer;
  let mockOrchestrator: ReturnType<typeof createMockOrchestrator>;

  beforeEach(async () => {
    // Create temporary directory for test database
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-autonomy-edge-test-'));
    store = new TaskStore(testDir);
    await store.initialize();

    mockOrchestrator = createMockOrchestrator();
    mockOrchestrator.store = store as any;
  });

  afterEach(async () => {
    // Clean up
    if (autonomyEnforcer) {
      // Stop any running timers/trackers
      const taskIds = ['edge-test-1', 'edge-test-2', 'edge-test-3'];
      taskIds.forEach(id => autonomyEnforcer.stopTracking(id));
    }

    // Clean up test directory
    await fs.rm(testDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  describe('Resource Limit Edge Cases', () => {
    beforeEach(() => {
      const config: AutonomyEnforcerConfig = {
        level: 'review-before-commit',
        gates: [],
        limits: {
          maxTokens: 1000,
          maxCost: 1.0,
          maxTimeMs: 5000, // 5 seconds
          maxFiles: 10,
          maxLines: 100,
          maxTurns: 5,
        } as TaskResourceLimits,
        warningThresholds: {
          costWarningPercent: 80,
          tokenWarningPercent: 80,
          timeWarningPercent: 80,
          fileWarningPercent: 80,
        },
      };
      autonomyEnforcer = new AutonomyEnforcer(config, mockOrchestrator as any);
    });

    it('should handle zero and negative usage values gracefully', () => {
      const taskId = 'edge-test-1';
      autonomyEnforcer.startTracking(taskId);

      // Test zero usage
      autonomyEnforcer.recordUsage(taskId, {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        estimatedCost: 0,
      });

      let usage = autonomyEnforcer.getTaskUsage(taskId);
      expect(usage?.totalTokens).toBe(0);
      expect(usage?.estimatedCost).toBe(0);

      // Test negative values (should be handled gracefully)
      autonomyEnforcer.recordUsage(taskId, {
        inputTokens: -10,
        outputTokens: -5,
        totalTokens: -15,
        estimatedCost: -0.01,
      });

      // Should not allow negative accumulation
      usage = autonomyEnforcer.getTaskUsage(taskId);
      expect(usage?.totalTokens).toBeGreaterThanOrEqual(0);
    });

    it('should handle extremely large usage values without overflow', () => {
      const taskId = 'edge-test-2';
      autonomyEnforcer.startTracking(taskId);

      const largeUsage: Partial<TaskUsage> = {
        inputTokens: Number.MAX_SAFE_INTEGER - 1000,
        outputTokens: 500,
        totalTokens: Number.MAX_SAFE_INTEGER - 500,
        estimatedCost: Number.MAX_VALUE / 2,
      };

      expect(() => {
        autonomyEnforcer.recordUsage(taskId, largeUsage);
      }).not.toThrow();

      const usage = autonomyEnforcer.getTaskUsage(taskId);
      expect(usage?.totalTokens).toBeLessThanOrEqual(Number.MAX_SAFE_INTEGER);
    });

    it('should handle rapid successive usage updates', async () => {
      const taskId = 'edge-test-3';
      autonomyEnforcer.startTracking(taskId);

      const eventSpy = vi.fn();
      autonomyEnforcer.on('limit:warning', eventSpy);

      // Rapidly update usage 100 times
      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(
          Promise.resolve().then(() => {
            autonomyEnforcer.recordUsage(taskId, {
              inputTokens: 5,
              outputTokens: 3,
              totalTokens: 8,
              estimatedCost: 0.001,
            });
          })
        );
      }

      await Promise.all(promises);

      // Should have accumulated all updates without data corruption
      const usage = autonomyEnforcer.getTaskUsage(taskId);
      expect(usage?.totalTokens).toBeGreaterThan(0);

      // Should not have excessive warning events
      expect(eventSpy).toHaveBeenCalledTimes(1); // One warning when threshold is crossed
    });

    it('should handle missing or invalid usage objects', () => {
      const taskId = 'edge-test-invalid';
      autonomyEnforcer.startTracking(taskId);

      // Test null usage
      autonomyEnforcer.recordUsage(taskId, null as any);
      expect(autonomyEnforcer.getTaskUsage(taskId)).toBeDefined();

      // Test undefined usage
      autonomyEnforcer.recordUsage(taskId, undefined as any);
      expect(autonomyEnforcer.getTaskUsage(taskId)).toBeDefined();

      // Test invalid usage object
      autonomyEnforcer.recordUsage(taskId, "invalid" as any);
      expect(autonomyEnforcer.getTaskUsage(taskId)).toBeDefined();

      // Test partial usage object
      autonomyEnforcer.recordUsage(taskId, { invalidField: 123 } as any);
      expect(autonomyEnforcer.getTaskUsage(taskId)).toBeDefined();
    });

    it('should properly clean up memory when tracking many tasks', () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Create and clean up 1000 tasks
      for (let i = 0; i < 1000; i++) {
        const taskId = `memory-test-${i}`;
        autonomyEnforcer.startTracking(taskId);
        autonomyEnforcer.recordUsage(taskId, {
          inputTokens: 100,
          outputTokens: 50,
          totalTokens: 150,
          estimatedCost: 0.01,
        });
        autonomyEnforcer.stopTracking(taskId);
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 10MB for 1000 tasks)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });

    it('should handle concurrent limit checks without race conditions', async () => {
      const taskId = 'concurrent-test';
      autonomyEnforcer.startTracking(taskId);

      // Record usage that exceeds limits
      autonomyEnforcer.recordUsage(taskId, {
        inputTokens: 800,
        outputTokens: 300,
        totalTokens: 1100, // Exceeds 1000 limit
        estimatedCost: 0.8,
      });

      // Check limits concurrently from multiple threads
      const promises = Array(20).fill(0).map(() =>
        Promise.resolve().then(() => autonomyEnforcer.checkLimits(taskId))
      );

      const results = await Promise.all(promises);

      // All results should be consistent
      results.forEach(result => {
        expect(result.exceeded).toBe(true);
        expect(result.limitType).toBe('tokens');
      });
    });

    it('should handle time limit calculations accurately', () => {
      const taskId = 'time-test';
      const startTime = Date.now();

      // Mock Date.now to control time progression
      vi.spyOn(Date, 'now')
        .mockReturnValueOnce(startTime) // Start tracking
        .mockReturnValueOnce(startTime + 3000) // First check (3s)
        .mockReturnValueOnce(startTime + 6000); // Second check (6s, exceeds 5s limit)

      autonomyEnforcer.startTracking(taskId);

      // First check - within limits
      let result = autonomyEnforcer.checkLimits(taskId);
      expect(result.exceeded).toBe(false);

      // Second check - exceeds time limit
      result = autonomyEnforcer.checkLimits(taskId);
      expect(result.exceeded).toBe(true);
      expect(result.limitType).toBe('time');
      expect(result.currentValue).toBe(6000);
      expect(result.limitValue).toBe(5000);

      vi.restoreAllMocks();
    });
  });

  describe('Approval Timeout Edge Cases', () => {
    let controller: ApprovalGateController;

    const createGateOptions = (timeout?: number): ApprovalGateOptions => ({
      config: {
        id: 'test-gate',
        type: 'before-commit',
        name: 'Test Gate',
        description: 'Edge case test gate',
        required: true,
        timeout,
        autoApprove: false,
        autoApproveOnTimeout: false,
        minApprovals: 1,
        tags: ['test'],
      },
      taskId: 'timeout-test-task',
      stage: 'implementation',
      agent: 'developer',
      store,
      parentEmitter: mockOrchestrator,
      context: {
        workflowName: 'edge-case',
        stageDescription: 'Timeout edge case test',
      },
    });

    afterEach(() => {
      if (controller) {
        controller.dispose();
      }
    });

    it('should handle extremely short timeouts without race conditions', async () => {
      controller = new ApprovalGateController(createGateOptions(0.001)); // 0.6ms

      const timeoutSpy = vi.fn();
      controller.on('approval:timeout', timeoutSpy);

      const result = await controller.requestApproval();

      expect(result.status).toBe('denied');
      expect(result.approver).toBe('system');
      expect(timeoutSpy).toHaveBeenCalledOnce();
    }, 1000);

    it('should handle approval race with timeout', async () => {
      controller = new ApprovalGateController({
        ...createGateOptions(0.05), // 30ms
        config: {
          ...createGateOptions(0.05).config,
          autoApproveOnTimeout: true,
        },
      });

      const approvalPromise = controller.requestApproval();

      // Race approval with timeout
      setTimeout(async () => {
        try {
          await controller.grant('race-user', 'Racing with timeout');
        } catch (error) {
          // May fail if timeout already occurred - that's ok
        }
      }, 25); // Try to grant before 30ms timeout

      const result = await approvalPromise;

      // Should either be approved by user or system (auto-approve on timeout)
      expect(result.status).toBe('approved');
      expect(['race-user', 'system']).toContain(result.approver);
    }, 1000);

    it('should handle multiple timeout scenarios simultaneously', async () => {
      const controllers = Array(5).fill(0).map((_, i) =>
        new ApprovalGateController({
          ...createGateOptions(0.01 + i * 0.01), // Staggered timeouts
          config: {
            ...createGateOptions().config,
            id: `multi-gate-${i}`,
            autoApproveOnTimeout: i % 2 === 0, // Alternate auto-approve
          },
        })
      );

      const promises = controllers.map(ctrl => ctrl.requestApproval());
      const results = await Promise.all(promises);

      // Clean up
      controllers.forEach(ctrl => ctrl.dispose());

      // All should have completed
      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(['approved', 'denied']).toContain(result.status);
      });
    }, 2000);

    it('should handle cleanup when approval is cancelled during timeout', async () => {
      controller = new ApprovalGateController(createGateOptions(0.1)); // 60ms

      const approvalPromise = controller.requestApproval();

      // Cancel after 30ms (before timeout)
      setTimeout(() => {
        controller.cancel();
      }, 30);

      await expect(approvalPromise).rejects.toThrow('Approval was cancelled');

      expect(controller.isResolved).toBe(true);
      expect(controller.approvalState.status).toBe('denied');
    }, 1000);

    it('should handle system clock changes gracefully', async () => {
      controller = new ApprovalGateController(createGateOptions(0.1)); // 60ms

      const originalNow = Date.now;
      let callCount = 0;

      // Mock Date.now to simulate clock jump
      vi.spyOn(Date, 'now').mockImplementation(() => {
        callCount++;
        if (callCount === 1) return originalNow();
        if (callCount === 2) return originalNow() - 10000; // Clock jump backwards
        return originalNow() + 1000; // Jump forward
      });

      const result = await controller.requestApproval();

      // Should handle clock changes gracefully and still timeout
      expect(result.status).toBe('denied');
      expect(result.approver).toBe('system');

      vi.restoreAllMocks();
    }, 1000);
  });

  describe('Limit Recovery Edge Cases', () => {
    beforeEach(() => {
      const config: AutonomyEnforcerConfig = {
        level: 'review-before-commit',
        gates: [],
        limits: {
          maxTokens: 1000,
          maxCost: 1.0,
          maxTimeMs: 5000,
        } as TaskResourceLimits,
        warningThresholds: {
          costWarningPercent: 80,
          tokenWarningPercent: 80,
          timeWarningPercent: 80,
          fileWarningPercent: 80,
        },
      };
      autonomyEnforcer = new AutonomyEnforcer(config, mockOrchestrator as any);
    });

    it('should allow recovery after limit exceeded through config update', () => {
      const taskId = 'recovery-test';
      autonomyEnforcer.startTracking(taskId);

      // Exceed limits
      autonomyEnforcer.recordUsage(taskId, {
        inputTokens: 800,
        outputTokens: 300,
        totalTokens: 1100, // Exceeds 1000 limit
        estimatedCost: 0.5,
      });

      let result = autonomyEnforcer.checkLimits(taskId);
      expect(result.exceeded).toBe(true);

      // Update config to increase limits
      autonomyEnforcer.updateConfig({
        limits: {
          maxTokens: 2000,
          maxCost: 2.0,
          maxTimeMs: 10000,
        } as TaskResourceLimits,
      });

      // Should now be within limits
      result = autonomyEnforcer.checkLimits(taskId);
      expect(result.exceeded).toBe(false);
    });

    it('should handle recovery when task usage is reset', () => {
      const taskId = 'reset-test';
      autonomyEnforcer.startTracking(taskId);

      // Exceed limits
      autonomyEnforcer.recordUsage(taskId, {
        inputTokens: 800,
        outputTokens: 300,
        totalTokens: 1100,
        estimatedCost: 1.5, // Exceeds 1.0 limit
      });

      let result = autonomyEnforcer.checkLimits(taskId);
      expect(result.exceeded).toBe(true);
      expect(result.limitType).toBe('tokens');

      // Simulate task reset by stopping and restarting tracking
      autonomyEnforcer.stopTracking(taskId);
      autonomyEnforcer.startTracking(taskId);

      // Should be within limits again
      result = autonomyEnforcer.checkLimits(taskId);
      expect(result.exceeded).toBe(false);
    });

    it('should handle partial limit recovery scenarios', () => {
      const taskId = 'partial-recovery-test';
      autonomyEnforcer.startTracking(taskId);

      // Exceed multiple limits
      autonomyEnforcer.recordUsage(taskId, {
        inputTokens: 800,
        outputTokens: 300,
        totalTokens: 1100, // Exceeds 1000 token limit
        estimatedCost: 1.5, // Exceeds 1.0 cost limit
      });

      let result = autonomyEnforcer.checkLimits(taskId);
      expect(result.exceeded).toBe(true);
      expect(result.limitType).toBe('tokens'); // First limit checked

      // Update config to only fix token limit
      autonomyEnforcer.updateConfig({
        limits: {
          maxTokens: 2000, // Increased
          maxCost: 1.0, // Still exceeded
          maxTimeMs: 5000,
        } as TaskResourceLimits,
      });

      // Should still be exceeded due to cost limit
      result = autonomyEnforcer.checkLimits(taskId);
      expect(result.exceeded).toBe(true);
      expect(result.limitType).toBe('cost');
    });

    it('should handle warning threshold recovery', () => {
      const taskId = 'warning-recovery-test';
      autonomyEnforcer.startTracking(taskId);

      const warningSpy = vi.fn();
      autonomyEnforcer.on('limit:warning', warningSpy);

      // Exceed warning threshold
      autonomyEnforcer.recordUsage(taskId, {
        inputTokens: 700,
        outputTokens: 150,
        totalTokens: 850, // 85% of 1000, exceeds 80% warning
        estimatedCost: 0.5,
      });

      expect(warningSpy).toHaveBeenCalledOnce();

      // Update thresholds to be higher
      autonomyEnforcer.updateConfig({
        warningThresholds: {
          costWarningPercent: 95,
          tokenWarningPercent: 95,
          timeWarningPercent: 95,
          fileWarningPercent: 95,
        },
      });

      warningSpy.mockClear();

      // Record more usage that would have triggered warning before
      autonomyEnforcer.recordUsage(taskId, {
        inputTokens: 50,
        outputTokens: 25,
        totalTokens: 75,
        estimatedCost: 0.05,
      });

      // Should not trigger warning with new threshold
      expect(warningSpy).not.toHaveBeenCalled();
    });
  });

  describe('Concurrent Operations Edge Cases', () => {
    beforeEach(() => {
      const config: AutonomyEnforcerConfig = {
        level: 'review-before-commit',
        gates: [],
        limits: {
          maxTokens: 1000,
          maxCost: 1.0,
          maxTimeMs: 5000,
        } as TaskResourceLimits,
        warningThresholds: {
          costWarningPercent: 80,
          tokenWarningPercent: 80,
          timeWarningPercent: 80,
          fileWarningPercent: 80,
        },
      };
      autonomyEnforcer = new AutonomyEnforcer(config, mockOrchestrator as any);
    });

    it('should handle concurrent tracking start/stop operations', async () => {
      const taskIds = Array(50).fill(0).map((_, i) => `concurrent-${i}`);

      // Start all tasks concurrently
      const startPromises = taskIds.map(id =>
        Promise.resolve().then(() => autonomyEnforcer.startTracking(id))
      );
      await Promise.all(startPromises);

      // Verify all tasks are tracked
      taskIds.forEach(id => {
        expect(autonomyEnforcer.getTaskUsage(id)).toBeDefined();
      });

      // Stop all tasks concurrently
      const stopPromises = taskIds.map(id =>
        Promise.resolve().then(() => autonomyEnforcer.stopTracking(id))
      );
      await Promise.all(stopPromises);

      // Verify all tasks are no longer tracked
      taskIds.forEach(id => {
        expect(autonomyEnforcer.getTaskUsage(id)).toBeUndefined();
      });
    });

    it('should handle concurrent config updates', async () => {
      const taskId = 'config-concurrent-test';
      autonomyEnforcer.startTracking(taskId);

      // Update config concurrently from multiple contexts
      const configPromises = Array(20).fill(0).map((_, i) =>
        Promise.resolve().then(() => {
          autonomyEnforcer.updateConfig({
            limits: {
              maxTokens: 1000 + i * 100,
              maxCost: 1.0 + i * 0.1,
              maxTimeMs: 5000 + i * 1000,
            } as TaskResourceLimits,
          });
        })
      );

      await Promise.all(configPromises);

      // Config should be in a valid state
      const result = autonomyEnforcer.checkLimits(taskId);
      expect(result).toBeDefined();
      expect(typeof result.exceeded).toBe('boolean');
    });

    it('should handle orchestrator event emission during operations', async () => {
      const task = createTestTask({ id: 'event-test' });

      // Get event handlers from the enforcer setup
      const handlers = mockOrchestrator.listeners('task:started');
      expect(handlers.length).toBeGreaterThan(0);

      // Emit events concurrently
      const eventPromises = Array(10).fill(0).map(() =>
        Promise.resolve().then(() => {
          mockOrchestrator.emit('task:started', task);
          mockOrchestrator.emit('usage:updated', task.id, {
            inputTokens: 10,
            outputTokens: 5,
            totalTokens: 15,
            estimatedCost: 0.001,
          });
        })
      );

      await Promise.all(eventPromises);

      // Should handle all events without corruption
      const usage = autonomyEnforcer.getTaskUsage(task.id);
      expect(usage).toBeDefined();
      expect(usage!.totalTokens).toBeGreaterThan(0);
    });
  });
});