/**
 * @fileoverview Task fixture factories
 *
 * Provides factory functions for creating Task fixtures with sensible defaults.
 * Follows the established pattern from existing test helpers.
 */

import type {
  Task,
  TaskStatus,
  TaskPriority,
  TaskEffort,
  TaskUsage,
  TaskLog,
  TaskArtifact,
} from '../../types.js';
import type { TaskFactoryOptions, FixtureFactory } from '../types.js';

/**
 * Creates default usage data for tasks
 */
function createDefaultUsage(): TaskUsage {
  return {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    estimatedCost: 0,
    totalCostCents: 0,
    executionTimeMs: 0,
  };
}

/**
 * Creates default task log entries
 */
function createDefaultLogs(): TaskLog[] {
  return [
    {
      level: 'info',
      message: 'Task created',
      timestamp: new Date(),
      agent: 'orchestrator',
    },
  ];
}

/**
 * Creates default artifacts array
 */
function createDefaultArtifacts(): TaskArtifact[] {
  return [];
}

/**
 * Creates a Task fixture with sensible defaults
 *
 * @param overrides - Partial Task properties to override defaults
 * @param options - Additional factory options
 * @returns A fully-typed Task object
 *
 * @example
 * ```typescript
 * const task = createTask({
 *   description: 'Custom task description',
 *   status: 'completed'
 * });
 * expect(task.id).toBeDefined();
 * expect(task.status).toBe('completed');
 * ```
 */
export const createTask: FixtureFactory<Task, TaskFactoryOptions> = (
  overrides = {},
  options = {}
): Task => {
  const now = new Date();
  const taskId = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  return {
    id: taskId,
    description: 'Test task description',
    workflow: 'feature',
    autonomy: 'review-before-commit',
    status: options.status || 'pending',
    priority: 'normal' as TaskPriority,
    effort: 'medium' as TaskEffort,
    projectPath: '/test/project',
    retryCount: 0,
    maxRetries: 3,
    resumeAttempts: 0,
    createdAt: now,
    updatedAt: now,
    completedAt: overrides.status === 'completed' || overrides.status === 'failed' ? now : undefined,
    usage: options.includeUsage !== false ? createDefaultUsage() : undefined,
    logs: options.includeLogs !== false ? createDefaultLogs() : [],
    artifacts: options.includeArtifacts !== false ? createDefaultArtifacts() : [],
    error: overrides.status === 'failed' ? 'Test task failed' : undefined,
    ...overrides,
  };
};

/**
 * Creates a pending task fixture
 */
export const createPendingTask: FixtureFactory<Task> = (overrides = {}) =>
  createTask(overrides, { status: 'pending' });

/**
 * Creates a running task fixture
 */
export const createRunningTask: FixtureFactory<Task> = (overrides = {}) =>
  createTask(overrides, { status: 'in-progress' });

/**
 * Creates a completed task fixture
 */
export const createCompletedTask: FixtureFactory<Task> = (overrides = {}) =>
  createTask(overrides, { status: 'completed' });

/**
 * Creates a failed task fixture
 */
export const createFailedTask: FixtureFactory<Task> = (overrides = {}) =>
  createTask({
    error: 'Task execution failed',
    ...overrides,
  }, { status: 'failed' });

/**
 * Creates a paused task fixture
 */
export const createPausedTask: FixtureFactory<Task> = (overrides = {}) =>
  createTask(overrides, { status: 'paused' });

/**
 * Creates a cancelled task fixture
 */
export const createCancelledTask: FixtureFactory<Task> = (overrides = {}) =>
  createTask(overrides, { status: 'cancelled' });

/**
 * Creates a task with specific workflow type
 *
 * @param workflow - The workflow type (e.g., 'feature', 'hotfix', 'bugfix')
 * @param overrides - Additional task properties to override
 * @returns Task fixture with specified workflow
 */
export const createTaskWithWorkflow = (workflow: string, overrides: Partial<Task> = {}): Task =>
  createTask({ workflow, ...overrides });

/**
 * Creates a task with high usage data for testing cost calculations
 */
