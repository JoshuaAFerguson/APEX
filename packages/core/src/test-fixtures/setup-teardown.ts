/**
 * @fileoverview Test Setup and Teardown Patterns
 *
 * This module provides reusable beforeEach/afterEach patterns for APEX tests.
 * It handles common setup tasks like mocking, state initialization, and cleanup.
 *
 * ## Quick Start
 *
 * Replace manual beforeEach/afterEach patterns with standardized test suites:
 *
 * @example Basic usage:
 * ```typescript
 * import { createTestSuite } from '@apex/core/test-fixtures';
 *
 * describe('My Test Suite', () => {
 *   const suite = createTestSuite({
 *     setupMocks: true,
 *     cleanupAfterEach: true
 *   });
 *
 *   beforeEach(suite.beforeEach);
 *   afterEach(suite.afterEach);
 *
 *   it('should run with proper setup', () => {
 *     // Test implementation - environment is automatically prepared and cleaned
 *   });
 * });
 * ```
 *
 * @example CLI package tests (with file system mocks):
 * ```typescript
 * describe('SessionStore', () => {
 *   const suite = createTestSuite({
 *     setupMocks: true,
 *     mockConfig: {
 *       mockFs: true,
 *       mockData: {
 *         fileSystemData: {
 *           '/test/sessions/session1.json': '{"id": "session1"}'
 *         }
 *       }
 *     }
 *   });
 *
 *   beforeEach(suite.beforeEach);
 *   afterEach(suite.afterEach);
 *
 *   it('loads sessions from filesystem', async () => {
 *     // fs.readFile automatically returns mocked data
 *   });
 * });
 * ```
 *
 * @example Orchestrator package tests (with database and agent mocks):
 * ```typescript
 * describe('ApexOrchestrator', () => {
 *   const suite = createTestSuite({
 *     setupMocks: true,
 *     timeout: 60000,
 *     mockConfig: {
 *       customMocks: {
 *         claudeAgent: vi.fn(),
 *         taskStore: vi.fn()
 *       }
 *     },
 *     customSetup: async () => {
 *       const testDb = await initializeTestDatabase();
 *       addCleanupTask(() => testDb.close());
 *     }
 *   });
 *
 *   beforeEach(suite.beforeEach);
 *   afterEach(suite.afterEach);
 * });
 * ```
 *
 * @example With custom setup/teardown:
 * ```typescript
 * describe('Custom Suite', () => {
 *   const suite = createTestSuite({
 *     customSetup: async () => {
 *       // Custom initialization
 *     },
 *     customTeardown: async () => {
 *       // Custom cleanup
 *     }
 *   });
 *
 *   beforeEach(suite.beforeEach);
 *   afterEach(suite.afterEach);
 * });
 * ```
 *
 * @example Timer-based tests:
 * ```typescript
 * describe('Timer Operations', () => {
 *   const suite = createTestSuite({ useFakeTimers: true });
 *
 *   beforeEach(suite.beforeEach);
 *   afterEach(suite.afterEach);
 *
 *   it('handles delayed operations', async () => {
 *     setTimeout(callback, 5000);
 *     await advanceTimers(5000);
 *     expect(callback).toHaveBeenCalled();
 *   });
 * });
 * ```
 *
 * See USAGE_GUIDE.md for comprehensive examples and migration patterns.
 */

import { vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

import type {
  TestSuiteConfig,
  SetupTeardownHooks,
  TestEnvironment,
  MockConfig,
} from './types.js';

// Global test environment state
let globalTestEnvironment: TestEnvironment | null = null;

/**
 * Creates a test suite with standardized setup and teardown patterns
 */
export function createTestSuite(config: TestSuiteConfig = {}): SetupTeardownHooks {
  const {
    setupMocks = false,
    cleanupAfterEach = true,
    mockConfig = {},
    timeout = 30000,
    useFakeTimers = false,
    customSetup,
    customTeardown,
  } = config;

  const setupHook = async () => {
    // Initialize test environment
    globalTestEnvironment = {
      projectPath: '/test/project',
      activeMocks: new Map(),
      cleanupTasks: [],
      testData: new Map(),
    };

    // Setup fake timers if requested
    if (useFakeTimers) {
      vi.useFakeTimers();
      globalTestEnvironment.cleanupTasks.push(() => vi.useRealTimers());
    }

    // Setup mocks if requested
    if (setupMocks) {
      await setupTestMocks(mockConfig);
    }

    // Run custom setup
    if (customSetup) {
      await customSetup();
    }

    // Set default timeout
    vi.setTimeout(timeout);
  };

  const teardownHook = async () => {
    // Run custom teardown first
    if (customTeardown) {
      try {
        await customTeardown();
      } catch (error) {
        console.warn('Custom teardown failed:', error);
      }
    }

    // Run all cleanup tasks
    if (globalTestEnvironment) {
      for (const cleanup of globalTestEnvironment.cleanupTasks) {
        try {
          await cleanup();
        } catch (error) {
          console.warn('Cleanup task failed:', error);
        }
      }
    }

    // Clear all mocks if cleanup is enabled
    if (cleanupAfterEach) {
      await cleanupTestState();
    }

    // Reset global state
    globalTestEnvironment = null;
  };

  return {
    beforeEach: setupHook,
    afterEach: teardownHook,
  };
}

/**
 * Sets up common test mocks based on configuration
 */
export async function setupTestMocks(config: MockConfig): Promise<void> {
  const { mockFs, mockNetwork, mockTimers, customMocks, mockData } = config;

  // Mock file system operations
  if (mockFs) {
    setupFileSystemMocks(mockData?.fileSystemData || {});
  }

  // Mock network operations
  if (mockNetwork) {
    setupNetworkMocks(mockData?.apiResponses || {});
  }

  // Mock timers
  if (mockTimers) {
    vi.useFakeTimers();
    addCleanupTask(() => vi.useRealTimers());
  }

  // Setup custom mocks
  if (customMocks) {
    Object.entries(customMocks).forEach(([name, mock]) => {
      if (globalTestEnvironment) {
        globalTestEnvironment.activeMocks.set(name, mock);
      }
    });
  }

  // Setup environment variables if provided
  if (mockData?.envVars) {
    Object.entries(mockData.envVars).forEach(([key, value]) => {
      vi.stubEnv(key, value);
    });
    addCleanupTask(() => vi.unstubAllEnvs());
  }
}

/**
 * Sets up file system mocks
 */
export function setupFileSystemMocks(fileData: Record<string, string>): void {
  vi.mock('fs/promises', async () => {
    const actual = await vi.importActual<typeof import('fs/promises')>('fs/promises');

    return {
      ...actual,
      readFile: vi.fn().mockImplementation(async (filePath: string) => {
        const normalizedPath = typeof filePath === 'string' ? filePath : filePath.toString();
        if (fileData[normalizedPath]) {
          return fileData[normalizedPath];
        }
        throw new Error(`ENOENT: no such file or directory, open '${normalizedPath}'`);
      }),
      writeFile: vi.fn().mockResolvedValue(undefined),
      mkdir: vi.fn().mockResolvedValue(undefined),
      unlink: vi.fn().mockResolvedValue(undefined),
      readdir: vi.fn().mockResolvedValue([]),
      stat: vi.fn().mockImplementation(async (filePath: string) => {
        const normalizedPath = typeof filePath === 'string' ? filePath : filePath.toString();
        if (fileData[normalizedPath]) {
          return {
            isFile: () => true,
            isDirectory: () => false,
            size: fileData[normalizedPath].length,
            mtime: new Date(),
          };
        }
        throw new Error(`ENOENT: no such file or directory, stat '${normalizedPath}'`);
      }),
    };
  });

  addCleanupTask(() => vi.unmock('fs/promises'));
}

/**
 * Sets up network mocks
 */
export function setupNetworkMocks(apiResponses: Record<string, any>): void {
  // Mock fetch for web requests
  global.fetch = vi.fn().mockImplementation(async (url: string | Request) => {
    const urlString = typeof url === 'string' ? url : url.url;

    if (apiResponses[urlString]) {
      return new Response(JSON.stringify(apiResponses[urlString]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    throw new Error(`Network request to ${urlString} was not mocked`);
  });

  addCleanupTask(() => {
    vi.unmock('node:fetch');
    delete (global as any).fetch;
  });
}

/**
 * Adds a cleanup task to be run during teardown
 */
export function addCleanupTask(cleanup: () => void | Promise<void>): void {
  if (globalTestEnvironment) {
    globalTestEnvironment.cleanupTasks.push(cleanup);
  }
}

/**
 * Cleans up all test state and mocks
 */
export async function cleanupTestState(): Promise<void> {
  // Clear all mock implementations
  vi.clearAllMocks();
  vi.resetAllMocks();

  // Clean up temporary files if any were created
  if (globalTestEnvironment?.tempDir) {
    try {
      await fs.rm(globalTestEnvironment.tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to cleanup temp directory:', error);
    }
  }

  // Clear test data
  if (globalTestEnvironment) {
    globalTestEnvironment.testData.clear();
    globalTestEnvironment.activeMocks.clear();
  }
}

/**
 * Gets the current test environment state
 */
export function getTestEnvironment(): TestEnvironment | null {
  return globalTestEnvironment;
}

/**
 * Sets test data that can be accessed across the test
 */
export function setTestData(key: string, value: any): void {
  if (globalTestEnvironment) {
    globalTestEnvironment.testData.set(key, value);
  }
}

/**
 * Gets test data by key
 */
export function getTestData(key: string): any {
  return globalTestEnvironment?.testData.get(key);
}

/**
 * Creates a temporary directory for test files
 */
export async function createTempDir(): Promise<string> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-test-'));

  if (globalTestEnvironment) {
    globalTestEnvironment.tempDir = tempDir;
  }

  addCleanupTask(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to cleanup temp directory:', error);
    }
  });

  return tempDir;
}

/**
 * Helper function to create a mock function with common setup
 */
export function createMockFunction<T extends (...args: any[]) => any>(
  name: string,
  implementation?: T
): ReturnType<typeof vi.fn<T>> {
  const mock = vi.fn(implementation);

  if (globalTestEnvironment) {
    globalTestEnvironment.activeMocks.set(name, mock);
  }

  return mock;
}

/**
 * Waits for all pending timers to complete (useful with fake timers)
 */
export async function flushTimers(): Promise<void> {
  await vi.runAllTimersAsync();
}

/**
 * Advances timers by a specific amount
 */
export async function advanceTimers(ms: number): Promise<void> {
  await vi.advanceTimersByTimeAsync(ms);
}

/**
 * Creates a spy on a module function
 */
export function createModuleSpy<T>(
  modulePath: string,
  functionName: string,
  implementation?: T
): ReturnType<typeof vi.fn> {
  const spy = vi.fn(implementation);

  vi.mock(modulePath, async () => {
    const actual = await vi.importActual(modulePath);
    return {
      ...actual,
      [functionName]: spy,
    };
  });

  addCleanupTask(() => vi.unmock(modulePath));

  return spy;
}