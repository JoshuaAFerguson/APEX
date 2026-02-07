/**
 * Central test utilities module
 * Exports all test utility functions and classes for easy import across test files
 */

// Export async utilities
export * from './async';

// Export assertion helpers
export * from './assertions';

// Export test context management
export * from './context';

// Export cleanup utilities
export * from './cleanup';

// Export test isolation utilities (see ADR-052)
export * from './isolation';

// Re-export browser test utilities would be available from the browser package if it existed
// Currently these are commented out as the browser package test utilities are not yet available
// TODO: Uncomment when browser package test utilities are implemented

// Export autonomy and permission test helpers
export * from './autonomy-test-helpers';
export * from './permission-test-helpers';

// Export browser automation test infrastructure
export * from './browser-test-base';
export * from './browser-automation-mocks';
export * from './browser-permission-simulator';
export * from './browser-test-fixtures';
export * from './browser-automation-test-setup';
export * from './browser-automation-config';
export * from './browser-error-fixtures';
export * from './browser-utils';

// Export navigation testing utilities
export * from './navigation-test-utils';
export * from './navigation-test-fixtures';

// Export MCP test infrastructure
export * from './mcp-test-base';
export * from './mcp-permission-helpers';
export * from './mock-server-factory';

// Re-export commonly used vitest functions for convenience
export { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from 'vitest';

/**
 * Convenience function to create a complete test environment
 * Sets up context, cleanup, and provides commonly used utilities
 */
export async function createTestEnvironment(options: {
  contextId?: string;
  withDatabase?: boolean;
  withMocks?: boolean;
} = {}) {
  const { createExtendedTestContext, createDatabaseTestContext } = await import('./context');
  const { createCleanupManager } = await import('./cleanup');

  // Create appropriate context based on options
  const context = options.withDatabase
    ? await createDatabaseTestContext(options.contextId)
    : await createExtendedTestContext(options.contextId);

  const cleanup = createCleanupManager();

  return {
    context,
    cleanup,
    tempDir: context.tempDir,
    mocks: context.mocks,
    ...(options.withDatabase && { dbPath: (context as any).dbPath }),
  };
}

/**
 * Quick setup for basic test needs
 * Creates a minimal test environment with cleanup
 */
export async function setupTest() {
  const { createTestContext } = await import('./context');
  const { createCleanupManager } = await import('./cleanup');

  const context = await createTestContext();
  const cleanup = createCleanupManager();

  return {
    context,
    cleanup,
    tempDir: context.tempDir,
  };
}

/**
 * Helper to run a test with automatic cleanup
 */
export async function runWithCleanup<T>(
  testFn: (env: Awaited<ReturnType<typeof createTestEnvironment>>) => Promise<T>,
  options?: Parameters<typeof createTestEnvironment>[0]
): Promise<T> {
  const env = await createTestEnvironment(options);
  try {
    return await testFn(env);
  } finally {
    await Promise.all([
      env.cleanup.cleanup(),
      env.context ? (await import('./context')).cleanupTestContext(env.context) : Promise.resolve(),
    ]);
  }
}

/**
 * Common test fixtures and data
 */
export const testFixtures = {
  /**
   * Sample task data for testing
   */
  sampleTask: {
    id: 'test-task-123',
    description: 'Test task for testing',
    workflow: 'feature',
    status: 'pending' as const,
    autonomy: 'full' as const,
    priority: 'normal' as const,
    retryCount: 0,
    maxRetries: 3,
    dependsOn: [],
    blockedBy: [],
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    usage: {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      estimatedCost: 0,
    },
    logs: [],
    artifacts: [],
  },

  /**
   * Sample config data for testing
   */
  sampleConfig: {
    version: '1.0',
    project: {
      name: 'test-project',
      language: 'typescript' as const,
      testCommand: 'npm test',
      lintCommand: 'npm run lint',
      buildCommand: 'npm run build',
    },
    autonomy: {
      default: 'full' as const,
    },
    models: {
      planning: 'sonnet' as const,
      implementation: 'sonnet' as const,
      review: 'sonnet' as const,
    },
    limits: {
      maxTokensPerTask: 100000,
      maxCostPerTask: 10,
    },
  },

  /**
   * Sample agent definition for testing
   */
  sampleAgent: {
    name: 'test-agent',
    description: 'Test agent for testing',
    tools: ['Read', 'Write', 'Edit'] as const,
    model: 'sonnet' as const,
    prompt: 'You are a test agent.',
  },

  /**
   * Sample workflow definition for testing
   */
  sampleWorkflow: {
    name: 'test-workflow',
    description: 'Test workflow for testing',
    stages: [
      {
        name: 'planning',
        agent: 'planner',
        description: 'Plan the task',
      },
      {
        name: 'implementation',
        agent: 'developer',
        description: 'Implement the task',
      },
      {
        name: 'testing',
        agent: 'tester',
        description: 'Test the implementation',
      },
    ],
  },
};

/**
 * Common test matchers and utilities
 */
export const testUtils = {
  /**
   * Generate a unique test ID
   */
  generateTestId: () => `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,

  /**
   * Create a mock file system path
   */
  mockPath: (...segments: string[]) => segments.join('/'),

  /**
   * Create a test date with optional offset
   */
  testDate: (offsetMs: number = 0) => new Date(Date.now() + offsetMs),

  /**
   * Sleep for testing (use sparingly)
   */
  sleep: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),
};

// Default export for convenience
export default {
  createTestEnvironment,
  setupTest,
  runWithCleanup,
  testFixtures,
  testUtils,
};