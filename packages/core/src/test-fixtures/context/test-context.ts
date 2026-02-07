/**
 * @fileoverview TestContext Implementation
 *
 * Provides a TestContext class for unique test isolation. Each TestContext instance
 * generates unique identifiers, provides isolated namespaces for test data, and
 * manages test-scoped resources with automatic cleanup.
 *
 * @example Basic Usage
 * ```typescript
 * import { createTestContext } from '@apex/core/test-fixtures';
 *
 * describe('My Test Suite', () => {
 *   let ctx: TestContext;
 *
 *   beforeEach(() => {
 *     ctx = createTestContext({ suiteName: 'My Suite' });
 *   });
 *
 *   afterEach(async () => {
 *     await ctx.cleanup();
 *   });
 *
 *   it('should use isolated identifiers', () => {
 *     const taskId = ctx.uniqueTaskId();
 *     expect(taskId).toMatch(/^task_test_\d+_/);
 *   });
 * });
 * ```
 *
 * @example With Temp Directory
 * ```typescript
 * it('should create isolated temp files', async () => {
 *   const dir = await ctx.createTempDir();
 *   await ctx.writeFile('config.json', '{"key": "value"}');
 *   // Directory is automatically cleaned up in afterEach
 * });
 * ```
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import type {
  TestContext,
  TestContextOptions,
  TestContextFactory,
  UseTestContextResult,
} from './types.js';

/**
 * Default options for TestContext
 */
const DEFAULT_OPTIONS: Required<Omit<TestContextOptions, 'seed' | 'metadata' | 'suiteName' | 'testName'>> & {
  seed: string | undefined;
  metadata: Record<string, unknown> | undefined;
  suiteName: string | undefined;
  testName: string | undefined;
} = {
  namespacePrefix: 'test',
  seed: undefined,
  tempBasePath: os.tmpdir(),
  createTempDirOnInit: false,
  metadata: undefined,
  suiteName: undefined,
  testName: undefined,
};

/**
 * Generates a random alphanumeric string
 */
