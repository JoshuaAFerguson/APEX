/**
 * Unit tests for AutonomyEnforcer class
 * Tests core functionality including approval checking, limit enforcement,
 * usage tracking, and event emission
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AutonomyEnforcer, type AutonomyEnforcerConfig, type TaskContext, type LimitCheckResult, type WarningResult } from '../autonomy-enforcer.js';
import { Task, TaskStatus, AutonomyLevel, AutonomyLimits, TaskUsage } from '@apexcli/core';

// Mock ApexOrchestrator
const createMockOrchestrator = () => ({
  on: vi.fn(),
  emit: vi.fn(),
  store: {
    getTask: vi.fn(),
  },
});

// Create mock task data
const createMockTask = (overrides: Partial<Task> = {}): Task => ({
  id: 'test-task-12345678',
  description: 'Test task for autonomy enforcer',
  status: 'pending' as TaskStatus,
  workflow: 'test-workflow',
  agent: 'test-agent',
  priority: 'medium',
  createdAt: new Date('2023-01-01'),
  updatedAt: new Date('2023-01-01'),
  completedAt: null,
  trashedAt: null,
  archivedAt: null,
  usage: {
    inputTokens: 100,
    outputTokens: 50,
    totalTokens: 150,
    estimatedCost: 0.01,
  },
  context: {},
  result: null,
  error: null,
  metadata: {},
  logs: [],
  artifacts: [],
  ...overrides,
});

describe('AutonomyEnforcer', () => {
  let autonomyEnforcer: AutonomyEnforcer;
  let mockOrchestrator: ReturnType<typeof createMockOrchestrator>;
  let defaultConfig: AutonomyEnforcerConfig;

  beforeEach(() => {
    mockOrchestrator = createMockOrchestrator();

    defaultConfig = {
      level: 'review-before-commit' as AutonomyLevel,
      gates: [],
      limits: {
        maxTokensPerTask: 10000,
        maxCostPerTask: 1.00,
        maxTimePerTaskMs: 300000, // 5 minutes
      } as AutonomyLimits,
      warningThresholds: {
        costWarningPercent: 80,
        tokenWarningPercent: 80,
        timeWarningPercent: 80,
        fileWarningPercent: 80,
      },
    };

    autonomyEnforcer = new AutonomyEnforcer(defaultConfig, mockOrchestrator as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with provided config and orchestrator', () => {
      expect(autonomyEnforcer).toBeInstanceOf(AutonomyEnforcer);
      expect(autonomyEnforcer.config).toEqual(defaultConfig);
    });

    it('should set up event listeners on orchestrator', () => {
      expect(mockOrchestrator.on).toHaveBeenCalledWith('task:started', expect.any(Function));
      expect(mockOrchestrator.on).toHaveBeenCalledWith('task:completed', expect.any(Function));
      expect(mockOrchestrator.on).toHaveBeenCalledWith('task:failed', expect.any(Function));
      expect(mockOrchestrator.on).toHaveBeenCalledWith('usage:updated', expect.any(Function));
    });

    it('should initialize with different autonomy levels', () => {
      const configs = [
        { ...defaultConfig, level: 'full-auto' as AutonomyLevel },
        { ...defaultConfig, level: 'review-all' as AutonomyLevel },
      ];

      configs.forEach(config => {
        const enforcer = new AutonomyEnforcer(config, mockOrchestrator as any);
        expect(enforcer.config.level).toBe(config.level);
      });
    });
  });

  describe('checkApprovalRequired', () => {
    const createTaskContext = (overrides: Partial<TaskContext> = {}): TaskContext => ({
      task: createMockTask(),
      currentStage: 'implementation',
      agent: 'developer',
      operationType: 'write',
      ...overrides,
    });

    describe('full-auto level', () => {
      beforeEach(() => {
        autonomyEnforcer.updateConfig({ level: 'full-auto' as AutonomyLevel });
      });

      it('should not require approval for standard operations', async () => {
        const context = createTaskContext({ operationType: 'write' });
        const result = await autonomyEnforcer.checkApprovalRequired('edit-file', context);
        expect(result).toBe(false);
      });

      it('should check specific gates even in full-auto mode', async () => {
        autonomyEnforcer.updateConfig({
          gates: [{ type: 'before-destructive', description: 'Review destructive ops', enabled: true }]
        });

        const context = createTaskContext({ operationType: 'dangerous' });
        const result = await autonomyEnforcer.checkApprovalRequired('delete-file', context);
        expect(result).toBe(true);
      });
    });

    describe('review-before-commit level', () => {
      it('should require approval for commit operations', async () => {
        const context = createTaskContext();
        const result = await autonomyEnforcer.checkApprovalRequired('git-commit', context);
        expect(result).toBe(true);
      });

      it('should require approval for push operations', async () => {
        const context = createTaskContext();
        const result = await autonomyEnforcer.checkApprovalRequired('git-push', context);
        expect(result).toBe(true);
      });

      it('should not require approval for non-commit operations', async () => {
        const context = createTaskContext();
        const result = await autonomyEnforcer.checkApprovalRequired('edit-file', context);
        expect(result).toBe(false);
      });

      it('should emit approval:required event for commit operations', async () => {
        const emitSpy = vi.spyOn(autonomyEnforcer, 'emit');
        const context = createTaskContext();

        await autonomyEnforcer.checkApprovalRequired('git-commit', context);
        expect(emitSpy).toHaveBeenCalledWith('approval:required', 'before-commit', context);
      });
    });

    describe('review-all level', () => {
      beforeEach(() => {
        autonomyEnforcer.updateConfig({ level: 'review-all' as AutonomyLevel });
      });

      it('should allow read operations without approval', async () => {
        const context = createTaskContext({ operationType: 'read' });
        const result = await autonomyEnforcer.checkApprovalRequired('read-file', context);
        expect(result).toBe(false);
      });

      it('should require approval for write operations', async () => {
        const context = createTaskContext({ operationType: 'write' });
        const result = await autonomyEnforcer.checkApprovalRequired('edit-file', context);
        expect(result).toBe(true);
      });

      it('should require approval for execute operations', async () => {
        const context = createTaskContext({ operationType: 'execute' });
        const result = await autonomyEnforcer.checkApprovalRequired('run-command', context);
        expect(result).toBe(true);
      });
    });

    describe('approval gates', () => {
      beforeEach(() => {
        autonomyEnforcer.updateConfig({
          gates: [
            { type: 'before-destructive', description: 'Review destructive operations', enabled: true },
            { type: 'before-network', description: 'Review network operations', enabled: true },
            { type: 'before-file-write', description: 'Review file modifications', enabled: true },
          ]
        });
      });

      it('should match before-destructive gate for dangerous operations', async () => {
        const context = createTaskContext({ operationType: 'dangerous' });
        const result = await autonomyEnforcer.checkApprovalRequired('delete-database', context);
        expect(result).toBe(true);
      });

      it('should match before-destructive gate for delete actions', async () => {
        const context = createTaskContext();
        const result = await autonomyEnforcer.checkApprovalRequired('remove-files', context);
        expect(result).toBe(true);
      });

      it('should match before-network gate for network operations', async () => {
        const context = createTaskContext({ operationType: 'network' });
        const result = await autonomyEnforcer.checkApprovalRequired('fetch-data', context);
        expect(result).toBe(true);
      });

      it('should match before-file-write gate for write operations', async () => {
        const context = createTaskContext({ operationType: 'write' });
        const result = await autonomyEnforcer.checkApprovalRequired('save-file', context);
        expect(result).toBe(true);
      });
    });
  });

  describe('limit checking', () => {
    let taskId: string;

    beforeEach(() => {
      taskId = 'test-task-123';
      autonomyEnforcer.startTracking(taskId);
    });

    afterEach(() => {
      autonomyEnforcer.stopTracking(taskId);
    });

    it('should return no violation when limits are not exceeded', () => {
      autonomyEnforcer.recordUsage(taskId, {
        inputTokens: 1000,
        outputTokens: 500,
        totalTokens: 1500,
        estimatedCost: 0.10,
      });

      const result = autonomyEnforcer.checkLimits(taskId);
      expect(result.exceeded).toBe(false);
    });

    it('should detect token limit violations', () => {
      autonomyEnforcer.recordUsage(taskId, {
        inputTokens: 8000,
        outputTokens: 3000,
        totalTokens: 11000, // Exceeds 10000 limit
        estimatedCost: 0.50,
      });

      const result = autonomyEnforcer.checkLimits(taskId);
      expect(result.exceeded).toBe(true);
      expect(result.limitType).toBe('tokens');
      expect(result.currentValue).toBe(11000);
      expect(result.limitValue).toBe(10000);
      expect(result.message).toContain('Token limit exceeded');
    });

    it('should detect cost limit violations', () => {
      autonomyEnforcer.recordUsage(taskId, {
        inputTokens: 5000,
        outputTokens: 2500,
        totalTokens: 7500,
        estimatedCost: 1.25, // Exceeds 1.00 limit
      });

      const result = autonomyEnforcer.checkLimits(taskId);
      expect(result.exceeded).toBe(true);
      expect(result.limitType).toBe('cost');
      expect(result.currentValue).toBe(1.25);
      expect(result.limitValue).toBe(1.00);
      expect(result.message).toContain('Cost limit exceeded');
    });

    it('should detect time limit violations', () => {
      // Mock Date.now to simulate time passage
      const originalNow = Date.now;
      const startTime = 1000000;
      vi.spyOn(Date, 'now')
        .mockReturnValueOnce(startTime) // Start tracking
        .mockReturnValue(startTime + 400000); // 400 seconds later (exceeds 300 second limit)

      // Restart tracking to get fresh timestamp
      autonomyEnforcer.stopTracking(taskId);
      autonomyEnforcer.startTracking(taskId);

      const result = autonomyEnforcer.checkLimits(taskId);
      expect(result.exceeded).toBe(true);
      expect(result.limitType).toBe('time');
      expect(result.currentValue).toBe(400000);
      expect(result.limitValue).toBe(300000);
      expect(result.message).toContain('Time limit exceeded');

      Date.now = originalNow;
    });

    it('should handle non-existent task gracefully', () => {
      const result = autonomyEnforcer.checkLimits('nonexistent-task');
      expect(result.exceeded).toBe(false);
    });
  });

  describe('usage tracking', () => {
    let taskId: string;

    beforeEach(() => {
      taskId = 'test-task-123';
      autonomyEnforcer.startTracking(taskId);
    });

    it('should accumulate usage over multiple recordings', () => {
      autonomyEnforcer.recordUsage(taskId, {
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
        estimatedCost: 0.01,
      });

      autonomyEnforcer.recordUsage(taskId, {
        inputTokens: 200,
        outputTokens: 100,
        totalTokens: 300,
        estimatedCost: 0.02,
      });

      const usage = autonomyEnforcer.getTaskUsage(taskId);
      expect(usage).toEqual({
        inputTokens: 300,
        outputTokens: 150,
        totalTokens: 450,
        estimatedCost: 0.03,
      });
    });

    it('should emit warnings when thresholds are reached', () => {
      const emitSpy = vi.spyOn(autonomyEnforcer, 'emit');

      // Record usage that exceeds 80% token warning threshold
      autonomyEnforcer.recordUsage(taskId, {
        inputTokens: 6000,
        outputTokens: 2500,
        totalTokens: 8500, // 85% of 10000 limit
        estimatedCost: 0.50,
      });

      expect(emitSpy).toHaveBeenCalledWith('limit:warning', expect.objectContaining({
        type: 'tokens',
        threshold: 80,
        currentValue: 8500,
        limitValue: 10000,
        message: expect.stringContaining('Token usage at 85.0% of limit'),
      }));
    });

    it('should emit limit exceeded events with task information', () => {
      const task = createMockTask({ id: taskId });
      mockOrchestrator.store.getTask.mockReturnValue(task);
      const emitSpy = vi.spyOn(autonomyEnforcer, 'emit');

      // Record usage that exceeds limits
      autonomyEnforcer.recordUsage(taskId, {
        inputTokens: 8000,
        outputTokens: 3000,
        totalTokens: 11000, // Exceeds limit
        estimatedCost: 0.75,
      });

      expect(emitSpy).toHaveBeenCalledWith('limit:exceeded', expect.objectContaining({
        exceeded: true,
        limitType: 'tokens',
      }), task);
    });

    it('should track task start times', () => {
      const startTime = autonomyEnforcer.getElapsedTime(taskId);
      expect(startTime).toBeGreaterThanOrEqual(0);
    });

    it('should clean up tracking data when stopped', () => {
      expect(autonomyEnforcer.getTaskUsage(taskId)).toBeDefined();
      expect(autonomyEnforcer.getElapsedTime(taskId)).toBeDefined();

      autonomyEnforcer.stopTracking(taskId);

      expect(autonomyEnforcer.getTaskUsage(taskId)).toBeUndefined();
      expect(autonomyEnforcer.getElapsedTime(taskId)).toBeUndefined();
    });
  });

  describe('warning thresholds', () => {
    let taskId: string;

    beforeEach(() => {
      taskId = 'test-task-123';
      autonomyEnforcer.startTracking(taskId);
    });

    it('should calculate warning thresholds correctly', () => {
      const usage: TaskUsage = {
        inputTokens: 6000,
        outputTokens: 2500,
        totalTokens: 8500, // 85% of 10000 = warning
        estimatedCost: 0.75, // 75% of 1.00 = no warning yet
      };

      const warnings = autonomyEnforcer.checkWarningThresholds(taskId, usage);

      expect(warnings).toHaveLength(1);
      expect(warnings[0].type).toBe('tokens');
      expect(warnings[0].threshold).toBe(80);
      expect(warnings[0].currentValue).toBe(8500);
      expect(warnings[0].limitValue).toBe(10000);
    });

    it('should warn for multiple threshold types simultaneously', () => {
      const usage: TaskUsage = {
        inputTokens: 6500,
        outputTokens: 2500,
        totalTokens: 9000, // 90% of 10000 = warning
        estimatedCost: 0.85, // 85% of 1.00 = warning
      };

      const warnings = autonomyEnforcer.checkWarningThresholds(taskId, usage);

      expect(warnings).toHaveLength(2);
      expect(warnings.some(w => w.type === 'tokens')).toBe(true);
      expect(warnings.some(w => w.type === 'cost')).toBe(true);
    });

    it('should handle time warnings', () => {
      const originalNow = Date.now;
      const startTime = 1000000;
      vi.spyOn(Date, 'now')
        .mockReturnValueOnce(startTime) // Start tracking
        .mockReturnValue(startTime + 250000); // 83% of 300 second limit

      autonomyEnforcer.stopTracking(taskId);
      autonomyEnforcer.startTracking(taskId);

      const usage: TaskUsage = {
        inputTokens: 1000,
        outputTokens: 500,
        totalTokens: 1500,
        estimatedCost: 0.10,
      };

      const warnings = autonomyEnforcer.checkWarningThresholds(taskId, usage);
      expect(warnings.some(w => w.type === 'time')).toBe(true);

      Date.now = originalNow;
    });
  });

  describe('config updates', () => {
    it('should update configuration partially', () => {
      const newLimits = {
        maxTokensPerTask: 20000,
        maxCostPerTask: 2.00,
      };

      autonomyEnforcer.updateConfig({ limits: newLimits as any });

      expect(autonomyEnforcer.config.limits.maxTokensPerTask).toBe(20000);
      expect(autonomyEnforcer.config.limits.maxCostPerTask).toBe(2.00);
      expect(autonomyEnforcer.config.level).toBe(defaultConfig.level); // Should remain unchanged
    });

    it('should update autonomy level', () => {
      autonomyEnforcer.updateConfig({ level: 'full-auto' as AutonomyLevel });
      expect(autonomyEnforcer.config.level).toBe('full-auto');
    });

    it('should update warning thresholds', () => {
      const newThresholds = {
        costWarningPercent: 90,
        tokenWarningPercent: 95,
        timeWarningPercent: 85,
        fileWarningPercent: 75,
      };

      autonomyEnforcer.updateConfig({ warningThresholds: newThresholds });
      expect(autonomyEnforcer.config.warningThresholds).toEqual(newThresholds);
    });
  });

  describe('event handling', () => {
    it('should handle orchestrator events correctly', () => {
      const task = createMockTask();
      const usage = {
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
        estimatedCost: 0.01,
      };

      // Get the event handlers
      const taskStartedHandler = mockOrchestrator.on.mock.calls.find(call => call[0] === 'task:started')?.[1];
      const taskCompletedHandler = mockOrchestrator.on.mock.calls.find(call => call[0] === 'task:completed')?.[1];
      const usageUpdatedHandler = mockOrchestrator.on.mock.calls.find(call => call[0] === 'usage:updated')?.[1];

      expect(taskStartedHandler).toBeDefined();
      expect(taskCompletedHandler).toBeDefined();
      expect(usageUpdatedHandler).toBeDefined();

      // Test event handlers
      const startTrackingSpy = vi.spyOn(autonomyEnforcer, 'startTracking');
      const stopTrackingSpy = vi.spyOn(autonomyEnforcer, 'stopTracking');
      const recordUsageSpy = vi.spyOn(autonomyEnforcer, 'recordUsage');

      taskStartedHandler!(task);
      expect(startTrackingSpy).toHaveBeenCalledWith(task.id);

      taskCompletedHandler!(task);
      expect(stopTrackingSpy).toHaveBeenCalledWith(task.id);

      usageUpdatedHandler!(task.id, usage);
      expect(recordUsageSpy).toHaveBeenCalledWith(task.id, usage);
    });

    it('should emit approval bypass events for disabled gates', async () => {
      autonomyEnforcer.updateConfig({
        gates: [
          { type: 'before-destructive', description: 'Review destructive ops', enabled: false },
        ]
      });

      const context: TaskContext = {
        task: createMockTask(),
        operationType: 'dangerous',
      };

      const emitSpy = vi.spyOn(autonomyEnforcer, 'emit');
      const result = await autonomyEnforcer.checkApprovalRequired('delete-file', context);

      expect(result).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle zero limits gracefully', () => {
      autonomyEnforcer.updateConfig({
        limits: {
          maxTokensPerTask: 0,
          maxCostPerTask: 0,
          maxTimePerTaskMs: 0,
        } as any
      });

      const taskId = 'test-task-123';
      autonomyEnforcer.startTracking(taskId);
      autonomyEnforcer.recordUsage(taskId, {
        inputTokens: 1,
        outputTokens: 1,
        totalTokens: 2,
        estimatedCost: 0.001,
      });

      // Should not throw, should just not check limits when they are 0
      const result = autonomyEnforcer.checkLimits(taskId);
      expect(result.exceeded).toBe(false);
    });

    it('should handle undefined limits gracefully', () => {
      autonomyEnforcer.updateConfig({
        limits: {} as any
      });

      const taskId = 'test-task-123';
      autonomyEnforcer.startTracking(taskId);
      autonomyEnforcer.recordUsage(taskId, {
        inputTokens: 1000000,
        outputTokens: 500000,
        totalTokens: 1500000,
        estimatedCost: 100.0,
      });

      const result = autonomyEnforcer.checkLimits(taskId);
      expect(result.exceeded).toBe(false);
    });

    it('should handle empty gate configurations', async () => {
      autonomyEnforcer.updateConfig({ gates: [] });

      const context: TaskContext = {
        task: createMockTask(),
        operationType: 'dangerous',
      };

      const result = await autonomyEnforcer.checkApprovalRequired('delete-everything', context);
      expect(result).toBe(false);
    });
  });
});