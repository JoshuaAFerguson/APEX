/**
 * Test utilities for web-ui tests
 *
 * This file provides helper functions and mock data generators
 * for testing the APEX Web UI package.
 */

import type {
  Task,
  TaskStatus,
  TaskPriority,
  AutonomyLevel,
  AgentDefinition,
  ApexConfig,
  TaskUsage,
  TaskLog,
  TaskArtifact,
} from '@apexcli/core';

/**
 * Create a mock Task object with default values
 */
export function createMockTask(overrides?: Partial<Task>): Task {
  const now = new Date();

  return {
    id: 'task_123_456',
    description: 'Test task description',
    workflow: 'feature-development',
    autonomy: 'review-before-merge' as AutonomyLevel,
    status: 'pending' as TaskStatus,
    priority: 'normal' as TaskPriority,
    projectPath: '/test/project',
    retryCount: 0,
    maxRetries: 3,
    createdAt: now,
    updatedAt: now,
    usage: createMockTaskUsage(),
    logs: [],
    artifacts: [],
    ...overrides,
  };
}

/**
 * Create a mock TaskUsage object
 */
export function createMockTaskUsage(overrides?: Partial<TaskUsage>): TaskUsage {
  return {
    inputTokens: 1000,
    outputTokens: 500,
    totalTokens: 1500,
    estimatedCost: 0.0225,
    ...overrides,
  };
}

/**
 * Create a mock TaskLog entry
 */
export function createMockTaskLog(
  overrides?: Partial<TaskLog>
): TaskLog {
  return {
    timestamp: new Date(),
    level: 'info',
    agent: 'test-agent',
    stage: 'test-stage',
    message: 'Test log message',
    ...overrides,
  };
}

/**
 * Create a mock TaskArtifact
 */
export function createMockTaskArtifact(
  overrides?: Partial<TaskArtifact>
): TaskArtifact {
  return {
    type: 'file',
    path: '/test/file.ts',
    description: 'Test artifact',
    content: 'test content',
    metadata: {},
    ...overrides,
  };
}

/**
 * Create a mock AgentDefinition
 */
export function createMockAgent(
  overrides?: Partial<AgentDefinition>
): AgentDefinition {
  return {
    name: 'test-agent',
    description: 'Test agent description',
    prompt: 'You are a test agent',
    model: 'sonnet',
    tools: ['Read', 'Write'],
    skills: ['testing'],
    ...overrides,
  };
}

/**
 * Create a mock ApexConfig
 */
export function createMockConfig(
  overrides?: Partial<ApexConfig>
): ApexConfig {
  return {
    version: '1.0',
    project: {
      name: 'test-project',
      testCommand: 'npm test',
      lintCommand: 'npm run lint',
      buildCommand: 'npm run build',
    },
    autonomy: {
      default: 'review-before-merge',
    },
    models: {
      planning: 'opus',
      implementation: 'sonnet',
      review: 'haiku',
    },
    git: {
      branchPrefix: 'apex/',
      commitFormat: 'conventional',
      autoPush: true,
      defaultBranch: 'main',
    },
    limits: {
      maxTokensPerTask: 500000,
      maxCostPerTask: 10.0,
      dailyBudget: 100.0,
      maxTurns: 100,
      maxConcurrentTasks: 3,
      maxRetries: 3,
      retryDelayMs: 1000,
      retryBackoffFactor: 2,
    },
    api: {
      url: 'http://localhost:3000',
      port: 3000,
    },
    ...overrides,
  } as ApexConfig;
}

/**
 * Create multiple mock tasks with different statuses
 */
export function createMockTasks(count: number = 5): Task[] {
  const statuses: TaskStatus[] = [
    'pending',
    'in-progress',
    'completed',
    'failed',
    'waiting-approval',
  ];

  return Array.from({ length: count }, (_, i) => {
    const status = statuses[i % statuses.length];
    return createMockTask({
      id: `task_${i}_${Math.random().toString(36).substr(2, 9)}`,
      description: `Test task ${i + 1}`,
      status,
      createdAt: new Date(Date.now() - i * 60000), // Stagger by 1 minute
    });
  });
}

/**
 * Mock fetch response helper
 */
export function mockFetchResponse<T>(
  data: T,
  options?: {
    ok?: boolean;
    status?: number;
    statusText?: string;
  }
): Response {
  return {
    ok: options?.ok ?? true,
    status: options?.status ?? 200,
    statusText: options?.statusText ?? 'OK',
    json: async () => data,
    text: async () => JSON.stringify(data),
    blob: async () => new Blob([JSON.stringify(data)]),
    arrayBuffer: async () => new ArrayBuffer(0),
    formData: async () => new FormData(),
    headers: new Headers(),
    redirected: false,
    type: 'basic',
    url: '',
    clone: function() { return this; },
    body: null,
    bodyUsed: false,
  } as Response;
}

/**
 * Mock fetch error response helper
 */
export function mockFetchError(
  message: string,
  status: number = 500
): Response {
  return mockFetchResponse(
    { message },
    {
      ok: false,
      status,
      statusText: getStatusText(status),
    }
  );
}

/**
 * Get HTTP status text for a status code
 */
function getStatusText(status: number): string {
  const statusTexts: Record<number, string> = {
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
  };
  return statusTexts[status] || 'Unknown';
}

/**
 * Wait for a specific amount of time (useful for async tests)
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create a date relative to now
 */
export function createRelativeDate(options: {
  seconds?: number;
  minutes?: number;
  hours?: number;
  days?: number;
}): Date {
  const now = Date.now();
  const offset =
    (options.seconds || 0) * 1000 +
    (options.minutes || 0) * 60 * 1000 +
    (options.hours || 0) * 60 * 60 * 1000 +
    (options.days || 0) * 24 * 60 * 60 * 1000;

  return new Date(now - offset);
}
