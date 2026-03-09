/**
 * Autonomy and Permission Level Test Helpers
 *
 * Utilities for testing autonomy levels, approval flows, permission scenarios,
 * and autonomy boundary conditions. Provides mock managers, event simulation,
 * and comprehensive assertion helpers.
 *
 * @module tests/test-utils/autonomy-test-helpers
 */

import { describe, it, expect, beforeEach, afterEach, vi, type MockedFunction } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import type {
  AutonomyLevel,
  AutonomyConfig,
  PermissionLevel,
  ToolPermissionResult,
  ApprovalGate,
  TaskResourceLimits,
  RejectionBehavior,
  AgentAutonomyOverride,
  Task,
  TaskStatus,
  Agent,
} from '../../packages/core/src/types.js';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Configuration for mock autonomy manager
 */
export interface MockAutonomyManagerConfig {
  /** Default autonomy level */
  defaultLevel?: AutonomyLevel;
  /** Agent-specific overrides */
  agentOverrides?: Record<string, AutonomyLevel | AgentAutonomyOverride>;
  /** Stage-specific overrides */
  stageOverrides?: Record<string, AutonomyLevel>;
  /** Approval gates to include */
  approvalGates?: ApprovalGate[];
  /** Resource limits */
  resourceLimits?: TaskResourceLimits;
  /** Approval timeout */
  approvalTimeout?: number;
  /** Rejection behavior */
  rejectionBehavior?: RejectionBehavior;
  /** Whether to simulate approval flow failures */
  simulateApprovalFailures?: boolean;
  /** Whether to simulate permission failures */
  simulatePermissionFailures?: boolean;
}

/**
 * Mock autonomy manager for controlled testing
 */
export interface MockAutonomyManager {
  checkAutonomyLevel: MockedFunction<(agent: string, stage: string) => Promise<AutonomyLevel>>;
  requiresApproval: MockedFunction<(level: AutonomyLevel, action: string) => boolean>;
  requestApproval: MockedFunction<(params: ApprovalRequest) => Promise<ApprovalResponse>>;
  getApprovalGates: MockedFunction<(stage: string) => ApprovalGate[]>;
  checkResourceLimits: MockedFunction<(task: Partial<Task>) => Promise<ResourceLimitCheck>>;
  enforceAutonomyBoundary: MockedFunction<(action: string, context: any) => Promise<boolean>>;
}

/**
 * Approval request parameters
 */
export interface ApprovalRequest {
  taskId: string;
  action: string;
  description: string;
  stage: string;
  agent: string;
  level: AutonomyLevel;
  timeout?: number;
  metadata?: Record<string, any>;
}

/**
 * Approval response
 */
export interface ApprovalResponse {
  approved: boolean;
  reason?: string;
  timestamp: Date;
  timeout?: boolean;
  metadata?: Record<string, any>;
}

/**
 * Resource limit check result
 */
export interface ResourceLimitCheck {
  withinLimits: boolean;
  violations: string[];
  estimatedUsage: {
    tokens?: number;
    duration?: number;
    cost?: number;
    files?: number;
  };
  recommendations: string[];
}

/**
 * Autonomy event captured during testing
 */
