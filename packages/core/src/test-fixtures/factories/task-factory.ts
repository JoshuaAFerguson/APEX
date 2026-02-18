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
  Artifact
} from '../../types.js';
import type { TaskFactoryOptions, FixtureFactory } from '../types.js';

/**
 * Creates default usage data for tasks
 */
function createDefaultUsage(): TaskUsage {
  return {
    tokenUsage: {
      inputTokens: 0,
      outputTokens: 0,
      cacheReadInputTokens: 0,
      cacheWriteInputTokens: 0,
    },
    costEstimate: 0,
    agentCosts: {},
    stageCosts: {},
    toolCosts: {},
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
      source: 'orchestrator',
    },
  ];
}

/**
 * Creates default artifacts array
 */
function createDefaultArtifacts(): Artifact[] {
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
    startedAt: overrides.status !== 'pending' ? now : undefined,
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
  createTask(overrides, { status: 'running' });

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
      tokenUsage: {
        inputTokens: 50000,
        outputTokens: 25000,
        cacheReadInputTokens: 10000,
        cacheWriteInputTokens: 5000,
      },
      costEstimate: 15.50,
      agentCosts: {
        'planner': 2.50,
        'architect': 3.75,
        'developer': 6.25,
        'reviewer': 2.00,
        'tester': 1.00,
      },
      stageCosts: {
        'planning': 2.50,
        'architecture': 3.75,
        'implementation': 6.25,
        'review': 2.00,
        'testing': 1.00,
      },
      toolCosts: {
        'Read': 0.25,
        'Write': 0.50,
        'Bash': 1.25,
      },
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
        source: 'orchestrator',
      },
      {
        level: 'info',
        message: 'Planning stage started',
        timestamp: new Date(Date.now() - 45000),
        source: 'planner',
        metadata: { stage: 'planning' },
      },
      {
        level: 'debug',
        message: 'Analyzing project structure',
        timestamp: new Date(Date.now() - 40000),
        source: 'planner',
      },
      {
        level: 'info',
        message: 'Architecture stage started',
        timestamp: new Date(Date.now() - 30000),
        source: 'architect',
        metadata: { stage: 'architecture' },
      },
      {
        level: 'warn',
        message: 'Potential breaking change detected',
        timestamp: new Date(Date.now() - 25000),
        source: 'architect',
      },
      {
        level: 'info',
        message: 'Implementation stage started',
        timestamp: new Date(Date.now() - 15000),
        source: 'developer',
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
        size: 2048,
        mimeType: 'text/markdown',
        createdAt: new Date(Date.now() - 30000),
        description: 'Implementation plan document',
      },
      {
        type: 'file',
        name: 'feature.js',
        path: '/test/project/src/feature.js',
        size: 4096,
        mimeType: 'text/javascript',
        createdAt: new Date(Date.now() - 15000),
        description: 'Main feature implementation',
      },
      {
        type: 'diff',
        name: 'changes.patch',
        path: '/test/project/changes.patch',
        size: 1024,
        mimeType: 'text/plain',
        createdAt: new Date(Date.now() - 5000),
        description: 'Code changes patch',
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
    minimal: () => createTask({ effort: 'minimal' as TaskEffort }),
    small: () => createTask({ effort: 'small' as TaskEffort }),
    medium: () => createTask({ effort: 'medium' as TaskEffort }),
    large: () => createTask({ effort: 'large' as TaskEffort }),
    xlarge: () => createTask({ effort: 'xlarge' as TaskEffort }),
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