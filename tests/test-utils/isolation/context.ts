/**
 * Isolated Test Context
 *
 * Provides a unified test isolation context that manages all isolation concerns.
 * Each test gets a unique context with isolated file system, environment,
 * mocks, timers, and processes.
 *
 * @module tests/test-utils/isolation/context
 * @see ADR-052 for architecture decisions
 *
 * @example
 * ```typescript
 * import { createIsolatedTest } from '../test-utils';
 *
 * describe('Feature', () => {
 *   let ctx: IsolatedTestContext;
 *
 *   beforeEach(async () => {
 *     ctx = await createIsolatedTest({ prefix: 'feature' });
 *   });
 *
 *   afterEach(async () => {
 *     await ctx.teardown();
 *   });
 *
 *   it('should work in isolation', async () => {
 *     const file = await ctx.files.createTempFile('test.txt', 'content');
 *     ctx.env.setEnv('TEST_VAR', 'value');
 *     // All cleaned up automatically in afterEach
 *   });
 * });
 * ```
 */

import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs/promises';
import type {
  IsolatedTestContext,
  IsolationOptions,
  CleanupFn,
  CleanupPriority,
  CleanupRegistration,
  CleanupResult,
  FileSystemIsolation,
  EnvironmentIsolation,
  MockIsolation,
  TimerIsolation,
  ProcessIsolation,
} from './types';
import { CleanupPriority as Priority } from './types';
import { FileSystemIsolationImpl } from './file-system';
import { EnvironmentIsolationImpl } from './environment';
import { MockIsolationImpl } from './mocks';
import { TimerIsolationImpl } from './timers';
import { ProcessIsolationImpl } from './processes';

/**
 * Generate a unique test ID.
 *
 * Format: `{prefix}_{timestamp}_{random}`
 * - timestamp: Current time in milliseconds
 * - random: 9-character random alphanumeric string
 *
 * @param prefix - Optional prefix (default: 'test')
 * @returns Unique identifier string
 *
 * @example
 * ```typescript
 * const id = generateTestId('unit');
 * // 'unit_1707302400000_abc123def'
 * ```
 */
export function generateTestId(prefix = 'test'): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 11);
  return `${prefix}_${timestamp}_${random}`;
}

/**
 * Implementation of IsolatedTestContext.
 *
 * Coordinates all isolation utilities and manages cleanup lifecycle.
 * Resources are cleaned up in priority order during teardown.
 */
export class IsolatedTestContextImpl implements IsolatedTestContext {
  /** Unique identifier for this test context */
  public readonly id: string;

  /** Isolated temporary directory path */
  public readonly tempDir: string;

  /** Database path if withDatabase was true */
  public readonly dbPath?: string;

  /** Start time for duration tracking */
  public readonly startTime: Date;

  /** Shared data storage between test phases */
  public readonly data: Record<string, unknown> = {};

  /** File system isolation utilities */
  public readonly files: FileSystemIsolation;

  /** Environment variable isolation */
  public readonly env: EnvironmentIsolation;

  /** Mock and spy isolation */
  public readonly mocks: MockIsolation;

  /** Timer isolation (setTimeout/setInterval) */
  public readonly timers: TimerIsolation;

  /** Process isolation (child processes) */
  public readonly processes: ProcessIsolation;

  /** Registered cleanup operations */
  private cleanupRegistry: CleanupRegistration[] = [];

  /** Whether teardown has been performed */
  private tornDown = false;

  /** Options used to create this context */
  private readonly options: Required<IsolationOptions>;

  /**
   * Create a new isolated test context.
   *
   * @param tempDir - Pre-created temporary directory path
   * @param options - Configuration options
   */
  constructor(tempDir: string, options: IsolationOptions = {}) {
    this.options = {
      prefix: options.prefix ?? 'test',
      withDatabase: options.withDatabase ?? false,
      withMocks: options.withMocks ?? true,
      tempBase: options.tempBase ?? os.tmpdir(),
      cleanupTimeout: options.cleanupTimeout ?? 10000,
    };

    this.id = generateTestId(this.options.prefix);
    this.tempDir = tempDir;
    this.startTime = new Date();

    // Initialize database path if requested
    if (this.options.withDatabase) {
      this.dbPath = path.join(tempDir, `${this.id}.db`);
    }

    // Initialize isolation utilities
    this.files = new FileSystemIsolationImpl(tempDir);
    this.env = new EnvironmentIsolationImpl();
    this.mocks = new MockIsolationImpl();
    this.timers = new TimerIsolationImpl();
    this.processes = new ProcessIsolationImpl();

    // Register built-in cleanup operations
    this.registerBuiltInCleanup();
  }

