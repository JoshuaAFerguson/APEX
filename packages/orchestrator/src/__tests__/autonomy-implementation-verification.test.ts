/**
 * Comprehensive verification test for v0.5.0 Autonomy Controls implementation
 * This test verifies the real implementation works with actual data.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import EventEmitter from 'eventemitter3';
import { AutonomyEnforcer, type AutonomyEnforcerConfig, type TaskContext, type ActionMetadata } from '../autonomy-enforcer.js';
import { ApprovalGateController, type ApprovalGateOptions } from '../approval-gate-controller.js';
import type { Task, TaskUsage, ApprovalGate, AutonomyLevel, TaskResourceLimits } from '@apexcli/core';

// Mock TaskStore
const mockTaskStore = {
  getTask: vi.fn(),
  updateTask: vi.fn(),
  createApprovalState: vi.fn(),
  updateApprovalState: vi.fn(),
  getApprovalState: vi.fn(),
  deleteApprovalState: vi.fn(),
  emit: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
} as any;

// Mock Orchestrator
const createMockOrchestrator = () => {
  const emitter = new EventEmitter();
  return {
    store: mockTaskStore,
    on: emitter.on.bind(emitter),
    off: emitter.off.bind(emitter),
    emit: emitter.emit.bind(emitter),
  };
};

describe('v0.5.0 Autonomy Controls Implementation Verification', () => {
  let mockOrchestrator: any;
  let autonomyConfig: AutonomyEnforcerConfig;

  beforeEach(() => {
    mockOrchestrator = createMockOrchestrator();
    vi.clearAllMocks();

    autonomyConfig = {
      level: 'review-before-commit' as AutonomyLevel,
      gates: [
        {
          type: 'before-commit',
          required: true,
          autoApprove: false,
          autoApproveOnTimeout: false,
          timeoutMs: 30000,
          approvalsRequired: 1,
        } as ApprovalGate,
      ],
      limits: {
        maxCost: 10.0,
        maxTokens: 100000,
        maxTimeMs: 300000,
        maxFilesCreated: 50,
        maxFilesModified: 100,
        maxFilesDeleted: 10,
        maxLinesChanged: 5000,
        maxTurns: 20,
        dailyBudget: 50.0,
        maxConcurrentTasks: 5,
      } as TaskResourceLimits,
      warningThresholds: {
        costWarningPercent: 80,
        tokenWarningPercent: 80,
        timeWarningPercent: 80,
        fileWarningPercent: 80,
      },
    };
  });

  describe('AutonomyEnforcer Real Implementation Tests', () => {
    it('should create AutonomyEnforcer with real config', () => {
      const enforcer = new AutonomyEnforcer(mockOrchestrator, autonomyConfig);
      expect(enforcer).toBeDefined();
      expect(enforcer.config).toEqual(autonomyConfig);
    });

    it('should check action based on autonomy level - full-auto', async () => {
      const config = { ...autonomyConfig, level: 'full-auto' as AutonomyLevel };
      const enforcer = new AutonomyEnforcer(mockOrchestrator, config);

      const actionMetadata: ActionMetadata = {
        agentType: 'developer',
        actionType: 'git-commit',
        scope: 'repository',
      };

      const requiresApproval = await enforcer.checkAction(actionMetadata);
      expect(requiresApproval).toBe(false);
    });

    it('should check action based on autonomy level - review-before-commit', async () => {
      const enforcer = new AutonomyEnforcer(mockOrchestrator, autonomyConfig);

      const actionMetadata: ActionMetadata = {
        agentType: 'developer',
        actionType: 'git-commit',
        scope: 'repository',
      };

      const requiresApproval = await enforcer.checkAction(actionMetadata);
      expect(requiresApproval).toBe(true);
    });

    it('should check action based on autonomy level - review-all', async () => {
      const config = { ...autonomyConfig, level: 'review-all' as AutonomyLevel };
      const enforcer = new AutonomyEnforcer(mockOrchestrator, config);

      const actionMetadata: ActionMetadata = {
        agentType: 'developer',
        actionType: 'file-write',
        scope: 'filesystem',
      };

      const requiresApproval = await enforcer.checkAction(actionMetadata);
      expect(requiresApproval).toBe(true);
    });

    it('should record and check resource usage limits', () => {
      const enforcer = new AutonomyEnforcer(mockOrchestrator, autonomyConfig);
      const taskId = 'test-task-123';

      // Record usage below limits
      const usage: Partial<TaskUsage> = {
        inputTokens: 1000,
        outputTokens: 2000,
        totalTokens: 3000,
        estimatedCost: 0.5,
        totalCostCents: 50,
        executionTimeMs: 30000,
      };

      enforcer.recordUsage(taskId, usage);

      const limitCheck = enforcer.checkLimits(taskId);
      expect(limitCheck.exceeded).toBe(false);
    });

    it('should detect limit violations', () => {
      const enforcer = new AutonomyEnforcer(mockOrchestrator, autonomyConfig);
      const taskId = 'test-task-limit-violation';

      // Record usage that exceeds limits
      const usage: Partial<TaskUsage> = {
        inputTokens: 50000,
        outputTokens: 60000,
        totalTokens: 110000, // Exceeds maxTokens: 100000
        estimatedCost: 12.0, // Exceeds maxCost: 10.0
        totalCostCents: 1200,
        executionTimeMs: 350000, // Exceeds maxTimeMs: 300000
      };

      enforcer.recordUsage(taskId, usage);

      const limitCheck = enforcer.checkLimits(taskId);
      expect(limitCheck.exceeded).toBe(true);
      expect(limitCheck.violations).toBeDefined();
      expect(limitCheck.violations!.length).toBeGreaterThan(0);
    });

    it('should emit warning events at threshold', async () => {
      const enforcer = new AutonomyEnforcer(mockOrchestrator, autonomyConfig);
      const taskId = 'test-task-warning';

      const warningListener = vi.fn();
      enforcer.on('limit:warning', warningListener);

      // Record usage at 90% of token limit (above 80% warning threshold)
      const usage: Partial<TaskUsage> = {
        inputTokens: 45000,
        outputTokens: 45000,
        totalTokens: 90000, // 90% of 100000 limit
        estimatedCost: 2.0,
        totalCostCents: 200,
        executionTimeMs: 50000,
      };

      enforcer.recordUsage(taskId, usage);

      // Should emit warning
      expect(warningListener).toHaveBeenCalled();
    });
  });

  describe('ApprovalGateController Real Implementation Tests', () => {
    let approvalOptions: ApprovalGateOptions;

    beforeEach(() => {
      approvalOptions = {
        config: {
          type: 'before-commit',
          required: true,
          autoApprove: false,
          autoApproveOnTimeout: false,
          timeoutMs: 5000, // Shorter timeout for tests
          approvalsRequired: 1,
        } as ApprovalGate,
        taskId: 'test-task-456',
        stage: 'implementation',
        agent: 'developer',
        store: mockTaskStore,
      };

      // Mock store methods
      mockTaskStore.createApprovalState.mockResolvedValue({
        id: 'approval-123',
        taskId: 'test-task-456',
        status: 'pending',
        createdAt: new Date(),
      });

      mockTaskStore.updateApprovalState.mockResolvedValue(undefined);
      mockTaskStore.deleteApprovalState.mockResolvedValue(undefined);
    });

    it('should create ApprovalGateController with real config', () => {
      const controller = new ApprovalGateController(approvalOptions);
      expect(controller).toBeDefined();
      expect(controller.config).toEqual(approvalOptions.config);
    });

    it('should request approval and create state', async () => {
      const controller = new ApprovalGateController(approvalOptions);

      const requestedListener = vi.fn();
      controller.on('approval:requested', requestedListener);

      // Start the approval request (don't await to avoid hanging)
      const approvalPromise = controller.requestApproval();

      // Should have created approval state
      expect(mockTaskStore.createApprovalState).toHaveBeenCalled();
      expect(requestedListener).toHaveBeenCalled();

      // Clean up by approving immediately
      await controller.approve('test-approver', 'test approval');

      const result = await approvalPromise;
      expect(result.status).toBe('approved');
    });

    it('should handle auto-approval when configured', async () => {
      const autoApproveOptions = {
        ...approvalOptions,
        config: {
          ...approvalOptions.config,
          autoApprove: true,
        },
      };

      const controller = new ApprovalGateController(autoApproveOptions);

      const result = await controller.requestApproval();
      expect(result.status).toBe('approved');
      expect(result.approver).toBe('system');
    });

    it('should handle approval with multiple required approvals', async () => {
      const multiApprovalOptions = {
        ...approvalOptions,
        config: {
          ...approvalOptions.config,
          approvalsRequired: 2,
        },
      };

      const controller = new ApprovalGateController(multiApprovalOptions);

      const resolvedListener = vi.fn();
      controller.on('approval:resolved', resolvedListener);

      // Start approval request
      const approvalPromise = controller.requestApproval();

      // First approval - should not resolve yet
      await controller.approve('approver1', 'first approval');
      expect(resolvedListener).not.toHaveBeenCalled();

      // Second approval - should resolve
      await controller.approve('approver2', 'second approval');

      const result = await approvalPromise;
      expect(result.status).toBe('approved');
      expect(result.approvalsReceived).toBe(2);
      expect(resolvedListener).toHaveBeenCalled();
    });

    it('should handle denial', async () => {
      const controller = new ApprovalGateController(approvalOptions);

      const resolvedListener = vi.fn();
      controller.on('approval:resolved', resolvedListener);

      // Start approval request
      const approvalPromise = controller.requestApproval();

      // Deny the approval
      await controller.deny('denier', 'rejected for testing');

      const result = await approvalPromise;
      expect(result.status).toBe('denied');
      expect(result.approver).toBe('denier');
      expect(resolvedListener).toHaveBeenCalled();
    });

    it('should handle timeout behavior', async () => {
      const shortTimeoutOptions = {
        ...approvalOptions,
        config: {
          ...approvalOptions.config,
          timeoutMs: 100, // Very short timeout
          autoApproveOnTimeout: false,
        },
      };

      const controller = new ApprovalGateController(shortTimeoutOptions);

      const timeoutListener = vi.fn();
      controller.on('approval:timeout', timeoutListener);

      const result = await controller.requestApproval();

      expect(result.status).toBe('timeout');
      expect(timeoutListener).toHaveBeenCalled();
    });

    it('should handle auto-approve on timeout', async () => {
      const autoApproveTimeoutOptions = {
        ...approvalOptions,
        config: {
          ...approvalOptions.config,
          timeoutMs: 100, // Very short timeout
          autoApproveOnTimeout: true,
        },
      };

      const controller = new ApprovalGateController(autoApproveTimeoutOptions);

      const result = await controller.requestApproval();

      expect(result.status).toBe('timeout');
      expect(result.approver).toBe('system');
    });
  });

  describe('Integration Tests - End-to-End Autonomy Flow', () => {
    it('should handle full autonomy flow from action check to approval resolution', async () => {
      const enforcer = new AutonomyEnforcer(mockOrchestrator, autonomyConfig);

      // 1. Check if action requires approval
      const actionMetadata: ActionMetadata = {
        agentType: 'developer',
        actionType: 'git-commit',
        scope: 'repository',
      };

      const requiresApproval = await enforcer.checkAction(actionMetadata);
      expect(requiresApproval).toBe(true);

      // 2. If approval required, create approval gate
      if (requiresApproval) {
        const gateConfig = autonomyConfig.gates.find(g => g.type === 'before-commit');
        expect(gateConfig).toBeDefined();

        const approvalOptions: ApprovalGateOptions = {
          config: gateConfig!,
          taskId: 'integration-test-task',
          stage: 'implementation',
          agent: 'developer',
          store: mockTaskStore,
        };

        const controller = new ApprovalGateController(approvalOptions);

        // 3. Request approval
        const approvalPromise = controller.requestApproval();

        // 4. Simulate user approval
        await controller.approve('integration-tester', 'Looks good!');

        // 5. Verify approval result
        const result = await approvalPromise;
        expect(result.status).toBe('approved');
        expect(result.approver).toBe('integration-tester');
      }
    });

    it('should handle autonomy level changes during runtime', async () => {
      const enforcer = new AutonomyEnforcer(mockOrchestrator, autonomyConfig);

      const actionMetadata: ActionMetadata = {
        agentType: 'developer',
        actionType: 'git-commit',
        scope: 'repository',
      };

      // Initially requires approval (review-before-commit)
      let requiresApproval = await enforcer.checkAction(actionMetadata);
      expect(requiresApproval).toBe(true);

      // Change to full-auto
      enforcer.updateConfig({
        ...autonomyConfig,
        level: 'full-auto' as AutonomyLevel,
      });

      // Now should not require approval
      requiresApproval = await enforcer.checkAction(actionMetadata);
      expect(requiresApproval).toBe(false);
    });

    it('should handle resource limit monitoring during task execution', () => {
      const enforcer = new AutonomyEnforcer(mockOrchestrator, autonomyConfig);
      const taskId = 'monitoring-test-task';

      const warningListener = vi.fn();
      const exceededListener = vi.fn();

      enforcer.on('limit:warning', warningListener);
      enforcer.on('limit:exceeded', exceededListener);

      // Simulate progressive usage updates
      const updates = [
        { totalTokens: 30000, totalCostCents: 300 }, // 30% usage
        { totalTokens: 60000, totalCostCents: 600 }, // 60% usage
        { totalTokens: 85000, totalCostCents: 850 }, // 85% usage - should warn
        { totalTokens: 110000, totalCostCents: 1100 }, // 110% usage - should exceed
      ];

      updates.forEach((usage, index) => {
        enforcer.recordUsage(taskId, usage as Partial<TaskUsage>);

        if (index === 2) {
          // At 85%, should have warned
          expect(warningListener).toHaveBeenCalled();
        }

        if (index === 3) {
          // At 110%, should have exceeded
          const limitCheck = enforcer.checkLimits(taskId);
          expect(limitCheck.exceeded).toBe(true);
        }
      });
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });
});