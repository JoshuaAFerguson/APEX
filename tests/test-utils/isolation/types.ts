/**
 * Test Isolation Type Definitions
 *
 * Core type definitions for the test isolation pattern system.
 * These types define the contracts for isolation utilities that enable
 * parallel-safe, reproducible, and cleanable test execution.
 *
 * @module tests/test-utils/isolation/types
 * @see ADR-052 for architecture decisions
 */

import type { SpyInstance } from 'vitest';

/**
 * Priority levels for cleanup operations.
 * Higher priority cleanups run first (LIFO within same priority).
 *
 * @example
 * ```typescript
 * // Database should be closed before temp directory is removed
 * ctx.registerCleanup(closeDatabase, CleanupPriority.HIGH);
 * ctx.registerCleanup(removeTempDir, CleanupPriority.LOW);
 * ```
 */
export enum CleanupPriority {
  /** Critical resources that must be cleaned first (databases, connections) */
  CRITICAL = 100,
  /** High priority cleanup (servers, processes) */
  HIGH = 75,
  /** Normal priority cleanup (mocks, spies) */
  NORMAL = 50,
  /** Low priority cleanup (timers, environment vars) */
  LOW = 25,
  /** Final cleanup (temp directories, files) */
  FINAL = 0,
}

/**
 * Function type for cleanup operations.
 * Can be synchronous or asynchronous.
 */
export type CleanupFn = () => void | Promise<void>;

/**
 * Registered cleanup operation with metadata.
 */
export interface CleanupRegistration {
  /** The cleanup function to execute */
  fn: CleanupFn;
  /** Priority level for ordering (higher runs first) */
  priority: CleanupPriority;
  /** Optional description for debugging */
  description?: string;
  /** Timestamp when registered */
  registeredAt: number;
}

/**
 * Options for creating an isolated test context.
 */
export interface IsolationOptions {
  /** Prefix for temp directories and IDs */
  prefix?: string;
  /** Whether to create a database path */
  withDatabase?: boolean;
  /** Whether to set up mock manager */
  withMocks?: boolean;
  /** Custom temp directory base (defaults to os.tmpdir()) */
  tempBase?: string;
  /** Timeout for cleanup operations in ms */
  cleanupTimeout?: number;
}

/**
 * Result of a cleanup operation.
 */
export interface CleanupResult {
  /** Whether cleanup completed successfully */
  success: boolean;
  /** Errors encountered during cleanup */
  errors: Error[];
  /** Duration of cleanup in milliseconds */
  duration: number;
  /** Number of cleanup operations executed */
  operationsExecuted: number;
}

/**
 * Core interface for isolated test context.
 * Provides unique identification and resource management for each test.
 *
 * @example
 * ```typescript
 * const ctx = await createIsolatedTest({ prefix: 'my-test' });
 * try {
 *   // Use ctx.tempDir for files
 *   // Use ctx.files.createTempFile() for temporary files
 *   // All resources tracked and cleaned automatically
 * } finally {
 *   await ctx.teardown();
 * }
 * ```
 */
export interface IsolatedTestContext {
  /** Unique identifier for this test context */
  readonly id: string;

  /** Isolated temporary directory path */
  readonly tempDir: string;

  /** Database path if withDatabase was true */
  readonly dbPath?: string;

  /** Start time for duration tracking */
  readonly startTime: Date;

  /** Shared data storage between test phases */
  readonly data: Record<string, unknown>;

  /** File system isolation utilities */
  readonly files: FileSystemIsolation;

  /** Environment variable isolation */
  readonly env: EnvironmentIsolation;

  /** Mock and spy isolation */
  readonly mocks: MockIsolation;

  /** Timer isolation (setTimeout/setInterval) */
  readonly timers: TimerIsolation;

  /** Process isolation (child processes) */
  readonly processes: ProcessIsolation;

  /**
   * Register a cleanup function to run during teardown.
   * @param fn - Cleanup function
   * @param priority - Priority level (default: NORMAL)
   * @param description - Optional description for debugging
   */
  registerCleanup(
    fn: CleanupFn,
    priority?: CleanupPriority,
    description?: string
  ): void;

  /**
   * Tear down the context and clean up all resources.
   * Runs all registered cleanup functions in priority order (LIFO within priority).
   */
  teardown(): Promise<CleanupResult>;

  /**
   * Get elapsed time since context creation.
   */
  getElapsed(): number;
}

/**
 * File system isolation interface.
 * Provides methods for creating and tracking temporary files/directories.
 */
