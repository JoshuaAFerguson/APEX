/**
 * Test context management utilities
 * Provides context management for test setup, teardown, and shared state
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { vi } from 'vitest';

/**
 * Test context interface for managing test state and resources
 */
export interface TestContext {
  /** Unique ID for this test context */
  id: string;
  /** Temporary directory for this test */
  tempDir: string;
  /** Cleanup functions to run on teardown */
  cleanupFunctions: Array<() => void | Promise<void>>;
  /** Shared data between test phases */
  data: Record<string, any>;
  /** Test start time */
  startTime: Date;
}

/**
 * Create a new test context with automatic cleanup
 */
export async function createTestContext(contextId?: string): Promise<TestContext> {
  const id = contextId || `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), `apex-test-${id}-`));

  const context: TestContext = {
    id,
    tempDir,
    cleanupFunctions: [],
    data: {},
    startTime: new Date(),
  };

  // Add default cleanup for temp directory
  context.cleanupFunctions.push(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn(`Failed to cleanup temp directory ${tempDir}:`, error);
    }
  });

  return context;
}

/**
 * Add a cleanup function to the test context
 */
export function addCleanup(context: TestContext, cleanup: () => void | Promise<void>): void {
  context.cleanupFunctions.push(cleanup);
}

/**
 * Clean up all resources in the test context
 */
export async function cleanupTestContext(context: TestContext): Promise<void> {
  const errors: Error[] = [];

  // Run cleanup functions in reverse order (LIFO)
  for (const cleanup of context.cleanupFunctions.reverse()) {
    try {
      await cleanup();
    } catch (error) {
      errors.push(error instanceof Error ? error : new Error(String(error)));
    }
  }

  // Reset cleanup functions
  context.cleanupFunctions.length = 0;

  if (errors.length > 0) {
    const errorMessage = errors.map(e => e.message).join('; ');
    throw new Error(`Cleanup errors: ${errorMessage}`);
  }
}

/**
 * Create a temporary file in the test context
 */
export async function createTempFile(
  context: TestContext,
  filename: string,
  content: string = ''
): Promise<string> {
  const filePath = path.join(context.tempDir, filename);

  // Ensure directory exists
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });

  await fs.writeFile(filePath, content, 'utf8');
  return filePath;
}

/**
 * Create a temporary directory in the test context
 */
export async function createTempDir(
  context: TestContext,
  dirname: string
): Promise<string> {
  const dirPath = path.join(context.tempDir, dirname);
  await fs.mkdir(dirPath, { recursive: true });
  return dirPath;
}

/**
 * Mock manager for handling vitest mocks in test context
 */
export class MockManager {
  private mocks: Array<{ restore: () => void }> = [];

  /**
   * Create a spy on an object method
   */
  spyOn<T extends Record<string, any>, K extends keyof T>(
    object: T,
    method: K
  ): ReturnType<typeof vi.spyOn> {
    const spy = vi.spyOn(object, method);
    this.mocks.push({ restore: () => spy.mockRestore() });
    return spy;
  }

  /**
   * Mock a module
   */
  mock(modulePath: string, factory?: () => any): void {
    vi.mock(modulePath, factory);
    this.mocks.push({ restore: () => vi.unmock(modulePath) });
  }

  /**
   * Create a mock function
   */
  fn<T extends (...args: any[]) => any>(implementation?: T): ReturnType<typeof vi.fn> {
    const mockFn = vi.fn(implementation);
    // Note: vi.fn mocks don't need explicit cleanup in vitest
    return mockFn;
  }

  /**
   * Restore all mocks
   */
  restoreAll(): void {
    for (const mock of this.mocks) {
      try {
        mock.restore();
      } catch (error) {
        console.warn('Failed to restore mock:', error);
      }
    }
    this.mocks.length = 0;
    vi.clearAllMocks();
  }
}

/**
 * Extended test context with mock management
 */
export interface ExtendedTestContext extends TestContext {
  mocks: MockManager;
}

/**
 * Create an extended test context with mock management
 */
export async function createExtendedTestContext(contextId?: string): Promise<ExtendedTestContext> {
  const baseContext = await createTestContext(contextId);
  const mockManager = new MockManager();

  // Add mock cleanup to context cleanup
  addCleanup(baseContext, () => mockManager.restoreAll());

  return {
    ...baseContext,
    mocks: mockManager,
  };
}

/**
 * Event tracker for testing event-driven systems
 */
export class EventTracker {
  public events: Array<{ type: string; data?: any; timestamp: Date }> = [];

  /**
   * Record an event
   */
  record(type: string, data?: any): void {
    this.events.push({
      type,
      data,
      timestamp: new Date(),
    });
  }

  /**
   * Clear all recorded events
   */
  clear(): void {
    this.events.length = 0;
  }

  /**
   * Get events of a specific type
   */
  getEventsByType(type: string): Array<{ type: string; data?: any; timestamp: Date }> {
    return this.events.filter(event => event.type === type);
  }

  /**
   * Get the latest event of a specific type
   */
  getLatestEvent(type: string): { type: string; data?: any; timestamp: Date } | undefined {
    const events = this.getEventsByType(type);
    return events[events.length - 1];
  }

  /**
   * Check if an event was recorded
   */
  hasEvent(type: string, data?: any): boolean {
    return this.events.some(event =>
      event.type === type &&
      (data === undefined || JSON.stringify(event.data) === JSON.stringify(data))
    );
  }

  /**
   * Wait for a specific event to be recorded
   */
  async waitForEvent(
    type: string,
    timeout: number = 5000,
    predicate?: (data: any) => boolean
  ): Promise<any> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const event = this.getLatestEvent(type);
      if (event && (!predicate || predicate(event.data))) {
        return event.data;
      }
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    throw new Error(`Event '${type}' was not recorded within ${timeout}ms`);
  }
}

/**
 * Database context for tests that need database setup
 */
export interface DatabaseTestContext extends ExtendedTestContext {
  dbPath: string;
}

/**
 * Create a test context with SQLite database setup
 */
export async function createDatabaseTestContext(contextId?: string): Promise<DatabaseTestContext> {
  const baseContext = await createExtendedTestContext(contextId);
  const dbPath = path.join(baseContext.tempDir, 'test.db');

  return {
    ...baseContext,
    dbPath,
  };
}

/**
 * Timer utilities for testing timing-dependent code
 */
export class TestTimer {
  private startTime: number = 0;
  private endTime: number = 0;

  /**
   * Start the timer
   */
  start(): void {
    this.startTime = Date.now();
  }

  /**
   * Stop the timer and return elapsed time
   */
  stop(): number {
    this.endTime = Date.now();
    return this.getElapsed();
  }

  /**
   * Get elapsed time since start
   */
  getElapsed(): number {
    const end = this.endTime || Date.now();
    return end - this.startTime;
  }

  /**
   * Reset the timer
   */
  reset(): void {
    this.startTime = 0;
    this.endTime = 0;
  }
}

/**
 * Create a test timer and add it to context
 */
export function createTestTimer(context: TestContext, name: string): TestTimer {
  const timer = new TestTimer();
  context.data[`timer_${name}`] = timer;
  return timer;
}

/**
 * Retry wrapper for flaky test operations
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxAttempts: number = 3,
  delay: number = 100
): Promise<T> {
  let attempt = 1;
  let lastError: Error;

  while (attempt <= maxAttempts) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === maxAttempts) {
        throw lastError;
      }

      await new Promise(resolve => setTimeout(resolve, delay));
      attempt++;
    }
  }

  throw lastError!;
}