export interface AutonomyEvent {
  type: 'approval_requested' | 'approval_granted' | 'approval_denied' | 'boundary_enforced' | 'limit_exceeded';
  taskId?: string;
  agent?: string;
  stage?: string;
  action?: string;
  level?: AutonomyLevel;
  reason?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

/**
 * Context for autonomy testing
 */
export interface AutonomyTestContext {
  autonomyManager: MockAutonomyManager;
  permissionManager: MockPermissionManager;
  eventEmitter: EventEmitter;
  events: AutonomyEvent[];
  config: AutonomyConfig;
  taskManager: MockTaskManager;
  approvalSimulator: ApprovalSimulator;
}

/**
 * Mock permission manager interface
 */
export interface MockPermissionManager {
  checkToolPermission: MockedFunction<(tool: string, options: { scope: string }) => Promise<ToolPermissionResult>>;
  grantPermission: MockedFunction<(tool: string, level: PermissionLevel, scope?: string) => Promise<void>>;
  denyPermission: MockedFunction<(tool: string, scope?: string) => Promise<void>>;
  hasPermission: MockedFunction<(tool: string, level: PermissionLevel, scope?: string) => Promise<boolean>>;
}

/**
 * Mock task manager for testing autonomy boundaries
 */
export interface MockTaskManager {
  createTask: MockedFunction<(description: string, config?: Partial<Task>) => Promise<Task>>;
  updateTask: MockedFunction<(id: string, updates: Partial<Task>) => Promise<Task>>;
  pauseTask: MockedFunction<(id: string, reason?: string) => Promise<void>>;
  resumeTask: MockedFunction<(id: string) => Promise<void>>;
  abortTask: MockedFunction<(id: string, reason?: string) => Promise<void>>;
  getCurrentTask: MockedFunction<() => Task | null>;
}

/**
 * Approval simulator for testing approval flows
 */
export interface ApprovalSimulator {
  simulateApproval: (delay?: number) => Promise<ApprovalResponse>;
  simulateDenial: (reason?: string, delay?: number) => Promise<ApprovalResponse>;
  simulateTimeout: (timeout?: number) => Promise<ApprovalResponse>;
  setAutoResponse: (response: 'approve' | 'deny' | 'timeout', delay?: number) => void;
  clearAutoResponse: () => void;
}

// ============================================================================
// Mock Factory Functions
// ============================================================================

/**
 * Create a mock autonomy manager with configurable behavior
 */
export function createMockAutonomyManager(config: MockAutonomyManagerConfig = {}): MockAutonomyManager {
  const {
    defaultLevel = 'review-before-commit',
    agentOverrides = {},
    stageOverrides = {},
    approvalGates = [],
    approvalTimeout = 30,
    rejectionBehavior = 'pause',
    simulateApprovalFailures = false,
    simulatePermissionFailures = false,
  } = config;

  return {
    checkAutonomyLevel: vi.fn(async (agent: string, stage: string): Promise<AutonomyLevel> => {
      // Check for stage-specific override first
      if (stageOverrides[stage]) {
        return stageOverrides[stage];
      }

      // Check for agent-specific override
      const agentOverride = agentOverrides[agent];
      if (agentOverride) {
        return typeof agentOverride === 'string' ? agentOverride : agentOverride.level;
      }

      // Return default level
      return defaultLevel;
    }),

    requiresApproval: vi.fn((level: AutonomyLevel, action: string): boolean => {
      switch (level) {
        case 'full-auto':
          return false;
        case 'review-before-commit':
          return ['commit', 'push', 'deploy', 'delete'].includes(action);
        case 'review-all':
          return true;
        default:
          return true;
      }
    }),

    requestApproval: vi.fn(async (params: ApprovalRequest): Promise<ApprovalResponse> => {
      if (simulateApprovalFailures) {
        throw new Error('Approval system temporarily unavailable');
      }

      // Default behavior: auto-approve for testing
      return {
        approved: true,
        timestamp: new Date(),
        reason: 'Auto-approved by test harness',
        metadata: {
          taskId: params.taskId,
          action: params.action,
          level: params.level,
        },
      };
    }),

    getApprovalGates: vi.fn((stage: string): ApprovalGate[] => {
      return approvalGates.filter(gate => gate.stage === stage);
    }),

    checkResourceLimits: vi.fn(async (task: Partial<Task>): Promise<ResourceLimitCheck> => {
      const limits = config.resourceLimits;
      if (!limits) {
        return {
          withinLimits: true,
          violations: [],
          estimatedUsage: {},
          recommendations: [],
        };
      }

      const violations: string[] = [];
      const estimatedUsage = task.usage || { totalTokens: 0, estimatedCost: 0 };

      if (limits.maxTokens && estimatedUsage.totalTokens > limits.maxTokens) {
        violations.push(`Token limit exceeded: ${estimatedUsage.totalTokens} > ${limits.maxTokens}`);
      }

      if (limits.maxCost && estimatedUsage.estimatedCost > limits.maxCost) {
        violations.push(`Cost limit exceeded: $${estimatedUsage.estimatedCost} > $${limits.maxCost}`);
      }

      return {
        withinLimits: violations.length === 0,
        violations,
        estimatedUsage: {
          tokens: estimatedUsage.totalTokens,
          cost: estimatedUsage.estimatedCost,
        },
        recommendations: violations.length > 0
          ? ['Consider breaking down the task into smaller parts', 'Review resource allocation']
          : [],
      };
    }),

    enforceAutonomyBoundary: vi.fn(async (action: string, context: any): Promise<boolean> => {
      const level = context.level || defaultLevel;
      const agent = context.agent || 'unknown';
      const stage = context.stage || 'implementation';

      const actualLevel = await this.checkAutonomyLevel(agent, stage);
      const requiresApproval = this.requiresApproval(actualLevel, action);

      if (!requiresApproval) {
        return true;
      }

      if (simulateApprovalFailures) {
        return false;
      }

      // For testing purposes, always allow unless explicitly configured otherwise
      return true;
    }),
  };
}

/**
 * Create a mock permission manager for testing permission scenarios
 */
export function createMockPermissionManager(config: {
  defaultLevel?: PermissionLevel;
  deniedTools?: string[];
  deniedScopes?: string[];
  simulateFailures?: boolean;
} = {}): MockPermissionManager {
  const {
    defaultLevel = 'full',
    deniedTools = [],
    deniedScopes = [],
    simulateFailures = false,
  } = config;

  return {
    checkToolPermission: vi.fn(async (tool: string, options: { scope: string }): Promise<ToolPermissionResult> => {
      if (simulateFailures) {
        throw new Error('Permission system connection failed');
      }

      const scope = options.scope || '';
      const isToolDenied = deniedTools.includes(tool);
      const isScopeDenied = deniedScopes.some(denied => scope.includes(denied));

      if (isToolDenied || isScopeDenied) {
        return {
          allowed: false,
          level: null,
          requiresConfirmation: false,
          denialReason: isToolDenied
            ? `Tool '${tool}' is not permitted by test policy`
            : `Scope '${scope}' is not permitted by test policy`,
        };
      }

      return {
        allowed: true,
        level: defaultLevel,
        requiresConfirmation: defaultLevel === 'limited',
      };
    }),

    grantPermission: vi.fn(async (tool: string, level: PermissionLevel, scope?: string): Promise<void> => {
      // Remove from denied lists
      const toolIndex = deniedTools.indexOf(tool);
      if (toolIndex >= 0) {
        deniedTools.splice(toolIndex, 1);
      }

      if (scope) {
        const scopeIndex = deniedScopes.indexOf(scope);
        if (scopeIndex >= 0) {
          deniedScopes.splice(scopeIndex, 1);
        }
      }
    }),

    denyPermission: vi.fn(async (tool: string, scope?: string): Promise<void> => {
      if (!deniedTools.includes(tool)) {
        deniedTools.push(tool);
      }
      if (scope && !deniedScopes.includes(scope)) {
        deniedScopes.push(scope);
      }
    }),

    hasPermission: vi.fn(async (tool: string, level: PermissionLevel, scope?: string): Promise<boolean> => {
      const result = await this.checkToolPermission(tool, { scope: scope || '' });
      return result.allowed && (result.level === level || level === 'none');
    }),
  };
}

/**
 * Create a mock task manager for testing autonomy boundaries
 */
export function createMockTaskManager(): MockTaskManager {
  let currentTask: Task | null = null;
  let taskCounter = 0;

  return {
    createTask: vi.fn(async (description: string, config: Partial<Task> = {}): Promise<Task> => {
      taskCounter++;
      const task: Task = {
        id: `test-task-${taskCounter}`,
        description,
        workflow: 'feature',
        status: 'pending',
        autonomy: 'review-before-commit',
        priority: 'normal',
        retryCount: 0,
        maxRetries: 3,
        dependsOn: [],
        blockedBy: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        usage: {
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          estimatedCost: 0,
        },
        logs: [],
        artifacts: [],
        ...config,
      };

      currentTask = task;
      return task;
    }),

    updateTask: vi.fn(async (id: string, updates: Partial<Task>): Promise<Task> => {
      if (!currentTask || currentTask.id !== id) {
        throw new Error(`Task ${id} not found`);
      }

      currentTask = { ...currentTask, ...updates, updatedAt: new Date() };
      return currentTask;
    }),

    pauseTask: vi.fn(async (id: string, reason?: string): Promise<void> => {
      if (currentTask && currentTask.id === id) {
        currentTask.status = 'paused';
        currentTask.updatedAt = new Date();
      }
    }),

    resumeTask: vi.fn(async (id: string): Promise<void> => {
      if (currentTask && currentTask.id === id) {
        currentTask.status = 'running';
        currentTask.updatedAt = new Date();
      }
    }),

    abortTask: vi.fn(async (id: string, reason?: string): Promise<void> => {
      if (currentTask && currentTask.id === id) {
        currentTask.status = 'aborted';
        currentTask.updatedAt = new Date();
      }
    }),

    getCurrentTask: vi.fn(() => currentTask),
  };
}

/**
 * Create an approval simulator for testing approval flows
 */
export function createApprovalSimulator(): ApprovalSimulator {
  let autoResponse: { type: 'approve' | 'deny' | 'timeout'; delay: number } | null = null;

  return {
    simulateApproval: vi.fn(async (delay = 100): Promise<ApprovalResponse> => {
      await new Promise(resolve => setTimeout(resolve, delay));
      return {
        approved: true,
        timestamp: new Date(),
        reason: 'Approved by test simulator',
      };
    }),

    simulateDenial: vi.fn(async (reason = 'Denied by test simulator', delay = 100): Promise<ApprovalResponse> => {
      await new Promise(resolve => setTimeout(resolve, delay));
      return {
        approved: false,
        timestamp: new Date(),
        reason,
      };
    }),

    simulateTimeout: vi.fn(async (timeout = 1000): Promise<ApprovalResponse> => {
      await new Promise(resolve => setTimeout(resolve, timeout));
      return {
        approved: false,
        timestamp: new Date(),
        timeout: true,
        reason: 'Approval request timed out',
      };
    }),

    setAutoResponse: (response: 'approve' | 'deny' | 'timeout', delay = 100) => {
      autoResponse = { type: response, delay };
    },

    clearAutoResponse: () => {
      autoResponse = null;
    },
  };
}

/**
 * Create a complete autonomy test context
 */
export function createAutonomyTestContext(config: MockAutonomyManagerConfig = {}): AutonomyTestContext {
  const autonomyManager = createMockAutonomyManager(config);
  const permissionManager = createMockPermissionManager();
  const eventEmitter = new EventEmitter();
  const events: AutonomyEvent[] = [];
  const taskManager = createMockTaskManager();
  const approvalSimulator = createApprovalSimulator();

  // Setup event tracking
  const eventTypes: AutonomyEvent['type'][] = [
    'approval_requested',
    'approval_granted',
    'approval_denied',
    'boundary_enforced',
    'limit_exceeded',
  ];

  eventTypes.forEach(eventType => {
    eventEmitter.on(eventType, (event) => {
      events.push({ type: eventType, timestamp: new Date(), ...event });
    });
  });

  // Create autonomy config from manager config
  const autonomyConfig: AutonomyConfig = {
    level: config.defaultLevel || 'review-before-commit',
    rejectionBehavior: config.rejectionBehavior || 'pause',
    approvalTimeout: config.approvalTimeout || 30,
    gates: config.approvalGates || [],
    limits: config.resourceLimits,
    stageOverrides: config.stageOverrides,
    agentOverrides: config.agentOverrides,
  };

  return {
    autonomyManager,
    permissionManager,
    eventEmitter,
    events,
    config: autonomyConfig,
    taskManager,
    approvalSimulator,
  };
}

// ============================================================================
// Scenario Generators
// ============================================================================

/**
 * Generate autonomy test scenarios for comprehensive testing
 */
export function createAutonomyTestScenarios() {
  return {
    // Basic autonomy level scenarios
    fullAutonomy: () => createAutonomyTestContext({
      defaultLevel: 'full-auto',
      approvalGates: [],
    }),

    reviewBeforeCommit: () => createAutonomyTestContext({
      defaultLevel: 'review-before-commit',
      approvalGates: [
        {
          id: 'commit-gate',
          name: 'Commit Review',
          description: 'Review before committing changes',
          stage: 'implementation',
          type: 'manual',
          timeout: 30,
          required: true,
          conditions: ['has-changes'],
        },
      ],
    }),

    reviewAll: () => createAutonomyTestContext({
      defaultLevel: 'review-all',
      approvalGates: [
        {
          id: 'action-gate',
          name: 'Action Review',
          description: 'Review all actions',
          stage: 'implementation',
          type: 'manual',
          timeout: 15,
          required: true,
          conditions: ['any-action'],
        },
      ],
    }),

    // Agent-specific scenarios
    developerOverride: () => createAutonomyTestContext({
      defaultLevel: 'review-all',
      agentOverrides: {
        'developer': {
          level: 'review-before-commit',
          approvalTimeout: 60,
          rejectionBehavior: 'pause',
        },
      },
    }),

    // Stage-specific scenarios
    implementationRestricted: () => createAutonomyTestContext({
      defaultLevel: 'full-auto',
      stageOverrides: {
        'implementation': 'review-all',
        'deployment': 'review-all',
      },
    }),

    // Resource-constrained scenarios
    limitedResources: () => createAutonomyTestContext({
      defaultLevel: 'full-auto',
      resourceLimits: {
        maxTokens: 1000,
        maxCost: 1.0,
        maxDuration: 5,
        maxRetries: 1,
        maxFiles: 5,
        maxFileSize: 1024,
      },
    }),

    // Failure simulation scenarios
    approvalFailures: () => createAutonomyTestContext({
      defaultLevel: 'review-before-commit',
      simulateApprovalFailures: true,
    }),

    permissionFailures: () => createAutonomyTestContext({
      defaultLevel: 'full-auto',
      simulatePermissionFailures: true,
    }),

    // Complex mixed scenarios
    mixedConstraints: () => createAutonomyTestContext({
      defaultLevel: 'review-before-commit',
      agentOverrides: {
        'tester': 'full-auto',
        'developer': {
          level: 'review-all',
          approvalTimeout: 45,
          rejectionBehavior: 'abort',
        },
      },
      stageOverrides: {
        'deployment': 'review-all',
      },
      resourceLimits: {
        maxTokens: 50000,
        maxCost: 5.0,
        maxDuration: 30,
        maxRetries: 2,
        maxFiles: 20,
        maxFileSize: 5242880, // 5MB
      },
      approvalGates: [
        {
          id: 'code-review',
          name: 'Code Review',
          description: 'Review code changes',
          stage: 'implementation',
          type: 'manual',
          timeout: 60,
          required: true,
          conditions: ['code-changes'],
        },
        {
          id: 'deployment-gate',
          name: 'Deployment Gate',
          description: 'Approve deployment',
          stage: 'deployment',
          type: 'manual',
          timeout: 30,
          required: true,
          conditions: ['deploy-ready'],
        },
      ],
    }),
  };
}

/**
 * Generate permission test scenarios
 */
export function createPermissionTestScenarios() {
  return {
    // Permission level scenarios
    fullPermissions: () => createMockPermissionManager({
      defaultLevel: 'full',
      deniedTools: [],
      deniedScopes: [],
    }),

    limitedPermissions: () => createMockPermissionManager({
      defaultLevel: 'limited',
      deniedTools: [],
      deniedScopes: [],
    }),

    readOnlyPermissions: () => createMockPermissionManager({
      defaultLevel: 'read-only',
      deniedTools: ['Write', 'Edit', 'Delete'],
      deniedScopes: [],
    }),

    noPermissions: () => createMockPermissionManager({
      defaultLevel: 'none',
      deniedTools: ['*'],
      deniedScopes: ['*'],
    }),

    // Tool-specific denials
    deniedFileOperations: () => createMockPermissionManager({
      defaultLevel: 'full',
      deniedTools: ['Write', 'Edit', 'Delete'],
    }),

    deniedNetworkOperations: () => createMockPermissionManager({
      defaultLevel: 'full',
      deniedTools: ['WebFetch', 'WebSearch'],
    }),

    deniedSystemOperations: () => createMockPermissionManager({
      defaultLevel: 'full',
      deniedTools: ['Bash', 'System'],
    }),

    // Scope-specific denials
    deniedSensitiveScopes: () => createMockPermissionManager({
      defaultLevel: 'full',
      deniedScopes: ['/.env', '/config/', '/secrets/', '/.git/'],
    }),

    deniedProductionScopes: () => createMockPermissionManager({
      defaultLevel: 'full',
      deniedScopes: ['/prod/', '/production/', '/deploy/'],
    }),

    // System failure scenarios
    permissionSystemDown: () => createMockPermissionManager({
      simulateFailures: true,
    }),
  };
}

// ============================================================================
// Assertion Helpers
// ============================================================================

/**
 * Assert that an approval was requested correctly
 */
export function assertApprovalRequested(
  events: AutonomyEvent[],
  expectedAction: string,
  expectedAgent?: string
): void {
  const approvalEvents = events.filter(e => e.type === 'approval_requested');
  expect(approvalEvents.length).toBeGreaterThan(0);

  const relevantEvent = approvalEvents.find(e => e.action === expectedAction);
  expect(relevantEvent).toBeDefined();
  expect(relevantEvent!.timestamp).toBeInstanceOf(Date);

  if (expectedAgent) {
    expect(relevantEvent!.agent).toBe(expectedAgent);
  }
}

/**
 * Assert that an approval was granted or denied correctly
 */
export function assertApprovalResponse(
  events: AutonomyEvent[],
  expectedOutcome: 'granted' | 'denied',
  expectedReason?: string
): void {
  const responseEvents = events.filter(e => e.type === `approval_${expectedOutcome}`);
  expect(responseEvents.length).toBeGreaterThan(0);

  const latestEvent = responseEvents[responseEvents.length - 1];
  expect(latestEvent.timestamp).toBeInstanceOf(Date);

  if (expectedReason) {
    expect(latestEvent.reason).toContain(expectedReason);
  }
}

/**
 * Assert that autonomy boundaries were enforced correctly
 */
export function assertAutonomyBoundaryEnforced(
  events: AutonomyEvent[],
  expectedAction: string,
  expectedLevel: AutonomyLevel
): void {
  const boundaryEvents = events.filter(e => e.type === 'boundary_enforced');
  expect(boundaryEvents.length).toBeGreaterThan(0);

  const relevantEvent = boundaryEvents.find(e => e.action === expectedAction);
  expect(relevantEvent).toBeDefined();
  expect(relevantEvent!.level).toBe(expectedLevel);
}

/**
 * Assert that resource limits were respected
 */
export function assertResourceLimitsRespected(
  checkResult: ResourceLimitCheck,
  shouldBeWithinLimits: boolean = true
): void {
  if (shouldBeWithinLimits) {
    expect(checkResult.withinLimits).toBe(true);
    expect(checkResult.violations).toHaveLength(0);
  } else {
    expect(checkResult.withinLimits).toBe(false);
    expect(checkResult.violations.length).toBeGreaterThan(0);
  }

  expect(checkResult.estimatedUsage).toBeDefined();
  expect(Array.isArray(checkResult.recommendations)).toBe(true);
}

/**
 * Assert that permission was handled correctly
 */
export function assertPermissionHandled(
  result: ToolPermissionResult,
  expectedOutcome: 'allowed' | 'denied',
  expectedLevel?: PermissionLevel
): void {
  if (expectedOutcome === 'allowed') {
    expect(result.allowed).toBe(true);
    expect(result.level).toBeDefined();
    if (expectedLevel) {
      expect(result.level).toBe(expectedLevel);
    }
  } else {
    expect(result.allowed).toBe(false);
    expect(result.level).toBeNull();
    expect(result.denialReason).toBeDefined();
    expect(typeof result.denialReason).toBe('string');
  }
}

/**
 * Assert that approval flow timing is correct
 */
export function assertApprovalTiming(
  events: AutonomyEvent[],
  expectedMaxDuration: number
): void {
  const requestEvents = events.filter(e => e.type === 'approval_requested');
  const responseEvents = events.filter(e => e.type === 'approval_granted' || e.type === 'approval_denied');

  expect(requestEvents.length).toBeGreaterThan(0);
  expect(responseEvents.length).toBeGreaterThan(0);

  const latestRequest = requestEvents[requestEvents.length - 1];
  const latestResponse = responseEvents[responseEvents.length - 1];

  const duration = latestResponse.timestamp.getTime() - latestRequest.timestamp.getTime();
  expect(duration).toBeLessThanOrEqual(expectedMaxDuration);
  expect(duration).toBeGreaterThan(0);
}

/**
 * Assert that task state transitions are correct
 */
export function assertTaskStateTransition(
  initialState: TaskStatus,
  finalState: TaskStatus,
  expectedTransitions: TaskStatus[]
): void {
  expect(expectedTransitions[0]).toBe(initialState);
  expect(expectedTransitions[expectedTransitions.length - 1]).toBe(finalState);

  // Validate that all transitions are valid
  // TaskStatus enum: 'pending' | 'queued' | 'planning' | 'in-progress' | 'waiting-approval' | 'awaiting-approval' | 'paused' | 'completed' | 'failed' | 'cancelled'
  const validTransitions: Record<TaskStatus, TaskStatus[]> = {
    'pending': ['queued', 'in-progress', 'paused', 'cancelled'],
    'queued': ['planning', 'in-progress', 'paused', 'cancelled'],
    'planning': ['in-progress', 'paused', 'cancelled', 'failed'],
    'in-progress': ['completed', 'failed', 'paused', 'cancelled', 'awaiting-approval'],
    'waiting-approval': ['in-progress', 'cancelled', 'paused'],
    'awaiting-approval': ['in-progress', 'cancelled', 'paused'],
    'paused': ['in-progress', 'cancelled', 'queued'],
    'completed': [],
    'failed': ['in-progress', 'pending'],
    'cancelled': [],
  };

  for (let i = 0; i < expectedTransitions.length - 1; i++) {
    const current = expectedTransitions[i];
    const next = expectedTransitions[i + 1];
    expect(validTransitions[current]).toContain(next);
  }
}

/**
 * Collect autonomy events for a specific duration
 */
export async function collectAutonomyEvents(
  emitter: EventEmitter,
  timeout: number = 1000
): Promise<AutonomyEvent[]> {
  const events: AutonomyEvent[] = [];

  const handlers = {
    approval_requested: (event: any) => events.push({ type: 'approval_requested', timestamp: new Date(), ...event }),
    approval_granted: (event: any) => events.push({ type: 'approval_granted', timestamp: new Date(), ...event }),
    approval_denied: (event: any) => events.push({ type: 'approval_denied', timestamp: new Date(), ...event }),
    boundary_enforced: (event: any) => events.push({ type: 'boundary_enforced', timestamp: new Date(), ...event }),
    limit_exceeded: (event: any) => events.push({ type: 'limit_exceeded', timestamp: new Date(), ...event }),
  };

  Object.entries(handlers).forEach(([event, handler]) => {
    emitter.on(event, handler);
  });

  await new Promise(resolve => setTimeout(resolve, timeout));

  Object.entries(handlers).forEach(([event, handler]) => {
    emitter.off(event, handler);
  });

  return events;
}

/**
 * Assert that no system errors occurred during testing
 */
export function assertNoSystemErrors(context: AutonomyTestContext): void {
  // Check that all mock functions are still operational
  expect(context.autonomyManager.checkAutonomyLevel).toBeDefined();
  expect(context.permissionManager.checkToolPermission).toBeDefined();
  expect(context.taskManager.getCurrentTask).toBeDefined();

  // Check that event emitter is still functional
  expect(typeof context.eventEmitter.emit).toBe('function');
  expect(typeof context.eventEmitter.on).toBe('function');

  // Verify no critical events were missed
  const criticalEvents = context.events.filter(e =>
    e.type === 'limit_exceeded' && e.reason?.includes('critical')
  );
  expect(criticalEvents).toHaveLength(0);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Wait for approval with timeout
 */
export async function waitForApproval(
  context: AutonomyTestContext,
  timeout: number = 5000
): Promise<ApprovalResponse | null> {
  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => resolve(null), timeout);

    const handler = (event: AutonomyEvent) => {
      if (event.type === 'approval_granted' || event.type === 'approval_denied') {
        clearTimeout(timeoutId);
        context.eventEmitter.off('approval_granted', handler);
        context.eventEmitter.off('approval_denied', handler);

        resolve({
          approved: event.type === 'approval_granted',
          timestamp: event.timestamp,
          reason: event.reason,
          metadata: event.metadata,
        });
      }
    };

    context.eventEmitter.on('approval_granted', handler);
    context.eventEmitter.on('approval_denied', handler);
  });
}