export interface FileSystemIsolation {
  /** Base temporary directory for this context */
  readonly baseTempDir: string;

  /**
   * Create a temporary subdirectory.
   * @param prefix - Optional prefix for the directory name
   * @returns Path to the created directory
   */
  createTempDir(prefix?: string): Promise<string>;

  /**
   * Create a temporary file with optional content.
   * @param name - File name (can include subdirectory path)
   * @param content - Optional file content
   * @returns Path to the created file
   */
  createTempFile(name: string, content?: string): Promise<string>;

  /**
   * Track an external path for cleanup.
   * @param filePath - Path to track
   */
  trackPath(filePath: string): void;

  /**
   * Get all tracked paths.
   */
  getTrackedPaths(): string[];

  /**
   * Clean up all tracked paths.
   */
  cleanup(): Promise<void>;
}

/**
 * Environment variable isolation interface.
 * Captures original values and provides snapshot/restore functionality.
 */
export interface EnvironmentIsolation {
  /**
   * Set an environment variable (original value is captured for restoration).
   * @param key - Environment variable name
   * @param value - Value to set
   */
  setEnv(key: string, value: string): void;

  /**
   * Delete an environment variable (original value is captured for restoration).
   * @param key - Environment variable name
   */
  deleteEnv(key: string): void;

  /**
   * Get current snapshot of modified environment variables.
   */
  getModified(): Record<string, string | undefined>;

  /**
   * Restore all environment variables to their original values.
   */
  restore(): void;
}

/**
 * Mock and spy isolation interface.
 * Tracks all mocks and spies for automatic restoration.
 */
export interface MockIsolation {
  /**
   * Create a spy on an object method.
   * @param obj - Object containing the method
   * @param method - Method name to spy on
   * @returns Vitest spy instance
   */
  spyOn<T extends object, K extends keyof T>(obj: T, method: K): SpyInstance;

  /**
   * Create a mock function.
   * @param impl - Optional implementation
   * @returns Mock function
   */
  fn<T extends (...args: unknown[]) => unknown>(impl?: T): ReturnType<typeof import('vitest').vi.fn>;

  /**
   * Get count of active mocks/spies.
   */
  getActiveCount(): number;

  /**
   * Restore all mocks and spies.
   */
  restoreAll(): void;
}

/**
 * Timer isolation interface.
 * Tracks setTimeout and setInterval for cleanup.
 */
export interface TimerIsolation {
  /**
   * Create a tracked setTimeout.
   * @param callback - Timer callback
   * @param ms - Delay in milliseconds
   * @returns Timer ID
   */
  setTimeout(callback: () => void, ms: number): NodeJS.Timeout;

  /**
   * Create a tracked setInterval.
   * @param callback - Timer callback
   * @param ms - Interval in milliseconds
   * @returns Timer ID
   */
  setInterval(callback: () => void, ms: number): NodeJS.Timeout;

  /**
   * Track an existing timer for cleanup.
   * @param id - Timer ID
   * @param type - Timer type ('timeout' or 'interval')
   */
  track(id: NodeJS.Timeout, type: 'timeout' | 'interval'): void;

  /**
   * Get count of active timers.
   */
  getActiveCount(): number;

  /**
   * Clear all tracked timers.
   */
  clearAll(): void;
}

/**
 * Process isolation interface.
 * Tracks child processes for cleanup.
 */
export interface ProcessIsolation {
  /**
   * Track a child process for cleanup.
   * @param process - Process with a kill method
   * @param description - Optional description for debugging
   */
  track(process: { kill: (signal?: string) => boolean }, description?: string): void;

  /**
   * Get count of active processes.
   */
  getActiveCount(): number;

  /**
   * Kill all tracked processes.
   * @param signal - Signal to send (default: 'SIGTERM')
   */
  killAll(signal?: string): void;
}

/**
 * Options for the withIsolation helper.
 */
export interface WithIsolationOptions extends IsolationOptions {
  /** Whether to suppress cleanup errors */
  suppressCleanupErrors?: boolean;
}

/**
 * Factory function type for creating isolated test contexts.
 */
export type CreateIsolatedTestFn = (
  options?: IsolationOptions
) => Promise<IsolatedTestContext>;

/**
 * Wrapper function type for running code with isolation.
 */
export type WithIsolationFn = <T>(
  fn: (ctx: IsolatedTestContext) => Promise<T>,
  options?: WithIsolationOptions
) => Promise<T>;