  /**
   * Register a cleanup function to run during teardown.
   *
   * Cleanup functions are executed in priority order (higher first),
   * and in LIFO order within the same priority.
   *
   * @param fn - Cleanup function
   * @param priority - Priority level (default: NORMAL)
   * @param description - Optional description for debugging
   *
   * @example
   * ```typescript
   * // High priority cleanup for database
   * ctx.registerCleanup(
   *   () => db.close(),
   *   CleanupPriority.HIGH,
   *   'close-database'
   * );
   *
   * // Normal priority cleanup
   * ctx.registerCleanup(() => cache.clear());
   * ```
   */
  registerCleanup(
    fn: CleanupFn,
    priority: CleanupPriority = Priority.NORMAL,
    description?: string
  ): void {
    if (this.tornDown) {
      throw new Error('Cannot register cleanup after teardown');
    }

    this.cleanupRegistry.push({
      fn,
      priority,
      description,
      registeredAt: Date.now(),
    });
  }

  /**
   * Tear down the context and clean up all resources.
   *
   * Executes cleanup in this order:
   * 1. Registered cleanup functions (by priority, LIFO within priority)
   * 2. Built-in isolation cleanup (processes, mocks, timers, env, files)
   *
   * @returns Cleanup result with success status, errors, and timing
   *
   * @example
   * ```typescript
   * const result = await ctx.teardown();
   * if (!result.success) {
   *   console.error('Cleanup errors:', result.errors);
   * }
   * ```
   */
  async teardown(): Promise<CleanupResult> {
    if (this.tornDown) {
      return {
        success: true,
        errors: [],
        duration: 0,
        operationsExecuted: 0,
      };
    }

    const startTime = Date.now();
    const errors: Error[] = [];
    let operationsExecuted = 0;

    try {
      // Sort cleanup operations by priority (descending), then by registration time (descending for LIFO)
      const sortedCleanups = [...this.cleanupRegistry].sort((a, b) => {
        if (a.priority !== b.priority) {
          return b.priority - a.priority;
        }
        return b.registeredAt - a.registeredAt;
      });

      // Execute cleanup operations
      for (const registration of sortedCleanups) {
        try {
          await Promise.race([
            registration.fn(),
            new Promise<never>((_, reject) =>
              setTimeout(
                () => reject(new Error(`Cleanup timeout: ${registration.description ?? 'unknown'}`)),
                this.options.cleanupTimeout
              )
            ),
          ]);
          operationsExecuted++;
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          errors.push(
            new Error(
              `Cleanup failed (${registration.description ?? 'unknown'}): ${err.message}`
            )
          );
        }
      }
    } finally {
      this.tornDown = true;
      this.cleanupRegistry = [];
    }

    return {
      success: errors.length === 0,
      errors,
      duration: Date.now() - startTime,
      operationsExecuted,
    };
  }

  /**
   * Get elapsed time since context creation.
   *
   * @returns Elapsed time in milliseconds
   *
   * @example
   * ```typescript
   * // At end of test
   * console.log(`Test took ${ctx.getElapsed()}ms`);
   * ```
   */
  getElapsed(): number {
    return Date.now() - this.startTime.getTime();
  }

