/**
 * Comprehensive Test Setup and Teardown Utilities
 *
 * This module provides robust setup and teardown helpers for all types of testing
 * in the APEX platform, ensuring clean, isolated test environments.
 */

import { vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { EventEmitter } from 'events';
import type { IntegrationTestEnvironment } from './integration-test-utilities';

// ============================================================================
// Global Test State Management
// ============================================================================

interface GlobalTestState {
  environments: Map<string, IntegrationTestEnvironment>;
  cleanupHandlers: Array<() => Promise<void>>;
  tempDirectories: Set<string>;
  mockRegistry: Map<string, any>;
  originalProcessEnv: NodeJS.ProcessEnv;
  originalProcessCwd: string;
}

const globalTestState: GlobalTestState = {
  environments: new Map(),
  cleanupHandlers: [],
  tempDirectories: new Set(),
  mockRegistry: new Map(),
  originalProcessEnv: { ...process.env },
  originalProcessCwd: process.cwd(),
};

// ============================================================================
// Test Environment Lifecycle Hooks
// ============================================================================

export interface TestLifecycleOptions {
  /**
   * Unique identifier for this test suite
   */
  suiteId?: string;

  /**
   * Whether to create an integration test environment
   */
  createIntegrationEnv?: boolean;

  /**
   * Integration environment options
   */
  integrationOptions?: any;

  /**
   * Whether to mock external dependencies
   */
  mockExternalDeps?: boolean;

  /**
   * Whether to isolate filesystem operations
   */
  isolateFilesystem?: boolean;

  /**
   * Whether to isolate environment variables
   */
  isolateEnvironment?: boolean;

  /**
   * Whether to isolate network requests
   */
  isolateNetwork?: boolean;

  /**
   * Custom setup function
   */
  customSetup?: () => Promise<void>;

  /**
   * Custom teardown function
   */
  customTeardown?: () => Promise<void>;

  /**
   * Timeout for setup/teardown operations
   */
  timeout?: number;
}

/**
 * Setup hook for test suites - call this in beforeAll or beforeEach
 */
export async function setupTestEnvironment(options: TestLifecycleOptions = {}): Promise<IntegrationTestEnvironment | void> {
  const {
    suiteId = generateSuiteId(),
    createIntegrationEnv = false,
    integrationOptions = {},
    mockExternalDeps = true,
    isolateFilesystem = true,
    isolateEnvironment = true,
    isolateNetwork = true,
    customSetup,
    timeout = 30000,
  } = options;

  console.log(`🔧 Setting up test environment: ${suiteId}`);

  try {
    // Set up filesystem isolation
    if (isolateFilesystem) {
      await setupFilesystemIsolation(suiteId);
    }

    // Set up environment isolation
    if (isolateEnvironment) {
      setupEnvironmentIsolation();
    }

    // Set up network isolation
    if (isolateNetwork) {
      setupNetworkIsolation();
    }

    // Set up external dependency mocks
    if (mockExternalDeps) {
      setupExternalMocks();
    }

    // Create integration environment if requested
    let integrationEnv: IntegrationTestEnvironment | undefined;
    if (createIntegrationEnv) {
      const { createIntegrationTestEnvironment } = await import('./integration-test-utilities');
      integrationEnv = await createIntegrationTestEnvironment(integrationOptions);
      globalTestState.environments.set(suiteId, integrationEnv);
    }

    // Run custom setup
    if (customSetup) {
      await Promise.race([
        customSetup(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Setup timeout')), timeout)
        ),
      ]);
    }

    console.log(`✅ Test environment ready: ${suiteId}`);

    return integrationEnv;
  } catch (error) {
    console.error(`❌ Failed to setup test environment: ${suiteId}`, error);
    await teardownTestEnvironment(suiteId, options);
    throw error;
  }
}

/**
 * Teardown hook for test suites - call this in afterAll or afterEach
 */
export async function teardownTestEnvironment(suiteId?: string, options: TestLifecycleOptions = {}) {
  const {
    customTeardown,
    timeout = 30000,
  } = options;

  const id = suiteId || 'unknown';
  console.log(`🧹 Tearing down test environment: ${id}`);

  try {
    // Run custom teardown first
    if (customTeardown) {
      await Promise.race([
        customTeardown(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Teardown timeout')), timeout)
        ),
      ]);
    }

    // Clean up integration environment
    if (suiteId && globalTestState.environments.has(suiteId)) {
      const env = globalTestState.environments.get(suiteId)!;
      await env.cleanup();
      globalTestState.environments.delete(suiteId);
    }

    // Clean up temporary directories
    for (const tempDir of globalTestState.tempDirectories) {
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (error) {
        console.warn(`Failed to clean up temp directory: ${tempDir}`, error);
      }
    }
    globalTestState.tempDirectories.clear();

    // Run global cleanup handlers
    for (const handler of globalTestState.cleanupHandlers) {
      try {
        await handler();
      } catch (error) {
        console.warn('Cleanup handler failed:', error);
      }
    }
    globalTestState.cleanupHandlers = [];

    // Reset mocks
    vi.clearAllMocks();
    vi.restoreAllMocks();
    globalTestState.mockRegistry.clear();

    // Restore process state
    process.env = { ...globalTestState.originalProcessEnv };
    process.chdir(globalTestState.originalProcessCwd);

    console.log(`✅ Test environment cleaned up: ${id}`);
  } catch (error) {
    console.error(`❌ Failed to teardown test environment: ${id}`, error);
    throw error;
  }
}

/**
 * Register a cleanup handler to run during teardown
 */
export function registerCleanupHandler(handler: () => Promise<void>) {
  globalTestState.cleanupHandlers.push(handler);
}

/**
 * Get the integration environment for a suite
 */
export function getIntegrationEnvironment(suiteId: string): IntegrationTestEnvironment | undefined {
  return globalTestState.environments.get(suiteId);
}

// ============================================================================
// Vitest Hook Wrappers
// ============================================================================

/**
 * Convenient wrapper for beforeAll hook with environment setup
 */
export function beforeAllWithSetup(options: TestLifecycleOptions = {}) {
  let suiteId: string;
  let environment: IntegrationTestEnvironment | undefined;

  beforeAll(async () => {
    suiteId = options.suiteId || generateSuiteId();
    environment = (await setupTestEnvironment({ ...options, suiteId })) as IntegrationTestEnvironment;
  }, options.timeout);

  afterAll(async () => {
    await teardownTestEnvironment(suiteId, options);
  }, options.timeout);

  return {
    getSuiteId: () => suiteId,
    getEnvironment: () => environment,
  };
}

/**
 * Convenient wrapper for beforeEach hook with environment setup
 */
export function beforeEachWithSetup(options: TestLifecycleOptions = {}) {
  let suiteId: string;
  let environment: IntegrationTestEnvironment | undefined;

  beforeEach(async () => {
    suiteId = options.suiteId || generateSuiteId();
    environment = (await setupTestEnvironment({ ...options, suiteId })) as IntegrationTestEnvironment;
  }, options.timeout);

  afterEach(async () => {
    await teardownTestEnvironment(suiteId, options);
  }, options.timeout);

  return {
    getSuiteId: () => suiteId,
    getEnvironment: () => environment,
  };
}

// ============================================================================
// Isolation Utilities
// ============================================================================

async function setupFilesystemIsolation(suiteId: string): Promise<void> {
  // Create isolated test directory
  const testDir = await fs.mkdtemp(path.join(os.tmpdir(), `apex-test-${suiteId}-`));
  globalTestState.tempDirectories.add(testDir);

  // Change to test directory for isolated operations
  process.chdir(testDir);

  // Mock fs operations to stay within test directory
  const originalFsReaddir = fs.readdir;
  const mockReaddir = vi.fn().mockImplementation(async (dirPath: string, options?: any) => {
    const resolvedPath = path.resolve(dirPath);
    if (!resolvedPath.startsWith(testDir) && !resolvedPath.startsWith('/tmp')) {
      throw new Error(`Filesystem access outside test directory not allowed: ${resolvedPath}`);
    }
    return originalFsReaddir(dirPath, options);
  });

  vi.spyOn(fs, 'readdir').mockImplementation(mockReaddir);
  globalTestState.mockRegistry.set('fs.readdir', mockReaddir);
}

function setupEnvironmentIsolation(): void {
  // Set test-specific environment variables
  process.env = {
    ...globalTestState.originalProcessEnv,
    NODE_ENV: 'test',
    CI: 'true',
    APEX_TEST_MODE: 'true',
    // Clear potentially problematic env vars
    ANTHROPIC_API_KEY: undefined,
    OPENAI_API_KEY: undefined,
  };
}

function setupNetworkIsolation(): void {
  // Mock network requests to prevent external calls
  const mockFetch = vi.fn().mockRejectedValue(
    new Error('Network requests are isolated in test environment')
  );

  if (typeof globalThis.fetch !== 'undefined') {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockFetch);
    globalTestState.mockRegistry.set('globalThis.fetch', mockFetch);
  }

  // Mock HTTP modules
  try {
    const http = require('http');
    const mockRequest = vi.fn().mockImplementation(() => {
      throw new Error('HTTP requests are isolated in test environment');
    });
    vi.spyOn(http, 'request').mockImplementation(mockRequest);
    globalTestState.mockRegistry.set('http.request', mockRequest);
  } catch {
    // HTTP module not available, skip
  }

  try {
    const https = require('https');
    const mockRequest = vi.fn().mockImplementation(() => {
      throw new Error('HTTPS requests are isolated in test environment');
    });
    vi.spyOn(https, 'request').mockImplementation(mockRequest);
    globalTestState.mockRegistry.set('https.request', mockRequest);
  } catch {
    // HTTPS module not available, skip
  }
}