/**
 * Simulate user approval workflow
 */
export async function simulateUserWorkflow(
  context: AutonomyTestContext,
  workflow: Array<{
    action: string;
    expectedApproval?: boolean;
    approvalDelay?: number;
    expectedOutcome?: 'success' | 'denied' | 'timeout';
  }>
): Promise<{ results: any[]; events: AutonomyEvent[] }> {
  const results: any[] = [];
  const startingEvents = [...context.events];

  for (const step of workflow) {
    const { action, expectedApproval = true, approvalDelay = 100, expectedOutcome = 'success' } = step;

    // Set up auto-response if needed
    if (expectedApproval) {
      context.approvalSimulator.setAutoResponse('approve', approvalDelay);
    } else {
      context.approvalSimulator.setAutoResponse('deny', approvalDelay);
    }

    // Simulate the action
    const requiresApproval = context.autonomyManager.requiresApproval(context.config.level, action);

    if (requiresApproval) {
      // Emit approval request
      context.eventEmitter.emit('approval_requested', {
        action,
        level: context.config.level,
        taskId: 'test-task',
      });

      // Simulate approval response
      const response = expectedApproval
        ? await context.approvalSimulator.simulateApproval(approvalDelay)
        : await context.approvalSimulator.simulateDenial(undefined, approvalDelay);

      // Emit approval response
      const eventType = response.approved ? 'approval_granted' : 'approval_denied';
      context.eventEmitter.emit(eventType, {
        action,
        reason: response.reason,
        timestamp: response.timestamp,
      });

      results.push({
        action,
        requiresApproval: true,
        approved: response.approved,
        reason: response.reason,
      });
    } else {
      results.push({
        action,
        requiresApproval: false,
        approved: true,
        reason: 'No approval required',
      });
    }

    // Clear auto-response
    context.approvalSimulator.clearAutoResponse();
  }

  const newEvents = context.events.slice(startingEvents.length);
  return { results, events: newEvents };
}

