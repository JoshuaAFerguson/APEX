/**
 * @fileoverview Test isolation utilities for APEX
 *
 * Provides patterns and utilities for test isolation including:
 * - Unique test contexts with guaranteed isolation
 * - State cleanup between tests with automatic restoration
 * - Parallel test support without interference
 * - Resource isolation (files, environment, database)
 * - Mock isolation and automatic restoration
 * - Memory and performance isolation utilities
 *
 * Usage:
 * ```typescript
 * import { createIsolatedTest, withTestIsolation } from './test-utils/isolation';
 *
 * // Automatic isolation wrapper
 * describe('My Feature Tests', () => {
 *   it('should work in isolation', async () => {
 *     await withTestIsolation(async (isolation) => {
 *       // Test runs in complete isolation
 *       isolation.env.set('TEST_VAR', 'value');
 *       isolation.fs.createFile('test.txt', 'content');
 *       // All resources automatically cleaned up
 *     });
 *   });
 *
 *   // Manual control
 *   it('should work with manual isolation', async () => {
 *     const isolation = await createIsolatedTest('my-test');
 *     try {
 *       // Test code
 *     } finally {
 *       await isolation.cleanup();
 *     }
 *   });
 * });
 * ```
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { vi } from 'vitest';
import type { MockInstance } from 'vitest';

/**
 * Configuration options for test isolation
 */
export interface TestIsolationOptions {
  /** Unique identifier for the test context */
  testId?: string;

  /** Enable file system isolation (default: true) */
  isolateFileSystem?: boolean;

  /** Enable environment variable isolation (default: true) */
  isolateEnvironment?: boolean;

  /** Enable process isolation where possible (default: true) */
  isolateProcess?: boolean;

  /** Enable database isolation (default: true) */
  isolateDatabase?: boolean;

  /** Enable mock isolation (default: true) */
  isolateMocks?: boolean;

  /** Enable timer isolation (default: true) */
  isolateTimers?: boolean;

  /** Enable memory monitoring (default: false) */
  monitorMemory?: boolean;

  /** Custom base directory for file isolation */
  baseDirectory?: string;

  /** Timeout for cleanup operations in ms (default: 30000) */
  cleanupTimeout?: number;

  /** Enable parallel test safety checks (default: true) */
  parallelSafe?: boolean;
}

/**
 * File system isolation utilities
 */
export class FileSystemIsolation {
  private isolationRoot: string;
  private createdPaths: Set<string> = new Set();
  private originalCwd: string;

  constructor(private testId: string, private baseDir?: string) {
    this.originalCwd = process.cwd();
  }

  async initialize(): Promise<void> {
    // Create isolation directory with test ID to prevent conflicts
    const baseDir = this.baseDir || os.tmpdir();
    this.isolationRoot = await fs.mkdtemp(
      path.join(baseDir, `apex-test-${this.testId}-`)
    );
    this.createdPaths.add(this.isolationRoot);
  }

  /**
   * Get the isolated root directory for this test
   */
  getIsolationRoot(): string {
    return this.isolationRoot;
  }

  /**
   * Create a file within the isolation context
   */
  async createFile(relativePath: string, content: string = ''): Promise<string> {
    const fullPath = path.join(this.isolationRoot, relativePath);
    const directory = path.dirname(fullPath);

    // Ensure directory exists
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(fullPath, content, 'utf8');

    this.createdPaths.add(fullPath);
    return fullPath;
  }

  /**
   * Create a directory within the isolation context
   */
  async createDirectory(relativePath: string): Promise<string> {
    const fullPath = path.join(this.isolationRoot, relativePath);
    await fs.mkdir(fullPath, { recursive: true });

    this.createdPaths.add(fullPath);
    return fullPath;
  }