export const createHighUsageTask: FixtureFactory<Task> = (overrides = {}) =>
  createTask({
    usage: {
      inputTokens: 50000,
      outputTokens: 25000,
      totalTokens: 75000,
      estimatedCost: 15.50,
      totalCostCents: 1550,
      executionTimeMs: 120000,
    },
    ...overrides,
  });

/**
 * Creates a task with extensive logs for testing log handling
 */
export const createTaskWithLogs: FixtureFactory<Task> = (overrides = {}) =>
  createTask({
    logs: [
      {
        level: 'info',
        message: 'Task created',
        timestamp: new Date(Date.now() - 60000),
        agent: 'orchestrator',
      },
      {
        level: 'info',
        message: 'Planning stage started',
        timestamp: new Date(Date.now() - 45000),
        agent: 'planner',
        metadata: { stage: 'planning' },
      },
      {
        level: 'debug',
        message: 'Analyzing project structure',
        timestamp: new Date(Date.now() - 40000),
        agent: 'planner',
      },
      {
        level: 'info',
        message: 'Architecture stage started',
        timestamp: new Date(Date.now() - 30000),
        agent: 'architect',
        metadata: { stage: 'architecture' },
      },
      {
        level: 'warn',
        message: 'Potential breaking change detected',
        timestamp: new Date(Date.now() - 25000),
        agent: 'architect',
      },
      {
        level: 'info',
        message: 'Implementation stage started',
        timestamp: new Date(Date.now() - 15000),
        agent: 'developer',
        metadata: { stage: 'implementation' },
      },
    ],
    ...overrides,
  });

/**
 * Creates a task with artifacts for testing artifact handling
 */
export const createTaskWithArtifacts: FixtureFactory<Task> = (overrides = {}) =>
  createTask({
    artifacts: [
      {
        type: 'file',
        name: 'implementation-plan.md',
        path: '/test/project/docs/implementation-plan.md',
        createdAt: new Date(Date.now() - 30000),
      },
      {
        type: 'file',
        name: 'feature.js',
        path: '/test/project/src/feature.js',
        createdAt: new Date(Date.now() - 15000),
      },
      {
        type: 'diff',
        name: 'changes.patch',
        path: '/test/project/changes.patch',
        createdAt: new Date(Date.now() - 5000),
      },
    ],
    ...overrides,
  });

/**
 * Task preset collections for common testing scenarios
 */
export const TaskPresets = {
  /** Basic task scenarios */
  basic: {
    pending: () => createPendingTask(),
    running: () => createRunningTask(),
    completed: () => createCompletedTask(),
    failed: () => createFailedTask(),
    paused: () => createPausedTask(),
    cancelled: () => createCancelledTask(),
  },

  /** Tasks with different workflow types */
  workflows: {
    feature: () => createTaskWithWorkflow('feature'),
    hotfix: () => createTaskWithWorkflow('hotfix'),
    bugfix: () => createTaskWithWorkflow('bugfix'),
    enhancement: () => createTaskWithWorkflow('enhancement'),
    refactor: () => createTaskWithWorkflow('refactor'),
  },

  /** Tasks with various priority levels */
  priorities: {
    low: () => createTask({ priority: 'low' as TaskPriority }),
    normal: () => createTask({ priority: 'normal' as TaskPriority }),
    high: () => createTask({ priority: 'high' as TaskPriority }),
    urgent: () => createTask({ priority: 'urgent' as TaskPriority }),
  },

  /** Tasks with different effort estimates */
  efforts: {
    xs: () => createTask({ effort: 'xs' as TaskEffort }),
    small: () => createTask({ effort: 'small' as TaskEffort }),
    medium: () => createTask({ effort: 'medium' as TaskEffort }),
    large: () => createTask({ effort: 'large' as TaskEffort }),
    xl: () => createTask({ effort: 'xl' as TaskEffort }),
  },

  /** Tasks with rich data for testing */
  enriched: {
    withUsage: () => createHighUsageTask(),
    withLogs: () => createTaskWithLogs(),
    withArtifacts: () => createTaskWithArtifacts(),
    complete: () => createTask({
      ...createHighUsageTask().usage && { usage: createHighUsageTask().usage },
      logs: createTaskWithLogs().logs,
      artifacts: createTaskWithArtifacts().artifacts,
    }),
  },
} as const;