/**
 * Reset test context to initial state
 */
export function resetAutonomyTestContext(context: AutonomyTestContext): void {
  // Clear events
  context.events.length = 0;

  // Remove all event listeners
  context.eventEmitter.removeAllListeners();

  // Re-setup event tracking
  const eventTypes: AutonomyEvent['type'][] = [
    'approval_requested',
    'approval_granted',
    'approval_denied',
    'boundary_enforced',
    'limit_exceeded',
  ];

  eventTypes.forEach(eventType => {
    context.eventEmitter.on(eventType, (event) => {
      context.events.push({ type: eventType, timestamp: new Date(), ...event });
    });
  });

  // Clear auto-response
  context.approvalSimulator.clearAutoResponse();

  // Reset mocks
  vi.clearAllMocks();
}

// ============================================================================
// Enhanced Autonomy Boundary Testing
// ============================================================================

/**
 * Test autonomy boundary conditions with various edge cases
 */
export function createAutonomyBoundaryTestScenarios() {
  return {
    // Boundary edge cases
    autonomyLevelTransitions: () => {
      const context = createAutonomyTestContext({ defaultLevel: 'full-auto' });

      // Add method to transition between autonomy levels during test
      (context as any).transitionToLevel = async (newLevel: AutonomyLevel) => {
        context.config.level = newLevel;
        context.autonomyManager.checkAutonomyLevel = vi.fn(async () => newLevel);

        context.eventEmitter.emit('boundary_enforced', {
          action: 'autonomy_transition',
          level: newLevel,
          reason: `Autonomy level changed to ${newLevel}`,
        });
      };

      return context;
    },

    conditionalApprovals: () => {
      const context = createAutonomyTestContext({ defaultLevel: 'review-all' });
      let approvalCondition: (action: string) => boolean = () => true;

      // Override approval simulator to use conditions
      const originalRequestApproval = context.autonomyManager.requestApproval;
      context.autonomyManager.requestApproval = vi.fn(async (params: ApprovalRequest) => {
        const shouldApprove = approvalCondition(params.action);
        return {
          approved: shouldApprove,
          timestamp: new Date(),
          reason: shouldApprove ? 'Condition met' : 'Condition not met',
          metadata: { condition: approvalCondition.toString() },
        };
      });

      (context as any).setApprovalCondition = (condition: (action: string) => boolean) => {
        approvalCondition = condition;
      };

      return context;
    },

    approvalTimeouts: () => {
      const context = createAutonomyTestContext({
        defaultLevel: 'review-all',
        approvalTimeout: 1 // 1 second timeout
      });

      // Override to simulate timeout scenarios
      context.approvalSimulator.simulateTimeout = vi.fn(async (timeout = 500) => {
        await new Promise(resolve => setTimeout(resolve, timeout));
        return {
          approved: false,
          timestamp: new Date(),
          timeout: true,
          reason: 'Approval request timed out',
        };
      });

      return context;
    },

    resourceLimitViolations: () => {
      const context = createAutonomyTestContext({
        defaultLevel: 'full-auto',
        resourceLimits: {
          maxTokens: 100,
          maxCost: 0.10,
          maxDuration: 1, // 1 second
          maxRetries: 1,
          maxFiles: 2,
          maxFileSize: 1024, // 1KB
        }
      });

      // Add method to trigger limit violations
      (context as any).exceedLimit = (limitType: 'tokens' | 'cost' | 'duration' | 'files') => {
        const task = context.taskManager.getCurrentTask();
        if (!task) return;

        const violations = {
          tokens: () => { task.usage!.totalTokens = 200; },
          cost: () => { task.usage!.estimatedCost = 0.20; },
          duration: () => { task.createdAt = new Date(Date.now() - 2000); },
          files: () => { task.artifacts = [{}, {}, {}] as any; }
        };

        violations[limitType]();

        context.eventEmitter.emit('limit_exceeded', {
          action: 'resource_check',
          reason: `${limitType} limit exceeded`,
          metadata: { limitType, task: task.id },
        });
      };

      return context;
    },

    gradualAutonomyReduction: () => {
      const levels: AutonomyLevel[] = ['full-auto', 'review-before-commit', 'review-all'];
      let currentLevelIndex = 0;

      const context = createAutonomyTestContext({ defaultLevel: levels[0] });

      // Automatically reduce autonomy on each violation
      const originalEnforceAutonomyBoundary = context.autonomyManager.enforceAutonomyBoundary;
      context.autonomyManager.enforceAutonomyBoundary = vi.fn(async (action: string, contextData: any) => {
        const result = await originalEnforceAutonomyBoundary.call(context.autonomyManager, action, contextData);

        if (!result && currentLevelIndex < levels.length - 1) {
          currentLevelIndex++;
          const newLevel = levels[currentLevelIndex];
          context.config.level = newLevel;

          context.eventEmitter.emit('boundary_enforced', {
            action,
            level: newLevel,
            reason: `Autonomy reduced to ${newLevel} due to boundary violation`,
          });
        }

        return result;
      });

      return context;
    },

    approvalChaining: () => {
      const context = createAutonomyTestContext({ defaultLevel: 'review-all' });
      const approvalChain: string[] = [];

      // Track approval chain
      const originalRequestApproval = context.autonomyManager.requestApproval;
      context.autonomyManager.requestApproval = vi.fn(async (params: ApprovalRequest) => {
        approvalChain.push(params.action);

        // Require all actions in chain to be approved for final approval
        const allApproved = approvalChain.length <= 3; // Max 3 chained approvals

        return {
          approved: allApproved,
          timestamp: new Date(),
          reason: allApproved ? 'Approval chain valid' : 'Approval chain too long',
          metadata: { chain: [...approvalChain] },
        };
      });

      (context as any).getApprovalChain = () => [...approvalChain];
      (context as any).clearApprovalChain = () => { approvalChain.length = 0; };

      return context;
    },

    autonomyEscalation: () => {
      const context = createAutonomyTestContext({ defaultLevel: 'review-all' });
      let escalationLevel = 0;

      // Simulate escalation process
      (context as any).escalate = async (reason: string) => {
        escalationLevel++;
        const targetLevel: AutonomyLevel = escalationLevel === 1 ? 'review-before-commit' : 'full-auto';

        context.eventEmitter.emit('approval_requested', {
          action: 'escalate_autonomy',
          level: targetLevel,
          reason: `Escalation ${escalationLevel}: ${reason}`,
          metadata: { escalationLevel, targetLevel },
        });

        // Auto-approve escalation for testing
        setTimeout(() => {
          context.config.level = targetLevel;
          context.eventEmitter.emit('approval_granted', {
            action: 'escalate_autonomy',
            level: targetLevel,
            reason: 'Escalation approved',
          });
        }, 100);
      };

      (context as any).getEscalationLevel = () => escalationLevel;

      return context;
    },

    crossAgentPermissions: () => {
      const context = createAutonomyTestContext({
        defaultLevel: 'review-all',
        agentOverrides: {
          'developer': { level: 'review-before-commit', approvalTimeout: 30 },
          'tester': { level: 'full-auto', approvalTimeout: 0 },
          'reviewer': { level: 'review-all', approvalTimeout: 60 },
        },
      });

      // Simulate agent switching during workflow
      (context as any).switchAgent = async (newAgent: string) => {
        const override = context.config.agentOverrides?.[newAgent];
        if (override && typeof override === 'object') {
          context.config.level = override.level;

          context.eventEmitter.emit('boundary_enforced', {
            action: 'agent_switch',
            agent: newAgent,
            level: override.level,
            reason: `Switched to agent ${newAgent} with level ${override.level}`,
          });
        }
      };

      return context;
    }
  };
}

