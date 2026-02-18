/**
 * Unit tests for ApexOrchestrator AutonomyEnforcer integration
 * Tests the constructor injection, initialization, and task execution integration
 * Validates that AutonomyEnforcer is properly accessible during task lifecycle
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ApexOrchestrator } from '../index.js';
import { AutonomyEnforcer, type AutonomyEnforcerConfig } from '../autonomy-enforcer.js';
import { Task, TaskStatus, AutonomyLevel, AutonomyLimits } from '@apexcli/core';

// Mock TaskStore
vi.mock('../store.js', () => {
  const mockTaskStore = {
    getTask: vi.fn(),
    createTask: vi.fn(),
    updateTask: vi.fn(),
    deleteTask: vi.fn(),
    listTasks: vi.fn(),
    ensureInitialized: vi.fn().mockResolvedValue(undefined),
    initialize: vi.fn().mockResolvedValue(undefined),
  };

  const mockToolActionStore = {
    recordAction: vi.fn(),
    getActions: vi.fn(),
  };

  return {
    TaskStore: vi.fn(() => mockTaskStore),
    ToolActionStore: vi.fn(() => mockToolActionStore),
  };
});

// Mock Claude Agent SDK
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  AgentSDK: vi.fn(() => ({
    query: vi.fn(),
  })),
  tool: vi.fn((config) => config),
  createSdkMcpServer: vi.fn(() => ({ start: vi.fn(), stop: vi.fn(), close: vi.fn() }))}));

// Mock config loading
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
    generateBranchName: vi.fn().mockReturnValue('test-branch'),
  };
});

// Mock fs
vi.mock('fs/promises', () => ({
  access: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
}));

// Mock policy enforcer
vi.mock('../policy.js', () => ({
  createPolicyEnforcer: vi.fn().mockReturnValue({
    checkPath: vi.fn().mockReturnValue({ allowed: true }),
    checkOperation: vi.fn().mockReturnValue({ allowed: true }),
  }),
}));

// Mock other dependencies
vi.mock('../workspace-manager.js', () => ({
  WorkspaceManager: vi.fn(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    cleanup: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('../worktree-manager.js', () => ({
  WorktreeManager: vi.fn(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    cleanup: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('../thought-capture.js', () => ({
  ThoughtCaptureManager: vi.fn(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('../interaction-manager.js', () => ({
  InteractionManager: vi.fn(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('../permission-store.js', () => ({
  PermissionStore: vi.fn(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('../permission-manager.js', () => ({
  PermissionManager: vi.fn(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('../permission-preset-manager.js', () => ({
  PermissionPresetManager: vi.fn(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('../linter.js', () => ({
  LinterService: vi.fn(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    lintFile: vi.fn().mockResolvedValue([]),
  })),
}));

vi.mock('../hook-manager.js', () => ({
  HookManager: vi.fn(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('../idle-processor.js', () => ({
  IdleProcessor: vi.fn(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
  })),
}));

// Create mock task data
const createMockTask = (overrides: Partial<Task> = {}): Task => ({
  id: 'test-task-12345678',
  description: 'Test task for autonomy enforcer integration',
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

describe('ApexOrchestrator AutonomyEnforcer Integration', () => {
  let orchestrator: ApexOrchestrator;
  let mockAutonomyEnforcer: AutonomyEnforcer;

  beforeEach(async () => {
    // Reset mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor injection', () => {
    it('should accept AutonomyEnforcer instance in constructor options', async () => {
      // Create a mock autonomy enforcer
      const mockConfig: AutonomyEnforcerConfig = {
        level: 'full-auto' as AutonomyLevel,
        gates: [],
        limits: {
          maxTokensPerTask: 5000,
          maxCostPerTask: 0.50,
          maxTimePerTaskMs: 180000,
        } as AutonomyLimits,
        warningThresholds: {
          costWarningPercent: 75,
          tokenWarningPercent: 75,
          timeWarningPercent: 75,
          fileWarningPercent: 75,
        },
      };

      mockAutonomyEnforcer = new AutonomyEnforcer(mockConfig, {} as any);

      // Create orchestrator with injected autonomy enforcer
      orchestrator = new ApexOrchestrator({
        projectPath: '/test/path',
        apiKey: 'test-key',
        autonomyEnforcer: mockAutonomyEnforcer,
      });

      await orchestrator.initialize();

      // Verify the injected autonomy enforcer is used
      const autonomyEnforcer = (orchestrator as any).autonomyEnforcer;
      expect(autonomyEnforcer).toBe(mockAutonomyEnforcer);
      expect(autonomyEnforcer).toBeInstanceOf(AutonomyEnforcer);
    });

    it('should create new AutonomyEnforcer when not provided in options', async () => {
      // Create orchestrator without autonomy enforcer injection
      orchestrator = new ApexOrchestrator({
        projectPath: '/test/path',
        apiKey: 'test-key',
      });

      await orchestrator.initialize();

      // Verify a new autonomy enforcer was created
      const autonomyEnforcer = (orchestrator as any).autonomyEnforcer;
      expect(autonomyEnforcer).toBeInstanceOf(AutonomyEnforcer);
    });

    it('should handle undefined autonomyEnforcer option gracefully', async () => {
      orchestrator = new ApexOrchestrator({
        projectPath: '/test/path',
        apiKey: 'test-key',
        autonomyEnforcer: undefined,
      });

      await orchestrator.initialize();

      // Should create a new autonomy enforcer when undefined
      const autonomyEnforcer = (orchestrator as any).autonomyEnforcer;
      expect(autonomyEnforcer).toBeInstanceOf(AutonomyEnforcer);
    });
  });

  describe('initialization from config', () => {
    beforeEach(async () => {
      orchestrator = new ApexOrchestrator({
        projectPath: '/test/path',
        apiKey: 'test-key',
      });
      await orchestrator.initialize();
    });

    it('should initialize AutonomyEnforcer with config values', () => {
      const autonomyEnforcer = (orchestrator as any).autonomyEnforcer;
      expect(autonomyEnforcer).toBeDefined();
      expect(autonomyEnforcer).toBeInstanceOf(AutonomyEnforcer);

      // The autonomy enforcer should be created with config from loadConfig mock
      const config = autonomyEnforcer.config;
      expect(config.level).toBe('review-before-commit');
      expect(config.limits.maxTokensPerTask).toBe(10000);
      expect(config.limits.maxCostPerTask).toBe(1.00);
    });

    it('should handle missing autonomy config gracefully', async () => {
      // Override mock to return config without autonomy section
      const { loadConfig } = await import('@apexcli/core');
      vi.mocked(loadConfig).mockResolvedValueOnce({
        policy: {},
        scanner: undefined,
        linter: { global: { enabled: false } },
        hooks: [],
        toolHooks: { pre: [], post: [], enabled: false, defaultTimeoutMs: 30000 },
        toolActionRetention: { maxAge: 7 * 24 * 60 * 60 * 1000, maxCount: 1000 },
      } as any);

      const newOrchestrator = new ApexOrchestrator({
        projectPath: '/test/path',
        apiKey: 'test-key',
      });

      await newOrchestrator.initialize();

      // Should still create autonomy enforcer with defaults
      const autonomyEnforcer = (newOrchestrator as any).autonomyEnforcer;
      expect(autonomyEnforcer).toBeInstanceOf(AutonomyEnforcer);
    });

    it('should set up event listeners between orchestrator and autonomy enforcer', () => {
      const autonomyEnforcer = (orchestrator as any).autonomyEnforcer;

      // Verify event listeners are set up
      expect(autonomyEnforcer.listenerCount('limit:warning')).toBeGreaterThan(0);
      expect(autonomyEnforcer.listenerCount('limit:exceeded')).toBeGreaterThan(0);
      expect(autonomyEnforcer.listenerCount('approval:required')).toBeGreaterThan(0);
    });
  });

  describe('task execution integration', () => {
    beforeEach(async () => {
      orchestrator = new ApexOrchestrator({
        projectPath: '/test/path',
        apiKey: 'test-key',
      });
      await orchestrator.initialize();
    });

    it('should make AutonomyEnforcer accessible during task execution', () => {
      const autonomyEnforcer = (orchestrator as any).autonomyEnforcer;
      expect(autonomyEnforcer).toBeDefined();

      // Test that we can call autonomy enforcer methods
      expect(typeof autonomyEnforcer.checkApprovalRequired).toBe('function');
      expect(typeof autonomyEnforcer.checkLimits).toBe('function');
      expect(typeof autonomyEnforcer.recordUsage).toBe('function');
      expect(typeof autonomyEnforcer.startTracking).toBe('function');
      expect(typeof autonomyEnforcer.stopTracking).toBe('function');
    });

    it('should start tracking when task is started', () => {
      const autonomyEnforcer = (orchestrator as any).autonomyEnforcer;
      const startTrackingSpy = vi.spyOn(autonomyEnforcer, 'startTracking');

      const task = createMockTask();

      // Simulate task:started event
      orchestrator.emit('task:started', task);

      expect(startTrackingSpy).toHaveBeenCalledWith(task.id);
    });

    it('should stop tracking when task is completed', () => {
      const autonomyEnforcer = (orchestrator as any).autonomyEnforcer;
      const stopTrackingSpy = vi.spyOn(autonomyEnforcer, 'stopTracking');

      const task = createMockTask();

      // Simulate task:completed event
      orchestrator.emit('task:completed', task);

      expect(stopTrackingSpy).toHaveBeenCalledWith(task.id);
    });

    it('should stop tracking when task fails', () => {
      const autonomyEnforcer = (orchestrator as any).autonomyEnforcer;
      const stopTrackingSpy = vi.spyOn(autonomyEnforcer, 'stopTracking');

      const task = createMockTask();
      const error = new Error('Test error');

      // Simulate task:failed event
      orchestrator.emit('task:failed', task, error);

      expect(stopTrackingSpy).toHaveBeenCalledWith(task.id);
    });

    it('should record usage when usage is updated', () => {
      const autonomyEnforcer = (orchestrator as any).autonomyEnforcer;
      const recordUsageSpy = vi.spyOn(autonomyEnforcer, 'recordUsage');

      const taskId = 'test-task-123';
      const usage = {
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
        estimatedCost: 0.02,
      };

      // Simulate usage:updated event
      orchestrator.emit('usage:updated', taskId, usage);

      expect(recordUsageSpy).toHaveBeenCalledWith(taskId, usage);
    });
  });

  describe('event forwarding', () => {
    beforeEach(async () => {
      orchestrator = new ApexOrchestrator({
        projectPath: '/test/path',
        apiKey: 'test-key',
      });
      await orchestrator.initialize();
    });

    it('should forward limit:warning events from autonomy enforcer', (done) => {
      const autonomyEnforcer = (orchestrator as any).autonomyEnforcer;

      const warning = {
        type: 'tokens' as const,
        threshold: 80,
        currentValue: 8500,
        limitValue: 10000,
        message: 'Token usage at 85% of limit',
      };

      // Listen for forwarded event
      orchestrator.on('autonomy:limit:warning', (receivedWarning) => {
        expect(receivedWarning).toEqual(warning);
        done();
      });

      // Emit from autonomy enforcer
      autonomyEnforcer.emit('limit:warning', warning);
    });

    it('should forward limit:exceeded events from autonomy enforcer', (done) => {
      const autonomyEnforcer = (orchestrator as any).autonomyEnforcer;
      const task = createMockTask();

      const limitCheck = {
        exceeded: true,
        limitType: 'cost' as const,
        currentValue: 1.20,
        limitValue: 1.00,
        message: 'Cost limit exceeded: $1.20 > $1.00',
      };

      // Listen for forwarded event
      orchestrator.on('autonomy:limit:exceeded', (receivedResult, receivedTask) => {
        expect(receivedResult).toEqual(limitCheck);
        expect(receivedTask).toEqual(task);
        done();
      });

      // Emit from autonomy enforcer
      autonomyEnforcer.emit('limit:exceeded', limitCheck, task);
    });

    it('should forward approval:required events from autonomy enforcer', (done) => {
      const autonomyEnforcer = (orchestrator as any).autonomyEnforcer;

      const gateName = 'before-commit';
      const context = {
        task: createMockTask(),
        currentStage: 'implementation',
        agent: 'developer',
        operationType: 'write' as const,
      };

      // Listen for forwarded event
      orchestrator.on('autonomy:approval:required', (receivedGateName, receivedContext) => {
        expect(receivedGateName).toBe(gateName);
        expect(receivedContext).toEqual(context);
        done();
      });

      // Emit from autonomy enforcer
      autonomyEnforcer.emit('approval:required', gateName, context);
    });
  });

  describe('error handling', () => {
    it('should handle AutonomyEnforcer initialization errors gracefully', async () => {
      // Mock AutonomyEnforcer constructor to throw
      vi.mocked(AutonomyEnforcer).mockImplementationOnce(() => {
        throw new Error('Autonomy enforcer initialization failed');
      });

      const orchestrator = new ApexOrchestrator({
        projectPath: '/test/path',
        apiKey: 'test-key',
      });

      // Should handle the error during initialization
      await expect(orchestrator.initialize()).rejects.toThrow('Autonomy enforcer initialization failed');
    });

    it('should handle autonomy enforcer method call failures', async () => {
      orchestrator = new ApexOrchestrator({
        projectPath: '/test/path',
        apiKey: 'test-key',
      });
      await orchestrator.initialize();

      const autonomyEnforcer = (orchestrator as any).autonomyEnforcer;

      // Mock a method to throw
      vi.spyOn(autonomyEnforcer, 'checkLimits').mockImplementation(() => {
        throw new Error('Limit check failed');
      });

      // Should handle the error gracefully
      expect(() => {
        autonomyEnforcer.checkLimits('test-task-123');
      }).toThrow('Limit check failed');
    });
  });

  describe('integration scenarios', () => {
    beforeEach(async () => {
      orchestrator = new ApexOrchestrator({
        projectPath: '/test/path',
        apiKey: 'test-key',
      });
      await orchestrator.initialize();
    });

    it('should integrate autonomy enforcement with task lifecycle', () => {
      const autonomyEnforcer = (orchestrator as any).autonomyEnforcer;
      const startTrackingSpy = vi.spyOn(autonomyEnforcer, 'startTracking');
      const stopTrackingSpy = vi.spyOn(autonomyEnforcer, 'stopTracking');
      const recordUsageSpy = vi.spyOn(autonomyEnforcer, 'recordUsage');

      const task = createMockTask();

      // Start task
      orchestrator.emit('task:started', task);
      expect(startTrackingSpy).toHaveBeenCalledWith(task.id);

      // Update usage
      const usage = { inputTokens: 50, outputTokens: 25, totalTokens: 75, estimatedCost: 0.01 };
      orchestrator.emit('usage:updated', task.id, usage);
      expect(recordUsageSpy).toHaveBeenCalledWith(task.id, usage);

      // Complete task
      orchestrator.emit('task:completed', task);
      expect(stopTrackingSpy).toHaveBeenCalledWith(task.id);
    });

    it('should allow custom autonomy enforcer with different config', async () => {
      const customConfig: AutonomyEnforcerConfig = {
        level: 'review-all' as AutonomyLevel,
        gates: [
          { type: 'before-destructive', description: 'Review destructive operations', enabled: true },
        ],
        limits: {
          maxTokensPerTask: 2000,
          maxCostPerTask: 0.25,
          maxTimePerTaskMs: 60000,
        } as AutonomyLimits,
        warningThresholds: {
          costWarningPercent: 90,
          tokenWarningPercent: 90,
          timeWarningPercent: 90,
          fileWarningPercent: 90,
        },
      };

      const customAutonomyEnforcer = new AutonomyEnforcer(customConfig, {} as any);

      const customOrchestrator = new ApexOrchestrator({
        projectPath: '/test/path',
        apiKey: 'test-key',
        autonomyEnforcer: customAutonomyEnforcer,
      });

      await customOrchestrator.initialize();

      const autonomyEnforcer = (customOrchestrator as any).autonomyEnforcer;
      expect(autonomyEnforcer).toBe(customAutonomyEnforcer);
      expect(autonomyEnforcer.config.level).toBe('review-all');
      expect(autonomyEnforcer.config.limits.maxTokensPerTask).toBe(2000);
    });
  });

  describe('concurrency and thread safety', () => {
    beforeEach(async () => {
      orchestrator = new ApexOrchestrator({
        projectPath: '/test/path',
        apiKey: 'test-key',
      });
      await orchestrator.initialize();
    });

    it('should handle concurrent task tracking operations', () => {
      const autonomyEnforcer = (orchestrator as any).autonomyEnforcer;
      const startTrackingSpy = vi.spyOn(autonomyEnforcer, 'startTracking');
      const recordUsageSpy = vi.spyOn(autonomyEnforcer, 'recordUsage');

      const task1 = createMockTask({ id: 'task1' });
      const task2 = createMockTask({ id: 'task2' });

      // Simulate concurrent operations
      orchestrator.emit('task:started', task1);
      orchestrator.emit('task:started', task2);

      orchestrator.emit('usage:updated', task1.id, { inputTokens: 100, outputTokens: 50, totalTokens: 150, estimatedCost: 0.02 });
      orchestrator.emit('usage:updated', task2.id, { inputTokens: 75, outputTokens: 40, totalTokens: 115, estimatedCost: 0.015 });

      expect(startTrackingSpy).toHaveBeenCalledTimes(2);
      expect(startTrackingSpy).toHaveBeenCalledWith('task1');
      expect(startTrackingSpy).toHaveBeenCalledWith('task2');

      expect(recordUsageSpy).toHaveBeenCalledTimes(2);
      expect(recordUsageSpy).toHaveBeenCalledWith('task1', expect.any(Object));
      expect(recordUsageSpy).toHaveBeenCalledWith('task2', expect.any(Object));
    });

    it('should maintain separate tracking state for multiple tasks', () => {
      const autonomyEnforcer = (orchestrator as any).autonomyEnforcer;

      const task1 = createMockTask({ id: 'task1' });
      const task2 = createMockTask({ id: 'task2' });

      // Start tracking both tasks
      orchestrator.emit('task:started', task1);
      orchestrator.emit('task:started', task2);

      // Verify both tasks are being tracked
      expect(autonomyEnforcer.getTaskUsage('task1')).toBeDefined();
      expect(autonomyEnforcer.getTaskUsage('task2')).toBeDefined();
      expect(autonomyEnforcer.getElapsedTime('task1')).toBeDefined();
      expect(autonomyEnforcer.getElapsedTime('task2')).toBeDefined();

      // Complete one task
      orchestrator.emit('task:completed', task1);

      // Only task1 should be cleaned up
      expect(autonomyEnforcer.getTaskUsage('task1')).toBeUndefined();
      expect(autonomyEnforcer.getTaskUsage('task2')).toBeDefined();
    });
  });
});