  /**
   * Create a temporary file within isolation
   */
  async createTempFile(prefix: string = 'temp', content: string = ''): Promise<string> {
    const tempName = `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    return this.createFile(tempName, content);
  }

  /**
   * Change working directory to isolation root (for tests that need it)
   */
  changeToIsolationRoot(): void {
    process.chdir(this.isolationRoot);
  }

  /**
   * Restore original working directory
   */
  restoreWorkingDirectory(): void {
    process.chdir(this.originalCwd);
  }

  /**
   * Clean up all created files and directories
   */
  async cleanup(): Promise<void> {
    // Restore working directory first
    this.restoreWorkingDirectory();

    // Clean up all created paths in reverse order
    const pathsArray = Array.from(this.createdPaths).reverse();
    const errors: Error[] = [];

    for (const filePath of pathsArray) {
      try {
        await fs.rm(filePath, { recursive: true, force: true });
      } catch (error) {
        errors.push(new Error(`Failed to clean up ${filePath}: ${error}`));
      }
    }

    this.createdPaths.clear();

    if (errors.length > 0) {
      throw new Error(`File system cleanup errors: ${errors.map(e => e.message).join('; ')}`);
    }
  }
}

/**
 * Environment variable isolation utilities
 */
export class EnvironmentIsolation {
  private originalEnv: Record<string, string | undefined> = {};
  private modifiedKeys: Set<string> = new Set();

  /**
   * Set an environment variable in isolation
   */
  set(key: string, value: string): void {
    if (!this.modifiedKeys.has(key)) {
      this.originalEnv[key] = process.env[key];
      this.modifiedKeys.add(key);
    }
    process.env[key] = value;
  }

  /**
   * Delete an environment variable in isolation
   */
  delete(key: string): void {
    if (!this.modifiedKeys.has(key)) {
      this.originalEnv[key] = process.env[key];
      this.modifiedKeys.add(key);
    }
    delete process.env[key];
  }

  /**
   * Get current value of an environment variable
   */
  get(key: string): string | undefined {
    return process.env[key];
  }

  /**
   * Set multiple environment variables
   */
  setMultiple(vars: Record<string, string>): void {
    for (const [key, value] of Object.entries(vars)) {
      this.set(key, value);
    }
  }

  /**
   * Restore all environment variables to their original state
   */
  cleanup(): void {
    for (const key of this.modifiedKeys) {
      const originalValue = this.originalEnv[key];
      if (originalValue === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalValue;
      }
    }

    this.originalEnv = {};
    this.modifiedKeys.clear();
  }
}

/**
 * Mock isolation utilities for comprehensive mock management
 */
export class MockIsolation {
  private mocks: Array<{ restore: () => void; description: string }> = [];
  private spies: Array<{ spy: MockInstance; description: string }> = [];
  private mockedModules: Set<string> = new Set();

  /**
   * Create and track a spy
   */
  spyOn<T extends Record<string, any>, K extends keyof T>(
    object: T,
    method: K,
    description?: string
  ): MockInstance {
    const spy = vi.spyOn(object, method);
    this.spies.push({ spy, description: description || `${String(method)} spy` });
    return spy;
  }

  /**
   * Mock a module
   */
  mockModule(modulePath: string, factory?: () => any, description?: string): void {
    vi.mock(modulePath, factory);
    this.mockedModules.add(modulePath);
    this.mocks.push({
      restore: () => vi.unmock(modulePath),
      description: description || `Module mock: ${modulePath}`,
    });
  }

  /**
   * Create a mock function
   */
  createMockFunction<T extends (...args: any[]) => any>(
    implementation?: T,
    description?: string
  ): MockInstance {
    const mockFn = vi.fn(implementation);
    this.mocks.push({
      restore: () => mockFn.mockRestore(),
      description: description || 'Mock function',
    });
    return mockFn;
  }

  /**
   * Mock global objects or functions
   */
  mockGlobal<T>(globalName: string, mockValue: T, description?: string): T {
    const original = (global as any)[globalName];
    (global as any)[globalName] = mockValue;

    this.mocks.push({
      restore: () => {
        if (original === undefined) {
          delete (global as any)[globalName];
        } else {
          (global as any)[globalName] = original;
        }
      },
      description: description || `Global mock: ${globalName}`,
    });

    return mockValue;
  }

  /**
   * Clear all mocks without restoring them (useful for test scenarios)
   */
  clearAll(): void {
    vi.clearAllMocks();
    for (const { spy } of this.spies) {
      spy.mockClear();
    }
  }

  /**
   * Restore all mocks and clear tracking
   */
  cleanup(): void {
    // Restore all tracked mocks
    for (const mock of this.mocks.reverse()) {
      try {
        mock.restore();
      } catch (error) {
        console.warn(`Failed to restore mock ${mock.description}:`, error);
      }
    }

    // Restore all spies
    for (const { spy, description } of this.spies) {
      try {
        spy.mockRestore();
      } catch (error) {
        console.warn(`Failed to restore spy ${description}:`, error);
      }
    }

    this.mocks.length = 0;
    this.spies.length = 0;
    this.mockedModules.clear();

    // Final cleanup
    vi.clearAllMocks();
  }
}

/**
 * Timer and async isolation utilities
 */
export class TimerIsolation {
  private timers: Array<{ clear: () => void; type: string; id: any }> = [];
  private fakeTimersEnabled = false;

  /**
   * Enable fake timers for deterministic timing
   */
  useFakeTimers(): void {
    if (!this.fakeTimersEnabled) {
      vi.useFakeTimers();
      this.fakeTimersEnabled = true;
    }
  }

  /**
   * Restore real timers
   */
  useRealTimers(): void {
    if (this.fakeTimersEnabled) {
      vi.useRealTimers();
      this.fakeTimersEnabled = false;
    }
  }

  /**
   * Track a setTimeout for cleanup
   */
  trackTimeout(callback: () => void, delay: number): NodeJS.Timeout {
    const timerId = setTimeout(callback, delay);
    this.timers.push({
      clear: () => clearTimeout(timerId),
      type: 'timeout',
      id: timerId,
    });
    return timerId;
  }

  /**
   * Track a setInterval for cleanup
   */
  trackInterval(callback: () => void, interval: number): NodeJS.Timeout {
    const timerId = setInterval(callback, interval);
    this.timers.push({
      clear: () => clearInterval(timerId),
      type: 'interval',
      id: timerId,
    });
    return timerId;
  }

  /**
   * Advance fake timers (only works when fake timers are enabled)
   */
  advanceTime(ms: number): void {
    if (this.fakeTimersEnabled) {
      vi.advanceTimersByTime(ms);
    }
  }

  /**
   * Run all pending timers (only works when fake timers are enabled)
   */
  runAllTimers(): void {
    if (this.fakeTimersEnabled) {
      vi.runAllTimers();
    }
  }

  /**
   * Clean up all timers and restore real timers
   */
  cleanup(): void {
    // Clear all tracked timers
    for (const timer of this.timers) {
      try {
        timer.clear();
      } catch (error) {
        console.warn(`Failed to clear ${timer.type} timer:`, error);
      }
    }

    this.timers.length = 0;

    // Restore real timers if fake timers were enabled
    this.useRealTimers();
  }
}

/**
 * Database isolation utilities (for SQLite-based tests)
 */
export class DatabaseIsolation {
  private dbPath: string | null = null;

  constructor(private testId: string, private isolationRoot: string) {}

  /**
   * Create an isolated database file
   */
  async createDatabase(filename: string = 'test.db'): Promise<string> {
    this.dbPath = path.join(this.isolationRoot, filename);
    return this.dbPath;
  }

  /**
   * Get the database path
   */
  getDatabasePath(): string | null {
    return this.dbPath;
  }

  /**
   * Clean up database files
   */
  async cleanup(): Promise<void> {
    if (this.dbPath) {
      try {
        await fs.unlink(this.dbPath);
      } catch (error) {
        // Database file might not exist, which is fine
        if ((error as any).code !== 'ENOENT') {
          throw new Error(`Failed to clean up database: ${error}`);
        }
      }
      this.dbPath = null;
    }
  }
}

/**
 * Memory monitoring utilities for performance testing
 */
export class MemoryMonitor {
  private initialMemory: NodeJS.MemoryUsage;
  private checkpoints: Array<{ name: string; memory: NodeJS.MemoryUsage; timestamp: number }> = [];

  constructor() {
    this.initialMemory = process.memoryUsage();
  }

  /**
   * Create a memory checkpoint
   */
  checkpoint(name: string): void {
    this.checkpoints.push({
      name,
      memory: process.memoryUsage(),
      timestamp: Date.now(),
    });
  }

  /**
   * Get memory usage since start
   */
  getMemoryDelta(): Partial<NodeJS.MemoryUsage> {
    const current = process.memoryUsage();
    return {
      heapUsed: current.heapUsed - this.initialMemory.heapUsed,
      heapTotal: current.heapTotal - this.initialMemory.heapTotal,
      external: current.external - this.initialMemory.external,
      rss: current.rss - this.initialMemory.rss,
    };
  }

  /**
   * Get all memory checkpoints
   */
  getCheckpoints(): typeof this.checkpoints {
    return [...this.checkpoints];
  }

  /**
   * Check for potential memory leaks (basic heuristic)
   */
  hasMemoryLeak(thresholdMB: number = 50): boolean {
    const delta = this.getMemoryDelta();
    const heapIncreaseMB = (delta.heapUsed || 0) / 1024 / 1024;
    return heapIncreaseMB > thresholdMB;
  }

  /**
   * Force garbage collection if available (Node.js with --expose-gc)
   */
  forceGC(): void {
    if (global.gc) {
      global.gc();
    }
  }
}

/**
 * Complete test isolation context
 */
export class TestIsolationContext {
  public readonly testId: string;
  public readonly fs: FileSystemIsolation;
  public readonly env: EnvironmentIsolation;
  public readonly mocks: MockIsolation;
  public readonly timers: TimerIsolation;
  public readonly db: DatabaseIsolation;
  public readonly memory?: MemoryMonitor;

  private cleanupCallbacks: Array<() => Promise<void> | void> = [];

  constructor(
    testId: string,
    private options: Required<TestIsolationOptions>
  ) {
    this.testId = testId;
    this.fs = new FileSystemIsolation(testId, options.baseDirectory);
    this.env = new EnvironmentIsolation();
    this.mocks = new MockIsolation();
    this.timers = new TimerIsolation();
    this.db = new DatabaseIsolation(testId, this.fs.getIsolationRoot());

    if (options.monitorMemory) {
      this.memory = new MemoryMonitor();
    }
  }

  /**
   * Initialize all isolation systems
   */
  async initialize(): Promise<void> {
    await this.fs.initialize();
    this.db = new DatabaseIsolation(this.testId, this.fs.getIsolationRoot());
  }

  /**
   * Add a custom cleanup callback
   */
  addCleanup(callback: () => Promise<void> | void): void {
    this.cleanupCallbacks.push(callback);
  }

  /**
   * Perform complete cleanup of all isolation systems
   */
  async cleanup(): Promise<void> {
    const errors: Error[] = [];
    const timeout = this.options.cleanupTimeout;

    // Wrap cleanup in timeout to prevent hanging tests
    const cleanupPromise = this.performCleanup();

    try {
      await Promise.race([
        cleanupPromise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Cleanup timed out after ${timeout}ms`)), timeout)
        ),
      ]);
    } catch (error) {
      errors.push(error instanceof Error ? error : new Error(String(error)));
    }

    if (errors.length > 0) {
      throw new Error(`Test isolation cleanup failed: ${errors.map(e => e.message).join('; ')}`);
    }
  }

  private async performCleanup(): Promise<void> {
    const errors: Error[] = [];

    // Execute custom cleanup callbacks first (in reverse order)
    for (const callback of this.cleanupCallbacks.reverse()) {
      try {
        await callback();
      } catch (error) {
        errors.push(new Error(`Custom cleanup failed: ${error}`));
      }
    }

    // Clean up all isolation systems
    const cleanupTasks = [];

    if (this.options.isolateTimers) {
      cleanupTasks.push(async () => this.timers.cleanup());
    }

    if (this.options.isolateMocks) {
      cleanupTasks.push(async () => this.mocks.cleanup());
    }

    if (this.options.isolateEnvironment) {
      cleanupTasks.push(async () => this.env.cleanup());
    }

    if (this.options.isolateDatabase) {
      cleanupTasks.push(async () => this.db.cleanup());
    }

    if (this.options.isolateFileSystem) {
      cleanupTasks.push(async () => this.fs.cleanup());
    }

    // Execute cleanup tasks
    for (const task of cleanupTasks) {
      try {
        await task();
      } catch (error) {
        errors.push(error instanceof Error ? error : new Error(String(error)));
      }
    }

    if (errors.length > 0) {
      throw new Error(`Cleanup errors: ${errors.map(e => e.message).join('; ')}`);
    }
  }
}