/**
 * Advanced approval flow simulation for complex scenarios
 */
export function createAdvancedApprovalSimulator(): ApprovalSimulator & {
  simulateComplexWorkflow: (workflow: ComplexWorkflowStep[]) => Promise<ApprovalResponse[]>;
  simulateApprovalConflict: () => Promise<ApprovalResponse>;
  simulatePartialApproval: (approvedActions: string[]) => Promise<ApprovalResponse>;
} {
  const baseSimulator = createApprovalSimulator();

  return {
    ...baseSimulator,

    simulateComplexWorkflow: vi.fn(async (workflow: ComplexWorkflowStep[]) => {
      const results: ApprovalResponse[] = [];

      for (const step of workflow) {
        const delay = step.delay || 100;
        const shouldApprove = step.expectedOutcome !== 'denied';

        const response = shouldApprove
          ? await baseSimulator.simulateApproval(delay)
          : await baseSimulator.simulateDenial(step.denialReason, delay);

        results.push({
          ...response,
          metadata: {
            step: step.action,
            expectedOutcome: step.expectedOutcome,
            agent: step.agent,
          },
        });

        // Break workflow on denial if configured
        if (!response.approved && step.breakOnDenial) {
          break;
        }
      }

      return results;
    }),

    simulateApprovalConflict: vi.fn(async () => {
      // Simulate scenario where multiple approvers give conflicting responses
      await new Promise(resolve => setTimeout(resolve, 100));
      return {
        approved: false,
        timestamp: new Date(),
        reason: 'Approval conflict: multiple conflicting responses received',
        metadata: {
          conflict: true,
          responses: [
            { approver: 'approver1', decision: 'approve' },
            { approver: 'approver2', decision: 'deny' },
          ],
        },
      };
    }),

    simulatePartialApproval: vi.fn(async (approvedActions: string[]) => {
      await new Promise(resolve => setTimeout(resolve, 100));
      return {
        approved: true,
        timestamp: new Date(),
        reason: 'Partial approval granted for specific actions',
        metadata: {
          partial: true,
          approvedActions,
          restrictions: 'Only approved actions may proceed',
        },
      };
    }),
  };
}

/**
 * Configuration for complex workflow steps
 */
export interface ComplexWorkflowStep {
  action: string;
  agent?: string;
  expectedOutcome?: 'approved' | 'denied' | 'timeout';
  delay?: number;
  denialReason?: string;
  breakOnDenial?: boolean;
  prerequisites?: string[];
}