function randomString(length: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * TestContext implementation class
 */
class TestContextImpl implements TestContext {
  readonly testId: string;
  readonly namespace: string;
  readonly createdAt: Date;
  readonly options: Readonly<TestContextOptions>;

  private _idSequence = 0;
  private _data: Map<string, unknown> = new Map();
  private _cleanupTasks: Array<() => Promise<void> | void> = [];
  private _tempDir: string | undefined;
  private _isCleanedUp = false;

  constructor(options: TestContextOptions = {}) {
    this.createdAt = new Date();
    this.options = { ...DEFAULT_OPTIONS, ...options };

    const prefix = this.options.namespacePrefix || 'test';
    const seed = this.options.seed || `${Date.now()}_${randomString(8)}`;

    this.testId = `${prefix}_${seed}`;
    this.namespace = this.testId;
  }

  // ============================================================================
  // ID Generation
  // ============================================================================

  get idSequence(): number {
    return this._idSequence;
  }

  uniqueId(prefix?: string): string {
    const seq = ++this._idSequence;
    const base = `${this.testId}_${seq}`;
    return prefix ? `${prefix}_${base}` : base;
  }

  uniqueTaskId(): string {
    const seq = ++this._idSequence;
    return `task_${this.testId}_${seq}`;
  }

  uniqueSessionId(): string {
    const seq = ++this._idSequence;
    return `sess_${this.testId}_${seq}`;
  }

  uniqueAgentId(): string {
    const seq = ++this._idSequence;
    return `agent_${this.testId}_${seq}`;
  }

  uniqueWorkflowId(): string {
    const seq = ++this._idSequence;
    return `wf_${this.testId}_${seq}`;
  }

  uniqueCheckpointId(): string {
    const seq = ++this._idSequence;
    return `checkpoint_${this.testId}_${seq}`;
  }

  // ============================================================================
  // Namespace Utilities
  // ============================================================================

  namespacedPath(basePath: string): string {
    // Insert namespace as a directory component
    const dir = path.dirname(basePath);
    const base = path.basename(basePath);
    return path.join(dir, this.namespace, base);
  }

  namespacedKey(key: string): string {
    return `${this.namespace}:${key}`;
  }

  namespacedTable(tableName: string): string {
    // Replace hyphens with underscores for SQL compatibility
    const safeNamespace = this.namespace.replace(/-/g, '_');
    return `${tableName}_${safeNamespace}`;
  }

  namespacedEnv(envKey: string): string {
    const safeNamespace = this.namespace.toUpperCase().replace(/-/g, '_');
    return `${safeNamespace}_${envKey.toUpperCase()}`;
  }

  // ============================================================================
  // Data Store
  // ============================================================================

  getData<T>(key: string): T | undefined {
    return this._data.get(key) as T | undefined;
  }

  setData<T>(key: string, value: T): void {
    this._data.set(key, value);
  }

  hasData(key: string): boolean {
    return this._data.has(key);
  }

  deleteData(key: string): boolean {
    return this._data.delete(key);
  }

  clearData(): void {
    this._data.clear();
  }

  // ============================================================================
  // Lifecycle Management
  // ============================================================================

  addCleanupTask(task: () => Promise<void> | void): void {
    if (this._isCleanedUp) {
      console.warn('TestContext: Adding cleanup task to already cleaned up context');
    }
    this._cleanupTasks.push(task);
  }

  async cleanup(): Promise<void> {
    if (this._isCleanedUp) {
      return;
    }

    // Run cleanup tasks in LIFO order
    const tasks = [...this._cleanupTasks].reverse();
    for (const task of tasks) {
      try {
        await task();
      } catch (error) {
        console.warn('TestContext cleanup task failed:', error);
      }
    }

    // Clean up temp directory if it exists
    if (this._tempDir) {
      try {
        await fs.rm(this._tempDir, { recursive: true, force: true });
      } catch (error) {
        console.warn('TestContext: Failed to clean up temp directory:', error);
      }
    }

    // Clear all state
    this._cleanupTasks = [];
    this._data.clear();
    this._tempDir = undefined;
    this._isCleanedUp = true;
  }

  isCleanedUp(): boolean {
    return this._isCleanedUp;
  }

  // ============================================================================
  // Directory Management
  // ============================================================================

  async createTempDir(): Promise<string> {
    if (this._tempDir) {
      return this._tempDir;
    }

    const basePath = this.options.tempBasePath || os.tmpdir();
    this._tempDir = await fs.mkdtemp(path.join(basePath, `apex-${this.testId}-`));

    return this._tempDir;
  }

  getTempDir(): string | undefined {
    return this._tempDir;
  }

  async createSubDir(subPath: string): Promise<string> {
    const tempDir = await this.createTempDir();
    const fullPath = path.join(tempDir, subPath);
    await fs.mkdir(fullPath, { recursive: true });
    return fullPath;
  }

  async writeFile(relativePath: string, content: string): Promise<string> {
    const tempDir = await this.createTempDir();
    const fullPath = path.join(tempDir, relativePath);

    // Ensure parent directory exists
    const parentDir = path.dirname(fullPath);
    await fs.mkdir(parentDir, { recursive: true });

    await fs.writeFile(fullPath, content, 'utf-8');
    return fullPath;
  }
}

/**
 * Creates a new TestContext instance for test isolation.
 *
 * @param options - Optional configuration for the context
 * @returns A new TestContext instance
 *
 * @example
 * ```typescript
 * const ctx = createTestContext();
 * const taskId = ctx.uniqueTaskId(); // 'task_test_1234567890_abcd1234_1'
 * ```
 *
 * @example With custom namespace
 * ```typescript
 * const ctx = createTestContext({ namespacePrefix: 'integration' });
 * const path = ctx.namespacedPath('/data/file.txt');
 * // '/data/integration_1234567890_abcd1234/file.txt'
 * ```
 */
export const createTestContext: TestContextFactory = (options?: TestContextOptions): TestContext => {
  return new TestContextImpl(options);
};

/**
 * Hook-based approach for integrating TestContext with Vitest describe/it blocks.
 *
 * @returns An object with context, setup, and teardown functions
 *
 * @example
 * ```typescript
 * describe('My Test Suite', () => {
 *   const { context: ctx, setup, teardown } = useTestContext();
 *
 *   beforeEach(setup);
 *   afterEach(teardown);
 *
 *   it('should have isolated context', () => {
 *     const id = ctx.uniqueId('item');
 *     expect(id).toContain('test_');
 *   });
 * });
 * ```
 */
export function useTestContext(options?: TestContextOptions): UseTestContextResult {
  let context: TestContext = createTestContext(options);

  return {
    get context() {
      return context;
    },
    setup() {
      // Create fresh context for each test
      context = createTestContext(options);
    },
    teardown: async () => {
      await context.cleanup();
    },
  };
}

/**
 * Creates a TestContext that's pre-configured for integration tests.
 * Automatically creates a temp directory on initialization.
 *
 * @param options - Additional options to merge
 * @returns A TestContext configured for integration testing
 */
export function createIntegrationTestContext(options?: TestContextOptions): TestContext {
  const ctx = createTestContext({
    namespacePrefix: 'integration',
    createTempDirOnInit: true,
    ...options,
  });

  // Schedule temp dir creation (lazy, but indicated as intended)
  return ctx;
}

/**
 * Creates a TestContext that's pre-configured for unit tests.
 * Lightweight, no temp directory by default.
 *
 * @param options - Additional options to merge
 * @returns A TestContext configured for unit testing
 */
export function createUnitTestContext(options?: TestContextOptions): TestContext {
  return createTestContext({
    namespacePrefix: 'unit',
    ...options,
  });
}
