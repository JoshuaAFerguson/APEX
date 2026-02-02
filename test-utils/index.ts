/**
 * @fileoverview Centralized test utilities for APEX monorepo
 *
 * This module re-exports all test utilities from the core package and
 * provides additional shared utilities for the entire monorepo.
 *
 * Usage:
 * ```typescript
 * import {
 *   createMockCleanup,
 *   createFileSystemMock,
 *   setupGlobalTestEnvironment,
 *   factories,
 *   assertions,
 *   mocks
 * } from '../../test-utils';
 * ```
 */

// Re-export all test utilities from core package
export * from '../packages/core/src/test-utils.js';
export * from '../packages/core/src/test-setup.js';
export * from '../packages/core/src/test-setup-utils.js';

// Export shared test setup
export * from '../test-setup.js';

// Export shared vitest configurations
export * from '../vitest.shared.config.js';

/**
 * Common test constants used across the monorepo
 */
export const TEST_CONSTANTS = {
  /** Default test timeout in milliseconds */
  DEFAULT_TIMEOUT: 5000,
  /** Integration test timeout in milliseconds */
  INTEGRATION_TIMEOUT: 30000,
  /** E2E test timeout in milliseconds */
  E2E_TIMEOUT: 60000,
  /** Test project path */
  TEST_PROJECT_PATH: '/test/project',
  /** Test session ID prefix */
  TEST_SESSION_PREFIX: 'test-session',
  /** Test timestamp for consistent temporal testing */
  TEST_BASE_DATE: '2023-01-01T00:00:00.000Z',
} as const;

/**
 * Pre-configured test environments
 */
export const TEST_ENVIRONMENTS = {
  /** Unit test environment - fast, isolated, mock-heavy */
  unit: {
    timeout: TEST_CONSTANTS.DEFAULT_TIMEOUT,
    environment: 'node' as const,
    setupMocks: true,
    setupConsole: true,
  },
  /** Integration test environment - real dependencies, extended timeout */
  integration: {
    timeout: TEST_CONSTANTS.INTEGRATION_TIMEOUT,
    environment: 'node' as const,
    setupMocks: false,
    setupConsole: false,
  },
  /** E2E test environment - full system, very long timeout */
  e2e: {
    timeout: TEST_CONSTANTS.E2E_TIMEOUT,
    environment: 'node' as const,
    setupMocks: false,
    setupConsole: false,
  },
  /** Browser test environment - jsdom/happy-dom for UI testing */
  browser: {
    timeout: TEST_CONSTANTS.DEFAULT_TIMEOUT,
    environment: 'jsdom' as const,
    setupMocks: true,
    setupConsole: true,
  },
} as const;

/**
 * Quick setup functions for common test patterns
 */
export const quickSetup = {
  /**
   * Sets up a basic unit test environment
   */
  unit: () => {
    const { setupGlobalTestEnvironment } = require('../test-setup.js');
    setupGlobalTestEnvironment(TEST_ENVIRONMENTS.unit);
  },

  /**
   * Sets up an integration test environment
   */
  integration: () => {
    const { setupGlobalTestEnvironment } = require('../test-setup.js');
    setupGlobalTestEnvironment(TEST_ENVIRONMENTS.integration);
  },

  /**
   * Sets up an E2E test environment
   */
  e2e: () => {
    const { setupGlobalTestEnvironment } = require('../test-setup.js');
    setupGlobalTestEnvironment(TEST_ENVIRONMENTS.e2e);
  },

  /**
   * Sets up a browser/UI test environment
   */
  browser: () => {
    const { setupGlobalTestEnvironment } = require('../test-setup.js');
    setupGlobalTestEnvironment(TEST_ENVIRONMENTS.browser);
  },
};

/**
 * Test helpers for common APEX patterns
 */
export const apexTestHelpers = {
  /**
   * Creates a mock APEX configuration
   */
  createMockApexConfig: (overrides: Record<string, any> = {}) => {
    return {
      projectPath: TEST_CONSTANTS.TEST_PROJECT_PATH,
      autonomy: {
        maxCost: 10.0,
        maxTokens: { input: 100000, output: 50000 },
        requiresApproval: false,
      },
      agents: {
        planner: { model: 'sonnet', temperature: 0.1 },
        architect: { model: 'sonnet', temperature: 0.1 },
        developer: { model: 'sonnet', temperature: 0.1 },
        tester: { model: 'sonnet', temperature: 0.1 },
        reviewer: { model: 'sonnet', temperature: 0.1 },
        devops: { model: 'sonnet', temperature: 0.1 },
      },
      limits: {
        maxConcurrentTasks: 5,
        maxTaskRetries: 3,
        maxSessionDuration: 3600,
      },
      ...overrides,
    };
  },

  /**
   * Creates a mock task object
   */
  createMockTask: (overrides: Record<string, any> = {}) => {
    const { factories } = require('../test-setup.js');
    return {
      id: factories.createTestId('task'),
      name: 'Test Task',
      description: 'A test task for unit testing',
      projectPath: TEST_CONSTANTS.TEST_PROJECT_PATH,
      status: 'pending',
      priority: 'medium',
      estimatedCost: 0.5,
      createdAt: new Date(TEST_CONSTANTS.TEST_BASE_DATE),
      updatedAt: new Date(TEST_CONSTANTS.TEST_BASE_DATE),
      workflow: 'feature-development',
      currentStage: 'planning',
      acceptanceCriteria: ['Task should be completed successfully'],
      ...overrides,
    };
  },

  /**
   * Creates a mock workflow execution
   */
  createMockWorkflowExecution: (overrides: Record<string, any> = {}) => {
    const { factories } = require('../test-setup.js');
    return {
      taskId: factories.createTestId('task'),
      workflowId: 'feature-development',
      currentStage: 'planning',
      stages: ['planning', 'architecture', 'implementation', 'testing', 'review'],
      stageResults: {},
      totalCost: 0,
      totalTokens: { input: 0, output: 0 },
      startedAt: new Date(TEST_CONSTANTS.TEST_BASE_DATE),
      ...overrides,
    };
  },
};