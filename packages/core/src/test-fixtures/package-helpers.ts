/**
 * @fileoverview Package-Specific Test Suite Helpers
 *
 * This module provides pre-configured test suites for different APEX packages,
 * making it easier to adopt standardized testing patterns across the codebase.
 */

import { vi } from 'vitest';
import { createTestSuite, type SetupTeardownHooks } from './setup-teardown.js';

/**
 * Creates a test suite optimized for CLI package tests
 */
export function createCLITestSuite(options: {
  mockFileSystem?: Record<string, string>;
  mockEnvVars?: Record<string, string>;
  customSetup?: () => void | Promise<void>;
  customTeardown?: () => void | Promise<void>;
} = {}): SetupTeardownHooks {
  return createTestSuite({
    setupMocks: true,
    mockConfig: {
      mockFs: true,
      mockData: {
        fileSystemData: options.mockFileSystem || {},
        envVars: {
          APEX_PROJECT_PATH: '/test/project',
          NODE_ENV: 'test',
          ...options.mockEnvVars,
        },
      },
    },
    customSetup: options.customSetup,
    customTeardown: options.customTeardown,
  });
}

/**
 * Creates a test suite optimized for Orchestrator package tests
 */
export function createOrchestratorTestSuite(options: {
  mockAgents?: string[];
  mockApiResponses?: Record<string, any>;
  timeout?: number;
  customSetup?: () => void | Promise<void>;
  customTeardown?: () => void | Promise<void>;
} = {}): SetupTeardownHooks {
  const mockAgents: Record<string, ReturnType<typeof vi.fn>> = {};
  (options.mockAgents || []).forEach(agent => {
    mockAgents[agent] = vi.fn();
  });

  return createTestSuite({
    setupMocks: true,
    timeout: options.timeout || 60000,
    mockConfig: {
      mockNetwork: true,
      customMocks: {
        ...mockAgents,
        taskStore: vi.fn(),
        claudeSDK: vi.fn(),
      },
      mockData: {
        apiResponses: options.mockApiResponses || {},
        envVars: {
          NODE_ENV: 'test',
        },
      },
    },
    customSetup: options.customSetup,
    customTeardown: options.customTeardown,
  });
}

/**
 * Creates a test suite optimized for Core package tests
 */
export function createCoreTestSuite(options: {
  enableMocks?: boolean;
  customSetup?: () => void | Promise<void>;
  customTeardown?: () => void | Promise<void>;
} = {}): SetupTeardownHooks {
  return createTestSuite({
    setupMocks: options.enableMocks || false,
    cleanupAfterEach: true,
    customSetup: options.customSetup,
    customTeardown: options.customTeardown,
  });
}

/**
 * Creates a test suite for timer-based testing
 */
export function createTimerTestSuite(options: {
  customSetup?: () => void | Promise<void>;
  customTeardown?: () => void | Promise<void>;
} = {}): SetupTeardownHooks {
  return createTestSuite({
    useFakeTimers: true,
    setupMocks: false,
    customSetup: options.customSetup,
    customTeardown: options.customTeardown,
  });
}