  /**
   * Register built-in cleanup operations for isolation utilities.
   */
  private registerBuiltInCleanup(): void {
    // Kill processes first (highest priority)
    this.registerCleanup(
      () => this.processes.killAll(),
      Priority.CRITICAL,
      'kill-processes'
    );

    // Close mocks and spies
    this.registerCleanup(
      () => this.mocks.restoreAll(),
      Priority.HIGH,
      'restore-mocks'
    );

    // Clear timers
    this.registerCleanup(
      () => this.timers.clearAll(),
      Priority.HIGH,
      'clear-timers'
    );

    // Restore environment
    this.registerCleanup(
      () => this.env.restore(),
      Priority.NORMAL,
      'restore-environment'
    );

    // Clean up file system last (lowest priority)
    this.registerCleanup(
      async () => this.files.cleanup(),
      Priority.FINAL,
      'cleanup-filesystem'
    );
  }
}

/**
 * Create a new isolated test context.
 *
 * This is the primary factory function for test isolation.
 * It creates a unique temporary directory and initializes all isolation utilities.
 *
 * @param options - Configuration options
 * @returns Promise resolving to an isolated test context
 *
 * @example
 * ```typescript
 * // Basic usage
 * const ctx = await createIsolatedTest();
 *
 * // With options
 * const ctx = await createIsolatedTest({
 *   prefix: 'integration',
 *   withDatabase: true,
 *   withMocks: true,
 * });
 *
 * try {
 *   // Use ctx.files, ctx.env, ctx.mocks, etc.
 * } finally {
 *   await ctx.teardown();
 * }
 * ```
 */
export async function createIsolatedTest(
  options: IsolationOptions = {}
): Promise<IsolatedTestContext> {
  const prefix = options.prefix ?? 'test';
  const tempBase = options.tempBase ?? os.tmpdir();

  // Create unique temporary directory
  const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const tempDir = path.join(tempBase, `apex-${prefix}-${uniqueId}`);
  await fs.mkdir(tempDir, { recursive: true });

  return new IsolatedTestContextImpl(tempDir, options);
}

/**
 * Run a function with an isolated test context.
 *
 * Ensures cleanup happens even if the function throws.
 * This is the recommended pattern for tests that need isolation.
 *
 * @param fn - Function to run with isolation context
 * @param options - Configuration options
 * @returns Promise resolving to the function's return value
 *
 * @example
 * ```typescript
 * it('should work', async () => {
 *   await withIsolation(async (ctx) => {
 *     const file = await ctx.files.createTempFile('data.json', '{}');
 *     // Even if this throws, cleanup happens
 *     await someOperationThatMightFail();
 *   });
 * });
 * ```
 */
export async function withIsolation<T>(
  fn: (ctx: IsolatedTestContext) => Promise<T>,
  options: IsolationOptions & { suppressCleanupErrors?: boolean } = {}
): Promise<T> {
  const ctx = await createIsolatedTest(options);

  try {
    return await fn(ctx);
  } finally {
    const result = await ctx.teardown();
    if (!result.success && !options.suppressCleanupErrors) {
      console.warn(
        `Isolation cleanup had ${result.errors.length} errors:`,
        result.errors.map(e => e.message).join(', ')
      );
    }
  }
}

/**
 * Create a test context factory for use with beforeEach/afterEach.
 *
 * This helper creates a reusable setup pattern for test suites.
 *
 * @param options - Default options for all contexts
 * @returns Object with setup and teardown functions
 *
 * @example
 * ```typescript
 * describe('Feature', () => {
 *   const { setup, teardown, getContext } = createTestContextFactory({
 *     prefix: 'feature',
 *     withDatabase: true,
 *   });
 *
 *   beforeEach(setup);
 *   afterEach(teardown);
 *
 *   it('should work', async () => {
 *     const ctx = getContext();
 *     // Use ctx
 *   });
 * });
 * ```
 */
export function createTestContextFactory(options: IsolationOptions = {}): {
  setup: () => Promise<void>;
  teardown: () => Promise<void>;
  getContext: () => IsolatedTestContext;
} {
  let currentContext: IsolatedTestContext | null = null;

  return {
    async setup() {
      currentContext = await createIsolatedTest(options);
    },

    async teardown() {
      if (currentContext) {
        await currentContext.teardown();
        currentContext = null;
      }
    },

    getContext() {
      if (!currentContext) {
        throw new Error('Test context not initialized. Did you forget to call setup()?');
      }
      return currentContext;
    },
  };
}