function setupExternalMocks(): void {
  // Mock Claude Agent SDK
  vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
    ClaudeSDK: vi.fn().mockImplementation(() => ({
      query: vi.fn().mockResolvedValue({
        content: 'Mock response from Claude',
        usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
      }),
    })),
  }));

  // Mock browser automation libraries
  vi.mock('playwright', () => ({
    chromium: {
      launch: vi.fn().mockResolvedValue({
        newContext: vi.fn().mockResolvedValue({
          newPage: vi.fn().mockResolvedValue({
            goto: vi.fn(),
            screenshot: vi.fn().mockResolvedValue('mock-screenshot-data'),
            close: vi.fn(),
          }),
          close: vi.fn(),
        }),
        close: vi.fn(),
      }),
    },
  }));

  vi.mock('puppeteer', () => ({
    launch: vi.fn().mockResolvedValue({
      newPage: vi.fn().mockResolvedValue({
        goto: vi.fn(),
        screenshot: vi.fn().mockResolvedValue('mock-screenshot-data'),
        close: vi.fn(),
      }),
      close: vi.fn(),
    }),
  }));

  // Mock database connections
  vi.mock('better-sqlite3', () => {
    return vi.fn().mockImplementation(() => ({
      prepare: vi.fn().mockReturnValue({
        run: vi.fn(),
        get: vi.fn(),
        all: vi.fn().mockReturnValue([]),
      }),
      close: vi.fn(),
    }));
  });
}