/**
 * Create an isolated test context with comprehensive isolation
 */
export async function createIsolatedTest(
  testId?: string,
  options: TestIsolationOptions = {}
): Promise<TestIsolationContext> {
  const resolvedTestId = testId || `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const resolvedOptions: Required<TestIsolationOptions> = {
    testId: resolvedTestId,
    isolateFileSystem: options.isolateFileSystem ?? true,
    isolateEnvironment: options.isolateEnvironment ?? true,
    isolateProcess: options.isolateProcess ?? true,
    isolateDatabase: options.isolateDatabase ?? true,
    isolateMocks: options.isolateMocks ?? true,
    isolateTimers: options.isolateTimers ?? true,
    monitorMemory: options.monitorMemory ?? false,
    baseDirectory: options.baseDirectory,
    cleanupTimeout: options.cleanupTimeout ?? 30000,
    parallelSafe: options.parallelSafe ?? true,
  };

  const context = new TestIsolationContext(resolvedTestId, resolvedOptions);
  await context.initialize();

  return context;
}

/**
 * Run a test function with complete isolation and automatic cleanup
 */
export async function withTestIsolation<T>(
  testFn: (isolation: TestIsolationContext) => Promise<T> | T,
  options?: TestIsolationOptions
): Promise<T> {
  const isolation = await createIsolatedTest(undefined, options);

  try {
    return await testFn(isolation);
  } finally {
    await isolation.cleanup();
  }
}

/**
 * Parallel test utilities for ensuring tests can run concurrently without interference
 */
export class ParallelTestCoordinator {
  private static activeTests = new Set<string>();
  private static resourceLocks = new Map<string, string>(); // resource -> testId

  /**
   * Register a test for parallel execution
   */
  static registerTest(testId: string): void {
    if (this.activeTests.has(testId)) {
      throw new Error(`Test ${testId} is already registered for parallel execution`);
    }
    this.activeTests.add(testId);
  }

  /**
   * Unregister a test from parallel execution
   */
  static unregisterTest(testId: string): void {
    this.activeTests.delete(testId);

    // Release any resource locks held by this test
    for (const [resource, lockTestId] of this.resourceLocks.entries()) {
      if (lockTestId === testId) {
        this.resourceLocks.delete(resource);
      }
    }
  }

  /**
   * Acquire an exclusive lock on a named resource
   */
  static acquireResourceLock(testId: string, resource: string): boolean {
    if (this.resourceLocks.has(resource)) {
      return false; // Resource is already locked by another test
    }

    this.resourceLocks.set(resource, testId);
    return true;
  }

  /**
   * Release a resource lock
   */
  static releaseResourceLock(testId: string, resource: string): void {
    const lockHolder = this.resourceLocks.get(resource);
    if (lockHolder === testId) {
      this.resourceLocks.delete(resource);
    }
  }

  /**
   * Check if tests can run in parallel without conflicts
   */
  static canRunInParallel(testId: string, requiredResources: string[] = []): boolean {
    // Check if any required resources are locked
    for (const resource of requiredResources) {
      if (this.resourceLocks.has(resource)) {
        return false;
      }
    }
    return true;
  }
}

/**
 * Create an isolated test with parallel execution support
 */
export async function createParallelSafeTest(
  testId?: string,
  requiredResources: string[] = [],
  options: TestIsolationOptions = {}
): Promise<TestIsolationContext> {
  const resolvedTestId = testId || `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Register for parallel execution
  ParallelTestCoordinator.registerTest(resolvedTestId);

  // Acquire resource locks
  for (const resource of requiredResources) {
    if (!ParallelTestCoordinator.acquireResourceLock(resolvedTestId, resource)) {
      throw new Error(`Resource '${resource}' is not available for test '${resolvedTestId}'`);
    }
  }

  const isolation = await createIsolatedTest(resolvedTestId, options);

  // Add cleanup to release parallel execution resources
  isolation.addCleanup(() => {
    ParallelTestCoordinator.unregisterTest(resolvedTestId);
  });

  return isolation;
}

/**
 * Test isolation middleware for automatic setup and teardown
 */
export function testIsolationMiddleware(options?: TestIsolationOptions) {
  return {
    /**
     * Setup function to call in beforeEach
     */
    async setup(testId?: string): Promise<TestIsolationContext> {
      return createIsolatedTest(testId, options);
    },

    /**
     * Cleanup function to call in afterEach
     */
    async cleanup(isolation: TestIsolationContext): Promise<void> {
      await isolation.cleanup();
    },
  };
}

/**
 * Utility to check if current environment supports test isolation features
 */
export function getIsolationCapabilities(): {
  fileSystem: boolean;
  environment: boolean;
  timers: boolean;
  memory: boolean;
  gc: boolean;
} {
  return {
    fileSystem: true, // Always available in Node.js
    environment: true, // Always available in Node.js
    timers: true, // Vitest provides fake timers
    memory: typeof process.memoryUsage === 'function',
    gc: typeof global.gc === 'function', // Available with --expose-gc
  };
}