// ============================================================================
// Utility Functions
// ============================================================================

function generateSuiteId(): string {
  return `suite_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a temporary directory for test operations
 */
export async function createTempDirectory(prefix = 'apex-test'): Promise<string> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), `${prefix}-`));
  globalTestState.tempDirectories.add(tempDir);
  return tempDir;
}

/**
 * Create a temporary file with content
 */
export async function createTempFile(
  content: string,
  options: {
    extension?: string;
    directory?: string;
    prefix?: string;
  } = {}
): Promise<string> {
  const {
    extension = '.txt',
    directory,
    prefix = 'apex-test-file',
  } = options;

  const tempDir = directory || await createTempDirectory();
  const fileName = `${prefix}-${Date.now()}${extension}`;
  const filePath = path.join(tempDir, fileName);

  await fs.writeFile(filePath, content, 'utf-8');
  return filePath;
}

/**
 * Wait for a condition to be true
 */
export function waitFor<T>(
  condition: () => Promise<T> | T,
  options: {
    timeout?: number;
    interval?: number;
    message?: string;
  } = {}
): Promise<T> {
  const {
    timeout = 5000,
    interval = 100,
    message = 'Condition not met within timeout',
  } = options;

  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const check = async () => {
      try {
        const result = await condition();
        if (result) {
          resolve(result);
          return;
        }
      } catch (error) {
        // Continue trying
      }

      if (Date.now() - startTime >= timeout) {
        reject(new Error(message));
        return;
      }

      setTimeout(check, interval);
    };

    check();
  });
}

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
    backoffMultiplier?: number;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 100,
    maxDelay = 5000,
    backoffMultiplier = 2,
  } = options;

  let delay = initialDelay;
  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt === maxRetries) {
        break;
      }

      await new Promise(resolve => setTimeout(resolve, delay));
      delay = Math.min(delay * backoffMultiplier, maxDelay);
    }
  }

  throw lastError!;
}

/**
 * Create a mock event emitter for testing
 */
export function createMockEventEmitter(): EventEmitter & {
  getEventHistory: () => Array<{ event: string; args: any[]; timestamp: Date }>;
  clearHistory: () => void;
} {
  const emitter = new EventEmitter();
  const history: Array<{ event: string; args: any[]; timestamp: Date }> = [];

  const originalEmit = emitter.emit;
  emitter.emit = function (event: string | symbol, ...args: any[]): boolean {
    history.push({
      event: String(event),
      args,
      timestamp: new Date(),
    });
    return originalEmit.call(this, event, ...args);
  };

  return Object.assign(emitter, {
    getEventHistory: () => [...history],
    clearHistory: () => { history.length = 0; },
  });
}

// ============================================================================
// Test Performance Utilities
// ============================================================================

/**
 * Measure execution time of a function
 */
export async function measureExecutionTime<T>(fn: () => Promise<T>): Promise<{
  result: T;
  executionTime: number;
}> {
  const startTime = performance.now();
  const result = await fn();
  const executionTime = performance.now() - startTime;

  return { result, executionTime };
}

/**
 * Create a performance benchmark
 */
export class PerformanceBenchmark {
  private measurements: Array<{ name: string; time: number }> = [];

  async measure<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const { result, executionTime } = await measureExecutionTime(fn);
    this.measurements.push({ name, time: executionTime });
    return result;
  }

  getResults(): Array<{ name: string; time: number }> {
    return [...this.measurements];
  }

  getAverageTime(name: string): number {
    const times = this.measurements.filter(m => m.name === name).map(m => m.time);
    return times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;
  }

  clear() {
    this.measurements = [];
  }
}

// ============================================================================
// Exports
// ============================================================================

export default {
  setupTestEnvironment,
  teardownTestEnvironment,
  beforeAllWithSetup,
  beforeEachWithSetup,
  registerCleanupHandler,
  getIntegrationEnvironment,
  createTempDirectory,
  createTempFile,
  waitFor,
  retryWithBackoff,
  createMockEventEmitter,
  measureExecutionTime,
  PerformanceBenchmark,
};